// 一筆花火 — 線を1本ひくと、それが導火線になる。純関数と、決定的なシミュレーションだけを置く
// （DOM・音・storage に触らない）。ページは hitofude.html、テストは tests/hitofude_core_test.mjs。
//
// 座標は W×H の論理単位。シミュレーションは 1/60 秒ずつ進め、同じ夜・同じ線なら必ず同じ結果になる
// （挑戦状と再生リンクは、これを前提にしている）。

export const W = 360;
export const H = 640;
export const DT = 1 / 60;
// ---------------------------------------------------------------- ステージ
// 八夜で1ステージ。今遊べるのはステージ1だけで、次のステージは反響を見てアップデートで足す
// （景色と仕掛けを変えて続ける）。夜ごとの仕掛け・大一番・景色は、今はステージ1のものだけを持つ
export const STAGES = [
  { id: 1, ja: '川辺の夏祭り', en: 'Riverside Festival', nights: 8, ready: true },
  { id: 2, ja: '準備中', en: 'Coming soon', nights: 8, ready: false },
];
export const STAGE = STAGES[0];
export const NIGHTS = STAGE.nights;
export function nextStage(id) { return STAGES.find((s) => s.id === id + 1) || null; }
// ステージを完走した記録: { <id>: { first: 初めて完走した日, best: 完走したときの最高点 } }（もとの記録は書き換えない）
export function recordStageClear(rec, id, total, dateKey) {
  const out = { ...(rec || {}) };
  const cur = out[id];
  out[id] = cur ? { first: cur.first, best: Math.max(cur.best || 0, total) } : { first: dateKey, best: total };
  return out;
}

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
  kuro: { r: 12, R: 120, pts: 60 },    // 黒玉（花火合戦のお邪魔玉）: 最初の火を消し、ひびが入ったあと導火線の火が届くと大爆発。倍率 +1
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

