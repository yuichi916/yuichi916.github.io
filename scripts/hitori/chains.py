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
from collections import defaultdict

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
