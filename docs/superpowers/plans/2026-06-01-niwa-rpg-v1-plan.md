# niwa.html RPG v1 (Action-Adventure) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add action-adventure RPG layer to niwa.html — ground-fill plane stops void-walking, multi-AABB stops building clipping, Space jumps + vaults ≤2.5m ledges, E enters per-section interiors, Soul Smoker placed in takibi, HUD shows interactable prompts.

**Architecture:** All changes in `niwa.html` except one Blender extractor (`_blender/enc_extract_int_soul_smoker.py`) and one CSS/HTML addition. New module-level state: `ENTITIES.interactables`, `climbActive`+state, `verticalVel` reused for jumps. New runtime mesh: ground-fill plane (invisible, Y=0, 70×70m). Multi-AABB collision filters mesh names against `wall|building|roof` allowlist.

**Tech Stack:** Three.js r155 single-file ES module, existing animate scope, existing diag hook (extended), Playwright Python tests.

**Anchors** (current `feature/niwa-rpg-v1` @ `bc59554`):
- `SCENES.island.build()`: ~line 7490
- `addPortalForScene`: search `function addPortalForScene`
- `buildScene` ENTITIES reset: line ~6184
- `blocked()` definition: ~line 9494
- Movement controller animate scope: lines 9319-9450
- `_islandStreamedCount` declaration: ~line 7574
- `__niwa` diag hook: ~line 10330
- `SCENES.<name>_int` defs: search `_int.*:.*{` (already exist)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `niwa.html` | Modify | All runtime: ground-fill, sky-miss, multi-AABB, climb-vault, interactables, HUD, portals, Soul Smoker placement |
| `_blender/enc_extract_int_soul_smoker.py` | Create | KB3D Enchanted Interiors → `enc_int_soul_smoker.glb` extractor |
| `tests/niwa_behavior_test.py` | Modify | Append G1-G5 (5 new assertions) |

---

## Task 1: Ground-fill plane (P0)

**Files:** Modify `niwa.html` — add to `SCENES.island.build()` body.

- [ ] **Step 1: Locate island.build()**

Search `SCENES.island = {` in niwa.html (anchor at line ~7490). The `build(root){` opens immediately after `preloadAssets: ['enc_prefab_plaza'],`.

- [ ] **Step 2: Add ground-fill near top of build()**

Insert immediately after `placeENC('enc_prefab_plaza', 0, 0, 0, 1.0, 0);`:
```js
    // v657: invisible ground-fill at Y=0 covers the entire island disc
    // so sky-miss raycasts always have a fallback ground.  Prevents
    // walk-over-void bugs.  Tagged isWalkSurface so sampleHeight picks
    // it up; opacity 0 keeps it invisible.
    const _gf = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0x1a2a18, roughness: 1.0, metalness: 0,
        transparent: true, opacity: 0.0, side: THREE.DoubleSide,
      })
    );
    _gf.rotation.x = -Math.PI * 0.5;
    _gf.position.y = 0;
    _gf.userData.isGroundFill = true;
    _gf.userData.isWalkSurface = true;
    _gf.receiveShadow = false;
    root.add(_gf);
```

- [ ] **Step 3: Validate**

```
python C:/tmp/check_dup_const.py niwa.html
```
Expected: clean.

- [ ] **Step 4: Commit**

```
git add niwa.html
git commit -m "feat(niwa): ground-fill plane at Y=0 for island (P0)"
```

---

## Task 2: Sky-miss strict revert (P1)

**Files:** Modify `niwa.html:9494-9528` (`blocked()` function).

- [ ] **Step 1: Find blocked() body**

Anchor: `function blocked(px, pz)` ~line 9494.

- [ ] **Step 2: Replace the sky-miss branch**

Find:
```js
    if(isFinite(nextY)){
      if(nextY - curY > maxUp) return true;
      if(curY - nextY > maxDown) return true;
    }
    // Sky-miss (NaN / non-finite): keep legacy permissive behaviour
    // so scenes that rely on the avatar walking over raycast voids
    // (distant water, prefab seams) don't regress.
    return false;
  }
```

Replace with:
```js
    if(isFinite(nextY)){
      if(nextY - curY > maxUp) return true;
      if(curY - nextY > maxDown) return true;
    } else {
      // v657: sky-miss is now STRICT.  Ground-fill plane (Task 1) gives
      // the island a continuous Y=0 baseline so finite raycasts are
      // expected everywhere.  A non-finite sample = stepping off the
      // world edge.
      return true;
    }
    return false;
  }
```

