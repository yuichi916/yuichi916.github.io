# 一筆花火を Steam で売る水準にするための調査

調査日: 2026-11-07。「ゲームの丸写し」ではなく、何が商用水準を作っているかを知るための資料。

## 読み方

- **[事実]** 出典 URL あり。
- **[抜粋]** 検索結果の要約でしか確認できていない事実。本文は開いていない。URL はあるが、精度は一段下がる。
- **[推測]** 私の解釈や提案。出典では裏づけていない。
- レビュー数と価格は、すべて 2026-11-07 に Steam から取得した**現在の値**。

## 取得できなかったデータ

- **SteamSpy・SteamDB の平均プレイ時間は取れなかった。** SteamSpy は Cloudflare の確認画面で 403 になり、回避はしなかった。プレイ時間の第三者 API（Gamalytic）は API キーが要るので使っていない。
- **HowLongToBeat（HLTB）には直接当たっていない。** 検索ツールが「このサイトにはアクセス不可」と返したため、回避せず、HLTB の値を表示している Deku Deals から取った。
- **全プレイヤーの平均プレイ時間は、どの作品についても見つからなかった。** 代わりに「HLTB の値」と「Vaporlens のレビュー投稿者の平均」を載せる。後者は投稿者だけの値で、高めに出るはず。
- **発売時の価格は、ほとんど確認できなかった。** 価格履歴を持つ SteamDB に入れなかったため。確認できたのは Vampire Survivors だけ。表の価格は現在の基本価格。

---

## 結論を先に（すべて [推測]）

1. **「パズル」として売らない。** 2025年に 1000 レビューへ届いた割合は、パズルが 0.34%、ローグライク・デッキビルダーが 5.1%（§2）。一筆花火の強みは後者に近い。ただし、看板に見合うビルドの深さが要る。
2. **お守り24種は、最低ラインの半分以下。** ビルド部品の下限の目安は、¥580 の Nubby's のアイテム 50 以上。¥780 で売るならお守り 50〜60、¥1,200 なら 100 前後（§5）。
3. **いちばん重い差はコンテンツ量ではなく、縦画面と無料の完全版かもしれない。** Steam の素材は 16:9、Deck は 16:10 が基準。Web 版は体験版に絞らないと、有料にする理由が立たない。
4. **広告は Steam 版から外す。** 広告を収益モデルにしたアプリは、Steam の「出すべきでないもの」に入っている（§4）。
5. **満足感の核は「連鎖の音階」と「最後の大団円」。** Peggle はどちらも実例がある。一筆花火の「満開」はすでにその位置にあるので、ここに演出の予算を集める。
6. **2時間の壁を設計に入れる。** Steam は購入14日以内・プレイ2時間未満なら返金できる。短いゲームほど、最初の2時間でメタ進行の広さを見せる必要がある。

---

## 1. 短いセッション × 深いメタのインディー

### 1-1. レビュー・価格・Early Access

出典: 各作品のストアページ（本文の末尾に URL）と Steam の appdetails API。「全言語」は API の `recommendations.total`、「英語」はストアページの表示。

| 作品 | 全言語レビュー | 英語レビューの肯定率（件数） | 日本価格 | 米国価格 | 正式発売 | Early Access 期間 |
|---|---:|---|---:|---:|---|---|
| Balatro | 162,829 | 98%（105,627） | ¥1,700 | $14.99 | 2024-02-20 | なし（ストア表示なし） |
| Slay the Spire | 194,884 | 97%（77,464） | ¥2,800 | $24.99 | 2019-01-23 | 2017-11 〜 約14か月 |
| Vampire Survivors | 252,829 | 98%（128,543） | ¥499 | $4.99 | 2022-10-20 | 2021-12-17 〜 約10か月 |
| Peglin | 16,734 | 88%（10,361） | ¥2,050 | $19.99 | 2024-08-27 | 2022-04-25 〜 約28か月 |
| Luck be a Landlord | 10,266 | 94%（5,355） | ¥1,200 | $9.99 | 2023-01-06 | 2021-01-08 〜 約24か月 |
| Dorfromantik | 27,545 | 96%（15,834） | ¥1,420 | $13.99 | 2022-04-28 | 2021-03-25 〜 約13か月 |
| Mini Metro | 12,871 | 95%（7,120） | ¥980 | $9.99 | 2015-11-06 | 2014-08 〜 約15か月 |
| ISLANDERS | 16,124 | 95%（10,225） | ¥620 | $4.99 | 2019-04-04 | なし（ストア表示なし） |
| Baba Is You | 21,160 | 97%（12,732） | ¥1,520 | $14.99 | 2019-03-13 | なし（ストア表示なし） |
| Monster Train | 19,993 | 96%（12,278） | ¥2,800 | $24.99 | 2020-05-21 | なし（ストア表示なし） |
| Dicey Dungeons | 10,487 | 89%（6,321） | ¥1,700 | $14.99 | 2019-08-13 | なし（ストア表示なし。発売前に無料の開発版あり） |
| Ballionaire | 2,429 | 85%（1,859） | ¥1,234 | $12.34 | 2024-12-10 | なし（ストア表示なし） |
| Nubby's Number Factory（追加） | 18,419 | 97%（17,105） | ¥580 | $4.99 | 2025-03-07 | なし（ストア表示なし） |
| BALL x PIT（追加） | 25,390 | 95%（15,817） | ¥1,700 | $14.99 | 2025-10-15 | なし（ストア表示なし） |

注意点:

