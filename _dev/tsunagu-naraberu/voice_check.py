"""声の書き起こし検査: faster-whisper で日本語として書き起こし、台詞と並べて表示する（英語読み・読み飛ばしの検出）。
使い方: python voice_check.py <id> [<id> ...]
"""
import json, pathlib, subprocess, sys
from faster_whisper import WhisperModel

ROOT = pathlib.Path(__file__).resolve().parents[2]
ASSET = ROOT / "assets" / "tsunagu-naraberu"


def lines_from_js():
    js = "import('file:///' + process.argv[1].replace(/\\\\/g, '/')).then(m => console.log(JSON.stringify(m.CHARACTERS)))"
    out = subprocess.run(["node", "-e", js, str(ASSET / "characters.js")], capture_output=True, text=True, encoding="utf-8", check=True)
    return {c["id"]: c["lines"] for c in json.loads(out.stdout)}


def main():
    lines = lines_from_js()
    model = WhisperModel("small", device="cpu", compute_type="int8")  # GPU は画像生成が使っている
    out = []
    for cid in sys.argv[1:]:
        for key, text in lines[cid].items():
            p = ASSET / "voice" / f"{cid}_{key}.mp3"
            if not p.exists():
                continue
            segs, info = model.transcribe(str(p), language=None, beam_size=5)
            got = "".join(s.text for s in segs).strip()
            out.append({"id": cid, "key": key, "line": text, "heard": got, "lang": info.language, "p": round(info.language_probability, 2)})
    path = ROOT / "_dev" / "tsunagu-naraberu" / "voice_check.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print("wrote", path, len(out))


if __name__ == "__main__":
    main()
