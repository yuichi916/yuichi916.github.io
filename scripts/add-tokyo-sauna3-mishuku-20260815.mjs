import { readFile, writeFile } from "node:fs/promises";

const base = "/home/ubuntu/hitori-source/data/hitori";
const facilityId = "manual-tokyo-sauna3-mishuku-20260815";
const checked = "2026-08-15";
const homeUrl = "https://s3cgrs.jp/";
const mapUrl = "https://msearch.gsi.go.jp/address-search/AddressSearch?q=%E6%9D%B1%E4%BA%AC%E9%83%BD%E4%B8%96%E7%94%B0%E8%B0%B7%E5%8C%BA%E4%B8%89%E5%AE%BF1-25-2";
const fact = (k, v, url = homeUrl, official = true) => ({
  conflict: false,
  k,
  n: 1,
  official,
  src: official ? [new URL(url).hostname] : ["一人マップ監査"],
  urls: official ? [url] : [],
  v,
});

const [prefText, curatedText, summaryText] = await Promise.all([
  readFile(`${base}/pref/13.json`, "utf8"),
  readFile(`${base}/curated.json`, "utf8"),
  readFile(`${base}/summary.json`, "utf8"),
]);
const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const summary = JSON.parse(summaryText);
if (pref.items.some(row => row[0] === facilityId) || curated[facilityId]) {
  throw new Error("Sauna3は既に静的データへ存在します。二重登録を停止しました。");
}

pref.items.push([
  facilityId, "Sauna3", 35.648804, 139.673187, "bath", "private_sauna",
  5, 4, 4, 4, 0, 0, 0, 0, "世田谷区",
  "08:00-24:10（不定休）", "080-3478-8026", homeUrl,
  "公式に1名プランを掲載する完全個室サウナ。利用人数・部屋別設備・同性利用条件を予約前に確認。会話ルールは公式未確認。", 5, 4, 4, checked,
]);
curated[facilityId] = {
  checked,
  facts: [
    fact("solo_ok", "公式は2階QUICK ROOMの60分・140分、3階VIP ROOMの80分・180分について、いずれも「1名様」プランを掲載。"),
    fact("price", "公式の平日料金は2階QUICK ROOMが60分2,200円、140分4,400円。3階VIP ROOMが80分6,000円、180分12,000円。土日祝は追加300円を案内。"),
    fact("hours", "公式は営業時間08:00〜24:10、不定休と案内。"),
    fact("towel", "公式は1人あたりバスタオル・フェイスタオル各1枚を用意し、2階に化粧水・乳液、3階にクレンジング等のスキンケアセットを案内。"),
    fact("reservation", "公式はWeb、直接来店、電話での予約を案内。Web予約はクレジットカード決済、店頭ではクレジットカード、Apple Pay、交通系IC、各種QR決済を案内。"),
    fact("private_room", "公式は2階をドライサウナと冷水/温水シャワーの1名プラン、3階をドライ/スチームサウナ、水風呂、温水シャワーの1〜3名プランとして案内。"),
    fact("conditions", "公式は3階VIP ROOMを同性同士の利用に限定し、全室禁煙、キャンセルは予約日前日17:00まで無料と案内。"),
    fact("silence", "会話環境の公式ルールは今回確認できないため、利用前に要確認。", homeUrl, false),
  ],
  sources: [homeUrl, mapUrl],
};
summary.total += 1;
summary.checked_count += 1;
await Promise.all([
  writeFile(`${base}/pref/13.json`, `${JSON.stringify(pref)}\n`),
  writeFile(`${base}/curated.json`, `${JSON.stringify(curated, null, 1)}\n`),
  writeFile(`${base}/summary.json`, `${JSON.stringify(summary)}\n`),
]);
console.log(JSON.stringify({ facilityId, total: summary.total, checkedCount: summary.checked_count, factCount: curated[facilityId].facts.length, sourceCount: curated[facilityId].sources.length }, null, 2));
