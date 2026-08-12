import fs from "node:fs/promises";
import path from "node:path";

const filePath = "/home/ubuntu/hitori-source/data/hitori/pref/40.json";
const id = "manual-fukuoka-sauna-ooo-fukuoka-20260813";
const payload = JSON.parse(await fs.readFile(filePath, "utf8"));
const row = payload.items.find(item => item[0] === id);
if (!row) throw new Error(`対象施設が見つかりません: ${id}`);
if (row.length === 23 && row[14] === "福岡市" && row[22] === "2026-08-13") {
  console.log(JSON.stringify({ status: "already-correct", id }, null, 2));
  process.exit(0);
}
if (row.length !== 24 || row[14] !== 0 || row[15] !== "福岡市" || row[23] !== "2026-08-13") {
  throw new Error(`想定外の静的配列形式です: ${JSON.stringify(row)}`);
}
row.splice(14, 1);
await fs.writeFile(filePath, `${JSON.stringify(payload)}\n`);
console.log(JSON.stringify({ status: "fixed", id, rowLength: row.length, city: row[14], checked: row[22] }, null, 2));
