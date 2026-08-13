import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const id = "manual-kanagawa-ultra-sauna-kannai-20260813";
const checked = "2026-08-13";
const officialUrl = "https://www.loylyland.com/bsm_lp-entry/";
const domain = "loylyland.com";
const readHead = file => execFileSync("git", ["-C", repository, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const [prefBase, curatedBase, summaryBase] = [readHead("data/hitori/pref/14.json").trim(), readHead("data/hitori/curated.json").trimEnd(), readHead("data/hitori/summary.json").trim()];

if (curatedBase.includes(`"${id}"`)) throw new Error(`確認済みデータに対象IDが既にあります: ${id}`);
if (!curatedBase.endsWith("\n}")) throw new Error("確認済みデータの末尾形式が想定外です。");
const pref = JSON.parse(prefBase);
if (pref.items.some(item => item[0] === id)) throw new Error(`神奈川県データに対象IDが既にあります: ${id}`);

const row = [
  id, "ULTRA SAUNA ICE & HEAT by LOYLY LAND", 35.446812, 139.635672, "bath", "private_sauna", 5, 1, 4, 2,
  1, 0, 0, 0, "横浜市中区", "10:00-22:30（木曜定休）", "070-1474-1137", officialUrl,
  "公式に一人利用可の個室サウナ、WEB予約、手ぶら利用可、会話歓迎・沈黙禁止、料金・利用条件を確認。静かな利用を優先する人は会話環境を公式情報で要確認。",
  5, 1, 4, checked,
];
if (row.length !== 23) throw new Error(`静的施設配列が23列ではありません: ${row.length}`);
pref.items.push(row);

const curated = {
  checked,
  facts: [
    { conflict: false, k: "solo_ok", n: 1, official: true, src: [domain], urls: [officialUrl], v: "「ひとりでもいい。ふたりでもいい。男女で入れる、個室サウナ」と案内。" },
    { conflict: false, k: "price", n: 1, official: true, src: [domain], urls: [officialUrl], v: "初回体験は70分4,400円（税込）。月額プラン・追加利用・同伴利用の料金は公式で案内。" },
    { conflict: false, k: "reservation", n: 1, official: true, src: [domain], urls: [officialUrl], v: "利用までの流れとしてWEB予約で完結と案内。体験予約あり。" },
    { conflict: false, k: "hours", n: 1, official: true, src: [domain], urls: [officialUrl], v: "10:00〜22:30、毎週木曜定休。" },
    { conflict: false, k: "towel", n: 1, official: true, src: [domain], urls: [officialUrl], v: "Q&Aで手ぶら利用可と案内。" },
    { conflict: false, k: "silence", n: 1, official: true, src: [domain], urls: [officialUrl], v: "おしゃべり大歓迎、沈黙禁止と案内。静かな利用を優先する人は要確認。" },
    { conflict: false, k: "conditions", n: 1, official: true, src: [domain], urls: [officialUrl], v: "体験利用は16歳未満、飲酒・体調不良、妊娠中、医師から制限がある場合は不可。男女ペアの混浴利用では専用ウェア着用必須。" },
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
