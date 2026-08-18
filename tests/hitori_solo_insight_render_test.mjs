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
assert.equal(typeof insightFact.v, "object", "インポーターは構造化済みの分析をオブジェクトとして保持する");
assert.equal(insightFact.v.quality, "grounded");
assert.equal(insightFact.v.policyVersion, "official-provenance-v2");
assert.match(insightFact.v.title, /完全個室で24時間/);
assert.match(insightFact.v.insight, /予約の5分前/);

assert.match(html, /const rawInsight = storedInsightFact\?\.v;/, "文字列とオブジェクトの両形式を受け付ける");
assert.match(html, /typeof rawInsight === "string" \? JSON\.parse\(rawInsight\) : rawInsight/, "オブジェクト形式を再パースせずに扱う");
assert.match(html, /candidate\.quality === "grounded"/, "品質ゲート済みだけを表示する");
assert.match(html, /candidate\.policyVersion === "official-provenance-v2"/, "現行の公式根拠ポリシーだけを表示する");
assert.match(html, /公式根拠付き・施設別分析/, "固有分析を汎用分析より優先して表示する");
assert.match(html, /facts=\(c\?\.facts\|\|\[\]\)\.filter\(f=>f\.k!=="solo_insight"\)\.slice\(0,8\)/, "構造化済みの固有ひとり情報を通常の事実一覧から除外する");

console.log("OK: static official solo insight rendering");
