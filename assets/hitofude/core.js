// 一筆花火 — 線を1本ひくと、それが導火線になる。純関数と、決定的なシミュレーションだけを置く
// （DOM・音・storage に触らない）。ページは hitofude.html、テストは tests/hitofude_core_test.mjs。
//
// 座標は W×H の論理単位。シミュレーションは 1/60 秒ずつ進め、同じ夜・同じ線なら必ず同じ結果になる
// （挑戦状と再生リンクは、これを前提にしている）。

export const W = 360;
export const H = 640;
export const DT = 1 / 60;
export const NIGHTS = 8;

// ---------------------------------------------------------------- 乱数・日付・月
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function rng32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DAY_MS = 86400000;
function keyToUTC(key) { return Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)); }
// お題は日本時間の 0 時で切り替わる
export function jstDateKey(date) { return new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
export const FIRST_DAY = '2026-09-26';
export function dayNumber(key) { return Math.round((keyToUTC(key) - keyToUTC(FIRST_DAY)) / DAY_MS) + 1; }
export function addDays(key, n) { return new Date(keyToUTC(key) + n * DAY_MS).toISOString().slice(0, 10); }
// その日の 21 時（日本時間）の月齢。0 = 新月、0.5 = 満月
export function moonPhase(key) {
  const jd = (keyToUTC(key) + 12 * 3600 * 1000) / DAY_MS + 2440587.5;
  const p = ((jd - 2451550.26) / 29.530588853) % 1;
  return p < 0 ? p + 1 : p;
}

// 今夜の月で、ルールが 1 つ変わる。番号は挑戦状に入るので並びを変えない
export const MOONS = [
  { id: 'shingetsu', ja: '新月', name: '闇夜', en: 'New moon', rule: '金の玉が2倍出る', ruleEn: 'Twice as many gold shells', fx: { goldDouble: true } },
  { id: 'mikazuki', ja: '三日月', name: '細い月', en: 'Crescent', rule: '千輪が3つ増える（千輪が出てくる夜から）', ruleEn: 'Three extra star shells (once they appear)', fx: { extraSenrin: 3 } },
  { id: 'jougen', ja: '上弦の月', name: '筆ののびる夜', en: 'First quarter', rule: '墨 +20%・導火線の火が届く幅 ×2', ruleEn: 'Ink +20% and fuse reach ×2', fx: { ink: 1.2, reach: 2 } },
  { id: 'juusanya', ja: '十三夜', name: '満ちてゆく月', en: 'Waxing gibbous', rule: '大玉が2倍出る（大玉が出てくる夜から）', ruleEn: 'Twice as many big shells (once they appear)', fx: { bigDouble: true } },
  { id: 'mangetsu', ja: '満月', name: '大輪の夜', en: 'Full moon', rule: '玉のひらく大きさ +12%', ruleEn: 'Bursts +12% bigger', fx: { radius: 1.12 } },
  { id: 'nemachi', ja: '寝待月', name: '欠けてゆく月', en: 'Waning gibbous', rule: '倍率が +1 から始まる', ruleEn: 'Multiplier starts at +1', fx: { startMult: 1 } },
  { id: 'kagen', ja: '下弦の月', name: '残り火の夜', en: 'Last quarter', rule: 'ひらいた玉の 2/5 が、もう一度はじける', ruleEn: '2 in 5 bursts pop again', fx: { afterglow: 0.4 } },
  { id: 'ariake', ja: '有明の月', name: '明け方の月', en: 'Waning crescent', rule: '墨（線の長さ）+25%', ruleEn: 'Ink +25%', fx: { ink: 1.25 } },
];
export function moonIndex(phase) { return Math.floor(((phase + 1 / 16) % 1) * 8) % 8; }

// ---------------------------------------------------------------- 花火玉とお守り
export const SHELLS = {
  kiku: { r: 9, R: 50, pts: 10 },      // 菊: ふつうの玉
  ootama: { r: 14, R: 80, pts: 30 },   // 大玉: 大きくひらく
  kin: { r: 8, R: 40, pts: 5 },        // 金: 倍率 +1
  senrin: { r: 10, R: 30, pts: 15 },   // 千輪: 火花をまっすぐ飛ばす
  chouchin: { r: 11, R: 40, pts: 10 }, // 提灯: 灯ったあとの玉は点が 2 倍
  shime: { r: 10, R: 50, pts: 25 },    // 湿った玉: 別々の火が 2 回当たるとひらく
  shaku: { r: 22, R: 170, pts: 200 },  // 尺玉: 最後の特大玉。倍率 +3
};
export const TYPES = ['kiku', 'ootama', 'kin', 'senrin', 'chouchin', 'shime', 'shaku'];

// 夜ごとに 1 つずつ増える仕掛け（一度に覚えることは 1 つだけ）
// say / sayEn は、その夜にマスコットのヒノコがひとことで知らせる言葉（15 字まで）
export const GIMMICKS = [
  { id: 'ootama', night: 1, ja: '大玉', en: 'Big shell', desc: '大きくひらく。群れのまん中にあると一気に広がる', descEn: 'A huge burst. In the middle of a cluster, it takes everything', say: '大玉は、ドカンと広いよ！', sayEn: 'Big shells blast wide!' },
  { id: 'senrin', night: 2, ja: '千輪', en: 'Star shell', desc: '火花がまっすぐ飛んで、離れた玉にも届く', descEn: 'Fires sparks in straight lines that reach far shells', say: '千輪の火花は遠くまで！', sayEn: 'Star sparks fly far!' },
  { id: 'chouchin', night: 3, ja: '提灯', en: 'Lantern', desc: '灯ったあとにひらく玉は、点が2倍。線は提灯から引きはじめよう', descEn: 'Every burst after it lights scores ×2. Start your line at the lantern', say: '提灯から引くと点が2倍！', sayEn: 'Start at the lantern: 2×!' },
  { id: 'kumo', night: 4, ja: '雲', en: 'Cloud', desc: '火は雲を通らない。線は雲をよけて引く', descEn: 'Fire can\'t pass through clouds. Draw around them', say: '雲の中は通れないよ…', sayEn: 'Fire can\'t cross clouds' },
  { id: 'shime', night: 5, ja: '湿った玉', en: 'Damp shell', desc: '別々の火が2回当たると、ひらく。点は高い', descEn: 'Needs two separate hits to burst. Worth more', say: '湿った玉は2回あてて！', sayEn: 'Damp ones need two hits' },
  { id: 'nawa', night: 6, ja: '仕掛け縄', en: 'Fuse rope', desc: '火が届くと、縄を走って遠くの玉まで燃え広がる', descEn: 'Once lit, fire races along the rope to far shells', say: '縄に火がつくと遠くまで！', sayEn: 'Light the rope, go far!' },
  { id: 'shaku', night: 7, ja: '尺玉', en: 'Grand shell', desc: '最後の特大玉。ひらけば倍率 +3、夜空いっぱいに咲く', descEn: 'The grand finale. Burst it for +3 mult', say: '尺玉で倍率+3！ねらって！', sayEn: 'Grand shell: mult +3!' },
];
export function gimmickFor(night) { return GIMMICKS.find((g) => g.night === night) || null; }

// 番号は再生リンクのビットに入るので、足すのは末尾だけ
export const CHARMS = [
  { id: 'nagafude', emoji: '🖌️', ja: '長い筆', en: 'Long brush', desc: '墨（線の長さ）+40%', descEn: 'Ink +40%' },
  { id: 'futofude', emoji: '🪶', ja: '太い筆', en: 'Thick brush', desc: '導火線の火が届く幅 ×2', descEn: 'Fuse reach ×2' },
  { id: 'tairin', emoji: '🌸', ja: '大輪', en: 'Big bloom', desc: '玉のひらく大きさ +30%', descEn: 'Bursts +30% bigger' },
  { id: 'kinun', emoji: '💰', ja: '金運', en: 'Gold luck', desc: '金の玉は倍率 +2', descEn: 'Gold shells give +2 mult' },
  { id: 'senrin', emoji: '💫', ja: '千輪', en: 'Thousand stars', desc: '千輪の火花が 10 本に', descEn: 'Star shells fire 10 sparks' },
  { id: 'orebi', emoji: '⚡', ja: '折れ火', en: 'Sharp turns', desc: '線の鋭い曲がり角が、ひとりでに爆ぜる', descEn: 'Sharp corners in your line explode' },
  { id: 'owaridama', emoji: '💣', ja: '終わり玉', en: 'Finale', desc: '線の終わりで、大玉ひとつ分爆ぜる', descEn: 'The end of your line explodes big' },
  { id: 'kodou', emoji: '🥁', ja: '鼓動', en: 'Heartbeat', desc: '5 連鎖ごとに倍率 +1（ふだんは 10）', descEn: '+1 mult every 5 bursts (not 10)' },
  { id: 'mankai', emoji: '🌕', ja: '満開の加護', en: 'Full bloom', desc: '全部ひらいたら ×4（ふだんは ×2）', descEn: 'Clear the sky for ×4 (not ×2)' },
  { id: 'mashidama', emoji: '🎇', ja: '増し玉', en: 'More shells', desc: '夜ごとに花火玉が 6 つ増える', descEn: '+6 shells every night' },
  { id: 'nihitsu', emoji: '✌️', ja: '二筆目', en: 'Second stroke', desc: '25 個ひらいたら、もう1本（墨は半分）', descEn: 'Burst 25 to draw once more (half ink)' },
  { id: 'nokoribi', emoji: '🔥', ja: '残り火', en: 'Embers', desc: 'ひらいた玉の 1/4 が、もう一度はじける', descEn: '1 in 4 bursts pops again' },
  { id: 'chouchinshi', emoji: '🏮', ja: '提灯職人', en: 'Lantern maker', desc: '提灯ひとつで点が 3 倍（ふだんは 2 倍）', descEn: 'Each lantern makes points ×3 (not ×2)' },
  { id: 'amayoke', emoji: '☂️', ja: '雨よけ', en: 'Umbrella', desc: '湿った玉も、1回の火でひらく', descEn: 'Damp shells burst on the first hit' },
  { id: 'kazekiri', emoji: '🌬️', ja: '風切り', en: 'Wind cutter', desc: '雲が半分の大きさになる', descEn: 'Clouds shrink to half size' },
];
// 仕掛けが出てくる前には候補に出さない（見たことのないものは選べない）
const CHARM_NEEDS = { senrin: 2, chouchinshi: 3, kazekiri: 4, amayoke: 5 };
export const CHARM_IDS = CHARMS.map((c) => c.id);
export function charmById(id) { return CHARMS.find((c) => c.id === id) || null; }

export const BASE_INK = 460;
export const BASE_REACH = 7;
// 夜ごとの目標点は、その夜の「基準点」× 夜ごとの倍率で決める。
// 基準点（parScore）は、お守りなしで、決まった手順の線を何本か試したうちのいちばん良い点。
// 並び方の運で「どう引いても届かない夜」が出ないように、夜ごとに測る（倍率は _dev/hitofude-ratio.mjs で決め、_dev/hitofude-balance.mjs で確かめた）。
// 後半の倍率が 1 を超えるのは、それまでに集めたお守りの分（お守りは基準点に入れない）
export const TARGET_RATIO = [0.18, 0.33, 0.45, 0.95, 1.3, 1.8, 2.6, 3.2];
// 目安（基準点を測らない所で使う。テストと古いメモ用）
export const TARGETS = [60, 150, 550, 2800, 5000, 16000, 40000, 200000];
export const BASE_COUNTS = [16, 20, 24, 28, 32, 36, 40, 44];

// ---------------------------------------------------------------- 大一番（三夜目と六夜目）
// その夜だけ、線の引き方が変わる。シードで決まるので、「今夜の一筆」ではみんな同じ大一番になる。
// まっすぐ・鏡は線そのものを変える（ここで扱う）。闇夜・一瞬は見え方と時間だけを変える（ページで扱う）
export const BOSS_NIGHTS = [2, 5];
export const TWISTS = [
  { id: 'massugu', ja: 'まっすぐ', en: 'Straight', say: '今夜の線は、まっすぐ！', sayEn: 'Straight lines only!', rule: '指を離した所まで、直線になる', ruleEn: 'Your line snaps straight', desc: '線は、引きはじめと指を離した所を結ぶ直線になる', descEn: 'Your line becomes a straight segment from start to release', target: 0.9 },
  { id: 'kagami', ja: '鏡', en: 'Mirror', say: '線が左右に映るよ！', sayEn: 'Your line is mirrored!', rule: '線が、まん中の線で左右に映る', ruleEn: 'Your line is copied to the other side', desc: '線が左右に映って 2 本になる（墨は 3/4）', descEn: 'Your line is mirrored left and right (3/4 ink)', target: 0.9 },
  { id: 'yamiyo', ja: '闇夜', en: 'Dark night', say: 'よく見て、覚えて！', sayEn: 'Look now, remember later!', rule: '玉は 5 秒でうすくなる', ruleEn: 'Shells fade after 5 seconds', desc: '玉がはっきり見えるのは、はじめの 5 秒だけ（あとはうっすら）', descEn: 'Shells are clear for 5 seconds, then only faint', target: 0.75 },
  { id: 'isshun', ja: '一瞬', en: 'Snap', say: '4秒で引き切って！', sayEn: 'Draw it in 4 seconds!', rule: '指を置いてから 4 秒で線が終わる', ruleEn: 'Your line ends 4 s after touching', desc: '指を置いてから 4 秒で、線は勝手に終わる', descEn: 'Your line ends 4 s after you touch down', target: 0.8 },
];
export const SNAP_SECONDS = 4;
export const DARK_SECONDS = 5;
export const MIRROR_INK = 0.75;
function shuffled(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function twistFor(seed, night) {
  const k = BOSS_NIGHTS.indexOf(night);
  if (k < 0) return null;
  return shuffled(TWISTS, rng32(hashStr(`hitofude-boss:${seed >>> 0}`)))[k];
}
export function isBoss(night) { return BOSS_NIGHTS.includes(night); }
// その夜の目標点。基準点 × 倍率（大一番は、闇夜・一瞬のように人にだけ効く難しさの分を下げる）。見やすいよう上 2 桁に丸める
export function targetFor(seed, night, moon = 4) {
  const tw = twistFor(seed, night);
  const t = parScore(seed, night, moon) * TARGET_RATIO[night] * (tw ? tw.target : 1);
  return Math.max(30, round2(t));
}
function round2(v) { const d = 10 ** Math.max(1, Math.floor(Math.log10(Math.max(1, v))) - 1); return Math.round(v / d) * d; }

// ---------------------------------------------------------------- 夜の景色（三夜目から）
// 玉の群れの並び方。夜ごとに変わり、同じ景色は続かない。八夜目は、尺玉を囲む輪
export const SCENES = [
  { id: 'mure', ja: '群れ', en: 'Clusters' },
  { id: 'kawa', ja: '天の川', en: 'River' },
  { id: 'wa', ja: '輪', en: 'Ring' },
  { id: 'yatai', ja: '屋台の列', en: 'Stalls' },
];
export function sceneFor(seed, night) {
  if (night < 2) return SCENES[0];
  if (night === NIGHTS - 1) return SCENES[2];
  const prev = night > 2 ? sceneFor(seed, night - 1).id : 'mure';
  const pool = SCENES.filter((sc) => sc.id !== prev && !(night === NIGHTS - 2 && sc.id === 'wa'));
  return pool[Math.floor(rng32(nightSeed(seed, night) ^ 0x5ce9e)() * pool.length)];
}

// お守りと今夜の月を合わせた、この夜のルール
export function rulesFor(charms, moonIdx) {
  const has = (id) => charms.includes(id);
  const m = (MOONS[moonIdx] || MOONS[4]).fx;
  return {
    ink: Math.round(BASE_INK * (has('nagafude') ? 1.4 : 1) * (m.ink || 1)),
    reach: BASE_REACH * (has('futofude') ? 2 : 1) * (m.reach || 1),
    radius: (has('tairin') ? 1.3 : 1) * (m.radius || 1),
    goldBonus: has('kinun') ? 2 : 1,
    senrinSparks: has('senrin') ? 10 : 6,
    corners: has('orebi'),
    endBurst: has('owaridama'),
    pulse: has('kodou') ? 5 : 10,
    bloom: has('mankai') ? 4 : 2,
    extraShells: has('mashidama') ? 6 : 0,
    secondStroke: has('nihitsu'),
    afterglow: (has('nokoribi') ? 0.25 : 0) + (m.afterglow || 0),
    startMult: m.startMult || 0,
    goldDouble: !!m.goldDouble,
    bigDouble: !!m.bigDouble,
    extraSenrin: m.extraSenrin || 0,
    lanternGain: has('chouchinshi') ? 2 : 1,
    dampHits: has('amayoke') ? 1 : 2,
    cloudScale: has('kazekiri') ? 0.5 : 1,
  };
}

// ---------------------------------------------------------------- 夜の並べ方
export const FIELD = { x0: 22, x1: W - 22, y0: 96, y1: 500 };
const MIN_GAP = 27;

function gauss(rng) { return (rng() + rng() + rng() - 1.5) / 1.5; }

export function nightSeed(seed, night) { return hashStr(`hitofude:${seed >>> 0}:${night}`); }

// 夜ごとの玉の内訳。仕掛けは GIMMICKS の夜から出てくる
export function shellMix(night, rules) {
  let gold = 1 + Math.floor(night / 3);
  let big = night >= 1 ? 1 + Math.floor((night - 1) / 2) : 0;
  let star = night >= 2 ? 1 + Math.floor((night - 2) / 2) : 0;
  const lantern = night >= 3 ? (night >= 6 ? 2 : 1) : 0;
  const damp = night >= 5 ? 3 + (night - 5) * 2 : 0;
  const shaku = night >= 7 ? 1 : 0;
  // 月のルールも、その玉が出てくる夜から効く（一度に覚えることは 1 つだけ）
  if (rules.goldDouble) gold *= 2;
  if (rules.bigDouble) big *= 2;
  if (night >= 2) star += rules.extraSenrin;
  return { kin: gold, ootama: big, senrin: star, chouchin: lantern, shime: damp, shaku };
}

// 雲（5 夜目から）。火も火花も通らない
export function makeClouds(seed, night, rules) {
  if (night < 4) return [];
  const rng = rng32(nightSeed(seed, night) ^ 0x0c10d5);
  const n = night >= 6 ? 2 : 1, out = [];
  for (let k = 0; k < n; k++) {
    for (let t = 0; t < 40; t++) {
      const r = Math.round((38 + rng() * 12) * rules.cloudScale);
      const c = { x: Math.round(FIELD.x0 + 50 + rng() * (FIELD.x1 - FIELD.x0 - 100)), y: Math.round(FIELD.y0 + 60 + rng() * (FIELD.y1 - FIELD.y0 - 120)), r };
      if (out.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < o.r + c.r + 60)) continue;
      out.push(c); break;
    }
  }
  return out;
}
// 線分 a→b が、どれかの雲を横切るか
export function crossesCloud(clouds, ax, ay, bx, by) {
  for (const c of clouds) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const u = l2 ? Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.y - ay) * dy) / l2)) : 0;
    if (Math.hypot(ax + dx * u - c.x, ay + dy * u - c.y) < c.r) return true;
  }
  return false;
}
export function inCloud(clouds, x, y) { return clouds.some((c) => Math.hypot(c.x - x, c.y - y) < c.r); }

