# -*- coding: utf-8 -*-
"""駅と市区町村の検索インデックスを生成する。

地理院の地名検索API（msearch.gsi.go.jp）は 2026-08-07 の実測で
「渋谷駅」でも「東京都渋谷区道玄坂」でも空配列を返し、依存先にできなかった。
自前で同梱すれば外部依存もネットワーク往復もなく、日本の利用者が実際に打つ
語（駅名）に直接当たる。

駅・市区町村とも Wikidata の SPARQL から取得する。当初は Overpass
（県単位クエリ）で両方を取る計画だったが、2026-08-07 の実測で:

- 市区町村（admin_level=7/8 の境界クエリ）は全県が安定して
  「Dispatcher_Client::request_read_and_idx::timeout. The server is
  probably too busy to handle your request.」を返した。/api/status では
  スロットが空いており、レート制限ではなくインスタンス側の処理能力不足に
  よる恒常的な失敗だった。代替ミラー（kumi.systems / osm.jp /
  private.coffee）もこのネットワークからは到達不可で迂回できなかった。
- 駅（railway=station のみの軽量クエリ）は個々には成功するが、47県を
  順番に叩く方式は47回のラウンドトリップがボトルネックになり、
  11県で18分・直近9分で2県しか進まないペースだった（2時間超の見込み）。

そこで両方とも Wikidata の1クエリに切り替えた。Wikidata には駅データに
都道府県コードが付与されていないため、`_local/hitori_raw/japan.geojson`
（このプロジェクトが県境データとして既に使っているもの）を使い、
バウンディングボックスで絞り込んでからレイキャスト法（even-odd rule）で
点内包判定する。市区町村は Wikidata の全国地方公共団体コード(P429)の
上2桁がそのまま県コードなので、この判定は不要。
"""
import json, math, re, sys, urllib.parse, urllib.request
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import iso   # 知名度カウントの格子バケットを流用する（下記 _facility_grid 参照）

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "hitori" / "places.json"
GEOJSON = ROOT / "_local" / "hitori_raw" / "japan.geojson"
STATION_CACHE = ROOT / "_local" / "hitori_raw" / "places_stations.json"
MUNI_CACHE = ROOT / "_local" / "hitori_raw" / "places_municipalities.json"
PREF_DATA_DIR = ROOT / "data" / "hitori" / "pref"

WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql"
UA = "hitori-map/1.0 (https://yuichi916.github.io/hitori.html)"

FIELDS = ["name", "lat", "lon", "type", "pref", "n"]
COORD_DIGITS = 5

# 知名度（prominence）の代理指標。「別府」で検索したとき、無名の駅より
# 温泉地として有名な大分県別府市を上に出したい。外部の知名度データは
# 持たないので、自前データセット内でその地点の半径2000m以内に施設が
# どれだけあるかを数え、代理指標として使う。
PROMINENCE_RADIUS_M = 2000.0

# 都道府県の総数。data/hitori/pref/ にこれ未満しか無ければ build_data.py が
# 未実行（または pref/ が空、あるいは places.py を build_data.py より先に
# 走らせた）とみなす。実行順は docs/superpowers/plans/…実行後の運用 参照。
MIN_PREF_FILES = 47


class MissingPrefDataError(RuntimeError):
    """data/hitori/pref/*.json（build_data.py の出力）が揃っていないときに送出する。

    ここが空/不足のまま知名度カウント（_facility_grid）を走らせると、格子が
    空になり全地名の n が黙って0になる。n=0は「知名度シグナルなし」＝旧挙動
    （駅を無条件優先）へ静かに戻ることを意味し、検索結果がおかしくなっても
    ここが原因だと誰も気づけない。黙って劣化したファイルを書くより、
    ここで止めて原因を言う。
    """

# 重複排除で「同一実体」とみなす距離。日本には事業者の異なる別施設が偶然
# 同じ駅名を名乗るケースが多く（高井田駅=JR片町線/近鉄道明寺線で13.4km、
# 御影駅=阪神本線/阪急神戸線で1.1km、いずれも大阪府・兵庫県内の実測）、
# (名前, 種別, 県) だけで1件に潰すと実在する別の駅を失う。0mの完全一致
# （同一実体の重複登録）と、実測最短1.1kmの別施設を分ける値として500mを選ぶ。
DEDUPE_RADIUS_M = 500.0

