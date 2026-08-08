# -*- coding: utf-8 -*-
"""出力JSONのスキーマ検証。ビルドからもテストからも同じ関数を呼ぶ。"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import iso as iso_mod  # 上限値の単一の出典。ここにも 50000 を書かない。

JAPAN_BBOX = (20.0, 46.0, 122.0, 154.0)  # 南, 北, 西, 東
EXPECTED_FIELDS = ["id", "name", "lat", "lon", "cat", "kind",
                   "solo", "quiet", "easy", "conf", "chain",
                   "hidden", "hidden_n", "iso", "city", "oh", "tel", "web", "note",
                   "solo_est", "quiet_est", "easy_est", "checked"]
CATS = ("bath", "eat", "play", "stay")
CHECKED_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")  # 空文字 または YYYY-MM-DD


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

        for axis in ("solo", "quiet", "easy"):
            v = row[idx[axis]]
            if not isinstance(v, int) or isinstance(v, bool) or not (1 <= v <= 5):
                errs.append(f"{axis} が不正: {fid} -> {v!r}")

        hv, hn = row[idx["hidden"]], row[idx["hidden_n"]]
        if not isinstance(hv, (int, float)) or isinstance(hv, bool) or not (0.0 <= hv <= 1.0):
            errs.append(f"hidden が不正: {fid} -> {hv!r}")
        if not isinstance(hn, int) or isinstance(hn, bool) or hn < 0:
            errs.append(f"hidden_n が不正: {fid} -> {hn!r}")
        elif hn < 3 and hv != 0.0:
            errs.append(f"hidden_n が3未満なのに hidden が0でない: {fid}")

        iv = row[idx["iso"]]
        if not isinstance(iv, int) or isinstance(iv, bool) or not (0 <= iv <= iso_mod.MAX_ISO_M):
            errs.append(f"iso が不正: {fid} -> {iv!r}")

        cf = row[idx["conf"]]
        if cf not in (0, 1, 2) or isinstance(cf, bool):
            errs.append(f"conf が不正: {fid} -> {cf!r}")

        ch = row[idx["chain"]]
        if ch not in (0, 1) or isinstance(ch, bool):
            errs.append(f"chain が不正: {fid} -> {ch!r}")

        if row[idx["cat"]] not in CATS:
            errs.append(f"cat が不正: {fid} -> {row[idx['cat']]!r}")

        checked = row[idx["checked"]]
        if checked != "" and not CHECKED_RE.match(str(checked)):
            errs.append(f"checked が不正: {fid} -> {checked!r}")

    return errs


def validate_summary(doc):
    errs = []
    th = doc.get("iso_threshold")
    if not isinstance(th, dict):
        errs.append("iso_threshold がない")
    else:
        for c in CATS:
            v = th.get(c)
            if not isinstance(v, int) or isinstance(v, bool) or v < 0:
                errs.append(f"iso_threshold.{c} が不正: {v!r}")

    # ブラウザ側 (hitori.html の formatIso) が同じ上限を summary.json から読む。
    # Python と JS の二重管理で閾値がずれた前例があるため、ここでも必須にする。
    im = doc.get("iso_max")
    if not isinstance(im, int) or isinstance(im, bool) or im != iso_mod.MAX_ISO_M:
        errs.append(f"iso_max が不正: {im!r}")

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
MANUAL_REQUIRED = ("name", "lat", "lon", "cat", "kind", "pref")


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
