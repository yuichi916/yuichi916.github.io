# ehon.html 絵本ゲートウェイ再構成 — 設計書

日付: 2026-07-05
状態: ユーザー承認済み (設計①②とも)
前提スペック: `2026-06-28-ehon-*` (飛び出す絵本 初版)

## 1. 目的

yuichi916.github.io 全体を、飛び出す絵本 `ehon.html` を実質の入り口として再構成する。
サイト配下の全コンテンツ (12個) をそれぞれ「本の見開きから飛び出す世界」としてリンクし、
動物図鑑・日替わり配置でリピート動機を作り、JP/EN 両対応と宣伝導線で世界中からの訪問・拡散を狙う。

## 2. 確定要件 (ユーザー回答)

| 論点 | 決定 |
|---|---|
| 入り口の形 | **ehonを実質トップに**。index.html は薄いランディング (SEOテキスト+「本を開く」CTA) に縮小。完全置換はしない |
| ページ構成 | **1コンテンツ=1見開き** (12見開き) |
| 既存3世界 (Enchanted/Valhalla/DarkFantasy) | **体験ページとして並存** (クエスト継続、「冒険の章」に配置) |
| 動物 (11種STLモデル) | **隠れ住人+収集図鑑**。クリックで鳴き声+セリフ→図鑑登録。全発見でメタ報酬 |
| リピート仕掛け | **日替わりの動物の居場所** (日付seed)。それ以外 (スタンプ帳/時間帯挿絵/隠しページ) は入れない |
| 言語 | **絵本はJP/EN完全両対応**。日本語専用リンク先に「Japanese content」バッジ |
| 宣伝導線 | **奥付「外の窓」+ 達成シェアカード + OGP/SEO全面整備** (紹介動画は今回スコープ外) |
| 世界ビジュアル制作 | **KitBashレンダ中心。インテリア・パーツ単位まで厳密に吟味し「城でごまかし」禁止。不足分はネット調達や自作も検討** |

## 3. 本の全体構成 (表紙+17見開き)

```
表紙 (現行の閉じた本 + タイトル)
 ├─ 目次見開き「世界の地図」 …… 全ページのサムネ+ジャンプ。図鑑ボタン常設
 ├─ 第一章 整える   : cabin / niwa / tomoshibi / stopwatch
 ├─ 第二章 遊ぶ     : sudoku / shogi-puyo
 ├─ 第三章 学ぶ     : lingo / toeic
 ├─ 第四章 聴く     : salon
 ├─ 第五章 旅する   : hitoritabi / world
 ├─ 第六章 物語     : hollow-tale
 ├─ 冒険の章 (既存3世界そのまま・クエスト継続)
 └─ 奥付「外の窓」  : YouTube / X / note / GitHub + 図鑑コンプ状況
```

- 各コンテンツ見開き = 左ページ**飛び出す世界** (水彩3層せり上がり+視差、現行 world-pop 機構) + 右ページ**短い物語文 (JP/EN) と「この世界に入る」ボタン** (=コンテンツへのリンク)。
- 新規12ページは**方式A (水彩) のみ**。方式B (3D GLB) は既存3世界だけ維持 (制作コストとモバイル負荷のため)。
- toeic-practice.html は toeic 見開きの副リンク。journal.html / universe.html / quest_test_tmp.html はリンク対象外 (それぞれバックアップ / salon重複 / テスト)。

## 4. コンテンツ×素材マッピング (台帳根拠付き)

素材台帳: `docs/asset-inventory/` (全5キットの blend オブジェクトダンプ、2026-07-05採取)。

| 頁 | 飛び出す世界 | 素材根拠 (実在確認済み) |
|---|---|---|
| cabin | 暖炉の小屋の内側 | 既存cabinレンダ資産 + ECI 暖炉・蝋燭21種 |
| niwa | 花咲く浮遊島の庭 | ENC PropShrub/Planter/Tree/Lantern + 既存niwa島資産 |
| tomoshibi | 夜の酒場の窓あかり | **ECI IntTavern** (170点: ストーブ・蝋燭・果物籠) |
| stopwatch | 時計塔のある街角 | **DKF Tower 26種**から選定 + 時計盤は自作合成 |
| sudoku | ルーンが浮かぶ大聖堂 | DKF 大聖堂 (既存equirect資産) + キューブUI合成 |
| shogi-puyo | 北欧の対局広間 | **VAL Shield×6/Weapon/Target/Totem/Well** + 盤駒自作 |
| lingo | 魔法使いの書斎 | **ECI IntWizardOffice** (171点: 机・巻物・魔法陣) |
| toeic | 聖騎士の試練の間 | **ECI IntPaladinsArmory** (412点: 武具=試験は戦い) |
| salon | 歌う星々の銀河 | KitBashに宇宙素材なし → **既存salon銀河ビジュアルを水彩化** (自作枠) |
| hitoritabi | 出航前の港と帆船 | **TIS Ship×34/Chest/Lantern/Palm/Hammock** (未使用キット始動) |
| world | 地図師の机と浮遊島群 | ECI WizardOffice 机 + PropBook22種 + 既存world島マップ |
| hollow-tale | 雪夜の焚き火 | VAL Firewood + ECI PropFire + cabin焚き火資産 |

