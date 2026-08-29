# -*- coding: utf-8 -*-
"""スコアリングの純関数テスト。spec §5 の判定表がそのまま期待値になっている。"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import scoring


def test_classify():
    # eat: 名前ルールが cuisine ルールより優先される
    assert scoring.classify({"amenity": "restaurant", "name": "立ち食いそば まる", "cuisine": "soba"}) == ("eat", "standing", 5)
    assert scoring.classify({"amenity": "fast_food", "name": "角打ち よしだ"}) == ("eat", "standing", 5)
    assert scoring.classify({"amenity": "restaurant", "name": "焼肉ライク 新宿店"}) == ("eat", "yakiniku_solo", 5)
    assert scoring.classify({"amenity": "restaurant", "name": "一蘭 渋谷店", "cuisine": "ramen"}) == ("eat", "ramen", 4)
    assert scoring.classify({"amenity": "fast_food", "name": "富士そば", "cuisine": "soba;udon"}) == ("eat", "soba_udon", 4)
    assert scoring.classify({"amenity": "restaurant", "name": "松屋", "cuisine": "gyudon"}) == ("eat", "gyudon", 4)
    assert scoring.classify({"amenity": "restaurant", "name": "CoCo壱番屋", "cuisine": "curry"}) == ("eat", "curry", 4)

    # 回帰: "gyudon" は部分文字列として "udon" を含む。部分一致で判定すると
    # 牛丼屋がそば・うどん屋に化ける。トークン照合であることを固定する。
    assert scoring.classify({"amenity": "fast_food", "name": "吉野家", "cuisine": "gyudon"}) == ("eat", "gyudon", 4)
    assert scoring.classify({"amenity": "restaurant", "name": "なか卯", "cuisine": "japanese;gyudon"}) == ("eat", "gyudon", 4)
    # 表記ゆれの救済経路でも同じ結果になること
    assert scoring.classify({"amenity": "fast_food", "name": "○○", "cuisine": "gyudon_shop"}) == ("eat", "gyudon", 4)
    # 素直な udon は soba_udon のまま
    assert scoring.classify({"amenity": "restaurant", "name": "○○", "cuisine": "udon"}) == ("eat", "soba_udon", 4)

    # eat: 対象外の業態は収録しない
    assert scoring.classify({"amenity": "restaurant", "name": "居酒屋 とり", "cuisine": "izakaya"}) is None
    assert scoring.classify({"amenity": "cafe", "name": "喫茶 のんびり"}) is None

    # bath
    assert scoring.classify({"leisure": "sauna", "name": "サウナ○○"}) == ("bath", "sauna", 5)
    assert scoring.classify({"amenity": "public_bath", "bath:type": "onsen", "name": "○○温泉"}) == ("bath", "onsen", 3)
    assert scoring.classify({"amenity": "public_bath", "name": "○○湯"}) == ("bath", "sento", 4)

    # play / stay
    assert scoring.classify({"amenity": "internet_cafe", "name": "快活CLUB"}) == ("play", "netcafe", 5)
    assert scoring.classify({"amenity": "karaoke_box", "name": "まねきねこ"}) == ("play", "karaoke", 4)
    assert scoring.classify({"amenity": "cinema", "name": "○○シネマ"}) == ("play", "cinema", 3)
    assert scoring.classify({"amenity": "library", "name": "○○図書館"}) == ("stay", "library", 4)
    assert scoring.classify({"tourism": "hostel", "name": "○○ゲストハウス"}) == ("stay", "hostel", 3)
    assert scoring.classify({"tourism": "museum", "name": "○○美術館"}) == ("stay", "museum", 3)

    # 該当なし
    assert scoring.classify({"shop": "convenience", "name": "○○ストア"}) is None
    assert scoring.classify({}) is None

    # restaurant タグと public_bath タグが同居しても bath に落ちる（早期 None にしない）
    assert scoring.classify({"amenity": "public_bath", "cuisine": "izakaya"}) == ("bath", "sento", 4)


def test_axes():
    # 業態ベース値。spec §5 の表がそのまま期待値。
    assert scoring.axes("library", "○○図書館", [], {}) == {"solo": 4, "quiet": 5, "easy": 5}
    assert scoring.axes("standing", "立ち食いそば まる", [], {}) == {"solo": 5, "quiet": 2, "easy": 2}
    assert scoring.axes("netcafe", "快活CLUB", [], {}) == {"solo": 5, "quiet": 5, "easy": 5}
    assert scoring.axes("sauna", "サウナ○○", [], {}) == {"solo": 5, "quiet": 5, "easy": 3}
    assert scoring.axes("karaoke", "○○カラオケ", [], {}) == {"solo": 4, "quiet": 2, "easy": 4}
    assert scoring.axes("sento", "はやし湯", [], {}) == {"solo": 4, "quiet": 4, "easy": 3}
    assert scoring.axes("onsen", "○○温泉", [], {}) == {"solo": 3, "quiet": 4, "easy": 3}
    assert scoring.axes("museum", "○○美術館", [], {}) == {"solo": 3, "quiet": 5, "easy": 5}

    # チェーン加点は solo にだけ効く。チェーンかどうかは静けさや作法と無関係。
    a = scoring.axes("ramen", "一蘭 渋谷店", [], {})
    assert a == {"solo": 5, "quiet": 4, "easy": 3}
    b = scoring.axes("ramen", "はやしや", [], {})
    assert b == {"solo": 4, "quiet": 4, "easy": 3}

    # エビデンスも solo にだけ効く
    pos = [{"src": "visit", "checked": "2026-08-01", "polarity": "+"}]
    assert scoring.axes("onsen", "○○温泉", pos, {}) == {"solo": 4, "quiet": 4, "easy": 3}
    neg = [{"src": "user", "checked": "2026-08-01", "polarity": "-"}]
    assert scoring.axes("sento", "はやし湯", neg, {}) == {"solo": 3, "quiet": 4, "easy": 3}

    # クランプ
    assert scoring.axes("standing", "焼肉ライク", pos, {})["solo"] == 5

    # curated は軸ごとに上書きできる
    assert scoring.axes("sento", "はやし湯", [], {"quiet": 2})["quiet"] == 2
    assert scoring.axes("library", "○○図書館", [], {"easy": 3, "solo": 5}) == \
        {"solo": 5, "quiet": 5, "easy": 3}

    # 未知の kind は例外にする（表の追加漏れを黙って通さない）
    try:
        scoring.axes("unknown_kind", "○○", [], {})
    except KeyError:
        pass
    else:
        raise AssertionError("未知のkindが素通りした")


def test_axes_table_covers_all_kinds():
    # classify が返しうる kind はすべて AXES に載っていること
    kinds = {
        "standing", "yakiniku_solo", "ramen", "soba_udon", "gyudon", "curry",
        "sauna", "onsen", "sento", "netcafe", "karaoke", "cinema",
        "library", "hostel", "museum",
    }
    assert kinds <= set(scoring.AXES), kinds - set(scoring.AXES)
    for k, v in scoring.AXES.items():
        assert len(v) == 3, k
        assert all(1 <= x <= 5 for x in v), k


def _entries(block):
    """業態名 → 連結した文字列。テンプレートの + 連結をつないで比べる。"""
    out = {}
    for k, v in re.findall(r"^\s{2}(\w+): (.*?)(?=\n\s{2}\w+:|\Z)", block, re.S | re.M):
        out[k] = "".join(re.findall(r"'([^']*)'", v))
    return out


def test_kind_gaze_covers_every_kind():
    """「周りからどう見えるか」が全業態にあること。

    研究(§2a)が一蘭の例で言うのは、一人客の最大の障壁は味でも値段でもなく
    他人の視線だということ。業態を足したときにここだけ抜けると、
    いちばん効く説明が黙って消える。
    """
    src = (ROOT / "hitori-legacy.html").read_text(encoding="utf-8")
    m = re.search(r"const KIND_GAZE = \{(.*?)\n\};", src, re.S)
    assert m, "hitori-legacy.html に KIND_GAZE が見つからない"
    keys = set(re.findall(r"^\s{2}(\w+):", m.group(1), re.M))
    assert set(scoring.AXES) <= keys, set(scoring.AXES) - keys


def test_kind_gaze_is_not_the_same_text_as_the_guide():
    """作法の言い換えになっていないこと。

    「自分は何をするのか」と「周りからどう見えるのか」は別の問い。
    同じ文を二度出すなら節を分ける意味がない。
    """
    src = (ROOT / "hitori-legacy.html").read_text(encoding="utf-8")
    g = _entries(re.search(r"const KIND_GAZE = \{(.*?)\n\};", src, re.S).group(1))
    d = _entries(re.search(r"const KIND_GUIDE = \{(.*?)\n\};", src, re.S).group(1))
    both = set(g) & set(d)
    assert both, "比べる業態が無い"
    for k in both:
        assert g[k], k
        assert g[k] != d[k], k


def test_kind_guide_covers_every_kind():
    """hitori-legacy.html の KIND_GUIDE が全業態を網羅していること。

    AXES には test_axes_table_covers_all_kinds があるが KIND_GUIDE には
    無かった。新しい業態を足すと、その業態だけ作法ガイドが黙って消える。
    ソースを読むのは、ここが Playwright を使わない層だから。
    """
    src = (ROOT / "hitori-legacy.html").read_text(encoding="utf-8")
    m = re.search(r"const KIND_GUIDE = \{(.*?)\n\};", src, re.S)
    assert m, "hitori-legacy.html に KIND_GUIDE が見つからない"
    keys = set(re.findall(r"^\s{2}(\w+):", m.group(1), re.M))
    assert keys, "KIND_GUIDE の項目を読み取れない"
    assert set(scoring.AXES) <= keys, set(scoring.AXES) - keys


def test_kind_guide_test_would_catch_a_missing_kind():
    """上のテストが空振りでないこと。1業態を消せば落ちる、を確かめる。"""
    src = (ROOT / "hitori-legacy.html").read_text(encoding="utf-8")
    m = re.search(r"const KIND_GUIDE = \{(.*?)\n\};", src, re.S)
    keys = set(re.findall(r"^\s{2}(\w+):", m.group(1), re.M))
    keys.discard("sento")
    assert not (set(scoring.AXES) <= keys), "業態を1つ消しても通ってしまう"


def test_footbath_is_not_a_sento():
    """足湯・手湯を銭湯として出さない。

    服を脱がず、番台も洗い場も無い。銭湯にすると「かけ湯をしてから
    湯船へ、湯船で体を洗わない」という作法ガイドまで付く。
    別府駅前広場モニュメント「手湯」が銭湯として一覧の先頭に出ていた。
    """
    for name in ("別府駅前広場モニュメント「手湯」", "羊ヶ丘ほっと足湯", "足湯",
                 "薬師如来の手・足湯", "道の駅 遠軽 森のオホーツク 足湯"):
        assert scoring.classify({"amenity": "public_bath", "name": name})             == ("bath", "footbath", 5), name
    # bath:type=onsen が付いていても足湯は足湯
    assert scoring.classify({"amenity": "public_bath", "bath:type": "onsen",
                             "name": "大湯沼川天然足湯"}) == ("bath", "footbath", 5)


def test_footbath_rule_does_not_swallow_real_baths():
    """本物の浴場を巻き込まないこと。「湯」を含むだけの名前は銭湯のまま。"""
    for name, want in (("松の湯", "sento"), ("旭湯", "sento"),
                       ("あしかがフラワーパーク", "sento"), ("手打ちそば湯本", "sento")):
        got = scoring.classify({"amenity": "public_bath", "name": name})
        assert got == ("bath", want, 4), (name, got)
    assert scoring.classify({"amenity": "public_bath", "bath:type": "onsen",
                             "name": "○○温泉"}) == ("bath", "onsen", 3)


def test_footbath_axes_say_it_is_easy():
    """服を脱がず作法も無い。solo と easy は最大。屋外なので quiet は下げる。"""
    assert scoring.axes("footbath", "足湯", [], {}) == {"solo": 5, "quiet": 3, "easy": 5}


def test_confidence():
    assert scoring.confidence([]) == 0
    assert scoring.confidence([{"src": "web", "checked": "2026-08-01", "polarity": "+"}]) == 1
    assert scoring.confidence([{"src": "user", "checked": "2026-08-01", "polarity": "+"}]) == 2
    assert scoring.confidence([{"src": "visit", "checked": "2026-08-01", "polarity": "+"}]) == 2
    # web と user が混在したら高いほうを採る
    assert scoring.confidence([
        {"src": "web", "checked": "2026-01-01", "polarity": "+"},
        {"src": "user", "checked": "2026-08-01", "polarity": "+"},
    ]) == 2


def test_is_chain():
    # 優先順位1: curated の明示指定がすべてに勝つ
    assert scoring.is_chain({"brand": "一蘭", "name": "一蘭 渋谷店"}, {"chain": 0}) == 0
    assert scoring.is_chain({"name": "個人の店"}, {"chain": 1}) == 1
    # curated はあるが chain キーがなければ無視
    assert scoring.is_chain({"name": "個人の店"}, {"note": "メモだけ"}) == 0

    # 優先順位2: brand / brand:wikidata タグ
    assert scoring.is_chain({"name": "無名の店", "brand": "なにか"}) == 1
    assert scoring.is_chain({"name": "無名の店", "brand:wikidata": "Q123"}) == 1

    # 優先順位3: 名称リスト。SOLO_BRANDS は CHAIN_BRANDS に含まれる
    assert scoring.is_chain({"name": "松屋 渋谷店"}) == 1
    assert scoring.is_chain({"name": "極楽湯 多摩センター店"}) == 1
    assert scoring.is_chain({"name": "快活CLUB 池袋店"}) == 1
    assert scoring.is_chain({"name": "スーパーホテル大阪"}) == 1

    # 優先順位4: 非該当
    assert scoring.is_chain({"name": "はやしや"}) == 0
    assert scoring.is_chain({}) == 0

    # SOLO_BRANDS ⊂ CHAIN_BRANDS であること
    for b in scoring.SOLO_BRANDS:
        assert b in scoring.CHAIN_BRANDS, f"{b} が CHAIN_BRANDS にない"


# 穴場出力の目視監査で追加した14件。CHAIN_BRANDS は _CHAIN_RE の部分一致
# （search）で判定されるため、ここが最も誤爆・見落としの起きやすい面。
# 支店名サフィックス付きの表記は「◯◯ △△店」がそのまま別名扱いされる
# chains.py（完全一致）では拾えず、このリストでしか防げない。
_NEW_CHAIN_BRANCH_SUFFIXED = {
    "来来亭": "来来亭 青梅店",
    "AFURI": "AFURI 中目黒本店",
    "蒙古タンメン中本": "蒙古タンメン中本 池袋本店",
    "ラーメン豚山": "ラーメン豚山 新宿店",
    "東京油組総本店": "東京油組総本店 新宿店",
    "新福菜館": "新福菜館 京都駅前店",
    "彩華ラーメン": "彩華ラーメン 本店",
    "ラーメンショップ": "ラーメンショップ 前橋店",
    "ラーメン山岡家": "ラーメン山岡家 千葉店",
    "優勝軒": "優勝軒 上尾店",
    "ジャンカラ": "ジャンカラ道頓堀店",
    "カラオケBanBan": "カラオケBanBan 高松店",
    "カラオケマック": "カラオケマック 札幌店",
    "109シネマズ": "109シネマズ川崎",
}


def test_new_chain_brands_bare_and_branch_suffixed():
    assert set(_NEW_CHAIN_BRANCH_SUFFIXED) == {
        "来来亭", "AFURI", "蒙古タンメン中本", "ラーメン豚山", "東京油組総本店",
        "新福菜館", "彩華ラーメン", "ラーメンショップ", "ラーメン山岡家", "優勝軒",
        "ジャンカラ", "カラオケBanBan", "カラオケマック", "109シネマズ",
    }, "監査で追加された14件と一致していない"

    for bare, suffixed in _NEW_CHAIN_BRANCH_SUFFIXED.items():
        assert scoring.is_chain({"name": bare}) == 1, f"{bare} が素の屋号でchain判定されない"
        assert scoring.is_chain({"name": suffixed}) == 1, f"{suffixed} が支店名付きでchain判定されない"

    # 誤検出ガード。どちらも「自動生成アプローチ」検討時に実際に誤爆した
    # 独立店名で、部分一致リストの副作用がここに出ないことを固定する。
    assert scoring.is_chain({"name": "そば処 おかあやん"}) == 0
    assert scoring.is_chain({"name": "ラーメンたかはし"}) == 0



def test_brand_beats_wrong_cuisine():
    """店名が分かっているチェーンは cuisine より優先する。

    OSMでは牛丼チェーンに cuisine=japanese しか付いていないことが多く、
    すき家に cuisine=curry だけが付いて「カレー」に分類された実例がある。
    """
    assert scoring.classify({"amenity": "fast_food", "name": "すき家 高松店",
                             "cuisine": "curry"}) == ("eat", "gyudon", 4)
    assert scoring.classify({"amenity": "fast_food", "name": "吉野家 1号店",
                             "cuisine": "japanese"}) == ("eat", "gyudon", 4)
    assert scoring.classify({"amenity": "fast_food", "name": "松屋 三条店",
                             "cuisine": ""}) == ("eat", "gyudon", 4)


def test_brand_match_is_prefix_only():
    """前方一致だけ。含んでいるだけの独立店を巻き込まない。"""
    assert scoring.brand_kind("すき家 高松店") == "gyudon"
    assert scoring.brand_kind("元祖すき家風どんぶり") is None
    assert scoring.brand_kind("そば処 おかあやん") is None
    assert scoring.brand_kind("") is None
    assert scoring.brand_kind(None) is None


def test_unlisted_fast_food_is_excluded():
    """ブランド表に無い fast_food は収録しない。

    ハンバーガーチェーンまで入れると「一人が標準」という前提が薄まる。
    """
    assert scoring.classify({"amenity": "fast_food", "name": "マクドナルド",
                             "cuisine": "burger"}) is None
    assert scoring.classify({"amenity": "fast_food", "name": "名もなき店",
                             "cuisine": ""}) is None


def test_cuisine_still_works_without_brand():
    """ブランドに無くても cuisine が正しければ従来どおり拾う。"""
    assert scoring.classify({"amenity": "restaurant", "name": "町の中華そば",
                             "cuisine": "ramen"}) == ("eat", "ramen", 4)


def test_ambiguous_noodle_cuisine_is_resolved_by_name():
    """cuisine=noodle は「麺類」全般を指す曖昧タグで、そば・うどん確定タグ
    （soba/udon）と同列に扱うと誤る。実データで826件、店名にラーメン系の
    語を持つ店が「そば・うどん」に分類されていた
    （川崎駅そばの「家系らーめん横崎家」「喜多方ラーメン」など）。
    """
    ramen_named = ("家系らーめん横崎家", "喜多方ラーメン", "らーめん山岡家",
                   "中華そば大勝軒", "横浜家系ラーメン いなせ家", "支那そば や",
                   "旭川らーめん 鷹の爪")
    for name in ramen_named:
        got = scoring.classify({"amenity": "fast_food", "name": name, "cuisine": "noodle"})
        assert got == ("eat", "ramen", 4), (name, got)

    # 表記ゆれ側（部分一致救済経路）でも同じ結果になること
    got = scoring.classify({"amenity": "fast_food", "name": "家系ラーメン",
                            "cuisine": "asian_noodle_shop"})
    assert got == ("eat", "ramen", 4), got


def test_ambiguous_noodle_cuisine_falls_back_when_name_is_unclear():
    """店名からラーメンと判断できないときは、これまでどおりそば・うどんへ
    倒す。無理に決めつけない。"""
    got = scoring.classify({"amenity": "fast_food", "name": "えきめんや", "cuisine": "noodle"})
    assert got == ("eat", "soba_udon", 4), got


def test_confirmed_soba_udon_tags_are_unaffected_by_the_noodle_fix():
    """soba / udon は元々の確定タグ。noodle の曖昧さと混ぜていないこと。"""
    assert scoring.classify({"amenity": "fast_food", "name": "ラーメン二郎",
                             "cuisine": "soba"}) == ("eat", "soba_udon", 4)
    assert scoring.classify({"amenity": "restaurant", "name": "○○",
                             "cuisine": "udon"}) == ("eat", "soba_udon", 4)


def main():
    test_classify()
    test_axes()
    test_axes_table_covers_all_kinds()
    test_kind_guide_covers_every_kind()
    test_kind_gaze_covers_every_kind()
    test_kind_gaze_is_not_the_same_text_as_the_guide()
    test_footbath_is_not_a_sento()
    test_footbath_rule_does_not_swallow_real_baths()
    test_footbath_axes_say_it_is_easy()
    test_kind_guide_test_would_catch_a_missing_kind()
    test_ambiguous_noodle_cuisine_is_resolved_by_name()
    test_ambiguous_noodle_cuisine_falls_back_when_name_is_unclear()
    test_confirmed_soba_udon_tags_are_unaffected_by_the_noodle_fix()
    test_confidence()
    test_is_chain()
    test_new_chain_brands_bare_and_branch_suffixed()
    test_brand_beats_wrong_cuisine()
    test_brand_match_is_prefix_only()
    test_unlisted_fast_food_is_excluded()
    test_cuisine_still_works_without_brand()
    print("OK: scoring")


if __name__ == "__main__":
    main()
