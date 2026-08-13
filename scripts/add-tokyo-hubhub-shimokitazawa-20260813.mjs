import { readFile, writeFile } from "node:fs/promises";

const base = "/home/ubuntu/hitori-source/data/hitori";
const facilityId = "manual-tokyo-hubhub-shimokitazawa-20260813";
const checked = "2026-08-13";
const officialUrl = "https://hubhub.jp/facility/shimokitazawa";
const mapUrl = "https://local.google.co.jp/maps?q=%E6%9D%B1%E4%BA%AC%E9%83%BD%E4%B8%96%E7%94%B0%E8%B0%B7%E5%8C%BA%E4%BB%A3%E6%B2%A25-8-6";
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
  readFile(`${base}/pref/13.json`, "utf8"),
  readFile(`${base}/curated.json`, "utf8"),
  readFile(`${base}/summary.json`, "utf8"),
]);
const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const summary = JSON.parse(summaryText);
if (pref.items.some(row => row[0] === facilityId) || curated[facilityId]) {
  throw new Error("HUBHUB下北沢は既に静的データへ存在します。二重登録を停止しました。");
}

pref.items.push([
  facilityId, "HUBHUB下北沢", 35.656175, 139.667593, "bath", "sauna",
  5, 2, 4, 3, 0, 0, 0, 0, "世田谷区",
  "月〜金・土日とも09:00〜23:00（メンテナンス等で臨時休業あり）", "080-4743-7536", officialUrl,
  "公式の一人歓迎・平日限定おひとりプランと、会話可能の案内を確認。静かな利用を望む場合は周囲の利用状況を要確認。", 5, 2, 4, checked,
]);
curated[facilityId] = {
  checked,
  facts: [
    fact("solo_ok", "公式は手ぶら・予約不要のパブリックサウナで「おひとり様も大歓迎」と案内し、平日限定の「おひとりととのいプラン」も掲載。"),
    fact("price", "公式掲載ではパブリックサウナ2,000円〜、平日限定おひとりととのいプラン3,000円〜、最大4名の貸切8,000円〜、最大6名の貸切10,000円〜。プラン・日時による変動は予約時に確認。"),
    fact("reservation", "パブリックサウナは予約不要。公式の利用の流れでは貸切を含む利用についてWEB予約から案内しているため、利用プランごとの予約要否は確認。"),
    fact("hours", "月〜金、土・日とも09:00〜23:00。定休日なし（施設メンテナンス等で臨時休業する場合あり）。"),
    fact("towel", "ドロップイン・プライベートサウナとも、無料フェイスタオル・バスタオル各1枚、化粧水、乳液、クレンジング、ヘアドライヤーを公式案内。"),
    fact("conditions", "未就学児および事前に利用規約へ同意できない人は利用不可。タトゥーがある人は貸切サウナのみ利用可。"),
    fact("silence", "公式FAQはHUBHUBのサウナをコミュニケーションの場とし、会話可能と案内。ただし他の利用者へ配慮するよう案内しているため、静かな利用を望む場合は要確認。"),
  ],
  sources: [officialUrl, mapUrl],
};
summary.total += 1;
summary.checked_count += 1;

await Promise.all([
  writeFile(`${base}/pref/13.json`, `${JSON.stringify(pref)}\n`),
  writeFile(`${base}/curated.json`, `${JSON.stringify(curated, null, 1)}\n`),
  writeFile(`${base}/summary.json`, `${JSON.stringify(summary)}\n`),
]);
console.log(JSON.stringify({ facilityId, total: summary.total, checkedCount: summary.checked_count, factCount: curated[facilityId].facts.length, sourceCount: curated[facilityId].sources.length }, null, 2));
