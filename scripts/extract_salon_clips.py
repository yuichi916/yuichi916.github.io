#!/usr/bin/env python3
"""Extract 30-second representative clips from each artist's folder.

For each (genre, artist) in the salon classification:
  1. Locate artist folder in P:/My Music/Lossless/<genre>/
  2. Find first audio file (FLAC/WAV/APE/MP3/M4A) — recurse if needed
  3. Get track duration via ffprobe
  4. Cut a 30s slice from ~45% mark (likely chorus area)
  5. Add 1s fade in/out, encode to 96kbps mono MP3
  6. Save to LOCAL_OUT/<slug>.mp3 with deterministic filename
Output: clips_manifest.json mapping artist_name → mp3 relative path.
"""
import json, re, sys, io, subprocess, hashlib, importlib.util, os
LOG = open("C:/tmp/salon_clips_extract.log", "a", encoding="utf-8")
def plog(*a):
    msg = " ".join(str(x) for x in a)
    LOG.write(msg + "\n"); LOG.flush()
print = plog
from pathlib import Path

ROOT = Path("P:/My Music/Lossless")
LOCAL_OUT = Path("C:/tmp/salon_clips")
LOCAL_OUT.mkdir(exist_ok=True)
MANIFEST = Path("C:/tmp/salon_clips_manifest.json")

CLIP_DURATION = 30.0      # seconds of clip
FADE = 1.0                 # fade in/out seconds
START_FRAC = 0.45          # cut starting at 45% of track duration
BITRATE = "96k"
SAMPLE_RATE = "44100"

GENERATOR = Path(__file__).parent / "generate_salon_map.py"
ADDITIONS_FILE = Path(__file__).parent / "salon_additions.py"

# Map slug to actual genre folder name (used in P:/My Music/Lossless/)
GENRE_FOLDER = {
    "ambient": "Ambient",
    "anime": "Anime",
    "blues-folk": "Blues&Fork",
    "celt": "Celt&Fantasy&Violin",
    "classic": "Classic",
    "game": "Game",
    "healing": "Healing＆New_age",
    "indies": "Indies",
    "jazz": "Jazz&Fusion",
    "jpop": "JPOP",
    "metal": "Metal&Hard_rock",
    "nature": "Nature",
    "pop-rock": "POP&Rock",
    "progressive": "Progressive",
}

AUDIO_EXTS = {".flac", ".wav", ".ape", ".mp3", ".m4a", ".tta", ".tak", ".dsf", ".dff", ".aiff"}


def slug_artist(name):
    """Generate filesystem-safe slug from artist name."""
    s = re.sub(r"[^\w぀-ゟ゠-ヿ一-鿿_-]", "_", name)
    s = re.sub(r"_+", "_", s).strip("_")
    if not s:
        s = hashlib.md5(name.encode()).hexdigest()[:8]
    # Limit to 60 chars + hash to avoid filesystem issues
    if len(s) > 60:
        s = s[:50] + "_" + hashlib.md5(name.encode()).hexdigest()[:8]
    return s


def find_artist_folder(genre_dir, artist_name):
    """Find the actual folder in genre_dir matching artist_name (or close)."""
    if not genre_dir.exists():
        return None
    artist_lower = artist_name.lower()
    artist_simple = re.sub(r"[^\w]", "", artist_lower)
    candidates = []
    for child in genre_dir.iterdir():
        if not child.is_dir():
            continue
        cn = child.name.lower()
        cn_simple = re.sub(r"[^\w]", "", cn)
        # Exact match
        if cn == artist_lower or cn_simple == artist_simple:
            return child
        # Starts-with match
        if cn.startswith(artist_lower) or cn_simple.startswith(artist_simple):
            candidates.append(child)
        # Contains (after stripping common prefixes from cn)
        cn2 = re.sub(r"^[\[\(]?\d{4,8}[\)\]\.\s\-]+", "", cn).strip()
        cn2_simple = re.sub(r"[^\w]", "", cn2.lower())
        if cn2_simple.startswith(artist_simple) or artist_simple in cn2_simple:
            candidates.append(child)
    return candidates[0] if candidates else None


def find_audio_file(folder, max_depth=3):
    """Find first audio file in folder (DFS)."""
    if not folder.exists():
        return None
    queue = [(folder, 0)]
    found = []
    while queue:
        d, depth = queue.pop(0)
        try:
            entries = sorted(d.iterdir(), key=lambda p: p.name.lower())
        except Exception:
            continue
        for e in entries:
            if e.is_file() and e.suffix.lower() in AUDIO_EXTS:
                # Skip if filename starts with hidden / system markers
                if e.name.startswith(".") or e.name.startswith("~"):
                    continue
                found.append(e)
            elif e.is_dir() and depth < max_depth:
                queue.append((e, depth + 1))
        if found:
            # Heuristic: skip track 01 if there's a track 02 (intros are often skippable)
            # but only if we have multiple tracks in same dir
            if len(found) > 1:
                # Try to find a track number > 01
                for f in found[1:4]:  # check first few
                    if re.search(r"(?:^|\s|_|-)0?[2-5][_\.\-\s]", f.name):
                        return f
            return found[0]
    return None


