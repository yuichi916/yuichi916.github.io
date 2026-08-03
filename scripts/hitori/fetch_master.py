# -*- coding: utf-8 -*-
"""Wikidata SPARQL から47都道府県のコード・名称・人口を取得する。

人口(P1082)はほぼ令和2年国勢調査の値。全国地方公共団体コード(P429)は
6桁のチェックディジット付きなので上2桁を県コードとして使う。
"""
import json, urllib.request, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "hitori" / "prefectures.json"
ENDPOINT = "https://query.wikidata.org/sparql"
UA = "hitori-map/1.0 (https://yuichi916.github.io/hitori.html)"

QUERY = """
SELECT ?pref ?prefLabel ?code ?pop WHERE {
  ?pref wdt:P31 wd:Q50337 ; wdt:P429 ?code ; wdt:P1082 ?pop .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja" }
} ORDER BY xsd:integer(?code)
"""


def fetch():
    url = ENDPOINT + "?" + urllib.parse.urlencode({"query": QUERY, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)["results"]["bindings"]


def main():
    rows = []
    for b in fetch():
        rows.append({
            "code": int(b["code"]["value"][:2]),
            "name": b["prefLabel"]["value"],
            "pop": int(float(b["pop"]["value"])),
        })
    rows.sort(key=lambda r: r["code"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {OUT} ({len(rows)} prefectures, total {sum(r['pop'] for r in rows):,})")


if __name__ == "__main__":
    main()
