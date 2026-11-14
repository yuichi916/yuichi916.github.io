// 一筆花火 2 — 記憶の層。ゲーム全体が、遊ぶ人のふるまいを覚えていて、登場人物の口から返す。
// DOM に触らない。台詞を選ぶだけ（main.js が出す）。
// mem: DB.meta.mem = { left, caught, waited, graze, dust, sold, lastPlay, lastEnd, mercy }

export const newMem = () => ({ left: 0, caught: 0, waited: 0, graze: 0, dust: 0, sold: 0, lastPlay: 0, lastEnd: null, mercy: 0 });
export const fixMem = (m) => ({ ...newMem(), ...(m || {}) });

// 夜の途中で消えたときの、トラの返事。1 回目は見逃す。2 回目からは提灯を 1 つもらう（最後の 1 つは取らない）
export function leftLine(mem, lives) {
  if (mem.left <= 1) return { take: false, ja: 'さっきの夜、途中で消えたね。\n……見なかったことにしてあげる。一度だけね。', en: 'You vanished in the middle of that night.\n...I\'ll pretend I didn\'t see. Just this once.' };
  if (lives <= 1) return { take: false, ja: `また途中で帰ったね。これで ${mem.left} 回目。\n最後の灯は、取らないでおく。`, en: `You left in the middle again. That's ${mem.left} times.\nI won't take your last light.` };
  return { take: true, ja: `また途中で帰ったね。これで ${mem.left} 回目。\n灯をひとつ、もらっておくよ。祭りは、ちゃんと数えてるから。`, en: `You left in the middle again. That's ${mem.left} times.\nI'll take one light. The festival keeps count.` };
}

// 火の子（ヒノコ）は話さない。でも、筆を止めて待ってくれた回数だけ、筆先に小さく書く
const HINOKO = [
  [1, '……？', '...?'],
  [2, 'まって、くれたの？', 'did you... wait for me?'],
  [3, 'どうして、にげないの', 'why aren\'t you running'],
  [5, 'あったかい', 'warm'],
  [8, 'いっしょに、いても いい？', 'can I stay with you?'],
  [13, 'ずっと、おいかけてた', 'I was chasing you all along'],
  [21, 'ありがとう', 'thank you'],
];
export function hinokoLine(waitedTotal) {
  const hit = HINOKO.find(([n]) => n === waitedTotal);
  return hit ? { ja: hit[1], en: hit[2] } : null;
}

// 大一番の妖怪は、これまでの記録を言い当てる（いちばん目立つ記録を 1 つ選ぶ）
export function bossTaunt(mem, rule, run) {
  const L = [];
  if (mem.mercy) L.push([9, 'あの子の となりを 歩いていたな。……今夜は、通してやってもいい', 'You walked beside that child. ...Perhaps I\'ll let you through tonight.']);
  if (mem.waited >= 3) L.push([8, `火を ${mem.waited} 回も 待っていたな。あの子が 喜んでいた`, `You waited for the flame ${mem.waited} times. The child was glad.`]);
  if (mem.left >= 2) L.push([7, `途中で ${mem.left} 回、逃げ帰ったのを 知っているぞ`, `I know you ran home in the middle, ${mem.left} times.`]);
  if (mem.sold >= 5) L.push([6, `お守りを ${mem.sold} 個も 売ったな。勝つためなら、何でも手放すか`, `You sold ${mem.sold} charms. Will you give up anything to win?`]);
  if (mem.graze >= 1000) L.push([5, `火を ${mem.graze.toLocaleString()} 回 かすめた。おまえ、火が怖くないのか`, `You grazed the flame ${mem.graze.toLocaleString()} times. Are you not afraid of fire?`]);
  if (mem.caught >= 30) L.push([4, `${mem.caught} 回も 追いつかれて、まだ来るか`, `Caught ${mem.caught} times, and still you come.`]);
  if (run && run.lives === 1) L.push([3, '灯は、あと ひとつ。よく見ておけ', 'One light left. Look at it well.']);
  if (mem.dust >= 2000) L.push([2, `星屑を ${mem.dust.toLocaleString()} 粒も 拾い集めて、何を願う`, `${mem.dust.toLocaleString()} grains of star dust. What are you wishing for?`]);
  if (!L.length) return null;
  L.sort((a, b) => b[0] - a[0]);
  // 同じ記録ばかり言わないよう、上位 2 つから妖怪ごとに選ぶ
  const pick = L[Math.min(L.length - 1, (rule || '').length % 2)];
  return { ja: pick[1], en: pick[2] };
}

