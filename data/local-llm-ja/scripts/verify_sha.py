# HF の LFS sha256 とダウンロードしたファイルを照合する
import json, hashlib, urllib.request, os
models = json.load(open("C:/tmp/llm-jp-bench/models.json", encoding="utf-8"))
res = {}
for m in models:
    path = m.get("local") or f"E:/ai/jpbench/models/{m['file']}"
    info = json.load(urllib.request.urlopen(f"https://huggingface.co/api/models/{m['repo']}?blobs=true"))
    s = next(x for x in info["siblings"] if x["rfilename"] == m["file"])
    want = (s.get("lfs") or {}).get("sha256")
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(16 << 20)
            if not b: break
            h.update(b)
    got = h.hexdigest()
    res[m["id"]] = {"file": m["file"], "size": os.path.getsize(path), "sha256": got, "hf_sha256": want, "match": got == want}
    print(m["id"], got == want, flush=True)
json.dump(res, open("C:/tmp/llm-jp-bench/raw/sha256.json", "w"), indent=1)
