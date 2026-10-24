"""国税庁「年末調整のしかた」の『年末調整等のための給与所得控除後の給与等の金額の表』（47〜54ページ）を
PDF からそのまま読み取り、行（以上・未満・給与所得控除後の金額）を JSON に書き出す。

使い方:  python scripts/nencho_2026/extract_tables.py   （先に fetch_sources.py）
出力:    data/nencho-2026/kyuyo-table-r8.json（令和8年分）
         data/nencho-2026/kyuyo-table-r7.json（令和7年分）

この JSON は計算機の画面では使わない。assets/nencho-2026-core.js の計算式が
表の全行と一致することを scripts/nencho_2026/test_core.mjs で確かめるための「正解表」。
表の冒頭（○円未満は0、○円以上○円未満は「給与等の金額から○円を控除した金額」）と、
660万円以上の算式の行は数字3つ並びではないので、ここでは読まず、下の HEAD_RULES に
PDF の文言を写して残す（test_core.mjs で rules.json と突き合わせる）。
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "_dev" / "nencho-2026" / "src"
OUT = ROOT / "data" / "nencho-2026"

NUM = r"(\d{1,3}(?:,\d{3})+)"
TRIPLE = re.compile(NUM + r"\s+" + NUM + r"\s+" + NUM)

YEARS = {
    "r8": {
        "pdf": "nencho2026_all.pdf", "source": "nta-nencho2026", "pages": list(range(47, 55)),
        "title": "令和８年分の年末調整等のための給与所得控除後の給与等の金額の表",
        # 表の冒頭と末尾（PDF 47・54ページの文言を写したもの）
        "HEAD_RULES": [
            {"text": "741,000円未満 → 0", "lt": 741000, "value": 0},
            {"text": "741,000円以上 2,191,000円未満 → 給与等の金額から740,000円を控除した金額", "ge": 741000, "lt": 2191000, "minus": 740000},
            {"text": "6,600,000円以上 8,500,000円未満 → 給与等の金額に90％を乗じて算出した金額から1,100,000円を控除した金額", "ge": 6600000, "lt": 8500000},
            {"text": "8,500,000円以上 20,000,000円未満 → 給与等の金額から1,950,000円を控除した金額", "ge": 8500000, "lt": 20000000},
            {"text": "20,000,000円 → 18,050,000円", "eq": 20000000, "value": 18050000},
        ],
    },
    "r7": {
        "pdf": "nencho2025_all.pdf", "source": "nta-nencho2025", "pages": list(range(47, 55)),
        "title": "令和７年分の年末調整等のための給与所得控除後の給与等の金額の表",
        "HEAD_RULES": [
            {"text": "651,000円未満 → 0", "lt": 651000, "value": 0},
            {"text": "651,000円以上 1,900,000円未満 → 給与等の金額から650,000円を控除した金額", "ge": 651000, "lt": 1900000, "minus": 650000},
            {"text": "6,600,000円以上 8,500,000円未満 → 給与等の金額に90％を乗じて算出した金額から1,100,000円を控除した金額", "ge": 6600000, "lt": 8500000},
            {"text": "8,500,000円以上 20,000,000円未満 → 給与等の金額から1,950,000円を控除した金額", "ge": 8500000, "lt": 20000000},
            {"text": "20,000,000円 → 18,050,000円", "eq": 20000000, "value": 18050000},
        ],
    },
}


def to_int(s: str) -> int:
    return int(s.replace(",", ""))


def extract(cfg: dict) -> list[list[int]]:
    doc = pymupdf.open(SRC / cfg["pdf"])
    head = doc[cfg["pages"][0] - 1].get_text("text", sort=True)
    assert cfg["title"].replace("８", "8").replace("７", "7")[:4] in head.replace("８", "8").replace("７", "7"), "表の見出しが見つからない"
    rows = set()
    for p in cfg["pages"]:
        text = doc[p - 1].get_text("text", sort=True)
        for line in text.splitlines():
            for m in TRIPLE.finditer(line):
                lo, hi, val = (to_int(g) for g in m.groups())
                rows.add((lo, hi, val))
    out = sorted(rows)
    # 自己検査: 行は隙間なく続き（前の行の「未満」＝次の行の「以上」）、幅は 1,000〜4,000 円、
    # 給与所得控除後の金額は単調に増える
    for a, b in zip(out, out[1:]):
        assert a[1] == b[0], f"行がつながらない: {a} -> {b}"
        assert b[2] >= a[2], f"金額が減っている: {a} -> {b}"
    for lo, hi, val in out:
        assert 0 < hi - lo <= 4000, (lo, hi, val)
        assert val < lo, (lo, hi, val)
    assert out[-1][1] == 6600000, f"表の最後の行が 6,600,000 円未満で終わらない: {out[-1]}"
    return out


def extract_bonus() -> dict:
    """『賞与に対する源泉徴収税額の算出率の表（令和8年分）』（源泉徴収税額表 15〜16ページ＝PDF 16・17枚目）の甲欄。
    率（%）ごとに、扶養親族等の数 0〜7人の「前月の社会保険料等控除後の給与等の金額」の以上・未満（千円）。"""
    doc = pymupdf.open(SRC / "zeigakuhyo2026_all.pdf")
    p16 = doc[15].get_text("text", sort=True)
    p17 = doc[16].get_text("text", sort=True)
    assert "賞与に対する源泉徴収税額の算出率の表（令和8 年分）" in p16
    n = lambda s: int(s.replace(",", ""))
    rates, left = [], []
    first_left = re.findall(r"([\d,]+) 千円未満", p16)
    last_left = re.findall(r"([\d,]+) 千円以上", p16)
    for line in p16.splitlines():
        m = re.match(r"\s*(\d+\.\d{3})\s+((?:[\d,]+\s+){7}[\d,]+)\s*$", line)
        if m:
            rates.append(m.group(1))
            left.append([n(x) for x in m.group(2).split()])
    right = []
    first_right = re.findall(r"([\d,]+) 千円未満", p17)[:4]
    last_right = re.findall(r"([\d,]+) 千円以上", p17)[:4]
    for line in p17.splitlines():
        # 右端の乙欄（「224 千円未満」など）を除いてから数える
        body = re.sub(r"[\d,]+ 千円(?:未満|以上)", "", line)
        nums = re.findall(r"\d{1,3}(?:,\d{3})*", body)
        if len(nums) in (8, 10) and "千円" not in body and re.fullmatch(r"[\d,\s]+", body):
            right.append([n(x) for x in nums[:8]])
    assert len(rates) == 19 and len(left) == 19 and len(right) == 19, (len(rates), len(left), len(right))
    # 列ごとに: 最初の行の「以上」＝「○千円未満」、各行の未満＝次の行の以上、最後の行の未満＝「○千円以上」
    cols = []
    for c in range(8):
        src_rows = left if c < 4 else right
        j = (c % 4) * 2
        lo = [r[j] for r in src_rows]
        hi = [r[j + 1] for r in src_rows]
        f = n((first_left if c < 4 else first_right)[c % 4])
        l = n((last_left if c < 4 else last_right)[c % 4])
        assert lo[0] == f, (c, lo[0], f)
        for a, b in zip(hi, lo[1:]):
            assert a == b, (c, a, b)
        assert hi[-1] == l, (c, hi[-1], l)
        cols.append([f] + lo[1:] + [l])  # 20 個: 率 i+1 の「以上」（i=0..19）
    all_rates = ["0.000"] + rates + ["45.945"]
    return {
        "title": "賞与に対する源泉徴収税額の算出率の表（令和8年分）甲欄",
        "source": "nta-zeigakuhyo2026",
        "pages": "15〜16ページ",
        "note": "ratesPer100000[i] の率は、扶養親族等の数 k の列で boundsThousandYen[k][i-1] 千円以上 boundsThousandYen[k][i] 千円未満（i=0 は最初の境目未満、最後の率は最後の境目以上）",
        "ratesPer100000": [round(float(r) * 1000) for r in all_rates],
        "boundsThousandYen": cols,
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    bonus = extract_bonus()
    (OUT / "bonus-rate-r8.json").write_text(json.dumps(bonus, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("bonus: rates", len(bonus["ratesPer100000"]), "cols", len(bonus["boundsThousandYen"]))
    for key, cfg in YEARS.items():
        rows = extract(cfg)
        data = {
            "title": cfg["title"],
            "source": cfg["source"],
            "pages": f"{cfg['pages'][0]}〜{cfg['pages'][-1]}ページ",
            "note": "PDF の数字3つ並びの行（給与等の金額 以上・未満、給与所得控除後の給与等の金額）をそのまま読み取ったもの。冒頭・末尾の文言の行は head_rules に写した。",
            "head_rules": cfg["HEAD_RULES"],
            "rows": rows,
        }
        path = OUT / f"kyuyo-table-{key}.json"
        path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"{key}: {len(rows)} 行  {rows[0]} … {rows[-1]}  -> {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
