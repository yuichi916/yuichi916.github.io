// 試合: 2つの盤と攻撃のやりとりを固定刻みで進める。盤の派の違いはここでは扱わない。
import { createTsunagu } from './tsunagu.js';
import { createNaraberu } from './naraberu.js';
import { sendAttack, landTsunagu, landNaraberu } from './damage.js';

export function createMatch({ cfg, kinds, seeds, handicap = [0, 0] }) {
  const M = {
    cfg,
    frame: 0,
    result: null,
    players: [],
    feverMul,
    attackMul,
    applyAttack,
    step,
  };

  for (let p = 0; p < 2; p++) {
    const pending = { D: 0, age: 0 };
    const make = kinds[p] === 'tsunagu' ? createTsunagu : createNaraberu;
    const take = kinds[p] === 'tsunagu' ? () => landTsunagu(pending, cfg) : () => landNaraberu(pending, cfg);
    M.players.push({ kind: kinds[p], pending, sent: 0, board: make({ cfg, seed: seeds[p], takeGarbage: take }) });
  }

  function feverMul() {
    const t = M.frame / 60;
    if (t < cfg.openingSec) return cfg.openingMul + (1 - cfg.openingMul) * (t / cfg.openingSec);
    if (t < cfg.feverStartSec) return 1;
    const steps = Math.floor((t - cfg.feverStartSec) / cfg.feverStepSec) + 1;
    return Math.min(cfg.feverMaxMul, 1 + steps * cfg.feverStepMul);
  }

  function attackMul(p) {
    return feverMul() * (1 + cfg.handicapStep * handicap[p]);
  }

  function applyAttack(p, D) {
    const me = M.players[p], opp = M.players[1 - p];
    const rest = sendAttack(D, me.pending, opp.pending, cfg);
    me.sent += rest;
    return rest;
  }

  function step(inputs) {
    if (M.result) return [];
    M.frame++;
    const out = [];
    for (let p = 0; p < 2; p++) {
      const pl = M.players[p];
      if (pl.pending.D > 0) pl.pending.age++;
      for (const e of pl.board.step(inputs[p])) {
        e.p = p;
        if (e.type === 'attack') {
          e.D *= attackMul(p);
          e.sent = applyAttack(p, e.D);
        }
        out.push(e);
      }
    }
    const d0 = M.players[0].board.isDead(), d1 = M.players[1].board.isDead();
    if (d0 || d1) M.result = { winner: d0 && d1 ? -1 : d0 ? 1 : 0, frames: M.frame };
    else if (M.frame >= cfg.maxFrames) M.result = { winner: -1, frames: M.frame };
    return out;
  }

  return M;
}
