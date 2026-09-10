# -*- coding: utf-8 -*-
"""取ってきた本文から、ひとりチェックの6項目を**規則で**抜く。

LLM に読ませるより先に、書き方が決まっているものは規則で拾う。この方式には
LLM に無い保証が2つある。

  1. 引用は必ず本文から切り出すので、**捏造が原理的に起きない**
  2. 同じページからは必ず同じ答えが出る（あとで数え直しても揺れない）

規則で拾えないもの（言い回しが自由な solo_ok など）は LLM に回す。
ここは「確実に取れるぶんを、確実に取る」ための工程。

誤検出を避けるための決めごと:
  - 否定と条件を先に見る。「予約は承っておりません」を possible にしない
  - 持ち帰り・宅配の文脈にある予約は採らない（席の予約ではない）
  - 「店舗により異なります」が同じ文にあれば採らない
"""
import argparse, json, re
from pathlib import Path

# 事実を1つ取り出す規則。(語彙値, 正規表現, 除外語) の組。
# 除外語が**同じ行**にあれば、その一致は捨てる。
NG_TAKEAWAY = ("弁当", "持ち帰", "テイクアウト", "お受け取り", "受け取り", "デリバリー",
               "出前", "通販", "宅配", "ケータリング", "オンラインショップ")
NG_VARY = ("店舗により", "店舗によって", "一部店舗", "店舗ごと")

RULES = {
    "payment_method": [
        ("ticket_machine", r"券売機", ()),
        ("cash_only", r"現金[のみ払]|現金決済のみ|お支払いは現金", ("現金以外", "現金の他")),
        ("cashless_ok", r"(クレジットカード|電子マネー|キャッシュレス|交通系IC|PayPay|QRコード決済)[^。\n]{0,12}(利用|使用|対応|可|OK|ご利用)", ("利用できません", "使えません", "不可", "対応しており")),
    ],
    "reservation": [
        ("required", r"(完全予約制|要予約|予約制です|事前予約が必要|予約が必須)", NG_TAKEAWAY),
        ("none", r"(予約[はも]?(承っておりません|不[要可]|受け付けており?ません|お受けしており?ません)|予約なしで)", NG_TAKEAWAY),
        ("possible", r"(ご?予約[はを]?(承(り|って)|受け付け|可能|できます|お受け)|席の予約|WEB予約|ネット予約)", NG_TAKEAWAY),
    ],
    "silence": [
        ("posted", r"(黙浴|私語[はを]?(お控え|ご遠慮|厳禁)|お静かに|静かに(ご鑑賞|お過ごし|ご利用)|会話[はを]?(お控え|ご遠慮))", ()),
    ],
    "access": [
        ("male_only", r"(男性専用|男性のみ(ご利用|利用)|女性[のはご]{0,2}(利用|入館)[はを]?(できません|ご遠慮))", ("男女", "女性専用")),
        ("female_only", r"(女性専用|女性のみ(ご利用|利用)|男性[のはご]{0,2}(利用|入館)[はを]?(できません|ご遠慮))", ("男女", "男性専用")),
        ("members_only", r"(会員制|会員のみ|会員限定|ご入会が必要)", ("会員でなくても", "非会員")),
        ("residents_only", r"(市民[のみ限定]|町民[のみ限定]|住民[のみ限定]|在住(の方|者)のみ)", ()),
    ],
    # 休業・閉業は「いまの状態」でなければ意味が無い。ところがお知らせ欄には
    # 過去の告知が何年も残る（「8月12日(水)臨時休業」「COVID-19に伴う臨時休業」）。
    # 日付や曜日が添えられた告知はその日限りの話なので採らない（DATED で行ごと外す）。
    # 期間の決まっていない休業と、閉業だけを現在の状態として扱う。
    "status": [
        ("closed_permanently", r"(閉[店館業]いたしました|閉[店館業]しました|営業を終了(いたし|し)ました)",
         ("一時", "リニューアル", "予定")),
        ("closed_temporarily", r"(当面の間[^。\n]{0,10}休|休[業館]中(です|となって|とさせて)|現在[^。\n]{0,6}休[業館]中|改修工事のため休[業館]中)",
         ()),
    ],
}
# カウンター席は数が書いてあれば数、無ければ有無を文で残す
COUNTER_N = re.compile(r"カウンター(?:席)?\s*[:：]?\s*(\d{1,3})\s*席")
COUNTER_Y = re.compile(r"カウンター席")
# 「8月12日(水)臨時休業」のように日付・曜日が添えられた告知は、その日限りの話。
DATED = re.compile(r"(\d{1,2}\s*[月/]\s*\d{1,2}\s*[日）)]?|[（(][月火水木金土日][）)]|\d{4}\s*年|令和\d)")
SEATS_N = re.compile(r"(?:総?席数|全席|座席数)\s*[:：]?\s*(\d{1,3})\s*席")
# 一人利用は言い回しが広い。規則では「その語がある行」を証拠として拾うだけにする。
# 「お一人様あたり3,000円」は料金の単位であって、一人歓迎の話ではない。
# 助詞で切って、歓迎・可否の文脈にあるものだけ拾う。
SOLO = re.compile(r"(おひとり様|お一人様|お一人|おひとり|1名様|一名様)"
                  r"(?!あたり|様?単位|につき|当たり)"
                  r"[^。\n]{0,14}(歓迎|大丈夫|OK|ok|どうぞ|安心|気軽|ご利用|利用いただ|お越し|ご来店|入店|可能|でも)")

