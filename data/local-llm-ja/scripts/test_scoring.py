"""採点まわりの自己検査。既知の正解で assert する。python test_scoring.py"""
import math
from bench import parse_digit, parse_letter, load_jcqa, load_mmmlu, load_elyza
from stats import wilson, mean_ci

# 1) 選択肢の取り出し: よくある出力の形
digit_cases = {"2": 2, "答え：3": 3, "**4**": 4, "０": 0, "答えは 1 です。": 1, "選択肢2の「マザーボード」": 2,
               " 4\n": 4, "わかりません": None, "10": None, "5": None}
for text, want in digit_cases.items():
    got = parse_digit(text)
    assert got == want, (text, got, want)
letter_cases = {"B": "B", "答え：C": "C", "**D**": "D", "Ａ": "A", "正解はBです": "B", "(A)": "A",
                "Answer: C": "C", "E": None, "なし": None, "C. 0,1": "C"}
for text, want in letter_cases.items():
    got = parse_letter(text)
    assert got == want, (text, got, want)

# 2) 正解をそのまま出す「満点モデル」と、必ず外す「0点モデル」
jc = load_jcqa(); mm = load_mmmlu(); el = load_elyza()
assert len(jc) == 100 and len(mm) == 100 and len(el) == 20
assert len({r["q_id"] for r in jc}) == 100
perfect = sum(parse_digit(str(r["label"])) == r["label"] for r in jc)
wrong = sum(parse_digit(str((r["label"] + 1) % 5)) == r["label"] for r in jc)
assert perfect == 100 and wrong == 0
perfect = sum(parse_letter(r["Answer"]) == r["Answer"] for r in mm)
nxt = {"A": "B", "B": "C", "C": "D", "D": "A"}
wrong = sum(parse_letter(nxt[r["Answer"]]) == r["Answer"] for r in mm)
assert perfect == 100 and wrong == 0
# 抽出は毎回同じ（seed 固定）
assert [r["q_id"] for r in load_jcqa()] == [r["q_id"] for r in jc]

# 3) 信頼区間: 既知の値（Wilson 95%, 50/100 -> 0.404–0.596）
lo, hi = wilson(50, 100)
assert abs(lo - 0.4038) < 1e-3 and abs(hi - 0.5962) < 1e-3, (lo, hi)
lo, hi = wilson(100, 100)
assert hi == 1.0 and abs(lo - 0.9630) < 1e-3, lo
m, lo, hi = mean_ci([3, 3, 3, 3])
assert m == 3 and lo == 3 and hi == 3
m, lo, hi = mean_ci([1, 2, 3, 4, 5])
assert m == 3 and abs((hi - m) - 2.776 * math.sqrt(2.5) / math.sqrt(5)) < 1e-2, (lo, hi)
print("ALL SCORING SELF-TESTS PASSED")
