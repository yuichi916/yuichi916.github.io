import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const id = "manual-saitama-solo37-20260813";
const checked = "2026-08-13";
const homeUrl = "https://solo37.com/";
const domain = "solo37.com";
const readHead = file => execFileSync("git", ["-C", repository, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const [prefBase, curatedBase, summaryBase] = [
  readHead("data/hitori/pref/11.json").trim(),
  readHead("data/hitori/curated.json").trimEnd(),
  readHead("data/hitori/summary.json").trim(),
];

if (curatedBase.includes(`"${id}"`)) throw new Error(`確認済みデータに対象IDが既にあります: ${id}`);
if (!curatedBase.endsWith("\n}")) throw new Error("確認済みデータの末尾形式が想定外です。");

const pref = JSON.parse(prefBase);
if (pref.items.some(item => item[0] === id)) throw new Error(`埼玉県データに対象IDが既にあります: ${id}`);

const row = [
  id, "SOLO37", 35.8032019, 139.7190165, "bath", "private_sauna", 5, 5, 3, 2,
  0, 0, 0, 0, "川口市", "10:00-24:00", "", homeUrl,
  "公式サイトでソロルームはお一人様専用、料金、WEB予約、営業時間、女性専用ルーム・VIPルームの利用条件を確認。",
  5, 5, 3, checked,
];
if (row.length !== 23) throw new Error(`静的施設配列が23列ではありません: ${row.length}`);
pref.items.push(row);

const curated = {
  checked,
  facts: [
    { conflict: false, k: "solo_ok", n: 1, official: true, src: [domain], urls: [homeUrl], v: "公式サイトはソロルームを「お一人様専用ルーム」と案内。" },
    { conflict: false, k: "price", n: 1, official: true, src: [domain], urls: [homeUrl], v: "ソロルーム: 60分2,800円、90分3,800円、120分5,600円、150分6,600円、180分7,600円。" },
    { conflict: false, k: "reservation", n: 1, official: true, src: [domain], urls: [homeUrl], v: "WEB予約で事前決済、当日予約時の店頭決済、回数券利用の3種類。VIPルームは事前決済のみ。" },
    { conflict: false, k: "hours", n: 1, official: true, src: [domain], urls: [homeUrl], v: "10:00〜24:00（清掃・設備メンテナンス等で変更する場合あり）。" },
    { conflict: false, k: "conditions", n: 1, official: true, src: [domain], urls: [homeUrl], v: "女性専用ルーム・パウダールームあり。VIPルームは1〜3名で男女利用可能（水着着用）。" },
  ],
  sources: [],
};

const summary = JSON.parse(summaryBase);
const curatedEntry = ` "${id}": ${JSON.stringify(curated, null, 1).replace(/\n/g, "\n ")}`;
const curatedNext = `${curatedBase.slice(0, -2)},\n${curatedEntry}\n}\n`;
const summaryNext = summaryBase
  .replace(`"total":${summary.total}`, `"total":${summary.total + 1}`)
  .replace(`"checked_count":${summary.checked_count}`, `"checked_count":${summary.checked_count + 1}`);

await Promise.all([
  fs.writeFile(path.join(dataRoot, "pref/11.json"), `${JSON.stringify(pref)}\n`),
  fs.writeFile(path.join(dataRoot, "curated.json"), curatedNext),
  fs.writeFile(path.join(dataRoot, "summary.json"), `${summaryNext}\n`),
]);

console.log(JSON.stringify({ status: "ok", id, total: summary.total + 1, checkedCount: summary.checked_count + 1, facility: row }, null, 2));
