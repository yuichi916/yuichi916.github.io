import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const id = "manual-tokyo-private-sauna-ladle-20260813";
const checked = "2026-08-13";
const informationUrl = "https://sauna-ladle.com/information/";
const reserveUrl = "https://sauna-ladle.com/reserve/";
const facilityUrl = "https://sauna-ladle.com/facility/";
const domain = "sauna-ladle.com";
const readHead = file => execFileSync("git", ["-C", repository, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const [prefBase, curatedBase, summaryBase] = [
  readHead("data/hitori/pref/13.json").trim(),
  readHead("data/hitori/curated.json").trimEnd(),
  readHead("data/hitori/summary.json").trim(),
];

if (curatedBase.includes(`"${id}"`)) throw new Error(`確認済みデータに対象IDが既にあります: ${id}`);
if (!curatedBase.endsWith("\n}")) throw new Error("確認済みデータの末尾形式が想定外です。");

const pref = JSON.parse(prefBase);
if (pref.items.some(item => item[0] === id)) throw new Error(`東京都データに対象IDが既にあります: ${id}`);

const row = [
  id, "プライベートサウナLadle", 35.6252953, 139.7234561, "bath", "private_sauna", 5, 5, 3, 2,
  0, 0, 0, 0, "品川区", "12:50-22:10（最終入室）", "080-4905-1121", informationUrl,
  "公式サイトで1名利用、料金、完全予約制、営業時間、無料タオル、完全個室と利用条件を確認。料金・予約枠・利用規約は変更され得るため、利用前に公式の最新情報を確認。",
  5, 5, 3, checked,
];
if (row.length !== 23) throw new Error(`静的施設配列が23列ではありません: ${row.length}`);
pref.items.push(row);

const curated = {
  checked,
  facts: [
    { conflict: false, k: "solo_ok", n: 1, official: true, src: [domain], urls: [informationUrl, facilityUrl], v: "公式料金表に1名様利用（60分・80分・100分）を掲載。施設案内では1名様ルームを案内。" },
    { conflict: false, k: "price", n: 1, official: true, src: [domain], urls: [informationUrl], v: "1名様利用は60分3,980円、80分4,980円、100分5,980円（税込）。曜日割引の料金は公式で要確認。" },
    { conflict: false, k: "reservation", n: 1, official: true, src: [domain], urls: [reserveUrl], v: "完全予約制。インターネットによる事前予約のみで、予約は開始10分前まで可能。" },
    { conflict: false, k: "hours", n: 1, official: true, src: [domain], urls: [informationUrl], v: "定休日なし。12:50〜22:10（最終入室）。" },
    { conflict: false, k: "towel", n: 1, official: true, src: [domain], urls: [informationUrl], v: "バスタオル・フェイスタオルを無料レンタル。" },
    { conflict: false, k: "conditions", n: 1, official: true, src: [domain], urls: [reserveUrl, facilityUrl], v: "完全個室。2名・3名利用は同性のみで男女利用不可。飲酒時または37.5℃以上の発熱時は利用不可。緊急時は従業員が入室する場合あり。" },
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
  fs.writeFile(path.join(dataRoot, "pref/13.json"), `${JSON.stringify(pref)}\n`),
  fs.writeFile(path.join(dataRoot, "curated.json"), curatedNext),
  fs.writeFile(path.join(dataRoot, "summary.json"), `${summaryNext}\n`),
]);

console.log(JSON.stringify({ status: "ok", id, total: summary.total + 1, checkedCount: summary.checked_count + 1, facility: row }, null, 2));
