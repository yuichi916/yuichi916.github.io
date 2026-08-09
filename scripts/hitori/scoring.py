# -*- coding: utf-8 -*-
"""ひとり歓迎マップのスコアリング。純関数のみ。I/O も副作用も持たない。

OSM には「黙浴」「カウンター席」というタグが存在しないため、
「業態としてひとりが標準かどうか」を代理指標にしている。これは推定であり、
画面上でもそう明示する。詳細は spec §5 を参照。
"""
import re

# ひとり歓迎チェーン。一致すると score に +1。実測で飲食7,849件が該当する。
SOLO_BRANDS = [
    "一蘭", "焼肉ライク", "いきなりステーキ", "てんや", "富士そば",
    "日高屋", "大戸屋", "やよい軒", "CoCo壱番屋", "ゆで太郎",
    "松屋", "吉野家", "すき家", "なか卯", "丸亀製麺",
    "はなまるうどん", "かつや", "餃子の王将", "リンガーハット", "天下一品",
]

_SOLO_RE = re.compile("|".join(re.escape(b) for b in SOLO_BRANDS))

# チェーン判定用。SOLO_BRANDS を包含する上位集合。
# 「チェーンを隠す」フィルタのためだけに使い、スコアには影響しない。
CHAIN_BRANDS = SOLO_BRANDS + [
    # 飲食
    "幸楽苑", "一風堂", "丸源ラーメン", "山田うどん", "小諸そば",
    "ばんどう太郎", "王将", "らあめん花月嵐", "スシロー", "はま寿司",
    # 湯
    "極楽湯", "万葉倶楽部", "おふろの王様", "湯けむりの里", "スパリゾート",
    "竜泉寺の湯", "野天風呂", "コナミスポーツ",
    # 娯楽
    "ビッグエコー", "カラオケ館", "まねきねこ", "ジョイサウンド", "シダックス",
    "快活CLUB", "自遊空間", "アプレシオ", "マンボー", "イオンシネマ",
    "TOHOシネマズ", "ユナイテッド・シネマ", "MOVIX",
    # 滞在
    "東横INN", "東横イン", "スーパーホテル", "ドーミーイン", "APAホテル",
    "アパホテル", "ルートイン", "コンフォートホテル",

    # 穴場（hidden gem）出力の目視監査で見つかった漏れ。3県以上で完全一致する
    # 店名を自動でチェーン昇格する chains.py は「◯◯ △△店」のような支店名
    # サフィックスを別名として扱ってしまうため拾えない。ここは _CHAIN_RE が
    # 部分一致（search）なので、素の屋号だけ足せば支店名付きの表記も自動的に
    # マッチする。
    # 飲食（追加）
    "来来亭", "AFURI", "蒙古タンメン中本", "ラーメン豚山", "東京油組総本店",
    "新福菜館", "彩華ラーメン", "ラーメンショップ", "ラーメン山岡家", "優勝軒",
    # 娯楽（追加）
    "ジャンカラ", "カラオケBanBan", "カラオケマック", "109シネマズ",
]

_CHAIN_RE = re.compile("|".join(re.escape(b) for b in CHAIN_BRANDS))
_STANDING = re.compile(r"立ち食い|立ち飲み|立喰|立呑|角打ち")
_YAKINIKU_SOLO = re.compile(r"焼肉ライク|一人焼肉|ひとり焼肉|ひとり焼き肉")
_EAT_AMENITY = {"restaurant", "fast_food"}

# cuisine は ";" 区切りが標準だが実データは "," や空白も混ざる。
_CUISINE_SEP = re.compile(r"[;,/\s]+")

# 部分文字列で判定すると "gyudon" が "udon" を含むため牛丼がそば屋になる。
# トークン単位で照合し、取りこぼしたときだけ安全な順序の部分一致に落とす。
_RAMEN = {"ramen"}
_SOBA_UDON = {"soba", "udon", "noodle", "noodles"}
_GYUDON = {"gyudon", "donburi", "katsudon", "oyakodon"}
_CURRY = {"curry"}

