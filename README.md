# yuichi916.github.io

ポートフォリオ + ミニゲーム公開サイト。GitHub Pages で `https://yuichi916.github.io/` にデプロイ。

## 構成

```
.
├── index.html          # ランディングページ
├── styles.css          # ホームページのスタイル
├── boxing/             # クリック・ボクシングゲーム (HTML5 Canvas)
│   ├── index.html
│   ├── game.js
│   ├── styles.css
│   ├── sprites.json
│   └── final/          # AI生成スプライト (透過 PNG)
│       ├── opponent_t/
│       ├── heroine_t/
│       ├── gloves_t/
│       └── bg/
└── README.md
```

## ローカル動作確認

```bash
python -m http.server 8000
# → http://localhost:8000/ でランディングページ
# → http://localhost:8000/boxing/ でゲーム
```

## デプロイ

main ブランチに push すると GitHub Pages が自動で `https://yuichi916.github.io/` に公開します。

## クレジット

- スプライト: Stable Diffusion (reForge) + waiNSFWIllustrious_v140
- 背景透過: rembg
- ゲーム実装: Claude Code
- BGM/SE: 未組み込み (将来追加予定)
