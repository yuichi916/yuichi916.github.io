# -*- coding: utf-8 -*-
"""OSM要素を施設レコードへ正規化し、重複を除去する。"""
import math

import scoring

_TYPE_PREFIX = {"node": "n", "way": "w", "relation": "r"}
DEDUPE_RADIUS_M = 30.0
COORD_DIGITS = 5  # 約1m精度


def element_id(el):
    return _TYPE_PREFIX[el["type"]] + str(el["id"])


def distance_m(lat1, lon1, lat2, lon2):
    """ハーバサイン距離（メートル）。"""
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _coords(el):
    if "lat" in el and "lon" in el:
        return el["lat"], el["lon"]
    c = el.get("center")
    if c:
        return c["lat"], c["lon"]
    return None, None


def to_record(el, curated):
    """OSM要素 → 施設レコード。収録対象外なら None。"""
    tags = el.get("tags") or {}
    name = (tags.get("name") or "").strip()
    if not name:
        return None

    lat, lon = _coords(el)
    if lat is None:
        return None

    cls = scoring.classify(tags)
    if cls is None:
        return None
    cat, kind, _base = cls

    fid = element_id(el)
    cur = curated.get(fid) or {}
    if cur.get("excluded"):
        return None

    evidence = cur.get("evidence") or []
    ax = scoring.axes(kind, name, evidence, cur)
    # spec §5 の収録条件。否定エビデンスや curated で solo が2以下に落ちた施設は収録しない。
    # v1 ではこの条件が仕様に書かれていながら一度も強制されていなかった。
    if ax["solo"] < 3:
        return None
    return {
        "id": fid,
        "name": name,
        "lat": round(lat, COORD_DIGITS),
        "lon": round(lon, COORD_DIGITS),
        "cat": cat,
        "kind": kind,
        "solo": ax["solo"],
        "quiet": ax["quiet"],
        "easy": ax["easy"],
        "conf": scoring.confidence(evidence),
        "chain": scoring.is_chain(tags, cur),
        "hidden": 0.0,      # compute_hidden が全国計算のあとに上書きする
        "hidden_n": 0,
        "city": (tags.get("addr:city") or "").strip(),
        "oh": (tags.get("opening_hours") or "").strip(),
        "tel": (tags.get("phone") or tags.get("contact:phone") or "").strip(),
        "web": (tags.get("website") or tags.get("contact:website") or "").strip(),
        "note": cur.get("note", ""),
    }


def _rank(rec):
    """統合時にどちらを残すかの優先度。面情報(way/relation)のほうが確度が高い。"""
    return {"r": 2, "w": 1, "n": 0, "c": 3}[rec["id"][0]]


def dedupe(records):
    """同名かつ DEDUPE_RADIUS_M 以内のレコードを1件に統合する。

    node と way の両方でタグ付けされたケースを吸収するのが目的。
    同名でまとめてから距離判定するので、全件総当たりにはならない。
    手動追加(c-)は人が入れたものなので最優先で残す。
    """
    by_name = {}
    for r in records:
        by_name.setdefault(r["name"], []).append(r)

    out = []
    for group in by_name.values():
        kept = []
        for r in group:
            for i, k in enumerate(kept):
                if distance_m(r["lat"], r["lon"], k["lat"], k["lon"]) <= DEDUPE_RADIUS_M:
                    if _rank(r) > _rank(k):
                        kept[i] = r
                    break
            else:
                kept.append(r)
        out.extend(kept)
    return out
