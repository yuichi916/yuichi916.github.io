// 一筆花火の登場人物。大一番の妖怪 4 人・屋台の招き猫・ヒノコの着せかえ・花火合戦の相手の小物。
// Canvas 2D だけで描く（画像ファイルなし）。形はヒノコと同じ考え方: やわらかい丸い形・平らな塗りとやわらかいぼかし・光。
// 線のふちどりは使わず、目や口の小さな墨だけ。28px（HUD）から 260px（幕間）まで読めるようにする。
//
//   drawCast(g, id, x, y, size, opts)   妖怪と招き猫。(x, y) はからだの中心、size はからだの高さ（耳や小物は外にはみ出る）
//   drawOutfit(g, id, x, y, r, opts)    ヒノコの着せかえ。drawHinoko(g, x, y, r, ...) のあとに、同じ x, y, r で重ねる
//   drawRivalGear(g, id, x, y, r, opts) 花火合戦の相手の小物。色を変えたヒノコのからだのあとに、同じ x, y, r で重ねる
//
// drawCast の絵（光を除く）は、(x, y) から 横 -0.7〜+0.6 × size・縦 -0.72〜+0.58 × size に収まる（flip で左右が入れかわる）。
// 着せかえと小物は、(x, y) から 横 ±1.9 × r・縦 -1.6〜+1.7 × r に収まる（炎の先は -2.05 × r）。
//
// 絵はすべて「単位の座標」で描く（drawCast は size を 100、ほかは r を 1 とする）。
// だからぼかし（グラデーション）は大きさによらず同じになり、キャンバスごとに一度だけ作って使い回せる。

import { blinkAt } from './hinoko.js';

const TAU = Math.PI * 2;
const INK = '#3a1606';
const CHEEK = 'rgba(255,90,120,.55)';

// ---------------------------------------------------------------- 登場人物（名前・色・せりふ）
// say / sayEn: intro 登場 / taunt 挑発 3 つ / win あなたが散ったとき / lose あなたが越えたとき / friend 倒したあとの顔出し
export const CAST = {
  tengu: {
    id: 'tengu', ja: '天狗', en: 'Tengu', name: 'ハナタカ', nameEn: 'Hanataka', title: 'まっすぐ天狗', titleEn: 'The Straight-Line Tengu',
    color: '#ff5a3c', twist: 'massugu', charm: 'tengu',
    say: {
      intro: '天狗のハナタカ見参！ 今宵の線は、ぜんぶまっすぐにしてやるわい！',
      taunt: ['曲がった線など、天狗は好かん！', 'まっすぐ進め、ふり返るな！', 'わしの鼻より長い線、引けるかの？'],
      win: 'ふふん、鼻が高いわい！',
      lose: 'ぬぬっ…わしの鼻が、折れた…！',
      friend: 'おう、まっすぐな一筆、見せてみい！',
    },
    sayEn: {
      intro: 'Hanataka the Tengu is here! Tonight, every line runs straight!',
      taunt: ['Curves? A tengu has no use for curves!', 'Straight ahead. No looking back!', "Bet you can't draw a line longer than my nose!"],
      win: 'Hmph! My nose has never stood taller!',
      lose: "Ngh… you've bent my nose!",
      friend: "Ho! Let's see a good straight stroke!",
    },
  },
  tanuki: {
    id: 'tanuki', ja: '狸', en: 'Tanuki', name: 'ポン吉', nameEn: 'Ponkichi', title: 'まねっこ化け狸', titleEn: 'The Copycat Tanuki',
    color: '#e0a050', twist: 'kagami', charm: 'tanuki',
    say: {
      intro: 'ポン吉さまの化け術だぽん！ 線がふたつに見えるかな〜？',
      taunt: ['右も左も、そっくりぽん！', 'どっちが本物か、わかるかな？', '腹つづみ、ぽんぽこぽん♪'],
      win: 'ぽんぽこ、大勝利〜！',
      lose: 'ありゃ、しっぽが出ちゃった…',
      friend: 'こんどは化かさないぽん。…たぶん！',
    },
    sayEn: {
      intro: "Ponkichi's shapeshifting magic! Seeing double yet?",
      taunt: ['Left or right? Perfect copies!', "Which line's the real one?", 'Belly drum! Pon-poko-pon♪'],
      win: 'Pon-poko! Total victory!',
      lose: 'Whoops… my tail slipped out.',
      friend: "I won't trick you this time. …Probably!",
    },
  },
  kitsune: {
    id: 'kitsune', ja: '狐', en: 'Kitsune', name: 'オボロ', nameEn: 'Oboro', title: '闇夜の狐', titleEn: 'The Fox of the Dark',
    color: '#8c9cff', twist: 'yamiyo', charm: 'kitsune',
    say: {
      intro: '狐のオボロよ。灯りが消えても、玉の場所、覚えていられる？',
      taunt: ['ほら、もう見えない…コン', '暗がりは、狐のなわばり', '化かされているのは、だあれ？'],
      win: 'うふふ、闇に迷ったわね',
      lose: 'まあ…闇夜でも、見えていたのね',
      friend: '足もとは、狐火で照らしてあげる',
    },
    sayEn: {
      intro: "I'm Oboro the fox. When the lights go out… will you remember?",
      taunt: ['See? Gone already… kon.', 'The dark belongs to foxes.', 'Now, who is fooling whom?'],
      win: 'Hehe. Lost in the dark, were we?',
      lose: 'My… you could see in the dark all along.',
      friend: 'Let my foxfire light your way.',
    },
  },
  kamaitachi: {
    id: 'kamaitachi', ja: '鎌鼬', en: 'Kamaitachi', name: 'ハヤテ', nameEn: 'Hayate', title: '一瞬のかまいたち', titleEn: 'The Split-Second Weasel',
    color: '#3fd6b0', twist: 'isshun', charm: 'kamaitachi',
    say: {
      intro: 'オレはハヤテ！ 4秒で引けなきゃ、風が線を断ち切るぜ！',
      taunt: ['おそいおそい！', 'ヒュッ…はい、時間切れ', '迷ったら、負けだぜ'],
      win: 'へへっ、風のほうが速かったな',
      lose: 'なっ…オレより速いだと！？',
      friend: '速さなら教えてやる。ついてこい！',
    },
    sayEn: {
      intro: "I'm Hayate! Draw it in 4 seconds, or the wind cuts your line!",
      taunt: ['Too slow, too slow!', "Whoosh… time's up.", 'Hesitate and you lose!'],
      win: 'Heh. The wind was faster.',
      lose: 'Wha—?! Faster than me?!',
      friend: 'Want speed? Try and keep up!',
    },
  },
  neko: {
    id: 'neko', ja: '招き猫', en: 'Lucky cat', name: 'コバン', nameEn: 'Koban', title: '星屋台の招き猫', titleEn: 'Lucky Cat of the Star Stall',
    color: '#ffc94a', twist: null, charm: null,
    say: {
      welcome: 'いらっしゃいニャ！ 星の屋台へ、ようこそ',
      buy: 'まいどありニャ！',
      broke: '星が足りないニャ…また来てね',
      sell: 'そのお守り、うちで引き取るニャ',
      upgrade: 'お守りが、ぐーんと強くなったニャ！',
      bye: 'よい夜を！ 福を招いておくニャ',
    },
    sayEn: {
      welcome: 'Welcome, welcome! Step right up to the Star Stall!',
      buy: 'Thank you kindly!',
      broke: 'Not enough stars… come back soon!',
      sell: "I'll take that charm off your paws.",
      upgrade: 'Your charm just got a whole lot stronger!',
      bye: "Have a great night! I'll beckon some luck your way.",
    },
  },
};
export const BOSSES = ['tengu', 'tanuki', 'kitsune', 'kamaitachi'];
export const FACES = ['idle', 'taunt', 'wow', 'sad', 'joy'];
// 大一番の仕掛けの id から、その夜の妖怪の id（なければ null）
export function bossOf(twist) { return BOSSES.find((id) => CAST[id].twist === twist) || null; }

// ヒノコの着せかえ
export const OUTFITS = [
  { id: 'hachimaki', ja: 'はちまき', en: 'Headband' },
  { id: 'omen', ja: '狐のお面', en: 'Fox mask' },
  { id: 'kanzashi', ja: '花かんざし', en: 'Flower hairpin' },
  { id: 'uchiwa', ja: 'うちわ', en: 'Paper fan' },
  { id: 'kingyo', ja: '金魚', en: 'Goldfish' },
  { id: 'kanmuri', ja: '王冠', en: 'Crown' },
];
// 花火合戦の相手の小物（見分けるための目じるし）
export const RIVAL_GEAR = [
  { id: 'chibi', ja: '若葉マークとばんそうこう', en: 'Beginner badge & bandage' },
  { id: 'shizuku', ja: 'リボンと線香花火', en: 'Ribbon & sparkler' },
  { id: 'don', ja: 'ねじりはちまきとひげ', en: 'Twisted headband & mustache' },
  { id: 'karakuri', ja: '片めがねとねじ巻き', en: 'Monocle & wind-up key' },
  { id: 'tsukikage', ja: '月の飾りとマフラー', en: 'Moon pin & scarf' },
];
// 相手のからだの色（core の RIVALS と同じ。opts.body で上書きできる）
const RIVAL_BODY = {
  chibi: ['#e9fbff', '#8fe3ff', '#3fb4ff', '#1f6fe0'], shizuku: ['#fbf0ff', '#d9a8ff', '#a066f0', '#6a34c8'],
  don: ['#f2fff0', '#9dffb0', '#35d37a', '#16804a'], karakuri: ['#fff8e8', '#ffd98a', '#e0a030', '#9a6010'],
  tsukikage: ['#ffffff', '#dfe6ff', '#8a9cff', '#3a3f9a'],
};
const HINO_BODY = ['#fff6c4', '#ffc93c', '#ff8a1e', '#f2551a'];

