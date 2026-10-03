"""AIエージェント能力アトラスの「仕事ごとのページ」と共有画像を書き出す。
  python tools/aimap/build_task_pages.py            # ページと一覧
  python tools/aimap/build_task_pages.py --images   # 共有画像（1200x630 JPEG）も作る（Playwright）
アトラス本体は1ページの JS アプリで、どのマスを共有しても SNS の見出しは同じ1枚になる。
仕事ごとに固定の URL（ai-map/t/<id>.html）と、その仕事の名前とレベルの入った画像を持たせて、
「自分の仕事は AI にどこまでできるか」で共有・検索されるようにする。文章は足さず data/ai-map.json の内容だけを使う。
データを更新したら（月1回）、build.py・build_seo_static.py のあとに再実行する。
"""
import html
import json
import os
import shutil
import subprocess
import sys
import time

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
DATA = os.path.join(ROOT, "data", "ai-map.json")
OUT = os.path.join(ROOT, "ai-map", "t")
IMG = os.path.join(ROOT, "assets", "og", "ai-map-t")
SITE = "https://yuichi916.github.io"
LEVEL = {0: "できない", 1: "デモ止まり", 2: "補助", 3: "実務品質（要確認）", 4: "専門家並み", 5: "専門家超え"}
COLOR = {0: "#d9e3e8", 1: "#f6e3cf", 2: "#ebc296", 3: "#d9915a", 4: "#bf5a2e", 5: "#6b2412"}


def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def tp_label(tp):
    return tp.replace("e", "年（予測）") if tp.endswith("e") else tp + "年"


def tasks(d):
    for dm in d["domains"]:
        for ar in dm["areas"]:
            for t in ar["tasks"]:
                yield dm, ar, t


CSS = """
:root{--paper:#f4f0e6;--card:#fbf9f3;--ink:#1d1b16;--muted:#6b6759;--line:#ddd6c6;--accent:#bf5a2e}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif;font-size:15.5px;line-height:1.85}
main{max-width:780px;margin:0 auto;padding:28px 16px 64px}
a{color:#7a3a1c}
p,h1,h2,li{word-break:auto-phrase;text-wrap:pretty}
.crumb{font-size:13px;color:var(--muted)}.crumb a{color:inherit}
h1{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;font-size:clamp(24px,4.6vw,34px);line-height:1.4;margin:.4em 0 .2em;text-wrap:balance}
.en{color:var(--muted);font-size:14px;margin:0 0 1em}
.now{display:flex;gap:14px;align-items:center;flex-wrap:wrap;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.lv{font-size:44px;font-weight:800;line-height:1;font-variant-numeric:tabular-nums}
.lv small{font-size:16px;color:var(--muted);font-weight:400}
.lvname{font-weight:700}
.tl{display:grid;grid-template-columns:repeat(8,1fr);gap:4px;margin:16px 0 4px}
.tl div{text-align:center;font-size:11.5px;color:var(--muted)}
.tl i{display:block;height:34px;border-radius:6px;margin-bottom:4px;font-style:normal;font-weight:700;line-height:34px;color:#1d1b16}
.tl i.hi{color:#fff}
h2{font-size:18px;margin:1.8em 0 .5em;padding-bottom:.25em;border-bottom:2px solid var(--line)}
ul.ev{padding-left:20px}ul.ev li{margin:.35em 0}
.d{color:var(--muted);font-size:13px}
.cta{display:inline-block;margin:1.4em 0 0;padding:10px 18px;border-radius:999px;background:var(--accent);color:#fff;text-decoration:none;font-weight:700}
.sib{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}
.sib a{display:inline-block;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:4px 12px;font-size:13.5px;text-decoration:none;color:var(--ink)}
.note{font-size:13px;color:var(--muted);margin-top:2.4em}
"""


