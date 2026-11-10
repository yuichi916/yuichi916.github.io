// 一筆花火2 — 計測（GoatCounter のイベント）と、結果の共有
// 計測は自分のサイトの上だけ。ゲームサイト用の書き出し（HANABI_PKG）やテストでは何も送らない
const ON = !window.HANABI_PKG && /(^|\.)yuichi916\.github\.io$/.test(location.hostname);
export const SITE = 'https://yuichi916.github.io/hanabi/';

export function track(path) {
  if (!ON) return;
  const p = 'hanabi/' + path;
  let tries = 0;
  (function attempt() {
    const g = window.goatcounter;
    if (g && typeof g.count === 'function') { try { g.count({ path: p, title: p, event: true }); } catch { /* 計測で遊びを止めない */ } return; }
    if (++tries < 20) setTimeout(attempt, 250);
  })();
}

// 外へのリンクを禁じる書き出し（CrazyGames 向け）では共有を出さない
export const canShare = () => !window.HANABI_NO_LINKS;

// スマホは OS の共有シート、PC は X の投稿画面。ref で、どこから来た人かを数える
export async function share(text, ref) {
  const url = SITE + '?ref=' + ref;
  track('share/' + ref);
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.share) {
    try { await navigator.share({ text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  window.open('https://x.com/intent/tweet?text=' + encodeURIComponent(text + '\n' + url), '_blank', 'noopener');
}
