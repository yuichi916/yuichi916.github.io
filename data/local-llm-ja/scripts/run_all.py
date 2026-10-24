"""全モデルを順に測る。python run_all.py [model_id ...]
既に raw/ に結果がある工程は飛ばす（途中から再開できる）。失敗したモデルは runner_failures.json に残して次へ進む。"""
import json, os, subprocess, sys, time

ROOT = os.path.dirname(os.path.abspath(__file__))
MODELS = json.load(open(os.path.join(ROOT, "models.json"), encoding="utf-8"))
SKIP = {"bonsai2-27b"}  # 公式 llama.cpp で読めない（型 143 = PrismML 独自の三値型）
ids = sys.argv[1:] or [m["id"] for m in MODELS if m["id"] not in SKIP]
fail_path = os.path.join(ROOT, "runner_failures.json")
failures = json.load(open(fail_path, encoding="utf-8")) if os.path.exists(fail_path) else {}

for mid in ids:
    for step in ("speed", "llamabench", "quality"):
        out = os.path.join(ROOT, "raw", f"{step}_{mid}.json")
        if os.path.exists(out):
            continue
        print(time.strftime("%H:%M:%S"), "RUN", step, mid, flush=True)
        logf = open(os.path.join(ROOT, "logs", f"run_{step}_{mid}.log"), "w", encoding="utf-8")
        env = dict(os.environ, PYTHONIOENCODING="utf-8")
        rc = subprocess.call([sys.executable, os.path.join(ROOT, "bench.py"), step, mid], stdout=logf,
                             stderr=subprocess.STDOUT, env=env)
        logf.close()
        if rc != 0:
            failures[f"{step}:{mid}"] = time.strftime("%Y-%m-%d %H:%M:%S") + f" rc={rc}"
            json.dump(failures, open(fail_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print(time.strftime("%H:%M:%S"), "FAIL", step, mid, flush=True)
            if step == "speed":
                break
print("RUNNER DONE", flush=True)
