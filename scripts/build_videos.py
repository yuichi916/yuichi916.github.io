# -*- coding: utf-8 -*-
"""動画の棚 videos.html を YouTube の公開動画から作る。

  python scripts/build_videos.py --fetch   # YouTube API から data/videos.json を取り直してから作る
  python scripts/build_videos.py           # data/videos.json だけで作る（API なし）

数字（再生回数・本数・日付）は手で書かない。data/videos.json の値だけを出す。
シリーズの振り分けは題名の【】で決める。作品の紹介動画だけは WORK_PAGES で作品ページにつなぐ。
"""
import argparse
import datetime as dt
import html
import io
import json
import re
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "videos.json"
OUT = ROOT / "videos.html"
TOKEN = Path(r"C:\projects\zundamon-ai-lab\scripts\token_force_ssl.json")
SITE = "https://yuichi916.github.io/"
CHANNEL = "https://www.youtube.com/@zundamon_ai_lab"

NANKAI = ROOT / "data" / "nankai-tsunami.json"
NANKAI_META = Path(r"C:\projects\zundamon-ai-lab\output\shorts\ai-news\nlong_01\meta.json")
FEATURED = "KyOVBrS72SA"  # 長尺4,000時間に向けた1本目。ページの最上段で再生できるようにする

# 作品の紹介動画 → 遊べるページ
WORK_PAGES = {
    "794UhPRtT1Y": ("tsunagu-naraberu.html", "ツナラベ！"),
    "MFWwoQl8N4M": ("hitofude.html", "一筆花火"),
    "k-9KY1SRtKc": ("ehon.html", "とびだす絵本"),
    "JMfa_bcAElY": ("salon.html", "音楽の宇宙"),
    "nKzDuJ7QPmo": ("salon.html", "音楽の宇宙"),
    "-pUJj1ijcUM": ("hitori.html", "ひとり歓迎マップ"),
    "uRswvkC2cMY": ("hyaku.html", "百の悪行"),
    "myFxzs-nUDo": ("hyaku.html", "百の悪行"),
    "5-ylT352rNM": ("seikai.html", "正解の外側"),
    "AYpOA6ArBCg": ("seikai.html", "正解の外側"),
    "bnU0AsiWC5Y": ("sudoku.html", "異世界立体数独"),
    "lkR2XTIgUcI": ("sudoku.html", "異世界立体数独"),
    "DT1-1y6anH4": ("cabin.html", "森の小屋"),
    "tlYusu9SfeU": ("ai-map.html", "AIエージェント能力アトラス"),
    "1k1y8Bq9pp4": ("ai-map.html", "AIエージェント能力アトラス"),
    "1GnXasJpTLk": ("ai-map.html", "AIエージェント能力アトラス"),
}

SERIES = [
    # key, 見出し, 説明, 題名の判定
    ("moshimo", "もしも", "「もしも○○だったら」を、国や研究機関の数字で計算して、身近な物の大きさや時間に置き換えます。",
     lambda t: re.search(r"【もしも(#\d+)?】", t)),
    ("kiroku", "記録で比べてみた", "公式の記録を並べて、いまの数字が歴代のどこにいるかを見ます。",
     lambda t: "【記録で比べてみた" in t),
    ("mukashi", "昔と今", "同じ場所の、昔と今。", lambda t: "【昔と今" in t),
    ("asobi", "AIで遊んでみた", "同じ質問を100回したり、大喜利をさせたり。AIのくせを数えます。",
     lambda t: "AI大喜利" in t or "AIに100回" in t or "AIに「好きな数字" in t),
]


