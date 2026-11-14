# -*- coding: utf-8 -*-
"""つまずき図鑑 長編 第1回「確率のつまずき」の台本（BIBLE.md §4）。第2版（2026-11-14、事実監査と視聴者目線の指摘を反映）
   台詞の数字は、ここで計算・実験（乱数を固定）して assert で確かめたものだけを埋め込む。
   出力: script.json（行: 話し手・表情・字幕・読み・場面・注記・後ろの間）と checks.json（ED の検算ログにも使う）
   構成: 冒頭の罠 → OP → つまずき4つ（間違い→実験→なぜ→用語→受験・生活）→ まとめ・次回 → ED
   つまずき: 1 コイン2枚（同様に確からしい）／2 サイコロ3個の9と10（順列と組合せ）／3 23人の誕生日（余事象）／4 5回続いた表（独立）"""
import json, itertools, math
from collections import Counter
from fractions import Fraction as F
from pathlib import Path
import numpy as np
HERE = Path(__file__).parent
CHK = []
def check(name, ok, shown):
    assert ok, name
    CHK.append({"name": name, "shown": shown})

# ---- 1) コイン2枚（Short #1 と同じ実験: seed 1754・1万回）
o = list(itertools.product("HT", repeat=2))
check("coin_two_mixed", F(sum(a != b for a, b in o), 4) == F(1, 2), "コイン2枚で表裏1枚ずつ = 2/4 = 1/2")
rng = np.random.default_rng(1754); a, b = rng.integers(0, 2, 10_000), rng.integers(0, 2, 10_000)
kind = a + b; coin = [int((kind == k).sum()) for k in range(3)]                 # 表表 / 表と裏 / 裏裏
assert coin == [2488, 4991, 2521], coin                                        # Short #1 の画面の数字と同じ
check("coin_sim_10000", abs(coin[1] / 10_000 - 0.5) < 0.01 and 1.9 < coin[1] / coin[0] < 2.1 and 1.9 < coin[1] / coin[2] < 2.1,
      f"1万回: 表表 {coin[0]:,}・表と裏 {coin[1]:,}・裏裏 {coin[2]:,}（まざりだけ約2倍）")
balls = list(itertools.combinations(["赤1", "赤2", "白"], 2))
check("balls_two_red", F(sum(all(s.startswith("赤") for s in x) for x in balls), len(balls)) == F(1, 3), "赤玉2個・白玉1個から2個で両方赤 = 1/3")

# ---- 2) サイコロ3個の合計9と10（ガリレオの問題）
d3 = list(itertools.product(range(1, 7), repeat=3)); cnt = Counter(sum(x) for x in d3)
parts = {s: sorted({tuple(sorted(x)) for x in d3 if sum(x) == s}) for s in (9, 10)}
perm = lambda p: math.factorial(3) // math.prod(math.factorial(v) for v in Counter(p).values())
check("dice3_partitions", len(parts[9]) == len(parts[10]) == 6, "組み合わせは 9も10も 6つずつ")
check("dice3_count", cnt[9] == 25 and cnt[10] == 27 and len(d3) == 216 and sum(map(perm, parts[9])) == 25 and sum(map(perm, parts[10])) == 27,
      "並べ方で数えると 9は25/216・10は27/216")
d2 = list(itertools.product(range(1, 7), repeat=2))
check("dice2_sum11", sum(x + y == 11 for x, y in d2) == 2, "サイコロ2個で11は2通り（5と6、6と5）")
rng = np.random.default_rng(1620); r3 = rng.integers(1, 7, (216_000, 3)).sum(1)
n9, n10 = int((r3 == 9).sum()), int((r3 == 10).sum())
check("dice3_sim", n10 > n9 and abs(n9 / 216_000 - 25 / 216) < 0.003 and abs(n10 / 216_000 - 27 / 216) < 0.003, f"21万6千回で 9は{n9:,}回・10は{n10:,}回")

