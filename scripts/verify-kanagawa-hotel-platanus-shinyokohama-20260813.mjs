import { readFile } from "node:fs/promises";

const base = "/home/ubuntu/hitori-source/data/hitori";
const id = "manual-kanagawa-hotel-platanus-shinyokohama-20260813";
const [prefText, curatedText, summaryText] = await Promise.all([
  readFile(`${base}/pref/14.json`, "utf8"),
  readFile(`${base}/curated.json`, "utf8"),
  readFile(`${base}/summary.json`, "utf8"),
]);
const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const summary = JSON.parse(summaryText);
const row = pref.items.find(item => item[0] === id);
const entry = curated[id];
if (!row || row.length !== 23) throw new Error("静的施設行が見つからないか、列数が不正です。");
if (!entry || entry.checked !== "2026-08-13" || entry.facts.length !== 6 || entry.sources.length !== 4) throw new Error("確認済み根拠、確認日、または情報源数が不正です。");
if (!entry.facts.some(fact => fact.k === "conditions" && fact.official && /一人利用個別明示は確認できない/.test(fact.v))) throw new Error("一人利用の要確認方針が記録されていません。");
if (!entry.facts.some(fact => fact.k === "silence" && !fact.official && /要確認/.test(fact.v))) throw new Error("会話環境の要確認方針が記録されていません。");
if (summary.total !== 40584 || summary.checked_count !== 769) throw new Error(`集計が不正です: total=${summary.total}, checked=${summary.checked_count}`);
console.log(JSON.stringify({ id, rowLength: row.length, factCount: entry.facts.length, sourceCount: entry.sources.length, total: summary.total, checkedCount: summary.checked_count }, null, 2));
