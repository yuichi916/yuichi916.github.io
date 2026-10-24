"""青空文庫のテキスト（ルビ付き zip）を本文だけにする処理。手で直さず、ここに書いた規則だけを当てる。

規則（この順に当てる）:
  1. zip の中の .txt を Shift_JIS（cp932）で読む。改行は \\n にそろえる
  2. 前付け（題名・作者名と、----- で囲まれた【テキスト中に現れる記号について】の欄）を落とす
  3. 後付け（行頭の「底本：」から後ろ）を落とす
  4. ルビ《…》を消す（親文字は残す）
  5. ルビの始まりを示す ｜ を消す
  6. 入力者注［＃…］（字下げ・傍点・見出しなどの指定）を消す
  7. 各行の行末の空白を消す

外字（※［＃…］）・アクセント記号〔…〕・くの字点（／＼、／″＼）は、上の規則では正しく直せないので、
それらを含む段落は問題に使わない（passage_ok で弾く）。
"""
from __future__ import annotations

import re
import zipfile
from pathlib import Path

RULES = [
    "zip 内の .txt を Shift_JIS（cp932）で読み、改行を \\n にそろえる",
    "前付け（題名・作者名と、----- で囲まれた【テキスト中に現れる記号について】の欄）を落とす",
    "後付け（行頭の「底本：」から後ろ）を落とす",
    "ルビ《…》を消す（親文字は残す）",
    "ルビの始まりを示す ｜ を消す",
    "入力者注［＃…］（字下げ・傍点・見出しなどの指定）を消す",
    "各行の行末の空白を消す",
    "外字（※［＃…］）・〔…〕・くの字点（／＼）を含む段落は使わない",
]

RUBY = re.compile(r"《[^》]*》")
NOTE = re.compile(r"［＃[^］]*］")
SEP = re.compile(r"^-{20,}\s*$")


def read_zip_text(zip_path: Path) -> str:
    with zipfile.ZipFile(zip_path) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".txt")]
        if len(names) != 1:
            raise ValueError(f"{zip_path}: .txt が {len(names)} 個")
        raw = z.read(names[0])
    return raw.decode("cp932").replace("\r\n", "\n").replace("\r", "\n")


def body_lines(raw: str) -> list[str]:
    lines = raw.split("\n")
    # 前付け: ----- の欄があればその後ろから。なければ最初の空行の後ろから
    seps = [i for i, l in enumerate(lines[:80]) if SEP.match(l)]
    if len(seps) >= 2:
        start = seps[1] + 1
    else:
        start = next(i for i, l in enumerate(lines) if l.strip() == "") + 1
    end = len(lines)
    for i in range(len(lines) - 1, start, -1):
        if lines[i].startswith("底本："):
            end = i
            break
    return lines[start:end]


def clean_line(line: str) -> str:
    line = RUBY.sub("", line)
    line = line.replace("｜", "")
    line = NOTE.sub("", line)
    return line.rstrip()


def clean_text(raw: str) -> str:
    """本文を規則どおりに整えた文字列（行=段落、\\n 区切り）。"""
    return "\n".join(clean_line(l) for l in body_lines(raw))


BAD = ("※", "〔", "〕", "／＼", "／″＼", "［＃", "《", "》", "｜")


def passage_ok(text: str) -> bool:
    return not any(b in text for b in BAD)


def load_clean(zip_path: Path) -> str:
    return clean_text(read_zip_text(zip_path))


if __name__ == "__main__":  # 簡単な自己確認
    sample = "　山路《やまみち》を｜登りながら［＃「登りながら」に傍点］、\n"
    assert clean_line(sample) == "　山路を登りながら、", clean_line(sample)
    print("ok")
