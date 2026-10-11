# 『つなぐ×ならべる』クオリティアップ 第4部: バランス 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** CPUを5段（かんたん・やさしい・ふつう・つよい・おに）にし、仕様4章の目標を満たすよう調整する。

**Spec:** `docs/superpowers/specs/2026-10-10-tsunagu-naraberu-quality-up-design.md`（4章）

## 目標（仕様4章）
- 各段: つなぐ派の勝率 45〜55%（2000試合）
- 同じ派どうし（ミラー）の1P勝率が 50% 付近
- 開幕20秒以内の決着: 全段で5%未満
- 平均試合時間: かんたん〜ふつうは 2.5〜4分、つよい・おには 1.5分以上
- 段の並び: 隣の段どうしで、上の段が 65% 以上勝つ（派の組み合わせは4通りを均等に）

## Task 1: 測定ツールを広げる（balance.mjs）
- `playOne` を、プレイヤーごとの段（levels: [a, b]）に対応させる
- 出力に「20秒以内の決着の割合」を足す
- `--ladder`: 隣の段どうしの勝率を出す（上の段の勝率、Wilson 95%）
- 試合時間の分布（10%・中央・90%）は今のまま

## Task 2: 5段にする（config.js）
- LEVELS に かんたん・おに を足す。段ごとの CPU の重み（AI_T/AI_N の noise・minChain・raiseBelow）も足す
- 画面: キャラ選択の「CPUの強さ」を5つに。戦績の段の表も5つに（LEVELS から作るので自動）

## Task 3: 調整
- 早い決着: 開幕のウォームアップ（openingSec / openingMul）
- 試合時間: 攻撃全体の大きさ（convT と convN を同じ比率で）
- 段ごとの五分: 段ごとの CPU の重み
- 段の並び: 段ごとの速さ（act/think）と読みの深さ
- 結果は `docs/tsunagu-naraberu-balance.md` に残す

## Task 4: 確認
- テスト全件、CPU対CPU が全段・全組み合わせで完走（ai.test の対象を5段に）
- 実画面: キャラ選択で5段が選べ、戦績の表に5段が出る
- 公開の可否をうかがう
