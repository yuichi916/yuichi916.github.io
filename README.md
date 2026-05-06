# yuichi916.github.io

ポートフォリオサイト。GitHub Pages で `https://yuichi916.github.io/` にデプロイ。

## ページ構成

| URL | 言語 | 説明 |
|---|---|---|
| `/` (`index.html`) | 日本語 | ランディング (Views Engineer) |
| `/index.en.html` | English | English landing |
| `/cabin.html` | 日本語 | 森の小屋 — 瞑想用ページ (タイマー / 環境音 / 音楽) |
| `/cabin.en.html` | English | Cabin in the Hollow — meditation page |

## ファイル

```
.
├── index.html          # JP landing
├── index.en.html       # EN landing
├── cabin.html          # JP cabin page
├── cabin.en.html       # EN cabin page
├── styles.css          # (legacy, currently unused — styles inline in pages)
├── favicon.svg
├── sitemap.xml
├── robots.txt
├── assets/
│   ├── og-image.png    # OG画像 (1200x630)
│   ├── cabin-hero.png  # cabin.html hero背景
│   ├── music-1.mp3     # cabin: Hollow Meditation
│   ├── music-2.mp3     # cabin: Forest Lullaby
│   └── music-3.mp3     # cabin: Night Whisper
├── googlea794ff425484fcb3.html  # Google Search Console verification
└── README.md
```

## ローカル動作確認

```bash
python -m http.server 8000
# → http://localhost:8000/
```

## デプロイ

main ブランチに push すると GitHub Pages が自動で `https://yuichi916.github.io/` に公開します。

## 多言語対応 (i18n)

- separate-files 方式: `index.html` (JP) ↔ `index.en.html` (EN), `cabin.html` (JP) ↔ `cabin.en.html` (EN)
- 各ファイルに `<link rel="alternate" hreflang="ja|en|x-default">` を設置
- `<html lang="ja|en">` で正しい言語属性
- マストヘッドの JP/EN リンクで切替

## リンク

- [Note (views_of_life)](https://note.com/views_of_life)
- [YouTube (ずんだもんの AI ラボ)](https://www.youtube.com/@zundamon_ai_lab)
- [GitHub](https://github.com/yuichi916)
- [X / @ViewsEngineer (個人)](https://x.com/ViewsEngineer)
- [X / @ZundamonAILab (AIラボ)](https://x.com/ZundamonAILab)
