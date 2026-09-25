"""サイトを実測して、機械可読な出力と「AIから見たこのサイト」ページを生成する。

手で書いた数字は必ず古くなるので、このスクリプトが公開 HTML を実際に読み、
そこから取れた事実だけを出力する。生成物:

  data/site-index.json  … 正本。以下はすべてこれから作る
  llms.txt              … AI エージェント向けの目次（llmstxt.org 形式）
  llms-full.txt         … 主要ページの本文を結合した全文版
  feed.xml              … RSS 2.0（サイトの更新 + 外部記事）
  feed.json             … JSON Feed 1.1
  agent.html            … 「AI から見たこのサイト」の可視化

使い方:  python scripts/build_agent_view.py
"""
from __future__ import annotations

import html
import json
import re
import subprocess
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path

import _agent_page

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://yuichi916.github.io"
TODAY = datetime.now(timezone.utc).date().isoformat()

# sitemap と同じ除外規則。ここがずれると llms.txt に作業ファイルが載る
EXCLUDE_DIRS = {
    ".git", ".github", ".superpowers", ".claude",
    "node_modules", "_dev", "_local", "_test_assets", "_workers",
    "_blender", "_gas", "_userscript", "_ehon_assets",
    "tests", "docs", "scripts", "assets",
    "_dist",   # 配布用のビルド出力 (gitignore。公開されない)
}
EXCLUDE_FILES = {
    "googlea794ff425484fcb3.html", "quest_test_tmp.html", "test-mobile.html",
    "cg-render.html", "cg2-render.html", "kv-render.html", "op-render.html",
    "seikai-plot.html", "agent.html",
}

# llms.txt の並び。前方一致で最初に当たったものを採用する
SECTIONS: list[tuple[str, str]] = [
    ("index.html",           "入口"),
    ("ai-map.html",          "研究 — AIエージェント能力アトラス"),
    ("method/",              "研究 — 新しい形の型"),
    ("kototsugi/",           "物語 — ことつぎの星"),
    ("seikai",               "物語 — 正解の外側"),
    ("hyaku.html",           "物語 — 百の悪行"),
    ("tomoshibi.html",       "物語"),
    ("hollow-tale.html",     "物語"),
    ("ehon",                 "遊ぶ"),   # ehon.html と ehon-about.html
    ("sudoku.html",          "遊ぶ"),
    ("shogi-puyo.html",      "遊ぶ"),
    ("bakekurabe.html",      "遊ぶ"),
    ("salon",                "遊ぶ — 音楽の宇宙"),
    ("universe.html",        "遊ぶ — 音楽の宇宙"),
    ("world.html",           "遊ぶ"),
    ("stop.html",            "遊ぶ"),
    ("niwa.html",            "遊ぶ"),
    ("cabin.html",           "遊ぶ"),
    ("ai-english.html",      "学ぶ — 英語"),
    ("english.html",         "学ぶ — 英語"),
    ("toeic",               "学ぶ — 英語"),
    ("lingo.html",           "学ぶ — 英語"),
    ("hitori",               "道具 — ひとりの時間"),
    ("hitoritabi/",          "道具 — 一人旅の記録"),
    ("stopwatch.html",       "道具"),
    ("devlog/",              "作り方"),
    ("journal.html",         "アーカイブ"),
]
DEFAULT_SECTION = "そのほか"


def public_pages() -> list[Path]:
    out = []
    for p in sorted(ROOT.glob("**/*.html")):
        rel = p.relative_to(ROOT)
        if EXCLUDE_DIRS & set(rel.parts):
            continue
        if rel.name in EXCLUDE_FILES:
            continue
        out.append(p)
    return out


def section_for(rel: str) -> str:
    for prefix, name in SECTIONS:
        if rel == prefix or rel.startswith(prefix):
            return name
    return DEFAULT_SECTION


def url_for(rel: str) -> str:
    if rel == "index.html":
        return SITE + "/"
    if rel.endswith("/index.html"):
        return SITE + "/" + rel[: -len("index.html")]
    return SITE + "/" + rel


def git_dates(rel: str) -> tuple[str, str]:
    """(初出, 最終更新) を git から取る。取れなければ今日。"""
    try:
        r = subprocess.run(
            ["git", "log", "--format=%cI", "--", rel],
            cwd=ROOT, check=True, capture_output=True, text=True,
        )
        lines = [x.strip()[:10] for x in r.stdout.splitlines() if x.strip()]
        if lines:
            return lines[-1], lines[0]
    except subprocess.CalledProcessError:
        pass
    return TODAY, TODAY


