@echo off
rem 一筆花火 2 の試遊: このウィンドウを開いたまま、ブラウザで遊ぶ
cd /d "%~dp0.."
python _dev\hanabi-serve.py 8800 . hanabi/index.html
