import fs from "node:fs/promises";
import path from "node:path";

const root = "/home/ubuntu/hitori-source/data/hitori";
const id = "manual-kanagawa-loylyland-kawasaki-20260813";
const homeUrl = "https://www.loylyland.com/";
const [prefText, curatedText, summaryText, pageText] = await Promise.all([
  fs.readFile(path.join(root, "pref/14.json"), "utf8"),
  fs.readFile(path.join(root, "curated.json"), "utf8"),
  fs.readFile(path.join(root, "summary.json"), "utf8"),
  fs.readFile("/home/ubuntu/hitori-source/hitori.html", "utf8"),
]);
const pref = JSON.parse(prefText);
const curated = JSON.parse(curatedText);
const summary = JSON.parse(summaryText);
const rows = pref.items.filter(row => row[0] === id);
if (rows.length !== 1) throw new Error(`神奈川県データの対象件数が不正です: ${rows.length}`);
const row = rows[0];
if (row.length !== 23 || row[1] !== "ロウリューランド川崎" || row[5] !== "private_sauna" || row[14] !== "川崎市川崎区" || row[15] !== "Mo-Fr 10:00-23:00; Sa-Su,PH 10:00-20:00; Th off" || row[22] !== "2026-08-13") {
  throw new Error("静的施設配列の公式登録値が不正です。");
}
const entry = curated[id];
if (!entry || entry.checked !== "2026-08-13" || entry.facts?.length !== 6) throw new Error("確認済み情報が不正です。");
const expectedKeys = ["conditions", "hours", "price", "reservation", "solo_ok", "towel"];
if (entry.facts.map(fact => fact.k).sort().join(",") !== expectedKeys.join(",")) throw new Error("確認済み情報の種類が不正です。");
if (!entry.facts.every(fact => fact.official && fact.urls?.includes(homeUrl))) throw new Error("公式根拠URLが不正です。");
if (!pageText.includes('conditions:"利用条件"') || !pageText.includes('towel:"タオル"')) throw new Error("確認済み情報の日本語ラベルが不正です。");
if (summary.total !== 40572 || summary.checked_count !== Object.keys(curated).length || summary.checked_count !== 754) throw new Error("全国集計が不正です。");
console.log(JSON.stringify({ status: "ok", id, total: summary.total, checkedCount: summary.checked_count }, null, 2));
