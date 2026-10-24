"""RTX 4070 12GB 日本語ローカルLLM 実測ハーネス（llama.cpp llama-server 使用）

使い方:
  python bench.py speed <model_id>      # 読み込み・TTFT・生成速度・VRAM を 3 回
  python bench.py quality <model_id>    # JCommonsenseQA / MMMLU(JA) / ELYZA-tasks-100 抜粋
  python bench.py llamabench <model_id> # llama-bench による tok/s 突き合わせ
生データは raw/ に JSON で書き出す。
"""
import json, os, re, subprocess, sys, threading, time, statistics, random, csv
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(ROOT, "raw")
LOGS = os.path.join(ROOT, "logs")
os.makedirs(RAW, exist_ok=True); os.makedirs(LOGS, exist_ok=True)
LLAMA_DIR = "E:/ai/jpbench/llama-b11852"
MODEL_DIR = "E:/ai/jpbench/models"
PORT = 8091
BASE = f"http://127.0.0.1:{PORT}"
CTX = 4096

MODELS = {m["id"]: m for m in json.load(open(os.path.join(ROOT, "models.json"), encoding="utf-8"))}
PROMPTS = json.load(open(os.path.join(ROOT, "prompts.json"), encoding="utf-8"))
KUMO = open(os.path.join(ROOT, "datasets", "kumo_no_ito.txt"), encoding="utf-8").read()


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


# ---------------- GPU ----------------
def gpu_query():
    out = subprocess.check_output(
        ["nvidia-smi", "--query-gpu=memory.used,memory.total,temperature.gpu,utilization.gpu,power.draw,clocks.sm",
         "--format=csv,noheader,nounits"], text=True).strip().splitlines()[0]
    used, total, temp, util, power, clk = [x.strip() for x in out.split(",")]
    return {"mem_used_mib": int(used), "mem_total_mib": int(total), "temp_c": int(temp),
            "util_pct": int(util), "power_w": float(power), "sm_clock_mhz": int(clk)}


def gpu_compute_apps():
    out = subprocess.check_output(
        ["nvidia-smi", "--query-compute-apps=pid,process_name,used_memory", "--format=csv,noheader"], text=True)
    return [l.strip() for l in out.splitlines() if l.strip()]


HEAVY_NAMES = ("ollama_llama_server", "llama-server", "lms.exe", "LM Studio", "blender", "ComfyUI")


def heavy_procs():
    """自分以外の LLM サーバや重い GPU 処理の実行ファイル名を探す（自分のサーバは停止後に呼ぶ）。"""
    out = subprocess.check_output(["tasklist", "/fo", "csv", "/nh"], text=True, errors="replace")
    names = [l.split(",")[0].strip('"') for l in out.splitlines() if l]
    return sorted({n for n in names if any(h.lower() in n.lower() for h in HEAVY_NAMES)})


class Sampler(threading.Thread):
    def __init__(self, interval=0.25):
        super().__init__(daemon=True)
        self.interval = interval; self.stop_flag = False; self.samples = []

    def run(self):
        while not self.stop_flag:
            try:
                self.samples.append(gpu_query())
            except Exception:
                pass
            time.sleep(self.interval)

    def stop(self):
        self.stop_flag = True; self.join()
        if not self.samples:
            return {}
        return {"mem_peak_mib": max(s["mem_used_mib"] for s in self.samples),
                "temp_max_c": max(s["temp_c"] for s in self.samples),
                "util_max_pct": max(s["util_pct"] for s in self.samples),
                "power_max_w": max(s["power_w"] for s in self.samples),
                "n_samples": len(self.samples)}


ENGINE_PS = r"""
$s = (Get-Counter '\GPU Engine(*)\Utilization Percentage' -ErrorAction SilentlyContinue).CounterSamples | Where-Object { $_.CookedValue -gt 0.5 }
foreach ($x in $s) { $i = [regex]::Match($x.InstanceName, 'pid_(\d+)').Groups[1].Value; $p = Get-Process -Id $i -ErrorAction SilentlyContinue; "{0:N1}|{1}|{2}|{3}" -f $x.CookedValue, $i, $p.ProcessName, ($x.InstanceName -replace '.*engtype_','') }
"""


