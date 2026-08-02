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
    # 1ミラーの試行回数を使い切ったら次のミラーへ移る
    n = osm_query.ATTEMPTS_PER_MIRROR
    op = FakeOpener(fail_times=n)
    osm_query.run_query("[out:json];out count;", opener=op, sleep=lambda s: None)
    assert op.calls[0].startswith(osm_query.MIRRORS[0])
    assert op.calls[n].startswith(osm_query.MIRRORS[1]), f"{n+1}回目がミラー2でない: {op.calls[n]}"


def test_all_mirrors_fail():
    op = FakeOpener(fail_times=999)
    try:
        osm_query.run_query("[out:json];out count;", opener=op, sleep=lambda s: None)
    except osm_query.OverpassError as e:
        assert len(op.calls) == osm_query.ATTEMPTS_PER_MIRROR * len(osm_query.MIRRORS)
        # 最後のミラーの例外だけでなく、全ミラー分の理由が出ること
        for m in osm_query.MIRRORS:
            assert m.split("/")[2] in str(e), f"{m} のエラーが報告に含まれていない: {e}"
        return
    raise AssertionError("全ミラー失敗時に OverpassError が上がらなかった")


def test_backoff_grows():
    slept = []
    op = FakeOpener(fail_times=999)
    try:
        osm_query.run_query("[out:json];out count;", opener=op, sleep=slept.append)
    except osm_query.OverpassError:
        pass
    n = osm_query.ATTEMPTS_PER_MIRROR
    assert slept[:n] == [min(osm_query.BACKOFF_MAX_SEC, osm_query.BACKOFF_BASE_SEC * 2 ** i)
                         for i in range(n)], slept[:n]
    assert slept[0] >= 5, "初回バックオフが短すぎるとレート制限窓を越えられない"


def main():
    test_build_query()
    test_retry_then_success()
    test_mirror_fallback()
    test_all_mirrors_fail()
    test_backoff_grows()
    print("OK: osm_query")


if __name__ == "__main__":
    main()