# 駅: 日本(Q17)にある「鉄道駅(Q55488)またはそのサブクラス」で、廃駅
# (P576あり)を除く。SERVICE wikibase:label で日本語ラベルを引く。
STATION_QUERY = """
SELECT DISTINCT ?s ?sLabel ?coord WHERE {
  ?s wdt:P31/wdt:P279* wd:Q55488 ;
     wdt:P17 wd:Q17 ;
     wdt:P625 ?coord .
  FILTER NOT EXISTS { ?s wdt:P576 ?d }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja" }
}
"""

# 市区町村: 廃止された自治体(P576あり)と都道府県自体(P31=Q50337、同じ
# 6桁コード体系を使う)を除外する。
MUNICIPALITY_QUERY = """
SELECT DISTINCT ?m ?mLabel ?code ?coord WHERE {
  ?m wdt:P429 ?code ; wdt:P625 ?coord .
  FILTER(STRLEN(?code) = 6)
  FILTER NOT EXISTS { ?m wdt:P576 ?d }
  FILTER NOT EXISTS { ?m wdt:P31 wd:Q50337 }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja" }
}
"""

# 座標は WKT の "Point(lon lat)" で返る。順序が経度→緯度であることに注意
# （逆にすると海に落ちる）。
COORD_RE = re.compile(r"Point\(([-\d.]+) ([-\d.]+)\)")
BARE_QID_RE = re.compile(r"^Q\d+$")


def _distance_m(lat1, lon1, lat2, lon2):
    """2点間の距離（メートル）。scripts/hitori/iso.py の実装と同じ形。"""
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _sparql(query, timeout=180):
    url = WIKIDATA_ENDPOINT + "?" + urllib.parse.urlencode({"query": query, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)["results"]["bindings"]


# ---- 県境ポリゴンによる駅の県判定 ----------------------------------------

def _load_prefectures():
    """japan.geojson を読み、県コードごとに (bbox, ポリゴン群) を返す。

    ポリゴン群は MultiPolygon の coordinates 形式（ポリゴンのリスト、各
    ポリゴンは外周とその後ろに0個以上の穴のリング）のまま保持する。
    """
    gj = json.loads(GEOJSON.read_text(encoding="utf-8"))
    prefs = []
    for feat in gj["features"]:
        code = int(feat["properties"]["id"])
        geom = feat["geometry"]
        polygons = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
        xs = [pt[0] for poly in polygons for ring in poly for pt in ring]
        ys = [pt[1] for poly in polygons for ring in poly for pt in ring]
        prefs.append((code, (min(xs), min(ys), max(xs), max(ys)), polygons))
    return prefs


def _point_in_ring(x, y, ring):
    """レイキャスト法。ring は [[lon, lat], ...] の閉じたリング。"""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y):
            x_int = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < x_int:
                inside = not inside
        j = i
    return inside


def _point_in_polygons(x, y, polygons):
    """穴あきポリゴン群に点(x,y)が含まれるか。

    同一ポリゴン内では外周・穴の全リングをXORすることで、穴の中に落ちた
    点を正しく「外」と判定する。
    """
    for rings in polygons:
        inside = False
        for ring in rings:
            if _point_in_ring(x, y, ring):
                inside = not inside
        if inside:
            return True
    return False


def _nearest_pref(x, y, prefs):
    """どの県のポリゴンにも入らなかった点（海岸線の単純化誤差など）に、
    最も近い頂点を持つ県を割り当てる。"""
    best_code, best_d2 = None, None
    for code, _bbox, polygons in prefs:
        for rings in polygons:
            for ring in rings:
                for px, py in ring:
                    d2 = (px - x) ** 2 + (py - y) ** 2
                    if best_d2 is None or d2 < best_d2:
                        best_d2, best_code = d2, code
    return best_code


def assign_prefecture(x, y, prefs):
    """(経度, 緯度) から県コードを判定する。bboxで絞ってから点内包判定し、
    どこにも入らなければ最寄り県にフォールバックする。戻り値は
    (県コード, フォールバックを使ったか)。"""
    for code, (minx, miny, maxx, maxy), polygons in prefs:
        if not (minx <= x <= maxx and miny <= y <= maxy):
            continue
        if _point_in_polygons(x, y, polygons):
            return code, False
    return _nearest_pref(x, y, prefs), True


