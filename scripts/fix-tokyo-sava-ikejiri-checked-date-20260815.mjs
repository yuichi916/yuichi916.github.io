import { readFile, writeFile } from "node:fs/promises";

const base = "/home/ubuntu/hitori-source/data/hitori";
const id = "manual-tokyo-sava-ikejiri-20260813";
const checked = "2026-08-15";
const [prefText, curatedText] = await Promise.all([
  readFile(`${base}/pref/13.json`, "utf8"),
  readFile(`${base}/curated.json`, "utf8"),
]);
const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const row = pref.items.find(item => item[0] === id);
if (!row || !curated[id]) throw new Error("サバ？の静的登録データが見つかりません。");
row[22] = checked;
curated[id].checked = checked;
await Promise.all([
  writeFile(`${base}/pref/13.json`, `${JSON.stringify(pref)}\n`),
  writeFile(`${base}/curated.json`, `${JSON.stringify(curated, null, 1)}\n`),
]);
console.log(JSON.stringify({ id, checked }, null, 2));
