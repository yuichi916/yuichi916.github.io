import { readFile } from "node:fs/promises";

const base = "/home/ubuntu/hitori-source/data/hitori";
const id = "manual-tokyo-sava-ikejiri-20260813";
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
if (!entry || entry.checked !== "2026-08-15" || entry.facts.length !== 6 || entry.sources.length !== 5) throw new Error("確認済み根拠、確認日、または情報源数が不正です。");
if (row[15] || row[16]) throw new Error("公式未確認の営業時間または電話番号が静的行へ推測登録されています。");
if (!entry.facts.some(fact => fact.k === "private_room" && fact.official && /一人利用個別明示は確認できない/.test(fact.v))) throw new Error("一人利用の要確認方針が記録されていません。");
if (!entry.facts.some(fact => fact.k === "silence" && !fact.official && /要確認/.test(fact.v))) throw new Error("会話環境の要確認方針が記録されていません。");
console.log(JSON.stringify({ id, rowLength: row.length, factCount: entry.facts.length, sourceCount: entry.sources.length, total: summary.total, checkedCount: summary.checked_count }, null, 2));
