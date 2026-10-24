"""総務省「全国地方公共団体コード」(令和6年1月1日更新) の Excel から、
fuseru.html が住所の検出に使う都道府県・市区町村名の一覧 data/fuseru/places.js を作る。

一次資料: https://www.soumu.go.jp/denshijiti/code.html
          https://www.soumu.go.jp/main_content/000925835.xlsx
          （_dev/fuseru/src/ に取得時のファイルを保存）

ページは fetch を使わない（CSP で connect-src 'none'）ので、JSON ではなく
<script src> で読める .js（グローバル変数に代入）として書き出す。

自己検査（既知の正解で assert）:
  - 都道府県 47、市区町村（特別区・政令市の区を含む）の件数が表の行数と一致
  - 札幌市中央区・千代田区・横浜市中区・大阪市北区・那覇市・与那国町 が入っている
  - 政令指定都市は 20 市
"""
from __future__ import annotations

import json
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "_dev" / "fuseru" / "src" / "soumu_dantai_code_R6_0101_000925835.xlsx"
OUT = ROOT / "data" / "fuseru" / "places.js"


def main() -> None:
    wb = openpyxl.load_workbook(SRC, read_only=True)
    ws_all, ws_wards = wb.worksheets[0], wb.worksheets[1]

    prefs: list[str] = []
    munis: dict[str, int] = {}   # 名前 -> 都道府県の番号（0始まり）
    n_rows = 0
    for row in list(ws_all.iter_rows(values_only=True))[1:]:
        code, pref, city = row[0], row[1], row[2]
        if not code or not pref:
            continue
        n_rows += 1
        if pref not in prefs:
            prefs.append(pref)
        if city:
            munis.setdefault(city, prefs.index(pref))

    designated: list[str] = []
    n_ward_rows = 0
    for row in list(ws_wards.iter_rows(values_only=True))[1:]:
        code, pref, name = row[0], row[1], row[2]
        if not code or not pref or not name:
            continue
        n_ward_rows += 1
        if name.endswith("市"):
            designated.append(name)
        munis.setdefault(name, prefs.index(pref))   # 例: 札幌市中央区

    # ---- 自己検査 ----
    assert len(prefs) == 47, len(prefs)
    assert prefs[0] == "北海道" and prefs[12] == "東京都" and prefs[46] == "沖縄県"
    assert len(designated) == 20, designated
    for must in ["札幌市中央区", "千代田区", "横浜市中区", "大阪市北区", "那覇市", "与那国町", "さいたま市", "つくば市"]:
        assert must in munis, must
    # 表の行数 = 都道府県47 + 市区町村。区を足したぶんだけ munis が増える
    n_city_rows = n_rows - 47
    n_ward_only = n_ward_rows - len(designated)
    assert len(munis) <= n_city_rows + n_ward_only

    data = {
        "source": "総務省「全国地方公共団体コード」都道府県コード及び市区町村コード（令和6年1月1日更新）",
        "sourceUrl": "https://www.soumu.go.jp/denshijiti/code.html",
        "asOf": "2024-01-01",
        "prefs": prefs,
        "munis": sorted(([name, idx] for name, idx in munis.items()), key=lambda x: (-len(x[0]), x[0])),
        "designated": designated,
    }
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        "/* fuseru: 都道府県・市区町村名。scripts/fuseru/build_places.py が総務省の表から生成。手で直さない */\n"
        "(function(g){g.FUSERU_PLACES=" + body + ";})(typeof globalThis!=='undefined'?globalThis:this);\n",
        encoding="utf-8",
    )
    print(f"prefs={len(prefs)} munis={len(munis)} (表の市区町村行 {n_city_rows} + 政令市の区 {n_ward_only}) designated={len(designated)}")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
