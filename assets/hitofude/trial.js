// 試しの線と、試し燃やし（画面と、画面の裏の worker の両方で使う）。
// 試しの線: 混んでいる所・提灯・金の玉から始めて、近い玉へ順に（墨の budget 割まで。金と提灯は少し遠くても寄る）たどる線を何本か作る
export function trialRoutes(K, st, budgets = [0.9]) {
  const live = st.shells.filter((s) => !s.burst && s.type !== 'kuro');
  if (!live.length) return [];
  const crowd = (a) => live.filter((b) => Math.hypot(a.x - b.x, a.y - b.y) < 70).length;
  const lure = (s) => (s.type === 'kin' || s.type === 'chouchin' ? 0.65 : 1);
  const starts = new Set([...live.slice().sort((a, b) => crowd(b) - crowd(a)).slice(0, 4), ...live.filter((s) => s.type === 'chouchin' || s.type === 'kin').slice(0, 4)]);
  const out = [];
  for (const k of budgets) for (const first of starts) {
    const budget = st.ink * k;
    let cur = first, used = 0;
    const route = [cur], seen = new Set([cur.id]);
    for (;;) {
      const nx = live.filter((s) => !seen.has(s.id) && !K.crossesCloud(st.clouds, cur.x, cur.y, s.x, s.y))
        .map((s) => ({ s, d: Math.hypot(s.x - cur.x, s.y - cur.y) })).sort((a, b) => a.d * lure(a.s) - b.d * lure(b.s))[0];
      if (!nx || used + nx.d > budget || route.length >= 14) break;
      used += nx.d; seen.add(nx.s.id); cur = nx.s; route.push(cur);
    }
    if (route.length >= 2) out.push(route.map((q) => ({ x: q.x, y: q.y })));
  }
  return out;
}
// その条件の夜で、試しの線のうちいちばん良い点（本物のルールで最後まで燃やす）
export function bestTrial(K, params, budgets) {
  let best = { score: 0, route: null };
  for (const route of trialRoutes(K, K.newRound(params), budgets)) {
    let score = 0;
    try { score = K.runToEnd(K.newRound(params), [route]).score; } catch (e) { /* 燃やせなかった線は 0 点 */ }
    if (score > best.score) best = { score, route };
  }
  return best;
}
