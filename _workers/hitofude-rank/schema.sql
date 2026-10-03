-- 一筆花火「今夜の一筆」のランキング（D1）
-- runs: 1 人 1 日 1 行。夜を越えるたびに、サーバーが確かめた進みで書きかえる
CREATE TABLE IF NOT EXISTS runs (
  day TEXT NOT NULL,              -- 日本時間の日付 YYYY-MM-DD
  player TEXT NOT NULL,           -- ページが作った見えない番号（32 桁の 16 進）。名前や端末の情報ではない
  name TEXT NOT NULL,             -- ランキングに出す名前（names.js で確かめたもの）
  night INTEGER NOT NULL,         -- 確かめ終えた夜の数（0〜8）
  total INTEGER NOT NULL,         -- サーバーが燃やしなおした点の合計
  cleared INTEGER NOT NULL,       -- 越えた夜の数
  over INTEGER NOT NULL DEFAULT 0,-- 祭りが終わった（散った・八夜を越えた）
  state TEXT NOT NULL,            -- 次の夜を確かめるのに要るもの（お守り・墨・星・予備の提灯）
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0, -- 管理で隠した
  PRIMARY KEY (day, player)
);
CREATE INDEX IF NOT EXISTS runs_rank ON runs (day, hidden, total DESC, updated);
-- ipcount: 同じ所からの新しい参加の数（IP はそのまま残さず、日ごとの塩をかけた要約だけ）
CREATE TABLE IF NOT EXISTS ipcount (
  day TEXT NOT NULL,
  ip TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (day, ip)
);
