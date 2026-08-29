# ひとり歓迎マップ 全面再設計 — 設計書

日付: 2026-08-29 ／ 対象: `hitori.html`（https://yuichi916.github.io/hitori.html）
分類: Architectural（単一ページの作り直し）。データ拡充（B）は別スペックにする。

## 0. 決まったこと（ブレストの結論）

| 論点 | 決定 |
|---|---|
| 主戦場 | **今いる場所から今すぐ**（スマホ・現在地・地図ファースト）。PCは同じUIの2カラム版 |
| 確認済み 817件 と 未確認 39,800件 | **確認済みが主役、未確認は「候補」**。候補には推定スコアの点線を出さない（根拠のない数字を見せない）。近くに確認済みが無ければ「このエリアはまだ調査前」と正直に言い、最寄りの確認済みへ誘導 |
| 利用者の記録 | **「行きたい」「行った」を端末内（localStorage）に保存**。バックエンドは作らない |
| アプローチ | **案1 地図アプリ型**。1画面＝地図＋ボトムシート。読み物は /method/hitori-kijun.html に任せる |
| 拡充パイプライン | 50件パイロット済み: 公式ページ到達 62%、事実2件以上 54%、約5.6k tok/施設(Haiku)。**別スペック**で本番化 |

## 1. 目的と成功の定義

目的: 「ひとりで入れるか」を根拠つきで答える、ひとり旅・ひとりぐらしの道具として、初見3秒で何ができるか分かり、1画面で 探す→確かめる→保存する が完結する。

成功の観測（GoatCounter イベントで測る）:
- `hitori.locate`（現在地で探した）／`hitori.detail`（詳細を開いた）／`hitori.save`（行きたい・行った）／`hitori.route`（経路を開いた）
- 初回訪問からの `detail` 到達率、`save` 率。数字の目標は置かず、公開後7日を起点に次の30日で比較する（旧版にはイベントが無い）。

## 2. 画面構成

### 2.1 モバイル（〜899px）
```
┌──────────────────────────────┐
│ ひ ひとり歓迎マップ   [♡3] [≡] │ ← 固定ヘッダー 52px
│                              │
│         地図（全面）           │  確認済み=濃いピン(赤茶)／候補=薄い点(canvas)
│                              │  選択中=金枠。現在地=青丸
│                              │
│┌────────────────────────────┐│
││ ═══ (ドラッグハンドル)       ││ ← ボトムシート。スナップ3段: peek(≈28%) / half(≈55%) / full
││ [⌕ 施設名・エリア          ] ││
││ (◎現在地) (東京都▾) (いま営業中)││
││ 飲食 温浴 体験 静かに過ごす 宿 ││
││ ─────────────────────────── ││
││ 確認済み 12件 · 候補 240件    ││
││ ┌ カード ┐ ┌ カード ┐ …     ││
│└────────────────────────────┘│
└──────────────────────────────┘
```
シートの状態（`sheet.mode`）: `home` / `list` / `detail` / `saved` / `about`。
- `home`（初回・リセット時）: 主張「ひとりで入れるか、根拠つきで。」＋「確認済み 817件／全国 40,615件」＋大ボタン2つ **「現在地から探す」「エリアを選んで探す」**＋場面ボタン4つ。
- `list`: 検索バー・フィルタ・カード列。地図を動かしたら「この範囲で再検索」ボタンを出す（自動追従はしない）。
- `detail`: 1施設。戻る「‹ 一覧へ」。地図はその施設へパン。
- `saved`: 行きたい／行った の2タブ。地図に保存ピンを重ねる。共有URL生成。
- `about`: データの出どころ・3つの決めごと・都道府県別進捗・掲載リクエスト（X intent）・OSM帰属・旧版リンク・「ひとりぶんの棚」へ。

### 2.2 デスクトップ（900px〜）
左パネル 420px（シートの中身をそのまま縦パネルに）＋右に地図。`detail` はパネル内で一覧を置き換える（戻るボタン）。ヘッダーは共通。