// タイトルの一言: お盆 > 迎えの結末を見た > 物語の結末 > 久しぶり > 途中で消えた > 前回の終わり方 > 時刻
export function titleLine(meta, now = new Date()) {
  const mem = fixMem(meta.mem), mo = now.getMonth() + 1, d = now.getDate(), h = now.getHours();
  if (mo === 8 && d >= 13 && d <= 16) return { ja: 'お盆の夜。帰ってくる人が、いる。', en: 'Obon night. Someone is coming home.' };
  if (mem.mercy) return { ja: '火の子は、もう追いかけてこない。となりにいる。', en: 'The little flame no longer chases you. It walks beside you.' };
  if (meta.storyDone) return { ja: '終わらない祭り —— それでも、もう一夜だけ。', en: 'The Endless Festival — just one more night.' };
  const days = mem.lastPlay ? Math.floor((now.getTime() - mem.lastPlay) / 86400000) : 0;
  if (days >= 3) return { ja: `${days} 日ぶりだね。火の子が、ずっと待ってた。`, en: `${days} days. The little flame has been waiting.` };
  if (mem.left > 0 && mem.lastLeftAt && now.getTime() - mem.lastLeftAt < 86400000) return { ja: '途中で消えた夜のこと、トラは覚えている。', en: 'Tora remembers the night you left halfway.' };
  if (mem.lastEnd && !mem.lastEnd.won && mem.lastEnd.nights > 0) return { ja: `この前は 第 ${mem.lastEnd.nights + 1} 夜で、灯が尽きた。`, en: `Last time, your lights ran out on night ${mem.lastEnd.nights + 1}.` };
  if (h >= 5 && h < 16) return { ja: 'まだ明るい。花火には、すこし早いかな。', en: 'Still daylight. A little early for fireworks.' };
  if (h < 5) return { ja: 'こんな夜ふけに。……でも、火は起きている。', en: 'This late at night. ...But the flame is awake.' };
  return { ja: '線を引け。火が追いかけてくる。', en: 'Draw the fuse. The flame is right behind you.' };
}

// 屋台のトラ: 売ったお守りを覚えていて、買い戻しを出す。ほかに言うことがあれば言う
export function shopLine(mem, run, ctx = {}) {
  if (ctx.buyBack) return { ja: `あのお守り、取っておいたよ。買い戻す？`, en: 'I kept that charm you sold. Want it back?' };
  if (ctx.ext) return { ja: '星屑で、灯がひとつ増えたね。きれいに拾うもんだ。', en: 'Your star dust bought you a light. Nicely gathered.' };
  if (ctx.waited) return { ja: 'さっき、火を待ってたね。……あの子、うれしそうだった。', en: 'You waited for the flame just now. ...That child looked happy.' };
  if (ctx.spellAll) return { ja: '技をぜんぶ取ったのかい。妖怪も、たまげてたよ。', en: 'You captured every technique? Even the yokai were stunned.' };
  return null;
}

// 迎えの結末: 1 周で「わざと捕まった」夜が 3 つ以上あって、最後まで越えたとき
export const MERCY_NEED = 3;
export function mercyEnding() {
  return {
    title: { ja: '迎え火', en: 'The Welcoming Fire' },
    body: {
      ja: 'あなたは、何度も立ち止まって、火を待った。\n逃げるための祭りだったのに。\n\n火の子は、もう追いかけてこない。\nいまは、となりを歩いている。',
      en: 'Again and again, you stopped and waited for the flame.\nIn a festival made for running away.\n\nThe little flame no longer chases you.\nNow it walks beside you.',
    },
  };
}
