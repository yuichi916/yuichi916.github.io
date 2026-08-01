# -*- coding: utf-8 -*-
"""koe.html の通し検証。ローカルHTTPを自前で立てて Playwright で回す。

  set PYTHONUTF8=1 && python tests/koe_e2e_test.py

守っているのは設計書10章の必須チェック:

  検証1 セイレンの無音 — v:1 でないセイレンの台詞は、どの経路からも音を鳴らさない。
  検証2 地の文の2系統 — 同じ本文が1周目は _k(カナタ)、2周目は _r(セイレン)で読まれる。
                        1周目でも終盤の {narrator:'ren'} 以降だけは _r になる——それが
                        仕掛けの開示そのものなので、「1周目は全部 _k」ではなく
                        「彼女が声を出す前に _r は無い／開示後は確かに _r になる」を見る。
  検証3 起動時の声    — タップゲートが一度だけ開き、その裏で「その1本」を鳴らしにいく。
                        どのファイルを掴むかまで見る（play() の回数だけ数えていると、
                        #titlekoe の src を別物に差し替えても緑のままになる）。
  検証4 セーブ往復    — 途中でやめて読み直して再開したとき、語り手・開示フラグ・
                        周回・位置がそのまま生きている。save_roundtrip() 参照。

「素通りしないこと」をこのファイル自身が担保する仕掛け:
  - 無音チェックは「実際に読んだ行の台帳」と突き合わせる。対象の台詞を読み終えた
    ことを確かめてから「鳴っていない」と言う（読まずに素通りしても合格、を封じる）。
    台帳はエンジンの backlog ではなくテスト側で pushLog をラップして持つ——backlog は
    200件で頭から捨てるリングバッファなので、周の境目を index で持つと本編台本
    (281ボイス行)で必ず狂い、正しいビルドでこのテストが落ちる。
  - 無音チェックは4本の物差しで見る: playVoice() のログ／#voice の src 属性／
    台詞ボイスの本数／実際に出た /voice/ へのネットワーク要求。
    最初の2つは voiceFile() が作った名前どうしの照合なので、命名規則ごと
    変えられると共倒れになる。本数は名前に依存しない。4本目はページ内の
    仕掛けに一切依存しない唯一の物差しで、`new Audio(...)` や fetch() のような
    エンジンを迂回した再生経路も拾える（前3本はどれもページの中にいるので
    迂回されると3本まとめて盲目になる）。
  - 地の文チェックも同じ台帳と突き合わせる。読んだ地の文すべてにボイス参照が
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
    要求すると正しいビルドが落ちるので、「play() を1回呼んだこと」までで止めてある
    （鳴らしにいったことは証明できるが、鳴り切ったことは Plan 2 まで証明できない）。
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
  src: window.__koeSrcLog.length, read: window.__koeReadLog.length,
  locked: locked, ex: _exOpen,
  choices: document.getElementById('choices').classList.contains('show')
})"""

WHERE_JS = """() => { try { return beatAddr(); } catch(e) { return '(beatAddr失敗: '+e.message+')'; } }"""

# #voice の src を直接見る第2の経路。playVoice() は __koeVoiceLog に積むが、
# tryVoice()/playFinalVoice() は v.src へ直接代入するのでログに載らない。
# src属性の変化を拾えば、エンジンが実際に音源として掴んだものを取りこぼさない。
#
# attributeOldValue が要る理由: MutationObserver のコールバックはマイクロタスクで
# まとめて走るので、同じタスク内で src を2回代入されると「今の値」を読むだけでは
# 1本目が消える。ここは tryVoice()/playFinalVoice() を見張る唯一の目なので、
# set→即差し替えの漏れが3本の物差し全部から見えなくなる。各レコードの oldValue も
# 積んで取りこぼしを防ぐ（同じ値が重複して入るが、この物差しは集合として使うので無害）。
INSTALL_SRC_SPY_JS = """() => {
  if (window.__koeSrcLog) return true;
  window.__koeSrcLog = [];
  const v = document.getElementById('voice');
  if (!v) return false;
  const now = v.getAttribute('src');
  if (now) window.__koeSrcLog.push(now);
  new MutationObserver(recs => {
    for (const r of recs) if (r.oldValue) window.__koeSrcLog.push(r.oldValue);
    const s = v.getAttribute('src');
    if (s) window.__koeSrcLog.push(s);
  }).observe(v, { attributes: true, attributeFilter: ['src'], attributeOldValue: true });
  return true;
}"""

