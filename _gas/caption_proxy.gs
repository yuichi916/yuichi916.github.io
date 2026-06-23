/**
 * lingo — YouTube caption-track proxy (Google Apps Script)  v2
 * ------------------------------------------------------------
 * Returns the caption TRACK LIST (signed baseUrls). The browser then fetches the
 * caption text directly from timedtext (CORS-enabled, user's own IP).
 *
 * v2: tries the watch page first (most reliable), then innertube ANDROID + WEB,
 *     with a retry — to get captions for far more videos from Google's IP.
 *
 * ── UPDATE an already-deployed web app (keeps the SAME /exec URL) ─────────────
 * 1. Paste this whole file over the old code → Save (disk icon)
 * 2. Deploy ▾ → Manage deployments → (pencil ✏ Edit) →
 *    Version: "New version" → Deploy
 * 3. The /exec URL stays the same. (If unsure, just "New deployment" → send me
 *    the new URL.)
 */

var BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
var INNERTUBE = [
  { ua: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip',
    ctx: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 34, hl: 'en', gl: 'US' } } },
  { ua: BROWSER_UA, headers: { 'X-YouTube-Client-Name': '1', 'X-YouTube-Client-Version': '2.20240502.00.00' },
    ctx: { client: { clientName: 'WEB', clientVersion: '2.20240502.00.00', hl: 'en', gl: 'US' } } }
];

function doGet(e) {
  var v = (e && e.parameter && e.parameter.v ? e.parameter.v : '').trim();
  var cb = e && e.parameter && e.parameter.callback;
  var out;
  if (!/^[A-Za-z0-9_-]{11}$/.test(v)) {
    out = { error: 'bad_video_id' };
  } else {
    try { out = { videoId: v, tracks: getTracks(v) }; }
    catch (err) { out = { error: String(err) }; }
  }
  var body = JSON.stringify(out);
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + body + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function getTracks(videoId) {
  for (var attempt = 0; attempt < 2; attempt++) {
    try { var w = viaWatchPage(videoId); if (w.length) return w; } catch (e) {}
    for (var i = 0; i < INNERTUBE.length; i++) {
      try { var t = viaInnertube(videoId, INNERTUBE[i]); if (t.length) return t; } catch (e2) {}
    }
    Utilities.sleep(800);
  }
  return [];
}

function viaWatchPage(videoId) {
  var res = UrlFetchApp.fetch('https://www.youtube.com/watch?v=' + videoId + '&hl=en&gl=US', {
    headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9', 'Cookie': 'SOCS=CAI; CONSENT=YES+; PREF=hl=en&gl=US' },
    muteHttpExceptions: true, followRedirects: true
  });
  if (res.getResponseCode() !== 200) return [];
  return mapTracks(extractJson(res.getContentText(), 'ytInitialPlayerResponse'));
}

function viaInnertube(videoId, c) {
  var headers = { 'User-Agent': c.ua };
  if (c.headers) for (var k in c.headers) headers[k] = c.headers[k];
  var res = UrlFetchApp.fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'post', contentType: 'application/json', headers: headers,
    payload: JSON.stringify({ context: c.ctx, videoId: videoId }),
    muteHttpExceptions: true, followRedirects: true
  });
  if (res.getResponseCode() !== 200) return [];
  var data; try { data = JSON.parse(res.getContentText()); } catch (e) { return []; }
  return mapTracks(data);
}

function mapTracks(pr) {
  var r = pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer;
  var tracks = r && r.captionTracks;
  if (!tracks || !tracks.length) return [];
  return tracks.map(function (t) {
    return {
      lang: t.languageCode || '',
      kind: t.kind || '',
      name: (t.name && (t.name.simpleText || (t.name.runs && t.name.runs[0] && t.name.runs[0].text))) || '',
      baseUrl: t.baseUrl
    };
  });
}

function extractJson(html, key) {
  var tok = 'var ' + key + ' = ';
  var i = html.indexOf(tok);
  if (i < 0) { i = html.indexOf('"' + key + '":'); if (i < 0) return null; i = html.indexOf('{', i); }
  else { i += tok.length; }
  if (i < 0) return null;
  var depth = 0;
  for (var j = i; j < html.length; j++) {
    var ch = html.charAt(j);
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(html.slice(i, j + 1)); } catch (e) { return null; } } }
  }
  return null;
}
