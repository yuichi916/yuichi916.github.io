import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CHARACTERS, CHAR, charsOf, EXPRESSIONS, LINE_KEYS, spritePath, voicePath,
} from '../../assets/tsunagu-naraberu/characters.js';

const assetDir = fileURLToPath(new URL('../../assets/tsunagu-naraberu/', import.meta.url));

test('4人・各派2人', () => {
  assert.equal(CHARACTERS.length, 4);
  assert.equal(charsOf('tsunagu').length, 2);
  assert.equal(charsOf('naraberu').length, 2);
  for (const c of CHARACTERS) assert.equal(CHAR[c.id], c);
});

test('全員に台詞11本・名前・色・相棒', () => {
  assert.equal(LINE_KEYS.length, 11);
  for (const c of CHARACTERS) {
    for (const k of LINE_KEYS) assert.ok(c.lines[k] && c.lines[k].length > 0, `${c.id}.${k}`);
    assert.ok(c.name && c.color.main && c.color.sub);
    assert.equal(c.partner, c.faction === 'tsunagu' ? 'punimaru' : 'kakutan');
  }
});

test('表情7種＋選択用＋カットインの絵が実在する', () => {
  assert.equal(EXPRESSIONS.length, 7);
  for (const c of CHARACTERS) {
    for (const e of [...EXPRESSIONS, 'select', 'cutin']) {
      const p = spritePath(c.id, e);
      assert.match(p, new RegExp(`^chara/${c.id}/${e}\\.webp$`));
      assert.ok(existsSync(assetDir + p), `missing ${p}`);
    }
  }
});

test('声のパスの形', () => {
  assert.equal(voicePath('rin', 'c3'), 'voice/rin_c3.mp3');
});
