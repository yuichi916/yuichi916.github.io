# -*- coding: utf-8 -*-
"""OSM の生タグから「ひとりチェック」の信号を取り出す。

外へ1回も取りに行かずに済む信号が、生データの中に埋まったままだった。
build_data.py は name/opening_hours/website など数個しか見ておらず、
payment:* や capacity や reservation を捨てていた。ここで拾い直す。

原則は本体と同じ。**書いてあることだけを事実にする**。
- payment:cash=yes だけでは cash_only にしない（カードのタグが無いことは、
  カードが使えないことの証拠ではない）。cashless のタグが yes の時だけ cashless_ok。
- reservation は OSM の語彙をそのまま写す。recommended は possible に寄せる。
- capacity は席数として扱うが、業態が飲食・温浴・体験のときだけ（宿の capacity は部屋数）。

使い方:
  python scripts/hitori/osm_signals.py --out <抽出結果と同じ形の JSON>
  → そのまま merge_extract.py に渡せる（同じ検査を通す）
"""
import argparse, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "_local" / "hitori_raw"
DATA = ROOT / "data" / "hitori"

# 「これが yes なら現金以外で払える」と言い切れるタグ。
CASHLESS = (
    "payment:credit_cards", "payment:visa", "payment:mastercard", "payment:jcb",
    "payment:american_express", "payment:debit_cards", "payment:cards", "payment:diners_club",
    "payment:discover_card", "payment:unionpay", "payment:icsf", "payment:id", "payment:iD",
    "payment:quicpay", "payment:QUICPay", "payment:edy", "payment:rakuten_edy", "payment:Edy",
    "payment:waon", "payment:WAON", "payment:nanaco", "payment:suica", "payment:pasmo",
    "payment:icoca", "payment:kitaca", "payment:toica", "payment:manaca", "payment:nimoca",
    "payment:sugoca", "payment:hayakaken", "payment:paypay", "payment:PayPay", "payment:line_pay",
    "payment:d_barai", "payment:au_pay", "payment:rakuten_pay", "payment:merpay", "payment:alipay",
    "payment:wechat", "payment:apple_pay", "payment:google_pay", "payment:contactless",
    "payment:qr_code", "payment:ic", "payment:jcoin_pay", "payment:bank_pay", "payment:aeon_pay",
)
RESERVATION = {"yes": "possible", "recommended": "possible", "required": "required", "no": "none"}
# 宿の capacity は部屋数のことが多い。席として読めるのは店内で過ごす業態だけ。
SEAT_CATS = {"eat", "bath", "play", "quiet"}


def osm_url(el):
    return f"https://www.openstreetmap.org/{el.get('type', 'node')}/{el.get('id')}"


def signals_from_tags(tags, cat=None):
    """タグ → 事実のリスト。quote は「タグ=値」そのもの（これが原文にあたる）。"""
    out = []
    hit = [k for k in CASHLESS if tags.get(k) == "yes"]
    if hit:
        out.append({"k": "payment_method", "v": "cashless_ok",
                    "quote": ", ".join(f"{k}=yes" for k in hit[:4])})
    r = RESERVATION.get(tags.get("reservation"))
    if r:
        out.append({"k": "reservation", "v": r, "quote": f"reservation={tags['reservation']}"})
    cap = (tags.get("capacity") or "").strip()
    if cap.isdigit() and int(cap) > 0 and (cat is None or cat in SEAT_CATS):
        out.append({"k": "seats_total", "v": int(cap), "quote": f"capacity={cap}"})
    male, female = tags.get("male") == "yes", tags.get("female") == "yes"
    if male and not female:
        out.append({"k": "access", "v": "male_only", "quote": "male=yes"})
    elif female and not male:
        out.append({"k": "access", "v": "female_only", "quote": "female=yes"})
    return out


def collect(raw_dir, cat_of):
    """生データ全県 → 抽出結果と同じ形。cat_of: id -> 表示前の cat（掲載中の施設だけ通す）"""
    results = []
    for path in sorted(Path(raw_dir).glob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        elements = doc.get("elements", []) if isinstance(doc, dict) else doc
        for el in elements:
            if not isinstance(el, dict):
                continue
            tags = el.get("tags") or {}
            if not (tags.get("name") or "").strip():
                continue
            fid = f"{el.get('type', 'node')[0]}{el.get('id')}"
            if fid not in cat_of:      # 掲載していない施設に事実を足しても意味がない
                continue
            facts = signals_from_tags(tags, cat_of[fid])
            if not facts:
                continue
            url = osm_url(el)
            results.append({
                "id": fid, "name": tags["name"], "status": "ok", "identity": "match",
                "fetched_urls": [url],
                # 出典は OSM そのもの。公式サイトの記述ではないので official は付けない
                "facts": [dict(f, url=url, official=False) for f in facts],
                "note": "OSM のタグから",
            })
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default=str(RAW_DIR))
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    cat_of = {}
    for f in sorted((DATA / "pref").glob("*.json")):
        doc = json.loads(f.read_text(encoding="utf-8"))
        i_id, i_cat = doc["fields"].index("id"), doc["fields"].index("cat")
        for row in doc["items"]:
            cat_of[row[i_id]] = row[i_cat]

    results = collect(args.raw, cat_of)
    n_facts = sum(len(r["facts"]) for r in results)
    Path(args.out).write_text(json.dumps({"results": results}, ensure_ascii=False), encoding="utf-8")
    print(f"掲載中の施設 {len(cat_of):,} 件のうち {len(results):,} 件に、OSM のタグから {n_facts:,} 個の信号")
    print(f"{args.out} に書いた。merge_extract.py --in {args.out} で下見できる。")


if __name__ == "__main__":
    main()