### 2.3 既存の共通部品の扱い
- 「← ひとりぶんの棚」固定ボタン（homeback）と「次はこちら」帯（nextstrip）は、全画面アプリでは地図操作と衝突するので**ヘッダーのメニュー(≡)と about シートに移す**。nextstrip の3リンク（作り方／一人旅ジャーナル／森の小屋）は about シート末尾に残す。
- SEO: `<title>`・description・canonical は維持。about シートの本文は DOM に常駐（display で隠す）ので検索エンジンには読める。`WebApplication` の JSON-LD を追加。

## 3. カテゴリと語彙の修正

現行データは `cat=stay` に museum/library が混ざり、「宿泊」チップに博物館が出る。表示カテゴリは **kind から再計算**する（データは触らない）:

| 表示カテゴリ | kind |
|---|---|
| 飲食 `eat` | ramen, soba_udon, gyudon, curry, standing |
| 温浴 `bath` | sento, sauna, onsen, footbath, private_sauna, spa, capsule_hotel_sauna, private_sauna_hotel |
| 体験 `play` | karaoke, netcafe, cinema |
| 静かに過ごす `quiet` | library, museum |
| 宿 `stay` | hostel |
| 未分類は kind をそのまま表示 | |

kind の日本語名も持つ（ramen=ラーメン, soba_udon=そば・うどん, gyudon=牛丼・定食, curry=カレー, standing=立ち食い, sento=銭湯, sauna=サウナ, onsen=温泉, footbath=足湯, private_sauna=個室サウナ, karaoke=カラオケ, netcafe=ネットカフェ, cinema=映画館, library=図書館, museum=博物館・美術館, hostel=ホステル）。現行の「体験・netcafe」のような英語混在はやめる。

## 4. フィルタとソート

状態 `filters = { q, pref, cat, verifiedOnly, openNow, hideChain, gemOnly, radiusKm }`。

- 現在地モード: `coords` があるとき距離順。半径は 1 / 3 / 10 / 制限なし（既定 3km、該当0件なら自動で広げて「10kmに広げました」と表示）。
- 並び: **確認済みを常に上位固定** → 距離（現在地モード）／穴場候補→ひとり度→名前（エリアモード）。
- 「いま営業中」: `oh`（OSM opening_hours）と確認済み `hours`（確認済みを優先）から判定。トグルOFFの既定表示では判定できない施設も「営業時間は要確認」のまま残す（除外すると候補が消えすぎる）。トグルONは「開いている店だけ」の明示なので open 判定のみ残す。
- 場面ボタン（home）:
  - 「今夜、ひとりで銭湯」= cat:bath + openNow
  - 「さっと一人飯」= cat:eat + openNow
  - 「雨の日に没頭」= cat:quiet ∪ cinema/netcafe
  - 「今夜の宿」= cat:stay
- 検索 `q`: 名前・市区町村・kind日本語名に部分一致。
- **駅名・地名検索**: 既存の `data/hitori/places.json`（駅 9,144＋市区町村 1,919、477KB）を検索欄フォーカス時に遅延読込し、`core.searchPlaces` で候補を出す。選ぶとその地点を起点にした「近い順」モードになる（現在地モードと同じ経路）。

## 5. カード（一覧）

確認済み:
```
┌──────────────────────────────────────┐
│ ✓確認済み 2026-08-08 · 公式3     [♡] │
│ 麺場 浜虎                 320m · 営業中│
│ ラーメン · 横浜市神奈川区                │
│ [カウンター席] [39席] [交通系OK] [年中無休]│ ← 根拠つき事実チップ（最大4）
└──────────────────────────────────────┘
```
候補（未確認）:
```
┌──────────────────────────────────────┐
│ 候補 · OSM由来                    [♡] │
│ 山ぼうし                   1.2km · 〜20:00│
│ そば・うどん · 秦野市                    │
│ 業態の見立て: 一人客が普通の業態          │ ← kind 由来の1行。点線スコアは出さない
└──────────────────────────────────────┘
```
- チェーンは `[チェーン]` チップ。穴場候補は `[穴場候補]`（「周辺に同業が少ない独立店」の説明は about に）。
- 「業態の見立て」文言は kind→固定文（ramen/gyudon/curry/standing/sento/netcafe/library/museum/cinema=「一人客が普通の業態」、soba_udon=「一人客が多い業態」、karaoke=「ヒトカラ対応は要確認」、hostel=「ドミトリー中心。個室は要確認」、onsen/sauna=「一人利用は一般的」、private_sauna=「個室型」）。

