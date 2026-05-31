# niwa.html Controls / Teleport / Bridges / Visuals / Tests Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad-hoc Euler-based avatar control with a Quaternion.slerp + velocity.normalize movement controller, add URL hash deep-link teleport with obstacle-aware spawn probing and facing preservation, re-extract the plaza prefab so bridges align with cobble Y, retune Bloom + add PMREM + FXAA, and expand the Playwright test suite from 6 distance-only checks to 70 behavioural assertions (M1+M2+T1+T2+T3+V1+V2+S1).

**Architecture:** Single-file Three.js ES module (`niwa.html`) plus one new Blender extractor and one new Playwright test file. Movement uses camera-forward vectors + normalized input + `Quaternion.slerp` for avatar rotation. Teleport is a single `teleportToIslandSection(id)` function that all three entry points (URL hash, tab click, future deep links) share. Bloom/PMREM/FXAA reuse the already-imported postprocessing modules. Tests use Playwright + python http.server and only the existing `?diag=1` `window.__niwa` hook (expanded).

**Tech Stack:**
- Three.js r155 (single-file ES module via importmap)
- EffectComposer / RenderPass / UnrealBloomPass / SMAAPass (already imported at lines 388-390; we add ShaderPass + FXAAShader + PMREMGenerator)
- Blender 4.x background mode (existing `_blender/enc_extract_cobbletop_v636.py` is the template)
- Playwright (Python sync API) + http.server, headless Chromium with `--disable-background-timer-throttling`
- pCloud Public Folder for asset delivery (`P:\Public Folder\hitoritabi\niwa-assets\blender\`)

**Anchors (current niwa.html state, baseline `feature/niwa-controls-refactor` @ 35c2796):**
- `SCENE_WORLD_POS`: line 497
- `IS_MOBILE`: line 512
- `fpYaw` / `firstPerson` / `playerVel` declarations: lines 551, 576, ~8819
- `setSun()`: line 709
- Movement controller body: lines 9310-9450
- Avatar rotation (Euler damp, to be replaced): lines 9442-9448
- `_tabClick()`: line 7562
- `_isClearSpawn()` / obstacle data: `ENTITIES.obstacles`, `ENTITIES.boxObstacles`, `currentScene.playableBounds`
- `placeENC('enc_prefab_plaza', 0, -5.46, 0, 1.0, 0)`: line 7468 (will revert to `0`)
- 1P/3P toggle: lines 8749-8766
- `__niwa` diagnostic hook: lines 10047-10066
- composer / RenderPass / UnrealBloomPass already constructed: lines 9123-9135
- animate() render call: lines 9942-9951

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `niwa.html` | Modify | All in-page changes: movement controller, teleport, 1P/3P toggle, PMREM, Bloom retune, FXAA, `__niwa` hook expansion |
| `_blender/enc_extract_plaza_v636.py` | Create | Plaza-only wrapper around `enc_extract_cobbletop_v636.py` logic to re-export `assets/blender/enc_prefab_plaza.glb` with cobble surface at Y=0 |
| `tests/niwa_behavior_test.py` | Create | Playwright-driven 70-assertion behaviour test (M1+M2+T1+T2+T3+V1+V2+S1) |
| `tests/run_niwa_behavior_test.py` | Create | http.server + Playwright launcher (reuse pattern from `C:/tmp/run_niwa_edge_walk_test.py`) |

Total: 1 modified, 3 created.

---

## Task 1: Plaza re-extraction Blender script (P0, parallel)

**Files:**
- Create: `_blender/enc_extract_plaza_v636.py`

This task is independent of all niwa.html work. Once the .glb is produced, the user copies it to pCloud. Until then, niwa.html keeps `placeENC(..., -5.46, ...)`.

- [ ] **Step 1: Create the plaza-only extractor**

Create `_blender/enc_extract_plaza_v636.py` with exactly this content:

```python
"""Plaza-only re-extract using the v636 cobble-Y normalisation.

The KB3D plaza prefab ships with the cobble TOP at z=5.46 in Blender,
which left bridges (placed at y=0 in niwa.html) floating 5.46 m below
the avatar. v636 shifts the prefab DOWN so the cobble surface ends at
z=0 in Blender (= y=0 after Y-up glTF export).

Run:
    blender -b -P _blender/enc_extract_plaza_v636.py

Output:
    assets/blender/enc_prefab_plaza.glb     (overwrites existing)

After extraction the user must copy the .glb to
`P:\\Public Folder\\hitoritabi\\niwa-assets\\blender\\enc_prefab_plaza.glb`
and wait for pCloud Drive sync.
"""
import bpy, os, sys

# Re-use the helper functions from the v636 script unchanged.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from enc_extract_cobbletop_v636 import (
    rewire, decimate_meshes, boolean_crop, export_glb
)

BLEND = r'P:\CG fanbook\3D assets\KitBash3D - Enchanted\kb3d_enchanted-native.blend'
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', 'assets', 'blender'))
os.makedirs(OUT_DIR, exist_ok=True)

# Single prefab — overwrite the production filename directly.
PREFABS = [
    ('plaza', 'KB3D_ENC_BldgSmLowerTownSquare_A_', 'enc_prefab_plaza', 8.0),
]

GROUND_TOKENS = ('Ground', 'Floor', 'Cobble', 'Paving', 'Path',
                 'Terrain', 'Street', 'Plaza')


def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    for tag, prefix, out_name, crop_radius in PREFABS:
        print(f'[plaza-v636] extracting {tag} ({prefix})')
        # Same body as enc_extract_cobbletop_v636.py main loop:
        # 1. Select all objects whose name starts with prefix
        # 2. Find GROUND_TOKENS meshes, compute max Z = cobbleTop
        # 3. Shift the whole prefab DOWN by cobbleTop
        # 4. Rewire materials, decimate, boolean-crop circular, export GLB
        out_path = os.path.join(OUT_DIR, out_name + '.glb')
        # If your enc_extract_cobbletop_v636.py main() body is not yet
        # exported as a function, copy lines 80-end of that file here
        # in place of this comment block, substituting (tag, prefix,
        # out_name, crop_radius) for the loop variables.
        export_glb(tag, prefix, out_name, crop_radius,
                   ground_tokens=GROUND_TOKENS, out_dir=OUT_DIR)
    print('[plaza-v636] done.')


if __name__ == '__main__':
    main()
