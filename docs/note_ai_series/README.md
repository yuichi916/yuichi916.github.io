# 連載「AIエージェントで、ひとりがスタジオになる」

**書く前に必ず [WRITING_RULES.md](WRITING_RULES.md) を見る（最初に細かい数字を出さない）。**

最新の軸は [04_concept_world.md](04_concept_world.md)（プロ＝自分だけの世界を築き・壊し・乗りこなす人）と、その掘り下げ [05_story_and_material.md](05_story_and_material.md)。01〜03 は古い案なので、そのまま使わない。

| ファイル | 中身 | 状態 |
|---|---|---|
| [01_differentiation.md](01_differentiation.md) | 差別化のまとめ（noteの型で）：読者の興味 → 読まなかったときの損失 → 読んだときの利益 → なぜこの連載でないといけないか（直したコミット287件の数字つき）→ 各回への反映 | 完成 |
| [research/note_style.md](research/note_style.md) | 人気noteの文体とAIっぽく見える書き方、図の作り方（出典つき） | 調査 |
| [figures/](figures/) | 記事の図（PNG）と作り方（src/ の HTML。フォントは Google Fonts の Klee One・Zen Maru Gothic を src/fonts/ に置いて描画。git には入れない） | — |
| [research/fix_analysis.md](research/fix_analysis.md) | 直したコミット287件の分類の要約（全件は fix_classified.tsv） | 調査 |
| [ep00_pro_is_not_prompt.md](ep00_pro_is_not_prompt.md) | **#00（無料）プロは、プロンプトがうまい人ではなかった**。人気noteの書き方に合わせて改稿（約1,700字・見出し5・図5・太字1）。図は figures/、スマホでの見え方は preview/ep00_phone.png | 第2稿 |
| [04_concept_world.md](04_concept_world.md) | **最新の軸**：プロはテクニックではなく、自分だけの世界を持つ人。築く・壊す・乗りこなすの三本柱、noteの型、全11回と道具箱、#00の書き出し | 完成 |
| [05_story_and_material.md](05_story_and_material.md) | **最新の軸の掘り下げ**：主張の筋道、写真と絵画のたとえ、読者の変化の道のり、各回の題材（研究ノートの原文つき）、反論と答え、#00の運び | 完成 |
| [03_concept_success.md](03_concept_success.md) | 古い案：失敗ではなく「ひとりでできるようになったこと」を主役にする。芯の一言、noteの型（興味・損失・利益・独自性）、成果が主役の全11回、#00の書き出し見本 | 完成 |
| [02_voice_and_angles.md](02_voice_and_angles.md) | 一般の読者に刺さる切り口と言い回し：芯の一言（受け取る力／AIのミスは音を立てない）、切り口5つ、言い換え辞書、各回のタイトル、#00の書き出し見本、やめる言い回し | 完成 |
| [00_series_plan.md](00_series_plan.md) | 企画書：コンセプト、形式・価格・更新の決め方と根拠、全11回の構成、各回の型、Xでの運用 | 完成 |
| [ep00_free_textbook.md](ep00_free_textbook.md) | #00（無料・毎月改訂）AIエージェントのプロになる教科書【2026年9月版】 | 初稿 |
| [ep01_omotteta_to_chigau.md](ep01_omotteta_to_chigau.md) | #01（有料）Claude Codeに頼んだのに「思ってたのと違う」をなくす | 初稿 |
| [../note_ai_era/02_paid_article.md](../note_ai_era/02_paid_article.md) | #04（有料）Claude Codeの「確認疲れ」を減らす（既存の記事を連載に組み込む） | ほぼ完成 |
| [research/latest_2026-09.md](research/latest_2026-09.md) | AIエージェントの現在地（Opus 5.5・GPT-6・Cowork統合・事故・公式の推奨） | 調査 |
| [research/aruaru_40.md](research/aruaru_40.md) | あるある40件（根拠の強さ・出典つき）と「こんなはずでは」の対応 | 調査 |
| [research/note_series_patterns.md](research/note_series_patterns.md) | noteの有料連載・メンバーシップの傾向 | 調査 |

## 公開前にやること
1. 本文の「要確認」のHTMLコメントの箇所を、公式ページで確かめる（Opus 5.5 の既定モデル・Free で使えないこと・effort の既定・Cowork の統合など）。
2. 調査の数値は、検索のスニペットから拾ったもの。本文で使っている数値（54.9%、41.8%、21.3%、66%、44.2%、90.9%）は、出典の原文を開いて確かめる。
3. 有料部分を GitHub Pages に置いたままにしない（`docs/` は公開されている）。