- [ ] **Step 3: Run existing tests — expect M1+M2+T1+T2 etc. still GREEN**

```
PYTHONUTF8=1 python tests/run_niwa_behavior_test.py
```
Expected: 69 pass / 0 fail (same as baseline) — ground-fill enables strict mode.

- [ ] **Step 4: Commit**

```
git add niwa.html
git commit -m "fix(niwa): sky-miss strict block (paired with ground-fill, P1)"
```

---

## Task 3: Multi-AABB building collision (P2)

**Files:** Modify `niwa.html` — extend `buildScene` to scan prefab mesh children.

- [ ] **Step 1: Locate buildScene** at line ~6034 (`function buildScene(name)`).

- [ ] **Step 2: Find the existing single-bbox push** at line ~6261:

```js
      if(dy > 1.5 && (dx * dz) > 0.3 && (dx * dz) < 6 && dx < 3 && dz < 3){
        ENTITIES.boxObstacles.push({
          minX: _box.min.x, maxX: _box.max.x,
          minZ: _box.min.z, maxZ: _box.max.z,
        });
      }
```

This already does per-mesh AABB but the size filter is tight. **Loosen** the size filter so larger building walls are captured:

Replace the `if` line with:
```js
      const nm2 = (o.name || '').toLowerCase();
      const isGround = /ground|floor|cobble|paving|path|terrain|street|plaza/.test(nm2);
      // v657: any tall, not-too-wide non-ground mesh becomes a collider
      if(!isGround && dy > 1.5 && Math.min(dx, dz) < 8 && Math.max(dx, dz) < 14){
        ENTITIES.boxObstacles.push({
          minX: _box.min.x, maxX: _box.max.x,
          minZ: _box.min.z, maxZ: _box.max.z,
        });
      }
```

- [ ] **Step 3: Apply same logic to island streamed prefabs**

Find `_streamRemainingIslandPrefabs` (~line 7574). After `root.add(m);` and before `_islandStreamedCount++;`, add a per-mesh scan:

```js
    // v657: register multi-AABB collision for streamed prefabs too
    m.traverse(o => {
      if(!o.isMesh) return;
      const nm = (o.name || '').toLowerCase();
      if(/ground|floor|cobble|paving|path|terrain|street|plaza/.test(nm)) return;
      const bb = new THREE.Box3().setFromObject(o);
      const dx = bb.max.x - bb.min.x;
      const dy = bb.max.y - bb.min.y;
      const dz = bb.max.z - bb.min.z;
      if(dy > 1.5 && Math.min(dx, dz) < 8 && Math.max(dx, dz) < 14){
        ENTITIES.boxObstacles.push({
          minX: bb.min.x, maxX: bb.max.x,
          minZ: bb.min.z, maxZ: bb.max.z,
        });
      }
    });
```

- [ ] **Step 4: Validate + smoke test**

```
python C:/tmp/check_dup_const.py niwa.html
PYTHONUTF8=1 python tests/run_niwa_behavior_test.py
```
Expected: still 69 GREEN. Walk-after distances may decrease (avatar bumping building walls earlier) but > 0.5m must remain.

- [ ] **Step 5: Commit**

```
git add niwa.html
git commit -m "feat(niwa): multi-AABB per-mesh building collision (P2)"
```

---

## Task 4: Climb-vault on Space (P3)

**Files:** Modify `niwa.html` — add climb state + `tryClimbOrJump` + keydown handler.

- [ ] **Step 1: Add module-level climb state**

Near other state declarations (~line 8820, after `let camYawState`), add:
```js
// v657: climb-vault state — Space triggers jump or vault depending on
// whether a ledge is detected within 0.6m forward + 2.5m up.
let climbActive = false;
let climbStart = 0;
const CLIMB_DURATION = 0.35;
let climbFromX = 0, climbFromY = 0, climbFromZ = 0;
let climbToX = 0, climbToY = 0, climbToZ = 0;
```

- [ ] **Step 2: Add tryClimbOrJump near _tabClick** (search `function _tabClick`):

