# -*- coding: utf-8 -*-
"""言語ごとの静的ページを書き出す（翻訳版が検索に出るようにする）。
  set PYTHONUTF8=1 && python scripts/build_lang_pages.py
元のページ（日本語）は ?lang= で JS が文を差し替える作りで、正本指定（canonical）が日本語版に固定されていたため、
翻訳版はすべて「日本語版の重複」として検索から外れていた。ここでは各言語を別の URL（stopwatch-en.html など）にし、
  - <html lang>・題名・説明・OG を、その言語で HTML に書き込む（JS を動かさない読み手にも届く）
  - data-i18n の付いた文を、その言語の文に置き換える
  - canonical は自分自身、hreflang は全言語で相互に張り、x-default は日本語版
  - window.__VE_LANG で JS の言語を固定し、言語メニューは各言語のページへ移動させる
訳文は元のページを実際にブラウザで開いて（?lang=xx）取り出す。元のページの文を変えたら再実行する。
"""
import html
import re
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://yuichi916.github.io/"
PORT = 18761

# 元のページ: 言語コード → hreflang の値。ファイル名は 元の名前-<小文字の言語>.html
PAGES = {
    "stopwatch.html": {"en": "en", "zh-CN": "zh-CN", "ko": "ko", "es": "es", "fr": "fr", "de": "de", "pt": "pt", "ru": "ru", "it": "it"},
    "hyaku.html": {"en": "en", "zh": "zh", "ko": "ko", "es": "es", "fr": "fr", "de": "de"},
}
# data-i18n ではなく id で文を差し替えているページ: 子要素の無い id 付き要素の文も書き込む。desc は説明文に使う要素の id
BY_ID = {"hyaku.html": {"desc": "aboutP1"}}


def lang_file(page, lang):
    return page[:-5] + "-" + lang.lower() + ".html"


def hreflang_block(page, langs, nl):
    lines = [f'<link rel="alternate" hreflang="ja" href="{SITE}{page}">']
    for lang, code in langs.items():
        lines.append(f'<link rel="alternate" hreflang="{code}" href="{SITE}{lang_file(page, lang)}">')
    lines.append(f'<link rel="alternate" hreflang="x-default" href="{SITE}{page}">')
    return nl.join(lines)


def strip_hreflang(src):
    return re.sub(r'[ \t]*<link rel="alternate" hreflang="[^"]*"[^>]*>\r?\n', "", src)


def set_meta(src, attr, name, value):
    pat = re.compile(r'(<meta\s+' + attr + r'="' + re.escape(name) + r'"\s+content=")([^"]*)(")', re.I)
    return pat.sub(lambda m: m.group(1) + html.escape(value, quote=True) + m.group(3), src, count=1)


def replace_inner(src, attr, key, new_inner):
    """attr="key" の付いた要素の中身を new_inner に置き換える（同名タグの入れ子を数えて閉じタグを探す）。"""
    out, pos = [], 0
    pat = re.compile(r'<([a-zA-Z0-9]+)\b[^>]*\s' + attr + r'="' + re.escape(key) + r'"[^>]*>')
    for m in pat.finditer(src):
        if m.start() < pos:
            continue
        tag = m.group(1).lower()
        depth, i = 1, m.end()
        tok = re.compile(r'<(/?)' + tag + r'\b[^>]*>', re.I)
        while depth:
            t = tok.search(src, i)
            if not t:
                return src
            depth += -1 if t.group(1) else 1
            i = t.end()
        close_start = t.start()
        out.append(src[pos:m.end()])
        out.append(new_inner)
        pos = close_start
    out.append(src[pos:])
    return "".join(out)


NAV_SCRIPT = """<script>
/* 言語メニューは、その言語の静的ページへ移動する（ここで差し替えると、日本語の文が復元できないため） */
(function(){var P=%s;document.addEventListener('click',function(e){var li=e.target.closest&&e.target.closest('[data-lang]');if(!li)return;var u=P[li.getAttribute('data-lang')];if(!u)return;e.preventDefault();e.stopImmediatePropagation();location.href=u;},true);})();
</script>"""


