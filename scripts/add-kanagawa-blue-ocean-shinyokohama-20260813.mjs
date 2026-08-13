import { readFile, writeFile } from "node:fs/promises";

const base = "/home/ubuntu/hitori-source/data/hitori";
const facilityId = "manual-kanagawa-blue-ocean-shinyokohama-20260813";
const checked = "2026-08-13";
const officialUrl = "https://blueocean.homepage.jp/";
const rateUrl = "https://blueocean.homepage.jp/firstvisitors";
const accessUrl = "https://blueocean.homepage.jp/access";
const mapUrl = "https://map.yahoo.co.jp/v3/place/m5aVFgKNFOE/map";
const fact = (k, v, official = true, urls = [rateUrl]) => ({
  conflict: false,
  k,
  n: 1,
  official,
  src: official ? ["blueocean.homepage.jp"] : ["一人マップ監査"],
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
  throw new Error("サウナリゾート＆スパ ブルーオーシャンは既に静的データへ存在します。二重登録を停止しました。");
}

pref.items.push([
  facilityId, "サウナリゾート＆スパ ブルーオーシャン", 35.51017744, 139.6148763, "bath", "spa",
  3, 3, 3, 3, 0, 0, 0, 0, "横浜市港北区",
  "24時間営業（24:00〜翌9:00はナイト利用で一部サービス終了／年中無休、臨時休業あり）", "045-594-7939", officialUrl,
  "公式に一般利用料金・設備・利用条件を確認。一般利用の一人利用明示と会話ルールは要確認。", 3, 3, 3, checked,
]);
curated[facilityId] = {
  checked,
  facts: [
    fact("price", "一般利用3時間は平日1,750円、土日祝・特定日2,050円、平日ナイト3,980円、土日祝・特定日ナイト4,500円（税別）。6時間は平日2,900円、土日祝・特定日3,320円。"),
    fact("hours", "24時間営業・年中無休（メンテナンス等で臨時休業あり）。24:00〜翌9:00はナイト利用で一部サービス終了。"),
    fact("towel", "シャンプー、コンディショナー、ボディーソープあり。タオルは250円、バスタオルレンタル250円、岩盤着・大判タオルセット500円。"),
    fact("payment_method", "支払いは現金のみ。下足ロッカー利用後に券売機でチケットを購入し、フロントで受付。"),
    fact("conditions", "タトゥーはシール等で隠すこと。飲食物持込不可、生理中のサウナ・浴槽利用不可、15歳未満利用不可。暴力団関係者・泥酔者は入場不可。"),
    fact("silence", "一人利用の個別案内と会話環境の公式ルールは確認できないため、利用前に要確認。", false),
  ],
  sources: [officialUrl, rateUrl, accessUrl, mapUrl],
};
summary.total += 1;
summary.checked_count += 1;

await Promise.all([
  writeFile(`${base}/pref/14.json`, `${JSON.stringify(pref)}\n`),
  writeFile(`${base}/curated.json`, `${JSON.stringify(curated, null, 1)}\n`),
  writeFile(`${base}/summary.json`, `${JSON.stringify(summary)}\n`),
]);
console.log(JSON.stringify({ facilityId, total: summary.total, checkedCount: summary.checked_count, factCount: curated[facilityId].facts.length }, null, 2));
