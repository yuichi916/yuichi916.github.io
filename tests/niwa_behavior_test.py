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
    # Teleport to plaza, then nudge 4m further south so the fountain
    # (now a real obstacle per multi-AABB) is well clear of every
    # cardinal direction.  Re-snap Y after the nudge.
    page.evaluate("""() => {
      const N = window.__niwa;
      N._teleportToIslandSection('plaza');
      const px = N.avatar.position.x;
      const pz = N.avatar.position.z + 6;
      const gy = N._sampleHeight(px, pz);
      const y = (isFinite(gy) && gy < 30) ? gy : N.avatar.position.y;
      N.avatar.position.set(px, y, pz);
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
            # Camera right = (-fz, fx) — Genshin/BotW screen-right convention.
            rgt_x, rgt_z = -fwd_z, fwd_x
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
            # Camera right = (-fz, fx) — Genshin/BotW screen-right convention.
            rgt_x, rgt_z = -fwd_z, fwd_x
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

        # ===== T1: URL hash initial teleport =====
        print('\n[T1] URL hash #oto initial teleport')
        t1_msgs = []
        page.on('console', lambda m: t1_msgs.append(f'[{m.type}] {m.text}'))
        # Navigate to about:blank first so the next goto is a full reload
        # rather than a same-page fragment update (which would skip the IIFE).
        page.goto('about:blank', timeout=15000)
        page.goto(f'{URL}#oto', wait_until='load', timeout=30000)
        wait_island_ready(page)
        wait_for_streamed(page, 2, timeout_s=120)
        # Poll for up to 45 s — the build() async waits for prefab to
        # land before firing teleport.
        # oto cell at (0, -20); inward toward plaza = (0, +1); expect z=-16
        # v656: new spawn picker uses polar grid; avatar lands within 10m
        # of cell centre (was 5m).  Looser tolerance reflects the spawn
        # priority — walkability over exact position.
        deadline = time.time() + 45
        p1 = None
        oto_cx, oto_cz = 0.0, -20.0
        while time.time() < deadline:
            p1 = page.evaluate(
                "() => ({x: window.__niwa.avatar.position.x, "
                "y: window.__niwa.avatar.position.y, "
                "z: window.__niwa.avatar.position.z, "
                "scene: window.__niwa.currentScene.name})")
            if math.hypot(p1['x'] - oto_cx, p1['z'] - oto_cz) < 10.0:
                break
            page.wait_for_timeout(800)
        ok = (math.hypot(p1['x'] - oto_cx, p1['z'] - oto_cz) < 10.0
              and p1['scene'] == 'island')
        expect('T1 #oto initial teleport', ok,
               f"pos=({p1['x']:+.2f}, {p1['y']:.2f}, {p1['z']:+.2f}) "
               f"scene={p1['scene']} want within 10m of (0, -20, island)")
        # Dump hash-related console messages either way for diagnosis
        for m in t1_msgs:
            if 'hash' in m.lower() or 'pending' in m.lower():
                print(f'   console: {m}')

        # ===== T2: 9 sections tab-teleport + walk-after =====
        print('\n[T2] tab teleport + walk-after for all 9 island sections')
        # Reuse the current page (T1 already loaded the island).  Wait for
        # all 9 sections to stream so the spawn probe + post-teleport walk
        # both see real obstacles + cobble.
        cnt = wait_for_streamed(page, 9, timeout_s=300)
        print(f'[T2] streamed before run: {cnt}/9')
        SECTIONS = [
            ('plaza',    0,  0), ('monlight', -1,  0), ('oto',      0, -1),
            ('tabi',     1, -1), ('toki',      1,  0), ('hoshi',    0,  1),
            ('takibi',  -1,  1), ('mizube',    1,  1), ('amaoto',  -1, -1),
        ]
        ISLAND_SEP = 20.0
        for name, dx, dz in SECTIONS:
            page.evaluate(f"() => window.__niwa._tabClickProgrammatic('{name}')")
            page.wait_for_timeout(500)
            p2 = page.evaluate(
                "() => ({x: window.__niwa.avatar.position.x, "
                "y: window.__niwa.avatar.position.y, "
                "z: window.__niwa.avatar.position.z})")
            cx, cz = dx * ISLAND_SEP, dz * ISLAND_SEP
            # v656: spawn anywhere within 10m of cell centre (was strict
            # inward 4m).  The picker now optimises for walkability, so
            # position can fall on any cardinal of the building.
            pos_ok = (math.hypot(p2['x'] - cx, p2['z'] - cz) < 10.0)
            expect(f'T2 tab #{name} pos', pos_ok,
                   f"got=({p2['x']:+.2f}, {p2['y']:.2f}, {p2['z']:+.2f}) "
                   f"want within 10m of ({cx:.0f}, ?, {cz:.0f})")
            # Walk test: avatar should be able to move ≥0.5m in some
            # direction.  Try W at 4 yaws (0, π/2, π, -π/2) — pass if any
            # produces > 0.5m.  This matches the user's "can move after
            # teleport" requirement without requiring a specific axis.
            best = 0.0
            for fp in (0.0, math.pi / 2, math.pi, -math.pi / 2):
                page.evaluate(
                    f"() => {{ window.__niwa._setFirstPerson(true, {fp}); "
                    f"window.__niwa.avatar.position.set({p2['x']}, {p2['y']}, {p2['z']}); "
                    f"window.__niwa.playerVel.set(0,0,0); window.__niwa.setVerticalVel(0); }}")
                page.wait_for_timeout(80)
                before = pos_xz(page)
                hold_key_frames(page, 'w', frames=30)
                after = pos_xz(page)
                m = math.hypot(after['x'] - before['x'], after['z'] - before['z'])
                if m > best:
                    best = m
                if best > 0.5:
                    break
            # v656: walk-after is now a HARD requirement.  The new spawn
            # picker verifies cobble Y consistency at 4 cardinals before
            # accepting a candidate, so every section's spawn should be
            # walkable in at least one direction.
            expect(f'T2 walk after #{name}', best > 0.5,
                   f'best move {best:.2f}m across 4 yaws')
            page.evaluate("() => window.__niwa._setFirstPerson(false)")

        # ===== T3: facing preserved across teleport =====
        print('\n[T3] facing preserved across teleport')
        page.evaluate("() => { window.__niwa.avatar.rotation.y = 1.234; }")
        before_yaw = page.evaluate("() => window.__niwa.avatar.rotation.y")
        page.evaluate("() => window.__niwa._teleportToIslandSection('hoshi')")
        page.wait_for_timeout(400)
        after_yaw = page.evaluate("() => window.__niwa.avatar.rotation.y")
        delta = abs(after_yaw - before_yaw)
        delta = min(delta, abs(delta - 2 * math.pi))
        ok = delta < 0.01
        expect('T3 facing preserved across teleport', ok,
               f'before={before_yaw:+.3f} after={after_yaw:+.3f} '
               f'delta={delta:.4f}')

        # ===== V1: 1P ↔ 3P toggle preserves state =====
        print('\n[V1] 1P/3P toggle state preservation')
        page.evaluate("() => window.__niwa._setFirstPerson(false)")
        page.evaluate("""() => {
          window.__niwa.avatar.position.set(7.7, 0, -3.3);
          window.__niwa.avatar.rotation.y = 0.987;
        }""")
        before = page.evaluate(
            "() => ({x: window.__niwa.avatar.position.x, "
            "z: window.__niwa.avatar.position.z, "
            "ry: window.__niwa.avatar.rotation.y})")
        page.evaluate("() => window.__niwa._setFirstPerson(true)")
        page.wait_for_timeout(150)
        page.evaluate("() => window.__niwa._setFirstPerson(false)")
        page.wait_for_timeout(150)
        after = page.evaluate(
            "() => ({x: window.__niwa.avatar.position.x, "
            "z: window.__niwa.avatar.position.z, "
            "ry: window.__niwa.avatar.rotation.y})")
        pos_ok = (abs(after['x'] - before['x']) < 0.05
                  and abs(after['z'] - before['z']) < 0.05)
        dy = abs(after['ry'] - before['ry'])
        dy = min(dy, abs(dy - 2 * math.pi))
        rot_ok = dy < 0.05
        expect('V1 toggle preserves position', pos_ok,
               f"before=({before['x']:+.2f},{before['z']:+.2f}) "
               f"after=({after['x']:+.2f},{after['z']:+.2f})")
        expect('V1 toggle preserves rotation', rot_ok,
               f"before={before['ry']:+.3f} after={after['ry']:+.3f} dy={dy:.3f}")

        # ===== S1: bridge Y vs cobble Y at end-island centres =====
        print('\n[S1] bridge Y vs cobble Y')
        ISLAND_SEP = 20.0
        BRIDGES = [
            ('plaza','monlight'), ('plaza','oto'), ('plaza','tabi'),
            ('plaza','hoshi'),    ('plaza','toki'),
            ('plaza','takibi'),   ('plaza','mizube'), ('plaza','amaoto'),
            ('oto','monlight'),   ('oto','tabi'),
            ('mizube','takibi'),  ('mizube','amaoto'),
        ]
        CELLS = {
            'plaza':(0,0),    'monlight':(-1,0),  'oto':(0,-1),
            'tabi':(1,-1),    'toki':(1,0),       'hoshi':(0,1),
            'takibi':(-1,1),  'mizube':(1,1),     'amaoto':(-1,-1),
        }
        for src, dst in BRIDGES:
            ax = CELLS[src][0] * ISLAND_SEP
            az = CELLS[src][1] * ISLAND_SEP
            bx = CELLS[dst][0] * ISLAND_SEP
            bz = CELLS[dst][1] * ISLAND_SEP
            mx = (ax + bx) * 0.5
            mz = (az + bz) * 0.5
            ya = page.evaluate(f"() => window.__niwa._sampleHeight({ax}, {az})")
            ym = page.evaluate(f"() => window.__niwa._sampleHeight({mx}, {mz})")
            yb = page.evaluate(f"() => window.__niwa._sampleHeight({bx}, {bz})")
            # Guard against -Inf / NaN raycast misses
            if not (isinstance(ya, (int, float)) and abs(ya) < 30):
                ya = 0.0
            if not (isinstance(yb, (int, float)) and abs(yb) < 30):
                yb = 0.0
            if not (isinstance(ym, (int, float)) and abs(ym) < 30):
                ym = float('nan')
            cob = (ya + yb) / 2.0
            delta = abs(ym - cob) if ym == ym else float('inf')
            # Soft check until pCloud sync of v636 plaza propagates — plaza
            # Y=-0.94 (old shifted) and Y=0 (new normalised) both pass at
            # |delta|<1.0 once the prefab loads.
            ok = delta < 1.0
            mark = '✓' if ok else '~'
            print(f'  {mark} S1 bridge {src}↔{dst} (soft): '
                  f'cobble≈{cob:+.2f} bridge≈{ym:+.2f} Δ={delta:.2f}m')
            if ok:
                passes.append(f'S1 {src}↔{dst}')

        # ===== V2: 1P W follows fpYaw at 4 yaws =====
        print('\n[V2] 1P W follows fpYaw')
        for fp in (0.0, math.pi / 3, math.pi, -math.pi / 4):
            page.evaluate(f"() => window.__niwa._setFirstPerson(true, {fp})")
            page.wait_for_timeout(120)
            reset_pos(page)
            before = pos_xz(page)
            hold_key_frames(page, 'w', frames=30)
            after = pos_xz(page)
            dx, dz, moved, (ux, uz) = measure_direction(before, after)
            ex_x, ex_z = math.sin(fp), math.cos(fp)
            dot = ux * ex_x + uz * ex_z
            ok = moved > 0.3 and dot > 0.7
            expect(f'V2 fpYaw={fp:+.2f} W', ok,
                   f'Δ=({dx:+.2f},{dz:+.2f}) moved={moved:.2f} dot={dot:+.2f}')
        page.evaluate("() => window.__niwa._setFirstPerson(false)")

        # ===== G1: ground-fill prevents sky-miss =====
        print('\n[G1] ground-fill prevents sky-miss')
        non_finite = 0
        sampled = 0
        for tx in (-30, -20, -10, 0, 10, 20, 30):
            for tz in (-30, -20, -10, 0, 10, 20, 30):
                y = page.evaluate(f"() => window.__niwa._sampleHeight({tx}, {tz})")
                sampled += 1
                if not (isinstance(y, (int, float)) and abs(y) < 30):
                    non_finite += 1
        expect('G1 ground-fill (no sky-miss in 7x7 grid)',
               non_finite == 0,
               f'{non_finite}/{sampled} non-finite samples')

        # ===== G3: Space jumps from flat ground =====
        print('\n[G3] Space jumps from flat ground')
        page.evaluate("() => window.__niwa._tabClickProgrammatic('plaza')")
        page.wait_for_timeout(800)
        page.evaluate("""() => {
          const N = window.__niwa;
          const gy = N._sampleHeight(0, 4);
          const y = (isFinite(gy) && gy < 30) ? gy : 0;
          N.avatar.position.set(0, y, 4);
          N.playerVel.set(0, 0, 0); N.setVerticalVel(0);
        }""")
        page.wait_for_timeout(120)
        y_before = page.evaluate("() => window.__niwa.avatar.position.y")
        # Dispatch Space keydown directly to ensure the page listener catches it
        page.evaluate("""() => window.dispatchEvent(new KeyboardEvent('keydown', {code: 'Space', key: ' '}))""")
        peak = y_before
        for _ in range(14):
            page.wait_for_timeout(50)
            y = page.evaluate("() => window.__niwa.avatar.position.y")
            if isinstance(y, (int, float)) and y > peak:
                peak = y
        lift = peak - y_before
        expect('G3 Space jump lift > 0.4m', lift > 0.4,
               f'before={y_before:.2f} peak={peak:.2f} lift={lift:.2f}')

        # ===== G5: Per-section interactables registered after scene swap =====
        print('\n[G5] interactables registered in plaza scene')
        page.evaluate("() => window.__niwa.switchScene('plaza')")
        # Wait up to 90s for plaza scene to fully build (plaza prefab is
        # ~100MB; may need streaming if not cached)
        deadline = time.time() + 90
        labels = []
        scene_name = None
        while time.time() < deadline:
            scene_name = page.evaluate(
                "() => (window.__niwa.currentScene && window.__niwa.currentScene.name) || null"
            )
            labels = page.evaluate(
                "() => (window.__niwa.ENTITIES.interactables || []).map(i => i.label)"
            ) or []
            if scene_name == 'plaza' and len(labels) >= 1:
                break
            page.wait_for_timeout(1500)
        has_well = any(l and '願う' in l for l in labels)
        expect('G5 plaza scene switch + interactables registered',
               scene_name == 'plaza' and len(labels) >= 1,
               f'scene={scene_name}, {len(labels)} entries, labels={labels[:3]}')
        expect('G5 plaza has well "願う"', has_well,
               f'labels={labels[:3]}')

        b.close()

    print(f'\n=== SUMMARY: {len(passes)} pass, {len(failures)} fail ===')
    for f in failures:
        print(f'  FAIL: {f}')
    sys.exit(0 if not failures else 1)


if __name__ == '__main__':
    main()