// 仕掛け縄（7 夜目から）。離れた玉どうしをゆるい弧でつなぐ。雲は通らない
export function makeRopes(seed, night, shells, clouds) {
  if (night < 6) return [];
  const rng = rng32(nightSeed(seed, night) ^ 0x2a0e5);
  const n = night >= 7 ? 3 : 2, out = [], used = new Set();
  for (let t = 0; t < 200 && out.length < n; t++) {
    const a = shells[Math.floor(rng() * shells.length)], b = shells[Math.floor(rng() * shells.length)];
    if (!a || !b || a === b || used.has(a.id) || used.has(b.id)) continue;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 100 || d > 190) continue;
    const bend = (rng() - 0.5) * 50, nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
    const cx = (a.x + b.x) / 2 + nx * bend, cy = (a.y + b.y) / 2 + ny * bend;
    const pts = [];
    const steps = Math.round(d / FUSE_SAMPLE);
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      pts.push({ x: (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * cx + u * u * b.x, y: (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * cy + u * u * b.y });
    }
    if (pts.some((p) => inCloud(clouds, p.x, p.y))) continue;
    used.add(a.id); used.add(b.id);
    out.push({ a: a.id, b: b.id, pts });
  }
  return out;
}

// 夜 night（0 始まり）の花火玉。いくつかの群れと、はぐれ玉。群れの間は線でつなぐ
export function makeLayout(seed, night, rules, clouds = makeClouds(seed, night, rules)) {
  const rng = rng32(nightSeed(seed, night));
  const n = BASE_COUNTS[Math.min(night, BASE_COUNTS.length - 1)] + rules.extraShells;
  const mix = shellMix(night, rules);
  const types = [];
  for (const t of ['kin', 'ootama', 'senrin', 'chouchin', 'shime']) for (let i = 0; i < mix[t]; i++) types.push(t);
  while (types.length < n - mix.shaku) types.push('kiku');
  for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
  // 序盤の夜ほど群れが少なく密（最初の一筆で気持ちよく連鎖させる）。三夜目からは、景色ごとに群れの置き方が変わる
  const scene = sceneFor(seed, night).id;
  let k = night < 2 ? 2 : 3 + Math.floor(rng() * 3);
  let spread = night < 2 ? 34 : 40 + night, sx = 1, sy = 1;
  const centers = [];
  if (scene === 'kawa') {
    // 画面を横切る、うねった川。小さな群れが流れに沿って並ぶ
    k = 6; spread = 30 + night;
    const ph = rng() * Math.PI * 2, amp = 90 + rng() * 40, mid = (FIELD.y0 + FIELD.y1) / 2;
    for (let c = 0; c < k; c++) { const u = c / (k - 1); centers.push({ x: FIELD.x0 + 34 + u * (FIELD.x1 - FIELD.x0 - 68), y: mid + Math.sin(ph + u * Math.PI * 1.8) * amp }); }
  } else if (scene === 'wa') {
    // まん中を空けた輪（八夜目は、まん中に尺玉）
    k = 7; spread = 28 + night;
    const off = rng() * Math.PI * 2, r = 118 + rng() * 14;
    for (let c = 0; c < k; c++) { const a = off + c / k * Math.PI * 2; centers.push({ x: W / 2 + Math.cos(a) * r, y: 298 + Math.sin(a) * r * 1.2 }); }
  } else if (scene === 'yatai') {
    // 横に長い屋台が、3 段に並ぶ
    k = 6; spread = 30 + night; sx = 1.7; sy = 0.55;
    const rows = [FIELD.y0 + 60, (FIELD.y0 + FIELD.y1) / 2, FIELD.y1 - 60], shift = rng() < 0.5 ? 0 : 1;
    for (let c = 0; c < k; c++) { const row = Math.floor(c / 2); centers.push({ x: (c % 2 === (row + shift) % 2 ? 100 : 260) + (rng() - 0.5) * 30, y: rows[row] + (rng() - 0.5) * 20 }); }
  } else {
    for (let c = 0; c < k; c++) {
      let best = null;
      for (let t = 0; t < 12; t++) {
        const p = { x: FIELD.x0 + 30 + rng() * (FIELD.x1 - FIELD.x0 - 60), y: FIELD.y0 + 30 + rng() * (FIELD.y1 - FIELD.y0 - 60) };
        const d = centers.reduce((m, q) => Math.min(m, Math.hypot(p.x - q.x, p.y - q.y)), 1e9);
        if (!best || d > best.d) best = { p, d };
      }
      centers.push(best.p);
    }
  }
  const shells = [];
  // 尺玉は、まん中あたりに先に置く
  if (mix.shaku) shells.push({ id: 0, type: 'shaku', x: Math.round(W / 2 + (rng() - 0.5) * 60), y: Math.round(290 + (rng() - 0.5) * 80), hue: 2 });
  const clear = (x, y, gap) => !shells.some((s) => Math.hypot(s.x - x, s.y - y) < gap + (s.type === 'shaku' ? 14 : 0)) && !clouds.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + 14);
  for (let i = 0; i < types.length; i++) {
    let pos = null;
    for (let t = 0; t < 60 && !pos; t++) {
      const loose = rng() < (night < 2 ? 0.08 : scene === 'mure' ? 0.22 : 0.12);
      const c = centers[Math.floor(rng() * centers.length)];
      // 間隔は丸めたあとの座標で確かめる（丸めで近づくことがある）。群れが混んで置けないときは、少しずつ広げる
      const grow = 1 + Math.floor(t / 20) * 0.35;
      const x = Math.round(loose ? FIELD.x0 + rng() * (FIELD.x1 - FIELD.x0) : c.x + gauss(rng) * spread * sx * grow);
      const y = Math.round(loose ? FIELD.y0 + rng() * (FIELD.y1 - FIELD.y0) : c.y + gauss(rng) * spread * sy * grow);
      if (x < FIELD.x0 || x > FIELD.x1 || y < FIELD.y0 || y > FIELD.y1) continue;
      if (!clear(x, y, MIN_GAP)) continue;
      pos = { x, y };
    }
    if (!pos) continue;
    shells.push({ id: shells.length, type: types[i], x: pos.x, y: pos.y, hue: Math.floor(rng() * 7) });
  }
  return shells;
}

