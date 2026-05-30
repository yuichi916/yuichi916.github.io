# niwa.html 操作系・テレポート・橋・視覚効果・テスト網羅性 リファクタ設計

**Date:** 2026-05-31
**Scope:** `niwa.html` の操作系・1P/3P カメラ・タブテレポート・島の橋の Y アラインメント・Bloom/PMREM/FXAA ポストプロセス・Playwright 拡張テスト
**Out of scope:** 室内シーンのデザイン、新規 prefab 追加、モバイル UI 全面改修

## 1. Why

過去数日の反応的パッチ累積（v640〜v654b）で、ユーザーから繰り返し以下が報告されている:

1. WASD がカメラの正面方向と一致しない
2. `?scene=island#oto` などタブテレポート後にアバターが動けない
3. 1P カメラがアバター本体と微妙にずれている
4. 島の橋がアバターより 5m 下に浮いて見える
5. テストが distance しか測らないため direction バグを検出できない

根本原因は、Euler 角ベースの向き計算が複数箇所に散在し符号バグが再発しやすいこと、テストが behavioural ではなく距離のみであること、Bloom/PMREM 等の Three.js 標準パターンが未適用であること、そして plaza prefab だけ cobble Y が未正規化であること。

threejs-skills（CloudAI-X/threejs-skills、10 ファイル全読了）が推奨する Quaternion.slerp + velocity.normalize + EffectComposer パターンに移行することで、構造的に同種のバグを再発させない。

## 2. Decisions

| ID | 決定事項 | 値 |
|----|---------|-----|
| D1 | 3P WASD 方向 | カメラ正面方向（モダン 3P, Genshin/BotW スタイル） |
| D2 | URL hash 初期テレポート | 有効: `?scene=island#oto` でロードすると oto セクションへ初期テレポート |
| D3 | テレポート後の facing | 維持（前 facing を保つ。建物方向には向き直さない） |
| D4 | テレポート位置 | obstacle-aware probe で動ける位置を選ぶ |
| D5 | 橋アラインメント | plaza prefab を v636 正規化スクリプトで再抽出（O3） |
| D6 | Bloom 方式 | 閾値ベース UnrealBloomPass 1 個（threshold 0.85, strength 0.55, radius 0.30, halfRes） |
| D7 | HDR environment | Sky shader を CubeRenderTarget → PMREM 変換（C2） |
| D8 | テスト網羅 | M1 + M2 + T1 + T2 + T3 + V1 + V2 + S1 (M3 と P1 は除外) |
| D9 | モバイル方針 | postprocessing は `IS_MOBILE === true` で完全 OFF |
| D10 | 実装順序 | TDD: テスト先行 → 最小実装 → 次テスト。Blender 抽出は P1-P10 と並列 |

## 3. Architecture

### 3.1 Movement Controller (D1, item A + D)

**入力ベクトル:**

```js
let mx = 0, mz = 0;
if (joyState.active && (|joyState.dx| > 0.06 || |joyState.dz| > 0.06)) {
  mx = joyState.dx; mz = joyState.dz;
} else {
  if (keys.w) mz -= 1;
  if (keys.s) mz += 1;
  if (keys.a) mx -= 1;
  if (keys.d) mx += 1;
}
```

**正規化（threejs-skills/animation の velocity pattern）:**

```js
const inputLen = Math.hypot(mx, mz);
if (inputLen > 0) {
  mx /= inputLen;   // 斜め入力 (W+D) でも単位速度
  mz /= inputLen;
}
const mag = Math.min(1, inputLen);   // joystick analog magnitude
```

**カメラ正面 / 右ベクトル:**

```js
let camFwdX, camFwdZ;
if (firstPerson) {
  camFwdX = Math.sin(fpYaw);
  camFwdZ = Math.cos(fpYaw);
} else {
  camFwdX = -Math.sin(camYawState);
  camFwdZ = -Math.cos(camYawState);
}
const camRgtX =  camFwdZ;   // 90° CW of camFwd
const camRgtZ = -camFwdX;
```

**速度合成:**

```js
const fwdAmt = -mz;   // W: +1
const rgtAmt =  mx;   // D: +1
const desiredVx = (camFwdX * fwdAmt + camRgtX * rgtAmt) * speed * mag;
const desiredVz = (camFwdZ * fwdAmt + camRgtZ * rgtAmt) * speed * mag;
playerVel.x = damp(playerVel.x, desiredVx, ACCEL, dt);
playerVel.z = damp(playerVel.z, desiredVz, ACCEL, dt);
```

