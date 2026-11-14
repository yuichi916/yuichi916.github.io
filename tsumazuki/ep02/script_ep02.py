# -*- coding: utf-8 -*-
"""つまずき図鑑 長編 第2回「情報で変わる確率」の台本と検算（BIBLE.md §4、PLAN_topics.md #2）。
   台詞の数字は、ここで計算・実験（乱数は固定）して assert で確かめたものだけを埋め込む。
   出力: script.json・checks.json
   つまずき: 1 くじは先に引くと得？（条件付き確率）／2 99%正確な検査で陽性（ベイズの定理・偽陽性）／3 褒めると下がる（平均への回帰）／4 最初の37%は見送れ（最適停止）
   冒頭の罠は 2 の検査（いちばん意外）"""
import json, itertools, math
from fractions import Fraction as F
from pathlib import Path
import numpy as np
HERE = Path(__file__).parent
CHK = []
def check(name, ok, shown):
    assert ok, name
    CHK.append({"name": name, "shown": shown})

# ---- 1) くじ: 3本のうち当たり1本、3人が順に引く（戻さない）
perms = list(itertools.permutations(["当", "外", "外"]))
pos = [F(sum(p[i] == "当" for p in perms), len(perms)) for i in range(3)]
check("lot_each_third", pos == [F(1, 3)] * 3, "3本に当たり1本: 1番目も2番目も3番目も 1/3")
check("lot_tree_second", F(2, 3) * F(1, 2) == F(1, 3), "2番目が当たる = 1番目が外れ 2/3 × 残り2本から当たり 1/2 = 1/3")
cond = F(sum(p[1] == "当" for p in perms if p[0] == "外"), sum(p[0] == "外" for p in perms))
check("lot_conditional", cond == F(1, 2), "1番目が外れたのを見たあとなら、2番目は 1/2")
rng = np.random.default_rng(2002); T = 300_000
win = np.array([rng.permutation(3) for _ in range(T)]).argmin(1)            # 当たり(0)が何番目に出たか
lot_counts = [int((win == i).sum()) for i in range(3)]
check("lot_sim", all(abs(c / T - 1 / 3) < 0.005 for c in lot_counts), f"30万回: 1番目 {lot_counts[0]:,}・2番目 {lot_counts[1]:,}・3番目 {lot_counts[2]:,}回")

# ---- 2) 検査: 有病率1%・病気の人を陽性と出す 99%・健康な人を陰性と出す 99%
prev, sens, spec = F(1, 100), F(99, 100), F(99, 100)
ppv = sens * prev / (sens * prev + (1 - spec) * (1 - prev))
check("test_ppv", ppv == F(1, 2), "有病率1%・正しさ99%の検査で陽性 → 本当に病気 1/2")
check("test_10000", (10000 * prev, 10000 * prev * sens, 10000 * (1 - prev) * (1 - spec)) == (100, 99, 99), "1万人: 病気100人のうち陽性99人、健康9,900人のうち陽性99人")
ppv01 = sens * F(1, 1000) / (sens * F(1, 1000) + (1 - spec) * F(999, 1000))
check("test_ppv_rare", round(float(ppv01) * 100) == 9, f"有病率0.1%なら 陽性で病気は {float(ppv01) * 100:.1f}%")
ppv2 = sens * ppv / (sens * ppv + (1 - spec) * (1 - ppv))
check("test_retest", ppv2 == F(99, 100), "もう1回の検査（1回目と独立とする）でも陽性なら 99%")
rng = np.random.default_rng(1763); N = 1_000_000
sick = rng.random(N) < 0.01; posi = np.where(sick, rng.random(N) < 0.99, rng.random(N) < 0.01)
t_pos, t_tp = int(posi.sum()), int((posi & sick).sum())
check("test_sim", abs(t_tp / t_pos - 0.5) < 0.02, f"100万人: 陽性 {t_pos:,}人のうち病気 {t_tp:,}人（{t_tp / t_pos * 100:.1f}%）")

