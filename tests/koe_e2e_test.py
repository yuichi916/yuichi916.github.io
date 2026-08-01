# -*- coding: utf-8 -*-
"""koe.html の通し検証。ローカルHTTPを自前で立てて Playwright で回す。

  set PYTHONUTF8=1 && python tests/koe_e2e_test.py

守っているのは設計書10章の「本作固有の必須チェック3つ」:

  検証1 セイレンの無音 — v:1 でないセイレンの台詞は、どの経路からも音を鳴らさない。
  検証2 地の文の2系統 — 同じ本文が1周目は _k(カナタ)、2周目は _r(セイレン)で読まれる。
                        1周目でも終盤の {narrator:'ren'} 以降だけは _r になる——それが
                        仕掛けの開示そのものなので、「1周目は全部 _k」ではなく
                        「彼女が声を出す前に _r は無い／開示後は確かに _r になる」を見る。
  検証3 起動時の声    — タップゲートが一度だけ開き、その裏で声を1本鳴らしにいく。

「素通りしないこと」をこのファイル自身が担保する仕掛け:
  - 無音チェックは backlog と突き合わせる。対象の台詞を実際に読み終えたことを
    確かめてから「鳴っていない」と言う（読まずに素通りしても合格、を封じる）。
  - 無音チェックは3本の物差しで見る: playVoice() のログ／#voice の src 属性／
    台詞ボイスの本数。前2つは voiceFile() が作った名前どうしの照合なので、
    命名規則ごと変えられると共倒れになる。本数は名前に依存しない。
  - 地の文チェックも backlog と突き合わせる。読んだ地の文すべてにボイス参照が
    あることまで見る（1本も鳴らないビルドで合格、を封じる）。
  - SKIP/AUTO が入っていないことを先に確かめる。SKIP中の renderSay() は
    声の分岐に到達せず抜けるので、ログが空になるのは「守れている」証拠にならない。
  - cfg.voice>0 を確かめる。0だと playVoice() は src を触らずに抜け、src側の
    物差しが丸ごと死ぬ。
  - 通し再生は「タイトルに戻った」だけでは終わりにせず、completeRound() が
    走った痕跡(st.roundDone / st.round)まで確認する。反復回数を使い切って
    素通りする経路は無い（回数ではなく壁時計と進行停滞で判定し、必ず落とす）。

意図的に見ていないこと（別の道具の担当・または前提が未成立）:
  - ファイルが実在するか・中身が正しいか。ここで見ているのは「エンジンがどの
    ファイルを掴みにいったか」だけ。実在と棚卸しは scripts/koe/voice_audit.py と
    tests/koe_audit_test.py、音そのものは tests/koe_synth_test.py の担当。
  - __koeGate.ended===true（＝声を最後まで鳴らし切ったか）。title-koe.mp3 は
    Plan 2 まで存在せず、今日の健全なビルドでは必ず false になる。ここで真を
    要求すると正しいビルドが落ちるので、開いた回数と理由までで止めてある。
  - 分岐網羅。選択肢は常に先頭を選ぶので、2つ目の reply と when の偽枝は通らない。
  - BGM・効果音・立ち絵・背景の見た目。BGMは tests/koe_bgm_test.py の担当。
"""
import subprocess, sys, time, socket, os
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("KOE_E2E_PORT", "8099"))
URL = f"http://127.0.0.1:{PORT}/koe.html"

# 1周ぶんの壁時計予算と、進行停滞とみなすまでの無変化時間（秒）。
# カード(hold 4.2s+0.7s)・採取フラッシュ(1.4s+0.42s)・モンタージュが最長の「無変化」区間。
PLAY_BUDGET = 300
STALL_AFTER = 25

# --- ページ側ヘルパ ---------------------------------------------------------

# プレイヤーと同じ入口を叩く。選択肢だけは actionability チェックで詰まるので JS の .click()。
# #adv も #scard(z-index:30) に覆われることがあるため同様に .click() で送る。
# どちらも #stage のクリックハンドラまでバブルするので、経路はプレイヤーと同じ。
STEP_JS = """() => {
  const ch = document.querySelector('#choices.show .choice');
  if (ch) { ch.click(); return 'choice'; }
  const hint = document.getElementById('exhint');
  if (hint && hint.classList.contains('show')) {
    const hs = document.getElementById('hs');
    if (hs && hs.classList.contains('show') && !hs.classList.contains('arrow')) { hs.click(); return 'hotspot'; }
    document.getElementById('exskip').click(); return 'exskip';
  }
  const card = document.getElementById('scard');
  if (card && card.classList.contains('show')) { card.click(); return 'card'; }
  const a = document.getElementById('adv');
  if (a) { a.click(); return 'adv'; }
  return 'none';
}"""

