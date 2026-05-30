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


def reset_pos(page):
    page.evaluate("""() => {
      const N = window.__niwa;
      N.avatar.position.set(0, 0, 0);
      N.playerVel.set(0, 0, 0); N.setVerticalVel(0);
      N.keys.w = N.keys.a = N.keys.s = N.keys.d = false;
    }""")


def hold_key_frames(page, key, frames=30):
    page.evaluate(f"() => {{ window.__niwa.keys['{key}'] = true; }}")
    page.keyboard.down(key)
    for _ in range(frames):
        page.wait_for_timeout(50)
        page.evaluate("() => window.__niwa.avatar.position.x")
    page.evaluate(f"() => {{ window.__niwa.keys['{key}'] = false; }}")
    page.keyboard.up(key)
    page.wait_for_timeout(200)


def pos_xz(page):
    return page.evaluate(
        "() => ({x: window.__niwa.avatar.position.x, "
        "z: window.__niwa.avatar.position.z})")


def measure_direction(before, after):
    dx = after['x'] - before['x']
    dz = after['z'] - before['z']
    moved = math.hypot(dx, dz)
    if moved < 1e-6:
        return dx, dz, moved, (0.0, 0.0)
    return dx, dz, moved, (dx / moved, dz / moved)


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

        # ===== M1: 3P WASD direction × 4 camYaws × 4 keys = 16 assertions =====
        print('\n[M1] 3P WASD direction tests')
        for cam_yaw in (0.0, math.pi / 2, math.pi, -math.pi / 2):
            page.evaluate("() => window.__niwa._setFirstPerson(false)")
            page.evaluate(f"() => window.__niwa._setCamYaw({cam_yaw})")
            page.wait_for_timeout(150)
            fwd_x, fwd_z = -math.sin(cam_yaw), -math.cos(cam_yaw)
            rgt_x, rgt_z = fwd_z, -fwd_x
            for key, (ex_x, ex_z) in (
                    ('w', (fwd_x, fwd_z)),
                    ('s', (-fwd_x, -fwd_z)),
                    ('d', (rgt_x, rgt_z)),
                    ('a', (-rgt_x, -rgt_z)),
            ):
                reset_pos(page)
                before = pos_xz(page)
                hold_key_frames(page, key, frames=30)
                after = pos_xz(page)
                dx, dz, moved, (ux, uz) = measure_direction(before, after)
                dot = ux * ex_x + uz * ex_z
                ok = moved > 0.3 and dot > 0.7
                expect(f'M1 camYaw={cam_yaw:+.2f} {key.upper()}', ok,
                       f'Δ=({dx:+.2f},{dz:+.2f}) moved={moved:.2f} dot={dot:+.2f} '
                       f'expect=({ex_x:+.2f},{ex_z:+.2f})')

        # ===== M2: 1P WASD direction × 4 fpYaws × 4 keys = 16 assertions =====
        print('\n[M2] 1P WASD direction tests')
        for fp_yaw in (0.0, math.pi / 2, math.pi, -math.pi / 2):
            page.evaluate(f"() => window.__niwa._setFirstPerson(true, {fp_yaw})")
            page.wait_for_timeout(150)
            fwd_x, fwd_z = math.sin(fp_yaw), math.cos(fp_yaw)
            rgt_x, rgt_z = fwd_z, -fwd_x
            for key, (ex_x, ex_z) in (
                    ('w', (fwd_x, fwd_z)),
                    ('s', (-fwd_x, -fwd_z)),
                    ('d', (rgt_x, rgt_z)),
                    ('a', (-rgt_x, -rgt_z)),
            ):
                reset_pos(page)
                before = pos_xz(page)
                hold_key_frames(page, key, frames=30)
                after = pos_xz(page)
                dx, dz, moved, (ux, uz) = measure_direction(before, after)
                dot = ux * ex_x + uz * ex_z
                ok = moved > 0.3 and dot > 0.7
                expect(f'M2 fpYaw={fp_yaw:+.2f} {key.upper()}', ok,
                       f'Δ=({dx:+.2f},{dz:+.2f}) moved={moved:.2f} dot={dot:+.2f} '
                       f'expect=({ex_x:+.2f},{ex_z:+.2f})')
        page.evaluate("() => window.__niwa._setFirstPerson(false)")

        b.close()

    print(f'\n=== SUMMARY: {len(passes)} pass, {len(failures)} fail ===')
    for f in failures:
        print(f'  FAIL: {f}')
    sys.exit(0 if not failures else 1)


if __name__ == '__main__':
    main()
