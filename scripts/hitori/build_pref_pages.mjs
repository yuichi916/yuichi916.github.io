// ひとり歓迎マップの「都道府県ごとの一覧」を静的 HTML で書き出す。
//   node scripts/hitori/build_pref_pages.mjs
// 地図（hitori.html）は JS で描くので、検索エンジンと AI の読み手には中身が届かない。
// ここでは「公式の裏付けがある施設」だけを、地図と同じ判定関数（map-core.js）で並べる。
// 公式の裏付けが MIN_OFFICIAL 件に満たない県はページを作らない（中身の薄いページを量産しない）。
// 閉業・休業の情報がある施設は載せない。文章は足さず、集めた事実だけを並べる。
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rowsToObjects } from '../../assets/hitori/core.js';
import { DISPLAY_CATS, displayCat, kindJa, soloCheck, closureOf } from '../../assets/hitori/map-core.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'hitori');
const SITE = 'https://yuichi916.github.io';
const MIN_OFFICIAL = 10;
const SLUG = ['', 'hokkaido', 'aomori', 'iwate', 'miyagi', 'akita', 'yamagata', 'fukushima', 'ibaraki', 'tochigi',
  'gunma', 'saitama', 'chiba', 'tokyo', 'kanagawa', 'niigata', 'toyama', 'ishikawa', 'fukui', 'yamanashi', 'nagano',
  'gifu', 'shizuoka', 'aichi', 'mie', 'shiga', 'kyoto', 'osaka', 'hyogo', 'nara', 'wakayama', 'tottori', 'shimane',
  'okayama', 'hiroshima', 'yamaguchi', 'tokushima', 'kagawa', 'ehime', 'kochi', 'fukuoka', 'saga', 'nagasaki',
  'kumamoto', 'oita', 'miyazaki', 'kagoshima', 'okinawa'];

const read = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');

const index = read('data/hitori/index.json');
const updated = index.updated;

function prefItems(code) {
  const doc = read(`data/hitori/pref/${pad(code)}.json`);
  let curated = {};
  try { curated = read(`data/hitori/curated/${pad(code)}.json`); } catch { /* 根拠の無い県 */ }
  const out = [];
  for (const it of rowsToObjects(doc)) {
    const meta = index.checked[it.id];
    if (!meta || !(meta[2] > 0)) continue;            // 公式の裏付けがある施設だけ（地図の isChecked と同じ）
    const cur = curated[it.id] || null;
    if (closureOf(cur)) continue;                    // 閉業・休業の情報があるものは載せない
    const chk = soloCheck(cur, it);
    const oks = chk.cells.filter(c => c.state === 'ok').map(c => c.short);
    const hours = ((cur && cur.facts) || []).find(f => (f.k === 'hours' || f.k === 'opening_hours') && f.official && !f.conflict);
    out.push({ it, cat: displayCat(it.kind, it.cat), oks, known: chk.known, hours: hours ? String(hours.v) : '' });
  }
  out.sort((a, b) => b.known - a.known || (a.it.city || '').localeCompare(b.it.city || '', 'ja') || a.it.name.localeCompare(b.it.name, 'ja'));
  return out;
}