def gpu_engines():
    """Windows のパフォーマンスカウンタからプロセス別・エンジン別の GPU 使用率を取る。"""
    out = subprocess.run(["powershell", "-NoProfile", "-Command", ENGINE_PS], capture_output=True, text=True,
                         errors="replace").stdout
    rows = []
    for l in out.splitlines():
        parts = l.strip().split("|")
        if len(parts) == 4:
            rows.append({"pct": float(parts[0]), "pid": parts[1], "proc": parts[2], "engine": parts[3]})
    return rows


def wait_gpu_idle(max_wait_s=3600):
    """他の重い GPU 処理がないことを確認する。
    WDDM ではデスクトップアプリも compute-apps に並ぶので、(1) 他プロセスの 3D/Compute エンジン使用率の合計、
    (2) VRAM 使用量（普段のデスクトップは約 2GB。4.5GB 超なら別モデル等が載っているとみなす）、
    (3) 他の LLM サーバ等の実行ファイル名、で判定する。動画再生のデコード（VideoDecode）は SM を使わないので除外。"""
    waited = 0
    while True:
        samples = []
        for _ in range(8):
            samples.append(gpu_query()); time.sleep(0.25)
        util = max(s["util_pct"] for s in samples)
        mem = max(s["mem_used_mib"] for s in samples)
        eng = gpu_engines()
        load3d = sum(e["pct"] for e in eng if e["engine"].lower().startswith(("3d", "compute", "cuda")))
        heavy = heavy_procs()
        if load3d <= 15 and mem <= 4500 and not heavy:
            s = samples[-1]; s["util_max_2s"] = util; s["waited_s"] = waited
            s["engines"] = eng; s["other_3d_compute_pct"] = round(load3d, 1)
            return s
        log(f"GPU busy (3d/compute={load3d:.0f}%, nvsmi util={util}%, mem={mem}MiB, heavy={heavy}) -> wait 30s")
        time.sleep(30); waited += 30
        if waited > max_wait_s:
            raise RuntimeError("GPU stayed busy")


# ---------------- server ----------------
def model_path(m):
    return m.get("local") or f"{MODEL_DIR}/{m['file']}"


def server_cmd(m, llama_dir=LLAMA_DIR):
    cmd = [f"{llama_dir}/llama-server.exe", "-m", model_path(m), "--host", "127.0.0.1", "--port", str(PORT),
           "-c", str(CTX), "-fa", "auto", "-lv", "4", "-np", "1", "-cram", "0"]
    if m["group"] == "vram":
        cmd += ["-ngl", "all", "--fit", "off"]
    else:
        cmd += ["--fit", "on", "-fitc", str(CTX)]
    return cmd + m.get("args", [])


def http(method, path, body=None, timeout=600):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def start_server(m, tag):
    logf = os.path.join(LOGS, f"server_{m['id']}_{tag}.log")
    fh = open(logf, "w", encoding="utf-8", errors="replace")
    cmd = server_cmd(m)
    t0 = time.perf_counter()
    proc = subprocess.Popen(cmd, stdout=fh, stderr=subprocess.STDOUT)
    while True:
        if proc.poll() is not None:
            fh.close()
            raise RuntimeError(f"server exited code={proc.returncode}; see {logf}")
        try:
            with urllib.request.urlopen(BASE + "/health", timeout=2) as r:
                if r.status == 200:
                    break
        except Exception:
            pass
        if time.perf_counter() - t0 > 900:
            proc.kill(); raise RuntimeError("load timeout")
        time.sleep(0.05)
    load_s = time.perf_counter() - t0
    return proc, load_s, logf, cmd


def stop_server(proc):
    proc.terminate()
    try:
        proc.wait(timeout=30)
    except Exception:
        proc.kill(); proc.wait()
    time.sleep(3)