// ---------------------------------------------------------------- 線
function pathLength(pts) {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
}
export { pathLength };
export const STROKE_STEP = 8;
export const STROKE_MAX_POINTS = 127;

// 指の軌跡を、8 単位ごとの整数座標にならし、墨の長さで切る。挑戦状にはこの形で入る
export function normalizeStroke(raw, ink) {
  const pts = (raw || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({ x: Math.max(0, Math.min(W - 1, p.x)), y: Math.max(0, Math.min(H - 1, p.y)) }));
  if (pts.length < 2) return [];
  const out = [{ x: Math.round(pts[0].x), y: Math.round(pts[0].y) }];
  let used = 0, carry = 0;
  for (let i = 1; i < pts.length && out.length < STROKE_MAX_POINTS; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg === 0) continue;
    let d = STROKE_STEP - carry;
    while (d <= seg && out.length < STROKE_MAX_POINTS) {
      if (used + STROKE_STEP > ink + 1e-9) return out;
      const q = { x: Math.round(a.x + (b.x - a.x) * d / seg), y: Math.round(a.y + (b.y - a.y) * d / seg) };
      const last = out[out.length - 1];
      if (q.x !== last.x || q.y !== last.y) { out.push(q); used += STROKE_STEP; }
      d += STROKE_STEP;
    }
    carry = seg - (d - STROKE_STEP);
  }
  return out;
}
// 線の中で、鋭く折れている点（折れ火）
function cornerIndices(pts) {
  const out = [];
  for (let i = 2; i < pts.length - 2; i++) {
    const a = pts[i - 2], b = pts[i], c = pts[i + 2];
    const v1x = b.x - a.x, v1y = b.y - a.y, v2x = c.x - b.x, v2y = c.y - b.y;
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    if (!l1 || !l2) continue;
    const cos = (v1x * v2x + v1y * v2y) / (l1 * l2);
    if (cos < -0.1 && (!out.length || i - out[out.length - 1] > 3)) out.push(i);
  }
  return out;
}

