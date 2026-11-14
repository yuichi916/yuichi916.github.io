// 一筆花火 2 — お守り。効き目は数値の差だけで終わらせず、線の引き方が変わるものを選ぶ。
// mod: 夜のはじめに定数を変える / on: 出来事ごとに呼ばれる（sim.js の fire）
import { charmBlast } from './sim.js';

const C = (id, tag, rar, ja, en, dj, de, x = {}) => ({ id, tag, rar, ja, en, dj, de, cost: { c: 4, r: 7, l: 11 }[rar], ...x });

export const CHARMS = [
  // ---- 熱: 火を引きつけるほど得をする
  C('hibashi', 'heat', 'c', '火箸', 'Fire Tongs', '「熱い」距離が 1.4 倍', 'HOT range ×1.4', { mod: (m) => { m.hotGap *= 1.4; } }),
  C('fuigo', 'heat', 'c', 'ふいご', 'Bellows', '熱が 1.5 倍の速さでたまる', 'Heat builds 1.5× faster', { mod: (m) => { m.heatRate *= 1.5; } }),
  C('oniibi', 'heat', 'r', '鬼火', 'Will-o-wisp', '最高の熱で、点がさらに ×5 に', 'Top heat scores ×5 instead of ×4', { mod: (m) => { m.heatTop = (m.heatTop || 0) + 1; } }),
  C('kiwadoi', 'heat', 'c', '紙一重', 'Hairsbreadth', 'きわどく玉を通すたび 倍率 +1', 'Each Close pass: +1 MULT', { on: { thread(c) { if (c.close) c.k.mult += 1; } } }),
  C('fushibi', 'heat', 'r', '不死火', 'Undying Ember', '追いつかれても、一筆に 1 度だけ踏みとどまる', 'Survive being caught once per stroke', { mod: (m) => { m.catchSaves = (m.catchSaves || 0) + 1; } }),
  C('hayabi', 'heat', 'c', '早火', 'Quick Flame', '火が 1.25 倍速い。点 ×1.5', 'Flame 25% faster. POINTS ×1.5', { mod: (m) => { m.flameX *= 1.25; m.chipsX *= 1.5; } }),
  C('osobi', 'heat', 'c', '遅火', 'Slow Burn', '火が 0.7 倍の速さ。手元が楽に', 'Flame 30% slower', { mod: (m) => { m.flameX *= 0.7; } }),
  C('netsuretsu', 'heat', 'r', '熱烈', 'Fever', '熱 ×3 以上の間、玉ごとに 倍率 +1', 'At HOT ×3+, every shell: +1 MULT', { on: { burst(c) { if (c.heatLv >= 2) c.k.mult += 1; } } }),
  C('haisui', 'heat', 'c', '背水', 'Last Stand', '最後の一筆は、熱 ×3 から始まる', 'Your last stroke starts at HOT ×3', { on: { strokeStart(c) { if (c.st.strokesLeft === 1) c.k.heat = Math.max(c.k.heat, 1.7); } } }),
  C('atsukan', 'heat', 'c', '熱燗', 'Warm Sake', '熱が冷めない', 'Heat never cools down', { mod: (m) => { m.heatHold = true; } }),
  C('hinotama', 'heat', 'l', '火の玉', 'Fireball', '追いつかれると、その場で大爆発。倍率 +4', 'If caught: huge blast and +4 MULT', { mod: () => {}, on: { strokeStart(c) { c.k.fb = true; } } , caught: true }),
  // ---- 連鎖
  C('tairin', 'chain', 'c', '大輪', 'Big Bloom', '爆風が 1.2 倍', 'Blasts ×1.2 wider', { mod: (m) => { m.blastR *= 1.2; } }),
  C('kodou', 'chain', 'c', '鼓動', 'Heartbeat', '倍率 +1 が 10 連鎖ごとから 6 連鎖ごとに', '+1 MULT every 6 chain (not 10)', { mod: (m) => { m.chainEvery = 6; } }),
  C('renjishi', 'chain', 'r', '連獅子', 'Lion Dance', '20 連鎖以上の一筆は 倍率 ×1.6', 'Chain 20+: MULT ×1.6', { on: { strokeEnd(c) { if (c.k.pops >= 20) c.k.mult *= 1.6; } } }),
  C('nokoribi', 'chain', 'c', '残り火', 'Embers', '連鎖しても爆風が小さくなりにくい', 'Chain blasts shrink far less', { mod: (m) => { m.genDecay = 0.97; m.genMin = 0.75; } }),
  C('rendan', 'chain', 'c', '連弾', 'Rapid Fire', '連鎖の数だけ、玉の点が増える', 'Each shell: + POINTS equal to chain count', { on: { burst(c) { c.pts += c.n; } } }),
  C('sazanami', 'chain', 'r', 'さざなみ', 'Undertow', '爆風が玉を押さず、引き寄せる', 'Blasts pull shells in instead of pushing', { mod: (m) => { m.pull = true; } }),
  C('hyakka', 'chain', 'r', '百花', 'Hundred Flowers', '一筆でひらいた玉の種類ごとに 倍率 +1', '+1 MULT per shell type opened', { on: { strokeEnd(c) { c.k.mult += Object.keys(c.k.types).length; } } }),
  C('oikaze', 'chain', 'c', '追い風', 'Tailwind', '爆風の広がりが 1.5 倍速', 'Blasts spread 1.5× faster', { mod: (m) => { m.shockV *= 1.5; } }),
  C('tsurube', 'chain', 'c', '釣瓶打ち', 'Volley', '線でなく爆風でひらいた玉は 点 +15', 'Shells opened by blasts: +15 POINTS', { on: { burst(c) { if (c.how !== 'line') c.pts += 15; } } }),
  C('sekirei', 'chain', 'r', '飛び火', 'Leaping Sparks', 'すべての玉が 火花を 3 本飛ばす', 'Every shell shoots 3 sparks', { mod: (m) => { m.sparkAll = 3; } }),
  C('yonaga', 'chain', 'c', '夜長', 'Long Night', '玉が 4 つ増える', '+4 shells each night', { mod: (m) => { m.countAdd += 4; } }),
  // ---- 金と小判
  C('kinun', 'gold', 'c', '金運', 'Gold Luck', '金の玉の倍率が +2 に', 'Gold shells give +2 MULT', { mod: (m) => { m.goldMult += 1; } }),
  C('maneki', 'gold', 'r', '招き猫', 'Lucky Cat', '金の玉をひらくと 小判 +1', 'Gold shells: +1 coin', { on: { burst(c) { if (c.s.type === 'kin') c.coin(1); } } }),
  C('ichiban', 'gold', 'c', '一番星', 'First Star', '一筆で最初の金の玉は 倍率 +3', 'First gold shell per stroke: +3 MULT', { on: { burst(c) { if (c.s.type === 'kin' && !c.k.firstGold) { c.k.firstGold = true; c.k.mult += 3; } } } }),
  C('kinpaku', 'gold', 'c', '金箔', 'Gold Leaf', '金の玉が夜ごとに 2 つ増える', '+2 gold shells each night', { mod: (m) => { m.addMix.kin = (m.addMix.kin || 0) + 2; } }),
  C('senryou', 'gold', 'r', '千両箱', 'Treasure Chest', '小判 5 枚ごとに 倍率 +1（夜のはじめ）', '+1 MULT per 5 coins you hold', { on: { strokeStart(c) { c.k.mult += Math.floor((c.st.loadout.coins || 0) / 5); } } }),
  C('risoku', 'gold', 'c', '利息', 'Interest', '夜を越えるたび 小判 +3', '+3 coins each night cleared', { on: { nightWin(c) { c.coin(3); } } }),
  C('tesuri', 'gold', 'c', '手水', 'Purification', '屋台の引き直しが 1 回ただ', 'First shop reroll is free', { freeReroll: 1 }),
  C('nebiki', 'gold', 'c', '値引き', 'Discount', '屋台の品が 1 小判 安い', 'Shop items cost 1 less', { discount: 1 }),
  C('oiri', 'gold', 'l', '大入り', 'Full House', '満開すると 小判 +10', 'Full Bloom: +10 coins', { on: { bloom(c) { c.coin(10); } } }),
  C('kogane', 'gold', 'r', '黄金虫', 'Gold Beetle', '金の玉は、ふれた線の火で点 ×5', 'Gold shells lit by your line: POINTS ×5', { on: { burst(c) { if (c.s.type === 'kin' && c.how === 'line') c.pts *= 5; } } }),
  // ---- 提灯
  C('chouchinshi', 'lantern', 'c', '提灯職人', 'Lantern Maker', '提灯が夜ごとに 2 つ増える', '+2 lanterns each night', { mod: (m) => { m.addMix.chouchin = (m.addMix.chouchin || 0) + 2; } }),
  C('hanaikada', 'lantern', 'r', '花筏', 'Petal Raft', '提灯のあとの点が 3 倍に', 'After a lantern: POINTS ×3', { mod: (m) => { m.lanternX = 3; } }),
  C('akari', 'lantern', 'c', '灯り', 'Glow', '提灯をひらくと 倍率 +2', 'Lanterns: +2 MULT', { on: { burst(c) { if (c.s.type === 'chouchin') c.k.mult += 2; } } }),
  C('tomoshibi', 'lantern', 'r', '灯火', 'First Light', '一筆の最初の玉は 提灯のように働く', 'First shell of a stroke counts as a lantern', { on: { burst(c) { if (c.n === 1) c.k.lantern++; } } }),
  C('yoinokuchi', 'lantern', 'c', '宵の口', 'Early Evening', '一筆めの点 ×1.5', 'First stroke of a night: POINTS ×1.5', { on: { burst(c) { if (c.st.strokesUsed === 0) c.pts *= 1.5; } } }),
  // ---- 墨と線の形
  C('nagafude', 'ink', 'c', '長い筆', 'Long Brush', '墨が 1.3 倍', 'Ink ×1.3', { mod: (m) => { m.ink *= 1.3; } }),
  C('nokorizumi', 'ink', 'c', '残り墨', 'Spare Ink', '使わなかった墨 1 割ごとに 倍率 +1', '+1 MULT per 10% ink left unused', { on: { strokeEnd(c) { c.k.mult += Math.floor((c.unused / c.inkLimit) * 10); } } }),
  C('suminagashi', 'ink', 'r', '墨流し', 'Ink Marbling', '余った墨が次の一筆に足される', 'Unused ink carries to your next stroke', { on: { strokeEnd(c) { c.st.carriedInk = Math.min(c.st.ink, c.unused * 0.8); } } }),
  C('futofude', 'ink', 'c', '太い筆', 'Thick Brush', '線が玉をとらえやすくなる', 'Your line catches shells more easily', { mod: (m) => { m.threadR += 14; } }),
  C('musubi', 'ink', 'r', '結び', 'Knot', '自分の線と交わると結び目に。火が来ると爆ぜて 倍率 +2', 'Cross your own line: knots burst for +2 MULT', { mod: (m) => { m.knots = 1; } }),
  C('tanuki', 'ink', 'l', '狸の葉っぱ', 'Tanuki Leaf', '線が左右に映って、両方燃える', 'Your line mirrors left-right; both burn', { mod: (m) => { m.mirror = true; } }),
  C('kitsune', 'ink', 'l', '狐火', 'Foxfire', '線の終わりで、残った玉のいちばんの群れへ火が飛ぶ', 'At the fuse\'s end, fire leaps to the densest cluster left', {
    on: { fuseEnd(c) { const idle = c.st.shells.filter((s) => s.state === 'idle' && s.rise <= 0); let best = null, bn = 0; for (const a of idle) { let n = 0; for (const b of idle) if (Math.hypot(a.x - b.x, a.y - b.y) < 150) n++; if (n > bn) { bn = n; best = a; } } if (best) charmBlast(c.st, best.x, best.y, 120); } },
  }),
  C('owaridama', 'ink', 'c', '終わり玉', 'Finale Shell', '線の終わりが爆ぜる', 'The end of your fuse explodes', { on: { fuseEnd(c) { charmBlast(c.st, c.x, c.y, 150); } } }),
  C('kazaguruma', 'ink', 'r', '風車', 'Pinwheel', '線を曲げるほど 倍率が増える', 'The more your line curves, the more MULT', { on: { strokeEnd(c) { c.k.mult += Math.floor(c.k.turn / 6); } } }),
  C('tengu', 'ink', 'l', '天狗の団扇', 'Tengu Fan', 'まっすぐな線ほど 倍率 ×（最大 ×3）', 'Straighter lines multiply MULT (up to ×3)', { on: { strokeEnd(c) { c.k.mult *= 1 + 2 * Math.max(0, 1 - c.k.turn / 6); } } }),
  C('nihitsu', 'ink', 'r', '二の筆', 'Extra Stroke', '夜ごとの筆が +1', '+1 stroke each night', { mod: (m) => { m.strokesAdd += 1; } }),
  C('ippatsu', 'ink', 'l', '一発勝負', 'All or Nothing', '筆は 1 本だけ。倍率 ×4', 'Only 1 stroke per night. MULT ×4', { mod: (m) => { m.onlyOneStroke = true; }, on: { strokeEnd(c) { c.k.mult *= 4; } } }),
  C('uchiage', 'ink', 'c', '打ち上げ師', 'Launch Crew', '筆のあとに上がる玉が 3 つ増える', '+3 shells rise after each stroke', { mod: (m) => { m.refillAdd += 3; } }),
  // ---- 大トリと満開
  C('mankai', 'finale', 'r', '満開の加護', 'Full Bloom Blessing', '満開の倍率が ×2 から ×4 に', 'Full Bloom: ×4 instead of ×2', { mod: (m) => { m.bloomX = 4; } }),
  C('shakudama', 'finale', 'r', '尺玉師', 'Grand Shell Master', '尺玉が夜ごとに 1 つ増える', '+1 Grand Shell each night', { mod: (m) => { m.addMix.shaku = (m.addMix.shaku || 0) + 1; } }),
  C('senkou', 'finale', 'c', '線香花火', 'Sparkler', '一筆の最後の玉は 点 ×4', 'The last shell of a stroke: POINTS ×4', { on: { burst(c) { if (!c.st.pending.length && !c.st.sparks.length && !c.k.penDown) c.pts *= 4; } } }),
  C('sakigake', 'finale', 'c', '先駆け', 'Vanguard', '一筆の最初の玉は 点 ×5', 'First shell of a stroke: POINTS ×5', { on: { burst(c) { if (c.n === 1) c.pts *= 5; } } }),
  C('kassai', 'finale', 'c', '喝采', 'Applause', 'ひらいた玉が 15 以上なら 倍率 +3', '15+ shells in a stroke: +3 MULT', { on: { strokeEnd(c) { if (c.k.pops >= 15) c.k.mult += 3; } } }),
  C('yaguruma', 'finale', 'l', '矢車', 'Pinwheel Crown', '満開すると、筆が 1 本もどる', 'Full Bloom refunds a stroke', { on: { bloom(c) { c.st.strokesLeft++; } } }),
  // ---- 仕掛け
  C('amayoke', 'gimmick', 'c', '雨よけ', 'Umbrella', '湿った玉は爆発 1 回でひらく', 'Wet shells open from one blast', { mod: (m) => { m.dampNeed = 1; } }),
  C('yukidoke', 'gimmick', 'c', '雪どけ', 'Thaw', '氷玉も線の火で燃える', 'Your line melts ice', { mod: (m) => { m.iceLine = true; } }),
  C('fukumame', 'gimmick', 'c', '福豆', 'Lucky Beans', '鬼玉を爆風でひらいても 倍率が減らない', 'Oni shells never lower MULT', { mod: (m) => { m.oniSafe = true; } }),
  C('kamaitachi', 'gimmick', 'r', '鎌鼬', 'Sickle Weasel', '千輪の火花が 6 本増える', 'Crossettes shoot 6 more sparks', { mod: (m) => { m.sparkAdd = 6; } }),
  C('senrin', 'gimmick', 'c', '千輪師', 'Crossette Master', '千輪が夜ごとに 3 つ増える', '+3 crossettes each night', { mod: (m) => { m.addMix.senrin = (m.addMix.senrin || 0) + 3; } }),
  C('oonyuudou', 'gimmick', 'r', '大入道', 'Colossus', '大玉が夜ごとに 3 つ増える', '+3 big shells each night', { mod: (m) => { m.addMix.ootama = (m.addMix.ootama || 0) + 3; } }),
  // ---- 星: 星屑・かすり・継ぎ火（腕の層を伸ばす）
  C('hoshihiroi', 'star', 'c', '星拾い', 'Stargazer', '星屑を拾える範囲が 1.7 倍', 'Pick up star dust from 1.7× farther', { mod: (m) => { m.dustPickX = 1.7; } }),
  C('nagareboshi', 'star', 'c', '流れ星', 'Shooting Star', '星屑が 2 倍長く残り、値が落ちにくい', 'Star dust lasts twice as long and keeps its value', { mod: (m) => { m.dustLifeX = 2; m.dustFade = 0.3; } }),
  C('hoshikuzu', 'star', 'c', '星の砂', 'Star Sand', '玉ひとつごとに 星屑が 2 粒増える', '+2 star dust from every shell', { mod: (m) => { m.dustAdd = 2; } }),
  C('kasurikizu', 'star', 'r', 'かすり傷', 'Scratch', 'かすり 20 回ごとに 倍率 +1', 'Every 20 grazes: +1 MULT', { on: { graze(c) { if (c.n % 20 === 0) c.k.mult += 1; } } }),
  C('kamihitoe', 'star', 'r', '薄紙', 'Paper Thin', 'かすれる距離が 1.5 倍。かすりで星の値が 2 倍伸びる', 'Graze range ×1.5, and grazes grow star value twice as fast', { mod: (m) => { m.grazeGapX = 1.5; m.grazePvX = 2; } }),
  C('tsugite', 'star', 'r', '継ぎ手', 'Splicer', '継ぎ火の輪が大きく長くなり、倍率を 8 割持ちこむ', 'Bigger, longer relight rings that carry 80% MULT', { mod: (m) => { m.tsugiRX = 1.5; m.tsugiWinX = 1.6; m.tsugiKeepX = 0.8; } }),
  C('tanabata', 'star', 'l', '天の川', 'Milky Way', '一筆で拾った星屑 10 粒ごとに 倍率 +1', 'Every 10 star dust in a stroke: +1 MULT', { on: { strokeEnd(c) { c.k.mult += Math.floor(c.k.dust / 10); } } }),
];
export const CHARM_BY_ID = Object.fromEntries(CHARMS.map((c) => [c.id, c]));

// 追いつかれたときの火の玉
CHARM_BY_ID.hinotama.on.strokeEnd = (c) => { if (c.k.caught) c.k.mult += 4; };
CHARM_BY_ID.hinotama.on.fuseEnd = () => {};

export const TAG_NAME = { heat: ['熱', 'Heat'], chain: ['連鎖', 'Chain'], gold: ['金', 'Gold'], lantern: ['提灯', 'Lantern'], ink: ['筆', 'Brush'], finale: ['大トリ', 'Finale'], gimmick: ['仕掛け', 'Trick'], star: ['星', 'Star'] };
export const TAG_COLOR = { heat: '#e8552a', chain: '#d43f8c', gold: '#d9a11f', lantern: '#e27a2c', ink: '#3a6fc4', finale: '#8f5ad6', gimmick: '#2ea77a', star: '#4fb3e8' };
