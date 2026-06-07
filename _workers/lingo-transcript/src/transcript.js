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
const INNERTUBE_CLIENT_VERSION = '20.10.38';
const INNERTUBE_UA = `com.google.android.youtube/${INNERTUBE_CLIENT_VERSION} (Linux; U; Android 14)`;
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36';

export async function fetchEnglishCues(videoId) {
  const tracks = await getCaptionTracks(videoId);
  if (!tracks.length) throw new NoCaptionsError(videoId);

  const track = pickEnglishTrack(tracks);
  if (!track) throw new NoCaptionsError(videoId);

  const xml = await fetchCaptionXml(track.baseUrl, videoId);
  const cues = parseTranscriptXml(xml);
  if (!cues.length) throw new NoCaptionsError(videoId);
  return cues;
}

async function getCaptionTracks(videoId) {
  let tracks = await fetchTracksViaInnerTube(videoId);
  if (tracks && tracks.length) return tracks;
  tracks = await fetchTracksViaWebPage(videoId);
  return tracks || [];
}

async function fetchTracksViaInnerTube(videoId) {
  try {
    const res = await fetch(INNERTUBE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': INNERTUBE_UA },
      body: JSON.stringify({
        context: { client: { clientName: 'ANDROID', clientVersion: INNERTUBE_CLIENT_VERSION } },
        videoId,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null;
  } catch {
    return null;
  }
}

async function fetchTracksViaWebPage(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': BROWSER_UA },
    });
    const html = await res.text();
    if (html.includes('class="g-recaptcha"')) throw new CaptchaError(videoId);
    const player = extractInlineJson(html, 'ytInitialPlayerResponse');
    return player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || null;
  } catch (err) {
    if (err instanceof CaptchaError) throw err;
    return null;
  }
}

function pickEnglishTrack(tracks) {
  const isEn = (t) => /^(en|a\.en)/i.test(t.languageCode || '');
  const manual = tracks.filter((t) => isEn(t) && t.kind !== 'asr');
  if (manual.length) return preferGeneric(manual);
  const asr = tracks.filter((t) => isEn(t) && t.kind === 'asr');
  if (asr.length) return preferGeneric(asr);
  return null;
}

function preferGeneric(tracks) {
  return (
    tracks.find((t) => t.languageCode === 'en') ||
    tracks.find((t) => /^en-/i.test(t.languageCode)) ||
    tracks[0]
  );
}

async function fetchCaptionXml(baseUrl, videoId) {
  const res = await fetch(baseUrl, { headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok) throw new NoCaptionsError(videoId);
  return res.text();
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
