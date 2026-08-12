import fs from 'node:fs/promises';

const html = await fs.readFile('/home/ubuntu/hitori-source/hitori.html', 'utf8');
if (!html.includes('const dataRevision = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;')) {
  throw new Error('データ更新識別子がありません。');
}
if (!html.includes('const loadJson = path => fetch(`${path}?v=${dataRevision}`,{cache:"no-store"})')) {
  throw new Error('キャッシュ回避付きJSON取得処理がありません。');
}
if (html.includes('fetch("data/hitori/summary.json").then') || html.includes('fetch(`data/hitori/pref/${String(code).padStart(2,"0")}.json`).then')) {
  throw new Error('旧キャッシュ可能な静的データ取得処理が残っています。');
}
console.log(JSON.stringify({ status: 'ok', cacheStrategy: 'session-revision + no-store' }, null, 2));