選定原則: 内装セット・小物単位で意味が通ること (書斎=言葉の学び、武具庫=試験の試練、酒場の灯=tomoshibi)。SD水彩化で全頁のトーンを統一。

## 5. 動物図鑑システム

素材: `P:\CG fanbook\3D assets\01. Fre Model Collection\` の11種 (**STL、テクスチャ無し** — Wolf Pup.zip で確認済み)。
パイプライン: STL→Blenderクレイレンダ→SD img2img水彩化→透過スプライト。

| 動物 | 頁 | 選定理由 |
|---|---|---|
| オオカミの子 | cabin | 森の小屋の同居人 |
| ホッキョクウサギ | niwa | 庭の茂みの住人 |
| イボイノシシ | tomoshibi | 酒場の食いしん坊 |
| ペンギン | stopwatch | 規則正しい行進=時の象徴 |
| ビントロング | sudoku | 夜行性=大聖堂の梁に潜む |
| ユキヒョウ | shogi-puyo | 雪国北欧の対局見物人 |
| ケナガイタチ | lingo | 言葉のようにすばしっこい |
| ライオンの子 | toeic | 試練に挑む勇気 |
| カエル (Mexican Burrowing Toad) | salon | 銀河の歌い手 |
| ウミガメ | hitoritabi | 海の旅人 |
| ディンゴ | world | 地図を歩く探検者 |

- コンテンツ12頁のうち hollow-tale のみ動物ゼロ (物語が主役)。目次・奥付・既存3世界にも動物は置かない。
- **日替わり**: `hash(YYYYMMDD + 動物ID) % spots.length` で各頁3〜5候補スポット (正規化x,y) から当日の隠れ場所を決定。
- クリック→鳴き声+ひとことセリフ (JP/EN) →図鑑登録。鳴き声は**Web Audio合成の絵本調の音 (動物ごとに音程・音色を変える) を基本**とし、フリー実音源が入手できた動物は差し替え (ビントロング等は実音入手困難のため合成が確実)。
- 保存: localStorage `ehon_zukan` = `{found: {animalId: firstFoundDate}}`。
- 図鑑UI: 目次頁+常設ボタンからモーダル。未発見はシルエット、発見済みは水彩画+名前+セリフ+初発見日。
- メタ報酬: 全11匹発見で表紙に金の動物紋章+シェアカード解禁。

## 6. i18n (JP/EN)

- PAGES データ自体が `title/sub/story` を `{jp, en}` で持ち、描画時に選択。既存コンテンツの i18n 機構 (data-i18n) とは独立。
- 初期言語: `localStorage.ehon_lang` > `?lang=` > `navigator.language` (ja以外→en)。
- 「あ/A」トグル常設。`<html lang>` 動的切替。
- EN表示時、日本語専用リンク先 (toeic/lingo/tomoshibi/hollow-tale) に「Japanese content」バッジ。
- meta description は JP 主、EN 副記。

## 7. 宣伝導線

1. **奥付「外の窓」**: 最終見開き。窓枠デザインで YouTube (ずんだもんAIラボ) / X (@ViewsEngineer) / note / GitHub の4窓。
2. **達成シェアカード**: 図鑑コンプ・全クエストクリア時に canvas でカード画像 (表紙+達成+URL) を生成→ Web Share API (モバイル、`navigator.canShare` 判定) / X intent URL (PC)。
3. **OGP/SEO**: og:image 用表紙ビジュアル 1200×630 新規制作、`twitter:card=summary_large_image`、JP/EN メタ、構造化データ (WebSite + CreativeWork)、sitemap 更新。

## 8. index.html の縮小

- Hero 主CTA を「📖 本を開く」(ehon.html) へ差し替え+絵本紹介セクション追加。
- 既存「世界の地図」グリッド・SEOテキスト・訪問者カウント・journal.html リンクは**温存** (検索流入と不変条件を守る)。大解体はしない。

## 9. アーキテクチャ

- `WORLDS` 配列 (3要素) → `PAGES` 配列 (17要素: 目次1+コンテンツ12+冒険3+奥付1。表紙は現行の「閉じた本」状態でありPAGES外) に拡張:
  ```js
  {id, chapter, type: 'toc'|'content'|'adventure'|'colophon',
   title:{jp,en}, sub:{jp,en}, story:{jp,en},
   link, linkJpOnly:bool,
   animal:{id, name:{jp,en}, quote:{jp,en}, spots:[{x,y},...]} | null,
   quest: (既存QUESTS参照) | null}
  ```
- ページめくり (`flipping` アニメ)・EHON シェル・QuestEngine・localStorage・方式A/Bトグル・`getImageUrl`/`getAssetUrl` (ローカル `_ehon_assets/ehon/`) は現行実装を流用。
- 単一ファイル ehon.html 継続 (リポジトリ文化)。commit 前に `python C:/tmp/check_dup_const.py` 必須。

## 10. 制作パイプライン (1頁あたり)

1. Blender headless で対象アセットのシーン構成+レンダ (既存 `_blender/ehon_*.py` 流用、ローカルコピー `C:\tmp\blends\` 使用)
2. reForge SD img2img 水彩化 (既存パイプライン、`--api` 起動)
3. 距離マスクで far/mid/fore 3層切出し (既存 `ehon_layer_cut.py`)
4. 本テーマページ `<pageId>_book.png` (book_render.png を頁別プロンプトで img2img)
5. 動物: STL→クレイレンダ→水彩化→透過スプライト

制約 (メモリ済み教訓):
- ECI テクスチャは `P:\CG fanbook\3D assets\Kitbash3D - Enchanted Interiors\kb3d_enchantedinteriors.png.2k\` (変則名) — `find_missing_files` で再リンク。ローカル: `C:\tmp\blends\eci\eci_textures\`
- Blender 5.1: コンポジタAPI廃止 (SD/PILへ)、Freestyle不可、`open_mainfile`+hide方式
- `.ehon-stage` に `preserve-3d` 禁止 (本canvasが世界を覆う)

## 11. パフォーマンス

- 新規画像は **WebP (q80-85)** で書き出し。追加容量見積 ~50MB (12頁×4枚×~1MB)。リポジトリ同梱継続 (GitHub Pages 1GB内)。
- 頁画像は現行同様、切替時遅延ロード。動物スプライトは頁表示時ロード。
- 目次サムネは小さい別ファイル (~50KB/枚)。

## 12. エラーハンドリング

- 画像ロード失敗: 現行同様 onerror でグラデ背景フォールバック。
- localStorage 不可 (プライベートモード): try/catch で図鑑・クエストは揮発動作 (現行 QuestEngine と同じ方針)。
- Web Share API 非対応: X intent URL へフォールバック。

## 13. テスト・検証

- `python C:/tmp/check_dup_const.py ehon.html` (commit 前必須)。
- Chrome headless `--screenshot` で方式A各頁の実描画確認 (方式Bは実機GPU必須)。
- 日替わりロジックは純関数化し Node で単体テスト (将棋ぷよ方式)。
- i18n は JP/EN 両方でスクショ比較。
- デプロイ後、github.io 本番で全頁+図鑑+シェアの動作確認。

## 14. リリース段階

- **Phase 1**: 骨格 — PAGES 配列化・目次・奥付・i18n 機構・図鑑機構 (世界ビジュアルは既存3世界+仮画像)
- **Phase 2**: 頁制作を1頁ずつ完成度MAXで (先行4頁: hitoritabi / lingo / tomoshibi / salon)
- **Phase 3**: 残り8頁+動物全配置
- **Phase 4**: OGP/シェアカード/index.html CTA切替/デプロイ

各Phase末に検証 (13章) を通してから commit。「まだXが残ってる」状態での未完成リスト放置は禁止 (feedback_niwa_world_design 準拠)。

## 15. 不変条件 (壊すな)

- 既存3世界の体験・クエスト保存データ (`ehon_quest`) の後方互換。
- journal.html (旧トップバックアップ)・universe.html は削除しない。
- index.html の訪問者カウント・GoatCounter・`?nofx=1` 規約・既存i18n機構は非破壊。
- `_ehon_assets/ehon/` 同一オリジン配信方針 (pCloud/Worker 依存に戻さない)。
