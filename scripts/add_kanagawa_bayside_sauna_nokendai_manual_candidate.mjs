import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const repo = "/home/ubuntu/hitori-source";
const root = path.join(repo, "data/hitori");
const id = "manual-kanagawa-bayside-sauna-nokendai-20260813";
const checked = "2026-08-13";
const officialUrl = "https://bayside-sauna.com/price";
const readHead = file => execFileSync("git", ["-C", repo, "show", `HEAD:${file}`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const [prefBase, curatedBase, summaryBase] = [readHead("data/hitori/pref/14.json").trim(), readHead("data/hitori/curated.json").trimEnd(), readHead("data/hitori/summary.json").trim()];
if (curatedBase.includes(`"${id}"`) || !curatedBase.endsWith("\n}")) throw new Error("確認済みデータのIDまたは末尾形式が想定外です。");
const pref = JSON.parse(prefBase);
if (pref.items.some(item => item[0] === id)) throw new Error("神奈川県データに対象IDが既にあります。");
const row = [id, "BAYSIDE SAUNA", 35.36177724194611, 139.62943656644933, "bath", "private_sauna", 5, 4, 4, 2, 0, 0, 0, 0, "横浜市金沢区", "5:00-23:00（定休日: 水曜。営業する場合あり）", "090-8019-7658", officialUrl, "公式に完全個室・シングル料金・予約締切・無人運営・男女ペア不可を確認。タオルは都度利用では有料、サブスクでは無料貸出と区分される。", 5, 4, 4, checked];
if (row.length !== 23) throw new Error(`静的施設配列が23列ではありません: ${row.length}`);
pref.items.push(row);
const src = ["https://bayside-sauna.com/", officialUrl];
const fact = (k, v, urls = src) => ({ conflict: false, k, n: 1, official: true, src: ["bayside-sauna.com"], urls, v });
const curated = { checked, facts: [
  fact("solo_ok", "完全個室で、都度利用のシングル60分・90分・120分を公式料金表に掲載。"),
  fact("price", "シングルは60分3,000円、90分4,000円、120分5,800円（税込）。", [officialUrl]),
  fact("reservation", "予約サイトで会員登録後に空き状況確認・予約。午前は前日23時、午後は開始150分前が予約締切。", [officialUrl]),
  fact("hours", "予約枠は5:00〜23:00。定休日は毎週水曜（営業する場合あり）。", [officialUrl]),
  fact("towel", "サウナマット・冷感バブ・アロマ水・ブロック氷は無料。都度利用のタオルは200円、バスタオルは300円。サブスクはタオル・サウナハット無料貸出。", [officialUrl]),
  fact("silence", "完全個室・完全無人運営と案内。会話ルールは公式に確認できないため、会話負荷は要確認。"),
  fact("conditions", "男女ペア利用不可。水着は任意。", [officialUrl]),
], sources: [] };
const summary = JSON.parse(summaryBase);
const entry = ` "${id}": ${JSON.stringify(curated, null, 1).replace(/\n/g, "\n ")}`;
await Promise.all([
  fs.writeFile(path.join(root, "pref/14.json"), `${JSON.stringify(pref)}\n`),
  fs.writeFile(path.join(root, "curated.json"), `${curatedBase.slice(0, -2)},\n${entry}\n}\n`),
  fs.writeFile(path.join(root, "summary.json"), `${summaryBase.replace(`"total":${summary.total}`, `"total":${summary.total + 1}`).replace(`"checked_count":${summary.checked_count}`, `"checked_count":${summary.checked_count + 1}`)}\n`),
]);
console.log(JSON.stringify({ status: "ok", id, total: summary.total + 1, checkedCount: summary.checked_count + 1, row }, null, 2));
