# lingo Dual-Language Subtitles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `yuichi916.github.io/lingo.html` — a single static page that plays a pasted YouTube URL with English subtitles on top and Japanese translation on the bottom, synced to the player's currentTime. The page is backed by a Cloudflare Worker (`_workers/lingo-transcript/`) that fetches YouTube English captions, machine-translates them to Japanese, and caches the result in KV.

**Architecture:** Static HTML + YouTube IFrame Player on the client side; Module Worker (Wrangler project) on the server side. The page asks the Worker for `[{start,end,en,ja},...]` once per video, then polls `currentTime` at 250ms intervals to render the active cue. KV (key = `v:<videoId>`, TTL 30d) deduplicates translation work.

**Tech Stack:** Vanilla HTML/JS, YouTube IFrame Player API, Cloudflare Workers (Module syntax), Cloudflare KV, `youtube-transcript` npm package, direct `fetch` to `translate.googleapis.com` (no npm wrapper — `@vitalets/google-translate-api` is Node-only and doesn't run on Workers, so we call the underlying endpoint ourselves). Wrangler v3 for deploy.

**Spec:** [`docs/superpowers/specs/2026-06-07-lingo-dual-subtitles-design.md`](../specs/2026-06-07-lingo-dual-subtitles-design.md)

---

## File Structure

| File | Responsibility |
|---|---|
| `_workers/lingo-transcript/package.json` | Node deps for Wrangler build (`youtube-transcript`, `wrangler`, `vitest`) |
| `_workers/lingo-transcript/wrangler.toml` | Worker config, KV binding `LINGO_CACHE`, route |
| `_workers/lingo-transcript/src/index.js` | Module Worker entry: routing, CORS, orchestrates fetch→translate→cache |
| `_workers/lingo-transcript/src/transcript.js` | `fetchEnglishCues(videoId)` — wraps `youtube-transcript`, normalizes to `{start,end,en}` |
| `_workers/lingo-transcript/src/translate.js` | `translateBatch(texts)` — chunks 40, max 3 in flight, calls `translate.googleapis.com` |
| `_workers/lingo-transcript/src/util.js` | Pure helpers: `extractVideoId`, `chunk`, `mergeCuesWithTranslations` |
| `_workers/lingo-transcript/test/util.test.js` | Vitest unit tests for the three pure helpers |
| `_workers/lingo-transcript/README.md` | One-time deploy steps: wrangler login, KV create, deploy, where to plug the URL into lingo.html |
| `lingo.html` | The page. Inline `<style>` and `<script>` — no build step. |

`lingo.html` is single-file deliberately, matching the repo's existing static pages (`niwa.html`, `cabin.html`, `salon.html`).

---

## Task 1: Scaffold the Worker project

**Files:**
- Create: `_workers/lingo-transcript/package.json`
- Create: `_workers/lingo-transcript/wrangler.toml`
- Create: `_workers/lingo-transcript/.gitignore`

- [ ] **Step 1.1: Create `package.json`**

```json
{
  "name": "lingo-transcript",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run"
  },
  "dependencies": {
    "youtube-transcript": "^1.2.1"
  },
  "devDependencies": {
    "wrangler": "^3.78.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 1.2: Create `wrangler.toml`** (placeholder for `kv_namespaces[].id` — filled after Step 8.1)

```toml
name = "lingo-transcript"
main = "src/index.js"
compatibility_date = "2026-06-01"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "LINGO_CACHE"
id = "REPLACE_AFTER_WRANGLER_KV_CREATE"

[vars]
ALLOWED_ORIGIN = "https://yuichi916.github.io"
CACHE_TTL_SECONDS = "2592000"
```

- [ ] **Step 1.3: Create `.gitignore`**

```
node_modules/
.wrangler/
.dev.vars
```

- [ ] **Step 1.4: Install dependencies**

Run from `_workers/lingo-transcript/`:
```
npm install
```
Expected: `node_modules/` populated, no errors. `youtube-transcript` and `wrangler` resolve.

- [ ] **Step 1.5: Commit**

```bash
cd C:/projects/yuichi916.github.io
git add _workers/lingo-transcript/package.json _workers/lingo-transcript/wrangler.toml _workers/lingo-transcript/.gitignore
git commit -m "feat(lingo): scaffold lingo-transcript Worker project"
```

---

## Task 2: Pure helpers — `extractVideoId`, `chunk`, `mergeCuesWithTranslations` (TDD)

**Files:**
- Create: `_workers/lingo-transcript/src/util.js`
- Create: `_workers/lingo-transcript/test/util.test.js`

- [ ] **Step 2.1: Write the failing tests**

`test/util.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { extractVideoId, chunk, mergeCuesWithTranslations } from '../src/util.js';

describe('extractVideoId', () => {
  it('extracts from watch URL', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('extracts from youtu.be short URL', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ');
  });
  it('extracts from shorts URL', () => {
    expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('extracts from raw videoId', () => {
    expect(extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('returns null for non-YouTube URLs', () => {
    expect(extractVideoId('https://example.com/video')).toBeNull();
  });
  it('returns null for empty input', () => {
    expect(extractVideoId('')).toBeNull();
  });
});

describe('chunk', () => {
  it('splits array into N-sized groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('returns empty array for empty input', () => {
    expect(chunk([], 3)).toEqual([]);
  });
  it('returns one chunk when size >= length', () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]]);
  });
});

describe('mergeCuesWithTranslations', () => {
  it('pairs cues with translations by index', () => {
    const cues = [
      { start: 0, end: 2, en: 'Hello.' },
      { start: 2, end: 4, en: 'World.' },
    ];
    const ja = ['こんにちは。', '世界。'];
    expect(mergeCuesWithTranslations(cues, ja)).toEqual([
      { start: 0, end: 2, en: 'Hello.', ja: 'こんにちは。' },
      { start: 2, end: 4, en: 'World.', ja: '世界。' },
    ]);
  });
  it('falls back to empty string when translation missing', () => {
    const cues = [{ start: 0, end: 2, en: 'Hello.' }];
    expect(mergeCuesWithTranslations(cues, [])).toEqual([
      { start: 0, end: 2, en: 'Hello.', ja: '' },
    ]);
  });
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

```
cd _workers/lingo-transcript
npm test
```
Expected: FAIL — `Cannot find module '../src/util.js'`.

- [ ] **Step 2.3: Implement the helpers**

`src/util.js`:
```javascript
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
```

- [ ] **Step 2.4: Run tests to verify they pass**

```
npm test
```
Expected: PASS, 11 tests passing.

- [ ] **Step 2.5: Commit**

```bash
git add _workers/lingo-transcript/src/util.js _workers/lingo-transcript/test/util.test.js
git commit -m "feat(lingo): add pure helpers extractVideoId/chunk/mergeCues with tests"
```

---

## Task 3: Fetch English cues from YouTube

**Files:**
- Create: `_workers/lingo-transcript/src/transcript.js`

`youtube-transcript` returns `[{text, offset, duration}, ...]` where `offset` and `duration` are **milliseconds**. The Worker normalizes to seconds and named fields.

- [ ] **Step 3.1: Write `transcript.js`**

```javascript
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
```

- [ ] **Step 3.2: Smoke-check locally** (no automated test — `youtube-transcript` hits live YouTube and is rate-limited)

Run from `_workers/lingo-transcript/`:
```
node --input-type=module -e "import('./src/transcript.js').then(async m => { const c = await m.fetchEnglishCues('jNQXAC9IVRw'); console.log(c.slice(0,2)); console.log('total cues:', c.length); })"
```
Expected: prints 2 cue objects with `start`/`end`/`en`, and a total count. (`jNQXAC9IVRw` is "Me at the zoo", YouTube's first video — has captions.)

If it fails with a network/rate-limit error, retry after 60s. If it fails persistently, this is the risk called out in spec §9 — proceed to Task 4 anyway and re-test after deploy.

- [ ] **Step 3.3: Commit**

```bash
git add _workers/lingo-transcript/src/transcript.js
git commit -m "feat(lingo): fetch English cues via youtube-transcript with NoCaptionsError"
```

---

## Task 4: Translate cues to Japanese via translate.googleapis.com

**Files:**
- Create: `_workers/lingo-transcript/src/translate.js`

Direct fetch to Google's unofficial endpoint. Uses a sentinel separator (`\n\n␞\n\n` — the `␞` is U+241E "Symbol for Record Separator", unlikely to appear in captions) so we can join 40 cues into one request body and split the JA response back.

- [ ] **Step 4.1: Write `translate.js`**

```javascript
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
```

The separator-roundtrip is fragile (Google may re-flow whitespace around it). The fallback in the last line covers shorter results; if Google returns *more* segments than we sent we still take the first N. Per spec §5, individual translation failure degrades to empty JA, never blocks the response.

- [ ] **Step 4.2: Smoke-check locally**

```
cd _workers/lingo-transcript
node --input-type=module -e "import('./src/translate.js').then(async m => { console.log(await m.translateBatch(['Hello, world.', 'Good morning.', 'How are you?'])); })"
```
Expected: `[ 'こんにちは、世界。', 'おはようございます。', '元気ですか？' ]` (exact wording may vary).

- [ ] **Step 4.3: Commit**

```bash
git add _workers/lingo-transcript/src/translate.js
git commit -m "feat(lingo): batch-translate cues via translate.googleapis.com with separator roundtrip"
```

---

## Task 5: Worker entry point with KV cache, CORS, routing

**Files:**
- Create: `_workers/lingo-transcript/src/index.js`

- [ ] **Step 5.1: Write `src/index.js`**

```javascript
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
```

- [ ] **Step 5.2: Local dev run**

```
cd _workers/lingo-transcript
npx wrangler dev --local
```
In another terminal:
```
curl "http://localhost:8787/api/transcript?v=jNQXAC9IVRw"
```
Expected: JSON with `videoId`, `cues` array (each with `start`, `end`, `en`, `ja`), `cachedAt`. KV writes are no-op in local mode without `--persist-to`, which is fine for smoke.

Hit `Ctrl+C` to stop wrangler.

- [ ] **Step 5.3: Commit**

```bash
git add _workers/lingo-transcript/src/index.js
git commit -m "feat(lingo): Worker entry — routing, CORS, KV cache, refresh param"
```

---

## Task 6: Deployment instructions (README)

**Files:**
- Create: `_workers/lingo-transcript/README.md`

- [ ] **Step 6.1: Write README**

```markdown
# lingo-transcript Worker

Cloudflare Worker that fetches YouTube English captions and machine-translates them to Japanese for `lingo.html`.

## One-time setup

```bash
cd _workers/lingo-transcript
npm install
npx wrangler login         # opens browser
npx wrangler kv namespace create LINGO_CACHE
```

The `kv namespace create` command prints something like:

```
[[kv_namespaces]]
binding = "LINGO_CACHE"
id = "abcd1234..."
```

Copy that `id` into the `[[kv_namespaces]]` block in `wrangler.toml`, replacing `REPLACE_AFTER_WRANGLER_KV_CREATE`.

## Deploy

```bash
npx wrangler deploy
```

Note the deployed URL (format `https://lingo-transcript.<your-subdomain>.workers.dev`) and paste it as `WORKER_URL` in `lingo.html` (top of inline `<script>`).

## Smoke test

```bash
curl "https://lingo-transcript.<your-subdomain>.workers.dev/api/transcript?v=jNQXAC9IVRw"
```

Expected: 200 JSON with cues. Second call should be visibly faster (KV hit).

## Local dev

```bash
npx wrangler dev --local
curl "http://localhost:8787/api/transcript?v=jNQXAC9IVRw"
```
```

- [ ] **Step 6.2: Commit**

```bash
git add _workers/lingo-transcript/README.md
git commit -m "docs(lingo): add Worker deploy README"
```

---

## Task 7: `lingo.html` skeleton with dark theme

**Files:**
- Create: `lingo.html`

- [ ] **Step 7.1: Write the page**

`lingo.html`:
```html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>lingo — YouTube English × 日本語</title>
  <link rel="icon" href="favicon.svg" />
  <style>
    :root {
      --bg: #0b0d11;
      --fg: #e6e8ec;
      --dim: #9aa3b2;
      --accent: #6ea8ff;
      --error: #ff6b6b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px 64px;
    }
    h1 {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 16px;
      color: var(--dim);
      letter-spacing: 0.04em;
    }
    h1 .accent { color: var(--accent); }
    .input-row {
      display: flex;
      gap: 8px;
      width: 100%;
      max-width: 960px;
      margin-bottom: 20px;
    }
    .input-row input {
      flex: 1;
      padding: 10px 14px;
      background: #1a1d24;
      border: 1px solid #2a2f3a;
      border-radius: 8px;
      color: var(--fg);
      font-size: 15px;
    }
    .input-row button {
      padding: 10px 18px;
      background: var(--accent);
      color: #0b0d11;
      border: 0;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .input-row button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    #player-wrap {
      width: 100%;
      max-width: 960px;
      aspect-ratio: 16 / 9;
      background: #000;
      border-radius: 12px;
      overflow: hidden;
    }
    #player-wrap iframe { width: 100%; height: 100%; border: 0; }
    #subtitles {
      width: 100%;
      max-width: 960px;
      min-height: 96px;
      padding: 20px 8px;
      text-align: center;
    }
    #sub-en {
      font-size: 28px;
      font-weight: 700;
      line-height: 1.3;
      color: var(--fg);
    }
    #sub-ja {
      font-size: 20px;
      line-height: 1.4;
      color: var(--dim);
      margin-top: 8px;
    }
    #status {
      margin-top: 12px;
      color: var(--dim);
      font-size: 14px;
      min-height: 20px;
    }
    #status.error { color: var(--error); }
  </style>
