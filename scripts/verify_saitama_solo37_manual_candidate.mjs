import fs from "node:fs/promises";
import path from "node:path";

const root = "/home/ubuntu/hitori-source/data/hitori";
const id = "manual-saitama-solo37-20260813";
const homeUrl = "https://solo37.com/";
const [prefText, curatedText, summaryText, pageText] = await Promise.all([
  fs.readFile(path.join(root, "pref/11.json"), "utf8"),
  fs.readFile(path.join(root, "curated.json"), "utf8"),
  fs.readFile(path.join(root, "summary.json"), "utf8"),
  fs.readFile("/home/ubuntu/hitori-source/hitori.html", "utf8"),
]);
const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const summary = JSON.parse(summaryText);
const rows = pref.items.filter(row => row[0] === id);
if (rows.length !== 1) throw new Error(`埼玉県データの対象件数が不正です: ${rows.length}`);
const row = rows[0];
if (row.length !== 23 || row[1] !== "SOLO37" || row[2] !== 35.8032019 || row[3] !== 139.7190165 || row[4] !== "bath" || row[5] !== "private_sauna" || row[10] !== 0 || row[14] !== "川口市" || row[15] !== "10:00-24:00" || row[22] !== "2026-08-13") {
  throw new Error("静的施設配列のSOLO37登録値が不正です。");
}
const entry = curated[id];
if (!entry || entry.checked !== "2026-08-13" || entry.facts?.length !== 5) throw new Error("確認済み情報が不正です。");
const expectedKeys = ["conditions", "hours", "price", "reservation", "solo_ok"];
if (entry.facts.map(fact => fact.k).sort().join(",") !== expectedKeys.join(",")) throw new Error("確認済み情報の種類が不正です。");
if (!entry.facts.every(fact => fact.official && fact.urls?.includes(homeUrl))) throw new Error("公式根拠URLが不正です。");
if (!pageText.includes('conditions:"利用条件"')) throw new Error("利用条件ラベルの日本語表示が不正です。");
if (summary.total !== 40571 || summary.checked_count !== Object.keys(curated).length || summary.checked_count < 753) {
  throw new Error("全国集計が不正です。");
}
console.log(JSON.stringify({ status: "ok", id, total: summary.total, checkedCount: summary.checked_count }, null, 2));
