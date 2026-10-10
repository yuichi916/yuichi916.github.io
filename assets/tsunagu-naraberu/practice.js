// 練習モード: 自分の盤だけを進める。試合（match.js）と同じ形のオブジェクトを返すので、描画と入力はそのまま使える。
// 相手はいない。おじゃまは「おじゃまを降らせる」ボタンで落とす。盤が詰まったら、その場で新しい盤にする。
import { createTsunagu } from './tsunagu.js';
import { createNaraberu } from './naraberu.js';
import { landTsunagu, landNaraberu } from './damage.js';

export function createPractice({ cfg, kind, seed }) {
  const pending = { D: 0, age: 0 };
  let resets = 0;
  const make = () => (kind === 'tsunagu'
    ? createTsunagu({ cfg, seed: seed + resets * 7919, takeGarbage: () => landTsunagu(pending, cfg) })
    : createNaraberu({ cfg, seed: seed + resets * 7919, takeGarbage: () => landNaraberu(pending, cfg) }));
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
    // n: 受ける側の単位（つなぐ派=おじゃまつぶの数、ならべる派=マス）
    dropGarbage(n) {
      pending.D += n / (kind === 'tsunagu' ? cfg.convT : cfg.convN);
      pending.age = 1e9; // 練習では予告の待ちなしで落とす
    },
  };

  function resetBoard() {
    resets++;
    pending.D = 0; pending.age = 0;
    pl.board = make();
  }

  function step(inputs) {
    P.frame++;
    const out = [];
    for (const e of pl.board.step(inputs[0])) {
      e.p = 0;
      if (e.type === 'attack') pl.sent += e.D;
      out.push(e);
    }
    if (pl.board.isDead()) { resetBoard(); out.push({ type: 'reset', p: 0 }); }
    return out;
  }

  return P;
}
