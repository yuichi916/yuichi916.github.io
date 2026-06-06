# lingo.html — Dual-Language Subtitle Viewer (LingosTube-style, minimal)

- **Status**: Approved (2026-06-07)
- **Repo**: `yuichi916.github.io`
- **Page**: `https://yuichi916.github.io/lingo.html`
- **API**: Cloudflare Workers (new), source under `_workers/lingo-transcript.js`

## 1. Goal

Paste a YouTube URL into a single static page, and watch the video with **English subtitles on top + Japanese translation on the bottom**, synced to the player's `currentTime`. No bake-in, no server rendering, no account, no installation.

The reference is LingosTube, but the subtitle UX is deliberately **simpler**: only the currently-active cue is shown, no per-word hover dictionary, no AB-repeat, no speed control (rely on YouTube's native controls).

## 2. Scope

### In scope (MVP)
- Single static HTML page on GitHub Pages.
- YouTube URL input → extract `videoId` → load YouTube IFrame Player.
- Cloudflare Workers endpoint that returns `[{start, end, en, ja}, ...]` for a given `videoId`.
- Subtitle overlay below the player: EN (large, white) above JP (smaller, dim).
- Polling-based sync: every ~250ms, look up the cue containing `currentTime` and render it.
- Graceful empty/error states (no English captions / API failure / translation failure).
- CORS + KV cache so the same `videoId` doesn't re-translate.

### Out of scope (deferred)
- Click-to-seek on a subtitle line.
- AB-repeat / loop / speed slider.
- Per-word hover dictionary.
- Subtitle download / edit.
- Favorites / history / login.
- Languages other than English source → Japanese target.
- Auto-generated (ASR) caption fallback when no `en` track exists.

## 3. Architecture

### 3.1 Components

| Component | Path | Responsibility |
|---|---|---|
| Frontend page | `lingo.html` | URL input, YouTube IFrame Player, subtitle overlay, polling sync |
| Workers API | `_workers/lingo-transcript.js` (deploy → `lingo-sub.<account>.workers.dev`) | Fetch EN cues, translate to JA, cache in KV, return JSON |
| KV namespace | `LINGO_CACHE` | Key: `v:<videoId>`, Value: cues JSON, TTL: 30 days |

### 3.2 Data flow

```
[lingo.html]
  user pastes URL
   │
   ├─ extract videoId from URL
   ├─ fetch(`${WORKERS_URL}/api/transcript?v=<videoId>`)
   │
   ▼
[Workers API]
   │
   ├─ KV.get("v:<videoId>")
   │    ├─ hit  → return cached cues JSON
   │    └─ miss → continue
   │
   ├─ youtube-transcript: getTranscript(videoId, {lang:'en'})
   │    └─ returns [{text, offset(ms), duration(ms)}, ...]
   │
   ├─ translate each cue text → ja
   │    using @vitalets/google-translate-api (or fetch wrapper compatible with Workers)
   │    chunked: 40 cues per upstream call, max 3 chunks in flight (≈120 cues/batch)
   │
   ├─ build cues JSON: [{start, end, en, ja}, ...]
   ├─ KV.put("v:<videoId>", cuesJson, {expirationTtl: 30 days})
   └─ return cues JSON with CORS headers
   │
   ▼
[lingo.html]
   │
   ├─ render YouTube IFrame Player (same videoId, autoplay off)
   ├─ store cues in memory, sorted by start
   ├─ setInterval(250ms): currentTime = player.getCurrentTime()
   │   activeCue = cues.find(c => start ≤ currentTime < end)
   │   render activeCue.en above, activeCue.ja below
   └─ on URL change → unload player → reload with new videoId
```

### 3.3 API contract

```
GET https://lingo-sub.<account>.workers.dev/api/transcript?v=<videoId>

Response 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: https://yuichi916.github.io

{
  "videoId": "abc123",
  "lang": { "from": "en", "to": "ja" },
  "cues": [
    { "start": 0.0, "end": 3.42, "en": "Hello, world.", "ja": "こんにちは、世界。" },
    { "start": 3.42, "end": 6.10, "en": "...", "ja": "..." }
  ],
  "cachedAt": 1717689600
}

Response 404 — no English captions available
Response 502 — upstream failure (transcript fetch or translate)
```

`start`/`end` are seconds (float). The frontend treats `[start, end)` as the active window.

## 4. Frontend layout (lingo.html)

```
┌──────────────────────────────────────────────┐
│  🌍 lingo — YouTube English × 日本語          │
│  ┌──────────────────────────────────────┐    │
│  │ Paste YouTube URL...        [読み込む]│    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │                                      │    │
│  │        YouTube IFrame Player         │    │
│  │           (16:9, max 960px)          │    │
│  │                                      │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ENGLISH CUE (white, 28px, bold)             │
│  日本語の訳 (#bbb, 20px)                       │
│                                              │
└──────────────────────────────────────────────┘
```

- Page is dark theme to match the rest of `yuichi916.github.io`.
- Only the **current** cue is shown — no upcoming-line preview, no scrollable list.
- When no cue is active (between cues, intro, end), the subtitle area is empty (do not blank-flicker — keep the previous cue visible for ≤ 500ms grace).

## 5. Error / empty states

| Condition | Behavior |
|---|---|
| URL doesn't contain a parseable `videoId` | Inline error: "YouTube の URL を確認してください" |
| API returns 404 (no English captions) | "この動画には英字幕がありません" (player still loads so user can watch) |
| API returns 502 / network error | "字幕の取得に失敗しました。少し待って再試行してください" |
| Per-cue translation fails | Cue is included with `ja: ""` — frontend shows EN only for that cue |
| Player fails to load | Standard YouTube iframe error UI |

## 6. Caching

- **KV cache**: `expirationTtl: 60 * 60 * 24 * 30` (30 days).
- **Cache key**: `v:<videoId>` (no language suffix — only en→ja is supported in MVP).
- **Bypass**: `?refresh=1` query param skips KV read but still writes the new value.

## 7. Deployment

- Frontend: commit `lingo.html` to `yuichi916.github.io` `main`. GitHub Pages auto-deploys.
- Worker: `wrangler deploy _workers/lingo-transcript.js` (separate one-time setup, similar to existing `pcloud-cors-proxy.js`).
- KV namespace: create `LINGO_CACHE` once via `wrangler kv namespace create LINGO_CACHE` and bind in `wrangler.toml`.

## 8. Testing strategy

- **Manual smoke**: 3 YouTube URLs with known English captions:
  1. A short (<1 min) TED clip
  2. A medium (~10 min) podcast with auto-CC
  3. A music video with **no** captions → 404 path
- Verify: subtitle sync visually matches lip movement within ~250ms.
- Verify: refresh same URL → second load reads from KV (check Worker logs).
- Verify: CORS — `lingo.html` on `localhost:8000` should be **rejected**, only `https://yuichi916.github.io` allowed (so the cache isn't burned by dev work).
- No automated tests for MVP (single-page, manual verification sufficient).

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| YouTube blocks `youtube-transcript` IP-range from Cloudflare PoPs | Fall back to `timedtext` direct fetch with a rotating UA; document in `_workers/README` |
| `@vitalets/google-translate-api` rate-limited / blocked | Batch up to 50 cues per HTTP call; if blocked, switch to DeepL Free (requires key, deferred) |
| Polling at 250ms causes jank on low-end mobile | If measurable, switch to `requestAnimationFrame` and throttle internally |
| Cue boundaries from YouTube don't align with natural sentences | Acceptable for MVP — out of scope to re-segment |

## 10. File layout

```
yuichi916.github.io/
├── lingo.html                       ← new
├── _workers/
│   ├── pcloud-cors-proxy.js
│   └── lingo-transcript.js          ← new
└── docs/superpowers/specs/
    └── 2026-06-07-lingo-dual-subtitles-design.md   ← this file
```

## 11. Done criteria

1. `https://yuichi916.github.io/lingo.html` loads and accepts a YouTube URL.
2. Pasting a URL with English captions shows EN top + JA bottom, synced.
3. Same URL on second load returns within ~300ms (KV hit).
4. Three error states above behave as specified.
5. Spec + page + Worker source are committed to `yuichi916.github.io` main.
