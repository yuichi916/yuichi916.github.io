import { readFile, writeFile } from "node:fs/promises";

const base = "/home/ubuntu/hitori-source/data/hitori";
const facilityId = "manual-kanagawa-hotel-platanus-shinyokohama-20260813";
const checked = "2026-08-13";
const officialUrl = "https://www.hotel-platanus.jp/";
const faqUrl = "https://www.hotel-platanus.jp/faq/";
const daytripUrl = "https://reserve.489ban.net/client/hotel-platanus/0/plan/daytrip";
const mapUrl = "https://local.google.co.jp/maps?q=%E7%A5%9E%E5%A5%88%E5%B7%9D%E7%9C%8C%E6%A8%AA%E6%B5%9C%E5%B8%82%E6%B8%AF%E5%8C%97%E5%8C%BA%E5%8C%97%E6%96%B0%E6%A8%AA%E6%B5%9C1-4-2";
const fact = (k, v, official = true, urls = [officialUrl]) => ({
  conflict: false,
  k,
  n: 1,
  official,
  src: official ? [new URL(urls[0]).hostname] : ["一人マップ監査"],
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
  throw new Error("ホテルプラタナス新横浜は既に静的データへ存在します。二重登録を停止しました。");
}

pref.items.push([
  facilityId, "ホテルプラタナス新横浜", 35.517612, 139.613649, "bath", "private_sauna_hotel",
  4, 4, 3, 3, 0, 0, 0, 0, "横浜市港北区",
  "日帰りプラン: 12:00〜17:00、12:00〜20:00、18:00〜23:00（プラン・空室により変動）", "045-717-7717", officialUrl,
  "公式の完全個室・日帰りプラン・最大2名・タオル等を確認。一人利用の個別明示と会話ルールは公式に確認できず要確認。", 4, 4, 3, checked,
]);
curated[facilityId] = {
  checked,
  facts: [
    fact("price", "公式予約画面では日帰り5時間15,000円〜、ナイトユース5時間15,000円〜、ロングデイユース8時間19,000円〜（客室により24,000円〜）を掲載。客室単位かつ変動する表示で、1名料金とは扱わない。", true, [daytripUrl]),
    fact("hours", "公式日帰りプランは12:00〜17:00の5時間、12:00〜20:00の8時間、18:00〜23:00の5時間を案内。利用可能な時間帯はプラン・空室により確認。", true, [daytripUrl]),
    fact("towel", "公式FAQはバスタオル・フェイスタオル、サウナハット、ポンチョ、男女水着、オリジナルタオルを案内。", true, [faqUrl]),
    fact("payment_method", "公式FAQはクレジットカード・QRコード決済可、現金・交通系IC等の電子マネー不可と案内。公式予約画面は現地決済またはクレジットカード事前決済を案内するため、利用プランごとの決済方法は予約時に確認。", true, [faqUrl, daytripUrl]),
    fact("conditions", "公式FAQは客室内の完全個室プライベートサウナ、最大2名での利用を案内。公式の一人利用個別明示は確認できないため、1名利用可とは扱わない。", true, [faqUrl]),
    fact("silence", "会話環境の公式ルールは確認できないため、利用前に要確認。", false),
  ],
  sources: [officialUrl, faqUrl, daytripUrl, mapUrl],
};
summary.total += 1;
summary.checked_count += 1;

await Promise.all([
  writeFile(`${base}/pref/14.json`, `${JSON.stringify(pref)}\n`),
  writeFile(`${base}/curated.json`, `${JSON.stringify(curated, null, 1)}\n`),
  writeFile(`${base}/summary.json`, `${JSON.stringify(summary)}\n`),
]);
console.log(JSON.stringify({ facilityId, total: summary.total, checkedCount: summary.checked_count, factCount: curated[facilityId].facts.length, sourceCount: curated[facilityId].sources.length }, null, 2));