def page(meta, dm, ar, t, siblings):
    tid = t["id"]
    url = f"{SITE}/ai-map/t/{tid}.html"
    lv = t["levels"].get("2026")
    lv30 = t["levels"].get("2030e")
    title = f"{t['name']}は、AIにどこまでできるか（2026年 レベル{lv}/5）｜AIエージェント能力アトラス"
    desc = f"2026年のレベルは{lv}/5（{LEVEL.get(lv, '')}）。専門家と比べて: {t.get('vs_expert', '')}"
    if len(desc) > 150:
        desc = desc[:148] + "…"
    img = f"{SITE}/assets/og/ai-map-t/{tid}.jpg"
    ld = {
        "@context": "https://schema.org", "@type": "Article", "headline": title[:110], "url": url,
        "inLanguage": "ja", "dateModified": meta["asof"], "datePublished": meta["asof"], "image": img,
        "author": {"@type": "Person", "@id": f"{SITE}/#person", "name": "yuichi916", "url": f"{SITE}/"},
        "isPartOf": {"@type": "Dataset", "name": "AIエージェント能力アトラス 2026", "url": f"{SITE}/ai-map.html"},
        "about": t["name"],
        "citation": [e["url"] for e in t.get("evidence", []) if e.get("url")],
        "breadcrumb": {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "AIエージェント能力アトラス", "item": f"{SITE}/ai-map.html"},
            {"@type": "ListItem", "position": 2, "name": "仕事ごとの一覧", "item": f"{SITE}/ai-map/t/"},
            {"@type": "ListItem", "position": 3, "name": t["name"], "item": url}]},
    }
    tl = "".join(
        f'<div><i class="{"hi" if (t["levels"].get(tp) or 0) >= 4 else ""}" style="background:{COLOR.get(t["levels"].get(tp), "#eee")}">{esc(t["levels"].get(tp, "—"))}</i>{esc(tp.replace("e", "予"))}</div>'
        for tp in meta["timepoints"])
    sec = []
    for key, h in [("vs_expert", "専門家と比べて"), ("can", "できること"), ("cannot", "まだできないこと"), ("why", "なぜそうなのか"), ("forecast_basis", "これからの予測の根拠")]:
        if t.get(key):
            sec.append(f"<h2>{h}</h2>\n<p>{esc(t[key])}</p>")
    if t.get("tools"):
        sec.append("<h2>いま使える主な道具</h2>\n<p>" + "、".join(esc(x) for x in t["tools"]) + "</p>")
    ev = t.get("evidence", [])
    if ev:
        sec.append("<h2>根拠</h2>\n<ul class=\"ev\">" + "".join(
            f'<li><a href="{esc(e.get("url"))}" target="_blank" rel="noopener">{esc(e.get("title"))}</a>'
            f'{" <span class=d>" + esc(e.get("date")) + "</span>" if e.get("date") else ""}'
            f'{"<br><span class=d>" + esc(e.get("note")) + "</span>" if e.get("note") else ""}</li>' for e in ev) + "</ul>")
    ld_json = json.dumps(ld, ensure_ascii=False).replace("</", "<\\/")
    sib = "".join(f'<li><a href="{esc(s["id"])}.html">{esc(s["name"])}</a></li>' for s in siblings if s["id"] != tid)
    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{img}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:site_name" content="Views Engineer">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@ViewsEngineer">