// ---------------------------------------------------------------- 下ごしらえ
// ぼかしは単位の座標で作るので、キャンバス（の文脈）ごとに 1 度だけ作って取っておく
const GC = new WeakMap();
function cached(g, key, make) {
  let m = GC.get(g);
  if (!m) { m = new Map(); GC.set(g, m); }
  let v = m.get(key);
  if (!v) { v = make(); m.set(key, v); }
  return v;
}
function rad(g, key, x0, y0, r0, x1, y1, r1, stops) {
  return cached(g, key, () => { const gr = g.createRadialGradient(x0, y0, r0, x1, y1, r1); for (const [o, c] of stops) gr.addColorStop(o, c); return gr; });
}
function lin(g, key, x0, y0, x1, y1, stops) {
  return cached(g, key, () => { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) gr.addColorStop(o, c); return gr; });
}
function ell(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); }
function dot(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
function stroke(g, w, pts) {
  g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]);
  if (pts.length === 4) g.lineTo(pts[2], pts[3]); else g.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
  g.stroke();
}
// 角の丸い四角（roundRect がない古いブラウザでも描けるように、自前で）
function rrect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.moveTo(x + rr, y); g.arcTo(x + w, y, x + w, y + h, rr); g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr); g.arcTo(x, y, x + w, y, rr); g.closePath();
}
// 三日月の形（半径 R の円から、(dx, dy) にずらした半径 r の円をくりぬく）
function crescent(g, R, dx, dy, r) {
  const d = Math.hypot(dx, dy), a = (R * R - r * r + d * d) / (2 * d), al = Math.acos(Math.max(-1, Math.min(1, a / R)));
  const tc = Math.atan2(dy, dx);
  const p1 = [Math.cos(tc + al) * R, Math.sin(tc + al) * R], p2 = [Math.cos(tc - al) * R, Math.sin(tc - al) * R];
  g.beginPath(); g.arc(0, 0, R, tc + al, tc - al + TAU, false);
  g.arc(dx, dy, r, Math.atan2(p2[1] - dy, p2[0] - dx), Math.atan2(p1[1] - dy, p1[0] - dx), true); g.closePath();
}
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------------------------------------------------------------- 顔（目・口・汗）。ヒノコと同じ墨の小さな形
// (x, y) は目の中心、w / h は目の横と縦の半径、lw は線の太さ（1 画素より細くしない）
function eyeOpen(g, x, y, w, h, ink = INK) {
  g.fillStyle = ink; ell(g, x, y, w, h);
  g.fillStyle = '#fff'; dot(g, x - w * 0.3, y - h * 0.38, w * 0.46);
}
function eyeBig(g, x, y, w, h, ink = INK) {
  g.fillStyle = ink; ell(g, x, y, w * 1.2, h * 1.15);
  g.fillStyle = '#fff'; dot(g, x - w * 0.35, y - h * 0.45, w * 0.55); dot(g, x + w * 0.4, y + h * 0.42, w * 0.22);
}
// まぶたを、からだと同じぼかしで上から塗る（目を細める）。cut 0〜1 = 隠す割合、tilt = 外がわの上がり下がり（s は左右）
function lid(g, x, y, w, h, cut, tilt, s, fill) {
  const top = y - h * 1.6, ly = y - h + 2 * h * cut, k = w * 1.6;
  g.fillStyle = fill; g.beginPath();
  g.moveTo(x - k, top); g.lineTo(x + k, top);
  g.lineTo(x + k, ly - tilt * s * h); g.lineTo(x - k, ly + tilt * s * h); g.closePath(); g.fill();
}
function eyeArc(g, x, y, w, h, up, lw) { // up: ^（にっこり） / 下向き: まばたき・すまし
  g.lineWidth = lw; g.beginPath();
  if (up) { g.moveTo(x - w * 1.15, y + h * 0.3); g.quadraticCurveTo(x, y - h * 0.95, x + w * 1.15, y + h * 0.3); }
  else { g.moveTo(x - w * 1.1, y + h * 0.1); g.quadraticCurveTo(x, y + h * 0.6, x + w * 1.1, y + h * 0.1); }
  g.stroke();
}
function eyeSad(g, x, y, w, h, s, lw) { // 外が下がった線（ヒノコの sad と同じ）
  g.lineWidth = lw; g.beginPath();
  g.moveTo(x - s * w * 1.15, y - h * 0.05); g.lineTo(x + s * w * 1.15, y + h * 0.35); g.stroke();
}
function eyeWink(g, x, y, w, h, s, lw) { // > <
  g.lineWidth = lw; g.beginPath();
  g.moveTo(x + s * w * 1.1, y - h * 0.55); g.lineTo(x - s * w * 0.9, y); g.lineTo(x + s * w * 1.1, y + h * 0.55); g.stroke();
}
function tearDrop(g, x, y, k) {
  g.fillStyle = '#9fd8ff'; g.beginPath();
  g.moveTo(x, y - k); g.quadraticCurveTo(x + k * 0.75, y + k * 0.15, x, y + k * 0.7); g.quadraticCurveTo(x - k * 0.75, y + k * 0.15, x, y - k); g.fill();
  g.fillStyle = 'rgba(255,255,255,.8)'; dot(g, x - k * 0.18, y + k * 0.1, k * 0.16);
}
function cheeks(g, x, y, rx, ry) { g.fillStyle = CHEEK; ell(g, -x, y, rx, ry); ell(g, x, y, rx, ry); }
// 口。kind: smile / w（ω）/ open（o）/ laugh（大きく笑う）/ frown / smirk / tongue（べー）/ grin（牙つき）
function mouth(g, kind, x, y, w, lw) {
  g.strokeStyle = INK; g.lineWidth = lw;
  switch (kind) {
    case 'w':
      g.beginPath(); g.moveTo(x - w, y - w * 0.2); g.quadraticCurveTo(x - w * 0.5, y + w * 0.6, x, y); g.quadraticCurveTo(x + w * 0.5, y + w * 0.6, x + w, y - w * 0.2); g.stroke(); break;
    case 'open':
      g.fillStyle = '#b3261e'; ell(g, x, y + w * 0.3, w * 0.55, w * 0.7); break;
    case 'laugh':
      g.fillStyle = '#b3261e'; g.beginPath(); g.moveTo(x - w * 1.25, y - w * 0.25); g.quadraticCurveTo(x, y + w * 2.1, x + w * 1.25, y - w * 0.25); g.closePath(); g.fill();
      g.fillStyle = '#ff8a8a'; ell(g, x, y + w * 0.75, w * 0.55, w * 0.3); break;
    case 'frown':
      g.beginPath(); g.moveTo(x - w * 0.8, y + w * 0.45); g.quadraticCurveTo(x, y - w * 0.25, x + w * 0.8, y + w * 0.45); g.stroke(); break;
    case 'wobble':
      g.beginPath(); g.moveTo(x - w, y + w * 0.3); g.quadraticCurveTo(x - w * 0.5, y - w * 0.15, x, y + w * 0.2); g.quadraticCurveTo(x + w * 0.5, y + w * 0.55, x + w, y + w * 0.1); g.stroke(); break;
    case 'smirk':
      g.beginPath(); g.moveTo(x - w * 0.9, y + w * 0.1); g.quadraticCurveTo(x + w * 0.1, y + w * 0.6, x + w * 1.05, y - w * 0.45); g.stroke(); break;
    case 'tongue':
      g.fillStyle = '#b3261e'; g.beginPath(); g.moveTo(x - w * 1.05, y - w * 0.1); g.quadraticCurveTo(x, y + w * 1.4, x + w * 1.05, y - w * 0.1); g.closePath(); g.fill();
      g.fillStyle = '#ff7f96'; ell(g, x + w * 0.25, y + w * 0.8, w * 0.48, w * 0.55, -0.3); break;
    case 'grin': // 片方に牙
      g.fillStyle = '#b3261e'; g.beginPath(); g.moveTo(x - w * 1.1, y - w * 0.15); g.quadraticCurveTo(x, y + w * 1.5, x + w * 1.1, y - w * 0.15); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + w * 0.35, y - w * 0.05); g.lineTo(x + w * 0.85, y - w * 0.12); g.lineTo(x + w * 0.62, y + w * 0.5); g.closePath(); g.fill();
      break;
    default: // smile
      g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x, y + w * 0.9, x + w, y); g.stroke();
  }
}

// ---------------------------------------------------------------- drawCast
// size はからだの高さ。opts: face（idle / taunt / wow / sad / joy / blink）, t 秒, still（動かさない）, flip（左右反転）,
// blink（t でまばたきさせる）, glow（後ろの光。小さなアイコンでは false に）
export function drawCast(g, id, x, y, size, opts = {}) {
  const fn = DRAW[id];
  if (!fn || !(size > 0)) return;
  const { t = 0, still = false, flip = false, blink = false, glow = true } = opts;
  let face = opts.face || 'idle';
  if (blink && !still && (face === 'idle' || face === 'taunt') && blinkAt(t, BLINK_SEED[id] || 0)) face = 'blink';
  const s = size / 100, an = still ? 0 : 1;
  g.save();
  g.translate(x, y);
  g.scale(flip ? -s : s, s);
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (glow) {
    g.fillStyle = rad(g, `glow.${id}`, 0, -4, 8, 0, -4, 82, GLOW[id]);
    g.fillRect(-82, -86, 164, 164);
  }
  // ふわっと上下する（足もとは止めたまま、少しだけ伸び縮み）
  const bob = an * Math.sin(t * 2.3 + (BLINK_SEED[id] || 0));
  g.translate(0, 50); g.scale(1 - bob * 0.012, 1 + bob * 0.018); g.translate(0, -50 - bob * 0.8);
  fn(g, face, { t, an, px: 1 / s });
  g.restore();
}
const BLINK_SEED = { tengu: 3, tanuki: 5, kitsune: 1, kamaitachi: 6, neko: 2 };
const GLOW = {
  tengu: [[0, 'rgba(255,110,70,.42)'], [0.55, 'rgba(255,80,50,.12)'], [1, 'rgba(255,80,50,0)']],
  tanuki: [[0, 'rgba(255,190,100,.38)'], [0.55, 'rgba(240,150,70,.1)'], [1, 'rgba(240,150,70,0)']],
  kitsune: [[0, 'rgba(150,170,255,.45)'], [0.55, 'rgba(110,130,255,.13)'], [1, 'rgba(110,130,255,0)']],
  kamaitachi: [[0, 'rgba(110,255,210,.38)'], [0.55, 'rgba(60,220,180,.1)'], [1, 'rgba(60,220,180,0)']],
  neko: [[0, 'rgba(255,215,110,.42)'], [0.55, 'rgba(255,190,80,.12)'], [1, 'rgba(255,190,80,0)']],
};