AT_TITLE_JS = """() => { const t = document.getElementById('title');
  return t.classList.contains('ready') && !t.classList.contains('gone'); }"""

# 進行しているかどうかの指紋。これが変わらなくなったら「詰まった」と判断する。
PROGRESS_JS = """() => ({
  scene: st.scene, i: cur ? cur.i : -1, stack: stack.length,
  mem: st.mem.length, synth: st.synth, log: window.__koeVoiceLog.length,
  src: window.__koeSrcLog.length, backlog: backlog.length,
  locked: locked, ex: _exOpen,
  choices: document.getElementById('choices').classList.contains('show')
})"""

WHERE_JS = """() => { try { return beatAddr(); } catch(e) { return '(beatAddr失敗: '+e.message+')'; } }"""

# #voice の src を直接見る第2の経路。playVoice() は __koeVoiceLog に積むが、
# tryVoice()/playFinalVoice() は v.src へ直接代入するのでログに載らない。
# src属性の変化を拾えば、エンジンが実際に音源として掴んだものを取りこぼさない。
INSTALL_SRC_SPY_JS = """() => {
  if (window.__koeSrcLog) return true;
  window.__koeSrcLog = [];
  const v = document.getElementById('voice');
  if (!v) return false;
  const rec = () => { const s = v.getAttribute('src'); if (s) window.__koeSrcLog.push(s); };
  new MutationObserver(rec).observe(v, { attributes: true, attributeFilter: ['src'] });
  rec();
  return true;
}"""


