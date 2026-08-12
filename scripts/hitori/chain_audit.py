# -*- coding: utf-8 -*-
"""静的サイトで表示するチェーン監査集計を、ビルド時に再生成する。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED = ROOT / "data" / "hitori" / "chain_audit_seed.json"


def build_audit(total, updated, seed_path=SEED):
    """監査設定を読み、公開用の監査集計を生成する。"""
    seed = json.loads(seed_path.read_text(encoding="utf-8"))
    statuses = seed.get("statuses", {})
    required = ("verified", "heuristic", "not_chain", "needs_review", "unreviewed")
    if any(key not in statuses for key in required):
        raise ValueError("chain_audit_seed.json に監査ステータスが不足しています")
    if sum(int(statuses[key]) for key in required) != int(total):
        raise ValueError("チェーン監査ステータスの合計が施設総数と一致しません")
    return {
        "updated": updated,
        "total": int(total),
        "statuses": {key: int(statuses[key]) for key in required},
        "method": seed.get("method", {}),
        "sources": seed.get("sources", []),
    }


def write_audit(out_dir, total, updated):
    """data/hitori/chain_audit.json をコンパクトな配信JSONとして書き出す。"""
    audit = build_audit(total, updated)
    target = Path(out_dir) / "chain_audit.json"
    target.write_text(json.dumps(audit, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return audit
