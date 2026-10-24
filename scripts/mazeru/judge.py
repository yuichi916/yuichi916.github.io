"""まぜる日本: 生成した組み合わせを、同じローカルLLMに「つながりのわかりやすさ」1〜5点で採点させる（品質の門）。

使い方:  python scripts/mazeru/judge.py     （再開可。キャッシュ C:/tmp/mazeru-gen/judge.jsonl）
採点の基準（プロンプト）: 5=だれでも納得、4=なるほど、3=少し考えればわかる、2=こじつけ、1=意味が通らない・片方が無関係。
build_data.py がこの点数で組を落とす（1点は必ず落とす。2点は、その要素へ届く道を残すのに必要なときだけ残す）。

人の抜き取り200組との突き合わせ（生成直後の表で実施）: 人が「納得」とした109組の点数は 5:8 4:29 3:22 2:36 1:14、
「納得できない」91組は 5:1 4:7 3:11 2:39 1:33。単独では人と食い違いも多いので、人の抜き取りは門を通した後にもう一度行う。
"""
from __future__ import annotations

import json
import os
import random
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import gen  # noqa: E402

JUDGE = os.path.join(gen.WORK, "judge.jsonl")
BATCH = 20
SYS = ("あなたは言葉あそびゲームの審査員です。「A + B = C」は、2つの要素AとBをまぜるとCができる、という組み合わせです。"
       "つながりのわかりやすさを1〜5で採点してください。5=だれでも納得、4=なるほど、3=少し考えればわかる、2=こじつけ、"
       "1=意味が通らない・片方が無関係。番号ごとに「番号. 点数」の1行で答える。")


def judge(chunk):
    msgs = [{"role": "system", "content": SYS},
            {"role": "user", "content": "\n".join(f"{i+1}. {a} + {b} = {r}" for i, (a, b, r) in enumerate(chunk))}]
    txt = gen._call(msgs, 8 * len(chunk) + 16, 1, 0)
    got = gen._parse_lines(txt, len(chunk))
    out = []
    for i, (a, b, r) in enumerate(chunk):
        m = re.search(r"[1-5]", got.get(i, ""))
        if not m and len(chunk) > 1:
            out.extend(judge([(a, b, r)]))
            continue
        out.append({"a": a, "b": b, "r": r, "score": int(m.group()) if m else 0, "raw": got.get(i, "")})
    return out


def main():
    gen.wait_server()
    raw = json.load(open(os.path.join(gen.WORK, "raw_graph.json"), encoding="utf-8"))
    done = set()
    if os.path.exists(JUDGE):
        for line in open(JUDGE, encoding="utf-8"):
            try:
                j = json.loads(line)
                done.add((j["a"], j["b"], j["r"]))
            except Exception:
                pass
    todo = [tuple(x) for x in raw["recipes"] if tuple(x) not in done]
    random.Random(7).shuffle(todo)  # 同じ要素の組が1回に並ばないように混ぜる
    gen.log("judge todo", len(todo), "done", len(done))
    chunks = [todo[i:i + BATCH] for i in range(0, len(todo), BATCH)]
    n = 0
    with open(JUDGE, "a", encoding="utf-8") as f, ThreadPoolExecutor(gen.NP) as ex:
        for res in ex.map(judge, chunks):
            for r in res:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
            f.flush()
            n += 1
            if n % 50 == 0:
                gen.log(f"judged {n * BATCH}/{len(todo)}")
    gen.log("judge done")


if __name__ == "__main__":
    main()