def wait_port(port, timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with socket.create_connection(("127.0.0.1", port), 0.4):
                return True
        except OSError:
            time.sleep(0.2)
    return False


def base(path):
    """srcLog は属性の生値。相対でも絶対でも比較できるよう末尾要素で見る。"""
    return path.rsplit("/", 1)[-1]


# ボイスのファイル名は voiceFile() が決める: 地の文は n<hash>_k|_r.mp3、台詞は v<hash>.mp3。
# パス全体に対する部分一致（"/n" など）で見分けると "…/voice/…" の v と衝突するので、
# 必ずファイル名の先頭で判定する。
def is_narr(f):
    return base(f).startswith("n")


def is_line(f):
    return base(f).startswith("v")


def play_through(pg, label):
    """タイトルに戻るまでプレイヤーと同じ入口で進める。
    反復回数ではなく壁時計と進行停滞で打ち切るので、「回数を使い切ったので合格」は起きない。"""
    t0 = time.time()
    last, last_change = None, time.time()
    while True:
        if pg.evaluate(AT_TITLE_JS):
            return time.time() - t0
        now = time.time()
        if now - t0 > PLAY_BUDGET:
            raise AssertionError(
                f"{label}: {PLAY_BUDGET}秒でエンディングに到達しなかった（進行不能）。"
                f"停止位置: {pg.evaluate(WHERE_JS)} / 状態: {pg.evaluate(PROGRESS_JS)}")
        sig = pg.evaluate(PROGRESS_JS)
        if sig != last:
            last, last_change = sig, now
        elif now - last_change > STALL_AFTER:
            raise AssertionError(
                f"{label}: {STALL_AFTER}秒進行が止まった（onerrorで先へ進めていないビートがある）。"
                f"停止位置: {pg.evaluate(WHERE_JS)} / 状態: {sig}")
        pg.evaluate(STEP_JS)
        pg.wait_for_timeout(110)


def check_silence(pg, log, srclog, label, since=0):
    """検証1: v:1 でないセイレンの台詞が、実際に読まれた上で1音も鳴っていないこと。

    since は backlog の開始位置。周ごとに切り出さないと、前の周に読んだ分で
    「読んだこと」の確認が通ってしまい、その周ぶんの空回りを見逃す。"""
    info = pg.evaluate("""(since) => {
      const silent = [], voiced = [];
      (window.KOE.ep1.scenes || []).forEach(function walk(n) {
        if (Array.isArray(n)) { n.forEach(walk); return; }
        if (!n || typeof n !== 'object') return;
        if (n.say === 'ren') (n.v ? voiced : silent).push(n.text);
        for (const k in n) walk(n[k]);
      });
      return {
        silent: silent,
        silentFiles: silent.map(t => voiceFile('ren', t)),
        voicedFiles: voiced.map(t => voiceFile('ren', t)),
        renRead: backlog.slice(since).filter(r => r.who === 'ren').map(r => r.text),
        /* この周に読んだ行のうち「鳴るはず」の本数。
           renderSay() と同じ規則で数える: カナタ/トキは丸括弧始まり(心の声)を除く。
           セイレンは名前欄が出た行だけ——nameFor() が b.v を見て 'セイレン' か '—' を
           返すので、backlog の name がそのまま v:1 の記録になっている。 */
        expected: backlog.slice(since).filter(r =>
          ((r.who === 'kanata' || r.who === 'toki') && !/^[（(]/.test((r.text||'').trim()))
          || (r.who === 'ren' && r.name === 'セイレン')).length
      };
    }""", since)
    assert info["silent"], f"{label}: 台本に無音のセイレン台詞が1つも無い（このチェックが空回りする）"
    unread = [t for t in info["silent"] if t not in info["renRead"]]
    assert not unread, (f"{label}: 無音のはずのセイレン台詞を読まずに終わった＝検証が空回りしている: {unread}")
    leaked = [f for f in info["silentFiles"] if f in log]
    assert leaked == [], f"{label}: セイレンの無音が破れている(playVoiceのログ): {leaked}"
    sl = set(base(s) for s in srclog)
    leaked2 = [f for f in info["silentFiles"] if base(f) in sl]
    assert leaked2 == [], f"{label}: セイレンの無音が破れている(#voiceのsrc): {leaked2}"
    # 3本目の物差し。上2つは voiceFile() が作った名前どうしの照合なので、
    # voiceFile() の命名規則ごと変えられると期待側と実測側が一緒に動いて共倒れになる。
    # 本数だけは名前に依存しない: 無音のはずの行が1本でも鳴れば、必ず期待より増える。
    actual = len([f for f in log if is_line(f)])
    assert actual == info["expected"], (
        f"{label}: 台詞ボイスの本数が読んだ行と合わない（無音のはずの行が鳴った/鳴るはずの行が死んだ）: "
        f"期待 {info['expected']}本 / 実測 {actual}本")
    return info


def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)],
                           cwd=str(ROOT), stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL)
    try:
        assert wait_port(PORT), "ローカルHTTPが起動しない"
        with sync_playwright() as pw:
            br = pw.chromium.launch(args=["--use-gl=swiftshader",
                                          "--autoplay-policy=no-user-gesture-required"])
            pg = br.new_page()
            errors = []
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.goto(URL)
            pg.wait_for_selector("#gate")
            pg.wait_for_selector("#voice", state="attached")
            assert pg.evaluate(INSTALL_SRC_SPY_JS), "#voice が見つからない"

            # --- 検証3: タイトルの声が鳴るか ---
            # 注意: `ended` は本物の onended でのみ true になる。title-koe.mp3 は
            # Plan 2 まで存在しないので、今日の健全なビルドでは常に false
            # （404 → play() が NotSupportedError で reject → reason:'rejected'）。
            # ここで ended===true を待つとハングする。revealCount で待つこと。
            pg.evaluate("document.getElementById('gate').click()")
            try:
                pg.wait_for_function("window.__koeGate && window.__koeGate.revealCount >= 1",
                                     timeout=12000)
            except PWTimeout:
                raise AssertionError(
                    "ゲートをタップしても声を鳴らす経路に入らなかった（__koeGate.revealCount が 0 のまま）。"
                    "画面だけ開いて声が死んでいる＝終盤の「あのとき聞いた声」が成立しない。"
                    f" 現在値: {pg.evaluate('window.__koeGate')}")
            gate = pg.evaluate("window.__koeGate")
            assert gate["played"] is True, f"タイトル声を鳴らしにいっていない: {gate}"
            assert gate["revealCount"] == 1, f"ゲートが複数回開いた: {gate}"
            assert gate["reason"] in ("ended", "error", "timeout", "rejected", "threw"), gate
            assert pg.evaluate("document.getElementById('gate').classList.contains('gone')"), \
                "ゲートが開いていない（黒画面のまま）"
            assert pg.evaluate("document.getElementById('title').classList.contains('ready')"), \
                "タイトルが出ていない"

            # --- 台本が全ビート型を含むこと（スタブの退化を防ぐ） ---
            kinds = pg.evaluate("""() => {
              const ks = new Set();
              (window.KOE.ep1.scenes||[]).forEach(s=>(s.beats||[]).forEach(b=>
                Object.keys(b).forEach(k=>ks.add(k))));
              return [...ks];
            }""")
            for need in ["pickup", "tryvoice", "narrator", "montage",
                         "finalvoice", "title", "choose"]:
                assert need in kinds, f"台本に {need} ビートが無い"

            # --- 前提: 声の経路が生きていること ---
            # cfg.voice<=0 だと playVoice() は src を触らずに抜けるので、
            # #voice の src を見る第2経路が丸ごと死ぬ（そして無音チェックが空回りする）。
            assert pg.evaluate("cfg.voice") > 0, "ボイス音量が0。srcを見る検証が空回りする"

            # --- 1周目: 通し再生（開始はプレイヤーと同じ「はじめから」ボタン） ---
            # ボタンは台本ロード検査の成功時にだけ解禁される。無効のままなら押しても
            # 何も起きず、以降の検証がまるごと空回りするので先に確かめる。
            assert pg.evaluate("!document.getElementById('tStart').disabled"), \
                "「はじめから」が無効のまま（台本ロード検査が通っていない）"
            pg.evaluate("window.__koeVoiceLog=[]; window.__koeSrcLog=[]")
            n0 = pg.evaluate("backlog.length")
            pg.evaluate("document.getElementById('tStart').click()")
            pg.wait_for_function("document.getElementById('title').classList.contains('gone')",
                                 timeout=5000)
            assert pg.evaluate("st.narr") == "kanata", \
                f"1周目の地の文がカナタになっていない: {pg.evaluate('st.narr')}"
            elapsed1 = play_through(pg, "1周目")

            # 「タイトルが見えた」だけでは完走の証明にならない（中断でも同じ絵になる）。
            # round を進める唯一の関数 completeRound() が走った痕跡まで見る。
            r1 = pg.evaluate("() => ({round: st.round, done: st.roundDone, cleared: st.cleared})")
            assert r1["done"] is True and r1["round"] >= 2, \
                f"完走していない（completeRound未通過）: {r1}"

            # SKIP/AUTO が入っていると renderSay() は声の分岐の手前で抜ける。
            # その状態のログは「無音が守られている」証拠にならないので先に潰す。
            mode = pg.evaluate("() => ({skip: skipOn, auto: autoOn})")
            assert mode["skip"] is False and mode["auto"] is False, \
                f"SKIP/AUTOが入った状態で計測している（検証が空回りする）: {mode}"

            log1 = pg.evaluate("window.__koeVoiceLog")
            src1 = pg.evaluate("window.__koeSrcLog")
            assert log1, "1周目でボイスが1本も参照されていない"
            assert src1, "1周目で #voice に音源が1本も渡っていない"

            # --- 検証1: セイレンの無音が守られているか（1周目） ---
            info1 = check_silence(pg, log1, src1, "1周目", since=n0)

            # --- 検証2: 地の文が1周目は _k で参照されているか ---
            # 1周目でも終盤の {narrator:'ren'} 以降だけは _r になる（それが仕掛けの開示そのもの）。
            # なので「1周目は全部 _k」ではなく「彼女が声を出す前は _k、_r は開示より後だけ」を見る。
            # 境界は彼女の v:1 の台詞がボイス参照された位置。エンジンは {narrator:'ren'} を
            # それより前に置くと throw するので、この位置は開示の下限として使える。
            narr1 = [f for f in log1 if is_narr(f)]
            assert narr1, "地の文のボイスが1本も参照されていない"
            voiced_ren = set(info1["voicedFiles"])
            reveal_at = next((i for i, f in enumerate(log1) if f in voiced_ren), None)
            assert reveal_at is not None, \
                "セイレンの v:1 の台詞が1周目で鳴っていない（開示の位置が決められない）"
            pre = [f for i, f in enumerate(log1) if is_narr(f) and i < reveal_at]
            post_r = [f for i, f in enumerate(log1) if is_narr(f) and i > reveal_at
                      and f.endswith("_r.mp3")]
            early_r = [f for i, f in enumerate(log1) if is_narr(f) and i < reveal_at
                       and f.endswith("_r.mp3")]
            assert pre, "開示より前に地の文のボイスが1本も無い（このチェックが空回りする）"
            assert early_r == [], f"1周目、彼女が声を出す前に地の文が _r で読まれた: {early_r}"
            assert all(f.endswith("_k.mp3") for f in pre), \
                f"開示より前の地の文が _k になっていない: {[f for f in pre if not f.endswith('_k.mp3')]}"
            assert post_r, ("{narrator:'ren'} を通ったのに地の文が _r に切り替わっていない"
                            f"（1周目の地の文 {len(narr1)}本すべて _k のまま）")
            # 読んだ地の文すべてにボイス参照があること（数本だけ鳴って合格、を封じる）。
            # どちらの系統かは上で見ているので、ここは「1本も引かれていない」だけを潰す。
            miss1 = pg.evaluate("""(log) => backlog.slice(%d).filter(r=>r.who==='narr')
              .filter(r => !log.includes(voiceFile('kanata', r.text, 'narr'))
                        && !log.includes(voiceFile('ren', r.text, 'narr')))
              .map(r=>r.text);""" % n0, log1)
            assert miss1 == [], f"1周目: 読んだのにボイス参照が無い地の文がある: {miss1}"

            # --- 2周目: 同じ地の文が _r で読まれるか ---
            # st.round は startGame() の冒頭 freshState(keep) で持ち越され、
            # そのすぐ後の st.narr 決定に使われる（＝最初の1行が出る前に効く）。
            n_before = pg.evaluate("backlog.length")
            pg.evaluate("st.round = 2")
            pg.evaluate("window.__koeVoiceLog=[]; window.__koeSrcLog=[]")
            pg.evaluate("document.getElementById('tStart').click()")
            pg.wait_for_function("document.getElementById('title').classList.contains('gone')",
                                 timeout=5000)
            assert pg.evaluate("st.narr") == "ren", \
                f"2周目の地の文がセイレンになっていない: {pg.evaluate('st.narr')}"
            elapsed2 = play_through(pg, "2周目")

            mode2 = pg.evaluate("() => ({skip: skipOn, auto: autoOn})")
            assert mode2["skip"] is False and mode2["auto"] is False, \
                f"2周目でSKIP/AUTOが入っている（検証が空回りする）: {mode2}"

            log2 = pg.evaluate("window.__koeVoiceLog")
            src2 = pg.evaluate("window.__koeSrcLog")
            narr2 = [f for f in log2 if is_narr(f)]
            assert narr2, "2周目で地の文が参照されていない"
            bad2 = [f for f in narr2 if not f.endswith("_r.mp3")]
            assert not bad2, f"2周目で _k が参照された: {bad2}"
            miss2 = pg.evaluate("""(log) => backlog.slice(%d).filter(r=>r.who==='narr')
              .map(r=>voiceFile('ren', r.text, 'narr'))
              .filter(f => !log.includes(f));""" % n_before, log2)
            assert miss2 == [], f"2周目: 読んだのにボイス参照が無い地の文がある: {miss2}"

            # 「同じ本文の2系統」であること。接尾辞を外した幹が両周で一致していなければ、
            # 2本の別々の音源を鳴らしているだけで、同じ文の読み直しになっていない。
            stem = lambda f: f[:-len("_k.mp3")]
            shared = set(map(stem, narr1)) & set(map(stem, narr2))
            assert shared, ("同じ地の文が2系統で読まれていない（_k と _r で本文ハッシュが違う）: "
                            f"1周目={sorted(set(map(stem, narr1)))[:3]} / "
                            f"2周目={sorted(set(map(stem, narr2)))[:3]}")

            # 2周目でもセイレンの無音は破れない（b.v だけを見ているので周回に依らない）
            check_silence(pg, log2, src2, "2周目", since=n_before)

            assert errors == [], f"ページエラー: {errors}"
            print(f"  1周目 {elapsed1:.1f}s / ボイス参照 {len(log1)}本(地の文 {len(narr1)}本) "
                  f"/ src {len(src1)}本")
            print(f"  2周目 {elapsed2:.1f}s / ボイス参照 {len(log2)}本(地の文 {len(narr2)}本) "
                  f"/ src {len(src2)}本 / 共有する地の文 {len(shared)}本")
            br.close()
    finally:
        srv.terminate()
    print("koe_e2e_test: OK")


if __name__ == "__main__":
    main()