// ---- 天狗のハナタカ: 赤い丸顔・長い鼻・黒い頭巾（ときん）・白い山伏の衣とぼんてん・羽うちわ
function tengu(g, face, k) {
  const { t, an, px } = k;
  const lw = Math.max(px, 2.6);
  const faceFill = rad(g, 'tg.face', -9, -30, 2, 0, -15, 36, [[0, '#ffa184'], [0.45, '#f2573f'], [0.85, '#d0362f'], [1, '#a9242a']]);
  // 衣（白。下へいくほど夜の色）
  g.fillStyle = lin(g, 'tg.robe', 0, 0, 0, 52, [[0, '#fffaf0'], [0.6, '#ece6f2'], [1, '#b9b0d6']]);
  g.beginPath(); g.moveTo(-17, 2);
  g.bezierCurveTo(-27, 12, -33, 32, -32, 44); g.quadraticCurveTo(-31, 51, -22, 51); g.lineTo(22, 51);
  g.quadraticCurveTo(31, 51, 32, 44); g.bezierCurveTo(33, 32, 27, 12, 17, 2); g.closePath(); g.fill();
  // 帯
  g.fillStyle = '#2f2a55'; g.beginPath(); g.moveTo(-31, 38); g.quadraticCurveTo(0, 43, 31, 38); g.lineTo(31.6, 44); g.quadraticCurveTo(0, 49, -31.6, 44); g.closePath(); g.fill();
  // 一本歯の下駄
  g.fillStyle = '#5a3a28';
  for (const s of [-1, 1]) { g.beginPath(); rrect(g, s * 11 - 8, 50, 16, 4, 2); g.fill(); g.fillRect(s * 11 - 2, 53, 4, 4); }
  // ぼんてん（胸の 3 つの毛玉）
  for (let i = -1; i <= 1; i++) {
    const bx = i * 13, by = 27 + Math.abs(i) * -2;
    g.save(); g.translate(bx, by);
    g.fillStyle = rad(g, 'tg.pom', -2, -2, 0.5, 0, 0, 7, [[0, '#fff3c8'], [0.5, '#ffb340'], [1, '#e2731a']]);
    g.beginPath(); for (let j = 0; j < 9; j++) { const a = (j / 9) * TAU; g.arc(Math.cos(a) * 4, Math.sin(a) * 4, 3.2, 0, TAU); } g.fill();
    g.restore();
  }
  // 頭（ヒノコと同じ、つやの光）
  g.fillStyle = faceFill; dot(g, 0, -15, 34);
  g.fillStyle = 'rgba(255,235,220,.32)'; ell(g, -25, -21, 4.2, 8, 0.35);
  // 頭巾（ときん）
  g.save(); g.translate(-4, -46); g.rotate(-0.2);
  g.fillStyle = lin(g, 'tg.tokin', 0, -12, 0, 5, [[0, '#55506e'], [0.5, '#2a2640'], [1, '#110e1c']]);
  g.beginPath(); g.moveTo(-12, 3); g.lineTo(-12, -2); g.lineTo(-7, -11); g.lineTo(7, -11); g.lineTo(12, -2); g.lineTo(12, 3); g.quadraticCurveTo(0, 7, -12, 3); g.fill();
  g.strokeStyle = 'rgba(200,205,255,.28)'; g.lineWidth = Math.max(px, 1.1);
  g.beginPath(); for (const xx of [-7, -2.4, 2.4, 7]) { g.moveTo(xx * 0.85, -10.5); g.lineTo(xx * 1.15, 4); } g.stroke();
  g.restore();
  // ほっぺ
  cheeks(g, 22, -4, 6, 3.5);
  // まゆ（白く太い）と目
  const ex = 11, ey = -23, ew = 4.3, eh = 6.4;
  const B = { idle: [[-31, -35], [-31, -35]], taunt: [[-32, -36], [-38, -40]], wow: [[-39, -39], [-39, -39]], sad: [[-37, -31], [-37, -31]], joy: [[-38, -37], [-38, -37]], blink: [[-31, -35], [-31, -35]] }[face] || [[-31, -35], [-31, -35]];
  g.strokeStyle = '#fff1dc'; g.lineCap = 'round';
  for (const s of [-1, 1]) {
    const [yi, yo] = B[s < 0 ? 0 : 1];
    stroke(g, Math.max(px, 5.2), [s * 4.5, yi, s * 11, Math.min(yi, yo) - 3, s * 19, yo]);
  }
  g.strokeStyle = INK; g.fillStyle = INK;
  for (const s of [-1, 1]) {
    const x = s * ex;
    if (face === 'joy') eyeArc(g, x, ey, ew, eh, true, lw);
    else if (face === 'blink') eyeArc(g, x, ey, ew, eh, false, lw);
    else if (face === 'sad') { eyeSad(g, x, ey, ew, eh, s, lw); }
    else if (face === 'wow') eyeBig(g, x, ey, ew, eh);
    else {
      eyeOpen(g, x, ey, ew, eh);
      // すまし顔: 内がわが下がったまぶた（いばっている）。挑発は、片目を細めてにやり
      const cut = face === 'taunt' ? (s < 0 ? 0.55 : 0.2) : 0.32;
      lid(g, x, ey, ew, eh, cut, face === 'taunt' && s > 0 ? 0.1 : -0.35, s, faceFill);
    }
  }
  if (face === 'sad') tearDrop(g, -ex - 4, ey + 9, 3.6);
  // 口（鼻の下）
  const mk = { idle: 'smirk', taunt: 'grin', wow: 'open', sad: 'wobble', joy: 'laugh', blink: 'smirk' }[face] || 'smile';
  mouth(g, mk, -6, 12, 5.2, Math.max(px, 2));
  // 鼻（顔によって上がり下がり。うれしいと鼻高々、しょげると垂れる）
  const na = { idle: -0.26, taunt: -0.42, wow: -0.1, sad: 0.6, joy: -0.52, blink: -0.26 }[face] ?? -0.26;
  const L = face === 'joy' ? 39 : 35;
  g.save(); g.translate(1, -2); g.rotate(na + an * Math.sin(t * 1.9) * 0.03);
  const nose = (dy) => { g.beginPath(); g.moveTo(0, -7 + dy); g.quadraticCurveTo(L * 0.5, -6.5 + dy, L, -4.2 + dy); g.arc(L, dy, 4.2, -Math.PI / 2, Math.PI / 2); g.quadraticCurveTo(L * 0.5, 6.5 + dy, 0, 7 + dy); g.arc(0, dy, 7, Math.PI / 2, Math.PI * 1.5); g.closePath(); };
  g.fillStyle = 'rgba(110,10,20,.25)'; nose(3.5); g.fill(); // 顔に落ちる影
  g.fillStyle = lin(g, 'tg.nose', 0, -7, 0, 7, [[0, '#ffb093'], [0.4, '#f25a42'], [1, '#a82626']]); nose(0); g.fill();
  g.fillStyle = 'rgba(255,240,225,.7)'; ell(g, L - 2, -2.2, 2.4, 1.2, -0.1);
  g.restore();
  // 羽うちわ（左手。ゆっくりあおぐ）
  const wave = an * Math.sin(t * 2.4) * 0.22;
  g.save(); g.translate(-31, 20);
  g.fillStyle = lin(g, 'tg.robe', 0, 0, 0, 52, [[0, '#fffaf0'], [0.6, '#ece6f2'], [1, '#b9b0d6']]);
  ell(g, 4, 3, 8, 7, 0.4);
  g.rotate(-0.55 + wave);
  g.fillStyle = '#7a3a24'; g.beginPath(); rrect(g, -1.8, -14, 3.6, 16, 1.8); g.fill();
  const featherFill = lin(g, 'tg.feather', 0, -15, 0, 15, [[0, '#7c5236'], [0.28, '#e9d6b0'], [1, '#fff8ea']]);
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + (i / 8) * 2.4;
    g.save(); g.translate(0, -13); g.rotate(a); g.translate(0, -15);
    g.fillStyle = featherFill; ell(g, 0, 0, i % 2 ? 3.6 : 4, 15);
    g.restore();
  }
  g.fillStyle = '#d23b2e'; dot(g, 0, -13, 4.2); g.fillStyle = '#ffd36a'; dot(g, 0, -13, 1.8);
  g.restore();
  g.fillStyle = faceFill; dot(g, -31, 20, 5.2);
}

// ---- 狸のポン吉: まんまる・目のまわりの黒い隈・頭の葉っぱ・大きなしっぽ・手鏡
function tanuki(g, face, k) {
  const { t, an, px } = k;
  const lw = Math.max(px, 2.5);
  const fur = rad(g, 'tn.fur', -10, -22, 4, 0, 0, 56, [[0, '#f0c088'], [0.5, '#c4844a'], [0.85, '#92592f'], [1, '#6e4224']]);
  // しっぽ（後ろ、右下からふさっと）
  g.save(); g.translate(22, 34); g.rotate(-0.35 + an * Math.sin(t * 1.7) * 0.12);
  g.fillStyle = lin(g, 'tn.tail', 0, 0, 30, -26, [[0, '#a66a38'], [0.55, '#c88e56'], [0.78, '#7a4a28'], [1, '#3e2414']]);
  g.beginPath(); g.moveTo(-4, 6); g.bezierCurveTo(14, 12, 38, 0, 38, -18); g.bezierCurveTo(38, -34, 22, -36, 18, -24); g.bezierCurveTo(14, -12, 6, -6, -6, -6); g.closePath(); g.fill();
  g.restore();
  // 耳
  for (const s of [-1, 1]) {
    g.fillStyle = '#4e2e17'; ell(g, s * 24, -36, 10, 9.5, s * 0.3);
    g.fillStyle = '#c99060'; ell(g, s * 23, -34, 5.2, 4.8, s * 0.3);
  }
  // からだ（たまご形）
  g.fillStyle = fur; g.beginPath(); g.moveTo(0, -45);
  g.bezierCurveTo(27, -45, 41, -19, 41, 9); g.bezierCurveTo(41, 37, 24, 50, 0, 50);
  g.bezierCurveTo(-24, 50, -41, 37, -41, 9); g.bezierCurveTo(-41, -19, -27, -45, 0, -45); g.fill();
  g.fillStyle = 'rgba(255,240,215,.3)'; ell(g, -24, -20, 6, 11, -0.4);
  // おなか
  g.fillStyle = rad(g, 'tn.belly', -4, 16, 2, 0, 24, 26, [[0, '#fff6e2'], [0.75, '#f6e2be'], [1, '#e2c491']]);
  ell(g, 0, 25, 25, 22);
  // 足
  g.fillStyle = '#4e2e17'; for (const s of [-1, 1]) ell(g, s * 16, 49, 9.5, 5);
  // 顔: 目のまわりの隈・白い口もと
  const ex = 13, ey = -15;
  g.fillStyle = '#f7e6c8'; ell(g, 0, -4, 15, 10.5);
  g.fillStyle = rad(g, 'tn.mask', 0, -15, 2, 0, -15, 26, [[0, '#7a4a26'], [1, '#5a3418']]);
  for (const s of [-1, 1]) ell(g, s * ex, ey + 1, 11.5, 9, s * 0.38);
  g.fillStyle = '#f7e6c8'; for (const s of [-1, 1]) ell(g, s * 11, -28, 5.5, 2.6, s * 0.2); // 眉のような白い毛
  // 腹つづみの手（左）と手鏡（右）
  const drum = face === 'taunt' || face === 'joy' ? an * Math.abs(Math.sin(t * 7)) * 3 : 0;
  g.fillStyle = '#8a532a'; ell(g, -27, 13 - drum, 7.5, 9.5, 0.55);
  g.save(); g.translate(33, 16); g.rotate(0.5 + an * Math.sin(t * 1.3) * 0.08);
  g.fillStyle = '#b8323a'; g.beginPath(); rrect(g, -2.4, -15, 4.8, 15, 2.2); g.fill(); // 柄（赤いひも巻き）
  g.fillStyle = '#ffd36a'; for (const yy of [-12, -7, -2]) g.fillRect(-2.4, yy, 4.8, 1.2);
  g.fillStyle = rad(g, 'tn.rim', -3, -30, 1, 0, -26, 13, [[0, '#fff2b0'], [0.6, '#e2ae44'], [1, '#a8741c']]);
  dot(g, 0, -26, 12.5);
  g.fillStyle = rad(g, 'tn.mirror', -3, -30, 1, 0, -26, 10, [[0, '#ffffff'], [0.35, '#e6f4ff'], [1, '#8fb6e0']]);
  dot(g, 0, -26, 9.8);
  const sweep = an ? (t * 0.7) % 1 : 0.35; // 鏡の光がすっと走る
  g.save(); g.beginPath(); g.arc(0, -26, 9.8, 0, TAU); g.clip();
  g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); const sx = -14 + sweep * 28;
  g.moveTo(sx - 3, -40); g.lineTo(sx + 2, -40); g.lineTo(sx - 6, -12); g.lineTo(sx - 11, -12); g.closePath(); g.fill();
  g.restore();
  g.restore();
  g.fillStyle = '#8a532a'; ell(g, 31, 15, 7, 8.5, -0.5);
  // 葉っぱ（頭の上で、ゆらゆら）
  g.save(); g.translate(3, -43); g.rotate(0.35 + an * Math.sin(t * 2.1) * 0.16);
  g.fillStyle = lin(g, 'tn.leaf', -6, 0, 8, -24, [[0, '#3f9a3a'], [0.6, '#7ed65e'], [1, '#c8f59a']]);
  g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-12, -6, -9, -22, 2, -27); g.bezierCurveTo(11, -18, 10, -5, 0, 0); g.fill();
  g.strokeStyle = 'rgba(30,80,30,.55)'; g.lineWidth = Math.max(px, 1.3); g.beginPath(); g.moveTo(0, 2); g.quadraticCurveTo(0, -12, 2, -24); g.stroke();
  g.restore();
  // 鼻・ほっぺ
  cheeks(g, 26, -1, 6, 3.4);
  g.fillStyle = '#2a160a'; ell(g, 0, -9, 4.2, 3.1); g.fillStyle = 'rgba(255,255,255,.6)'; dot(g, -1.3, -10, 1.1);
  // 目（隈の上でも読めるように、光を大きく）
  const ew = 3.9, eh = 5.6, ink = '#160903';
  g.strokeStyle = '#1e0c04'; g.fillStyle = ink;
  for (const s of [-1, 1]) {
    const x = s * ex;
    if (face === 'joy') { g.strokeStyle = '#fff1d6'; eyeArc(g, x, ey, ew, eh, true, lw); }
    else if (face === 'blink') { g.strokeStyle = '#fff1d6'; eyeArc(g, x, ey, ew, eh, false, lw); }
    else if (face === 'taunt' && s < 0) { g.strokeStyle = '#fff1d6'; eyeWink(g, x, ey, ew, eh, s, lw); }
    else if (face === 'sad') { g.strokeStyle = '#fff1d6'; eyeSad(g, x, ey, ew, eh, -s, lw); }
    else if (face === 'wow') { g.fillStyle = '#fff6e6'; ell(g, x, ey, ew * 1.55, eh * 1.4); eyeBig(g, x, ey, ew * 0.85, eh * 0.85, ink); }
    else { g.fillStyle = 'rgba(255,240,215,.9)'; ell(g, x, ey, ew * 1.35, eh * 1.25); eyeOpen(g, x, ey, ew, eh, ink); }
  }
  if (face === 'sad') { tearDrop(g, -ex - 3, ey + 9, 3.4); tearDrop(g, ex + 4, ey + 10, 2.8); }
  const mk = { idle: 'w', taunt: 'tongue', wow: 'open', sad: 'wobble', joy: 'laugh', blink: 'w' }[face] || 'w';
  mouth(g, mk, 0, -3, mk === 'w' ? 4.6 : 5, Math.max(px, 1.9));
}

