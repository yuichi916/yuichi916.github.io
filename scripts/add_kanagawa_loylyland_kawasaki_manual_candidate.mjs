import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const id = "manual-kanagawa-loylyland-kawasaki-20260813";
const checked = "2026-08-13";
const homeUrl = "https://www.loylyland.com/";
const domain = "loylyland.com";
const readHead = file => execFileSync("git", ["-C", repository, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const [prefBase, curatedBase, summaryBase] = [
  readHead("data/hitori/pref/14.json").trim(),
  readHead("data/hitori/curated.json").trimEnd(),
  readHead("data/hitori/summary.json").trim(),
];

if (curatedBase.includes(`"${id}"`)) throw new Error(`確認済みデータに対象IDが既にあります: ${id}`);
if (!curatedBase.endsWith("\n}")) throw new Error("確認済みデータの末尾形式が想定外です。");

const pref = JSON.parse(prefBase);
if (pref.items.some(item => item[0] === id)) throw new Error(`神奈川県データに対象IDが既にあります: ${id}`);

const row = [
  id, "ロウリューランド川崎", 35.5287377, 139.6956152, "bath", "private_sauna", 5, 5, 3, 2,
  0, 0, 0, 0, "川崎市川崎区", "Mo-Fr 10:00-23:00; Sa-Su,PH 10:00-20:00; Th off", "044-201-4438", homeUrl,
  "公式サイトで一人利用、会員制事前予約、料金、営業時間、タオル、個室の利用条件を確認。料金・キャンペーン・営業時間は変更され得るため利用前に公式の最新情報を確認。",
  5, 5, 3, checked,
];
if (row.length !== 23) throw new Error(`静的施設配列が23列ではありません: ${row.length}`);
pref.items.push(row);

const curated = {
  checked,
  facts: [
    { conflict: false, k: "solo_ok", n: 1, official: true, src: [domain], urls: [homeUrl], v: "公式サイトは「ひとりでも。ふたりでも。」と案内し、個室ならではの「ひとり時間」を明記。" },
    { conflict: false, k: "price", n: 1, official: true, src: [domain], urls: [homeUrl], v: "初回個室サウナ体験は通常4,400円（キャンペーン表示時は2,980円/人）。会員プランは月1回3,600円、月2回6,980円、月4回13,500円、通い放題25,000円。" },
    { conflict: false, k: "reservation", n: 1, official: true, src: [domain], urls: [homeUrl], v: "会員制の事前予約システム。体験予約・WEB入会の公式導線あり。" },
    { conflict: false, k: "hours", n: 1, official: true, src: [domain], urls: [homeUrl], v: "平日10:00〜23:00、土日祝10:00〜20:00、毎週木曜定休。" },
    { conflict: false, k: "towel", n: 1, official: true, src: [domain], urls: [homeUrl], v: "会員プランはタオルセット無料。" },
    { conflict: false, k: "conditions", n: 1, official: true, src: [domain], urls: [homeUrl], v: "着替え・シャワー・サウナ・休息が個室で完結。男女ペアの同室利用は水着着用で可能。" },
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
  fs.writeFile(path.join(dataRoot, "pref/14.json"), `${JSON.stringify(pref)}\n`),
  fs.writeFile(path.join(dataRoot, "curated.json"), curatedNext),
  fs.writeFile(path.join(dataRoot, "summary.json"), `${summaryNext}\n`),
]);

console.log(JSON.stringify({ status: "ok", id, total: summary.total + 1, checkedCount: summary.checked_count + 1, facility: row }, null, 2));
