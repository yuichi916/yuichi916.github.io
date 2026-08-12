import fs from "node:fs/promises";
import path from "node:path";

const dataRoot = "/home/ubuntu/hitori-source/data/hitori";
const curated = JSON.parse(await fs.readFile(path.join(dataRoot, "curated.json"), "utf8"));
const summary = JSON.parse(await fs.readFile(path.join(dataRoot, "summary.json"), "utf8"));
const facilityIds = new Set();
for (const filename of await fs.readdir(path.join(dataRoot, "pref"))) {
  if (!filename.endsWith(".json")) continue;
  const payload = JSON.parse(await fs.readFile(path.join(dataRoot, "pref", filename), "utf8"));
  for (const facility of payload.items ?? []) facilityIds.add(facility[0]);
}

const orphanIds = Object.keys(curated).filter(id => !facilityIds.has(id));
if (orphanIds.length) throw new Error(`施設配列に存在しない確認済みデータがあります: ${orphanIds.join(", ")}`);
if (summary.checked_count !== Object.keys(curated).length) {
  throw new Error(`summary.checked_countが確認済みデータ数と一致しません: ${summary.checked_count} != ${Object.keys(curated).length}`);
}
console.log(JSON.stringify({ status: "ok", checkedCount: summary.checked_count, orphanCount: 0 }, null, 2));
