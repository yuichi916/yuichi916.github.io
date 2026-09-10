# -*- coding: utf-8 -*-
"""公式ページを自分で取ってきて、本文をローカルに貯める。

LLM に取得までやらせると、取得できたかどうかが LLM の道具の機嫌に左右される。
実測では「取得できなかった」1,347件のうち **58% は素の HTTP なら普通に応答した**。
取得は取得で分けて、確実な手段でやる。副産物として2つ効く:

  - 引用が本当にそのページにあるかを、あとから機械で照合できる（merge_extract --pages）
  - 6項目の手がかりが1つも無いページは、LLM に渡す前に落とせる

使い方:
  python scripts/hitori/fetch_pages.py --in <施設リスト.json> --out <保存dir> --jobs 12
  → <保存dir>/pages/<id>.txt に本文、<保存dir>/fetch.json に結果一覧
"""
import argparse, gzip, io, json, re, socket, ssl, sys, threading, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen

UA = "Mozilla/5.0 (compatible; hitori-map/1.0; +https://yuichi916.github.io/hitori.html)"
TIMEOUT = 15
# 6項目の手がかり。1つも無いページは LLM に渡しても何も出ない。
HINTS = ("券売機", "予約", "カウンター", "席", "おひとり", "お一人", "一人", "ひとり", "黙浴",
         "会員制", "男性専用", "女性専用", "現金", "カード", "電子マネー", "キャッシュレス",
         "PayPay", "定休", "営業時間", "休業", "閉店", "閉館", "静か", "私語", "駐車")
TAG = re.compile(r"(?is)<(script|style|noscript|svg|head)[^>]*>.*?</\1>")
BR = re.compile(r"(?i)<(br|/p|/div|/li|/tr|/h[1-6])[^>]*>")
ANY = re.compile(r"(?s)<[^>]+>")
WS = re.compile(r"[ \t　]+")
NL = re.compile(r"\n{3,}")


def variants(url):
    """同じページに届きうる URL の言い換え。素の失敗の多くはここで拾える。"""
    out, seen = [], set()
    p = urlparse(url)
    for scheme in ([p.scheme, "https", "http"] if p.scheme else ["https", "http"]):
        for host in ([p.netloc, p.netloc[4:] if p.netloc.startswith("www.") else "www." + p.netloc]):
            if not host:
                continue
            for path in ([p.path, p.path.rstrip("/"), "/"] if p.path not in ("", "/") else [p.path or "/"]):
                u = urlunparse((scheme, host, path, "", p.query, ""))
                if u not in seen:
                    seen.add(u)
                    out.append(u)
    return out[:6]


# UTF-8 を cp932/euc-jp で読むと、この帯の文字ばかりが並ぶ（縺・繧・繝・蜈…）。
# 化けているかどうかは、この帯の密度で分かる。
_MOJI = re.compile(r"[぀-ヿ一-鿿]")
_MOJI_MARK = re.compile(r"[縺繧繝蜈蜃蟶謇讌螟蠕蟒蜀郢遖鬮髞鄙螻]")


def _mojibake(text):
    head = text[:3000]
    ja = len(_MOJI.findall(head))
    if ja < 20:
        return False
    return len(_MOJI_MARK.findall(head)) / ja > 0.35


# 下層ページの当たり所。トップに書いていない運用は、この手のページに書いてある。
FOLLOW_WORDS = ("ご利用案内", "利用案内", "ご利用方法", "利用方法", "はじめての", "初めての",
                "よくある質問", "FAQ", "Q&A", "料金", "価格", "メニュー", "店舗情報", "施設案内",
                "館内", "ご案内", "アクセス", "設備", "サービス", "お知らせ")
A_TAG = re.compile(r"""(?is)<a\s[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>(.{0,60}?)</a>""")
SKIP_EXT = (".pdf", ".jpg", ".jpeg", ".png", ".gif", ".zip", ".mp4", ".doc", ".xls")


def follow_links(html, base_url, limit=3):
    """本文に無い運用が書かれていそうな下層ページの URL を選ぶ。同じホストだけ。"""
    host = urlparse(base_url).netloc
    seen, out = set(), []
    for href, label in A_TAG.findall(html):
        text = ANY.sub("", label).strip()
        if not any(w in text for w in FOLLOW_WORDS):
            continue
        u = urljoin(base_url, href)
        pu = urlparse(u)
        if pu.netloc != host or pu.path.lower().endswith(SKIP_EXT):
            continue
        u = urlunparse((pu.scheme, pu.netloc, pu.path, "", pu.query, ""))
        if u == base_url or u in seen:
            continue
        seen.add(u)
        out.append((u, text))
        if len(out) >= limit:
            break
    return out