- Balatro の全言語レビューは、API では 162,829 件、第三者サイトでは 189,944 件（SteamPulse）〜199,632 件（Vaporlens）と開きがある。理由は分からない。ここでは Steam の値を使う。
- Early Access の日付は、ストアページの「Early Access Release Date」を優先した。Slay the Spire と Mini Metro はストアに表示がなく、Wikipedia の記述による。
- Peglin は Wikipedia が「around a year」と書くが、ストアの日付では約28か月。ストアを採用した。
- 発売時価格で確認できたのは Vampire Survivors だけ。**Early Access は $2.99 で始まり、2022-09-21 に $4.99 へ上がった** [抜粋] https://www.pcgamesn.com/vampire-survivors/price-increase-steam
- Luck be a Landlord は開発元の資料でも PC 版 $9.99。発売時点の値かは不明。 https://www.trampolinetales.com/lbal/presskit

### 1-2. コンテンツ量とメタ進行

| 作品 | コンテンツ量 [事実] | メタ進行 [事実] | 周回を続ける理由 [推測] |
|---|---|---|---|
| Balatro | ジョーカー150、デッキ15、難易度8、ジョーカーの変種5、タロット22、惑星11、バウチャー32、チャレンジとシード付きラン、実績31 | 高難度「ステーク」は Slay the Spire の登塔モードを参考にした [Automaton] | 組み合わせの発見と、デッキ×難易度の埋めていく表 |
| Slay the Spire | カード350+、アイテム200+、戦闘50+、イベント50+。実績46 | Early Access 開始時は2キャラで、期間中にキャラを追加 [Wikipedia] | 調整されたカード間の相互作用と、キャラ別の難度の梯子 |
| Vampire Survivors | 抜粋では Early Access 開始時に7キャラ・武器22・パワーアップ12・ステージ1・実績23。1.0 時点の総数は資料が食い違う（24キャラ計画 vs 40キャラの報道） [抜粋]。実績243（現在） | ゴールドで永続強化、長い実績リストとチャレンジ [The Conversation] | 解放の連鎖そのものが報酬。次の解放がすぐ見える |
| Peglin | オーブ117・遺物183（2026-11 時点の第三者 wiki。v2.0 後の値で 1.0 時点は不明）、クラス4、Cruciball 20段階。実績52 | クラス解放と Cruciball [抜粋] | 同じ盤面でも、持ち玉で別の打ち方になる |
| Luck be a Landlord | シンボル152、アイテム227、実績186、フロア20、20言語 | フロアが難度の梯子 [開発元資料] | 組み合わせと、家賃を超える一回ごとの山場 |
| Dorfromantik | タイル、クエスト、解放要素（個数はストアに記載なし）。実績85 | 解放要素 [ストア] | 落ち着いて遊べる一回と、広がる景色 |
| Mini Metro | 実在の都市 24以上（Over two dozen）、Daily Challenge。実績73 | Daily Challenge [Wikipedia] | 手作りレベルなし。同じ規則で毎回違う盤面 |
| ISLANDERS | 島は自動生成、得点で次の島へ。実績38 | 得点の閾値で建物パックを選ぶ [Wikipedia] | 一回が短く、景色が残る |
| Baba Is You | 200レベル超。実績18 | 周回なし。レベルを解いていく型 | 周回ではなく、未解決の問題が残ること |
| Monster Train | カード220+、クラン5（各10レベル）、スターター10、難度25段階、イベント21+。実績53 | クランのレベル解放 | クラン2つの組み合わせ |
| Dicey Dungeons | 無料DLC「Reunion」で6エピソード追加。総数はストアから確定できず。実績53 | キャラごとのエピソード | キャラごとに規則が変わる |
| Ballionaire | トリガー145+、ブーン55+。実績23 | 組み合わせの発見 | 物理の偶然と計画の間 |
| Nubby's Number Factory | アイテム50+。実績13 | 数字の巨大化とノルマ | ¥580 で、数字がふくらむ快感が主役 |
| BALL x PIT | ボール60+（更新で増）、建物70+。実績63 | 拠点の建設 | 周回が拠点を育てる |

販売の参考 [事実/抜粋]:

- Balatro は 8時間で100万ドル超、1か月で100万本、2025年1月に500万本（Wikipedia）。発売3日で25万本 https://www.gamedeveloper.com/business/localthunk-s-balatro-sells-250-000-copies-in-first-three-days
- Peglin は Early Access の最初の1年で40万本（Wikipedia）。
- Ballionaire は発売から約2週間で10万本（Raw Fury 発表） [抜粋] https://automaton-media.com/articles/newsjp/20241222-322866/
- Slay the Spire の Early Access 最初の数週はおよそ2000本で、中国の配信者が取り上げて伸びた（Wikipedia）。
- 第三者の販売推定（Vaporlens の Balatro 1471万本など）は採用しない。発売元の数字と比べて極端に大きく、算出方法の説明もない。

### 1-3. プレイ時間

HLTB の値は Deku Deals 経由。Vaporlens は「2時間超プレイのレビュー投稿者（肯定）の平均」と「2時間以下の投稿の割合」。

| 作品 | HLTB メイン | HLTB メイン+追加 | HLTB 完全 | 投稿者（2時間超・肯定）平均 | 2時間以下の投稿の割合 |
|---|---:|---:|---:|---:|---:|
| Balatro | 8h | 46.5h | 250.5h | 104.8h | 1.0% |
| Slay the Spire | 12.5h | 47.5h | 191h | 174.2h | 0.6% |
| Vampire Survivors | 16.5h | 30.5h | 58.5h | 68.7h | 2.1% |
| Peglin | 4.5h | 15h | 66h | 90.5h | 3.7% |
| Luck be a Landlord | 3.5h | 17.5h | 149.5h | 66.8h | 7.9% |
| Dorfromantik | 取得不可 | 取得不可 | 取得不可 | 79.7h | 7.0% |
| Mini Metro | 6h | 13h | 44h | 取得不可 | 取得不可 |
| ISLANDERS | 取得不可 | 取得不可 | 取得不可 | 32.8h | 16.7% |
| Baba Is You | 7.5h | 21h | 46h | 42.1h | 0.8% |
| Monster Train | 取得不可 | 取得不可 | 取得不可 | 85.3h | 2.3% |
| Dicey Dungeons | 27h | 44h | 58h | 57.6h | 3.5% |
| Ballionaire | 6.5h | 9.5h | 15.5h | 16.6h | 15.7% |
| Nubby's Number Factory | 3h | 10h | 不明 | 26.0h | 3.1% |
| BALL x PIT | 19h | 25h | 36h | 42.9h | 1.7% |
| World of Goo | 6h | 8h | 14h | 11.2h | 13.1% |
| Peggle Deluxe | 取得不可 | 取得不可 | 取得不可 | 26.1h | 9.4% |