// ---------------------------------------------------------------- シミュレーション
export const FUSE_SPEED = 300;       // 導火線の火が走る速さ（単位/秒）
export const FUSE_SAMPLE = 4;        // 導火線を刻む細かさ
export const BURST_GROW = 0.2;       // 玉がひらききるまで
export const BURST_HOLD = 0.25;      // ひらいたまま火が移る時間
export const SPARK_SPEED = 260;
export const SPARK_LIFE = 0.55;

export function newRound({ seed, night, charms = [], moon = 4, par = false }) {
  const rules = rulesFor(charms, moon);
  const tw = twistFor(seed, night);
  const clouds = makeClouds(seed, night, rules);
  const shells = makeLayout(seed, night, rules, clouds).map((s) => ({ ...s, burst: false, burstAt: -1, hp: s.type === 'shime' ? rules.dampHits : 1, lastSrc: null }));
  const st = {
    seed: seed >>> 0, night, charms: charms.slice(), moon, rules, shells, clouds, ropes: [],
    twist: tw ? tw.id : null, scene: sceneFor(seed, night).id, target: par ? 0 : targetFor(seed, night, moon),
    t: 0, tick: 0, phase: 'draw', strokes: [], ink: Math.round(rules.ink * (tw && tw.id === 'kagami' ? MIRROR_INK : 1)),
    fuse: { pts: [], burnt: [], seg: [], wet: [], rope: [], links: [], corners: new Set(), ends: new Set() },
    heads: [], explosions: [], sparks: [], embers: [], nextId: 1,
    pops: 0, chips: 0, goldMult: 0, lanterns: 0, maxChainAt: 0, events: [],
    rng: rng32(nightSeed(seed, night) ^ 0x9e3779b9), secondUsed: false, done: false, result: null,
  };
  const ropes = makeRopes(seed, night, shells, clouds);
  ropes.forEach((r, k) => addSegment(st, r.pts, 10 + k, true));
  st.ropes = ropes;
  return st;
}