def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(channel="chrome")
            for page, langs in PAGES.items():
                path = ROOT / page
                src0 = path.read_bytes().decode("utf-8")
                nl = "\r\n" if "\r\n" in src0 else "\n"
                urls = {"ja": page, **{l: lang_file(page, l) for l in langs}}
                for lang in langs:
                    ctx = b.new_context(locale="ja-JP")
                    pg = ctx.new_page()
                    pg.goto(f"http://127.0.0.1:{PORT}/{page}?lang={lang}", wait_until="load")
                    pg.wait_for_timeout(2500)
                    got = pg.evaluate("""() => {
                      const q = s => { const e = document.querySelector(s); return e ? e.getAttribute('content') : null; };
                      const t = {}, h = {};
                      document.querySelectorAll('[data-i18n]').forEach(e => t[e.getAttribute('data-i18n')] = e.textContent);
                      document.querySelectorAll('[data-i18n-html]').forEach(e => h[e.getAttribute('data-i18n-html')] = e.innerHTML);
                      const ids = {};
                      document.querySelectorAll('body [id]').forEach(e => { if (!e.children.length && e.textContent.trim() && !/^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(e.tagName)) ids[e.id] = e.textContent; });
                      return { lang: document.documentElement.lang, title: document.title, desc: q('meta[name="description"]'),
                               ogt: q('meta[property="og:title"]'), ogd: q('meta[property="og:description"]'),
                               twt: q('meta[name="twitter:title"]'), twd: q('meta[name="twitter:description"]'),
                               loc: q('meta[property="og:locale"]'), t, h, ids };
                    }""")
                    ctx.close()
                    s = src0
                    s = re.sub(r'<html lang="[^"]*"', f'<html lang="{got["lang"] or lang}"', s, count=1)
                    s = re.sub(r"<title>.*?</title>", "<title>" + html.escape(got["title"]) + "</title>", s, count=1, flags=re.S)
                    for attr, name, key in [("name", "description", "desc"), ("property", "og:title", "ogt"), ("property", "og:description", "ogd"),
                                            ("name", "twitter:title", "twt"), ("name", "twitter:description", "twd"), ("property", "og:locale", "loc")]:
                        if got[key]:
                            s = set_meta(s, attr, name, got[key])
                    url = SITE + urls[lang]
                    s = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url}">', s, count=1)
                    s = re.sub(r'(<meta property="og:url" content=")[^"]*(")', lambda m: m.group(1) + url + m.group(2), s, count=1)
                    s = strip_hreflang(s)
                    s = s.replace(f'<link rel="canonical" href="{url}">', f'<link rel="canonical" href="{url}">{nl}' + hreflang_block(page, langs, nl), 1)
                    for k, v in got["t"].items():
                        s = replace_inner(s, "data-i18n", k, html.escape(v, quote=False))
                    for k, v in got["h"].items():
                        s = replace_inner(s, "data-i18n-html", k, v)
                    if page in BY_ID:
                        for k, v in got["ids"].items():
                            m = re.search(r'<[a-zA-Z0-9]+[^>]*\sid="' + re.escape(k) + r'"[^>]*>([^<]*)</', s)
                            if m and m.group(1).strip() and m.group(1).strip() != v.strip():
                                s = replace_inner(s, "id", k, html.escape(v, quote=False))
                        d = got["ids"].get(BY_ID[page]["desc"], "").strip()
                        if d:
                            d = d if len(d) <= 150 else d[:148].rsplit(" ", 1)[0] + "…"
                            for attr, name in [("name", "description"), ("property", "og:description"), ("name", "twitter:description")]:
                                s = set_meta(s, attr, name, d)
                    s = re.sub(r"(<head[^>]*>)", lambda m: m.group(1) + nl + f'<script>window.__VE_LANG="{lang}";</script>', s, count=1)
                    nav = NAV_SCRIPT % ("{" + ",".join(f'"{l}":"{u}"' for l, u in urls.items()) + "}")
                    s = s.replace("</body>", nav + nl + "</body>", 1)
                    (ROOT / urls[lang]).write_bytes(s.encode("utf-8"))
                    print("wrote", urls[lang], "|", got["title"][:50])
                # 元の日本語ページの hreflang も、静的な各言語ページを指すように直す
                s = strip_hreflang(src0)
                s = s.replace(f'<link rel="canonical" href="{SITE}{page}">', f'<link rel="canonical" href="{SITE}{page}">{nl}' + hreflang_block(page, langs, nl), 1)
                path.write_bytes(s.encode("utf-8"))
            b.close()
    finally:
        srv.kill()


if __name__ == "__main__":
    main()
