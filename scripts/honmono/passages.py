"""どっちが本物？: 原文の切り出し。手で文字を写さず、ここに書いた位置から機械的に切り出す。

位置の書き方（行番号は aozora_text.clean_text の結果を \\n で割った 0 始まりの番号）:
  (作品ID, 行, 段落数)                  … その行から連続する段落を丸ごと
  (作品ID, 行, "s", 開始の文, 文の数)   … 1 段落の中の、連続する文だけ（文は「。」までで区切る）

切り出しの規則:
  - 段落の行頭の字下げ（全角・半角の空白）は落とす
  - 2 段落以上のときは段落の間を \\n でつなぐ（画面では改行して見せる）

使い方:  python scripts/honmono/passages.py   → data/honmono/originals.json
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from aozora_text import load_clean, passage_ok  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]

PICKS: list[tuple] = [
    ("000794", 879, 1),            # 三四郎: 畑の上の空と風、美禰子
    ("000760", 135, 2),            # 硝子戸の中: 北の果ての中学校長
    ("043017", 5, "s", 8, 2),      # 蜜柑: 硝子戸が落ちる
    ("043016", 26, 1),             # トロッコ: 竹藪から海が見える
    ("002257", 17, 1),             # 黄金風景: 女中への悪行を思い出す
    ("000275", 84, 1),             # 女生徒: 母が先に寝る
    ("000473", 38, 2),             # よだかの星: 巣を片づけて日の方へ
    ("000470", 17, 1),             # セロ弾きのゴーシュ: 叱られた後のひとり稽古
    ("056041", 62, 1),             # たけくらべ: 風で鼻緒が抜ける
    ("000624", 27, 1),             # 山月記: 丘の上から虎を見る
    ("000621", 22, 1),             # 名人伝: 九年後に山を降りる
    ("000424", 12, 1),             # 檸檬: 檸檬を嗅ぐ
    ("000429", 30, 1),             # 城のある町にて: 米つきばった
    ("042618", 130, 1),            # 桜の森の満開の下: 都の退屈
    ("042615", 37, 1),             # 風と光と二十の私と: 不幸を空想する
    ("001293", 123, 2),            # 半七捕物帳 お文の魂: 初夏の寺へ
    ("056160", 62, 1),             # 影を踏まれた女: 犬が影を踏む
    ("002381", 71, 1),             # 瓶詰地獄: 神は何も示さない
    ("000930", 276, 2),            # 押絵の奇蹟: 父に責められる母
    ("045245", 27, 1),             # 高瀬舟: 庄兵衛の思案
    ("000689", 120, 2),            # 山椒大夫: 柴刈りと汐汲み
    ("000521", 143, 2),            # 高野聖: 山蛭
    ("000360", 123, 2),            # 外科室: 小石川植物園ですれ違う
    ("000211", 31, 1),             # 一房の葡萄: 泣き寝入りから目覚める
    ("004803", 525, 1),            # 風立ちぬ: 一年ぶりに手帳を開く
    ("051034", 11, 2),             # 野ばら: 将棋を教わる
    ("054372", 84, 2),             # 赤い蝋燭と人魚: 大暴風雨の夜
    ("000637", 27, 1),             # 手袋を買いに: 子狐が町の灯へ
    ("000628", 27, 1),             # ごん狐: 墓地と葬式の鐘
    ("056645", 11, 1),             # 押絵と旅する男: 親不知を過ぎる車内
    ("056648", 6, 1),              # 人間椅子: 原稿を読み始める
    ("045649", 2970, 2),           # 放浪記: 風呂敷包みを提げて歩く
    ("000545", 50, 1),             # 夫婦善哉: 地蔵盆の夜に柳吉が戻る
    ("000452", 1, 1),              # 競馬: 曇天の競馬場
    ("000329", 91, 1),             # 武蔵野: 小金井の堤を歩く
    ("001409", 45, 1),             # 忘れえぬ人々: 大津と秋山
    ("001503", 450, 1),            # 千曲川のスケッチ: 冬の近づく霧の日
    ("000827", 7, 1),              # どんぐり: 植物園の静けさ
    ("002363", 16, 1),             # 茶わんの湯: 湯の面の霧の模様
    ("002302", 3, 1),              # 蠅: 真夏の宿場の厩
    ("000904", 153, 2),            # 春は馬車に乗って: 医者の宣告と帰り道
    ("000496", 92, 1),             # 恩讐の彼方に: 槌を振る市九郎
    ("004306", 14, 1),             # 形: 新兵衛が若武者を眺める
    ("052016", 415, 1),            # 濹東綺譚: 音のない稲妻
    ("056642", 31, "s", 2, 2),     # 陰翳礼讃: 屋根と庇の下の闇
    ("056641", 52, 1),             # 刺青: 針を刺す
    ("000647", 216, 1),            # 野菊の墓: 民子が泣き通したと知る
    ("004680", 29, 1),             # 夏の花: 逃げ出す支度
    ("001016", 133, 2),            # 鮨: 母の握った鮨
    ("001465", 108, 1),            # 蟹工船: 川崎船を縛りつける
]


def sentences(p: str) -> list[str]:
    return [s for s in re.findall(r"[^。]*。|[^。]+$", p) if s]


def indent_strip(l: str) -> str:
    return l.lstrip("　 ")


def extract(lines: list[str], pick: tuple) -> str:
    if len(pick) == 3:
        _, i, k = pick
        seg = [indent_strip(x) for x in lines[i:i + k]]
        return "\n".join(seg)
    _, i, s, a, n = pick
    assert s == "s"
    ss = sentences(indent_strip(lines[i]))
    return "".join(ss[a:a + n])


def length(t: str) -> int:
    return len(t.replace("\n", ""))


def main() -> None:
    works = {w["id"]: w for w in json.loads((ROOT / "data/honmono/works.json").read_text(encoding="utf-8"))["works"]}
    out = []
    for pick in PICKS:
        w = works[pick[0]]
        lines = load_clean(ROOT / w["text_zip"]).split("\n")
        t = extract(lines, pick)
        if not passage_ok(t):
            raise SystemExit(f"{pick}: 使えない文字を含む")
        out.append({
            "work_id": w["id"],
            "where": {"line": pick[1], "paragraphs": pick[2]} if len(pick) == 3 else
                     {"line": pick[1], "sentence_from": pick[3], "sentences": pick[4]},
            "text": t,
            "chars": length(t),
            "paragraphs": t.count("\n") + 1,
        })
        print(w["author"], w["title"], length(t))
    (ROOT / "data/honmono/originals.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", len(out))


if __name__ == "__main__":
    main()