Insert after `function _tabClick(id)` body:
```js
function tryClimbOrJump(){
  if(climbActive) return;
  // Only trigger when grounded (verticalVel ≈ 0 AND avatar y matches sample)
  if(Math.abs(verticalVel) > 0.5) return;
  const camFwd = (() => {
    if(firstPerson) return [Math.sin(fpYaw), Math.cos(fpYaw)];
    return [-Math.sin(camYawState), -Math.cos(camYawState)];
  })();
  const probeX = avatar.position.x + camFwd[0] * 0.6;
  const probeZ = avatar.position.z + camFwd[1] * 0.6;
  const groundY = sampleHeight(probeX, probeZ);
  const ledgeUp = isFinite(groundY) ? groundY - avatar.position.y : -1;
  if(ledgeUp > 0.3 && ledgeUp <= 2.5){
    // Vault — but only if landing spot is not inside an obstacle bbox
    const AVR = (typeof AV_RADIUS !== 'undefined') ? AV_RADIUS : 0.35;
    let blocked = false;
    for(const b of (ENTITIES.boxObstacles || [])){
      if(probeX > b.minX - AVR && probeX < b.maxX + AVR &&
         probeZ > b.minZ - AVR && probeZ < b.maxZ + AVR){ blocked = true; break; }
    }
    if(!blocked){
      climbActive = true;
      climbStart = performance.now();
      climbFromX = avatar.position.x;
      climbFromY = avatar.position.y;
      climbFromZ = avatar.position.z;
      climbToX = probeX;
      climbToY = groundY + 0.05;
      climbToZ = probeZ;
      playerVel.set(0, 0, 0);
      verticalVel = 0;
      return;
    }
  }
  // Plain jump
  verticalVel = 5.0;
}
```

- [ ] **Step 3: Add climb tween into animate()**

In `animate()`, find the movement controller block (~line 9319). Insert at the TOP of the `try` body (just after `const dt = ...`):

```js
  // v657: climb-vault tween takes priority over movement input
  if(climbActive){
    const t = Math.min(1, (performance.now() - climbStart) / (CLIMB_DURATION * 1000));
    const e = t * t * (3 - 2 * t);
    avatar.position.x = climbFromX + (climbToX - climbFromX) * e;
    avatar.position.y = climbFromY + (climbToY - climbFromY) * e + Math.sin(t * Math.PI) * 0.2;
    avatar.position.z = climbFromZ + (climbToZ - climbFromZ) * e;
    if(t >= 1){ climbActive = false; verticalVel = 0; }
  }
```

And add an early-return in the movement section: in the existing block at ~line 9389 (`playerVel.x = THREE.MathUtils.damp(...)`), wrap with:
```js
  if(!climbActive){
    playerVel.x = THREE.MathUtils.damp(playerVel.x, desiredVx, dampRate, dt);
    playerVel.z = THREE.MathUtils.damp(playerVel.z, desiredVz, dampRate, dt);
    // ... existing step + slide collision ...
  }
```

- [ ] **Step 4: Wire Space keydown**

Find the existing keydown listener (search `keys.w = true` or `key === 'w'`). Add a case for Space:

```js
  if(e.code === 'Space' && !e.repeat){
    e.preventDefault();
    tryClimbOrJump();
  }
```

- [ ] **Step 5: Validate**

```
python C:/tmp/check_dup_const.py niwa.html
```

- [ ] **Step 6: Manual smoke**

Open `niwa.html?scene=plaza`, press Space — avatar should jump (Y rises ~1m, falls back).
Place avatar near a building wall, press Space — should vault on top.

- [ ] **Step 7: Commit**

```
git add niwa.html
git commit -m "feat(niwa): Space climb-vault + jump (P3)"
```

---

## Task 5: Interactable system + HUD (P4)

**Files:** Modify `niwa.html` — add `ENTITIES.interactables`, HUD div, per-frame proximity check, E key handler.

- [ ] **Step 1: Init ENTITIES.interactables**

Find `ENTITIES = { obstacles: [], boxObstacles: [], ... }` declaration. Add `interactables: []` to the object.

In `buildScene` (after `ENTITIES.boxObstacles.length = 0;`) add:
```js
  ENTITIES.interactables = [];
```

- [ ] **Step 2: Add HUD div to body**

Find `<body>` in the HTML head section. After existing UI divs, insert:
```html
  <div id="interact-hud"></div>
```