// ---- 狐のオボロ: 白い狐・高い耳・頬の毛・赤いくまどりと麻呂まゆ・赤いよだれかけ・青い狐火
function kitsune(g, face, k) {
  const { t, an, px } = k;
  const lw = Math.max(px, 2.5);
  const fur = rad(g, 'ks.fur', -8, -30, 3, 0, -10, 52, [[0, '#ffffff'], [0.55, '#f1f2ff'], [0.85, '#c9cdf6'], [1, '#9aa1e6']]);
  // 狐火の位置（後ろの 2 つはからだより先に描く）
  const wisps = [];
  for (let i = 0; i < 3; i++) {
    const a = (an ? t * 0.8 : 0.9) + (i * TAU) / 3;
    wisps.push({ x: Math.cos(a) * 47, y: 2 + Math.sin(a) * 24 + an * Math.sin(t * 2.3 + i * 2) * 2.5, d: Math.sin(a), i });
  }
  const wisp = (w) => {
    const sc = 0.78 + (w.d + 1) * 0.16, fl = an ? Math.sin(t * 9 + w.i * 2.1) * 1.4 : 0;
    g.save(); g.translate(w.x, w.y); g.scale(sc, sc);
    g.fillStyle = rad(g, 'ks.wglow', 0, 0, 1, 0, 0, 16, [[0, 'rgba(170,200,255,.6)'], [1, 'rgba(120,150,255,0)']]);
    dot(g, 0, 0, 16);
    g.fillStyle = rad(g, 'ks.wisp', 0, 2, 0.5, 0, 0, 9, [[0, '#ffffff'], [0.45, '#bcd4ff'], [1, '#6f7cf2']]);
    g.beginPath(); g.moveTo(fl, -12); g.bezierCurveTo(3, -6, 6.5, -2, 6.5, 2); g.arc(0, 2, 6.5, 0, Math.PI); g.bezierCurveTo(-6.5, -2, -3, -6, fl, -12); g.fill();
    g.restore();
  };
  for (const w of wisps) if (w.d < 0) wisp(w);
  // しっぽ（右うしろ。先は藍色）
  g.save(); g.translate(14, 44); g.rotate(an * Math.sin(t * 1.5) * 0.1);
  g.fillStyle = lin(g, 'ks.tail', 0, 0, 30, -54, [[0, '#ffffff'], [0.5, '#eef0ff'], [0.78, '#8f98ee'], [1, '#4a4fb6']]);
  g.beginPath(); g.moveTo(-8, 4); g.bezierCurveTo(30, 10, 52, -18, 42, -46); g.quadraticCurveTo(38, -60, 24, -62);
  g.quadraticCurveTo(30, -50, 22, -38); g.bezierCurveTo(16, -24, 6, -16, -8, -12); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.moveTo(4, -2); g.bezierCurveTo(26, 0, 40, -18, 36, -38); g.bezierCurveTo(32, -20, 22, -8, 4, -6); g.fill();
  g.restore();
  // からだ（すわった形）
  g.fillStyle = fur; g.beginPath(); g.moveTo(0, -8);
  g.bezierCurveTo(20, -8, 28, 18, 26, 38); g.bezierCurveTo(25, 48, 16, 51, 0, 51);
  g.bezierCurveTo(-16, 51, -25, 48, -26, 38); g.bezierCurveTo(-28, 18, -20, -8, 0, -8); g.fill();
  g.fillStyle = 'rgba(150,160,230,.35)'; for (const s of [-1, 1]) { g.beginPath(); rrect(g, s * 8 - 4.5, 30, 9, 21, 4.5); g.fill(); }
  g.fillStyle = '#ffffff'; for (const s of [-1, 1]) ell(g, s * 8, 48.5, 6, 3.6);
  // よだれかけ（赤）
  g.fillStyle = lin(g, 'ks.bib', 0, 2, 0, 28, [[0, '#ff6a50'], [1, '#c82a2a']]);
  g.beginPath(); g.moveTo(-17, 4); g.quadraticCurveTo(0, 11, 17, 4); g.quadraticCurveTo(12, 20, 0, 28); g.quadraticCurveTo(-12, 20, -17, 4); g.fill();
  g.fillStyle = '#ffd36a'; dot(g, 0, 15, 2.4);
  // 耳（ゆれる。しょげると寝る）
  const droop = face === 'sad' ? 0.42 : face === 'wow' ? -0.1 : 0;
  const twitch = an * Math.max(0, Math.sin(t * 1.1) * 10 - 9) * 0.25;
  for (const s of [-1, 1]) {
    g.save(); g.translate(s * 15, -38); g.rotate(s * (droop + (s > 0 ? twitch : 0)));
    g.fillStyle = lin(g, 'ks.ear', 0, 6, 0, -30, [[0, '#ffffff'], [0.55, '#e8eaff'], [1, '#5a60c8']]);
    g.beginPath(); g.moveTo(s * -9, 4); g.quadraticCurveTo(s * 2, -22, s * 10, -30); g.quadraticCurveTo(s * 16, -10, s * 12, 8); g.closePath(); g.fill();
    g.fillStyle = '#ff8f9c'; g.beginPath(); g.moveTo(s * -3, 2); g.quadraticCurveTo(s * 4, -15, s * 9, -20); g.quadraticCurveTo(s * 11, -7, s * 8, 4); g.closePath(); g.fill();
    g.restore();
  }
  // 頭（頬の毛が横にとがる）
  g.fillStyle = fur; g.beginPath(); g.moveTo(0, -46);
  g.bezierCurveTo(18, -46, 28, -36, 28, -24); g.lineTo(38, -13); g.quadraticCurveTo(29, -6, 23, -1); g.quadraticCurveTo(13, 8, 0, 8);
  g.quadraticCurveTo(-13, 8, -23, -1); g.quadraticCurveTo(-29, -6, -38, -13); g.lineTo(-28, -24); g.bezierCurveTo(-28, -36, -18, -46, 0, -46); g.fill();
  // くまどり（麻呂まゆと、目じりの赤）
  g.fillStyle = '#e8453c';
  for (const s of [-1, 1]) ell(g, s * 9, -34, 3.4, 2.3, s * -0.2);
  g.strokeStyle = 'rgba(232,69,60,.9)'; g.lineCap = 'round';
  const ex = 11.5, ey = -20, ew = 4.2, eh = 5.8;
  for (const s of [-1, 1]) stroke(g, Math.max(px, 2.2), [s * (ex + 4), ey - 1, s * (ex + 9), ey - 3, s * (ex + 12), ey - 9]);
  cheeks(g, 19, -8, 5.5, 3.2);
  // 目
  g.strokeStyle = INK; g.fillStyle = INK;
  const sly = (x, s) => { g.lineWidth = lw * 1.05; g.beginPath(); g.moveTo(x - s * 4.6, ey + 0.5); g.quadraticCurveTo(x + s * 0.5, ey + 3.8, x + s * 5.8, ey - 3); g.stroke(); };
  for (const s of [-1, 1]) {
    const x = s * ex;
    if (face === 'joy') eyeArc(g, x, ey, ew, eh, true, lw);
    else if (face === 'blink') eyeArc(g, x, ey + 1, ew, eh * 0.6, false, lw);
    else if (face === 'sad') eyeSad(g, x, ey, ew, eh, s, lw);
    else if (face === 'wow') eyeBig(g, x, ey, ew, eh);
    else if (face === 'taunt' && s > 0) { eyeOpen(g, x, ey, ew, eh); lid(g, x, ey, ew, eh, 0.42, 0.25, s, fur); }
    else sly(x, s);
  }
  if (face === 'sad') tearDrop(g, ex + 3, ey + 9, 3.3);
  // 鼻と口
  g.fillStyle = '#3a2a4a'; ell(g, 0, -7.5, 3.3, 2.3);
  const mk = { idle: 'w', taunt: 'smirk', wow: 'open', sad: 'frown', joy: 'laugh', blink: 'w' }[face] || 'w';
  mouth(g, mk, 0, -3.2, mk === 'w' ? 4 : 4.4, Math.max(px, 1.8));
  for (const w of wisps) if (w.d >= 0) wisp(w);
}

