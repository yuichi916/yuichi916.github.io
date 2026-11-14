-- 一筆花火2 の世界ランキング（D1）
-- entries: 1 人 1 板 1 行（いちばん良い記録だけ）。board = 'd:YYYYMMDD'（今日の祭り）か 'a:段位:流派'（歴代）
CREATE TABLE IF NOT EXISTS entries (
  board TEXT NOT NULL,
  player TEXT NOT NULL,             -- ページが作った見えない番号（32 桁の 16 進）。名前や端末の情報ではない
  name TEXT NOT NULL,               -- 載せる名前（names.js で確かめたもの）
  score INTEGER NOT NULL,           -- 1 周の合計の点
  nights INTEGER NOT NULL,          -- 越えた夜
  won INTEGER NOT NULL DEFAULT 0,   -- 24 夜を越えた
  school TEXT NOT NULL, rank INTEGER NOT NULL, fuse TEXT NOT NULL,
  log TEXT,                         -- 記録（gzip + base64）。上位 200 だけ残す
  verified INTEGER NOT NULL DEFAULT 0, -- 0 まだ / 1 流しなおして合った / -1 合わなかった（隠す）
  why TEXT,
  hidden INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL, updated INTEGER NOT NULL,
  PRIMARY KEY (board, player)
);
CREATE INDEX IF NOT EXISTS entries_rank ON entries (board, hidden, score DESC, updated);
CREATE INDEX IF NOT EXISTS entries_pending ON entries (verified, hidden, score DESC);
-- ipcount: 同じ所からの送信の数（IP はそのまま残さず、日ごとの塩をかけた要約だけ）
CREATE TABLE IF NOT EXISTS ipcount (day TEXT NOT NULL, ip TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, ip));