export function multOf(st) {
  return 1 + st.rules.startMult + st.goldMult + Math.floor(st.pops / st.rules.pulse);
}
// 提灯が灯ったあとの、点の倍率（1 + 灯った提灯 × 1。提灯職人なら × 2）
export function pointFactor(st) { return 1 + st.lanterns; }

// 導火線に区間を足す（プレイヤーの線も、仕掛け縄も）。近くにある別の区間の点どうしは「つながり」として覚え、
// 片方が燃えたらもう片方にも火が移る
const LINK_DIST = 6;
function addSegment(st, samples, segId, isRope) {
  const f = st.fuse, base = f.pts.length;
  for (const p of samples) {
    f.pts.push(p); f.burnt.push(false); f.seg.push(segId); f.rope.push(!!isRope);
    f.wet.push(inCloud(st.clouds, p.x, p.y)); f.links.push([]);
  }
  for (let i = base; i < f.pts.length; i++) {
    for (let j = 0; j < base; j++) {
      if (f.seg[j] === segId) continue;
      if (Math.hypot(f.pts[i].x - f.pts[j].x, f.pts[i].y - f.pts[j].y) <= LINK_DIST) { f.links[i].push(j); f.links[j].push(i); }
    }
  }
  return base;
}

// 指の軌跡から線を置いて火をつける（1 本目も 2 本目も同じ）。返り値は、実際に使われた線
export function lightStroke(st, raw) {
  return lightPoints(st, normalizeStroke(st.twist === 'massugu' ? straighten(raw, st.ink) : raw, st.ink));
}
// まっすぐの夜: 引きはじめから、指を離した所へ向かう直線（墨の長さまで）
export function straighten(raw, ink) {
  const pts = (raw || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (pts.length < 2) return pts;
  const a = pts[0], b = pts[pts.length - 1], d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d < 1) return [a];
  const k = Math.min(1, ink / d);
  return [{ x: a.x, y: a.y }, { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }];
}
// 鏡の夜: 左右に映した線
export function mirrorPoint(p) { return { x: W - p.x, y: p.y }; }
// ならし済みの線（挑戦状・再生リンクから来たもの）をそのまま置く。ならし直すと線がずれて結果が変わる
export function lightPoints(st, input) {
  const pts = [];
  let len = 0;
  for (const p of input || []) {
    if (!p || !Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) return null;
    if (pts.length) {
      const d = Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y);
      if (len + d > st.ink + 1) break;
      len += d;
    }
    if (pts.length >= STROKE_MAX_POINTS) break;
    pts.push({ x: p.x, y: p.y });
  }
  if (pts.length < 3) return null;
  st.strokes.push(pts);
  // 導火線は、線を FUSE_SAMPLE ごとに刻んだ点の列。2 本目は後ろにつなげず、別の区間として持つ
  const samples = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(seg / FUSE_SAMPLE));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) samples.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
  }
  const segId = st.strokes.length - 1;
  const base = addSegment(st, samples, segId, false);
  const corners = st.rules.corners ? cornerIndices(pts).map((ci) => base + Math.round(ci * STROKE_STEP / FUSE_SAMPLE)) : [];
  for (const c of corners) st.fuse.corners.add(Math.min(c, st.fuse.pts.length - 1));
  st.fuse.ends.add(st.fuse.pts.length - 1);
  // 鏡の夜は、左右に映した線も置いて、両方の端から火をつける
  let mirror = null;
  if (st.twist === 'kagami') {
    const ms = samples.map(mirrorPoint), mseg = 20 + segId;
    const mb = addSegment(st, ms, mseg, false);
    for (const c of corners) st.fuse.corners.add(Math.min(mb + (c - base), st.fuse.pts.length - 1));
    st.fuse.ends.add(st.fuse.pts.length - 1);
    mirror = { base: mb, seg: mseg, p: ms[0] };
  }
  st.phase = 'burn';
  st.fuse.burnt[base] = true;
  st.events.push({ type: 'light', x: samples[0].x, y: samples[0].y });
  // 雲の中から引きはじめた線は、火がつかない
  const mainWet = st.fuse.wet[base];
  if (!mainWet) {
    st.heads.push({ i: base, dir: 1, f: base });
    fuseNeighborsBurst(st, samples[0], st.rules.reach, 'f' + segId);
    catchLinks(st, base);
  }
  if (mirror && !st.fuse.burnt[mirror.base]) {
    st.fuse.burnt[mirror.base] = true;
    if (!st.fuse.wet[mirror.base]) {
      st.heads.push({ i: mirror.base, dir: 1, f: mirror.base });
      fuseNeighborsBurst(st, mirror.p, st.rules.reach, 'f' + mirror.seg);
      catchLinks(st, mirror.base);
    }
  }
  if (mainWet && !st.heads.length) st.events.push({ type: 'fizzle', x: samples[0].x, y: samples[0].y });
  return pts;
}

function spawnExplosion(st, x, y, R, cause, hue) {
  st.explosions.push({ id: st.nextId++, x, y, R, t: 0, cause, hue: hue == null ? -1 : hue });
}

// src は火の出どころ（爆発・火花・導火線の区間）。湿った玉は、別々の出どころから 2 回当たるとひらく
function burst(st, s, cause, src) {
  if (s.burst) return;
  if (s.type === 'shime' && s.lastSrc === src) return; // 同じ火は、何度当たっても 1 回と数える
  if (s.hp > 1) {
    s.hp--; s.lastSrc = src;
    st.events.push({ type: 'dry', shell: s });
    return;
  }
  const def = SHELLS[s.type];
  s.burst = true; s.burstAt = st.t;
  st.pops++;
  st.chips += def.pts * pointFactor(st);
  if (s.type === 'kin') st.goldMult += st.rules.goldBonus;
  if (s.type === 'shaku') st.goldMult += 3;
  if (s.type === 'chouchin') { st.lanterns += st.rules.lanternGain; st.events.push({ type: 'lantern', shell: s, factor: pointFactor(st) }); }
  spawnExplosion(st, s.x, s.y, def.R * st.rules.radius, cause, s.hue);
  if (s.type === 'senrin') {
    const n = st.rules.senrinSparks;
    const off = (s.id * 0.61803) % 1;
    for (let k = 0; k < n; k++) {
      const a = (k / n + off) * Math.PI * 2;
      st.sparks.push({ id: st.nextId++, x: s.x, y: s.y, vx: Math.cos(a) * SPARK_SPEED, vy: Math.sin(a) * SPARK_SPEED, life: SPARK_LIFE });
    }
  }
  if (st.rules.afterglow && st.rng() < st.rules.afterglow) st.embers.push({ x: s.x, y: s.y, at: st.t + 0.8, R: def.R * 0.7 * st.rules.radius, pts: Math.round(def.pts / 2) * pointFactor(st), hue: s.hue });
  st.events.push({ type: 'burst', shell: s, chain: st.pops, cause });
}

function igniteFuseAt(st, i) {
  const f = st.fuse;
  if (f.burnt[i] || f.wet[i]) return;
  f.burnt[i] = true;
  st.heads.push({ i, dir: 1, f: i }, { i, dir: -1, f: i });
  st.events.push({ type: 'catch', x: f.pts[i].x, y: f.pts[i].y, rope: f.rope[i] });
  fuseNeighborsBurst(st, f.pts[i], st.rules.reach, 'f' + f.seg[i]);
  catchLinks(st, i);
}
// 燃えた点のすぐそばを通る別の区間（縄や、もう 1 本の線）にも火を移す
function catchLinks(st, i) {
  for (const j of st.fuse.links[i]) igniteFuseAt(st, j);
}

