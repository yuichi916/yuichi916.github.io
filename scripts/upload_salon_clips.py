#!/usr/bin/env python3
"""Upload salon clips to pCloud Public Folder/salon-clips/ via rclone +
get publink code + build artist→fileid mapping JSON.

Output:
  C:/tmp/salon_clips_pcloud.json — {publink_code, mapping: {artist_name: fileid}}
This JSON is consumed by generate_salon_map.py to embed in salon.html.
"""
import json, subprocess, requests, time, importlib.util, sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from pathlib import Path

CLIPS_DIR = Path("C:/tmp/salon_clips")
MANIFEST_IN = Path("C:/tmp/salon_clips_manifest.json")
OUT = Path("C:/tmp/salon_clips_pcloud.json")
GENERATOR = Path(__file__).parent / "generate_salon_map.py"


def get_token():
    r = subprocess.run(["rclone", "config", "show", "pcloud"], capture_output=True, text=True)
    for line in r.stdout.splitlines():
        if line.strip().startswith("token"):
            d = json.loads(line.split("=", 1)[1].strip())
            return d["access_token"]
    raise RuntimeError("token not found")


TOKEN = get_token()
API = "https://api.pcloud.com"


def api_call(endpoint, **params):
    params["access_token"] = TOKEN
    r = requests.get(f"{API}/{endpoint}", params=params, timeout=30)
    r.raise_for_status()
    d = r.json()
    if d.get("result") != 0:
        raise RuntimeError(f"{endpoint} failed: {d}")
    return d


def main():
    # Step 1: ensure /Public Folder/salon-clips/ folder
    print("step 1: ensure /Public Folder/salon-clips/")
    pf = api_call("listfolder", path="/Public Folder")
    PF_ID = pf["metadata"]["folderid"]
    sc_id = None
    for c in pf["metadata"].get("contents", []):
        if c["name"] == "salon-clips" and c["isfolder"]:
            sc_id = c["folderid"]; break
    if not sc_id:
        r = api_call("createfolder", folderid=PF_ID, name="salon-clips")
        sc_id = r["metadata"]["folderid"]
    print(f"  salon-clips folderid: {sc_id}")

    # Step 2: upload local MP3s via rclone (idempotent)
    print("step 2: rclone copy local clips → pCloud")
    cmd = ["rclone", "copy", str(CLIPS_DIR), "pcloud:/Public Folder/salon-clips", "-P", "--checkers", "8", "--transfers", "8", "--min-size", "1k"]
    subprocess.run(cmd, check=True)

    # Step 3: list folder contents to get fileid for each .mp3
    print("step 3: list folder to map filename → fileid")
    listing = api_call("listfolder", folderid=sc_id)
    name_to_fid = {c["name"]: c["fileid"] for c in listing["metadata"].get("contents", []) if not c["isfolder"]}
    print(f"  files in salon-clips: {len(name_to_fid)}")

    # Step 4: get publink code for salon-clips folder
    print("step 4: get publink code")
    try:
        pl = api_call("getfolderpublink", folderid=sc_id)
        CODE = pl["code"]
    except Exception as e:
        # Try listpublinks if already exists
        print(f"  getfolderpublink failed: {e}; trying listpublinks")
        lp = api_call("listpublinks")
        CODE = None
        for link in lp.get("publinks", []):
            if link.get("metadata", {}).get("folderid") == sc_id:
                CODE = link["code"]; break
        if not CODE:
            raise RuntimeError("publink code not obtained")
    print(f"  publink code: {CODE}")

    # Step 5: build artist_name → fileid mapping using extraction manifest
    if not MANIFEST_IN.exists():
        print(f"  WARN: {MANIFEST_IN} not found — proceeding without artist names")
        manifest_data = {}
    else:
        manifest_data = json.loads(MANIFEST_IN.read_text(encoding="utf-8"))

    # manifest_data keys are "slug::artist_name", values include "file": "name.mp3"
    artist_to_fid = {}
    miss = []
    for k, v in manifest_data.items():
        if v.get("status") != "ok":
            continue
        fname = v.get("file")
        if not fname:
            continue
        fid = name_to_fid.get(fname)
        if fid is None:
            miss.append(fname)
            continue
        artist_to_fid[k] = fid

    print(f"  mapped: {len(artist_to_fid)}, missing in pCloud listing: {len(miss)}")

    OUT.write_text(json.dumps({
        "publink_code": CODE,
        "salon_clips_folderid": sc_id,
        "url_template_streaming_api": f"https://api.pcloud.com/getpubfilelink?code={CODE}&fileid=<FILEID>",
        "mapping": artist_to_fid,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSaved: {OUT}")
    print(f"  publink code: {CODE}")
    print(f"  mapped: {len(artist_to_fid)}")


if __name__ == "__main__":
    main()