**アバター向き（Quaternion.slerp、threejs-skills/animation のパターン）:**

```js
const _avTargetQ = new THREE.Quaternion();
const _avTargetE = new THREE.Euler();

const hasForwardIntent =
  keys.w || (joyState.active && joyState.dz < -0.06) || (moveTarget !== null);

if (firstPerson) {
  // 1P は look 方向と直接同期、slerp 無し
  _avTargetE.set(0, fpYaw, 0);
  avatar.quaternion.setFromEuler(_avTargetE);
} else if (Math.hypot(playerVel.x, playerVel.z) > 0.4 && hasForwardIntent) {
  // 3P は forward intent 時のみ damp
  const targetYaw = Math.atan2(playerVel.x, playerVel.z);
  _avTargetE.set(0, targetYaw, 0);
  _avTargetQ.setFromEuler(_avTargetE);
  avatar.quaternion.slerp(_avTargetQ, Math.min(1, dt * 8));
}
```

**1P 入りで snap せず（v654 既存ロジック互換）:**

```js
if (firstPerson 切替時):
  fpYaw = quaternionToYaw(avatar.quaternion);
```

### 3.2 Teleport (D2 + D3 + D4, item E と連動)

**初期ロード:**

```js
const requested = urlParams.get('scene');
const hashSection = location.hash.replace('#', '').trim();
const initialScene = (requested && SCENES[requested]) ? requested : 'island';
let pendingHashSection = null;
if (initialScene === 'island' && hashSection && SCENE_WORLD_POS[hashSection]) {
  pendingHashSection = hashSection;
}
```

`SCENES.island.build()` の末尾で:

```js
if (pendingHashSection) {
  setTimeout(() => teleportToIslandSection(pendingHashSection), 100);
  pendingHashSection = null;
}
```

**`teleportToIslandSection(id)` 共通関数:**

```js
function teleportToIslandSection(id) {
  const pos = SCENE_WORLD_POS[id]; if (!pos) return;
  const cx = pos.dx * ISLAND_SEPARATION;
  const cz = pos.dz * ISLAND_SEPARATION;
  // 障害物回避: 建物南側から 5 候補を試す
  const offsets = [[0, 4], [0, 5.5], [2, 4], [-2, 4], [0, 6.5]];
  let chosen = null;
  for (const [dx, dz] of offsets) {
    const tx = cx + dx, tz = cz + dz;
    if (_isClearSpawn(tx, tz)) { chosen = { x: tx, z: tz }; break; }
  }
  if (!chosen) chosen = { x: cx, z: cz + 4 };   // フォールバック
  // Y スナップ
  avatar.position.set(chosen.x, 0, chosen.z);
  const gy = sampleHeight(chosen.x, chosen.z);
  if (isFinite(gy) && gy < 30) avatar.position.y = gy;
  // facing は維持（D3）→ avatar.quaternion 触らない
  playerVel.set(0, 0, 0); verticalVel = 0;
  if (currentScene) currentScene.spawnPos = { x: chosen.x, y: avatar.position.y, z: chosen.z };
  bridgeCooldownUntil = performance.now() + 1500;
  history.replaceState(null, '', `?scene=island#${id}`);
}

function _isClearSpawn(x, z) {
  // 既存 ENTITIES.boxObstacles + obstacles の中じゃない、かつ 4 方向で
  // 0.5m 進める（既存 findSafeSpawn の canStep 流用）
}
```

**`_tabClick(id)` をこの関数に置き換える。** タブクリック・初期ハッシュ・将来の deep-link 全部同じ関数に集約。

### 3.3 Bridges (D5, item A の一部 + S1 テスト)

**Blender スクリプト** `_blender/enc_extract_plaza_v636.py`:

- 既存 `enc_extract_cobbletop_v636.py` のラッパー。`PREFABS` 配列を plaza 1 行のみ:
  ```py
  PREFABS = [
    ('plaza', 'KB3D_ENC_BldgSmLowerTownSquare_A_', 'enc_prefab_plaza', 8.0),
  ]
  ```
- 出力: `assets/blender/enc_prefab_plaza.glb`（既存と同じファイル名で上書き）
- Blender background mode で抽出（推定 5-15 分）

**ユーザー作業（pCloud 反映）:**

1. 抽出完了後、`P:\Public Folder\hitoritabi\niwa-assets\blender\enc_prefab_plaza.glb` を新しいファイルで上書き
2. pCloud Drive 同期完了を待つ
3. ブラウザキャッシュ反映には数分

**niwa.html 側変更:**

- `SCENES.island.build()` の `placeENC('enc_prefab_plaza', 0, -5.46, 0, 1.0, 0)` を `0` に戻す
- それ以外の変更なし

**フェイルセーフ:**

- pCloud アップロード完了前は v654b の `-5.46` シフトをそのまま維持（運用継続）
- S1 テストで `sampleHeight(0, 0)` がまだ 5.46 を返すうちは S1 だけ skip しつつ他を動かす

### 3.4 Postprocessing (D6 + D7 + D9, item B + C)

**動的初期化（dynamic import）:**

```js
let composer = null, bloomPass = null, pmrem = null, pmremTexture = null;