# ---- 3) 誕生日（1年365日・どの日も同じ確からしさ・2/29は除く）
def p_same(n): return 1 - math.prod(F(365 - k, 365) for k in range(n))
P = {n: float(p_same(n)) for n in (10, 20, 22, 23, 40)}
check("birthday23", p_same(23) > F(1, 2) > p_same(22), f"23人で同じ誕生日の組がいる = {P[23] * 100:.1f}%（22人は {P[22] * 100:.1f}%）")
check("birthday_meter", [round(P[n] * 100) for n in (10, 20, 22, 23, 40)] == [12, 41, 48, 51, 89], "10人12%・20人41%・22人48%・23人51%・40人89%")
check("birthday_pairs23", math.comb(23, 2) == 253 == sum(range(1, 23)), "23人の2人組 = 22+21+…+1 = 253組")
rng = np.random.default_rng(23); cls = np.sort(rng.integers(0, 365, (100_000, 23)), 1)
bday_hit = int((np.diff(cls, axis=1) == 0).any(1).sum())
check("birthday_sim", bday_hit > 50_000 and abs(bday_hit / 100_000 - P[23]) < 0.01, f"23人のクラス10万組で同じ誕生日あり {bday_hit:,}組")
self_n = next(n for n in range(1, 1000) if 1 - F(364, 365) ** n > F(1, 2))
check("birthday_self", self_n == 253, "自分と同じ誕生日の人が半分をこえるのは 自分以外に253人")

# ---- 4) 表が5回続いたあと（seed 5・100万回）
s6 = list(itertools.product("HT", repeat=6))
check("six_seq_eq", all(F(sum(x == tuple(q) for x in s6), 64) == F(1, 64) for q in ("HHHHHH", "HHHHHT", "HTTHHT")), "表6連続も、表5回のあと裏も、ばらばらの並びも 1/64")
rng = np.random.default_rng(5); t = rng.integers(0, 2, 1_000_000)             # 0 表
run = np.convolve(t == 0, np.ones(5, int), "valid")[:-1] == 5                  # 直前5回が全部表の位置（重なりあり）
nxt = t[5:][run]; streak_n, streak_h = int(len(nxt)), int((nxt == 0).sum())
sp = f"{streak_h / streak_n * 100:.1f}"
check("streak_sim", abs(streak_h / streak_n - 0.5) < 0.01, f"100万回で直前5回が表 {streak_n:,}回のうち次も表 {streak_h:,}回（{sp}%）")

# ---- 数字の読み
D = "ぜろ いち に さん よん ご ろく なな はち きゅう".split()
def kana(n, _top=True):
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
assert kana(4991) == "よんせんきゅうひゃくきゅうじゅういち" and kai(31586) == "さんまんいっせんごひゃくはちじゅうろっかい" and kana(1009) == "せんきゅう"
pc = lambda n: f"{P[n] * 100:.0f}"