TAG_RE = re.compile(r"<[^>]+>")
# noscript は落とさない。GPTBot / ClaudeBot / PerplexityBot は JavaScript を実行しないので、
# noscript の中身は「機械に届いている本文」に数えるのが実態に合う。
DROP_RE = re.compile(r"<(script|style|template)\b[^>]*>.*?</\1>", re.S | re.I)


def visible_text(raw: str) -> str:
    body = DROP_RE.sub(" ", raw)
    body = re.sub(r"<!--.*?-->", " ", body, flags=re.S)
    txt = html.unescape(TAG_RE.sub(" ", body))
    return re.sub(r"\s+", " ", txt).strip()


def meta(raw: str, name: str, attr: str = "name") -> str:
    m = re.search(rf'<meta\s+{attr}="{re.escape(name)}"\s+content="([^"]*)"', raw)
    if not m:
        m = re.search(rf'<meta\s+content="([^"]*)"\s+{attr}="{re.escape(name)}"', raw)
    return html.unescape(m.group(1)).strip() if m else ""


def ld_types(raw: str) -> list[str]:
    found: list[str] = []
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', raw, re.S):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            found.append("(壊れた JSON-LD)")
            continue
        for node in data.get("@graph", [data]):
            t = node.get("@type")
            if isinstance(t, list):
                found.extend(t)
            elif t:
                found.append(t)
    return found


def scan() -> dict:
    pages = []
    for p in public_pages():
        rel = p.relative_to(ROOT).as_posix()
        raw = p.read_text(encoding="utf-8", errors="replace")
        text = visible_text(raw)
        title = html.unescape((re.search(r"<title>(.*?)</title>", raw, re.S) or ["", ""])[1]).strip()
        first, last = git_dates(rel)
        pages.append({
            "path": rel,
            "url": url_for(rel),
            "section": section_for(rel),
            "title": title,
            "description": meta(raw, "description"),
            "lang": (re.search(r'<html[^>]*\blang="([^"]+)"', raw) or ["", "ja"])[1],
            "published": first,
            "modified": last,
            "textChars": len(text),
            "links": len(re.findall(r'<a\s[^>]*href=', raw)),
            "structuredData": ld_types(raw),
            "hasDescription": bool(meta(raw, "description")),
            "hasOgImage": bool(meta(raw, "og:image", "property")),
            "hasCanonical": 'rel="canonical"' in raw,
            "noindex": "noindex" in raw,
            "excerpt": text[:600],
        })
    ext_path = ROOT / "data" / "external-posts.json"
    external = json.loads(ext_path.read_text(encoding="utf-8")) if ext_path.exists() else []
    return {
        "generatedAt": TODAY,
        "site": SITE,
        "name": "ひとりぶんの棚 — Views Engineer",
        "pageCount": len(pages),
        "pages": pages,
        "externalPosts": external,
    }


# ── 生成物 ────────────────────────────────────────────────────────────

INTRO = (
    "ひとりの人間が AI エージェント（主に Claude Code）と組んで作った、"
    "物語・ゲーム・道具・研究の置き場です。すべてブラウザで、登録もインストールもなく無料で開けます。"
    "作り方と失敗も記事にして公開しています。"
)


def write_llms(idx: dict) -> None:
    ordered, seen = [], set()
    for _, name in SECTIONS + [("", DEFAULT_SECTION)]:
        if name not in seen:
            seen.add(name)
            ordered.append(name)

    out = [f"# {idx['name']}", "", f"> {INTRO}", "",
           f"最終生成: {idx['generatedAt']} / 公開ページ {idx['pageCount']} 枚。"
           " この目次は公開 HTML を実際に読んで自動生成しています。", ""]
    for sec in ordered:
        rows = [p for p in idx["pages"] if p["section"] == sec and not p["noindex"]]
        if not rows:
            continue
        out.append(f"## {sec}")
        out.append("")
        for p in sorted(rows, key=lambda x: x["path"]):
            desc = p["description"] or p["title"]
            out.append(f"- [{p['title'] or p['path']}]({p['url']}): {desc}")
        out.append("")

    out.append("## 外部に置いている記事")
    out.append("")
    for e in idx["externalPosts"][:30]:
        out.append(f"- [{e['title']}]({e['url']}): {e['platform']} / {e['date']}")
    out.append("")
    out.append("## Optional")
    out.append("")
    out.append(f"- [更新フィード（RSS）]({SITE}/feed.xml): 新しい作品と記事の配信")
    out.append(f"- [更新フィード（JSON Feed）]({SITE}/feed.json): 同上の JSON 版")
    out.append(f"- [サイトの実測データ]({SITE}/data/site-index.json): 全ページの構造・文字数・構造化データ")
    out.append(f"- [AI から見たこのサイト]({SITE}/agent.html): 上のデータを人間向けに可視化したもの")
    (ROOT / "llms.txt").write_text("\n".join(out) + "\n", encoding="utf-8")

    full = [f"# {idx['name']} — 全文", "",
            f"> {INTRO}", "", f"最終生成: {idx['generatedAt']}", ""]
    for p in sorted(idx["pages"], key=lambda x: (x["section"], x["path"])):
        if p["noindex"] or p["textChars"] < 400:
            continue
        full += [f"## {p['title'] or p['path']}", "",
                 f"URL: {p['url']}", f"分類: {p['section']}", "",
                 (p["description"] or ""), "", p["excerpt"], "", "---", ""]
    (ROOT / "llms-full.txt").write_text("\n".join(full) + "\n", encoding="utf-8")


