import { readFile, writeFile } from "node:fs/promises";

const base = "/home/ubuntu/hitori-source/data/hitori";
const facilityId = "manual-tokyo-sava-ikejiri-20260813";
const checked = "2026-08-15";
const homeUrl = "https://sava.storeinfo.jp/";
const priceUrl = "https://sava.storeinfo.jp/pages/7161184/menu";
const flowUrl = "https://sava.storeinfo.jp/pages/7161263/page_202307262222";
const accessUrl = "https://sava.storeinfo.jp/pages/7161262/page_202307262221";
const mapUrl = "https://local.google.co.jp/maps?q=%E6%9D%B1%E4%BA%AC%E9%83%BD%E4%B8%96%E7%94%B0%E8%B0%B7%E5%8C%BA%E6%B1%A0%E5%B0%BB3-23-5";
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
  throw new Error("会員制個室サウナ サバ？は既に静的データへ存在します。二重登録を停止しました。");
}

pref.items.push([
  facilityId, "会員制個室サウナ サバ？", 35.648287, 139.679508, "bath", "private_sauna",
  4, 4, 3, 3, 0, 0, 0, 0, "世田谷区",
  "", "", homeUrl,
  "完全個室・最大2名の公式案内あり。公式は一人利用を直接明示していないため、1名利用可とは扱わず予約時に要確認。", 4, 4, 3, checked,
]);
curated[facilityId] = {
  checked,
  facts: [
    fact("price", "公式の体験利用は120分平日5,800円〜、休日10,300円〜。初回新規のみ1回限り・2名まで・入会金不要。会員向けスポット等は120分5,800円〜11,700円で、金額変動の可能性を案内。", priceUrl),
    fact("reservation", "公式の利用の流れは事前予約が必須とし、原則として電話予約・直接来店では利用できないと案内。", flowUrl),
    fact("towel", "公式はバスタオル2枚、化粧水、洗顔フォーム、クレンジング、シャンプー、コンディショナー、ボディソープ等を案内。水着は持参で貸出なし。", flowUrl),
    fact("conditions", "公式は水着着用、最大2名、18歳未満利用不可、予約60分前を過ぎるとキャンセル不可を案内。健康状態等による利用制限は公式規約を確認。", priceUrl),
    fact("private_room", "公式は約50.24㎡の完全個室にサウナ、シャワー、トイレ、パウダールームを設け、定員を最大2名と案内。公式の一人利用個別明示は確認できないため、1名利用可とは扱わない。", homeUrl),
    fact("silence", "会話環境の公式ルールは今回確認できないため、利用前に要確認。", homeUrl, false),
  ],
  sources: [homeUrl, priceUrl, flowUrl, accessUrl, mapUrl],
};
summary.total += 1;
summary.checked_count += 1;

await Promise.all([
  writeFile(`${base}/pref/13.json`, `${JSON.stringify(pref)}\n`),
  writeFile(`${base}/curated.json`, `${JSON.stringify(curated, null, 1)}\n`),
  writeFile(`${base}/summary.json`, `${JSON.stringify(summary)}\n`),
]);
console.log(JSON.stringify({ facilityId, total: summary.total, checkedCount: summary.checked_count, factCount: curated[facilityId].facts.length, sourceCount: curated[facilityId].sources.length }, null, 2));