- 出典の例: https://www.dekudeals.com/items/balatro 、https://vaporlens.app/app/2379780/balatro/stats/details （他作品も同じ形式）。
- Vaporlens の更新日は作品ごとに異なる（2025-12〜2026-10）。Vaporlens の表は全レビューではなく一部の標本で、選び方は書かれていない。
- [推測] 2時間以下の投稿の割合は、「買って早々に判断された率」の粗い代理になる。肯定率の低い Ballionaire が 15.7% と高いのは、その表れかもしれない。ただし短くても満足できる作品（ISLANDERS）も高いので、これだけでは決められない。

---

## 2. 線を引く・連鎖・物理の系統

### 2-1. ジャンル全体の数字 [事実]

- **2025年の Steam 発売 20,282本のうち、1000レビューに届いたのは608本（2.99%）。パズルは 4,022本中14本で 0.34%。ローグライク・デッキビルダーは 212本中11本で 5.1%（2024年は 6.71%）。** ジャンル分けは筆者（Chris Zukowski）の分類。 https://howtomarketagame.com/2026/01/27/what-the-hell-happened-in-2025/
- 収益の中央値が最も低いジャンルはレーシング・パズル・アーケード・プラットフォーマーで、約 $1,000 以下（We Love It の調査を wnhub が紹介）。 https://wnhub.io/news/stores-and-publishing/item-51948
- Zukowski は GDC 2025 で、発売1か月で250レビューを目安に挙げた [抜粋]。例外も認めている。 https://wnhub.io/news/stores-and-publishing/item-47399

### 2-2. 個別の作品（レビュー数は古い作品ほど有利で、価格も違う点に注意）

| 作品 | 型 | 全言語レビュー | 肯定率 | 日本価格 |
|---|---|---:|---:|---:|
| Peggle Deluxe | ペグ消し | 12,901 | 97% | ¥700 |
| Peglin | ペグ×ローグライク | 16,734 | 88% | ¥2,050 |
| Nubby's Number Factory | プリンコ×ローグライク | 18,419 | 97% | ¥580 |
| BALL x PIT | ブロック崩し×ローグライク | 25,390 | 95% | ¥1,700 |
| Ballionaire | パチンコ×ローグライク | 2,429 | 85% | ¥1,234 |
| Roundguard | ピンボール×ダンジョン | 452 | 80% | ¥2,300 |
| holedown | 玉の反射 | 54 | 85% | ¥1,200 |
| Mini Metro | 線を引く（経営） | 12,871 | 95% | ¥980 |
| Mini Motorways | 線を引く（経営） | 23,737 | 96% | ¥1,010 |
| Poly Bridge | 橋の物理 | 17,175 | 89% | ¥1,010 |
| Poly Bridge 2 | 橋の物理 | 7,881 | 95% | ¥1,520 |
| Bridge Constructor | 橋の物理 | 962 | 78% | ¥1,200 |
| World of Goo | 物理パズル | 4,859 | 92% | ¥1,520 |
| World of Goo 2 | 物理パズル | 826 | 87% | ¥3,400 |
| Crayon Physics Deluxe | 線を描く物理 | 376 | 89% | ¥1,980 |
| Unium | 一筆書き | 227 | 94% | ¥235 |
| One Line | 一筆書き | 67 | 95% | ¥235 |
| One Line Coloring | 一筆書き | 54 | 92% | ¥580 |
| Fireworks Mania | 花火のシミュレーター | 7,588 | 97% | ¥1,200 |

- Bad Piggies は Steam のストア検索に出なかった。Steam での販売は見つからなかった。
- 線を引く×ローグライク、連鎖×ローグライクの有力作は、探した範囲では見つからなかった（探し切ったとは言えない）。

売れた・売れなかった事例と、その理由として語られたこと:

- **TILTit**（物理パズル）: 発売時のウィッシュリスト41、発売週の販売5本、ウィンターセールで追加7本。作者の挙げる原因は計画不足、宣伝の遅れ、ニッチ選びの失敗。 https://www.gamedeveloper.com/business/tiltit-postmortem-or-how-to-not-publish-a-game-in-todays-market
- **Peggle** も最初は売れ行きが遅く、Valve の Orange Box に専用の体験版が入ってから伸びた（Wikipedia）。**中身がよくても、見つかるかどうかで結果が変わる**例。
- **World of Goo** の Steam での最良の31日は 97,000本で、2回の値引きによるもの [抜粋]。 https://www.pocketgamer.biz/its-two-years-old-and-cost-ten-bucks-but-world-of-goo-still-did-125000-ipad-sales-in-its-launch-month/
- World of Goo の開発期間は、8か月の計画が約3倍に延びた [抜粋]。 https://destructoid.com/?p=41340

### 2-3. 差はどこから来るか [推測]