def ffprobe_duration(path):
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=20
        )
        return float(r.stdout.strip())
    except Exception:
        return None


def extract_clip(audio_path, out_mp3, start_sec, dur=CLIP_DURATION, fade=FADE):
    """Cut a clip with fade in/out, encode to MP3."""
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-ss", f"{start_sec:.2f}",
        "-i", str(audio_path),
        "-t", f"{dur:.2f}",
        "-af", f"afade=t=in:st=0:d={fade},afade=t=out:st={dur-fade:.2f}:d={fade}",
        "-ac", "1",  # mono
        "-ar", SAMPLE_RATE,
        "-b:a", BITRATE,
        "-codec:a", "libmp3lame",
        str(out_mp3)
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    return r.returncode == 0


def load_genres():
    """Load GENRES dict + apply ADDITIONS."""
    spec = importlib.util.spec_from_file_location("gen", GENERATOR)
    gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)
    data, _ = gen.build_data()
    return data


def main():
    # Try to resume — load existing manifest
    manifest = {}
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        print(f"Resuming: {len(manifest)} clips already done")

    data = load_genres()

    # Flatten: list of (genre_slug, artist_name, subgroup_name) where artist appears once
    # (dedup across subgroups — first occurrence wins)
    seen = set()
    tasks = []
    for slug, g in data.items():
        for sg in g["subgroups"]:
            for a in sg["artists"]:
                key = (slug, a)
                if key in seen:
                    continue
                seen.add(key)
                tasks.append((slug, a))
    print(f"Total artist tasks: {len(tasks)}")

    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading
    lock = threading.Lock()
    counts = {"ok":0, "fail":0, "skip":0}

    def process_one(slug, artist):
        a_slug = slug_artist(artist)
        out_name = f"{slug}__{a_slug}.mp3"
        manifest_key = f"{slug}::{artist}"

        if manifest_key in manifest and (LOCAL_OUT / manifest[manifest_key].get("file","")).exists():
            return manifest_key, {"_skip": True}

        out_mp3 = LOCAL_OUT / out_name
        if out_mp3.exists() and out_mp3.stat().st_size > 1000:
            return manifest_key, {"file": out_name, "status": "ok", "_skip": True}

        genre_dir = ROOT / GENRE_FOLDER[slug]
        afolder = find_artist_folder(genre_dir, artist)
        if afolder is None:
            return manifest_key, {"status": "no_folder"}

        audio = find_audio_file(afolder)
        if audio is None:
            return manifest_key, {"status": "no_audio", "folder": afolder.name}

        dur = ffprobe_duration(audio)
        if not dur or dur < CLIP_DURATION + 5:
            start = 0.5
            actual_dur = max(5, min(CLIP_DURATION, (dur or CLIP_DURATION) - 1))
        else:
            start = dur * START_FRAC
            actual_dur = CLIP_DURATION

        try:
            ok = extract_clip(audio, out_mp3, start, dur=actual_dur)
        except Exception:
            ok = False

        if ok and out_mp3.exists() and out_mp3.stat().st_size > 1000:
            return manifest_key, {
                "file": out_name,
                "source": str(audio.relative_to(ROOT)),
                "src_dur": round(dur, 1) if dur else None,
                "clip_start": round(start, 1),
                "clip_dur": round(actual_dur, 1),
                "status": "ok"
            }
        return manifest_key, {"status": "ffmpeg_fail", "audio": str(audio.name)}

    todo = []
    for slug, artist in tasks:
        a_slug = slug_artist(artist)
        manifest_key = f"{slug}::{artist}"
        out_name = f"{slug}__{a_slug}.mp3"
        out_path = LOCAL_OUT / out_name
        if manifest_key in manifest and (LOCAL_OUT / manifest[manifest_key].get("file","")).exists():
            counts["skip"] += 1
            continue
        if out_path.exists() and out_path.stat().st_size > 1000:
            manifest[manifest_key] = {"file": out_name, "status": "ok"}
            counts["skip"] += 1
            continue
        todo.append((slug, artist))

    print(f"  to do: {len(todo)} (already done/skip: {counts['skip']})")
    completed = 0

    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = [ex.submit(process_one, s, a) for s, a in todo]
        for fut in as_completed(futures):
            try:
                key, result = fut.result()
            except Exception as e:
                continue
            with lock:
                completed += 1
                if result.get("_skip"):
                    counts["skip"] += 1
                    if not result.get("file"):
                        manifest[key] = {k:v for k,v in result.items() if k != "_skip"}
                elif result.get("status") == "ok":
                    counts["ok"] += 1
                    manifest[key] = result
                else:
                    counts["fail"] += 1
                    manifest[key] = result
                if completed % 25 == 0:
                    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
                if completed % 25 == 0:
                    print(f"  [{completed}/{len(todo)}]  ok={counts['ok']} fail={counts['fail']} skip={counts['skip']}")

    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nDone: ok={counts['ok']} fail={counts['fail']} skip={counts['skip']}  (manifest: {MANIFEST})")


if __name__ == "__main__":
    main()