```

> Implementation note: if `enc_extract_cobbletop_v636.py` does not already expose helper functions, refactor it FIRST to expose `rewire`, `decimate_meshes`, `boolean_crop`, `export_glb` (no behaviour change), then call them from this script.

- [ ] **Step 2: Run the extractor**

Run:
```
blender -b -P _blender/enc_extract_plaza_v636.py
```
Expected output: `[plaza-v636] done.` and `assets/blender/enc_prefab_plaza.glb` modified.

- [ ] **Step 3: Verify the extracted GLB cobble surface is near Y=0**

Quick smoke check — load the glb in any glTF viewer or run:
```
python -c "import json,struct; print('size:', __import__('os').path.getsize('assets/blender/enc_prefab_plaza.glb'))"
```
Expected: file size > 100 KB, < 5 MB.

- [ ] **Step 4: Ask the user to upload to pCloud**

Print explicit message:
> "Plaza re-extraction complete. Please copy `assets/blender/enc_prefab_plaza.glb` to `P:\\Public Folder\\hitoritabi\\niwa-assets\\blender\\enc_prefab_plaza.glb` and confirm when pCloud sync is done. Until then niwa.html keeps the temporary -5.46 Y shift."

- [ ] **Step 5: Commit the extractor**

```
git add _blender/enc_extract_plaza_v636.py
git commit -m "feat(niwa): add plaza-only v636 re-extractor for cobble-Y normalization"
```

---

## Task 2: Expand `__niwa` diagnostic hook (P1)

**Files:**
- Modify: `niwa.html:10047-10066`

The current hook exposes `switchScene`, `currentScene`, `avatar`, `playerVel`, `verticalVel`, `keys`, `joyState`, `camYawState`, `ENTITIES`, `activeBridges`, `bridgeCooldownUntil`, `firstPerson`, `moveTarget`, `bumpHud`. We add setters for camera/view state, an island-streamed predicate, a sampleHeight passthrough, an rAF-paced wait, and a programmatic tab-click. All gated on `?diag=1`.

- [ ] **Step 1: Locate the hook block and add new entries**

Find this block at `niwa.html:10047`:
```js
  if(urlParams.get('diag') === '1'){
    window.__niwa = {
      switchScene,
      get currentScene(){ return currentScene; },
      get avatar(){ return avatar; },
      get playerVel(){ return playerVel; },
      get verticalVel(){ return verticalVel; },
      setVerticalVel(v){ verticalVel = v; },
      get keys(){ return keys; },
      get joyState(){ return joyState; },
      get camYawState(){ return camYawState; },
      get ENTITIES(){ return ENTITIES; },
      get activeBridges(){ return activeBridges; },
      get bridgeCooldownUntil(){ return bridgeCooldownUntil; },
      get firstPerson(){ return firstPerson; },
      get moveTarget(){ return moveTarget; },
      get bumpHud(){ try { return bumpHud; } catch(_){ return null; } },
    };
    console.log('niwa: __niwa diagnostic hook ready');
  }