# ---- 取得 -------------------------------------------------------------

def fetch_stations(prefs):
    """Wikidata から駅の行を取得する。県コードは japan.geojson との
    点内包判定で決める。戻り値は (rows, フォールバック件数)。"""
    rows = []
    fallback = 0
    for b in _sparql(STATION_QUERY):
        name = b["sLabel"]["value"].strip()
        if not name or BARE_QID_RE.match(name):
            continue  # 日本語ラベルが無い項目はスキップ
        m = COORD_RE.match(b["coord"]["value"])
        if not m:
            continue
        lon, lat = float(m.group(1)), float(m.group(2))
        if not (20.0 <= lat <= 46.0 and 122.0 <= lon <= 154.0):
            continue  # 座標が明らかに日本国外の項目はスキップ
        pref, used_fallback = assign_prefecture(lon, lat, prefs)
        if used_fallback:
            fallback += 1
        rows.append([name, round(lat, COORD_DIGITS), round(lon, COORD_DIGITS), "s", pref])
    return rows, fallback


def fetch_municipalities():
    """Wikidata から市区町村の行を取得する。県コードは全国地方公共団体
    コード(P429)の上2桁からそのまま決まる。"""
    by_code = {}
    for b in _sparql(MUNICIPALITY_QUERY):
        code = b["code"]["value"]
        if len(code) != 6 or not code.isdigit():
            continue
        name = b["mLabel"]["value"].strip()
        if not name or BARE_QID_RE.match(name):
            continue  # 日本語ラベルが無い項目はスキップ
        m = COORD_RE.match(b["coord"]["value"])
        if not m:
            continue
        lon, lat = float(m.group(1)), float(m.group(2))
        pref = int(code[:2])
        if not (1 <= pref <= 47):
            continue
        # 同じコードの重複行はここで最初の1件に絞る（最終的な重複排除は dedupe が担う）
        by_code.setdefault(code, [name, round(lat, COORD_DIGITS), round(lon, COORD_DIGITS),
                                   "c", pref])
    return list(by_code.values())


def dedupe(rows):
    """同じ (名前, 種別, 県) かつ DEDUPE_RADIUS_M 以内にある行だけを1件にまとめる。

    同名でも県が違えば別物として残す。同じ県内でも DEDUPE_RADIUS_M より
    離れていれば別物として残す（事業者違いの同名駅を守るため）。

    クラスタリングは完全連結（complete linkage）: 新しい行は、既存クラスタの
    「全員」が閾値以内のときだけそのクラスタに加える。単連結（誰か1人が
    近ければ加える）だと、A-B が400m・B-C が400m・A-C が800mのような
    連鎖で、直接は500m超離れている A と C まで1件に潰れてしまう。
    駅が実在するのに消える方が、重複が1件残るより悪い（前者は誰にも
    気づかれない）ので、判定に迷ったら別物のまま残す側に倒す。
    """
    groups = defaultdict(list)
    for r in rows:
        groups[(r[0], r[3], r[4])].append(r)

    out = []
    for group in groups.values():
        clusters = []
        for r in group:
            for cluster in clusters:
                if all(_distance_m(r[1], r[2], m[1], m[2]) <= DEDUPE_RADIUS_M for m in cluster):
                    cluster.append(r)
                    break
            else:
                clusters.append([r])
        out.extend(cluster[0] for cluster in clusters)
    return sorted(out, key=lambda r: (r[4], r[3], r[0]))


# ---- 知名度（周辺施設数）----------------------------------------------
# 11,000件の地名 × 37,000件の施設を総当たりすると4億回超の距離計算になり
# 実用的でない。iso.py が孤立度計算で使っているのと同じ格子バケット方式
# （セル辺 iso.CELL_DEG 度）を流用し、地名ごとに周辺セルだけを見る。

