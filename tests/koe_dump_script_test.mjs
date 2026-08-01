// dump_script.mjs の検証。node tests/koe_dump_script_test.mjs で実行、exit 0 が合格。
//
// fix round 1（レビュー指摘 Important 4）: 複数エピソードが1ファイルに
// 代入されていても、以前は先頭だけを黙って棚卸しできてしまった。
// 「どちらを見ているか曖昧なときは選ばず止める」ことを回帰させないための
// 自動テスト（これまで dump_script.mjs には自動テストが無かった）。
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const BRIDGE = fileURLToPath(new URL('../scripts/koe/dump_script.mjs', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'koe-dump-test-'));

function runOk(file) {
  return execFileSync(process.execPath, [BRIDGE, file], { encoding: 'utf8' });
}

function runFails(file) {
  try {
    execFileSync(process.execPath, [BRIDGE, file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return null;
  } catch (e) {
    return e.status;
  }
}

try {
  // --- 単一エピソード: JSONへ正しくラウンドトリップする（ネストしたreply込み） ---
  const oneEp = join(dir, 'ep-one.js');
  writeFileSync(oneEp, `
window.KOE = window.KOE || {};
window.KOE.ep1 = { scenes: [{ beats: [
  { say: 'kanata', text: '拾い屋だ' },
  { say: 'toki', text: '昔な', reply: [ { say: 'kanata', text: '返事だ' } ] }
]}] };
`, 'utf8');
  const parsed = JSON.parse(runOk(oneEp));
  assert.strictEqual(parsed.scenes[0].beats[0].text, '拾い屋だ', '日本語テキストがラウンドトリップする');
  assert.strictEqual(parsed.scenes[0].beats[1].reply[0].text, '返事だ', 'ネストしたreplyもラウンドトリップする');

  // --- 複数エピソード代入 → エラーで止まる（無言でどちらか片方だけ棚卸ししない） ---
  const twoEp = join(dir, 'ep-two.js');
  writeFileSync(twoEp, `
window.KOE = window.KOE || {};
window.KOE.ep1 = { scenes: [] };
window.KOE.ep2 = { scenes: [] };
`, 'utf8');
  assert.strictEqual(runFails(twoEp), 1, '複数エピソードはexit 1で止まる');

  // --- 何も代入されていない → エラーで止まる（既存の挙動を維持） ---
  const zeroEp = join(dir, 'ep-zero.js');
  writeFileSync(zeroEp, `window.KOE = window.KOE || {};`, 'utf8');
  assert.strictEqual(runFails(zeroEp), 1, '未代入はexit 1で止まる');

  console.log('koe_dump_script_test: OK');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
