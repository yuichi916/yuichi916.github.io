# -*- coding: utf-8 -*-
"""抽出係（LLM）の出力を検証し、curated.json へ取り込む。

抽出係は「書いてあることだけ書く」と指示されているが、指示は守られたか分からない。
守られたかどうかを**機械で確かめてから**しか本体に入れない、というのがこの工程の役目。

弾く条件（1つでも当たれば、その事実は捨てる。施設ごと落とすのではなく事実ごと）:
  - quote が無い / 短すぎる
  - 語彙が決まっている k なのに語彙外の値
  - quote が取得元ページに実在しない（引用の捏造。ページ本文を持っている時のみ検査）
  - url が http(s) でない
  - identity が match でない施設の事実すべて（別の店の情報を混ぜない）

同じ k に既存の値があり、値が違えば conflict=true を両方に立てる（どちらかを選んで捨てない）。

使い方:
  python scripts/hitori/merge_extract.py --in <抽出結果.json ...> --dry
  python scripts/hitori/merge_extract.py --in <抽出結果.json ...> --apply
"""
import argparse, json, re, sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
CURATED = ROOT / "data" / "hitori" / "curated.json"

# enrich.FACT_VOCAB と同じ語彙。ここを緩めると、推測で埋めた値が本体に入る。
VOCAB = {
    "payment_method": {"ticket_machine", "counter_person", "cashless_ok", "cash_only"},
    "reservation": {"none", "possible", "required"},
    "silence": {"posted", "observed"},
    "clientele": {"local", "tourist", "solo_common"},
    "first_timer": {"easy", "custom_exists"},
    "access": {"public", "residents_only", "members_only", "male_only", "female_only"},
    "status": {"open", "closed_temporarily", "closed_permanently"},
}
INT_KEYS = {"counter_seats", "seats_total", "price"}
STR_KEYS = {"hours", "closed_days", "solo_ok", "parking", "price_note", "address", "closes_on", "renamed_to"}
ALLOWED = set(VOCAB) | INT_KEYS | STR_KEYS
# 自動アクセスを禁止しているサイト。事実の出所として数えない（enrich.BLOCKED_DOMAINS と同じ趣旨）
BLOCKED = {"tabelog.com", "sauna-ikitai.com", "retty.me"}
MIN_QUOTE = 4


def _domain(url):
    try:
        return (urlparse(url).hostname or "").replace("www.", "")
    except ValueError:
        return ""


def _norm(s):
    """引用の一致を見るための正規化。空白と全角半角の揺れだけを吸収する。"""
    return re.sub(r"\s+", "", str(s)).replace("～", "〜").replace("－", "-")


def check_fact(f, page_text=None):
    """1件の事実を検査する。通れば None、駄目なら理由を返す。"""
    k, v, q, u = f.get("k"), f.get("v"), f.get("quote"), f.get("url")
    if k not in ALLOWED:
        return f"未知の項目 {k!r}"
    if not isinstance(u, str) or not re.match(r"^https?://", u):
        return "url が http(s) でない"
    d = _domain(u)
    if d in BLOCKED:
        return f"取得を禁じているドメイン {d}"
    if not isinstance(q, str) or len(q.strip()) < MIN_QUOTE:
        return "quote が無い/短い"
    if k in VOCAB and v not in VOCAB[k]:
        return f"{k} の語彙外の値 {v!r}"
    if k in INT_KEYS and not isinstance(v, int):
        return f"{k} が整数でない {v!r}"
    if k in STR_KEYS and not (isinstance(v, str) and v.strip()):
        return f"{k} が空"
    if page_text and _norm(q) not in _norm(page_text):
        return "quote が取得元ページに見つからない"
    return None


def to_curated_fact(f, checked):
    """抽出結果 1件 → curated.json の事実の形。"""
    d = _domain(f["url"])
    return {"k": f["k"], "v": f["v"], "n": 1, "official": True, "conflict": False,
            "src": [d], "urls": [f["url"]], "quote": f["quote"], "checked": checked}


def merge(results, curated, checked, pages=None):
    """抽出結果を curated に足す。curated は破壊的に更新する。統計を返す。"""
    pages = pages or {}
    stat = {"facilities": 0, "added": 0, "rejected": 0, "conflicts": 0, "skipped_facilities": 0}
    reasons, added_ids = {}, []
    for r in results:
        fid = r.get("id")
        if not fid or r.get("status") != "ok" or r.get("identity") != "match":
            stat["skipped_facilities"] += 1
            continue
        good = []
        for f in r.get("facts", []):
            why = check_fact(f, pages.get(f.get("url")))
            if why:
                stat["rejected"] += 1
                reasons[why] = reasons.get(why, 0) + 1
                continue
            good.append(f)
        if not good:
            stat["skipped_facilities"] += 1
            continue
        entry = curated.setdefault(fid, {"checked": checked, "facts": []})
        entry["checked"] = max(entry.get("checked", ""), checked)
        for f in good:
            new = to_curated_fact(f, checked)
            same = [x for x in entry["facts"] if x.get("k") == new["k"]]
            # 同じ項目に違う値があるなら、どちらかを選んで捨てず両方に印をつける
            if any(x.get("v") != new["v"] for x in same):
                new["conflict"] = True
                for x in same:
                    x["conflict"] = True
                stat["conflicts"] += 1
            elif same:
                continue          # 同じ値の重複は増やさない
            entry["facts"].append(new)
            stat["added"] += 1
        stat["facilities"] += 1
        added_ids.append(fid)
    return stat, reasons, added_ids


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inputs", nargs="+", required=True)
    ap.add_argument("--pages", help="url -> 本文 の JSON（あれば引用の実在も検査する）")
    ap.add_argument("--apply", action="store_true", help="curated.json を書き換える（既定は下見のみ）")
    ap.add_argument("--checked", default=date.today().isoformat())
    args = ap.parse_args()

    results = []
    for p in args.inputs:
        doc = json.loads(Path(p).read_text(encoding="utf-8"))
        results += doc["results"] if isinstance(doc, dict) else doc
    pages = json.loads(Path(args.pages).read_text(encoding="utf-8")) if args.pages else {}

    curated = json.loads(CURATED.read_text(encoding="utf-8"))
    before = len(curated)
    stat, reasons, ids = merge(results, curated, args.checked, pages)

    print(f"入力 {len(results)} 施設 / 取り込み {stat['facilities']} 施設 {stat['added']} 事実")
    print(f"  弾いた事実 {stat['rejected']}  食い違い {stat['conflicts']}  見送った施設 {stat['skipped_facilities']}")
    for why, n in sorted(reasons.items(), key=lambda x: -x[1]):
        print(f"    {n:4} {why}")
    print(f"  確認済み施設 {before} -> {len(curated)}")
    if not args.apply:
        print("下見のみ。書き込むには --apply を付ける。")
        return
    CURATED.write_text(json.dumps(curated, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{CURATED} を更新した。scripts/hitori/build_index.py を実行して索引を作り直すこと。")


if __name__ == "__main__":
    main()
