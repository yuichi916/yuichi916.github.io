"""index.html の「外の窓」を data/external-posts.json から組み立て直す。

本数と最新の 1 本を手で書くと必ず古くなるので、実データから焼き込む。
同じ種類の窓はグループ見出しでまとめる。

実行:  python scripts/bake_windows.py
"""
from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BEGIN = "<!-- BAKED:windows:begin -->"
END = "<!-- BAKED:windows:end -->"

# (グループ見出し, [窓...]) の順に並べる。窓は
# (名前, URL, ハンドル, リード文, external-posts.json の platform か None, 固定の最新行)
GROUPS: list[tuple[str, list[tuple]]] = [
    ("読みもの — 書いたもの", [
        ("note", "https://note.com/views_of_life", "/views_of_life",
         "作ったものの裏側を、最初から最後まで書いた長文。読み物として一番厚いのはここ。",
         "note", None),
        ("Qiita", "https://qiita.com/kernel_yu", "@kernel_yu",
         "同じ話を、手を動かせる形に落とした技術記事。コードと再現手順つき。",
         "Qiita", None),
        ("Zenn", "https://zenn.dev/viewsengineer", "/viewsengineer",
         "調べ物が長くなりすぎた回の置き場。原典リンクを全部たどれる形で残しています。",
         "Zenn", None),
        ("Medium", "https://medium.com/@ViewsEngineer", "@ViewsEngineer",
         "英語版。制作パイプラインと、AI で作るときに踏んだ落とし穴。",
         "Medium", None),
    ]),
    ("動画 — 話したもの", [
        ("YouTube", "https://www.youtube.com/@zundamon_ai_lab", "@zundamon_ai_lab",
         "ずんだもんの AI ラボ。AI ニュースと英語の原文を、Shorts と長尺で読む。<b>登録 70 人</b>。",
         None, ("2026-09-20", "AIは、全体のばらつきを削っていく — 重要論文3本を英語で読む【AI英語ラボ #04】")),
    ]),
    ("作品の投稿先 — フリーゲーム・個人開発", [
        ("Tsukutta", "https://tsukutta.app/portfolio/40fb201e-b5d7-46f0-8637-519d78c1114d",
         "/portfolio/40fb201e",
         "個人開発プラットフォーム Tsukutta のポートフォリオ。ここが一番たくさん置いてあります。",
         None, ("6 作品・417 PV", "正解の外側 ／ 音楽の宇宙 ／ 百の悪行 ／ 森の小屋 ／ 将棋ぷよ ／ 立体数独")),
        ("PLiCy", "https://plicy.net/User/150013", "/User/150013",
         "フリーゲーム投稿サイト PLiCy の作者ページ。ブラウザでそのまま遊べます。",
         None, ("公開中 1 作品", "正解の外側 — 全15話・フルボイスのサウンドノベル")),
        ("夢現", "https://freegame-mugen.jp/adventure/game_15309.html", "/adventure/game_15309",
         "フリーゲーム夢現。アドベンチャー・ノベル枠に 1 本置いています。",
         None, ("投稿作品", "百の悪行 — 魔王の犯行記録を、勇者が検証する約30分の短編")),

        # ── 投稿したら URL を入れてコメントを外す。投稿文は docs/submit_0*.md ──
        # 投稿順: ProtoPedia → itch.io → ふりーむ！
        #
        # ("ProtoPedia", "https://protopedia.net/prototyper/<ID>", "/prototyper/<ID>",
        #  "個人開発の作品を記事として置く場所。道具と研究はここに出しています。",
        #  None, ("公開中 4 作品", "AI能力アトラス ／ 音楽の宇宙 ／ ひとり歓迎マップ ／ lingo")),
        #
        # ("itch.io", "https://<USER>.itch.io/", "/<USER>",
        #  "英語圏向け。ブラウザでそのまま遊べる形で置いています。",
        #  None, ("公開中 3 作品", "The Outside of the Answer ／ A Hundred Misdeeds ／ Kototsugi")),
        #
        # ("ふりーむ！", "https://www.freem.ne.jp/brand/<ID>", "/brand/<ID>",
        #  "国内最大級のフリーゲーム投稿サイト。ノベルゲーム枠に置いています。",
        #  None, ("公開中 2 作品", "正解の外側 ／ 百の悪行")),
    ]),
    ("コード — 作ったもの", [
        ("GitHub", "https://github.com/yuichi916", "@yuichi916",
         "この庭と各コンテンツのソース、動画・記事を作っている自動化スクリプト。公開 7 リポジトリ。",
         None, ("主なもの", "yuichi916.github.io ／ lingo-android ／ zundamon-ai-video ／ news-english-shorts")),
    ]),
    ("いま — 作っている途中", [
        ("X", "https://x.com/ViewsEngineer", "@ViewsEngineer",
         "作ったものと、作っている途中の話。詰まった所と、抜け方。更新の告知もここが一番早い。",
         None, ("ほぼ毎日", "制作ログ・失敗した実験・新しい作品の公開通知")),
    ]),
]


def latest_of(posts: list[dict], platform: str) -> tuple[str, str, int]:
    rows = [p for p in posts if p["platform"] == platform]
    newest = max(rows, key=lambda p: p["date"])
    return newest["date"], newest["title"], len(rows)


def build(posts: list[dict]) -> str:
    out = [BEGIN, '  <div class="directory">']
    n = 0
    for title, windows in GROUPS:
        out.append(f'    <div class="dir-group">{html.escape(title)}</div>')
        for name, url, handle, lead, platform, fixed in windows:
            n += 1
            if platform:
                date, headline, count = latest_of(posts, platform)
                lead_full = f"{lead}<b>全 {count} 本</b>。"
                tag, text = date, headline
            else:
                lead_full = lead
                tag, text = fixed
            out += [
                f'    <a class="dir-row" href="{url}" target="_blank" rel="noopener me">',
                f'      <div class="ix">{n:02d}</div><div class="name serif">{html.escape(name)}</div>',
                '      <div class="desc">',
                f'        <span class="win-lead">{lead_full}</span>',
                f'        <span class="win-latest"><span class="d">{html.escape(tag)}</span>'
                f'<b>{html.escape(text)}</b></span>',
                "      </div>",
                f'      <div class="handle">{html.escape(handle)}</div><div class="arr">→</div></a>',
            ]
    out += ["  </div>", END]
    return "\n".join(out)


def main() -> int:
    posts = json.loads((ROOT / "data" / "external-posts.json").read_text(encoding="utf-8"))
    path = ROOT / "index.html"
    src = path.read_text(encoding="utf-8")
    block = build(posts)

    today = datetime.now(timezone.utc).date().isoformat()
    src = re.sub(r"（最終確認 \d{4}-\d{2}-\d{2}）", f"（最終確認 {today}）", src)

    if BEGIN in src:
        out = re.sub(re.escape(BEGIN) + r".*?" + re.escape(END), lambda _: block, src, flags=re.S)
    else:
        m = re.search(r'  <div class="directory">.*?\n  </div>', src, re.S)
        if not m:
            print("ERROR: .directory が見つからない")
            return 1
        out = src[: m.start()] + block + src[m.end():]
    path.write_text(out, encoding="utf-8")
    rows = out.count('class="dir-row"')
    groups = out.count('class="dir-group"')
    print(f"外の窓: {groups} グループ / {rows} 窓")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