def parse_offload(logf):
    txt = open(logf, encoding="utf-8", errors="replace").read()
    info = {}
    mm = re.findall(r"offloaded (\d+)/(\d+) layers to GPU", txt)
    if mm:
        info["gpu_layers"], info["total_layers"] = int(mm[-1][0]), int(mm[-1][1])
    mm = re.findall(r"n_cpu_moe\s*=\s*(\d+)", txt)
    if mm:
        info["n_cpu_moe"] = int(mm[-1])
    mm = re.findall(r"CUDA0 model buffer size\s*=\s*([\d.]+) MiB", txt)
    if mm:
        info["cuda_model_buffer_mib"] = float(mm[-1])
    mm = re.findall(r"CPU_Mapped model buffer size\s*=\s*([\d.]+) MiB", txt)
    if mm:
        info["cpu_model_buffer_mib"] = sum(float(x) for x in mm)
    info["flash_attn"] = "off (unsupported)" if "Flash Attention not supported" in txt else "on"
    mm = re.findall(r"CUDA0 KV buffer size\s*=\s*([\d.]+) MiB", txt)
    if mm:
        info["cuda_kv_mib"] = float(mm[-1])
    mm = re.findall(r"CUDA0 compute buffer size\s*=\s*([\d.]+) MiB", txt)
    if mm:
        info["cuda_compute_mib"] = float(mm[-1])
    fit = re.findall(r"llama_params_fit.*|fit_params.*|common_fit.*", txt)
    if fit:
        info["fit_log"] = fit[-6:]
    return info


