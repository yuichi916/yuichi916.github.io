"""年末調整の計算機（令和8年分）: 一次資料（国税庁・財務省）を取得して控えを残す。

使い方:  python scripts/nencho_2026/fetch_sources.py
出力:    _dev/nencho-2026/src/*.pdf（大きいので git には入れない。.gitignore 済み）
         _dev/nencho-2026/src/manifest.json（URL・取得日・バイト数・SHA-256。こちらは git に入れる）

計算に使う数値はすべてこの一覧の資料から取り、data/nencho-2026/rules.json に資料名とページを付けて書く。
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "_dev" / "nencho-2026" / "src"

# id は rules.json の sources と同じ
SOURCES = [
    ("nta-nencho2026", "https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/nencho_all.pdf", "nencho2026_all.pdf"),
    ("nta-nencho2026-rei2", "https://www.nta.go.jp/publication/pamph/gensen/nencho2026/pdf/203.pdf", "nencho2026_203.pdf"),
    ("nta-nencho2025", "https://www.nta.go.jp/publication/pamph/gensen/nencho2025/pdf/nencho_all.pdf", "nencho2025_all.pdf"),
    ("nta-nencho2025-rei2", "https://www.nta.go.jp/publication/pamph/gensen/nencho2025/pdf/203.pdf", "nencho2025_203.pdf"),
    ("nta-kaisei2026", "https://www.nta.go.jp/publication/pamph/gensen/2026kaisei.pdf", "2026kaisei.pdf"),
    ("nta-kiso2026-qa", "https://www.nta.go.jp/users/gensen/2026kiso/pdf/0026005-024.pdf", "2026kiso_qa.pdf"),
    ("nta-zeigakuhyo2026", "https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/all.pdf", "zeigakuhyo2026_all.pdf"),
    ("nta-denshi2026", "https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/denshi_01.pdf", "denshi2026.pdf"),
    ("mof-zeisei2026", "https://www.mof.go.jp/tax_policy/publication/brochure/zeisei2026_pdf/zeisei26_all.pdf", "mof_zeisei26_all.pdf"),
]


def main() -> None:
    SRC.mkdir(parents=True, exist_ok=True)
    (SRC / ".gitignore").write_text("*.pdf\n", encoding="utf-8")
    manifest = []
    for sid, url, name in SOURCES:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (nencho-2026 source fetch)"})
        with urllib.request.urlopen(req, timeout=120) as r:
            body = r.read()
        if not body.startswith(b"%PDF-"):
            raise SystemExit(f"{url}: PDF ではない応答")
        (SRC / name).write_bytes(body)
        manifest.append({
            "id": sid, "url": url, "file": name, "bytes": len(body),
            "sha256": hashlib.sha256(body).hexdigest(),
            "fetched": dt.date.today().isoformat(),
        })
        print(f"{sid:22s} {len(body):>10,d} bytes  {name}")
    (SRC / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