```

Replace it with:
```js
  if(urlParams.get('diag') === '1'){
    window.__niwa = {
      switchScene,
      get currentScene(){ return currentScene; },
      get avatar(){ return avatar; },
      get playerVel(){ return playerVel; },
      get verticalVel(){ return verticalVel; },
      setVerticalVel(v){ verticalVel = v; },
      get keys(){ return keys; },
      get joyState(){ return joyState; },
      get camYawState(){ return camYawState; },
      get fpYaw(){ return fpYaw; },
      get ENTITIES(){ return ENTITIES; },
      get activeBridges(){ return activeBridges; },
      get bridgeCooldownUntil(){ return bridgeCooldownUntil; },
      get firstPerson(){ return firstPerson; },
      get moveTarget(){ return moveTarget; },
      get bumpHud(){ try { return bumpHud; } catch(_){ return null; } },
      // === Test setters (D8 / P1) ===
      _setCamYaw(yaw){ camYawTarget = yaw; camYawState = yaw; },
      _setFpYaw(yaw){ fpYaw = yaw; },
      _setFirstPerson(b, yaw){
        firstPerson = !!b;
        if(b){
          fpYaw = (typeof yaw === 'number') ? yaw : avatar.rotation.y;
          fpPitch = -0.1;
        } else {
          camYawTarget = avatar.rotation.y + Math.PI;
        }
        const btn = document.getElementById('btn-view');
        if(btn){
          btn.textContent = firstPerson ? 'VIEW · 1P' : 'VIEW · 3P';
          btn.classList.toggle('active', firstPerson);
        }
      },
      _isIslandStreamed(){
        try { return (typeof _islandStreamedCount !== 'undefined') && _islandStreamedCount >= 9; }
        catch(_){ return false; }
      },
      _sampleHeight(x, z){ return sampleHeight(x, z); },
      _waitFrames(n){
        return new Promise(resolve => {
          let i = 0;
          const tick = () => { if(++i >= n) resolve(); else requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
        });
      },
      _tabClickProgrammatic(id){ _tabClick(id); },
      _teleportToIslandSection(id){
        if(typeof teleportToIslandSection === 'function') teleportToIslandSection(id);
      },
    };
    console.log('niwa: __niwa diagnostic hook ready (extended)');
  }
```

- [ ] **Step 2: Validator + smoke test**

Run:
```
python C:/tmp/check_dup_const.py niwa.html
```
Expected: `OK: no same-scope const/let/var duplicates ...` (no new duplicates).

- [ ] **Step 3: Manual smoke**

Open `http://localhost:<port>/niwa.html?diag=1` and in DevTools console:
```js
window.__niwa._setCamYaw(0);
window.__niwa._setCamYaw(Math.PI/2);
await window.__niwa._waitFrames(5);
window.__niwa._isIslandStreamed();
```
Expected: each call returns without throwing. `_isIslandStreamed()` returns `false` for non-island scenes.

- [ ] **Step 4: Commit**

```
git add niwa.html
git commit -m "feat(niwa): extend __niwa diag hook with test setters (P1)"
```

---

## Task 3: Playwright harness skeleton (P1)

**Files:**
- Create: `tests/run_niwa_behavior_test.py`
- Create: `tests/niwa_behavior_test.py` (skeleton only — populated in Tasks 4/6/8/10/12)

- [ ] **Step 1: Create the runner**

Create `tests/run_niwa_behavior_test.py`:
```python
"""Launcher: spins up http.server, runs niwa_behavior_test.py."""
import os, sys, subprocess, threading, http.server, socketserver, pathlib, time, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', newline='')

REPO = pathlib.Path(__file__).resolve().parents[1]
PORT = 9302


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a, **kw): pass


def serve():
    os.chdir(REPO)
    socketserver.TCPServer(('127.0.0.1', PORT), Quiet).serve_forever()


def main():
    threading.Thread(target=serve, daemon=True).start()
    time.sleep(0.5)
    env = dict(os.environ, NIWA_PORT=str(PORT))
    rc = subprocess.call([sys.executable, str(pathlib.Path(__file__).with_name('niwa_behavior_test.py'))], env=env)
    sys.exit(rc)


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Create the test skeleton**

Create `tests/niwa_behavior_test.py`:
```python
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


def wait_island_ready(page, timeout_ms=120000):
    page.wait_for_function(
        "() => window.__niwa && typeof window.__niwa._setCamYaw === 'function'",
        timeout=timeout_ms)
    # Wait for island streamed prefabs (9 sections)
    page.wait_for_function(
        "() => window.__niwa._isIslandStreamed()", timeout=timeout_ms)
    page.wait_for_timeout(1500)


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
        wait_island_ready(page)
        expect('hook ready', True, 'extended __niwa available')
        # Test blocks (M1, M2, ...) will be appended here in subsequent tasks.
        b.close()

    print(f'\n=== SUMMARY: {len(passes)} pass, {len(failures)} fail ===')
    for f in failures:
        print(f'  FAIL: {f}')
    sys.exit(0 if not failures else 1)


if __name__ == '__main__':
    main()
```

- [ ] **Step 3: Run the skeleton — expect "1 pass"**

Run:
```
python tests/run_niwa_behavior_test.py
```
Expected: `=== SUMMARY: 1 pass, 0 fail ===` and exit 0.

- [ ] **Step 4: Commit**

```
git add tests/run_niwa_behavior_test.py tests/niwa_behavior_test.py
git commit -m "test(niwa): playwright harness skeleton + __niwa hook smoke (P1)"
```

---

## Task 4: M1 + M2 movement-direction tests — RED (P2)

**Files:**
- Modify: `tests/niwa_behavior_test.py`

Append two blocks: M1 (3P) tests 4 camera yaws × 4 keys = 16 assertions, M2 (1P) tests 4 fpYaws × 4 keys = 16 assertions. Each uses `dot(actualDir, expectedDir) > 0.7` AND `moved > 0.3m`.

- [ ] **Step 1: Add the shared helper to `niwa_behavior_test.py`** (immediately above `def main():`)

```python
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


def measure_direction(page, before, after):
    dx = after['x'] - before['x']
    dz = after['z'] - before['z']
    moved = math.hypot(dx, dz)
    if moved < 1e-6:
        return dx, dz, moved, 0.0, (0.0, 0.0)
    return dx, dz, moved, None, (dx / moved, dz / moved)


def pos_xz(page):
    return page.evaluate("() => ({x: window.__niwa.avatar.position.x, z: window.__niwa.avatar.position.z})")
```

- [ ] **Step 2: Add M1 block to `main()`** (after the `expect('hook ready', ...)` line)

```python
        # ===== M1: 3P WASD direction × 4 camYaws × 4 keys = 16 assertions =====
        print('\n[M1] 3P WASD direction tests')
        for cam_yaw in (0.0, math.pi / 2, math.pi, -math.pi / 2):
            page.evaluate(f"() => window.__niwa._setFirstPerson(false)")
            page.evaluate(f"() => window.__niwa._setCamYaw({cam_yaw})")
            page.wait_for_timeout(150)
            # In 3P camera forward is (-sin(camYaw), -cos(camYaw)).
            fwdX, fwdZ = -math.sin(cam_yaw), -math.cos(cam_yaw)
            rgtX, rgtZ = fwdZ, -fwdX
            for key, (exX, exZ) in (
                    ('w', (fwdX, fwdZ)),
                    ('s', (-fwdX, -fwdZ)),
                    ('d', (rgtX, rgtZ)),
                    ('a', (-rgtX, -rgtZ)),
            ):
                reset_pos(page)
                before = pos_xz(page)
                hold_key_frames(page, key, frames=30)
                after = pos_xz(page)
                dx, dz, moved, _, (ux, uz) = measure_direction(page, before, after)
                dot = ux * exX + uz * exZ
                ok = moved > 0.3 and dot > 0.7
                expect(f'M1 camYaw={cam_yaw:+.2f} {key.upper()}', ok,
                       f'Δ=({dx:+.2f},{dz:+.2f}) moved={moved:.2f} dot={dot:+.2f} '
                       f'expect=({exX:+.2f},{exZ:+.2f})')
```

- [ ] **Step 3: Add M2 block** (after M1)

```python
        # ===== M2: 1P WASD direction × 4 fpYaws × 4 keys = 16 assertions =====
        print('\n[M2] 1P WASD direction tests')
        for fp_yaw in (0.0, math.pi / 2, math.pi, -math.pi / 2):
            page.evaluate(f"() => window.__niwa._setFirstPerson(true, {fp_yaw})")
            page.wait_for_timeout(150)
            # In 1P camera forward is (sin(fpYaw), cos(fpYaw)).
            fwdX, fwdZ = math.sin(fp_yaw), math.cos(fp_yaw)
            rgtX, rgtZ = fwdZ, -fwdX
            for key, (exX, exZ) in (
                    ('w', (fwdX, fwdZ)),
                    ('s', (-fwdX, -fwdZ)),
                    ('d', (rgtX, rgtZ)),
                    ('a', (-rgtX, -rgtZ)),
            ):
                reset_pos(page)
                before = pos_xz(page)
                hold_key_frames(page, key, frames=30)
                after = pos_xz(page)
                dx, dz, moved, _, (ux, uz) = measure_direction(page, before, after)
                dot = ux * exX + uz * exZ
                ok = moved > 0.3 and dot > 0.7
                expect(f'M2 fpYaw={fp_yaw:+.2f} {key.upper()}', ok,
                       f'Δ=({dx:+.2f},{dz:+.2f}) moved={moved:.2f} dot={dot:+.2f} '
                       f'expect=({exX:+.2f},{exZ:+.2f})')
        # restore 3P
        page.evaluate("() => window.__niwa._setFirstPerson(false)")
```

- [ ] **Step 4: Run and verify RED**

Run:
```
python tests/run_niwa_behavior_test.py
```
Expected: some M1/M2 assertions FAIL (the current Euler-only avatar rotation should fail some yaws), exit code 1. Confirm at least one `✗` line appears. Goal here is RED — we want the test to actually detect direction bugs.

- [ ] **Step 5: Commit RED**

```
git add tests/niwa_behavior_test.py
git commit -m "test(niwa): M1+M2 WASD-direction tests (RED, P2)"
```

---

## Task 5: Movement controller refactor — GREEN M1+M2 (P3)

**Files:**
- Modify: `niwa.html:9319-9450` (movement controller body)

The current controller at `niwa.html:9319-9359` already uses camera-forward composition (added in v654), but the avatar rotation at `niwa.html:9442-9448` uses raw `avatar.rotation.y` Euler damp which is sign-fragile. Replace with `Quaternion.slerp`. Also normalize the input vector unconditionally and tighten the forward-intent check.

- [ ] **Step 1: Find the rotation block at `niwa.html:9442-9448`**

Current code:
```js
  const _hasForwardIntent = keys.w ||
                            (joyState.active && joyState.dz < -0.06) ||
                            (typeof moveTarget !== 'undefined' && moveTarget);
  if(Math.hypot(playerVel.x, playerVel.z) > 0.4 && _hasForwardIntent){
    const targetYaw = Math.atan2(playerVel.x, playerVel.z);
    let cur = avatar.rotation.y;
    let diff = targetYaw - cur;
    while(diff >  Math.PI) diff -= Math.PI * 2;
    while(diff < -Math.PI) diff += Math.PI * 2;
    avatar.rotation.y = cur + diff * Math.min(1, dt * 14);
  }
```

- [ ] **Step 2: Replace with Quaternion.slerp**

```js
  const _hasForwardIntent = keys.w ||
                            (joyState.active && joyState.dz < -0.06) ||
                            (typeof moveTarget !== 'undefined' && moveTarget);
  if(firstPerson){
    // 1P: avatar body locked to camera yaw — no damp, no slerp.
    _avTargetE.set(0, fpYaw, 0);
    avatar.quaternion.setFromEuler(_avTargetE);
  } else if(Math.hypot(playerVel.x, playerVel.z) > 0.4 && _hasForwardIntent){
    // 3P: only when forward input is active.  Slerp avoids Euler sign bugs.
    const targetYaw = Math.atan2(playerVel.x, playerVel.z);
    _avTargetE.set(0, targetYaw, 0);
    _avTargetQ.setFromEuler(_avTargetE);
    avatar.quaternion.slerp(_avTargetQ, Math.min(1, dt * 8));
  }
```

- [ ] **Step 3: Declare the two scratch objects (top of the animate scope)**

Find an appropriate scope — the animate function. Add near other scratch objects (search for `THREE.Vector3()` in the same scope at lines ~8820-8830 if there is a global declarations block, otherwise just above the movement controller at ~9312):
```js
  const _avTargetE = new THREE.Euler();
  const _avTargetQ = new THREE.Quaternion();
```

> If `animate()` is called every frame and these aren't outside the scope, the `new` cost is acceptable (cheap struct) but moving them outside `animate()` to module scope is preferred. If module-scope, prefix with `let`/`const` once near `let camYawState` at ~8818-8820 and remove the inline `const`.

- [ ] **Step 4: Verify input normalization is unconditional**

At `niwa.html:9331-9334`:
```js
  if(mx || mz){
    const len = Math.hypot(mx,mz);
    const mag = Math.min(1, len);
    mx /= (len || 1); mz /= (len || 1);
```
This is correct — already normalizes when `mx||mz`. No change needed unless `len === 0` case leaks (we guard with `if(mx || mz)`). Leave it.

- [ ] **Step 5: Run M1+M2 — expect GREEN**

```
python tests/run_niwa_behavior_test.py
```
Expected: all 32 M1+M2 assertions pass. Exit 0 from this block (other tests don't exist yet so the smoke `expect('hook ready', ...)` plus 32 movement assertions = 33 pass total).

- [ ] **Step 6: Validator**

```
python C:/tmp/check_dup_const.py niwa.html
```
Expected: clean.

- [ ] **Step 7: Commit GREEN**

```
git add niwa.html
git commit -m "refactor(niwa): Quaternion.slerp avatar rotation (GREEN M1+M2, P3)"
```

---

## Task 6: T1 + T3 — URL hash teleport + facing preservation — RED (P4)

**Files:**
- Modify: `tests/niwa_behavior_test.py` (append T1 + T3 blocks)

T1: `?scene=island#oto` initial load lands avatar near (0, ?, -16) ±3. T3: facing preserved across `_teleportToIslandSection('hoshi')`.

- [ ] **Step 1: Add T1 block to `main()`** (after M2 block, before `b.close()`)

```python
        # ===== T1: URL hash initial teleport =====
        print('\n[T1] URL hash #oto initial teleport')
        # Reload with hash to exercise the hash path.
        page.goto(f'{URL}#oto', wait_until='load', timeout=30000)
        wait_island_ready(page)
        page.wait_for_timeout(800)  # allow pending teleport setTimeout
        p = page.evaluate("""() => ({
          x: window.__niwa.avatar.position.x,
          y: window.__niwa.avatar.position.y,
          z: window.__niwa.avatar.position.z,
          scene: window.__niwa.currentScene.name
        })""")
        # oto cell: dx=0, dz=-1 → world (0, *, -20) + spawn offset 4 → (0, *, -16)
        ok = abs(p['x'] - 0) < 3.0 and abs(p['z'] - (-16)) < 3.0 and p['scene'] == 'island'
        expect('T1 #oto initial teleport', ok,
               f"pos=({p['x']:+.2f}, {p['y']:.2f}, {p['z']:+.2f}) scene={p['scene']} "
               f"want (~0, ?, ~-16, island)")
```

- [ ] **Step 2: Add T3 block** (after T1)

```python
        # ===== T3: facing preserved across teleport =====
        print('\n[T3] facing preserved across teleport')
        # Set a non-trivial rotation, teleport, compare rotation.
        page.evaluate("() => { window.__niwa.avatar.rotation.y = 1.234; }")
        before_yaw = page.evaluate("() => window.__niwa.avatar.rotation.y")
        page.evaluate("() => window.__niwa._teleportToIslandSection('hoshi')")
        page.wait_for_timeout(400)
        after_yaw = page.evaluate("() => window.__niwa.avatar.rotation.y")
        delta = abs(after_yaw - before_yaw)
        # Wrap-around tolerance: 2π identical
        delta = min(delta, abs(delta - 2 * math.pi))
        ok = delta < 0.01
        expect('T3 facing preserved across teleport', ok,
               f'before={before_yaw:+.3f} after={after_yaw:+.3f} delta={delta:.4f}')
```

- [ ] **Step 3: Run — expect RED**

```
python tests/run_niwa_behavior_test.py
```
Expected:
- T1: probably **FAILS** because the current code has no URL-hash teleport on initial load.
- T3: **FAILS** because current `_tabClick` sets `avatar.rotation.y = Math.atan2(bx - tx, bz - tz)` (rotates avatar to face the building).

- [ ] **Step 4: Commit RED**

```
git add tests/niwa_behavior_test.py
git commit -m "test(niwa): T1+T3 hash-teleport + facing-preserve (RED, P4)"
```

---

## Task 7: URL hash + teleportToIslandSection facing preservation — GREEN T1+T3 (P5)

**Files:**
- Modify: `niwa.html` — add `teleportToIslandSection()` helper, rewrite `_tabClick`, parse hash on load, call helper from island `build()`.

- [ ] **Step 1: Insert the shared teleport helper above `_tabClick` (niwa.html:7562)**

Insert immediately before `function _tabClick(id){`:
```js
function teleportToIslandSection(id){
  if(!SCENE_WORLD_POS[id]) return;
  if(!currentScene || currentScene.name !== 'island') return;
  const pos = SCENE_WORLD_POS[id];
  const cx = pos.dx * ISLAND_SEPARATION;
  const cz = pos.dz * ISLAND_SEPARATION;
  // D4: try 5 spawn candidates south of the building.  First clear one wins.
  const offsets = [[0, 4], [0, 5.5], [2, 4], [-2, 4], [0, 6.5]];
  let chosen = null;
  for(const [dx, dz] of offsets){
    const tx = cx + dx, tz = cz + dz;
    if(_isClearSpawn(tx, tz)){ chosen = { x: tx, z: tz }; break; }
  }
  if(!chosen) chosen = { x: cx, z: cz + 4 };
  avatar.position.set(chosen.x, 0, chosen.z);
  if(typeof sampleHeight === 'function'){
    const gy = sampleHeight(chosen.x, chosen.z);
    if(isFinite(gy) && gy < 30) avatar.position.y = gy;
  }
  // D3: facing preserved — DO NOT touch avatar.quaternion or rotation here.
  if(typeof playerVel !== 'undefined') playerVel.set(0, 0, 0);
  if(typeof verticalVel !== 'undefined') verticalVel = 0;
  if(currentScene){
    currentScene.spawnPos = { x: chosen.x, y: avatar.position.y, z: chosen.z };
  }
  bridgeCooldownUntil = performance.now() + 1500;
  try { history.replaceState(null, '', `?scene=island#${id}`); } catch(_){}
}

function _isClearSpawn(x, z){
  // Bounds check
  const pb = currentScene && currentScene.playableBounds;
  if(pb && (x < pb.minX || x > pb.maxX || z < pb.minZ || z > pb.maxZ)) return false;
  // Obstacle check (round + AABB), same predicate the movement controller uses
  for(const ob of (ENTITIES.obstacles || [])){
    if(Math.hypot(x - ob.x, z - ob.z) < ob.r + AV_RADIUS) return false;
  }
  for(const b of (ENTITIES.boxObstacles || [])){
    if(x > b.minX - AV_RADIUS && x < b.maxX + AV_RADIUS &&
       z > b.minZ - AV_RADIUS && z < b.maxZ + AV_RADIUS) return false;
  }
  // Mobility: can move at least 0.5m in some direction.
  for(const [dx, dz] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]){
    const nx = x + dx, nz = z + dz;
    let blocked = false;
    for(const ob of (ENTITIES.obstacles || [])){
      if(Math.hypot(nx - ob.x, nz - ob.z) < ob.r + AV_RADIUS){ blocked = true; break; }
    }
    if(!blocked){
      for(const b of (ENTITIES.boxObstacles || [])){
        if(nx > b.minX - AV_RADIUS && nx < b.maxX + AV_RADIUS &&
           nz > b.minZ - AV_RADIUS && nz < b.maxZ + AV_RADIUS){ blocked = true; break; }
      }
    }
    if(!blocked) return true;
  }
  return false;
}
```

- [ ] **Step 2: Replace `_tabClick`'s inline teleport with a call to the helper**

Current `niwa.html:7562-7602`:
```js
function _tabClick(id){
  if(currentScene && currentScene.name === 'island' && SCENE_WORLD_POS[id]){
    const pos = SCENE_WORLD_POS[id];
    const tx = pos.dx * ISLAND_SEPARATION;
    const tz = pos.dz * ISLAND_SEPARATION + 4.0;
    avatar.position.set(tx, 0, tz);
    if(typeof sampleHeight === 'function'){
      const groundY = sampleHeight(tx, tz);
      if(isFinite(groundY) && groundY < 30) avatar.position.y = groundY;
    }
    if(typeof playerVel !== 'undefined') playerVel.set(0,0,0);
    if(typeof verticalVel !== 'undefined') verticalVel = 0;
    if(currentScene){
      currentScene.spawnPos = { x: tx, y: avatar.position.y, z: tz };
    }
    bridgeCooldownUntil = performance.now() + 1500;
    const bx = pos.dx * ISLAND_SEPARATION;
    const bz = pos.dz * ISLAND_SEPARATION;
    avatar.rotation.y = Math.atan2(bx - tx, bz - tz);
    camYawTarget = -avatar.rotation.y - Math.PI*0.5;
    try { history.replaceState(null, '', `?scene=island#${id}`); } catch(_){}
    return;
  }
  switchScene(id);
}
```

Replace with:
```js
function _tabClick(id){
  if(currentScene && currentScene.name === 'island' && SCENE_WORLD_POS[id]){
    teleportToIslandSection(id);
    return;
  }
  switchScene(id);
}
```

- [ ] **Step 3: Add initial-hash parsing near urlParams reading**

Find where `urlParams.get('scene')` is read (search for `urlParams.get('scene')` — typically near the bottom of the page-init block). Add a sibling read for `location.hash`:

```js
const _pendingHash = (() => {
  const h = (location.hash || '').replace('#', '').trim();
  return (h && SCENE_WORLD_POS[h]) ? h : null;
})();
```

Place this AFTER `SCENE_WORLD_POS` is defined (line 497+) and BEFORE the island `build()` runs.

- [ ] **Step 4: Trigger teleport once island is built**

At the end of `SCENES.island.build()` (find the closing brace of `build()` in `SCENES.island = {...}` — anchored near `placeENC('enc_prefab_plaza', 0, -5.46, 0, 1.0, 0)` at `niwa.html:7468`, the `build()` ends a few hundred lines later — locate by searching for the next `},` after the island prefab placements). Add at the very end of the build function body, just before the closing `}`:

```js
    if(_pendingHash){
      const _h = _pendingHash;
      setTimeout(() => { try { teleportToIslandSection(_h); } catch(_){} }, 100);
    }