# cuisine タグが当てにならないチェーン。OSMでは cuisine=japanese としか
# 付いていないことが多く、cuisine 条件だけでは丸ごと取りこぼす。
# 店名の前方一致で業態を決める。ここに無い fast_food は収録しない
# （ハンバーガーチェーン等まで入れると、一人が標準という前提が薄まる）。
#
# 店名一致は cuisine タグより優先する。OSM の cuisine は誤りが混ざる
# （n10199509617 は「松のや」なのに cuisine=burger）。名前が確かなら
# そちらを採る。逆に、ここに無い名前は cuisine=burger のまま落ちる。
#
# 松のや はとんかつ・かつ丼のチェーン。gyudon は「牛丼・丼」の意味で
# 使っており、_GYUDON に katsudon を含めてあるのと同じ扱いにしている。
_BRAND_KIND = [
    ("gyudon", ("すき家", "吉野家", "松屋", "なか卯", "松のや", "東京チカラめし",
                "神戸らんぷ亭", "伝説のすた丼屋")),
    ("curry", ("CoCo壱番屋", "ココイチ", "ゴーゴーカレー", "日乃屋カレー",
               "カレーハウスCoCo壱番屋", "松屋カレー")),
    ("soba_udon", ("富士そば", "名代富士そば", "ゆで太郎", "小諸そば", "箱根そば",
                   "いろり庵きらく", "しぶそば", "そば処 吉野家", "はなまるうどん",
                   "丸亀製麺", "資さんうどん", "山田うどん")),
    ("ramen", ("日高屋", "らあめん花月嵐", "町田商店", "らーめん山岡家",
               "幸楽苑", "天下一品", "来来亭")),
]


# ブランド名の直後に来てよい文字。ここで切らないと「松屋製麺所」（ラーメン）や
# 「松屋うどん」が牛丼になる。実際にその回帰を出した。
# 取りこぼす側（「すき家高松店」のように区切りが無い表記）に倒す。
# 誤って業態を書き換えるより、拾えないほうがましである。
_BRAND_TAIL = " 　・･（）()[]〔〕-–—/／、,"


def brand_kind(name):
    """店名から業態を決める。cuisine が当てにならないチェーン向け。

    完全一致か、ブランド名の直後が区切り文字のときだけ採る。単純な
    前方一致にすると「松屋製麺所」のような無関係な独立店を巻き込む
    （chains.py と brands.py が前置き一致を却下したのと同じ理由）。
    """
    n = (name or "").strip()
    if not n:
        return None
    for kind, brands in _BRAND_KIND:
        for b in brands:
            if n == b:
                return kind
            if n.startswith(b):
                tail = n[len(b):]
                if tail[0] in _BRAND_TAIL or tail[0].isdigit():
                    return kind
    return None


def _cuisine_tokens(cuisine):
    return {t for t in _CUISINE_SEP.split((cuisine or "").lower()) if t}


def _classify_cuisine(cuisine):
    """cuisine 文字列 → (kind, base) または None。"""
    toks = _cuisine_tokens(cuisine)
    if toks & _RAMEN:
        return ("ramen", 4)
    if toks & _SOBA_UDON:
        return ("soba_udon", 4)
    if toks & _GYUDON:
        return ("gyudon", 4)
    if toks & _CURRY:
        return ("curry", 4)

    # トークンに割れない表記ゆれ("ramen_shop" 等)の救済。
    # Overpass 側は部分一致で取得しているので、ここで落とすと取得済みの行を捨ててしまう。
    c = (cuisine or "").lower()
    if "ramen" in c:
        return ("ramen", 4)
    if any(k in c for k in _GYUDON):      # udon より先に見る（部分一致の順序が効く）
        return ("gyudon", 4)
    if any(k in c for k in _SOBA_UDON):
        return ("soba_udon", 4)
    if "curry" in c:
        return ("curry", 4)
    return None


def classify(tags):
    """OSMタグ辞書 → (cat, kind, base) または None（収録対象外）。

    複数条件に該当する場合は先に書いた行が勝つ（spec §5 の表の順序）。
    eat 判定が外れても bath/play/stay の判定へ落ちるよう、途中で None を返さない。
    """
    amenity = tags.get("amenity", "")
    name = tags.get("name", "")
    cuisine = tags.get("cuisine", "")

    if amenity in _EAT_AMENITY:
        if _STANDING.search(name):
            return ("eat", "standing", 5)
        if _YAKINIKU_SOLO.search(name):
            return ("eat", "yakiniku_solo", 5)
        # 店名が分かっているチェーンは cuisine より優先する。すき家に
        # cuisine=curry だけが付いていて「カレー」に分類された実例がある。
        bk = brand_kind(name)
        if bk:
            return ("eat", bk, 4)
        hit = _classify_cuisine(cuisine)
        if hit:
            return ("eat",) + hit

    if tags.get("leisure") == "sauna":
        return ("bath", "sauna", 5)
    if amenity == "public_bath":
        if tags.get("bath:type") == "onsen":
            return ("bath", "onsen", 3)
        return ("bath", "sento", 4)

    if amenity == "internet_cafe":
        return ("play", "netcafe", 5)
    if amenity == "karaoke_box":
        return ("play", "karaoke", 4)
    if amenity == "cinema":
        return ("play", "cinema", 3)

    if amenity == "library":
        return ("stay", "library", 4)
    if tags.get("tourism") == "hostel":
        return ("stay", "hostel", 3)
    if tags.get("tourism") == "museum":
        return ("stay", "museum", 3)

    return None


