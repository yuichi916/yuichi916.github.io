# -*- coding: utf-8 -*-
"""座標がどの都道府県に入るかを、県境ポリゴンで判定する。

県境の施設は Overpass の area クエリが両隣の県に返す。どちらに載せるかを
「県コードが若いほう」のような機械的な規則で決めると、横手山頂ヒュッテ
（長野県山ノ内町）が群馬県の一覧に出るような誤りになる。座標で決める。

出典: 地球地図日本（国土地理院） https://www.gsi.go.jp/kankyochiri/gm_jpn.html
経由: https://github.com/dataofjapan/land (japan.geojson)

ポリゴンは _local に置いた 12MB のキャッシュで、リポジトリには入れていない。
無いときは None を返す。呼び出し側が決め打ちの規則へ落とす。
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "_local" / "hitori_raw" / "japan.geojson"

_INDEX = None   # [(code, bbox, [ring, ...])] / 読み込み失敗なら []


def _rings(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"][0]]
    return [poly[0] for poly in geom["coordinates"]]


def _bbox(rings):
    lons = [c[0] for r in rings for c in r]
    lats = [c[1] for r in rings for c in r]
    return (min(lons), min(lats), max(lons), max(lats))


def _load():
    global _INDEX
    if _INDEX is not None:
        return _INDEX
    if not CACHE.exists():
        _INDEX = []
        return _INDEX
    data = json.loads(CACHE.read_text(encoding="utf-8"))
    idx = []
    for f in data["features"]:
        rings = _rings(f["geometry"])
        if rings:
            idx.append((int(f["properties"]["id"]), _bbox(rings), rings))
    _INDEX = idx
    return _INDEX


def _in_ring(lon, lat, ring):
    """交差数判定。境界そのものの扱いは決めない（県境の精度はそこまで無い）。"""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat):
            x = (xj - xi) * (lat - yi) / (yj - yi) + xi
            if lon < x:
                inside = not inside
        j = i
    return inside


def pref_from_address(text, prefs):
    """住所文字列から県コードを読む。読めなければ None。

    OSM の addr:* はローマ字のことが多い（"…, Nagano 381-0401 Japan"）。
    県名の日本語表記と、接尾辞を落としたローマ字の両方で照合する。
    2県以上が現れたら決めない。**推測しない。**
    """
    if not text:
        return None
    low = text.lower()
    hit = set()
    for p in prefs:
        ja = p["name"]
        if ja in text:
            hit.add(p["code"])
            continue
        # 「長野県」→ nagano、「北海道」→ hokkaido、「東京都」→ tokyo
        romaji = _ROMAJI.get(p["code"])
        if romaji and re.search(rf"\b{romaji}\b", low):
            hit.add(p["code"])
    return hit.pop() if len(hit) == 1 else None


_ROMAJI = {
    1: "hokkaido", 2: "aomori", 3: "iwate", 4: "miyagi", 5: "akita",
    6: "yamagata", 7: "fukushima", 8: "ibaraki", 9: "tochigi", 10: "gunma",
    11: "saitama", 12: "chiba", 13: "tokyo", 14: "kanagawa", 15: "niigata",
    16: "toyama", 17: "ishikawa", 18: "fukui", 19: "yamanashi", 20: "nagano",
    21: "gifu", 22: "shizuoka", 23: "aichi", 24: "mie", 25: "shiga",
    26: "kyoto", 27: "osaka", 28: "hyogo", 29: "nara", 30: "wakayama",
    31: "tottori", 32: "shimane", 33: "okayama", 34: "hiroshima", 35: "yamaguchi",
    36: "tokushima", 37: "kagawa", 38: "ehime", 39: "kochi", 40: "fukuoka",
    41: "saga", 42: "nagasaki", 43: "kumamoto", 44: "oita", 45: "miyazaki",
    46: "kagoshima", 47: "okinawa",
}


def pref_of(lat, lon):
    """(lat, lon) を含む県コードを返す。判定できなければ None。

    ポリゴンが無いとき、どの県にも入らないとき（海上・島の簡略化漏れ）、
    複数の県に入るとき（境界の重なり）はすべて None。**推測しない。**
    """
    hits = []
    for code, (w, s, e, n) in ((c, b) for c, b, _ in _load()):
        if w <= lon <= e and s <= lat <= n:
            hits.append(code)
    if not hits:
        return None
    found = []
    for code, _, rings in _load():
        if code in hits and any(_in_ring(lon, lat, r) for r in rings):
            found.append(code)
    return found[0] if len(found) == 1 else None