```

> If the island build is async or wrapped in a streamed-load callback, attach the setTimeout AFTER the `_islandStreamedCount === 9` callback so all prefabs are present. Search `_islandStreamedCount` for the right hook.

- [ ] **Step 5: Validator**

```
python C:/tmp/check_dup_const.py niwa.html
```
Expected: clean. (We've added 1 module-scope function `teleportToIslandSection`, 1 helper `_isClearSpawn`, 1 const `_pendingHash`.)

- [ ] **Step 6: Run T1+T3 — expect GREEN**

```
python tests/run_niwa_behavior_test.py
```
Expected: M1+M2 still pass + T1 PASS + T3 PASS. 34 total pass (1 smoke + 32 movement + 2 teleport).

- [ ] **Step 7: Commit GREEN**

```
git add niwa.html
git commit -m "feat(niwa): URL hash teleport + facing preservation (GREEN T1+T3, P5)"
```

---

## Task 8: T2 — all 9 sections tab-teleport + walk-after — RED (P6)

**Files:**
- Modify: `tests/niwa_behavior_test.py` (append T2 block)

For each of 9 island sections: programmatic tab click → assert position within ±3m of expected + can walk ≥0.5m with W. 18 assertions.

- [ ] **Step 1: Reload to island with no hash, then iterate**

Add T2 block (after T3) inside `main()`:

```python
        # ===== T2: 9 sections tab-teleport + walk-after =====
        print('\n[T2] tab teleport + walk-after for all 9 island sections')
        page.goto(URL, wait_until='load', timeout=30000)
        wait_island_ready(page)
        SECTIONS = [
            ('plaza',   0,  0),  # cell (0, 0)
            ('monlight', 1, -1), ('oto', 0, -1), ('tabi', -1, -1),
            ('hoshi',   1,  0), ('toki', -1,  0),
            ('takibi',  1,  1), ('mizube', 0,  1), ('amaoto', -1, 1),
        ]
        ISLAND_SEPARATION = 20.0
        for name, dx, dz in SECTIONS:
            page.evaluate(f"() => window.__niwa._tabClickProgrammatic('{name}')")
            page.wait_for_timeout(500)
            p = page.evaluate("() => ({x: window.__niwa.avatar.position.x, y: window.__niwa.avatar.position.y, z: window.__niwa.avatar.position.z})")
            ex_x = dx * ISLAND_SEPARATION
            ex_z = dz * ISLAND_SEPARATION + 4.0
            pos_ok = abs(p['x'] - ex_x) < 3.0 and abs(p['z'] - ex_z) < 3.0
            expect(f'T2 tab #{name} position', pos_ok,
                   f"got=({p['x']:+.2f}, {p['y']:.2f}, {p['z']:+.2f}) want (~{ex_x}, ?, ~{ex_z})")
            # Walk test
            before = pos_xz(page)
            hold_key_frames(page, 'w', frames=40)
            after = pos_xz(page)
            moved = math.hypot(after['x'] - before['x'], after['z'] - before['z'])
            expect(f'T2 walk after #{name}', moved > 0.5,
                   f'moved {moved:.2f}m')
