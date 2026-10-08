// 共通ダメージ: 各盤の消去 → D、相殺、受ける側の盤に合わせた変換。
// 予告(pending)は {D, age}。D は小数のまま持ち、着弾時に整数分だけ落とす。

const GB = n => (n <= 4 ? 0 : n >= 11 ? 10 : n - 3);
const CB = [0, 0, 3, 6, 12, 24];
const COMBO = { 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 10, 11: 12 };

export function chainPower(chain, cfg) {
  const CP = cfg.CP;
  if (chain < CP.length) return CP[chain];
  return CP[CP.length - 1] + 32 * (chain - CP.length + 1);
}

export function tsunaguDamage({ n, chain, groupSizes, colors }, cfg) {
  const bonus = chainPower(chain, cfg) + groupSizes.reduce((s, g) => s + GB(g), 0) + CB[Math.min(colors, 5)];
  return (10 * n * Math.max(1, bonus)) / 70 * cfg.atkMulT;
}

export function naraberuDamage({ n, chain }, cfg) {
  const combo = n >= 4 ? (COMBO[n] ?? n) : 0;
  const ch = chain >= 2 ? cfg.chainStepN * (chain - 1) : 0;
  return (combo + ch) * cfg.atkMulN;
}

// 予告に足す。ならべる派で着弾できない量(3マス未満)からの再開なら猶予を数え直す。
export function addPending(p, D, cfg) {
  if (p.D * cfg.convN < 3) p.age = 0;
  p.D += D;
}

// 自分の予告から相殺し、余りを相手へ。返り値=相手に送った量。
export function sendAttack(D, own, opp, cfg = { convN: 1 }) {
  const off = Math.min(D, own.D);
  own.D -= off;
  const rest = D - off;
  if (rest > 0) addPending(opp, rest, cfg);
  return rest;
}

// つなぐ派が受ける: おじゃまつぶの個数
export function landTsunagu(p, cfg) {
  const count = Math.min(cfg.tsunaguMaxGarbage ?? 30, Math.floor(p.D * cfg.convT + 1e-9));
  if (count > 0) p.D = Math.max(0, p.D - count / cfg.convT);
  return count;
}

// ならべる派が受ける: [{w,h}]。猶予前・3マス未満なら空。
export function landNaraberu(p, cfg) {
  if (p.age < cfg.naraberuLandSec * 60) return [];
  let cells = Math.floor(p.D * cfg.convN + 1e-9);
  const rows = Math.min(12, Math.floor(cells / 6));
  const out = [];
  if (rows > 0) { out.push({ w: 6, h: rows }); cells -= rows * 6; }
  if (rows < 12 && cells >= 3) { out.push({ w: cells, h: 1 }); cells = 0; }
  const used = out.reduce((s, b) => s + b.w * b.h, 0);
  if (used > 0) p.D = Math.max(0, p.D - used / cfg.convN);
  return out;
}