</head>
<body>
  <h1>🌍 <span class="accent">lingo</span> — YouTube English × 日本語</h1>
  <div class="input-row">
    <input id="url-input" type="text" placeholder="https://www.youtube.com/watch?v=..." autocomplete="off" />
    <button id="load-btn">読み込む</button>
  </div>
  <div id="player-wrap"></div>
  <div id="subtitles">
    <div id="sub-en"></div>
    <div id="sub-ja"></div>
  </div>
  <div id="status"></div>
  <script src="https://www.youtube.com/iframe_api"></script>
  <script>
    // Filled in subsequent tasks.
  </script>
</body>
</html>
```

- [ ] **Step 7.2: Visual check**

Open `lingo.html` directly in a browser (double-click or `file://`). Expected: dark page with title, URL input, button, empty player box, empty subtitle area. No JS errors in console (other than possibly the YouTube IFrame API not finding a target, which is fine — that's added in Task 9).

- [ ] **Step 7.3: Commit**

```bash
git add lingo.html
git commit -m "feat(lingo): add lingo.html skeleton with dark theme"
```

---

## Task 8: Inline pure logic — `extractVideoId` + `findActiveCue` (TDD via the page itself)

The Worker already has `extractVideoId`. Frontend needs the same logic. To keep `lingo.html` zero-build, we duplicate the small function inline. `findActiveCue` is new.