1. **「問題集」か「毎回違う遊び」か。** 一筆書きの純パズルは、肯定率が高くても数十〜数百レビューに留まる。線を引く系で万の単位に届いているのは Mini Metro と Mini Motorways で、どちらも手作りの問題を解くのではなく、毎回違う状況を経営する。Mini Metro の開発者は「手作りレベルを使わない」を制約に置いた。 https://www.gamedeveloper.com/audio/postmortem-dinosaur-polo-club-s-i-mini-metro-i-
2. **同じペグ系でも差は大きく、機構だけでは説明できない。** Peglin（16,734）、Nubby's（18,419）、Ballionaire（2,429）、Roundguard（452）。価格、時期、配信者、発売元が混ざっていて、単一の原因は特定できない。Nubby's の ¥580 と Roundguard の ¥2,300 の差は無視できないと思う。
3. **動画の1秒で伝わるか。** Mini Metro の開発者は「路線図という身近な題材で内容が伝わりやすい」ことと、無料の Web 版が広がりに効いたことを成功要因に挙げている（同上）。花火の連鎖は動画映えする点で有利。
4. **花火そのものに需要はあるようだ。** Fireworks Mania は 7,588 レビューで 97%。ただし別ジャンルのシミュレーターなので、参考の域を出ない。

---

## 3. 満足感（juice）を作る技法

### 3-1. 一次資料で確認できたこと

**Balatro**

- 開発者 LocalThunk が一番誇る機能は、手札が要求スコアを超えたときの炎の演出。「人生で最も生産的な夜」に作り、朝4時に形になったと投稿している。炎はスコア枠を中心に小さく始まり、枠全体に広がって数字を揺らす [抜粋]。 https://www.gamesradar.com/games/roguelike/after-winning-big-at-the-game-awards-and-taking-hours-of-our-time-in-2024-balatro-creator-reveals-their-most-productive-night-resulted-in-one-of-the-games-most-satisfying-features
- CRT フィルター、渦巻く背景、揺れるカードに統一感があったと本人が語る。ポーカーのなじみ深さにも頼ったと言う。 https://www.gameinformer.com/interview/2024/03/21/balatro-was-almost-called-joker-poker-and-other-details-from-its-creator
- 調整は「ほとんど数値の変更で済む」「テスターやコミュニティが明らかな問題に気づいたらパッチを当て、再評価する」。 https://rogueliker.com/balatro-interview/
- 開発は 2021-12-13 に開始。その月の末にはチップ×倍率の基本ができていた。他のローグライクは意図して遊ばなかった。 https://automaton-media.com/articles/newsjp/localthunk-the-balatro-timeline-20250308-330836/

**Balatro の二次情報（開発者の裏づけなし）**

- スコア計算中、カードとジョーカーが高くなっていく音を交互に鳴らし、チップは青で表示されるとレビューが記述している [抜粋]。 https://www.gameshub.com/?p=2637397
- 5層の演出、スコアに比例する揺れ、ド・レ・ミ・ファ・ソの上昇、約300ms の順次発動といった解説がある。ただし**著者の解釈と再現コードで、開発者の発言や実測はない**（本文で確認）。数値は設計の参考程度に。 https://blakecrosley.com/guides/design/balatro
- **スコアの段階表示・揺れ・音程上昇について、開発者本人が設計を説明した資料は見つからなかった。** GDC 講演も見つからなかった。

**Peggle**

- Extreme Fever は冗談から始まった（"it started out as a joke"）。作っていくうちに第九が流れると気持ちいいと分かり（"it's just so gratifying"）、「第九に負けない演出は何か」と炎、虹と積み上がっていった。 https://www.gamezebo.com/news/peggle-how-a-spark-started-a-fever/
- チームは「Extreme Fever をできるだけ劇的にする」と決め、ユニコーンや虹を仮素材から本採用に変えた。「それがなければ、楽しいゲームではあるが……」という発言がある（Sukhbir Sidhu、Jason Kapalka）。 https://pcgamer.com/the-making-of-peggle/2
- 物理がいちばん難しく、ゲームの形が決まってからエンジンを書き直した（"The physics was the toughest part."）。 https://www.gamezebo.com/news/peggle-how-a-spark-started-a-fever/
- 連鎖の音階: 当たるたびに音が高くなり、ショットの出来を音で伝える仕組みが特許にも記載されている [抜粋]。 https://www.patentarcade.com/video-game-patent/US8128476/electronic-game-such-as-a-computer-game-involving-removing-pegs
- 最後の一個: 球が最後のペグに向かうとスローになり、カメラが寄る。外すか当たるかがぎりぎりまで分からない [抜粋・レビュー]。 https://www.destructoid.com/?p=131509 、https://gamesradar.com/peggle-review
- 音の調整: 大砲のような発射音は空気砲に、受け皿の音は短い天使の合唱に変えた（Wikipedia） https://en.wikipedia.org/wiki/Peggle
- Extreme Fever の設計を開発者が語った GDC 講演は見つからなかった。

**Vampire Survivors**

- 価格について、作者 Galante は「賢くではなく、公平に値付けした」と語る（"It wasn't priced in a smart way, it was priced in a fair way"）。 https://pcgamer.com/vampire-survivors-saved-its-creator-from-working-on-mobile-gambling-games
- 量の快感を作者が説明した一次資料や GDC 講演は見つからなかった。Noclip のドキュメンタリーは未確認。 https://www.youtube.com/watch?v=XQVdR8mJrds
- ギャンブル業界の経験が効いているという分析がある（The Conversation）。一方、宝箱を開ける演出に限った話だとする資料も検索結果にあった [抜粋。どのページの記述かは特定できていない]。 https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613
- The Conversation の解説にある「多層の報酬」「あと少しの感覚」は著者の分析。光や音の技法には触れていない。

**Slay the Spire（調整の方法）**

- GDC 2019 の講演 "Metrics Driven Design and Balance"。 https://www.gdcvault.com/browse/gdc-19/play/1025731
- 主な指標は「選択肢に出たときに取られる率」と「勝ったデッキに入っている率」。最初3つだったグラフが90以上に増えた。数値だけでなく、理由の明確な意見も重視する。 https://gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder

**汎用の古典**

- "Juice It or Lose It"（Jonasson・Purho）: 地味なブロック崩しに、機構を変えず演出だけを足していく実演。 https://gdcvault.com/play/1016487/contactUs 、https://www.gamedeveloper.com/design/video-is-your-game-juicy-enough-
- "The Art of Screenshake"（Nijman）: 地味なシューティングに30個の小さな調整を足していく実演 [抜粋]。 https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games

### 3-2. 一筆花火に置き換えると [推測]

丸写しを避けるため、技法の「役割」だけを移す。

| 役割 | 実例 | 一筆花火での案 |
|---|---|---|
| 連鎖の長さを耳で伝える | Peggle の音階 | 連鎖の段数で音階を上げる。西洋の音階ではなく、祭囃子や和音階にして作品の個性にする |
| 結果を計算の途中で見せる | Balatro の順次発動（二次情報） | 点を一度に出さず、玉・お守りごとに加算して、札が順に光る。どのお守りが効いたかを教える役も兼ねる |
| 数字の大きさを体で感じる | Balatro の炎 | 目標を超えたら、夜空に数字の規模に応じた枠や火の粉が広がる。「目標超え」の瞬間に一度だけ大きく鳴らす |
| 最後の一個の間 | Peggle のスローとカメラ | 最後の玉へ火が走るとき、時間を遅らせて寄る。「満開」になるかどうかを引っぱる |
| 大団円 | Extreme Fever | 「満開」を、音楽・全画面の花火・観客の反応まで含めた儀式にする。冗談の許される和風の見せ場（例: 招き猫や山車）も検討 |
| 量の快感 | Vampire Survivors（作者の説明はないが見た目の特徴） | 後半の夜で玉の数が大きく増える展開を作り、画面が埋まる瞬間を用意する |
| 調整の根拠 | Slay the Spire の指標 | 既存のボット測定に「お守りの採用率」「勝ちランへの含有率」を足す |

注意: 長い演出は周回の邪魔になる。高速化や省略の設定を最初から入れる。Steam Deck の性能（800p で 30fps が基準）も確認する。

---

## 4. Steam に出す実務

### 4-1. 費用・日程 [事実]

| 項目 | 内容 | 出典 |
|---|---|---|
| Steam Direct | 1作につき $100。返金なし。Steam の調整後総収益が $1,000 に達すると回収される | https://partner.steamgames.com/doc/gettingstarted/appfee |
| 発売までの待機 | 費用の支払いから **21日** は発売できない | https://partner.steamgames.com/doc/gettingstarted/onboarding |
| 税務情報の確認 | 第三者の確認に最大 **30日** | 同上 |
| Coming Soon | 公開ページを **2週間以上** 掲載してから発売 | https://partner.steamgames.com/doc/store/coming_soon |
| ストアページ審査 | 通常3〜5営業日。公開希望日の7営業日前までに申請 | https://partner.steamgames.com/doc/store/review_process |
| ビルド審査 | 通常3〜5営業日。7営業日を見込む | 同上 |
| Valve の取り分 | 基本 30%、$1,000 万超の部分は 25%、$5,000 万超の部分は 20% [抜粋] | https://www.bluesnews.com/s/195571/steam-increasing-revenue-share-for-biggest-sellers |
| ローンチ割引 | 上限 40%、期間 7〜14日。発売後30日は他の割引不可 | https://partner.steamgames.com/doc/marketing/discounts |
| 価格の変更 | 発売から30日は値上げ不可。値上げ後30日は割引不可 | 同上 |
| 日本円 | 価格を設定しないと日本のユーザーは買えない | https://partner.steamgames.com/doc/store/pricing |
| 返金 | 購入から2週間以内、プレイ2時間未満 | https://store.steampowered.com/steam_refunds/ |

### 4-2. 必須の素材 [事実]

ストア用 https://partner.steamgames.com/doc/store/assets/standard

- Header Capsule 920×430
- Small Capsule 462×174
- Main Capsule 1232×706
- Vertical Capsule 748×896
- スクリーンショット 5枚以上、**最小 1920×1080、16:9**
- 任意: Page Background 1438×810

ライブラリ用 https://partner.steamgames.com/doc/store/assets/libraryassets

- Library Capsule 600×900
- Library Header 920×430
- Library Hero 3840×1240
- Library Logo 幅1280 または 高さ720

トレーラー https://partner.steamgames.com/doc/store/trailer

- **必須**。最初のトレーラーはゲームプレイ中心を推奨。ディスカバリーキューでは印象づけるまで10秒未満のこともある。
- 最大 1920×1080、16:9 推奨、H.264・AAC、5,000Kbps 以上推奨。

審査で見られること https://partner.steamgames.com/doc/store/review_process

- カプセルに読めるタイトルかロゴがある。
- スクリーンショットはゲーム画面のみ。賞の表示や宣伝文句の入った画像は不可。
- 説明文に外部リンクを入れない。
- 未実装の機能を書かない。
- 記載した対応 OS で起動する。

### 4-3. 禁止事項・AI の申告 [事実]

- 「出すべきでないもの」に **"Applications with advertising-based business models."** がある。 https://partner.steamgames.com/doc/gettingstarted/onboarding
- 同じ一覧に「権利を持たないコンテンツ」もある。Web サイトのラッパーを禁じる項目は、この一覧にはなかった。
- AI の申告: Content Survey で、ゲームに同梱されてプレイヤーが消費するコンテンツが対象（アート、音、物語、ローカライズなど）。 https://partner.steamgames.com/doc/gettingstarted/contentsurvey
  - **Pre-Generated**: 開発中に作って同梱するもの。
  - **Live-Generated**: 実行中に生成するもの。ガードレールの説明が追加で要る。
  - 開発効率のためのツールは対象外（2026年1月の改定 [抜粋]）。 https://www.pcgamer.com/software/ai/steam-updates-ai-disclosure-form-to-specify-that-its-focused-on-ai-generated-content-that-is-consumed-by-players-not-efficiency-tools-used-behind-the-scenes/
  - ストアページや宣伝素材が対象かは、公式ページに明記を見つけられなかった。