MAXQ = 80


def _lines(text):
    for raw in text.splitlines():
        s = raw.strip()
        if 4 <= len(s) <= 400:
            yield s


def _quote(line):
    return line if len(line) <= MAXQ else line[:MAXQ - 1] + "…"


def extract(text, url):
    """本文 → 事実のリスト。同じ項目は最初に当たった1つだけ。"""
    found, out = set(), []

    def add(k, v, line):
        if k in found:
            return
        found.add(k)
        out.append({"k": k, "v": v, "quote": _quote(line), "url": url})

    for line in _lines(text):
        if any(w in line for w in NG_VARY):
            continue
        dated = DATED.search(line)
        for k, rules in RULES.items():
            if k in found:
                continue
            # 日付つきの休業告知は「その日の話」。いまの状態として採らない
            if k == "status" and dated:
                continue
            for value, pat, ng in rules:
                if any(w in line for w in ng):
                    continue
                if re.search(pat, line):
                    add(k, value, line)
                    break
        if "counter_seats" not in found:
            m = COUNTER_N.search(line)
            if m:
                add("counter_seats", int(m.group(1)), line)
            elif COUNTER_Y.search(line):
                add("counter_seats", "カウンター席あり", line)
        if "seats_total" not in found:
            m = SEATS_N.search(line)
            if m:
                add("seats_total", int(m.group(1)), line)
        if "solo_ok" not in found and SOLO.search(line):
            add("solo_ok", _quote(line), line)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", required=True, help="fetch_pages.py の出力ディレクトリ")
    ap.add_argument("--out", required=True)
    ap.add_argument("--official", action="store_true", default=True)
    args = ap.parse_args()

    base = Path(args.pages)
    fetched = json.loads((base / "fetch.json").read_text(encoding="utf-8"))
    results, n_facts = [], 0
    for rec in fetched:
        if rec.get("status") != "ok":
            continue
        p = base / "pages" / (rec.get("file") or f"{rec['id']}.txt")
        if not p.exists():
            continue
        text = p.read_text(encoding="utf-8")
        facts = extract(text, rec.get("final_url") or rec["web"])
        if not facts:
            continue
        n_facts += len(facts)
        results.append({"id": rec["id"], "name": rec.get("name", ""), "status": "ok",
                        "identity": "match", "fetched_urls": [rec.get("final_url") or rec["web"]],
                        "facts": facts, "note": "本文からの規則抽出"})
    Path(args.out).write_text(json.dumps({"results": results}, ensure_ascii=False), encoding="utf-8")
    print(f"本文 {sum(1 for r in fetched if r.get('status') == 'ok'):,} 件から "
          f"{len(results):,} 施設 / {n_facts:,} 事実")
    print(f"{args.out} に書いた。merge_extract.py --in {args.out} --pages <本文> で照合できる。")


if __name__ == "__main__":
    main()