And in the CSS block (`<style>` near top), add:
```css
  #interact-hud {
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    padding: 10px 20px;
    background: rgba(14, 26, 38, 0.88);
    color: #e8dcb8; border: 1px solid #c89848;
    font: 14px/1.2 'JetBrains Mono', monospace; letter-spacing: 0.06em;
    border-radius: 6px; opacity: 0; transition: opacity 0.15s;
    pointer-events: none; z-index: 200;
  }
  #interact-hud.visible { opacity: 1; }
```

- [ ] **Step 3: Add proximity check in animate()**

After the movement block (and after climb tween), insert:
```js
  // v657: interactable proximity + HUD
  let _nearestInteract = null, _nearestDist = Infinity;
  for(const it of (ENTITIES.interactables || [])){
    const d = Math.hypot(it.x - avatar.position.x, it.z - avatar.position.z);
    if(d < it.r && d < _nearestDist){ _nearestInteract = it; _nearestDist = d; }
  }
  const _hud = document.getElementById('interact-hud');
  if(_hud){
    if(_nearestInteract){
      if(_hud.textContent !== _nearestInteract.label) _hud.textContent = _nearestInteract.label;
      _hud.classList.add('visible');
    } else {
      _hud.classList.remove('visible');
    }
  }
  // Stash for keypress access
  window._currentInteract = _nearestInteract;
```

- [ ] **Step 4: Wire E keydown**

In the keydown listener, add:
```js
  if(e.code === 'KeyE' && !e.repeat){
    if(window._currentInteract && window._currentInteract.onActivate){
      window._currentInteract.onActivate();
    }
  }
```

- [ ] **Step 5: Validate + smoke**

Reload page, no interactables registered yet → HUD never shows.

- [ ] **Step 6: Commit**

```
git add niwa.html
git commit -m "feat(niwa): interactable system + HUD + E key (P4)"
```

---

## Task 6: Interior portals (P5)

**Files:** Modify `niwa.html` — refactor `addPortalForScene` to register interactables.

- [ ] **Step 1: Find addPortalForScene**

Search `function addPortalForScene`.

- [ ] **Step 2: Add a section that pushes to ENTITIES.interactables**

Inside `addPortalForScene(name)`, after existing bridge logic, insert:
```js
  // v657: per-section interior entry portal
  const intName = name + '_int';
  if(SCENES[intName] && !name.endsWith('_int')){
    // Add entry portal at building south face
    ENTITIES.interactables.push({
      x: 0, z: 3.5, r: 1.2,
      label: 'E: 中に入る',
      onActivate: () => switchScene(intName),
    });
    // Visible glow ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.7, 24),
      new THREE.MeshBasicMaterial({
        color: 0xc89848, transparent: true, opacity: 0.55,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.set(0, 0.06, 3.5);
    ring.userData.skipRaycast = true;
    if(currentScene && currentScene.root) currentScene.root.add(ring);
  }
  // Interior → outer exit portal
  if(name.endsWith('_int')){
    const outer = name.slice(0, -4);
    if(SCENES[outer]){
      ENTITIES.interactables.push({
        x: 0, z: -3.0, r: 1.2,
        label: 'E: 外に出る',
        onActivate: () => switchScene(outer),
      });
    }
  }
```

- [ ] **Step 3: Test**

Open `niwa.html?scene=monlight`. HUD shows "E: 中に入る" when near (0, 0, 3.5). Press E → swaps to monlight_int. Inside, walk to (0, 0, -3.0), HUD shows "E: 外に出る". E returns to monlight.

- [ ] **Step 4: Commit**

```
git add niwa.html
git commit -m "feat(niwa): interior entry portals (E to enter, E to exit, P5)"
```

---

## Task 7: Soul Smoker Blender extract (P7 — script + asset)

**Files:** Create `_blender/enc_extract_int_soul_smoker.py`.

- [ ] **Step 1: Create extractor**

`_blender/enc_extract_int_soul_smoker.py`:
```python
"""Soul Smoker single-prop extract from KB3D Enchanted Interiors.

Output: assets/blender/enc_int_soul_smoker.glb
Run:   blender -b -P _blender/enc_extract_int_soul_smoker.py
"""
import os, sys
_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _DIR)
import enc_extract_cobbletop_v636 as v636

v636.BLEND = r'P:\CG fanbook\3D assets\KitBash3D - Enchanted Interiors\kb3d_enchanted-interiors-native.blend'
v636.PREFABS = [
    ('soul_smoker', 'KB3D_ENI_SoulSmoker', 'enc_int_soul_smoker', 2.5),
]
# Looser ground tokens — interior props rarely have "Ground" named meshes
v636.GROUND_TOKENS = ('Base', 'Floor', 'Ground')

import bpy
def _patched_main():
    out = os.path.join(v636.OUT_DIR, 'enc_int_soul_smoker.glb')
    if os.path.exists(out):
        print(f'[soul-smoker] removing existing {out}')
        os.remove(out)
    v636.main()
    print('[soul-smoker] done.  Upload to pCloud:')
    print(f'  src: {out}')
    print('  dst: P:\\Public Folder\\hitoritabi\\niwa-assets\\blender\\enc_int_soul_smoker.glb')

if __name__ == '__main__':
    _patched_main()
```