def feed_items(idx: dict, limit: int = 25) -> list[dict]:
    items = []
    for p in idx["pages"]:
        if p["noindex"] or p["textChars"] < 400 or p["path"] == "index.html":
            continue
        items.append({
            "title": p["title"] or p["path"],
            "url": p["url"],
            "date": p["published"],
            "summary": p["description"] or p["excerpt"][:180],
            "kind": p["section"],
        })
    for e in idx["externalPosts"]:
        items.append({
            "title": e["title"], "url": e["url"], "date": e["date"],
            "summary": f"{e['platform']} に書いた記事。", "kind": f"記事 — {e['platform']}"})
    items.sort(key=lambda x: x["date"], reverse=True)
    return items[:limit]


def write_feeds(idx: dict) -> None:
    items = feed_items(idx)
    def esc(x: str) -> str:
        return html.escape(x, quote=False)

    rss = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">', "  <channel>",
           f"    <title>{esc(idx['name'])}</title>",
           f"    <link>{SITE}/</link>",
           f"    <description>{esc(INTRO)}</description>",
           "    <language>ja</language>",
           f'    <atom:link href="{SITE}/feed.xml" rel="self" type="application/rss+xml" />',
           f"    <lastBuildDate>{format_datetime(datetime.now(timezone.utc))}</lastBuildDate>"]
    for it in items:
        pub = format_datetime(datetime.fromisoformat(it["date"] + "T09:00:00+09:00"))
        rss += ["    <item>",
                f"      <title>{esc(it['title'])}</title>",
                f"      <link>{it['url']}</link>",
                f"      <guid isPermaLink=\"true\">{it['url']}</guid>",
                f"      <category>{esc(it['kind'])}</category>",
                f"      <pubDate>{pub}</pubDate>",
                f"      <description>{esc(it['summary'])}</description>",
                "    </item>"]
    rss += ["  </channel>", "</rss>"]
    (ROOT / "feed.xml").write_text("\n".join(rss) + "\n", encoding="utf-8")

    (ROOT / "feed.json").write_text(json.dumps({
        "version": "https://jsonfeed.org/version/1.1",
        "title": idx["name"],
        "home_page_url": SITE + "/",
        "feed_url": SITE + "/feed.json",
        "description": INTRO,
        "language": "ja",
        "authors": [{"name": "yuichi916 / Views Engineer", "url": SITE + "/"}],
        "items": [{
            "id": it["url"], "url": it["url"], "title": it["title"],
            "summary": it["summary"], "tags": [it["kind"]],
            "date_published": it["date"] + "T09:00:00+09:00",
        } for it in items],
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def main() -> int:
    idx = scan()
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data" / "site-index.json").write_text(
        json.dumps(idx, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    write_llms(idx)
    write_feeds(idx)
    _agent_page.build(idx)

    thin = [p for p in idx["pages"] if p["textChars"] < 900 and not p["noindex"]]
    nold = [p for p in idx["pages"] if not p["structuredData"] and not p["noindex"]]
    print(f"公開ページ {idx['pageCount']} / 外部記事 {len(idx['externalPosts'])}")
    print(f"  本文 900 字未満: {len(thin)}  {[p['path'] for p in thin][:6]}")
    print(f"  構造化データなし: {len(nold)}  {[p['path'] for p in nold][:6]}")
    print("  wrote: data/site-index.json, llms.txt, llms-full.txt, feed.xml, feed.json, agent.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
