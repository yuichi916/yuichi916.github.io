// 気持ちスタンプの純関数。DOM・fetch・storage に触らない。
// ブラウザでは assets/feel/feel.js が import し、テストは tests/feel_core_test.mjs が import する。
// 設計書: docs/superpowers/specs/2026-09-23-feelings-stamps-design.md

export const COUNTER_BASE = 'https://viewsengineer.goatcounter.com/counter/';
export const FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfu4FAXL_Qyu_BBhgGgyIfn2KH4gPGAnQSueTNop6v2H8RjJA/formResponse';
export const FORM_ENTRIES = { work: 'entry.796994745', page: 'entry.20892979', text: 'entry.274902902' };
export const NOTE_MAX = 500;
export const NOTE_MIN_MS = 3000;
export const CACHE_TTL_MS = 10 * 60 * 1000;

// key は GoatCounter のパスに入る。変えると、それまでの数がゼロに戻る
export const SETS = {
  story: [
    { key: 'naita', emoji: '😭', ja: '泣いた', en: 'It made me cry' },
    { key: 'mouichido', emoji: '🔁', ja: 'もう一度読みたい', en: 'Want to read again' },
    { key: 'susume', emoji: '📣', ja: '誰かに勧めたい', en: 'Would recommend' },
    { key: 'tsuzuki', emoji: '✍️', ja: '続きが読みたい', en: 'Want a sequel' },
  ],
  game: [
    { key: 'tanoshii', emoji: '🎉', ja: '楽しかった', en: 'Fun' },
    { key: 'tegowai', emoji: '🧠', ja: '手ごわかった', en: 'Tough one' },
    { key: 'mata', emoji: '🔁', ja: 'またやる', en: 'Will play again' },
  ],
  ehon: [
    { key: 'tanoshii', emoji: '🎉', ja: '楽しかった', en: 'Fun' },
    { key: 'kirei', emoji: '✨', ja: 'きれいだった', en: 'Beautiful' },
    { key: 'mata', emoji: '🔁', ja: 'また開く', en: 'Will open again' },
  ],
  note: [
    { key: 'yakudatta', emoji: '💡', ja: '役に立った', en: 'Useful' },
    { key: 'tameshite', emoji: '🛠️', ja: '試してみる', en: "I'll try it" }, // 🛠 は既定が白黒の文字表示
    { key: 'motto', emoji: '❓', ja: 'もっと知りたい', en: 'Want to know more' },
  ],
  tool: [
    { key: 'yakudatta', emoji: '💡', ja: '役に立った', en: 'Useful' },
    { key: 'omoshiroi', emoji: '✨', ja: '面白かった', en: 'Interesting' },
    { key: 'mata', emoji: '🔁', ja: 'また来る', en: 'Will come back' },
  ],
  site: [
    { key: 'clap', emoji: '👏', ja: '拍手', en: 'Applause' },
    { key: 'mata', emoji: '🔁', ja: 'また来る', en: 'Will come back' },
    { key: 'susume', emoji: '📣', ja: '誰かに勧めたい', en: 'Would recommend' },
  ],
};

export const HEADINGS = {
  story: { ja: 'この物語に、気持ちを置いていく', en: 'Leave a feeling for this story' },
  game: { ja: '遊んでみて、どうでした？', en: 'How was it?' },
  ehon: { ja: 'この絵本、どうでした？', en: 'How was this book?' },
  note: { ja: 'このノート、どうでした？', en: 'How was this note?' },
  tool: { ja: 'ここまで見て、どうでした？', en: 'How was it?' },
  site: { ja: 'このサイトに、ひとこと', en: 'A word for this site' },
};

export const TEXT = {
  ja: {
    sub: '押すと、同じ気持ちの人の数が見えます',
    already: 'もう届いています。ありがとう。',
    thanks: 'ありがとう。',
    noteToggle: '🔒 作者にひとこと（非公開）',
    noteLabel: '作者へのひとこと',
    noteHint: '作者だけが読みます。返事はしていません。個人情報は書かないでください。',
    notePlaceholder: 'たとえば、いちばん残った場面',
    send: '届ける',
    sending: '送っています…',
    sent: '届きました。ありがとう。',
    failed: '送れませんでした。もう一度どうぞ。',
    empty: 'ひとことを書いてから届けてください。',
    tooLong: '500字までにしてください。',
    tooFast: 'もう一度「届ける」を押してください。',
  },
  en: {
    sub: 'Tap to see how many felt the same',
    already: 'Already sent. Thank you.',
    thanks: 'Thank you.',
    noteToggle: '🔒 A private note to the author',
    noteLabel: 'Note to the author',
    noteHint: "Only the author reads this. No replies. Please don't include personal information.",
    notePlaceholder: 'The scene that stayed with you',
    send: 'Send',
    sending: 'Sending…',
    sent: 'Sent. Thank you.',
    failed: "Couldn't send. Please try again.",
    empty: 'Write something first.',
    tooLong: 'Please keep it under 500 characters.',
    tooFast: 'Please press Send once more.',
  },
};

