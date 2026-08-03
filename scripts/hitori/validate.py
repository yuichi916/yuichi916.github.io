# -*- coding: utf-8 -*-
"""出力JSONのスキーマ検証。ビルドからもテストからも同じ関数を呼ぶ。"""

JAPAN_BBOX = (20.0, 46.0, 122.0, 154.0)  # 南, 北, 西, 東
EXPECTED_FIELDS = ["id", "name", "lat", "lon", "cat", "kind", "score", "conf", "chain", "note"]
CATS = ("bath", "eat", "play", "stay")


def validate_pref(doc):
    errs = []
    if doc.get("fields") != EXPECTED_FIELDS:
        errs.append(f"fields が期待と異なる: {doc.get('fields')}")
        return errs  # 列位置が信用できないので以降は見ない

    idx = {k: i for i, k in enumerate(EXPECTED_FIELDS)}
    s, n, w, e = JAPAN_BBOX
    seen = set()

    for row in doc.get("items", []):
        if len(row) != len(EXPECTED_FIELDS):
            errs.append(f"列数が不正: {row}")
            continue
        fid = row[idx["id"]]
        if fid in seen:
            errs.append(f"duplicate id: {fid}")
        seen.add(fid)

        if not str(row[idx["name"]]).strip():
            errs.append(f"name が空: {fid}")

        lat, lon = row[idx["lat"]], row[idx["lon"]]
        if not (s <= lat <= n and w <= lon <= e):
            errs.append(f"bbox 外の座標: {fid} ({lat}, {lon})")

        sc = row[idx["score"]]
        if not isinstance(sc, int) or isinstance(sc, bool) or not (1 <= sc <= 5):
            errs.append(f"score が不正: {fid} -> {sc!r}")

        cf = row[idx["conf"]]
        if cf not in (0, 1, 2) or isinstance(cf, bool):
            errs.append(f"conf が不正: {fid} -> {cf!r}")

        ch = row[idx["chain"]]
        if ch not in (0, 1) or isinstance(ch, bool):
            errs.append(f"chain が不正: {fid} -> {ch!r}")

        if row[idx["cat"]] not in CATS:
            errs.append(f"cat が不正: {fid} -> {row[idx['cat']]!r}")

    return errs


def validate_summary(doc):
    errs = []
    prefs = doc.get("prefectures", [])
    for p in prefs:
        c, ci = p.get("counts", {}), p.get("counts_indie", {})
        for k in ("all",) + CATS:
            if k not in c:
                errs.append(f"counts に {k} がない: {p.get('code')}")
                continue
            if ci.get(k, 0) > c[k]:
                errs.append(f"counts_indie.{k} が counts.{k} を超えている: {p.get('code')}")
        if c.get("all", 0) != sum(c.get(k, 0) for k in CATS):
            errs.append(f"counts.all がカテゴリ合計と一致しない: {p.get('code')}")
    return errs


VALID_SRC = ("web", "user", "visit", "review")
MANUAL_REQUIRED = ("name", "lat", "lon", "cat", "kind", "base", "pref")


def validate_curated(curated):
    """curated.json の健全性。ビルドの入口で弾く。

    spec §6.2「出典URLが取れないものは採用しない」をここで機械的に強制する。
    """
    errs = []
    for fid, rec in curated.items():
        if "chain" in rec and rec["chain"] not in (0, 1):
            errs.append(f"{fid}: chain が不正 -> {rec['chain']!r}")

        # c- 始まりは OSM に存在しない手動追加。座標とカテゴリを自前で持つ必要がある。
        if fid.startswith("c-") and not rec.get("excluded"):
            missing = [k for k in MANUAL_REQUIRED if k not in rec]
            if missing:
                errs.append(f"{fid}: 手動追加エントリに {missing} がありません")

        for ev in rec.get("evidence", []):
            src = ev.get("src")
            if src not in VALID_SRC:
                errs.append(f"{fid}: src が不正 -> {src!r}")
            if src == "web" and not (ev.get("url") or "").strip():
                errs.append(f"{fid}: src=web に url がありません")
            if ev.get("polarity") not in ("+", "-"):
                errs.append(f"{fid}: polarity が不正 -> {ev.get('polarity')!r}")
            if not ev.get("checked"):
                errs.append(f"{fid}: checked がありません")
    return errs