def fetch():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    c = Credentials.from_authorized_user_file(str(TOKEN))
    if not c.valid:
        c.refresh(Request())
    yt = build("youtube", "v3", credentials=c)
    ch = yt.channels().list(part="contentDetails,statistics", mine=True).execute()["items"][0]
    up = ch["contentDetails"]["relatedPlaylists"]["uploads"]
    ids, tok = [], None
    while True:
        r = yt.playlistItems().list(part="contentDetails", playlistId=up, maxResults=50, pageToken=tok).execute()
        ids += [i["contentDetails"]["videoId"] for i in r["items"]]
        tok = r.get("nextPageToken")
        if not tok:
            break
    vids = []
    for k in range(0, len(ids), 50):
        r = yt.videos().list(part="snippet,statistics,status,contentDetails", id=",".join(ids[k:k + 50])).execute()
        for v in r["items"]:
            if v["status"]["privacyStatus"] != "public":
                continue
            vids.append({
                "id": v["id"],
                "title": v["snippet"]["title"],
                "published": v["snippet"]["publishedAt"],
                "duration": v["contentDetails"]["duration"],
                "views": int(v["statistics"].get("viewCount", 0)),
            })
    data = {
        "fetched": dt.datetime.now().strftime("%Y-%m-%d"),
        "subscribers": int(ch["statistics"].get("subscriberCount", 0)),
        "videos": vids,
    }
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print("fetched", len(vids), "public videos")


def import_nankai():
    """長尺の説明欄（事実監査済み）から26エリアの表を取り出して data に置く。"""
    desc = json.loads(NANKAI_META.read_text(encoding="utf-8"))["description"]
    rows = []
    for m in re.finditer(r"^(\d+)位 (\S+) 最大(\d+)m（([^）]+)）／いちばん早い所 ([^（]+)（([^）]+)）$", desc, re.M):
        rows.append({"rank": int(m.group(1)), "area": m.group(2), "max_m": int(m.group(3)), "max_at": m.group(4),
                     "first": m.group(5), "first_at": m.group(6)})
    src = re.search(r"■ 出典\n・(.+?) (https://\S+)", desc)
    assert len(rows) == 26 and rows[0]["area"] == "高知県" and rows[0]["max_m"] == 34, rows[:2]
    NANKAI.write_text(json.dumps({"source": src.group(1), "source_url": src.group(2), "rows": rows},
                                 ensure_ascii=False, indent=1), encoding="utf-8")
    print("nankai rows", len(rows))


def nankai_table():
    if not NANKAI.exists():
        return ""
    d = json.loads(NANKAI.read_text(encoding="utf-8"))
    e = html.escape
    trs = "".join(
        f"<tr><td>{r['rank']}</td><th>{e(r['area'])}</th><td><b>{r['max_m']}m</b><span>{e(r['max_at'])}</span></td>"
        f"<td><b>{e(r['first'])}</b><span>{e(r['first_at'])}</span></td></tr>" for r in d["rows"])
    return (
        '<details class="tbl"><summary>26エリアの一覧を見る（最大の津波の高さ順）</summary>'
        '<div class="tw"><table><thead><tr><th>順位</th><th>都府県</th><th>最大の津波の高さ</th><th>1mの津波がいちばん早く届く時間</th></tr></thead>'
        f'<tbody>{trs}</tbody></table></div>'
        '<p class="small">国が考えた最大クラスの地震で、11通りのうちいちばん厳しい値です。必ずこうなるという予想ではありません。'
        '高さは海岸付近の津波の高さ（満潮位）で、陸をかけ上がる高さとは別です。時間は海岸付近に1mの津波が届くまでの時間です。'
        '県の値はその県でいちばん高い・早い市町村の値で、高さと早さは別の市町村のことがあります。東京は23区と島しょ部に分けています。'
        f'出典: <a href="{e(d["source_url"])}" target="_blank" rel="noopener">{e(d["source"])}</a></p></details>')


def secs(iso):
    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso)
    h, mi, s = (int(x or 0) for x in m.groups())
    return h * 3600 + mi * 60 + s


