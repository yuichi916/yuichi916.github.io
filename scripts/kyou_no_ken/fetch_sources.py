"""きょうの県: 一次資料を取ってくる。

取ったファイルは _dev/kyou-no-ken/src/ に置く（公開しない。sitemap・llms.txt の対象外）。
数字はここで取ったファイルからだけ作る。手で数字を書かない。

  1. 総務省統計局「統計でみる都道府県のすがた2026」社会生活統計指標（e-Stat の Excel 12 本）
  2. 国土地理院「都道府県の庁舎及び東西南北端点の経緯度（世界測地系）」
     現行サイトから外れたため、Internet Archive の 2015-10-16 の保存版を使う
  3. 国土地理院「都道府県庁間の距離」PDF（距離計算の答え合わせ用。同じく保存版）
  4. 総務省統計局「家計消費状況調査 用語の説明」の地域区分（地方）

使い方:  python scripts/kyou_no_ken/fetch_sources.py
"""
from __future__ import annotations

import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "_dev" / "kyou-no-ken" / "src"

ESTAT = "https://www.e-stat.go.jp/stat-search/file-download?statInfId={}&fileKind=0"
# statInfId → 分野。「統計でみる都道府県のすがた2026」(tstat=000001240736) の社会生活統計指標
ESTAT_FILES = {
    "000040412522": "A_人口・世帯",
    "000040412523": "B_自然環境",
    "000040412524": "C_経済基盤",
    "000040412525": "D_行政基盤",
    "000040412526": "E_教育",
    "000040412527": "F_労働",
    "000040412528": "G_文化・スポーツ",
    "000040412529": "H_居住",
    "000040412530": "I_健康・医療",
    "000040412531": "J_福祉・社会保障",
    "000040412532": "K_安全",
    "000040412533": "L_家計",
}
OTHER = {
    "gsi_zenken.html": "https://web.archive.org/web/20151016142035/http://www.gsi.go.jp/KOKUJYOHO/CENTER/zenken.htm",
    "gsi_kenchokan.pdf": "https://web.archive.org/web/20160509062429id_/http://www.gsi.go.jp/common/000137532.pdf",
    "stat_joukyou_yougo.html": "https://www.stat.go.jp/data/joukyou/yougo-i.html",
}


def get(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (kyou-no-ken data fetch)"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            dest.write_bytes(data)
            print(f"  {dest.name}  {len(data):,} bytes")
            return
        except Exception as e:  # noqa: BLE001 - 取得失敗は再試行してから落とす
            print(f"  retry {attempt + 1}: {e}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))
    raise SystemExit(f"取得できない: {url}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for sid, name in ESTAT_FILES.items():
        get(ESTAT.format(sid), OUT / f"sugata2026_{sid}.xls")
    for name, url in OTHER.items():
        get(url, OUT / name)


if __name__ == "__main__":
    main()
