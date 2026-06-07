const ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function extractVideoId(input) {
  if (!input) return null;
  if (ID_RE.test(input)) return input;
  try {
    const u = new URL(input);
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1);
      return ID_RE.test(id) ? id : null;
    }
    if (u.hostname.endsWith('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v && ID_RE.test(v)) return v;
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function chunk(arr, size) {
  if (!arr.length) return [];
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function mergeCuesWithTranslations(cues, jaTexts) {
  return cues.map((c, i) => ({ ...c, ja: jaTexts[i] ?? '' }));
}
