# 気持ちスタンプ — 設計書

日付: 2026-09-23 ／ 対象: 作品の終わりと各ページ末尾に置く共通部品 `assets/feel/`、トップ `index.html` の新しい節「みんなの気持ち」
分類: Architectural（サイトで初めての共通 JS 部品と、約 30 ページへの設置）。
「交流・流入・見やすさ」の改修を 3 つに分けたうちの 1 つ目（交流）。見やすさ（トップの再構成）と流入は別の設計書にする。

## 0. 目的と、決まるまでの経緯

依頼: 「交流を含めて、もっとユーザが流入し楽しんでくれる場所へ。見やすさや工夫も含めて」。

実測（2026-09-23、GoatCounter 公開カウンタ、累計）: 全体 2,035。トップ 290、cabin 124、seikai 85、niwa 83、ai-map 63、salon 61、hyaku 40、ehon 32。
トップには感想・反応を残す手段が一つもなく、出口は note と X への外部リンクだけだった。

決まったこと（ユーザーの選択順）:
1. 交流の形は **訪問者から作者へ**
2. 送れるものは 拍手・ひとこと感想・リクエスト・質問
3. 置き場所は **作品の終わり＋トップ**
4. 運用は「返事を選んで公開」→「メールに返信するだけ」→「AI が当番」と案を重ねたが、ユーザーの指示で
   **メールは使わない／監視・承認・定期タスクなどの運用の仕組みは避ける** に決着した
5. 最終形: **気持ちスタンプ（数だけを公開）＋作者だけが読む非公開のひとこと**。作者の運用作業はゼロ

返事・お便りコーナー・受付番号・返事のお知らせは、運用を生むので作らない。

### 成功の見方（30 日後）
- 押してもらえた率 = スタンプを押した人数 ÷ 最後まで読んだ人数（hyaku・seikai は読了イベントがある）
- ひとことの件数
- 「みんなの気持ち」から作品を開いた数

## 1. 訪問者の体験

**はがき（通常版）** — 物語の読了画面とページ末尾に置く。
- 見出し（例: 「この物語に、気持ちを置いていく」）と、スタンプ 3〜4 個
- 押すとその場で +1 して「あなたと同じ気持ちの人が N 人います」。0 人だった場合は「最初のひとりになりました」
- まだ誰も押していないスタンプは、数の代わりに「まだ誰も」と出す
- 押したスタンプはブラウザに覚え（`localStorage` の `feel.v1`）、次に来たときも押した状態で出す。二重には押せない
- 「🔒 作者にひとこと（非公開）」を開くと 500 字までの欄。「作者だけが読みます。返事はしていません。個人情報は書かないでください」と添える

**はがき（小型版）** — ゲームの結果画面と絵本の奥付。スタンプだけで、ひとこと欄は付けない。

**見た目**: クリーム色の紙に細いインクの線、右上に切手の枠。ページの明暗に合わせず、「一枚の紙が置かれている」見せ方で全ページをそろえる。スタンプは絵文字。

**言語**: 文言は日本語と英語の 2 つ。`<html lang>` → `navigator.language` の順で決め、日本語以外は英語にする。

## 2. スタンプの定義

| 組 | スタンプ（キー） | 使う作品 |
|---|---|---|
| story | 😭 泣いた `naita` ／ 🔁 もう一度読みたい `mouichido` ／ 📣 誰かに勧めたい `susume` ／ ✍️ 続きが読みたい `tsuzuki` | hyaku, seikai, kototsugi |
| game | 🎉 楽しかった `tanoshii` ／ 🧠 手ごわかった `tegowai` ／ 🔁 またやる `mata` | sudoku, shogi-puyo |
| ehon | 🎉 楽しかった `tanoshii` ／ ✨ きれいだった `kirei` ／ 🔁 また開く `mata` | ehon |
| note | 💡 役に立った `yakudatta` ／ 🛠 試してみる `tameshite` ／ ❓ もっと知りたい `motto` | method/ の各ノート |
| tool | 💡 役に立った `yakudatta` ／ ✨ 面白かった `omoshiroi` ／ 🔁 また来る `mata` | ai-map, salon, ai-english, toeic, novel-bench, hitoritabi |
| site | 👏 拍手 `clap` ／ 🔁 また来る `mata` ／ 📣 誰かに勧めたい `susume` | トップ（サイト全体） |