def _decisive_polarity(evidence):
    """賛否が混在する場合は確認日が新しいほうが勝つ。同日なら否定を優先（保守的）。"""
    if not evidence:
        return None
    pols = {e.get("polarity", "+") for e in evidence}
    if len(pols) == 1:
        return pols.pop()
    newest = max(e.get("checked", "") for e in evidence)
    same_day = {e.get("polarity", "+") for e in evidence if e.get("checked", "") == newest}
    return "-" if "-" in same_day else "+"


# 業態 → (solo, quiet, easy)。spec §5 の表。
#   solo  5=一人が標準 / 4=一人が多数 / 3=一人でも浮かない
#   quiet 5=会話が発生しない / 4=静か寄り / 2=声を出す場
#   easy  5=作法不要 / 4=ほぼ不要 / 3=軽い作法 / 2=常連文化
# 日本では業態が静けさと作法をかなり正確に予測する。図書館は静かで作法不要、
# 立ち飲みは声を出す場で常連文化がある、一蘭は静かだが食券と記入用紙の作法がある。
AXES = {
    "standing":      (5, 2, 2),
    "yakiniku_solo": (5, 4, 4),
    "netcafe":       (5, 5, 5),
    "sauna":         (5, 5, 3),
    "ramen":         (4, 4, 3),
    "gyudon":        (4, 4, 4),
    "soba_udon":     (4, 4, 3),
    "curry":         (4, 4, 4),
    "sento":         (4, 4, 3),
    "onsen":         (3, 4, 3),
    "karaoke":       (4, 2, 4),
    "library":       (4, 5, 5),
    "cinema":        (3, 5, 5),
    "museum":        (3, 5, 5),
    "hostel":        (3, 3, 3),
    # capsule は classify() が一切返さない手動限定の種別。OSMに全国1件しかタグ付けが
    # 無いため、curated.json の "c-" エントリでのみ登場する（spec §5.1参照）。
    # easy は sento(3) を基準に据えている。sento の3はかけ湯の作法だけで付く値だが、
    # capsule は初見の作法がそれより明確に多い（下駄箱、フロントでのロッカーキー交換、
    # 館内着への着替え、大浴場、カプセル内通話禁止）ため、sentoより易しくはできない。
    "capsule":       (5, 5, 3),
}


def axes(kind, name, evidence, curated=None):
    """業態 → 3軸スコア。curated で軸ごとに上書きできる。

    チェーン加点とエビデンス加減は solo にだけ効く。
    チェーンかどうかは静けさや作法とは無関係だからである。
    表に無い kind は KeyError を上げる。追加漏れを黙って通さないため。
    """
    solo, quiet, easy = AXES[kind]

    if _SOLO_RE.search(name or ""):
        solo += 1
    pol = _decisive_polarity(evidence)
    if pol == "+":
        solo += 1
    elif pol == "-":
        solo -= 1

    out = {
        "solo": max(1, min(5, solo)),
        "quiet": max(1, min(5, quiet)),
        "easy": max(1, min(5, easy)),
    }
    for k in ("solo", "quiet", "easy"):
        if curated and k in curated:
            out[k] = max(1, min(5, int(curated[k])))
    return out


def confidence(evidence):
    """0=推定 / 1=出典あり / 2=現地確認。複数あれば高いほうを採る。"""
    if not evidence:
        return 0
    srcs = {e.get("src") for e in evidence}
    if srcs & {"user", "visit"}:
        return 2
    return 1


def is_chain(tags, curated=None):
    """0=独立店 / 1=チェーン。判定順は spec §5「チェーン判定」に従う。

    0 は「チェーンだと分からなかった」という不在証明にすぎず、
    リストに載っていない地域チェーンは独立店として残る。
    画面では「個人店だけ」ではなく「チェーンを隠す」と表現すること。
    """
    if curated and "chain" in curated:
        return int(curated["chain"])
    if tags.get("brand") or tags.get("brand:wikidata"):
        return 1
    if _CHAIN_RE.search(tags.get("name", "") or ""):
        return 1
    return 0
