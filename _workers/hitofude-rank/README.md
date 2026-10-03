# hitofude-rank（一筆花火「今夜の一筆」のランキング）

`hitofude.html` の「今夜の一筆」の日間ランキングを受け持つ Cloudflare Worker です（D1 に保存）。

- 夜を越えるたびに、ページがその夜だけを送ります（`POST /night`）。
- サーバーは 1 夜ずつ、本物のルール（`assets/hitofude/core.js`）で線を燃やしなおして点を確かめます。確かめるもの:
  - お守りは候補に出ていたものか
  - 屋台の星は足りていたか
  - 予備の提灯は残っていたか
- 点は、ページが送った数字ではなく、サーバーが燃やしなおした点を使います。
- 無料の枠（1 回 10ms ほど）に収まるよう、重い願い札は日ごとに前もって作った表（`src/wishes.js`）を使います。
- 名前は `assets/hitofude/names.js` で確かめます（12 字まで。URL・不適切な言葉は不可）。すり抜けた名前は、管理用の合言葉で隠せます。
- ページは `GET /health` が返事をしたときだけ、ランキングのボタンを出します。Worker を置く前にサイトを公開しても、ランキングが出ないだけで遊べます。

## はじめての準備（1 回だけ）

```bash
cd _workers/hitofude-rank
npm install
npx wrangler login                       # ブラウザが開く
npx wrangler d1 create hitofude-rank     # database_id が出る
```

出てきた `database_id` を、`wrangler.toml` の `REPLACE_AFTER_D1_CREATE` と入れかえます。

```bash
npx wrangler d1 execute hitofude-rank --remote --file=schema.sql   # 表を作る
npx wrangler secret put ADMIN_TOKEN       # 管理用の合言葉（自分で決めた長い文字列）を入力する
npx wrangler deploy
```

デプロイ先が `https://hitofude-rank.yuichi916.workers.dev` でないときは、`hitofude.html` の `RANK_API` を、出てきた URL に変えてください。

## 手元で確かめる

```bash
npx wrangler d1 execute hitofude-rank --local --file=schema.sql
echo "ADMIN_TOKEN=<手元用の合言葉>" > .dev.vars     # .dev.vars は git に入らない
npx wrangler dev --local --port 8787
# 別の窓で
RANK_URL=http://127.0.0.1:8787 ADMIN_TOKEN=<手元用の合言葉> node test/worker.test.mjs
```

ページを手元のサーバーにつなぐときは、`http://127.0.0.1:8765/hitofude.html?rankapi=http://127.0.0.1:8787` のように開きます（`?rankapi=` は localhost のときだけ効く）。

## ゲームのルールを変えたとき（順番が大事）

サーバーはデプロイしたときの `core.js` で確かめます。ルール（盤の作り方・点・お守り・願い札）を変えたら、次の順で行います。

1. `core.js` の `REPLAY_VERSION` を 1 つ上げる（ページとサーバーの版を見分けるため）
2. `npm run wishes`（願い札の表を作りなおす。数分かかる）
3. `npx wrangler deploy`
4. サイトを公開する

版が合わない間は、ページは「ランキングは新しい版の準備中」と出し、ランキングに送りません。

## 毎年の作業

願い札の表は、今は 2026-10-01 から 457 日ぶん（2027-12-31 まで）です。切れる前に作り足してデプロイします。

```bash
npm run wishes -- 2027-12-01 400
npx wrangler deploy
```

表に無い日は、ページが送る願い札の星（2 まで）をそのまま受けます。点の確かめは、表が無くても変わりません。

## 名前を隠す（管理）

合言葉は、端末の環境変数から読みます（コマンドに直接書かない）。

```bash
export ADMIN_TOKEN=...   # wrangler secret put で入れたものと同じ
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "https://hitofude-rank.yuichi916.workers.dev/admin/list?day=2026-10-04"
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"day":"2026-10-04","player":"<list に出た player>","hidden":1}' https://hitofude-rank.yuichi916.workers.dev/admin/hide
```

`hidden` を `0` にすると、もとに戻ります。

## 無料の枠について

1 夜を確かめる重さは、ふつう 2〜6ms、強いお守りがそろう終盤の夜で 11ms ほどです。
無料の枠を越えた夜は失敗することがあります。そのときページは 2 回までやりなおし、だめならその祭りはそこまでの点で止まります。
失敗が目立つようなら、Workers Paid（月 5 ドル）にすると、上限が大きくなります。
