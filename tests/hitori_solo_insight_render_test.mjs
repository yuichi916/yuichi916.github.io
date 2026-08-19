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
assert.match(insightFact.v.title, /完全個室で24時間/);
assert.match(insightFact.v.insight, /予約の5分前/);

assert.match(html, /const MANUS_ORIGIN = "https:\/\/hitorimap-nc8t8eqr\.manus\.space";/, "Manus公開版を唯一の表示ソースにする");
assert.match(html, /const facilityId = params\.get\("facility"\) \|\| params\.get\("externalId"\);/, "既存の施設共有URLをManus詳細URLへ引き継ぐ");
assert.match(html, /target\.pathname = `\/facilities\/\$\{encodeURIComponent\(facilityId\)\}`;/, "施設詳細はManus版の同じルートを表示する");
assert.match(html, /const query = params\.get\("q"\) \|\| params\.get\("query"\);/, "検索語をManus版へ引き継ぐ");
assert.match(html, /frame\.src = target\.toString\(\);/, "GitHub PagesはManus版を直接表示する");
assert.match(html, /height: 100dvh/, "余白を作らずManus画面を全画面表示する");
assert.doesNotMatch(html, /leaflet@1\.9\.4/, "GitHub Pages側で別の地図・別の表示文言を実装しない");

console.log("OK: GitHub Pages mirrors Manus official solo insight rendering");
