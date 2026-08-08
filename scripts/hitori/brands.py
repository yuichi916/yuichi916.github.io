# -*- coding: utf-8 -*-
"""ブランド単位の判定を、そのブランドの全施設へ展開する。

チェーンが丸ごと閉業すると、施設を1軒ずつ調べる方式では取りこぼす。
瀬戸うどん（ゼンショーHD）は2025年10月16日に全店閉店したが、こちらの
データには4件が営業中として残っていた。455件の丸亀製麺のような規模の
ブランドが1つ畳まれれば、一度に数百件が誤りになる。

ここでは名称の完全一致だけを使う。部分一致にすると「そば処 おかあやん」
のような無関係な独立店を巻き込む（chains.py で同じ理由から前置き一致を
却下している）。

使い方:
    python scripts/hitori/brands.py > batch.json
    cat batch.json | python scripts/hitori/curate.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PREF_DIR = ROOT / "data" / "hitori" / "pref"
RULINGS = ROOT / "data" / "hitori" / "brand_rulings.json"


def load_rulings():
    """{ブランド名: {"checked": ..., "facts": [{"k","v","urls"}]}}"""
    if not RULINGS.exists():
        return {}
    return json.loads(RULINGS.read_text(encoding="utf-8"))


def _matches(name, brand, rule):
    """既定は完全一致。前置き一致は判定側が明示したときだけ許す。

    「そば」で「そば処 おかあやん」を拾うような巻き込みを防ぐため、
    既定を完全一致にしている（chains.py が前置き一致を却下したのと同じ
    理由）。ただし「シダックス 蓮田店」のように支店名が付く実データが
    あるため、ブランドごとに match:"prefix" を選べるようにする。
    その場合も cat/kind の一致を必須にし、無関係な業態を巻き込まない。
    """
    if rule.get("match") == "prefix":
        return name.startswith(brand)
    return name == brand


def facilities_by_name(names, rulings=None):
    """ブランド名から施設IDを集める。既定は完全一致。"""
    rulings = rulings or {}
    want = list(names)
    out = {n: [] for n in want}
    for f in sorted(PREF_DIR.glob("*.json")):
        doc = json.loads(f.read_text(encoding="utf-8"))
        ni = doc["fields"].index("name")
        idi = doc["fields"].index("id")
        ki = doc["fields"].index("kind")
        for row in doc["items"]:
            for brand in want:
                rule = rulings.get(brand, {})
                if not _matches(row[ni], brand, rule):
                    continue
                # 前置き一致のときは業態も一致させる。名前だけで広げない。
                need = rule.get("kind")
                if need and row[ki] != need:
                    continue
                out[brand].append(row[idi])
                break
    return out


def expand(rulings, by_name):
    """ブランドの判定を、その名称を持つ全施設の curated 入力へ展開する。"""
    entries = []
    for brand, ruling in sorted(rulings.items()):
        ids = by_name.get(brand, [])
        for fid in ids:
            entries.append({
                "id": fid,
                "checked": ruling["checked"],
                "facts": [dict(f) for f in ruling["facts"]],
            })
    return entries


def main():
    rulings = load_rulings()
    if not rulings:
        print(f"{RULINGS} がありません。", file=sys.stderr)
        sys.exit(1)
    by_name = facilities_by_name(rulings, rulings)
    entries = expand(rulings, by_name)

    # 既に除外された施設は pref/*.json から消えているので0件になる。
    # 「名称が違う」と決めつけると、正しく効いた判定を誤りに見せてしまう。
    curated_path = ROOT / "data" / "hitori" / "curated.json"
    known = json.loads(curated_path.read_text(encoding="utf-8")) if curated_path.exists() else {}
    for brand in sorted(rulings):
        n = len(by_name.get(brand, []))
        note = ""
        if not n:
            note = ("  ← 適用済み（除外されて現データに無い）" if known
                    else "  ← 該当する施設が無い（名称が違う可能性）")
        print(f"{brand}: {n}件{note}", file=sys.stderr)
    print(f"合計 {len(entries)} 件の施設へ展開", file=sys.stderr)

    json.dump(entries, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
