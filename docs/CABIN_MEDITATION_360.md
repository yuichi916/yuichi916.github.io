# 森の小屋 — Cabin in the Hollow / 360° 瞑想空間 リデザイン仕様

2026-06-13 / `cabin.html` を「読みもののランディングページ」から「**没入する瞑想空間**」へ再構成する。
Kitbash3D **Enchanted Interiors**（`P:\CG fanbook\3D assets\Kitbash3D - Enchanted Interiors`、全1995オブジェクトを棚卸し済）の最良プロップを Blender Cycles で写実描画し、Three.js の 360° ビューアに没入させる。

---

## 1. コンセプト

> 夜の森のおく、灯りのともる小屋の中。炉床の前に座り、火を見つめる。
> ドラッグ／スマホのジャイロで室内をぐるりと見回せる。炎は揺らぎ、火の粉と埃の光が漂い、ランタンが呼吸する。

- 一人称・着座視点（eye height ≈ 1.15m）。主役は **暖炉の火**。
- 受動的に「眺める」体験＋呼吸ペーサー・タイマー・環境音で「整える」体験。
- "enchanted"（幻想）の質感 — 魔法の発光・蝋燭・室内に佇む樹 — を瞑想の静けさへ昇華。

## 2. 構図ルール（niwa スタイルブック準拠・数値化）

| # | ルール | 数値/指定 |
|---|--------|-----------|
| 1 | 主役は1つ | 暖炉の火。初期視線 yaw=0 が炉床正面 |
| 2 | 三層の奥行き | 手前=ラグ＋座布団(下1/3) / 中景=炉床・揺り椅子・卓 / 遠景=戸口の先の森・棚 |
| 3 | パレット 3+1 | 夜青 `#0a0e16` ＋ 残り火 `#d97a32` ＋ ランタン金 `#f0c878`／中間=木bark `#2a1a10`・石ash |
| 4 | ネガティブスペース | 暗く静かな壁/天井を 30–40%。詰め込まない |
| 5 | 光源 1+3 | 主光=暖炉(低・揺らぎ・2200K) ＋ 副3=ランタン・蝋燭群・戸口の月光(6500K cool) |
| 6 | 接地 70/30 | 床=温かい板/ラグ70 ・ 石の炉前30 |
| 7 | シルエットテスト | 炉＋煙突の塊が黒影でも主役と分かる |
| 8 | 視線誘導 | ラグの縁→火→マントルの蝋燭→揺り椅子 のS字 |

## 3. 採用アセット（全1995から選定した「最高品質」瞑想キット）

ベース室内 = **IntWizardOffice**（魔法使いの書斎：暖炉・揺り椅子・本棚・室内樹・蝋燭・発光ポーション、親密スケール 17×19×11）を土台に検討。
※テスト描画で囲い(360適性)を確認し、不足なら下記クリーン版 `Prop*`（全て原点配置・高品質）で自作殻に再構成する。

| 役割 | 採用オブジェクト | poly | 寸法(m) |
|------|------------------|------|---------|
| 暖炉(主役) | `KB3D_ECI_PropFireplace_A_Main` | 37,029 | 3.85×2.51×5.24 |
| 炎 | `KB3D_ECI_PropFire_B_Main` / `_C_Main` | 576 | 〜0.68×0.67×1.19 |
| 座布団(zafu) | `KB3D_ECI_PropPillow_A_Main` | 223,444 | 0.47×0.66×0.10 |
| ラグ | `KB3D_ECI_PropFloorFabric_A_Main` / `PropCarpet_A` | 20,480 | 4.83×4.34 |
| 揺り椅子 | `KB3D_ECI_PropRockingChair_A_Main` | 36,263 | 0.72×1.27×1.35 |
| ランタン | `KB3D_ECI_PropLantern_A_Main`(+Transl) | 4,229 | 0.18×0.18×0.32 |
| 蝋燭 | `PropCandleLit_A–D` / `PropCandleStackLit_A–C` | 0.5–2k | — |
| 香炉(incense) | `KB3D_ECI_PropSoulSmokers_A_Brazier`(+Fire) | 11,132 | 0.69×0.69×1.15 |
| 幻想の光柱 | `KB3D_ECI_PropMagicalLight_A–D_Main` | 13,508 | 0.59×0.59×(1.7–5.3) |
| 本(静物) | `PropBookStack_A–P` / `IntWizardOffice ShelfUnit` | — | — |
| 室内樹(任意) | `KB3D_ECI_IntWizardOffice_A_Tree` | 66,369 | 9.6×6.2×9.1 |
| 戸口/窓 | `PropDoor_C` / Archway。森を見せる開口に | — | — |

