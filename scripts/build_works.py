#!/usr/bin/env python3
"""作品の台帳 data/works.json から、作品一覧 works.html と、トップ index.html の作品欄を作る。

    python scripts/build_works.py            # 作る
    python scripts/build_works.py --check    # 台帳と出力の検査だけ（書きこまない）

作品を足すとき:
  1. data/works.json の items に1件足す（top / now は付けすぎない。検査が止める）
  2. このスクリプトを回す（絵 assets/thumbs/<id>.webp も作られる）
  3. python scripts/build_agent_view.py → python scripts/generate_sitemap.py

index.html は手で書く部分と、ここが書きかえる部分に分かれている。
<!-- BUILD:名前 --> から <!-- /BUILD:名前 --> の間だけを書きかえ、ほかは触らない。
"""
from __future__ import annotations

import html
import io
import json
import re
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://yuichi916.github.io/"
DATA = ROOT / "data" / "works.json"
TEMPLATE = ROOT / "scripts" / "works-template.html"
THUMBS = ROOT / "assets" / "thumbs"
TW, TH = 480, 252
TOP_MAX = 4          # トップに出すのは1分類4つまで
NOW_COUNT = 3        # 最上段は3枚
CARD_CATS = ("play", "read", "tools", "learn", "research")   # 絵つきのカードが並ぶ分類


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def is_ext(href: str) -> bool:
    return href.startswith("http://") or href.startswith("https://")


def local_target(href: str) -> Path:
    h = href.split("#")[0].split("?")[0]
    p = ROOT / h
    return p / "index.html" if h.endswith("/") else p


# ── 絵 ────────────────────────────────────────────────────
def thumb_rel(it: dict) -> str | None:
    return f"assets/thumbs/{it['id']}.webp" if it.get("img") else None


def make_thumb(it: dict) -> None:
    src = it.get("img")
    if not src:
        return
    out = THUMBS / f"{it['id']}.webp"
    from PIL import Image

    if src.startswith("yt:") or is_ext(src):
        if out.exists():           # 取りに行くのは最初の1回だけ（オフラインでも作り直せる）
            return
        urls = ([f"https://i.ytimg.com/vi/{src[3:]}/maxresdefault.jpg", f"https://i.ytimg.com/vi/{src[3:]}/hqdefault.jpg"]
                if src.startswith("yt:") else [src])
        raw = None
        for u in urls:
            try:
                raw = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read()
                break
            except Exception:
                continue
        if raw is None:
            raise SystemExit(f"絵を取れません: {it['id']} {src}")
        im = Image.open(io.BytesIO(raw))
    else:
        sp = ROOT / src
        if not sp.exists():
            raise SystemExit(f"絵の元がありません: {it['id']} {src}")
        if out.exists() and out.stat().st_mtime >= sp.stat().st_mtime:
            return
        im = Image.open(sp)
    im = im.convert("RGB")
    w, h = im.size
    r = max(TW / w, TH / h)
    im = im.resize((max(TW, round(w * r)), max(TH, round(h * r))), Image.LANCZOS)
    w, h = im.size
    l, t = (w - TW) // 2, (h - TH) // 2
    im = im.crop((l, t, l + TW, t + TH))
    THUMBS.mkdir(parents=True, exist_ok=True)
    im.save(out, "WEBP", quality=80, method=6)


