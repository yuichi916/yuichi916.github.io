import { readFile, writeFile } from "node:fs/promises";

const path = "/home/ubuntu/hitori-source/data/hitori/curated.json";
const id = "manual-tokyo-hubhub-shimokitazawa-20260813";
const curated = JSON.parse(await readFile(path, "utf8"));
const fact = curated[id]?.facts?.find(item => item.k === "solo" && /おひとり様も大歓迎/.test(item.v));
if (!fact) throw new Error("修正対象のHUBHUB下北沢の一人利用事実が見つかりません。");
fact.k = "solo_ok";
await writeFile(path, `${JSON.stringify(curated, null, 1)}\n`);
console.log(JSON.stringify({ id, factKey: fact.k }, null, 2));
