import fs from "node:fs/promises";
import path from "node:path";

const root = "/home/ubuntu/hitori-source/data/hitori";
const id = "manual-kanagawa-wairoom-spa-tsurumi-20260813";
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
if (row[1] !== "ワイルームSpa横浜鶴見店" || row[2] !== 35.505719 || row[3] !== 139.6774788 || row[4] !== "bath" || row[7] !== 4) throw new Error("名称・座標・業態・静けさスコアが想定と異なります。");
const entry = curated[id];
if (!entry || entry.checked !== "2026-08-13" || entry.facts?.length !== 7 || !entry.facts.every(fact => fact.official && !fact.conflict)) throw new Error("確認済み根拠の内容が想定と異なります。");
const solo = entry.facts.find(fact => fact.k === "solo_ok")?.v || "";
const privateFact = entry.facts.find(fact => fact.k === "silence")?.v || "";
if (!/1名/.test(solo) || !/話し声もなし/.test(privateFact)) throw new Error("一人利用・会話環境の公式根拠が不足しています。");
if (summary.total !== 40576 || summary.checked_count !== 758) throw new Error(`集計値が想定と異なります: ${summary.total}/${summary.checked_count}`);
console.log(JSON.stringify({ status: "ok", id, total: summary.total, checkedCount: summary.checked_count, factCount: entry.facts.length, row }, null, 2));