<meta name="twitter:image" content="{img}">
<link rel="icon" href="/favicon.svg">
<script data-goatcounter="https://viewsengineer.goatcounter.com/count" async src="https://gc.zgo.at/count.js" integrity="sha384-2UjvVpptg4JlEVgJI2PdscrjOjPcil/4F1ZvIMJ81CShQnEDSlPI+l4PfogvTLYi" crossorigin="anonymous"></script>
<script type="application/ld+json">{ld_json}</script>
<style>{CSS}</style>
</head>
<body>
<main>
<p class="crumb"><a href="/ai-map.html">AIエージェント能力アトラス</a> › <a href="/ai-map/t/">仕事ごとの一覧</a> › {esc(dm["name"])} › {esc(ar["name"])}</p>
<h1>{esc(t["name"])}</h1>
<p class="en">{esc(t.get("name_en", ""))}</p>
<div class="now"><span class="lv">{esc(lv)}<small>/5</small></span><span><span class="lvname">2026年: {esc(LEVEL.get(lv, ""))}</span><br><span class="d">2030年（予測）: {esc(lv30)}/5 {esc(LEVEL.get(lv30, ""))}</span></span></div>
<div class="tl" aria-label="2022年から2030年（予測）までのレベル">{tl}</div>
<p class="d">0 できない ／ 1 デモ止まり ／ 2 補助 ／ 3 実務品質（要確認） ／ 4 専門家並み ／ 5 専門家超え。「予」は予測。</p>
{chr(10).join(sec)}
<a class="cta" href="/ai-map.html?ref=task-page">アトラス全体の地図をひらく →</a>
<h2>同じ分野のほかの仕事（{esc(ar["name"])}）</h2>
<ul class="sib">{sib}</ul>
<p class="note">AIエージェント能力アトラス 2026（{esc(meta["asof"])} 時点・v{esc(meta["version"])}）の1マスです。レベルは公開された実験・ベンチマーク・報告から付けた目安で、2027年以降は予測です。全マスに根拠のリンクがあります。作者は個人で、AI（Claude）と一緒に調べて作っています。</p>
</main>
</body>
</html>
"""


OG_TMPL = """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1200px;height:630px;background:#f4f0e6;color:#1d1b16;font-family:"Hiragino Sans","Yu Gothic","Noto Sans JP",sans-serif;overflow:hidden}
.w{position:absolute;inset:0;padding:56px 64px;box-sizing:border-box;display:flex;flex-direction:column}
.k{font-size:24px;letter-spacing:.12em;color:#bf5a2e;font-weight:700}
.dm{font-size:24px;color:#6b6759;margin-top:6px}
h1{font-family:"Yu Mincho","Hiragino Mincho ProN",serif;font-size:__FS__px;line-height:1.3;margin:22px 0 0;max-width:1070px}
.q{font-size:30px;margin-top:14px;color:#3a3830}
.row{margin-top:auto;display:flex;align-items:flex-end;gap:26px}
.big{font-size:120px;font-weight:800;line-height:.9}.big small{font-size:34px;color:#6b6759;font-weight:400}
.lab{font-size:30px;font-weight:700;padding-bottom:10px}
.tl{margin-left:auto;display:flex;gap:6px;align-items:flex-end;padding-bottom:12px}
.tl i{display:block;width:44px;border-radius:5px}
.tl span{display:block;text-align:center;font-size:15px;color:#6b6759;margin-top:4px}
.site{position:absolute;right:64px;top:56px;font-size:22px;color:#6b6759}
</style></head><body><div class="w"><div class="k">AIエージェント能力アトラス 2026</div><div class="dm">__DM__</div>
<h1>__NAME__</h1><div class="q">は、AIにどこまでできる？</div>
<div class="row"><div class="big">__LV__<small>/5</small></div><div class="lab">2026年: __LVN__</div><div class="tl">__TL__</div></div></div>
<div class="site">yuichi916.github.io</div></body></html>"""


def og_html(dm, ar, t, meta):
    name = t["name"]
    fs = 64 if len(name) <= 16 else 54 if len(name) <= 24 else 44
    tl = "".join(
        f'<div><i style="height:{12 + 16 * (t["levels"].get(tp) or 0)}px;background:{COLOR.get(t["levels"].get(tp), "#ddd")}"></i><span>{tp[2:4]}{"予" if tp.endswith("e") else ""}</span></div>'
        for tp in meta["timepoints"])
    lv = t["levels"].get("2026")
    return (OG_TMPL.replace("__FS__", str(fs)).replace("__DM__", esc(f"{dm['name']} › {ar['name']}"))
            .replace("__NAME__", esc(name)).replace("__LV__", esc(lv)).replace("__LVN__", esc(LEVEL.get(lv, ""))).replace("__TL__", tl))


def main():
    d = json.load(open(DATA, encoding="utf-8"))
    meta = d["meta"]
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    items = list(tasks(d))
    for dm, ar, t in items:
        with open(os.path.join(OUT, t["id"] + ".html"), "w", encoding="utf-8") as f:
            f.write(page(meta, dm, ar, t, ar["tasks"]))
    # 一覧
    rows = []
    for dm in d["domains"]:
        rows.append(f"<h2>{esc(dm['name'])}</h2>")
        for ar in dm["areas"]:
            rows.append(f"<h3 style=\"font-size:15px;margin:1.2em 0 .4em\">{esc(ar['name'])}</h3><ul class=\"sib\">" + "".join(
                f'<li><a href="{esc(t["id"])}.html">{esc(t["name"])} <span class="d">{esc(t["levels"].get("2026"))}/5</span></a></li>' for t in ar["tasks"]) + "</ul>")
    idx_title = f"仕事ごとの一覧（{len(items)}件）｜AIエージェント能力アトラス 2026"
    idx = f"""<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<title>{esc(idx_title)}</title>
<meta name="description" content="AIエージェントが2026年にどこまでできるかを、{len(items)}の仕事ごとに6段階で示した一覧。各ページに専門家との比較・できること・できないこと・根拠リンク。">
<link rel="canonical" href="{SITE}/ai-map/t/">
<meta property="og:title" content="{esc(idx_title)}"><meta property="og:image" content="{SITE}/assets/og/ai-map-1200x630.png">
<meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/favicon.svg">
<script data-goatcounter="https://viewsengineer.goatcounter.com/count" async src="https://gc.zgo.at/count.js" integrity="sha384-2UjvVpptg4JlEVgJI2PdscrjOjPcil/4F1ZvIMJ81CShQnEDSlPI+l4PfogvTLYi" crossorigin="anonymous"></script>
<style>{CSS}</style></head><body><main>
<p class="crumb"><a href="/ai-map.html">AIエージェント能力アトラス</a> › 仕事ごとの一覧</p>
<h1>AIは、その仕事をどこまでできるか（{len(items)}の仕事）</h1>
<p>2026年時点のレベル（0 できない 〜 5 専門家超え）を、仕事ごとのページにまとめました。各ページに、専門家との比較・できること・できないこと・予測の根拠と、出典のリンクがあります。</p>
<a class="cta" href="/ai-map.html">地図でまとめて見る →</a>
{chr(10).join(rows)}
<p class="note">{esc(meta["asof"])} 時点・v{esc(meta["version"])}。</p>
</main></body></html>
"""
    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
        f.write(idx)
    print("pages:", len(items))

    if "--images" in sys.argv:
        from playwright.sync_api import sync_playwright
        os.makedirs(IMG, exist_ok=True)
        with sync_playwright() as p:
            b = p.chromium.launch(channel="chrome")
            pg = b.new_page(viewport={"width": 1200, "height": 630})
            for i, (dm, ar, t) in enumerate(items):
                pg.set_content(og_html(dm, ar, t, meta))
                pg.screenshot(path=os.path.join(IMG, t["id"] + ".jpg"), type="jpeg", quality=78)
            b.close()
        print("images:", len(items))


if __name__ == "__main__":
    main()
