# -*- coding: utf-8 -*-
"""公式サイトからの事実抽出を、まとめて回す。

抽出そのものは codex CLI（gpt-5.6-luna）にやらせる。ここがやるのは、
仕事を分けて、並べて走らせて、落ちたところから再開できるようにすること。

再開可能であることが要件。数時間かかる仕事が途中で止まったとき、
最初からやり直すと金も時間も倍かかる。**結果ファイルがあるバッチは飛ばす**。

  # 1) 仕事を作る（対象の切り出しとバッチ分割）
  python scripts/hitori/run_extract.py plan --out <作業dir>
  # 2) 回す（何度でも再実行してよい。終わっていないバッチだけ走る）
  python scripts/hitori/run_extract.py run --dir <作業dir> --jobs 8
  # 3) 進み具合
  python scripts/hitori/run_extract.py stat --dir <作業dir>
"""
import argparse, json, os, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "hitori"
# 自動アクセスを禁じている/店舗個別情報が無いドメイン。仕事に入れる前に外す
# （入れても non_official_url が返るだけで、1施設ぶんの手番を無駄にする）
SKIP_DOMAINS = ("tabelog.com", "sauna-ikitai.com", "retty.me", "instagram.com",
                "x.com", "twitter.com", "facebook.com", "goope.jp", "line.me")
# この6項目のどれかを公式の根拠で持っていれば、その施設はもう聞きに行かない
SIGNALS = {"solo_ok", "counter_seats", "seats_total", "payment_method",
           "reservation", "silence", "access"}
BATCH = 10
# Windows では PATH 上の codex は .cmd ラッパー。subprocess は shell 無しだと
# 拡張子を補ってくれないので、実体を先に解決しておく。
CODEX = shutil.which("codex") or shutil.which("codex.cmd") or "codex"


def targets():
    """まだ公式の裏付けが無い、公式URLつきの施設を返す。"""
    curated = json.loads((DATA / "curated.json").read_text(encoding="utf-8"))
    done = {fid for fid, e in curated.items()
            if any(f.get("official") and f.get("k") in SIGNALS for f in e.get("facts", []))}
    out, skipped = [], 0
    for path in sorted((DATA / "pref").glob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        fields = doc["fields"]
        for row in doc["items"]:
            r = dict(zip(fields, row))
            web = (r.get("web") or "").strip()
            if not web.startswith("http") or r["id"] in done:
                continue
            if any(d in web for d in SKIP_DOMAINS):
                skipped += 1
                continue
            out.append({k: r[k] for k in ("id", "name", "cat", "kind", "city", "web", "oh")}
                       | {"pref": int(doc["pref"])})
    return out, skipped


def cmd_plan(args):
    work = Path(args.out)
    (work / "batch").mkdir(parents=True, exist_ok=True)
    (work / "result").mkdir(parents=True, exist_ok=True)
    (work / "log").mkdir(parents=True, exist_ok=True)
    items, skipped = targets()
    # 県ごとにまとめず散らす。途中で止めても全国が薄く進んだ状態になるほうが、
    # 1県だけ濃くて他が空よりも、地図として見られる状態に早く着く。
    items.sort(key=lambda r: (r["id"] % 97 if isinstance(r["id"], int) else hash(r["id"]) % 97, r["pref"]))
    n = 0
    for i in range(0, len(items), BATCH):
        chunk = items[i:i + BATCH]
        (work / "batch" / f"{i // BATCH:04d}.json").write_text(
            json.dumps(chunk, ensure_ascii=False, indent=1), encoding="utf-8")
        n += 1
    print(f"対象 {len(items):,} 施設 / バッチ {n} 本（各{BATCH}件）")
    print(f"取得を禁じているドメインとして外した施設: {skipped:,}")
    print(f"作業場所: {work}")


def run_one(work, prompt, name, model, timeout):
    res = work / "result" / f"{name}.json"
    if res.exists() and res.stat().st_size > 2:
        return name, "skip", 0
    started = time.time()
    log = work / "log" / f"{name}.jsonl"
    cmd = [CODEX, "exec", "--skip-git-repo-check", "-s", "workspace-write",
           "-C", str(work), "-m", model, "--json",
           f"{prompt} を読み、その指示に厳密に従ってください。"
           f"BATCH_FILE = {work / 'batch' / (name + '.json')}、OUT_FILE = {res}。"
           f"最後に必ず OUT_FILE を書くこと。"]
    try:
        with log.open("w", encoding="utf-8", errors="replace") as fh:
            subprocess.run(cmd, stdout=fh, stderr=subprocess.STDOUT, timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        return name, "timeout", time.time() - started
    ok = res.exists() and res.stat().st_size > 2
    return name, "ok" if ok else "nofile", time.time() - started


def cmd_run(args):
    work = Path(args.dir)
    prompt = Path(args.prompt).resolve()
    names = sorted(p.stem for p in (work / "batch").glob("*.json"))
    todo = [n for n in names
            if not ((work / "result" / f"{n}.json").exists()
                    and (work / "result" / f"{n}.json").stat().st_size > 2)]
    print(f"バッチ {len(names)} 本 / 未了 {len(todo)} 本 / 同時 {args.jobs}", flush=True)
    done = {"ok": 0, "nofile": 0, "timeout": 0, "skip": 0}
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.jobs) as ex:
        futs = [ex.submit(run_one, work, prompt, n, args.model, args.timeout) for n in todo]
        for i, f in enumerate(futs, 1):
            name, status, sec = f.result()
            done[status] += 1
            rate = (time.time() - t0) / max(i, 1)
            left = rate * (len(todo) - i) / 60
            print(f"[{i}/{len(todo)}] {name} {status} {sec:.0f}s "
                  f"ok={done['ok']} 失敗={done['nofile'] + done['timeout']} 残り約{left:.0f}分", flush=True)
    print("完了:", done)


def cmd_stat(args):
    work = Path(args.dir)
    names = sorted(p.stem for p in (work / "batch").glob("*.json"))
    got = [p for p in (work / "result").glob("*.json") if p.stat().st_size > 2]
    n_fac = n_sig = n_ok = 0
    for p in got:
        try:
            rows = json.loads(p.read_text(encoding="utf-8"))["results"]
        except Exception:
            continue
        n_fac += len(rows)
        n_ok += sum(1 for r in rows if r.get("status") == "ok")
        n_sig += sum(1 for r in rows for f in r.get("facts", []) if f.get("k") in SIGNALS)
    print(f"バッチ {len(got)}/{len(names)} 本 完了")
    print(f"施設 {n_fac:,} 件処理 / 取得成功 {n_ok:,} / 6項目の信号 {n_sig:,}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("plan"); p.add_argument("--out", required=True); p.set_defaults(fn=cmd_plan)
    r = sub.add_parser("run")
    r.add_argument("--dir", required=True)
    r.add_argument("--prompt", required=True)
    r.add_argument("--jobs", type=int, default=8)
    r.add_argument("--model", default="gpt-5.6-luna")
    r.add_argument("--timeout", type=int, default=1500)
    r.set_defaults(fn=cmd_run)
    s = sub.add_parser("stat"); s.add_argument("--dir", required=True); s.set_defaults(fn=cmd_stat)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
