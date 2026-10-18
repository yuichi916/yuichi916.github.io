# 紹介動画の作り方

1. `node scout.mjs --level つよい --n 200` — 30〜55秒で決着し、大連鎖と相殺がある試合（seed）を探す
2. サイトを `python -m http.server 18983 --bind 127.0.0.1` で配る
3. `python capture.py --seed 157 --out <素材>` — 仮想の時計で1コマずつ撮る。音は OfflineAudioContext で同じ時計に描き出す（ずれない）
4. `python overlays.py <字幕>` — 字幕・最初と終わりのカード（透明 PNG）
5. `python compose.py <素材> <字幕> out.mp4` — 字幕の時刻は events.json の出来事から決める。音は -14 LUFS

2026-10-18 版: seed 157・つよい・ひなた vs りん、51秒、1920x1080。
