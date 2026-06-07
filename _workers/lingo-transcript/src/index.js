import { fetchEnglishCues, NoCaptionsError } from './transcript.js';
import { translateBatch } from './translate.js';
import { extractVideoId, mergeCuesWithTranslations } from './util.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return corsResponse(env, null, 204);
    }

    if (url.pathname !== '/api/transcript') {
      return corsResponse(env, { error: 'not_found' }, 404);
    }

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

    let cues;
    try {
      cues = await fetchEnglishCues(videoId);
    } catch (err) {
      if (err instanceof NoCaptionsError) {
        return corsResponse(env, { error: 'no_captions', videoId }, 404);
      }
      return corsResponse(env, { error: 'upstream_transcript', message: String(err?.message || err) }, 502);
    }

    let jaTexts;
    try {
      jaTexts = await translateBatch(cues.map((c) => c.en));
    } catch (err) {
      jaTexts = cues.map(() => '');
    }

    const merged = mergeCuesWithTranslations(cues, jaTexts);
    const payload = {
      videoId,
      lang: { from: 'en', to: 'ja' },
      cues: merged,
      cachedAt: Math.floor(Date.now() / 1000),
    };

    const ttl = Number(env.CACHE_TTL_SECONDS) || 2592000;
    await env.LINGO_CACHE.put(cacheKey, JSON.stringify(payload), { expirationTtl: ttl });

    return corsResponse(env, payload, 200);
  },
};

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