- [推測] 一筆花火の BGM は Suno 製なので Pre-Generated の申告対象。コードだけの Claude は対象外の可能性が高いが、フォームの最新の文面で確かめる。画像に AI を使っていれば、それも申告対象。Suno の利用権も確認する。

### 4-4. Steam Deck・実績・クラウド [事実]

**Steam Deck** https://partner.steamgames.com/doc/steamdeck/compat

- 4区分: Verified / Playable / Unsupported / Unknown。
- Verified の要件: **既定の設定で、物理ボタンだけで全コンテンツを操作できる**。使用中の入力に合ったボタン表示。解像度は 1280×800 か 1280×720 を推奨。最小文字 9px（推奨 12px）。800p で 30fps。ランチャーもコントローラーで操作できる。

**実績** https://partner.steamgames.com/doc/features/achievements

- 最初は上限100個。Profile Features の基準を満たすと増やせる（基準の詳細はこのページになく、未確認）。
- アプリがある程度公開されるまで実績は表示されない。

**クラウド** https://partner.steamgames.com/doc/features/cloud

- Steam Auto-Cloud はコードなしで使える。指定したファイルを同期する。
- [推測] Electron の localStorage は内部形式のファイルなので、セーブは自前の JSON に書き出すほうが安全。

### 4-5. HTML5 の包み方

**実例 [事実/抜粋]**

- Vampire Survivors は Phaser（JavaScript）で作られ、2023年のバージョン1.6で Unity に移行した（第三者の記事で確認。Steam ビルドが Electron だったかは裏づけられなかった）。 https://www.summerengine.com/make-great-games/threejs-game-on-steam
- CrossCode は NW.js で発売。Deck では Windows 版を Proton で動かす指定（Valve の Issue で確認）。 https://github.com/ValveSoftware/steam-runtime/issues/585
- Game Dev Tycoon は Greenworks が作られるきっかけの作品（同 summerengine）。
- Cookie Clicker の Steam 版は Electron とされる（Linux 用の第三者ツールの説明による） [抜粋]。 https://github.com/Kesefon/NativeCookie
- Drawize は Electron + Greenworks で Windows 64bit のみに対応。Steam 関連の処理はメインプロセスに置いて IPC で呼ぶ方式。 https://www.drawize.com/blog/tech-how-to-release-html5-game-on-steam
- **Tauri で Steam に出した実例は見つからなかった。**

**分かっている問題 [事実/抜粋]**

- Steam オーバーレイが、一部の環境で表示されない、またはクラッシュの原因になる（Drawize）。
- steamworks.js の Issue に、Electron の窓がソフトウェア描画と判定されてオーバーレイが効かない報告がある [抜粋]。 https://www.github.com/ceifa/steamworks.js/issues/102
- Cookie Clicker が Proton で動かない報告が、Arch Linux のフォーラムに1件ある [抜粋]。 https://bbs.archlinux.org/viewtopic.php?id=306856
- **Steam Deck での WebGL・Canvas の性能測定は見つからなかった。**

**[推測] 選ぶなら Electron。** Chromium を同梱するので環境差が小さい。Tauri は WebView2 の Proton 上での動作を確かめた実例がなく、調べるコストが高い。一筆花火はオーバーレイが無くても遊べるので、「出なくても動く」前提で組む。Deck の実機で 800p・30fps を早めに測る。

### 4-6. 無料のブラウザ版がある場合

**Steam の明文ルールは見つからなかった。** 近い規則として次のものがある。

- Steam キーの他店販売で、Steam の客を不利にしてはいけない。 https://partner.steamgames.com/doc/features/keys
- Early Access の価格は、他サービスより高くしない。 https://partner.steamgames.com/doc/store/earlyaccess
- Next Fest には新規性や独占の要件がない。 https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest

**前例 [事実/抜粋]**

- Cookie Clicker: ブラウザ版は無料のまま、Steam 版は ¥580。全言語 89,111 レビュー、96%。Steam 版は広告なしと紹介されている [抜粋]。 https://www.pcgamesn.com/cookie-clicker/player-count
- Townscaper: 2021年12月に Web 版を**体験版として**公開（Wikipedia）。 https://en.wikipedia.org/wiki/Townscaper
- Vampire Survivors: itch の Web 版は、Steam に比べて体験版のようなものというユーザーの説明がある（公式ではない）。 https://poncle.itch.io/vampire-survivors/comments?before=24
- Mini Metro: 無料の Web 版が広がりと Greenlight 通過に効いたと開発者が述べる。 https://www.gamedeveloper.com/audio/postmortem-dinosaur-polo-club-s-i-mini-metro-i-
- Crayon Physics: 無料の試作の後に有料版。Steam のレビューは 376 件（発売が2009年で、比較は難しい）。
- 「無料の Web 版が売上を減らすか」を示すデータは見つからなかった。

**[推測] 一筆花火の場合。** 今は2ステージとも無料で遊べる。Cookie Clicker はそのまま売れた例だが、放置ゲームという特殊な型で、長年の知名度もある。安全なのは、Steam 発売時に Web 版を「体験版」の範囲に絞り、Steam 版にお守りの大半、追加ステージ、メタ進行を置くこと。公開済みのものを狭めると既存の遊び手に不満が出る可能性があるので、時期と説明は別途考える。

### 4-7. デモと Next Fest

**規則 [事実]** https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest

