import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const curatedPath = path.join(dataRoot, "curated.json");
const summaryPath = path.join(dataRoot, "summary.json");
const expectedOrphanCount = 70;

const curated = JSON.parse(await fs.readFile(curatedPath, "utf8"));
const summary = JSON.parse(await fs.readFile(summaryPath, "utf8"));
const facilityIds = new Set();
for (const filename of await fs.readdir(path.join(dataRoot, "pref"))) {
  if (!filename.endsWith(".json")) continue;
  const payload = JSON.parse(await fs.readFile(path.join(dataRoot, "pref", filename), "utf8"));
  for (const facility of payload.items ?? []) facilityIds.add(facility[0]);
}

const orphanIds = Object.keys(curated).filter(id => !facilityIds.has(id));
if (orphanIds.length !== expectedOrphanCount) {
  throw new Error(`孤立した確認済みデータが想定外です: ${orphanIds.length}件（想定${expectedOrphanCount}件）`);
}

const nextCurated = Object.fromEntries(Object.entries(curated).filter(([id]) => facilityIds.has(id)));
const nextCheckedCount = Object.keys(nextCurated).length;
if (summary.checked_count - orphanIds.length !== nextCheckedCount) {
  throw new Error(`summary.checked_countの整合性が取れません: ${summary.checked_count} - ${orphanIds.length} != ${nextCheckedCount}`);
}

summary.checked_count = nextCheckedCount;
await Promise.all([
  fs.writeFile(curatedPath, `${JSON.stringify(nextCurated, null, 1)}\n`),
  fs.writeFile(summaryPath, `${JSON.stringify(summary)}\n`),
]);

console.log(JSON.stringify({
  status: "ok",
  removedOrphanCount: orphanIds.length,
  checkedCount: nextCheckedCount,
  archivedAudit: "/home/ubuntu/hitori-map-pro/docs/research/static-db-verification-diff-2026-08-13.json",
}, null, 2));
