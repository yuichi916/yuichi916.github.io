# -*- coding: utf-8 -*-
"""スコアリングの純関数テスト。spec §5 の判定表がそのまま期待値になっている。"""
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


def test_score():
    # チェーン加点なし・エビデンスなし
    assert scoring.score(4, "はやしや", []) == 4
    # SOLO_BRANDS 一致で +1
    assert scoring.score(4, "一蘭 渋谷店", []) == 5
    # 上限5でクランプ（base5 + ブランド加点）
    assert scoring.score(5, "焼肉ライク 新宿店", []) == 5
    # 肯定エビデンスで +1
    assert scoring.score(3, "○○温泉", [{"src": "web", "checked": "2026-08-01", "polarity": "+"}]) == 4
    # 否定エビデンスで -1
    assert scoring.score(4, "はやしや", [{"src": "user", "checked": "2026-08-01", "polarity": "-"}]) == 3
    # 賛否が混在したら確認日が新しいほうが勝つ
    mixed = [
        {"src": "web", "checked": "2026-01-01", "polarity": "+"},
        {"src": "user", "checked": "2026-08-01", "polarity": "-"},
    ]
    assert scoring.score(4, "はやしや", mixed) == 3
    mixed2 = [
        {"src": "user", "checked": "2026-08-01", "polarity": "+"},
        {"src": "web", "checked": "2026-01-01", "polarity": "-"},
    ]
    assert scoring.score(4, "はやしや", mixed2) == 5
    # 下限1でクランプ
    assert scoring.score(1, "はやしや", [{"src": "user", "checked": "2026-08-01", "polarity": "-"}]) == 1


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


def main():
    test_classify()
    test_score()
    test_confidence()
    test_is_chain()
    print("OK: scoring")


if __name__ == "__main__":
    main()
