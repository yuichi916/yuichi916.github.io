// 一筆花火 2 — 実績。周回をまたいで残り、遊び方の幅を見せる
const A = (id, ja, en, dj, de, test) => ({ id, ja, en, dj, de, test });
export const ACHIEVEMENTS = [
  A('first', '初めての一筆', 'First Stroke', '夜を 1 つ越える', 'Clear a night', (c) => c.st?.cleared),
  A('bloom', '満開', 'Full Bloom', '盤の玉を全部ひらく', 'Open every shell on the board', (c) => c.st?.blooms > 0),
  A('bloom3', '三度の満開', 'Triple Bloom', '1 夜に満開を 3 回', '3 Full Blooms in one night', (c) => c.st?.blooms >= 3),
  A('streak3', '満開三連', 'Bloom Streak 3', '満開を 3 回続ける', 'Keep a Full Bloom streak of 3', (c) => c.st?.streak >= 3),
  A('streak6', '満開六連', 'Bloom Streak 6', '満開を 6 回続ける', 'Keep a Full Bloom streak of 6', (c) => c.st?.streak >= 6),
  A('act2', '第二幕の満開', 'Encore Bloom', '大一番の第二幕で満開', 'Full Bloom in a boss encore', (c) => c.st?.act2 && c.st.lastBloom !== undefined && c.st.encoreBloom),
  A('shape', '型物師', 'Picture Maker', '型物の夜を満開で越える', 'Trace a whole Picture Night', (c) => c.st?.twist === 'katamono' && c.st.goalMet),
  A('oneshot', '一発屋', 'One Hit Wonder', '尺玉一発を熱で越える', 'Pass One Grand Shell with heat', (c) => c.st?.twist === 'ippatsu' && c.st.goalMet),
  A('senko', '散り菊', 'Last Petal', '線香花火を散り菊まで保つ', 'Hold a sparkler to its last stage', (c) => c.meta?.senko >= 4),
  A('chain15', '十五連', 'Chain of 15', '一筆で 15 連鎖', '15 shells in one stroke', (c) => c.st?.bestChain >= 15),
  A('chain30', '三十連', 'Chain of 30', '一筆で 30 連鎖', '30 shells in one stroke', (c) => c.st?.bestChain >= 30),
  A('chain50', '五十連', 'Chain of 50', '一筆で 50 連鎖', '50 shells in one stroke', (c) => c.st?.bestChain >= 50),
  A('hot', '火遊び', 'Playing with Fire', '熱 ×4 に届く', 'Reach HOT ×4', (c) => c.st?.topHeat >= 3),
  A('close10', '紙一重の十回', 'Ten Close Calls', '1 夜にきわどい通過 10 回', '10 Close passes in one night', (c) => c.st?.closeCalls >= 10),
  A('nocaught', '逃げ切り', 'Clean Getaway', '追いつかれずに大一番を越える', 'Beat a boss without being caught', (c) => c.st?.cleared && c.st.level.boss && c.st.caughtCount === 0),
  A('one', '一筆書き', 'One Stroke', '1 本目の線だけで夜を越える', 'Clear a night with your first stroke', (c) => c.st?.cleared && c.st.strokesUsed === 1 && c.st.level.night >= 3),
  A('triple', '大逆転', 'Comeback', '最後の一筆で目標の半分以上を稼いで越える', 'Clear on your last stroke, earning over half the target', (c) => c.st?.cleared && c.st.strokesLeft === 0 && c.st.lastGain >= c.st.target / 2),
  A('star3', '三つ星', 'Three Stars', '夜を星 3 つで越える', 'Get 3 stars on a night', (c) => c.stars >= 3),
  A('score10k', '一万点', '10,000', '1 夜で 1 万点', '10,000 in one night', (c) => c.st?.score >= 10000),
  A('score100k', '十万点', '100,000', '1 夜で 10 万点', '100,000 in one night', (c) => c.st?.score >= 100000),
  A('score1m', '百万点', 'A Million', '1 夜で 100 万点', '1,000,000 in one night', (c) => c.st?.score >= 1000000),
  A('boss1', '大一番', 'First Boss', '妖怪に勝つ', 'Beat a boss', (c) => c.st?.cleared && c.st.level.boss),
  A('world1', '夏の終わり', 'End of Summer', '川辺の夏祭りを越える', 'Finish the Riverside Festival', (c) => c.run?.nightsCleared >= 8),
  A('world2', '雪どけ', 'Thaw', '雪の山里を越える', 'Finish the Snowy Village', (c) => c.run?.nightsCleared >= 16),
  A('win', '大団円', 'Grand Finale', '24 夜を越える', 'Clear all 24 nights', (c) => c.run?.won),
  A('win3', '三度の大団円', 'Three Finales', '3 回完走', 'Finish 3 runs', (c) => c.meta?.wins >= 3),
  A('rank3', '親方', 'Master', '段位 4 で完走', 'Win at Rank 4', (c) => c.run?.won && c.run.rank >= 3),
  A('rank8', '花火神', 'Fireworks God', '段位 8 で完走', 'Win at Rank 8', (c) => c.run?.won && c.run.rank >= 7),
  A('rich', '大金持ち', 'High Roller', '小判を 50 枚持つ', 'Hold 50 coins', (c) => c.run?.coins >= 50),
  A('full', '袋いっぱい', 'Full Bags', 'お守りを持てるだけ持つ', 'Fill every charm slot', (c) => c.run && c.run.charms.length >= c.run.slots),
  A('legend', '伝説', 'Legendary', '伝説のお守りを手に入れる', 'Own a legendary charm', (c) => c.hasLegend),
  A('runs10', '常連', 'Regular', '10 回遊ぶ', 'Play 10 runs', (c) => c.meta?.runs >= 10),
  A('allfuses', '導火線集め', 'Fuse Collector', '導火線を全部開く', 'Unlock every fuse', (c) => c.fusesOpen),
  A('book', 'お守り帳', 'Charm Book', 'お守りを全部開く', 'Unlock every charm', (c) => c.bookFull),
  // 腕の層
  A('graze100', 'かすり百', 'Hundred Grazes', '1 夜に 100 回かすめる', 'Graze 100 times in one night', (c) => c.st?.graze >= 100),
  A('dust100', '星集め', 'Stardust Collector', '1 夜に星屑を 100 粒拾う', 'Collect 100 star dust in one night', (c) => c.st?.dustGot >= 100),
  A('pv100', '星の値 百', 'Star Value 100', '星の値を 100 まで育てる', 'Raise star value to 100', (c) => c.st?.pv >= 100),
  A('sweep', '一網打尽', 'Clean Sweep', '見切りで星屑を 20 粒まとめて回収', 'Sweep 20 star dust with one close call', (c) => c.st?.bestSweep >= 20),
  A('tsugi3', '継ぎ火三連', 'Relight ×3', '継ぎ火を 3 回つなげる', 'Chain 3 relights', (c) => c.st?.tsugiBest >= 3),
  A('spell1', '技取り', 'First Capture', '大一番の技を取る', 'Capture a boss technique', (c) => c.st?.spellLog?.some((x) => x.got)),
  A('oku', '奥義破り', 'Secret Art Broken', '第二幕の奥義を取る', 'Capture a secret art in an encore', (c) => c.st?.spellLog?.some((x) => x.got && x.id.endsWith('3'))),
  // 記憶の層
  A('seen', '見られていた', 'Someone Was Watching', '夜の途中で、いなくなる', 'Leave in the middle of a night', (c) => c.meta?.mem?.left >= 1),
  A('wait', '立ち止まる', 'Standing Still', '筆を止めて、火を待つ', 'Stop and wait for the flame', (c) => c.meta?.mem?.waited >= 1),
  A('mercy', '迎え火', 'The Welcoming Fire', '火を待ちながら、祭りを越える', 'Finish the festival while waiting for the flame', (c) => c.meta?.mem?.mercy),
];
export function checkAchievements(meta, ctx) {
  meta.ach = meta.ach || {};
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (meta.ach[a.id]) continue;
    let ok = false; try { ok = !!a.test({ ...ctx, meta }); } catch { /* その場に無い情報は、まだ */ }
    if (ok) { meta.ach[a.id] = 1; got.push(a); }
  }
  return got;
}
