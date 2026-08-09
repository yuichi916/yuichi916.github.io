# -*- coding: utf-8 -*-
"""Overpass API のクエリ生成と実行。

全国一括クエリはタイムアウトするため、必ず県単位で投げる。
これは同時に「各施設がどの県に属するか」を点内包判定なしで確定させる。
"""
import json, time, urllib.request

# 2026-08-02 に実測したところ、この環境から到達できるのは overpass-api.de だけだった。
# kumi.systems は接続不可、overpass.osm.jp は証明書のホスト名不一致で常に失敗する
# （必ず落ちる枠を抱えるとバックオフ時間を捨てるだけなので osm.jp は外した）。
# ミラーは事実上の保険であり、実質は先頭ミラーへのリトライで粘る設計になっている。
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
# Overpass はレート制限をかけてくる。短い間隔で3回叩いても制限窓を越えられないため、
# 回数を増やしつつバックオフを秒単位で長めに取る（5,10,20,40秒）。
ATTEMPTS_PER_MIRROR = 4
BACKOFF_BASE_SEC = 5
BACKOFF_MAX_SEC = 60
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
  // 牛丼・定食チェーンは cuisine=japanese としか付いていないことが多く、
  // cuisine 条件では丸ごと取りこぼす（すき家は全国約1,900店あるのに4件
  // しか取れていなかった）。fast_food を丸ごと取り、業態の判定は
  // scoring.py の店名照合に任せる。brand タグへの正規表現は Overpass が
  // 504 を返すので使えない。
  nwr["amenity"="fast_food"](area.pref);
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
    """ミラーごとに ATTEMPTS_PER_MIRROR 回試す。全滅したら OverpassError を上げる。

    失敗理由はミラーごとに集約する。最後の例外だけを出すと、到達すらできない
    末尾ミラーのエラーが、本命ミラーで何が起きたかを覆い隠してしまう。
    """
    opener = opener or urllib.request.urlopen
    errors = {}
    for mirror in MIRRORS:
        host = mirror.split("/")[2]
        for attempt in range(ATTEMPTS_PER_MIRROR):
            req = urllib.request.Request(
                mirror, data=ql.encode("utf-8"), headers={"User-Agent": UA}
            )
            try:
                with opener(req, timeout=400) as r:
                    return json.load(r)
            except Exception as e:  # noqa: BLE001 - ネットワーク例外は種類を問わず退避
                errors[host] = f"{type(e).__name__}: {e}"
                sleep(min(BACKOFF_MAX_SEC, BACKOFF_BASE_SEC * 2 ** attempt))
    detail = " | ".join(f"{h} -> {m}" for h, m in errors.items())
    raise OverpassError(f"全ミラーで失敗しました: {detail}")
