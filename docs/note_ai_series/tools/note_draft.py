"""note の下書きを、投稿の直前まで自動で作る。

  - 連載のマガジンを作る（--magazine のとき。すでにあれば不要）
  - 記事の下書きを作る：タイトル、見出し画像、本文（見出し・引用・太字）、本文中の図
  - 公開設定の画面で、ハッシュタグとマガジンへの追加まで入れる
  - 「投稿する」は押さない。最後はあなたが画面で確認して押す

使い方（Windows の例。Mac は py を python3 に）:
  py -m pip install playwright
  py docs\\note_ai_series\\tools\\note_draft.py               # #00 の下書き
  py docs\\note_ai_series\\tools\\note_draft.py --magazine    # 先にマガジンも作る

  Chrome か Edge がそのまま使われる（どちらも無いときだけ `py -m playwright install chromium`）。
  初回はブラウザが開いたら、手で note にログインする。ログインは PC の中
  （ホームの .note_draft_profile）に残り、このリポジトリには入らない。
  パスワードやトークンをこのファイルや引数に書かないこと。

うまく進めない手順があると、ブラウザを開いたまま止まり、何を手でやればよいかを表示する。
手でやったら、このウィンドウで Enter を押すと続きから進む。
"""
import argparse
import base64
import html
import re
import sys
from pathlib import Path

from playwright.sync_api import TimeoutError as PWTimeout
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
SERIES_DIR = HERE.parent
PROFILE_DIR = Path.home() / ".note_draft_profile"

MAGAZINE = {
    "name": "ひとりで、世界をつくる。",
    "description": (
        "AIエージェントと、自分だけの世界を築く教科書。\n"
        "覚えたAIのコツは、来月には古くなる。残るのは、自分の世界。"
        "会社員が夜と週末にAIエージェントと作ってきたものから、"
        "自分の「好き」や「こだわり」を形にする道順を、毎回ひとつずつ書いていきます。"
    ),
    "cover": SERIES_DIR / "figures" / "series_cover.png",
}

MARK = "［図{}］"  # 本文の図を入れる場所の目印。入れ終わったら消す


# ---------------------------------------------------------------- 原稿を読む
def parse_article(md_path: Path) -> dict:
    """ep00_*.md から、タイトル・見出し画像・本文 HTML・本文の図・ハッシュタグを取り出す。"""
    raw = md_path.read_text(encoding="utf-8")
    tags = []
    m = re.search(r"ハッシュタグ[:：]\s*(.+)", raw)
    if m:
        tags = [t.lstrip("#") for t in m.group(1).split() if t.startswith("#")]
    text = re.sub(r"<!--.*?-->", "", raw, flags=re.S).strip()

    def inline(t):
        t = html.escape(t)
        return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)

    title, header, figures, out, para = None, None, [], [], []

    def flush():
        if para:
            out.append("<p>" + "<br>".join(inline(x) for x in para) + "</p>")
            para.clear()

    for line in text.split("\n"):
        img = re.match(r"!\[(.*?)\]\((.*?)\)\s*$", line)
        if not line.strip():
            flush()
        elif line.startswith("# "):
            flush()
            title = line[2:].strip()
        elif line.startswith("## "):
            flush()
            out.append("<h2>" + inline(line[3:].strip()) + "</h2>")
        elif line.startswith("> "):
            flush()
            out.append("<blockquote><p>" + inline(line[2:].strip()) + "</p></blockquote>")
        elif img:
            flush()
            path = (md_path.parent / img.group(2)).resolve()
            if header is None and img.group(1) == "見出し画像":
                header = path
            else:
                figures.append(path)
                out.append("<p>" + MARK.format(len(figures)) + "</p>")
        elif line.strip() == "── ここから有料 ──":
            raise SystemExit("有料の線がある原稿は、まだこのスクリプトでは扱わない（#00 は無料）")
        else:
            para.append(line)
    flush()
    body_html = "".join(out)
    body_text = re.sub(r"<[^>]+>", "\n", body_html)
    for p in [header, *figures]:
        if p and not p.exists():
            raise SystemExit(f"画像が見つからない: {p}")
    return {"title": title, "header": header, "figures": figures,
            "html": body_html, "text": html.unescape(body_text), "tags": tags}


# ---------------------------------------------------------------- 画面の操作
def wait_hand(msg: str):
    """自動でできなかった手順を、手でやってもらう。"""
    print("\n" + "=" * 60)
    print("【手で操作してください】")
    print(msg)
    print("終わったら、このウィンドウで Enter を押してください。")
    print("=" * 60)
    input()


def first_visible(page, selectors, timeout=4000):
    """候補のうち、最初に見つかったものを返す（note の画面が変わっても動きやすいように）。"""
    for sel in selectors:
        loc = page.locator(sel).first
        try:
            loc.wait_for(state="visible", timeout=timeout)
            return loc
        except PWTimeout:
            continue
    return None


def ensure_login(page):
    page.goto("https://note.com/notes/new")
    if "editor.note.com" in page.url:
        return
    print("ブラウザで note にログインしてください（初回だけ）。ログインが終わると自動で進みます。")
    page.wait_for_url(re.compile(r"editor\.note\.com/"), timeout=15 * 60 * 1000)