# ---- 3) 平均への回帰: 点数 = 実力 + その日の運。実力 N(50,10)、運 N(0,10)。何も手を加えない
rng = np.random.default_rng(1955); n = 10_000
skill = rng.normal(50, 10, n); s1 = skill + rng.normal(0, 10, n); s2 = skill + rng.normal(0, 10, n)
top = s1 >= np.quantile(s1, 0.9); bot = s1 <= np.quantile(s1, 0.1)
r = {k: round(float(v), 1) for k, v in dict(top1=s1[top].mean(), top2=s2[top].mean(), bot1=s1[bot].mean(), bot2=s2[bot].mean(), all1=s1.mean(), all2=s2.mean()).items()}
check("regress_top_down", r["top2"] < r["top1"] - 5, f"1回目の上位1割: {r['top1']}点 → 2回目 {r['top2']}点（何もしていないのに下がる）")
check("regress_bot_up", r["bot2"] > r["bot1"] + 5, f"1回目の下位1割: {r['bot1']}点 → 2回目 {r['bot2']}点（何もしていないのに上がる）")
check("regress_all_same", abs(r["all1"] - r["all2"]) < 0.5, f"全員の平均は {r['all1']}点 → {r['all2']}点で変わらない")

# ---- 4) 最初の37%は見送れ（100人が1人ずつ来る。その場で決める。戻れない。いちばん良い人を選べたら成功）
def succ(nn, k): return F(1, nn) if k == 0 else F(k, nn) * sum(F(1, i) for i in range(k, nn))
best_k = max(range(0, 100), key=lambda k: succ(100, k))
check("secretary_best", best_k == 37 and round(float(succ(100, 37)) * 100, 1) == 37.1, "100人なら 最初の37人を見送り → 成功 37.1%")
check("secretary_first", succ(100, 0) == F(1, 100), "1人目で決める → 1%")
rng = np.random.default_rng(1611); R = 100_000
ranks = np.array([rng.permutation(100) for _ in range(R)])                  # 0 がいちばん良い人
def sim(k):
    if k == 0: return float((ranks[:, 0] == 0).mean())
    bar = ranks[:, :k].min(1); rest = ranks[:, k:]
    better = rest < bar[:, None]; first = np.where(better.any(1), better.argmax(1), 99 - k)   # 誰も来なければ最後の人
    return float((rest[np.arange(R), first] == 0).mean())
curve = {k: round(sim(k) * 100, 1) for k in (0, 10, 20, 30, 37, 50, 70, 90)}
check("secretary_sim", abs(curve[37] - 37.1) < 0.6 and curve[37] >= max(curve.values()) - 0.5, f"10万回の実験: 37人見送りで {curve[37]}%（10人 {curve[10]}%・70人 {curve[70]}%）")

# ---- 数字の読み（第1回と同じ）
D = "ぜろ いち に さん よん ご ろく なな はち きゅう".split()
def kana(n):
    if n == 0: return "ぜろ"
    out = ""; man, n = divmod(n, 10000)
    if man: out += kana(man) + "まん"
    sen, n = divmod(n, 1000)
    if sen: out += {1: "いっせん" if man else "せん", 3: "さんぜん", 8: "はっせん"}.get(sen, D[sen] + "せん")
    hyk, n = divmod(n, 100)
    if hyk: out += {1: "ひゃく", 3: "さんびゃく", 6: "ろっぴゃく", 8: "はっぴゃく"}.get(hyk, D[hyk] + "ひゃく")
    ju, n = divmod(n, 10)
    if ju: out += ("" if ju == 1 else D[ju]) + "じゅう"
    if n: out += D[n]
    return out
