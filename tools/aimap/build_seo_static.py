"""
ai-map.html 内に「全タスクのテキスト版」を <details> ブロックとして埋め込む/更新する。

理由: 326タスクの本文(vs_expert/can/cannot/why/根拠URL)はクリック操作(openTask)でしか
DOMに出現せず、JSを実行してもクローラーが到達できない。<details> はブラウザが閉じた状態
でも子要素をDOMに保持し、Googleは閉じたdetails/summaryの内容もインデックスすると明言して
いる(cloaking にはならない — 表示内容と提供内容が同一)。よってここに全件を静的展開する。

使い方: python tools/aimap/build_seo_static.py
  data/ai-map.json を読み、ai-map.html 内の
  <!-- SEO-STATIC:START --> ... <!-- SEO-STATIC:END -->
  マーカー間を再生成する。マーカーが無ければ </footer> の直前に新規挿入する。
"""
import html
import json
import os

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
DATA_PATH = os.path.join(ROOT, "data", "ai-map.json")
HTML_PATH = os.path.join(ROOT, "ai-map.html")

START = "<!-- SEO-STATIC:START -->"
END = "<!-- SEO-STATIC:END -->"


def esc(s):
    return html.escape(str(s or ""), quote=False)


def render_task(t):
    lv = t.get("levels", {}).get("2026", "—")
    parts = [f'<div id="t-{esc(t["id"])}">']
    parts.append(
        f'<p><b>{esc(t["name"])}</b>'
        f'<span style="color:#7d786a"> / {esc(t.get("name_en",""))}</span>'
        f' — 2026年レベル: {esc(lv)}/5</p>'
    )
    if t.get("vs_expert"):
        parts.append(f"<p>専門家と比べて: {esc(t['vs_expert'])}</p>")
    if t.get("can"):
        parts.append(f"<p>できる: {esc(t['can'])}</p>")
    if t.get("cannot"):
        parts.append(f"<p>できない: {esc(t['cannot'])}</p>")
    if t.get("why"):
        parts.append(f"<p>なぜ: {esc(t['why'])}</p>")
    ev = t.get("evidence") or []
    if ev:
        items = "".join(
            f'<li><a href="{esc(e.get("url",""))}" rel="noopener">{esc(e.get("title",""))}</a>'
            f' ({esc(e.get("date",""))}) {esc(e.get("note",""))}</li>'
            for e in ev
        )
        parts.append(f"<ul>{items}</ul>")
    parts.append("</div>")
    return "".join(parts)


def render_area(a):
    tasks = "".join(render_task(t) for t in a.get("tasks", []))
    return f'<h4>{esc(a["name"])}</h4>{tasks}'


def render_domain(d):
    areas = "".join(render_area(a) for a in d.get("areas", []))
    return (
        f'<h3>{esc(d["name"])} <span style="color:#7d786a;font-weight:400">'
        f'({esc(d.get("name_en",""))})</span></h3>'
        f'<p>{esc(d.get("summary",""))}</p>{areas}'
    )


def build_block(data):
    n_tasks = sum(len(a["tasks"]) for d in data["domains"] for a in d["areas"])
    domains_html = "".join(render_domain(d) for d in data["domains"])
    asof = data.get("meta", {}).get("asof", "")
    return (
        f"{START}\n"
        '<section id="v-textlist"><div class="wrap">\n'
        '<details id="fulltext">\n'
        f'<summary style="cursor:pointer;font-family:var(--mono);font-size:12px;color:var(--ink3);padding:10px 0">'
        f"全{n_tasks}タスクの詳細を1ページのテキストで見る（検索・引用・スクリーンリーダー向け・as of {esc(asof)}）</summary>\n"
        '<div style="margin:10px 0 30px;max-width:900px">\n'
        "<h2>AIエージェント能力アトラス — 全タスク一覧（テキスト版）</h2>\n"
        f"{domains_html}\n"
        "</div>\n"
        "</details>\n"
        "</div></section>\n"
        f"{END}"
    )


def main():
    with open(DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)
    block = build_block(data)

    with open(HTML_PATH, encoding="utf-8") as f:
        src = f.read()

    if START in src and END in src:
        pre = src.split(START)[0]
        post = src.split(END)[1]
        out = pre + block + post
    else:
        marker = "<footer>"
        idx = src.index(marker)
        out = src[:idx] + block + "\n\n" + src[idx:]

    with open(HTML_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)

    print(f"wrote {len(block):,} chars of static SEO content ({n_tasks_str(data)} tasks)")


def n_tasks_str(data):
    return sum(len(a["tasks"]) for d in data["domains"] for a in d["areas"])


if __name__ == "__main__":
    main()