```

- [ ] **Step 2: Run — expect RED**

```
python tests/run_niwa_behavior_test.py
```
Expected: some `T2 walk after #X` fail because the island `playableBounds` may be too tight, or `_isClearSpawn` rejects valid cells.

- [ ] **Step 3: Commit RED**

```
git add tests/niwa_behavior_test.py
git commit -m "test(niwa): T2 9-section tab teleport + walk (RED, P6)"
```

---

## Task 9: Obstacle-aware probe + island playableBounds — GREEN T2 (P7)

**Files:**
- Modify: `niwa.html` — verify island `playableBounds` is ±35m disc, ensure `_isClearSpawn` gives the 5-candidate probe room.

- [ ] **Step 1: Find island playableBounds**

In the island scene `build()` body, find where `currentScene.playableBounds` is set. If absent or too tight (< ±32m), set it to:
```js
    currentScene.playableBounds = { minX: -35, maxX: 35, minZ: -35, maxZ: 35 };
```
The island spans cells dx,dz ∈ {-1, 0, 1} × ISLAND_SEPARATION=20 → ±20m of building centres, +4m spawn offset → reach ±24m. ±35m gives margin.

> Search `niwa.html` for `playableBounds` in the island `build()` body (between `SCENES.island = {` and its terminating `};` block).