export const WORKS = {
  hyaku: { title: '百の悪行', url: 'hyaku.html' },
  seikai: { title: '正解の外側', url: 'seikai.html' },
  kototsugi: { title: 'ことつぎの星', url: 'kototsugi/' },
  ehon: { title: '飛び出す絵本', url: 'ehon.html' },
  sudoku: { title: '異世界立体数独', url: 'sudoku.html' },
  'shogi-puyo': { title: '将棋ぷよ「成」', url: 'shogi-puyo.html' },
  bakekurabe: { title: '化けくらべ', url: 'bakekurabe.html' },
  'ai-map': { title: 'AIエージェント能力アトラス', url: 'ai-map.html' },
  salon: { title: '音楽の宇宙', url: 'salon.html' },
  'ai-english': { title: 'AI英語ラボ', url: 'ai-english.html' },
  toeic: { title: 'TOEIC Part 5 英文法30問', url: 'toeic.html' },
  'novel-bench': { title: '書き出し診断', url: 'novel-bench.html' },
  hitoritabi: { title: '一人旅フォトジャーナル', url: 'hitoritabi/' },
  site: { title: 'ひとりぶんの棚', url: './' },
};

// トップの「みんなの気持ち」。研究ノートは 16 本に分かれて問い合わせが増えるので載せない
export const BOARD = [
  // ことつぎの星のはがきは読む前の紹介ページにしかないので、読み終えた人の「泣いた」と混ぜない
  { id: 'cry', label: '泣きたい', key: 'naita', emoji: '😭', stamp: '泣いた', works: ['hyaku', 'seikai'] },
  { id: 'fun', label: '遊びたい', key: 'tanoshii', emoji: '🎉', stamp: '楽しかった', works: ['bakekurabe', 'shogi-puyo', 'sudoku', 'ehon'] },
  { id: 'learn', label: '学びたい', key: 'yakudatta', emoji: '💡', stamp: '役に立った',
    works: ['ai-map', 'ai-english', 'toeic', 'novel-bench'] },
];

// 既存の読了イベント（hyaku.html / seikai.html が送っている）
export const CLEAR_PATHS = { hyaku: 'game/hyaku/clear', seikai: 'game/seikai/clear' };

const WORK_ID = /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/;
const own = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

export function isWorkId(work) {
  return typeof work === 'string' && work.length <= 80 && WORK_ID.test(work);
}

export function stampsFor(set) {
  return own(SETS, set) ? SETS[set] : null;
}

export function counterPath(work, key) {
  return `feel/${work}/${key}`;
}

export function counterUrl(path) {
  return COUNTER_BASE + encodeURIComponent(path) + '.json';
}

// 公開カウンタは {"count":"2 035"} のように区切り文字入りの文字列を返す
export function parseCount(json) {
  if (!json || typeof json !== 'object' || json.count == null) return null;
  const digits = String(json.count).replace(/\D/g, '');
  return digits === '' ? null : Number(digits);
}

// 優先順は data-feel-lang → <html lang> → navigator.language。日本語以外は英語にする
export function pickLang(hint, navLang) {
  const l = String(hint || navLang || '').toLowerCase();
  return l === 'jp' || l.startsWith('ja') ? 'ja' : 'en';
}

export function countLabel(lang, n) {
  if (n == null) return '';
  if (n === 0) return lang === 'ja' ? 'まだ誰も' : 'be the first';
  return lang === 'ja' ? `${n}人` : String(n);
}

export function countMessage(lang, n) {
  if (n == null) return TEXT[lang].thanks;
  if (n <= 1) return lang === 'ja' ? '最初のひとりになりました。' : "You're the first.";
  return lang === 'ja' ? `あなたと同じ気持ちの人が ${n} 人います。` : `${n} people felt the same.`;
}

export function validateNote(text, elapsedMs, honeypot) {
  if (honeypot) return { ok: false, reason: 'bot' };
  const t = String(text || '').trim();
  if (!t) return { ok: false, reason: 'empty' };
  if (t.length > NOTE_MAX) return { ok: false, reason: 'tooLong' };
  if (elapsedMs < NOTE_MIN_MS) return { ok: false, reason: 'tooFast' };
  return { ok: true, text: t };
}

export function formBody(work, page, text) {
  return [[FORM_ENTRIES.work, work], [FORM_ENTRIES.page, page], [FORM_ENTRIES.text, text]];
}

// WORKS に無いもの（研究ノート）は、ページの <title> の先頭を使う
export function workTitle(work, docTitle) {
  if (own(WORKS, work)) return WORKS[work].title;
  const t = String(docTitle || '').split(/\s*[｜|—]\s*/)[0].trim();
  return t || work;
}

// 多い順。数が読めなかった行（null）は最後。同数は設定の順
export function sortRows(rows) {
  const v = (r) => (r.count == null ? -1 : r.count);
  return rows.slice().sort((a, b) => v(b) - v(a) || a.order - b.order);
}

export function readCache(store, path, now, ttl = CACHE_TTL_MS) {
  const hit = store && own(store, path) ? store[path] : null;
  if (!hit || typeof hit.n !== 'number' || now - hit.t > ttl) return null;
  return hit.n;
}

export function writeCache(store, path, n, now) {
  return Object.assign({}, store, { [path]: { n, t: now } });
}

export function isPressed(state, path) {
  return !!(state && state.pressed && own(state.pressed, path));
}

export function markPressed(state, path, day) {
  const pressed = Object.assign({}, state && state.pressed, { [path]: day });
  return Object.assign({}, state, { pressed });
}

export function getDraft(state, work) {
  return (state && state.drafts && own(state.drafts, work) && state.drafts[work]) || '';
}

export function setDraft(state, work, text) {
  const drafts = Object.assign({}, state && state.drafts);
  if (text) drafts[work] = text;
  else delete drafts[work];
  return Object.assign({}, state, { drafts });
}