const HEAD = (title, desc, canon) => `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${SITE}/assets/og/hitori-1200x630.jpg">
<meta property="og:site_name" content="Views Engineer">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@ViewsEngineer">
<link rel="icon" href="/favicon.svg">
<script data-goatcounter="https://viewsengineer.goatcounter.com/count" async src="https://gc.zgo.at/count.js" integrity="sha384-2UjvVpptg4JlEVgJI2PdscrjOjPcil/4F1ZvIMJ81CShQnEDSlPI+l4PfogvTLYi" crossorigin="anonymous"></script>
<style>
:root{--paper:#faf7f1;--white:#fffdfa;--ink:#2c2723;--muted:#756b64;--line:#e8ded4;--accent:#ad5039;--sage:#276b60;--sage-pale:#e8f3ef}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Hiragino Sans","Yu Gothic",system-ui,sans-serif;font-size:15px;line-height:1.75}
main{max-width:820px;margin:0 auto;padding:28px 16px 64px}
a{color:var(--sage)}
.crumb{font-size:13px;color:var(--muted)}
.crumb a{color:inherit}
p,h1,h2{word-break:auto-phrase;text-wrap:pretty}
h1{font-size:clamp(22px,4.4vw,30px);line-height:1.4;margin:.4em 0 .3em}
h2{font-size:19px;margin:2em 0 .6em;padding-bottom:.3em;border-bottom:2px solid var(--line)}
.lede{color:var(--muted);margin:0 0 1.2em}
.cta{display:inline-block;margin:.4em 0 1em;padding:10px 18px;border-radius:999px;background:var(--accent);color:#fff;text-decoration:none;font-weight:700}
.facts{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 .6em;padding:0;list-style:none}
.facts li{background:var(--white);border:1px solid var(--line);border-radius:10px;padding:6px 12px;font-size:14px}
ol.list{list-style:none;margin:0;padding:0}
ol.list>li{background:var(--white);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 10px}
.nm{font-weight:700;font-size:16px}
.meta{font-size:13px;color:var(--muted)}
.ok{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 0;padding:0;list-style:none}
.ok li{font-size:12.5px;background:var(--sage-pale);color:var(--sage);border-radius:999px;padding:2px 10px;border:0;margin:0}
.go{font-size:13px}
.prefs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;list-style:none;padding:0}
.prefs a{display:block;background:var(--white);border:1px solid var(--line);border-radius:10px;padding:10px 12px;text-decoration:none;color:var(--ink)}
.prefs b{display:block}
.prefs span{font-size:13px;color:var(--muted)}
.note{font-size:13px;color:var(--muted);margin-top:2.4em}
</style>
</head>
<body>
<main>
`;
const FOOT = `<p class="note">一覧に載せているのは、公式サイトや自治体のページなど<b>公式の情報で裏付けが取れた施設だけ</b>です（閉業・休業の情報があるものは除いています）。「ひとりで入りやすいか」の根拠は、地図の詳細で出典つきで確かめられます。データは OpenStreetMap と各施設の公式情報をもとに、AI（Claude・Codex）で公式ページから読み取っています。最終更新 ${esc(updated)}。</p>
<p class="note"><a href="/hitori.html">ひとり歓迎マップ</a> ／ <a href="/hitori/">都道府県の一覧</a> ／ <a href="/">ひとりぶんの棚（トップ）</a></p>
</main>
</body>
</html>
`;

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.html')) unlinkSync(join(OUT, f));