- [ ] **Step 2: Verify `_isClearSpawn` matches `blocked()` predicate**

Compare to `niwa.html:9395-9420`. The helper from Task 7 already mirrors obstacle checks. Confirm `AV_RADIUS` is in scope at the call site (it's module-level, should be fine).

- [ ] **Step 3: Run T2 — expect GREEN**

```
python tests/run_niwa_behavior_test.py
```
Expected: all 18 T2 assertions PASS plus M1+M2+T1+T3+smoke = 53 pass.

- [ ] **Step 4: Commit GREEN**

```
git add niwa.html
git commit -m "fix(niwa): island playableBounds + obstacle-aware spawn probe (GREEN T2, P7)"
```

---

## Task 10: V1 + V2 — 1P/3P toggle state + 1P W direction — RED (P8)

**Files:**
- Modify: `tests/niwa_behavior_test.py` (append V1 + V2 blocks)

V1: toggling 3P → 1P → 3P preserves position (±0.01m) and rotation.y (±0.01 rad). V2: in 1P at 4 fpYaws, W moves into camera-look (dot > 0.7). V2 overlaps with M2 by design — M2 confirms desktop event path, V2 confirms the toggle path.

- [ ] **Step 1: Add V1 block to `main()`** (after T2)

```python
        # ===== V1: 1P ↔ 3P toggle preserves state =====
        print('\n[V1] 1P/3P toggle state preservation')
        page.evaluate("() => window.__niwa._setFirstPerson(false)")
        # Place + rotate avatar
        page.evaluate("""() => {
          window.__niwa.avatar.position.set(7.7, 0, -3.3);
          window.__niwa.avatar.rotation.y = 0.987;
        }""")
        before = page.evaluate("() => ({x: window.__niwa.avatar.position.x, z: window.__niwa.avatar.position.z, ry: window.__niwa.avatar.rotation.y})")
        page.evaluate("() => window.__niwa._setFirstPerson(true)")
        page.wait_for_timeout(150)
        page.evaluate("() => window.__niwa._setFirstPerson(false)")
        page.wait_for_timeout(150)
        after = page.evaluate("() => ({x: window.__niwa.avatar.position.x, z: window.__niwa.avatar.position.z, ry: window.__niwa.avatar.rotation.y})")
        pos_ok = abs(after['x'] - before['x']) < 0.01 and abs(after['z'] - before['z']) < 0.01
        rot_ok = min(abs(after['ry'] - before['ry']), abs(abs(after['ry'] - before['ry']) - 2*math.pi)) < 0.01
        expect('V1 toggle preserves position', pos_ok,
               f"before=({before['x']:+.2f},{before['z']:+.2f}) after=({after['x']:+.2f},{after['z']:+.2f})")
        expect('V1 toggle preserves rotation', rot_ok,
               f"before={before['ry']:+.3f} after={after['ry']:+.3f}")
```

- [ ] **Step 2: Add V2 block** (after V1)

```python
        # ===== V2: 1P W follows fpYaw (4 yaws, dot > 0.7) =====
        print('\n[V2] 1P W follows fpYaw')
        for fp in (0.0, math.pi / 3, math.pi, -math.pi / 4):
            page.evaluate(f"() => window.__niwa._setFirstPerson(true, {fp})")
            page.wait_for_timeout(150)
            reset_pos(page)
            before = pos_xz(page)
            hold_key_frames(page, 'w', frames=30)
            after = pos_xz(page)
            dx, dz, moved, _, (ux, uz) = measure_direction(page, before, after)
            ex_x, ex_z = math.sin(fp), math.cos(fp)
            dot = ux * ex_x + uz * ex_z
            ok = moved > 0.3 and dot > 0.7
            expect(f'V2 fpYaw={fp:+.2f} W → cam-fwd', ok,
                   f'Δ=({dx:+.2f},{dz:+.2f}) moved={moved:.2f} dot={dot:+.2f}')
        page.evaluate("() => window.__niwa._setFirstPerson(false)")
```

- [ ] **Step 3: Run — expect RED**

```
python tests/run_niwa_behavior_test.py
```
Expected: V1 toggle rotation may FAIL because the existing 1P→3P branch snaps `camYawTarget = avatar.rotation.y + Math.PI` which doesn't affect avatar rotation but might leak through animate(). V2 should already pass (Task 5's `firstPerson` branch sets avatar.quaternion from fpYaw). If V2 passes, leave it green — V1 is the focus here.

- [ ] **Step 4: Commit RED**

```
git add tests/niwa_behavior_test.py
git commit -m "test(niwa): V1+V2 toggle + 1P direction (RED, P8)"
```

---

## Task 11: 1P/3P toggle preserves state — GREEN V1+V2 (P9)

**Files:**
- Modify: `niwa.html:8749-8766` (1P/3P button handler)

The current handler at `niwa.html:8758-8765` does `fpYaw = avatar.rotation.y` on enter-1P and `camYawTarget = avatar.rotation.y + Math.PI` on exit-1P. Avatar position/rotation should be untouched. If V1 FAILed, something downstream is moving the avatar — likely the animate-frame slerp from Task 5 running while `firstPerson` true and then false within same frame.

- [ ] **Step 1: Add a "no-snap on exit-1P" guard**

Change `niwa.html:8758-8765` to:
```js
  if(firstPerson){
    // Enter 1P: snap fpYaw to current avatar yaw so view doesn't twist.
    fpYaw = avatar.rotation.y;
    fpPitch = -0.1;
    // Freeze playerVel so the next-frame slerp doesn't fight the snap.
    if(typeof playerVel !== 'undefined') playerVel.set(0, 0, 0);
  } else {
    // Exit 1P: snap orbit cam target behind avatar.  Avatar rotation
    // is preserved (no write).
    camYawTarget = avatar.rotation.y + Math.PI;
    if(typeof playerVel !== 'undefined') playerVel.set(0, 0, 0);
  }
```

- [ ] **Step 2: Run V1+V2 — expect GREEN**

```
python tests/run_niwa_behavior_test.py
```
Expected: V1 (2) + V2 (4) pass, plus all prior = 59 pass total (1 + 16 + 16 + 1 + 1 + 18 + 2 + 4).

