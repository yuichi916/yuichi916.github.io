import { readFile, writeFile } from "node:fs/promises";

const base = "/home/ubuntu/hitori-source/data/hitori";
const facilityId = "manual-kanagawa-saunabal-people-people-aobadai-20260813";
const checked = "2026-08-13";
const officialUrl = "https://saunabal-peoplexpeople.com/";
const menuUrl = "https://saunabal-peoplexpeople.com/menu/";
const mapUrl = "https://www.navitime.co.jp/poi?name=%E7%A5%9E%E5%A5%88%E5%B7%9D%E7%9C%8C%E6%A8%AA%E6%B5%9C%E5%B8%82%E9%9D%92%E8%91%89%E5%8C%BA%E6%A6%8E%E3%81%8C%E4%B8%985&address=1411701300005005";

const fact = (k, v, official = true, urls = [officialUrl, menuUrl]) => ({
  conflict: false,
  k,
  n: 1,
  official,
  src: official ? ["saunabal-peoplexpeople.com"] : ["一人マップ監査"],
  urls: official ? urls : [],
  v,
});

const [prefText, curatedText, summaryText] = await Promise.all([
  readFile(`${base}/pref/14.json`, "utf8"),
  readFile(`${base}/curated.json`, "utf8"),
  readFile(`${base}/summary.json`, "utf8"),
]);
const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const summary = JSON.parse(summaryText);
if (pref.items.some(row => row[0] === facilityId) || curated[facilityId]) {
  throw new Error("Saunabal People×Peopleは既に静的データへ存在します。二重登録を停止しました。");
}

pref.items.push([
  facilityId, "Saunabal People×People", 35.541176, 139.514646, "bath", "sauna",
  5, 3, 3, 3, 0, 0, 0, 0, "横浜市青葉区",
  "10:00〜24:00（平日10:00〜12:00・16:00以降、土日祝18:00以降は事前予約制／不定休）", "070-8969-0901", officialUrl,
  "公式に1名から予約可能。通常は貸切ではなく、予約が重なる場合は共用大サウナを利用する。会話環境は要確認。", 5, 3, 3, checked,
]);
curated[facilityId] = {
  checked,
  facts: [
    fact("solo_ok", "公式：1名から予約可能。1名は小サウナ室を案内。", true, [officialUrl]),
    fact("price", "平日2時間1,500円、60分2,480円、90分3,480円、120分4,480円（税込）。個室利用料は別途。", true, [menuUrl]),
    fact("reservation", "予約は利用日の1日前から受付。平日10:00〜12:00・16:00以降、土日祝18:00以降は事前予約制。", true, [officialUrl]),
    fact("hours", "10:00〜24:00。平日・土日祝の一部時間帯は事前予約制。不定期の営業・休業あり。", true, [officialUrl]),
    fact("towel", "着衣・タオルのレンタルは500円。バスタオル300円、4点セット（着衣・ハット・マット・バスタオル）500円。", true, [menuUrl]),
    fact("conditions", "通常は貸切ではなく、予約が重なる場合は共用大サウナを利用。小サウナの個室利用は別途個室代。中学生以下・高校生のみの利用不可。", true, [menuUrl]),
    fact("silence", "会話環境に関する公式ルールは確認できないため、利用前に要確認。", false),
  ],
  sources: [officialUrl, menuUrl, mapUrl],
};
summary.total += 1;
summary.checked_count += 1;

await Promise.all([
  writeFile(`${base}/pref/14.json`, `${JSON.stringify(pref)}\n`),
  writeFile(`${base}/curated.json`, `${JSON.stringify(curated, null, 1)}\n`),
  writeFile(`${base}/summary.json`, `${JSON.stringify(summary)}\n`),
]);
console.log(JSON.stringify({ facilityId, total: summary.total, checkedCount: summary.checked_count, factCount: curated[facilityId].facts.length }, null, 2));
