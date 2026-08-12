# -*- coding: utf-8 -*-
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chain_audit import build_audit, write_audit


def test_audit_statuses_sum_to_dataset_total():
    audit = build_audit(40560, "2026-08-12")
    assert audit["total"] == 40560
    assert sum(audit["statuses"].values()) == 40560
    assert audit["statuses"]["needs_review"] == 288


def test_writer_emits_compact_readable_json():
    with tempfile.TemporaryDirectory() as tmp:
        audit = write_audit(Path(tmp), 40560, "2026-08-12")
        emitted = json.loads((Path(tmp) / "chain_audit.json").read_text(encoding="utf-8"))
    assert emitted == audit


if __name__ == "__main__":
    test_audit_statuses_sum_to_dataset_total()
    test_writer_emits_compact_readable_json()
    print("chain_audit_test: ok")