// ---- 鎌鼬のハヤテ: すらっとした鼬・赤いマフラー・鎌のしっぽ・まわりを回る風
function kamaitachi(g, face, k) {
  const { t, an, px } = k;
  const lw = Math.max(px, 2.5);
  const fur = rad(g, 'km.fur', -8, -30, 3, 0, -8, 54, [[0, '#d9fff2'], [0.42, '#8fe6cc'], [0.8, '#48b6a2'], [1, '#2a8580']]);
  const spin = an ? t * 2.4 : 0.6;
  const ring = (front) => { // 腰のまわりを回る風の輪（後ろ半分と前半分。角度で切り分ける）
    g.save(); g.translate(0, 22); g.scale(1, 0.32);
    g.fillStyle = front ? 'rgba(200,255,235,.55)' : 'rgba(150,240,210,.28)';
    const lo = front ? 0 : Math.PI, hi = lo + Math.PI;
    g.beginPath();
    for (let j = 0; j < 3; j++) {
      const a0 = (spin + (j * TAU) / 3) % TAU, r0 = 44 + j * 3;
      for (const base of [a0 - TAU, a0]) { // 2π をまたぐ分も見る
        const s0 = Math.max(lo, base), s1 = Math.min(hi, base + 1.5);
        if (s1 - s0 < 0.02) continue;
        g.moveTo(Math.cos(s0) * r0, Math.sin(s0) * r0);
        g.arc(0, 0, r0, s0, s1); g.arc(0, 0, r0 - 5, s1, s0, true); g.closePath();
      }
    }
    g.fill();
    g.restore();
  };
  ring(false);
  // しっぽと、その先の鎌
  const tw = an * Math.sin(t * 2.1) * 3;
  g.strokeStyle = '#4fb8a6'; g.lineCap = 'round'; g.lineWidth = 10;
  g.beginPath(); g.moveTo(10, 40); g.bezierCurveTo(40, 46, 44, 12, 34 + tw * 0.4, -6); g.stroke();
  g.strokeStyle = 'rgba(210,255,240,.5)'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(14, 39); g.bezierCurveTo(38, 42, 41, 14, 33 + tw * 0.4, -4); g.stroke();
  g.save(); g.translate(34 + tw * 0.4, -6); g.rotate(-0.15 + tw * 0.02);
  g.fillStyle = lin(g, 'km.blade', -10, -30, 10, 0, [[0, '#ffffff'], [0.45, '#dfeaf6'], [1, '#8296b0']]);
  g.beginPath(); g.moveTo(-4, 2); g.bezierCurveTo(16, -4, 18, -26, 2, -38); g.bezierCurveTo(8, -24, 4, -10, -6, -4); g.closePath(); g.fill();
  g.fillStyle = '#5a3a28'; g.beginPath(); rrect(g, -6, -3, 9, 7, 2.5); g.fill();
  g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.moveTo(6, -10); g.quadraticCurveTo(10, -20, 4, -30); g.quadraticCurveTo(8, -20, 3.5, -11); g.fill();
  g.restore();
  // からだ（細長い胴。のどから腹まで白）
  g.fillStyle = fur; g.beginPath(); g.moveTo(0, -12);
  g.bezierCurveTo(13, -12, 17, 8, 17, 24); g.bezierCurveTo(17, 40, 12, 50, 0, 50); g.bezierCurveTo(-12, 50, -17, 40, -17, 24); g.bezierCurveTo(-17, 8, -13, -12, 0, -12); g.fill();
  g.fillStyle = rad(g, 'km.belly', 0, 10, 2, 0, 20, 28, [[0, '#ffffff'], [1, '#dcf8ee']]);
  g.beginPath(); g.moveTo(0, -8); g.bezierCurveTo(8, -8, 10, 10, 10, 26); g.bezierCurveTo(10, 40, 6, 47, 0, 47); g.bezierCurveTo(-6, 47, -10, 40, -10, 26); g.bezierCurveTo(-10, 10, -8, -8, 0, -8); g.fill();
  g.fillStyle = '#3c9e92'; for (const s of [-1, 1]) ell(g, s * 9, 49.5, 7.5, 4);
  // 耳（小さく、頭の横に）
  for (const s of [-1, 1]) { g.fillStyle = '#3fa898'; dot(g, s * 22, -36, 6.8); g.fillStyle = '#ffb3c0'; dot(g, s * 22, -35, 3.5); }
  // 頭（横に広く、平たい）
  g.fillStyle = fur; g.beginPath(); g.moveTo(0, -45);
  g.bezierCurveTo(19, -45, 29, -36, 29, -25); g.bezierCurveTo(29, -14, 18, -7, 0, -7); g.bezierCurveTo(-18, -7, -29, -14, -29, -25); g.bezierCurveTo(-29, -36, -19, -45, 0, -45); g.fill();
  // 目の上の、きりっとした毛
  g.fillStyle = '#2f8a80';
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 4, -34); g.quadraticCurveTo(s * 13, -39, s * 23, -35); g.quadraticCurveTo(s * 13, -35.5, s * 4, -31); g.closePath(); g.fill(); }
  // 口もと（白く、少し前に出た鼻づら）
  g.fillStyle = '#f2fffa'; ell(g, 0, -13.5, 11.5, 7.6);
  cheeks(g, 18, -15, 5, 3);
  // 手（胸の前で、ぐっ）
  g.fillStyle = '#5cc4b0'; for (const s of [-1, 1]) ell(g, s * 10, 13, 5, 6, s * 0.3);
  // マフラー（赤。結び目から 2 本の端が風になびく）
  g.fillStyle = lin(g, 'km.scarf', 0, -6, 0, 12, [[0, '#ff6b54'], [1, '#c4262c']]);
  g.beginPath(); g.moveTo(-20, -4); g.quadraticCurveTo(0, 6, 20, -4); g.lineTo(20, 4); g.quadraticCurveTo(0, 14, -20, 4); g.closePath(); g.fill();
  for (let e = 0; e < 2; e++) {
    const n = 12, top = [], bot = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = -15 - u * (34 - e * 7), y = 4 + e * 3 - u * (10 - e * 7) + (an ? Math.sin(u * 5.5 - t * 10 + e) : Math.sin(u * 5.5 + e)) * 3.2 * u;
      const w = 3.4 - u * 1.4;
      top.push([x, y - w]); bot.push([x, y + w]);
    }
    g.beginPath(); g.moveTo(top[0][0], top[0][1]);
    for (const p of top) g.lineTo(p[0], p[1]);
    for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
    g.closePath(); g.fill();
  }
  g.fillStyle = '#d8323a'; dot(g, -16, 4, 4.5);
  // 目
  const ex = 11, ey = -25, ew = 4, eh = 5.8;
  g.strokeStyle = INK; g.fillStyle = INK;
  for (const s of [-1, 1]) {
    const x = s * ex;
    if (face === 'joy') eyeArc(g, x, ey, ew, eh, true, lw);
    else if (face === 'blink') eyeArc(g, x, ey, ew, eh, false, lw);
    else if (face === 'sad') eyeSad(g, x, ey, ew, eh, s, lw);
    else if (face === 'wow') eyeBig(g, x, ey, ew, eh);
    else if (face === 'taunt' && s < 0) eyeWink(g, x, ey, ew, eh, s, lw);
    else { eyeOpen(g, x, ey, ew, eh); lid(g, x, ey, ew, eh, face === 'taunt' ? 0.45 : 0.3, -0.45, s, fur); }
  }
  if (face === 'sad') tearDrop(g, ex + 6, ey + 9, 3.4);
  g.fillStyle = '#1f2f30'; ell(g, 0, -17.5, 3.4, 2.5); g.fillStyle = 'rgba(255,255,255,.5)'; dot(g, -1, -18.3, 0.9);
  const mk = { idle: 'grin', taunt: 'tongue', wow: 'open', sad: 'wobble', joy: 'laugh', blink: 'grin' }[face] || 'grin';
  mouth(g, mk, 0, -12.5, mk === 'grin' ? 4.2 : 4.4, Math.max(px, 1.8));
  ring(true);
  // 速さの線（動いているときだけ、左へ流れる）
  if (an) {
    g.strokeStyle = 'rgba(200,255,235,.45)'; g.lineWidth = Math.max(px, 1.6);
    for (let i = 0; i < 3; i++) {
      const u = (t * 1.7 + i / 3) % 1, yy = -30 + i * 22, xx = -34 - u * 26;
      g.globalAlpha = Math.sin(u * Math.PI); g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx - 12, yy); g.stroke();
    }
    g.globalAlpha = 1;
  }
}

// ---- 招き猫のコバン: 白い三毛・上げた手で手招き・赤い首輪と金の鈴・藍の法被・小判（星の刻印）・赤い座布団
function neko(g, face, k) {
  const { t, an, px } = k;
  const lw = Math.max(px, 2.5);
  const white = rad(g, 'nk.white', -10, -30, 3, 0, -6, 58, [[0, '#ffffff'], [0.6, '#f6f2f8'], [0.88, '#d9d2e6'], [1, '#b8afcc']]);
  // 座布団
  g.fillStyle = lin(g, 'nk.zabu', 0, 44, 0, 58, [[0, '#ff5a5a'], [1, '#a81e3a']]);
  g.beginPath(); rrect(g, -36, 44, 72, 12, 6); g.fill();
  g.fillStyle = '#ffd36a'; for (const s of [-1, 1]) dot(g, s * 35, 52, 2.6);
  // からだ（法被）
  g.save();
  g.beginPath(); g.ellipse(0, 24, 29, 26, 0, 0, TAU); g.clip();
  g.fillStyle = lin(g, 'nk.happi', 0, 0, 0, 50, [[0, '#3e56b8'], [1, '#1f2a6e']]); g.fillRect(-30, -2, 60, 52);
  g.fillStyle = white; g.beginPath(); g.moveTo(-6, 4); g.lineTo(6, 4); g.lineTo(14, 52); g.lineTo(-14, 52); g.closePath(); g.fill();
  g.fillStyle = '#f4f0ff'; // 法被のえり
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 6, 4); g.lineTo(s * 12, 4); g.lineTo(s * 21, 52); g.lineTo(s * 14, 52); g.closePath(); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(-30, 42, 60, 2.2); g.fillRect(-30, 46, 60, 1.2);
  g.restore();
  // 小判を抱えた手（左）
  g.save(); g.translate(-15, 27); g.rotate(-0.18);
  g.fillStyle = rad(g, 'nk.koban', -3, -6, 1, 0, 0, 14, [[0, '#fff6c0'], [0.5, '#ffd24a'], [1, '#c98a14']]);
  ell(g, 0, 0, 9.5, 13.5);
  g.strokeStyle = 'rgba(160,100,10,.55)'; g.lineWidth = Math.max(px, 1);
  g.beginPath(); for (const yy of [-9, -6, 6, 9]) { g.moveTo(-6, yy); g.lineTo(6, yy); } g.stroke();
  g.fillStyle = '#c98a14'; starPath(g, 0, 0.5, 5.2, 2.2); g.fill();
  g.restore();
  g.fillStyle = white; ell(g, -9, 18, 7, 6, 0.3);
  // 耳
  const flat = face === 'sad' ? 0.35 : 0;
  for (const s of [-1, 1]) {
    g.save(); g.translate(s * 18, -38); g.rotate(s * flat);
    g.fillStyle = white; g.beginPath(); g.moveTo(s * -11, 6); g.quadraticCurveTo(s * 4, -20, s * 9, -19); g.quadraticCurveTo(s * 14, -6, s * 12, 8); g.closePath(); g.fill();
    g.fillStyle = s < 0 ? '#f2a03e' : '#3a3444';
    g.beginPath(); g.moveTo(s * -2, -6); g.quadraticCurveTo(s * 5, -20, s * 9, -19); g.quadraticCurveTo(s * 13, -8, s * 12, 2); g.closePath(); g.fill();
    g.fillStyle = '#ffb8c6'; g.beginPath(); g.moveTo(s * -5, 4); g.quadraticCurveTo(s * 4, -12, s * 8, -13); g.quadraticCurveTo(s * 10, -4, s * 8, 6); g.closePath(); g.fill();
    g.restore();
  }
  // 頭と三毛のぶち
  g.save(); g.beginPath(); g.ellipse(0, -17, 32, 27, 0, 0, TAU);
  g.fillStyle = white; g.fill(); g.clip();
  g.fillStyle = '#f2a03e'; ell(g, -22, -38, 17, 13, 0.3);
  g.fillStyle = '#3a3444'; ell(g, 26, -40, 12, 11, -0.3);
  g.restore();
  // 首輪と鈴
  g.fillStyle = '#e23a3a'; g.beginPath(); g.moveTo(-21, 4); g.quadraticCurveTo(0, 12, 21, 4); g.lineTo(21, 8); g.quadraticCurveTo(0, 16, -21, 8); g.closePath(); g.fill();
  g.save(); g.translate(0, 15); g.rotate(an ? Math.sin(t * 3.6 + 0.6) * 0.12 : 0);
  g.fillStyle = rad(g, 'nk.bell', -2, -2, 0.5, 0, 0, 7, [[0, '#fff7c8'], [0.5, '#ffcf3a'], [1, '#b8780c']]); dot(g, 0, 0, 6);
  g.strokeStyle = '#7a4a08'; g.lineWidth = Math.max(px, 1.2); g.beginPath(); g.moveTo(-5.4, 0.6); g.lineTo(5.4, 0.6); g.moveTo(0, 0.6); g.lineTo(0, 5); g.stroke();
  g.restore();
  // 顔
  const ex = 12.5, ey = -18, ew = 4.3, eh = 6.2;
  cheeks(g, 21, -7, 6, 3.4);
  g.strokeStyle = 'rgba(58,22,6,.45)'; g.lineWidth = Math.max(px * 0.8, 1);
  g.beginPath(); for (const s of [-1, 1]) for (const d of [-2.5, 2]) { g.moveTo(s * 18, -8 + d * 0.6); g.lineTo(s * 31, -10 + d * 1.6); } g.stroke();
  g.strokeStyle = INK; g.fillStyle = INK;
  for (const s of [-1, 1]) {
    const x = s * ex;
    if (face === 'joy') eyeArc(g, x, ey, ew, eh, true, lw);
    else if (face === 'blink') eyeArc(g, x, ey, ew, eh, false, lw);
    else if (face === 'sad') eyeSad(g, x, ey, ew, eh, s, lw);
    else if (face === 'wow') { eyeBig(g, x, ey, ew, eh); g.fillStyle = '#ffd24a'; starPath(g, x + ew * 0.2, ey + eh * 0.15, ew * 0.75, ew * 0.32); g.fill(); g.fillStyle = INK; }
    else if (face === 'taunt' && s > 0) eyeWink(g, x, ey, ew, eh, s, lw);
    else eyeOpen(g, x, ey, ew, eh);
  }
  if (face === 'sad') tearDrop(g, ex + 9, ey - 6, 3.6);
  g.fillStyle = '#ff8fa6'; g.beginPath(); g.moveTo(-2.8, -11); g.lineTo(2.8, -11); g.lineTo(0, -8.4); g.closePath(); g.fill();
  const mk = { idle: 'w', taunt: 'w', wow: 'open', sad: 'frown', joy: 'laugh', blink: 'w' }[face] || 'w';
  mouth(g, mk, 0, -6.5, mk === 'w' ? 4.4 : 4.6, Math.max(px, 1.8));
  // 上げた手（右。顔の横で手まねき）
  const beck = an ? Math.sin(t * 3.6) : 0;
  g.save(); g.translate(25, 8); g.rotate(0.26 + beck * 0.14);
  g.fillStyle = lin(g, 'nk.sleeve', 0, 0, 0, -24, [[0, '#24337e'], [1, '#4a64cc']]);
  g.beginPath(); rrect(g, -8.5, -22, 17, 27, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(-8.5, -20, 17, 2);
  g.fillStyle = white; g.save(); g.translate(0, -30); g.scale(1, 1 - Math.max(0, beck) * 0.2);
  ell(g, 0, 0, 9.8, 10.2);
  g.fillStyle = '#ffadc0'; ell(g, 0, 2, 4.2, 3.2); for (const [xx, yy] of [[-4.8, -3.6], [0, -5.8], [4.8, -3.6]]) dot(g, xx, yy, 1.9);
  g.restore(); g.restore();
}
function starPath(g, x, y, R, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath();
}
const DRAW = { tengu, tanuki, kitsune, kamaitachi, neko };

