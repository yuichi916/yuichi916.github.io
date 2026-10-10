// あそびかた（チュートリアル）: 派ごとに、用意した盤面で課題を出し、できたら次へ進む。
// 各課題: {title, text, cfg?, setup(board), goal(board, events)}。events は課題を始めてからの出来事。
import { emptyGrid } from './tsunagu.js';
import { fillFromRows, BOTTOM, COLS } from './naraberu.js';

const R = 1, G = 2, B = 3, GARB = 6;
const T = s => [...s].map(ch => ({ '.': 0, R, G, B, Y: 4, P: 5, O: GARB }[ch]));
function tsGrid(rows) { // 下詰め（最後の文字列が y=12）
  const g = emptyGrid();
  rows.forEach((r, k) => { g[13 - rows.length + k] = T(r); });
  return g;
}
const has = (ev, type, f = () => true) => ev.some(e => e.type === type && f(e));
const garbageCount = b => b.grid.flat().filter(v => v === GARB).length;

export const TUTORIALS = {
  tsunagu: [
    {
      title: '動かして置く',
      text: '←→で組を動かして、いちばん左の列に置いてみよう。↑ですぐ落とせるよ。',
      setup(b) { b.grid = emptyGrid(); b.piece = { x: 2, y: 1, rot: 0, a: R, b: G }; },
      goal: (b, ev) => has(ev, 'lock') && b.grid.some((r, y) => y >= 1 && r[0] !== 0),
    },
    {
      title: '4つつなげて消す',
      text: '同じ色を4つ以上つなげると消えるよ。赤い組を右に1つ動かして、下の赤につなげよう。',
      setup(b) { b.grid = tsGrid(['RRR...']); b.piece = { x: 2, y: 1, rot: 0, a: R, b: R }; },
      goal: (b, ev) => has(ev, 'pop'),
    },
    {
      title: '連鎖を組む',
      text: '消えたあとに落ちたつぶがまたそろうと「連鎖」。そのまま落とすと、赤が消えて緑が落ち、2連鎖になるよ。',
      setup(b) { b.grid = tsGrid(['.R....', 'RR.GGG']); b.piece = { x: 2, y: 1, rot: 0, a: R, b: G }; },
      goal: (b, ev) => has(ev, 'pop', e => e.chain >= 2),
    },
    {
      title: 'おじゃまを消す',
      text: '灰色の「おじゃまつぶ」は、となりで消すと一緒に消えるよ。赤をつなげて、おじゃまを巻き込もう。',
      setup(b) { b.grid = tsGrid(['RRR.O.']); b.piece = { x: 2, y: 1, rot: 0, a: R, b: R }; b.__tutG = garbageCount(b); },
      goal: (b, ev) => has(ev, 'pop') && garbageCount(b) < (b.__tutG ?? 1),
    },
  ],
  naraberu: [
    {
      title: '入れ替える',
      text: '白い枠（カーソル）の2マスを入れ替えよう。F（スマホはパネルを横になぞる）で入れ替え。',
      setup(b) { fillFromRows(b, ['GB....', 'YPGBYP']); b.cursor = { x: 0, y: BOTTOM - 1 }; },
      goal: (b, ev) => has(ev, 'swap'),
    },
    {
      title: '3つ並べて消す',
      text: '縦か横に同じ色を3つ並べると消えるよ。カーソルの2マスを入れ替えて、赤を3つ並べよう。',
      setup(b) { fillFromRows(b, ['RR.R..', 'GBYGBY']); b.cursor = { x: 2, y: BOTTOM - 1 }; },
      goal: (b, ev) => has(ev, 'pop'),
    },
    {
      title: '連鎖',
      text: '消えたあと、上のパネルが落ちてまたそろうと「連鎖」。赤をそろえると、上の緑が落ちて2連鎖！',
      setup(b) { fillFromRows(b, ['..G...', 'GGRR.R', 'BYPBYP']); b.cursor = { x: 4, y: BOTTOM - 1 }; },
      goal: (b, ev) => has(ev, 'pop', e => e.chain >= 2),
    },
    {
      title: 'アクティブ連鎖',
      text: '消えたあと、上のパネルは少しのあいだ浮くよ。浮いている間に、右の緑を下に差し込むと連鎖がつながる！',
      cfg: { naraberuHoverFrames: 45 },
      setup(b) { fillFromRows(b, ['..G...', '..G...', 'RRRG..']); b.cursor = { x: 2, y: BOTTOM }; },
      goal: (b, ev) => has(ev, 'pop', e => e.chain >= 2),
    },
    {
      title: 'せり上げる',
      text: 'G（スマホは下のボタン）を押している間、盤を自分でせり上げられるよ。2段せり上げてみよう。',
      setup(b) { fillFromRows(b, ['GBYGBY']); b.cursor = { x: 2, y: BOTTOM - 1 }; b.__tutRc = b.riseCount; },
      goal: b => b.riseCount - (b.__tutRc ?? 0) >= 2,
    },
  ],
};

// チュートリアルの盤の設定: 勝手にせり上がらない（せり上げの課題は手動だけで動かす）
export function tutorialCfg(cfg, kind, step) {
  return { ...cfg, naraberuRiseStartSec: 1e6, naraberuRiseEndSec: 1e6, ...(step && step.cfg) };
}

export { COLS };
