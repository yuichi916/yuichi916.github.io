"""raw/ の生データを集計して、サイト用の results.json と CSV を作る。python aggregate.py"""
import json, os, csv, statistics, re, glob
from stats import wilson, mean_ci

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(ROOT, "raw")
OUT = os.path.join(ROOT, "out")
os.makedirs(OUT, exist_ok=True)
MODELS = json.load(open(os.path.join(ROOT, "models.json"), encoding="utf-8"))
META = json.load(open(os.path.join(ROOT, "meta.json"), encoding="utf-8"))
med = statistics.median


def load(name):
    p = os.path.join(RAW, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None


judg = load("elyza_judgments.json") or {}
rows, req_rows, item_rows, models_out = [], [], [], []
for m in MODELS:
    sp = load(f"speed_{m['id']}.json")
    if not sp:
        continue
    q = load(f"quality_{m['id']}.json")
    lb = load(f"llamabench_{m['id']}.json")
    cyc = sp["cycles"]
    size_b = os.path.getsize(m.get("local") or f"E:/ai/jpbench/models/{m['file']}")
    tok = cyc[0]["tokenizer"]
    tpc = (tok["kumo_tokens"] + tok["modern_tokens"]) / (tok["kumo_chars"] + tok["modern_chars"])
    # 速度: 各プロンプトの 3 回の中央値
    s = {}
    for key in ("short", "summary", "chat"):
        rs = [c["requests"][key] for c in cyc]
        s[key] = {"ttft_ms": med([r["ttft_ms_client"] for r in rs]),
                  "gen_tps": med([r["timings"]["predicted_per_second"] for r in rs]),
                  "gen_tps_client": med([r["gen_tps_client"] for r in rs]),
                  "pp_tps": med([r["timings"]["prompt_per_second"] for r in rs]),
                  "prompt_n": rs[0]["timings"]["prompt_n"],
                  "gen_n": med([r["timings"]["predicted_n"] for r in rs])}
        for c in cyc:
            r = c["requests"][key]; t = r["timings"]
            req_rows.append({"model": m["id"], "cycle": c["cycle"], "prompt": key, "prompt_tokens": t["prompt_n"],
                             "prompt_tps": round(t["prompt_per_second"], 2), "ttft_ms_client": round(r["ttft_ms_client"], 1),
                             "gen_tokens": t["predicted_n"], "gen_tps_server": round(t["predicted_per_second"], 3),
                             "gen_tps_client": round(r["gen_tps_client"], 3), "finish": r["finish_reason"],
                             "content_chars": r["content_chars_nows"], "reasoning_chars": r["reasoning_chars_nows"],
                             "gpu_temp_max_c": c["gpu_during"]["temp_max_c"]})
    short_ctx = [c["requests"][k]["timings"]["predicted_per_second"] for c in cyc for k in ("short", "chat")]
    gen_tps = med(short_ctx)
    off = cyc[0]["offload"]
    entry = {k: m[k] for k in ("id", "name", "maker", "jp", "repo", "base", "file", "quant", "license", "group", "think", "why")}
    entry.update({"replaced": m.get("replaced"), "size_gb": round(size_b / 1e9, 2),
                  "flash_attn": off.get("flash_attn"), "gpu_layers": off.get("gpu_layers"), "total_layers": off.get("total_layers"),
                  "cpu_weights_mib": off.get("cpu_model_buffer_mib"),
                  "load_s": round(med([c["load_s"] for c in cyc[1:]]), 2), "load_first_s": round(cyc[0]["load_s"], 2), "load_s_all": [round(c["load_s"], 2) for c in cyc],
                  "vram_gib": round(med([c["vram_peak_mib"] for c in cyc]) / 1024, 2),
                  "gpu_temp_max_c": max(c["gpu_during"]["temp_max_c"] for c in cyc),
                  "baseline_vram_mib": [c["baseline"]["mem_used_mib"] for c in cyc],
                  "baseline_other_gpu_pct": [c["baseline"].get("other_3d_compute_pct") for c in cyc],
                  "tokens_per_char": round(tpc, 4),
                  "gen_tps": round(gen_tps, 1),
                  "jp_chars_per_s": round(gen_tps / tpc, 1),
                  "ttft_ms_short": round(s["short"]["ttft_ms"]), "ttft_ms_summary": round(s["summary"]["ttft_ms"]),
                  "pp_tps_summary": round(s["summary"]["pp_tps"]), "gen_tps_summary": round(s["summary"]["gen_tps"], 1),
                  "speed_detail": s})
    if lb and isinstance(lb.get("result"), list):
        for r in lb["result"]:
            if r.get("n_gen", 0) > 0:
                entry["llamabench_tg128"] = round(r["avg_ts"], 1)
            elif r.get("n_prompt", 0) > 0:
                entry["llamabench_pp512"] = round(r["avg_ts"], 1)
    if q:
        for task in ("jcqa", "mmmlu"):
            k = sum(x["correct"] for x in q[task]); n = len(q[task])
            lo, hi = wilson(k, n)
            entry[task] = {"k": k, "n": n, "acc": round(k / n, 3), "lo": round(lo, 3), "hi": round(hi, 3),
                           "unparsed": sum(x["pred"] is None for x in q[task]),
                           "truncated": sum(x["finish"] == "length" and x["pred"] is None for x in q[task]),
                           "think_truncated": sum(x["finish"] == "length" and x.get("reasoning_chars", 0) > 0 and x["pred"] is None for x in q[task])}
            for x in q[task]:
                item_rows.append({"model": m["id"], "task": task, "item": x.get("q_id", x.get("row")),
                                  "gold": x["gold"], "pred": x["pred"], "correct": int(x["correct"])})
        sc = judg.get(m["id"])
        if sc:
            vals = [v["score"] for v in sc.values()]
            mu, lo, hi = mean_ci(vals)
            entry["elyza"] = {"mean": round(mu, 2), "lo": round(lo, 2), "hi": round(hi, 2), "n": len(vals)}
            for idx, v in sc.items():
                item_rows.append({"model": m["id"], "task": "elyza", "item": idx, "gold": "", "pred": v["score"], "correct": ""})
        entry["elyza_truncated"] = sum(x["finish"] == "length" for x in q["elyza"])
    models_out.append(entry)
    rows.append({"id": m["id"], "name": m["name"], "quant": m["quant"], "size_gb": entry["size_gb"], "group": m["group"],
                 "think": m["think"], "load_s": entry["load_s"], "ttft_ms_short": entry["ttft_ms_short"],
                 "ttft_ms_summary": entry["ttft_ms_summary"], "gen_tps": entry["gen_tps"],
                 "gen_tps_summary": entry["gen_tps_summary"], "pp_tps_summary": entry["pp_tps_summary"],
                 "tokens_per_char": entry["tokens_per_char"], "jp_chars_per_s": entry["jp_chars_per_s"],
                 "vram_gib": entry["vram_gib"], "llamabench_tg128": entry.get("llamabench_tg128"),
                 "llamabench_pp512": entry.get("llamabench_pp512"),
                 "jcqa_acc": entry.get("jcqa", {}).get("acc"), "mmmlu_acc": entry.get("mmmlu", {}).get("acc"),
                 "elyza_mean": entry.get("elyza", {}).get("mean"), "license": m["license"]})

excluded = json.load(open(os.path.join(ROOT, "excluded.json"), encoding="utf-8"))
res = {"meta": META, "models": models_out, "excluded": excluded}
json.dump(res, open(os.path.join(OUT, "results.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for name, data in (("summary.csv", rows), ("speed_requests.csv", req_rows), ("quality_items.csv", item_rows)):
    if data:
        with open(os.path.join(OUT, name), "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(data[0].keys())); w.writeheader(); w.writerows(data)
print(f"models={len(models_out)} requests={len(req_rows)} items={len(item_rows)}")