def _decode(raw, headers):
    """文字コードは宣言を信じすぎない。日本のサイトは Shift_JIS と EUC-JP がまだ多い。"""
    enc = None
    ct = headers.get("Content-Type", "")
    m = re.search(r"charset=([\w-]+)", ct, re.I)
    if m:
        enc = m.group(1)
    if not enc:
        m = re.search(rb'charset=["\']?([\w-]+)', raw[:4000], re.I)
        if m:
            enc = m.group(1).decode("ascii", "ignore")
    for e in [enc, "utf-8", "cp932", "euc-jp"]:
        if not e:
            continue
        try:
            text = raw.decode(e)
        except (UnicodeDecodeError, LookupError):
            continue
        # cp932 と euc-jp は UTF-8 のバイト列もエラー無く「復号」してしまう。
        # 宣言を信じて化けた文字列を返すと、あとで引用が照合できなくなる。
        if _mojibake(text):
            continue
        return text
    return raw.decode("utf-8", "replace")


def to_text(html):
    t = TAG.sub(" ", html)
    t = BR.sub("\n", t)
    t = ANY.sub(" ", t)
    t = (t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<")
          .replace("&gt;", ">").replace("&quot;", '"').replace("&#39;", "'"))
    t = WS.sub(" ", t)
    return NL.sub("\n\n", "\n".join(line.strip() for line in t.splitlines())).strip()


def fetch(url, ctx):
    last = ""
    for u in variants(url):
        try:
            req = Request(u, headers={"User-Agent": UA, "Accept-Language": "ja,en;q=0.8",
                                      "Accept-Encoding": "gzip"})
            with urlopen(req, timeout=TIMEOUT, context=ctx) as r:
                raw = r.read(600_000)
                if (r.headers.get("Content-Encoding") or "").lower() == "gzip":
                    try:
                        raw = gzip.decompress(raw)
                    except OSError:
                        pass
                html = _decode(raw, r.headers)
                return to_text(html), r.geturl(), "", html
        except Exception as e:                      # noqa: BLE001 - 種類ごとに分けても打つ手は同じ
            last = f"{type(e).__name__}: {str(e)[:60]}"
    return "", "", last, ""


def _save(out, fid, suffix, url, final, text):
    """1ページ = 1ファイル。引用の出どころを URL 単位で保てるようにする
    （下層ページの文をトップの本文に混ぜると、引用の出典が嘘になる）。"""
    name = f"{fid}{suffix}.txt"
    (out / "pages" / name).write_text(text[:40_000], encoding="utf-8")
    return {"id": fid, "file": name, "web": url, "final_url": final or url,
            "status": "ok", "chars": len(text), "hints": sum(1 for h in HINTS if h in text)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", nargs="+", required=True, help="施設リスト JSON（配列）")
    ap.add_argument("--out", required=True)
    ap.add_argument("--jobs", type=int, default=12)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--follow", type=int, default=0,
                    help="下層ページを何枚まで追うか（ご利用案内・料金・FAQ など）")
    args = ap.parse_args()

    out = Path(args.out)
    (out / "pages").mkdir(parents=True, exist_ok=True)
    items = []
    for s in args.src:
        doc = json.loads(Path(s).read_text(encoding="utf-8-sig"))
        items += doc if isinstance(doc, list) else doc.get("results", doc.get("items", []))
    if args.limit:
        items = items[:args.limit]

    # 相手のサーバに連続で当てない。ホストごとに間隔を空ける。
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    socket.setdefaulttimeout(TIMEOUT)
    host_lock, last_hit = threading.Lock(), {}

    def one(r):
        url = (r.get("web") or "").strip()
        if not url.startswith("http"):
            return {"id": r.get("id"), "status": "no_url"}
        host = urlparse(url).netloc
        with host_lock:
            wait = last_hit.get(host, 0) + 1.0 - time.time()
            last_hit[host] = time.time() + max(wait, 0)
        if wait > 0:
            time.sleep(min(wait, 5))
        text, final, err, html = fetch(url, ctx)
        base = {"id": r.get("id"), "name": r.get("name")}
        if not text:
            return [base | {"web": url, "status": "fetch_failed", "note": err}]
        recs = [_save(out, r["id"], "", url, final, text)]
        for n, (sub_url, label) in enumerate(follow_links(html, final or url, args.follow), 1):
            if n > args.follow:
                break
            time.sleep(0.6)                      # 同じホストに続けて当てない
            stext, sfinal, _serr, _shtml = fetch(sub_url, ctx)
            if stext:
                recs.append(_save(out, r["id"], f"__{n}", sub_url, sfinal, stext) | {"sub": label})
        return recs

    done = []
    with ThreadPoolExecutor(max_workers=args.jobs) as ex:
        for i, recs in enumerate(ex.map(one, items), 1):
            done += recs
            if i % 100 == 0:
                ok = len({d["id"] for d in done if d["status"] == "ok"})
                print(f"[{i}/{len(items)}] 取得成功 {ok} / ページ {len(done)}", flush=True)

    (out / "fetch.json").write_text(json.dumps(done, ensure_ascii=False), encoding="utf-8")
    ok = [d for d in done if d["status"] == "ok"]
    worth = [d for d in ok if d.get("hints", 0) >= 2]
    print(f"施設 {len({d['id'] for d in ok}):,}/{len(items):,} 取得成功 / "
          f"ページ {len(ok):,}（うち下層 {sum(1 for d in ok if d.get('sub')):,}）/ "
          f"手がかりが2つ以上 {len(worth):,}")
    print(f"{out / 'fetch.json'} と {out / 'pages'} に保存した。")


if __name__ == "__main__":
    main()