**Files:**
- Modify: `lingo.html` (replace the empty `<script>` block)

- [ ] **Step 8.1: Write the inline test harness first**

Replace the empty `<script>` in `lingo.html` with:

```html
  <script>
    (function () {
      const ID_RE = /^[A-Za-z0-9_-]{11}$/;

      function extractVideoId(input) {
        if (!input) return null;
        const trimmed = input.trim();
        if (ID_RE.test(trimmed)) return trimmed;
        try {
          const u = new URL(trimmed);
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
        } catch (e) {
          return null;
        }
        return null;
      }

      function findActiveCue(cues, t) {
        if (!cues || !cues.length) return null;
        let lo = 0, hi = cues.length - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const c = cues[mid];
          if (t < c.start) hi = mid - 1;
          else if (t >= c.end) lo = mid + 1;
          else return c;
        }
        return null;
      }

      // Self-test in dev console — visible if you open devtools.
      if (window.location.search.includes('selftest=1')) {
        console.assert(extractVideoId('https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ', 'youtu.be');
        console.assert(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ', 'watch');
        console.assert(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ') === 'dQw4w9WgXcQ', 'shorts');
        console.assert(extractVideoId('not-a-url') === null, 'invalid');
        const cues = [{start:0,end:2,en:'a'},{start:2,end:4,en:'b'},{start:5,end:7,en:'c'}];
        console.assert(findActiveCue(cues, 1) && findActiveCue(cues, 1).en === 'a', 'cue@1');
        console.assert(findActiveCue(cues, 3) && findActiveCue(cues, 3).en === 'b', 'cue@3');
        console.assert(findActiveCue(cues, 4.5) === null, 'gap@4.5');
        console.assert(findActiveCue(cues, 6) && findActiveCue(cues, 6).en === 'c', 'cue@6');
        console.log('lingo selftest passed');
      }

      // Expose to next-task code via the IIFE's window assignment below.
      window.__lingo = { extractVideoId, findActiveCue };
    })();
  </script>
```