async function initPostprocessing() {
  if (IS_MOBILE) return;
  try {
    const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
    const { RenderPass }     = await import('three/addons/postprocessing/RenderPass.js');
    const { UnrealBloomPass }= await import('three/addons/postprocessing/UnrealBloomPass.js');
    const { ShaderPass }     = await import('three/addons/postprocessing/ShaderPass.js');
    const { FXAAShader }     = await import('three/addons/shaders/FXAAShader.js');
    composer = new EffectComposer(renderer);
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5),
      0.55, 0.30, 0.85
    );
    composer.addPass(bloomPass);
    const fxaa = new ShaderPass(FXAAShader);
    fxaa.material.uniforms.resolution.value.set(
      1 / window.innerWidth, 1 / window.innerHeight);
    composer.addPass(fxaa);
  } catch (e) {
    console.warn('postprocessing init failed', e);
    composer = null;
  }
}
```

**render ループ:**

```js
function render() {
  if (composer && !firstPerson) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}
```

1P は perspective camera を使うため composer に渡すとパスを切替する必要がある。簡略のため 1P 中は postprocessing を旁通。

**PMREM:**

```js
let _pmremGen = null;
const _skyCubeTarget = new THREE.WebGLCubeRenderTarget(128, {
  type: THREE.HalfFloatType, generateMipmaps: true,
});

function regeneratePMREM() {
  if (!_pmremGen) _pmremGen = new THREE.PMREMGenerator(renderer);
  // Sky shader をキューブにレンダリング
  const cubeCamera = new THREE.CubeCamera(0.1, 10000, _skyCubeTarget);
  scene.background = sky;    // 一時的に sky を背景に
  cubeCamera.update(renderer, scene);
  // PMREM 生成
  const pmrem = _pmremGen.fromCubeRenderTarget(_skyCubeTarget);
  scene.environment = pmrem.texture;
}
```

**呼出タイミング:** `setSun()` 呼出時のみ。シーン切替・night/day トグル時に setSun が走るのでそこに hook する。

**屋内シーンでは:** `def.kind === 'interior'` のとき `scene.environment = null`（既存）

**colorSpace 一貫性（threejs-skills/textures）:** 色テクスチャの `colorSpace = THREE.SRGBColorSpace` を確認、データ系（normal, roughness）は LinearSRGBColorSpace 既定。

### 3.5 Test (item E)

**ファイル:** `tests/niwa_behavior_test.py`

**`__niwa` テストフック拡張（diag=1 時のみ）:**

```js
window.__niwa = {
  ...既存,
  _setCamYaw(yaw) { camYawTarget = yaw; camYawState = yaw; },
  _setFpYaw(yaw)  { fpYaw = yaw; },
  _setFirstPerson(b) { firstPerson = b; ... },
  _isIslandStreamed() { return _islandStreamedCount === 9; },
  _sampleHeight(x, z) { return sampleHeight(x, z); },
  _waitFrames(n) { return new Promise(r => { let i=0; const t=()=>{if(++i>=n)r(); else requestAnimationFrame(t);}; requestAnimationFrame(t); }); },
  _tabClickProgrammatic(id) { _tabClick(id); },
};
```

**テスト構成:**

| ID | 名前 | アサーション数 | 合格基準 |
|----|------|---------------|---------|
| M1 | 3P WASD direction (camYaw 4 値 × 4 キー) | 16 | `dot(actualDir, expectedDir) > 0.7` AND `moved > 0.3m` |
| M2 | 1P WASD direction (fpYaw 4 値 × 4 キー) | 16 | 同上、expected = (sin(fpYaw), cos(fpYaw)) for W |
| T1 | `?scene=island#oto` 初期ロード | 1 | avatar position |dx| < 3, |dz - (-16)| < 3 |
| T2 | 9 セクションタブテレポート + W テスト | 18 | 各セクションで位置 ±3m AND W で 0.5m 動ける |
| T3 | テレポート前後 facing 保存 | 1 | `|before.y - after.y| < 0.01` rad |
| V1 | 1P/3P toggle で state 保存 | 2 | position ±0.01m, rotation ±0.01 rad |
| V2 | 1P で W が fpYaw 方向 | 4 | dot > 0.7 |
| S1 | 橋 Y と cobble Y の一致 | 推定 12 ペア | `|walkway_y - cobble_y| < 0.5m` |