外の森 = 既存 `cabin-hero.png` 系の世界観に合わせ、開口の先に **夜森の発光プレーン or HDRI**（雨/月）を置く。

## 4. 描画パイプライン

スクリプト `_blender/eci_meditation_360.py`（`blender -b --factory-startup --python`、ローカル `C:\tmp\blends\eci\...blend` 使用）。

1. ベース室を isolate（他build を hide_render）。不足なら自作殻＋Prop配置。
2. 着座カメラ（z=floor+1.15）。**360°**: `camera.type='PANO'`, `panorama_type='EQUIRECTANGULAR'`。
3. ライティング = 構図ルール#5。暖炉に warm area/point（temp 2200K, flickerはWeb側）、戸口に cool area(月光)、蝋燭/ランタンに小point、`PropMagicalLight` は emissive。
4. **Cycles**, 2048–4096 samples + OptiX/OpenImageDenoise。
   - 出力A: `assets/cabin360.jpg` 6144×3072（equirect, sRGB, 品質88）
   - 出力B: `assets/cabin-still.jpg` 2560×1440（同シーンの通常 35mm 静止画＝WebGL不可時フォールバック & OGP）
5. 色: Filmic/AgX, 露出は夜の沈み込み。火周りのみ持ち上げ。

## 5. ページ再構成（没入のための構造）

現 `cabin.html` の scrolly LP → 4 段の没入体験へ。既存の i18n・環境音・タイマー資産は再利用。

1. **しきい（Threshold）** — 起動時ほぼ黒、一行の詩、`ここをひらく / Enter`。火の微光が脈動。タップで入室＝音声 unlock（autoplay 規制対策）。
2. **部屋（Immersion）** — 全画面 360 室内。ドラッグ/ジャイロ見回し＋無操作で微速オートドリフト。
   - **リアルタイム炎層**（炉床方向に固定追従）: 炎明滅光 / 立ち上る火の粉(additive) / 埃の光 / ランタン呼吸 / 露出のゆっくりした息。
   - **静かなUI**（warm-glass, 自動退避）: 中央=**呼吸ペーサー**(吸4-止4-吐4の輪、炉の glow が同期) / **タイマー**(5/10/20＋任意, りんの音) / **環境音ミキサ**(火・雨・森・風) / 見回しヒント・全画面・言語・音。
3. **静けさ（読みもの）** — 下スクロール/「言葉」で、暗くした続きの上に内省的散文（既存 story/method/practice を最小限に再編）。
4. **結び** — クレジット（Kitbash3D Enchanted Interiors）、戻る、サイト内リンク。

## 6. フォールバック / アクセシビリティ

- WebGL 不可 → `cabin-still.jpg` を背景に、炎は CSS グロー（既存資産）。**劣化なしで成立**。
- `prefers-reduced-motion` → オートドリフト/火の粉/露出呼吸を停止。見回しは手動のみ。
- 音は必ず明示トグル＆既定 off（unlock 後も初期ミュート選択可）。
- スマホ: ジャイロは権限プロンプト後のみ。下360pxは指UI領域として重要操作を置かない。

## 7. 成果物

```
assets/cabin360.jpg        6144x3072 equirectangular（写実・GI焼込）
assets/cabin-still.jpg     2560x1440 フォールバック&OGP
cabin.html                 4段没入に再構成（Three.js + 既存UI統合）
_blender/eci_meditation_360.py   シーン構築&描画スクリプト
docs/CABIN_MEDITATION_360.md     本仕様
```

## 8. 品質ゲート（完成度MAX判定）

- [ ] 360 が継ぎ目・天底の破綻なく一周する
- [ ] 火が「生きている」（明滅・火の粉・暖色グローの呼吸）
- [ ] 構図ルール8項目を満たす（主役/三層/パレット/余白/光1+3/接地/シルエット/S字）
- [ ] スマホ実寸で操作が直感的、下360pxにUI被りなし
- [ ] WebGL不可・reduced-motion で破綻しない
- [ ] Playwright で実描画スクショ確認（火層の動き含む）