## 6. 詳細シート

順序:
1. 見出し: 名前／kind／市区町村／距離／営業中判定（時刻と根拠: 「OSM opening_hours」か「公式サイト 2026-08-08確認」）
2. **確認のしるし**: 確認済みなら「確認日・公式ソース n・出典ドメイン n・食い違い n」、未確認なら「未確認: OpenStreetMap の登録情報のみ。公式情報をご確認ください」
3. **ひとり基準**（このサービスの独自ブロック）: 一人利用の明記(solo_ok 引用)／席(counter_seats, seats_total)／支払い(payment_method)／予約(reservation)／静けさ(silence)／初回(first_timer)／利用制限(access: male_only 等は常に警告色で必ず出す)／営業状態(status: 休業・閉業は最上部に赤で)
4. 「一人マップのひとこと」= 既存の solo_insight（`quality=grounded` かつ `policyVersion=official-provenance-v2` のみ）。無いときはこの節を出さない（現行の定型文生成は廃止: 根拠のない文を出さない方針に合わせる）。
5. 事実一覧: 営業時間・定休日・料金・アクセス・駐車場…。**食い違いは両方並べる**（「600円 ← city.kuwana.lg.jp(公式)」「150円 ← yuru-to.net」「⚠ 出典で食い違い」）。個人訪問記由来は「個人訪問記」ラベル。
6. アクション行: **行きたい** / **行った**（日付＋一言メモ、任意）/ **経路**（`https://www.google.com/maps/dir/?api=1&destination=lat,lon`）/ 公式サイト（`web` があれば）/ 共有 / 「情報が違う」（X intent、施設名入り定型文）
7. この土地の一人旅: `data/hitori/journal_links.json`（都道府県コード→ hitoritabi の journey ページ）に該当があればカード1枚。実装時に各 journey ページを読んで都道府県を確定する（推測で貼らない）。

## 7. 保存（localStorage）

キー `hitori.saved.v1`:
```json
{ "want": { "<id>": { "t": 1724900000, "pref": 14, "name": "…" } },
  "went": { "<id>": { "t": 1724900000, "pref": 14, "name": "…", "date": "2026-08-30", "memo": "…" } } }
```
- `pref` を持つのは、共有URL `?saved=14:n123,13:n456` から別端末で復元するとき県ファイルを引くため。
- 保存件数はヘッダー `[♡3]` に出す。saved シートは一覧＋地図重ね。「共有URLをコピー」で `?saved=` 付きURL。
- 読み書きは try/catch。使えない環境ではボタンを「この端末では保存できません」に。

## 8. データ読み込みと性能

現行の問題: `curated.json` 2.3MB を初回に丸ごと読む／「現在地から」で県ファイル47本(5.8MB)を全部読む。

変更（`scripts/hitori/build_index.py` を追加。Python、リポジトリ内で完結）:
- `data/hitori/index.json`（新規, 〜60KB）: 都道府県ごとの中心座標・件数・確認済み件数、＋ `checked: {id: [pref, n_facts, n_official, n_conflict, has_insight, checked]}` の軽い索引。
- `data/hitori/curated/NN.json`（新規, 県別）: facts 本体。詳細を開くか「確認済みのみ」で必要になった県だけ読む。
- `curated.json` は残す（旧版 `hitori-legacy.html` と既存スクリプトが参照するため）。build_index は curated.json から派生させる一方向。
- 現在地モード: 既存の `data/hitori/prefectures_svg.json` ＋ `core.prefectureAt()` で県を決め、その県を先に読んで描画し、`data/hitori/neighbors.json` の隣接県を後から追加読込する（旧版と同じ方式。境界箱は作らない）。
- 地図描画: 候補は `L.canvas()` の circleMarker、確認済み・選択中・保存済みだけ divIcon。一覧は近い50件＋「もっと見る」。
- 読み込み中はシートにスケルトン。失敗時は「再読み込み」ボタン付きメッセージ。

