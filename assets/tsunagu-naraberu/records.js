// 戦績（localStorage: tn-records-v1）。CPU戦は段別・キャラ別に勝敗を数え、2人対戦は回数だけ。練習・チュートリアルは数えない。
export const KEY = 'tn-records-v1';

export const emptyRecords = () => ({ plays: 0, cpu: {}, chars: {}, bestChain: 0, bestAttack: 0 });

function valid(r) {
  return r && typeof r === 'object' && Number.isFinite(r.plays) && r.cpu && typeof r.cpu === 'object'
    && r.chars && typeof r.chars === 'object' && Number.isFinite(r.bestChain) && Number.isFinite(r.bestAttack);
}

export function loadRecords(storage) {
  try {
    const r = JSON.parse((storage && storage.getItem(KEY)) || 'null');
    return valid(r) ? r : emptyRecords();
  } catch { return emptyRecords(); }
}

export function saveRecords(storage, r) {
  try { storage && storage.setItem(KEY, JSON.stringify(r)); } catch { /* 保存できない環境 */ }
}

// 1試合ぶんを足す。返り値は自己ベストを更新したか
export function recordResult(r, { mode, level, chars, result, maxChain = 0, attack = 0 }) {
  const none = { newBestChain: false, newBestAttack: false };
  if (mode !== 'cpu' && mode !== '2p') return none;
  r.plays++;
  const me = chars[0];
  const c = (r.chars[me] ||= { win: 0, lose: 0, plays: 0 });
  c.plays++;
  if (mode === '2p') return none;
  const lv = (r.cpu[level] ||= { win: 0, lose: 0, draw: 0 });
  lv[result === 'win' ? 'win' : result === 'lose' ? 'lose' : 'draw']++;
  if (result === 'win') c.win++;
  else if (result === 'lose') c.lose++;
  const atk = Math.round(attack);
  const out = { newBestChain: maxChain > r.bestChain, newBestAttack: atk > r.bestAttack };
  if (out.newBestChain) r.bestChain = maxChain;
  if (out.newBestAttack) r.bestAttack = atk;
  return out;
}
