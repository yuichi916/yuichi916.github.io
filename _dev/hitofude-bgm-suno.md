# 一筆花火の BGM を Suno で作る

ゲームは、BGM のファイルが無いあいだ、ブラウザの中で合成した曲を流します。
この合成曲は、D の陽音階・96 BPM で、琴・太鼓・鉦・篠笛の音を重ねています。

Suno で作った曲を置けば、そちらに切り替わります。受け口は次の 2 つです。

- `assets/hitofude/bgm/tracks.json`: 曲の登録表
- `assets/hitofude/music.js`: 再生の仕組み

曲の使い分けは次のとおりです。

| 枠 | いつ鳴るか | ねらい |
|---|---|---|
| `calm` | タイトル・線を考えているあいだ | 落ち着いた夏の夜。ずっとループする |
| `burn` | 火が走って連鎖しているあいだ | 祭りの太鼓で一気に盛り上げる。連鎖のたびに頭から流れる |
| `finale` | 満開（全部ひらいた）の瞬間 | 4〜8 秒のファンファーレ |

- `calm` と `burn` はテンポがちがってよく、重ねずに切り替えます。`burn` の曲が無いときは、火が走るあいだも `calm` のままです。
- `burn` は毎回ファイルの頭から鳴ります。頭から太鼓が鳴っているテイクを選んでください。

---

## 1. プロンプト（Custom モード、Instrumental ON）

Instrumental を ON にすると Lyrics 欄が消える版があるかもしれません（未確認）。
その場合は Instrumental を OFF にし、Lyrics 欄に下のタグだけを入れてください。
アーティスト名は入れないでください。入れると弾かれます。

### (A) calm: 線を考えているあいだ

- **Title**: `Hitofude Hanabi - Planning`
- **Style**:
  ```
  Japanese summer night lo-fi, instrumental, 90 BPM, D major pentatonic, soft shinobue flute, koto plucks, wind chimes, warm pad, brushed drums, steady groove, no intro, loopable
  ```
- **Exclude**:
  ```
  vocals, singing, humming, choir, spoken word, rap, EDM drop, dubstep, heavy distortion, tempo change, fade out, long intro
  ```
- **Lyrics**（1 行に 1 タグ）:
  ```
  [Instrumental]
  [Main Theme]
  [Groove]
  [Main Theme]
  [Groove]
  [Main Theme]
  [End]
  ```

### (B) burn: 火が走っているあいだ

- **Title**: `Hitofude Hanabi - Chain`
- **Style**:
  ```
  Japanese matsuri festival, instrumental, 135 BPM, D major pentatonic, driving taiko and shime-daiko, atarigane, bright shinobue lead, shamisen riffs, energetic, starts on downbeat, loopable
  ```
- **Exclude**:
  ```
  vocals, singing, humming, choir, chanting, shouts, spoken word, rap, EDM drop, dubstep, metal, tempo change, fade out, long intro
  ```
- **Lyrics**:
  ```
  [Instrumental]
  [Taiko Drum Break]
  [Main Theme]
  [Shamisen Riff]
  [Main Theme]
  [Taiko Drum Break]
  [End]
  ```

祭りものは掛け声が混ざりやすいので、Exclude に chanting / shouts を入れています。

### (C) finale: 満開の瞬間

- **Title**: `Hitofude Hanabi - Finale`
- **Style**:
  ```
  Triumphant Japanese festival fanfare, instrumental, D major, taiko roll, shinobue flourish, shamisen strum, big final hit, short sting
  ```
- **Exclude**:
  ```
  vocals, singing, choir, spoken word, long intro, fade out, sad, minor key
  ```
- **Lyrics**:
  ```
  [Instrumental]
  [Short Intro]
  [Fanfare]
  [Final Hit]
  [End]
  ```

4〜8 秒の曲を直接作れるかは未確認です。
作れなければ、生成した曲の最後の 4〜8 秒を切り出して使ってください。

---

## 2. 作り方の手順

1. **生成**: Create → Custom を開き、上のプロンプトを貼ります。1 曲につき 2〜3 回生成します。
2. **選ぶ**: 次の 3 つを満たすテイクを選びます。
   - 声が入っていない
   - テンポが最後まで一定
   - 途中で曲調が変わらない

   (B) は、頭から太鼓が鳴っているものを選んでください。
3. **ダウンロード**: WAV があれば WAV で落とします（有料プランのみ）。無ければ MP3 で構いません。
4. **ループ区間を切る**: Audacity などで、曲の中盤を「小節の頭から小節の頭まで」の長さで切ります。
   - 90 BPM を 24 小節切ると 64.0 秒、135 BPM を 36 小節切ると 64.0 秒になります。
   - 切る位置は、波形がゼロをまたぐ点（ゼロクロス）にします。
   - 20 回ほどループさせて聴き、つなぎ目の「プチッ」が無いか確かめます。