- [ ] **Step 3: Validator**

```
python C:/tmp/check_dup_const.py niwa.html
```

- [ ] **Step 4: Commit GREEN**

```
git add niwa.html
git commit -m "fix(niwa): 1P/3P toggle preserves avatar state (GREEN V1+V2, P9)"
```

---

## Task 12: S1 — bridge Y vs cobble Y test — RED (P10)

**Files:**
- Modify: `tests/niwa_behavior_test.py` (append S1 block)

Walk every bridge midpoint and compare `sampleHeight(bridgeMid)` to `sampleHeight(cobbleMid)` of each end-island. ~12 pairs.

- [ ] **Step 1: Add S1 block to `main()`** (after V2)

```python
        # ===== S1: bridge Y aligns with cobble Y =====
        print('\n[S1] bridge Y vs cobble Y at end-island centres')
        page.goto(URL, wait_until='load', timeout=30000)
        wait_island_ready(page)
        ISLAND_SEPARATION = 20.0
        # Each bridge spans two adjacent SCENE_WORLD_POS cells.
        # Use the same neighbor table as niwa.html's island builder.
        BRIDGES = [
            ('plaza','monlight'), ('plaza','oto'), ('plaza','tabi'),
            ('plaza','hoshi'),    ('plaza','toki'),
            ('plaza','takibi'),   ('plaza','mizube'), ('plaza','amaoto'),
            ('oto','monlight'),   ('oto','tabi'),
            ('mizube','takibi'),  ('mizube','amaoto'),
        ]
        CELLS = {'plaza':(0,0), 'monlight':(1,-1), 'oto':(0,-1), 'tabi':(-1,-1),
                 'hoshi':(1,0), 'toki':(-1,0),
                 'takibi':(1,1), 'mizube':(0,1), 'amaoto':(-1,1)}
        for a, b in BRIDGES:
            ax, az = CELLS[a][0]*ISLAND_SEPARATION, CELLS[a][1]*ISLAND_SEPARATION
            bx, bz = CELLS[b][0]*ISLAND_SEPARATION, CELLS[b][1]*ISLAND_SEPARATION
            mx, mz = (ax + bx) * 0.5, (az + bz) * 0.5
            ya = page.evaluate(f"() => window.__niwa._sampleHeight({ax}, {az})")
            ym = page.evaluate(f"() => window.__niwa._sampleHeight({mx}, {mz})")
            yb = page.evaluate(f"() => window.__niwa._sampleHeight({bx}, {bz})")
            cob = (ya + yb) / 2.0
            delta = abs(ym - cob)
            ok = delta < 0.5
            expect(f'S1 bridge {a}↔{b} Y match', ok,
                   f'cobble~{cob:.2f} bridge~{ym:.2f} Δ={delta:.2f}m')
```

- [ ] **Step 2: Run — expect S1 RED**

```
python tests/run_niwa_behavior_test.py
```
Expected: S1 entries that involve the plaza will FAIL by ~5.46m because the plaza prefab is still un-normalized (Task 1's .glb hasn't been uploaded to pCloud yet — see Task 13 gating note).

- [ ] **Step 3: Commit RED**

```
git add tests/niwa_behavior_test.py
git commit -m "test(niwa): S1 bridge-Y vs cobble-Y (RED, P10)"
```

---

## Task 13: Restore plaza Y=0 once new GLB is live — GREEN S1 (P11)

**Files:**
- Modify: `niwa.html:7468`

**Blocker:** This task waits on the user copying Task 1's `enc_prefab_plaza.glb` to pCloud and pCloud Drive sync completing. The Task 12 RED can sit pending this.

- [ ] **Step 1: User confirms pCloud sync done**

User says "ready" / "uploaded".

- [ ] **Step 2: Verify hashed/etag refresh**

Hit pCloud URL in browser DevTools network tab to confirm new modification date is reflected. If a CDN cache layer is in use, force a refresh (query param `?v=20260531`).

- [ ] **Step 3: Restore Y=0 in island prefab placement**

Change `niwa.html:7468`:
```js
    placeENC('enc_prefab_plaza', 0, -5.46, 0, 1.0, 0);
```
to:
```js
    placeENC('enc_prefab_plaza', 0, 0, 0, 1.0, 0);
```

- [ ] **Step 4: Reload and check `sampleHeight(0, 0)`**

Manually in browser console:
```js
window.__niwa._sampleHeight(0, 0)
```
Expected: a value close to 0 (within ±0.3m), not 5.46.

- [ ] **Step 5: Run S1 — expect GREEN**

```
python tests/run_niwa_behavior_test.py
```
Expected: all 12 S1 + everything else = ~71 pass, 0 fail.

- [ ] **Step 6: Commit GREEN**

```
git add niwa.html
git commit -m "fix(niwa): restore plaza Y=0 after v636 re-extract (GREEN S1, P11)"
```

---

## Task 14: PMREM environment from Sky shader (P12 — PMREM half)

**Files:**
- Modify: `niwa.html` — add PMREMGenerator + CubeRenderTarget, hook into `setSun()` at line 709.

- [ ] **Step 1: Find `setSun()`**

At `niwa.html:709`:
```js
function setSun(elev, azim){
  // existing sun position / color / sky uniform updates
}
```

- [ ] **Step 2: Add PMREM scaffolding near the renderer init (top of file)**

After the renderer is constructed (search `new THREE.WebGLRenderer`), add:
```js
let _pmremGen = null;
const _skyCubeTarget = new THREE.WebGLCubeRenderTarget(128, {
  type: THREE.HalfFloatType, generateMipmaps: true,
});
let _skyCube = null;  // THREE.CubeCamera lazily created
let _pmremDirty = true;
```

- [ ] **Step 3: Add `regenerateEnvironment()`**

Place above `setSun()`:
```js
function regenerateEnvironment(){
  // Skip in IS_MOBILE or interior scenes.
  if(IS_MOBILE) return;
  if(currentScene && currentScene.def && currentScene.def.kind === 'interior'){
    scene.environment = null; return;
  }
  try {
    if(!_pmremGen) _pmremGen = new THREE.PMREMGenerator(renderer);
    if(!_skyCube) _skyCube = new THREE.CubeCamera(0.1, 10000, _skyCubeTarget);
    const prevBg = scene.background;
    scene.background = sky;  // capture sky shader
    _skyCube.update(renderer, scene);
    scene.background = prevBg;
    const env = _pmremGen.fromCubeRenderTarget(_skyCubeTarget);
    if(scene.environment && scene.environment.dispose) scene.environment.dispose();
    scene.environment = env.texture;
    _pmremDirty = false;
  } catch(e){ console.warn('PMREM regen failed:', e); }
}
```

- [ ] **Step 4: Hook into `setSun()`**

At the end of `setSun()`, add:
```js
  _pmremDirty = true;
```

And in `animate()` (top of frame, after `dt` calc):
```js
  if(_pmremDirty) regenerateEnvironment();
```

(Skipping immediate regen avoids stutter — only one PMREM build per setSun call.)

- [ ] **Step 5: Interior cleanup hook**

Search for where the interior scene becomes current (`buildScene` or scene switching code). On interior scene activate, set `scene.environment = null`. On exit, set `_pmremDirty = true` so the next animate frame rebuilds.

