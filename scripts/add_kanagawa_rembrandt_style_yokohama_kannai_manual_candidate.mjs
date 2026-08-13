import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const id = "manual-kanagawa-rembrandt-style-yokohama-kannai-20260813";
const checked = "2026-08-13";
const officialUrl = "https://rembrandt-style.com/yokohama-kannai-private-sauna/information/";
const domain = "rembrandt-style.com";
const sourceUrls = ["https://rembrandt-style.com/yokohama-kannai-private-sauna/", officialUrl];
const readHead = file => execFileSync("git", ["-C", repository, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const [prefBase, curatedBase, summaryBase] = [readHead("data/hitori/pref/14.json").trim(), readHead("data/hitori/curated.json").trimEnd(), readHead("data/hitori/summary.json").trim()];

if (curatedBase.includes(`"${id}"`)) throw new Error(`確認済みデータに対象IDが既にあります: ${id}`);
if (!curatedBase.endsWith("\n}")) throw new Error("確認済みデータの末尾形式が想定外です。");
const pref = JSON.parse(prefBase);
if (pref.items.some(item => item[0] === id)) throw new Error(`神奈川県データに対象IDが既にあります: ${id}`);

const row = [
  id, "レンブラントスタイル横浜関内 プライベートサウナルーム", 35.442224, 139.637189, "bath", "private_sauna", 5, 5, 4, 2,
  0, 0, 0, 0, "横浜市中区", "8:10-最終枠22:10（サウナ予約枠。ホテル営業時間とは異なるため利用前に要確認）", "045-681-4800", officialUrl,
  "公式に一人利用、1名あたり料金、専用予約・事前会員登録、タオル・アメニティ、個室条件を確認。サウナのみは休憩室料が別途必要。",
  5, 5, 4, checked,
];
if (row.length !== 23) throw new Error(`静的施設配列が23列ではありません: ${row.length}`);
pref.items.push(row);

const fact = (k, v, urls = sourceUrls) => ({ conflict: false, k, n: 1, official: true, src: [domain], urls, v });
const curated = {
  checked,
  facts: [
    fact("solo_ok", "公式に「お１人さま利用はもちろん」と案内するプライベートサウナ。", ["https://rembrandt-style.com/yokohama-kannai-private-sauna/"]),
    fact("price", "サウナのみは平日2,480円＋休憩室料1,000円、土日祝2,980円＋休憩室料1,000円。表示は一人当たり税込。", [officialUrl]),
    fact("reservation", "サウナルーム専用予約サイトを使用し、事前会員登録が必要。サウナ代は事前決済。", [officialUrl]),
    fact("hours", "サウナの予約枠は8:10〜最終枠22:10。ホテル営業時間5:00〜24:00とは異なるため、予約枠を公式で確認。", sourceUrls),
    fact("towel", "大・小タオル貸出、アメニティブッフェ利用可。", [officialUrl]),
    fact("silence", "「誰にも邪魔されない」と案内するプライベート空間。サウナ・水風呂・ととのい椅子を集中配置。", ["https://rembrandt-style.com/yokohama-kannai-private-sauna/"]),
    fact("conditions", "サウナルームは最大2名、1回100分、18歳未満は利用不可。", [officialUrl]),
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