- [ ] **Step 8.2: Run the self-test**

Open `lingo.html?selftest=1` in a browser. Open DevTools console.
Expected: `lingo selftest passed`. No `console.assert` failures.

- [ ] **Step 8.3: Commit**

```bash
git add lingo.html
git commit -m "feat(lingo): inline extractVideoId + findActiveCue with selftest harness"
```

---

## Task 9: Wire up YouTube IFrame Player + API fetch + polling sync

**Files:**
- Modify: `lingo.html` — append a second `<script>` block after the IIFE.

- [ ] **Step 9.1: Append the player + sync logic**

After the closing `</script>` of the IIFE, add:

```html
  <script>
    const WORKER_URL = 'https://lingo-transcript.REPLACE_ME.workers.dev';
    const { extractVideoId, findActiveCue } = window.__lingo;

    const urlInput = document.getElementById('url-input');
    const loadBtn = document.getElementById('load-btn');
    const playerWrap = document.getElementById('player-wrap');
    const subEn = document.getElementById('sub-en');
    const subJa = document.getElementById('sub-ja');
    const statusEl = document.getElementById('status');

    let player = null;
    let cues = [];
    let pollTimer = null;
    let lastShownAt = 0;
    const GRACE_MS = 500;

    function setStatus(msg, isError = false) {
      statusEl.textContent = msg || '';
      statusEl.classList.toggle('error', !!isError);
    }

    function clearSubtitles() {
      subEn.textContent = '';
      subJa.textContent = '';
    }

    function renderCue(cue) {
      subEn.textContent = cue.en || '';
      subJa.textContent = cue.ja || '';
      lastShownAt = Date.now();
    }

    function startPolling() {
      stopPolling();
      pollTimer = setInterval(() => {
        if (!player || typeof player.getCurrentTime !== 'function') return;
        const t = player.getCurrentTime();
        const c = findActiveCue(cues, t);
        if (c) {
          renderCue(c);
        } else if (Date.now() - lastShownAt > GRACE_MS) {
          clearSubtitles();
        }
      }, 250);
    }

    function stopPolling() {
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    function mountPlayer(videoId) {
      playerWrap.innerHTML = '<div id="player"></div>';
      if (player) { try { player.destroy(); } catch (e) {} player = null; }
      player = new YT.Player('player', {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => startPolling(),
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED || e.data === YT.PlayerState.PAUSED) {
              // keep current cue visible; do nothing
            }
          },
        },
      });
    }

    async function loadVideo() {
      const raw = urlInput.value.trim();
      const videoId = extractVideoId(raw);
      if (!videoId) {
        setStatus('YouTube の URL を確認してください', true);
        return;
      }
      setStatus('字幕を取得中...');
      loadBtn.disabled = true;
      clearSubtitles();
      cues = [];

      try {
        const res = await fetch(`${WORKER_URL}/api/transcript?v=${videoId}`);
        if (res.status === 404) {
          mountPlayer(videoId);
          setStatus('この動画には英字幕がありません', true);
          loadBtn.disabled = false;
          return;
        }
        if (!res.ok) {
          mountPlayer(videoId);
          setStatus('字幕の取得に失敗しました。少し待って再試行してください', true);
          loadBtn.disabled = false;
          return;
        }
        const data = await res.json();
        cues = data.cues || [];
        mountPlayer(videoId);
        setStatus(`${cues.length} cues 読み込み済み`);
      } catch (err) {
        mountPlayer(videoId);
        setStatus('字幕の取得に失敗しました。少し待って再試行してください', true);
      } finally {
        loadBtn.disabled = false;
      }
    }

    loadBtn.addEventListener('click', loadVideo);
    urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadVideo(); });

    // YouTube IFrame API loads asynchronously; if it's already ready, fine.
    window.onYouTubeIframeAPIReady = () => { /* nothing — we create player lazily on loadVideo */ };
  </script>
```

