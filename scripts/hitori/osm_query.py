# -*- coding: utf-8 -*-
"""Overpass API のクエリ生成と実行。

全国一括クエリはタイムアウトするため、必ず県単位で投げる。
これは同時に「各施設がどの県に属するか」を点内包判定なしで確定させる。
"""
import json, time, urllib.request

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
]
ATTEMPTS_PER_MIRROR = 3
UA = "hitori-map/1.0 (https://yuichi916.github.io/hitori.html)"

# ひとりが標準の業態のみ。cafe は件数過大かつ「ひとりが標準」と言い切れないため除外。
SOLO_CUISINE = "ramen|noodle|soba|udon|gyudon|curry|donburi"


class OverpassError(RuntimeError):
    pass


def build_query(pref_code):
    """指定県の全カテゴリを1クエリで取る Overpass QL を返す。

    admin_level=4 の area を都道府県名で引くと表記ゆれに弱いため、
    ISO3166-2 コード（JP-01 形式）で指定する。
    """
    iso = f"JP-{pref_code:02d}"
    return f"""[out:json][timeout:300];
area["ISO3166-2"="{iso}"]["admin_level"="4"]->.pref;
(
  nwr["amenity"="public_bath"](area.pref);
  nwr["leisure"="sauna"](area.pref);
  nwr["amenity"~"^(restaurant|fast_food)$"]["cuisine"~"{SOLO_CUISINE}"](area.pref);
  nwr["amenity"="karaoke_box"](area.pref);
  nwr["amenity"="cinema"](area.pref);
  nwr["amenity"="internet_cafe"](area.pref);
  nwr["tourism"="hostel"](area.pref);
  nwr["amenity"="library"](area.pref);
  nwr["tourism"="museum"](area.pref);
);
out center tags;
"""


def run_query(ql, opener=None, sleep=time.sleep):
    """リトライ3回×ミラー3件。全滅したら OverpassError を上げる。"""
    opener = opener or urllib.request.urlopen
    last = None
    for mirror in MIRRORS:
        for attempt in range(ATTEMPTS_PER_MIRROR):
            req = urllib.request.Request(
                mirror, data=ql.encode("utf-8"), headers={"User-Agent": UA}
            )
            try:
                with opener(req, timeout=400) as r:
                    return json.load(r)
            except Exception as e:  # noqa: BLE001 - ネットワーク例外は種類を問わず退避
                last = e
                sleep(2 ** attempt)
    raise OverpassError(f"全ミラーで失敗しました: {last}")
