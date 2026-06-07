import { fetchSourceCues, NoCaptionsError, CaptchaError } from './transcript.js';
import { translateBatch } from './translate.js';
import { extractVideoId } from './util.js';
import { searchYouTube } from './search.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return corsResponse(env, null, 204);
    }

    if (url.pathname === '/api/transcript') {
      return handleTranscript(env, url);
    }
    if (url.pathname === '/api/search') {
      return handleSearch(env, url);
    }
    return corsResponse(env, { error: 'not_found' }, 404);
  },
};

async function handleTranscript(env, url) {
  const videoId = extractVideoId(url.searchParams.get('v') || '');
  if (!videoId) {
    return corsResponse(env, { error: 'bad_video_id' }, 400);
  }

  const refresh = url.searchParams.get('refresh') === '1';
  const cacheKey = `v:${videoId}`;

  if (!refresh) {
    const cached = await env.LINGO_CACHE.get(cacheKey, 'json');
    if (cached) return corsResponse(env, cached, 200);
  }

  const debug = url.searchParams.get('debug') === '1' ? {} : null;
  let src;
  try {
    src = await fetchSourceCues(videoId, debug);
  } catch (err) {
    if (err instanceof NoCaptionsError) {
      return corsResponse(env, { error: 'no_captions', videoId, ...(debug ? { debug } : {}) }, 404);
    }
    if (err instanceof CaptchaError) {
      return corsResponse(env, { error: 'rate_limited', message: 'YouTube PoP rate-limited, retry shortly' }, 503);
    }
    return corsResponse(env, { error: 'upstream_transcript', message: String(err?.message || err), ...(debug ? { debug } : {}) }, 502);
  }

  const merged = await buildBilingualCues(src, debug);
  const payload = {
    videoId,
    lang: { from: src.srcLang, to: 'ja' },
    cues: merged,
    cachedAt: Math.floor(Date.now() / 1000),
    ...(debug ? { debug } : {}),
  };

  const ttl = Number(env.CACHE_TTL_SECONDS) || 2592000;
  await env.LINGO_CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: ttl });

  return corsResponse(env, payload, 200);
}

async function buildBilingualCues(src, debug = null) {
  const texts = src.cues.map((c) => c.text);
  if (src.srcLang === 'en') {
    let ja;
    try { ja = await translateBatch(texts, { from: 'en', to: 'ja', debug }); }
    catch { ja = texts.map(() => ''); }
    return src.cues.map((c, i) => ({ start: c.start, end: c.end, en: c.text, ja: ja[i] ?? '' }));
  }
  if (src.srcLang === 'ja') {
    let en;
    try { en = await translateBatch(texts, { from: 'ja', to: 'en', debug }); }
    catch { en = texts.map(() => ''); }
    return src.cues.map((c, i) => ({ start: c.start, end: c.end, en: en[i] ?? '', ja: c.text }));
  }
  let en, ja;
  try { en = await translateBatch(texts, { from: src.srcLang, to: 'en', debug }); }
  catch { en = texts.map(() => ''); }
  try { ja = await translateBatch(texts, { from: src.srcLang, to: 'ja', debug }); }
  catch { ja = texts.map(() => ''); }
  return src.cues.map((c, i) => ({ start: c.start, end: c.end, en: en[i] ?? '', ja: ja[i] ?? '' }));
}

async function handleSearch(env, url) {
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return corsResponse(env, { error: 'empty_query' }, 400);

  const cacheKey = `s:${q.toLowerCase()}`;
  const cached = await env.LINGO_CACHE.get(cacheKey, 'json');
  if (cached) return corsResponse(env, cached, 200);

  let results;
  try {
    results = await searchYouTube(q);
  } catch (err) {
    if (err instanceof CaptchaError) {
      return corsResponse(env, { error: 'rate_limited', message: 'YouTube PoP rate-limited, retry shortly' }, 503);
    }
    return corsResponse(env, { error: 'upstream_search', message: String(err?.message || err) }, 502);
  }

  const payload = { query: q, results, cachedAt: Math.floor(Date.now() / 1000) };
  await env.LINGO_CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: 3600 });
  return corsResponse(env, payload, 200);
}

function corsResponse(env, bodyObj, status) {
  const origin = env.ALLOWED_ORIGIN || 'https://yuichi916.github.io';
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Cache-Control': 'public, max-age=600',
  };
  if (bodyObj === null) return new Response(null, { status, headers });
  return new Response(JSON.stringify(bodyObj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
