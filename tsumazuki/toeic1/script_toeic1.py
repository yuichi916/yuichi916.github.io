# -*- coding: utf-8 -*-
"""つまずき図鑑 特別編「TOEIC 730点の手前で落とす、4つのつまずき」の台本と検算（依頼主 2026-11-16「TOEIC の点数向上動画を、つまずき図鑑で世界一わかりやすくためになる動画として。730点レベル」→ パート横断の4つ）。
   第2版: 例題・事実の審査（言い切りの直し: 語尾は「たいてい」、Part 2 は「最初の1語で決まる」ではなく「合わない答えを消す」、Why don't we の罠）と
          視聴者目線の審査（冒頭は塗り絵、迷子に本当の誤答 more efficient、手順は「選択肢→位置」、言いかえの中身、時計は時刻で2つ、数字を半分に）を反映。
   つまずき: 1 Part 5 全部訳してから選ぶ／2 Part 2 全部聞き取ろうとする／3 Part 3・4 聞こえた単語の選択肢を選ぶ／4 Part 7 Part 5 から納得いくまで考えて時間切れ
   例題はすべてこの動画のためのオリジナル（公式問題は使わない）。公式（IIBC、2026-11-16 確認）:
     形式 https://www.iibc-global.org/toeic/test/lr/about/format.html ／採点「誤った解答は減点されません」https://www.iibc-global.org/toeic/test/lr/guide04.html
     禁止「問題用紙への書き込み」https://www.iibc-global.org/toeic/test/lr/guide02/prohibition.html
   出力: script.json・checks.json"""
import json
from pathlib import Path
import numpy as np
HERE = Path(__file__).parent
CHK = []
def check(name, ok, shown):
    assert ok, name
    CHK.append({"name": name, "shown": shown})
# ---- 公式の形式（IIBC）
L_PARTS = {1: 6, 2: 25, 3: 39, 4: 30}; R_PARTS = {5: 30, 6: 16, 7: 54}; P7 = {"single": 29, "multi": 25}; R_MIN = 75
check("format", sum(L_PARTS.values()) == 100 and sum(R_PARTS.values()) == 100 and sum(P7.values()) == R_PARTS[7] and L_PARTS[3] % 3 == 0 and L_PARTS[4] % 3 == 0,
      "公式の形式: リスニング100問（Part 1〜4 ＝ 6・25・39・30）、リーディング75分100問（Part 5〜7 ＝ 30・16・54）")
# ---- 1) Part 5
check("p5_time", R_PARTS[5] * 40 / 60 == 20 and R_PARTS[5] * 20 / 60 == 10, "Part 5 の30問: 1問40秒なら20分、20秒なら10分（差は10分）")
POS = {"efficient": "形容詞", "efficiently": "副詞", "efficiency": "名詞", "efficiencies": "名詞", "care": "名詞", "careful": "形容詞", "carefully": "副詞", "carefulness": "名詞"}
Q1 = {"stem": "The new software allows employees to complete reports more ______.", "opts": ["efficient", "efficiently", "efficiency", "efficiencies"], "ans": 1}
Q2 = {"stem": "The manager praised the team for its ______ planning of the event.", "opts": ["care", "careful", "carefully", "carefulness"], "ans": 1}
assert POS[Q1["opts"][Q1["ans"]]] == "副詞" and POS[Q2["opts"][Q2["ans"]]] == "形容詞"   # 例題の答えの品詞（手で書いた辞書なので検算の件数には入れない）
# ---- 4) Part 7 の時間
p7_fast = R_MIN - R_PARTS[5] * 20 / 60 - R_PARTS[6] * 30 / 60          # Part 5 を1問20秒・Part 6 を1問30秒（8分）とした目安
sec_fast = p7_fast * 60 / R_PARTS[7]; lost_q = 10 * 60 / 60
check("p7_budget", p7_fast == 57 and round(sec_fast) == 63 and lost_q == 10,
      f"目安: Part 5 を10分・Part 6 を8分 → Part 7 に57分（1問 約{sec_fast:.0f}秒）。Part 7 を1問1分とすると、10分は10問ぶん")
