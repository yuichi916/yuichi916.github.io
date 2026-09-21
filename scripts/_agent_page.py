"""agent.html（AI から見たこのサイト）を site-index.json から組み立てる。

テンプレートは scripts/agent-template.html。CSS の波括弧と衝突しないよう、
str.format ではなく __PLACEHOLDER__ の単純置換で埋める。
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://yuichi916.github.io"
TEMPLATE = Path(__file__).resolve().parent / "agent-template.html"

PROMPT = (
    "https://yuichi916.github.io/llms.txt を読んでから、次を教えてください。\n"
    "1. このサイトを作っている人は、何を目的に、何を作っているか\n"
    "2. 自分がいちばん先に見るべきページはどれか（理由も）\n"
    "3. 作り方の記事のうち、手順をそのまま再現できるものを 3 本"
)


def _tree(idx: dict, pages: list[dict]) -> str:
    raw = (ROOT / "index.html").read_text(encoding="utf-8", errors="replace")
    blocks = re.findall(r'<script type="application/ld\+json">(.*?)</script>', raw, re.S)
    graph = json.loads(blocks[0]).get("@graph", [])
    person = next((n for n in graph if n.get("@type") == "Person"), {})
    lists = [n for n in graph if n.get("@type") == "ItemList"]
    same = person.get("sameAs", [])
    total = sum(p["textChars"] for p in pages)

    def c(s: str) -> str:
        return f'<span class="c">{html.escape(s)}</span>'

    out = [f'<b>Person</b>  {html.escape(person.get("name", "?"))}  '
           + c("/ " + person.get("alternateName", "")),
           "          " + c(person.get("jobTitle", "")),
           "  |",
           f'  +- <b>sameAs</b>  ' + c(f"同一人物として辿れるアカウント {len(same)} 件")]
    for u in same:
        out.append("  |     " + html.escape(u))
    out.append("  |")
    for lst in lists:
        out.append(f'  +- <b>{html.escape(lst.get("name", "ItemList"))}</b>  '
                   + c(f'{len(lst.get("itemListElement", []))} 件'))
    out.append("  |")
    out.append("  +- <b>公開ページ</b>  " + c(f"{len(pages)} 枚 / 本文あわせて {total:,} 字"))
    out.append("  +- <b>外部の記事</b>  "
               + c(f'{len(idx["externalPosts"])} 本（note / Qiita / Zenn / Medium）'))
    return "\n".join(out)


def _why(p: dict) -> str:
    if p["textChars"] < 120:
        return "HTML にほぼ本文がない。中身を JavaScript で描いているため、読まずに立ち去られる。"
    if p["textChars"] < 400:
        return "本文が数行しかなく、何のページなのかが機械に伝わらない。"
    return "本文は足りているが、構造化データがないので何のページとして扱えばよいか分類されない。"


def _gaps(pages: list[dict]) -> str:
    thin = [p for p in pages if p["textChars"] < 400]
    nold = [p for p in pages if not p["structuredData"] and p not in thin]
    rows = []
    for p in sorted(thin + nold, key=lambda x: x["textChars"]):
        sd = (", ".join(p["structuredData"]) if p["structuredData"]
              else '<span style="color:var(--bad)">なし</span>')
        rows.append(
            f'<tr><td><a href="{html.escape(p["path"])}">'
            f'{html.escape(p["title"] or p["path"])}</a>'
            f'<br><span class="path">/{html.escape(p["path"])}</span></td>'
            f'<td class="num">{p["textChars"]:,} 字</td>'
            f'<td class="num">{sd}</td>'
            f'<td>{_why(p)}</td></tr>')
    return "\n".join(rows) or '<tr><td colspan="4">いま躓いている場所はありません。</td></tr>'


def build(idx: dict) -> None:
    pages = [p for p in idx["pages"] if not p["noindex"]]
    pages.sort(key=lambda p: (-p["textChars"], p["path"]))

    desc = (f"AIエージェントがこのサイトを読むと何が見えて何が見えないのかを、公開HTML {len(pages)} 枚を"
            "実測して可視化したページ。llms.txt・RSS・サイトの実測JSONも配っています。")

    ld = json.dumps({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": SITE + "/agent.html",
        "url": SITE + "/agent.html",
        "name": "AIから見た、このサイト｜ひとりぶんの棚",
        "description": desc,
        "inLanguage": "ja-JP",
        "dateModified": idx["generatedAt"],
        "isPartOf": {"@id": SITE + "/#website"},
        "about": {"@id": SITE + "/#person"},
    }, ensure_ascii=False)

    data = json.dumps([{
        "p": p["path"], "t": p["title"] or p["path"], "d": p["description"],
        "c": p["textChars"], "l": p["links"], "s": p["structuredData"],
        "sec": p["section"], "m": p["modified"],
    } for p in pages], ensure_ascii=False, separators=(",", ":"))
    # </script> が JSON 内に現れるとブロックが途中で閉じてしまう
    data = data.replace("</", "<\\/")

    out = TEMPLATE.read_text(encoding="utf-8")
    for key, val in [
        ("__DESC__", html.escape(desc, quote=True)),
        ("__GENERATED__", idx["generatedAt"]),
        ("__NPAGES__", str(len(pages))),
        ("__TREE__", _tree(idx, pages)),
        ("__GAPS__", _gaps(pages)),
        ("__PROMPT__", html.escape(PROMPT)),
        ("__LD__", ld),
        ("__DATA__", data),
    ]:
        out = out.replace(key, val)
    left = re.findall(r"__[A-Z]+__", out)
    assert not left, f"未置換のプレースホルダ: {set(left)}"
    (ROOT / "agent.html").write_text(out, encoding="utf-8")
