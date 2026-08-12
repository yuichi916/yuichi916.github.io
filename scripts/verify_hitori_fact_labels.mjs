import fs from "node:fs/promises";

const html = await fs.readFile("/home/ubuntu/hitori-source/hitori.html", "utf8");
if (!html.includes('towel:"タオル"')) throw new Error("towelの日本語表示辞書がありません。");
if (!html.includes("FACT[f.k]||f.k")) throw new Error("確認済み情報が表示辞書を利用していません。");
console.log(JSON.stringify({ status: "ok", towelLabel: "タオル" }, null, 2));