- [ ] **Step 2: Run Blender** (foreground — may take 1-3 minutes)

```
"/c/Users/yuich/Downloads/blender-5.1.1-windows-x64/blender-5.1.1-windows-x64/blender.exe" -b -P _blender/enc_extract_int_soul_smoker.py
```

Expected output: `[OK] enc_int_soul_smoker.glb meshes=N size=N.NMB`.
If prefix `KB3D_ENI_SoulSmoker` matches no objects: try `Soul_Smoker`, `Smoker`, `SoulSmoker_A_`.

- [ ] **Step 3: Ask user to upload to pCloud**

> "Soul Smoker GLB extracted. Please confirm I can copy `assets/blender/enc_int_soul_smoker.glb` to `P:\\Public Folder\\hitoritabi\\niwa-assets\\blender\\enc_int_soul_smoker.glb`."

- [ ] **Step 4: Commit script**

```
git add _blender/enc_extract_int_soul_smoker.py
git commit -m "feat(blender): Soul Smoker extractor for takibi (P7a)"
```

---

## Task 8: Place Soul Smoker in takibi (P7b)

**Files:** Modify `niwa.html` — `SCENES.takibi.build()` body.

Gated on Task 7 user upload confirmation.

- [ ] **Step 1: Find SCENES.takibi**

Search `SCENES.takibi = {`.

- [ ] **Step 2: Add to preloadAssets**

Find `preloadAssets: ['enc_prefab_takibi', ...]`. Append `'enc_int_soul_smoker'`.

- [ ] **Step 3: Add placeENC call**

After existing brazier/lantern placements, add:
```js
    placeENC('enc_int_soul_smoker', 2.5, 0.05, 8.5, 0.9, 30);
```

- [ ] **Step 4: Validate + manual check**

Open `niwa.html?scene=takibi`. Soul Smoker should appear south-east of firepit.

- [ ] **Step 5: Commit**

```
git add niwa.html
git commit -m "feat(niwa): place Soul Smoker in takibi scene (P7b)"
```

---

## Task 9: Per-section interactables (P8)

**Files:** Modify `niwa.html` — append to each `SCENES[name].build()` body.

- [ ] **Step 1: plaza — well interactable**

In `SCENES.plaza.build()`, after existing placeENC calls:
```js
    ENTITIES.interactables.push({
      x: 0, z: 9.5, r: 1.5,
      label: 'E: 願う',
      onActivate: () => {
        const m = document.createElement('div');
        m.style.cssText = 'position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);background:rgba(14,26,38,0.95);color:#e8dcb8;border:1px solid #c89848;padding:24px 32px;border-radius:8px;z-index:300;font:16px/1.6 serif;max-width:380px;text-align:center';
        m.innerHTML = '井戸に小さな願いを落とした。<br><br>耳を澄ますと、遠くで誰かが頷いた気がした。';
        document.body.appendChild(m);
        setTimeout(() => m.remove(), 3500);
      },
    });
```

- [ ] **Step 2: monlight — bookshelf**

In `SCENES.monlight.build()`:
```js
    ENTITIES.interactables.push({
      x: 0, z: 11.0, r: 1.8,
      label: 'E: 本を開く',
      onActivate: () => {
        const m = document.createElement('div');
        m.style.cssText = 'position:fixed;top:40%;left:50%;transform:translate(-50%,-50%);background:rgba(14,26,38,0.95);color:#e8dcb8;border:1px solid #c89848;padding:24px 32px;border-radius:8px;z-index:300;font:16px/1.7 serif;max-width:400px;text-align:left';
        m.innerHTML = '〈月光の書架〉<br><br>夜は長く、光は遠い。<br>けれど確かに、ここにある。<br>― この本に栞は要らない。<br>　 開いたところが今のページ。';
        document.body.appendChild(m);
        m.addEventListener('click', () => m.remove());
        setTimeout(() => m.remove(), 8000);
      },
    });
```

