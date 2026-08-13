import { readFile, writeFile } from "node:fs/promises";

const path = "/home/ubuntu/hitori-source/data/hitori/curated.json";
const facilityId = "manual-kanagawa-blue-ocean-shinyokohama-20260813";
const expectedSources = [
  "https://blueocean.homepage.jp/firstvisitors",
  "https://blueocean.homepage.jp/access",
  "https://map.yahoo.co.jp/v3/place/m5aVFgKNFOE/map",
];
const curated = JSON.parse(await readFile(path, "utf8"));
if (!curated[facilityId]) throw new Error("対象施設の確認済みデータが見つかりません。");
curated[facilityId].sources = expectedSources;
await writeFile(path, `${JSON.stringify(curated, null, 1)}\n`);
console.log(JSON.stringify({ facilityId, sources: curated[facilityId].sources }, null, 2));