function fuseNeighborsBurst(st, p, reach, src) {
  for (const s of st.shells) {
    if (s.burst) continue;
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d <= SHELLS[s.type].r + reach) burst(st, s, 'fuse', src);
  }
}

export function step(st) {
  if (st.done || st.phase === 'draw' || st.phase === 'draw2') return st;
  st.t += DT; st.tick++;
  const f = st.fuse;
  // 導火線の火
  const adv = FUSE_SPEED * DT / FUSE_SAMPLE;
  const alive = [];
  for (const h of st.heads) {
    let dead = false;
    const target = h.f + h.dir * adv;
    while (!dead) {
      const next = h.i + h.dir;
      if ((h.dir > 0 && next > target) || (h.dir < 0 && next < target)) break;
      if (next < 0 || next >= f.pts.length || f.burnt[next] || f.wet[next] || f.seg[next] !== f.seg[h.i]) { dead = true; break; }
      f.burnt[next] = true;
      h.i = next;
      fuseNeighborsBurst(st, f.pts[next], st.rules.reach, 'f' + f.seg[next]);
      catchLinks(st, next);
      if (f.corners.has(next)) spawnExplosion(st, f.pts[next].x, f.pts[next].y, 42 * st.rules.radius, 'corner', 3);
      if (st.rules.endBurst && f.ends.has(next)) spawnExplosion(st, f.pts[next].x, f.pts[next].y, 80 * st.rules.radius, 'end', 2);
    }
    h.f = target;
    if (!dead) alive.push(h);
  }
  st.heads = alive;
  // 爆発: ひらいている間、近くの玉と導火線に火を移す
  for (const e of st.explosions) {
    e.t += DT;
    if (e.t > BURST_GROW + BURST_HOLD) continue;
    const rad = e.R * Math.min(1, e.t / BURST_GROW);
    const clouds = st.clouds;
    for (const s of st.shells) {
      if (s.burst) continue;
      if (Math.hypot(s.x - e.x, s.y - e.y) > rad + SHELLS[s.type].r) continue;
      // 雲の向こうには火が届かない
      if (clouds.length && crossesCloud(clouds, e.x, e.y, s.x, s.y)) continue;
      burst(st, s, 'chain', e.id);
    }
    let best = -1, bd = 1e9;
    for (let i = 0; i < f.pts.length; i++) {
      if (f.burnt[i] || f.wet[i]) continue;
      const d = Math.hypot(f.pts[i].x - e.x, f.pts[i].y - e.y);
      if (d <= rad && d < bd) { bd = d; best = i; }
    }
    if (best >= 0 && !(clouds.length && crossesCloud(clouds, e.x, e.y, f.pts[best].x, f.pts[best].y))) igniteFuseAt(st, best);
  }
  // 千輪の火花
  const sparks = [];
  for (const sp of st.sparks) {
    sp.x += sp.vx * DT; sp.y += sp.vy * DT; sp.life -= DT;
    if (st.clouds.length && inCloud(st.clouds, sp.x, sp.y)) continue; // 雲に入った火花は消える
    for (const s of st.shells) {
      if (!s.burst && Math.hypot(s.x - sp.x, s.y - sp.y) <= SHELLS[s.type].r + 5) burst(st, s, 'spark', sp.id);
    }
    for (let i = 0; i < f.pts.length; i++) {
      if (!f.burnt[i] && !f.wet[i] && Math.hypot(f.pts[i].x - sp.x, f.pts[i].y - sp.y) <= 5) { igniteFuseAt(st, i); break; }
    }
    if (sp.life > 0 && sp.x > -10 && sp.x < W + 10 && sp.y > -10 && sp.y < H + 10) sparks.push(sp);
  }
  st.sparks = sparks;
  // 残り火
  const embers = [];
  for (const em of st.embers) {
    if (st.t >= em.at) { st.chips += em.pts; spawnExplosion(st, em.x, em.y, em.R, 'ember', em.hue); st.events.push({ type: 'ember', x: em.x, y: em.y }); }
    else embers.push(em);
  }
  st.embers = embers;
  st.explosions = st.explosions.filter((e) => e.t <= BURST_GROW + BURST_HOLD + 0.6);
  // 終わったか
  const busy = st.heads.length || st.sparks.length || st.embers.length || st.explosions.some((e) => e.t <= BURST_GROW + BURST_HOLD);
  if (!busy) {
    if (st.rules.secondStroke && !st.secondUsed && st.pops >= 25 && st.shells.some((s) => !s.burst)) {
      st.secondUsed = true; st.phase = 'draw2'; st.ink = Math.round(st.rules.ink * (st.twist === 'kagami' ? MIRROR_INK : 1) / 2);
      st.events.push({ type: 'second' });
      return st;
    }
    finish(st);
  }
  return st;
}

export function finish(st) {
  if (st.done) return st;
  const allClear = st.shells.every((s) => s.burst);
  const mult = multOf(st);
  const base = st.chips * mult;
  const score = base * (allClear ? st.rules.bloom : 1);
  st.done = true; st.phase = 'done';
  st.result = { pops: st.pops, total: st.shells.length, chips: st.chips, mult, allClear, bloom: allClear ? st.rules.bloom : 1, score };
  st.events.push({ type: 'done', result: st.result });
  return st;
}

// 線を置いたあと、終わるまで一気に回す（テストと、再生リンクの答え合わせ用）。
// normalized = true なら、線はならし済み（再生リンク）としてそのまま使う
export function runToEnd(st, strokes, { normalized = false, maxTicks = 60 * 60 } = {}) {
  const light = (pts) => (normalized ? lightPoints(st, pts) : lightStroke(st, pts));
  let k = 0;
  if (strokes[k]) light(strokes[k++]);
  for (let n = 0; n < maxTicks && !st.done; n++) {
    if (st.phase === 'draw2') {
      if (strokes[k]) light(strokes[k++]); else finish(st);
    }
    step(st);
    st.events.length = 0;
  }
  if (!st.done) finish(st);
  return st.result;
}

// ---------------------------------------------------------------- 基準点
// お守りなしで、決まった手順の線（提灯から・尺玉から・ばらばらの所から、近い玉を順につなぐ。まっすぐの夜は玉から玉への直線）を
// PAR_LINES 本試し、いちばん良い点。シードと夜と月だけで決まるので、今夜の一筆では全員同じになる
export const PAR_LINES = 12;
const parCache = new Map();
export function parScore(seed, night, moon = 4) {
  const key = `${seed >>> 0}|${night}|${moon}`;
  if (parCache.has(key)) return parCache.get(key);
  const r = rng32(nightSeed(seed, night) ^ 0x9a55e7);
  let best = 0;
  for (let c = 0; c < PAR_LINES; c++) {
    const st = newRound({ seed, night, charms: [], moon, par: true });
    const res = runToEnd(st, [refLine(st, r, c)]);
    if (res && res.score > best) best = res.score;
  }
  if (parCache.size > 400) parCache.clear();
  parCache.set(key, best);
  return best;
}
function refLine(st, r, c) {
  const alive = st.shells;
  if (st.twist === 'massugu') {
    const a = alive[Math.floor(r() * alive.length)], far = alive.filter((s) => Math.hypot(s.x - a.x, s.y - a.y) > 120);
    const b = (far.length ? far : alive)[Math.floor(r() * (far.length || alive.length))];
    return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
  }
  const lantern = alive.find((s) => s.type === 'chouchin'), shaku = alive.find((s) => s.type === 'shaku');
  let cur = (c % 3 === 0 && lantern) || (c % 3 === 1 && shaku) || alive[Math.floor(r() * alive.length)];
  const pts = [{ x: cur.x, y: cur.y }], seen = new Set([cur.id]);
  let used = 0;
  for (;;) {
    const cand = alive.filter((s) => !seen.has(s.id) && !crossesCloud(st.clouds, cur.x, cur.y, s.x, s.y))
      .map((s) => ({ s, d: Math.hypot(s.x - cur.x, s.y - cur.y) })).sort((a, b) => a.d - b.d).slice(0, 3);
    if (!cand.length) break;
    const pick = cand[Math.floor(r() * cand.length)];
    if (used + pick.d > st.ink) break;
    used += pick.d; seen.add(pick.s.id); cur = pick.s; pts.push({ x: cur.x, y: cur.y });
  }
  return pts;
}

