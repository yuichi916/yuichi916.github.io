import fs from "node:fs/promises";
import path from "node:path";

const root = "/home/ubuntu/hitori-source/data/hitori";
const id = "manual-fukuoka-sauna-ooo-fukuoka-20260813";
const [prefText, curatedText, summaryText] = await Promise.all([
  fs.readFile(path.join(root, "pref/40.json"), "utf8"),
  fs.readFile(path.join(root, "curated.json"), "utf8"),
  fs.readFile(path.join(root, "summary.json"), "utf8"),
]);
const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const summary = JSON.parse(summaryText);
const rows = pref.items.filter(row => row[0] === id);
if (rows.length !== 1) throw new Error(`福岡県データの対象件数が不正です: ${rows.length}`);
const row = rows[0];
if (row[2] !== 33.5934698 || row[3] !== 130.4047847) throw new Error("座標が不正です。");
if (row.length !== 23 || row[10] !== 1 || row[13] !== 1 || row[14] !== "福岡市" || row[22] !== "2026-08-13") {
  throw new Error("静的施設配列のチェーン判定・タオル・都市名・確認日が不正です。");
}
const entry = curated[id];
if (!entry || entry.checked !== "2026-08-13" || entry.facts?.length !== 4) throw new Error("確認済み情報が不正です。");
if (!entry.facts.every(fact => fact.official && fact.urls?.some(url => url === "https://ooo-sauna.com/fukuoka.html"))) {
  throw new Error("公式根拠URLが不正です。");
}
if (!entry.sources?.includes("https://map.yahoo.co.jp/v3/place/oIypGGhJJ_k/map")) throw new Error("地図根拠が不正です。");
const fukuoka = summary.prefectures.find(prefecture => prefecture.code === 40);
if (!fukuoka || summary.total < 40569 || summary.checked_count !== Object.keys(curated).length || fukuoka.counts.bath < 118) {
  throw new Error("福岡県または全国の集計が不正です。");
}
console.log(JSON.stringify({ status: "ok", id, total: summary.total, checkedCount: summary.checked_count, fukuoka: fukuoka.counts }, null, 2));
