# -*- coding: utf-8 -*-
"""koe（『声を、あげる』）の全ゲートをまとめて回す唯一の入口。

    set PYTHONUTF8=1 && python tests/run_koe_tests.py

このリポジトリには CI も Makefile も無いので、計画書の「全テストを通す」手順が
そのまま実行手順を兼ねている。そこに書き漏らされたスイートは誰も回さない
＝ゲートとして存在しないのと同じになる（実際 tests/koe_dump_script_test.mjs は
どの実行手順にも載っておらず、一度も自動で回っていなかった）。
だから「どのスイートを回すか」をドキュメントではなくコードに置く。

素通り対策（このランナー自身が偽のGREENを出さないための決まり）:
  - 宣言したスイートが1本でも存在しなければエラーで落とす（消えたスイートを
    黙って飛ばさない）。
  - tests/koe_*.py と tests/koe_*.mjs を実際にglobし、宣言に載っていない
    スイートが1本でもあればエラーで落とす。新しいゲートを足して
    ここに登録し忘れる、が二度と起きないようにするため。
  - node が無い環境でも .mjs スイートを「スキップ」しない。回せないなら失敗。
  - 途中で失敗しても最後まで回して結果を並べる（1本直すたびに全部回し直さない）。
    終了コードは1本でも失敗があれば非0。
"""
import os
import subprocess
import sys
from pathlib import Path

TESTS = Path(__file__).resolve().parent
ROOT = TESTS.parents[0]

# ここが「回すゲートの一覧」の唯一の定義。追加したら必ずここに1行足す
# （足し忘れは下の _check_declared_covers_disk() が落とす）。
PY_SUITES = [
    "koe_synth_test.py",
    "koe_kana_test.py",
    "koe_audit_test.py",
    "koe_bgm_test.py",
    "koe_e2e_test.py",
]
NODE_SUITES = [
    "koe_dump_script_test.mjs",
]


def _check_declared_covers_disk():
    """宣言とディスク上の実体が食い違っていたら落とす。

    - 宣言したのに無い     → 消されたゲートを黙って飛ばしている
    - あるのに宣言していない → 誰も回していないゲートがある（＝今回の指摘そのもの）
    どちらも「静かに緑になる」形なので、ここで止める。
    """
    declared = set(PY_SUITES) | set(NODE_SUITES)
    missing = sorted(n for n in declared if not (TESTS / n).exists())
    if missing:
        raise SystemExit(
            "run_koe_tests: 宣言したスイートが見つからない: %s\n"
            "  消したのなら宣言からも消すこと。黙って飛ばさない。" % ", ".join(missing))

    # このランナー自身（run_koe_*）は対象外。koe_* だけを見る。
    on_disk = {p.name for p in TESTS.glob("koe_*.py")} | {p.name for p in TESTS.glob("koe_*.mjs")}
    unlisted = sorted(on_disk - declared)
    if unlisted:
        raise SystemExit(
            "run_koe_tests: 宣言に載っていない koe のテストがある: %s\n"
            "  PY_SUITES / NODE_SUITES に足すこと。"
            "誰も回さないゲートはゲートではない。" % ", ".join(unlisted))


def _run(argv, label):
    print("=" * 62)
    print("RUN  " + label)
    print("=" * 62, flush=True)
    try:
        rc = subprocess.call(argv, cwd=str(ROOT), env=dict(os.environ, PYTHONUTF8="1"))
    except FileNotFoundError as e:
        # node が無い等。「スキップ」にはしない——回せていないことは合格ではない。
        print("  実行できない: %s" % e, flush=True)
        return 127
    print("  -> exit %d" % rc, flush=True)
    return rc


def main():
    _check_declared_covers_disk()
    results = []
    for name in PY_SUITES:
        results.append((name, _run([sys.executable, str(TESTS / name)], name)))
    for name in NODE_SUITES:
        results.append((name, _run(["node", str(TESTS / name)], name)))

    print()
    print("=" * 62)
    width = max(len(n) for n, _ in results)
    for name, rc in results:
        print("  %-*s  %s" % (width, name, "OK" if rc == 0 else "FAIL (exit %d)" % rc))
    failed = [n for n, rc in results if rc != 0]
    print("=" * 62)
    if failed:
        print("run_koe_tests: FAILED (%d/%d) — %s" % (len(failed), len(results), ", ".join(failed)))
        return 1
    print("run_koe_tests: OK (%d/%d)" % (len(results), len(results)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
