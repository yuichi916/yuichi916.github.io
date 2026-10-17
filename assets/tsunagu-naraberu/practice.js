// 練習モード: 自分の盤だけを進める。試合（match.js）と同じ形のオブジェクトを返すので、描画と入力はそのまま使える。
// 相手はいない。おじゃまは「おじゃまを降らせる」ボタンで落とす。盤が詰まったら、その場で新しい盤にする。
import { createTsunagu } from './tsunagu.js';
import { createNaraberu } from './naraberu.js';
import { landTsunagu, landNaraberu, addPending } from './damage.js';

// setup(board): チュートリアルの課題の盤面を用意する（やり直し・詰まったときにも毎回かける）
// pending: 始めから出しておく予告（受ける側の単位: つなぐ派=おじゃまつぶ、ならべる派=マス）。相殺の練習用
export function createPractice({ cfg, kind, seed, setup = null, pending: start = 0 }) {
  const conv = kind === 'tsunagu' ? cfg.convT : cfg.convN;
  const startD = start / conv;
  const pending = { D: startD, age: 0, kind };
  let resets = 0;
  const make = () => {
    const b = kind === 'tsunagu'
      ? createTsunagu({ cfg, seed: seed + resets * 7919, takeGarbage: () => landTsunagu(pending, cfg) })
      : createNaraberu({ cfg, seed: seed + resets * 7919, takeGarbage: () => landNaraberu(pending, cfg) });
    if (setup) {
      if (kind === 'tsunagu') b.step({ left: false, right: false, up: false, down: false, a: false, b: false, downHeld: false, bHeld: false }); // 最初の組を出してから
      setup(b);
    }
    return b;
  };
  const pl = { kind, pending, sent: 0, board: make() };

  const P = {
    cfg,
    practice: true,
    frame: 0,
    result: null,
    players: [pl],
    feverMul: () => 1,
    attackMul: () => 1,
    step,
    resetBoard,
    get resets() { return resets; }, // 盤を作り直した回数（演出が点数などを数え直すため）
    // n: 受ける側の単位（つなぐ派=おじゃまつぶの数、ならべる派=マス）
    // 試合と同じく予告に足す（3秒の待ちのあとで降る。その間に消して打ち消す＝相殺の練習になる）
    dropGarbage(n) {
      addPending(pending, n / conv, cfg);
    },
  };

  function resetBoard() {
    resets++;
    pending.D = startD; pending.age = 0; // 作り直したら最初の予告に戻す（ふつうの練習は0）
    pl.board = make();
  }

  function step(inputs) {
    P.frame++;
    const out = [];
    if (pending.D > 0) pending.age++;
    for (const e of pl.board.step(inputs[0])) {
      e.p = 0;
      if (e.type === 'attack') {
        // 相手はいないが、自分の予告は試合と同じく打ち消せる（相殺）
        e.offset = Math.min(e.D, pending.D);
        pending.D -= e.offset;
        e.sent = e.D - e.offset;
        pl.sent += e.sent;
      }
      out.push(e);
    }
    if (pl.board.isDead()) { resetBoard(); out.push({ type: 'reset', p: 0 }); }
    return out;
  }

  return P;
}
