# CrazyGames の審査基準と、通っている小規模パズルの最低線

調査日: 2026-11-07。対象: 『一筆花火 Hitofude Hanabi』の作り直しに使う基準。
読むだけの調査で、開発者ポータルへのログイン・提出・送信はしていない。

表記のきまり
- **【事実】** 公式文書、または自分で開いて確かめたもの。出典URLを添える。
- **【自己申告】** 開発者のブログ等の報告。本人の数字で、裏は取れていない。
- **【推測】** 上の材料からの私の判断。

---

## 0. 結論

1. **関門は2段ある。今回の不採用は1段目（人の審査）である。**
   【事実】1段目はQAチームが遊んで判定し、2段目 Basic Launch は実プレイの数字で判定する（[公式 FAQ](https://docs.crazygames.com/faq/)、[公式 Introduction](https://docs.crazygames.com/)）。
   【自己申告】文面も分かれている。
   - 1段目: "The overall quality of the game does not yet meet the expectations of our platform."（[Drift Lane](https://medium.com/@froessell/crazygames-rejected-drift-lane-the-game-claude-code-built-from-a-7-line-prd-97fabe3591a5)、[Outer Sheep](https://renbangames.itch.io/outer-sheep/devlog/1714284/rebuilt-after-a-rejection-5-stages-a-shepherd-and-music-written-in-code)、[Wild Trail Rally](https://makoto366.itch.io/wild-trail-rally/devlog/1693895/rejected-by-a-portal-rarely-finished-even-for-free-so-i-put-a-price-on-it)）
   - 2段目: "The game did not reach the performance benchmarks during Basic Launch."（[SCRAP ARMS NEO](https://note.com/kludgelog/n/n246208d3dc81)、[SinkEm](https://blog.hyperindex.org/sinkem-crazygames-7-day-launch-rejected/)）
   【推測】一筆花火は数字を測られる前の段階で落ちている。

2. **作り直しの目標は2段目の数字に置く。** 1段目を通っても、報告例の多くは2段目で落ちている（3章）。【事実】パズルの上位ゲームの平均は、プレイ時間21分・翌日復帰6.2%・1分転換68%（[公式 Puzzle](https://docs.crazygames.com/resources/monetizing-puzzle/)）。

3. **実物を開いて見えた共通点は「最初の5〜10秒」である。** 開いた24本のほぼ全部が、数秒で盤面まで届き、手の絵やカーソルで次の操作を指していた。タイトル画面で止まるものは少なかった（4章）。

4. **再提出には回数のリスクがある。** 【事実】"Developers who repeatedly submit non-compliant games may face restrictions on future submissions."（[公式 Gameplay](https://docs.crazygames.com/requirements/gameplay/)）。2回落ちているので、3回目は確かめてから出す。

---

## 1. 公式の基準【事実】

### 1-1. 2段階の仕組み

| | Basic Launch | Full Launch |
|---|---|---|
| 公開範囲 | 限られた人に7〜21日 | 全世界 |
| 実装 | CrazyGames専用の実装は不要、SDK任意 | SDK必須、着地で即プレイ |
| 審査 | Basic QA | Full QA |
| 広告・収益 | なし | あり |
| 終わる条件 | 7日以上かつ500プレイ以上。500未満なら21日で自動終了 | — |

出典: [Introduction](https://docs.crazygames.com/)、[Requirements intro](https://docs.crazygames.com/requirements/intro/)

Basic Launch の結果は3通りある（[Introduction](https://docs.crazygames.com/)）。
- 全指標が基準以上: Full 実装に招待される
- 一部が基準以上: 改善して再度の Basic Launch に招かれることがある
- 大半が基準未満: 進めない。再提出は "significant improvements" を含む新しいゲームとして扱う

### 1-2. 必須の要件（Basic で既に必要なもの）

出典: [Gameplay](https://docs.crazygames.com/requirements/gameplay/)、[Technical](https://docs.crazygames.com/requirements/technical/)

- 文字と画像が devicePixelRatio 1 で読めること。主要な枠は 907×510、1216×684、1077×606、821×462、1366×768、1920×1080、1536×864、1280×720、スマホ 800×450、タブレット 1080×607
- 物理が画面のリフレッシュレートに左右されないこと（144Hz、165Hz）
- 英語対応、直感的な操作、速い読み込み、エラーがないこと
- 名前・素材・内容に独自性があること
- 自前の全画面ボタンは禁止（サイト側が用意する）
- 他のゲームやサイトの宣伝は禁止（例外あり）
- PEGI 12 に適合すること（"Content is targeted for kids" も却下理由）
- 容量: 初回ダウンロード 50MB以下、スマホのトップ掲載には20MB以下。総量250MB以下、1500ファイル以下
- Chrome と Edge で動くこと。4GB RAM の Chromebook で滑らかでないと Chromium OS では無効にされる
- 横画面で遊べること。**縦画面ゲームも可**で、左右は黒帯か背景画像で埋める
- 提出物: カバー画像3種（1920×1080、800×1200、800×800）とプレビュー動画（15〜20秒、音なし）。「スクリーンショットのままにしない」との指示あり（[Game covers](https://docs.crazygames.com/requirements/game-covers/)）

### 1-3. 公式が挙げる却下理由（1段目）

"not limited to" の但し書きつきで、[FAQ](https://docs.crazygames.com/faq/) は次を挙げる。
- バグ、壊れたメカニクス
- 英語がない
- クローン、アセットフリップ
- 不適切な内容、PEGI 12 違反、子ども向けの内容
- 要件・規約・倫理基準に合わない

【自己申告】却下メールには "low gameplay quality, broken builds, copyright issues, or not meeting our integration requirements" のような並びが入るという（[Trustpilot](https://au.trustpilot.com/review/crazygames.com)、[Drift Lane](https://medium.com/@froessell/crazygames-rejected-drift-lane-the-game-claude-code-built-from-a-7-line-prd-97fabe3591a5)）。

公式は "we share constructive feedback" と書いているが、開発者側は具体的な理由がなかったと複数人が書いている（[Trustpilot](https://au.trustpilot.com/review/crazygames.com)）。

### 1-4. 品質ガイドライン（任意だが「強く推奨」）

出典: [Quality guidelines](https://docs.crazygames.com/requirements/quality/)

- オンボーディング: 新規は直接そこに着地する／ゲームプレイの中で教える／核の操作だけ教える／飛ばせる／文字より絵で／操作をマウスジェスチャ等で見せる
- 原則: 明確なゴール、覚えやすさ、一貫した操作
- 楽しさ: 操作への反応が速い／挑戦と戦略の釣り合いとテンポ／配置が快適／音が快適／プレイヤー層が広い／退屈な反復がない
- 独自性: 同名や似たアイコンと紛らわしくない／一般名だけの題名は避ける
- 見た目: 高解像度、解像度の統一、圧縮の汚れがない、**作風が途中で変わらない**、音量が揃っている、音楽が映像に合う

### 1-5. 2段目の指標

出典: [Basic Launch Guide](https://docs.crazygames.com/resources/basic-launch-metrics/)、各ジャンルの [Puzzle](https://docs.crazygames.com/resources/monetizing-puzzle/) [Word](https://docs.crazygames.com/resources/monetizing-word/) [Action](https://docs.crazygames.com/resources/monetizing-action/) [Clicker](https://docs.crazygames.com/resources/monetizing-clicker/)

| 指標 | 定義 | 公式の「強い作品」の目安 |
|---|---|---|
| 平均プレイ時間 | 1セッションの平均 | 10分以上 |
| 翌日復帰 D1 | 翌日戻った割合 | 10〜15% |
| Conversion | 開始後 **1分以上遊んだ**割合 | 80%以上、読み込み10秒未満、20MB未満 |

| 上位ゲームの平均 | 時間 | D1 | 転換 |
|---|---|---|---|
| **Puzzle** | **21分**（全体平均より32%上） | **6.2%** | **68%** |
| Word | 14分 | 7.6% | 記載なし |
| Clicker | 15分 | 6.6% | 記載なし |
| Action | 約13分 | 8.1% | 記載なし |
| 全体 | 記載なし | 6.7% | 記載なし |

公式によると、パズルは収益上位100本で最大の分類である。

公式が挙げる直し方: 進行要素（レベル、解放、強化）／デイリーの仕掛け／進行の保存／磨き込み／新要素を徐々に出す。

---

## 2. 1段目で落ちた例と、本人が考えた原因【自己申告・原因は本人の推測】

| ゲーム | 本人が挙げた原因、直した点 | 出典 |
|---|---|---|
| Wild Trail Rally | 作風の混在、21秒の読み込みに表示なし、操作説明なし、カバーがスクショ | [devlog](https://makoto366.itch.io/wild-trail-rally/devlog/1693895/rejected-by-a-portal-rarely-finished-even-for-free-so-i-put-a-price-on-it) |
| Outer Sheep | 友人37人の感想「数ラウンドは楽しいが次の目標がない」。5ステージ化、ステージ別の曲、得点時の演出強化 | [devlog](https://renbangames.itch.io/outer-sheep/devlog/1714284/rebuilt-after-a-rejection-5-stages-a-shepherd-and-music-written-in-code) |
| Lethal Grid | 最初の1分、音楽、絵の密度、連鎖の見返り。新規には Play と Skip だけ、1手で全滅する盤面、手のカーソル、「Chain!」表示、曲2本 | [PR #23](https://github.com/amitsingh0024/lethal-grid/pull/23) |
| Dead Days | 3回却下。907×510でHUDの文字が8〜9pxで読めない。1キーで開始、説明スライドを削除 | [devlog](https://anirudhxp.itch.io/dead-days-family-survival/devlog/1759573/dead-days-family-survival) |
| Drift Lane | 7行の仕様から数時間で作成。「似たゲームと近く作りも甘い」と本人の推測 | [Medium](https://medium.com/@froessell/crazygames-rejected-drift-lane-the-game-claude-code-built-from-a-7-line-prd-97fabe3591a5) |

- 同じ作者の同じ手法の Bolt Pit は通っている（同上）。審査員の判定基準は公開されていない。
- Lethal Grid は連鎖ゲームで、一筆花火に最も近い。**作り直し後に通ったかは見つからなかった。**
- **却下後に作り直して1段目を通った実例の記事は見つからなかった。** 逆に、作り直して4時間未満で再び落ちた報告はある（[r/IndieDev](https://www.reddit.com/r/IndieDev/comments/1woa2wx/our_crazy_games_basic_launch_failed_heres_what_we/)。これは Basic Launch 失敗後の再提出）。
- 独自性で落ちた報告もある。「rejected four times for not being unique enough」「too similar to existing titles」（[Trustpilot](https://au.trustpilot.com/review/crazygames.com)）。
- AI生成の扱いの規定は公表されていない（[Portal Ready](https://portalready.world/portals/crazygames/) の確認）。公式 FAQ はAI利用を開発手段として紹介している（[FAQ](https://docs.crazygames.com/faq/)）。
- r/gamedev、r/WebGames を探したが、1段目の却下理由に絞った投稿は多く見つからなかった。HTML5GameDevs と Discord 由来の整理された事例は見つからなかった。

---

## 3. 2段目の採点【自己申告】

**公式は合格点も配点表も公開していない。** 以下は各開発者のダッシュボードやメールの報告である。

- 3指標を各5点、計15点で採点。デスクトップとモバイルは別々（[フジヤマハンブン](https://fujiyamahanbun.hatenablog.com/entry/2026/07/27/210324)）
- 比較対象は同カテゴリの他ゲーム（同上のメール、[kludgelog](https://note.com/kludgelog/n/n246208d3dc81)）。**カテゴリの選び方で採点が変わる**
- 表示の帯: 11点以上「Ready for Full Launch」／9〜10点「Will be enabled - improvements recommended」（フジヤマハンブン）。10月の報告では9〜10は「Pending manual review」と表示された（kludgelog）。表示が変わった可能性がある
- **合格線は報告が割れている**: 「9点以上」（[Dockside Labs](https://blog.docksidelabs.se/posts/ah-crazygames)、[SinkEm](https://blog.hyperindex.org/sinkem-crazygames-7-day-launch-rejected/)）。ただし 9/15 で却下された例がある（フジヤマハンブン）。【推測】安全線は11点以上
- 採点は期間で切る。期間後の修正は数えない（kludgelog）。却下されるとページは404になり、新版提出のボタンも消えたという（kludgelog、SinkEm）

| ゲーム（分類） | 端末 | 平均時間（点） | D1（点） | 1分転換（点） | 計 | 結果 |
|---|---|---|---|---|---|---|
| **Brickaboom（ブロックパズル）** | PC | 4分54秒（1） | 1.83%（2） | 47.02%（1） | 4 | 未達 |
| | スマホ | 6分09秒（2） | 2.26%（3） | 25.65%（1） | 6 | |
| 2作目（Clickerで提出） | PC | 19分00秒（4） | 3.55%（2） | 61.82%（3） | 9 | 却下 |
| | スマホ | 12分25秒（4） | 4.08%（3） | 37.60%（2） | 9 | |
| SCRAP ARMS NEO（Action） | PC | 5分12秒（2） | 3.16%（2） | 42.58%（1） | 5 | 却下 |
| | スマホ | 4分10秒（2） | 0%（1） | 18.15%（1） | 4 | |
| SinkEm（3D対戦） | — | 8分21秒（3） | 3.16%（2） | 56.96%（1） | 6 | 却下 |
| Card Quest（カード） | — | 10分45秒 | 6.25% | 記載なし | 6 | 却下 |
| Chaos Arena | PC/スマホ | 18分/36分 | 12.03% | 記載なし | 15 | 可 |
| Tile Clash（文字の対戦、Full 後） | — | 22分33秒 | 10.60% | 67.10% | — | Full |

出典: [Kynora Labs](https://kynoralabs.com/laboratorio/retencion-crazygames-lo-que-aprendimos)、[フジヤマハンブン](https://fujiyamahanbun.hatenablog.com/entry/2026/07/27/210324)、[kludgelog](https://note.com/kludgelog/n/n246208d3dc81)、[SinkEm](https://blog.hyperindex.org/sinkem-crazygames-7-day-launch-rejected/)、[r/gamedev](https://www.reddit.com/r/gamedev/comments/1spr40q/my_dream_project_flopped_on_crazygames_so_i/)

読み取れること【推測】
- **最大の落とし穴は1分転換である。** 時間が足りていても転換で落ちる例が多い。スマホは特に低い。
- **Brickaboom が唯一のパズルの点数である。** 4分54秒で1点、47%で1点。パズルの比較相手が強いことと合う。
- 公式の「D1 10〜15%」は実際の配点より高い。4%台で3点、6%台で4点の報告がある（フジヤマハンブン）。

Full に進んでからの QA の指摘例（Tile Clash、原文）: "fill the entire available game frame and avoid showing solid-colored areas on the sides"、"guide the player to click the 'Continue' button"（[Kynora Labs](https://kynoralabs.com/laboratorio/retencion-crazygames-lo-que-aprendimos)）。

Poki の参考【事実】: 500人に見せるテストで、平均3分超かつ25%以上が3分超で次へ進む。成功作は平均5分以上（[Poki Player Fit Test](https://developers.poki.com/guide/player-fit-test)）。

---

## 4. 上位と通過直後のゲームを開いた記録

### 測り方【事実】

- 2026-11-07、Python Playwright（channel="chrome"、headful、音は消音）、1366×800、新しいゲスト状態で各1回、依頼主の回線とPC
- 開始後30秒は無操作で観察し、その後は汎用のクリックとドラッグ。一部は手順を書いて短く操作した
- **広告の配信元を遮断した**（誤クリック防止）。実際の利用者が見るプレロール等の時間は入っていない
- 「最初の操作まで」は画面の連番から読んだ、盤面と指示が出るまでの秒数で、±2秒程度
- 「DL」は開始30秒に受信した最大のゲーム用ホストの content-length 合計で参考値。HTML5 はヘッダなしの応答が多く出ないので「—」
- **音の中身は聴いていない。** 全24本で AudioContext が作られ running になるのを確認したが、質は未評価
- **プレイ数はどの画面にも見えなかった。** CrazyGames は好評数と不評数、Poki は評価と票数だけ
- **1ゲームの長さは、自動操作では実測できなかった。** 説明文や画面から分かることだけ書く
- 順位は `/c/puzzle` の「Top games」、`/t/casual`、トップページの表示順（2026-11-07）から選んだ。厳密な順位表ではない
- 証拠: `C:\tmp\hitofude_market\cg_shots\`（各ゲームの t10・t30・t60、操作した回の mid・end、計95枚）、`C:\tmp\hitofude_market\measure\`（連番シート）、`C:\tmp\hitofude_market\cg_scan.json`（172本の情報欄）

### 上位・比較対象

URLはすべて `https://www.crazygames.com/game/` の後ろに slug を付けたもの。

| ゲーム（slug） | 開発元 | 評価／好評・不評 | 公開／更新 | 技術 | 最初の操作まで | DL | 導入の形 | メタ進行（説明文と画面） | 見た目 |
|---|---|---|---|---|---|---|---|---|---|
| Piece of Cake（piece-of-cake-merge-and-bake） | HG POINT | 8.2／282K・54K | 2024-10／2025-05 | 外部iframe | **17秒で物語** | 表示19.8MB | ロゴ→読込→物語の紙芝居（Skipあり）。Skipを押さない汎用クリックでは63秒でも盤面に未到達 | 店の修復、章解放、ブースト | 2D。描き込まれた絵、最高水準 |
| Block Blaster（block-puzzle-master） | Onki Games | 8.7／142K・21K | 2024-03／2026-07 | Unity 6 | 9秒 | 17.9MB | **タイトルなし**。手が1列消しを指示 | コイン、最高点、物語モード | 2D。面取りブロック、背景あり |
| Screw Out（screw-out-bolts-and-nuts） | Vkusnyatina | 8.6／71K・11K | 2025-03／2026-05 | Unity 2022 | 13秒 | 19.4MB | ロゴ→Level 1。手が示す。**縦画面で左右を柄で埋める** | Level表記、ブースト4種 | 2D。紙の質感 |
| Goods Triple Match 3D（goods-triple-match-3d） | YYGGames | 8.3／9K・1.7K | 2026-03／2026-10 | Cocos | 17秒 | 表示16.1MB | 読込→Level 1、手が示す | レベル、残り時間、順位表タグ | 3D風の商品 |
| Hexa Stack（hexa-stack） | SOFTGAMES | 8.4／8K・1.5K | 2026-07／2026-10 | HTML5 | 9秒 | — | 「Goal 60」の帯→矢印と手 | 「thousands of levels」、道具4種 | 3D調の六角 |
| Numicolor（numicolor） | medoborodyj | 8.6／26K・4K | 2026-04／2026-11 | HTML5 | 4秒＋1クリック | — | Welcome（Start tour／Skip）、吹き出しで案内 | 画像集、複数モード | 塗り絵、簡素 |
| Bus Escape（bus-escape-clear-jam） | Mirra Games | 9.0／3.7K・421 | 2026-02／— | Unity 2022 | 9秒 | 8.3MB | Level 1が即出る。説明文なし | ブースト4種、コイン | 3D調、明るい。PCのみ |
| Bridge Builder（bridge-builder-eoi） | FreePDA | 8.8／46K・4.8K | 2025-08／2025-12 | Unity 2022 | 13秒 | 38.9MB | 手が橋を引く見本 | 星3つ、コスト | 3D都市 |
| Slime Works（slime-works-cjj） | 表示なし | **9.4**／1.6K・94 | 2026-09／— | HTML5 | **5秒** | — | 手が光る配管を指す。短文、SKIP。SKIPを押すと「SHIFT 1」 | **ランク、皮、道具、強化、補給品の店、独自通貨、デイリー、ゴール3つ** | 2D。金属の質感、統一感が高い |
| Cornerlet（cornerlet） | 表示なし | 9.1／9.5K・924 | 2026-09／2026-11 | HTML5 | 5秒 | — | 部屋に直接着地。少女の吹き出しが案内 | ワールド、234種のシール | 2D。手描き風シール |
| Words of Wonders（words-of-wonders） | Famobi | 8.8／438K・62K | 2023-05／2025-07 | Phaser | 13秒＋1クリック | — | ロゴ→言語選択と PLAY→即レベル | 通貨、ヒント、背景収集 | 写真背景 |
| Space Waves（space-waves） | do.games | 8.7／5.1M・862K | 2024-04／2026-10 | Unity 6 | 9秒 | 16.6MB | 実物の中で操作説明、Skip tutorial | 複数ワールド、順位表 | 単純な図形＋強い色 |
| Paint to Hide!（paint-to-hide） | motionman games | 9.0／78K・8.3K | 2026-08／2026-10 | HTML5 | 6秒 | — | ロビーに着地、13秒で試合 | ラウンド制（75秒の準備） | ローポリ3D |

### 一筆花火に近い比較対象

| ゲーム（slug） | 開発元 | 評価／好評・不評 | 公開 | 技術 | 最初の操作まで | DL | 導入の形 | 見た目 |
|---|---|---|---|---|---|---|---|---|
| Draw One Line（draw-one-line-drawing-puzzle） | Bravestars | 9.2／263・23 | 2026-07 | Unity 2022 | 10秒 | 18.1MB | 手が線をなぞる＋短文。"hundreds" | **白地に灰色の線だけ、ごく簡素** |
| Pocketro（pocketro）ローグ系カード | Rising Pixel | 8.9／3.3K・423 | 2025-05 | Unity 6 | 9秒 | 13.0MB | タイトルなし。手が札を指し短文で説明 | 2D。キャラと紙吹雪 |

### 通過直後の小規模ゲーム（pre-release＝Basic Launch と思われる）

**ここが最低線の直接の材料である。** 【事実】情報欄に "(pre-release)" とあり、票が数件〜数十件。Basic Launch の中の可能性が高い（【推測】）。Full に進むかは不明である。

| ゲーム（slug） | 評価／票 | 技術 | 最初の操作まで | 導入の形 | 量とメタ（説明文と画面） | 見た目 |
|---|---|---|---|---|---|---|
| Clock Tinker（clock-tinker） | 9.2／12・1 | HTML5 | **5秒** | 半透明カーソルが見本を動かす。**1回のドラッグで「Nice!」、金の輪と紙吹雪** | 面番号1/8の表記、ルビーで帽子、ヒント、工房の壁 | 木の机、猫が反応し眠る。統一感が高い |
| Letter Trip（letter-trip-rlb） | 9.3／26・2 | HTML5 | **5秒** | 手が文字をなぞる。**1回なぞれば1語目が入る**（こちらは14秒待ってから操作） | 都市ごとの面、Miles通貨、スタンプ、絵葉書 | ベネチアの写真背景 |
| Gotcha Cat（gotcha-cat） | 8.6／6・1 | HTML5 | 5秒＋2クリック | **ハブ画面に着地**→How to play→開始 | **25事件**、毎日解放、コイン、店、記録と連続日数、バッジ、暦 | 描き込んだイラスト、猫探偵 |
| Rally Sleuth（rally-sleuth） | 8.8／7・1 | HTML5 | 5秒＋2クリック | モーダル「Practice lap／Skip」→同行役が説明 | デイリーの論理パズル | コミック調、作り込みが濃い |
| Ossuário（ossuario） | 9.5／21・1 | HTML5 | 6秒、盤面は未確認 | **キャラ選択に着地**。汎用操作では盤面に進めず | 7層、最大9人、12人解放、装備、金と宝石 | 暗い写実調の肖像 |
| Match Pairs（match-pairs-memory-training） | 9.2／11・1 | Unity 2022 | 24秒で報酬画面、45秒で盤面（こちらの操作開始は30秒） | 47MB表示→Unityロゴ→**Daily Reward**→3頁の説明→盤面 | 300札、51テーマ、裏面30、背景30、輪、店、宝箱 | 描き込んだ庭、豪華 |

### Poki の上位パズル

順位は [poki.com/en/puzzle](https://poki.com/en/puzzle) の表示順。URLは `https://poki.com/en/g/` の後ろに slug を付けたもの。

| ゲーム（slug） | 開発元 | 評価（票数） | 公開／更新 | 技術 | 最初の操作まで | DL | 導入の形 | 見た目 |
|---|---|---|---|---|---|---|---|---|
| Blocky Blast Puzzle（blocky-blast-puzzle） | OPlay Games | 4.3（778,082） | 2024-04／2026-03 | wasm系 | 5秒 | 1.7MB | **タイトルなし**。手が1列消しを指示、Skip | 2D。面取りブロック |
| Tens!（tens） | Dial-Up Dino Games | 4.2（9,315） | 2026-06／2026-09 | Godot | 10秒 | 14.2MB | 短文2行＋手。早送りボタンあり | 水の写真＋数字タイル、簡素 |
| Goods Master（goods-master） | Tuki Tuki Games | 4.3（11,590） | 2026-08／2026-10 | Unity | 5秒 | 4.1MB | Level 1、「3 Moves」、手 | 棚と小物、落ち着いた配色 |

### 実際に少し操作して分かったこと【事実】

- **Slime Works**: 1タップ目で説明が次へ進み、SKIPで本編に入る。本編でも短文が順に出る（"Red and yellow make orange."、"Delivered!" など）。「Shift goals」3つが常時見える。失敗すると結果画面に「LINE RUPTURE」「NEW BEST」、達成の内訳、次の解放（RUST）までの残り、ランクの進捗、「WATCH AD — FLUSH」「NEW RUN」「SHOP」が1枚に出る。**店の品揃えは皮4、道具3、強化1、補給品1で、一部はランクで解放**。ローグ系の周回の作り方の見本である。
- **Clock Tinker**: 1手目で盤が回り「Nice!」、次の面では「1 more ruby for the next hat」が出て次の目標を見せる。無操作だと猫が眠る。
- **Gotcha Cat**: 「How to earn coins」に報酬が一覧で出る（Chest of the day 50、Hard case 40、New sticker 25）。
- 自動操作では Block Blaster、Screw Out、Hexa Stack、Draw One Line の最初の手を通せなかった。**ゲームの不具合とは言えず**、こちらの座標が粗かった可能性が高い。

### 2人用の表示【事実】

`/t/2-player` は `/multiplayer?tab=2-player` へ転送され、8 Ball Pool、Ragdoll Archers、Bullseye Brawl、Chess Free、PixelWars、Stickman Clash、Tap Superstar などが並ぶ。パズルは見当たらないので、個別の計測はしていない。

---

## 5. 通っている小規模パズルの最低線【推測】

根拠は上の pre-release 6本と 2026 年公開の小規模作、公式の数字、報告の点数である。少数の標本で、生存者の偏りがある。合格を保証する線ではない。

### A. 1段目（人の審査）の最低線

| 項目 | 最低線 | 根拠 |
|---|---|---|
| 開いて最初の操作まで | HTML5 で **5秒前後** | pre-release の HTML5 5本すべて5〜6秒 |
| 開始前の関門 | 1〜2クリックまで。専用ロゴや長い説明は置かない | Rally、Gotcha は2クリックで通過。Full では1クリックまで |
| チュートリアル | **手かカーソルが盤面の上で動き、文字は1文**。飛ばせる | 開いたほぼ全部 |
| 最初の成功 | **1操作で、開いて15秒以内に届く形** | Clock Tinker、Letter Trip、Slime Works |
| 成功の演出 | 文字＋光＋粒＋キャラの反応 | Clock Tinker、Slime Works、Lethal Grid |
| 見た目 | **1つの作風に統一し、画面全部が絵か意図ある背景**。図形だけの場合も配色と線が整っている | 6本とも画面に空きがない。例外の Draw One Line や Tens! も統一は崩れていない |
| 画面の埋め方 | 16:9の枠を埋める。縦長なら左右に柄や絵 | Screw Out、Tile Clash の指摘 |
| 常設UI | 音量、一時停止、やり直し、ヒントが見える | Clock Tinker、Gotcha など |
| 文字の大きさ | 907×510、DPR1で読めること | 公式要件、Dead Days |
| 量の見え方 | 画面の進行表示（1/8、Case #9 など）か、説明文の数えられる数字で、先の量が分かる | 6本のうち Rally を除く5本（Rally は毎日更新の形） |
| 進行要素 | 通貨・収集・デイリーのうち**少なくとも1つ**。両方あると強い | 6本すべてに1つ以上。両方あるのは Gotcha、Match Pairs。全部あるのは正式公開の Slime Works |
| 音 | 操作音と曲、消音ボタン | 全本で音の処理あり。質は未確認 |
| 提出物 | 英語、スクショでないカバー3種、15〜20秒の動画 | 公式 |

ステージ数の目安: 記載があるものは「8面×町単位」「25事件＋毎日」「7層」である。公式の数値基準はない。【推測】**1回目に20〜30分遊べる量と、翌日の新しい目標**を最低に置く。8夜×2で足りるかは、1夜の長さ次第である。

### B. 2段目で落ちないための数字

| 指標 | 下限の目安【推測】 | 根拠 |
|---|---|---|
| PCの1分転換 | **60%以上**、目標68% | 61.82%で3点（Clicker）、56.96%で1点（SinkEm）、パズル上位68% |
| スマホの1分転換 | **40%以上** | 37.60%で2点。パズルでの線は不明 |
| 平均時間 | **10分以上**、パズルは目標15〜20分 | 公式10分、パズル上位21分 |
| D1 | **4〜6%** | 4.08%で3点、6%台で4点、パズル上位6.2% |
| 容量と読み込み | 20MB未満、10秒未満 | 公式。HTML5 なら大きく下回れる |
| 合計点 | PC・スマホとも11点以上を狙う | 9/15で却下の例 |

カバーのクリック率も見られている（FAQ の "CTR"）。報告は 0.3%〜1.8%で（[r/gamedev](https://www.reddit.com/r/gamedev/comments/1spr40q/my_dream_project_flopped_on_crazygames_so_i/)、[Larss IO](https://fxf8.itch.io/larss-io/devlog/1586849/launching-a-1v1-strategy-game-on-crazygames-04-ctr-and-what-im-learning)、[Bolt Pit](https://medium.com/@froessell/my-claude-code-game-got-664-plays-and-earned-0-fewer-than-2-in-100-players-came-back-the-next-day-4997c2e825ec)）、公式の基準値は見つからなかった。

### C. 一筆花火へのあてはめ（一筆花火の実物は開いていない。依頼文の説明からの推測）

1. **最初の1本を5秒以内に引かせ、一発で連鎖が咲くようにする。** 手が線をなぞる。Lethal Grid の「1手で全滅する盤面」と同じ考え方。
2. **タイトルと説明を飛ばす。** 2回目以降にだけメニューを見せる。
3. **縦画面寄りは禁止ではないが、16:9の枠で小さくなる。** 510pxの高さで線と玉と文字が読めるかが先。左右は花火の夜景などで埋める。Canvas の DPR1 での滲みも確認する。
4. **お守り24種は強みになりうる。** ローグ系は通っている（Pocketro、Slime Works）。結果画面で「次の解放まであと何」と「もう1回」を1枚に出す。店と通貨は Slime Works が見本。
5. **デイリーを足す。** Rally Sleuth、Gotcha Cat、Slime Works が持つ。D1 に直接効く部分で、同じ配置を全員で遊ぶ形は作りやすい。
6. **作風の統一を確認する。** 公式が名指ししており、落ちた人の自己診断にも出る。
7. **遊んだ人の1分転換を提出前に測る。** スマホで特に。ここが一番落ちている。
8. **3回目は慎重に出す。** プレビュー機能で確かめ（[Introduction](https://docs.crazygames.com/)）、知らない人に遊んでもらってから。公式は「意味のある改善」を求めている。

### 公式の資料で見つからなかったもの

- 合格点、配点表、パズルの基準値
- 1段目の不合格理由を具体的に知る方法
- CrazyGames の担当者が「どんなゲームが通るか」を語るインタビュー。[PocketGamer.biz の Rafael Morgan 氏](https://www.pocketgamer.biz/speaker-spotlight-crazygames-rafael-morgan/) は流通の話が中心だった。[利用傾向の記事](https://www.pocketgamer.biz/report-hypercasual-and-puzzle-games-dominate-the-browser-gaming-space/) は米国で平均30分、ハイパーカジュアルとパズルが上位という内容で、審査基準には触れていない
- 各ゲームのプレイ数
