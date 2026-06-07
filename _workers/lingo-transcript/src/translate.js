import { chunk } from './util.js';

const SEPARATOR = '\n\n␞\n\n';
const CHUNK_SIZE = 40;
const MAX_IN_FLIGHT = 3;
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

export async function translateBatch(texts, { from = 'en', to = 'ja' } = {}) {
  if (!texts.length) return [];
  const groups = chunk(texts, CHUNK_SIZE);
  const results = new Array(groups.length);

  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= groups.length) return;
      results[i] = await translateGroup(groups[i], from, to);
    }
  }
  const workers = Array.from({ length: Math.min(MAX_IN_FLIGHT, groups.length) }, worker);
  await Promise.all(workers);

  return results.flat();
}

async function translateGroup(group, from, to) {
  const joined = group.join(SEPARATOR);
  const url = `${ENDPOINT}?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(joined)}`;
  let body;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 lingo-transcript/0.1' },
    });
    if (!res.ok) throw new Error(`translate HTTP ${res.status}`);
    body = await res.json();
  } catch (err) {
    return group.map(() => '');
  }
  const joinedJa = (body?.[0] ?? [])
    .map((seg) => seg?.[0] ?? '')
    .join('');
  const parts = joinedJa.split(SEPARATOR);
  if (parts.length === group.length) return parts.map((s) => s.trim());
  return group.map((_, i) => (parts[i] ?? '').trim());
}
