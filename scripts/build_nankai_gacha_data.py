# -*- coding: utf-8 -*-
"""「南海トラフの日、あなたは」(nankai-gacha.html) のデータを作る。

入力（どちらも一次資料。数字は手で書かない）
  1. 津波: 内閣府 南海トラフ巨大地震モデル・被害想定手法検討会「市町村別一覧表」(2025-03-31)
     を取り出して監査済みの正本
       C:\\projects\\zundamon-ai-lab\\output\\shorts\\ai-news\\nankai_01\\points.json
     （生成と自己検査: 同じフォルダの nankai_data.py。キー pref, name, lat, lon, min, h）
  2. 人口: 総務省「住民基本台帳に基づく人口、人口動態及び世帯数（令和8年1月1日現在）」
     参考資料【総計】市区町村別（日本人住民＋外国人住民）。政令市の区の行もある。
       https://www.soumu.go.jp/main_content/000892952.xlsx
     手元にない場合はダウンロードして C:\\tmp\\nankai-gacha-pop\\dl\\ に置く。

出力
  data/nankai-gacha/nankai-gacha.json  … ページが読む唯一のデータ

照合は (都道府県, 市区町村名) の完全一致だけ。points.json の「東京都（区部）」「東京都（島嶼部）」は
「東京都」として引く。一致しなかった行は推測で埋めず、excluded に理由つきで残す。

使い方:  python scripts/build_nankai_gacha_data.py
検査:    python scripts/check_nankai_gacha_data.py
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import sys
import urllib.request
from pathlib import Path

import openpyxl

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "nankai-gacha" / "nankai-gacha.json"

POINTS = Path(r"C:\projects\zundamon-ai-lab\output\shorts\ai-news\nankai_01\points.json")
POP_URL = "https://www.soumu.go.jp/main_content/000892952.xlsx"
POP_PAGE = "https://www.soumu.go.jp/main_sosiki/jichi_gyousei/daityo/jinkou_jinkoudoutai-setaisuu.html"
POP_XLSX = Path(r"C:\tmp\nankai-gacha-pop\dl\r8_shikuchoson.xlsx")
POP_RETRIEVED = "2026-10-24"

TSUNAMI_URL = "https://www.bousai.go.jp/jishin/nankai/kento_wg/pdf/ichiran.pdf"
# points.json の元（nankai_data.py が読む、一覧表から取り出した413件）。到達時間「-」の市区町村を名前で出すために読む
POINTS_CSV = Path(r"C:\tmp\nankai\points.csv")


def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def load_population() -> dict[tuple[str, str], tuple[str, int]]:
    if not POP_XLSX.exists():
        POP_XLSX.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(POP_URL, headers={"User-Agent": "Mozilla/5.0"})
        POP_XLSX.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    ws = openpyxl.load_workbook(POP_XLSX, read_only=True, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    # 見出しの形を確かめてから読む（列がずれた版を黙って読まない）
    assert rows[5][:3] == ("団体コード", "都道府県名", "市区町村名"), rows[5]
    assert rows[3][5] == "人口" and rows[4][5] == "計", (rows[3][5], rows[4][5])
    assert "令和8年1月1日" in rows[0][0], rows[0][0]
    pop: dict[tuple[str, str], tuple[str, int]] = {}
    for r in rows[6:]:
        code, pref, name, total = r[0], r[1], r[2], r[5]
        if not code or name in (None, "-"):
            continue
        key = (pref, name)
        assert key not in pop, f"重複: {key}"
        pop[key] = (str(code), int(total))
    return pop


def main() -> int:
    src = json.loads(POINTS.read_text(encoding="utf-8"))
    points = src["points"]
    pop = load_population()

    rows, excluded = [], []
    for p in points:
        pref = p["pref"]
        pref_key = "東京都" if pref.startswith("東京都（") else pref
        hit = pop.get((pref_key, p["name"]))
        if hit is None:
            excluded.append({"pref": pref, "name": p["name"], "reason": "住民基本台帳の表に同じ名前の市区町村が見つからない"})
            continue
        code, n = hit
        if n <= 0:
            excluded.append({"pref": pref, "name": p["name"], "reason": f"人口が {n}"})
            continue
        rows.append({
            "code": code,
            "pref": pref_key,
            "area": pref,            # points.json の表記（東京都（区部）など）
            "name": p["name"],
            "min": p["min"],
            "h": p["h"],
            "pop": n,
        })

    # 一覧表で到達時間が「-」のため points.json に入っていない市区町村
    dash = []
    if POINTS_CSV.exists():
        src_rows = list(csv.DictReader(open(POINTS_CSV, encoding="utf-8-sig")))
        col = next(c for c in src_rows[0] if c.startswith("到達時間"))
        dash = [{"pref": r["都道府県"], "name": r["市町村名"]} for r in src_rows if not r[col].strip().isdigit()]
        assert len(src_rows) - len(dash) == len(points), (len(src_rows), len(dash), len(points))

    out = {
        "title": "南海トラフの日、あなたは — データ",
        "built": POP_RETRIEVED,
        "tsunami": {
            "source": src["source"],
            "url": TSUNAMI_URL,
            "note": src["note"],
            "file": "points.json（内閣府の一覧表から取り出し、資料の文と照合した正本）",
            "sha256": sha256(POINTS),
            "count": len(points),
        },
        "population": {
            "source": "総務省「住民基本台帳に基づく人口、人口動態及び世帯数（令和8年1月1日現在）」【総計】市区町村別（日本人住民＋外国人住民）",
            "page": POP_PAGE,
            "url": POP_URL,
            "as_of": "2026-01-01",
            "retrieved": POP_RETRIEVED,
            "sha256": sha256(POP_XLSX),
        },
        "constants": {
            "walk_m_per_min": {
                "value": 80,
                "source": "不動産の表示に関する公正競争規約施行規則 第9条(9)「徒歩による所要時間は、道路距離80メートルにつき1分間を要するものとして算出」",
                "url": "https://www.rftc.jp/webkanri/kanri/wp-content/uploads/2019/02/h_kiyaku.pdf",
            },
            "floor_m": {
                "value": 3,
                "source": "国土交通省「水害ハザードマップ作成の手引き」(令和8年5月) p.36・p.38「2階床下に相当する3m」「日本の二階建て家屋の床面高は3.0m以上（0.45+2.3+0.24=2.99m≒3.0m）」",
                "url": "https://www.mlit.go.jp/river/basic_info/jigyo_keikaku/saigai/tisiki/hazardmap/pdf/suigai_hazardmap_tebiki.pdf",
            },
        },
        "not_in_list": dash,    # 一覧表で到達時間「-」
        "excluded": excluded,   # 人口が付けられなかったもの
        "rows": rows,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    total = sum(r["pop"] for r in rows)
    print(f"{len(rows)}件に人口を付けた（除外 {len(excluded)}件）。人口の合計 {total:,} 人 → {OUT}")
    for e in excluded:
        print("  除外:", e["pref"], e["name"], "—", e["reason"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
