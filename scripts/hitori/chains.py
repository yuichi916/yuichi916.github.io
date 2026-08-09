# -*- coding: utf-8 -*-
"""複数県にまたがる同名店をチェーンとみなす。

手作業のチェーン一覧（~50件）とOSMのbrandタグだけでは検出漏れが多い。
367の店名が3県以上にまたがって出現し(6,063件)、来来亭(105件/27県)や
ラーメン山岡家(79件/25県)のような明らかなチェーンが一覧から漏れていた。
「同じ名前が複数県に展開している」こと自体を機械的にチェーン判定へ使う。

ただし県数だけで判定すると、庵・きらく・ふるさと・末広・喜楽・三浦屋・
富士屋・味平・香蘭のようなありふれた日本語の店名で、無関係な個人店3軒が
同名なだけの誤検出が起きる（実測で287グループ/5,554件のうち121グループ/
401件が総件数4件以下で、家族経営の店が大半を占めていた）。誤爆の実害は
機能の目的そのものと逆で、チェーンバッジが付いて「チェーンを隠す」で
消え、二度と穴場に選ばれなくなる。件数（展開規模）もあわせて要求する。
"""
import json
from collections import defaultdict
from pathlib import Path

NOTES = Path(__file__).resolve().parents[2] / "data" / "hitori" / "brand_notes.json"

MIN_PREFS = 3
MIN_RECORDS = 5   # 県をまたいでいても総件数がこれ未満なら個人店の可能性を優先する
CHAIN_CATS = ("eat", "play")


def detect_multi_pref_chains(records, min_prefs=MIN_PREFS, min_records=MIN_RECORDS, cats=CHAIN_CATS):
    """同一名かつ同カテゴリの施設が min_prefs 県以上・min_records 件以上のとき
    chain=1 にする。破壊的。

    cats に絞るのは、公共施設（中央図書館・市民会館など）が全国に同名で
    存在してもチェーンではないため。bath/stay には適用しない。
    (name, cat) でグルーピングするのは、同名の飲食店と娯楽施設が別法人で
    たまたま同じ名前を名乗っているだけのケースを合算しないため。
    県内で同名店が何件あっても（1つの県にしか出現しないなら）ここでは
    昇格させない — それは繁盛している個人店であってチェーンではない。
    件数が min_records に満たない場合も同様に昇格させない。
    既に chain=1 のレコードを 0 に戻すことはしない。
    """
    by_key = defaultdict(list)
    for r in records:
        if r["cat"] in cats:
            by_key[(r["name"], r["cat"])].append(r)

    promoted = 0
    for group in by_key.values():
        prefs = {r["_pref"] for r in group}
        if len(prefs) < min_prefs or len(group) < min_records:
            continue
        for r in group:
            if r["chain"] != 1:
                r["chain"] = 1
                promoted += 1
    return promoted


def load_brand_notes(path=NOTES):
    """調査で確定したブランドの分類を読む。

    県数の条件（3県以上）は、2県展開のチェーンを取りこぼす。実測で
    味の時計台16件・福しん12件・藤一番12件が漏れていた。逆に松の湯26件・
    大黒湯15件・鶴の湯14件のような同名の独立店は、条件を緩めると
    誤ってチェーンにされる。機械的な条件だけでは分けられないので、
    調べて確定したものを名簿で持つ。

    戻り値は (チェーンと確認した名前, チェーンでないと確認した名前)。
    """
    if not path.exists():
        return set(), set()
    d = json.loads(path.read_text(encoding="utf-8"))
    chain = set(d.get("active_verified", {}).get("brands", []))
    chain |= {k for k in d.get("shrinking", {}) if not k.startswith("_")}
    chain |= {k for k in d.get("closed_all", {}) if not k.startswith("_")}
    not_chain = {k for k in d.get("not_a_chain", {}) if not k.startswith("_")}
    return chain, not_chain


def apply_brand_notes(records, chain_names=None, not_chain_names=None):
    """調べて確定した分類を反映する。破壊的。戻り値は (付けた数, 外した数)。

    名簿は機械的な検出より強い。調べた結果だからである。
    「チェーンでない」と確認したものは、誤って付いた印を外す。
    """
    if chain_names is None or not_chain_names is None:
        c, n = load_brand_notes()
        chain_names = chain_names if chain_names is not None else c
        not_chain_names = not_chain_names if not_chain_names is not None else n
    added = removed = 0
    for r in records:
        nm = r.get("name", "")
        if nm in not_chain_names:
            if r.get("chain") == 1:
                r["chain"] = 0
                removed += 1
        elif nm in chain_names:
            if r.get("chain") != 1:
                r["chain"] = 1
                added += 1
    return added, removed