- **1タイトルにつき1回限り**。ベースゲームのストアページが公開済みで、未発売であること。デモの長さに要件はない。
- デモは別の App ID。独立したストアページを作ると、デモにレビューが付く。実績は無効にしてセーブを Cloud で共有し、製品版で読み込んだ時に付与するのが推奨。 https://partner.steamgames.com/doc/store/application/demos

**次回の日程 [事実]** https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027

- フェス本体: 2027-02-22 〜 03-01
- 登録締切: 2027-01-10
- デモとストアページの審査提出: 2027-01-18（プレスプレビューに出す場合）
- 必要項目の審査提出: 2027-02-01
- 2027年6月の回の日程は確認していない。

**効果の数字 [事実/抜粋]**

- Valve の 2020 年の初回のデータ: 中央値のゲームで、期間中の1日あたりウィッシュリスト追加が開催前2週間より 421% 増。終了後3週間も 15% 増。古い数字で、当時の環境の話。 https://www.gamedeveloper.com/business/steam-demo-showcases-officially-good-for-sales-
- 2024年6月の回（40本の調査）: 獲得ウィッシュリストの中央値は 618。デモを遊んだ人のうち追加する人は平均およそ 20%。 https://howtomarketagame.com/2024/06/24/do-demos-help-earn-wishlists-steam-next-fest-june-2024/
- 2024年10月の回（86本の調査）: 中央値 944。「Next Fest でデモを初公開しないほうがよい」。 https://howtomarketagame.com/?p=4248
- 2026年2月の調査（182人）: 開催前のウィッシュリストと期間中の獲得の相関は 0.825。2,000 以上を推奨 [抜粋・二次]。 https://ziva.sh/blogs/steam-next-fest-2026
- 発売時のウィッシュリストの目安は 5,000 / 8,000 / 50,000 / 90,000 の段階。初週の転換率は 15〜25%（どれも一人の調査者の基準）。 https://howtomarketagame.com/benchmarks/

**Balatro の例**

- 2023年6月の最初のデモはほぼ効果なし。配信者（Northernlion, 2023-07-19）の後にフォロワーが約400%増。2023年10月と2024年2月に Next Fest に参加（Brothers in Gaming の分析を GIGAZINE が要約。原文未確認）。 https://gigazine.net/gsc_news/en/20250207-balatro-successful-launch-strategy
- 現行の規則は1回限りなので、2回参加は再現できない。当時の規則は確認していない。

**[推測] 2027年2月の回は急がない。** 登録まで約2か月しかなく、横画面対応とお守りの増量が間に合うか疑わしい。1回限りの枠なので、先にストアページとデモを公開し、配信者に渡してウィッシュリストを 2,000 まで積んでから、2027年6月か10月を狙うほうがよい。

---

## 5. Steam で500〜2000円で売るなら（すべて [推測]）

公式の基準はない。§1〜§4 の比較作から引いた線で、同じ量を作れば売れるという保証ではない。

### 5-1. 価格帯ごとの比較作 [事実]

| 帯 | 比較作とコンテンツ |
|---|---|
| ¥500〜700 | Vampire Survivors ¥499（抜粋では Early Access 開始時に7キャラ・武器22・ステージ1）、Nubby's ¥580（アイテム50+）、ISLANDERS ¥620、Peggle ¥700（55レベル＋チャレンジ75） |
| ¥1,000〜1,500 | Mini Metro ¥980（都市24+）、Luck be a Landlord ¥1,200（シンボル152・アイテム227）、Ballionaire ¥1,234（トリガー145+・ブーン55+、85%）、Dorfromantik ¥1,420、Baba Is You ¥1,520（200レベル超） |
| ¥1,700〜2,050 | Balatro ¥1,700（ジョーカー150・デッキ15・難度8）、BALL x PIT ¥1,700（ボール60+・建物70+）、Dicey Dungeons ¥1,700、Peglin ¥2,050 |

### 5-2. 最低ライン

| 要素 | ¥780 帯（まず狙う線） | ¥1,200 帯 | ¥1,800 帯 |
|---|---|---|---|
| お守り（ビルドの素） | **50〜60** | 100 前後 | 150 前後 |
| 開始の型（キャラやデッキにあたるもの） | 3〜4 | 6〜8 | 12〜15 |
| 難度の段階 | 5〜8 | 8〜10 | 8 以上に加えチャレンジ |
| ステージ | 3（既存2＋1） | 4 | 4〜5 |
| 実績 | 20〜30 | 40〜60 | 30〜60 |
| 毎日の遊び | 今夜の一筆＋Steam ランキング | 同左 | 同左＋シード共有 |
| 言語 | 日英 | 日英＋主要数言語 | 主要言語（LBaL は20言語） |
| BGM | ステージ別に新曲 | 同左 | 同左＋サントラ検討 |

現状（依頼文とメモから）: 8夜×2ステージ、お守り24種。**¥780 帯でも、お守りを2倍以上にして開始の型と難度の梯子を足す必要がある。** 段位があるので、難度は作り足しやすいはず。

### 5-3. 量より先に要る品質の線

1. **横画面が主役。** 素材が 16:9 で、Deck は 16:10。メモでは PC 横で鳥居が横倒しという未解決の問題がある。縦の UI を引き伸ばすのではなく、横で設計し直す。
2. **広告なし、外部通信の必須なし。** オフラインで最後まで遊べること。ランキングは Steam のものを使えば、自前の Worker が不要になる。
3. **ゲームパッド操作で線を引ける。** Deck の Verified では物理ボタンで全部を操作できることが要る。一筆書きをスティックで気持ちよく引けるかは、この作品にとって大きな設計の課題。Verified が取れなければ Playable でも発売はできる。
4. **最初の2時間で広さが見える。** 返金の境界。1ラン目で「お守りの組み合わせが効く瞬間」を体験させ、2時間以内に新しい型の解放を1つ見せる。
5. **演出の核が3つ揃っている。** 連鎖の音階、点の順次加算、満開の大団円（§3-2）。
6. **ストアで伝わる。** トレーラーの冒頭10秒以内に連鎖と満開を見せる。スクリーンショットはゲーム画面のみ。
7. **文字の読みやすさ。** 1280×800 で最小 9px、推奨 12px。
8. **第三者が却下した理由をつぶす。** メモによれば CrazyGames は「全体の品質が基準に届かない」と却下し、再提出が審査中。この返事の中身は、Steam でも通じる弱点を示している可能性がある。結果を待たず、知らない人に通しで遊んでもらって離脱点を見る。

