# ひとり歓迎マップ（hitori.html）設計

- 日付: 2026-08-02
- 状態: 設計承認済み・実装計画待ち
- 成果物: `C:\projects\yuichi916.github.io\hitori.html` ほか

## 1. 目的

「ひとりで行きやすい施設」ではなく **「ひとりが標準の施設」** だけを集めた日本地図を作る。
サイト（yuichi916.github.io）の新作ページとして公開し、salon / niwa / ehon と同じ単一HTML＋GitHub Pages の系譜に載せる。

利用者の問い: **「今週末、ひとりで行ける場所はどこか」**、および **「日本のどこがひとりに優しいのか」**。

## 2. 決定事項

| 論点 | 決定 |
|---|---|
| 位置づけ | サイトの新作ページ（公開・SEO・将来の動画化まで想定） |
| データ源 | ハイブリッド（OSM Overpass で母数＋手動キュレーションで質） |
| カテゴリ | 湯・サウナ / カウンター飲食 / ひとり娯楽 / ひとり滞在 の4種 |
| 地図表現 | 県別ヒートマップ → 県クリックでドリルダウン |
| 県の塗り色 | 人口10万人あたりの収録件数 |
| 配信方式 | 二段配信（全国サマリを先読み、県詳細は都度fetch） |
| 補完源 | 業態ベース点＋チェーン加点＋出典つきエビデンス |
| 投稿受け口 | GitHub Issue Forms（v1）。将来 Cloudflare Worker へ移行可 |
| 県詳細の地図 | 県ポリゴン上の散布図（外部タイル依存なし） |

## 3. データ実現性（実測値）

2026-08-02 に Overpass API で実測した全国件数。推測ではない。

| カテゴリ | OSMタグ | 件数 |
|---|---|---|
| 湯・サウナ | `amenity=public_bath` | 5,667（うち `bath:type=onsen` 751） |
| 湯・サウナ | `leisure=sauna` | 820 |
| カウンター飲食 | `amenity=restaurant` + cuisine=ramen/noodle/soba/udon/gyudon/curry/donburi | 15,589 |
| カウンター飲食 | `amenity=fast_food` + 同上 | 3,704 |
| カウンター飲食 | ひとり歓迎チェーン20社の name 一致 | 7,849 |
| ひとり娯楽 | `amenity=karaoke_box` | 1,460 |
| ひとり娯楽 | `amenity=cinema` | 520 |
| ひとり娯楽 | `amenity=internet_cafe` | 520 |
| ひとり滞在 | `tourism=hostel` | 1,063 |
| ひとり滞在 | `amenity=library` | 3,891 |
| ひとり滞在 | `tourism=museum` | 6,722 |

重複除去後の概算 **3.5〜4万件**。これが「単一JSONでは配れない」という配信設計の根拠になっている。

`tourism=hotel` + `hotel=capsule` は全国1件しかなく、カプセルホテルは OSM から機械的には取れない。手動キュレーション層でのみ扱う。

`amenity=cafe` は v1 では収録しない。件数が膨大で、かつ「ひとりが標準」とまでは言えないため。

## 4. アーキテクチャ

ビルド時にデータを固め、ランタイムは静的JSONを読むだけ。一方向のデータフロー。

```
Overpass API
    │  fetch_osm.py（県単位・リトライ・ミラーフォールバック）
    ▼
_local\hitori_raw\{pref}.json     ← gitignore、再開可能なキャッシュ
    │
    │  build_data.py（正規化 → 重複除去 → スコア付与 → 分割）
    │  ← curated.json（人が編集する唯一のファイル）
    │  ← prefecture_population.json
    ▼
data\hitori\summary.json + data\hitori\pref\{01..47}.json
    │
    ▼
hitori.html（fetch のみ）
```

### ファイル構成

