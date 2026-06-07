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

## Unit tests

```bash
npm test
```

Runs `vitest` on the pure helpers in `src/util.js`.
