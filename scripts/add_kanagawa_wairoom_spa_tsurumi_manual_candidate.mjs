import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const id = "manual-kanagawa-wairoom-spa-tsurumi-20260813";
const checked = "2026-08-13";
const officialUrl = "https://wairoom-spa.com/shops/tsurumi/";
const domain = "wairoom-spa.com";
const readHead = file => execFileSync("git", ["-C", repository, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const [prefBase, curatedBase, summaryBase] = [readHead("data/hitori/pref/14.json").trim(), readHead("data/hitori/curated.json").trimEnd(), readHead("data/hitori/summary.json").trim()];

if (curatedBase.includes(`"${id}"`)) throw new Error(`確認済みデータに対象IDが既にあります: ${id}`);
if (!curatedBase.endsWith("\n}")) throw new Error("確認済みデータの末尾形式が想定外です。");
const pref = JSON.parse(prefBase);
if (pref.items.some(item => item[0] === id)) throw new Error(`神奈川県データに対象IDが既にあります: ${id}`);

const row = [
  id, "ワイルームSpa横浜鶴見店", 35.505719, 139.6774788, "bath", "private_sauna", 5, 4, 4, 2,
  0, 0, 0, 0, "横浜市鶴見区", "月・水〜金12:00-23:00／土日11:00-23:00（火曜定休、最終受付21:30）", "045-947-2828", officialUrl,
  "公式に完全個室・1名専用ルーム・1名料金・予約方法・手ぶら利用を確認。マッサージ併設だが、サウナだけの利用可否と最新予約枠は予約先で確認。",
  5, 4, 4, checked,
];
if (row.length !== 23) throw new Error(`静的施設配列が23列ではありません: ${row.length}`);
pref.items.push(row);

const curated = {
  checked,
  facts: [
    { conflict: false, k: "solo_ok", n: 1, official: true, src: [domain], urls: [officialUrl], v: "完全個室。スタンダードルームは1名さま専用で、公式は「ひとりでも、お二人でも」と案内。" },
    { conflict: false, k: "price", n: 1, official: true, src: [domain], urls: [officialUrl], v: "スタンダード（1名）は80分4,500円〜、120分6,800円〜。最新価格は公式予約先で要確認。" },
    { conflict: false, k: "reservation", n: 1, official: true, src: [domain], urls: [officialUrl], v: "LINE・ホットペッパー・電話で予約優先。当日空きがあればウォークイン可。" },
    { conflict: false, k: "hours", n: 1, official: true, src: [domain], urls: [officialUrl], v: "月・水〜金12:00〜23:00、土日11:00〜23:00、火曜定休、最終受付21:30。" },
    { conflict: false, k: "towel", n: 1, official: true, src: [domain], urls: [officialUrl], v: "タオル・アメニティ完備、手ぶら利用可。" },
    { conflict: false, k: "silence", n: 1, official: true, src: [domain], urls: [officialUrl], v: "完全個室で「順番待ちも人目も話し声もなし」と案内。" },
    { conflict: false, k: "conditions", n: 1, official: true, src: [domain], urls: [officialUrl], v: "VIPペアは1〜2名、プレミアムペアは2〜3名。男女同室可。スタンダードは1名専用。" },
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