```
C:\projects\yuichi916.github.io\hitori.html
C:\projects\yuichi916.github.io\data\hitori\summary.json
C:\projects\yuichi916.github.io\data\hitori\pref\01.json … 47.json
C:\projects\yuichi916.github.io\data\hitori\curated.json
C:\projects\yuichi916.github.io\scripts\hitori\fetch_osm.py
C:\projects\yuichi916.github.io\scripts\hitori\build_data.py
C:\projects\yuichi916.github.io\scripts\hitori\scoring.py
C:\projects\yuichi916.github.io\scripts\hitori\ingest_issues.py
C:\projects\yuichi916.github.io\scripts\hitori\research_queue.py
C:\projects\yuichi916.github.io\scripts\hitori\prefecture_population.json
C:\projects\yuichi916.github.io\tests\hitori\test_scoring.py
C:\projects\yuichi916.github.io\tests\hitori\test_build_output.py
C:\projects\yuichi916.github.io\tests\hitori\test_render.py
C:\projects\yuichi916.github.io\.github\ISSUE_TEMPLATE\hitori-submission.yml
```

各スクリプトの責務は独立している。`scoring.py` は副作用のない純関数のみを持ち、`build_data.py` から呼ばれる。取得（fetch）と加工（build）を分けてあるため、スコアリングを直すのに Overpass を叩き直す必要がない。

### 取得の単位

Overpass のクエリは `area["admin_level"=4]` で **都道府県ごとに分割**して投げる。これは2つの問題を同時に解く。

1. 全国一括クエリはタイムアウトする（調査中に実際に exit 28 を踏んだ）
2. 各施設がどの県に属するかを、点内包判定なしで確定できる

## 5. スコアリング

### 前提と限界

**OSM には「黙浴」「カウンター席」というタグが存在しない。** そのため「業態としてひとりが標準かどうか」を代理指標にする。日本の外食・入浴は業態とひとり歓迎度の相関が強く、実用的な近似になる。ただしこれは推定であり、画面上でそう明示する。

### 計算式

```
score = clamp(業態ベース点 + チェーン加点 + エビデンス加点, 1, 5)
収録条件: score >= 3
```

### 業態ベース点

OSMタグから決定的に決まる。同一施設が複数条件に該当する場合は**最も上の行が勝つ**。

| カテゴリ | 判定条件 | 種別キー | 基本点 |
|---|---|---|---|
| eat | `name` に 立ち食い/立ち飲み/立喰/角打ち | standing | 5 |
| eat | `name` に 焼肉ライク/一人焼肉/ひとり焼肉 | yakiniku_solo | 5 |
| eat | `cuisine` に ramen | ramen | 4 |
| eat | `cuisine` に soba / udon / noodle | soba_udon | 4 |
| eat | `cuisine` に gyudon / donburi | gyudon | 4 |
| eat | `cuisine` に curry | curry | 4 |
| bath | `leisure=sauna` | sauna | 5 |
| bath | `amenity=public_bath` + `bath:type=onsen` | onsen | 3 |
| bath | `amenity=public_bath` | sento | 4 |
| play | `amenity=internet_cafe` | netcafe | 5 |
| play | `amenity=karaoke_box` | karaoke | 4 |
| play | `amenity=cinema` | cinema | 3 |
| stay | `amenity=library` | library | 4 |
| stay | `tourism=hostel` | hostel | 3 |
| stay | `tourism=museum` | museum | 3 |

eat の条件は `amenity` が `restaurant` または `fast_food` のときのみ評価する。

### チェーン加点

`name` がひとり歓迎チェーン20社のいずれかに一致すれば **+1**。実測で7,849件が該当する。リストは `scoring.py` に定数として置き、追加時はテストも足す。

一蘭 / 焼肉ライク / いきなりステーキ / てんや / 富士そば / 日高屋 / 大戸屋 / やよい軒 / CoCo壱番屋 / ゆで太郎 / 松屋 / 吉野家 / すき家 / なか卯 / 丸亀製麺 / はなまるうどん / かつや / 餃子の王将 / リンガーハット / 天下一品