def kai(n):
    k = kana(n)
    for a_, b_ in (("いち", "いっ"), ("ろく", "ろっ"), ("はち", "はっ"), ("じゅう", "じゅっ")):
        if k.endswith(a_): return k[:-len(a_)] + b_ + "かい"
    return k + "かい"
def nin(n):   # 〜人
    return kana(n) + "にん"
def ten(x):   # 小数1けたの点数・%: 67.9 → ろくじゅうななてんきゅう
    a, b = f"{x:.1f}".split("."); return kana(int(a)) + "てん" + D[int(b)]

# ---- 追加の検算（第2版で使う数字）
check("secretary_90", round(float(succ(100, 90)) * 100, 1) == 9.5, "90人見送ると 9.5%")
best10 = max(range(10), key=lambda k: succ(10, k))
check("secretary_10", best10 == 3 and round(float(succ(10, 3)) * 100, 1) == 39.9, "10件なら 最初の3件を見送る（39.9%）")
check("secretary_e", abs(37 / 100 - 1 / math.e) < 0.003 and abs(float(succ(100, 37)) - 1 / math.e) < 0.004, "見送る割合も当たる確率も 約37%（1/e ＝ 0.3679）")
check("test_retest_counts", (round(99 * 0.99), round(99 * 0.01)) == (98, 1), "陽性198人を別の検査で: 病気99人のうち約98人・健康99人のうち約1人がまた陽性")
check("benford_9", round(math.log10(10 / 9) * 100, 1) == 4.6, "ベンフォードの法則: 9で始まる数は 4.6%（次回予告）")
check("benford_1", round(math.log10(2) * 100, 1) == 30.1, "ベンフォードの法則: 1で始まる数は 30.1%（約3割・次回予告）")
check("test_50x", ppv / prev == 50, "陽性で 1% → 50%（50倍）")
check("secretary_fail", round(1 - float(succ(100, 37)), 2) == 0.63 and float(succ(100, 37)) > F(1, 3), "37人見送り: 当たり 37.1%（3人に1人以上）・外れ 約63%（約6割）")

