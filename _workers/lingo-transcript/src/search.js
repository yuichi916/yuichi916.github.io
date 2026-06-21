import { CaptchaError } from './transcript.js';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36';
const MAX_RESULTS = 18;

const SORT_FIELD = { relevance: 0, rating: 1, date: 2, views: 3 };

// Build YouTube's `sp` filter protobuf: sort order + a video-type filter.
// We intentionally do NOT add the "Subtitles/CC" flag: YouTube only flags videos
// with *manual* captions there, so it excluded recent auto-captioned videos —
// which lingo can still use — and made 新着順 return only years-old results.
function buildSearchParams(sort) {
  const sortBy = SORT_FIELD[sort] ?? 0;
  const bytes = [];
  if (sortBy) bytes.push(0x08, sortBy);   // field 1: sort order
  const filt = [0x10, 0x01];              // type = video
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
      const published = vr.publishedTimeText?.simpleText || '';
      const thumbs = vr.thumbnail?.thumbnails || [];
      const thumbnail = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;

      out.push({ videoId: vr.videoId, title, channel, duration, views, published, thumbnail });
    }
  }
  // For new queries YouTube sometimes ignores the date sort (entity/brand bias),
  // returning popular-but-old videos. Re-order the page we got by parsed upload
  // age so "新着順" actually surfaces the newest of the captioned results.
  if (sort === 'date') {
    out.sort((a, b) => publishedAgeSeconds(a.published) - publishedAgeSeconds(b.published));
  }
  return out.slice(0, MAX_RESULTS);
}

function publishedAgeSeconds(text) {
  if (!text) return Infinity; // unknown / live → sort last
  const m = String(text).match(/(\d+)\s*(second|minute|hour|day|week|month|year)/i);
  if (!m) return Infinity;
  const mult = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2592000, year: 31536000 };
  return parseInt(m[1], 10) * (mult[m[2].toLowerCase()] || 0);
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