リクエストは「✍️ 続きが読みたい」「❓ もっと知りたい」で受ける。

## 3. 仕組み（新しいサーバは立てない）

**数える**: 既存の GoatCounter のイベント。
`goatcounter.count({ path: 'feel/<work>/<key>', title: '<作品名> — <気持ち>', event: true })`

**読む**: 公開カウンタ `https://viewsengineer.goatcounter.com/counter/<encodeURIComponent(path)>.json`。
2026-09-23 に実測で確認済み（`game/hyaku/start` = 29、`game/hyaku/clear` = 14、CORS `*`）。
- 返る値は `"2 035"` のように区切り文字入りの文字列なので、数字以外を除いてから数値にする
- 反映は数分遅れる。押した本人にはその場で +1 して見せる
- 取ってきた数は `sessionStorage` に 10 分保存して使い回す

**ひとこと**: Google フォーム「ひとりぶんの棚 — 作者へのひとこと」（2026-09-23 作成・公開済み、作者の Google ドライブ）の
`formResponse` へ、`fetch(..., { mode: 'no-cors' })` で `application/x-www-form-urlencoded` を POST する。

| 項目 | entry |
|---|---|
| 作品 | `entry.796994745` |
| ページ | `entry.20892979` |
| ひとこと（段落） | `entry.274902902` |

送信先: `https://docs.google.com/forms/d/e/1FAIpQLSfu4FAXL_Qyu_BBhgGgyIfn2KH4gPGAnQSueTNop6v2H8RjJA/formResponse`
（メールアドレスの収集なし・ログイン不要。回答は作者のスプレッドシートにもつながっている。改行が保たれることをテスト送信で確認済み）

送った件数だけを `feel/<work>/note` のイベントで数える。本文は GoatCounter に送らない。

**作者が読む**: フォームの回答画面かスプレッドシート。Google ドライブ連携が有効なら Claude に「お便り見せて」でも読める。通知・定期タスクは作らない。

## 4. 置き場所

| ページ | 置き方 | 組 |
|---|---|---|
| `index.html` | 新しい節「№ 05 — みんなの気持ち」を `#knowhow`（作り方）と `#windows`（外の窓）の間に入れる。節の下にサイト全体のはがき（通常版） | site |
| `hyaku.html` | 読了画面 `#afterword` に通常版。既存のなろう・カクヨムへの感想導線は残す | story |
| `seikai.html` | エンディング後に戻るタイトル画面の `.sharerow` の下に通常版 | story |
| `kototsugi/index.html` | 末尾の footer の前に通常版。GoatCounter のタグがないので足す | story |
| `ehon.html` | 最後の頁「奥付」（`renderColophon()`）に小型版 | ehon |
| `sudoku.html` | 結果画面 `#resultScreen`（`showResult()`）に小型版 | game |
| `shogi-puyo.html` | 結果カード `#resultCard`（`endGame()`）に小型版 | game |
| `ai-map.html` `salon.html` `ai-english.html` `toeic.html` `novel-bench.html` `hitoritabi/index.html` | ページ末尾（footer の前）に通常版 | tool |
| `method/` の各ノート（日本語 14 本＋英語 2 本） | 各ノートの `<footer>` の直前に通常版。英語ノートは英語の文言 | note |

**置かない**: cabin・niwa（静かなまま保つ決定）、hitori（全画面の地図）、stopwatch、kototsugi/game（別リポジトリの再ビルドが要る）、koe（未完成・宣伝しない）、journal（アーカイブ）、hitoritabi の各旅ページ。

