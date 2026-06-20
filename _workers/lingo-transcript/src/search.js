import { CaptchaError } from './transcript.js';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36';
const MAX_RESULTS = 18;

const SORT_FIELD = { relevance: 0, rating: 1, date: 2, views: 3 };

// Build YouTube's `sp` filter protobuf: sort order + the "Subtitles/CC" feature
// flag so the results only include videos that actually have a caption track —
// lingo can't show anything for a video with no subtitles.
function buildSearchParams(sort) {
  const sortBy = SORT_FIELD[sort] ?? 0;
  const bytes = [];
  if (sortBy) bytes.push(0x08, sortBy);   // field 1: sort order
  const filt = [];
  if (sortBy) filt.push(0x10, 0x01);      // type = video (matches prior sorted behaviour)
  filt.push(0x28, 0x01);                  // has_subtitles = true
  bytes.push(0x12, filt.length, ...filt); // field 2: filters submessage
  return btoa(String.fromCharCode(...bytes));
}

export async function searchYouTube(query, sort = 'relevance') {
  const sp = buildSearchParams(sort);
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=en&sp=${encodeURIComponent(sp)}`;
  const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const html = await res.text();
  if (html.includes('class="g-recaptcha"')) throw new CaptchaError('search');

  const init = extractInlineJson(html, 'ytInitialData');
  const sections =
    init?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

  const out = [];
  for (const sec of sections) {
    const items = sec?.itemSectionRenderer?.contents || [];
    for (const it of items) {
      const vr = it.videoRenderer;
      if (!vr || !vr.videoId) continue;

      const title =
        vr.title?.runs?.map((r) => r.text).join('') ||
        vr.title?.simpleText ||
        '';
      const channel =
        vr.ownerText?.runs?.[0]?.text ||
        vr.longBylineText?.runs?.[0]?.text ||
        vr.shortBylineText?.runs?.[0]?.text ||
        '';
      const duration = vr.lengthText?.simpleText || vr.lengthText?.accessibility?.accessibilityData?.label || '';
      const views = vr.viewCountText?.simpleText || vr.shortViewCountText?.simpleText || '';
      const thumbs = vr.thumbnail?.thumbnails || [];
      const thumbnail = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;

      out.push({ videoId: vr.videoId, title, channel, duration, views, thumbnail });
      if (out.length >= MAX_RESULTS) return out;
    }
  }
  return out;
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
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