### 5-4. 平均プレイ時間の現実的な目標

全プレイヤーの平均は比較作でも取れなかったので、取れる指標で書く。

| 指標 | ¥780 帯 | ¥1,200 帯 | 根拠 |
|---|---:|---:|---|
| HLTB メイン（1回クリアまで） | 3〜5h | 5〜8h | Nubby's 3h、Peglin 4.5h、Balatro 8h |
| HLTB メイン＋追加 | 10h 以上 | 15〜25h | Nubby's 10h、Ballionaire 9.5h（低評価側）、LBaL 17.5h |
| レビュー投稿者の平均 | 20〜30h | 30〜60h | Nubby's 26h、Peggle 26h、ISLANDERS 33h、Ballionaire 17h は下限の警告 |
| 2時間以下の投稿の割合 | 10% 未満 | 5% 未満 | Balatro 1%、Nubby's 3%、Ballionaire 16% |

自前で測れる目標（Steam の統計や自前のログで見る）:

- 開始した人の 50% 以上が 2時間を超える（この数字は比較データのない私の提案）。
- 1ランは 15〜30分（比較作の1ラン時間の数値は見つからなかったので、これも私の提案）。

### 5-5. 売上の見通しの置き方

- [事実] 2025年に 1000 レビューへ届いたのは全体の 3%。Zukowski の目安は発売1か月で 250 レビュー。発売時ウィッシュリストの下の段は 5,000。
- [計算例] ウィッシュリスト 5,000 × 初週転換 15〜20% × ¥780 ＝ 売上総額 ¥585,000〜¥780,000（Valve の取り分 30% と税、返金の前）。ここから上は配信者の露出しだい。
- [推測] この規模では専業の収入にならない。**内容を増やす投資を始める前に、ストアページとデモでウィッシュリストの伸びを測る**のが順序として安全。週の獲得が調査の中段（15〜120件 / Silver）にも届かないなら、題材か見せ方を見直す。

---

## 比較作のストアページ

- Balatro https://store.steampowered.com/app/2379780/
- Peglin https://store.steampowered.com/app/1296610/
- Luck be a Landlord https://store.steampowered.com/app/1404850/
- Slay the Spire https://store.steampowered.com/app/646570/
- Vampire Survivors https://store.steampowered.com/app/1794680/
- Dorfromantik https://store.steampowered.com/app/1455840/
- Mini Metro https://store.steampowered.com/app/287980/
- ISLANDERS https://store.steampowered.com/app/1046030/
- Baba Is You https://store.steampowered.com/app/736260/
- Monster Train https://store.steampowered.com/app/1102190/
- Dicey Dungeons https://store.steampowered.com/app/861540/
- Ballionaire https://store.steampowered.com/app/2667120/
- Nubby's Number Factory https://store.steampowered.com/app/3191030/
- BALL x PIT https://store.steampowered.com/app/2062430/
- Peggle Deluxe https://store.steampowered.com/app/3480/
- World of Goo https://store.steampowered.com/app/22000/
- World of Goo 2 https://store.steampowered.com/app/3385670/
- Crayon Physics Deluxe https://store.steampowered.com/app/26900/
- Poly Bridge https://store.steampowered.com/app/367450/
- Poly Bridge 2 https://store.steampowered.com/app/1062160/
- Mini Motorways https://store.steampowered.com/app/1127500/
- Roundguard https://store.steampowered.com/app/848030/
- holedown https://store.steampowered.com/app/1268370/
- Bridge Constructor https://store.steampowered.com/app/250460/
- Unium https://store.steampowered.com/app/357600/
- One Line https://store.steampowered.com/app/1820690/
- One Line Coloring https://store.steampowered.com/app/1367420/
- Fireworks Mania https://store.steampowered.com/app/1079260/
- Townscaper https://store.steampowered.com/app/1291340/
- Cookie Clicker https://store.steampowered.com/app/1454400/

## その他の出典

- Peglin のクラス・Cruciball [抜粋] https://pcgamer.com/games/goblin-pachinko-roguelike-peglin-is-finished-complete-with-some-clutch-reworks 、オーブと遺物の数 [抜粋] https://bloxodes.com/wiki/peglin/orbs 、https://bloxodes.com/wiki/peglin/relics
- Vampire Survivors の内容数 [抜粋・本文未確認] https://www.pcgamer.com/vampire-survivors-will-get-9-more-characters-5-new-stages-and-16-new-weapons-before-release 、https://gamegrin.com/news/indie-hit-vampire-survivors-is-coming-out-today
- Wikipedia: https://en.wikipedia.org/wiki/Balatro 、https://en.wikipedia.org/wiki/Peglin 、https://en.wikipedia.org/wiki/Slay_the_Spire 、https://en.wikipedia.org/wiki/Vampire_Survivors 、https://en.wikipedia.org/wiki/Mini_Metro_(video_game) 、https://en.wikipedia.org/wiki/Islanders_(video_game) 、https://en.wikipedia.org/wiki/Crayon_Physics_Deluxe
- Early Access の規則 https://partner.steamgames.com/doc/store/earlyaccess
