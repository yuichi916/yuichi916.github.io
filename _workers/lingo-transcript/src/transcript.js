export class NoCaptionsError extends Error {
  constructor(videoId) {
    super(`No English captions for ${videoId}`);
    this.name = 'NoCaptionsError';
  }
}

export class CaptchaError extends Error {
  constructor(videoId) {
    super(`YouTube captcha required for ${videoId} (PoP rate-limited)`);
    this.name = 'CaptchaError';
  }
}

const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36';

const INNERTUBE_CLIENTS = [
  {
    name: 'IOS',
    ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X)',
    extraHeaders: { 'X-YouTube-Client-Name': '5', 'X-YouTube-Client-Version': '20.10.4' },
    context: {
      client: {
        clientName: 'IOS',
        clientVersion: '20.10.4',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        osName: 'iPhone',
        osVersion: '18.3.2.22D82',
        hl: 'en', gl: 'US',
      },
    },
  },
  {
    name: 'ANDROID',
    ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip',
    extraHeaders: { 'X-YouTube-Client-Name': '3', 'X-YouTube-Client-Version': '20.10.38' },
    context: {
      client: {
        clientName: 'ANDROID',
        clientVersion: '20.10.38',
        androidSdkVersion: 34,
        osName: 'Android',
        osVersion: '14',
        hl: 'en', gl: 'US',
      },
    },
  },
  {
    name: 'WEB',
    ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    extraHeaders: {
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': '2.20240502.00.00',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://www.youtube.com',
      'Referer': 'https://www.youtube.com/',
      'Cookie': 'SOCS=CAI; CONSENT=YES+; PREF=hl=en&gl=US',
    },
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20240502.00.00',
        hl: 'en', gl: 'US',
      },
    },
  },
];

export async function fetchEnglishCues(videoId, debug = null) {
  const result = await fetchSourceCues(videoId, debug);
  return result.cues.map((c) => ({ start: c.start, end: c.end, en: c.text }));
}

export async function fetchSourceCues(videoId, debug = null) {
  const tracks = await getCaptionTracks(videoId, debug);
  if (debug) debug.tracks = tracks.map((t) => ({ lc: t.languageCode, k: t.kind }));
  if (!tracks.length) throw new NoCaptionsError(videoId);

  const pick = pickBestTrack(tracks);
  if (debug) debug.pick = pick ? { lc: pick.track.languageCode, k: pick.track.kind, srcLang: pick.srcLang } : null;
  if (!pick) throw new NoCaptionsError(videoId);

  let xml;
  try {
    xml = await fetchCaptionXml(pick.track.baseUrl, videoId, debug);
  } catch (err) {
    if (debug) debug.firstFetchErr = String(err?.message || err);
    if (pick.fallback) {
      xml = await fetchCaptionXml(pick.fallback.baseUrl, videoId, debug);
    } else {
      throw err;
    }
  }
  const rawCues = parseTranscriptXml(xml);
  if (debug) debug.parsedCues = rawCues.length;
  if (!rawCues.length) throw new NoCaptionsError(videoId);

  return {
    srcLang: pick.srcLang,
    cues: rawCues.map((c) => ({ start: c.start, end: c.end, text: c.en })),
  };
}

async function getCaptionTracks(videoId, debug = null) {
  // Distinguish "genuinely no captions" from "YouTube blocked our datacenter IP".
  // A block must surface as a retryable rate-limit (503), not as no_captions (404).
  let blocked = false;
  // ANDROID innertube is the most resilient from datacenter IPs (IOS is often
  // blocked first); try it first so most videos succeed on a SINGLE request and
  // we never burst through every client.
  const PRIORITY = { ANDROID: 0, IOS: 1, WEB: 2 };
  const orderedClients = [...INNERTUBE_CLIENTS].sort((a, b) => (PRIORITY[a.name] ?? 9) - (PRIORITY[b.name] ?? 9));
  for (const client of orderedClients) {
    const r = await fetchTracksViaInnerTube(videoId, client);
    if (r === 'BLOCKED') { blocked = true; if (debug) (debug.attempts ||= []).push({ client: client.name, blocked: true }); continue; }
    if (debug) (debug.attempts ||= []).push({ client: client.name, count: Array.isArray(r) ? r.length : 0 });
    if (Array.isArray(r) && r.length) return r;
  }
  let webTracks = null;
  try {
    webTracks = await fetchTracksViaWebPage(videoId, debug);
  } catch (e) {
    if (e instanceof CaptchaError) blocked = true;
    else throw e;
  }
  if (debug) (debug.attempts ||= []).push({ client: 'WEBPAGE', count: webTracks?.length ?? 0 });
  if (webTracks && webTracks.length) return webTracks;
  if (blocked) throw new CaptchaError(videoId);
  return [];
}