def clock(n):
    h, r = divmod(n, 3600)
    m, s = divmod(r, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def clean_title(t):
    t = re.sub(r"\s*#[Ss]horts?\b", "", t)
    return t.strip()


def ep_no(t):
    m = re.search(r"#(\d+)】", t)
    return int(m.group(1)) if m else 0


def is_long(v):
    return secs(v["duration"]) > 180


def watch_url(v):
    return f"https://www.youtube.com/watch?v={v['id']}" if is_long(v) else f"https://www.youtube.com/shorts/{v['id']}"


def card(v, show_views=False):
    e = html.escape
    t = clean_title(v["title"])
    long = is_long(v)
    work = WORK_PAGES.get(v["id"])
    views = f'<span class="vw">{v["views"]:,} 回</span>' if show_views else ""
    play = (f'<a class="play" href="{work[0]}?ref=videos">{e(work[1])}をひらく →</a>' if work else "")
    return (
        f'<li class="vc{" long" if long else ""}">'
        f'<a class="th" href="{watch_url(v)}" target="_blank" rel="noopener" data-goatcounter-click="video/{v["id"]}" '
        f'data-goatcounter-title="{e(t)}">'
        f'<img src="https://i.ytimg.com/vi/{v["id"]}/hqdefault.jpg" alt="" loading="lazy" decoding="async" width="480" height="360">'
        f'<span class="du">{clock(secs(v["duration"]))}</span></a>'
        f'<div class="meta"><a class="tt" href="{watch_url(v)}" target="_blank" rel="noopener" '
        f'data-goatcounter-click="video/{v["id"]}">{e(t)}</a>'
        f'<span class="dt">{v["published"][:10].replace("-", ".")}</span>{views}{play}</div></li>'
    )


def video_ld(v):
    return {
        "@type": "VideoObject",
        "name": clean_title(v["title"]),
        "description": clean_title(v["title"]),
        "thumbnailUrl": f"https://i.ytimg.com/vi/{v['id']}/hqdefault.jpg",
        "uploadDate": v["published"],
        "duration": v["duration"],
        "contentUrl": watch_url(v),
        "embedUrl": f"https://www.youtube.com/embed/{v['id']}",
    }


def build():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    vids = sorted(data["videos"], key=lambda v: v["published"], reverse=True)
    by_id = {v["id"]: v for v in vids}
    assert FEATURED in by_id, "featured video is not public"
    feat = by_id[FEATURED]

    groups = {k: [] for k, *_ in SERIES}
    for v in vids:
        for k, _, _, test in SERIES:
            if test(v["title"]):
                groups[k].append(v)
                break
    for k in ("moshimo", "kiroku", "mukashi"):
        groups[k].sort(key=lambda v: (ep_no(v["title"]), v["published"]), reverse=True)
    longs = [v for v in vids if is_long(v) and v["id"] != FEATURED]
    works = [v for v in vids if v["id"] in WORK_PAGES and not is_long(v)]
    news = [v for v in vids if "1分AIニュース" in v["title"]][:6]
    series_ids = {v["id"] for g in groups.values() for v in g}
    popular = sorted([v for v in vids if v["id"] in series_ids], key=lambda v: -v["views"])[:8]

    # 自己検査: 既知の動画が正しい棚に入っているか
    assert any(v["id"] == "qRzzqOhhL3o" for v in groups["moshimo"]), "もしも#9 missing"
    assert any(v["id"] == "O0HflZ4UazI" for v in groups["kiroku"]), "記録#4 missing"
    assert not any(is_long(v) for v in groups["moshimo"]), "long video in shorts shelf"

    e = html.escape
    fetched = data["fetched"]
    subs = data["subscribers"]
    n_series = sum(len(g) for g in groups.values())

    sections = []
    sections.append(
        '<section class="blk" id="popular"><div class="wrap"><h2><span class="n">01 — Popular</span>よく見られている順</h2>'
        f'<p>シリーズの中で、再生回数の多い8本です（{fetched} 時点）。</p>'
        '<ul class="grid">' + "".join(card(v, True) for v in popular) + "</ul></div></section>")
    no = 2
    for k, head, desc, _ in SERIES:
        g = groups[k]
        if not g:
            continue
        sections.append(
            f'<section class="blk" id="{k}"><div class="wrap"><h2><span class="n">{no:02d} — Series</span>{e(head)}（{len(g)}本）</h2>'
            f'<p>{e(desc)}</p><ul class="grid">' + "".join(card(v) for v in g) + "</ul></div></section>")
        no += 1
    sections.append(
        f'<section class="blk" id="works"><div class="wrap"><h2><span class="n">{no:02d} — Works</span>作品の紹介（{len(works)}本）</h2>'
        '<p>このサイトの作品を、遊んでいるところ・めくっているところの録画で紹介します。動画の下から、そのまま作品をひらけます。</p>'
        '<ul class="grid">' + "".join(card(v) for v in works) + "</ul></div></section>")
    no += 1
    sections.append(
        f'<section class="blk" id="long"><div class="wrap"><h2><span class="n">{no:02d} — Long</span>長い動画（{len(longs)}本）</h2>'
        '<p>3分をこえる横長の動画です。全編プレイ、研究の解説、論文を英語の原文で読む特別編など。</p>'
        '<ul class="grid wide">' + "".join(card(v) for v in longs) + "</ul></div></section>")
    no += 1
    if news:
        sections.append(
            f'<section class="blk" id="news"><div class="wrap"><h2><span class="n">{no:02d} — News</span>1分AIニュース（最近の6本）</h2>'
            '<p>AIの発表を、公式の発表文と照らして1分にまとめたシリーズです。</p>'
            '<ul class="grid">' + "".join(card(v) for v in news) + "</ul></div></section>")

    shown = [feat] + popular + [v for g in groups.values() for v in g] + works + longs + news
    seen, items = set(), []
    for v in shown:
        if v["id"] in seen:
            continue
        seen.add(v["id"])
        items.append(v)
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "CollectionPage", "@id": SITE + "videos.html", "url": SITE + "videos.html",
             "name": "動画の棚 — もしも・記録で比べてみた・南海トラフ津波ランキング",
             "inLanguage": "ja-JP", "isPartOf": {"@id": SITE + "#website"},
             "mainEntity": {"@type": "ItemList", "numberOfItems": len(items),
                            "itemListElement": [{"@type": "ListItem", "position": i + 1, "item": video_ld(v)}
                                                for i, v in enumerate(items)]}},
            {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "ひとりぶんの棚", "item": SITE},
                {"@type": "ListItem", "position": 2, "name": "動画の棚", "item": SITE + "videos.html"}]},
        ],
    }
    ld_txt = json.dumps(ld, ensure_ascii=False, indent=1).replace("</", "<\\/")

    tpl = (ROOT / "scripts" / "videos-template.html").read_text(encoding="utf-8")
    page = (tpl.replace("__LD__", ld_txt)
            .replace("__FEAT_ID__", feat["id"])
            .replace("__FEAT_TITLE__", e(clean_title(feat["title"])))
            .replace("__FEAT_DATE__", feat["published"][:10].replace("-", "."))
            .replace("__FEAT_DUR__", clock(secs(feat["duration"])))
            .replace("__NANKAI_TABLE__", nankai_table())
            .replace("__N_SERIES__", str(n_series))
            .replace("__N_ALL__", str(len(vids)))
            .replace("__SUBS__", f"{subs:,}")
            .replace("__FETCHED__", fetched)
            .replace("__SECTIONS__", "\n".join(sections)))
    assert "__" not in re.sub(r"__(?:proto|init)__", "", page.split("<body", 1)[1]), "placeholder left"
    OUT.write_text(page, encoding="utf-8")
    print(f"videos.html: featured={feat['id']} popular={len(popular)} series={n_series} works={len(works)} long={len(longs)} news={len(news)} all={len(vids)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true")
    a = ap.parse_args()
    if a.fetch:
        fetch()
        import_nankai()
    build()