def editor(page):
    return page.locator(".ProseMirror[contenteditable='true']").first


PASTE_JS = """
async ({html, text, b64, name, mime, mode}) => {
  const el = document.querySelector(".ProseMirror[contenteditable='true']");
  el.focus();
  const dt = new DataTransfer();
  if (b64) {
    const bin = atob(b64); const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    dt.items.add(new File([u8], name, {type: mime}));
  } else {
    dt.setData("text/html", html);
    dt.setData("text/plain", text);
  }
  if (mode === "drop") {
    const r = window.getSelection().getRangeAt(0).getBoundingClientRect();
    const opt = {dataTransfer: dt, bubbles: true, cancelable: true,
                 clientX: r.left + 2, clientY: r.top + r.height / 2};
    const target = document.elementFromPoint(opt.clientX, opt.clientY) || el;
    target.dispatchEvent(new DragEvent("dragover", opt));
    target.dispatchEvent(new DragEvent("drop", opt));
  } else {
    el.dispatchEvent(new ClipboardEvent("paste", {clipboardData: dt, bubbles: true, cancelable: true}));
  }
}
"""

SELECT_MARK_JS = """
(mark) => {
  const el = document.querySelector(".ProseMirror[contenteditable='true']");
  const p = [...el.querySelectorAll("p")].find(n => n.textContent.trim() === mark);
  if (!p) return false;
  el.focus();
  const r = document.createRange(); r.selectNodeContents(p);
  const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  return true;
}
"""

COUNT_IMG_JS = """() => document.querySelectorAll(".ProseMirror[contenteditable='true'] img:not(.ProseMirror-separator)").length"""


def paste_body(page, art):
    ed = editor(page)
    ed.click()
    page.evaluate(PASTE_JS, {"html": art["html"], "text": art["text"], "b64": None,
                             "name": None, "mime": None, "mode": "paste"})
    page.wait_for_timeout(1500)
    n_h2 = page.locator(".ProseMirror h2").count()
    want = art["html"].count("<h2>")
    if n_h2 < want:
        print(f"  注意：見出しが {n_h2}/{want} しか見出しになっていない。画面で確認してください。")


def select_mark(page, mark) -> bool:
    ok = page.evaluate(SELECT_MARK_JS, mark)
    page.wait_for_timeout(200)
    return ok


def put_image(page, mark, path: Path) -> bool:
    """目印の段落を選んで、画像を貼る。だめなら、落とす（ドロップ）を試す。"""
    b64 = base64.b64encode(path.read_bytes()).decode()
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    for mode in ("paste", "drop"):
        if not select_mark(page, mark):
            return False
        before = page.evaluate(COUNT_IMG_JS)
        page.evaluate(PASTE_JS, {"html": None, "text": None, "b64": b64,
                                 "name": path.name, "mime": mime, "mode": mode})
        for _ in range(40):  # アップロードを最大 20 秒待つ
            page.wait_for_timeout(500)
            if page.evaluate(COUNT_IMG_JS) > before:
                # 目印の文字が残っていたら消す
                if select_mark(page, mark):
                    page.keyboard.press("Backspace")
                    page.keyboard.press("Backspace")
                return True
    return False


def set_header(page, path: Path):
    btn = first_visible(page, [
        "button[aria-label='画像を追加']",
        "button:has-text('見出し画像')",
        "[class*='eyecatch'] button",
    ])
    if btn:
        try:
            btn.click()
            item = first_visible(page, ["text=画像をアップロード", "button:has-text('アップロード')"], 3000)
            with page.expect_file_chooser(timeout=8000) as fc:
                (item or btn).click()
            fc.value.set_files(str(path))
            save = first_visible(page, ["[role='dialog'] button:has-text('保存')", "[role='dialog'] button:has-text('決定')",
                                        "button:text-is('保存')"], 15000)
            if save:
                save.click()
                page.wait_for_timeout(3000)
                return
        except PWTimeout:
            pass
    wait_hand(f"見出し画像を入れてください。\n  ファイル: {path}\n"
              "  （タイトルの上の画像アイコン → 画像をアップロード → 保存）")


def fill_title(page, title):
    t = first_visible(page, ["textarea[placeholder*='タイトル']", "[placeholder*='タイトル']"], 15000)
    if not t:
        wait_hand(f"タイトル欄に次を貼ってください。\n  {title}")
        return
    t.click()
    t.fill(title)


def save_draft(page):
    btn = first_visible(page, ["button:has-text('下書き保存')"], 5000)
    if btn:
        btn.click()
        page.wait_for_timeout(2500)


