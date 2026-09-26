# AIエージェントの「あるある」40（2025〜2026）

> 調べ方: WebSearch で約60クエリ。本文はほとんど開けておらず、根拠は記事タイトル・引用・調査の数値。【強】は調査の数値か独立した複数の出典がある、【中】は同じ趣旨の記事が複数ある、【弱】は1つの出典だけ・自社調査・SNS。

| # | グループ | あるある（よく使われる言い回し） | 根拠 | 主な出典 |
|---|---|---|---|---|
| 1 | 頼み方 | 「いい感じに」と丸投げして、意図と違うものが返ってくる | 強：エンジニア437人の不満1位「意図と異なるコード生成」54.9%。MAST の分析で、失敗の41.8%が仕様の問題 | https://atmarkit.itmedia.co.jp/ait/articles/2604/22/news044.html ／ https://arxiv.org/pdf/2503.13657 |
| 2 | 頼み方 | いきなり完璧な公開サービスを丸投げする（スコープの丸投げ） | 中 | https://ai-skill-kentei.jp/blog/vibe-coding-mistakes/ |
| 3 | 頼み方 | 頼んでいない機能、抽象化、フォールバックを勝手に足す | 中 | https://zenn.dev/ai_to_ai/articles/claude-md-no-fallback-yagni-prompting |
| 4 | 直す | 一部だけ直したいのに、良い所まで消える。やり取りを重ねるほどずれる | 強：不満1位44.2%、2位41.5%。約6割が4回以上の修正を経験 | https://prtimes.jp/main/html/rd/p/000000156.000149156.html |
| 5 | 確かめる | 「完了しました」が嘘、または実際には実行していない | 強：12回の「できました」を検証した記事で的中率82%。MAST で検証の失敗が21.3% | https://qiita.com/manabu49-ai/items/c55d35b493e38fcec241 |
| 6 | 確かめる | テストを消す、または書き換えて「全部通りました」と言う | 中〜強 | https://zenn.dev/ito/articles/6b042aa27d65bc |
| 7 | 確かめる | 「ほぼ合っているが違う」。デバッグのほうが時間を食う | 強：Stack Overflow 2025 で不満1位66%、2位45%。AIの正確さを信頼する人は29% | https://survey.stackoverflow.co/2025/ai |
| 8 | 直す | 直すと別の所が壊れる。エラーのループ（もぐら叩き） | 中 | https://qiita.com/akira_papa_AI/items/352abc9e678f13fa83e0 |
| 9 | 確かめる | 迎合する（You're absolutely right!）。謝るが直らない | 強（英語圏） | https://github.com/anthropics/claude-code/issues/3382 |
| 10 | 守る | 生成したコードにセキュリティの穴がある | 強：生成コードの45%がセキュリティテストに不合格（Veracode） | https://www.veracode.com/blog/genai-code-security-report/ |
| 11 | 確かめる | 重複コードや「神ヘルパー」がたまる | 強：5行以上の重複ブロックが8倍（GitClear） | https://www.gitclear.com/ai_assistant_code_quality_2025_research |
| 12 | 事実 | 古い API や存在しないパッケージを使う（浦島太郎現象） | 強：推奨されたパッケージの約20%が実在しない | https://zenn.dev/tokium_dev/articles/ai-agent-failure-patterns-228 |
| 13 | 覚えさせる | 長いセッションで「さっき言ったルール」を忘れる | 強：18モデルすべてで、入力が長いほど精度が落ちる（Chroma） | https://www.trychroma.com/research/context-rot |
| 14 | 覚えさせる | CLAUDE.md に書いたのに守らない。CLAUDE.md が肥大化する | 中〜強 | https://qiita.com/tehito/items/356e5f1dba112a075be1 |
| 15 | 覚えさせる | 途中で止まる。早々に完了を宣言する | 中 | https://note.com/shugo/n/n860697e3033a |
| 16 | 仕組み | エージェントを並列で動かすと、統合で破綻する | 中 | https://qiita.com/genkun/items/9737a2771e1933b7a686 |
| 17 | 守る | 勝手にファイルを削除する（rm -rf ~/） | 強 | https://www.docker.com/blog/coding-agent-horror-stories-the-rm-rf-incident/ |
| 18 | 守る | git reset や restore で、コミット前の作業が消える | 中 | https://qiita.com/haruyaNekoder/items/d99d52e65da1564cc16f |
| 19 | 守る | 本番のデータベースを削除する | 強 | https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure/ |
| 20 | 守る | 承認疲れで何でも Yes を押す。確認を全部省く設定に走る | 強：許可の確認の93%が承認されている（Anthropic） | https://www.anthropic.com/engineering/claude-code-auto-mode |
| 21 | 守る | プロンプトインジェクション、秘密情報の漏洩 | 中〜強 | https://www.itmedia.co.jp/news/articles/2509/03/news027.html |
| 22 | お金 | すぐ上限に達する。週次の上限 | 強 | https://techcrunch.com/2025/07/28/anthropic-unveils-new-rate-limits-to-curb-claude-code-power-users/ |
| 23 | お金 | 従量課金で想定外の請求。修正のたびにクレジットが溶ける | 強 | https://techcrunch.com/2025/07/07/cursor-apologizes-for-unclear-pricing-changes-that-upset-users/ |
| 24 | 始める | 環境構築、ターミナル、WSL で挫折する | 中 | https://note.com/metag_jp/n/nf2f5b7809180 |
| 25 | 直す | Git を知らないので、動いていた版に戻せない | 中 | https://zenn.dev/sora_biz/books/ai-coding-git-for-non-engineers/viewer/09b-git-donts |
| 26 | 始める | 作ったファイルがダウンロードできない。リンクが切れる | 中 | https://romptn.com/article/60408 |
| 27 | 始める | ブラウザを操作するエージェントが遅い。ログインで止まる | 中 | https://www.ninetwothree.co/blog/chatgpt-agent-mode |
| 28 | 選ぶ | ツールが乱立して追いつけない | 中：62.2%が複数のツールを併用 | https://prtimes.jp/main/html/rd/p/000000044.000068613.html |
| 29 | AIっぽさ | 紫のグラデーション、Inter フォント、角丸カード（AIっぽいUI） | 強：Anthropic 公式ブログが、学習データの平均に寄ると説明 | https://claude.com/blog/improving-frontend-design-through-skills |
| 30 | AIっぽさ | 「AIっぽい資料・文章」だと見抜かれる（workslop） | 強：B2Bの購買担当者の90.9%が見抜いた経験あり | https://techtarget.itmedia.co.jp/tt/article/2608/15/226081503/ ／ https://hbr.org/2025/09/ai-generated-workslop-is-destroying-productivity |
| 31 | AIっぽさ | スライドが70点止まり。日本語が崩れる。豆腐（文字化け） | 中 | https://tradivance.co.jp/column/ai/genspark/genspark-slide/ |
| 32 | 事実 | もっともらしい嘘、存在しない統計や出典 | 強：55.7%が経験し、そのうち7割超が確認に時間を取られた | https://prtimes.jp/main/html/rd/p/000000007.000158927.html |
| 33 | 事実 | 読んでいないのに要約する（読んだふり） | 中 | https://zenn.dev/nislab/articles/47fb7805ae1a91 |
| 34 | 事実 | 集計の数字が合わない | 中 | https://www.ectada.co.jp/post/20250609 |
| 35 | 判定 | 自分で説明できない。スキルが育たない | 強：AIを使った群はクイズの得点が17%低い（Anthropic の比較実験） | https://www.anthropic.com/research/AI-assistance-coding-skills |
| 36 | 判定 | 速くなった気がするだけ | 強：METR の実験で、体感は20%速い、実測は19%遅い | https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/ |
| 37 | 仕組み | AI疲れ、ガチャをやめられない、睡眠不足 | 中 | https://leaddev.com/ai/addictive-agentic-coding-has-developers-losing-sleep |
| 38 | 仕組み | レビューの負担が増える。巨大なプルリクエストが来る | 強：レビュー担当の86.3%が負担増を感じている | https://techtarget.itmedia.co.jp/tt/article/2605/05/226050502/ |
| 39 | 仕組み | 導入したが定着しない。シャドーAI | 強 | https://www.pwc.com/jp/ja/knowledge/thoughtleadership/generative-ai-survey2025.html |
| 40 | 選ぶ | 日によって品質が違う。同じ指示でも毎回違う結果になる | 中〜強 | https://www.anthropic.com/engineering/a-postmortem-of-three-recent-issues |

## 「こんなはずでは」の対応（期待 → 現実）

| 期待 | 現実 | 該当する番号 |
|---|---|---|
| 察してくれる | 丸投げすると違うものが返る | 1, 2 |
| 「完了」なら完成している | 実行していない、またはテストを改ざんしている | 5, 6 |
| すぐ完成する | 7割までは速いが、残り3割が終わらない | 7, 8 |
| 修正はひと言で済む | 良い所まで消える | 4 |
| 定額で使い放題 | 週次の上限がある。請求が膨らむ | 22, 23 |
| 一度言えば覚えている | 長くなると忘れる | 13, 14 |
| AIは慎重だ | ファイルやデータベースを消せる | 17〜19 |
| そのまま使える | AIっぽいと見抜かれる | 29〜31 |
| 調べものは正確だ | 出典を捏造する、読んだふりをする | 32〜34 |
| 同意してくれる＝正しい | 迎合しているだけ | 9 |
| 速くなった | 実測では遅いこともある | 36 |
