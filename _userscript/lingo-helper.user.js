// ==UserScript==
// @name         lingo caption helper
// @namespace    https://yuichi916.github.io/
// @version      1.0
// @description  Fetch YouTube caption tracks from YOUR own (residential) IP so lingo can show subtitles for any video. YouTube blocks server/datacenter IPs; your browser is not blocked — and GM_xmlhttpRequest bypasses CORS.
// @author       yuichi916
// @match        https://yuichi916.github.io/lingo.html*
// @grant        GM_xmlhttpRequest
// @connect      www.youtube.com
// @connect      youtube.com
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // Tell the lingo page the helper is installed (synchronous, race-free).
  try { document.documentElement.setAttribute('data-lingo-helper', '1'); } catch (e) {}

  function gmGet(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': 'SOCS=CAI; CONSENT=YES+; PREF=hl=en&gl=US'
        },
        timeout: 20000,
        onload: (r) => resolve(r.responseText || ''),
        onerror: () => reject(new Error('net')),
        ontimeout: () => reject(new Error('timeout'))
      });
    });
  }

  function extractJson(html, key) {
    let i = html.indexOf('var ' + key + ' = ');
    if (i < 0) { i = html.indexOf('"' + key + '":'); if (i < 0) return null; i = html.indexOf('{', i); }
    else { i += ('var ' + key + ' = ').length; }
    if (i < 0) return null;
    let depth = 0;
    for (let j = i; j < html.length; j++) {
      const ch = html[j];
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(html.slice(i, j + 1)); } catch (e) { return null; } } }
    }
    return null;
  }

  async function getTracks(videoId) {
    const html = await gmGet('https://www.youtube.com/watch?v=' + videoId + '&hl=en&gl=US');
    const pr = extractJson(html, 'ytInitialPlayerResponse');
    const r = pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer;
    const tracks = (r && r.captionTracks) || [];
    return tracks.map((t) => ({ lang: t.languageCode || '', kind: t.kind || '', baseUrl: t.baseUrl }));
  }

  window.addEventListener('message', async (e) => {
    const d = e.data;
    if (!d || d.type !== 'lingo-helper-req' || !d.videoId) return;
    try {
      const tracks = await getTracks(d.videoId);
      window.postMessage({ type: 'lingo-helper-res', reqId: d.reqId, tracks: tracks }, '*');
    } catch (err) {
      window.postMessage({ type: 'lingo-helper-res', reqId: d.reqId, error: String(err && err.message || err) }, '*');
    }
  });
})();