// Returns: an array of caption tracks (possibly empty) on a clean response,
// 'BLOCKED' when YouTube rate-limited/blocked us (403/429/automated-queries),
// or null on other transient failure.
async function fetchTracksViaInnerTube(videoId, client) {
  try {
    const headers = { 'Content-Type': 'application/json', 'User-Agent': client.ua };
    if (client.extraHeaders) Object.assign(headers, client.extraHeaders);
    const res = await fetch(INNERTUBE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ context: client.context, videoId }),
    });
    if (res.status === 403 || res.status === 429) return 'BLOCKED';
    if (!res.ok) return null;
    const text = await res.text();
    if (/automated queries|unusual traffic|\/sorry\//i.test(text)) return 'BLOCKED';
    let data;
    try { data = JSON.parse(text); } catch { return null; }
    return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  } catch {
    return null;
  }
}

async function fetchTracksViaWebPage(videoId, debug = null) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en&gl=US`, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (debug) debug.webStatus = res.status;
    if (res.status === 403 || res.status === 429) throw new CaptchaError(videoId);
    const html = await res.text();
    if (debug) {
      debug.htmlLen = html.length;
      debug.hasCaptcha = html.includes('class="g-recaptcha"');
      debug.hasPlayerResp = html.includes('ytInitialPlayerResponse');
      debug.hasCaptionsKey = html.includes('playerCaptionsTracklistRenderer');
    }
    if (html.includes('class="g-recaptcha"') || /automated queries|unusual traffic/i.test(html)) {
      throw new CaptchaError(videoId);
    }
    const player = extractInlineJson(html, 'ytInitialPlayerResponse');
    return player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null;
  } catch (err) {
    if (err instanceof CaptchaError) throw err;
    return null;
  }
}

function pickBestTrack(tracks) {
  const isEn = (t) => /^(en|a\.en)/i.test(t.languageCode || '');
  const manualEn = tracks.filter((t) => isEn(t) && t.kind !== 'asr');
  if (manualEn.length) return { track: preferGeneric(manualEn), srcLang: 'en' };
  const asrEn = tracks.filter((t) => isEn(t) && t.kind === 'asr');
  if (asrEn.length) return { track: preferGeneric(asrEn), srcLang: 'en' };
  const manualAny = tracks.find((t) => t.kind !== 'asr');
  if (manualAny) return { track: manualAny, srcLang: normalizeLang(manualAny.languageCode) };
  const asrAny = tracks.find((t) => t.kind === 'asr');
  if (asrAny) return { track: asrAny, srcLang: normalizeLang(asrAny.languageCode) };
  return null;
}

function preferGeneric(tracks) {
  return (
    tracks.find((t) => t.languageCode === 'en') ||
    tracks.find((t) => /^en-/i.test(t.languageCode)) ||
    tracks[0]
  );
}

function normalizeLang(lc) {
  if (!lc) return 'auto';
  return lc.replace(/^a\./, '').split('-')[0].toLowerCase();
}

async function fetchCaptionXml(baseUrl, videoId, debug = null) {
  if (debug) debug.fetchUrl = baseUrl.slice(0, 200);
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(baseUrl, { headers: { 'User-Agent': BROWSER_UA } });
    lastStatus = res.status;
    if (res.ok) {
      if (debug) debug.fetchStatus = res.status;
      return res.text();
    }
    if (res.status !== 429 && res.status !== 503) break;
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  if (debug) debug.fetchStatus = lastStatus;
  // We already found a caption track, so the captions exist — a 429/403/503 here
  // is a rate-limit, not a missing transcript. Surface it as retryable.
  if (lastStatus === 429 || lastStatus === 503 || lastStatus === 403) throw new CaptchaError(videoId);
  throw new NoCaptionsError(videoId);
}

function parseTranscriptXml(xml) {
  const cues = [];

  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = pRegex.exec(xml)) !== null) {
    const startMs = parseInt(m[1], 10);
    const durMs = parseInt(m[2], 10);
    const inner = m[3];
    let text = '';
    const sRegex = /<s[^>]*>([^<]*)<\/s>/g;
    let sm;
    while ((sm = sRegex.exec(inner)) !== null) text += sm[1];
    if (!text) text = inner.replace(/<[^>]+>/g, '');
    text = decodeHtmlEntities(text.replace(/\s+/g, ' ').trim());
    if (text) cues.push({ start: startMs / 1000, end: (startMs + durMs) / 1000, en: text });
  }
  if (cues.length) return cues;

  const xRegex = /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g;
  while ((m = xRegex.exec(xml)) !== null) {
    const start = parseFloat(m[1]);
    const dur = parseFloat(m[2]);
    const text = decodeHtmlEntities(m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    if (text) cues.push({ start, end: start + dur, en: text });
  }
  return cues;
}

function extractInlineJson(html, name) {
  const tok = `var ${name} = `;
  const idx = html.indexOf(tok);
  if (idx === -1) return null;
  const start = idx + tok.length;
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