def _facility_grid(pref_dir):
    """data/hitori/pref/*.json 全県分の施設座標を格子に積む。

    pref_dir が無い、または47県に満たない場合は MissingPrefDataError を
    送出する（黙って空/不完全な格子を返さない。理由は同クラスの docstring）。
    """
    files = sorted(pref_dir.glob("*.json")) if pref_dir.is_dir() else []
    if len(files) < MIN_PREF_FILES:
        raise MissingPrefDataError(
            f"{pref_dir} に県データが {len(files)} 件しかありません（{MIN_PREF_FILES}件必要）。"
            f"先に `python scripts/hitori/build_data.py` を実行してください。")
    grid = defaultdict(list)
    for path in files:
        doc = json.loads(path.read_text(encoding="utf-8"))
        idx = {f: i for i, f in enumerate(doc["fields"])}
        lat_i, lon_i = idx["lat"], idx["lon"]
        for row in doc["items"]:
            lat, lon = row[lat_i], row[lon_i]
            cell = (int(math.floor(lat / iso.CELL_DEG)), int(math.floor(lon / iso.CELL_DEG)))
            grid[cell].append((lat, lon))
    return grid


def _count_nearby(lat, lon, grid, radius_m=PROMINENCE_RADIUS_M):
    """(lat, lon) から radius_m 以内にある施設数を数える。

    iso.MIN_CELL_M（セル1辺の最小メートル数の安全側の見積り）を使い、
    半径を確実にカバーするリング数を決める。動的な打ち切りをする
    iso._nearest_same_cat と違い、こちらは固定半径の件数カウントなので
    リング数は固定でよい。
    """
    cy = int(math.floor(lat / iso.CELL_DEG))
    cx = int(math.floor(lon / iso.CELL_DEG))
    rings = int(math.ceil(radius_m / iso.MIN_CELL_M)) + 1
    n = 0
    for dy in range(-rings, rings + 1):
        for dx in range(-rings, rings + 1):
            for flat, flon in grid.get((cy + dy, cx + dx), ()):
                if iso._distance_m(lat, lon, flat, flon) <= radius_m:
                    n += 1
    return n


def add_prominence(rows, pref_dir):
    """各行 (name, lat, lon, type, pref) に n（半径2000m以内の施設数）を足す。

    穴場度・孤立度は data/hitori/pref/*.json 側（build_data.py）で計算済みの
    値をそのまま使っているのに対し、こちらは地名側の知名度シグナルなので
    別に計算する。孤立度のしきい値のような固定値はここに置かない。
    """
    grid = _facility_grid(pref_dir)
    return [list(r) + [_count_nearby(r[1], r[2], grid)] for r in rows]


def main():
    STATION_CACHE.parent.mkdir(parents=True, exist_ok=True)
    prefs = _load_prefectures()

    if STATION_CACHE.exists():
        cached = json.loads(STATION_CACHE.read_text(encoding="utf-8"))
        station_rows, fallback = cached["rows"], cached["fallback"]
        print(f"skip stations (cached): {len(station_rows)} rows", flush=True)
    else:
        station_rows, fallback = fetch_stations(prefs)
        STATION_CACHE.write_text(
            json.dumps({"rows": station_rows, "fallback": fallback}, ensure_ascii=False),
            encoding="utf-8")
        print(f"ok   stations (wikidata): {len(station_rows)} rows", flush=True)
    print(f"     県境フォールバック: {fallback} 件 "
          f"({fallback / max(len(station_rows), 1) * 100:.2f}%)", flush=True)

    if MUNI_CACHE.exists():
        muni_rows = json.loads(MUNI_CACHE.read_text(encoding="utf-8"))
        print(f"skip municipalities (cached): {len(muni_rows)} rows", flush=True)
    else:
        muni_rows = fetch_municipalities()
        MUNI_CACHE.write_text(json.dumps(muni_rows, ensure_ascii=False), encoding="utf-8")
        print(f"ok   municipalities (wikidata): {len(muni_rows)} rows", flush=True)

    rows = dedupe(station_rows + muni_rows)
    print(f"prominence: {PREF_DATA_DIR} を走査して周辺{PROMINENCE_RADIUS_M:.0f}m施設数を計算しています…", flush=True)
    try:
        rows = add_prominence(rows, PREF_DATA_DIR)
    except MissingPrefDataError as e:
        # 劣化した places.json（n が全件0）を書くくらいなら、ここで止めて
        # 原因を言う。実行順は「実行後の運用」（build_data.py が先）参照。
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "updated": __import__("datetime").date.today().isoformat(),
        "fields": FIELDS,
        "items": rows,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    st = sum(1 for r in rows if r[3] == "s")
    ct = len(rows) - st
    print(f"wrote {OUT} ({OUT.stat().st_size/1024:.0f}KB / 駅 {st:,} / 市区町村 {ct:,})")


if __name__ == "__main__":
    main()