start_m = 15 * 60 - R_MIN; t_p6 = start_m + 10; t_p7 = start_m + 18
hm = lambda m: f"{m // 60}時{m % 60}分"
check("p7_clock", (hm(start_m), hm(t_p6), hm(t_p7)) == ("13時45分", "13時55分", "14時3分"), "リーディングの終わりが15時なら、始まり13時45分・Part 6 へ13時55分・Part 7 へ14時3分")
rng = np.random.default_rng(730); T = 200_000
hits = (rng.integers(0, 4, (T, 10)) == 0).sum(1); mean_hits = hits.mean()
check("guess", abs(mean_hits - 2.5) < 0.02, f"4択10問を当てずっぽうで塗ると 平均 {mean_hits:.2f}問（20万回）")
# ---- 台本
L = []
def S(ex, text, say=None, scene=None, note=None, pause=0): L.append(dict(who="shisho", ex=ex, text=text, say=say, scene=scene, note=note, pause=pause))
def M(ex, text, say=None, scene=None, note=None, pause=0): L.append(dict(who="maigo", ex=ex, text=text, say=say, scene=scene, note=note, pause=pause))
def E(who, text, scene, note=None, pause=0): L.append(dict(who=who, ex="normal", text=text, say=None, scene=scene, note=note, pause=pause))
NOTE_ORIG = "※例題はこの動画のためのオリジナル問題（公式問題ではありません）"
NOTE_FMT = "※試験の形式は IIBC 公式サイトより"
NOTE_PC = "※コンピューターの乱数で20万回ためした"
# 冒頭: 塗り絵 → Part 5 の罠
S("normal", "リーディングの最後、塗り絵になっていませんか。", "リーディングの最後、ぬりえに、なっていませんか。", "cold_paint")
M("confused", "なってる…いつも時間が足りない。", "なってる…。いつも、時間が足りない。", "cold_paint")
S("normal", "原因は、最初のPart 5かもしれません。たとえばこの問題。", "原因は、最初の、パートファイブかもしれません。たとえば、この問題。", "cold_q", NOTE_ORIG)
M("smug", "more efficient！ よく聞く形！", "モア、エフィシェント！ よく聞く形！", "cold_q")
S("normal", "それは×。訳さなくても、5秒で見分けられます。", "それは、まちがいです。やくさなくても、ごびょうで、見分けられます。", "cold_q")
S("smile", "解き方で直せる、4つのつまずき。つまずき図鑑、特別編です。", "解き方で直せる、よっつのつまずき。つまずき図鑑、特別編です。", "cold_title", pause=0.4)
L.append(dict(who="op", scene="op"))
# 1) Part 5 品詞
S("normal", "まずリーディングのPart 5。短い文の穴うめが30問です。", "まず、リーディングの、パートファイブ。短い文の穴うめが、さんじゅうもんです。", "c1_claim", NOTE_FMT)
M("smug", "英文は、全部訳してから選ぶものでしょ？", "英文は、全部、訳してから選ぶものでしょ？", "c1_claim")
S("normal", "1問40秒なら20分。20秒との差の10分が、4つめで効きます。", "いちもん、よんじゅうびょうなら、にじゅっぷん。にじゅうびょうとの差の、じゅっぷんが、よっつめで、効いてきます。", "c1_claim")
S("normal", "手順は2つ。まず文より先に、選択肢を見ます。", "手順は、ふたつ。まず、文より先に、選択肢を見ます。", "c1_demo", NOTE_ORIG)
S("normal", "同じ単語の形ちがいなら、品詞の問題。", None, "c1_demo")
S("normal", "名詞・形容詞・副詞の、どれが入るかを選びます。", None, "c1_demo")
S("normal", "次に空所の位置。complete reports で形は完成。", "次に、空所の位置。コンプリート、リポーツで、文の形は、もう完成。", "c1_demo")
S("normal", "完成した文に「どんなふうに」を足すのは、副詞。", None, "c1_demo")
S("normal", "答えは efficiently。efficient は形容詞で×。", "答えは、エフィシェントリー。エフィシェントは、形容詞で、ばつ。", "c1_demo")
M("surprise", "訳さなくても、位置で決まるんだ！", "やくさなくても、位置で決まるんだ！", "c1_demo")
S("normal", "位置の決まりは3つ。", "位置の決まりは、みっつ。", "c1_term")
S("normal", "the・its・前置詞のあと、後ろに名詞がない→名詞。", "ザ、イッツ、前置詞のあとで、後ろに名詞がない、なら、名詞。", "c1_term")
S("normal", "名詞の前→たいてい形容詞。完成した文に足す→副詞。", "名詞の前なら、たいてい、形容詞。完成した文に足すなら、副詞。", "c1_term", "※safety inspection のような名詞＋名詞や、is・become の後ろなど例外もあります")
S("normal", "語尾の目印も。-tion、-ness、-ment は、たいてい名詞。", "語尾の目印も。ション、ネス、メントは、たいてい、名詞。", "c1_term")
S("normal", "-ful・-able・-ive は形容詞、-ly は副詞（たいてい）。", "フル、エイブル、イブは、たいてい、形容詞。エル、ワイで終わる語は、たいてい、副詞。", "c1_term", "※representative（担当者）は名詞、friendly・costly は形容詞のような例外あり")
S("normal", "20秒で決まらなければ、塗って次へ。", "にじゅうびょうで決まらなければ、塗って、次へ。", "c1_term")
S("normal", "もう1問。3秒で選んでみてください。", "もう、いちもん。さんびょうで、選んでみてください。", "c1_ex", pause=3.0)
S("normal", "its のあとでも、後ろに名詞 planning がある。", "イッツのあとでも、後ろに、プランニングという、名詞がある。", "c1_ex")
M("happy", "名詞の前は形容詞。careful！", "名詞の前は、形容詞。ケアフル！", "c1_ex")
S("normal", "意味がちがう4択は、浮いた時間でちゃんと読みます。", "意味がちがう、よんたくは、浮いた時間で、ちゃんと読みます。", "c1_ex")
M("happy", "選択肢を見て、空所の位置で決める！ 1つめ！", "選択肢を見て、空所の位置で決める！ ひとつめ！", "c1_pin")
# 2) Part 2 合わない答えを消す
S("normal", "ここからリスニング。Part 2は25問です。", "ここから、リスニング。パートツーは、にじゅうごもんです。", "c2_claim", NOTE_FMT)
S("normal", "問いかけや発言のあと、答えが3つ。文字はなく、1回だけ。", "問いかけや、発言のあと、答えが、みっつ。文字はなく、いっかいだけ。", "c2_claim")
M("smug", "全部の単語を、聞き取らなきゃ！", None, "c2_claim")
S("normal", "まず本番と同じく、文字なしで聞きます。", "まず、本番と同じく、文字なしで聞きます。", "c2_demo", NOTE_ORIG)
E("en_m", "Where should I put these boxes?", "c2_demo")
E("en_w2", "A. By Friday afternoon.", "c2_demo")
E("en_w2", "B. In the storage room, please.", "c2_demo")
E("en_w2", "C. Yes, they're quite heavy.", "c2_demo", pause=1.5)
S("normal", "最初のひとことは Where。答えは「場所」にしぼれます。", "最初のひとことは、ウェア。答えは、場所に、しぼれます。", "c2_demo")
S("normal", "Aは「いつ」、Cは Yes。場所を言っているのはB。", "エーは、いつ。シーは、イエス。場所を言っているのは、ビー。", "c2_demo")
S("normal", "WhereやWhenの問いに、YesやNoで答えると話が合わない。", "ウェアや、ウェンの問いに、イエスや、ノーで答えると、話が合いません。", "c2_term")
S("normal", "注意。Why don't we… は理由ではなく「〜しませんか」。", "注意。ワイ、ドント、ウィー、は、理由ではなく、しませんか、という誘いです。", "c2_term")
S("normal", "答えは Because ではなく、誘いへの返事。断るのも可。", "答えは、ビコーズ、ではなく、シュア、のような、誘いへの返事。断る返事も、あります。", "c2_term")
S("normal", "「わからない・確認する」の答えは、多くの問いに合います。", "わからない、確認する、の答えは、多くの問いに、合います。", "c2_term")
S("normal", "もう1問。最初のひとことを聞き取ってください。", "もう、いちもん。最初のひとことを、聞き取ってください。", "c2_ex")
E("en_w", "When will the new manager start?", "c2_ex")
E("en_m2", "A. In the sales department.", "c2_ex")
E("en_m2", "B. I haven't heard yet.", "c2_ex")
E("en_m2", "C. Yes, she's very experienced.", "c2_ex", pause=1.5)
M("confused", "あれ？ 「いつ」を言っている答えがない！", "あれ？ いつ、を言っている答えがない！", "c2_ex")
S("normal", "Aは場所、Cは Yes。消して残ったBが正解。", "エーは場所、シーは、イエス。消して残った、ビーが正解。", "c2_ex")
S("normal", "「まだ聞いていない」という、遠回しな答えです。", "アイ、ハブント、ハード、イェット。まだ、聞いていない。遠回しな答えです。", "c2_ex")
S("normal", "迷ったらすぐ塗って、次の最初のひとことに構えます。", "迷ったら、すぐ塗って、次の、最初のひとことに、構えます。", "c2_ex")
M("happy", "最初のひとことで、合わない答えを消す！ 2つめ！", "最初のひとことで、合わない答えを消す！ ふたつめ！", "c2_pin")
# 3) Part 3・4 言いかえ
S("normal", "Part 3は会話、Part 4は1人の話。設問は印刷されています。", "パートスリーは会話、パートフォーは、ひとりの話。設問は、印刷されています。", "c3_claim", NOTE_FMT)
S("normal", "設問を読むのは、前の3問を塗り終えたすき間です。", "設問を読むのは、前の、さんもんを、塗り終えた、すき間です。", "c3_claim")
M("smug", "聞こえた単語が入った選択肢を、選べばいいんでしょ？", None, "c3_claim")
S("normal", "設問は「女性の困りごとは？」。女性の声に注目。", "設問は、女性の困りごとは。女性の声に、注目。", "c3_demo", "※本番より短くした例（本番は会話がもう少し長く、設問は3つ）")
E("en_w", "Hi, I'm calling about the printer on the third floor.", "c3_demo")
E("en_w", "It keeps jamming, and we have a big presentation tomorrow.", "c3_demo")
E("en_m", "I'll send a technician up this afternoon.", "c3_demo", pause=0.4)
S("normal", "A 機械が動かない、B 発表が中止、C 3階が閉鎖、D 紙不足。", "エー、機械が動かない。ビー、発表が中止。シー、さんかいが閉鎖。ディー、紙が足りない。", "c3_demo")
M("smug", "third floor って聞こえた！ Cだ！", "サードフロアって、聞こえた！ シーだ！", "c3_demo")
S("normal", "Cは、聞こえた単語をそのまま使った罠。Bも同じです。", "シーは、聞こえた単語を、そのまま使った罠。ビーの、プレゼンテーションも、同じです。", "c3_demo")
S("normal", "正解はA。printer が machine に言いかえられています。", "正解は、エー。プリンターが、マシーンに、言いかえられています。", "c3_demo")
S("normal", "jamming（紙づまり）も、not working に。", "ジャミング、紙づまりも、ノット、ワーキング、動かない、に。", "c3_demo")
S("normal", "具体的な物は、まとめた言葉に変わりやすい。", None, "c3_demo")
S("normal", "正解は、言いかえになっていることが多い。", None, "c3_term")
S("normal", "聞こえた単語がそのまま入った選択肢は、まず疑います。", None, "c3_term")
S("normal", "例：copier→equipment、purchase→buy", "たとえば、コピー機の、コピアーが、イクイップメント、機器に。買うの、パーチェスが、同じ、買うの、バイに。", "c3_term")
M("happy", "同じ単語より、同じ意味！ 3つめ！", "同じ単語より、同じ意味！ みっつめ！", "c3_pin")
# 4) Part 7 時計と空欄ゼロ
S("normal", "最後はリーディングに戻って、Part 7。長文が54問です。", "最後は、リーディングに戻って、パートセブン。長文が、ごじゅうよんもんです。", "c4_claim", NOTE_FMT)
M("smug", "Part 5から1問ずつ、納得いくまで考える！", "パートファイブから、いちもんずつ、納得いくまで考える！", "c4_claim")
S("normal", "Part 5を1問40秒で解くと、20秒より10分多くかかります。", "パートファイブを、いちもん、よんじゅうびょうで解くと、にじゅうびょうより、じゅっぷん多くかかります。", "c4_demo")
S("normal", "Part 7を1問1分で解くなら、その10分は10問ぶん。", "パートセブンを、いちもん、いっぷんで解くなら、その、じゅっぷんは、じゅうもんぶん。", "c4_demo")
M("surprise", "最初の30問が、最後の時間を食べてたんだ！", "最初の、さんじゅうもんが、最後の時間を、食べてたんだ！", "c4_demo")
S("normal", "そこで、見る時刻を2つ決めます。終わりが15時なら、", "そこで、見る時刻を、ふたつ決めます。終わりが、じゅうごじなら、", "c4_term", "※スマートウォッチなど通信機能のある時計は使えません（IIBC 公式）")
S("normal", "13時55分にPart 6へ、14時3分にPart 7へ。", "じゅうさんじ、ごじゅうごふんに、パートシックスへ。じゅうよじ、さんぷんに、パートセブンへ。", "c4_term", "※問題用紙への書き込みは禁止（IIBC 公式）。時刻は覚えておく")
S("normal", "目安はPart 5が1問20秒、Part 7が1問1分です。", "目安は、パートファイブが、いちもん、にじゅうびょう。パートセブンが、いちもん、いっぷんです。", "c4_term")
S("normal", "そして、間違えても減点はありません。公式の案内です。", None, "c4_ex", "※IIBC 公式「誤った解答は減点されません」")
S("normal", "10問を空欄にすると0問。全部塗れば、平均2.5問。", "じゅうもんを、何も塗らずに残すと、ゼロもん。全部塗れば、平均、にてんごもん。", "c4_ex", NOTE_PC)
S("normal", "残り3分になったら、解いていない問題は塗って終える。", "残り、さんぷんになったら、解いていない問題は、塗って、終える。", "c4_ex")
M("happy", "時刻を2つ決めて、空欄ゼロ！ 4つめ！", "時刻を、ふたつ決めて、空欄ゼロ！ よっつめ！", "c4_pin")
# まとめ
S("smile", "今日の4つを、行動にすると。", "今日の、よっつを、行動にすると。", "outro")
S("normal", "選択肢を見て、位置で決める。最初のひとことで消す。", None, "outro")
S("normal", "言いかえを探す。時刻を2つ決めて、空欄ゼロ。", "言いかえを、さがす。時刻を、ふたつ決めて、空欄ゼロ。", "outro")
S("normal", "1つだけやるなら、時刻を2つ決めること。", "ひとつだけ、やるなら、時刻を、ふたつ決めること。", "outro")
M("happy", "次の模試で、ためしてみる！", None, "outro")
S("normal", "どこでつまずいたか、コメントで教えてください。", None, "outro")
L.append(dict(who="ed", scene="ed"))
for i, l in enumerate(L): l["id"] = f"L{i:03d}"
long = [(l["id"], len(l["text"]), l["text"]) for l in L if "text" in l and len(l["text"]) > (62 if l["who"].startswith("en") else 35)]
assert not long, long
data = {"checks": CHK, "q1": Q1, "q2": Q2, "budget": {"p7_fast": p7_fast, "sec_fast": sec_fast, "lost_q": lost_q},
        "guess": {"mean": float(mean_hits)},
        "p2a": ["Where should I put these boxes?", ["By Friday afternoon.", "In the storage room, please.", "Yes, they're quite heavy."], 1],
        "p2b": ["When will the new manager start?", ["In the sales department.", "I haven't heard yet.", "Yes, she's very experienced."], 1],
        "p3": {"q": "What is the woman's problem?", "opts": ["A machine is not working properly.", "A presentation has been canceled.", "The third floor is closed.", "She needs more paper."], "ans": 0}}
(HERE / "script.json").write_text(json.dumps(L, ensure_ascii=False, indent=1), encoding="utf-8")
(HERE / "checks.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(L), "lines", sum(len(l.get("say") or l.get("text", "")) for l in L), "say-chars; checks", len(CHK))
for c in CHK: print(" ", c["shown"])
