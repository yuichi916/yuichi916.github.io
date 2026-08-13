import { readFile } from "node:fs/promises";

const base = "/home/ubuntu/hitori-source/data/hitori";
const id = "manual-kanagawa-saunabal-people-people-aobadai-20260813";
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
if (!row || row.length !== 23) throw new Error("Saunabal People×Peopleの静的施設行が見つからないか、列数が不正です。");
if (!entry || entry.checked !== "2026-08-13" || entry.facts.length !== 7) throw new Error("確認済み根拠または確認日が不正です。");
if (!entry.facts.some(fact => fact.k === "solo_ok" && fact.official)) throw new Error("公式の一人予約根拠がありません。");
if (!entry.facts.some(fact => fact.k === "silence" && !fact.official && /要確認/.test(fact.v))) throw new Error("会話環境の要確認根拠がありません。");
if (summary.total !== 40582 || summary.checked_count !== 767) throw new Error(`集計が不正です: total=${summary.total}, checked=${summary.checked_count}`);
console.log(JSON.stringify({ id, rowLength: row.length, factCount: entry.facts.length, total: summary.total, checkedCount: summary.checked_count }, null, 2));