def make_og(d: dict) -> None:
    """作品一覧の共有用画像。絵を 5×5 に並べるだけ（文字は入れない）。作品が増えると自動で入れ替わる。"""
    from PIL import Image

    items = [i for i in d["items"] if i.get("img")]
    items.sort(key=lambda i: (0 if i.get("now") else 1 if i.get("top") else 2))
    cw, ch, cols, rows = 240, 126, 5, 5
    sheet = Image.new("RGB", (cw * cols, ch * rows), "#161510")
    for k, it in enumerate(items[: cols * rows]):
        im = Image.open(THUMBS / f"{it['id']}.webp").convert("RGB").resize((cw, ch), Image.LANCZOS)
        sheet.paste(im, ((k % cols) * cw, (k // cols) * ch))
    out = ROOT / "assets" / "og" / "works-1200x630.jpg"
    sheet.save(out, "JPEG", quality=84, optimize=True, progressive=True)


# ── 部品 ──────────────────────────────────────────────────
def attrs(it: dict, prefix: str) -> str:
    a = f' href="{esc(it["href"])}" data-start="{prefix}-{esc(it["id"])}"'
    if is_ext(it["href"]):
        a += ' target="_blank" rel="noopener"'
    return a


def added_attr(it: dict) -> str:
    return f' data-added="{it["added"]}"' if it.get("added") else ""


def img_html(it: dict) -> str:
    t = thumb_rel(it)
    if not t:
        return f'<span class="wk-img emo" aria-hidden="true">{it.get("emoji", "📄")}</span>'
    alt = esc(f'{it["title"]}（{it["kicker"]}）') if it.get("kicker") else esc(it["title"])
    return (f'<span class="wk-img"><img src="{t}" width="{TW}" height="{TH}" alt="{alt}" '
            f'loading="lazy" decoding="async"></span>')


def badge_html(it: dict) -> str:
    b = '<i class="new">NEW</i>' if it.get("added") else ""
    if it.get("daily"):
        b += "<i>毎日</i>"
    return f'<span class="badge">{b}</span>' if b else ""


def card(it: dict, prefix: str, full: bool) -> str:
    """絵つきのカード。full=True（一覧ページ）では、遊び方などの添えリンクも出す。"""
    body = (f'{img_html(it)}<span class="wk-b"><span class="wk-k">{badge_html(it)}{esc(it.get("kicker", ""))}</span>'
            f'<span class="wk-t">{esc(it["title"])}</span><span class="wk-d">{esc(it["desc"])}</span></span>')
    if full and it.get("sub"):
        subs = "".join(f'<a href="{esc(s["href"])}">{esc(s["label"])}</a>' for s in it["sub"])
        # 外側を <a> にすると、中の <a> でブラウザが外側を閉じてしまう。だから article にする
        return (f'<article class="wk" id="{esc(it["id"])}"{added_attr(it)}>'
                f'<a class="wk-main"{attrs(it, prefix)}>{body}</a><p class="wk-sub">{subs}</p></article>')
    idattr = f' id="{esc(it["id"])}"' if full else ""
    return f'<a class="wk"{idattr}{attrs(it, prefix)}{added_attr(it)}>{body}</a>'


def note_row(it: dict, prefix: str) -> str:
    where = it.get("where")
    tail = ""
    if where:
        tail = f'<small>{esc(where)}{" ↗" if is_ext(it["href"]) else ""}</small>'
    return (f'<a class="nt"{attrs(it, prefix)}><span class="nt-c">{esc(it.get("code", ""))}</span>'
            f'<span class="nt-t">{esc(it["title"])}{tail}</span><span class="nt-d">{esc(it["desc"])}</span></a>')


def now_card(it: dict) -> str:
    return (f'<a class="now-card"{attrs(it, "now")}{added_attr(it)}>'
            f'<img src="{thumb_rel(it)}" width="{TW}" height="{TH}" alt="{esc(it["title"])}（{esc(it["kicker"])}）">'
            f'<span class="nc-b"><span class="nc-chip"><b>NEW</b>{esc(it["kicker"])}</span>'
            f'<span class="nc-t">{esc(it["title"])}</span><span class="nc-d">{esc(it["desc"])}</span>'
            f'<span class="nc-go">ひらく →</span></span></a>')


# ── 数 ────────────────────────────────────────────────────
def counts(d: dict) -> dict:
    items = d["items"]
    n = {c["id"]: sum(1 for i in items if i["cat"] == c["id"] and i["id"] != "m-index") for c in d["cats"]}
    n["works"] = sum(1 for i in items if not i.get("note"))
    n["notes"] = sum(1 for i in items if i["cat"] == "research" and i.get("note") and i["id"] != "m-index")
    n["all"] = sum(n[c["id"]] for c in d["cats"])
    return n


# ── トップの作品欄 ────────────────────────────────────────
def render_index_parts(d: dict) -> dict:
    items, n = d["items"], counts(d)
    cats = {c["id"]: c for c in d["cats"]}
    now = sorted((i for i in items if i.get("now")), key=lambda i: i["now"])
    rows = []
    for cid in CARD_CATS:
        c = cats[cid]
        tops = [i for i in items if i["cat"] == cid and i.get("top") and not i.get("note")]
        sub = c["h"].split(" — ", 1)[1]
        rows.append(
            f'<div class="row" id="w-{cid}">\n'
            f'  <div class="row-h"><h3>{esc(c["name"])} <span>{esc(sub)}</span></h3>'
            f'<a href="works.html#{cid}" data-start="all-{cid}">{n[cid]}{esc(c["unit"])}すべて見る →</a></div>\n'
            f'  <div class="wk-grid">\n    ' + "\n    ".join(card(i, "w", False) for i in tops) + "\n  </div>\n</div>")
    making = [i for i in items if i["cat"] == "making" and i.get("top")]
    return {
        "now": '<div class="now-row">\n  ' + "\n  ".join(now_card(i) for i in now) + "\n</div>",
        "rows": "\n".join(rows),
        "making": '<div class="nt-list">\n  ' + "\n  ".join(note_row(i, "mk") for i in making) + "\n</div>",
    }


# ── 作品一覧ページ ────────────────────────────────────────
def render_works_parts(d: dict) -> dict:
    items, n = d["items"], counts(d)
    nav = "".join(f'<a href="#{c["id"]}">{esc(c["name"])}<small>{n[c["id"]]}</small></a>' for c in d["cats"])
    secs = []
    for c in d["cats"]:
        mine = [i for i in items if i["cat"] == c["id"]]
        cards = [i for i in mine if not i.get("note")]
        notes = [i for i in mine if i.get("note")]
        s = [f'<section class="row" id="{c["id"]}">',
             f'  <div class="row-h"><h2>{esc(c["h"])}</h2></div>',
             f'  <p class="row-lead">{esc(c["lead"])}</p>']
        if cards:
            s.append('  <div class="wk-grid">\n    ' + "\n    ".join(card(i, "ls", True) for i in cards) + "\n  </div>")
        if notes:
            gap = ' style="margin-top:18px"' if cards else ""
            s.append(f'  <div class="nt-list"{gap}>\n    ' + "\n    ".join(note_row(i, "ls") for i in notes) + "\n  </div>")
        s.append("</section>")
        secs.append("\n".join(s))
    return {"catnav": f'<nav class="cat-nav" aria-label="分類">{nav}</nav>', "sections": "\n".join(secs)}


def works_jsonld(d: dict) -> str:
    def url(h):
        return h if is_ext(h) else SITE + h
    els = [{"@type": "ListItem", "position": k + 1, "name": i["title"], "url": url(i["href"])}
           for k, i in enumerate(x for x in d["items"] if not is_ext(x["href"]))]
    g = {"@context": "https://schema.org", "@graph": [
        {"@type": "CollectionPage", "@id": SITE + "works.html#page", "url": SITE + "works.html",
         "name": "作品一覧 — 無料のブラウザゲーム・サウンドノベル・道具・研究ノート",
         "isPartOf": {"@id": SITE + "#website"}, "author": {"@id": SITE + "#person"}, "inLanguage": "ja-JP",
         "mainEntity": {"@id": SITE + "works.html#list"}},
        {"@type": "ItemList", "@id": SITE + "works.html#list", "name": "Views Engineer の作品",
         "numberOfItems": len(els), "itemListElement": els},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Views Engineer", "item": SITE},
            {"@type": "ListItem", "position": 2, "name": "作品一覧", "item": SITE + "works.html"}]},
    ]}
    return json.dumps(g, ensure_ascii=False, indent=1).replace("</", "<\\/")


# ── 書きかえ ──────────────────────────────────────────────
def patch(text: str, parts: dict, n: dict, name: str) -> str:
    for key, body in parts.items():
        pat = re.compile(rf"(<!-- BUILD:{key} -->).*?(<!-- /BUILD:{key} -->)", re.S)
        if not pat.search(text):
            raise SystemExit(f"{name}: 目印 BUILD:{key} がありません")
        text = pat.sub(lambda m: m.group(1) + "\n" + body + "\n" + m.group(2), text, count=1)

    def num(m):
        key = m.group(2)
        if key not in n:
            raise SystemExit(f"{name}: data-n=\"{key}\" に当たる数がありません")
        return m.group(1) + str(n[key]) + m.group(3)
    return re.sub(r'(<[a-z0-9]+[^>]*\sdata-n="([a-z]+)"[^>]*>)[^<]*(<)', num, text)


# ── 検査 ──────────────────────────────────────────────────
class NestCheck(HTMLParser):
    """<a> の中に <a> が入っていないか、<a> の中に段落や見出しの箱が入っていないかを見る。"""

    def __init__(self):
        super().__init__()
        self.depth = 0
        self.errors = []

    def handle_starttag(self, tag, a):
        if tag == "a":
            if self.depth:
                self.errors.append(f"<a> の入れ子: {dict(a).get('href')}")
            self.depth += 1

    def handle_endtag(self, tag):
        if tag == "a" and self.depth:
            self.depth -= 1


def validate(d: dict) -> None:
    items = d["items"]
    ids = [i["id"] for i in items]
    assert len(ids) == len(set(ids)), "id が重なっています"
    catids = {c["id"] for c in d["cats"]}
    for i in items:
        assert i["cat"] in catids, f"分類がありません: {i['id']}"
        assert i["title"] and i["desc"], f"題か説明が空です: {i['id']}"
        if not is_ext(i["href"]):
            assert local_target(i["href"]).exists(), f"リンク先がありません: {i['id']} → {i['href']}"
        for s in i.get("sub", []):
            if not is_ext(s["href"]):
                assert local_target(s["href"]).exists(), f"添えリンクの先がありません: {i['id']} → {s['href']}"
        if not i.get("note"):
            assert i.get("kicker"), f"kicker がありません: {i['id']}"
            assert i.get("img") or i.get("emoji"), f"絵も絵文字もありません: {i['id']}"
    now = [i for i in items if i.get("now")]
    assert len(now) == NOW_COUNT and all(i.get("img") for i in now), f"now は絵つきの{NOW_COUNT}件にします（いま {len(now)}）"
    assert not any(i.get("now") and i.get("top") for i in items), "同じ作品を now と top の両方に出さない（入口は1つ）"
    for c in CARD_CATS:
        t = sum(1 for i in items if i["cat"] == c and i.get("top"))
        assert 1 <= t <= TOP_MAX, f"{c}: top は1〜{TOP_MAX}件にします（いま {t}）"


def check_output(index_html: str, works_html: str, d: dict) -> None:
    items = d["items"]
    for name, text in (("index.html", index_html), ("works.html", works_html)):
        nc = NestCheck()
        nc.feed(text)
        assert not nc.errors, f"{name}: {nc.errors[:3]}"
    # 一覧には全件が1回ずつ、トップには top と now だけが1回ずつ出る
    for i in items:
        k = works_html.count(f'data-start="ls-{i["id"]}"')
        assert k == 1, f"works.html に {i['id']} が {k} 回"
        want = 1 if (i.get("top") or i.get("now")) else 0
        got = sum(index_html.count(f'data-start="{p}-{i["id"]}"') for p in ("w", "now", "mk"))
        assert got == want, f"index.html に {i['id']} が {got} 回（{want} のはず）"
    assert "BUILD:" not in re.sub(r"<!-- /?BUILD:[a-z]+ -->", "", works_html + index_html), "目印が壊れています"


def selftest() -> None:
    """検査そのものが働くことを、わざと壊した入力で確かめる。"""
    nc = NestCheck()
    nc.feed('<a href="x"><span><a href="y">z</a></span></a>')
    assert nc.errors, "入れ子の <a> を見逃しています"
    ok = NestCheck()
    ok.feed('<article><a href="x">a</a><p><a href="y">b</a></p></article>')
    assert not ok.errors
    t = patch('<b data-n="works">0</b><!-- BUILD:k -->old<!-- /BUILD:k -->', {"k": "new"}, {"works": 7}, "t")
    assert t == '<b data-n="works">7</b><!-- BUILD:k -->\nnew\n<!-- /BUILD:k -->', t
    fake = {"cats": [{"id": "play"}, {"id": "research"}],
            "items": [{"id": "a", "cat": "play"}, {"id": "m-index", "cat": "research", "note": True},
                      {"id": "n1", "cat": "research", "note": True}, {"id": "r", "cat": "research"}]}
    c = counts(fake)
    assert (c["play"], c["research"], c["works"], c["notes"], c["all"]) == (1, 2, 2, 1, 3), c


def main() -> int:
    check = "--check" in sys.argv
    selftest()
    d = json.loads(DATA.read_text(encoding="utf-8"))
    validate(d)
    if not check:
        for it in d["items"]:
            make_thumb(it)
        make_og(d)
    n = counts(d)
    idx_path, works_path = ROOT / "index.html", ROOT / "works.html"
    index_html = patch(idx_path.read_text(encoding="utf-8"), render_index_parts(d), n, "index.html")
    works_html = patch(TEMPLATE.read_text(encoding="utf-8"), render_works_parts(d), n, "works.html")
    works_html = re.sub(r'(<script type="application/ld\+json" data-build="works">).*?(</script>)',
                        lambda m: m.group(1) + works_jsonld(d) + m.group(2), works_html, count=1, flags=re.S)
    check_output(index_html, works_html, d)
    if not check:
        idx_path.write_text(index_html, encoding="utf-8", newline="\n")
        works_path.write_text(works_html, encoding="utf-8", newline="\n")
    print(("検査のみ: " if check else "作りました: ") + " / ".join(f"{k} {v}" for k, v in n.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
