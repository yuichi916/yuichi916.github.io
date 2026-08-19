import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, curatedText] = await Promise.all([
  readFile(new URL("../hitori.html", import.meta.url), "utf8"),
  readFile(new URL("../data/hitori/curated.json", import.meta.url), "utf8"),
]);

const curated = JSON.parse(curatedText);
const record = curated["manual-tokyo-kudochi-roppongi-20260819"];
const insightFact = record?.facts?.find(fact => fact.k === "solo_insight");

assert.ok(insightFact, "KUDOCHI sauna 六本木店のsolo_insightが静的データに存在する");
assert.equal(typeof insightFact.v, "object", "構造化済みの施設別分析を保持する");
assert.equal(insightFact.v.quality, "grounded");
assert.equal(insightFact.v.policyVersion, "official-provenance-v2");
assert.match(insightFact.v.title, /完全個室|水風呂/, "施設固有の設備を見出しに含める");
assert.match(insightFact.v.insight, /予約時間の5分前|5分前/, "公式の入室時刻条件を本文に反映する");
assert.ok(Array.isArray(insightFact.v.anchors) && insightFact.v.anchors.length >= 2, "公式事実に追跡可能なアンカーを複数持つ");

assert.match(html, /const MANUS_ORIGIN = "https:\/\/hitorimap-nc8t8eqr\.manus\.space";/, "Manus公開版を唯一の表示ソースにする");
assert.match(html, /const facilityId = params\.get\("facility"\) \|\| params\.get\("externalId"\);/, "既存の施設共有URLをManus詳細URLへ引き継ぐ");
assert.match(html, /target\.pathname = `\/facilities\/\$\{encodeURIComponent\(facilityId\)\}`;/, "施設詳細はManus版の同じルートを表示する");
assert.match(html, /const query = params\.get\("q"\) \|\| params\.get\("query"\);/, "検索語をManus版へ引き継ぐ");
assert.match(html, /window\.location\.replace\(destination\);/, "GitHub PagesはManus正規URLへ直接引き継ぐ");
assert.match(html, /id="manus-link"/, "自動遷移できない環境にもManus正規URLへの導線を表示する");
assert.doesNotMatch(html, /<iframe/, "空白になり得るクロスオリジンiframeを使わない");
assert.doesNotMatch(html, /leaflet@1\.9\.4/, "GitHub Pages側で別の地図・別の表示文言を実装しない");

console.log("OK: GitHub Pages mirrors Manus official solo insight rendering");