# ---- 台本
L = []
def S(ex, text, say=None, scene=None, note=None, pause=0): L.append(dict(who="shisho", ex=ex, text=text, say=say, scene=scene, note=note, pause=pause))
def M(ex, text, say=None, scene=None, note=None, pause=0): L.append(dict(who="maigo", ex=ex, text=text, say=say, scene=scene, note=note, pause=pause))
NOTE_PC = "※コンピューターの乱数で実験・コードは公開"
NOTE_FAIR = "※表と裏が同じ確率のコイン"
NOTE_BD = "※1年365日（2/29除く）・どの日も同じ確率"
# 冒頭の罠（OPの前、約35秒）
M("smug", "コイン2枚で表と裏が1枚ずつ？ 3通りだから3分の1！", "コインにまいで、オモテとウラがいちまいずつ？ さんとおりだから、さんぶんのいち！", "cold_three", NOTE_FAIR)
M("smug", "表表、表裏、裏裏。かんたんでしょ？", "オモテオモテ、オモテウラ、ウラウラ。かんたんでしょ？", "cold_three")
S("normal", "では、コンピューターで1万回、投げてみましょう。", "では、コンピューターで、いちまんかい、投げてみましょう。", "cold_sim", NOTE_PC)
S("normal", "3分の1なら、どれも約3,333回のはずです。", "さんぶんのいちなら、どれも、やく、さんぜんさんびゃくさんじゅうさんかいの、はずです。", "cold_sim")
S("normal", f"でも、表と裏が1枚ずつは{coin[1]:,}回。ほかの約2倍です。", f"でも、オモテとウラがいちまいずつは、{kai(coin[1])}。ほかの、やく、にばいです。", "cold_sim")
M("surprise", "えっ、ほぼ半分！？ 3分の1じゃないの！？", "えっ、ほぼ半分！？ さんぶんのいちじゃないの！？", "cold_sim")
S("smile", "人がつまずいた場所を、標本にして図鑑に留めていきます。", "人がつまずいた場所を、標本にして、図鑑に、とめていきます。", "cold_title")
S("normal", "今日の標本は4つ。23人のクラスの、ふしぎな話もあります。", "今日の標本はよっつ。にじゅうさんにんのクラスの、ふしぎな話もあります。", "cold_title", pause=0.4)
L.append(dict(who="op", scene="op"))
# つまずき1 コイン2枚
S("normal", "まず、このコインから。10円玉と100円玉で考えます。", "まず、このコインから。じゅうえんだまと、ひゃくえんだまで考えます。", "c1_two")
M("normal", "ちがうコインにしたら、答えが変わるの？", None, "c1_two")
S("normal", "変わりません。見分けやすくなるだけです。", None, "c1_two")
S("normal", "出方を、全部並べてみましょう。", "でかたを、全部並べてみましょう。", "c1_four", pause=1.6)
M("surprise", "1、2、3、4…。4通りある！", "いち、に、さん、よん…。よんとおりある！", "c1_four")
S("normal", "表と裏が1枚ずつは、このうち2つ。2分の1です。", "オモテとウラがいちまいずつは、このうちふたつ。にぶんのいちです。", "c1_half")
M("confused", "でも、同じ10円玉2枚なら、見分けがつかないよ？", "でも、同じじゅうえんだまにまいなら、見分けがつかないよ？", "c1_same")
S("smile", "そこ、みんな引っかかります。", None, "c1_same")
S("normal", "片方に見えないシールを貼っても、コインは気づきません。", None, "c1_same")
S("normal", "見分けがつかなくても、表と裏が1枚ずつには、道が2つあるんです。", "見分けがつかなくても、オモテとウラがいちまいずつには、道がふたつあるんです。", "c1_merge")
S("normal", "1万回の実験で、ここだけ2倍出たのは、そのためです。", "いちまんかいの実験で、ここだけ、にばい出たのは、そのためです。", "c1_merge")
S("normal", "どの出方も、同じくらい起きる。", "どのでかたも、同じくらい起きる。", "c1_term")
S("normal", "この性質を「同様に確からしい」と言います。", "この性質を、どうようにたしからしい、と言います。", "c1_term")
S("normal", "「何通り分の何通り」で確率を出せるのは、このときだけです。", "なんとおりぶんの、なんとおり、で確率を出せるのは、このときだけです。", "c1_term")
M("confused", "表表・表裏・裏裏の3つは、同じくらいじゃなかったんだ。", "オモテオモテ、オモテウラ、ウラウラのみっつは、同じくらいじゃなかったんだ。", "c1_term")
S("normal", "受験では、玉の問題でよく出ます。", None, "c1_exam")
S("normal", "赤玉2個と白玉1個。2個取って、両方赤の確率は？", "あかだまにこと、しろだまいっこ。にこ取って、両方あかの確率は？", "c1_exam")
M("smug", "赤赤か、赤白。2通りだから、2分の1！", "あかあかか、あかしろ。ふたとおりだから、にぶんのいち！", "c1_exam")
S("normal", "赤にも名前をつけます。赤1赤2、赤1白、赤2白。", "あかにも名前をつけます。あかいちあかに、あかいちしろ、あかにしろ。", "c1_exam2")
S("normal", "3通りのうち、両方赤は1つ。3分の1です。", "さんとおりのうち、両方あかはひとつ。さんぶんのいちです。", "c1_exam2")
M("happy", "同じに見えても、名前をつける！ 1つめ！", "同じに見えても、名前をつける！ ひとつめ！", "c1_pin")
# つまずき2 サイコロ3個
M("smug", "名前をつけるのは、わかった。サイコロ2つで11は2通りでしょ？", "名前をつけるのは、わかった。サイコロふたつで、じゅういちは、ふたとおりでしょ？", "c2_two")
S("smile", "そのとおりです。5と6、6と5。では、3個ならどうでしょう。", "そのとおりです。ごとろく、ろくとご。では、さんこならどうでしょう。", "c2_two")
S("normal", "サイコロ3個で、合計9と10。出やすいのは、どっち？", "サイコロさんこで、合計きゅうと、じゅう。出やすいのは、どっち？", "c2_q")
S("normal", "3秒で、決めてみてください。", "さんびょうで、決めてみてください。", "c2_q", pause=3.0)
M("smug", "9は、1・2・6、1・3・5…。組み合わせは6つ。", "きゅうは、いち、に、ろく。いち、さん、ご…。組み合わせは、むっつ。", "c2_claim")
M("smug", "10も6つ。だから、同じ！", "じゅうも、むっつ。だから、同じ！", "c2_claim")
S("normal", "コンピューターで、21万6千回ふりました。", "コンピューターで、にじゅういちまんろくせんかい、ふりました。", "c2_sim", "※乱数で実験・コード公開／どの目も同じ確率")
S("normal", f"合計9は{n9:,}回。合計10は{n10:,}回。", f"合計きゅうは、{kai(n9)}。合計じゅうは、{kai(n10)}。", "c2_sim")
M("surprise", "10のほうが、多い！ 組み合わせは同じ6つなのに！", "じゅうのほうが、多い！ 組み合わせは、同じむっつなのに！", "c2_sim")
S("normal", "3個を、赤・青・黄に塗ってみます。", "さんこを、あか、あお、きいろに塗ってみます。", "c2_perm")
S("normal", "1・2・6なら、並べ方は6通り。", "いち、に、ろくなら、並べ方は、ろくとおり。", "c2_perm")
S("normal", "でも3・3・3は、どう並べても1通りです。", "でも、さん、さん、さんは、どう並べても、ひととおりです。", "c2_perm")
M("confused", "組み合わせごとに、入れかえの数がちがうんだ…。", None, "c2_perm")
S("normal", "数え直すと、9は25通り、10は27通り。全部で216通りです。", "数え直すと、きゅうは、にじゅうごとおり。じゅうは、にじゅうななとおり。全部で、にひゃくじゅうろくとおりです。", "c2_count", pause=0.6)
S("normal", "並べ方まで数えるのが順列、組だけ数えるのが組合せ。", "並べ方まで数えるのが、じゅんれつ。組だけ数えるのが、くみあわせ。", "c2_term")
S("normal", "確率は、同じくらい起きる「並べ方」で数えます。", None, "c2_term")
S("normal", "400年ほど前、ガリレオ・ガリレイも、この問いに答えています。", "よんひゃくねんほど前、ガリレオ・ガリレイも、この問いに答えています。", "c2_term", "※ガリレオ『Sopra le scoperte dei dadi』")
S("normal", "受験の「場合の数」は、この区別から始まります。", "受験の、ばあいのかず、は、この区別から始まります。", "c2_term")
M("happy", "組が同じでも、並べ方がちがう！ 2つめ！", "組が同じでも、並べ方がちがう！ ふたつめ！", "c2_pin")
# つまずき3 誕生日
S("normal", "では、いちばんふしぎな問題です。", None, "c3_q")
S("normal", "クラスに、同じ誕生日の人が1組でもいる確率。", "クラスに、同じ誕生日の人が、ひとくみでもいる確率。", "c3_q", NOTE_BD)
S("normal", "半分をこえるのは、何人のクラスからでしょう。", None, "c3_q")
M("smug", "1年は365日。その半分で、183人！", "いちねんは、さんびゃくろくじゅうごにち。その半分で、ひゃくはちじゅうさんにん！", "c3_q")
S("normal", "人数を、1人ずつ増やしてみましょう。", "人数を、ひとりずつ増やしてみましょう。", "c3_meter", NOTE_BD, pause=0.4)
S("normal", f"10人で約{pc(10)}%。20人で約{pc(20)}%。", "じゅうにんで、やく、じゅうにパーセント。にじゅうにんで、やく、よんじゅういちパーセント。", "c3_meter")
S("normal", f"22人で約{pc(22)}%。そして23人で、約{pc(23)}%。", "にじゅうににんで、やく、よんじゅうはちパーセント。そして、にじゅうさんにんで、やく、ごじゅういちパーセント。", "c3_meter")
M("surprise", "23人で、半分をこえる！？ うそでしょ！？", "にじゅうさんにんで、半分をこえる！？ うそでしょ！？", "c3_meter")
S("normal", f"23人のクラスを10万組つくると、{bday_hit:,}組にいました。", f"にじゅうさんにんのクラスを、じゅうまん組つくると、{kana(bday_hit)}組に、いました。", "c3_sim", NOTE_PC)
S("normal", "「自分と同じ人」じゃありません。だれとだれでもいいんです。", "自分と同じ人、じゃありません。だれとだれでもいいんです。", "c3_pairs")
S("normal", "1人目は、ほかの22人と組になれます。2人目は21人と…。", "ひとりめは、ほかのにじゅうににんと組になれます。ふたりめは、にじゅういちにんと…。", "c3_pairs", pause=0.6)
S("normal", "全部足すと253組。この中の1組でも同じなら、いいんです。", "全部足すと、にひゃくごじゅうさんくみ。この中のひとくみでも同じなら、いいんです。", "c3_pairs")
M("confused", "253組もあったら、どれか当たりそう…。", "にひゃくごじゅうさんくみもあったら、どれか当たりそう…。", "c3_pairs")
S("normal", "ただ、組どうしが重なるので、そのままは数えられません。", None, "c3_comp")
S("normal", "そこで反対の「全員の誕生日がちがう」を考えます。", None, "c3_comp")
S("normal", "2人目もちがう、3人目もちがう…。「も」が続くときは、掛け算です。", "ふたりめもちがう、さんにんめもちがう…。も、が続くときは、掛け算です。", "c3_comp")
S("normal", "365分の364、掛ける365分の363…と、23人目まで。", "さんびゃくろくじゅうごぶんの、さんびゃくろくじゅうよん。かける、さんびゃくろくじゅうごぶんの、さんびゃくろくじゅうさん…と、にじゅうさんにんめまで。", "c3_comp", pause=0.6)
S("normal", f"すると約{100 - round(P[23] * 100)}%。全員ちがうのは、半分より少ないんです。", "すると、やく、よんじゅうきゅうパーセント。全員ちがうのは、半分より少ないんです。", "c3_comp")
S("normal", f"だから「同じ人がいる」は、100%から引いて約{pc(23)}%。", "だから、同じ人がいる、は、ひゃくパーセントから引いて、やく、ごじゅういちパーセント。", "c3_comp")
S("normal", "「全員ちがう」のような反対の出来事を「余事象」と言います。", "全員ちがう、のような、反対の出来事を、よじしょう、と言います。", "c3_term")
S("normal", "受験で「少なくとも1つ」と出たら、まず余事象を考えます。", "受験で、少なくともひとつ、と出たら、まず、よじしょうを考えます。", "c3_term")
M("confused", "じゃあ、わたしの183人は、何だったの？", "じゃあ、わたしの、ひゃくはちじゅうさんにんは、何だったの？", "c3_self")
S("smile", "「自分と同じ誕生日の人」なら、もっと要ります。", None, "c3_self")
S("normal", "自分以外に253人いて、やっと半分をこえます。", "自分以外に、にひゃくごじゅうさんにんいて、やっと半分をこえます。", "c3_self")
M("surprise", "253！ さっきの組の数と、同じ！", "にひゃくごじゅうさん！ さっきの組の数と、同じ！", "c3_self")
S("smile", "どちらも、約253回くらべると、半分をこえるんです。", "どちらも、やく、にひゃくごじゅうさんかい、くらべると、半分をこえるんです。", "c3_self")
S("normal", f"40人のクラスだと約{pc(40)}%。たいていは、いるんです。", "よんじゅうにんのクラスだと、やく、はちじゅうきゅうパーセント。たいていは、いるんです。", "c3_self")
M("happy", "反対から考える！ 3つめ！", "反対から考える！ みっつめ！", "c3_pin")
# つまずき4 5回続いた表
M("smug", "最後は自信あるよ。表が5回続いたら、次はさすがに裏！", "最後は自信あるよ。オモテがごかい続いたら、次は、さすがにウラ！", "c4_claim")
M("smug", "だって、表6連続なんて、64回に1回でしょ？", "だって、オモテろくれんぞくなんて、ろくじゅうよんかいに、いっかいでしょ？", "c4_claim")
S("normal", "では、この2つの並び。出やすいのは、どっちでしょう。", None, "c4_two", pause=1.6)
M("smug", "下に決まってる！ ばらばらのほうが、ありそう。", None, "c4_two")
S("normal", "どちらも64分の1です。どの並びも、同じくらい起きます。", "どちらも、ろくじゅうよんぶんのいちです。どのならびも、同じくらい、おきます。", "c4_two")
S("normal", "表6連続も、「表5回のあと裏」も、64回に1回ずつ。", "オモテろくれんぞくも、オモテごかいのあとウラも、ろくじゅうよんかいに、いっかいずつ。", "c4_two")
M("confused", "あれ…。じゃあ、次が表でも裏でも、同じ？", "あれ…。じゃあ、次がオモテでもウラでも、同じ？", "c4_two")
S("normal", "ためしてみましょう。コンピューターで100万回、投げました。", "ためしてみましょう。コンピューターで、ひゃくまんかい、投げました。", "c4_sim", NOTE_PC)
S("normal", "直前の5回がすべて表だった場面を、全部集めます。", "直前のごかいが、すべてオモテだった場面を、全部集めます。", "c4_sim", "※表が7回続けば3か所と数える", pause=0.8)
S("normal", f"{streak_n:,}回のうち、次も表は{streak_h:,}回。{sp}%です。", f"{kai(streak_n)}のうち、次もオモテは、{kai(streak_h)}。ごじゅってんにパーセントです。", "c4_sim")
M("surprise", "ほんとに、ほぼ半分…！", None, "c4_sim")
S("normal", "コインは、前に何が出たかを、覚えていません。", None, "c4_why")
S("normal", "1回ごとの結果が、ほかの回の結果に影響しない。", "いっかいごとの結果が、ほかの回の結果に影響しない。", "c4_why")
S("normal", "このとき、それぞれの試行は「独立」だと言います。", "このとき、それぞれの試行は、どくりつ、だと言います。", "c4_why")
S("normal", "1913年、モンテカルロのカジノで黒が26回続いたと伝えられています。", "せんきゅうひゃくじゅうさんねん、モンテカルロのカジノで、くろが、にじゅうろっかい続いたと、伝えられています。", "c4_life")
S("normal", "「次こそ赤」と賭け続けた人たちは、大きく負けたそうです。", "次こそあか、と賭け続けた人たちは、大きく負けたそうです。", "c4_life")
S("normal", "この思いこみは「ギャンブラーの誤謬」と呼ばれています。", "この思いこみは、ギャンブラーのごびゅう、と呼ばれています。", "c4_life")
M("happy", "コインは、覚えてない！ 4つめ！", "コインは、覚えてない！ よっつめ！", "c4_pin")
# まとめと次回
S("smile", "今日の標本は、4つでした。", "今日の標本は、よっつでした。", "outro")
S("normal", "同様に確からしい。順列と組合せ。余事象。独立。", "どうようにたしからしい。じゅんれつと、くみあわせ。よじしょう。どくりつ。", "outro", pause=0.4)
M("smug", "もう確率はこわくない！ くじは、先に引いたほうが得だよね！", None, "outro")
S("smile", "…それは、次の標本で。", None, "outro")
S("normal", "4つのうち、どれでつまずきましたか。番号でコメントしてください。", "よっつのうち、どれでつまずきましたか。番号で、コメントしてください。", "outro")
L.append(dict(who="ed", scene="ed"))

for i, l in enumerate(L): l["id"] = f"L{i:03d}"
long = [(l["id"], len(l["text"]), l["text"]) for l in L if "text" in l and len(l["text"]) > 35]
assert not long, long
(HERE / "script.json").write_text(json.dumps(L, ensure_ascii=False, indent=1), encoding="utf-8")
(HERE / "checks.json").write_text(json.dumps({"checks": CHK, "coin": coin, "dice3": {"n9": n9, "n10": n10, "parts": {k: [list(p) + [perm(p)] for p in v] for k, v in parts.items()}},
    "P": P, "bday_hit": bday_hit, "streak": [streak_n, streak_h], "sp": sp}, ensure_ascii=False, indent=1), encoding="utf-8")
chars = sum(len(l.get("say") or l.get("text", "")) for l in L)
print(len(L), "lines", chars, "say-chars; checks", len(CHK))
for c in CHK: print(" ", c["shown"])
