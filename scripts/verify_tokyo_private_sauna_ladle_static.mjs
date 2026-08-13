import fs from "node:fs/promises";
import path from "node:path";

const root = "/home/ubuntu/hitori-source/data/hitori";
const id = "manual-tokyo-private-sauna-ladle-20260813";
const [pref, curated, summary] = await Promise.all([
  fs.readFile(path.join(root, "pref/13.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(root, "curated.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(root, "summary.json"), "utf8").then(JSON.parse),
]);
const rows = pref.items.filter(item => item[0] === id);
const detail = curated[id];
if (rows.length !== 1) throw new Error(`東京都の施設配列に対象IDが一意ではありません: ${rows.length}`);
if (rows[0].length !== 23) throw new Error(`静的施設配列が23列ではありません: ${rows[0].length}`);
if (!detail || detail.facts.length !== 6) throw new Error("確認済み事実6件を確認できません。");
if (rows[0][2] !== 35.6252953 || rows[0][3] !== 139.7234561) throw new Error("座標が一致しません。");
if (summary.total !== 40573 || summary.checked_count !== 755) throw new Error(`集計値が想定外です: ${summary.total}/${summary.checked_count}`);
console.log(JSON.stringify({ id, row: rows[0], factCount: detail.facts.length, total: summary.total, checkedCount: summary.checked_count }, null, 2));