### チェーン判定（フィルタ用）

スコアとは独立に、各施設へ `chain` フラグ（0=独立店 / 1=チェーン）を付ける。「有名チェーンを隠して個人店だけ見る」フィルタのため。

判定は以下の順で、最初に該当したものが勝つ。

1. `curated.json` に `chain` の明示指定があればそれに従う（人の判断が最優先）
2. `brand` または `brand:wikidata` タグがあれば **1**
3. `name` が `CHAIN_BRANDS`（正規表現リスト）に一致すれば **1**
4. いずれでもなければ **0**

**`brand` タグ単独では不十分であることを実測で確認した**（2026-08-02）。

| 対象 | 総数 | `brand` タグあり | 被覆率 |
|---|---|---|---|
| カウンター飲食 | 19,293 | 2,860 | 14.8% |
| 銭湯・公衆浴場 | 5,667 | 4 | 0.07% |
| カラオケ | 1,460 | 615 | 42% |
| ネットカフェ | 520 | 288 | 55% |

一方、チェーン20社の名称一致だけで飲食7,849件を拾えている（`brand` タグの2.7倍）。したがって判定の主役は名称リストであり、`brand` タグは補助にすぎない。

`CHAIN_BRANDS` は `SOLO_BRANDS`（20社）を包含する上位集合として `scoring.py` に置く。初期値は全カテゴリ合わせて50件程度を想定する。

- 飲食: SOLO_BRANDS 20社 ＋ 幸楽苑 / 一風堂 / 丸源ラーメン / 山田うどん / 小諸そば ほか
- 湯: 極楽湯 / 万葉倶楽部 / おふろの王様 / 湯けむりの里 / スーパー銭湯チェーン各社
- 娯楽: ビッグエコー / カラオケ館 / まねきねこ / ジョイサウンド / 快活CLUB / 自遊空間 / アプレシオ
- 滞在: 東横INN / スーパーホテル / ドーミーイン / APAホテル

**この判定の限界を明示する。** `chain=0`（独立店）は「チェーンだと分からなかった」という**不在証明**であり、原理的に不完全。リストに載っていない地域チェーンは独立店として表示される。画面上でも「独立店」ではなく「チェーン判明分を除く」という語で表現する。誤りは `curated.json` の `chain` 指定で個別に直せる。

### エビデンス加点

`curated.json` に出典つきの証拠がある場合に加減する。

```
肯定エビデンスが1件以上ある   → +1
否定エビデンスが1件以上ある   → -1
excluded フラグが立っている   → 収録しない（理由を残す）
```

同一施設に複数の証拠がある場合、**確認日が新しいものが勝つ**。`curated.json` は常に OSM 由来の値より優先される。

否定エビデンス（「ひとりだと入りにくかった」）を受けられることは必須要件。これがないと地図は嘘をつき続ける。

## 6. 補完レイヤー

業態ベース点は初期値にすぎず、その上に出典つきの証拠を積む。**出典のない情報は採用しない。**

### エビデンスのスキーマ

```json
{"src":"web",   "url":"https://...", "claim":"仕切りカウンター12席",   "checked":"2026-08-02", "polarity":"+"}
{"src":"user",  "id":"gh-issue-42",  "claim":"黙浴の掲示あり",         "checked":"2026-08-02", "polarity":"+"}
{"src":"visit", "claim":"21時は自分ひとりだった",                      "checked":"2026-07-20", "polarity":"+"}
{"src":"user",  "id":"gh-issue-57",  "claim":"2名以上でないと入店不可", "checked":"2026-08-01", "polarity":"-"}
```

`src` は `web` / `user` / `visit` / `review` の4値。`review` はスキーマだけ用意し、v1では書き込まない（§6.3参照）。

### 6.1 ユーザ投稿（GitHub Issue Forms）

画面の「この施設の情報を送る」から、施設ID・県コード・施設名をプリフィルした issue 作成URLへ遷移する。