## 9. ファイル構成

既存資産を土台にする。`assets/hitori/core.js`（ESM、旧版 `hitori-legacy.html` が使用、`tests/hitori_core_test.mjs` で検証済み）には haversineM / parseOpeningHours / openState / searchPlaces / prefectureAt / filterItems / sortItems がすでにある。**これらは再実装せず import する**。

```
hitori.html                      マークアップ + CSS（インライン）。<script type="module" src="assets/hitori/app.js">
assets/hitori/core.js            既存。触らない
assets/hitori/map-core.js        新規・純関数: 表示カテゴリ再計算, kind日本語, 営業中ラベル, 事実整形(食い違い集約), 順位付け(確認済み上位固定), 半径拡大, 保存ストア v1, 共有URL, 場面定義
assets/hitori/app.js             新規: DOM・Leaflet・fetch・シート挙動・GoatCounter
tests/hitori_mapcore_test.mjs    node（既存 hitori_core_test.mjs と同じ check/eq 流儀）。tests/hitori_all.py の NODE_TESTS に追加
scripts/hitori/build_index.py    新規。tests/hitori_index_test.py（fixture で固める）。TESTS に追加
data/hitori/index.json, data/hitori/curated/NN.json, data/hitori/journal_links.json
tests/hitori_map_test.py         pytest + Playwright（既存 hitori_render_test.py と同じローカルHTTP方式）。390×844 / 1400×900 で home→現在地(座標モック)→カード→詳細→保存→共有URL復元。スクショは tests/screens/
tests/hitori_render_test.py      BASE を hitori-legacy.html に向け直す（旧版の回帰テストとして残す）
```
地図タイルは旧版と同じ **地理院タイル pale**（`https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png`、出典表記「国土地理院」）。淡色なのでピンが立ち、OSM タイルの利用規約上の懸念もない。地図ライブラリは Leaflet 1.9.4（現行のまま）。

## 10. 見た目

- 既存パレット継続（paper #faf7f1 / ink #2c2723 / accent #ad5039 / sage #276b60 / 金 #f5c24a）。Noto Sans JP / Noto Serif JP。
- 地図タイルは地理院 pale（§9）。CSS フィルタは掛けない。
- タップ対象は最小 44px。シートはドラッグ＋ハンドルタップでスナップ。`prefers-reduced-motion` でアニメ無効。
- ダーク対応はしない（地図タイルが明るいので統一感が崩れる）。

## 11. エラーと縁

- 位置情報拒否/失敗: 現行の3種メッセージを踏襲し、エリア選択へ導く。
- 該当0件: 半径自動拡大→それでも0なら「このエリアは調査前。最寄りの確認済み: ○○（12km）」を計算して出す。
- 共有URLの id が県ファイルに無い（除外済みなど）: 「この施設は現在掲載していません」。
- JS無効/Leaflet失敗: 現行のフォールバック位置図は廃止し、一覧のみ表示（保守コスト対効果）。

## 12. 検証

- `node --test hitori/test/`: カテゴリ再計算（stay+museum→quiet）、営業中判定（"Mo-Su 11:00-21:00", "11:00-14:00,17:00-22:00", "24/7", 定休 "Mo off", 深夜跨ぎ "18:00-02:00"）、食い違い集約、保存ストア、共有URL往復。
- Playwright E2E（スクショを `tests/screens/hitori-*.png`）。公開前に実機幅のスクショを目で確認する。
- `python C:/tmp/check_dup_const.py hitori/app.js` exit 0（大型JSの重複宣言チェック）。
- 公開後: GoatCounter イベント4種が届いていることを翌日確認。

## 13. やらないこと（今回）

ログイン・同期／課金／レビュー投稿／ダークモード／TikTok等の外部連携／データ本体の変更（Bで行う）。
