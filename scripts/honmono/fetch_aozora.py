"""どっちが本物？: 青空文庫から作品のテキストと図書カードを取り、著作権の状態と底本を記録する。

  - 青空文庫の公開目録 list_person_all_extended_utf8.zip（作品・人物の著作権フラグ、底本、テキスト URL を含む）を読む
  - works.py の各作品について、作品著作権フラグ・人物著作権フラグが「なし」であることを確かめる
  - 図書カード（HTML）も取得し、「著作権存続」の表示がないことを確かめる
  - ルビ付きテキストの zip を _dev/honmono/src/ に保存し、SHA-256 を記録する
  - 結果を data/honmono/works.json に書く

使い方:  python scripts/honmono/fetch_aozora.py
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import sys
import time
import urllib.request
import zipfile
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from works import WORKS  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "_dev" / "honmono" / "src"
OUT = ROOT / "data" / "honmono" / "works.json"
INDEX_URL = "https://www.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip"
UA = {"User-Agent": "Mozilla/5.0 (honmono-quiz; +https://yuichi916.github.io/)"}


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main() -> None:
    SRC.mkdir(parents=True, exist_ok=True)
    idx = get(INDEX_URL)
    with zipfile.ZipFile(io.BytesIO(idx)) as z:
        csv_text = z.read(z.namelist()[0]).decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(csv_text)))
    head = rows[0]
    col = {name: i for i, name in enumerate(head)}
    by_id: dict[str, list[list[str]]] = {}
    for r in rows[1:]:
        by_id.setdefault(r[col["作品ID"]], []).append(r)

    works = []
    for wid, author in WORKS:
        cands = [r for r in by_id.get(wid, []) if r[col["役割フラグ"]] == "著者"]
        if len(cands) != 1:
            raise SystemExit(f"{wid}: 著者の行が {len(cands)} 件")
        r = cands[0]
        name = r[col["姓"]] + r[col["名"]]
        if name != author:
            raise SystemExit(f"{wid}: 作家名が違う {name} != {author}")
        if r[col["作品著作権フラグ"]] != "なし" or r[col["人物著作権フラグ"]] != "なし":
            raise SystemExit(f"{wid}: 著作権フラグが『なし』でない")
        card_url = r[col["図書カードURL"]]
        card_html = get(card_url).decode("utf-8", errors="replace")
        if "著作権存続" in card_html:
            raise SystemExit(f"{wid}: 図書カードに『著作権存続』の表示がある")
        txt_url = r[col["テキストファイルURL"]]
        data = get(txt_url)
        zpath = SRC / f"{wid}.zip"
        zpath.write_bytes(data)
        works.append({
            "id": wid,
            "title": r[col["作品名"]],
            "subtitle": r[col["副題"]],
            "author": name,
            "born": r[col["生年月日"]],
            "died": r[col["没年月日"]],
            "orthography": r[col["文字遣い種別"]],
            "work_copyright": r[col["作品著作権フラグ"]],
            "person_copyright": r[col["人物著作権フラグ"]],
            "card_url": card_url,
            "card_checked": "図書カードに「著作権存続」の表示なし",
            "text_url": txt_url,
            "text_zip": f"_dev/honmono/src/{wid}.zip",
            "text_zip_sha256": hashlib.sha256(data).hexdigest(),
            "text_updated": r[col["テキストファイル最終更新日"]],
            "teihon": r[col["底本名1"]],
            "teihon_publisher": r[col["底本出版社名1"]],
            "teihon_first_edition": r[col["底本初版発行年1"]],
            "oya_teihon": r[col["底本の親本名1"]],
        })
        print(wid, name, r[col["作品名"]], r[col["文字遣い種別"]], len(data), "bytes")
        time.sleep(0.6)  # 青空文庫に負担をかけない

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "source": "青空文庫 公開目録 " + INDEX_URL,
        "fetched": date.today().isoformat(),
        "works": works,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", OUT.relative_to(ROOT), len(works), "works")


if __name__ == "__main__":
    main()
