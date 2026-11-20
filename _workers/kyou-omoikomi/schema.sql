-- きょうの県「思い込みチェック」の答え（Cloudflare D1）
-- 答えを 1 行ずつ answers に残し、集計の表（cells・hist・home・conf・days・dayact）は
-- 書きこむたびに引き金（TRIGGER）で足しこむ。集計を読むときに全部の行を数えなおさない（無料の枠の読み出し回数を守る）。

-- answers: 答え 1 つで 1 行
--   kind 'r' … 思い込みチェック（ある県のある統計が「全国で何位か」の予想）
--   kind 'g' … 毎日の問題で外した答え（どの県とまちがえたか）
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,            -- 受けとった時刻（UNIX 秒）
  jday TEXT NOT NULL,             -- 日本時間の日付 YYYY-MM-DD
  sid TEXT NOT NULL,              -- ページが作った見えない番号（端末ごと）。名前や端末の情報ではない
  kind TEXT NOT NULL,             -- 'r' か 'g'
  pref INTEGER NOT NULL,          -- 'r': 予想した県 / 'g': その日の正解の県（0=北海道 … 46=沖縄）
  ind TEXT NOT NULL DEFAULT '',   -- 'r': 統計の番号（例 A05203）/ 'g': ''
  guess INTEGER NOT NULL,         -- 'r': 予想した順位（1〜47、1 が大きい）/ 'g': まちがえて答えた県
  truth INTEGER NOT NULL DEFAULT 0, -- 'r': 本当の順位（サーバーが表から入れる）/ 'g': 0
  home INTEGER NOT NULL DEFAULT -1, -- 住んでいる県（答えた人だけ。-1 は答えていない）
  day INTEGER NOT NULL DEFAULT -1,  -- 'g': 何番目の問題か（0 始まり）/ 'r': 毎日の問題から来たときはその番号
  hints INTEGER NOT NULL DEFAULT 0, -- 'g': 答えたときに開いていたヒントの数
  src TEXT NOT NULL DEFAULT '',   -- 'r': どこから来た問いか（daily=毎日の問題の後 / check=思い込みチェック）
  iph TEXT NOT NULL DEFAULT ''    -- 同じ所から大量に送られたときに見分けるための要約（日ごとの塩をかけた IP の要約。公開しない）
);
CREATE UNIQUE INDEX IF NOT EXISTS answers_once ON answers (sid, kind, pref, ind, day, guess);
CREATE UNIQUE INDEX IF NOT EXISTS answers_r_once ON answers (sid, pref, ind) WHERE kind = 'r';
CREATE INDEX IF NOT EXISTS answers_iph ON answers (iph, ts);

-- cells: 県×統計ごとの予想の数・ずれの合計（ずれ = 予想した順位 − 本当の順位）
CREATE TABLE IF NOT EXISTS cells (pref INTEGER NOT NULL, ind TEXT NOT NULL, n INTEGER NOT NULL, se INTEGER NOT NULL, ae INTEGER NOT NULL, PRIMARY KEY (pref, ind));
-- hist: 県×統計×予想した順位 ごとの数（答え合わせで「みんなの予想」を見せる）
CREATE TABLE IF NOT EXISTS hist (pref INTEGER NOT NULL, ind TEXT NOT NULL, guess INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (pref, ind, guess));
-- home: 県ごとに、その県に住む人（ins=1）と住んでいない人（ins=0）の予想の数・ずれ
CREATE TABLE IF NOT EXISTS home (pref INTEGER NOT NULL, ins INTEGER NOT NULL, n INTEGER NOT NULL, se INTEGER NOT NULL, ae INTEGER NOT NULL, PRIMARY KEY (pref, ins));
-- conf: 毎日の問題で、正解の県 pref を、どの県 guess とまちがえたか
CREATE TABLE IF NOT EXISTS conf (pref INTEGER NOT NULL, guess INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (pref, guess));
-- days: 日ごとの答えの数 / dayact: 日ごとに答えた端末の数（同じ日に同じ端末は 1 回だけ数える）
CREATE TABLE IF NOT EXISTS days (jday TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (jday, kind));
CREATE TABLE IF NOT EXISTS active (jday TEXT NOT NULL, sid TEXT NOT NULL, PRIMARY KEY (jday, sid));
CREATE TABLE IF NOT EXISTS dayact (jday TEXT NOT NULL PRIMARY KEY, n INTEGER NOT NULL);
-- people: 答えたことのある端末（はじめて答えた日）
CREATE TABLE IF NOT EXISTS people (sid TEXT NOT NULL PRIMARY KEY, first TEXT NOT NULL);

CREATE TRIGGER IF NOT EXISTS answers_r AFTER INSERT ON answers WHEN NEW.kind = 'r' BEGIN
  INSERT INTO cells (pref, ind, n, se, ae) VALUES (NEW.pref, NEW.ind, 1, NEW.guess - NEW.truth, abs(NEW.guess - NEW.truth))
    ON CONFLICT (pref, ind) DO UPDATE SET n = n + 1, se = se + excluded.se, ae = ae + excluded.ae;
  INSERT INTO hist (pref, ind, guess, n) VALUES (NEW.pref, NEW.ind, NEW.guess, 1)
    ON CONFLICT (pref, ind, guess) DO UPDATE SET n = n + 1;
  INSERT INTO home (pref, ins, n, se, ae) SELECT NEW.pref, (NEW.home = NEW.pref), 1, NEW.guess - NEW.truth, abs(NEW.guess - NEW.truth) WHERE NEW.home >= 0
    ON CONFLICT (pref, ins) DO UPDATE SET n = n + 1, se = se + excluded.se, ae = ae + excluded.ae;
END;
CREATE TRIGGER IF NOT EXISTS answers_g AFTER INSERT ON answers WHEN NEW.kind = 'g' BEGIN
  INSERT INTO conf (pref, guess, n) VALUES (NEW.pref, NEW.guess, 1)
    ON CONFLICT (pref, guess) DO UPDATE SET n = n + 1;
END;
CREATE TRIGGER IF NOT EXISTS answers_day AFTER INSERT ON answers BEGIN
  INSERT INTO days (jday, kind, n) VALUES (NEW.jday, NEW.kind, 1)
    ON CONFLICT (jday, kind) DO UPDATE SET n = n + 1;
  INSERT OR IGNORE INTO active (jday, sid) VALUES (NEW.jday, NEW.sid);
  INSERT OR IGNORE INTO people (sid, first) VALUES (NEW.sid, NEW.jday);
END;
CREATE TRIGGER IF NOT EXISTS active_day AFTER INSERT ON active BEGIN
  INSERT INTO dayact (jday, n) VALUES (NEW.jday, 1)
    ON CONFLICT (jday) DO UPDATE SET n = n + 1;
END;