// ---------------------------------------------------------------- ヒノコのからだに合わせる
// hinoko.js と同じ計算で、息づかい（伸び縮み）と炎の先のゆれを再現する。r を 1 とした座標にして返す
function hinoFrame(g, x, y, r, o) {
  const { t = 0, still = false, dir = null, stretch = 0 } = o;
  g.translate(x, y);
  const lean = dir !== null ? -Math.cos(dir) * Math.min(1, stretch) : 0;
  if (!still && dir === null) { const b = Math.sin(t * 3.2) * 0.045; g.translate(0, r * b * 0.6); g.scale(1 + b, 1 - b); }
  g.scale(r, r);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const flick = still ? 0 : Math.sin(t * 5.3) * 0.22 + Math.sin(t * 8.1) * 0.08;
  return { sway: lean * 1.25 + flick * (1 - Math.abs(lean) * 0.5), tipY: -(2.05 - Math.abs(lean) * 0.35), px: 1 / Math.max(0.01, r) };
}
function hinoPath(g, f) {
  const sw = f.sway;
  g.beginPath(); g.moveTo(sw, f.tipY);
  g.bezierCurveTo(0.35 + sw * 0.5, -1.35, 1.02, -0.7, 1, 0); g.arc(0, 0, 1, 0, Math.PI, false);
  g.bezierCurveTo(-1.02, -0.7, -0.35 + sw * 0.5, -1.35, sw, f.tipY); g.closePath();
}
const bz = (a, b, c, d, u) => (1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * b + 3 * (1 - u) * u * u * c + u ** 3 * d;
// 高さ y での、からだの中心の x と半分の幅
function hinoAt(f, y) {
  if (y >= 0) return { cx: 0, hw: Math.sqrt(Math.max(0, 1 - y * y)) };
  let lo = 0, hi = 1;
  for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (bz(f.tipY, -1.35, -0.7, 0, m) < y) lo = m; else hi = m; }
  const sw = f.sway, xr = bz(sw, 0.35 + 0.5 * sw, 1.02, 1, lo), xl = bz(sw, -0.35 + 0.5 * sw, -1.02, -1, lo);
  return { cx: (xr + xl) / 2, hw: (xr - xl) / 2 };
}
// 小物を持つ小さな手（からだと同じ炎の色）
function hand(g, x, y, pal, key) {
  g.fillStyle = rad(g, `hand.${key}`, -0.05, -0.06, 0.01, 0, 0, 0.2, [[0, pal[0]], [0.5, pal[1]], [1, pal[2]]]);
  ell(g, x, y, 0.16, 0.145);
}

