"""まぜる漢字: 「きょうの7字」の日替わり問題を前もって作る。

使い方:  python -I scripts/kanji/build_daily.py
入力:   data/kanji/words.json, data/kanji/kanji.json（build_dict.py の出力）
出力:   data/kanji/daily.json  {"v":1, "start", "end", "days":[{"d","c","o","a"}]}
          c = 中央の字、o = まわりの6字（盤の並び順）、a = 答え（common 語、words.json の並び＝長さ→字）

答えの決まり（SPEC_kanji.md から1点だけ変えた。理由は下）:
  - 盤の7字だけで作れる 2〜4字の common 語のうち、質2でない語が答え（同じ字は何度使ってもよい）。
    質2の語（古語・略語・まれ・かな書きがふつう・固有名詞らしい）は「辞書にはある言葉」として受け付けるが点にしない
  - 中央の字は「きょうの字」で、答えのおよそ半分以上に入るように盤を選ぶ（必須にはしない）
  理由: 「中央の字を必ず含む」にすると、common 辞書では 1 問の答えが最大でも 6〜9 語にしかならない
        （小学校の字 1,026 字を中央に置いて、まわりの組み合わせを総当たりした結果、12 語以上は 6 字だけ。
        news2/ichi2 まで辞書を広げても 14 字）。仕様の「12〜30 語」を満たせないため。

盤の条件:
  - 7字は全部常用、中央は小学校の字
  - 答えは 12〜30 語、3字以上の語を1つ以上
  - 中央の字を含む答えが 35% 以上かつ 4 語以上
  - 英訳が大文字で始まる語（東京・月曜 など固有名詞らしい語）は 2 語まで、質1（新聞の下位・spec2・gai のみ）の語は 5 語まで
  - まわりの6字は、どれも2つ以上の答えに使われる
  - 前後14日で中央の字が重ならない
  - 数字・日付・助数詞だけでできた語（NUM_CHARS の字だけの語）は答えの25%まで。中央に数字の字は置かない
  - 各問の答えを辞書から作り直して（全語をなめる素朴な版で）保存した答えと一致することを assert する
"""
from __future__ import annotations

import json
import random
import sys
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "kanji"
START, END = date(2026, 10, 25), date(2027, 12, 31)
GAP = 14
POOL = 26          # 中央の字とよく熟語をつくる字の上位いくつから、まわりの6字を選ぶか
MIN_N, MAX_N, TARGET = 12, 30, 18
# 数字・日付・助数詞だけでできた語（二十日・一回・三人 など）。盤の答えの25%までにする。中央には数字の字を置かない
NUM_CHARS = set("一二三四五六七八九十百千万億兆零半日年月回人時分秒度番倍枚個円週歳号")
NUM_CENTER = set("一二三四五六七八九十百千万億兆零")
MAX_NUMERAL = 0.25


def numeralish(w: str) -> bool:
    return all(ch in NUM_CHARS for ch in w)

W = json.loads((DATA / "words.json").read_text(encoding="utf-8"))
ROWS = W["common"]
GRADE = json.loads((DATA / "kanji.json").read_text(encoding="utf-8"))
Q = {r[0]: r[3] for r in ROWS}
READ = {r[0]: r[1] for r in ROWS}
PROPERISH = set(W["proper"])   # 英訳が大文字で始まる語（build_dict.py が付ける）
ORDER = {r[0]: i for i, r in enumerate(ROWS)}
BY_CHAR = defaultdict(list)
for r in ROWS:
    for ch in set(r[0]):
        BY_CHAR[ch].append(r[0])


def answers(center: str, outer: str) -> list[str]:
    """盤の答え: 7字だけでできた common 語（words.json の並び順）。"""
    s = set(outer) | {center}
    out = {w for ch in s for w in BY_CHAR[ch] if set(w) <= s and Q[w] < 2}
    return sorted(out, key=ORDER.__getitem__)


def answers_bruteforce(center: str, outer: str) -> list[str]:
    """検算用: 全語を1つずつなめる素朴な版（索引を使わない）。"""
    s = set(outer) | {center}
    return [r[0] for r in ROWS if r[3] < 2 and all(ch in s for ch in r[0])]


def score_board(center, outer, a):
    """条件を満たせば点（大きいほどよい）、満たさなければ None。"""
    n = len(a)
    if not (MIN_N <= n <= MAX_N):
        return None
    if center in NUM_CENTER or sum(1 for w in a if numeralish(w)) > MAX_NUMERAL * n:
        return None
    if any(Q[w] == 2 for w in a):
        return None
    longs = sum(1 for w in a if len(w) >= 3)
    if longs < 1:
        return None
    caps = sum(1 for w in a if w in PROPERISH)
    q1 = sum(1 for w in a if Q[w] == 1)
    if caps > 2 or q1 > 5:
        return None
    withc = sum(1 for w in a if center in w)
    if withc < 4 or withc < 0.35 * n:
        return None
    uses = Counter(ch for w in a for ch in set(w))
    mu = min(uses[k] for k in outer)
    if mu < 2:
        return None
    q0 = (n - q1) / n
    low = sum(1 for k in outer if GRADE[k] <= 6)
    return (q0 * 10 + min(longs, 4) * 0.8 - abs(n - TARGET) * 0.2 + min(mu, 4) * 0.4
            + (withc / n) * 3 + low * 0.3 - caps * 0.8)


