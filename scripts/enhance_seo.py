#!/usr/bin/env python3
"""Inject missing SEO bits into every HTML page on the site.

Only adds what's missing — never overwrites existing tags. Skips a small
allow-list of pages that are either already gold-standard (stopwatch.html)
or technical / verification stubs (googlea794...html).

For each page we may inject:
  - <meta name="robots">                            (max-image-preview large)
  - <meta name="theme-color">                       (dark+light)
  - <meta name="color-scheme">
  - <link rel="canonical">
  - <meta property="og:title">                      (from <title>)
  - <meta property="og:description">                (from existing description)
  - <meta property="og:type">                       (website)
  - <meta property="og:url">                        (canonical)
  - <meta property="og:image"> + width/height       (page-specific or fallback)
  - <meta property="og:site_name">                  (Views Engineer)
  - <meta name="twitter:card">                      (summary_large_image)
  - <meta name="twitter:site">                      (@ViewsEngineer)
  - <meta name="twitter:title|description|image">
  - <script type="application/ld+json">             (WebPage + BreadcrumbList)
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(r"C:\Users\yuich\yuichi916.github.io")
SITE = "https://yuichi916.github.io"
DEFAULT_OG = SITE + "/assets/og-image.png"
DEFAULT_OG_W = "1200"
DEFAULT_OG_H = "630"
SITE_NAME = "Views Engineer"
TWITTER_HANDLE = "@ViewsEngineer"

# Pages with their own OG image (page → relative path under /assets/)
PAGE_OG = {
    "stopwatch.html": "/assets/og-stopwatch.png",
}

# Skip files that don't need SEO improvement
SKIP = {
    "googlea794ff425484fcb3.html",  # Google site verification stub
    "stopwatch.html",               # already done (gold standard)
}


def site_url_for(path: Path) -> str:
    rel = path.relative_to(ROOT).as_posix()
    if rel == "index.html":
        return SITE + "/"
    if rel.endswith("/index.html"):
        return SITE + "/" + rel[: -len("index.html")]
    return SITE + "/" + rel


def breadcrumbs_for(path: Path, page_title: str) -> list[dict]:
    rel = path.relative_to(ROOT).as_posix()
    items: list[dict] = [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"}
    ]
    parts = [p for p in rel.split("/") if p and p != "index.html"]
    cur = SITE
    pos = 2
    for i, seg in enumerate(parts):
        cur += "/" + seg
        is_last = i == len(parts) - 1
        # name for last segment uses page title, otherwise capitalised dir
        if is_last:
            name = page_title or seg.replace(".html", "").replace("-", " ").title()
        else:
            name = seg.replace("-", " ").title()
        items.append({
            "@type": "ListItem",
            "position": pos,
            "name": name,
            "item": cur if not is_last else cur,
        })
        pos += 1
    return items


def extract_existing(src: str, pattern: str) -> str | None:
    m = re.search(pattern, src, re.I)
    return m.group(1) if m else None


def ensure_meta_tag(src: str, name_or_prop: str, content: str,
                     attr: str = "name") -> tuple[str, bool]:
    """Insert <meta {attr}="name_or_prop" content="..."> if missing.
    Returns (new_src, did_insert)."""
    pattern = rf'<meta\s+{attr}=["\']{re.escape(name_or_prop)}["\']'
    if re.search(pattern, src, re.I):
        return src, False
    tag = f'  <meta {attr}="{name_or_prop}" content="{html_escape(content)}">'
    return inject_into_head(src, tag), True


def html_escape(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
             .replace('"', "&quot;"))


def inject_into_head(src: str, snippet: str) -> str:
    """Insert snippet right before </head>."""
    pos = re.search(r"</head>", src, re.I)
    if not pos:
        return src
    i = pos.start()
    return src[:i] + snippet + "\n" + src[i:]


def maybe_add_canonical(src: str, page_url: str) -> tuple[str, bool]:
    if re.search(r'<link\s+rel=["\']canonical["\']', src, re.I):
        return src, False
    tag = f'  <link rel="canonical" href="{page_url}">'
    return inject_into_head(src, tag), True


def maybe_add_og_basic(src: str, page_url: str, title: str, desc: str,
                       og_image: str) -> list[tuple[str, bool]]:
    results = []
    pairs = [
        ("og:title", title),
        ("og:description", desc),
        ("og:type", "website"),
        ("og:url", page_url),
        ("og:image", og_image),
        ("og:image:width", DEFAULT_OG_W),
        ("og:image:height", DEFAULT_OG_H),
        ("og:image:type", "image/png"),
        ("og:site_name", SITE_NAME),
        ("og:locale", "ja_JP"),
    ]
    for prop, val in pairs:
        src, added = ensure_meta_tag(src, prop, val, attr="property")
        results.append((prop, added))
    return src, results


def maybe_add_twitter(src: str, title: str, desc: str,
                       og_image: str) -> list[tuple[str, bool]]:
    results = []
    pairs = [
        ("twitter:card", "summary_large_image"),
        ("twitter:site", TWITTER_HANDLE),
        ("twitter:creator", TWITTER_HANDLE),
        ("twitter:title", title),
        ("twitter:description", desc),
        ("twitter:image", og_image),
    ]
    for name, val in pairs:
        src, added = ensure_meta_tag(src, name, val, attr="name")
        results.append((name, added))
    return src, results


def maybe_add_misc(src: str) -> tuple[str, int]:
    """Add robots/theme-color/color-scheme/mobile etc if missing."""
    added = 0
    for name, val in [
        ("robots", "index, follow, max-image-preview:large, max-snippet:-1"),
        ("theme-color", "#0d1117"),
        ("color-scheme", "dark light"),
        ("format-detection", "telephone=no"),
    ]:
        src, did = ensure_meta_tag(src, name, val, attr="name")
        if did:
            added += 1
    # apple-touch-icon
    if not re.search(r'<link\s+rel=["\']apple-touch-icon["\']', src, re.I):
        src = inject_into_head(src, '  <link rel="apple-touch-icon" href="/favicon.svg">')
        added += 1
    return src, added


def maybe_add_jsonld(src: str, page_url: str, title: str, desc: str,
                     og_image: str, path: Path) -> tuple[str, bool]:
    if re.search(r'<script\s+type=["\']application/ld\+json["\']', src, re.I):
        return src, False
    rel = path.relative_to(ROOT).as_posix()
    page_type = "WebPage"
    # Heuristics: stopwatch-like tools => WebApplication; main app pages => CreativeWork
    if rel in ("salon.html", "universe.html", "babel.html", "niwa.html",
               "cabin.html", "niwa_scatter.html", "niwa_walk.html"):
        page_type = "WebApplication"
    payload = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": page_type,
                "@id": page_url + "#" + ("app" if page_type == "WebApplication"
                                          else "webpage"),
                "name": title,
                "headline": title,
                "url": page_url,
                "description": desc,
                "image": og_image,
                "inLanguage": "ja",
                "isPartOf": {"@id": SITE + "/#website"},
                "author": {
                    "@type": "Person",
                    "name": "Views Engineer",
                    "alternateName": "yuichi916",
                    "url": SITE + "/",
                },
                "publisher": {
                    "@type": "Organization",
                    "name": "Views Engineer",
                    "url": SITE + "/",
                },
            },
            {
                "@type": "WebSite",
                "@id": SITE + "/#website",
                "url": SITE + "/",
                "name": SITE_NAME,
                "inLanguage": "ja",
                "publisher": {
                    "@type": "Person",
                    "name": "Views Engineer",
                    "url": SITE + "/",
                },
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": breadcrumbs_for(path, title),
            },
        ],
    }
    if page_type == "WebApplication":
        payload["@graph"][0].update({
            "applicationCategory": "UtilitiesApplication",
            "operatingSystem": "Any (modern web browser)",
            "browserRequirements": "Requires JavaScript",
            "isAccessibleForFree": True,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "JPY"},
        })
    snippet = (
        "  <script type=\"application/ld+json\">\n"
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + "\n  </script>"
    )
    return inject_into_head(src, snippet), True


def process(path: Path) -> dict[str, int]:
    rel = path.relative_to(ROOT).as_posix()
    if rel in SKIP or any(rel.endswith("/" + s) or rel == s for s in SKIP):
        return {"skipped": 1}
    if not path.is_file():
        return {}
    src = path.read_text(encoding="utf-8", errors="replace")

    title = extract_existing(src, r"<title>([^<]+)</title>")
    desc = extract_existing(src, r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']')
    if not title or not desc:
        # Pages without basic tags should be hand-curated — flag and skip
        return {"flag_no_title_or_desc": 1}

    title = title.strip()
    desc = desc.strip()
    page_url = site_url_for(path)
    og_rel = PAGE_OG.get(rel, "/assets/og-image.png")
    og_image = SITE + og_rel

    stats: dict[str, int] = {}
    src, did = maybe_add_canonical(src, page_url)
    if did: stats["canonical"] = 1

    src, og_results = maybe_add_og_basic(src, page_url, title, desc, og_image)
    stats["og_added"] = sum(1 for _, d in og_results if d)

    src, tw_results = maybe_add_twitter(src, title, desc, og_image)
    stats["twitter_added"] = sum(1 for _, d in tw_results if d)

    src, misc = maybe_add_misc(src)
    stats["misc_added"] = misc

    src, ld_added = maybe_add_jsonld(src, page_url, title, desc, og_image, path)
    if ld_added: stats["jsonld"] = 1

    path.write_text(src, encoding="utf-8")
    return stats


def main() -> int:
    files = sorted(ROOT.glob("**/*.html"))
    files = [f for f in files if ".git" not in f.parts]
    print(f"scanning {len(files)} HTML files\n")
    totals: dict[str, int] = {}
    touched = 0
    for f in files:
        stats = process(f)
        if not stats or stats.get("skipped"):
            continue
        rel = f.relative_to(ROOT).as_posix()
        change_count = sum(v for k, v in stats.items() if k != "skipped")
        if change_count:
            touched += 1
            print(f"[+] {rel:<50} {dict(stats)}")
        for k, v in stats.items():
            totals[k] = totals.get(k, 0) + v
    print(f"\ntouched {touched} files. totals: {totals}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
