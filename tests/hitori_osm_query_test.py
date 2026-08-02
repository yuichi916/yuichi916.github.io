# -*- coding: utf-8 -*-
"""Overpass クエリ生成とリトライ・ミラーフォールバックの検証。実ネットワークは叩かない。"""
import sys, json, io
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "hitori"))

import osm_query


def test_build_query():
    ql = osm_query.build_query(13)

    # 県単位の area 指定（全国一括はタイムアウトするため必須）
    assert 'admin_level"="4' in ql
    assert "3600000013" not in ql, "OSM area id を直書きしない"
    assert "13" in ql

    # spec §3 の全タグが含まれること
    for needle in ['"amenity"="public_bath"', '"leisure"="sauna"',
                   '"amenity"="karaoke_box"', '"amenity"="cinema"',
                   '"amenity"="internet_cafe"', '"tourism"="hostel"',
                   '"amenity"="library"', '"tourism"="museum"']:
        assert needle in ql, f"{needle} がクエリにない"
    assert "ramen" in ql and "gyudon" in ql and "curry" in ql

    # タグ本体が必要なので out count ではなく out center
    assert "out center" in ql
    assert "out count" not in ql


class FakeOpener:
    """呼び出し回数と URL を記録し、指定回数だけ失敗させる偽の opener。"""

    def __init__(self, fail_times, payload=None):
        self.fail_times = fail_times
        self.calls = []
        self.payload = payload if payload is not None else {"elements": [{"id": 1}]}

    def __call__(self, req, timeout=None):
        self.calls.append(req.full_url)
        if len(self.calls) <= self.fail_times:
            raise TimeoutError("simulated timeout")
        return io.BytesIO(json.dumps(self.payload).encode("utf-8"))


def test_retry_then_success():
    op = FakeOpener(fail_times=2)
    result = osm_query.run_query("[out:json];out count;", opener=op, sleep=lambda s: None)
    assert result == {"elements": [{"id": 1}]}
    assert len(op.calls) == 3, f"3回目で成功するはずが {len(op.calls)} 回"


def test_mirror_fallback():
    # 1ミラーあたり3回まで試すので、4回目は次のミラーに移る
    op = FakeOpener(fail_times=3)
    osm_query.run_query("[out:json];out count;", opener=op, sleep=lambda s: None)
    assert op.calls[0].startswith(osm_query.MIRRORS[0])
    assert op.calls[3].startswith(osm_query.MIRRORS[1]), f"4回目がミラー2でない: {op.calls[3]}"


def test_all_mirrors_fail():
    op = FakeOpener(fail_times=999)
    try:
        osm_query.run_query("[out:json];out count;", opener=op, sleep=lambda s: None)
    except osm_query.OverpassError:
        assert len(op.calls) == 3 * len(osm_query.MIRRORS)
        return
    raise AssertionError("全ミラー失敗時に OverpassError が上がらなかった")


def main():
    test_build_query()
    test_retry_then_success()
    test_mirror_fallback()
    test_all_mirrors_fail()
    print("OK: osm_query")


if __name__ == "__main__":
    main()
