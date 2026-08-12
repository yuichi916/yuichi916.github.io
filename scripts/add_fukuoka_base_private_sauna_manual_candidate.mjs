import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repository = "/home/ubuntu/hitori-source";
const dataRoot = path.join(repository, "data/hitori");
const checked = "2026-08-13";
const candidate = {
  id: "manual-fukuoka-base-private-sauna-yakuin-20260813",
  facility: [
    "manual-fukuoka-base-private-sauna-yakuin-20260813", "BASE private sauna 福岡薬院店", 33.583241, 130.400882,
    "bath", "private_sauna", 5, 4, 3, 2, 0, 0.0, 0, 1, "福岡市",
    "10:00-23:00", "092-791-1210", "https://base-sauna.jp/",
    "公式ページで1名利用、料金、予約方法、営業時間、タオルを確認。複数店舗の公式根拠を未確認のためチェーン判定は要確認。",
    5, 4, 3, checked,
  ],
  curated: {
    checked,
    facts: [
      { conflict: false, k: "solo_ok", n: 1, official: true, src: ["base-sauna.jp"], urls: ["https://base-sauna.jp/price/"], v: "1名利用可。2名利用は家族または同性同士のみ。" },
      { conflict: false, k: "price", n: 1, official: true, src: ["base-sauna.jp"], urls: ["https://base-sauna.jp/price/"], v: "平日80分5,000円〜150分7,500円。土日祝80分5,300円〜150分7,800円。" },
      { conflict: false, k: "reservation", n: 1, official: true, src: ["base-sauna.jp"], urls: ["https://base-sauna.jp/how-to-use/"], v: "WEB・電話・LINEから予約可。予約なしでも利用可能だが予約者を優先。" },
      { conflict: false, k: "hours", n: 1, official: true, src: ["base-sauna.jp"], urls: ["https://base-sauna.jp/price/"], v: "10:00〜23:00。" },
      { conflict: false, k: "towel", n: 1, official: true, src: ["base-sauna.jp"], urls: ["https://base-sauna.jp/price/"], v: "料金に個室使用料、タオル、各種アメニティを含む。" },
      { conflict: false, k: "access", n: 1, official: true, src: ["base-sauna.jp"], urls: ["https://base-sauna.jp/price/"], v: "福岡市中央区薬院1丁目2-5。薬院駅北口から徒歩約2分。" },
    ],
    sources: [],
  },
};

const readHead = file => execFileSync("git", ["-C", repository, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const prefBase = readHead("data/hitori/pref/40.json").trim();
const curatedBase = readHead("data/hitori/curated.json").trimEnd();
const summaryBase = readHead("data/hitori/summary.json").trim();

if (prefBase.includes(`\"${candidate.id}\"`) || curatedBase.includes(`\"${candidate.id}\"`)) {
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