`.github\ISSUE_TEMPLATE\hitori-submission.yml` で入力項目を構造化し、`hitori-submission` ラベルを自動付与。`ingest_issues.py` が `gh` CLI で当該ラベルの issue を取得し、本文をパースして `curated.json` にマージする。取り込み済みの issue は `ingested` ラベルを付けてクローズ。

この方式を選ぶ理由: サーバー不要、GitHubアカウント必須なのでスパムが自然に抑制される、投稿履歴が公開監査できる、無料。Cloudflare Worker + KV（`_workers\lingo-transcript` に実績あり）は投稿ハードルが下がる代わりにスパム対策とモデレーションUIを自前で持つ必要があり、投稿ゼロの初日から抱えるコストとして重い。投稿が育った時点で移行する。

マージは自動だが**無条件ではない**。`ingest_issues.py` は差分を表示して人が確認してから `curated.json` に書き込む（`--yes` で省略可）。

### 6.2 ネット情報

`research_queue.py` が調査すべき施設を優先度順に出力する。優先度は「ユーザ投稿が来た施設」＞「スコア境界（3点）の施設」＞「県内で件数の少ないカテゴリ」の順。

調査は公式サイト・公式SNSの記載（「おひとり様歓迎」「黙浴にご協力ください」等）を根拠にし、**出典URLと確認日を必ず記録する**。URLが取れないものは採用しない。この制約は `build_data.py` 側でも検証し、`src:"web"` で `url` が空のエビデンスはビルドエラーにする。

### 6.3 口コミ

食べログ・サウナイキタイ等のスクレイピングは利用規約違反のため**行わない**。

Google Places API は合法だが有料・キャッシュ30日制限・表示要件があるため、v1では実装しない。`src:"review"` のスキーマだけ用意しておき、将来必要になった時点で追加する。

## 7. データスキーマ

### summary.json

初回ロードで読む。数KB。

```json
{
  "updated": "2026-08-02",
  "total": 38412,
  "population_source": "総務省統計局 人口推計（2025年10月1日現在）",
  "prefectures": [
    {"code":1, "name":"北海道", "pop":5092000,
     "counts":       {"all":1022, "bath":312, "eat":418, "play":88, "stay":204},
     "counts_indie": {"all":679,  "bath":298, "eat":221, "play":31, "stay":129},
     "density":       {"all":20.1, "bath":6.1, "eat":8.2, "play":1.7, "stay":4.0},
     "density_indie": {"all":13.3, "bath":5.9, "eat":4.3, "play":0.6, "stay":2.5}}
  ]
}
```

`density` は `counts / pop * 100000`。カテゴリ別かつチェーン有無別に持つのは、**フィルタ切り替えのたびに再fetchせず塗り分けを即座に再計算するため**。フィールドが倍になるが、47県×10値なのでファイルは数KBのまま収まる。

### pref/{code}.json

県クリック時にfetch。最大の東京都でも150KB程度を目標とする。列名を1回だけ書く配列形式、座標は小数5桁（約1m精度）に丸める。

```json
{
  "pref": 13, "name": "東京都", "updated": "2026-08-02",
  "fields": ["id","name","lat","lon","cat","kind","score","conf","chain","note"],
  "items": [
    ["n1234567890","一蘭 渋谷店",35.65894,139.70043,"eat","ramen",5,2,1,"仕切りカウンター12席"],
    ["n1122334455","はやしや",35.70112,139.75820,"eat","soba_udon",4,0,0,""]
  ]
}
```

`conf`（信頼度）は 0=推定 / 1=出典あり / 2=現地確認。`chain` は 0=独立店 / 1=チェーン（§5参照）。`note` は curated 由来の一言で、なければ空文字。

### curated.json

人が編集する唯一のデータファイル。施設IDをキーにする。

