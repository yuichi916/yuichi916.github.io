// Suno の画面を Playwright で見る（手元の PC で動かす。クラウドのセッションからは Suno に届かない）。
// ログインは人が自分の Chrome でする。Playwright が起動したブラウザだと、Google などのログインが「安全でないブラウザ」として弾かれるため、
// 別の作業用プロフィールで Chrome を「リモートデバッグ」付きで開き、そこに Playwright からつなぐ。
//
// 1) Chrome を開く（ふだんのプロフィールとは別。Chrome 136 以降は、別プロフィールでないとリモートデバッグが使えない）
//    Mac:     "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="$HOME/.suno-chrome"
//    Windows: "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\.suno-chrome"
// 2) 開いた Chrome で https://suno.com にログインする（2回目からはログインしたまま）
// 3) node _dev/suno-session.mjs inspect   … Create 画面を撮り、ボタンと入力欄の名前を書き出す（まだ何も押さない）
//
// 曲を作る・落とす手順は、inspect の結果を見てから足す（画面の作りは変わるので、推測でボタンを押してクレジットを使わない）。
// 作った曲は _dev/hitofude-bgm-prep.mjs でループに仕上げて登録する。プロンプトは _dev/hitofude-bgm-suno.md。
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const cmd = process.argv[2] || 'inspect';
const OUT = process.env.SUNO_OUT || '_local/suno';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.connectOverCDP(process.env.SUNO_CDP || 'http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => /suno\.com/.test(p.url())) || await ctx.newPage();

if (cmd === 'inspect') {
  await page.goto('https://suno.com/create', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const signedIn = !/sign-?in|login/i.test(page.url()) && !(await page.getByRole('button', { name: /sign in|log in/i }).count());
  console.log('URL', page.url(), signedIn ? '（ログイン済みに見える）' : '（ログインしていないように見える。開いた Chrome でログインしてから、もう一度）');
  await page.screenshot({ path: `${OUT}/create.png`, fullPage: true });
  // 押せる物と書ける物を、名前つきで書き出す（次の手順を書くための地図）
  const items = await page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.innerText || e.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    return [...document.querySelectorAll('button, [role=button], [role=switch], [role=tab], input, textarea, [contenteditable=true]')].filter(vis)
      .map((e) => ({ tag: e.tagName.toLowerCase(), role: e.getAttribute('role') || '', name: name(e), testid: e.getAttribute('data-testid') || '' }));
  });
  writeFileSync(`${OUT}/create-controls.json`, JSON.stringify(items, null, 2));
  console.log(`撮った: ${OUT}/create.png ・ 書き出した: ${OUT}/create-controls.json（${items.length} 個）`);
}
// browser.close() はつないだ Chrome ごと閉じることがあるので、接続だけ切って終わる
process.exit(0);