# 起動時の声を「本当に鳴らしにいったか」を数える。
# __koeGate.played は openGate() の1行目（try の外）で立つので、play() を消しても真になる。
# reason も5値すべてを受理していて、6秒の保険タイマーで開いた 'timeout' と区別できない。
# つまりゲートの状態だけを見ていると「画面は開くが声は一度も鳴らない」ビルドが素通りする。
# HTMLMediaElement.play() の呼び出し自体を数えるのが唯一の直接証拠。
INSTALL_TITLE_PLAY_SPY_JS = """() => {
  if (window.__koeTitlePlay != null) return true;
  const a = document.getElementById('titlekoe');
  if (!a) return false;
  const orig = a.play.bind(a);
  window.__koeTitlePlay = 0;
  a.play = function(){ window.__koeTitlePlay++; return orig(); };
  return true;
}"""

# 「その行を実際に読んだか」を数える台帳。
# エンジンの backlog は pushLog() が200件でリングバッファ化する（shift()する）ので、
# 絶対index を保存して slice する方式は本編台本(281ボイス行)で必ず破綻し、
# 正しいビルドでこのテストが落ちる。pushLog をラップして無制限の台帳を別に持ち、
# 周のはじめに空にする。エンジンには一切触らない。
INSTALL_READ_SPY_JS = """() => {
  if (window.__koeReadLog) return true;
  if (typeof window.pushLog !== 'function') return false;
  window.__koeReadLog = [];
  const orig = window.pushLog;
  window.pushLog = function(who, name, text){
    window.__koeReadLog.push({who: who, name: name, text: text});
    return orig.apply(this, arguments);
  };
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


def install_spies(pg):
    """ページ読み込み直後に仕込む3つの覗き見。goto() のたびに消えるので毎回呼ぶ。"""
    assert pg.evaluate(INSTALL_SRC_SPY_JS), "#voice が見つからない"
    assert pg.evaluate(INSTALL_READ_SPY_JS), "pushLog が見つからない（読んだ行を追えない）"
    # タップする前に仕込む。openGate() は el('titlekoe') をその場で取り直すので、
    # 要素のメソッドを差し替えておけば必ず経由する。
    assert pg.evaluate(INSTALL_TITLE_PLAY_SPY_JS), "#titlekoe が見つからない"


def open_gate(pg):
    """タップゲートを通す。revealCount が 1 以上になるまで待つ。"""
    pg.evaluate("document.getElementById('gate').click()")
    try:
        pg.wait_for_function("window.__koeGate && window.__koeGate.revealCount >= 1",
                             timeout=12000)
    except PWTimeout:
        raise AssertionError(
            "ゲートをタップしても声を鳴らす経路に入らなかった（__koeGate.revealCount が 0 のまま）。"
            f" 現在値: {pg.evaluate('window.__koeGate')}")


def step_until(pg, cond_js, label, budget=120):
    """条件が真になるまでプレイヤーと同じ入口で進める。
    play_through() と同じく、反復回数ではなく壁時計と進行停滞で打ち切る。"""
    t0 = time.time()
    last, last_change = None, time.time()
    while True:
        if pg.evaluate(cond_js):
            return time.time() - t0
        now = time.time()
        if now - t0 > budget:
            raise AssertionError(
                f"{label}: {budget}秒で条件に到達しなかった。"
                f"停止位置: {pg.evaluate(WHERE_JS)} / 状態: {pg.evaluate(PROGRESS_JS)}")
        sig = pg.evaluate(PROGRESS_JS)
        if sig != last:
            last, last_change = sig, now
        elif now - last_change > STALL_AFTER:
            raise AssertionError(
                f"{label}: {STALL_AFTER}秒進行が止まった（例外で止まっている可能性が高い）。"
                f"停止位置: {pg.evaluate(WHERE_JS)} / 状態: {sig}")
        pg.evaluate(STEP_JS)
        pg.wait_for_timeout(110)


def check_silence(pg, log, srclog, reqs, label):
    """検証1: v:1 でないセイレンの台詞が、実際に読まれた上で1音も鳴っていないこと。

    「読んだ行」は __koeReadLog（周のはじめに空にするテスト側の台帳）で見る。
    エンジンの backlog は200件で頭から捨てるので、周の境目を index で持つと
    行数の多い本編台本で必ず狂う。"""
    info = pg.evaluate("""() => {
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
        read: window.__koeReadLog.length,
        renRead: window.__koeReadLog.filter(r => r.who === 'ren').map(r => r.text),
        /* この周に読んだ行のうち「鳴るはず」の本数。
           renderSay() と同じ規則で数える: カナタ/トキは丸括弧始まり(心の声)を除く。
           セイレンは名前欄が出た行だけ——nameFor() が b.v を見て 'セイレン' か '—' を
           返すので、記録された name がそのまま v:1 の記録になっている。 */
        expected: window.__koeReadLog.filter(r =>
          ((r.who === 'kanata' || r.who === 'toki') && !/^[（(]/.test((r.text||'').trim()))
          || (r.who === 'ren' && r.name === 'セイレン')).length
      };
    }""")
    assert info["read"], f"{label}: 読んだ行の台帳が空（pushLogのラップが効いていない＝全チェックが空回りする）"
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
    # 4本目の物差し。上3つはどれもページの中にいる（playVoice のラップ・#voice の
    # src・その名前の数え上げ）ので、`new Audio(url).play()` や fetch() のように
    # エンジンを迂回して鳴らす経路が入ると3本まとめて盲目になる。
    # ブラウザが実際に出した /voice/ へのHTTP要求だけはページ側の仕掛けに依存しない。
    assert reqs, (f"{label}: /voice/ へのネットワーク要求が1本も無い。"
                  "第4の物差しが空回りしている（音源を一度も取りに行っていない）")
    rq = set(base(u) for u in reqs)
    leaked3 = [f for f in info["silentFiles"] if base(f) in rq]
    assert leaked3 == [], f"{label}: セイレンの無音が破れている(ネットワーク要求): {leaked3}"
    return info


# セーブ往復で突き合わせる状態。周回(round)・語り手(narr)・開示(revealed)・位置(ep/scene/beat)。
SNAP_JS = """() => ({narr: st.narr, revealed: st.revealed, round: st.round,
  ep: st.ep, scene: st.scene, beat: st.beat})"""
# localStorage に「実際に書かれている」もの。メモリ上の st と食い違っていないかを見る。
SAVED_JS = """() => { const s = JSON.parse(localStorage.getItem('koe_save') || 'null');
  return s && {narr: s.narr, revealed: s.revealed, round: s.round,
    ep: s.ep, scene: s.scene, beat: s.beat}; }"""


def _reload_and_load(pg):
    """ページを読み直し、ゲートを通し、「つづきから」を押す。

    戻り値は (loaded, after):
      loaded — tCont を押す *前* の st。koe.html は初期化の最後で load() を呼ぶので、
               この時点の st は「セーブから復元しただけの状態」そのもの。位置(beat)を
               含めて厳密に突き合わせられる唯一のタイミング。
      after  — tCont を押した *後* の st。startGame(false) が復元済みの値を
               踏み潰していないかを見る（beat は再開後に進むので比較対象外）。
    """
    pg.goto(URL)
    pg.wait_for_selector("#gate")
    pg.wait_for_selector("#voice", state="attached")
    install_spies(pg)
    open_gate(pg)
    loaded = pg.evaluate(SNAP_JS)
    assert pg.evaluate("!document.getElementById('tCont').disabled"), \
        "「つづきから」が無効のまま（セーブが読めていない＝往復が成立しない）"
    pg.evaluate("document.getElementById('tCont').click()")
    pg.wait_for_function("document.getElementById('title').classList.contains('gone')",
                         timeout=5000)
    return loaded, pg.evaluate(SNAP_JS)


def save_roundtrip(pg, errors):
    """検証4: セーブ往復（設計書10章の必須チェック）。

    途中でセーブ → ページを読み直す → つづきから → 語り手・開示フラグ・周回・位置が
    そのまま生きていること。ここまで通していない状態が Plan 1 の穴だった。

    往復を2回する。1回だけでは2つの欠陥のうち片方しか踏めないため:
      A) 開示の一行（{say:'ren', v:1}）でやめたとき。
         step() の save() はビートを取り出した直後＝その行を描く前に走るので、
         保存された beat は v:1 の「次」を指しているのに revealed は false のまま、
         という1ビートぶんのズレが残っていた。再開すると正しい台本の
         {narrator:'ren'} を revealed:false で踏んで throw する。
         renderSay() 側で revealed を立てた瞬間に save() するのが直し。
      B) 語り手が切り替わったあと（st.narr==='ren'、まだ1周目）でやめたとき。
         再開の入口 startGame(false) が st.narr を fresh かどうかに関係なく
         round から再計算していたため、セーブに入っていた 'ren' を 'kanata' で
         踏み潰した。st.narr の決定を if(fresh) の中に入れるのが直し。
    """
    pg.evaluate("localStorage.clear()")
    pg.goto(URL)
    pg.wait_for_selector("#gate")
    pg.wait_for_selector("#voice", state="attached")
    install_spies(pg)
    open_gate(pg)
    assert pg.evaluate("!document.getElementById('tStart').disabled"), \
        "「はじめから」が無効のまま（台本ロード検査が通っていない）"
    pg.evaluate("document.getElementById('tStart').click()")
    pg.wait_for_function("document.getElementById('title').classList.contains('gone')",
                         timeout=5000)

    # --- 往復A: 開示の一行で中断する ---
    step_until(pg, "() => st.revealed === true", "セーブ往復A: 開示の一行まで")
    mem_a = pg.evaluate(SNAP_JS)
    saved_a = pg.evaluate(SAVED_JS)
    assert saved_a is not None, "セーブ往復A: localStorage に koe_save が書かれていない"
    assert mem_a["revealed"] is True and mem_a["round"] == 1, \
        f"セーブ往復A: 前提が崩れている（1周目・開示済みで止まっていない）: {mem_a}"
    assert saved_a["revealed"] is True, (
        "セーブ往復A: 開示の一行を読んだのに、保存された revealed が false のまま。"
        "この状態で再開すると、正しい {narrator:'ren'} ビートで throw する。"
        f" メモリ上={mem_a} / 保存済み={saved_a}")
    assert saved_a == mem_a, \
        f"セーブ往復A: 保存済みの状態がメモリ上と食い違う: 保存={saved_a} / メモリ={mem_a}"

    loaded_a, after_a = _reload_and_load(pg)
    assert loaded_a == mem_a, \
        f"セーブ往復A: 読み直した状態が保存時と違う: 復元={loaded_a} / 保存時={mem_a}"
    # 再開位置は {narrator:'ren'} の直前なので、つづきから を押した時点で
    # そのビートを踏み直す。revealed が復元できていなければここで throw する。
    assert errors == [], (
        "セーブ往復A: 再開した瞬間にページ例外。開示済みのセーブから再開したのに "
        "{narrator:'ren'} の順序チェックが発火している（revealed が保存されていない）。"
        f" 例外: {errors}")
    assert after_a["narr"] == "ren", \
        f"セーブ往復A: 再開後に {{narrator:'ren'}} を踏んでいない: {after_a}"

    # --- 往復B: 語り手が切り替わった位置で中断する ---
    step_until(pg, "() => st.narr === 'ren'", "セーブ往復B: 語り手の切替まで")
    mem_b = pg.evaluate(SNAP_JS)
    saved_b = pg.evaluate(SAVED_JS)
    assert mem_b["narr"] == "ren" and mem_b["round"] == 1, \
        f"セーブ往復B: 前提が崩れている（1周目で語り手がセイレンになっていない）: {mem_b}"
    assert saved_b == mem_b, \
        f"セーブ往復B: 保存済みの状態がメモリ上と食い違う: 保存={saved_b} / メモリ={mem_b}"

    loaded_b, after_b = _reload_and_load(pg)
    assert loaded_b == mem_b, \
        f"セーブ往復B: 読み直した状態が保存時と違う: 復元={loaded_b} / 保存時={mem_b}"
    # beat は再開後に進むので比べない。それ以外は再開の入口を通っても不変でなければならない。
    for k in ("narr", "revealed", "round", "ep", "scene"):
        assert after_b[k] == mem_b[k], (
            f"セーブ往復B: つづきから を押した時点で {k} が書き換わった "
            f"（startGame(false) が復元済みの値を踏み潰している）: "
            f"再開後={after_b} / 保存時={mem_b}")
    assert after_b["beat"] >= mem_b["beat"], \
        f"セーブ往復B: 保存位置より前に巻き戻っている: 再開後={after_b} / 保存時={mem_b}"

    # 再開したセーブから最後まで読み切れること（往復が「開くだけ」で終わっていない）。
    play_through(pg, "セーブ往復: 再開後の続き")
    fin = pg.evaluate("() => ({round: st.round, done: st.roundDone})")
    assert fin["done"] is True and fin["round"] >= 2, \
        f"セーブ往復: 再開したセーブから完走できていない: {fin}"
    return {"a": mem_a, "b": mem_b}


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
            # 4本目の物差し（ページ内の仕掛けに依存しない唯一の目）。
            # 音源をどう鳴らそうと、ブラウザがHTTPで取りに行けばここに出る。
            voice_reqs = []
            pg.on("request",
                  lambda r: voice_reqs.append(r.url) if "/voice/" in r.url else None)
            pg.goto(URL)
            pg.wait_for_selector("#gate")
            pg.wait_for_selector("#voice", state="attached")
            install_spies(pg)

            # --- 検証3: タイトルの声が鳴るか ---
            # まず「どのファイルを鳴らしにいくのか」。play() の回数だけを数えていると、
            # #titlekoe の src を別ファイルに差し替えてもテストは緑のままになる
            # （src はマークアップ側にあり、エンジンのどのログにも現れない）。
            # 期待値はエンジンのアセット根 A から組み立てる——A を動かせばここが落ちる。
            # 'title-koe' は設計書8-5の正規名で、scripts/koe/voice_audit.py の
            # ALLOWED_NON_SCRIPT_STEMS にも同じ名前で載っている（棚卸しと突き合う）。
            want_src = pg.evaluate("() => A + 'voice/title-koe.mp3'")
            got_src = pg.evaluate("() => document.getElementById('titlekoe').getAttribute('src')")
            assert got_src == want_src, (
                f"#titlekoe が鳴らすファイルが違う: 期待 {want_src} / 実際 {got_src}。"
                "起動時に聞かせる声はこの1本だけで、終盤の「あのとき聞いた声」の前提になっている。")

            # 注意: `ended` は本物の onended でのみ true になる。title-koe.mp3 は
            # Plan 2 まで存在せず、今日の健全なビルドでは常に false
            # （404 → play() が NotSupportedError で reject → reason:'rejected'）。
            # ここで ended===true を待つとハングする。revealCount で待つこと。
            open_gate(pg)
            gate = pg.evaluate("window.__koeGate")
            # ここが検証3の本体。__koeGate.played は openGate() の1行目（try の外）で立ち、
            # reason は5値すべてを受理しているので、この2つはゲートが開いた時点で必ず真になる
            # ＝それだけでは何も証明しない。play() を実際に呼んだ回数だけが直接の証拠になる。
            # （play() を消して6秒の保険タイマーで開かせると played:true/reason:'timeout' で
            #  素通りする。それがまさにこのチェックが防ぐ「声が死んだまま出荷」の形。）
            plays = pg.evaluate("window.__koeTitlePlay")
            assert plays == 1, (
                f"起動時の声を鳴らしにいっていない（titlekoe.play() の呼び出し {plays}回）。"
                f"ゲートは開いたが声は一度も鳴っていない＝終盤の「あのとき聞いた声」が成立しない。"
                f" ゲート状態: {gate}")
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
            pg.evaluate("window.__koeVoiceLog=[]; window.__koeSrcLog=[]; window.__koeReadLog=[]")
            voice_reqs.clear()
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
            req1 = list(voice_reqs)
            assert log1, "1周目でボイスが1本も参照されていない"
            assert src1, "1周目で #voice に音源が1本も渡っていない"

            # --- 検証1: セイレンの無音が守られているか（1周目） ---
            info1 = check_silence(pg, log1, src1, req1, "1周目")

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
            miss1 = pg.evaluate("""(log) => window.__koeReadLog.filter(r=>r.who==='narr')
              .filter(r => !log.includes(voiceFile('kanata', r.text, 'narr'))
                        && !log.includes(voiceFile('ren', r.text, 'narr')))
              .map(r=>r.text);""", log1)
            assert miss1 == [], f"1周目: 読んだのにボイス参照が無い地の文がある: {miss1}"

            # --- 2周目: 同じ地の文が _r で読まれるか ---
            # st.round は startGame() の冒頭 freshState(keep) で持ち越され、
            # そのすぐ後の st.narr 決定に使われる（＝最初の1行が出る前に効く）。
            pg.evaluate("st.round = 2")
            pg.evaluate("window.__koeVoiceLog=[]; window.__koeSrcLog=[]; window.__koeReadLog=[]")
            voice_reqs.clear()
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
            req2 = list(voice_reqs)
            narr2 = [f for f in log2 if is_narr(f)]
            assert narr2, "2周目で地の文が参照されていない"
            bad2 = [f for f in narr2 if not f.endswith("_r.mp3")]
            assert not bad2, f"2周目で _k が参照された: {bad2}"
            miss2 = pg.evaluate("""(log) => window.__koeReadLog.filter(r=>r.who==='narr')
              .map(r=>voiceFile('ren', r.text, 'narr'))
              .filter(f => !log.includes(f));""", log2)
            assert miss2 == [], f"2周目: 読んだのにボイス参照が無い地の文がある: {miss2}"

            # 「同じ本文の2系統」であること。接尾辞を外した幹が両周で一致していなければ、
            # 2本の別々の音源を鳴らしているだけで、同じ文の読み直しになっていない。
            stem = lambda f: f[:-len("_k.mp3")]
            shared = set(map(stem, narr1)) & set(map(stem, narr2))
            assert shared, ("同じ地の文が2系統で読まれていない（_k と _r で本文ハッシュが違う）: "
                            f"1周目={sorted(set(map(stem, narr1)))[:3]} / "
                            f"2周目={sorted(set(map(stem, narr2)))[:3]}")

            # 2周目でもセイレンの無音は破れない（b.v だけを見ているので周回に依らない）
            check_silence(pg, log2, src2, req2, "2周目")

            # --- 検証4: セーブ往復（設計書10章「セーブ往復」） ---
            rt = save_roundtrip(pg, errors)

            assert errors == [], f"ページエラー: {errors}"
            # src は oldValue も積むので生の件数には重複が入る。物差しとしては集合なので、
            # 表示は異なり数（＝エンジンが実際に掴んだ音源の種類数）にする。
            print(f"  1周目 {elapsed1:.1f}s / ボイス参照 {len(log1)}本(地の文 {len(narr1)}本) "
                  f"/ src {len(set(map(base, src1)))}種 / titlekoe.play {plays}回")
            print(f"  2周目 {elapsed2:.1f}s / ボイス参照 {len(log2)}本(地の文 {len(narr2)}本) "
                  f"/ src {len(set(map(base, src2)))}種 / 共有する地の文 {len(shared)}本")
            print(f"  /voice/ 要求 1周目 {len(set(map(base, req1)))}種 / "
                  f"2周目 {len(set(map(base, req2)))}種")
            print(f"  セーブ往復 A={rt['a']} / B={rt['b']}")
            br.close()
    finally:
        srv.terminate()
    print("koe_e2e_test: OK")


if __name__ == "__main__":
    main()
