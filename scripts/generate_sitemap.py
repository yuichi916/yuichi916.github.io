"""Regenerate sitemap.xml from the actual HTML files in the repo.

Why a fresh script: GSC has been reporting 'couldn't read' / '0 pages
detected' despite the existing sitemap parsing as valid XML, and the
audit showed the live sitemap is also missing 7 actual pages. The fix
is to produce a single, simple, complete sitemap from ground truth
(the HTML files on disk) and resubmit.

Design choices:
  - No XML extensions (no image:image), just the core sitemaps 0.9 schema.
    Google's stricter parser sometimes silently drops sitemaps that mix
    namespaces without the urlset declaring them at the top level.
  - One <url> per line (compact form). Google parses this fine.
  - lastmod from the git history of each file (max of last commit dates).
  - changefreq + priority from a small hand-tuned map per path pattern.
  - Drop duplicate URLs (e.g. hitoritabi/ alongside hitoritabi/index.html).
"""
from __future__ import annotations

import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# スクリプトが置かれているリポジトリを対象にする。以前は特定のクローンを
# 絶対パスで直書きしていたため、別のクローンから実行すると無関係な作業ツリーの
# sitemap.xml を書き換えてしまっていた。
ROOT = Path(__file__).resolve().parents[1]
SITE = "https://yuichi916.github.io"
OUT = ROOT / "sitemap.xml"

# Pages we never want in the sitemap
EXCLUDE = {
    "googlea794ff425484fcb3.html",  # verification stub
}

# Priority & changefreq policy keyed by path prefix; first match wins.
# Tuple: (changefreq, priority)
POLICY: list[tuple[str, tuple[str, str]]] = [
    ("index.html",       ("weekly",  "1.0")),
    ("hitoritabi/index.", ("weekly",  "0.9")),
    ("hitoritabi/",      ("monthly", "0.7")),
    ("salon/",           ("monthly", "0.7")),
    # Top-level "app" pages
    ("salon.html",       ("weekly",  "0.9")),
    ("universe.html",    ("weekly",  "0.9")),
    ("niwa.html",        ("weekly",  "0.9")),
    ("cabin.html",       ("weekly",  "0.9")),
    ("stopwatch.html",   ("monthly", "0.8")),
    ("sudoku.html",      ("monthly", "0.8")),
    ("shogi-puyo.html",  ("monthly", "0.8")),
    ("lingo.html",       ("monthly", "0.8")),
    ("toeic.html",       ("monthly", "0.8")),
    ("toeic-practice.html", ("monthly", "0.8")),
    ("journal.html",     ("monthly", "0.7")),
    ("world.html",       ("monthly", "0.7")),
]
DEFAULT_POLICY = ("monthly", "0.6")


def policy_for(rel: str) -> tuple[str, str]:
    for prefix, p in POLICY:
        if rel == prefix or rel.startswith(prefix):
            return p
    return DEFAULT_POLICY


def git_lastmod(path: Path) -> str:
    """ISO date of the last commit touching `path`, else today."""
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%cI", "--", path.relative_to(ROOT).as_posix()],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        iso = result.stdout.strip()
        if iso:
            # take YYYY-MM-DD
            return iso.split("T")[0]
    except subprocess.CalledProcessError:
        pass
    return datetime.now(timezone.utc).date().isoformat()


def site_url_for(rel: str) -> str:
    if rel == "index.html":
        return SITE + "/"
    if rel.endswith("/index.html"):
        # drop trailing index.html to avoid duplicates
        return SITE + "/" + rel[: -len("index.html")]
    return SITE + "/" + rel


def main() -> int:
    files = sorted({
        p.relative_to(ROOT).as_posix()
        for p in ROOT.glob("**/*.html")
        if ".git" not in p.parts and p.name not in EXCLUDE
    })
    urls: list[tuple[str, str, str, str]] = []
    seen = set()
    for rel in files:
        url = site_url_for(rel)
        if url in seen:
            continue
        seen.add(url)
        changefreq, priority = policy_for(rel)
        lastmod = git_lastmod(ROOT / rel)
        urls.append((url, lastmod, changefreq, priority))

    lines: list[str] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for url, lastmod, freq, prio in urls:
        lines.append(
            f"  <url><loc>{url}</loc>"
            f"<lastmod>{lastmod}</lastmod>"
            f"<changefreq>{freq}</changefreq>"
            f"<priority>{prio}</priority></url>"
        )
    lines.append("</urlset>")
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote: {OUT}  ({len(urls)} URLs)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
