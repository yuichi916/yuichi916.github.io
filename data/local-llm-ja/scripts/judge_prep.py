"""ELYZA-tasks の回答を、モデル名を伏せて審査用のバッチファイルにする。
python judge_prep.py  -> judge/batch_*.json と judge/key.json（伏せ字 ID → モデル）
python judge_prep.py --collect -> judge/result_*.json を集めて raw/elyza_judgments.json"""
import json, os, random, sys, glob, csv

ROOT = os.path.dirname(os.path.abspath(__file__))
J = os.path.join(ROOT, "judge"); os.makedirs(J, exist_ok=True)
rows = list(csv.DictReader(open(os.path.join(ROOT, "datasets", "elyza_tasks_100.csv"), encoding="utf-8")))

if "--collect" in sys.argv:
    key = json.load(open(os.path.join(J, "key.json"), encoding="utf-8"))
    out = {}
    for f in sorted(glob.glob(os.path.join(J, "result_*.json"))):
        for r in json.load(open(f, encoding="utf-8")):
            mid, idx = key[r["id"]]
            s = int(r["score"]); assert 1 <= s <= 5
            out.setdefault(mid, {})[str(idx)] = {"score": s, "reason": r.get("reason", "")}
    missing = [k for k in key if key[k][1] is not None and str(key[k][1]) not in out.get(key[k][0], {})]
    assert not missing, f"未採点 {len(missing)} 件: {missing[:5]}"
    json.dump(out, open(os.path.join(ROOT, "raw", "elyza_judgments.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print({m: len(v) for m, v in out.items()})
    sys.exit()

rnd = random.Random(20261024)
answers = {}
for f in sorted(glob.glob(os.path.join(ROOT, "raw", "quality_*.json"))):
    q = json.load(open(f, encoding="utf-8"))
    for e in q["elyza"]:
        answers.setdefault(e["idx"], []).append((q["model"], e["content"], e["finish"]))
key, tasks = {}, []
for idx in sorted(answers):
    items = answers[idx][:]; rnd.shuffle(items)
    lst = []
    for mid, content, finish in items:
        aid = f"a{rnd.randrange(16**6):06x}"
        key[aid] = [mid, idx]
        lst.append({"id": aid, "answer": content if content.strip() else "（空の回答）",
                    "note": "出力上限で途中終了" if finish == "length" else ""})
    r = rows[idx]
    tasks.append({"task_no": idx, "question": r["input"], "reference_answer": r["output"], "eval_aspect": r["eval_aspect"],
                  "answers": lst})
n_batches = 4
for b in range(n_batches):
    part = tasks[b::n_batches]
    json.dump(part, open(os.path.join(J, f"batch_{b+1}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(key, open(os.path.join(J, "key.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("tasks", len(tasks), "answers", len(key))