// ---------------------------------------------------------------- 着せかえ
// opts: t, still, dir, stretch（drawHinoko に渡したのと同じ値を渡すと、息づかいや走るときのなびきに合う）
export function drawOutfit(g, id, x, y, r, opts = {}) {
  const fn = OUTFIT_DRAW[id];
  if (!fn || !(r > 0)) return;
  g.save();
  const f = hinoFrame(g, x, y, r, opts);
  fn(g, f, opts.t || 0, opts.still ? 0 : 1);
  g.restore();
}
const OUTFIT_DRAW = {
  // はちまき: 額に白い布と赤い日の丸。右で結んで、端がなびく
  hachimaki(g, f, t, an) {
    const yc = -0.5, a = hinoAt(f, yc), hw = a.hw + 0.04;
    const band = (dy) => { g.moveTo(a.cx - hw, yc - 0.1 + dy); g.quadraticCurveTo(a.cx, yc + 0.06 + dy, a.cx + hw, yc - 0.1 + dy); };
    g.save(); hinoPath(g, f); g.clip();
    g.fillStyle = lin(g, 'o.hachi', -1, 0, 1, 0, [[0, '#d9dcf0'], [0.25, '#ffffff'], [0.75, '#ffffff'], [1, '#d9dcf0']]);
    g.beginPath(); band(-0.13); g.lineTo(a.cx + hw, yc + 0.03); g.quadraticCurveTo(a.cx, yc + 0.19, a.cx - hw, yc + 0.03); g.closePath(); g.fill();
    g.fillStyle = '#e8352c'; ell(g, a.cx, yc - 0.035, 0.105, 0.1);
    g.restore();
    // 結び目となびく端
    const kx = a.cx + a.hw * 0.86, ky = yc - 0.06;
    for (let e = 0; e < 2; e++) {
      const top = [], bot = [], n = 8;
      for (let i = 0; i <= n; i++) {
        const u = i / n, wv = (an ? Math.sin(u * 4 - t * 7 + e * 1.3) : Math.sin(u * 4 + e)) * 0.07 * u;
        const xx = kx + u * (0.55 - e * 0.12), yy = ky + u * (0.18 + e * 0.22) + wv, w = 0.075 - u * 0.025;
        top.push([xx, yy - w]); bot.push([xx, yy + w]);
      }
      g.fillStyle = e ? '#e6e8f6' : '#ffffff';
      g.beginPath(); g.moveTo(top[0][0], top[0][1]); for (const q of top) g.lineTo(q[0], q[1]);
      for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]); g.closePath(); g.fill();
    }
    g.fillStyle = '#ffffff'; ell(g, kx, ky, 0.11, 0.09);
  },
  // 狐のお面: 頭の横に斜めにかけた、白い狐の面
  omen(g, f, t, an) {
    const a = hinoAt(f, -0.85);
    g.save(); g.translate(a.cx - a.hw * 0.95, -0.82); g.rotate(-0.42 + (an ? Math.sin(t * 2) * 0.03 : 0)); g.scale(0.5, 0.5);
    // ひも（頭のうしろへ回る）
    g.strokeStyle = '#d8322a'; g.lineWidth = 0.11; g.beginPath(); g.moveTo(0.72, -0.05); g.quadraticCurveTo(1.05, 0.05, 1.25, 0.32); g.stroke();
    // 耳
    for (const s of [-1, 1]) {
      g.fillStyle = '#f6f2ea'; g.beginPath(); g.moveTo(s * 0.25, -0.55); g.lineTo(s * 0.62, -1.15); g.lineTo(s * 0.78, -0.35); g.closePath(); g.fill();
      g.fillStyle = '#e8453c'; g.beginPath(); g.moveTo(s * 0.4, -0.55); g.lineTo(s * 0.6, -0.92); g.lineTo(s * 0.68, -0.48); g.closePath(); g.fill();
    }
    // 面
    g.fillStyle = rad(g, 'o.omen', -0.25, -0.35, 0.05, 0, -0.1, 1.05, [[0, '#ffffff'], [0.7, '#f3eee4'], [1, '#d5cdbd']]);
    g.beginPath(); g.moveTo(0, -0.75); g.bezierCurveTo(0.6, -0.75, 0.85, -0.35, 0.82, -0.05); g.quadraticCurveTo(0.6, 0.45, 0, 0.9); g.quadraticCurveTo(-0.6, 0.45, -0.82, -0.05); g.bezierCurveTo(-0.85, -0.35, -0.6, -0.75, 0, -0.75); g.fill();
    // くまどりと目
    g.strokeStyle = '#e8453c'; g.lineWidth = 0.1;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.12, -0.22); g.quadraticCurveTo(s * 0.4, -0.38, s * 0.6, -0.12); g.stroke(); }
    g.fillStyle = '#e8453c'; for (const s of [-1, 1]) ell(g, s * 0.2, -0.5, 0.09, 0.06);
    g.strokeStyle = '#2a1a1a'; g.lineWidth = 0.075;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.15, -0.08); g.quadraticCurveTo(s * 0.33, -0.02, s * 0.5, -0.15); g.stroke(); }
    g.fillStyle = '#2a1a1a'; ell(g, 0, 0.52, 0.09, 0.07);
    g.fillStyle = '#ffd36a'; ell(g, 0, -0.52, 0.06, 0.08);
    g.restore();
  },
  // 花かんざし: 右上につまみ細工の花。下がり（ビラ）がゆれる
  kanzashi(g, f, t, an) {
    const a = hinoAt(f, -0.9), fx = a.cx + a.hw * 0.72, fy = -0.9;
    // 下がり（金の糸と小さな花びら）
    for (let i = 0; i < 3; i++) {
      const sw = an ? Math.sin(t * 2.6 + i * 0.7) * 0.07 : 0, x0 = fx + 0.08 + i * 0.1, len = 0.4 + i * 0.16;
      g.strokeStyle = '#ffd36a'; g.lineWidth = 0.04; g.beginPath(); g.moveTo(x0, fy + 0.12); g.lineTo(x0 + sw, fy + 0.12 + len); g.stroke();
      g.fillStyle = i === 1 ? '#ffffff' : '#ff8fb8'; ell(g, x0 + sw, fy + 0.18 + len, 0.065, 0.085);
    }
    // 小さい花（白）と葉
    g.fillStyle = '#5fbf6a'; ell(g, fx - 0.36, fy + 0.16, 0.17, 0.075, -0.6);
    flower(g, fx + 0.3, fy + 0.2, 0.2, '#ffffff', '#ffd36a', 'o.kz2');
    flower(g, fx, fy, 0.36, '#ff6fa6', '#ffe08a', 'o.kz1');
  },
  // うちわ: 右手に。藍の紙に白い花火。ゆっくりあおぐ
  uchiwa(g, f, t, an) {
    const hx = 0.96, hy = 0.3;
    g.save(); g.translate(hx, hy); g.rotate(0.3 + (an ? Math.sin(t * 3.4) * 0.16 : 0));
    g.fillStyle = '#d9b26a'; g.beginPath(); rrect(g, -0.045, -0.42, 0.09, 0.54, 0.04); g.fill();
    g.translate(0, -0.86);
    g.fillStyle = '#f0d8a0'; dot(g, 0, 0, 0.5);
    g.fillStyle = rad(g, 'o.uchiwa', -0.15, -0.15, 0.02, 0, 0, 0.48, [[0, '#4f68d6'], [1, '#22307e']]); dot(g, 0, 0, 0.46);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 0.02; g.beginPath();
    for (let i = 0; i < 9; i++) { const aa = Math.PI * 0.5 + (i - 4) * 0.36; g.moveTo(0, 0.46); g.lineTo(Math.cos(aa + Math.PI) * 0.46, 0.46 - Math.sin(aa) * 0.9); } g.stroke();
    // 白い花火（菊）
    g.strokeStyle = '#ffffff'; g.lineWidth = 0.045; g.beginPath();
    for (let i = 0; i < 12; i++) { const aa = (i / 12) * TAU; g.moveTo(-0.04 + Math.cos(aa) * 0.08, -0.05 + Math.sin(aa) * 0.08); g.lineTo(-0.04 + Math.cos(aa) * 0.26, -0.05 + Math.sin(aa) * 0.26); } g.stroke();
    g.fillStyle = '#ff7a8a'; for (let i = 0; i < 12; i++) { const aa = (i / 12) * TAU + 0.26; dot(g, -0.04 + Math.cos(aa) * 0.33, -0.05 + Math.sin(aa) * 0.33, 0.035); }
    g.fillStyle = '#ffd36a'; dot(g, -0.04, -0.05, 0.06);
    g.restore();
    hand(g, hx, hy, HINO_BODY, 'hino');
  },
  // 金魚: 左手に、水の入った袋。中で金魚が泳ぐ
  kingyo(g, f, t, an) {
    const hx = -0.98, hy = 0.32;
    g.save(); g.translate(hx, hy); g.rotate(an ? Math.sin(t * 1.9) * 0.12 : 0.05);
    g.strokeStyle = '#ff5a6a'; g.lineWidth = 0.035; g.beginPath(); g.moveTo(0, 0); g.lineTo(-0.06, 0.28); g.moveTo(0, 0); g.lineTo(0.06, 0.28); g.stroke();
    g.translate(0, 0.3);
    const bag = () => { g.beginPath(); g.moveTo(-0.05, 0); g.bezierCurveTo(-0.2, 0.1, -0.42, 0.38, -0.42, 0.66); g.bezierCurveTo(-0.42, 0.95, -0.2, 1.04, 0, 1.04); g.bezierCurveTo(0.2, 1.04, 0.42, 0.95, 0.42, 0.66); g.bezierCurveTo(0.42, 0.38, 0.2, 0.1, 0.05, 0); g.closePath(); };
    g.fillStyle = 'rgba(220,245,255,.3)'; bag(); g.fill();
    g.save(); bag(); g.clip();
    const lv = 0.36 + (an ? Math.sin(t * 2.4) * 0.025 : 0);
    g.fillStyle = lin(g, 'o.water', 0, 0.3, 0, 1.05, [[0, 'rgba(200,245,255,.72)'], [1, 'rgba(110,195,255,.72)']]);
    g.fillRect(-0.5, lv, 1, 0.8);
    g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(-0.5, lv - 0.012, 1, 0.024);
    // 金魚（左右に泳いで、向きを変える）
    const sx = an ? Math.sin(t * 1.1) : 0.4, dirx = an ? (Math.cos(t * 1.1) >= 0 ? 1 : -1) : 1;
    g.save(); g.translate(sx * 0.14, 0.7 + (an ? Math.sin(t * 2.2) * 0.04 : 0)); g.scale(dirx, 1);
    const wag = an ? Math.sin(t * 9) * 0.2 : 0;
    g.fillStyle = 'rgba(255,120,80,.85)'; g.beginPath(); g.moveTo(-0.08, 0); g.quadraticCurveTo(-0.22, -0.16 + wag * 0.3, -0.3, -0.1 + wag * 0.5); g.quadraticCurveTo(-0.24, 0, -0.3, 0.12 + wag * 0.5); g.quadraticCurveTo(-0.22, 0.14 + wag * 0.3, -0.08, 0); g.fill();
    g.fillStyle = rad(g, 'o.fish', 0.04, -0.03, 0.01, 0, 0, 0.14, [[0, '#ffd08a'], [0.5, '#ff5a2a'], [1, '#d8281e']]);
    ell(g, 0.02, 0, 0.13, 0.085);
    g.fillStyle = '#2a0a0a'; dot(g, 0.09, -0.02, 0.022);
    g.restore();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 0.035; g.beginPath(); g.moveTo(-0.3, 0.45); g.quadraticCurveTo(-0.36, 0.66, -0.28, 0.85); g.stroke();
    g.fillStyle = '#ff5a6a'; ell(g, 0, 0.01, 0.07, 0.045);
    g.restore();
    hand(g, hx, hy, HINO_BODY, 'hino');
  },
  // 王冠: 炎の頭に金の冠。先は冠の中から出る
  kanmuri(g, f, t, an) {
    const yb = -1.0, a = hinoAt(f, yb), hb = a.hw + 0.06;
    g.save(); g.translate(a.cx, yb); g.rotate(f.sway * 0.18 - 0.08);
    const H = 0.42, ht = hb * 0.92;
    g.fillStyle = lin(g, 'o.crown', 0, -H, 0, 0.08, [[0, '#fff6b8'], [0.45, '#ffd043'], [1, '#c9870c']]);
    g.beginPath(); g.moveTo(-hb, 0.02); g.quadraticCurveTo(0, 0.12, hb, 0.02);
    g.lineTo(ht, -H * 0.62);
    const n = 5;
    for (let i = n - 1; i >= 0; i--) {
      const xx = -ht + (i / (n - 1)) * 2 * ht, tipY = i === 2 ? -H : -H * 0.86;
      g.lineTo(xx, tipY);
      if (i > 0) g.lineTo(xx - ht / (n - 1), -H * 0.42);
    }
    g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(-hb + 0.05, -0.08); g.quadraticCurveTo(0, 0.0, hb - 0.05, -0.08); g.lineTo(hb - 0.05, -0.14); g.quadraticCurveTo(0, -0.06, -hb + 0.05, -0.14); g.fill();
    for (let i = 0; i < n; i++) { const xx = -ht + (i / (n - 1)) * 2 * ht; g.fillStyle = '#fff8d8'; dot(g, xx, (i === 2 ? -H : -H * 0.86) - 0.02, 0.05); }
    g.fillStyle = '#e8304a'; ell(g, 0, -0.1, 0.07, 0.08);
    g.fillStyle = '#4aa8ff'; for (const s of [-1, 1]) ell(g, s * hb * 0.55, -0.08, 0.045, 0.055);
    // きらり（ときどき光る）
    const tw = an ? Math.max(0, Math.sin(t * 2.2)) ** 6 : 0.8;
    if (tw > 0.02) {
      const gx = ht * 0.45, gy = -H * 0.55, k = 0.16 * tw;
      g.fillStyle = `rgba(255,255,240,${tw})`; g.beginPath();
      g.moveTo(gx, gy - k); g.quadraticCurveTo(gx, gy, gx + k, gy); g.quadraticCurveTo(gx, gy, gx, gy + k); g.quadraticCurveTo(gx, gy, gx - k, gy); g.quadraticCurveTo(gx, gy, gx, gy - k); g.fill();
    }
    g.restore();
  },
};
function flower(g, x, y, R, col, core, key) {
  g.save(); g.translate(x, y);
  g.fillStyle = rad(g, key, 0, 0, R * 0.1, 0, 0, R, [[0, '#ffffff'], [0.35, col], [1, col]]);
  for (let i = 0; i < 5; i++) {
    g.save(); g.rotate((i / 5) * TAU - Math.PI / 2); g.beginPath();
    g.moveTo(0, 0); g.quadraticCurveTo(R * 0.55, -R * 0.35, R, 0); g.quadraticCurveTo(R * 0.55, R * 0.35, 0, 0); g.fill();
    g.restore();
  }
  g.fillStyle = core; dot(g, 0, 0, R * 0.22);
  g.restore();
}

