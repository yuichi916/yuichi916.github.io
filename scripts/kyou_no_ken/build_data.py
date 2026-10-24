"""きょうの県: 一次資料から data/kyou-no-ken/data.json を作る。

数字は _dev/kyou-no-ken/src/ に置いた一次資料のファイルからだけ読む（fetch_sources.py で取る）。
このファイルに書いてあるのは「どの表のどの列を使うか」「見出しをどう短くするか」「出典の調査名」だけで、
統計の値・順位・緯度経度は 1 つも手で書いていない。

使い方:  python scripts/kyou_no_ken/build_data.py
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

import xlrd

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "_dev" / "kyou-no-ken" / "src"
OUT = ROOT / "data" / "kyou-no-ken" / "data.json"

SUGATA = "総務省統計局「統計でみる都道府県のすがた2026」社会生活統計指標"
SUGATA_PAGE = "https://www.e-stat.go.jp/stat-search/files?page=1&toukei=00200502&tstat=000001240736"
ESTAT_DL = "https://www.e-stat.go.jp/stat-search/file-download?statInfId={}&fileKind=0"
FILE_OF = {  # 分野の頭文字 → statInfId
    "A": "000040412522", "B": "000040412523", "C": "000040412524", "F": "000040412527",
    "G": "000040412528", "H": "000040412529",
}
FIELD_NAME = {"A": "A 人口・世帯", "B": "B 自然環境", "C": "C 経済基盤", "F": "F 労働",
              "G": "G 文化・スポーツ", "H": "H 居住"}
WEATHER_NOTE = "県庁所在地の気象台の観測値（埼玉県は熊谷市、東京都は千代田区、滋賀県は彦根市）"

# tier: 1=当てにくい（最初に出す） 2=中くらい 3=当てやすい（最後のほう）
# label は画面に出す短い名前。official は表の指標名そのまま（照合に使う）。
# survey は「利用者のために」の「データの出典」に載っている基礎データの資料源。
INDICATORS = [
    # ---- tier 1
    dict(id="A06102", tier=1, label="1世帯あたりの人数", official="一般世帯の平均人員", unit="人",
         survey="国勢調査（総務省統計局）"),
    dict(id="B02401", tier=1, label="年間の日照時間", official="日照時間（年間）", unit="時間",
         survey="過去の気象データ（気象庁）", note=WEATHER_NOTE),
    dict(id="H01301", tier=1, label="持ち家の割合", official="持ち家比率（対居住世帯あり住宅数）", unit="%",
         survey="住宅・土地統計調査（総務省統計局）"),
    dict(id="H01405", tier=1, label="空き家の割合", official="空き家比率（対総住宅数）", unit="%",
         survey="住宅・土地統計調査（総務省統計局）"),
    dict(id="H04102", tier=1, label="民営賃貸住宅の家賃（3.3㎡・1か月）", official="民営賃貸住宅の家賃（１か月3.3㎡当たり）",
         unit="円", survey="小売物価統計調査（動向編）（総務省統計局）", note="県庁所在市の値"),
    dict(id="H06130", tier=1, label="飲食店の数（人口千人あたり）", official="飲食店数（人口千人当たり）", unit="店",
         survey="経済センサス-活動調査（総務省統計局・経済産業省）"),
    dict(id="H06121", tier=1, label="公衆浴場の数（人口10万人あたり）", official="公衆浴場数（人口10万人当たり）",
         unit="施設", survey="衛生行政報告例（厚生労働省）"),
    dict(id="F01503", tier=1, label="共働き世帯の割合", official="共働き世帯割合（対一般世帯数）", unit="%",
         survey="国勢調査（総務省統計局）"),
    dict(id="G01104", tier=1, label="図書館の数（人口100万人あたり）", official="図書館数（人口100万人当たり）",
         unit="館", survey="社会教育調査（文部科学省）"),
    dict(id="A05203", tier=1, label="合計特殊出生率", official="合計特殊出生率", unit="",
         survey="人口動態調査（厚生労働省）"),
    # ---- tier 2
    dict(id="A03503", tier=2, label="65歳以上の人の割合", official="65歳以上人口割合（対総人口）", unit="%",
         survey="人口推計（総務省統計局）"),
    dict(id="B01202", tier=2, label="森林の割合", official="森林面積割合(北方地域及び竹島を除く)（対総面積）", unit="%",
         survey="農林業センサス（農林水産省）"),
    dict(id="B02101", tier=2, label="年平均気温", official="年平均気温", unit="℃",
         survey="過去の気象データ（気象庁）", note=WEATHER_NOTE),
    dict(id="B02402", tier=2, label="年間の降水量", official="降水量（年間）", unit="mm",
         survey="過去の気象データ（気象庁）", note=WEATHER_NOTE),
    dict(id="F01201", tier=2, label="第1次産業で働く人の割合", official="第１次産業就業者比率（対就業者）", unit="%",
         survey="国勢調査（総務省統計局）"),
    dict(id="C01321", tier=2, label="1人あたり県民所得", official="１人当たり県民所得（平成27年基準）", unit="千円",
         survey="県民経済計算（内閣府）"),
    dict(id="A01302", tier=2, label="昼夜間人口比率", official="昼夜間人口比率", unit="%",
         survey="国勢調査（総務省統計局）", note="昼の人口÷夜の人口×100。100より大きいと、通勤・通学で昼に人が集まる"),
    # ---- tier 3
    dict(id="A011000", tier=3, label="総人口", official="総人口", unit="万人",
         survey="人口推計（総務省統計局）"),
    dict(id="B011001", tier=3, label="面積", official="総面積(北方地域及び竹島を含む)", unit="km²", scale=100,
         survey="全国都道府県市区町村別面積調（国土地理院）", note="表の単位は100km²。北方地域・竹島を含む"),
    dict(id="A01201", tier=3, label="人口密度（1km²あたり）", official="総面積１k㎡当たり人口密度", unit="人",
         survey="人口推計（総務省統計局）・全国都道府県市区町村別面積調（国土地理院）"),
]

# 都道府県のよみ（検索用）。値ではなく名前の読み。
KANA = ["ほっかいどう", "あおもり", "いわて", "みやぎ", "あきた", "やまがた", "ふくしま", "いばらき", "とちぎ",
        "ぐんま", "さいたま", "ちば", "とうきょう", "かながわ", "にいがた", "とやま", "いしかわ", "ふくい",
        "やまなし", "ながの", "ぎふ", "しずおか", "あいち", "みえ", "しが", "きょうと", "おおさか", "ひょうご",
        "なら", "わかやま", "とっとり", "しまね", "おかやま", "ひろしま", "やまぐち", "とくしま", "かがわ",
        "えひめ", "こうち", "ふくおか", "さが", "ながさき", "くまもと", "おおいた", "みやざき", "かごしま",
        "おきなわ"]


def norm(s: str) -> str:
    return re.sub(r"\s+", "", str(s)).replace("(", "（").replace(")", "）")


def decimals_of(fmt: str) -> int:
    m = re.search(r"0\.(0+)", fmt)
    return len(m.group(1)) if m else 0


def read_indicator(spec: dict) -> dict:
    # 指標コードの頭文字と、載っているファイルの分野は一致しないことがある（共働き世帯割合 F01503 は A 表）
    for field, sid in FILE_OF.items():
        book = xlrd.open_workbook(str(SRC / f"sugata2026_{sid}.xls"), formatting_info=True)
        sh = book.sheets()[0]
        hits = [c for c in range(sh.ncols) if str(sh.cell_value(8, c)).strip().lstrip("#") == spec["id"]]
        if hits:
            c = hits[0]
            break
    else:
        raise SystemExit(f"{spec['id']} が表にない")
    name = norm(sh.cell_value(6, c))
    assert norm(spec["official"]) in name or name in norm(spec["official"]), (spec["id"], name, spec["official"])
    assert str(sh.cell_value(11, c + 1)).startswith("順位"), spec["id"]
    year = int(float(sh.cell_value(10, c)))
    unit_raw = str(sh.cell_value(9, c)).strip()
    prefs, vals, ranks, decs = [], [], [], set()
    for r in range(13, 60):  # 12 行目は全国、13〜59 行目が 01 北海道〜47 沖縄県
        code = str(sh.cell_value(r, 7)).strip()
        prefs.append((code, str(sh.cell_value(r, 8)).strip(), str(sh.cell_value(r, 9)).strip()))
        v = sh.cell_value(r, c)
        assert isinstance(v, float), (spec["id"], r, v)
        fmt = book.format_map[book.xf_list[sh.cell_xf_index(r, c)].format_key].format_str
        decs.add(decimals_of(fmt))
        vals.append(v)
        ranks.append(int(sh.cell_value(r, c + 1)))
    dec = max(decs)
    scale = spec.get("scale", 1)
    out = {
        "id": spec["id"], "tier": spec["tier"], "label": spec["label"], "official": name,
        "unit": spec["unit"], "unitInTable": unit_raw, "year": year,
        # 表の書式の小数桁。ただし 47 県すべてが整数の値（降水量など）は「1,437.0」と出さず整数で出す
        "decimals": 0 if all(abs(v * scale - round(v * scale)) < 1e-9 for v in vals) else max(0, dec - (2 if scale == 100 else 0)),
        "values": [round(v * scale, 6) for v in vals],
        # 順位は表に載っている順位をそのまま使う。表の順位は四捨五入前の値で付いているので、
        # 表示上同じ値でも順位が分かれることがある（selftest.py で、値の大小と矛盾しないことを確かめる）
        "ranks": ranks,
        "survey": spec["survey"],
        "table": f"{SUGATA} {FIELD_NAME[field]}",
        "url": ESTAT_DL.format(sid),
        "page": SUGATA_PAGE,
    }
    if spec.get("note"):
        out["note"] = spec["note"]
    return out, prefs


def rank_desc(values: list[float]) -> list[int]:
    """大きい順の順位。同じ値は同じ順位（1,2,2,4 型）。"""
    return [1 + sum(1 for w in values if w > v + 1e-9) for v in values]


def dms(s: str) -> float:
    m = re.match(r"(\d+)°(\d+)′(\d+)″", s)
    d, mi, se = (int(x) for x in m.groups())
    return d + mi / 60 + se / 3600


def read_gsi() -> list[dict]:
    t = (SRC / "gsi_zenken.html").read_bytes().decode("utf-8", "replace")
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", t, flags=re.S)
    txt = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t)))
    pat = re.compile(r"(\S+?)(?:庁) 東 端 西 端 南 端 北 端 経 度 (\S+) \S+ \S+ \S+ \S+ 緯 度 (\S+) ")
    out = []
    for m in pat.finditer(txt):
        out.append({"office": m.group(1) + "庁", "lon": dms(m.group(2)), "lat": dms(m.group(3)),
                    "lonDMS": m.group(2), "latDMS": m.group(3)})
    return out


def read_regions() -> dict[str, str]:
    t = (SRC / "stat_joukyou_yougo.html").read_bytes().decode("shift_jis", "replace")
    txt = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t)))
    seg = txt[txt.index("地域区分"):txt.index("都市階級")]
    out = {"北海道": "北海道"}
    for m in re.finditer(r"(\S+?)（([^）]+)）", seg):
        region = m.group(1).replace("地方", "").strip()
        for p in re.split(r"[、，,]", m.group(2)):
            out[p.strip()] = region
    return out


def main() -> None:
    indicators, pref_rows = [], None
    for spec in INDICATORS:
        ind, prefs = read_indicator(spec)
        if pref_rows is None:
            pref_rows = prefs
        assert prefs == pref_rows, spec["id"]
        indicators.append(ind)

    gsi = read_gsi()
    assert len(gsi) == 47, len(gsi)
    regions = read_regions()

    prefs = []
    for i, (code, name, en) in enumerate(pref_rows):
        # 国土地理院のページは県コード順ではない（山梨・長野が新潟の前）ので、庁舎名で突き合わせる
        hit = [g for g in gsi if g["office"] == name + "庁"]
        assert len(hit) == 1, (name, [g["office"] for g in gsi])
        g = hit[0]
        short = name if name == "北海道" else name[:-1]
        prefs.append({
            "code": code, "name": name, "short": short, "en": en.replace("-ken", "").replace("-to", "").replace("-fu", ""),
            "kana": KANA[i], "region": regions[name],
            "lat": round(g["lat"], 6), "lon": round(g["lon"], 6), "latDMS": g["latDMS"], "lonDMS": g["lonDMS"],
            "office": g["office"],
        })

    data = {
        "version": 1,
        "title": "きょうの県",
        "sources": {
            "stats": {"name": SUGATA, "page": SUGATA_PAGE,
                      "citation": "出典 総務省統計局「統計でみる都道府県のすがた2026」"},
            "coords": {"name": "国土地理院「都道府県の庁舎及び東西南北端点の経緯度（世界測地系）」",
                       "url": "https://web.archive.org/web/20151016142035/http://www.gsi.go.jp/KOKUJYOHO/CENTER/zenken.htm",
                       "note": "国土地理院のページ（2015年10月時点の保存版）。庁舎の位置を秒単位で記載"},
            "distanceCheck": {"name": "国土地理院「都道府県庁間の距離」（GRS80 楕円体の測地線長）",
                              "url": "https://web.archive.org/web/20160509062429/http://www.gsi.go.jp/common/000137532.pdf"},
            "regions": {"name": "総務省統計局「家計消費状況調査 用語の説明」地域区分（地方）",
                        "url": "https://www.stat.go.jp/data/joukyou/yougo-i.html"},
        },
        "prefs": prefs,
        "indicators": indicators,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}  {OUT.stat().st_size:,} bytes  prefs={len(prefs)} indicators={len(indicators)}")
    mism = [(d["id"], sum(a != b for a, b in zip(rank_desc(d["values"]), d["ranks"]))) for d in indicators]
    print("表示の値から計算した順位と表の順位が違う数（同じ値の並びの中だけのはず。selftest で検査）:",
          [m for m in mism if m[1]] or "なし")


if __name__ == "__main__":
    main()
