import { readFile } from "node:fs/promises";

const base = "/home/ubuntu/hitori-source/data/hitori";
const id = "manual-tokyo-hubhub-shimokitazawa-20260813";
const [prefText, curatedText, summaryText] = await Promise.all([
  readFile(`${base}/pref/13.json`, "utf8"),
  readFile(`${base}/curated.json`, "utf8"),
  readFile(`${base}/summary.json`, "utf8"),
]);
const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const summary = JSON.parse(summaryText);
const row = pref.items.find(item => item[0] === id);
const entry = curated[id];
if (!row || row.length !== 23) throw new Error("静的施設行が見つからないか、列数が不正です。");
if (!entry || entry.checked !== "2026-08-13" || entry.facts.length !== 7 || entry.sources.length !== 2) throw new Error("確認済み根拠、確認日、または情報源数が不正です。");
if (!entry.facts.some(fact => fact.k === "solo_ok" && fact.official && /おひとり様も大歓迎/.test(fact.v))) throw new Error("公式一人利用根拠が記録されていません。");
if (!entry.facts.some(fact => fact.k === "silence" && fact.official && /会話可能/.test(fact.v))) throw new Error("公式会話方針が記録されていません。");
if (summary.total !== 40585 || summary.checked_count !== 770) throw new Error(`集計が不正です: total=${summary.total}, checked=${summary.checked_count}`);
console.log(JSON.stringify({ id, rowLength: row.length, factCount: entry.facts.length, sourceCount: entry.sources.length, total: summary.total, checkedCount: summary.checked_count }, null, 2));
