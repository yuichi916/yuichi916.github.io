// 『つなぐ×ならべる』の調整つまみ。バランスはここだけを直す。
// 値の決め方と測定結果: docs/tsunagu-naraberu-balance.md
export const CFG = {
  // 盤
  W: 6,
  H: 12,
  colorsT: 4, // つなぐ派の色数（このジャンルの標準。5色だとCPUも人も盤が散らかって詰む）
  colorsN: 5, // ならべる派の色数

  // 変換率（共通ダメージD → 受ける側のおじゃま）
  convT: 0.95, // ならべる派の攻撃 → つなぐ派のおじゃまつぶ
  convN: 0.22, // つなぐ派の攻撃 → ならべる派のおじゃまブロック（マス）

  // 攻撃力
  atkMulT: 1.0,
  atkMulN: 1.0,
  chainStepN: 6, // ならべる派: 連鎖1段ごとのD
  CP: [0, 0, 8, 16, 32, 64, 96, 128, 160], // つなぐ派: 連鎖ボーナス（添字=連鎖段、以降+32）

  // つなぐ派の時間
  tsunaguFallSec: 0.5,
  tsunaguSoftFrames: 2,
  tsunaguPopSec: 0.5,
  tsunaguGarbageFrames: 20,
  tsunaguMaxGarbage: 30,
  tsunaguLandSec: 3, // 予告が出てから降るまでの待ち（ならべる派の naraberuLandSec と同じ。少量が降り続けて形を崩されないように）

  // ならべる派の時間
  naraberuRiseStartSec: 8,
  naraberuRiseEndSec: 3,
  naraberuRiseRampSec: 180,
  naraberuManualRiseFrames: 6,
  // ならべる派の消去: 光る → 驚いた顔 → 1枚ずつはじける（刻み）。消え終わるまで 光る＋顔＋枚数×1枚
  naraberuClearFlash: 40,
  naraberuClearFace: 14,
  naraberuClearPop: 9,
  naraberuLandSec: 3,
  naraberuStartRows: 4,
  topGraceSec: 3, // 天井に着いてから負けるまで（消去・浮遊・落下・停止時間の間は減らない）
  naraberuHoverFrames: 12, // 消えたあと上のパネルが浮いている刻み（アクティブ連鎖の受け止めどき）
  naraberuSwapHoverFrames: 3, // 入れ替えで宙に出たパネルが浮く刻み
  naraberuStopCombo: 60, // 4つ同時消しでもらえる停止時間（刻み）
  naraberuStopComboPer: 10, // 5つ以上は1つごとに追加
  naraberuStopChain: 60, // 連鎖1段ごとの停止時間（刻み）

  // 開幕のウォームアップ: 攻撃倍率が openingMul から openingSec 秒かけて1.0へ
  // （ならべる派は積まれた盤で始まり、つなぐ派は空の盤で始まる差を埋める）
  openingSec: 60,
  openingMul: 0.05,

  // 終盤加速
  feverStartSec: 90,
  feverStepSec: 15,
  feverStepMul: 0.1,
  feverMaxMul: 2.0,

  // 試合打ち切り（引き分け）
  maxFrames: 36000,

  // ハンデ1段あたりの攻撃倍率
  handicapStep: 0.2,
};

// CPUの評価の重み
export const AI_T = {
  fireBig: 30, // 大連鎖(minChain以上)の発火: D あたり
  fireSmall: 1, // 小さい発火: D あたり
  fireDanger: 60, // 危険時(予告が多い/盤が高い)の発火: D あたり
  dangerFree: 0.4, // 予告が空きマスのこの割合を超えたら危険
  dangerHeight: 8,
  conn: 2, // 同色の隣接1組あたり
  pot: 6, // 1つ足したら起きる連鎖数^2 あたり
  high: 4, // 高さ6超の2乗あたり
  bump: 1, // 凸凹
  col3: 300, // 出現列が9段以上
  urgentCol3: 8, // 出現列がこの高さ以上なら、考える間を置かず横移動を先にする
  // 段の設定（LEVELS の act・think・depth・lookahead）を、つなぐ派CPUだけ上書きする（人が相手のときの難しさを派ごとに合わせる）
  speed: { かんたん: {}, やさしい: {}, ふつう: { act: 12, think: 31 }, つよい: {}, おに: {} },
  garbage: 0.5,
  noise: { かんたん: 4, やさしい: 1, ふつう: 2, つよい: 2, おに: 2 },
  minChain: { かんたん: 1, やさしい: 2, ふつう: 2, つよい: 3, おに: 3 },
  // CPUの攻撃補正（人が操作する側にはかからない）。段ごとに両派のCPUの強さを揃える
  atk: { かんたん: 1.15, やさしい: 1.45, ふつう: 1, つよい: 1.2, おに: 1.05 },
};
export const AI_N = {
  D: 20,
  clear: 1.5,
  chain: 15,
  thaw: 3,
  smallClear: 0.3, // 見込みを育てる段階の小さい消し（1マスあたり）
  pot: 5, // 次の1手で起こせる連鎖数^2 あたり（2連鎖以上のみ）
  topK: 25, // 見込み・2手目を調べる候補数
  high: 6, // 高さ6超の2乗あたり
  dist: 0.15, // カーソルからの距離
  pair: 0.4, // 同色の隣り合い（仕込み）
  second: 0.7, // 2手目の重み
  dangerHeight: 9,
  dangerPending: 6,
  raiseBelow: { かんたん: 4, やさしい: 5, ふつう: 6, つよい: 7, おに: 7 },
  raiseIdle: 8, // 良い入れ替えがないときは、この高さ未満までせり上げて材料を出す
  // 段の速さ（LEVELS の act・think）を、ならべる派CPUだけ上書きする（弱い段ほど手が遅い）
  speed: { かんたん: { act: 36, think: 50 }, やさしい: { act: 22, think: 56 }, ふつう: { act: 20, think: 50, lookahead: false }, つよい: { act: 8, think: 22 }, おに: { act: 6, think: 15 } },
  prepTol: 2, // それ以上せり上げられないときは、評価がこれ以上は下がらない入れ替え（形を整える手）を打つ
  noise: { かんたん: 20, やさしい: 12, ふつう: 14, つよい: 6, おに: 2 },
  minChain: { かんたん: 1, やさしい: 1, ふつう: 2, つよい: 2, おに: 2 },
  // CPUの攻撃補正（人が操作する側にはかからない）。段ごとに両派のCPUの強さを揃える
  atk: { かんたん: 0.6, やさしい: 1.1, ふつう: 1, つよい: 1, おに: 1 },
};

// CPUの攻撃補正（その派・その段）
export function cpuAtkOf(kind, level) {
  return (kind === 'tsunagu' ? AI_T : AI_N).atk[level] ?? 1;
}

// CPUの段。act=1操作ごとの待ち刻み、think=考え始めるまでの刻み
export const LEVELS = {
  かんたん: { depth: 1, act: 22, think: 50, lookahead: false },
  やさしい: { depth: 1, act: 14, think: 36, lookahead: false },
  ふつう: { depth: 1, act: 8, think: 20, lookahead: true },
  つよい: { depth: 2, act: 6, think: 16, lookahead: true },
  おに: { depth: 2, act: 4, think: 10, lookahead: true },
};