- [ ] **Step 3: oto — bell at the 祠**

In `SCENES.oto.build()`:
```js
    ENTITIES.interactables.push({
      x: 0, z: 10.5, r: 1.5,
      label: 'E: 鳴らす',
      onActivate: () => {
        if(typeof audioCtx === 'undefined' || !audioCtx) return;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.frequency.value = 440;
        o.type = 'sine';
        g.gain.setValueAtTime(0.001, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2.5);
        o.connect(g); g.connect(audioCtx.destination);
        o.start();
        o.stop(audioCtx.currentTime + 2.5);
      },
    });
```

- [ ] **Step 4: takibi — fire warmth**

In `SCENES.takibi.build()`:
```js
    ENTITIES.interactables.push({
      x: 0, z: 0, r: 2.5,
      label: 'E: 暖を取る',
      onActivate: () => {
        const tint = document.createElement('div');
        tint.style.cssText = 'position:fixed;inset:0;background:radial-gradient(ellipse at center, rgba(255,140,60,0.0) 30%, rgba(255,80,30,0.25) 100%);pointer-events:none;z-index:50;animation:fade-out 4s forwards';
        document.body.appendChild(tint);
        setTimeout(() => tint.remove(), 4500);
      },
    });
```

Add the keyframe to CSS:
```css
@keyframes fade-out {
  0% { opacity: 0; } 20% { opacity: 1; } 100% { opacity: 0; }
}
```

- [ ] **Step 5: Validate + smoke**

Open each scene, walk to the labeled object, HUD shows label, E triggers effect.

- [ ] **Step 6: Commit**

```
git add niwa.html
git commit -m "feat(niwa): per-section interactables (well/book/bell/warmth, P8)"
```

---

## Task 10: Mobile action buttons (P9)

**Files:** Modify `niwa.html` — add jump + interact buttons to HTML + CSS + JS.

- [ ] **Step 1: HTML**

Inside the existing mobile-controls block (search `<div id="joy"`), add siblings:
```html
  <button id="btn-jump-mobile" class="mobile-action" aria-label="ジャンプ">⤴</button>
  <button id="btn-interact-mobile" class="mobile-action" aria-label="調べる">E</button>
```

- [ ] **Step 2: CSS**

In the `<style>` block:
```css
  .mobile-action {
    display: none; position: fixed; right: 20px;
    width: 56px; height: 56px; border-radius: 50%;
    background: rgba(14, 26, 38, 0.7);
    color: #e8dcb8; border: 2px solid #c89848;
    font: 22px/1 monospace; touch-action: manipulation;
    z-index: 150;
  }
  #btn-jump-mobile { bottom: 180px; }
  #btn-interact-mobile { bottom: 110px; }
  @media (pointer: coarse) { .mobile-action { display: block; } }
```

- [ ] **Step 3: JS — wire button handlers**

Near other button event listeners:
```js
const _bJump = document.getElementById('btn-jump-mobile');
if(_bJump) _bJump.addEventListener('click', () => tryClimbOrJump());
const _bInteract = document.getElementById('btn-interact-mobile');
if(_bInteract) _bInteract.addEventListener('click', () => {
  if(window._currentInteract && window._currentInteract.onActivate){
    window._currentInteract.onActivate();
  }
});
```

- [ ] **Step 4: Commit**

```
git add niwa.html
git commit -m "feat(niwa): mobile jump + interact buttons (P9)"
```

---

## Task 11: G-block test assertions (P10)

**Files:** Modify `tests/niwa_behavior_test.py`.

- [ ] **Step 1: Add G1 — sky-miss prevention**

Before `b.close()`:
```python
        # ===== G1: ground-fill prevents sky-miss =====
        print('\n[G1] ground-fill prevents sky-miss')
        samples = []
        for tx in (-30, -20, -10, 0, 10, 20, 30):
            for tz in (-30, -20, -10, 0, 10, 20, 30):
                y = page.evaluate(f"() => window.__niwa._sampleHeight({tx}, {tz})")
                samples.append((tx, tz, y))
        nonfin = [s for s in samples if not (isinstance(s[2], (int, float)) and abs(s[2]) < 30)]
        expect('G1 sky-miss prevention', len(nonfin) == 0,
               f'{len(nonfin)}/{len(samples)} non-finite samples in 7×7 grid')
```

