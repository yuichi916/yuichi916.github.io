// 気持ちスタンプの純関数テスト。DOM も fetch も使わない。実行: node tests/feel_core_test.mjs
import * as F from '../assets/feel/feel-core.js';

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function deq(a, b, msg) { eq(JSON.stringify(a), JSON.stringify(b), msg); }

check('SETS: 各組は 3〜4 個・キー重複なし・文言がそろう', () => {
  for (const [name, stamps] of Object.entries(F.SETS)) {
    if (stamps.length < 3 || stamps.length > 4) throw new Error(`${name}: ${stamps.length} 個`);
    eq(new Set(stamps.map((s) => s.key)).size, stamps.length, `${name} のキー重複`);
    for (const s of stamps) {
      if (!/^[a-z]+$/.test(s.key) || !s.emoji || !s.ja || !s.en) throw new Error(`${name}/${s.key} が欠けている`);
    }
    if (!F.HEADINGS[name] || !F.HEADINGS[name].ja || !F.HEADINGS[name].en) throw new Error(`${name} の見出しが無い`);
  }
});

check('SETS: 絵文字はカラーで出る（既定が文字表示の字には U+FE0F を付ける）', () => {
  for (const [name, stamps] of Object.entries(F.SETS)) {
    for (const s of stamps) {
      const color = /^\p{Emoji_Presentation}$/u.test(s.emoji) || /️$/.test(s.emoji);
      if (!color) throw new Error(`${name}/${s.key}: ${s.emoji} は白黒の文字で出る`);
    }
  }
});

check('TEXT: 日本語と英語でキーがそろう', () => {
  deq(Object.keys(F.TEXT.ja).sort(), Object.keys(F.TEXT.en).sort());
});

check('BOARD: 作品は WORKS にあり、キーはどこかの組にある', () => {
  const keys = new Set(Object.values(F.SETS).flat().map((s) => s.key));
  for (const g of F.BOARD) {
    if (!keys.has(g.key)) throw new Error(`${g.id}: ${g.key}`);
    for (const w of g.works) if (!F.WORKS[w]) throw new Error(`${g.id}: ${w} が WORKS に無い`);
  }
  for (const w of Object.keys(F.CLEAR_PATHS)) if (!F.WORKS[w]) throw new Error(`CLEAR_PATHS: ${w}`);
});

check('BOARD: 泣きたいは読み終えた所で押された数だけ（紹介ページの kototsugi は入れない）', () => {
  const cry = F.BOARD.find((g) => g.id === 'cry');
  eq(cry.works.includes('kototsugi'), false, 'kototsugi は読む前の紹介ページにしか置いていない');
});

check('isWorkId', () => {
  for (const ok of ['hyaku', 'shogi-puyo', 'site', 'method/kansoku-suru-monogatari',
    'method/en/stories-that-watch-you', 'harness-story']) eq(F.isWorkId(ok), true, ok);
  for (const ng of ['', 'Hyaku', '../x', 'a//b', 'a/', '/a', '_test', 'a b', null, 'x'.repeat(81)]) {
    eq(F.isWorkId(ng), false, String(ng));
  }
});

check('stampsFor: 無い組と Object のプロパティ名は null', () => {
  eq(F.stampsFor('story').length, 4);
  eq(F.stampsFor('nope'), null);
  eq(F.stampsFor('constructor'), null);
});

check('counterPath / counterUrl', () => {
  eq(F.counterPath('hyaku', 'naita'), 'feel/hyaku/naita');
  eq(F.counterUrl('feel/hyaku/naita'),
    'https://viewsengineer.goatcounter.com/counter/feel%2Fhyaku%2Fnaita.json');
  eq(F.counterUrl('feel/method/en/stories-that-watch-you/motto'),
    'https://viewsengineer.goatcounter.com/counter/feel%2Fmethod%2Fen%2Fstories-that-watch-you%2Fmotto.json');
});

check('parseCount: 区切り文字・ゼロ・壊れた値', () => {
  eq(F.parseCount({ count: '2 035' }), 2035);
  eq(F.parseCount({ count: '2\u202f035' }), 2035);
  eq(F.parseCount({ count: '0' }), 0);
  eq(F.parseCount({ count: 7 }), 7);
  eq(F.parseCount({ count: '' }), null);
  eq(F.parseCount({ count: 'abc' }), null);
  eq(F.parseCount({}), null);
  eq(F.parseCount(null), null);
  eq(F.parseCount('12'), null);
});

check('pickLang', () => {
  eq(F.pickLang('ja', 'en-US'), 'ja');
  eq(F.pickLang('', 'ja-JP'), 'ja');
  eq(F.pickLang('en', 'ja'), 'en');
  eq(F.pickLang('jp', ''), 'ja');
  eq(F.pickLang('zh-CN', 'ja'), 'en');
  eq(F.pickLang('', ''), 'en');
});

check('countLabel', () => {
  eq(F.countLabel('ja', null), '');
  eq(F.countLabel('ja', 0), 'まだ誰も');
  eq(F.countLabel('ja', 12), '12人');
  eq(F.countLabel('en', 0), 'be the first');
  eq(F.countLabel('en', 12), '12');
});

