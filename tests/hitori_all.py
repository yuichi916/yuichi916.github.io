# -*- coding: utf-8 -*-
"""ひとり歓迎マップの全テストを順に実行する。"""
import subprocess, sys, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TESTS = [
    "hitori_master_test.py",
    "hitori_scoring_test.py",
    "hitori_osm_query_test.py",
    "hitori_normalize_test.py",
    "hitori_validate_test.py",
    "hitori_build_test.py",
    "hitori_mapsvg_test.py",
    "hitori_ingest_test.py",
    "hitori_queue_test.py",
    "hitori_render_test.py",   # Playwright を使うので最後
]


def main():
    env = dict(os.environ, PYTHONUTF8="1")
    failed = []
    for t in TESTS:
        print(f"\n=== {t} ===", flush=True)
        r = subprocess.run([sys.executable, str(ROOT / "tests" / t)], env=env)
        if r.returncode != 0:
            failed.append(t)
    print("\n" + "=" * 40)
    if failed:
        print(f"FAILED: {failed}")
        sys.exit(1)
    print(f"ALL PASS ({len(TESTS)} suites)")


if __name__ == "__main__":
    main()
