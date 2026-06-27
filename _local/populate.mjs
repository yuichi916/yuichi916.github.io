// lingo cache populator — run from a RESIDENTIAL IP (your PC), where YouTube is
// not blocked. Fetches timed English captions + Japanese translation for a list
// of video IDs and stores them in the Worker's shared cache, so every visitor
// gets bilingual subtitles zero-install. Node 18+ (global fetch).
//
//   node _local/populate.mjs <id1> <id2> ...
//   node _local/populate.mjs --search "english conversation" 8
//
// The populate secret is read from C:/tmp/pop_secret.txt (or POP_SECRET env).
import fs from 'node:fs';

const WORKER = 'https://lingo-transcript.yuichi916.workers.dev';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const SECRET = (process.env.POP_SECRET || (fs.existsSync('C:/tmp/pop_secret.txt') ? fs.readFileSync('C:/tmp/pop_secret.txt', 'utf8').trim() : '')).trim();

function extractJson(html, key) {
  let i = html.indexOf('var ' + key + ' = ');
  if (i < 0) { i = html.indexOf('"' + key + '":'); if (i < 0) return null; i = html.indexOf('{', i); } else { i += ('var ' + key + ' = ').length; }
  let d = 0;
  for (let j = i; j < html.length; j++) { const ch = html[j]; if (ch === '{') d++; else if (ch === '}') { d--; if (d === 0) { try { return JSON.parse(html.slice(i, j + 1)); } catch { return null; } } } }
  return null;
}
function decode(s) { return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)); }
function parseXml(xml) {
  const cues = []; let m;
  const pRe = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  while ((m = pRe.exec(xml)) !== null) {
    const start = +m[1] / 1000, dur = +m[2] / 1000; let text = '';
    const sRe = /<s[^>]*>([^<]*)<\/s>/g; let sm; while ((sm = sRe.exec(m[3])) !== null) text += sm[1];
    if (!text) text = m[3].replace(/<[^>]+>/g, '');
    text = decode(text.replace(/\s+/g, ' ').trim());
    if (text) cues.push({ start, end: start + dur, en: text });
  }
  return cues;
}
async function getEnCues(videoId) {
  const html = await (await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en&gl=US`, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', 'Cookie': 'SOCS=CAI; CONSENT=YES+; PREF=hl=en&gl=US' } })).text();
  const pr = extractJson(html, 'ytInitialPlayerResponse');
  const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const en = tracks.find((t) => /^en/i.test(t.languageCode) && t.kind !== 'asr') || tracks.find((t) => /^en/i.test(t.languageCode)) || tracks[0];
  if (!en) return null;
  const xml = await (await fetch(en.baseUrl)).text();
  const cues = parseXml(xml);
  return cues.length ? cues : null;
}
const SEP = '\n\n␞\n\n';
async function gt(texts) {
  const joined = texts.join(SEP);
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=t';
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA }, body: 'q=' + encodeURIComponent(joined) });
      if (!r.ok) { await new Promise((x) => setTimeout(x, 400 * (i + 1))); continue; }
      const b = await r.json();
      const tl = (b[0] || []).map((s) => s?.[0] ?? '').join('');
      const parts = tl.split(SEP);
      if (parts.length === texts.length) return parts.map((s) => s.trim());
      return texts.map((_, k) => (parts[k] ?? '').trim());
    } catch { await new Promise((x) => setTimeout(x, 400 * (i + 1))); }
  }
  return texts.map(() => '');
}
async function translateAll(cues) {
  // chunk by ~3000 bytes
  let i = 0;
  while (i < cues.length) {
    const batch = []; let bytes = 0; const idx = [];
    while (i < cues.length && (batch.length === 0 || bytes < 3000)) { const t = cues[i].en; bytes += encodeURIComponent(t).length + 8; batch.push(t); idx.push(i); i++; }
    const ja = await gt(batch);
    idx.forEach((ci, k) => { cues[ci].ja = ja[k] || ''; });
    process.stdout.write(`   translated ${Math.min(i, cues.length)}/${cues.length}\r`);
  }
}
async function searchIds(q, n) {
  const r = await (await fetch(`${WORKER}/api/search?q=${encodeURIComponent(q)}&sort=relevance`)).json();
  return (r.results || []).slice(0, n).map((x) => x.videoId);
}
async function populate(videoId) {
  const cues = await getEnCues(videoId);
  if (!cues) { console.log(`${videoId}: no captions`); return false; }
  await translateAll(cues);
  const r = await fetch(`${WORKER}/api/populate`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Populate-Secret': SECRET }, body: JSON.stringify({ videoId, lang: { from: 'en', to: 'ja' }, cues }) });
  const j = await r.json().catch(() => ({}));
  console.log(`${videoId}: ${r.status} ${j.ok ? '✅ cached ' + j.cues + ' cues' : JSON.stringify(j)}`);
  return !!j.ok;
}
(async () => {
  if (!SECRET) { console.log('No populate secret (C:/tmp/pop_secret.txt or POP_SECRET).'); process.exit(1); }
  let ids = process.argv.slice(2);
  if (ids[0] === '--search') { ids = await searchIds(ids[1], parseInt(ids[2] || '8', 10)); }
  console.log('populating', ids.length, 'videos');
  let ok = 0;
  for (const v of ids) { try { if (await populate(v)) ok++; } catch (e) { console.log(v, 'ERR', e.message); } }
  console.log(`done: ${ok}/${ids.length} cached`);
})();
