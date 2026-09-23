# itch.io 投稿用テキスト（3作品・英語＋日本語）

投稿先: https://itch.io/
形式: HTML ゲームを zip でアップロードして「Play in browser」で公開する。
外部サイトへのリンクだけでも出せるが、browser-playable にした方が遊ばれる。

共通設定:
- **Kind of project**: HTML
- **Pricing**: No payments（無料）
- **Classification**: Games
- **Genre**: Visual Novel
- **Release status**: Released
- **Average session**: 15–30 minutes / A few hours（作品による）
- **Inputs**: Mouse, Touchscreen, Keyboard
- **Accessibility**: Subtitles, Configurable controls
- **Links**: Homepage → https://yuichi916.github.io/

itch.io は英語圏が主戦場なので、**英語を主、日本語を従**にする。
このサイトは 7 言語に対応しているので、そこを前面に出すのが一番効く。

---

## 1. The Outside of the Answer（正解の外側）

**Title**
```
The Outside of the Answer / 正解の外側
```

**Short description（ストア一覧に出る 1 行）**
```
A boy who can see the correct path meets the one girl it never shows him. 15 episodes, fully voiced, free in your browser — in 7 languages.
```

**Description（本文）**
```
Deep in the Abyss, on the lowest floor, a boy was called by a number.

Five-one-seven. That was the name of sixteen-year-old Kai. He handled toxic waste with bare hands and slept on grey paste. And he had a secret he could tell no one: once he decided on a goal, the correct path to it appeared before his eyes, a golden line.

Then he met a silver-haired girl with no memory — the only person his golden line refused to show.

**Play free in your browser · no install, no account**

■ What's in it
- 15 episodes, fully voiced
- Branching endings
- 360° rendered backgrounds
- Runs on phones and desktops
- 7 languages: English / 日本語 / 中文(简/繁) / 한국어 / Español / Français / Deutsch

■ How it was made
Built by one person with AI as a partner: the script, the voices, the 360° backgrounds (Blender), and the engine itself — a single HTML file plus assets, no server. The full technical write-up is here:
https://yuichi916.github.io/seikai-tech-guide.html

---

地下世界アビス、最下層。「廃棄層」と呼ばれる場所で、少年は番号で呼ばれていました。

五一七——それが、十六歳の少年カイの名前です。目的を決めると、そこへ至る「正解」の道筋が金色の線になって視えてしまう。ある日カイは、記憶のない銀髪の少女と出会います。彼女だけが、カイの道筋に映らなかった。

全15話・フルボイス・分岐エンド。ブラウザだけで、無料で最後まで読めます。7言語対応。
```

**Tags**
```
visual-novel, sound-novel, story-rich, sci-fi, dystopian, fully-voiced, multiple-endings, free, browser, japanese
```

**Links to add**
- Play (external): https://yuichi916.github.io/seikai.html
- Series site: https://yuichi916.github.io/seikai-saga.html
- Opening movie: https://www.youtube.com/watch?v=AYpOA6ArBCg

---

## 2. A Hundred Misdeeds（百の悪行）

**Title**
```
A Hundred Misdeeds / 百の悪行
```

**Short description**
```
The hero killed the Demon Lord. Now he is checking all one hundred charges against him, one by one. A 30-minute fully-voiced sound novel, free in 7 languages.
```

**Description**
```
The Demon Lord is dead. The hero did it. Everyone agrees he deserved it — there is, after all, a Catalogue of Misdeeds, One Hundred Counts, and the kingdom read it aloud at the victory feast.

So the hero starts checking them. Count one. Count two.

He should have stopped there.

**A 30-minute read. Fully voiced, illustrated, free in your browser.**

■ What's in it
- About 30 minutes, one sitting
- Fully voiced, with illustrations
- 7 languages: English / 日本語 / 中文(简/繁) / 한국어 / Español / Français / Deutsch
- No install, no account, works on phones

■ If you like
Inverted detective stories (the crime is known, the question is *what really happened*), unreliable records, and villains who are not what the paperwork says.

---

魔王を討った勇者が、『悪行目録・全百条』を一条ずつ検証していく偽悪の短編サウンドノベル。フルボイス・挿絵つき・約30分。7言語対応。ブラウザだけで無料で読めます。
```

**Tags**
```
visual-novel, sound-novel, short, story-rich, fantasy, mystery, fully-voiced, free, browser, japanese
```

**Links to add**
- Play (external): https://yuichi916.github.io/hyaku.html

---

## 3. Kototsugi（ことつぎの星）

**Title**
```
Kototsugi — The Star That Fell Into Words / ことつぎの星
```

**Short description**
```
Words wash up on the shore like driftwood. Fit them into the gaps in the story, and the story changes. A free browser sound novel.
```

**Description**
```
A star fell, and the language broke with it.

On this island, fragments of words wash up on the beach every morning. A boy who gathers them meets a girl who remembers nothing — and together they begin fitting the fragments into the gaps in old, half-erased texts.

Every word you choose changes what the story becomes.

**Free in your browser · no install, no account**

■ What makes it different
The choices are not "pick option A or B". You are handed the actual missing words, and the sentence you complete is the sentence the world then has to live with.

---

星が堕ち、言葉のかけらが浜に打ち上がる島。言葉を拾う少年と、記憶のない少女。文章の「欠け」に言葉を継ぐと、物語そのものが書き換わります。無料で遊べるブラウザサウンドノベル。
```

**Tags**
```
visual-novel, sound-novel, story-rich, wordplay, fantasy, atmospheric, free, browser, japanese
```

**Links to add**
- Play (external): https://yuichi916.github.io/kototsugi/game/
- Official page: https://yuichi916.github.io/kototsugi/

---

## 投稿後にやること

1. 3 作品を **Collection**（例: "Browser sound novels in 7 languages"）にまとめる
2. プロフィール（itch.io の Profile）に https://yuichi916.github.io/ を入れる
3. プロフィール URL をメモして、サイトの「外の窓」に追加する
   → `scripts/bake_windows.py` の「作品の投稿先」グループに 1 行足して
     `python scripts/bake_windows.py` を実行