- [ ] **Step 9.2: Visual smoke test against a deployed Worker stub**

You can't test end-to-end until Task 10. For now, manually inspect: open `lingo.html` in a browser, paste a YouTube URL, click 読み込む.

Expected: status reads "字幕を取得中..." then either an error (if `WORKER_URL` is still the `REPLACE_ME` placeholder — that's fine) or successful load. The player frame mounts and starts loading the video either way (we mount the player even on subtitle error).

- [ ] **Step 9.3: Commit**

```bash
git add lingo.html
git commit -m "feat(lingo): wire YouTube IFrame Player + transcript fetch + 250ms cue sync"
```

---

## Task 10: Deploy the Worker and plug its URL into `lingo.html`

This step requires Cloudflare credentials. If running headless without them, stop here and hand off.

- [ ] **Step 10.1: Run the one-time setup from the Worker README**

```
cd _workers/lingo-transcript
npx wrangler login
npx wrangler kv namespace create LINGO_CACHE
```

Copy the printed `id` into `_workers/lingo-transcript/wrangler.toml`, replacing `REPLACE_AFTER_WRANGLER_KV_CREATE`.

- [ ] **Step 10.2: Deploy**

```
npx wrangler deploy
```
Expected: prints `Deployed lingo-transcript … https://lingo-transcript.<your-subdomain>.workers.dev`.

- [ ] **Step 10.3: Verify via curl**

```
curl "https://lingo-transcript.<your-subdomain>.workers.dev/api/transcript?v=jNQXAC9IVRw"
```
Expected: 200 JSON with at least one cue.

Re-run the same curl. Expected: noticeably faster (KV hit).

Curl with a video that has no captions (e.g. an audio-only music video — pick something you know lacks CC):
Expected: 404 with `{"error":"no_captions",...}`.

- [ ] **Step 10.4: Plug the URL into `lingo.html`**

In `lingo.html`, replace `https://lingo-transcript.REPLACE_ME.workers.dev` with the actual deployed URL from Step 10.2.

- [ ] **Step 10.5: Commit the wrangler.toml + lingo.html update**

```bash
cd C:/projects/yuichi916.github.io
git add _workers/lingo-transcript/wrangler.toml lingo.html
git commit -m "feat(lingo): wire deployed Worker URL into lingo.html"
git push
```

---

## Task 11: End-to-end smoke test (the three videos from spec §8)

GitHub Pages typically deploys within ~30 seconds of push.

- [ ] **Step 11.1: Test video 1 — short TED clip with EN captions**

Pick a short TED talk URL. Open `https://yuichi916.github.io/lingo.html` in a real browser. Paste URL. Click 読み込む.

Expected:
- Player loads and starts playing (or pauses at intro).
- Within ~2s, status shows `N cues 読み込み済み`.
- As video plays, EN top + JA bottom update in sync (within ~250ms of lip movement).

- [ ] **Step 11.2: Test video 2 — medium podcast with auto-CC**

Pick a ~10min YouTube interview/podcast. Paste, load.
Expected: Same behavior. Cue count > 100.

- [ ] **Step 11.3: Test video 3 — music video with NO captions**

Pick a vocal music video (most don't have CC, e.g. a Japanese song video).
Expected: Player loads (you can still watch), status reads "この動画には英字幕がありません" in red.

- [ ] **Step 11.4: Test KV cache**

Reload the page. Paste the same URL from Step 11.1 again.
Expected: Status reaches `N cues 読み込み済み` within ~300ms (vs. several seconds first time). Open DevTools Network tab to confirm the fetch returns quickly.

- [ ] **Step 11.5: Test CORS rejection (informational)**

Open `lingo.html` from `file://` or `http://localhost:8000`. Paste a URL, click 読み込む.
Expected: fetch fails with CORS error in console; status shows the "字幕の取得に失敗しました" message. This proves the Worker only serves `yuichi916.github.io`.

If any of the above fail, debug before continuing. Do NOT mark this task complete based on intent.

- [ ] **Step 11.6: Final commit (if any tweaks were needed during smoke)**

```bash
git status
# if dirty:
git add -A
git commit -m "fix(lingo): smoke-test adjustments"
git push
```

---

## Self-Review

**Spec coverage:**
- §2 In scope (single page, paste URL, EN+JA synced, cues JSON API, polling, empty/error states, CORS, KV) — covered by Tasks 5, 7, 8, 9.
- §3 Architecture (frontend / Worker / KV table) — Tasks 1, 5, 7.
- §3.2 Data flow (KV-first, fetch, translate, cache, return) — Task 5.
- §3.3 API contract (200/404/502, CORS) — Task 5.
- §4 Layout (dark, single cue, no upcoming preview) — Task 7.
- §5 Error states (bad URL, no captions, network, per-cue failure, player error) — Tasks 5 + 9.
- §5 Grace period (≤500ms keep previous cue) — Task 9 (`GRACE_MS = 500`).
- §6 Caching (30d TTL, `?refresh=1`) — Task 5.
- §7 Deployment (commit page, wrangler deploy, KV namespace) — Tasks 6, 10.
- §8 Testing (3 manual videos, KV hit, CORS rejection) — Task 11.
- §10 File layout — matches Tasks 1, 5, 7.
- §11 Done criteria — all 5 covered by Task 11 and prior commits.

**Placeholder scan:** `REPLACE_ME` in lingo.html and `REPLACE_AFTER_WRANGLER_KV_CREATE` in wrangler.toml are **intentional, named placeholders** filled in Task 10.4 and 10.1 respectively. No "TBD", "TODO", or "fill in later" elsewhere.

**Type consistency:**
- `extractVideoId(input) -> string|null` — same signature in Worker (Task 2) and frontend (Task 8).
- Cue shape `{start, end, en, ja}` — produced in Task 5, consumed by `findActiveCue` in Task 8 / render in Task 9. Consistent.
- `findActiveCue(cues, t) -> cue|null` — defined Task 8, called Task 9. Consistent.
- API response shape — defined Task 5, consumed Task 9: `{videoId, lang, cues, cachedAt}`. Consistent.

All checks pass.