// ---------------------------------------------------------------- 夜ごとのお守り
// round は、大一番を越えたときの 2 つ目の選択（別の 3 つを出す）
export function offerCharms(seed, night, held, round = 0) {
  const rng = rng32(nightSeed(seed, night) ^ 0x51ed270b ^ (round ? 0x2b0d5 * round : 0));
  const pool = CHARM_IDS.filter((id) => !held.includes(id) && (CHARM_NEEDS[id] || 0) <= night + 1);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 3);
}

// ---------------------------------------------------------------- 散ったときのヒント
// 終わった夜の様子から、次に効きそうなことを 1 つだけ選ぶ（上ほど効き目が大きい）
export function failHint(st) {
  const f = st.fuse, left = st.shells.filter((s) => !s.burst);
  const leftOf = (type) => left.filter((s) => s.type === type).length;
  // 1) 雲の中から引きはじめて、火がつかなかった
  if (st.strokes.length && f.wet[0] && st.pops === 0) return { id: 'cloudStart' };
  // 2) 大一番のコツ
  if (st.twist) return { id: 'twist_' + st.twist };
  // 3) 尺玉が残った（倍率 +3）
  if (leftOf('shaku')) return { id: 'shaku' };
  // 4) 提灯が灯らなかった／灯るのが遅かった（あとにひらく玉ほど点が倍）
  if (leftOf('chouchin') && leftOf('chouchin') === st.shells.filter((s) => s.type === 'chouchin').length) return { id: 'lantern' };
  const lit = st.shells.filter((s) => s.type === 'chouchin' && s.burst).map((s) => s.burstAt);
  if (lit.length && st.pops >= 8) {
    const order = st.shells.filter((s) => s.burst).map((s) => s.burstAt).sort((a, b) => a - b);
    if (Math.min(...lit) > order[Math.floor(order.length / 2)]) return { id: 'lanternLate' };
  }
  // 5) あと少しで満開（×2）だった
  if (left.length > 0 && left.length <= 3) return { id: 'almost', n: left.length };
  // 6) 墨が余った
  const used = st.strokes.reduce((a, pts) => a + pathLength(pts), 0);
  if (used < st.rules.ink * 0.6) return { id: 'ink' };
  // 7) 仕掛け縄に火が届かなかった
  if (st.ropes.length && st.ropes.every((r) => !f.burnt.some((b, i) => b && f.rope[i]))) return { id: 'rope' };
  // 8) 湿った玉が残った
  if (leftOf('shime') >= 2) return { id: 'damp' };
  // 9) 金の玉が残った（倍率）
  if (leftOf('kin')) return { id: 'gold' };
  // 10) 線から遠い群れが残った
  if (left.length >= 4) return { id: 'far' };
  return { id: 'general' };
}

