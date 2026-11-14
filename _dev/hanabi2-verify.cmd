@echo off
rem Hitofude Hanabi 2 world ranking: replay the top records with the real rules (daily, Task Scheduler)
cd /d E:\wt\hitofude-pro
node _dev\hanabi2-verify.mjs >> E:\tmp\hanabi2-verify-run.log 2>&1