### トップの「みんなの気持ち」
- 「泣きたい／遊びたい／学びたい」の切り替えで、そのスタンプが多い順に作品を並べる。各行は作品へのリンク
  - 泣きたい = story の `naita`（hyaku, seikai, kototsugi）
  - 遊びたい = game・ehon の `tanoshii`（shogi-puyo, sudoku, ehon）
  - 学びたい = tool の `yakudatta`（ai-map, ai-english, toeic, novel-bench）。研究ノートは 16 本に分かれていて問い合わせが増えるので、ボードには載せない
- 実測の「最後まで読んだ人数」（`game/hyaku/clear`、`game/seikai/clear`）を添える
- 数を読みに行くのは節が画面に入ったとき（`IntersectionObserver`）だけ。問い合わせは約 15 件
- ナビに「気持ち」を足す。節番号がずれる（外の窓 № 06、AIの目 № 07、立場 № 08）。本文中の「№ 05 — 世界の外の窓」の参照も直す

## 5. 部品の構成

- `assets/feel/feel-core.js` — DOM に触らない純関数。スタンプ定義、GoatCounter のパス組み立て、カウンタ値の読み取り、並べ替え、文言の選択。ブラウザでは `window.FeelCore`、Node では `module.exports`
- `assets/feel/feel.js` — DOM と通信。スタイルは JS から 1 回だけ差し込む（クラスは `.feel-` で始める）。
  `[data-feel]` を自動で組み立てる: `<div data-feel="hyaku" data-feel-set="story" data-feel-mode="full"></div>`。
  JS が後から描く画面（ehon の奥付、sudoku・shogi-puyo の結果）向けに `window.Feel.mount(el, opts)` も出す
- 各ページの変更は「読み込み 1 行＋置き場所 1 行」を基本にする。`<script src="/assets/feel/feel-core.js" defer>` と `feel.js`
- GoatCounter の `count.js` が遅れて読み込まれる場合に備え、押下は最大 5 秒キューに溜めてから送る

## 6. 安全・壊れたとき

- サイトに出るのは数だけ。文章は表に出ないので、荒らし・なりすまし・スクリプト混入の入口がない
- ひとこと: 隠し入力欄が埋まっていたら送らない。欄を開いて 3 秒未満の送信も送らない。500 字まで
- 送信が通信エラーになったら「送れませんでした。もう一度」と出し、書いた文章は残す（`localStorage` の下書き）。
  `no-cors` のため Google 側の受け取り失敗は検知できない。通信が通れば「届きました」と出す
- 数が読めない（広告ブロッカー等）: 数は出さず、スタンプは押せる（押した演出だけ）
- ボードの数が読めない: 作品へのリンクだけ出す
- 数の水増しは完全には防げない。影響は数がずれることだけ。ひどい場合はそのスタンプの数の表示を止める
- GoatCounter は Cookie を使わない既存の計測。個人を識別する情報は新しく取らない

## 7. テスト

- `tests/feel_core_test.mjs`（Node）: スタンプ定義の整合（キー重複なし・全置き場所の組が存在）、パス組み立て、
  `"2 035"`・`"0"`・空・不正値の読み取り、ボードの並べ替え、言語の選択
- Playwright（ローカル HTTP）: 各置き場所をスマホ幅 375px と PC 幅 1280px で撮る。横スクロールが出ないこと。
  `hyaku.html` の読了画面がスクロールで末尾まで届くこと。はがきが暗いページでも読めること
- `python C:/tmp/check_dup_const.py` を大きな単一 HTML の変更後に通す
- 公開後: テスト用のキー（`feel/_test/…`）で押し、公開カウンタに反映されるか、連打で増えないかを実測する
- 公開後に `scripts/build_agent_view.py` と `scripts/generate_sitemap.py` を再実行する（コンテンツを足したら必ず）

## 8. 範囲外

- 返事、お便りコーナー、受付番号、通知、承認、定期タスク
- トップの見やすさ（最初の 1 画面・長さ）と流入 → 別の設計書
- ことつぎの星のゲーム本編の終幕、ひとり歓迎マップへの設置 → 後で検討