def go_publish_settings(page, art, magazine_name):
    btn = first_visible(page, ["button:has-text('公開に進む')", "button:has-text('公開設定')"], 5000)
    if not btn:
        wait_hand("「公開に進む」を押して、公開設定の画面を開いてください。")
    else:
        btn.click()
        page.wait_for_timeout(3000)

    tag_input = first_visible(page, ["input[placeholder*='ハッシュタグ']", "input[placeholder*='タグ']"], 8000)
    if tag_input and art["tags"]:
        for tag in art["tags"]:
            tag_input.click()
            tag_input.fill(tag)
            page.keyboard.press("Enter")
            page.wait_for_timeout(600)
    elif art["tags"]:
        wait_hand("ハッシュタグを入れてください。\n  " + " ".join("#" + t for t in art["tags"]))

    row = (page.locator("li, div").filter(has_text=magazine_name)
           .filter(has=page.locator("button:has-text('追加')")).last)
    try:
        row.wait_for(state="visible", timeout=5000)
        row.locator("button:has-text('追加')").first.click()
        page.wait_for_timeout(1000)
    except PWTimeout:
        wait_hand(f"マガジン「{magazine_name}」の「追加」を押してください。\n"
                  "  （マガジンがまだ無いときは、--magazine を付けて先に作る）")


def create_magazine(page):
    page.goto("https://note.com/")
    urlname = page.evaluate("""async () => {
        try { const r = await fetch('/api/v2/current_user', {credentials: 'include'});
              const j = await r.json(); return j.data && j.data.urlname; } catch (e) { return null; } }""")
    page.goto(f"https://note.com/{urlname}/magazines" if urlname else "https://note.com/")
    btn = first_visible(page, ["button:has-text('マガジンを作成')", "a:has-text('マガジンを作成')",
                               "button:has-text('作成')"], 6000)
    if btn:
        btn.click()
        page.wait_for_timeout(1500)
    name = first_visible(page, ["input[placeholder*='マガジン名']", "input[name*='name']"], 5000)
    desc = first_visible(page, ["textarea[placeholder*='説明']", "textarea"], 3000)
    if name:
        name.fill(MAGAZINE["name"])
    if desc:
        desc.fill(MAGAZINE["description"])
    wait_hand("マガジンの作成画面です。次の内容になっているか確かめて、足りないところを入れてから作成してください。\n"
              f"  マガジン名: {MAGAZINE['name']}\n"
              f"  説明:\n    " + MAGAZINE["description"].replace("\n", "\n    ") + "\n"
              f"  見出し画像: {MAGAZINE['cover']}\n"
              "  （無料マガジンにして、有料の回は1本ずつ売る形がおすすめ）")


# ---------------------------------------------------------------- 本体
def launch(pw):
    for channel in ("chrome", "msedge", None):
        try:
            return pw.chromium.launch_persistent_context(
                str(PROFILE_DIR), channel=channel, headless=False,
                viewport={"width": 1280, "height": 900}, locale="ja-JP")
        except Exception:  # そのブラウザが入っていない
            continue
    raise SystemExit("Chrome か Edge が見つからない。`py -m playwright install chromium` を実行してください。")


def main():
    ap = argparse.ArgumentParser(description="note の下書きを、投稿の直前まで作る")
    ap.add_argument("article", nargs="?", default=str(SERIES_DIR / "ep00_pro_is_not_prompt.md"))
    ap.add_argument("--magazine", action="store_true", help="先に連載のマガジンを作る")
    ap.add_argument("--check", action="store_true", help="原稿を読むだけ（ブラウザを開かない）")
    a = ap.parse_args()

    art = parse_article(Path(a.article))
    print(f"タイトル: {art['title']}")
    print(f"見出し画像: {art['header'].name if art['header'] else 'なし'}／本文の図: {len(art['figures'])} 枚")
    print(f"ハッシュタグ: {' '.join('#' + t for t in art['tags'])}")
    if a.check:
        return

    with sync_playwright() as pw:
        ctx = launch(pw)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.set_default_timeout(20000)

        ensure_login(page)
        if a.magazine:
            create_magazine(page)
            page.goto("https://note.com/notes/new")
            page.wait_for_url(re.compile(r"editor\.note\.com/"))

        print("1/5 タイトル")
        fill_title(page, art["title"])
        print("2/5 見出し画像")
        if art["header"]:
            set_header(page, art["header"])
        print("3/5 本文")
        paste_body(page, art)
        print("4/5 本文の図")
        left = []
        for i, fig in enumerate(art["figures"], 1):
            ok = put_image(page, MARK.format(i), fig)
            print(f"  {MARK.format(i)} {fig.name}: {'OK' if ok else '入らなかった'}")
            if not ok:
                left.append((MARK.format(i), fig))
        if left:
            wait_hand("次の図が自動で入らなかったので、本文の目印の場所にドラッグして入れ、目印の文字を消してください。\n"
                      + "\n".join(f"  {m} → {p}" for m, p in left))
        save_draft(page)
        print("5/5 公開設定（ハッシュタグ・マガジン）")
        go_publish_settings(page, art, MAGAZINE["name"])

        print("\n" + "=" * 60)
        print("投稿の直前まで進めました。「投稿する」は押していません。")
        print("画面で、タイトル・見出し画像・本文・図・ハッシュタグ・マガジンを確かめてください。")
        print("よければ、画面の「投稿する」を押せば公開されます。")
        print("やめるときは、このウィンドウで Enter（下書きは note に残ります）。")
        print("=" * 60)
        input()
        ctx.close()


if __name__ == "__main__":
    sys.exit(main())
