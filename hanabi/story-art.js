// 一筆花火 物語の小物（手続きで描く。画像ファイルも AI 画像も使わない）
// 物語の章は、この地図の絵を名前で呼ぶ: api.put(x, y, size, 'toro') のように。
import { drawCast } from '../assets/hitofude/cast.js';

export const STORY_CELLS = [
  'neko', 'kitsune', 'tanuki', 'tengu', 'kamaitachi', 'yukionna', 'yamabiko', // 0〜6 妖怪たち（cast.js の絵）
  'toro', 'toro_lit', 'lotus', 'rock', 'shrine', // 7〜11 灯籠流し
  'sled', 'usagi', 'house', 'snowpine', // 12〜15 雪の山里
  'andon', 'shoji_dot', // 16〜17 影絵の宿
  'kitsunebi', 'bride', // 18〜19 狐の嫁入り
  'mask', 'taiko', // 20〜21 百鬼夜行
  'memory', 'memory_lit', // 22〜23 灯の家
];
export const STORY_COLS = STORY_CELLS.length;
export const storyCell = (name) => STORY_CELLS.indexOf(name);

export function storyAtlas(cell = 144) {
  const c = document.createElement('canvas');
  c.width = cell * STORY_COLS; c.height = cell;
  const g = c.getContext('2d');
  const at = (name, f) => { const i = storyCell(name); g.save(); g.translate(cell * i + cell / 2, cell / 2); g.scale(cell / 100, cell / 100); try { f(); } catch { /* 描けなくても遊べる */ } g.restore(); };
  for (const id of ['neko', 'kitsune', 'tanuki', 'tengu', 'kamaitachi', 'yukionna', 'yamabiko']) at(id, () => drawCast(g, id, 0, 6, 82, { still: true, glow: false }));
  const lantern = (lit) => () => {
    // 灯籠: 木の台に、紙の四角い箱
    g.fillStyle = '#4a2a14'; g.fillRect(-30, 22, 60, 8);
    const gr = g.createLinearGradient(0, -26, 0, 22); gr.addColorStop(0, lit ? '#fff6d0' : '#e8dcc0'); gr.addColorStop(1, lit ? '#ffb24a' : '#b8a888');
    g.fillStyle = gr; g.fillRect(-22, -26, 44, 48);
    g.strokeStyle = '#4a2a14'; g.lineWidth = 3; g.strokeRect(-22, -26, 44, 48); g.beginPath(); g.moveTo(0, -26); g.lineTo(0, 22); g.moveTo(-22, -2); g.lineTo(22, -2); g.stroke();
    g.fillStyle = '#3a1a0a'; g.fillRect(-26, -32, 52, 7);
  };
  at('toro', lantern(false)); at('toro_lit', lantern(true));
  at('lotus', () => { for (let i = 0; i < 8; i++) { g.save(); g.rotate((i / 8) * 6.283); g.fillStyle = i % 2 ? '#ffb6d2' : '#ff8fbd'; g.beginPath(); g.ellipse(0, -18, 9, 20, 0, 0, 7); g.fill(); g.restore(); } g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); });
  at('rock', () => { const gr = g.createRadialGradient(-10, -12, 4, 0, 0, 40); gr.addColorStop(0, '#8a8a92'); gr.addColorStop(1, '#2a2a32'); g.fillStyle = gr; g.beginPath(); g.moveTo(-38, 14); g.quadraticCurveTo(-36, -24, -6, -32); g.quadraticCurveTo(30, -30, 38, 4); g.quadraticCurveTo(36, 30, 0, 32); g.quadraticCurveTo(-30, 32, -38, 14); g.fill(); g.strokeStyle = '#b8c0d8'; g.lineWidth = 2.5; g.stroke(); });
  at('shrine', () => { g.strokeStyle = '#ff3a22'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(-40, -30); g.quadraticCurveTo(0, -40, 40, -30); g.moveTo(-32, -16); g.lineTo(32, -16); g.moveTo(-24, -30); g.lineTo(-24, 40); g.moveTo(24, -30); g.lineTo(24, 40); g.stroke(); });
  at('sled', () => {
    // そりと座敷わらし（赤い着物、おかっぱ）
    g.strokeStyle = '#6a3a14'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-36, 30); g.lineTo(30, 30); g.quadraticCurveTo(42, 30, 40, 18); g.stroke();
    g.fillStyle = '#8a5020'; g.fillRect(-30, 18, 56, 8);
    g.fillStyle = '#d2283a'; g.beginPath(); g.moveTo(-18, 18); g.lineTo(-12, -8); g.lineTo(10, -8); g.lineTo(16, 18); g.closePath(); g.fill();
    g.fillStyle = '#ffe2c8'; g.beginPath(); g.arc(0, -20, 13, 0, 7); g.fill();
    g.fillStyle = '#1a1018'; g.beginPath(); g.arc(0, -24, 14, Math.PI, 0); g.fill(); g.fillRect(-14, -24, 28, 7);
    g.fillStyle = '#1a1018'; g.fillRect(-6, -19, 3, 3); g.fillRect(4, -19, 3, 3);
  });
  at('usagi', () => { g.fillStyle = '#f4f8ff'; g.beginPath(); g.ellipse(0, 10, 30, 20, 0, 0, 7); g.fill(); g.fillStyle = '#3a8a3a'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 9, -16, 6, 16, s * 0.3, 0, 7); g.fill(); } g.fillStyle = '#e02030'; g.beginPath(); g.arc(-10, 6, 4, 0, 7); g.arc(10, 6, 4, 0, 7); g.fill(); });
  at('house', () => { g.fillStyle = '#3a2a24'; g.fillRect(-34, -6, 68, 40); g.fillStyle = '#e8eef8'; g.beginPath(); g.moveTo(-46, -4); g.lineTo(0, -40); g.lineTo(46, -4); g.closePath(); g.fill(); g.fillStyle = '#ffc860'; g.fillRect(-20, 6, 16, 14); g.fillRect(6, 6, 16, 14); });
  at('snowpine', () => { g.fillStyle = '#1e3a30'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(0, -42 + i * 20); g.lineTo(-30 + i * -4, -6 + i * 20); g.lineTo(30 + i * 4, -6 + i * 20); g.closePath(); g.fill(); } g.fillStyle = '#eef4ff'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(0, -42 + i * 20); g.lineTo(-14, -26 + i * 20); g.lineTo(14, -26 + i * 20); g.closePath(); g.fill(); } });
  at('andon', () => { g.fillStyle = '#3a2410'; g.fillRect(-26, 34, 52, 6); const gr = g.createRadialGradient(0, 0, 4, 0, 0, 40); gr.addColorStop(0, '#fff8d8'); gr.addColorStop(1, '#ffb04a'); g.fillStyle = gr; g.fillRect(-20, -34, 40, 68); g.strokeStyle = '#3a2410'; g.lineWidth = 4; g.strokeRect(-20, -34, 40, 68); });
  at('shoji_dot', () => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 40); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fill(); });
  at('kitsunebi', () => { const gr = g.createRadialGradient(0, 8, 2, 0, 0, 40); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, '#9fd0ff'); gr.addColorStop(1, 'rgba(80,120,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, -40); g.quadraticCurveTo(30, 0, 18, 22); g.quadraticCurveTo(0, 40, -18, 22); g.quadraticCurveTo(-30, 0, 0, -40); g.fill(); });
  at('bride', () => { g.fillStyle = '#f8f8ff'; g.beginPath(); g.moveTo(-22, 40); g.lineTo(-14, -6); g.lineTo(14, -6); g.lineTo(22, 40); g.closePath(); g.fill(); g.fillStyle = '#f0e8d0'; g.beginPath(); g.arc(0, -18, 14, 0, 7); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, -30, 22, 9, 0, 0, 7); g.fill(); g.fillStyle = '#d8a050'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 6, -30); g.lineTo(s * 14, -44); g.lineTo(s * 16, -28); g.closePath(); g.fill(); } g.fillStyle = '#c02020'; g.fillRect(-3, -14, 6, 2); });
  at('mask', () => { g.fillStyle = '#c8281e'; g.beginPath(); g.ellipse(0, 4, 32, 36, 0, 0, 7); g.fill(); g.fillStyle = '#f0e0b0'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 16, -24); g.lineTo(s * 24, -46); g.lineTo(s * 30, -20); g.closePath(); g.fill(); } g.fillStyle = '#ffe680'; g.beginPath(); g.ellipse(-12, -2, 7, 5, 0.3, 0, 7); g.ellipse(12, -2, 7, 5, -0.3, 0, 7); g.fill(); g.fillStyle = '#1a0a08'; g.fillRect(-14, 16, 28, 8); g.fillStyle = '#fff'; g.fillRect(-12, 16, 4, 8); g.fillRect(8, 16, 4, 8); });
  at('taiko', () => { g.fillStyle = '#7a3a18'; g.beginPath(); g.ellipse(0, 0, 38, 30, 0, 0, 7); g.fill(); g.fillStyle = '#f4e8cc'; g.beginPath(); g.ellipse(0, 0, 30, 24, 0, 0, 7); g.fill(); g.fillStyle = '#c8281e'; g.beginPath(); g.arc(0, 0, 10, 0, 7); g.fill(); });
  const card = (lit) => () => { g.fillStyle = lit ? '#fff4d8' : '#c8bca4'; g.fillRect(-30, -38, 60, 76); g.strokeStyle = lit ? '#ffb24a' : '#6a5a44'; g.lineWidth = 4; g.strokeRect(-30, -38, 60, 76); g.fillStyle = lit ? '#e07a2a' : '#7a6a54'; g.fillRect(-20, -26, 40, 30); };
  at('memory', card(false)); at('memory_lit', card(true));
  return c;
}