check('countMessage', () => {
  eq(F.countMessage('ja', 1), '最初のひとりになりました。');
  eq(F.countMessage('ja', 13), 'あなたと同じ気持ちの人が 13 人います。');
  eq(F.countMessage('ja', null), 'ありがとう。');
  eq(F.countMessage('en', 1), "You're the first.");
  eq(F.countMessage('en', 13), '13 people felt the same.');
  eq(F.countMessage('en', null), 'Thank you.');
});

check('validateNote', () => {
  deq(F.validateNote('x', 9000, 'http://spam'), { ok: false, reason: 'bot' });
  deq(F.validateNote('', 5000, ''), { ok: false, reason: 'empty' });
  deq(F.validateNote('   ', 5000, ''), { ok: false, reason: 'empty' });
  deq(F.validateNote('あ'.repeat(501), 5000, ''), { ok: false, reason: 'tooLong' });
  deq(F.validateNote('こんにちは', 2999, ''), { ok: false, reason: 'tooFast' });
  deq(F.validateNote('こんにちは', 3000, ''), { ok: true, text: 'こんにちは' });
  deq(F.validateNote(' 前後の空白 ', 4000, ''), { ok: true, text: '前後の空白' });
  deq(F.validateNote('あ'.repeat(500), 4000, ''), { ok: true, text: 'あ'.repeat(500) });
});

check('formBody と送信先: 設計書の entry に対応させる', () => {
  deq(F.formBody('hyaku', '/hyaku.html', '本文'), [
    ['entry.796994745', 'hyaku'], ['entry.20892979', '/hyaku.html'], ['entry.274902902', '本文'],
  ]);
  eq(F.FORM_URL,
    'https://docs.google.com/forms/d/e/1FAIpQLSfu4FAXL_Qyu_BBhgGgyIfn2KH4gPGAnQSueTNop6v2H8RjJA/formResponse');
});

check('workTitle', () => {
  eq(F.workTitle('hyaku', 'なんでも'), '百の悪行');
  eq(F.workTitle('method/kansoku-suru-monogatari',
    '観測する物語 — 物語に「あなたを覚えている」を実装できるようになった｜新しい形の研究'), '観測する物語');
  eq(F.workTitle('method/en/stories-that-watch-you',
    'Stories That Watch You — Flags Made of Words | New Forms Research'), 'Stories That Watch You');
  eq(F.workTitle('harness-x', ''), 'harness-x');
  eq(F.workTitle('constructor', ''), 'constructor');
});

check('sortRows: 多い順・null は最後・同数は設定順・元を並べ替えない', () => {
  const rows = [
    { work: 'a', count: 3, order: 0 }, { work: 'b', count: 5, order: 1 }, { work: 'c', count: 0, order: 2 },
    { work: 'd', count: null, order: 3 }, { work: 'e', count: 5, order: 4 },
  ];
  deq(F.sortRows(rows).map((r) => r.work), ['b', 'e', 'a', 'c', 'd']);
  eq(rows[0].work, 'a');
});

check('readCache / writeCache: 10 分で切れる・元を書き換えない', () => {
  const empty = {};
  const s = F.writeCache(empty, 'feel/hyaku/naita', 12, 1000);
  deq(empty, {});
  eq(F.readCache(s, 'feel/hyaku/naita', 1000 + F.CACHE_TTL_MS - 1), 12);
  eq(F.readCache(s, 'feel/hyaku/naita', 1000 + F.CACHE_TTL_MS + 1), null);
  eq(F.readCache(s, 'feel/other', 1000), null);
  eq(F.readCache({ p: { n: 'x', t: 0 } }, 'p', 1), null);
  eq(F.readCache(null, 'p', 1), null);
});

check('isPressed / markPressed', () => {
  const s0 = {};
  const s1 = F.markPressed(s0, 'feel/hyaku/naita', '2026-09-24');
  eq(F.isPressed(s1, 'feel/hyaku/naita'), true);
  eq(F.isPressed(s1, 'feel/hyaku/tsuzuki'), false);
  eq(F.isPressed(s0, 'feel/hyaku/naita'), false, '元を書き換えない');
  eq(F.isPressed(F.markPressed(null, 'p', 'd'), 'p'), true);
  eq(F.isPressed(null, 'p'), false);
});

check('getDraft / setDraft', () => {
  const s1 = F.setDraft({}, 'hyaku', '下書き');
  eq(F.getDraft(s1, 'hyaku'), '下書き');
  eq(F.getDraft(s1, 'seikai'), '');
  const s2 = F.setDraft(s1, 'hyaku', '');
  eq(F.getDraft(s2, 'hyaku'), '');
  eq('hyaku' in s2.drafts, false, '空にしたら消す');
  eq(F.getDraft(s1, 'hyaku'), '下書き', '元を書き換えない');
  eq(F.getDraft(null, 'hyaku'), '');
});

if (failures) { console.error(`feel_core_test: ${failures} FAILED`); process.exit(1); }
console.log('feel_core_test: ALL PASS');