// ---------------------------------------------------------------- 花火合戦の相手の小物
// opts: t, still, dir, stretch（drawHinoko と同じ）, body（からだの色。省けば core の RIVALS と同じ色）
export function drawRivalGear(g, id, x, y, r, opts = {}) {
  const fn = GEAR_DRAW[id];
  if (!fn || !(r > 0)) return;
  g.save();
  const f = hinoFrame(g, x, y, r, opts);
  fn(g, f, opts.t || 0, opts.still ? 0 : 1, opts.body || RIVAL_BODY[id]);
  g.restore();
}
const GEAR_DRAW = {
  // チビ火: 若葉マーク（見習い）と、ほっぺのばんそうこう
  chibi(g, f) {
    const a = hinoAt(f, -0.62);
    g.save(); g.translate(a.cx - a.hw * 0.72, -0.62); g.rotate(-0.28); g.scale(0.36, 0.36);
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.beginPath(); g.moveTo(-0.62, -0.72); g.lineTo(0, -0.42); g.lineTo(0.62, -0.72); g.lineTo(0.62, 0.22); g.lineTo(0, 0.82); g.lineTo(-0.62, 0.22); g.closePath(); g.fill();
    g.fillStyle = '#ffd400'; g.beginPath(); g.moveTo(-0.5, -0.52); g.lineTo(-0.04, -0.3); g.lineTo(-0.04, 0.62); g.lineTo(-0.5, 0.16); g.closePath(); g.fill();
    g.fillStyle = '#1fa64a'; g.beginPath(); g.moveTo(0.5, -0.52); g.lineTo(0.04, -0.3); g.lineTo(0.04, 0.62); g.lineTo(0.5, 0.16); g.closePath(); g.fill();
    g.restore();
    g.save(); g.translate(0.6, 0.36); g.rotate(-0.55);
    g.fillStyle = '#ffe3c2'; g.beginPath(); rrect(g, -0.21, -0.075, 0.42, 0.15, 0.075); g.fill();
    g.fillStyle = '#f0bf8e'; g.fillRect(-0.06, -0.075, 0.12, 0.15);
    g.restore();
  },
  // シズク: 頭のリボンと、手に持った線香花火（火の玉から松葉の火花）
  shizuku(g, f, t, an, pal) {
    const a = hinoAt(f, -0.95);
    g.save(); g.translate(a.cx - a.hw * 0.62, -0.98); g.rotate(-0.35);
    g.fillStyle = lin(g, 'r.ribbon', 0, -0.3, 0, 0.3, [[0, '#ffd2ec'], [1, '#ff6fb4']]);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * 0.18, -0.34, s * 0.5, -0.3, s * 0.46, 0); g.bezierCurveTo(s * 0.5, 0.26, s * 0.18, 0.28, 0, 0); g.fill(); }
    g.beginPath(); g.moveTo(-0.05, 0.04); g.lineTo(-0.2, 0.42); g.lineTo(-0.08, 0.38); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(0.05, 0.04); g.lineTo(0.16, 0.44); g.lineTo(0.24, 0.34); g.closePath(); g.fill();
    g.fillStyle = '#ff5aa0'; ell(g, 0, 0, 0.1, 0.09);
    g.restore();
    // 線香花火（右手から垂らす）
    const hx = 0.95, hy = 0.32, sw = an ? Math.sin(t * 1.6) * 0.05 : 0;
    const bx = hx + 0.22 + sw, by = hy + 0.82;
    g.strokeStyle = '#7a4fd0'; g.lineWidth = 0.05; g.beginPath(); g.moveTo(hx + 0.02, hy); g.quadraticCurveTo(hx + 0.08, hy + 0.45, bx, by - 0.06); g.stroke();
    g.strokeStyle = '#ff8fc8'; g.lineWidth = 0.025; g.setLineDash([0.05, 0.06]); g.stroke(); g.setLineDash([]);
    g.fillStyle = rad(g, 'r.spglow', 0, 0, 0.01, 0, 0, 0.5, [[0, 'rgba(255,190,90,.6)'], [1, 'rgba(255,140,40,0)']]);
    g.save(); g.translate(bx, by); dot(g, 0, 0, 0.5);
    g.fillStyle = rad(g, 'r.spball', -0.02, -0.02, 0.005, 0, 0, 0.09, [[0, '#fffbe0'], [0.5, '#ffb03a'], [1, '#ff5a1a']]); dot(g, 0, 0, 0.085);
    // 松葉の火花（細い線が枝分かれする）
    g.strokeStyle = '#ffd88a'; g.lineWidth = 0.022;
    const seed = an ? Math.floor(t * 12) : 3;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const h1 = hash(seed * 7 + i), aa = h1 * TAU, L = 0.18 + hash(seed * 13 + i) * 0.22;
      const ex = Math.cos(aa) * L, ey = Math.sin(aa) * L;
      g.moveTo(Math.cos(aa) * 0.1, Math.sin(aa) * 0.1); g.lineTo(ex, ey);
      for (const d of [-0.6, 0.6]) { g.moveTo(ex * 0.7, ey * 0.7); g.lineTo(ex * 0.7 + Math.cos(aa + d) * 0.09, ey * 0.7 + Math.sin(aa + d) * 0.09); }
    }
    g.stroke();
    g.restore();
    hand(g, hx, hy, pal, `r.${pal[1]}`);
  },
  // ドン: ねじりはちまき（前で結ぶ）と、太いひげ
  don(g, f) {
    const yc = -0.52, a = hinoAt(f, yc), hw = a.hw + 0.05;
    const band = (dy) => { g.beginPath(); g.moveTo(a.cx - hw, yc - 0.12 + dy); g.quadraticCurveTo(a.cx, yc + 0.04 + dy, a.cx + hw, yc - 0.12 + dy); g.lineTo(a.cx + hw, yc + 0.07 + dy); g.quadraticCurveTo(a.cx, yc + 0.23 + dy, a.cx - hw, yc + 0.07 + dy); g.closePath(); };
    g.save(); hinoPath(g, f); g.clip();
    g.fillStyle = 'rgba(0,50,25,.28)'; band(0.06); g.fill();
    g.fillStyle = '#f4f6ff'; band(0); g.fill(); g.save(); g.clip();
    g.strokeStyle = '#2348a8'; g.lineWidth = 0.085;
    g.beginPath();
    for (let i = -7; i <= 7; i++) { const xx = a.cx + i * 0.15, k = 1 - (i * 0.15 / hw) ** 2, yy = yc - 0.03 + 0.08 * Math.max(0, k); g.moveTo(xx - 0.08, yy - 0.11); g.lineTo(xx + 0.08, yy + 0.11); }
    g.stroke(); g.restore();
    g.restore();
    // 前の結び目（両端がぴんと立つ）
    g.save(); g.translate(a.cx + 0.18, yc + 0.02);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(-0.02, -0.04); g.quadraticCurveTo(-0.16, -0.28, -0.08, -0.36); g.quadraticCurveTo(0.0, -0.22, 0.06, -0.04); g.fill();
    g.beginPath(); g.moveTo(0.02, -0.04); g.quadraticCurveTo(0.2, -0.24, 0.24, -0.16); g.quadraticCurveTo(0.14, -0.08, 0.08, 0.02); g.fill();
    g.strokeStyle = '#2a5ab8'; g.lineWidth = 0.05; g.beginPath();
    g.moveTo(-0.1, -0.12); g.lineTo(-0.02, -0.16); g.moveTo(-0.12, -0.24); g.lineTo(-0.05, -0.28);
    g.moveTo(0.1, -0.08); g.lineTo(0.13, -0.15); g.moveTo(0.17, -0.14); g.lineTo(0.2, -0.2); g.stroke();
    g.fillStyle = '#ffffff'; dot(g, 0.01, -0.01, 0.1);
    g.fillStyle = '#2a5ab8'; ell(g, 0.01, -0.01, 0.1, 0.035, 0.8);
    g.restore();
    // ひげ
    g.fillStyle = rad(g, 'r.mus', 0, -0.05, 0.02, 0, 0, 0.45, [[0, '#4a4040'], [1, '#1c1616']]);
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(s * 0.03, 0.33);
      g.bezierCurveTo(s * 0.15, 0.22, s * 0.38, 0.24, s * 0.46, 0.34);
      g.quadraticCurveTo(s * 0.52, 0.42, s * 0.6, 0.38);
      g.quadraticCurveTo(s * 0.52, 0.52, s * 0.36, 0.48);
      g.bezierCurveTo(s * 0.24, 0.46, s * 0.12, 0.44, s * 0.03, 0.4); g.closePath(); g.fill();
    }
  },
  // カラクリ: 右目の片めがね（金のくさり）と、背中のねじ巻き
  karakuri(g, f, t, an) {
    const turn = an ? t * 3 : 0.6, c = Math.cos(turn);
    g.save(); g.translate(-0.98, 0.05);
    g.fillStyle = '#b8862e'; g.beginPath(); rrect(g, -0.32, -0.05, 0.34, 0.1, 0.03); g.fill();
    g.translate(-0.36, 0); g.scale(1, Math.max(0.12, Math.abs(c)));
    g.fillStyle = lin(g, 'r.key', 0, -0.3, 0, 0.3, [[0, '#fff0b0'], [0.5, '#e8b44a'], [1, '#9a6a1a']]);
    for (const s of [-1, 1]) ell(g, -0.04, s * 0.17, 0.12, 0.15);
    g.fillStyle = 'rgba(40,24,8,.55)'; for (const s of [-1, 1]) ell(g, -0.04, s * 0.17, 0.045, 0.06);
    g.restore();
    // 片めがね
    const mx = 0.36, my = 0.12;
    g.fillStyle = 'rgba(210,240,255,.25)'; dot(g, mx, my, 0.27);
    g.strokeStyle = lin(g, 'r.mono', 0, -0.3, 0, 0.3, [[0, '#fff2b0'], [1, '#c08a1e']]); g.lineWidth = 0.075;
    g.beginPath(); g.arc(mx, my, 0.27, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 0.04; g.beginPath(); g.arc(mx, my, 0.18, -2.6, -1.7); g.stroke();
    g.strokeStyle = '#e8c06a'; g.lineWidth = 0.025; g.setLineDash([0.035, 0.03]);
    g.beginPath(); g.moveTo(mx + 0.2, my + 0.18); g.quadraticCurveTo(0.68, 0.62, 0.84, 0.5); g.stroke(); g.setLineDash([]);
  },
  // ツキカゲ: 頭の三日月の飾りと、なびく藍のマフラー
  tsukikage(g, f, t, an) {
    const a = hinoAt(f, -0.95);
    g.save(); g.translate(a.cx - a.hw * 0.55, -1.0); g.rotate(-0.5);
    g.fillStyle = rad(g, 'r.moon', -0.05, -0.05, 0.01, 0, 0, 0.3, [[0, '#fffbe0'], [0.6, '#ffe07a'], [1, '#e0a83a']]);
    crescent(g, 0.26, 0.11, -0.06, 0.21); g.fill();
    g.restore();
    g.fillStyle = '#fff6c0'; starPath(g, a.cx - a.hw * 0.05, -1.22, 0.08, 0.035); g.fill();
    // マフラー
    const yc = 0.68;
    g.fillStyle = lin(g, 'r.scarf', 0, 0.5, 0, 0.9, [[0, '#5a68d8'], [1, '#262c78']]);
    for (let e = 0; e < 2; e++) {
      const n = 10, top = [], bot = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n, wv = (an ? Math.sin(u * 5 - t * 6 + e * 1.4) : Math.sin(u * 5 + e)) * 0.08 * u;
        const xx = -0.62 - u * (0.95 - e * 0.25), yy = yc - 0.02 + e * 0.12 - u * (0.25 - e * 0.15) + wv, w = 0.12 - u * 0.04;
        top.push([xx, yy - w]); bot.push([xx, yy + w]);
      }
      g.beginPath(); g.moveTo(top[0][0], top[0][1]); for (const q of top) g.lineTo(q[0], q[1]);
      for (let i = bot.length - 1; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]); g.closePath(); g.fill();
    }
    g.save(); hinoPath(g, f); g.clip();
    g.beginPath(); g.moveTo(-1.1, yc - 0.16); g.quadraticCurveTo(0, yc + 0.02, 1.1, yc - 0.16); g.lineTo(1.1, yc + 0.12); g.quadraticCurveTo(0, yc + 0.3, -1.1, yc + 0.12); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,240,180,.85)'; for (const xx of [-0.5, -0.1, 0.3, 0.7]) dot(g, xx, yc - 0.02 + 0.08 * (1 - xx * xx), 0.035);
    g.restore();
    g.fillStyle = '#2f3890'; ell(g, -0.66, yc, 0.12, 0.11);
  },
};
