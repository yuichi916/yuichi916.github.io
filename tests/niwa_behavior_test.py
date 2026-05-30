"""niwa.html behaviour test — M1+M2+T1+T2+T3+V1+V2+S1 (70 assertions).

Each block is added in a subsequent task. This skeleton just confirms
the page loads and the extended __niwa hook is present.
"""
import os, sys, time, math, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', newline='')
from playwright.sync_api import sync_playwright

PORT = int(os.environ.get('NIWA_PORT', '9302'))
URL = f'http://127.0.0.1:{PORT}/niwa.html?scene=island&diag=1'

failures, passes = [], []


def expect(label, ok, detail):
    (passes if ok else failures).append(label)
    mark = '✓' if ok else '✗'
    print(f'  {mark} {label}: {detail}')


def wait_island_ready(page, hook_timeout_ms=60000,
                       min_streamed=1, max_wait_s=240):
    """Wait for the diagnostic hook to be ready and at least
    `min_streamed` island sections to land.

    Most movement tests (M1, M2, V1, V2) don't need any streamed
    section. min_streamed=1 just proves the streaming pipeline is
    alive. Tests that need specific sections (T1/T2/T3/S1) can call
    wait_for_streamed(page, n) themselves.
    """
    page.wait_for_function(
        "() => window.__niwa && typeof window.__niwa._setCamYaw === 'function'",
        timeout=hook_timeout_ms)
    deadline = time.time() + max_wait_s
    streamed = 0
    while time.time() < deadline:
        try:
            streamed_now = page.evaluate(
                "() => (window.__niwa ? window.__niwa._islandStreamedCount : -1)")
            streamed = max(0, streamed_now or 0)
        except Exception:
            streamed = 0
        if streamed >= min_streamed:
            break
        page.wait_for_timeout(1500)
    page.wait_for_timeout(1500)
    print(f'[harness] island streamed: {streamed}/9 (wanted ≥{min_streamed})')
    return streamed


def wait_for_streamed(page, n, timeout_s=240):
    """Wait until __niwa._islandStreamedCount >= n.  Returns the count
    at exit (≥ n on success, last seen on timeout)."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            cnt = page.evaluate(
                "() => (window.__niwa ? window.__niwa._islandStreamedCount : -1)") or 0
        except Exception:
            cnt = 0
        if cnt >= n:
            page.wait_for_timeout(800)
            return cnt
        page.wait_for_timeout(1500)
    return cnt


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=[
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
        ])
        ctx = b.new_context(viewport={'width': 1280, 'height': 800})
        page = ctx.new_page()
        page.on('pageerror', lambda exc: print(f'[PAGEERROR] {exc}'))
        print(f'[harness] loading {URL}')
        page.goto(URL, wait_until='load', timeout=30000)
        streamed = wait_island_ready(page)
        expect('hook ready', True, 'extended __niwa available')
        expect('island streaming alive', streamed >= 1,
               f'{streamed}/9 prefabs reached the renderer in time')
        # Test blocks (M1, M2, ...) will be appended here in subsequent tasks.
        b.close()

    print(f'\n=== SUMMARY: {len(passes)} pass, {len(failures)} fail ===')
    for f in failures:
        print(f'  FAIL: {f}')
    sys.exit(0 if not failures else 1)


if __name__ == '__main__':
    main()
