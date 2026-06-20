const SEPARATOR = '\n\n␞\n\n';
const MAX_IN_FLIGHT = 1;
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const FETCH_TIMEOUT_MS = 6000;
const ENCODED_SEP_BYTES = encodeURIComponent(SEPARATOR).length;
const CHUNK_URL_BUDGET = 3000;

async function fetchWithTimeout(url, opts = {}, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function translateBatch(texts, { from = 'en', to = 'ja', debug = null, gtTries = 2 } = {}) {
  if (!texts.length) return [];
  const groups = chunkByByteBudget(texts, CHUNK_URL_BUDGET);
  const results = new Array(groups.length);

  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= groups.length) return;
      results[i] = await translateGroup(groups[i], from, to, debug, gtTries);
    }
  }
  const workers = Array.from({ length: Math.min(MAX_IN_FLIGHT, groups.length) }, worker);
  await Promise.all(workers);

  return results.flat();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function hasContent(parts) {
  return Array.isArray(parts) && parts.some((s) => s && s.trim());
}

function chunkByByteBudget(texts, maxBytes) {
  const out = [];
  let cur = [];
  let curBytes = 0;
  for (const t of texts) {
    const tBytes = encodeURIComponent(t).length;
    const sepCost = cur.length ? ENCODED_SEP_BYTES : 0;
    if (cur.length && curBytes + sepCost + tBytes > maxBytes) {
      out.push(cur);
      cur = [];
      curBytes = 0;
    }
    cur.push(t);
    curBytes += (cur.length === 1 ? 0 : ENCODED_SEP_BYTES) + tBytes;
  }
  if (cur.length) out.push(cur);
  return out;
}

async function translateGroup(group, from, to, debug = null, gtTries = 2) {
  // GT (translate.googleapis.com) batches well (preserves the separator) and is
  // fast, but intermittently 429s from Cloudflare PoP IPs. Retry a few times
  // with a short backoff; the client fills anything still missing via MyMemory
  // from its own (un-throttled) IP.
  const tries = Math.max(1, gtTries);
  for (let i = 0; i < tries; i++) {
    const viaGT = await translateViaGT(group, from, to, debug);
    if (hasContent(viaGT)) return viaGT;
    if (i < tries - 1) await sleep(150 + i * 150);
  }
  return group.map(() => '');
}

async function translateViaGT(group, from, to, debug = null) {
  const joined = group.join(SEPARATOR);
  const url = `${ENDPOINT}?client=gtx&sl=${from}&tl=${to}&dt=t`;
  const formBody = `q=${encodeURIComponent(joined)}`;
  let body;
  let lastStatus = 0;
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      body: formBody,
    });
    lastStatus = res.status;
    if (!res.ok) {
      if (debug) (debug.gtFails ||= []).push({ from, to, status: lastStatus });
      return null;
    }
    body = await res.json();
  } catch (err) {
    if (debug) (debug.gtFails ||= []).push({ from, to, status: lastStatus, err: String(err?.message || err) });
    return null;
  }
  const joinedTl = (body?.[0] ?? [])
    .map((seg) => seg?.[0] ?? '')
    .join('');
  if (!joinedTl) {
    if (debug) (debug.gtFails ||= []).push({ from, to, status: lastStatus, err: 'empty body' });
    return null;
  }
  if (debug) (debug.gtSuccess ||= []).push({ from, to, status: lastStatus, groupLen: group.length });
  const parts = joinedTl.split(SEPARATOR);
  if (parts.length === group.length) return parts.map((s) => s.trim());
  return group.map((_, i) => (parts[i] ?? '').trim());
}