**ランタイム budget:** ~8 分（headless rAF throttle 込み）、 timeout 15 分

**ログフォーマット:**

```
[M1] camYaw=0   W → dir=(0.00, -0.99) dot=0.99 moved=0.42m   ✓
[M1] camYaw=0   A → dir=(-0.98, 0.02) dot=0.98 moved=0.40m   ✓
...
[T2] tab #oto    → pos=(-0.1, 0, -15.9) walk_after=0.78m     ✓
...
=== SUMMARY: 70 pass, 0 fail ===
```

## 4. Implementation Order

```
P0  (並列) Blender plaza 抽出スクリプト作成 + 起動
P1  __niwa hook 拡張 + Playwright ハーネス骨格
P2  M1+M2 テスト → RED 確認
P3  Movement リファクタ (velocity.normalize + camera-fwd + Quaternion.slerp) → GREEN M1+M2
P4  T1+T3 テスト → RED
P5  URL hash 初期テレポート + facing 維持実装 → GREEN T1+T3
P6  T2 テスト → RED
P7  obstacle-aware probe + island playableBounds 維持 → GREEN T2
P8  V1+V2 テスト → RED
P9  1P/3P toggle state 保存 + 1P W direction 修正 → GREEN V1+V2
P10 S1 テスト → RED
P11 (P0 完了 + ユーザー pCloud アップロード後) -5.46 シフトを 0 に戻す → GREEN S1
P12 Visual: Bloom + PMREM + FXAA (dynamic import, mobile OFF)
P13 各 P3-P12 終了時に requesting-code-review 実行
P14 finishing-a-development-branch で worktree クリーンアップ + main マージ
```

**並列性:** P0 (Blender) は P1-P10 と独立に進行可能。pCloud アップロードがユーザー作業のためブロッカーになり得るので、P10 まで終わった時点で残りは P12 + (pCloud 待ち) P11 の 2 経路に分岐できる。

## 5. Test Plan

実装中の各 GREEN フェーズで該当テストが PASS していることを `make test-niwa`（または `python tests/niwa_behavior_test.py`）で確認。最終チェック:

- `python tests/niwa_behavior_test.py` 終了 code 0
- desktop ブラウザで `?scene=island` ロード → タブクリックで全 9 セクション周回、各セクションで W/A/S/D 全方向動作
- desktop ブラウザで 1P 切替・ドラッグして向き変更後 W で動作確認
- mobile ブラウザで Bloom OFF（白浮きしない）+ 初期ロード時間が現状から悪化していないこと

## 6. Failure Modes & Mitigations

| Failure | Mitigation |
|---------|-----------|
| Blender 抽出クラッシュ | `-5.46` シフトを残す。`sampleHeight(0, 0) > 0.5` ならば S1 テストを skip マーク（fail せず警告のみ）して他テストは続行 |
| pCloud アップロード遅延 | P12 を先に進める。P11 は完了通知後に独立コミット |
| PMREM 生成で fps 低下 | desktop でも `setSun()` 頻度を 0.5s 以上に間引き、cube target サイズ 128 上限 |
| dynamic import 失敗 | composer null → `renderer.render` フォールバック |
| Quaternion slerp で gimbal 副作用 | 1P は slerp 無し直接 setFromEuler、3P のみ slerp で副作用域を狭める |

## 7. Rollback Plan

各 P3-P12 が独立コミットなので、回帰検出時は git revert <commit> で単一フィーチャを巻き戻し可能。worktree 上で進めるので main に直接影響無し。

---

**Status:** Approved by user (sections 1-6) on 2026-05-31. Next: writing-plans skill で実装プラン化。
