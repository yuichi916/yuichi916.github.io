# -*- coding: utf-8 -*-
"""hitori-submission ラベルの GitHub Issue を curated.json に取り込む。

マージは自動だが無条件ではない。差分を表示して人が確認してから書き込む。
--yes を付けると確認を飛ばす。
"""
import argparse, json, re, subprocess, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CURATED = ROOT / "data" / "hitori" / "curated.json"

_ID_RE = re.compile(r"^[nwr]\d+$")
_SECTION_RE = re.compile(r"^###\s+(.+?)\s*$", re.M)
_NEGATIVE = "ひとり向きではなかった"
_NO_RESPONSE = "_No response_"


def _sections(body):
    """'### 見出し' で区切られた本文を {見出し: 中身} にする。"""
    out, parts = {}, _SECTION_RE.split(body or "")
    for i in range(1, len(parts) - 1, 2):
        out[parts[i].strip()] = parts[i + 1].strip()
    return out


def parse_issue_body(body):
    """issue本文 → {"id","polarity","claim"}。不正なら None。"""
    sec = _sections(body)
    fid = sec.get("施設ID", "").strip()
    if not fid or fid == _NO_RESPONSE or not _ID_RE.match(fid):
        return None
    claim = sec.get("根拠", "").strip()
    if not claim or claim == _NO_RESPONSE:
        return None
    verdict = sec.get("この施設はひとり向きですか", "").strip()
    return {
        "id": fid,
        "polarity": "-" if _NEGATIVE in verdict else "+",
        "claim": claim,
    }


def merge(curated, entries):
    """curated に evidence を追記する。同じ issue 番号は二重に入れない。"""
    out = json.loads(json.dumps(curated))  # 深いコピー。元の辞書は壊さない。
    changes = []
    for e in entries:
        rec = out.setdefault(e["id"], {})
        ev = rec.setdefault("evidence", [])
        eid = f"gh-issue-{e['issue']}"
        if any(x.get("id") == eid for x in ev):
            continue
        ev.append({
            "src": "user", "id": eid, "claim": e["claim"],
            "checked": e["checked"], "polarity": e["polarity"],
        })
        changes.append(f"{e['id']}  {e['polarity']}  {e['claim'][:40]}  (#{e['issue']})")
    return out, changes


def _fetch_issues():
    cmd = ["gh", "issue", "list", "--label", "hitori-submission",
           "--state", "open", "--limit", "200",
           "--json", "number,body"]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if res.returncode != 0:
        print(f"gh の実行に失敗しました: {res.stderr}")
        sys.exit(1)
    return json.loads(res.stdout)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--yes", action="store_true", help="確認せずに書き込む")
    ap.add_argument("--close", action="store_true", help="取り込んだ issue をクローズする")
    args = ap.parse_args()

    today = date.today().isoformat()
    entries, skipped = [], []
    for it in _fetch_issues():
        parsed = parse_issue_body(it.get("body"))
        if not parsed:
            skipped.append(it["number"])
            continue
        parsed.update(issue=it["number"], checked=today)
        entries.append(parsed)

    curated = json.loads(CURATED.read_text(encoding="utf-8")) if CURATED.exists() else {}
    new, changes = merge(curated, entries)

    if skipped:
        print(f"形式不正でスキップ: {skipped}")
    if not changes:
        print("取り込む変更はありません。")
        return

    print(f"\n{len(changes)} 件の変更:")
    for c in changes:
        print("  " + c)

    if not args.yes and input("\n書き込みますか [y/N]: ").strip().lower() != "y":
        print("中止しました。")
        return

    CURATED.write_text(json.dumps(new, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {CURATED}")

    if args.close:
        for e in entries:
            subprocess.run(["gh", "issue", "close", str(e["issue"]),
                            "--comment", "取り込みました。ありがとうございます。"],
                           capture_output=True, text=True)
            subprocess.run(["gh", "issue", "edit", str(e["issue"]),
                            "--add-label", "ingested"], capture_output=True, text=True)
    print("build_data.py を再実行してデータへ反映してください。")


if __name__ == "__main__":
    main()
