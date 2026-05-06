# yuichi916.github.io

ポートフォリオサイト。GitHub Pages で `https://yuichi916.github.io/` にデプロイ。

## ページ構成

| URL | 説明 |
|---|---|
| `/` (`index.html`) | ランディング (Views Engineer) |
| `/cabin.html` | 森の小屋 — 瞑想用ページ (タイマー / 環境音 / 音楽) |

両ページとも **10言語対応** (JS 辞書方式 / `localStorage` で記憶):
JP · EN · ZH-CN · KO · ES · FR · DE · PT · RU · IT

## ファイル

```
.
├── index.html          # ランディング (10-lang)
├── cabin.html          # 森の小屋 (10-lang)
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

言語切替テスト:
- `?lang=en` で EN 強制 (例: `localhost:8000/cabin.html?lang=zh-CN`)
- ブラウザの `navigator.language` で初回自動判定
- マストヘッドの言語ドロップダウンで切替 (localStorage に保存)

## デプロイ

main ブランチに push すると GitHub Pages が自動で `https://yuichi916.github.io/` に公開します。

## 多言語対応 (i18n)

- **方式**: JS 辞書 + `data-i18n` / `data-i18n-html` 属性 (single URL)
- **対応 10 言語**: ja, en, zh-CN, ko, es, fr, de, pt, ru, it
- **検出順序**: URL の `?lang=xx` → localStorage → navigator.language → ja (default)
- **記憶**: 切替時に `localStorage["ve_lang"]` に保存
- **属性**:
  - `data-i18n="key"` → `textContent` を差替え
  - `data-i18n-html="key"` → `innerHTML` を差替え (HTML 含むキー用)

新規キー追加手順:
1. HTML に `data-i18n="新キー"` を付与
2. `<script>` 内の i18n 辞書に各言語の翻訳を追加 (JP は DOM から自動キャプチャ)

## リンク

- [Note (views_of_life)](https://note.com/views_of_life)
- [YouTube (ずんだもんの AI ラボ)](https://www.youtube.com/@zundamon_ai_lab)
- [GitHub](https://github.com/yuichi916)
- [X / @ViewsEngineer (個人)](https://x.com/ViewsEngineer)
- [X / @ZundamonAILab (AIラボ)](https://x.com/ZundamonAILab)
