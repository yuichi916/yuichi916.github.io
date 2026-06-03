# niwa.html — RPG v1 (Action-Adventure) Design

**Date:** 2026-06-01
**Base:** main `60bff2e`
**Scope:** ground-fill plane, building solid-collision, climb-vault on Space, interior scene entry, Soul Smoker placement, interactable system
**Out of scope:** combat, stats, inventory, dialogue trees, save state

## 1. Why

User-reported issues on the v656 build:
1. 地面のない部分を歩けてしまう — sky-miss is permissive
2. 建物などをすりぬけてしまう — boxObstacle is one AABB per prefab, too loose
3. 段差を登れない — MAX_STEP_UP=0.30m kills any ledge-climb
4. 焚火シーンに soul smoker が無い
5. 建物の中に入れない — interior scenes exist but no entry portal
6. RPG として成り立っていない — needs action layer (interact key, HUD)

## 2. Decisions

| ID | 決定事項 | 値 |
|----|---------|-----|
| D1 | Sky-miss behaviour | Strict block (return `true` from `blocked()`) outside grace; §3 ground-fill removes legitimate sky-miss |
| D2 | Building collision | Multi-AABB per prefab — every mesh with `dy>1.5m` AND `(dx,dz)<6m` adds its own world AABB |
| D3 | Ground-fill plane | One thin `Mesh` at world Y=0, 70×70m, covers the entire island disc.  Tagged as `userData.isGroundFill=true` so it never participates in obstacle/visual culling logic |
| D4 | Climb-vault | Space — if grounded + ledge ≤ 2.5m: vault.  If grounded + no ledge: jump (+5 m/s).  Detection: forward 0.5m raycast at Y+0.3, then top-Y scan at Y+0.3..Y+2.5 |
| D5 | Soul Smoker | Blender extract from KB3D Enchanted Interiors → `assets/blender/enc_int_soul_smoker.glb` → upload to pCloud → place at (2.5, 0.05, 8.5) scale 0.9 rot 30° in takibi |
| D6 | Interior entry | Each outdoor `SCENES[name]` registers a portal interactable at `(0, 0, 3.5)` (south face of building); E or walk-into triggers `switchScene(name + '_int')` |
| D7 | Interior layout | Reuse existing `_int` scene defs; each interior's build() places `enc_int_<name>` prefab + an exit portal at scene origin; bounds shrunk to ±6m |
| D8 | Interactable system | `ENTITIES.interactables = [{x, z, r, label, onActivate}]`; HUD prompt when avatar within `r`; E triggers `onActivate` |
| D9 | Per-section interactables | plaza/monlight/oto/takibi: 1 per section; others portal-only.  Activation produces a HUD modal (read) or a brief audio cue |
| D10 | Test coverage | M1+M2+T1+T2+T3+V1+V2 retained.  Add: G1 (ground-fill prevents sky-miss); G2 (avatar can't pass through monlight building bbox); G3 (Space jumps from flat ground); G4 (Space vaults over a 1.5m ledge); G5 (Interior scene swap + return) |
| D11 | Implementation order | Bugs first (D1+D2+D3), then climb (D4), then portals (D6+D7), then content (D5+D9), then HUD+interact (D8) |
| D12 | Mobile UX | Joystick still works for movement; on-screen Space button + E button added bottom-right (44×44px each, semi-transparent) |

## 3. Architecture

### 3.1 Ground-fill plane (D3)

In `SCENES.island.build()`, immediately after creating the procedural cloud / waterfall layers:

```js
const _gf = new THREE.Mesh(
  new THREE.PlaneGeometry(70, 70, 1, 1),
  new THREE.MeshStandardMaterial({
    color: 0x1a2a18, roughness: 1.0, metalness: 0,
    transparent: true, opacity: 0.0,    // invisible
  })
);
_gf.rotation.x = -Math.PI * 0.5;
_gf.position.y = 0;
_gf.userData.isGroundFill = true;
_gf.userData.isWalkSurface = true;       // sampleHeight participates
_gf.receiveShadow = false;
root.add(_gf);
```

Opacity 0 keeps it invisible.  `userData.isWalkSurface = true` ensures the sampleHeight raycast hits it (per existing v633 filter).  Y=0 is the cobble baseline so it's the LOWEST surface — sampleHeight's "lowest tagged ground" picks the actual cobble/porch when above 0, falls through to Y=0 only over true voids.

### 3.2 Sky-miss strict (D1)

`blocked()` in animate scope reverts to:
```js
if(isFinite(nextY)){
  if(nextY - curY > maxUp) return true;
  if(curY - nextY > maxDown) return true;
} else {
  return true;   // sky-miss = no ground = blocked
}
```

With D3 in place, sky-miss is rare; this catches genuine void edges.

### 3.3 Multi-AABB building collision (D2)

In `buildScene` after prefab placement, before the existing single-bbox push:

```js
prefabRoot.traverse(m => {
  if(!m.isMesh) return;
  // Skip ground/cobble/floor meshes — only WALLS get collision
  const nm = (m.name || '').toLowerCase();
  if(/ground|floor|cobble|paving|path|terrain|street|plaza/.test(nm)) return;
  const box = new THREE.Box3().setFromObject(m);
  const dx = box.max.x - box.min.x;
  const dy = box.max.y - box.min.y;
  const dz = box.max.z - box.min.z;
  if(dy > 1.5 && Math.min(dx, dz) < 6 && Math.max(dx, dz) < 12){
    ENTITIES.boxObstacles.push({
      minX: box.min.x, maxX: box.max.x,
      minZ: box.min.z, maxZ: box.max.z,
    });
  }
});
```

Trade-off: more boxObstacles → blocked() iterates more.  Each section adds ~10-30 AABBs.  Total ≤ 300 across the island.  Per-frame cost ~0.05ms.

### 3.4 Climb-vault (D4)

Add to animate-scope, after the existing movement controller:

```js
// Climb state
let climbActive = false;
let climbStart = 0, climbDuration = 0.35;
let climbFromX = 0, climbFromY = 0, climbFromZ = 0;
let climbToX = 0, climbToY = 0, climbToZ = 0;

function tryClimbOrJump(){
  if(climbActive) return;
  if(Math.abs(verticalVel) > 0.5) return;   // must be grounded
  // Forward direction
  let fwdX, fwdZ;
  if(firstPerson){ fwdX = Math.sin(fpYaw); fwdZ = Math.cos(fpYaw); }
  else { fwdX = -Math.sin(camYawState); fwdZ = -Math.cos(camYawState); }
  // Probe ledge: 0.6m ahead, Y+0.3 up
  const probeX = avatar.position.x + fwdX * 0.6;
  const probeZ = avatar.position.z + fwdZ * 0.6;
  const groundY = sampleHeight(probeX, probeZ);
  const ledgeUp = groundY - avatar.position.y;
  if(isFinite(groundY) && ledgeUp > 0.3 && ledgeUp <= 2.5){
    // Vault
    climbActive = true;
    climbStart = performance.now();
    climbFromX = avatar.position.x; climbFromY = avatar.position.y; climbFromZ = avatar.position.z;
    climbToX = probeX; climbToY = groundY + 0.05; climbToZ = probeZ;
    playerVel.set(0, 0, 0); verticalVel = 0;
    return;
  }
  // Jump
  verticalVel = 5.0;
}

// In animate(), before movement:
if(climbActive){
  const t = Math.min(1, (performance.now() - climbStart) / (climbDuration * 1000));
  const e = t * t * (3 - 2 * t);   // smoothstep
  avatar.position.x = climbFromX + (climbToX - climbFromX) * e;
  avatar.position.y = climbFromY + (climbToY - climbFromY) * e + Math.sin(t * Math.PI) * 0.2;   // arc
  avatar.position.z = climbFromZ + (climbToZ - climbFromZ) * e;
  if(t >= 1) climbActive = false;
}

// Space key:
window.addEventListener('keydown', e => {
  if(e.code === 'Space' && !e.repeat){ e.preventDefault(); tryClimbOrJump(); }
});
```

Climb input lock: while `climbActive`, the movement controller skips applying playerVel.

### 3.5 Interior portals (D6 + D7)

Refactor `addPortalForScene(name)` to register an interactable instead of a bridge:

```js
function addPortalForScene(name){
  if(!currentScene || currentScene.name !== name) return;
  // Outdoor → interior: portal at building south face (z = +3.5)
  if(SCENES[name + '_int']){
    ENTITIES.interactables.push({
      x: 0, z: 3.5, r: 1.2,
      label: 'E: 中に入る',
      onActivate: () => switchScene(name + '_int'),
    });
    // Visible glow at portal location
    const portalMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.7, 24),
      new THREE.MeshBasicMaterial({ color: 0xc89848, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
    );
    portalMesh.rotation.x = -Math.PI * 0.5;
    portalMesh.position.set(0, 0.05, 3.5);
    portalMesh.userData.skipRaycast = true;
    currentScene.root.add(portalMesh);
  }
  // Interior → outdoor: exit portal at scene origin
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
}
```

Interior scene `build()` (in existing `_int` defs) places the `enc_int_<name>` prefab via `placeENC` and sets `playableBounds` to ±6m.

### 3.6 Soul Smoker (D5)

`_blender/enc_extract_int_soul_smoker.py` extracts the prop:
```py
BLEND = r'P:\CG fanbook\3D assets\KitBash3D - Enchanted Interiors\kb3d_enchanted-interiors-native.blend'
PREFAB = ('soul_smoker', 'KB3D_ENI_SoulSmoker', 'enc_int_soul_smoker', 2.5)
```

Then in `SCENES.takibi.build()`:
```js
placeENC('enc_int_soul_smoker', 2.5, 0.05, 8.5, 0.9, 30);
```

### 3.7 Interactable system (D8)

```js
ENTITIES.interactables = [];   // reset each buildScene

// HUD element (#interact-hud) added to index DOM once
const hud = document.getElementById('interact-hud');

// Per-frame in animate(), after position updates:
let nearest = null, nearestDist = Infinity;
for(const it of ENTITIES.interactables){
  const d = Math.hypot(it.x - avatar.position.x, it.z - avatar.position.z);
  if(d < it.r && d < nearestDist){ nearest = it; nearestDist = d; }
}
if(nearest){
  hud.textContent = nearest.label;
  hud.classList.add('visible');
} else {
  hud.classList.remove('visible');
}

// Key handler
window.addEventListener('keydown', e => {
  if(e.code === 'KeyE' && !e.repeat){
    if(nearest && nearest.onActivate) nearest.onActivate();
  }
});
```

CSS for `#interact-hud`:
```css
#interact-hud {
  position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
  padding: 8px 16px; background: rgba(14, 26, 38, 0.85);
  color: #e8dcb8; border: 1px solid #c89848;
  font: 14px/1 'JetBrains Mono', monospace; letter-spacing: 0.05em;
  border-radius: 4px; opacity: 0; transition: opacity 0.15s;
  pointer-events: none; z-index: 200;
}
#interact-hud.visible { opacity: 1; }
```

### 3.8 Mobile buttons (D12)

```html
<button id="btn-jump" class="mobile-action">⤴</button>
<button id="btn-interact" class="mobile-action">E</button>
```

Show only when touch detected. Bottom-right, 50px above the joystick.

## 4. Implementation Order (D11)

```
P0  Ground-fill plane (D3) — touches SCENES.island.build()
P1  Sky-miss strict (D1) — touches blocked()
P2  Multi-AABB collision (D2) — touches buildScene
P3  Climb-vault (D4) — adds tryClimbOrJump, animate-scope state
P4  Interactable system + HUD (D8) — adds ENTITIES.interactables, #interact-hud
P5  Interior portals (D6) — refactor addPortalForScene
P6  Interior scene build (D7) — verify _int scenes load + bound
P7  Soul Smoker (D5) — Blender extract + place in takibi
P8  Per-section interactables (D9) — populate ENTITIES.interactables per scene
P9  Mobile buttons (D12) — touch UI
P10 Tests G1-G5 + retest M1+M2+T1+T2+T3+V1+V2 (D10)
P11 requesting-code-review
P12 finishing-a-development-branch
```

P0-P3 are core foundation.  P5-P8 are content.  P9 is polish.  P10 + P11 are verification.

## 5. Test Plan (D10)

**Existing 69-assertion suite retained.**

**New G-block assertions:**

| ID | Name | Assertion |
|----|------|-----------|
| G1 | sky-miss prevention | sampleHeight at any (x, z) in ±35m island returns finite Y |
| G2 | building solid | place avatar adjacent to monlight building south wall; W into wall does NOT advance > 0.2m |
| G3 | Space jump on flat | press Space on plaza cobble; avatar Y rises > 0.5m within 0.5s |
| G4 | Space vault 1.5m | place 1.5m test ledge; press Space; avatar position.x advances ~0.6m AND Y rises to ledge top |
| G5 | Interior swap | trigger portal at monlight south face; currentScene.name becomes 'monlight_int'; exit portal returns to 'monlight' |

Total target: ~75 hard assertions, ≤ 12 soft.

## 6. Failure Modes & Mitigations

| Failure | Mitigation |
|---------|-----------|
| Soul Smoker prefab not in KB3D Interiors blend | Search alternate names (`SoulSmoker`, `Smoker`, `Brazier`); fallback skip placement |
| Multi-AABB explodes obstacle count > 500 | Tag-filter more aggressively; merge overlapping boxes |
| Climb-vault clips through walls | Pre-validate climbToX/Z is not inside an obstacle bbox before activating |
| Interior scene crashes (missing GLB) | `lazyLoadAsset` returns null; build() skips placement gracefully |
| Mobile Space button conflicts with joystick | Place at separate corner (right edge, 100px above zoom buttons) |

## 7. Rollback

Each P-step is an independent commit on `feature/niwa-rpg-v1`.  Revert any single commit on detection of regression.

---

**Status:** Awaiting user approval after writing this doc.  Plan written separately after approval.
