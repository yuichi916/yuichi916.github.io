# ツナラベ！ 投稿サイト用の紹介文（2026-10-18 案）

遊ぶURLは投稿先ごとに `?ref=` を付ける（GoatCounter で流入元を数える）。
例: https://yuichi916.github.io/tsunagu-naraberu.html?ref=mugen

## 題名
- 日本語: ツナラベ！ — つなぐ×ならべる 異種対戦パズル
- itch.io / Game Jolt: Tsunarabe! / ツナラベ！

## キャッチコピー（1つ選ぶ）
- A: 消し方のちがう2つのパズルが、本気で対戦する。
- B: 4つつなげる派 vs 3つ並べる派。ルールのちがう対戦パズル。
- C: つなげて消すか、並べて消すか。ちがうルールで、同じ勝負。

## 紹介文（日本語・夢現／PLiCy／Tsukutta／ProtoPedia）

ルールのちがう2つのパズルが、直接ぶつかる対戦パズルです。

つなぐ派は、落ちてくる2個1組を積んで、同じ色を4つつなげて消す。
ならべる派は、せり上がる盤のパネルを入れ替えて、3つ並べて消す。
消し方はまるで別なのに、連鎖すればどちらも相手の盤におじゃまが降ります。

【遊びどころ】
・攻撃の予告が出てから3秒は降ってこない。その間に消し返せば、攻撃は自分の予告にぶつかって打ち消せる（相殺）
・つなぐ派は、組み上げてから一気に崩す大連鎖
・ならべる派は、消えている最中に次をつなげるアクティブ連鎖
・どちらの派で遊んでも、同じ腕前なら同じくらい勝てるように調整。人の腕前をまねたプレイヤーを、各段のCPUと400試合ずつ戦わせて確かめました

【モード】
・CPUと対戦（かんたん・やさしい・ふつう・つよい・おに）
・ふたりで対戦（1台のPC。キーボード／ゲームパッド）
・れんしゅう／あそびかた（相殺まで、手を動かして約1分で覚えられる）

【キャラクター】
つなぐ派のひなた・もも、ならべる派のりん・すず。連鎖のたびに声が入り、大きな連鎖ではカットインが出ます。

【動作環境】
ブラウザ（PC・スマホ）。インストール不要・無料。スマホはタッチ操作でCPUと対戦できます。

【制作について】
音楽・効果音は Suno、キャラクターの声は ElevenLabs、キャラクターの絵は Stable Diffusion（WAI-Illustrious）で作成。プログラムは生成AI（Claude）と一緒に書きました。

[English]
Tsunarabe! is a versus puzzle where two different puzzle rules fight head to head. One side stacks falling pairs and links four of a color; the other swaps panels on a rising board to line up three. Chains on either side drop garbage on the opponent, and an incoming attack can be cancelled out during its 3-second warning. CPU battles with five difficulty levels, plus local 2-player on one PC. The interface is in Japanese.
Music & SFX: Suno / Voices: ElevenLabs / Character art: Stable Diffusion (WAI-Illustrious) / Code written with Claude.

## タグ
パズル, 対戦, 落ち物, 連鎖, ブラウザゲーム（itch.io: puzzle, versus, falling-block, match-3, local-multiplayer, anime）

## 画像（_dev/tsunagu-naraberu/brand/out/。git の外）
- 表紙: cover_itch_630x500.png / cover_itch_en_630x500.png / cover_square_800.png（夢現）/ cover_wide_1280x720.png・cover_header_2000x500.png（Game Jolt）
- スクショ: shots/1_title.png・2_battle.png・3_cutin.png・4_naraberu.png（1280x720）・5_mobile.png（390x844）

## 配布 zip（_dist/itch/。git の外）
- サイト版: `python scripts/build_itch_package.py tsunagu-naraberu` → tsunagu-naraberu-itch.zip（itch.io・PLiCy）
- ポータル版: `python scripts/build_itch_package.py tsunagu-naraberu-portal` → TOPへのリンク・外部フォントなし（Game Jolt）