def search(center: str, rng: random.Random, keep: int = 8):
    """中央の字ごとに、山登り（入れ替え）でよい盤を探す。まわりの字が3つ以上ちがう盤を keep 個まで。"""
    nb = Counter()
    for w in BY_CHAR[center]:
        if Q[w] < 2:
            for ch in set(w):
                if ch != center:
                    nb[ch] += (2 if len(w) == 2 else 1) + (Q[w] == 0)
    pool = [k for k, _ in nb.most_common(POOL)]
    if len(pool) < 6:
        return []
    chars = [center] + pool
    bit = {ch: 1 << i for i, ch in enumerate(chars)}
    allm = (1 << len(chars)) - 1
    words = {w for ch in chars for w in BY_CHAR[ch] if set(w) <= set(chars) and Q[w] < 2}
    wm = [(w, sum(bit[ch] for ch in set(w))) for w in words]
    cache = {}

    def f(outer):
        key = frozenset(outer)
        if key in cache:
            return cache[key]
        m = 1 | sum(bit[k] for k in outer)
        a = sorted((w for w, x in wm if x & ~m & allm == 0), key=ORDER.__getitem__)
        sc = score_board(center, outer, a)
        if sc is None:   # 条件に近いほど高い「仮の点」で、条件を満たす方へ歩かせる
            n = len(a)
            bad = sum(1 for w in a if Q[w] == 2)
            withc = sum(1 for w in a if center in w)
            soft = -100 + min(n, MAX_N) - max(0, n - MAX_N) - 6 * bad + withc * 0.5
            cache[key] = (soft, a, False)
        else:
            cache[key] = (sc, a, True)
        return cache[key]

    found = {}
    for restart in range(30):
        cur = pool[:6] if restart == 0 else rng.sample(pool, 6)
        best = f(cur)
        improved = True
        while improved:
            improved = False
            for i in range(6):
                for k in pool:
                    if k in cur:
                        continue
                    cand = cur[:i] + [k] + cur[i + 1:]
                    v = f(cand)
                    if v[0] > best[0] + 1e-9:
                        cur, best, improved = cand, v, True
        if best[2]:
            found[frozenset(cur)] = (best[0], tuple(sorted(cur)), best[1])
    res = sorted(found.values(), key=lambda x: -x[0])
    picked = []
    for sc, combo, a in res:
        if all(len(set(combo) & set(p[1])) <= 3 for p in picked):
            picked.append((sc, combo, a))
        if len(picked) >= keep:
            break
    return picked