export function newRound({ seed, night, charms = [], moon = 4, par = false, vs = null }) {
  const rules = rulesFor(charms, moon);
  if (vs) rules.extraShells += vs.extra || 0;
  const tw = vs ? null : twistFor(seed, night);
  const clouds = makeClouds(seed, night, rules);
  const shells = makeLayout(seed, night, rules, clouds).map((s) => ({ ...s, burst: false, burstAt: -1, hp: s.type === 'shime' ? rules.dampHits : 1, lastSrc: null }));
  const st = {
    seed: seed >>> 0, night, charms: charms.slice(), moon, rules, shells, clouds, ropes: [],
    twist: tw ? tw.id : null, scene: sceneFor(seed, night).id, target: par || vs ? 0 : targetFor(seed, night, moon),
    t: 0, tick: 0, phase: 'draw', strokes: [], ink: Math.round(rules.ink * (tw && tw.id === 'kagami' ? MIRROR_INK : 1)),
    fuse: { pts: [], burnt: [], seg: [], wet: [], rope: [], links: [], owner: [], fire: [], corners: new Set(), ends: new Set() },
    heads: [], explosions: [], sparks: [], embers: [], nextId: 1,
    pops: 0, chips: 0, goldMult: 0, lanterns: 0, maxChainAt: 0, events: [],
    rng: rng32(nightSeed(seed, night) ^ 0x9e3779b9), secondUsed: false, done: false, result: null, vs: null,
  };
  if (vs) st.vs = newVsState(vs);
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
function addSegment(st, samples, segId, isRope, owner = 0) {
  const f = st.fuse, base = f.pts.length;
  for (const p of samples) {
    f.pts.push(p); f.burnt.push(false); f.seg.push(segId); f.rope.push(!!isRope); f.owner.push(isRope ? -1 : owner); f.fire.push(-1);
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
  const placed = placePoints(st, input, 0);
  if (!placed) return null;
  igniteStroke(st, placed, 0);
  return placed.pts;
}
// 線を導火線として置く（火はまだつけない）。owner は線を引いた人（花火合戦では 0 = あなた、1 = 相手）
function placePoints(st, input, owner, segOverride = null) {
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
  const segId = segOverride == null ? st.strokes.length - 1 : segOverride;
  const base = addSegment(st, samples, segId, false, owner);
  const corners = st.rules.corners ? cornerIndices(pts).map((ci) => base + Math.round(ci * STROKE_STEP / FUSE_SAMPLE)) : [];
  for (const c of corners) st.fuse.corners.add(Math.min(c, st.fuse.pts.length - 1));
  st.fuse.ends.add(st.fuse.pts.length - 1);
  // 鏡の夜は、左右に映した線も置いて、両方の端から火をつける
  let mirror = null;
  if (st.twist === 'kagami') {
    const ms = samples.map(mirrorPoint), mseg = 20 + segId;
    const mb = addSegment(st, ms, mseg, false, owner);
    for (const c of corners) st.fuse.corners.add(Math.min(mb + (c - base), st.fuse.pts.length - 1));
    st.fuse.ends.add(st.fuse.pts.length - 1);
    mirror = { base: mb, seg: mseg, p: ms[0] };
  }
  return { pts, base, segId, p0: samples[0], mirror, len: samples.length };
}
// 置いた線の引きはじめに火をつける
function igniteStroke(st, placed, o) {
  const { base, segId, p0, mirror } = placed;
  st.phase = 'burn';
  // 花火合戦: 引きはじめが、もう相手の火で燃えていたら、火はつかない（線の頭を取られた）
  if (st.fuse.burnt[base]) { st.events.push({ type: 'fizzle', x: p0.x, y: p0.y, o }); return; }
  st.fuse.burnt[base] = true; st.fuse.fire[base] = o;
  st.events.push({ type: 'light', x: p0.x, y: p0.y, o });
  // 雲の中から引きはじめた線は、火がつかない
  const mainWet = st.fuse.wet[base];
  if (!mainWet) {
    st.heads.push({ i: base, dir: 1, f: base, o });
    fuseNeighborsBurst(st, p0, st.rules.reach, 'f' + segId, o);
    catchLinks(st, base, o);
  }
  if (mirror && !st.fuse.burnt[mirror.base]) {
    st.fuse.burnt[mirror.base] = true; st.fuse.fire[mirror.base] = o;
    if (!st.fuse.wet[mirror.base]) {
      st.heads.push({ i: mirror.base, dir: 1, f: mirror.base, o });
      fuseNeighborsBurst(st, mirror.p, st.rules.reach, 'f' + mirror.seg, o);
      catchLinks(st, mirror.base, o);
    }
  }
  if (mainWet && !st.heads.some((h) => h.o === o)) st.events.push({ type: 'fizzle', x: p0.x, y: p0.y, o });
}

function spawnExplosion(st, x, y, R, cause, hue, o = 0) {
  st.explosions.push({ id: st.nextId++, x, y, R, t: 0, cause, hue: hue == null ? -1 : hue, o });
}

// src は火の出どころ（爆発・火花・導火線の区間）。湿った玉は、別々の出どころから 2 回当たるとひらく。
// o は火の持ち主。花火合戦では、ひらいた玉の点は、その火の持ち主のものになる
function burst(st, s, cause, src, o = 0) {
  if (s.burst) return;
  if ((s.type === 'shime' || s.type === 'kuro') && s.lastSrc === src) return; // 同じ火は、何度当たっても 1 回と数える
  if (s.type === 'kuro' && s.hp === 1 && cause !== 'fuse') return; // ひびの入った黒玉は、導火線の火でしか爆発しない（爆発や火花は、はね返る）
  if (s.hp > 1) {
    s.hp--; s.lastSrc = src;
    if (s.type === 'kuro') crackKuro(st, s, o); else st.events.push({ type: 'dry', shell: s, o });
    return;
  }
  const def = SHELLS[s.type];
  s.burst = true; s.burstAt = st.t; s.by = o;
  st.pops++;
  const side = st.vs ? st.vs.side[o] : null;
  const factor = side ? 1 + side.lanterns : pointFactor(st);
  st.chips += def.pts * factor;
  if (side) { side.pops++; side.chips += def.pts * factor; }
  if (s.type === 'kin') { st.goldMult += st.rules.goldBonus; if (side) side.gold += st.rules.goldBonus; }
  if (s.type === 'shaku') { st.goldMult += 3; if (side) side.gold += 3; }
  if (side) {
    const v = st.vs;
    v.powder[o] = Math.min(VS_POWDER.max, v.powder[o] + 1 + (s.type === 'kuro' ? VS_POWDER.kuro : 0));
    if (s.type === 'kuro') { side.gold += 1; side.kuro++; if (s.from !== o) side.back++; st.events.push({ type: 'kuroBoom', shell: s, o, from: s.from }); }
  }
  if (s.type === 'chouchin') {
    st.lanterns += st.rules.lanternGain;
    if (side) side.lanterns += st.rules.lanternGain;
    st.events.push({ type: 'lantern', shell: s, factor: side ? 1 + side.lanterns : pointFactor(st), o });
  }
  spawnExplosion(st, s.x, s.y, def.R * st.rules.radius * (side ? st.vs.mod[o].radius : 1), cause, s.hue, o);
  if (s.type === 'senrin') {
    const n = st.rules.senrinSparks;
    const off = (s.id * 0.61803) % 1;
    for (let k = 0; k < n; k++) {
      const a = (k / n + off) * Math.PI * 2;
      st.sparks.push({ id: st.nextId++, x: s.x, y: s.y, vx: Math.cos(a) * SPARK_SPEED, vy: Math.sin(a) * SPARK_SPEED, life: SPARK_LIFE, o });
    }
  }
  if (st.rules.afterglow && st.rng() < st.rules.afterglow) st.embers.push({ x: s.x, y: s.y, at: st.t + 0.8, R: def.R * 0.7 * st.rules.radius, pts: Math.round(def.pts / 2) * (side ? 1 + side.lanterns : pointFactor(st)), hue: s.hue, o });
  st.events.push({ type: 'burst', shell: s, chain: side ? side.pops : st.pops, cause, o });
}

function igniteFuseAt(st, i, o = 0) {
  const f = st.fuse;
  if (f.burnt[i] || f.wet[i]) return;
  f.burnt[i] = true; f.fire[i] = o;
  st.heads.push({ i, dir: 1, f: i, o }, { i, dir: -1, f: i, o });
  st.events.push({ type: 'catch', x: f.pts[i].x, y: f.pts[i].y, rope: f.rope[i], o });
  // 花火合戦: 相手の線に自分の火が移った（横取り）。すでに自分の火が燃やしている所の続きは数えない
  if (st.vs && f.owner[i] >= 0 && f.owner[i] !== o) {
    const cont = (j) => j >= 0 && j < f.pts.length && f.seg[j] === f.seg[i] && f.fire[j] === o;
    if (!cont(i - 1) && !cont(i + 1)) { st.vs.side[o].steals++; st.events.push({ type: 'steal', x: f.pts[i].x, y: f.pts[i].y, o }); }
  }
  fuseNeighborsBurst(st, f.pts[i], st.rules.reach, 'f' + f.seg[i], o);
  catchLinks(st, i, o);
}
// 燃えた点のすぐそばを通る別の区間（縄や、もう 1 本の線）にも火を移す
function catchLinks(st, i, o = 0) {
  for (const j of st.fuse.links[i]) igniteFuseAt(st, j, o);
}

function fuseNeighborsBurst(st, p, reach, src, o = 0) {
  if (st.vs) reach *= st.vs.mod[o].reach;
  for (const s of st.shells) {
    if (s.burst) continue;
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d <= SHELLS[s.type].r + reach) burst(st, s, 'fuse', src, o);
  }
}
// 火の頭・爆発・火花を順に動かす。動かしている間に増えたもの（燃え移った火など）も、同じコマのうちに動かす。
// 花火合戦では、同じ瞬間に 2 人の火が同じ玉に届いたとき、どちらが先かを 1 コマごとに入れかえる（いつも同じ人が勝たないように）
function eachFair(st, list, fn) {
  if (!st.vs) { for (const x of list) fn(x); return; }
  const n = list.length, first = st.tick % 2;
  for (const x of list.slice(0, n).sort((a, b) => (a.o === first ? 0 : 1) - (b.o === first ? 0 : 1))) fn(x);
  for (let k = n; k < list.length; k++) fn(list[k]);
}

export function step(st) {
  if (st.done || st.phase === 'draw' || st.phase === 'draw2') return st;
  st.t += DT; st.tick++;
  const f = st.fuse;
  if (st.vs) vsTick(st);
  // 導火線の火
  const adv = FUSE_SPEED * DT / FUSE_SAMPLE;
  const alive = [];
  eachFair(st, st.heads, (h) => {
    let dead = false;
    const target = h.f + h.dir * adv;
    while (!dead) {
      const next = h.i + h.dir;
      if ((h.dir > 0 && next > target) || (h.dir < 0 && next < target)) break;
      if (next < 0 || next >= f.pts.length || f.burnt[next] || f.wet[next] || f.seg[next] !== f.seg[h.i]) { dead = true; break; }
      f.burnt[next] = true; f.fire[next] = h.o;
      h.i = next;
      fuseNeighborsBurst(st, f.pts[next], st.rules.reach, 'f' + f.seg[next], h.o);
      catchLinks(st, next, h.o);
      if (f.corners.has(next)) spawnExplosion(st, f.pts[next].x, f.pts[next].y, 42 * st.rules.radius, 'corner', 3, h.o);
      if (st.rules.endBurst && f.ends.has(next)) spawnExplosion(st, f.pts[next].x, f.pts[next].y, 80 * st.rules.radius, 'end', 2, h.o);
    }
    h.f = target;
    if (!dead) alive.push(h);
  });
  // 雨雲に消された火は、ここで落とす（燃える先が雲の中なら、上の見回りで止まっている）
  st.heads = st.vs ? alive.filter((h) => !f.wet[h.i]) : alive;
  // 爆発: ひらいている間、近くの玉と導火線に火を移す
  eachFair(st, st.explosions, (e) => {
    e.t += DT;
    if (e.t > BURST_GROW + BURST_HOLD) return;
    const rad = e.R * Math.min(1, e.t / BURST_GROW);
    const clouds = st.clouds;
    for (const s of st.shells) {
      if (s.burst) continue;
      if (Math.hypot(s.x - e.x, s.y - e.y) > rad + SHELLS[s.type].r) continue;
      // 雲の向こうには火が届かない
      if (clouds.length && crossesCloud(clouds, e.x, e.y, s.x, s.y)) continue;
      burst(st, s, 'chain', e.id, e.o);
    }
    let best = -1, bd = 1e9;
    for (let i = 0; i < f.pts.length; i++) {
      if (f.burnt[i] || f.wet[i]) continue;
      const d = Math.hypot(f.pts[i].x - e.x, f.pts[i].y - e.y);
      if (d <= rad && d < bd) { bd = d; best = i; }
    }
    if (best >= 0 && !(clouds.length && crossesCloud(clouds, e.x, e.y, f.pts[best].x, f.pts[best].y))) igniteFuseAt(st, best, e.o);
  });
  // 千輪の火花
  const sparks = [];
  eachFair(st, st.sparks, (sp) => {
    sp.x += sp.vx * DT; sp.y += sp.vy * DT; sp.life -= DT;
    if (st.clouds.length && inCloud(st.clouds, sp.x, sp.y)) return; // 雲に入った火花は消える
    for (const s of st.shells) {
      if (!s.burst && Math.hypot(s.x - sp.x, s.y - sp.y) <= SHELLS[s.type].r + 5) burst(st, s, 'spark', sp.id, sp.o);
    }
    for (let i = 0; i < f.pts.length; i++) {
      if (!f.burnt[i] && !f.wet[i] && Math.hypot(f.pts[i].x - sp.x, f.pts[i].y - sp.y) <= 5) { igniteFuseAt(st, i, sp.o); break; }
    }
    if (sp.life > 0 && sp.x > -10 && sp.x < W + 10 && sp.y > -10 && sp.y < H + 10) sparks.push(sp);
  });
  st.sparks = sparks;
  // 残り火
  const embers = [];
  for (const em of st.embers) {
    if (st.t >= em.at) {
      st.chips += em.pts; if (st.vs) st.vs.side[em.o].chips += em.pts;
      spawnExplosion(st, em.x, em.y, em.R, 'ember', em.hue, em.o); st.events.push({ type: 'ember', x: em.x, y: em.y, o: em.o });
    } else embers.push(em);
  }
  st.embers = embers;
  st.explosions = st.explosions.filter((e) => e.t <= BURST_GROW + BURST_HOLD + 0.6);
  // 終わったか
  const busy = st.heads.length || st.sparks.length || st.embers.length || st.explosions.some((e) => e.t <= BURST_GROW + BURST_HOLD) || (st.vs && st.vs.ignite.length);
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
  if (st.vs) return finishVs(st);
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

// ---------------------------------------------------------------- 花火合戦（CPU と対戦）
// 同じ夜空に、2 人がそれぞれ 1 本ずつ線を引く。自分の火でひらいた玉が、自分の点になる。
// 相手の線に自分の火が移ると、そこから先は自分の火として燃える（横取り）。先に火が届いた方が取る。
// 先手（相手）が先に線を見せ、後手（あなた）はそれを見てから引く。火は 2 人いっしょにつく。
// 番の前に「作戦札」を 1 枚選ぶ。火が走っているあいだは、自分の玉がひらくたびに「火薬」がたまり、2 つの道具に使える:
//  ・お邪魔玉（黒玉）: 相手の火の先に落とす。最初に触れた火は消え、線もそこで切れる。ひびが入った黒玉は、
//    導火線の火（継ぎ火など）が届くと大爆発し、届けた人の点になる（落とされた側も、火を届ければ逆に戦力にできる）
//  ・継ぎ火: 自分の火が通ったあとから、短い線を 1 本足して、すぐ火をつける
// 持ち主の番号は 0 = あなた、1 = 相手
export const VS_BOUTS = [
  { night: 2, extra: 8, ja: '群れと千輪', en: 'Clusters & stars' },
  { night: 3, extra: 8, ja: '提灯の取り合い', en: 'Lantern fight' },
  { night: 7, extra: 0, ja: 'まん中の尺玉を取り合う', en: 'Fight for the grand shell' },
];
export const VS_WIN = 2;            // 先に 2 番取った方の勝ち
export const VS_FIRST = [1, 1, 1];  // 番ごとの先手（いつも相手が先に線を見せ、あなたはそれを見てから引く）
export const VS_START_GAP = 26;     // 後手は先手の線のすぐそばから、どちらも尺玉のすぐそばからは引きはじめられない
export const VS_FALL = 0.2;         // 相手のお邪魔玉は、落ちる影が見えてから効くまでこれだけかかる
// 火薬: はじめ 3、自分の玉が 1 つひらくごとに +1（黒玉を爆発させると +3）、12 まで。
// 道具の値段は、同じ番で同じ道具を使うたびに +2（連発より、使いどころを選ぶ）
export const VS_POWDER = { start: 3, max: 12, ojama: 3, tsugi: 5, kuro: 3, again: 2 };
export function vsCost(st, o, tool) { const sd = st.vs.side[o]; return VS_POWDER[tool] + VS_POWDER.again * sd[tool]; }
export const VS_TSUGI_INK = 130;    // 継ぎ火の墨
export const VS_TSUGI_GAP = 22;     // 継ぎ火は、自分の火が通った所からこの距離の中で引きはじめる
export const VS_KURO_SOAK = 24;     // 黒玉に最初に触れた火は、まわりこの距離の導火線ごと消える
// 作戦札（番ごとに 3 枚から 1 枚）
export const TACTICS = [
  { id: 'nagafude', emoji: '🖌️', ja: '長い筆', en: 'Long brush', desc: '墨 +35%', descEn: 'Ink +35%' },
  { id: 'futofude', emoji: '🪶', ja: '太い筆', en: 'Thick brush', desc: '線から火が届く幅 ×2', descEn: 'Fuse reach ×2' },
  { id: 'tairin', emoji: '🌸', ja: '大輪', en: 'Big bloom', desc: '自分の玉のひらく大きさ +25%', descEn: 'Your bursts +25%' },
  { id: 'kayaku', emoji: '🧨', ja: '火薬箱', en: 'Powder keg', desc: '火薬 +4 で始まる', descEn: 'Start with +4 powder' },
  { id: 'hayabi', emoji: '⚡', ja: '早火', en: 'Quick light', desc: '自分の火が 0.15 秒早くつく', descEn: 'Your fire lights 0.15 s sooner' },
];
export function tacticById(id) { return TACTICS.find((x) => x.id === id) || null; }
// 番ごとの作戦札の候補（シードで決まる。挑戦状で遊ぶ人も同じ札が出る）
export function vsOffers(seed, bout, o) {
  return shuffled(TACTICS.map((x) => x.id), rng32(hashStr(`hitofude-vs-tactic:${seed >>> 0}:${bout}:${o}`))).slice(0, 3);
}

// 番付（弱い順）。強さは _dev/hitofude-vs-balance.mjs で CPU どうしを戦わせて決めた。
// lines は線を考える本数、pick は上から何本の中から選ぶか（多いほど気まぐれ）、probe は「あなたの返し手」を何通り読むか（いちばん効く）、
// lag は火をつけるのが遅れる秒、ink は墨の倍率。
// 道具: react は火がついてから道具を考えはじめるまでの秒、ojama / tsugi は使うかどうかと「使う価値がある」と見なす割合（残りの玉のうち）。
// powder は、はじめから多く持っている火薬。tactics は作戦札の好み（前ほど好き）
export const RIVALS = [
  { id: 'chibi', ja: 'チビ火', en: 'Chibi', title: '見習いの火の子', titleEn: 'Apprentice spark', lines: 1, pick: 1, probe: 0, lag: 0.25, ink: 0.8,
    react: 99, ojama: 0, tsugi: 0, tactics: [],
    body: ['#e9fbff', '#8fe3ff', '#3fb4ff', '#1f6fe0'], say: { start: 'よーし、負けないぞ！', steal: 'やった、もらい！', stolen: 'あっ、ぼくの線…', ojama: 'えいっ、お邪魔！', boom: 'わー、ドカン！', win: 'かったー！', lose: 'つよいなあ…' },
    sayEn: { start: 'I won\'t lose!', steal: 'Mine now!', stolen: 'Hey, my line…', ojama: 'Take this!', boom: 'Whoa, boom!', win: 'I won!', lose: 'You\'re good…' } },
  { id: 'shizuku', ja: 'シズク', en: 'Shizuku', title: '線香花火の子', titleEn: 'Sparkler girl', lines: 3, pick: 2, probe: 0, lag: 0.1, ink: 0.9,
    react: 1.0, ojama: 0.3, tsugi: 0, tactics: ['nagafude', 'kayaku'],
    body: ['#fbf0ff', '#d9a8ff', '#a066f0', '#6a34c8'], say: { start: '提灯は、わたしのもの', steal: 'しずかに、いただきます', stolen: 'あら…', ojama: 'ちょっと、じゃましますね', boom: 'まあ、はでな…', win: 'ふふ、勝ち', lose: 'きれいな線だった' },
    sayEn: { start: 'The lantern is mine.', steal: 'Quietly taken.', stolen: 'Oh my…', ojama: 'Pardon the interruption.', boom: 'How flashy…', win: 'Hehe, I win.', lose: 'What a line.' } },
  { id: 'don', ja: 'ドン', en: 'Don', title: '打ち上げ屋の親方', titleEn: 'Master launcher', lines: 3, pick: 3, probe: 1, lag: 0, ink: 1,
    react: 1.0, ojama: 0.22, tsugi: 0, tactics: ['tairin', 'nagafude'],
    body: ['#f2fff0', '#9dffb0', '#35d37a', '#16804a'], say: { start: '大玉は、ドンといただく', steal: 'ドーン！', stolen: 'ぬうっ', ojama: '黒玉、くらえ！', boom: 'でっけえ花火だ！', win: 'ガッハッハ！', lose: 'やるじゃねえか' },
    sayEn: { start: 'Big shells are mine!', steal: 'BOOM!', stolen: 'Grr!', ojama: 'Eat this!', boom: 'What a blast!', win: 'Ha ha ha!', lose: 'Not bad, kid.' } },
  { id: 'karakuri', ja: 'カラクリ', en: 'Karakuri', title: '横取りとお邪魔の名人', titleEn: 'Master of theft and tricks', lines: 6, pick: 1, probe: 1, lag: 0, ink: 1,
    react: 0.45, ojama: 0.14, tsugi: 0.14, tactics: ['hayabi', 'kayaku', 'futofude'],
    body: ['#fff8e8', '#ffd98a', '#e0a030', '#9a6010'], say: { start: '線は、読んでいるよ', steal: '計算どおり', stolen: 'ほう、読まれたか', ojama: 'からくり、発動', boom: 'それも計算のうち…？', win: 'からくり、完成', lose: '見事な手だ' },
    sayEn: { start: 'I\'ve read your line.', steal: 'As calculated.', stolen: 'Oh, you read me.', ojama: 'Trap activated.', boom: 'Was that… planned?', win: 'Mechanism complete.', lose: 'A fine move.' } },
  { id: 'tsukikage', ja: 'ツキカゲ', en: 'Tsukikage', title: '月夜の花火師', titleEn: 'Moonlit master', lines: 6, pick: 1, probe: 2, lag: 0, ink: 1,
    react: 0.3, ojama: 0.1, tsugi: 0.1, powder: 2, tactics: ['hayabi', 'tairin', 'kayaku'],
    body: ['#ffffff', '#dfe6ff', '#8a9cff', '#3a3f9a'], say: { start: '月の下で、勝負', steal: '月は、すべてを照らす', stolen: '…やるね', ojama: '影を、落とそう', boom: '月も、驚いている', win: '今宵も、月の勝ち', lose: 'きみの花火、覚えておく' },
    sayEn: { start: 'Under the moon, we duel.', steal: 'The moon sees all.', stolen: '…impressive.', ojama: 'Let a shadow fall.', boom: 'Even the moon is surprised.', win: 'The moon wins tonight.', lose: 'I\'ll remember your fireworks.' } },
];
export function rivalById(id) { return RIVALS.find((r) => r.id === id) || RIVALS[0]; }
// 相手の作戦札: 出た 3 枚のうち、好みの札（無ければ 1 枚目）
export function rivalTactic(rival, offers) {
  for (const id of rival.tactics || []) if (offers.includes(id)) return id;
  return (rival.tactics || []).length ? offers[0] : null;
}

// 番の盤面。ink は [あなた, 相手] の墨の倍率、lag は [あなた, 相手] の火が遅れてつく秒、tactics は [あなた, 相手] の作戦札
export function newVsRound({ seed, bout, moon = 4, ink = [1, 1], lag = [0, 0], tactics = [null, null], powder = [0, 0], first = VS_FIRST[bout] }) {
  const b = VS_BOUTS[bout];
  const st = newRound({ seed, night: b.night, moon, vs: { extra: b.extra, first } });
  const v = st.vs;
  v.bout = bout; v.lag = lag.slice(); v.inkK = ink.slice();
  v.powder = v.powder.map((x, o) => Math.min(VS_POWDER.max, x + (powder[o] || 0)));
  v.ink = ink.map((k) => Math.round(st.rules.ink * k));
  for (const o of [0, 1]) if (tactics[o]) vsSetTactic(st, o, tactics[o]);
  st.ink = v.ink[0];
  return st;
}
function newVsState(vs) {
  return {
    first: vs.first == null ? 1 : vs.first, bout: 0, ink: null, inkK: [1, 1], lag: [0, 0],
    side: [0, 1].map(() => ({ pops: 0, chips: 0, gold: 0, lanterns: 0, steals: 0, ojama: 0, tsugi: 0, kuro: 0, back: 0 })),
    mod: [0, 1].map(() => ({ reach: 1, radius: 1 })), tactic: [null, null],
    powder: [VS_POWDER.start, VS_POWDER.start], ignite: [], falling: [], placed: [null, null], cool: [0, 0], nextShell: 1000,
  };
}
// 作戦札を効かせる（線を置く前に）
export function vsSetTactic(st, o, id) {
  const v = st.vs, tc = tacticById(id);
  if (!v || !tc || v.tactic[o] || v.placed[o]) return false;
  v.tactic[o] = id;
  if (id === 'nagafude') v.ink[o] = Math.round(st.rules.ink * v.inkK[o] * 1.35);
  if (id === 'futofude') v.mod[o].reach = 2;
  if (id === 'tairin') v.mod[o].radius = 1.25;
  if (id === 'kayaku') v.powder[o] = Math.min(VS_POWDER.max, v.powder[o] + 4);
  if (id === 'hayabi') v.lag[1 - o] = (v.lag[1 - o] || 0) + 0.15;
  if (o === 0) st.ink = v.ink[0];
  return true;
}
// 引きはじめてよい所か。後手は先手の線のすぐそばから、どちらも尺玉のすぐそばからは引きはじめられない
export function vsCanStart(st, o, p) {
  if (!p) return true;
  if (st.shells.some((s) => s.type === 'shaku' && Math.hypot(s.x - p.x, s.y - p.y) < SHELLS.shaku.r + VS_START_GAP)) return false;
  const other = st.vs.placed[1 - o];
  if (!other) return true;
  const f = st.fuse;
  for (let i = other.base; i < other.base + other.len; i++) if (Math.hypot(f.pts[i].x - p.x, f.pts[i].y - p.y) < VS_START_GAP) return false;
  return true;
}
// 線を置く（火はまだ）。置けなければ null（短すぎる・相手の線のすぐそばから引いた）
export function vsPlace(st, o, input, { normalized = false } = {}) {
  const v = st.vs;
  if (!v || v.placed[o] || st.phase !== 'draw') return null;
  const ink = v.ink[o], keep = st.ink;
  const pts = normalized ? input : normalizeStroke(input, ink);
  if (!pts || pts.length < 3 || !vsCanStart(st, o, pts[0])) return null;
  st.ink = ink;
  const placed = placePoints(st, pts, o);
  st.ink = keep;
  if (!placed) return null;
  v.placed[o] = placed;
  return placed.pts;
}
// 点火。2 人いっしょに火がつく（lag のある方は、その秒数だけ遅れて）
export function vsIgnite(st) {
  const v = st.vs;
  st.phase = 'burn';
  for (const o of [v.first, 1 - v.first]) {
    if (!v.placed[o]) continue;
    const d = Math.round((v.lag[o] || 0) / DT);
    if (d > 0) v.ignite.push({ tick: st.tick + d, o }); else igniteStroke(st, v.placed[o], o);
  }
  st.events.push({ type: 'vsStart', first: v.first });
}
// 道具が使える場面か
function toolReady(st, o, tool) { const v = st.vs; return !!v && !st.done && st.phase === 'burn' && v.powder[o] >= vsCost(st, o, tool); }
// お邪魔玉を置ける所か（ほかの玉と重ならない・場の中）
export function vsOjamaSpot(st, x, y) {
  if (x < FIELD.x0 || x > FIELD.x1 || y < FIELD.y0 - 20 || y > FIELD.y1 + 20) return false;
  return !st.shells.some((s) => !s.burst && Math.hypot(s.x - x, s.y - y) < SHELLS[s.type].r + SHELLS.kuro.r);
}
// お邪魔玉を落とす。delay 秒後に現れる（落ちてくる影を見せる間）
export function vsDropOjama(st, o, x, y, delay = 0) {
  const v = st.vs;
  x = Math.round(x); y = Math.round(y);
  if (!toolReady(st, o, 'ojama') || !vsOjamaSpot(st, x, y)) return false;
  v.powder[o] -= vsCost(st, o, 'ojama'); v.side[o].ojama++; v.cool[o] = st.tick + 18;
  const c = { x, y, o, tick: st.tick + Math.round(delay / DT) };
  if (delay > 0) { v.falling.push(c); st.events.push({ type: 'ojamaFall', x, y, o, at: st.t + delay }); } else landOjama(st, c);
  return true;
}
function landOjama(st, c) {
  const s = { id: st.vs.nextShell++, type: 'kuro', x: c.x, y: c.y, hue: 5, burst: false, burstAt: -1, hp: 2, lastSrc: null, from: c.o };
  st.shells.push(s);
  st.events.push({ type: 'ojama', shell: s, o: c.o });
  // すでに火や爆発がそこにあれば、落ちた瞬間に触れる
  const f = st.fuse;
  for (const h of st.heads) if (Math.hypot(f.pts[h.i].x - s.x, f.pts[h.i].y - s.y) <= SHELLS.kuro.r + st.rules.reach * st.vs.mod[h.o].reach) { burst(st, s, 'fuse', 'f' + f.seg[h.i], h.o); break; }
}
// 黒玉に最初に火が触れた: その火は消え、まわりの導火線も濡れて切れる。黒玉にはひびが入る
function crackKuro(st, s, o) {
  const f = st.fuse;
  // 触れた火の頭が必ず入る広さ（太い筆や月で火の届く幅が広いときも）
  const soak = Math.max(VS_KURO_SOAK, SHELLS.kuro.r + st.rules.reach * st.vs.mod[o].reach + 4);
  for (let i = 0; i < f.pts.length; i++) if (!f.wet[i] && Math.hypot(f.pts[i].x - s.x, f.pts[i].y - s.y) < soak) f.wet[i] = true;
  st.sparks = st.sparks.filter((sp) => Math.hypot(sp.x - s.x, sp.y - s.y) >= soak);
  st.events.push({ type: 'crack', shell: s, o, from: s.from });
}
// 継ぎ火を引きはじめてよい所か（自分の火が通ったあとのそば）
export function vsCanExtend(st, o, p) {
  if (!p) return false;
  const f = st.fuse;
  for (let i = 0; i < f.pts.length; i++) if (f.fire[i] === o && Math.hypot(f.pts[i].x - p.x, f.pts[i].y - p.y) < VS_TSUGI_GAP) return true;
  return false;
}
// 継ぎ火: 短い線を足して、すぐに自分の火をつける
export function vsExtend(st, o, input, { normalized = false } = {}) {
  const v = st.vs;
  if (!toolReady(st, o, 'tsugi')) return null;
  const pts = normalized ? input : normalizeStroke(input, VS_TSUGI_INK);
  if (!pts || pts.length < 3 || !vsCanExtend(st, o, pts[0])) return null;
  const keep = st.ink; st.ink = VS_TSUGI_INK;
  const placed = placePoints(st, pts, o, 100 + st.strokes.length);
  st.ink = keep;
  if (!placed) return null;
  v.powder[o] -= vsCost(st, o, 'tsugi'); v.side[o].tsugi++; v.cool[o] = st.tick + 18;
  st.events.push({ type: 'tsugi', o, pts: placed.pts });
  igniteStroke(st, placed, o);
  return placed.pts;
}
// 1 コマごと: 遅れてつく火と、落ちてきたお邪魔玉
function vsTick(st) {
  const v = st.vs;
  if (v.ignite.length) {
    const now = v.ignite.filter((g) => st.tick >= g.tick);
    v.ignite = v.ignite.filter((g) => st.tick < g.tick);
    for (const g of now) igniteStroke(st, v.placed[g.o], g.o);
  }
  if (v.falling.length) {
    const now = v.falling.filter((c) => st.tick >= c.tick);
    v.falling = v.falling.filter((c) => st.tick < c.tick);
    for (const c of now) if (vsOjamaSpot(st, c.x, c.y)) landOjama(st, c); else { v.side[c.o].ojama--; v.powder[c.o] = Math.min(VS_POWDER.max, v.powder[c.o] + vsCost(st, c.o, 'ojama')); }
  }
}
export function vsMult(st, o) { const sd = st.vs.side[o]; return 1 + st.rules.startMult + sd.gold + Math.floor(sd.pops / st.rules.pulse); }
export function vsScore(st, o) { return st.vs.side[o].chips * vsMult(st, o); }
function finishVs(st) {
  const sc = [vsScore(st, 0), vsScore(st, 1)], sd = st.vs.side, f = st.fuse;
  // 相手の線のうち、自分の火で燃やした長さ（点の数）
  const took = [0, 0];
  for (let i = 0; i < f.pts.length; i++) if (f.owner[i] >= 0 && f.fire[i] >= 0 && f.fire[i] !== f.owner[i]) took[f.fire[i]]++;
  st.done = true; st.phase = 'done';
  const pick = (k) => sd.map((x) => x[k]);
  st.result = {
    vs: true, score: sc, winner: sc[0] > sc[1] ? 0 : sc[1] > sc[0] ? 1 : -1, total: st.shells.filter((s) => s.type !== 'kuro').length,
    pops: pick('pops'), chips: pick('chips'), mult: [vsMult(st, 0), vsMult(st, 1)], steals: pick('steals'), took,
    ojama: pick('ojama'), tsugi: pick('tsugi'), kuro: pick('kuro'), back: pick('back'), tactic: st.vs.tactic.slice(),
  };
  st.events.push({ type: 'done', result: st.result });
  return st;
}

// ---- CPU の頭の中
// 近い玉を順につなぐ線（ばらつきは rng）。from から始め、墨が切れるか、つなげる玉が無くなるまで
function chainLine(st, from, ink, r, visited = new Set()) {
  const pts = [{ x: from.x, y: from.y }];
  let cur = from, used = 0;
  for (;;) {
    const cand = st.shells.filter((s) => !visited.has(s.id) && !crossesCloud(st.clouds, cur.x, cur.y, s.x, s.y))
      .map((s) => ({ s, d: Math.hypot(s.x - cur.x, s.y - cur.y) })).filter((c) => c.d > 1).sort((a, b) => a.d - b.d).slice(0, 3);
    if (!cand.length) break;
    const pick = cand[Math.floor(r() * cand.length)];
    if (used + pick.d > ink) {
      // 最後の玉まで届かなくても、墨の残りだけその方へ伸ばす
      const k = (ink - used) / pick.d;
      if (k > 0.3) pts.push({ x: cur.x + (pick.s.x - cur.x) * k, y: cur.y + (pick.s.y - cur.y) * k });
      break;
    }
    used += pick.d; visited.add(pick.s.id); cur = pick.s; pts.push({ x: cur.x, y: cur.y });
  }
  return pts;
}
// 考える線の候補。後手で cut のある相手は、先手の線に遅れて届く所を横切る線も考える
export function vsCandidates(st, o, rival, r) {
  const v = st.vs, f = st.fuse, ink = v.ink[o], out = [];
  const other = v.placed[1 - o];
  const okStart = (s) => vsCanStart(st, o, s) && !inCloud(st.clouds, s.x, s.y);
  const shells = st.shells.filter(okStart);
  if (!shells.length) return out;
  const pri = ['shaku', 'chouchin', 'ootama', 'kin'];
  const starts = [];
  for (const t of pri) for (const s of shells) if (s.type === t) starts.push(s);
  const n = rival.lines;
  const nCut = other && rival.cut ? Math.floor(n / 2) : 0;
  for (let c = 0; c < n - nCut; c++) {
    const s0 = c < starts.length && c % 2 === 0 ? starts[Math.floor(c / 2) % starts.length] : shells[Math.floor(r() * shells.length)];
    out.push(chainLine(st, s0, ink, r, new Set([s0.id])));
  }
  // 横取りの線: 先手の線の、火が遅れて届く所（途中から先）を目がけて、近くの玉から横切る
  for (let c = 0; c < nCut; c++) {
    const frac = 0.25 + 0.6 * ((c + 0.5) / nCut);
    const qi = other.base + Math.floor(frac * (other.len - 1));
    const q = f.pts[qi];
    if (!q || f.wet[qi]) continue;
    const theirs = (qi - other.base) * FUSE_SAMPLE / FUSE_SPEED; // 先手の火がそこへ届くまで（相手が先手なので、遅れなし）
    const near = shells.map((s) => ({ s, d: Math.hypot(s.x - q.x, s.y - q.y) })).filter((x) => x.d > VS_START_GAP && x.d < Math.min(150, ink * 0.5))
      .filter((x) => (v.lag[o] || 0) + x.d / FUSE_SPEED < theirs + (v.lag[1 - o] || 0) && !crossesCloud(st.clouds, x.s.x, x.s.y, q.x, q.y)).sort((a, b) => a.d - b.d);
    if (!near.length) continue;
    const s0 = near[Math.floor(r() * Math.min(3, near.length))].s;
    // 横切る点の少し先まで伸ばしてから、近い玉を順につなぐ
    const dx = q.x - s0.x, dy = q.y - s0.y, dl = Math.hypot(dx, dy) || 1;
    const over = { x: Math.max(1, Math.min(W - 2, q.x + dx / dl * 10)), y: Math.max(1, Math.min(H - 2, q.y + dy / dl * 10)) };
    const used = dl + 10;
    const rest = chainLine(st, over, Math.max(0, ink - used), r, new Set([s0.id]));
    out.push([{ x: s0.x, y: s0.y }, ...rest]);
  }
  return out;
}
// 線を 1 本ずつ試して選ぶ（1 本ごとに yield。ページでは、考えている間も画面を止めない）。
// make() は、この番の盤面を作り直す関数（先手の線がもう置いてあれば、それも置いた盤面）。
// 後手は、先手の線と並べて最後まで回し、差がいちばん大きい線を選ぶ。
// 先手は、相手の返し手（近い玉をつなぐ線と、横取りをねらう線）を probe × 2 本ためし、最悪と平均のあいだで測る
// （1 人で回していちばん点が高い線は、長くて横取りされやすい）
export function* vsPlanGen(make, o, rival, r) {
  const base = make();
  const other = base.vs.placed[1 - o];
  const cands = vsCandidates(base, o, rival, r);
  const probe = !other && rival.probe ? { lines: rival.probe * 2, cut: true } : null;
  const scored = [];
  for (const c of cands) {
    const st = make();
    if (!vsPlace(st, o, c)) { yield; continue; }
    const pts = st.vs.placed[o].pts;
    let val;
    if (probe) {
      const replies = vsCandidates(st, 1 - o, probe, r);
      const margins = [];
      for (const rep of replies) {
        const t = make();
        vsPlace(t, o, pts, { normalized: true });
        if (!vsPlace(t, 1 - o, rep)) continue;
        vsIgnite(t); runVs(t);
        margins.push(vsScore(t, o) - vsScore(t, 1 - o));
        yield;
      }
      if (!margins.length) { vsIgnite(st); runVs(st); margins.push(vsScore(st, o)); }
      val = 0.5 * Math.min(...margins) + 0.5 * margins.reduce((a, b) => a + b, 0) / margins.length;
    } else {
      vsIgnite(st); runVs(st);
      val = vsScore(st, o) - (other ? vsScore(st, 1 - o) : 0) * 0.8;
    }
    scored.push({ pts, val });
    yield;
  }
  scored.sort((a, b) => b.val - a.val);
  if (!scored.length) return null;
  return scored[Math.floor(r() * Math.min(scored.length, rival.pick || 1))].pts;
}
export function vsPlan(make, o, rival, r) {
  const g = vsPlanGen(make, o, rival, r);
  for (;;) { const x = g.next(); if (x.done) return x.value; }
}
// ---- CPU の道具の使い方
const worthOf = (s) => (s.type === 'kuro' ? (s.hp > 1 ? 0 : 90) : SHELLS[s.type].pts * (s.type === 'kin' || s.type === 'chouchin' || s.type === 'shaku' ? 3 : 1));
// もうすぐ誰かの爆発に飲まれる玉（取り合っても意味が薄い）
function doomed(st, s) { return st.explosions.some((e) => e.t < BURST_GROW + BURST_HOLD && Math.hypot(e.x - s.x, e.y - s.y) < e.R + SHELLS[s.type].r + 6); }
// お邪魔玉をどこに落とすか: 相手の火の頭が、落ちるまでに進む少し先の導火線の上。その先で取られそうな玉が多い所
export function vsOjamaChoice(st, o, rival) {
  const v = st.vs, f = st.fuse, opp = 1 - o;
  if (!rival.ojama || !toolReady(st, o, 'ojama') || st.t < rival.react || st.tick < v.cool[o]) return null;
  const left = st.shells.filter((s) => !s.burst && !doomed(st, s));
  const total = left.reduce((a, s) => a + worthOf(s), 0);
  if (!total) return null;
  const mine = st.heads.filter((g) => g.o === o).map((g) => f.pts[g.i]);
  const lead = Math.round(VS_FALL * FUSE_SPEED / FUSE_SAMPLE) + 3;
  let best = null;
  for (const h of st.heads) {
    if (h.o !== opp) continue;
    const seg = f.seg[h.i], ahead = [];
    for (let j = h.i + h.dir; j >= 0 && j < f.pts.length && f.seg[j] === seg && !f.burnt[j] && !f.wet[j] && ahead.length < 500; j += h.dir) ahead.push(j);
    if (ahead.length < lead + 5) continue;
    // 置ける所を探す: 少し先へ、または線の横へ少しずらす（線から火が届く幅の中なら、火は黒玉に触れる）
    let c = null, k = lead;
    for (; k < Math.min(ahead.length - 4, lead + 14) && !c; k++) {
      const p = f.pts[ahead[k]], q = f.pts[ahead[k + 1]], dx = q.x - p.x, dy = q.y - p.y, dl = Math.hypot(dx, dy) || 1;
      for (const off of [0, 8, -8, 14, -14]) {
        const x = Math.round(p.x - dy / dl * off), y = Math.round(p.y + dx / dl * off);
        if (vsOjamaSpot(st, x, y)) { c = { x, y }; break; }
      }
    }
    k--;
    if (!c || mine.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 60)) continue;
    let val = 0;
    for (const s of left) {
      const rr = SHELLS[s.type].r + st.rules.reach + 24;
      for (let q = k; q < ahead.length; q += 3) { const p = f.pts[ahead[q]]; if (Math.hypot(p.x - s.x, p.y - s.y) <= rr) { val += worthOf(s); break; } }
    }
    if (!best || val > best.val) best = { x: Math.round(c.x), y: Math.round(c.y), val };
  }
  if (!best || best.val / total < rival.ojama) return null;
  return best;
}
// 継ぎ火をどこに引くか: 自分の火が通ったあとから、まだ誰も取りそうにない玉（ひびの入った黒玉は大きなごほうび）へ
export function vsExtendChoice(st, o, rival) {
  const v = st.vs, f = st.fuse;
  if (!rival.tsugi || !toolReady(st, o, 'tsugi') || st.t < rival.react || st.tick < v.cool[o]) return null;
  const starts = [];
  for (let i = 0; i < f.pts.length; i += 3) if (f.fire[i] === o && !f.wet[i]) starts.push(f.pts[i]);
  if (!starts.length) return null;
  const left = st.shells.filter((s) => !s.burst && !doomed(st, s));
  const total = left.reduce((a, s) => a + worthOf(s), 0);
  if (!total) return null;
  const reach = st.rules.reach * v.mod[o].reach;
  const targets = left.filter((s) => worthOf(s) > 0).sort((a, b) => worthOf(b) - worthOf(a)).slice(0, 12);
  let best = null;
  for (const tg of targets) {
    let sp = null, sd = 1e9;
    for (const p of starts) { const d = Math.hypot(p.x - tg.x, p.y - tg.y); if (d < sd && !crossesCloud(st.clouds, p.x, p.y, tg.x, tg.y)) { sd = d; sp = p; } }
    if (!sp || sd > VS_TSUGI_INK - 10 || sd < 20) continue;
    const route = [{ x: sp.x, y: sp.y }, ...chainLine(st, tg, VS_TSUGI_INK - sd, () => 0, new Set(st.shells.filter((x) => x.burst).map((x) => x.id).concat([tg.id])))];
    let val = 0;
    for (const s of left) {
      const rr = SHELLS[s.type].r + reach + 2;
      for (let q = 1; q < route.length; q++) {
        const a = route[q - 1], b = route[q], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
        const u = l2 ? Math.max(0, Math.min(1, ((s.x - a.x) * dx + (s.y - a.y) * dy) / l2)) : 0;
        if (Math.hypot(a.x + dx * u - s.x, a.y + dy * u - s.y) <= rr) { val += worthOf(s); break; }
      }
    }
    if (!best || val > best.val) best = { pts: route, val };
  }
  if (!best || best.val / total < rival.tsugi) return null;
  return best;
}
// CPU の 1 回ぶんの判断（6 コマごと）。継ぎ火が見合えば継ぎ火、だめならお邪魔玉。相手のお邪魔玉は落ちてくるまで少しかかる
export function vsAct(st, o, rival, fall = VS_FALL) {
  if (!st.vs || st.tick % 6 !== 0) return null;
  const e = vsExtendChoice(st, o, rival);
  if (e && vsExtend(st, o, e.pts)) return 'tsugi';
  const c = vsOjamaChoice(st, o, rival);
  if (c && vsDropOjama(st, o, c.x, c.y, fall)) return 'ojama';
  return null;
}
// 盤面を最後まで回す（CPU どうしの対戦と、線の試し）。policies = [あなた役, 相手役] の道具の使い方
export function runVs(st, policies = null, maxTicks = 60 * 60) {
  for (let n = 0; n < maxTicks && !st.done; n++) {
    if (policies) for (const o of [0, 1]) if (policies[o]) vsAct(st, o, policies[o]);
    step(st); st.events.length = 0;
  }
  if (!st.done) finish(st);
  return st.result;
}

// 番を落としたときのヒント（上ほど効き目が大きい）
export function vsHint(st, o = 0) {
  const r = st.result, opp = 1 - o, f = st.fuse;
  if (!r || !r.vs) return null;
  const shaku = st.shells.find((s) => s.type === 'shaku');
  if (shaku && shaku.burst && shaku.by === opp) return { id: 'vsShaku' };
  if (r.took[opp] > r.took[o] + 12) return { id: 'vsTaken' };
  const lantern = st.shells.find((s) => s.type === 'chouchin' && s.burst && s.by === opp);
  if (lantern && !st.shells.some((s) => s.type === 'chouchin' && s.burst && s.by === o)) return { id: 'vsLantern' };
  if (r.kuro[opp] > r.kuro[o] && r.back[opp]) return { id: 'vsBack' };
  if (!r.steals[o]) return { id: 'vsCross' };
  if (!r.ojama[o] && !r.tsugi[o]) return { id: 'vsTools' };
  let mine = 0; for (let i = 0; i < f.pts.length; i++) if (f.owner[i] === o) mine++;
  if (mine && r.pops[o] < r.pops[opp] / 2) return { id: 'vsDense' };
  return { id: 'vsGeneral' };
}

// ---- 挑戦状（同じ相手・同じ夜空で）
export function encodeVs(seed, rivalIdx, marks) {
  const m = (marks || '').replace(/[^wld]/g, '').slice(0, 3);
  return `${(seed >>> 0).toString(36)}.${rivalIdx}.${m}`;
}
export function decodeVs(s) {
  const m = /^([0-9a-z]{1,7})\.([0-9])\.([wld]{0,3})$/.exec(s || '');
  if (!m) return null;
  const seed = parseInt(m[1], 36), rival = +m[2];
  if (!Number.isFinite(seed) || seed > 0xffffffff || rival >= RIVALS.length) return null;
  return { seed: seed >>> 0, rival, marks: m[3] };
}
export function vsMarks(results) { return results.map((r) => (r.winner === 0 ? 'w' : r.winner === 1 ? 'l' : 'd')).join(''); }
export function vsShareText(match, lang, url = SITE_URL) {
  const rv = RIVALS[match.rival], en = lang === 'en';
  const w = match.results.filter((r) => r.winner === 0).length, l = match.results.filter((r) => r.winner === 1).length;
  const dots = match.results.map((r) => (r.winner === 0 ? '🔴' : r.winner === 1 ? '🔵' : '⚪')).join('');
  const sum = (k) => match.results.reduce((a, r) => a + r[k][0], 0);
  const steals = sum('steals'), back = sum('back');
  const won = match.winner === 0;
  const head = en ? `Hanabi Battle vs ${rv.en}: ${won ? 'won' : 'lost'} ${w}-${l}` : `花火合戦 vs ${rv.ja}　${w}-${l} で${won ? '勝ち！' : '負け…'}`;
  const tail = en ? `Steals ${steals} · Ojama returned ${back}` : `横取り ${steals} ・ お邪魔返し ${back}`;
  return `${head}\n${dots} ${tail}\n${url}\n${en ? '#hitofudehanabi' : HASHTAG}`;
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
  // 絵文字は見出しの 🎆 だけ。結果は言葉で書く（夜ごとの印の列は画面とシェア画像にだけ出す）
  const en = lang === 'en';
  const cleared = run.nights.filter((r) => r && r.score >= r.target).length;
  const moon = MOONS[run.moon];
  let head;
  if (run.daily) {
    const md = `${+run.key.slice(5, 7)}/${+run.key.slice(8, 10)}`;
    head = `🎆${en ? 'Hitofude Hanabi' : '一筆花火'} #${run.no} ${md} ${en ? moon.en : moon.ja}`;
  } else head = en ? '🎆Hitofude Hanabi' : '🎆一筆花火';
  const line2 = cleared === NIGHTS ? (en ? `Stage ${STAGE.id} clear!` : `ステージ${STAGE.id} 完走`)
    : (en ? `Stage ${STAGE.id} · ${cleared}/${NIGHTS} nights` : `ステージ${STAGE.id} ${cleared}/${NIGHTS}夜`);
  const line3 = en ? `${fmt(run.total)} pts · best chain ${run.bestChain}` : `${fmt(run.total)}点・最大${run.bestChain}連鎖`;
  // 筆跡と、大一番の結果（今夜の一筆は、みんな同じ大一番）
  const extra = [];
  if (run.type) { const ty = STROKE_TYPES.find((x) => x.id === run.type); if (ty) extra.push(en ? `Stroke: ${ty.en}` : `筆跡「${ty.ja}」`); }
  const bosses = run.nights.filter((r) => r && r.twist).map((r) => {
    const tw = TWISTS.find((x) => x.id === r.twist); if (!tw) return null;
    const won = r.score >= r.target;
    return en ? `${tw.en} ${won ? 'cleared' : 'missed'}` : `「${tw.ja}」${won ? '成功' : '届かず'}`;
  }).filter(Boolean);
  if (bosses.length) extra.push((en ? 'Boss ' : '大一番') + bosses.join(en ? ', ' : '、'));
  const line4 = extra.length ? '\n' + extra.join(en ? ' · ' : '・') : '';
  return `${head}\n${line2} ${line3}${line4}\n${url}\n${en ? '#hitofudehanabi' : HASHTAG}`;
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
