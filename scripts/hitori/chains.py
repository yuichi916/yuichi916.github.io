# -*- coding: utf-8 -*-
"""複数県にまたがる同名店をチェーンとみなす。

手作業のチェーン一覧（~50件）とOSMのbrandタグだけでは検出漏れが多い。
367の店名が3県以上にまたがって出現し(6,063件)、来来亭(105件/27県)や
ラーメン山岡家(79件/25県)のような明らかなチェーンが一覧から漏れていた。
「同じ名前が複数県に展開している」こと自体を機械的にチェーン判定へ使う。
"""
from collections import defaultdict

MIN_PREFS = 3
CHAIN_CATS = ("eat", "play")


def detect_multi_pref_chains(records, min_prefs=MIN_PREFS, cats=CHAIN_CATS):
    """同一名の施設が min_prefs 県以上に存在するとき chain=1 にする。破壊的。

    cats に絞るのは、公共施設（中央図書館・市民会館など）が全国に同名で
    存在してもチェーンではないため。bath/stay には適用しない。
    県内で同名店が何件あっても（1つの県にしか出現しないなら）ここでは
    昇格させない — それは繁盛している個人店であってチェーンではない。
    既に chain=1 のレコードを 0 に戻すことはしない。
    """
    by_name = defaultdict(list)
    for r in records:
        if r["cat"] in cats:
            by_name[r["name"]].append(r)

    promoted = 0
    for group in by_name.values():
        prefs = {r["_pref"] for r in group}
        if len(prefs) < min_prefs:
            continue
        for r in group:
            if r["chain"] != 1:
                r["chain"] = 1
                promoted += 1
    return promoted