# ---------------- requests ----------------
def chat_stream(messages, max_tokens):
    body = {"messages": messages, "max_tokens": max_tokens, "temperature": 0, "stream": True,
            "cache_prompt": False, "seed": 42}
    req = urllib.request.Request(BASE + "/v1/chat/completions", data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json"})
    t0 = time.perf_counter(); t_first = None; t_last = None
    content, reasoning = [], []; timings = None; n_chunks = 0; finish = None
    with urllib.request.urlopen(req, timeout=1200) as r:
        for raw in r:
            line = raw.decode("utf-8", errors="replace").strip()
            if not line.startswith("data:"):
                continue
            payload = line[5:].strip()
            if payload == "[DONE]":
                break
            j = json.loads(payload)
            if "timings" in j:
                timings = j["timings"]
            for ch in j.get("choices", []):
                d = ch.get("delta", {}) or {}
                piece_c = d.get("content") or ""
                piece_r = d.get("reasoning_content") or ""
                if piece_c or piece_r:
                    now = time.perf_counter()
                    if t_first is None:
                        t_first = now
                    t_last = now; n_chunks += 1
                content.append(piece_c); reasoning.append(piece_r)
                if ch.get("finish_reason"):
                    finish = ch["finish_reason"]
    t_end = time.perf_counter()
    c = "".join(content); rz = "".join(reasoning)
    res = {"ttft_ms_client": (t_first - t0) * 1000 if t_first else None,
           "total_ms_client": (t_end - t0) * 1000,
           "stream_gen_s_client": (t_last - t_first) if t_first and t_last else None,
           "n_chunks": n_chunks, "finish_reason": finish, "timings": timings,
           "content": c, "reasoning": rz,
           "content_chars_nows": len(re.sub(r"\s", "", c)),
           "reasoning_chars_nows": len(re.sub(r"\s", "", rz))}
    if timings and res["stream_gen_s_client"]:
        res["gen_tps_client"] = (timings["predicted_n"] - 1) / res["stream_gen_s_client"]
    return res


def chat_once(messages, max_tokens):
    body = {"messages": messages, "max_tokens": max_tokens, "temperature": 0, "seed": 42, "cache_prompt": True}
    t0 = time.perf_counter()
    j = http("POST", "/v1/chat/completions", body, timeout=1800)
    msg = j["choices"][0]["message"]
    return {"content": msg.get("content") or "", "reasoning": msg.get("reasoning_content") or "",
            "finish_reason": j["choices"][0].get("finish_reason"), "timings": j.get("timings"),
            "wall_ms": (time.perf_counter() - t0) * 1000}


def count_tokens(text):
    j = http("POST", "/tokenize", {"content": text, "add_special": False})
    return len(j["tokens"])


def speed_prompts():
    out = {}
    out["short"] = PROMPTS["short"]["messages"]
    out["summary"] = [{"role": "user", "content": PROMPTS["summary"]["prefix"] + KUMO}]
    out["chat"] = PROMPTS["chat"]["messages"]
    return out


# ---------------- speed ----------------
def run_speed(mid, cycles=3):
    m = MODELS[mid]
    prompts = speed_prompts()
    result = {"model": mid, "started": time.strftime("%Y-%m-%d %H:%M:%S"), "cycles": []}
    for cyc in range(cycles):
        pre = wait_gpu_idle()
        log(mid, f"cycle {cyc+1}: baseline mem={pre['mem_used_mib']}MiB temp={pre['temp_c']}C util={pre['util_max_2s']}%")
        proc, load_s, logf, cmd = start_server(m, f"speed{cyc+1}")
        try:
            time.sleep(1.0)
            after_load = gpu_query()
            tok = {"kumo_chars": len(KUMO), "kumo_tokens": count_tokens(KUMO),
                   "modern_chars": len(PROMPTS["modern_text"]), "modern_tokens": count_tokens(PROMPTS["modern_text"])}
            cyc_res = {"cycle": cyc + 1, "baseline": pre, "load_s": load_s, "after_load": after_load,
                       "vram_model_loaded_mib": after_load["mem_used_mib"] - pre["mem_used_mib"],
                       "tokenizer": tok, "offload": parse_offload(logf), "cmd": cmd, "requests": {}}
            samp = Sampler(); samp.start()
            for key, msgs in prompts.items():
                r = chat_stream(msgs, PROMPTS[key]["max_tokens"])
                t = r["timings"] or {}
                log(mid, key, f"pp={t.get('prompt_n')}tok {t.get('prompt_per_second',0):.0f}t/s ttft={r['ttft_ms_client']:.0f}ms "
                    f"gen={t.get('predicted_n')}tok {t.get('predicted_per_second',0):.1f}t/s (client {r.get('gen_tps_client',0):.1f})")
                cyc_res["requests"][key] = r
            cyc_res["gpu_during"] = samp.stop()
            cyc_res["vram_peak_mib"] = cyc_res["gpu_during"]["mem_peak_mib"] - pre["mem_used_mib"]
        finally:
            stop_server(proc)
        result["cycles"].append(cyc_res)
    result["finished"] = time.strftime("%Y-%m-%d %H:%M:%S")
    json.dump(result, open(os.path.join(RAW, f"speed_{mid}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    log(mid, "speed done")


# ---------------- quality ----------------
DS = os.path.join(ROOT, "datasets")


def load_jcqa(n=100, seed=42):
    rows = [json.loads(l) for l in open(os.path.join(DS, "jcqa_valid.json"), encoding="utf-8")]
    rnd = random.Random(seed)
    return rnd.sample(rows, n)


def load_mmmlu(n=100, seed=42):
    rows = list(csv.DictReader(open(os.path.join(DS, "mmmlu_ja.csv"), encoding="utf-8")))
    rnd = random.Random(seed)
    return rnd.sample(rows, n)


def load_elyza(n=20, seed=42):
    rows = list(csv.DictReader(open(os.path.join(DS, "elyza_tasks_100.csv"), encoding="utf-8")))
    for i, r in enumerate(rows):
        r["idx"] = i
    rnd = random.Random(seed)
    return sorted(rnd.sample(rows, n), key=lambda r: r["idx"])


def jcqa_prompt(r):
    ch = "\n".join(f"{i}. {r[f'choice{i}']}" for i in range(5))
    return ("次の質問に対する答えとして最も適切なものを、選択肢の番号（0〜4）から1つ選んでください。"
            "番号だけを答えてください。\n\n" f"質問：{r['question']}\n選択肢：\n{ch}\n\n答え：")


def mmmlu_prompt(r):
    ch = "\n".join(f"{k}. {r[k]}" for k in "ABCD")
    return ("次の問題の正解を A、B、C、D から1つ選び、記号だけを答えてください。\n\n"
            f"問題：{r['Question']}\n{ch}\n\n答え：")


Z2H = str.maketrans("０１２３４５６７８９ＡＢＣＤ", "0123456789ABCD")


def parse_digit(text):
    t = text.translate(Z2H)
    m = re.search(r"(?<!\d)([0-4])(?!\d)", t)
    return int(m.group(1)) if m else None


def parse_letter(text):
    t = text.translate(Z2H)
    m = re.search(r"(?<![A-Za-z])([ABCD])(?![A-Za-z])", t)
    return m.group(1) if m else None


def mc_max_tokens(m):
    return 1024 + 64 if m["think"] == "on" else 32


def run_quality(mid):
    m = MODELS[mid]
    pre = wait_gpu_idle()
    proc, load_s, logf, cmd = start_server(m, "quality")
    out = {"model": mid, "started": time.strftime("%Y-%m-%d %H:%M:%S"), "baseline": pre, "cmd": cmd,
           "offload": parse_offload(logf), "jcqa": [], "mmmlu": [], "elyza": []}
    try:
        for r in load_jcqa():
            res = chat_once([{"role": "user", "content": jcqa_prompt(r)}], mc_max_tokens(m))
            pred = parse_digit(res["content"])
            out["jcqa"].append({"q_id": r["q_id"], "gold": r["label"], "pred": pred, "correct": pred == r["label"],
                                "raw": res["content"][:200], "reasoning_chars": len(res["reasoning"]),
                                "finish": res["finish_reason"], "pred_n": (res["timings"] or {}).get("predicted_n")})
        log(mid, "jcqa acc", sum(x["correct"] for x in out["jcqa"]))
        for r in load_mmmlu():
            res = chat_once([{"role": "user", "content": mmmlu_prompt(r)}], mc_max_tokens(m))
            pred = parse_letter(res["content"])
            out["mmmlu"].append({"row": int(r[""]), "subject": r["Subject"], "gold": r["Answer"], "pred": pred,
                                 "correct": pred == r["Answer"], "raw": res["content"][:200],
                                 "reasoning_chars": len(res["reasoning"]), "finish": res["finish_reason"],
                                 "pred_n": (res["timings"] or {}).get("predicted_n")})
        log(mid, "mmmlu acc", sum(x["correct"] for x in out["mmmlu"]))
        mt = 2048 if m["think"] == "on" else 1024
        for r in load_elyza():
            res = chat_once([{"role": "user", "content": r["input"]}], mt)
            out["elyza"].append({"idx": r["idx"], "content": res["content"], "reasoning_chars": len(res["reasoning"]),
                                 "finish": res["finish_reason"], "timings": res["timings"]})
        log(mid, "elyza done")
    finally:
        stop_server(proc)
    out["finished"] = time.strftime("%Y-%m-%d %H:%M:%S")
    json.dump(out, open(os.path.join(RAW, f"quality_{mid}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


# ---------------- llama-bench ----------------
def run_llamabench(mid):
    m = MODELS[mid]
    wait_gpu_idle()
    off = json.load(open(os.path.join(RAW, f"speed_{mid}.json"), encoding="utf-8"))["cycles"][0]["offload"]
    fa = "1" if off.get("flash_attn") == "on" else "0"
    cmd = [f"{LLAMA_DIR}/llama-bench.exe", "-m", model_path(m), "-fa", fa, "-p", "512", "-n", "128", "-r", "3", "-o", "json"]
    if m["group"] == "vram":
        cmd += ["-ngl", "99"]
    else:
        # サーバーと同じく llama.cpp の自動配置（空きを 1024MiB 残す）に任せる
        cmd += ["-fitt", "1024", "-fitc", str(CTX)]
    log("llama-bench", " ".join(cmd))
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    try:
        data = json.loads(p.stdout)
    except Exception:
        data = {"stdout": p.stdout[-3000:], "stderr": p.stderr[-3000:]}
    json.dump({"model": mid, "cmd": cmd, "result": data}, open(os.path.join(RAW, f"llamabench_{mid}.json"), "w",
              encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    what, mid = sys.argv[1], sys.argv[2]
    {"speed": run_speed, "quality": run_quality, "llamabench": run_llamabench}[what](mid)
