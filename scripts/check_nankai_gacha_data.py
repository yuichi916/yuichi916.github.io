# -*- coding: utf-8 -*-
"""data/nankai-gacha/nankai-gacha.json の自己検査。通らなければ止まる。

確かめること
  A. 人口の表そのものが正しく読めているか（表の外の値と突き合わせる）
     - 全国の合計 = 総務省「ポイント」PDF の 1億2,376万7,642人
     - 横浜市 = 同 PDF の 375万3,315人（市区部の人口1位）
     - 都道府県別の別ファイル(000892948.xlsx)の47都道府県の人口 = 市区町村別ファイルの都道府県行
       = その都道府県の市区町村（政令市の区と、郡・島しょの小計行を除く）の合計
     - 政令市の人口 = その区の合計（ページで使う区のある市すべて）
  B. 照合
     - points.json の全件に人口が付いたか。付かなかったものは理由つきで一覧を出す
     - 各行の 分・m が points.json と一致、人口が表の値と一致
     - 有名な数市の人口が表どおりか（表の行を別経路で引いて照合）
  C. 合計が妥当か（全国の人口に対する割合）
"""
from __future__ import annotations

import io
import json
import re
import sys
from pathlib import Path

import openpyxl

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "nankai-gacha" / "nankai-gacha.json"
POINTS = Path(r"C:\projects\zundamon-ai-lab\output\shorts\ai-news\nankai_01\points.json")
MUNI = Path(r"C:\tmp\nankai-gacha-pop\dl\r8_shikuchoson.xlsx")
PREF = Path(r"C:\tmp\nankai-gacha-pop\dl\r8_pref.xlsx")   # https://www.soumu.go.jp/main_content/000892948.xlsx

# 総務省「住民基本台帳に基づく人口、人口動態及び世帯数のポイント（令和8年1月1日現在）」
# https://www.soumu.go.jp/main_content/000892926.pdf  p.1「総計 1億2,376万7,642人」、p.2「神奈川県横浜市(375万3,315人)」
PDF_NATIONAL = 123_767_642
PDF_YOKOHAMA = 3_753_315

ok = 0


def check(cond: bool, msg: str) -> None:
    global ok
    if not cond:
        print("NG:", msg)
        raise SystemExit(1)
    ok += 1


def rows_of(p: Path):
    return list(openpyxl.load_workbook(p, read_only=True, data_only=True).worksheets[0].iter_rows(values_only=True))


def main() -> int:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    points = json.loads(POINTS.read_text(encoding="utf-8"))["points"]

    # ---- A. 表そのもの ----
    muni = rows_of(MUNI)
    body = [r for r in muni[6:] if r[0]]
    national = [r for r in body if r[1] == "合計"]
    check(len(national) == 1 and national[0][5] == PDF_NATIONAL, f"全国の合計 {national}")
    pref_rows = {r[1]: r[5] for r in body if r[2] == "-" and r[1] != "合計"}
    check(len(pref_rows) == 47, f"都道府県行 {len(pref_rows)}")
    check(sum(pref_rows.values()) == PDF_NATIONAL, "都道府県行の合計 ≠ 全国")

    pref_file = {r[1]: r[4] for r in rows_of(PREF)[7:] if r[0] and r[1] and r[0] != "-" and isinstance(r[4], int)}
    check(len(pref_file) == 47, f"都道府県別ファイル {len(pref_file)}")
    for k, v in pref_file.items():
        check(pref_rows.get(k) == v, f"{k}: 市区町村別ファイル {pref_rows.get(k)} ≠ 都道府県別ファイル {v}")

    ward = re.compile(r"^.+市.+区$")
    by_pref: dict[str, int] = {}
    table: dict[tuple[str, str], int] = {}
    for r in body:
        pref, name, total = r[1], r[2], r[5]
        if name in (None, "-"):
            continue
        table[(pref, name)] = total
        # 区（政令市の内訳）と、郡・「島しょ」の小計行は数えない
        if ward.match(name) or not re.search(r"[市区町村]$", name):
            continue
        by_pref[pref] = by_pref.get(pref, 0) + total
    for k, v in pref_rows.items():
        check(by_pref.get(k) == v, f"{k}: 市区町村の合計 {by_pref.get(k)} ≠ 都道府県 {v}")

    check(table[("神奈川県", "横浜市")] == PDF_YOKOHAMA, f"横浜市 {table[('神奈川県', '横浜市')]}")

    cities = sorted({(r["pref"], r["name"].split("市")[0] + "市") for r in data["rows"] if ward.match(r["name"])})
    for pref, city in cities:
        wards = sum(v for (p, n), v in table.items() if p == pref and n.startswith(city) and n != city and ward.match(n))
        check(wards == table[(pref, city)], f"{city}: 区の合計 {wards} ≠ 市 {table[(pref, city)]}")
    print(f"A. 表: 全国 {PDF_NATIONAL:,} 人・横浜市 {PDF_YOKOHAMA:,} 人が PDF と一致、47都道府県が2ファイルで一致、"
          f"政令市 {len(cities)} 市（{'・'.join(c for _, c in cities)}）で 区の合計 = 市")

    # ---- B. 照合 ----
    rows = data["rows"]
    check(len(points) == data["tsunami"]["count"] == 403, f"points {len(points)}")
    excluded = data["excluded"]
    check(len(rows) + len(excluded) == len(points), "件数の合計が合わない")
    if excluded:
        print("人口が付かなかった市区町村:")
        for e in excluded:
            print("  ", e["pref"], e["name"], "—", e["reason"])
    by_key = {(r["area"], r["name"]): r for r in rows}
    for p in points:
        r = by_key.get((p["pref"], p["name"]))
        if r is None:
            check(any(e["name"] == p["name"] and e["pref"] == p["pref"] for e in excluded), f"行が消えた {p}")
            continue
        check(r["min"] == p["min"] and r["h"] == p["h"], f"津波の値がずれた {p} {r}")
        pref = "東京都" if p["pref"].startswith("東京都（") else p["pref"]
        check(r["pop"] == table[(pref, p["name"])], f"人口がずれた {r}")
    codes = [r["code"] for r in rows]
    check(len(set(codes)) == len(codes), "団体コードが重複")

    # 有名な数市（表の行を団体コードで引き直して照合。名前の照合とは別経路）
    by_code = {str(r[0]): r for r in body}
    famous = ["静岡市清水区", "浜松市中央区", "高知市", "和歌山市", "徳島市", "宮崎市", "大阪市住之江区", "名古屋市港区", "東牟婁郡串本町"]
    for name in famous:
        r = next(x for x in rows if x["name"] == name)
        src = by_code[r["code"]]
        check(src[2] == name and src[5] == r["pop"], f"{name}: 団体コード {r['code']} の行 {src[:6]}")
        print(f"   {name}: {r['pop']:,} 人（団体コード {r['code']}）")

    # ---- C. 合計 ----
    total = sum(r["pop"] for r in rows)
    share = total / PDF_NATIONAL
    check(25_000_000 < total < 45_000_000, f"合計 {total}")
    check(min(r["pop"] for r in rows) > 0, "人口0の行がある")
    print(f"B. 照合: {len(rows)}/{len(points)} 件に人口（除外 {len(excluded)} 件）、分・m・人口すべて一致")
    print(f"C. 合計: {total:,} 人（全国の {share:.1%}）。最少 {min(rows, key=lambda r: r['pop'])['name']} "
          f"{min(r['pop'] for r in rows):,} 人、最多 {max(rows, key=lambda r: r['pop'])['name']} {max(r['pop'] for r in rows):,} 人")
    print(f"ALL OK（{ok} 件の検査）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