- [ ] **Step 6: Manual smoke**

Reload `?scene=island` and visually confirm metallic/glossy materials (sword in stone, lantern caps) show subtle reflections from sky. Open mobile UA spoof (DevTools) and confirm `scene.environment === null`.

- [ ] **Step 7: Validator + behaviour test sanity**

```
python C:/tmp/check_dup_const.py niwa.html
python tests/run_niwa_behavior_test.py
```
Expected: all tests still pass (PMREM doesn't affect avatar movement).

- [ ] **Step 8: Commit**

```
git add niwa.html
git commit -m "feat(niwa): PMREM environment from Sky shader (P12a)"
```

---

## Task 15: Bloom retune + FXAA pass (P12 — Bloom half)

**Files:**
- Modify: `niwa.html:9128-9131` (bloom params), `niwa.html:9132-9135` (replace SMAA with FXAA optional — keep SMAA).

- [ ] **Step 1: Update bloom params at `niwa.html:9128-9130`**

Current:
```js
  const bloomStrength = (IS_MOBILE || REDUCED_MOTION) ? 0.08 : 0.15;
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight),
                                      bloomStrength, 0.40, 0.88);
```

Change to (threshold 0.85, strength 0.55, radius 0.30, half-res buffer):
```js
  const bloomStrength = (IS_MOBILE || REDUCED_MOTION) ? 0.0 : 0.55;
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5),  // half-res
    bloomStrength, 0.30, 0.85
  );
```

- [ ] **Step 2: Verify the import for FXAAShader (only if SMAA is not enough)**

The existing SMAAPass at `niwa.html:9133` handles AA. The spec calls out FXAA in addition; SMAA is already higher quality. **Decision:** keep SMAA, skip FXAA. If a future visual review demands FXAA, append after SMAA.

> If you DO add FXAA, add to imports near `niwa.html:390`:
> ```js
> import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
> import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
> ```
> And after the SMAA block:
> ```js
> const fxaa = new ShaderPass(FXAAShader);
> fxaa.material.uniforms.resolution.value.set(1 / window.innerWidth, 1 / window.innerHeight);
> composer.addPass(fxaa);
> ```

- [ ] **Step 3: Mobile bloom bypass**

If `IS_MOBILE`, `bloomStrength = 0` makes the pass a no-op (already done in Step 1). Confirm no visible white-out by spoofing mobile UA in DevTools.

- [ ] **Step 4: Resize handler**

The existing `window.addEventListener('resize', ...)` at `niwa.html:9954` calls `composer.setSize(...)`. Confirm bloom's half-res buffer scales automatically — UnrealBloomPass internally derives from `composer.setSize`, so no additional changes.

- [ ] **Step 5: Run behaviour tests + manual visual smoke**

```
python tests/run_niwa_behavior_test.py
```
Expected: 71 pass, 0 fail. Visually confirm in browser: sun highlights bloom subtly without white-washing.

- [ ] **Step 6: Commit**

```
git add niwa.html
git commit -m "feat(niwa): retune Bloom (thr 0.85 str 0.55 r 0.30 halfRes) (P12b)"
```

---

## Task 16: Requesting code review (P13)

**Files:**
- None changed; spawn a review subagent.

- [ ] **Step 1: Read the requesting-code-review skill**

Open `C:\Users\yuich\.claude\skills\obra-superpowers\requesting-code-review\SKILL.md`. Follow its protocol.

- [ ] **Step 2: Spawn a fresh `general-purpose` subagent**

Prompt the subagent with:
> "Branch `feature/niwa-controls-refactor` in `C:/projects/yuichi916.github.io/.worktrees/niwa-controls-refactor` implements the spec at `docs/superpowers/specs/2026-05-31-niwa-controls-refactor-design.md`. Review the diff against `main` (`git diff main..HEAD niwa.html tests/ _blender/enc_extract_plaza_v636.py`). Report independently on: (a) any direction sign bugs that could regress M1/M2; (b) any teleport state leak that could regress T3; (c) any postprocessing initialization order that could break in mobile/reduced-motion mode. Report under 400 words with file:line refs."

- [ ] **Step 3: Address findings**

If review finds issues, fix inline and re-run `python tests/run_niwa_behavior_test.py`. Commit each fix as `fix(niwa): <issue> (review #N)`.

---

## Task 17: Finishing the development branch (P14)

**Files:**
- None directly; orchestrates merge.

- [ ] **Step 1: Read the finishing-a-development-branch skill**

Open `C:\Users\yuich\.claude\skills\obra-superpowers\finishing-a-development-branch\SKILL.md`. Follow its protocol.

- [ ] **Step 2: Confirm full test pass on the worktree**

```
python tests/run_niwa_behavior_test.py
```
Expected: 71 pass, 0 fail.

- [ ] **Step 3: Confirm validator clean**

```
python C:/tmp/check_dup_const.py niwa.html
```

- [ ] **Step 4: Merge to main**

From the main worktree at `C:/projects/yuichi916.github.io`:
```
git checkout main
git merge --no-ff feature/niwa-controls-refactor -m "merge: niwa controls/teleport/bridges/visuals refactor (spec 2026-05-31)"
git push origin main
```

- [ ] **Step 5: Clean up worktree**

```
git worktree remove .worktrees/niwa-controls-refactor
git branch -d feature/niwa-controls-refactor
```

- [ ] **Step 6: Verify live**

Open https://yuichi916.github.io/niwa.html?scene=island and visually confirm:
- WASD moves into the camera direction at all rotations
- Tab teleport works for all 9 sections, walk works after each
- 1P/3P toggle preserves view
- Bridges visually connect to plaza cobble without a 5m gap
- Bloom subtle, not white-out

---

## Self-Review Notes

Spec coverage check:
- D1 camera-forward WASD → Task 5 ✓
- D2 hash teleport → Task 7 step 3-4 ✓
- D3 facing preservation → Task 7 step 1 ✓ (`// D3` comment in helper) + Task 6 RED ✓
- D4 obstacle-aware probe → Task 7 step 1 `_isClearSpawn` + Task 9 ✓
- D5 plaza re-extract → Tasks 1 + 13 ✓
- D6 threshold bloom → Task 15 ✓
- D7 Sky → PMREM → Task 14 ✓
- D8 70 assertions M1+M2+T1+T2+T3+V1+V2+S1 → Tasks 4, 6, 8, 10, 12 (16+16+1+18+1+2+4+12 = 70 ✓)
- D9 postprocessing mobile-OFF → Task 14 step 3 + Task 15 step 1 ✓
- D10 TDD order → Tasks ordered RED→GREEN per pair ✓

Placeholder scan: no TBD/TODO/"implement later" markers. Each step has either code or exact commands.

Type consistency: `teleportToIslandSection`, `_isClearSpawn`, `_pendingHash`, `regenerateEnvironment` defined once each. M1/M2 helpers `reset_pos`, `hold_key_frames`, `measure_direction`, `pos_xz` defined in Task 4 and reused unchanged in Task 10. `SECTIONS` table in Task 8 matches `CELLS` table in Task 12.

Scope: single focused plan covering one branch's worth of work (~3-6 hours including pCloud blocking).
