import { YoutubeTranscript } from 'youtube-transcript';

export class NoCaptionsError extends Error {
  constructor(videoId) {
    super(`No English captions for ${videoId}`);
    this.name = 'NoCaptionsError';
  }
}

export async function fetchEnglishCues(videoId) {
  let raw;
  try {
    raw = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/transcript is disabled/i.test(msg) || /no transcript/i.test(msg) || /could not find/i.test(msg)) {
      throw new NoCaptionsError(videoId);
    }
    throw err;
  }
  if (!raw?.length) throw new NoCaptionsError(videoId);
  return raw.map((c) => {
    const start = c.offset / 1000;
    return {
      start,
      end: start + c.duration / 1000,
      en: decodeHtmlEntities(c.text.replace(/\s+/g, ' ').trim()),
    };
  });
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
