# AIエージェント能力アトラス — 設計書

日付: 2026-09-06 ／ 対象: `ai-map.html`（https://yuichi916.github.io/ai-map.html）＋ `data/ai-map.json`
分類: Architectural（新規ページ＋データ基盤）。図解方式の選定はユーザーから委任。

## 0. 目的
「2026年9月時点でAIエージェントに何ができ、何ができず、いつできるようになりそうか」を、
ベンチマークスコアではなく**具体的タスク単位**で、専門家との比較・根拠つきで、
MECEな階層と時間軸をもつ一枚の図解にする。誰もが指針にできる master を作り、
以後は動画・note・サイト内作品へのリンクの起点（ハブ）として運用する。

中心命題（ページの冒頭に置く）:
> 問題設定と input/output の定義ができれば、AIエージェントとの壁打ちでほとんどの分野の問題は解ける。
> ただし「解ける」の中身は領域ごとに違い、モデルの世代で海岸線が動く。この地図はその海岸線の記録である。

## 1. データモデル（`data/ai-map.json`）
```
meta: { asof:"2026-09-06", version, level_defs[6], timepoints[8] }
domains[8]: { id, name, name_en, color, summary, areas[5-9]: { id, name, name_en, tasks[4-8]: Task } }
Task: { id, name, name_en, levels:{2022,2023,2024,2025,2026,2027e,2028e,2030e},
        vs_expert, can, cannot, why, autonomy(copilot|agent|autonomous), tools[],
        evidence[{title,url,date,note}], forecast_basis, site_examples[{title,url,kind}] }
models: { milestones[], metrics[], forecasts[], eras[] }
```
- レベル 0〜5: できない／デモ止まり／補助／実務品質(要確認)／専門家並み／専門家超え
- 時点: 2022, 2023, 2024, 2025, 2026(=現在), 2027e, 2028e, 2030e。予測には forecast_basis 必須
- 8領域(L1): content / dev / research / business / professional / physical / personal / foundation
  - foundation は横断的な「基盤能力」。他7領域は出力の種類で分割（MECE）

## 2. 画面
1. **導入**: 命題、凡例（6段階の色）、現在の要約数値（タスク総数、lv≥4 の割合、lv≤1 の割合）
2. **領土図（Atlas）**: d3 treemap の入れ子（領域→中分類→タスク）。セル色＝選択時点のレベル。
   年スライダー（8時点、再生ボタンで自動送り）。その時点で上がったセルに縁取り（「この年に上陸」）。
   ホバーでツールチップ、クリックで詳細パネル。領域クリックでズーム。
3. **年表ヒートマップ（Timeline）**: 行＝タスク（領域・中分類で折りたたみ）、列＝8時点、色＝レベル。
   横スクロール、ヘッダー固定。並び替え（伸び幅／現在値）。検索。
4. **モデル進化（Evolution）**: 時代区分の帯＋主要マイルストーン縦年表＋指標折れ線
   （METR time horizon は対数軸、SWE-bench 等）。予測は点線で区別。
5. **詳細パネル**: レベル推移スパークライン、vs_expert、できる／できない／理由、運用形態、ツール、
   根拠リンク、予測根拠、サイト内の実例（作品・動画・記事）
6. **使い方（How to use）**: 「問題設定→I/O定義→壁打ち」の型、レベル別の人の役割

## 3. 技術
- 単一 HTML + JSON（fetch）。d3 v7 を cdnjs から読み込み。依存はそれだけ。
- 配色はサイト共通（paper #f4f0e6 / ink #161510 / accent #c43d2a）。レベル色は 6段階の連続スケール。
- モバイル: treemap は幅にフィット、年表は横スクロール、詳細はボトムシート。
- 計測: GoatCounter（`aimap.open_task` `aimap.year` `aimap.view`）。
- テスト: JSON スキーマ検査スクリプト（id 一意、levels 8キー、evidence≥1、単調性の警告）＋ Playwright でレンダリング確認。

## 4. 運用
- データは JSON のみ更新すれば図が変わる。月1回の更新を想定（meta.asof を進める）。
- 動画・note は各タスク id をアンカー（`#task=dev.new.prototype`）にして相互リンク。
