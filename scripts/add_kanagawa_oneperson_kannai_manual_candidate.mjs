import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const id = "manual-kanagawa-oneperson-kannai-20260813";
const checked = "2026-08-13";
const officialUrl = "https://oneperson.jp/store/";
const domain = "oneperson.jp";
const sourceUrls = ["https://oneperson.jp/", "https://oneperson.jp/store/", "https://oneperson.jp/facility/"];
const readHead = file => execFileSync("git", ["-C", repository, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const [prefBase, curatedBase, summaryBase] = [readHead("data/hitori/pref/14.json").trim(), readHead("data/hitori/curated.json").trimEnd(), readHead("data/hitori/summary.json").trim()];

if (curatedBase.includes(`"${id}"`)) throw new Error(`確認済みデータに対象IDが既にあります: ${id}`);
if (!curatedBase.endsWith("\n}")) throw new Error("確認済みデータの末尾形式が想定外です。");
const pref = JSON.parse(prefBase);
if (pref.items.some(item => item[0] === id)) throw new Error(`神奈川県データに対象IDが既にあります: ${id}`);

const row = [
  id, "ONEPERSON横浜関内", 35.444386, 139.634486, "bath", "private_sauna", 5, 5, 4, 2,
  1, 0, 0, 0, "横浜市中区", "9:00-23:00", "080-5774-5934", officialUrl,
  "公式に完全個室・1名料金・事前予約制・手ぶら設備を確認。デラックスルームの水風呂は横浜関内店のみと公式施設案内に記載。",
  5, 5, 4, checked,
];
if (row.length !== 23) throw new Error(`静的施設配列が23列ではありません: ${row.length}`);
pref.items.push(row);

const fact = (k, v, urls = sourceUrls) => ({ conflict: false, k, n: 1, official: true, src: [domain], urls, v });
const curated = {
  checked,
  facts: [
    fact("solo_ok", "完全個室型・事前予約制のプライベートサウナ。公式料金表に1名利用を掲載。"),
    fact("price", "スタンダード1名は60分3,600円、90分5,200円、120分6,700円。デラックス1名は90分6,200円、120分7,700円（税込）。", ["https://oneperson.jp/price/"]),
    fact("reservation", "完全個室型・事前予約制と公式案内。"),
    fact("hours", "9:00〜23:00。", [officialUrl]),
    fact("towel", "タオル、サウナハット、シャンプー、ヘアドライヤー等のアメニティを用意し、手ぶら利用可と案内。", ["https://oneperson.jp/facility/", "https://oneperson.jp/price/"]),
    fact("silence", "サウナ・シャワー・休憩・トイレ・パウダースペースが個室内で完結するプライベート空間と案内。", ["https://oneperson.jp/", "https://oneperson.jp/facility/"]),
    fact("conditions", "1室2名利用は同性同士のみが原則。横浜関内店はスタンダード2名利用とデラックス2名利用を公式に案内。"),
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
