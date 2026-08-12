import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const checked = "2026-08-13";
const candidate = {
  id: "manual-fukuoka-sauna-ooo-fukuoka-20260813",
  facility: [
    "manual-fukuoka-sauna-ooo-fukuoka-20260813", "SAUNA OOO FUKUOKA", 33.5934698, 130.4047847,
    "bath", "private_sauna", 5, 4, 3, 2, 1, 0.0, 0, 1, 0, "福岡市",
    null, null, "https://ooo-sauna.com/fukuoka.html",
    "公式サイトでソロ利用、1名料金、完全予約制、タオルを含むリネン類を確認。公式サイトが複数都市の店舗を案内するためチェーンとして表示。営業時間は公式ページで確認できないため要確認。",
    5, 4, 3, checked,
  ],
  curated: {
    checked,
    facts: [
      { conflict: false, k: "solo_ok", n: 1, official: true, src: ["ooo-sauna.com"], urls: ["https://ooo-sauna.com/fukuoka.html"], v: "ソロ利用から最大5名まで利用可能。各室の料金は1名まで同一料金。" },
      { conflict: false, k: "price", n: 1, official: true, src: ["ooo-sauna.com"], urls: ["https://ooo-sauna.com/fukuoka.html"], v: "100分4,500円〜、120分6,000円〜（部屋により異なる）。1名まで同一料金。" },
      { conflict: false, k: "reservation", n: 1, official: true, src: ["ooo-sauna.com"], urls: ["https://ooo-sauna.com/fukuoka.html"], v: "完全予約制。WEB予約・事前クレジットカード決済。電話予約不可。" },
      { conflict: false, k: "towel", n: 1, official: true, src: ["ooo-sauna.com"], urls: ["https://ooo-sauna.com/fukuoka.html"], v: "室内にタオル、フェイスタオル、バスマット等のリネン類を用意。" },
    ],
    sources: ["https://map.yahoo.co.jp/v3/place/oIypGGhJJ_k/map"],
  },
};

const readHead = file => execFileSync("git", ["-C", repository, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const prefBase = readHead("data/hitori/pref/40.json").trim();
const curatedBase = readHead("data/hitori/curated.json").trimEnd();
const summaryBase = readHead("data/hitori/summary.json").trim();

if (prefBase.includes(`"${candidate.id}"`) || curatedBase.includes(`"${candidate.id}"`)) {
  throw new Error(`福岡県データに対象IDが既にあります: ${candidate.id}`);
}
if (!prefBase.endsWith("]}")) throw new Error("福岡県データの末尾形式が想定外です。");
if (!curatedBase.endsWith("\n}")) throw new Error("確認済みデータの末尾形式が想定外です。");

const summary = JSON.parse(summaryBase);
const fukuoka = summary.prefectures.find(prefecture => prefecture.code === 40);
if (!fukuoka) throw new Error("福岡県の集計が見つかりません。");
const oldFukuokaText = JSON.stringify(fukuoka);
const nextFukuoka = structuredClone(fukuoka);
nextFukuoka.counts.bath += 1;
nextFukuoka.counts.all += 1;
for (const [key, value] of Object.entries(nextFukuoka.counts)) {
  nextFukuoka.density[key] = Number((value / nextFukuoka.pop * 100).toFixed(2));
}

const prefNext = `${prefBase.slice(0, -2)},${JSON.stringify(candidate.facility)}]}`;
const curatedEntry = ` "${candidate.id}": ${JSON.stringify(candidate.curated, null, 1).replace(/\n/g, "\n ")}`;
const curatedNext = `${curatedBase.slice(0, -2)},\n${curatedEntry}\n}\n`;
let summaryNext = summaryBase.replace(oldFukuokaText, JSON.stringify(nextFukuoka));
summaryNext = summaryNext.replace(`"total":${summary.total}`, `"total":${summary.total + 1}`);
summaryNext = summaryNext.replace(`"checked_count":${summary.checked_count}`, `"checked_count":${summary.checked_count + 1}`);

await Promise.all([
  fs.writeFile(path.join(dataRoot, "pref/40.json"), `${prefNext}\n`),
  fs.writeFile(path.join(dataRoot, "curated.json"), curatedNext),
  fs.writeFile(path.join(dataRoot, "summary.json"), `${summaryNext}\n`),
]);

console.log(JSON.stringify({ status: "ok", id: candidate.id, total: summary.total + 1, checkedCount: summary.checked_count + 1, fukuoka: nextFukuoka.counts }, null, 2));
