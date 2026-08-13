import fs from "node:fs/promises";
import path from "node:path";

const root = "/home/ubuntu/hitori-source/data/hitori";
const id = "manual-kanagawa-rembrandt-style-yokohama-kannai-20260813";
const [prefRaw, curatedRaw, summaryRaw] = await Promise.all([
  fs.readFile(path.join(root, "pref/14.json"), "utf8"),
  fs.readFile(path.join(root, "curated.json"), "utf8"),
  fs.readFile(path.join(root, "summary.json"), "utf8"),
]);
const pref = JSON.parse(prefRaw);
const curated = JSON.parse(curatedRaw);
const summary = JSON.parse(summaryRaw);
const rows = pref.items.filter(item => item[0] === id);
if (rows.length !== 1) throw new Error(`施設IDの件数が不正です: ${rows.length}`);
const row = rows[0];
if (row.length !== 23) throw new Error(`静的施設配列が23列ではありません: ${row.length}`);
if (row[1] !== "レンブラントスタイル横浜関内 プライベートサウナルーム" || row[2] !== 35.442224 || row[3] !== 139.637189 || row[4] !== "bath") throw new Error("名称・座標・業態が想定と異なります。");
const entry = curated[id];
if (!entry || entry.checked !== "2026-08-13" || entry.facts?.length !== 7 || !entry.facts.every(fact => fact.official && !fact.conflict)) throw new Error("確認済み根拠の内容が想定と異なります。");
const price = entry.facts.find(fact => fact.k === "price")?.v || "";
const conditions = entry.facts.find(fact => fact.k === "conditions")?.v || "";
if (!/2,480円/.test(price) || !/休憩室料/.test(price) || !/18歳未満/.test(conditions)) throw new Error("料金・利用条件の公式根拠が不足しています。");
if (summary.total !== 40578 || summary.checked_count !== 760) throw new Error(`集計値が想定と異なります: ${summary.total}/${summary.checked_count}`);
console.log(JSON.stringify({ status: "ok", id, total: summary.total, checkedCount: summary.checked_count, factCount: entry.facts.length, row }, null, 2));
