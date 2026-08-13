import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const id = "manual-kanagawa-oneperson-noborito-20260813";
const checked = "2026-08-13";
const rootUrl = "https://oneperson.jp/";
const priceUrl = "https://oneperson.jp/price/";
const howtoUrl = "https://oneperson.jp/howto/";
const storeUrl = "https://oneperson.jp/store/";
const facilityUrl = "https://oneperson.jp/facility/";
const domain = "oneperson.jp";
const readHead = file => execFileSync("git", ["-C", repository, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const [prefBase, curatedBase, summaryBase] = [readHead("data/hitori/pref/14.json").trim(), readHead("data/hitori/curated.json").trimEnd(), readHead("data/hitori/summary.json").trim()];

if (curatedBase.includes(`"${id}"`)) throw new Error(`確認済みデータに対象IDが既にあります: ${id}`);
if (!curatedBase.endsWith("\n}")) throw new Error("確認済みデータの末尾形式が想定外です。");
const pref = JSON.parse(prefBase);
if (pref.items.some(item => item[0] === id)) throw new Error(`神奈川県データに対象IDが既にあります: ${id}`);

const row = [
  id, "ONEPERSON登戸", 35.62007446, 139.57028413, "bath", "private_sauna", 5, 5, 4, 2,
  1, 0, 0, 0, "川崎市多摩区", "9:00-23:00", "080-5774-5964", rootUrl,
  "公式に完全個室・お一人様専用・1名料金・事前予約・温浴アメニティを確認。2名利用は同性のみ。料金・予約枠・利用条件は利用前に公式の最新情報を確認。",
  5, 5, 4, checked,
];
if (row.length !== 23) throw new Error(`静的施設配列が23列ではありません: ${row.length}`);
pref.items.push(row);

const curated = {
  checked,
  facts: [
    { conflict: false, k: "solo_ok", n: 1, official: true, src: [domain], urls: [rootUrl, howtoUrl], v: "完全個室型。利用方法では本サウナをお一人様専用として案内。" },
    { conflict: false, k: "price", n: 1, official: true, src: [domain], urls: [priceUrl], v: "登戸店の1名利用は60分3,900円、90分4,900円、120分5,900円（税込）。" },
    { conflict: false, k: "reservation", n: 1, official: true, src: [domain], urls: [howtoUrl], v: "WEB予約はアカウント登録・事前決済。電話・来店予約も案内。予約開始は利用日の14日前午前10時。" },
    { conflict: false, k: "hours", n: 1, official: true, src: [domain], urls: [storeUrl], v: "登戸店の営業時間は9:00〜23:00。" },
    { conflict: false, k: "towel", n: 1, official: true, src: [domain], urls: [priceUrl, facilityUrl], v: "タオル、サウナハット、シャンプー、ヘアドライヤー等のアメニティを案内。" },
    { conflict: false, k: "conditions", n: 1, official: true, src: [domain], urls: [rootUrl, howtoUrl], v: "2名利用時は同性のみ。飲酒時・18歳未満は利用不可。体調等の詳細条件は公式利用方法を確認。" },
  ],
  sources: [],
};

const summary = JSON.parse(summaryBase);
const curatedEntry = ` "${id}": ${JSON.stringify(curated, null, 1).replace(/\n/g, "\n ")}`;
const curatedNext = `${curatedBase.slice(0, -2)},\n${curatedEntry}\n}\n`;
const summaryNext = summaryBase.replace(`"total":${summary.total}`, `"total":${summary.total + 1}`).replace(`"checked_count":${summary.checked_count}`, `"checked_count":${summary.checked_count + 1}`);

await Promise.all([
  fs.writeFile(path.join(dataRoot, "pref/14.json"), `${JSON.stringify(pref)}\n`),
  fs.writeFile(path.join(dataRoot, "curated.json"), curatedNext),
  fs.writeFile(path.join(dataRoot, "summary.json"), `${summaryNext}\n`),
]);
console.log(JSON.stringify({ status: "ok", id, total: summary.total + 1, checkedCount: summary.checked_count + 1, facility: row }, null, 2));
