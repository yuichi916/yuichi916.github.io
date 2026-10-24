"""きょうの県: data/kyou-no-ken/data.json の自己検査。

  - 47 県 × 全指標の欠損ゼロ、値は有限の数
  - 資料で確かめた事実を assert（人口 1 位東京・47 位鳥取、面積 1 位北海道・47 位香川 など）
  - 順位: 表の順位が 1〜47 の競技順位になっていて、値の大小と矛盾しない。
          自前で値から計算した順位と、同じ値が並ぶところ以外で一致する
  - 地方: 47 県すべてに付いていて、出典の区分どおり 9 地方
  - 距離: 国土地理院の庁舎の経緯度から GRS80 測地線長を計算し、
          国土地理院「都道府県庁間の距離」の全 1,081 組と照合（±0.2 km）
          あわせて JS 側の検査用に答えの表を _dev/kyou-no-ken/gsi_distances.json に書き出す

使い方:  python scripts/kyou_no_ken/selftest.py
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "kyou-no-ken" / "data.json"
SRC = ROOT / "_dev" / "kyou-no-ken" / "src"
FIXTURE = ROOT / "_dev" / "kyou-no-ken" / "gsi_distances.json"

fails: list[str] = []


def check(cond: bool, msg: str) -> None:
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        fails.append(msg)


def rank_desc(values):
    return [1 + sum(1 for w in values if w > v + 1e-9) for v in values]


def vincenty(lat1, lon1, lat2, lon2):
    a, f = 6378137.0, 1 / 298.257222101
    b = a * (1 - f)
    L = math.radians(lon2 - lon1)
    U1 = math.atan((1 - f) * math.tan(math.radians(lat1)))
    U2 = math.atan((1 - f) * math.tan(math.radians(lat2)))
    sinU1, cosU1, sinU2, cosU2 = math.sin(U1), math.cos(U1), math.sin(U2), math.cos(U2)
    lam = L
    for _ in range(200):
        sl, cl = math.sin(lam), math.cos(lam)
        ss = math.hypot(cosU2 * sl, cosU1 * sinU2 - sinU1 * cosU2 * cl)
        if ss == 0:
            return 0.0
        cs = sinU1 * sinU2 + cosU1 * cosU2 * cl
        sig = math.atan2(ss, cs)
        sa = cosU1 * cosU2 * sl / ss
        c2a = 1 - sa * sa
        c2m = cs - 2 * sinU1 * sinU2 / c2a if c2a else 0.0
        C = f / 16 * c2a * (4 + f * (4 - 3 * c2a))
        prev = lam
        lam = L + (1 - C) * f * sa * (sig + C * ss * (c2m + C * cs * (-1 + 2 * c2m * c2m)))
        if abs(lam - prev) < 1e-12:
            break
    u2 = c2a * (a * a - b * b) / (b * b)
    A = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)))
    B = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)))
    ds = B * ss * (c2m + B / 4 * (cs * (-1 + 2 * c2m * c2m) - B / 6 * c2m * (-3 + 4 * ss * ss) * (-3 + 4 * c2m * c2m)))
    return b * A * (sig - ds) / 1000


def gsi_distance_table(short_names: list[str]) -> dict[tuple[int, int], float]:
    """国土地理院「都道府県庁間の距離」PDF の下三角表を読む。"""
    import pypdf
    text = "\n".join(p.extract_text() for p in pypdf.PdfReader(str(SRC / "gsi_kenchokan.pdf")).pages)
    rows = {}
    order = []
    for line in text.splitlines():
        line = line.replace("　", "").strip()
        m = re.match(r"^([^\d\s.]+?)\s*((?:\d+\.\d\s*)+)\s*\1?$", line)
        if not m:
            continue
        name = m.group(1)
        nums = [float(x) for x in re.findall(r"\d+\.\d", m.group(2))]
        rows[name] = nums
        order.append(name)
    # 先頭の行（北海道）は数字がないので、2 行目（青森）の 1 つ目の列が北海道
    head = "北海道"
    names = [head] + [n for n in order]
    idx = {}
    for n in names:
        key = n if n in short_names else None
        if key is None:
            raise SystemExit(f"PDF の県名が読めない: {n!r}")
        idx[n] = short_names.index(key)
    table = {}
    for r, n in enumerate(names[1:], start=1):
        nums = rows[n]
        assert len(nums) == r, (n, len(nums), r)
        for c, km in enumerate(nums):
            table[(idx[names[c]], idx[n])] = km
    return table


def main() -> None:
    d = json.loads(DATA.read_text(encoding="utf-8"))
    prefs, inds = d["prefs"], d["indicators"]
    names = [p["name"] for p in prefs]
    short = [p["short"] for p in prefs]
    by_id = {i["id"]: i for i in inds}

    print("[1] 形と欠損")
    check(len(prefs) == 47, "都道府県が 47")
    check([p["code"] for p in prefs] == [f"{i:02d}" for i in range(1, 48)], "県コードが 01〜47 の順")
    check(names[0] == "北海道" and names[12] == "東京都" and names[46] == "沖縄県", "01 北海道・13 東京都・47 沖縄県")
    check(12 <= len(inds) <= 20, f"指標が 12〜20 種類（{len(inds)}）")
    for t in (1, 2, 3):
        check(sum(i["tier"] == t for i in inds) >= {1: 4, 2: 3, 3: 1}[t], f"tier{t} の指標が足りる")
    missing = [(i["id"], k) for i in inds for k in range(47)
               if not isinstance(i["values"][k], (int, float)) or not math.isfinite(i["values"][k])]
    check(len(inds) == len(by_id), "指標 ID の重複なし")
    check(all(len(i["values"]) == 47 and len(i["ranks"]) == 47 for i in inds), "全指標 47 県ぶんの値と順位")
    check(not missing, f"47 県 × {len(inds)} 指標の欠損ゼロ（欠損 {len(missing)}）")
    for i in inds:
        for key in ("label", "unit", "year", "survey", "table", "url"):
            if key not in i or (key != "unit" and not i[key]):
                check(False, f"{i['id']} に {key} がない")
    check(all(i["url"].startswith("https://www.e-stat.go.jp/") for i in inds), "全指標に e-Stat の出典 URL")
    check(all(2019 <= i["year"] <= 2026 for i in inds), "調査年が 2019〜2026")
    check(all(p["region"] for p in prefs), "47 県すべてに地方")
    check(all(24 < p["lat"] < 46 and 127 < p["lon"] < 146 for p in prefs), "庁舎の経緯度が日本の範囲")

    print("[2] 資料で確かめた事実")
    def top(id_, r):
        return [names[k] for k in range(47) if by_id[id_]["ranks"][k] == r]
    check(top("A011000", 1) == ["東京都"], "総人口 1 位は東京都")
    check(top("A011000", 47) == ["鳥取県"], "総人口 47 位は鳥取県")
    check(top("B011001", 1) == ["北海道"], "面積 1 位は北海道")
    check(top("B011001", 47) == ["香川県"], "面積 47 位は香川県")
    check(top("A01201", 1) == ["東京都"], "人口密度 1 位は東京都")
    check(top("A01201", 47) == ["北海道"], "人口密度 47 位は北海道")
    check(top("B02101", 1) == ["沖縄県"], "年平均気温 1 位は沖縄県")
    check(top("A05203", 1) == ["沖縄県"] and top("A05203", 47) == ["東京都"],
          "合計特殊出生率（2023）1 位沖縄県・47 位東京都")
    v = by_id["A011000"]["values"]
    check(v[names.index("東京都")] == 1418, "東京都の総人口 1,418 万人（人口推計 2024 年 10 月 1 日）")
    check(abs(by_id["B011001"]["values"][0] - 83422) < 1, "北海道の面積 83,422 km²（表の 834.22 ×100）")
    check(prefs[0]["latDMS"] == "43°03′51″" and prefs[0]["lonDMS"] == "141°20′49″", "北海道庁 43°03′51″N 141°20′49″E")
    check(prefs[12]["latDMS"] == "35°41′22″" and prefs[12]["lonDMS"] == "139°41′30″", "東京都庁 35°41′22″N 139°41′30″E")

    print("[3] 順位")
    for i in inds:
        r, vals = i["ranks"], i["values"]
        sorted_r = sorted(r)
        comp = all(sorted_r[k] == 1 + sum(1 for x in sorted_r if x < sorted_r[k]) for k in range(47))
        mine = rank_desc(vals)
        contradict = [(names[a], names[b]) for a in range(47) for b in range(47)
                      if vals[a] > vals[b] + 1e-9 and not r[a] < r[b]]
        outside_tie = [names[k] for k in range(47)
                       if not (mine[k] <= r[k] < mine[k] + sum(1 for x in vals if abs(x - vals[k]) < 1e-9))]
        same = sum(a == b for a, b in zip(mine, r))
        ok = comp and min(r) == 1 and max(r) <= 47 and not contradict and not outside_tie
        check(ok, f"{i['id']} {i['label']}: 競技順位・大小と矛盾なし・自前計算と一致 {same}/47"
                  f"（違いは同じ値の並びの中だけ）" + (f" 矛盾 {contradict[:3]} {outside_tie[:3]}" if not ok else ""))
    # 順位の計算そのものの自己検査
    check(rank_desc([5, 3, 3, 1]) == [1, 2, 2, 4], "rank_desc の検算 [5,3,3,1] → [1,2,2,4]")

    print("[4] 地方")
    regions = {}
    for p in prefs:
        regions.setdefault(p["region"], []).append(p["name"])
    check(len(regions) == 9, f"地方は 9 区分（{list(regions)}）")
    check(sorted(regions["関東"]) == sorted(["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県", "山梨県", "長野県"]),
          "関東 = 茨城〜神奈川＋山梨・長野（出典の区分）")
    check(prefs[46]["region"] == "九州・沖縄", "沖縄県は九州・沖縄")

    print("[5] 距離（国土地理院の表と照合）")
    check(abs(vincenty(0, 0, 0, 1) - 111.3195) < 0.001, "赤道上の経度 1 度 = 111.3195 km（GRS80）")
    table = gsi_distance_table(short)
    check(len(table) == 47 * 46 // 2, f"距離表の組数 1,081（{len(table)}）")
    worst = 0.0
    worst_pair = None
    for (a, b), km in table.items():
        mine = vincenty(prefs[a]["lat"], prefs[a]["lon"], prefs[b]["lat"], prefs[b]["lon"])
        if abs(mine - km) > worst:
            worst, worst_pair = abs(mine - km), (names[a], names[b], km, round(mine, 2))
    check(worst <= 0.2, f"全 1,081 組で国土地理院の値との差 ≤ 0.2 km（最大 {worst:.3f} km {worst_pair}）")
    check(abs(table[(short.index("東京"), short.index("大阪"))] - 395.9) < 1e-9, "表の読み取り: 東京–大阪 395.9 km")
    FIXTURE.write_text(json.dumps([[a, b, km] for (a, b), km in sorted(table.items())]), encoding="utf-8")
    print(f"  JS 検査用の答え: {FIXTURE.relative_to(ROOT)}")

    print()
    if fails:
        print(f"FAILED {len(fails)}")
        sys.exit(1)
    print("ALL PASS")


if __name__ == "__main__":
    main()
