"""hitori.html の #about-static に、説明文を静的に焼き込む。

app.js が起動時に同じ内容を書いていたが、それだと HTML の中身は空のままで、
JavaScript を実行しない読み手（GPTBot / ClaudeBot / PerplexityBot など)には
「ひとり歓迎マップ」が 64 字のページにしか見えていなかった。

数字は data/hitori/index.json から取るので、手で書かない。
実行:  python scripts/bake_static_about.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BEGIN = "<!-- BAKED:about-static:begin -->"
END = "<!-- BAKED:about-static:end -->"


def build_html(idx: dict) -> str:
    total = idx["total"]
    checked = idx["checked_count"]
    sourced = idx.get("sourced_count", checked)
    prefs = sorted(idx["prefectures"], key=lambda p: -p["checked"])
    top = prefs[:12]
    rows = "".join(
        f'<li>{p["name"]} <b>{p["checked"]}</b> / {p["count"]:,}</li>' for p in top
    )
    return f"""{BEGIN}
  <div id="about-static" hidden>
    <h2>情報を、曖昧なままおすすめしない。</h2>
    <p>「ひとりで入れるか」を一本の軸にして、全国 {total:,} 施設を並べ直した地図です。
    {sourced:,} 件に出典つきの根拠があり、そのうち <b>{checked:,} 件</b>は施設の公式情報で裏が取れています。
    残りは個人の訪問記や地図データが根拠で、詳細では ● 公式 / ◐ 公式以外 と分けて表示します。
    データの更新日は {idx["updated"]} です。</p>

    <h3>ひとりチェック 6 項目</h3>
    <p>カウンター席があるか、一人客の利用実績が確認できるか、予約なしで入れるか、
    コース強制ではないか、チェーンではない独立店か、周辺に同業が少ない穴場か。
    この 6 つを信号機の色で出しています。</p>

    <h3>三つの決めごと</h3>
    <ol>
      <li>店の自己申告に頼らず、観測できる属性（業態・席・営業形態・チェーンか）から組み立てる。</li>
      <li>混雑は測れないので、周辺に同業が少ない独立店を「穴場候補」として代理指標にする。</li>
      <li>事実には出典・URL・公式かどうかを必ず添え、出典同士の食い違いは消さずに両方見せる。</li>
    </ol>

    <h3>確認済みの多い都道府県</h3>
    <ul>{rows}</ul>
    <p>全 {len(prefs)} 都道府県を収録しています。</p>

    <h3>出典</h3>
    <p>施設データ: © OpenStreetMap contributors / ODbL ／ 地図タイル: 国土地理院 ／
    人口: Wikidata (CC0)・令和2年国勢調査 ／ 確認済みの情報には各施設に個別の出典を表示しています。</p>

    <h3>関連</h3>
    <p><a href="method/hitori-kijun.html">この地図の作り方（ひとり基準）</a> ／
    <a href="hitoritabi/">一人旅ジャーナル</a> ／
    <a href="hitori-legacy.html">旧版</a> ／
    <a href="./">ひとりぶんの棚</a></p>
  </div>
{END}"""


def main() -> int:
    idx = json.loads((ROOT / "data" / "hitori" / "index.json").read_text(encoding="utf-8"))
    path = ROOT / "hitori.html"
    src = path.read_text(encoding="utf-8")
    block = build_html(idx)

    if BEGIN in src:
        out = re.sub(re.escape(BEGIN) + r".*?" + re.escape(END), lambda _: block, src, flags=re.S)
    else:
        target = '<div id="about-static" hidden></div>'
        if target not in src:
            print("ERROR: #about-static の差し込み位置が見つからない")
            return 1
        out = src.replace(target, block)
    path.write_text(out, encoding="utf-8")

    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", out, flags=re.S)
    chars = len(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body)).strip())
    print(f"hitori.html: 本文 {chars:,} 字（施設 {idx['total']:,} / 公式確認 {idx['checked_count']:,}）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
