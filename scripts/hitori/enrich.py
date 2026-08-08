# -*- coding: utf-8 -*-
"""集めた事実の語彙と、3軸への反映。

3軸は業態からの機械的な推定である。実際に確認できた事実があれば、その
ぶんだけ推定を補正する。上書きはしない。差分として持ち、推定値と実効値の
両方を出力する（何を根拠に変えたのかを隠さないため）。

自由記述は扱わない。ここにある語彙の値だけを受け付ける。他人の文章を
持ち込まないための構造上の制約であり、運用の約束ではない。
"""
from urllib.parse import urlparse

# 自動アクセスを禁止しているサイト。著作権ではなくアクセス規約の問題なので、
# 検索結果に出てきても事実の出所として数えない。
BLOCKED_DOMAINS = frozenset({"tabelog.com", "sauna-ikitai.com", "retty.me"})

AXES = ("solo", "quiet", "easy")
MIN_SUPPORT = 2          # 軸を動かすのに必要な独立ドメイン数
MAX_ADJUST = 2           # 軸ごとの補正の上限（絶対値）

# 事実名 → 許される値。int は非負整数。
FACT_VOCAB = {
    "payment_method": {"ticket_machine", "counter_person", "cashless_ok", "cash_only"},
    "counter_seats": int,
    "seats_total": int,
    "reservation": {"none", "possible", "required"},
    "silence": {"posted", "observed"},
    "clientele": {"local", "tourist", "solo_common"},
    "first_timer": {"easy", "custom_exists"},
    "hours": str,
    "closed_days": str,
    "price": int,
    # 「そこへ一人で行けるか」以前の問題を表す事実。収集を始めて初めて必要に
    # なった。地元住民専用の共同浴場や休業中の施設を「ひとりで行ける場所」と
    # して載せると、行った人が門前払いになる。
    "access": {"public", "residents_only", "members_only"},
    "status": {"open", "closed_temporarily", "closed_permanently"},
    "renamed_to": str,
    # 一人で行く前に知らないと困ること。実際の収集で情報源が書いていたのに
    # 語彙が無くて捨てていた（「30分制限」「無人料金箱」「洗い場なし」など）。
    # 同行者に聞けないので、一人客ほどこれを事前に知る必要がある。
    "stay_limit": int,                                   # 滞在時間の上限（分）
    "luggage": {"locker", "shelf_only", "none"},         # 荷物の置き場
    "bring_towel": {"required", "rental", "included"},   # タオル
    "wash_area": {"yes", "no"},                          # 洗い場（体を洗えるか）
    "busy_time": {"morning_quiet", "evening_busy", "weekend_busy", "usually_quiet"},
    "unstaffed": {"yes", "no"},                          # 無人（料金箱など）
    # このアプリの根幹。一人で利用できない施設を「ひとりで行ける場所」として
    # 載せてはならない。2名以上が前提の宿（一人旅の受入は年2回だけ）が実在した。
    "solo_ok": {"yes", "no", "limited"},
}

# この事実が裏付け MIN_SUPPORT 件以上で立つと、その施設を一覧から外す。
# 「一人で行ける場所」として成立しないため。件数は必ず報告する（黙って
# 消すと、なぜ件数が減ったのか誰にも分からなくなる）。
EXCLUDING = {
    ("solo_ok", "no"): "一人では利用できない",
    ("access", "residents_only"): "地元住民専用",
    ("access", "members_only"): "会員専用",
    ("status", "closed_permanently"): "閉業",
}

# 公式サイト1件で採用してよい事実。客観的で、自治体や施設自身が
# 一次情報を持つものに限る。主観を含む事実（客層など）は含めない。
OFFICIAL_ONLY_FACTS = frozenset({"hours", "closed_days", "price"})

# (事実, 値) → (軸, 増減)
ADJUST = {
    ("payment_method", "ticket_machine"): ("easy", +1),
    ("payment_method", "counter_person"): ("easy", -1),
    ("reservation", "none"): ("easy", +1),
    ("reservation", "required"): ("easy", -2),
    ("first_timer", "easy"): ("easy", +1),
    ("first_timer", "custom_exists"): ("easy", -1),
    ("clientele", "local"): ("easy", -1),
    ("clientele", "solo_common"): ("solo", +1),
    ("silence", "posted"): ("quiet", +1),
    ("silence", "observed"): ("quiet", +1),
}


def normalize_domain(url):
    """URL → 小文字のホスト名（先頭の www. を除く）。"""
    host = (urlparse(str(url)).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def is_blocked(url):
    d = normalize_domain(url)
    return any(d == b or d.endswith("." + b) for b in BLOCKED_DOMAINS)


def valid_fact(key, value):
    spec = FACT_VOCAB.get(key)
    if spec is None:
        return False
    if spec is int:
        return isinstance(value, int) and not isinstance(value, bool) and value >= 0
    if spec is str:
        return isinstance(value, str) and bool(value.strip())
    return value in spec


def _conflicting_keys(facts):
    """同じ事実名に異なる値がある（＝情報が分かれている）ものの集合。"""
    seen = {}
    bad = set()
    for f in facts:
        k, v = f["k"], f["v"]
        if k in seen and seen[k] != v:
            bad.add(k)
        seen.setdefault(k, v)
    return bad


def exclusion_reason(facts):
    """一覧から外すべき施設なら理由を返す。そうでなければ None。

    矛盾している事実では外さない（判断を保留する側に倒す）。
    """
    conflicts = _conflicting_keys(facts)
    for f in facts:
        if f["k"] in conflicts:
            continue
        if f.get("n", 0) < MIN_SUPPORT:
            continue
        hit = EXCLUDING.get((f["k"], f["v"]))
        if hit:
            return hit
    return None


def apply_adjust(est, facts):
    """推定値 est に事実 facts を反映した実効値を返す。est は変更しない。

    - 裏付けが MIN_SUPPORT 未満の事実は無視する
    - 情報が分かれている事実は無視する（どちらかを選ばない）
    - 軸ごとの補正は ±MAX_ADJUST で頭打ち、最後に 1..5 へ収める
    """
    conflicts = _conflicting_keys(facts)
    delta = {a: 0 for a in AXES}

    for f in facts:
        k, v = f["k"], f["v"]
        if k in conflicts:
            continue
        if f.get("n", 0) < MIN_SUPPORT:
            continue          # 公式1件は事実の採用には効くが、軸は動かさない
        hit = ADJUST.get((k, v))
        if hit is None:
            if k == "counter_seats" and isinstance(v, int) and v >= 1:
                hit = ("solo", +1)
            else:
                continue
        axis, amount = hit
        delta[axis] += amount

    out = {}
    for a in AXES:
        d = max(-MAX_ADJUST, min(MAX_ADJUST, delta[a]))
        out[a] = max(1, min(5, est[a] + d))
    return out
