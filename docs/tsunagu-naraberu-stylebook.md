# 『つなぐ×ならべる』スタイルブック

キャラの絵はここに書いた決まりでだけ作る。思いつきでプロンプトを足さない。変えるときはここを先に直す。

## 画風
- アニメ調、やわらかい塗り、太めの線、明るい色
- 頭身は3〜4頭身寄りのかわいい系。中高生くらいに見える範囲で、露出・性的な表現は入れない
- 構図は腰から上（cowboy shot）、正面やや斜め、カメラ目線
- 背景は真っ白（あとで抜く）

## 色
| 派 | 主色 | 差し色 |
|---|---|---|
| つなぐ派 | コーラル `#ff8a65` | 琥珀 `#ffcf3f` |
| ならべる派 | シアン `#4dd0e1` | 紫 `#b57bff` |

## 共通プロンプト（生成スクリプトの正本）
- 先頭: `masterpiece, best quality, amazing quality, anime style, cute, 1girl, solo, teenage, cowboy shot, looking at viewer, upper body focus, simple background, white background, soft shading, thick outline, bright colors`
- ネガティブ: `nsfw, nude, cleavage, underwear, revealing clothes, lowres, worst quality, bad quality, bad anatomy, bad hands, extra fingers, missing fingers, extra arms, deformed, blurry, text, watermark, signature, logo, multiple girls, multiple views, frame, border, dark background`

## キャラ
| ID | 名前 | 派 | 性格 | 外見タグ（プロンプトに足す） |
|---|---|---|---|---|
| hinata | ひなた | つなぐ派 | 元気・負けず嫌い | `orange hair, twintails, star hair ornament, yellow hairclip, amber eyes, coral hoodie, white shirt, black shorts, energetic, fang` |
| momo | もも | つなぐ派 | おっとり・天然 | `pink hair, long hair, wavy hair, cream beret, droopy eyes, pink eyes, white cardigan, pastel ribbon, long pink skirt, gentle smile` |
| rin | りん | ならべる派 | クール・秀才 | `cyan hair, bob cut, square hair ornament, block hairclip, blue eyes, tsurime, navy blazer, white shirt, blue necktie, pleated skirt, calm` |
| suzu | すず | ならべる派 | いたずら好き（髪は青緑のメッシュ入り。紫のメッシュは生成で出なかったため基本の1枚に合わせた） | `mint green hair, short hair, purple streaked hair, cat ear hood, oversized purple hoodie, denim shorts, green eyes, fang, mischievous smile` |

## 表情（inpaint で顔だけ描き直す）
| キー | 使う場面 | 足すタグ |
|---|---|---|
| normal | ふだん | `smile, closed mouth` |
| happy | 2〜3連鎖 | `happy, open mouth, smile, closed eyes, ^_^` |
| attack | 4連鎖以上 | `shouting, open mouth, determined, v-shaped eyebrows` |
| ouch | おじゃまを受けた | `surprised, wince, one eye closed, sweatdrop, open mouth` |
| pinch | 天井・窒息が近い | `worried, nervous, sweat, frown, wavy mouth` |
| win | 勝ち | `laughing, open mouth, sparkle, happy tears` |
| lose | 負け | `crying, tears, sad, frown` |

## 相棒マスコット
canvas で描く（絵ファイルにしない）。ぷにまる＝コーラルのしずく形スライム、カクたん＝シアンの角丸ブロック。どちらも目と頬だけのシンプルな顔。

## 選んだ基本の1枚（2026-10-10、確認用エージェントの判定）
| ID | 候補 | 顔の矩形 |
|---|---|---|
| hinata | base_0（seed 1000） | [275,222,550,472] |
| momo | base_5（seed 1005） | [300,270,560,505] |
| rin | 作り直し base_6（seed 2006、ネガティブに outline/sticker を追加。崩れた手を避けて y≤1000 で切る） | [288,215,508,385] |
| suzu | base_6（seed 1006） | [300,300,520,478] |