```json
{
  "n1234567890": {
    "note": "仕切りカウンター12席",
    "evidence": [
      {"src":"web","url":"https://ichiran.com/shop/tokyo/shibuya/","claim":"仕切りカウンター12席","checked":"2026-08-02","polarity":"+"}
    ]
  },
  "c-0001": {
    "name": "カプセルホテル○○", "lat": 35.6, "lon": 139.7,
    "cat": "stay", "kind": "capsule", "base": 5,
    "note": "OSM未登録のため手動追加",
    "evidence": [{"src":"visit","claim":"訪問済み","checked":"2026-07-20","polarity":"+"}]
  },
  "n9876543210": {
    "excluded": true,
    "exclude_reason": "2名以上でないと入店不可",
    "evidence": [{"src":"user","id":"gh-issue-57","claim":"2名以上でないと入店不可","checked":"2026-08-01","polarity":"-"}]
  }
}
```

`excluded: true` の施設は収録されないが、レコードは残す。再ビルドのたびに OSM から復活してしまうのを防ぐため。

チェーン判定を人手で上書きする場合は `"chain": 0` または `"chain": 1` を書く。地域チェーンを個別にチェーン扱いしたり、チェーン名を含む独立店（「一蘭本店の隣の店」のような誤爆）を独立店に戻したりするのに使う。

`n`/`w`/`r` 始まりのIDは OSM 由来（node/way/relation + OSM ID）。`c-` 始まりは OSM に存在しない手動追加で、この場合は座標とカテゴリも curated 側に持つ。

### 重複除去

同一名かつ 30m 以内の施設は1件にまとめる。node と way の両方でタグ付けされたケースを吸収するため。統合時は way/relation 側を残す（面情報のほうが確度が高い）。

## 8. 画面

### 全国俯瞰

SVGの日本列島を人口10万人あたり密度で塗り分ける。右にトップ10県のランキングを常時表示。上部に3種のフィルタを置く。

1. **カテゴリ** — 湯・飲食・娯楽・滞在（複数選択、初期は全ON）
2. **チェーンを隠す** — トグル。ONで `chain=1` を全画面から除外する
3. **信頼度** — ◌推定 / ◍出典あり / ◉現地確認

**この画面の核はフィルタの切り替えにある。** 4つのカテゴリで地図の濃淡がまったく変わることが、そのままコンテンツになる。

チェーントグルはさらに強い。全ONの地図は「牛丼屋とカラオケが多い県」を映すが、チェーンを隠した地図は**その土地に根づいた個人店の分布**を映す。同じデータで2つの異なる日本が出てくるのが、この機能の価値。銭湯は `brand` タグがほぼ無く実質すべて独立店として残るため、トグルON時は湯の比重が上がった地図になるはずである（実データで確認する）。

いずれのフィルタも `summary.json` 内の density / density_indie を読み替えるだけなので、再fetchなしで即座に反映される。

チェーントグルの表示ラベルは「チェーンを隠す」とし、補助テキストで「判明しているチェーンのみ。地域チェーンは残る場合があります」と添える。§5で述べたとおり独立店判定は不在証明であり、「個人店だけ」と言い切ってはいけない。

配色は dataviz スキルに従い、単一色相のシーケンシャルスケール、5分位ビン、light/dark 両対応。色だけに頼らないよう、県ラベルに数値を併記し、キーボード操作（Tab で県移動、Enter で選択）を提供する。

県ポリゴンは Natural Earth の admin-1（パブリックドメイン）を簡略化してHTMLに直接埋め込む。目標50KB。精度が不足する場合は国土数値情報（国土交通省、出典明記で利用可）に差し替える。

### 県詳細

PCは右サイドパネル、モバイルはボトムシート。表示内容は、県の密度と全国順位、カテゴリ内訳、施設リスト（スコア順・信頼度バッジ付き・各件に Google Maps リンク）、そして県ポリゴンを拡大した散布図。