def main():
    rng = random.Random(20261025)
    centers = sorted(k for k, g in GRADE.items() if g <= 6 and k not in NUM_CENTER)
    pool = {}
    for i, c in enumerate(centers):
        b = search(c, rng)
        if b:
            pool[c] = b
        if i % 100 == 0:
            print(f"  {i}/{len(centers)} 中央の字を調べた。盤が作れた字 {len(pool)}", flush=True)
    print("盤が作れた中央の字:", len(pool), " 2つめの盤もある字:", sum(1 for b in pool.values() if len(b) > 1))

    n_days = (END - START).days + 1
    flat = sorted(((b[0][0], c, 0) for c, b in pool.items()), key=lambda x: -x[0])
    # 最初の1週間は、やさしい字（中央もまわりも小学校の字が多い）で答えが14〜24語、全部が質0のよい盤
    def easy(x):
        sc, c, w = x
        _, combo, a = pool[c][w]
        return (GRADE[c] <= 3 and sum(GRADE[k] <= 4 for k in combo) >= 5 and 14 <= len(a) <= 24
                and all(Q[x] == 0 for x in a))
    # 似た盤が続かないように: 前に選んだ盤と字が3つ以上重ならない、数字（一〜十・百・千・万）が多い盤は1つまで
    NUM = set("一二三四五六七八九十百千万")
    cand = [x for x in flat if easy(x)][:40]
    rng.shuffle(cand)
    first, numeric = [], 0
    for x in cand:
        chars = set(x[1]) | set(pool[x[1]][x[2]][1])
        if any(len(chars & (set(y[1]) | set(pool[y[1]][y[2]][1]))) >= 3 for y in first):
            continue
        isnum = len(chars & NUM) >= 3
        if isnum and numeric >= 1:
            continue
        numeric += isnum
        first.append(x)
        if len(first) == 7:
            break
    used = {x[1] for x in first}
    # 1つめの盤（中央の字ごとにいちばんよい盤）を全部使い、足りない分を2つめ以降の盤の点の高い順で足す
    rest = [x for x in flat if x[1] not in used]
    alt = sorted(((b[w][0], c, w) for c, b in pool.items() for w in range(1, len(b))), key=lambda x: -x[0])
    need = n_days - len(first)
    rest = (rest + alt)[:need] if len(rest) < need else rest[:need]
    assert len(first) + len(rest) >= n_days, f"盤が足りない {len(first) + len(rest)} < {n_days}"

    # 並べる: 前後14日で中央の字が重ならないように。残りの数が多い字から先に置くと行き詰まらない
    # （同じ字の盤どうしは自然に離れる）。同点は乱数で混ぜる
    seq = list(first)
    left = list(rest)
    rng.shuffle(left)
    while len(seq) < n_days:
        recent = {y[1] for y in seq[-GAP:]}
        cnt = Counter(x[1] for x in left)
        ok = [x for x in left if x[1] not in recent]
        if not ok:
            raise SystemExit("前後14日の条件を満たせない")
        top = max(cnt[x[1]] for x in ok)
        x = next(x for x in ok if cnt[x[1]] == top)
        left.remove(x)
        seq.append(x)

    days = []
    for k, (sc, c, which) in enumerate(seq):
        d = START + timedelta(days=k)
        _, combo, a = pool[c][which]
        outer = list(combo)
        random.Random(f"{d}{c}").shuffle(outer)   # 盤の並びは日ごとに混ぜる
        days.append({"d": d.isoformat(), "c": c, "o": "".join(outer), "a": a})

    # ------------------------------------------------------------------ 検算
    assert days[0]["d"] == "2026-10-25" and days[-1]["d"] == "2027-12-31" and len(days) == n_days
    for i, day in enumerate(days):
        c, o, a = day["c"], day["o"], day["a"]
        assert len(o) == 6 and len(set(o + c)) == 7, day
        assert GRADE[c] <= 6 and all(GRADE[k] <= 8 for k in o), day
        again = answers_bruteforce(c, o)
        assert again == a, (day, again)                  # 辞書から作り直して一致
        assert score_board(c, o, a) is not None, day     # 条件をすべて満たす
        assert c not in NUM_CENTER and sum(map(numeralish, a)) <= MAX_NUMERAL * len(a), day
        for j in range(max(0, i - GAP), i):
            assert days[j]["c"] != c, (days[j], day)
    # 既知の答え: 火・山・花・大・人・口・水 の盤なら 火山・花火・大人・人口・火口・山火 は作れる語
    a = answers_bruteforce("火", "山花大人口水")
    for w in ["火山", "花火", "大人", "人口", "火口", "大火"]:
        assert w in a, w
    assert "火山" not in answers_bruteforce("山", "花大人口水金")   # 火 が盤に無ければ作れない
    assert "人々" not in a and all(len(w) >= 2 for w in a)
    assert a == answers("火", "山花大人口水")              # 索引版と素朴な版が一致
    # 数字っぽさの判定と、数字だらけの盤が弾かれること（負例）
    assert numeralish("二十日") and numeralish("一回") and numeralish("三人") and not numeralish("日本") and not numeralish("今日")
    num_board = answers_bruteforce("二", "日前十期一回")
    assert score_board("二", "日前十期一回", num_board) is None
    # 負例: わざと答えを1つ消した日・盤の字を1つ変えた日は、検算で落ちる
    bad = dict(days[0]); bad["a"] = days[0]["a"][1:]
    assert answers_bruteforce(bad["c"], bad["o"]) != bad["a"]
    bad2 = dict(days[0]); bad2["o"] = "愛" + days[0]["o"][1:] if "愛" not in days[0]["o"] + days[0]["c"] else "球" + days[0]["o"][1:]
    assert answers_bruteforce(bad2["c"], bad2["o"]) != days[0]["a"]

    out = {"v": 1, "start": START.isoformat(), "end": END.isoformat(), "days": days}
    (DATA / "daily.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    ns = [len(d["a"]) for d in days]
    cu = Counter(d["c"] for d in days)
    print(f"日数 {len(days)}  答えの数 最小{min(ns)} 平均{sum(ns)/len(ns):.1f} 最大{max(ns)}  中央の字の種類 {len(cu)}  2回使う字 {sum(1 for v in cu.values() if v > 1)}")
    print("中央の字の学年:", dict(sorted(Counter(GRADE[d['c']] for d in days).items())))
    print("まわりの字の学年:", dict(sorted(Counter(GRADE[k] for d in days for k in d['o']).items())))
    print("長さ別の答え:", dict(sorted(Counter(len(w) for d in days for w in d['a']).items())))
    tot = sum(ns)
    print("数字っぽい答えの割合: %.1f%%（盤ごとの最大 %.0f%%）" % (
        100 * sum(1 for d in days for w in d['a'] if numeralish(w)) / tot,
        100 * max(sum(map(numeralish, d['a'])) / len(d['a']) for d in days)))
    print("質1の答えの割合: %.1f%%  固有名詞らしい語の割合: %.1f%%  中央の字を含む答えの割合: %.1f%%" % (
        100 * sum(1 for d in days for w in d['a'] if Q[w] == 1) / tot,
        100 * sum(1 for d in days for w in d['a'] if w in PROPERISH) / tot,
        100 * sum(1 for d in days for w in d['a'] if d['c'] in w) / tot))
    for d in days[:7]:
        print(d["d"], d["c"], d["o"], len(d["a"]), " ".join(f"{w}({READ[w]})" for w in d["a"]))


if __name__ == "__main__":
    main()