// ---------------------------------------------------------------- 筆跡占い
// 線の形から、その人の「筆跡」を 7 つのどれかに見立てる（結果とシェアに出す）
export const STROKE_TYPES = [
  { id: 'nyuukon', emoji: '🎯', ja: 'ひと筆入魂', en: 'One Touch', line: '短く、深く。無駄のない一筆', lineEn: 'Short and deep. Nothing wasted' },
  { id: 'massugu', emoji: '🏹', ja: '一直線', en: 'Arrow', line: '狙いをしぼった、まっすぐな一筆', lineEn: 'Aimed and straight' },
  { id: 'wa', emoji: '⭕', ja: 'ひと回り', en: 'Full Circle', line: '始まりに帰ってくる、律儀な一筆', lineEn: 'Comes back to where it began' },
  { id: 'uzumaki', emoji: '🌀', ja: '渦巻き', en: 'Whirlpool', line: 'ぐるりと巻き込む、欲ばりな一筆', lineEn: 'Spirals in to take it all' },
  { id: 'inazuma', emoji: '⚡', ja: '稲妻', en: 'Lightning', line: '迷いなく折れる、勝負師の一筆', lineEn: 'Sharp turns, no hesitation' },
  { id: 'nami', emoji: '🌊', ja: '波乗り', en: 'Wave Rider', line: 'ゆらゆら拾っていく、しなやかな一筆', lineEn: 'Sways and gathers, supple' },
  { id: 'sanpo', emoji: '🐾', ja: 'ぶらり散歩', en: 'Wanderer', line: '寄り道が、いちばんの近道', lineEn: 'Detours are the best shortcuts' },
];
export function strokeType(pts, { ink = BASE_INK, pops = 0, total = 1 } = {}) {
  const list = (pts || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  const T = (id) => STROKE_TYPES.find((t) => t.id === id);
  if (list.length < 3) return T('nyuukon');
  const len = pathLength(list), a = list[0], b = list[list.length - 1], chord = Math.hypot(b.x - a.x, b.y - a.y);
  // 3 点おき（約 24 単位）に向きの変わり方を見る（指のぶれを拾わない）
  const q = list.filter((_, i) => i % 3 === 0 || i === list.length - 1);
  let turn = 0, flips = 0, lastSign = 0;
  for (let i = 1; i < q.length - 1; i++) {
    const ang = Math.atan2(q[i + 1].y - q[i].y, q[i + 1].x - q[i].x) - Math.atan2(q[i].y - q[i - 1].y, q[i].x - q[i - 1].x);
    const d = Math.atan2(Math.sin(ang), Math.cos(ang));
    turn += d;
    if (Math.abs(d) > 0.25) { const sg = Math.sign(d); if (lastSign && sg !== lastSign) flips++; lastSign = sg; }
  }
  const sharp = cornerIndices(list).length;
  if (len < ink * 0.45 && pops >= total * 0.6) return T('nyuukon');
  if (chord / len > 0.9) return T('massugu');
  if (len > 180 && chord < len * 0.15) return T('wa');
  if (Math.abs(turn) > Math.PI * 1.6) return T('uzumaki');
  if (sharp >= 3) return T('inazuma');
  if (flips >= 3) return T('nami');
  return T('sanpo');
}

// ---------------------------------------------------------------- 共有・挑戦状・再生
export const SITE_URL = 'https://yuichi916.github.io/hitofude.html';
export const HASHTAG = '#一筆花火';

export function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

// 夜ごとの結果。🎆 目標の 3 倍以上 / ✨ 越えた / 💥 散った / 🌑 たどり着かず
export function nightMark(r) {
  if (!r) return '🌑';
  if (r.score < r.target) return '💥';
  return r.score >= r.target * 3 ? '🎆' : '✨';
}

export function runShareText(run, lang, url = SITE_URL) {
  const en = lang === 'en';
  const marks = Array.from({ length: NIGHTS }, (_, i) => nightMark(run.nights[i])).join('');
  const cleared = run.nights.filter((r) => r.score >= r.target).length;
  const moon = MOONS[run.moon];
  let head;
  if (run.daily) {
    const md = `${+run.key.slice(5, 7)}/${+run.key.slice(8, 10)}`;
    head = `${en ? 'Hitofude Hanabi' : '一筆花火'} #${run.no} ${md} ${en ? moon.en : moon.ja}`;
  } else head = en ? 'Hitofude Hanabi' : '一筆花火';
  const line2 = cleared === NIGHTS ? (en ? 'All 8 nights!' : '八夜 完走！') : (en ? `${cleared}/8 nights` : `${cleared}/8 夜`);
  const line3 = en ? `${fmt(run.total)} pts · best chain ${run.bestChain}` : `${fmt(run.total)}点 ・ 最大 ${run.bestChain}連鎖`;
  // 筆跡と、大一番の結果（今夜の一筆は、みんな同じ大一番）
  const extra = [];
  if (run.type) { const ty = STROKE_TYPES.find((x) => x.id === run.type); if (ty) extra.push(en ? `Stroke ${ty.emoji}${ty.en}` : `筆跡 ${ty.emoji}${ty.ja}`); }
  const bosses = run.nights.filter((r) => r && r.twist).map((r) => { const tw = TWISTS.find((x) => x.id === r.twist); return tw ? `${en ? tw.en : tw.ja}${r.score >= r.target ? '⭕' : '❌'}` : null; }).filter(Boolean);
  if (bosses.length) extra.push((en ? 'Boss ' : '大一番 ') + bosses.join(' '));
  const line4 = extra.length ? '\n' + extra.join(en ? ' · ' : ' ・ ') : '';
  return `${head}\n${marks}\n${line2} ${line3}${line4}\n${url}\n${en ? '#hitofudehanabi' : HASHTAG}`;
}

// 同じ夜で勝負: #s=<seed36>.<moon>[.<score>]
export function encodeDuel(seed, moon, score) {
  return `${(seed >>> 0).toString(36)}.${moon}${score ? '.' + Math.round(score) : ''}`;
}
export function decodeDuel(s) {
  const m = typeof s === 'string' && s.match(/^([0-9a-z]{1,7})\.([0-7])(?:\.(\d{1,12}))?$/);
  if (!m) return null;
  const seed = parseInt(m[1], 36);
  if (!Number.isFinite(seed) || seed > 0xffffffff) return null;
  return { seed: seed >>> 0, moon: +m[2], score: m[3] ? +m[3] : 0 };
}

// 一筆の再生: [版4][シード32][月3][夜3][お守り16][本数1+1][各線: 点数7, (x9, y10)×点数]
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
// 版 2: 大一番と夜の景色を足した（版 1 のリンクは、同じ夜を作れないので読まない）
export const REPLAY_VERSION = 2;
function writer() {
  const out = []; let acc = 0, n = 0;
  return {
    put(v, bits) { for (let i = bits - 1; i >= 0; i--) { acc = (acc << 1) | (Math.floor(v / 2 ** i) & 1); if (++n === 6) { out.push(B64[acc]); acc = 0; n = 0; } } },
    done() { if (n) out.push(B64[acc << (6 - n)]); return out.join(''); },
  };
}
function reader(s) {
  const vals = [];
  for (const ch of s) { const v = B64.indexOf(ch); if (v < 0) return null; vals.push(v); }
  let i = 0, bit = 0;
  return {
    get(bits) {
      let v = 0;
      for (let k = 0; k < bits; k++) {
        if (i >= vals.length) throw new Error('short');
        v = v * 2 + ((vals[i] >>> (5 - bit)) & 1);
        if (++bit === 6) { bit = 0; i++; }
      }
      return v;
    },
  };
}
export function encodeReplay({ seed, moon, night, charms, strokes }) {
  const w = writer();
  w.put(REPLAY_VERSION, 4); w.put(seed >>> 0, 32); w.put(moon, 3); w.put(night, 3);
  let mask = 0;
  for (const c of charms) { const i = CHARM_IDS.indexOf(c); if (i >= 0) mask |= 1 << i; }
  w.put(mask, 16);
  w.put(Math.min(2, strokes.length) - 1, 1);
  for (const pts of strokes.slice(0, 2)) {
    w.put(pts.length, 7);
    for (const p of pts) { w.put(p.x, 9); w.put(p.y, 10); }
  }
  return w.done();
}
export function decodeReplay(s) {
  if (typeof s !== 'string' || s.length < 12 || s.length > 700) return null;
  const r = reader(s);
  if (!r) return null;
  try {
    const ver = r.get(4);
    if (ver !== REPLAY_VERSION) return ver >= 1 && ver < REPLAY_VERSION ? { old: true } : null;
    const seed = r.get(32) >>> 0, moon = r.get(3), night = r.get(3), mask = r.get(16);
    if (night >= NIGHTS) return null;
    const charms = CHARM_IDS.filter((_, i) => mask & (1 << i));
    if (mask >> CHARM_IDS.length) return null;
    const count = r.get(1) + 1;
    const strokes = [];
    for (let k = 0; k < count; k++) {
      const n = r.get(7);
      if (n < 3) return null;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const x = r.get(9), y = r.get(10);
        if (x >= W || y >= H) return null;
        pts.push({ x, y });
      }
      strokes.push(pts);
    }
    return { seed, moon, night, charms, strokes };
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------- 記録
// 連続記録は「遊んだ日」で数える。1 日だけの休みは、7 日に 1 回まで見逃す
export function nextStreak(prev, today) {
  const s = { streak: 0, last: null, freezeOn: null, ...(prev || {}) };
  if (s.last === today) return s;
  if (!s.last) return { ...s, streak: 1, last: today };
  const gap = Math.round((keyToUTC(today) - keyToUTC(s.last)) / DAY_MS);
  if (gap === 1) return { ...s, streak: s.streak + 1, last: today };
  const freezeOk = !s.freezeOn || Math.round((keyToUTC(today) - keyToUTC(s.freezeOn)) / DAY_MS) >= 7;
  if (gap === 2 && freezeOk) return { ...s, streak: s.streak + 1, last: today, freezeOn: addDays(today, -1) };
  return { ...s, streak: 1, last: today };
}
export function currentStreak(s, today) {
  if (!s || !s.last || !s.streak) return 0;
  const gap = Math.round((keyToUTC(today) - keyToUTC(s.last)) / DAY_MS);
  if (gap <= 1) return s.streak;
  const freezeOk = !s.freezeOn || Math.round((keyToUTC(today) - keyToUTC(s.freezeOn)) / DAY_MS) >= 7;
  return gap === 2 && freezeOk ? s.streak : 0;
}
// counts[i] = i 夜を越えた人数。自分より先まで行った人数 + 同じ人数の半分 から上位 % を出す
export function topPercent(counts, mine) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < 10) return null;
  let better = 0;
  for (let i = mine + 1; i < counts.length; i++) better += counts[i];
  const p = Math.round(((better + counts[mine] / 2) / total) * 100);
  return Math.max(1, Math.min(99, p));
}
