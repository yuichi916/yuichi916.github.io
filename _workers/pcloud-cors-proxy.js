/**
 * Cloudflare Worker — pCloud CORS proxy for niwa.html
 *
 * Why this exists:
 *   pCloud CDN (ptok2.pcloud.com) refuses Access-Control-Allow-Origin for
 *   non-pcloud origins, blocking browser fetch of GLB files from
 *   yuichi916.github.io. <img> tags bypass CORS (hitoritabi works that way),
 *   but three.js GLTFLoader uses fetch() and needs CORS-friendly responses.
 *
 * What it does:
 *   1. Browser calls https://<worker-name>.<account>.workers.dev/g/<fileid>
 *   2. Worker calls pCloud REST: getpublinkdownload to obtain a fresh
 *      4-hour CDN URL (signed with Referer: https://www.pcloud.com so pCloud
 *      accepts it).
 *   3. Worker fetches the GLB bytes from the CDN.
 *   4. Worker re-serves the bytes with Access-Control-Allow-Origin: *.
 *
 * Deploy steps:
 *   1. Open https://workers.cloudflare.com → Sign up (free).
 *   2. Dashboard → Workers & Pages → Create Worker → name it "niwa-cors".
 *   3. Click Edit Code, paste ALL of this file's contents.
 *   4. Click Save and Deploy.
 *   5. Copy the URL ("niwa-cors.<your-subdomain>.workers.dev")
 *      and paste it into niwa.html's PCLOUD_PROXY constant.
 *
 * Free-tier limits: 100k requests/day, 10ms CPU per request — plenty for niwa.
 */

const PUBLINK_CODE = 'kZqt6O5Z4gUlPEmDoLyJhwfgiE5ztFhhp9Fk';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    // Route: /g/<fileid>  → fetch the GLB by pCloud fileid
    const match = url.pathname.match(/^\/g\/(\d+)/);
    if (!match) {
      return new Response('Usage: /g/<pcloud-fileid>', { status: 400 });
    }
    const fileid = match[1];

    // 1) Get a fresh signed CDN URL from pCloud REST.
    //    Set Referer: https://www.pcloud.com so pCloud accepts the call.
    const dlRes = await fetch(
      `https://api.pcloud.com/getpublinkdownload?code=${PUBLINK_CODE}&fileid=${fileid}&download=1`,
      { headers: { 'Referer': 'https://www.pcloud.com/' } }
    );
    const dl = await dlRes.json();
    if (dl.result !== 0 || !dl.hosts || !dl.hosts.length) {
      return new Response(JSON.stringify(dl), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    const cdn = `https://${dl.hosts[0]}${dl.path}`;

    // 2) Fetch the GLB from the CDN. Range requests passed through.
    const upstreamHeaders = {};
    const range = request.headers.get('Range');
    if (range) upstreamHeaders['Range'] = range;
    const fileRes = await fetch(cdn, { headers: upstreamHeaders });

    // 3) Re-serve with permissive CORS headers.
    const outHeaders = new Headers(fileRes.headers);
    outHeaders.set('Access-Control-Allow-Origin', '*');
    outHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
    outHeaders.set('Cache-Control', 'public, max-age=3600');
    outHeaders.delete('Set-Cookie');

    return new Response(fileRes.body, {
      status: fileRes.status,
      statusText: fileRes.statusText,
      headers: outHeaders,
    });
  }
};