**県詳細に地図タイルは使わない。** OSM公式タイルサーバーは公開サイトからの継続利用がタイル利用ポリシー上グレーであり、MapLibre＋商用タイルはAPIキーとレート制限を抱え込む。GitHub Pages で外部依存ゼロを保つほうがこの規模のページには堅い。失われる「駅からの距離感」は各ピンの Google Maps リンクで外部に委ねる。

### 信頼度の表示

```
◌ 推定      業態からの機械推定のみ（薄い輪郭）
◍ 出典あり   公式サイト等で確認（半分塗り）
◉ 現地確認   ユーザ投稿・訪問済み（塗りつぶし＋縁取り）
```

フィルタで「◉のみ」に絞れる。「4万件あるが、確かなのはこの数百件」という実態を隠さずに出すための装置。

画面下部に常設で注記を出す:
> この分類は OpenStreetMap のタグと業態から機械的に推定したものです。実際の座席形態や黙浴の有無を保証するものではありません。

### URL状態

`hitori.html#pref=13&cat=eat&conf=2&nochain=1` の形で状態をURLに持ち、共有とブラウザバックに対応する。`nochain=1` はチェーン非表示。

## 9. 失敗の扱い

### 取得時

Overpass のタイムアウトは実際に発生する（調査中に exit 28 を踏んだ）。対策は3層。

1. クエリを県単位に分割する
2. リトライ3回（指数バックオフ）、その後ミラーへフォールバック（`overpass-api.de` → `overpass.kumi.systems` → `overpass.osm.jp`）
3. 成功した県の raw を `_local\hitori_raw\` にキャッシュし、再実行時はスキップ

**部分的に失敗しても再実行すれば埋まる**構造にすること。47県すべてが揃うまで `build_data.py` は走らせない（`--allow-partial` で明示的に上書き可）。

### ビルド時

出力を検証してから書き出す。1つでも落ちたらビルドを失敗させる。

- 47県すべてのファイルが存在する
- 緯度経度が日本のbbox（北緯20〜46、東経122〜154）内にある
- `name` が空でない（無名施設は収録しない）
- `score` が 1〜5 の整数
- `chain` が 0 または 1
- `counts_indie` の各値が `counts` の対応値を超えない
- ID重複がない
- `src:"web"` のエビデンスに `url` がある

### ランタイム

県JSONのfetch失敗は**その県のパネルだけ**のエラー表示に閉じ込め、地図本体と他県は生かす。リトライボタンを出す。`summary.json` の取得に失敗した場合のみ全体エラーとする。

## 10. テスト

| 対象 | 方法 | ファイル |
|---|---|---|
| スコアリング | 純関数テスト。各業態・チェーン加点・エビデンス加減・clamp・収録閾値 | `tests\hitori\test_scoring.py` |
| チェーン判定 | 純関数テスト。curated優先 / brandタグ / 名称一致 / 非該当 の4経路と、優先順位が守られること | `tests\hitori\test_scoring.py` |
| ビルド出力 | §9のスキーマ検証をテストとしても実行 | `tests\hitori\test_build_output.py` |
| 描画 | headless screenshot（shogi-puyo で確立した手法）。俯瞰・県詳細・モバイル幅の3枚 | `tests\hitori\test_render.py` |
| commit前 | 重複const宣言チェック `python C:/tmp/check_dup_const.py hitori.html` が exit 0 | 手順 |

スコアリングのテストは実装より先に書く。ここが仕様の本体であり、後から書くと実装に引きずられる。

## 11. v1に含めないもの

- Google Places API による口コミ取得（スキーマのみ用意）
- Cloudflare Worker による投稿受け口（GitHub Issue で開始）
- 地図タイル（県ポリゴン散布図で代替）
- `amenity=cafe`（件数過大かつ「ひとりが標準」と言い切れない）
- 全国横断の店名検索（県別配信のため。必要なら軽量な名前インデックスを別途追加）
- 営業時間・混雑度（OSMの `opening_hours` はカバレッジが低く、信頼できない）