5. **音量をそろえる**: 3 曲とも -16 LUFS、ピークは -1 dBTP 以下にそろえます。
6. **書き出し**: MP3 160kbps で書き出します。どのブラウザでも鳴ります。
7. **置いて登録する**
   - ファイル名は英数字・`_`・`-` だけにして、`assets/hitofude/bgm/` に置きます。
   - `tracks.json` に登録します。

   ```json
   {
     "calm":   { "src": "hitofude_calm_d90.mp3",  "loopStart": 0,    "loopEnd": 64.0, "gain": 0.8 },
     "burn":   { "src": "hitofude_burn_d135.mp3", "loopStart": 0,    "loopEnd": 64.0, "gain": 0.8 },
     "finale": { "src": "hitofude_finale.mp3",    "gain": 0.9 }
   }
   ```

   - `loopStart` / `loopEnd` はループさせる区間で、単位は秒です。前後に余白を残して書き出した場合は、その秒数を書きます。
   - `gain` は音量です。1 のとき等倍です。
   - src には、このフォルダのファイル名しか書けません。外部の URL やパスは、ページが読み込みません。

**手順 4〜7 は、道具で自動にできます。** 落とした曲をそのまま渡すと、次の処理を 1 回でまとめてやります。

- 継ぎ目の前後がいちばんよく似る小節の頭を探して、ループを切り出す
- -16 LUFS にそろえる
- MP3 にする
- `tracks.json` に登録する

```
node _dev/hitofude-bgm-prep.mjs calm   _local/suno/calm.mp3   --bpm 90
node _dev/hitofude-bgm-prep.mjs burn   _local/suno/burn.mp3   --bpm 135
node _dev/hitofude-bgm-prep.mjs finale _local/suno/finale.mp3 --len 6
```

- 使うには playwright と `@breezystack/lamejs` が要ります。ffmpeg は要りません。
- `--dry` を付けると、書き出さずに、選んだ区間と音量だけを表示します。
- 継ぎ目が気になるときは、`--start 秒` で別の所から切ってください。
- 合成した曲で試した結果、96 BPM・8 小節のループを 20.009 秒で見つけました。MP3 にしたあとも、継ぎ目の段差は、ふだんの隣り合う音の差の範囲に収まっています。

---

## 1.5 Suno を Playwright で操作する（手元の PC で）

クラウドのセッションからは Suno に届きません。環境のネットワーク設定で suno.com 系が止められています。
それに、クラウドのブラウザには、人がログインする画面がありません。
そのため、Suno の操作は**手元の PC で動く Claude Code**（Claude Desktop、またはリポジトリのフォルダで `claude remote-control`）から行います。

1. 作業用の Chrome をリモートデバッグ付きで開き、Suno にログインします。コマンドは `_dev/suno-session.mjs` の先頭にあります。
   - Playwright が起動したブラウザだと、Google などのログインが弾かれることがあります。そのため、人が開いた Chrome にあとからつなぎます。
2. `node _dev/suno-session.mjs inspect` を実行します。Create 画面を撮り、ボタンと入力欄の名前を `_local/suno/` に書き出します。この時点では、まだ何も押しません。
3. その地図を見て、プロンプトを入れる → Create → 待つ → ダウンロード、の手順を足します。
   - 画面の作りは変わるので、推測でボタンを押してクレジットを使うことはしません。
4. 落とした曲を `_local/suno/` に置き、上の `hitofude-bgm-prep.mjs` で仕上げます。`_local/suno/` は git に入りません。

注意: 自動での操作は、Suno の利用規約で禁じられている可能性があります（本文は未確認です）。アカウントへの影響は、使う人の判断でお願いします。
手で作って落とすだけなら、3 曲 × 2〜3 テイクで 10 分ほどです。

---

## 3. 規約とプランについて（2026-09-26 時点の調べ）

注意: 公式ページの本文は読めていません。以下は、公式ヘルプとブログの検索結果の抜粋を元にしています。公開する前に、必ず最新の規約を公式ページで確かめてください。

- **無料プラン**
  - 作った曲の用途は、個人の非営利に限られます。曲の所有者は Suno です。
  - 広告の無い個人サイトは、この範囲に入ると読めます。ただ、ファイルを公開して配ることを明示的に認めた文言は見つかっていません。
- **Pro / Premier（有料）**
  - 作った曲の権利が作成者に渡ります。
  - 有料期間中に落とした曲は、解約後も自分のものです。
  - ただし、無料期間に作った曲には、後から加入しても権利がさかのぼって付きません。
- **クレジット表記**: 不要とされています。
- **ダウンロード回数**: 2026 年 9 月から、プランごとに制限が付きました。無料は試用分だけで、有料はプランごとに毎月の回数が決まっています。
- **いちばん安全なやり方**: 有料プランに 1 か月だけ入り、その間に作ってダウンロードする。

参考（検索で見つけた公式ページ）:
- https://help.suno.com/en/articles/9601601
- https://help.suno.com/en/articles/2416769
- https://help.suno.com/en/articles/2425729
- https://suno.com/terms-of-service
- https://suno.com/blog/suno-updates-tos