# ---- 台本（第2版: 事実監査・視聴者目線の指摘を反映）
L = []
def S(ex, text, say=None, scene=None, note=None, pause=0): L.append(dict(who="shisho", ex=ex, text=text, say=say, scene=scene, note=note, pause=pause))
def M(ex, text, say=None, scene=None, note=None, pause=0): L.append(dict(who="maigo", ex=ex, text=text, say=say, scene=scene, note=note, pause=pause))
NOTE_PC = "※コンピューターの乱数で実験・コードは概要欄に"
NOTE_TEST = "※話を簡単にした例。実際の検査の正しさは検査ごとに違います"
r1 = lambda x: round(x)
# 冒頭の罠
S("normal", "99%当たる検査で、陽性。本当に病気の確率は？", "きゅうじゅうきゅうパーセント当たる検査で、陽性。本当に病気の確率は？", "cold_test", NOTE_TEST)
S("normal", "病気の人の99%が陽性、健康な人の99%が陰性になる検査です。", "病気の人の、きゅうじゅうきゅうパーセントが陽性、健康な人の、きゅうじゅうきゅうパーセントが陰性になる検査です。", "cold_test")
M("smug", "99%当たるなら、99%病気でしょ！", "きゅうじゅうきゅうパーセント当たるなら、きゅうじゅうきゅうパーセント病気でしょ！", "cold_test")
S("normal", "検査を受ける人の、100人に1人が病気だとして、ためします。", "検査を受ける人の、ひゃくにんにひとりが病気だとして、ためします。", "cold_sim", NOTE_PC)
S("normal", f"100万人で、陽性は{t_pos:,}人。うち病気は{t_tp:,}人。", "ひゃくまんにんで、陽性は、およそにまんにん。そのうち病気は、およそいちまんにん。", "cold_sim")
M("surprise", "半分！？ 99%じゃないの！？", "半分！？ きゅうじゅうきゅうパーセントじゃないの！？", "cold_sim")
S("smile", "なぜ半分なのか。2つめの標本で、1万人を並べて確かめます。", "なぜ半分なのか。ふたつめの標本で、いちまんにんを並べて確かめます。", "cold_title")
S("normal", "その前に、もっと身近な「くじ」から。今日は4つです。", "その前に、もっと身近な、くじから。今日は、よっつです。", "cold_title", pause=0.4)
L.append(dict(who="op", scene="op"))
# つまずき1 くじ
S("normal", "役員決めのくじ。先に引くか、最後に引くか、もめたことは？", None, "c1_claim")
M("smug", "先に引いたほうが得だよね！ 当たりが残ってるうちに！", None, "c1_claim")
S("normal", "3本のうち、当たりは1本。3人が順に引きます。", "さんぼんのうち、当たりは、いっぽん。さんにんが、順に引きます。", "c1_claim")
S("normal", "実はこれ、くじを先に3人に配ってから、順に開けるのと同じです。", "実はこれ、くじを先に、さんにんに配ってから、順に開けるのと同じです。", "c1_shuffle")
S("normal", "配られた1本が当たりの確率は、誰でも3分の1。", "配られたいっぽんが当たりの確率は、誰でも、さんぶんのいち。", "c1_shuffle")
S("normal", "コンピューターで、30万回引いて確かめましょう。", "コンピューターで、さんじゅうまんかい引いて、確かめましょう。", "c1_sim", NOTE_PC)
S("normal", f"1番目{lot_counts[0]:,}回、2番目{lot_counts[1]:,}回、3番目{lot_counts[2]:,}回。", "どれも、ほぼじゅうまんかい。さんぶんのいちずつです。", "c1_sim")
M("confused", "後の人は、当たりを先に取られるかも…。", None, "c1_tree")
M("confused", "でも、残りが少ないぶん、当たりやすい…？", None, "c1_tree")
S("smile", "そう。その損と得が、ちょうど打ち消し合うんです。", None, "c1_tree")
S("normal", "2番目なら、1番目が外れて3分の2。残り2本から当たりで2分の1。", "にばんめなら、いちばんめが外れて、さんぶんのに。残りの、にほんのくじから当たりで、にぶんのいち。", "c1_tree")
S("normal", "3分の2かける2分の1で、3分の1。1番目と同じです。", "さんぶんのに、かける、にぶんのいちで、さんぶんのいち。いちばんめと同じです。", "c1_tree")
M("smug", "じゃあ、1番目の人が外れたのを見てから引いたら？", "じゃあ、いちばんめの人が、外れたのを見てから引いたら？", "c1_cond")
S("normal", "そのときは、残り2本に当たり1本。2分の1に上がります。", "そのときは、残りの、にほんのくじに、当たりがいっぽん。にぶんのいちに上がります。", "c1_cond")
S("normal", "「1番目が外れた」とわかったうえでの確率。", "いちばんめが外れた、とわかったうえでの確率。", "c1_term")
S("normal", "これを「条件付き確率」と言います。", "これを、じょうけんつきかくりつ、と言います。", "c1_term")
S("normal", "引く前は、どの順番も同じ。変わるのは、結果を知ったあとです。", None, "c1_term")
M("happy", "順番は関係ない！ 知ると変わる！ 1つめ！", "順番は関係ない！ 知ると変わる！ ひとつめ！", "c1_pin")
# つまずき2 検査
S("normal", "では、冒頭の検査を、1万人で見てみましょう。", "では、冒頭の検査を、いちまんにんで見てみましょう。", "c2_dots", NOTE_TEST)
S("normal", "検査を受ける人の100人に1人が病気。1万人なら100人です。", "検査を受ける人の、ひゃくにんにひとりが病気。いちまんにんなら、ひゃくにんです。", "c2_dots", pause=0.4)
S("normal", "その100人のうち、99人が陽性になります。", "そのひゃくにんのうち、きゅうじゅうきゅうにんが、陽性になります。", "c2_dots")
S("normal", "健康な人は9,900人。その1%、99人も陽性になります。", "健康な人は、きゅうせんきゅうひゃくにん。そのいちパーセント、きゅうじゅうきゅうにんも、陽性になります。", "c2_dots")
M("surprise", "陽性は198人。そのうち病気は、99人だけ…！", "陽性は、ひゃくきゅうじゅうはちにん。そのうち病気は、きゅうじゅうきゅうにんだけ…！", "c2_ratio")
S("normal", "99%は「病気の人が、陽性になる」確率。", "きゅうじゅうきゅうパーセントは、病気の人が、陽性になる確率。", "c2_ratio")
S("normal", "知りたいのは「陽性の人が、病気」の確率。向きが逆なんです。", "知りたいのは、陽性の人が、病気の確率。向きが、逆なんです。", "c2_ratio")
S("normal", "病気の人が少ないと、健康な人の「偽陽性」が目立ちます。", "病気の人が少ないと、健康な人の、ぎようせい、が目立ちます。", "c2_ratio")
S("normal", f"病気が1,000人に1人なら、陽性でも病気は約{float(ppv01) * 100:.0f}%です。", "病気が、せんにんにひとりなら、陽性でも、病気は、やく、きゅうパーセントです。", "c2_rare", "※症状があって受ける検査では、この確率は高くなります")
M("confused", "じゃあ、検査の意味がないってこと？", None, "c2_retest")
S("smile", "いいえ。1%が50%に。50倍に上がっています。", "いいえ。いちパーセントが、ごじゅっパーセントに。ごじゅうばいに上がっています。", "c2_retest")
S("normal", "陽性の198人を、別の検査でもう一度調べます。", "陽性の、ひゃくきゅうじゅうはちにんを、別の検査で、もう一度調べます。", "c2_retest", "※2つの検査がおたがいに影響しない（別の種類の検査）とした計算")
S("normal", "病気の99人は約98人がまた陽性。健康な99人は約1人だけ。", "病気のきゅうじゅうきゅうにんは、やく、きゅうじゅうはちにんが、また陽性。健康なきゅうじゅうきゅうにんは、やく、ひとりだけ。", "c2_retest")
S("normal", "だから2回目も陽性なら、約99%。こうして確かめていくんです。", "だから、にかいめも陽性なら、やく、きゅうじゅうきゅうパーセント。こうして、確かめていくんです。", "c2_retest")
S("normal", "「病気なら陽性」の確率から、「陽性なら病気」の確率を逆に求める。", "病気なら陽性、の確率から、陽性なら病気、の確率を、逆に求める。", "c2_term")
S("normal", "この式を「ベイズの定理」と言います。", "この式を、ベイズのていり、と言います。", "c2_term")
S("normal", "健診の「要精密検査」も、病気と決まったわけではありません。", "健診の、ようせいみつけんさ、も、病気と決まったわけではありません。", "c2_term")
S("normal", "だからこそ、必ず精密検査を受けてください。", "だからこそ、必ず、せいみつけんさを受けてください。", "c2_term")
M("happy", "陽性でも、病気とは限らない！ 2つめ！", "陽性でも、病気とは限らない！ ふたつめ！", "c2_pin")
# つまずき3 平均への回帰
S("normal", "心理学者のカーネマンが「褒めるほうが効く」と教えたとき。", None, "c3_story", "※カーネマン『ファスト＆スロー』より")
S("normal", "空軍の教官が、こう反論しました。", None, "c3_story")
S("normal", "「褒めると次はたいてい下手になり、叱るとたいていうまくなる」", "褒めると、次はたいてい、へたになり、叱ると、たいてい、うまくなる。", "c3_story")
M("smug", "やっぱり叱るのが正解！ …あれ、これも何か裏がある？", None, "c3_story")
S("normal", "1万人にテストを2回受けてもらいます。褒めも叱りもしません。", "いちまんにんに、テストを、にかい受けてもらいます。褒めも、叱りもしません。", "c3_sim", "※点数＝実力＋その日の運。運のばらつきを実力と同じ大きさにして実験")
S("normal", f"1回目の上位1割は、{r['top1']}点から{r['top2']}点に下がりました。", f"いっかいめの上位いちわりは、{kana(r1(r['top1']))}てんくらいから、{kana(r1(r['top2']))}てんくらいに、下がりました。", "c3_sim")
S("normal", f"下位1割は、{r['bot1']}点から{r['bot2']}点に上がりました。", f"下位いちわりは、{kana(r1(r['bot1']))}てんくらいから、{kana(r1(r['bot2']))}てんくらいに、上がりました。", "c3_sim")
S("normal", f"全員の平均は{r['all1']}点と{r['all2']}点で、変わっていません。", "全員の平均は、どちらも、ごじゅってんくらいで、変わっていません。", "c3_sim")
M("surprise", "何もしてないのに、上と下が真ん中に寄ってる！？", None, "c3_sim")
S("normal", "点数は、実力と、その日の運の合計です。", None, "c3_why")
S("normal", "1回目がとても良かった人には、運も良かった人が多い。", "いっかいめが、とても良かった人には、運も良かった人が多い。", "c3_why")
S("normal", "次の運は前と関係なく、たいてい平均くらい。", None, "c3_why")
S("normal", "だから点数も、平均に近づくんです。", None, "c3_why")
S("normal", "これを「平均への回帰」と言います。", "これを、へいきんへのかいき、と言います。", "c3_term")
S("normal", "叱らなくても、次はたいていうまくなるんです。", "しからなくても、次は、たいてい、うまくなるんです。", "c3_term")
S("normal", "カーネマンの答えは、叱ったおかげとは言えない、でした。", None, "c3_term")
S("normal", "効いたか確かめるには、叱らない組とくらべるしかありません。", None, "c3_term")
S("normal", "2年目のジンクスも、「サプリを飲んだら治った」も。", "にねんめのジンクスも、サプリを飲んだらなおった、も。", "c3_life")
S("normal", "たまたま平均に近づいただけかも、と疑ってみてください。", None, "c3_life")
M("happy", "良すぎた次は、平均に近づく！ 3つめ！", "良すぎた次は、平均に近づく！ みっつめ！", "c3_pin")
# つまずき4 37%
S("normal", "最後は、選ぶ問題。100人の候補が、1人ずつ面接に来ます。", "最後は、選ぶ問題。ひゃくにんの候補が、ひとりずつ面接に来ます。", "c4_claim", "※人数は前もって分かる・比べられるのはそれまでの人とだけ・順番はでたらめ")
S("normal", "断ったら、もう呼び戻せません。", None, "c4_claim")
S("normal", "いちばんの人を選べる確率を、いちばん高くするには？", None, "c4_claim")
S("normal", "あなたなら、何人目で決めますか。5秒、考えてみてください。", "あなたなら、何人目で決めますか。ごびょう、考えてみてください。", "c4_claim", pause=5.0)
M("smug", "最初の何人かは様子見…？ いや、迷ったら負け！ 来たら即決！", None, "c4_claim")
S("normal", "何人見送るかを変えて、10万回ためしてみましょう。", "何人見送るかを変えて、じゅうまんかい、ためしてみましょう。", "c4_sim", NOTE_PC)
S("normal", f"1人目で決めると1%。10人見送ると{curve[10]}%。", f"ひとりめで決めると、いちパーセント。じゅうにん見送ると、{ten(curve[10])}パーセント。", "c4_sim")
S("normal", "計算すると、いちばん高いのは37人見送るとき。37.1%です。", "計算すると、いちばん高いのは、さんじゅうななにん見送るとき。さんじゅうななてんいちパーセントです。", "c4_sim")
M("surprise", "3人に1人以上で、いちばんの人に当たる！？", "さんにんにひとり以上で、いちばんの人に当たる！？", "c4_sim")
S("normal", "見送りが少ないと、基準が低くて、ふつうの人で決めてしまう。", None, "c4_why")
S("normal", "見送りが多すぎると、いちばんの人を、もう見送ってしまう。", None, "c4_why")
S("normal", "90人見送ると、9.5%まで下がります。", "きゅうじゅうにん見送ると、きゅうてんごパーセントまで下がります。", "c4_why")
S("normal", "やり方はこうです。最初の37人は、見るだけで決めません。", "やり方はこうです。最初の、さんじゅうななにんは、見るだけで、決めません。", "c4_rule", "※最後まで来なければ、最後の人に決まる（失敗）")
S("normal", "そのあと、それまでの誰より良い人が来たら、すぐ決めます。", None, "c4_rule")
S("normal", "見送る割合も、当たる確率も、約37%。1をeで割った数です。", "見送る割合も、当たる確率も、やく、さんじゅうななパーセント。いちを、ネイピア数の、イーで割った数です。", "c4_rule", "※e＝2.718…（ネイピア数）。1÷e＝0.367…")
M("confused", "でも、6割はハズレなんでしょ？", "でも、ろくわりは、ハズレなんでしょ？", "c4_rule")
S("smile", "はい。それでも、ほかのどんな決め方より高いんです。", None, "c4_rule")
S("normal", "こういう「いつ止めるか」の問題を、「最適停止」と言います。", "こういう、いつ止めるか、の問題を、さいてきていし、と言います。", "c4_term")
S("normal", "部屋を10件見るなら、最初の3件は見るだけ、がヒントです。", "部屋をじゅっけん見るなら、最初のさんけんは、見るだけ、がヒントです。", "c4_term")
S("normal", "ただし、数が分からない・戻れる・2番目でもいいなら、話は別です。", "ただし、数が分からない、戻れる、にばんめでもいい、なら、話は別です。", "c4_term")
M("happy", "最初の37%は、見るだけ！ 4つめ！", "最初の、さんじゅうななパーセントは、見るだけ！ よっつめ！", "c4_pin")
# まとめ
S("smile", "今日の標本は4つ。どれも、直感の逆でしたね。", "今日の標本は、よっつ。どれも、直感の逆でしたね。", "outro", pause=0.3)
M("happy", "わかったことで、見え方が変わるんだね。次は、何？", None, "outro")
S("smile", "次は「数字の見え方」。多くのデータで、1で始まる数が約3割。", "次は、数字の見え方。多くのデータで、いちで始まる数が、やく、さんわり。", "outro")
S("normal", "9で始まる数は、5%もないんです。", "きゅうで始まる数は、ごパーセントもないんです。", "outro")
S("normal", "最初の検査、あなたは何%だと思いましたか？ 数字だけ、コメントで。", "最初の検査、あなたは、何パーセントだと思いましたか？ 数字だけ、コメントで。", "outro")
L.append(dict(who="ed", scene="ed"))

for i, l in enumerate(L): l["id"] = f"L{i:03d}"
long = [(l["id"], len(l["text"]), l["text"]) for l in L if "text" in l and len(l["text"]) > 35]
assert not long, long
(HERE / "script.json").write_text(json.dumps(L, ensure_ascii=False, indent=1), encoding="utf-8")
(HERE / "checks.json").write_text(json.dumps({"checks": CHK, "lot": lot_counts, "test": {"pos": t_pos, "tp": t_tp, "ppv01": float(ppv01)},
    "regress": r, "secretary": curve}, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(L), "lines", sum(len(l.get("say") or l.get("text", "")) for l in L), "say-chars; checks", len(CHK))
for c in CHK: print(" ", c["shown"])