- [ ] **Step 2: Add G3 — Space jumps from plaza**

```python
        # ===== G3: Space jumps from flat ground =====
        print('\n[G3] Space jumps from flat ground')
        page.evaluate("() => window.__niwa._tabClickProgrammatic('plaza')")
        page.wait_for_timeout(800)
        page.evaluate("""() => {
          const N = window.__niwa;
          N.avatar.position.set(0, N._sampleHeight(0, 0), 0);
          N.playerVel.set(0, 0, 0); N.setVerticalVel(0);
        }""")
        page.wait_for_timeout(120)
        y_before = page.evaluate("() => window.__niwa.avatar.position.y")
        page.keyboard.press('Space')
        # Sample peak Y in next 600ms
        peak = y_before
        for _ in range(12):
            page.wait_for_timeout(50)
            y = page.evaluate("() => window.__niwa.avatar.position.y")
            if y > peak: peak = y
        lift = peak - y_before
        expect('G3 Space jump lift > 0.5m', lift > 0.5,
               f'before={y_before:.2f} peak={peak:.2f} lift={lift:.2f}')
```

- [ ] **Step 3: Add G5 — Interior swap**

```python
        # ===== G5: monlight ↔ monlight_int swap =====
        print('\n[G5] interior swap')
        page.evaluate("() => window.__niwa.switchScene('monlight')")
        page.wait_for_timeout(2500)
        before_scene = page.evaluate("() => window.__niwa.currentScene.name")
        # Trigger entry portal interactable
        triggered = page.evaluate("""() => {
          const ents = window.__niwa.ENTITIES;
          const it = (ents.interactables || []).find(i => i.label && i.label.includes('入る'));
          if(it && it.onActivate){ it.onActivate(); return true; }
          return false;
        }""")
        page.wait_for_timeout(2500)
        inside_scene = page.evaluate("() => window.__niwa.currentScene.name")
        expect('G5 interior entry', triggered and inside_scene == 'monlight_int',
               f'before={before_scene} after={inside_scene} triggered={triggered}')
```

(G2 and G4 require more setup; mark as soft probes for now — skip if scene state is too uncertain.)

- [ ] **Step 4: Run full suite**

```
PYTHONUTF8=1 python tests/run_niwa_behavior_test.py
```
Expected: 72 pass (69 + G1 + G3 + G5), 0 fail.

- [ ] **Step 5: Commit**

```
git add tests/niwa_behavior_test.py
git commit -m "test(niwa): G1+G3+G5 ground/jump/interior assertions (P10)"
```

---

## Task 12: Code review (P11)

Per requesting-code-review skill — dispatch a fresh general-purpose subagent with:
- Branch: `feature/niwa-rpg-v1`
- Base: `60bff2e`
- Head: post-Task 11 SHA
- Spec ref: `docs/superpowers/specs/2026-06-01-niwa-rpg-v1-design.md`
- Key concerns: climb-vault edge-case safety, multi-AABB collision regression risk, sky-miss strict regression in other outdoor scenes, interactable HUD cleanup on scene change

Address Critical / Important findings inline before merge.

---

## Task 13: Finish branch (P12)

Per finishing-a-development-branch skill:
1. Verify full test suite passes (72 hard)
2. Validator clean
3. Merge `feature/niwa-rpg-v1` to main with `--no-ff`
4. Push to origin
5. Cleanup worktree + delete feature branch

---

## Self-Review Notes

Spec coverage:
- D1 sky-miss strict → Task 2 ✓
- D2 multi-AABB → Task 3 ✓
- D3 ground-fill → Task 1 ✓
- D4 climb-vault → Task 4 ✓
- D5 Soul Smoker → Tasks 7 + 8 ✓
- D6 interior portals → Task 6 ✓
- D7 interior layout → Task 6 step pushes interactable in interior scenes ✓
- D8 interactable system → Task 5 ✓
- D9 per-section interactables → Task 9 ✓
- D10 G1-G5 tests → Task 11 ✓ (G2, G4 deferred to soft / future)
- D11 implementation order → matches Task numbering ✓
- D12 mobile buttons → Task 10 ✓

Placeholders: none. Type consistency: `tryClimbOrJump`, `climbActive`, `_currentInteract`, `ENTITIES.interactables` all consistently named throughout.

Scope: focused single-plan, est. 4-6 hours implementation.