const made = [];
// 先に対象の県を決めておき、各ページの末尾に「ほかの都道府県」を並べる（県どうしの内部リンク）
const eligible = index.prefectures.map(p => ({ p, items: prefItems(p.code) })).filter(x => x.items.length >= MIN_OFFICIAL);
const prefNav = code => `<h2>ほかの都道府県</h2>
<ul class="prefs">${eligible.filter(x => x.p.code !== code)
  .map(x => `<li><a href="${SLUG[x.p.code]}.html"><b>${esc(x.p.name)}</b><span>${x.items.length}件</span></a></li>`).join('')}</ul>
`;
for (const { p, items } of eligible) {
  const slug = SLUG[p.code];
  const canon = `${SITE}/hitori/${slug}.html`;
  const byCat = new Map(DISPLAY_CATS.map(c => [c.key, []]));
  for (const x of items) (byCat.get(x.cat) || byCat.set(x.cat, []).get(x.cat)).push(x);
  const catSummary = DISPLAY_CATS.map(c => [c.label, (byCat.get(c.key) || []).length]).filter(([, n]) => n);
  const kinds = [...new Set(items.map(x => kindJa(x.it.kind)))].slice(0, 4).join('・');
  const title = `${p.name}で一人で行ける・入りやすい店と銭湯 ${items.length}件（公式で確認済み）｜ひとり歓迎マップ`;
  const desc = `${p.name}の${kinds}など、一人で入りやすいかを公式情報で確かめた${items.length}施設の一覧。一人利用・カウンター席・券売機・予約の要否などの根拠つき。`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: canon, inLanguage: 'ja', dateModified: updated,
    isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website` },
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ひとり歓迎マップ', item: `${SITE}/hitori.html` },
      { '@type': 'ListItem', position: 2, name: '都道府県の一覧', item: `${SITE}/hitori/` },
      { '@type': 'ListItem', position: 3, name: p.name, item: canon }] },
    mainEntity: { '@type': 'ItemList', numberOfItems: items.length,
      itemListElement: items.slice(0, 50).map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.it.name,
        url: `${SITE}/hitori.html?pref=${p.code}&facility=${encodeURIComponent(x.it.id)}` })) },
  };
  let body = HEAD(title, desc, canon);
  body += `<p class="crumb"><a href="/hitori.html">ひとり歓迎マップ</a> › <a href="/hitori/">都道府県の一覧</a> › ${esc(p.name)}</p>\n`;
  body += `<h1>${esc(p.name)}で、一人で行ける・入りやすい店と銭湯</h1>\n`;
  body += `<p class="lede">${esc(p.name)}の${esc(p.count.toLocaleString('en-US'))}施設のうち、一人で入りやすいかを<b>公式の情報で確かめられた ${items.length} 件</b>です。確かめられた項目が多い順に並べています。</p>\n`;
  body += `<a class="cta" href="/hitori.html#pref=${p.code}">${esc(p.name)}を地図で見る →</a>\n`;
  body += `<ul class="facts">${catSummary.map(([l, n]) => `<li>${esc(l)} ${n}件</li>`).join('')}</ul>\n`;
  for (const c of DISPLAY_CATS) {
    const list = byCat.get(c.key) || [];
    if (!list.length) continue;
    body += `<h2>${esc(c.label)}（${list.length}件）</h2>\n<ol class="list">\n`;
    for (const x of list) {
      const url = `/hitori.html?pref=${p.code}&amp;facility=${encodeURIComponent(x.it.id)}`;
      body += `<li><div class="nm">${esc(x.it.name)}</div>`
        + `<div class="meta">${esc(kindJa(x.it.kind))}${x.it.city ? '・' + esc(x.it.city) : ''}${x.hours ? '・営業時間（公式）' + esc(x.hours) : ''}</div>`
        + (x.oks.length ? `<ul class="ok">${x.oks.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : '')
        + `<a class="go" href="${url}">地図で根拠を見る →</a></li>\n`;
    }
    body += `</ol>\n`;
  }
  body = body.replace('</head>', `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n</head>`);
  body += prefNav(p.code) + FOOT;
  writeFileSync(join(OUT, `${slug}.html`), body);
  made.push({ code: p.code, name: p.name, slug, n: items.length });
}

// 都道府県の一覧
const total = made.reduce((s, m) => s + m.n, 0);
const title = `一人で行ける・入りやすい店と銭湯 都道府県別（公式で確認済み ${total.toLocaleString('en-US')}件）｜ひとり歓迎マップ`;
const desc = `一人で入りやすいかを公式情報で確かめた ${total.toLocaleString('en-US')} 施設を、${made.length} の都道府県ごとに一覧にしました。ラーメン・そば・銭湯・サウナ・図書館など。`;
let idxBody = HEAD(title, desc, `${SITE}/hitori/`);
idxBody += `<p class="crumb"><a href="/hitori.html">ひとり歓迎マップ</a> › 都道府県の一覧</p>\n<h1>一人で行ける・入りやすい店と銭湯（都道府県別）</h1>\n`;
idxBody += `<p class="lede">全国${index.total.toLocaleString('en-US')}施設のうち、一人で入りやすいかを公式の情報で確かめられた施設を、都道府県ごとにまとめました。公式で確かめられた施設が${MIN_OFFICIAL}件に満たない県は、地図でご覧ください。</p>\n`;
idxBody += `<a class="cta" href="/hitori.html">地図で探す →</a>\n<ul class="prefs">${made.map(m => `<li><a href="${m.slug}.html"><b>${esc(m.name)}</b><span>${m.n}件</span></a></li>`).join('')}</ul>\n`;
idxBody += FOOT;
const idxLd = {
  '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: `${SITE}/hitori/`, inLanguage: 'ja', dateModified: updated,
  isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website` },
  mainEntity: { '@type': 'ItemList', numberOfItems: made.length,
    itemListElement: made.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.name, url: `${SITE}/hitori/${m.slug}.html` })) },
};
idxBody = idxBody.replace('</head>', `<script type="application/ld+json">${JSON.stringify(idxLd).replace(/</g, '\\u003c')}</script>\n</head>`);
writeFileSync(join(OUT, 'index.html'), idxBody);
console.log(`wrote ${made.length} pref pages + index (${total} facilities). skipped: ${index.prefectures.filter(p => !made.find(m => m.code === p.code)).map(p => p.name).join(' ')}`);
