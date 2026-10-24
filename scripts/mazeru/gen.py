"""まぜる日本: 組み合わせ表をローカルLLM（llama.cpp llama-server）で幅優先に作る。

課金APIは使わない。プレイ中にLLMは呼ばない（この表を事前に作って同梱する）。

使い方:
  python gen.py serve            # llama-server を起動して待つ（別プロセス）
  python gen.py run              # 生成（再開可。キャッシュ C:/tmp/mazeru-gen/*.jsonl）
  python gen.py run --dry        # LLMを呼ばずキャッシュだけで再構成して数を表示
  MAZERU_DENSE=10 python gen.py run   # 要素が上限に達したあと、全要素に相手を10個ずつ足して組を増やす（公開版はこれ）

公開版の手順: serve → run（2,800要素まで幅優先）→ MAZERU_DENSE=10 で組を足す → judge.py で全組を採点 → build_data.py

仕組み:
  - 要素を発見順に並べ、先頭から1つずつ「相手」を決めて組を作る。
    相手 = 基本要素すべて + 自分自身 + 序盤の要素から3つ + それまでの要素から3つ（名前で決まる乱数）。
  - 組は順序なし（A+B=B+A）。生のLLM出力を pairs.jsonl に、要素の分類を classes.jsonl に
    追記していくので、止めても同じ順序で再構成して続きから回る。
  - 新しい要素は分類（カテゴリ／除外判定）を通ったものだけ受け入れる。
"""
import hashlib, json, os, random, re, subprocess, sys, threading, time, unicodedata
import urllib.request
from concurrent.futures import ThreadPoolExecutor

LLAMA_DIR = "E:/ai/jpbench/llama-b11852"
MODEL = "E:/ai/jpbench/models/gemma-4-12b-it-Q4_K_M.gguf"
MODEL_NAME = "Gemma 4 12B it（Q4_K_M）"
PORT = 8092
BASE = f"http://127.0.0.1:{PORT}"
NP = int(os.environ.get("MAZERU_NP", "4"))
WORK = "C:/tmp/mazeru-gen"
os.makedirs(WORK, exist_ok=True)
PAIRS = os.path.join(WORK, "pairs.jsonl")
CLASSES = os.path.join(WORK, "classes.jsonl")
STATE = os.path.join(WORK, "state.json")
WORDS = os.path.join(WORK, "words.jsonl")

BASES = [("水", "💧"), ("火", "🔥"), ("土", "🟫"), ("風", "🌬️"), ("木", "🌳"), ("米", "🌾"), ("人", "🧑")]
CAP_ELEMS = int(os.environ.get("MAZERU_CAP", "2800"))
MAX_PAIRS = int(os.environ.get("MAZERU_MAX_PAIRS", "50000"))
MAX_LEN = 8
PAIR_BATCH = 14
CLS_BATCH = 20

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ngwords import ng_reason  # noqa: E402


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


# ---------------- 正規化 ----------------
STRIP = "「」『』【】（）()［］[]〈〉《》\"'“”‘’、。,.!！?？・:：;；…〜~ 　\t\r\n*＊#＃"
KATA2HIRA = {chr(c): chr(c - 0x60) for c in range(0x30A1, 0x30F7)}


def clean_name(s):
    s = unicodedata.normalize("NFKC", s or "").strip()
    s = s.strip(STRIP)
    s = re.sub(r"\s+", "", s)
    return s.lower()


def key_of(name):
    """表記ゆれ（カタカナ/ひらがな、長音の有無）を同一視するためのキー。"""
    k = "".join(KATA2HIRA.get(ch, ch) for ch in name)
    return k.replace("ー", "").replace("ゔ", "ぶ")


EMOJI_RE = re.compile(r"[\u2190-\u2BFF\u2600-\u27BF\U0001F000-\U0001FAFF\u3030\u303D\u3297\u3299\u00A9\u00AE\u203C\u2049\u2122\u2139]")


def clean_emoji(e):
    e = (e or "").strip()
    if not e or not EMOJI_RE.search(e):
        return None
    # 先頭の書記素（簡易）: 最初の絵文字コードポイント + 続く結合文字/ZWJ列
    out = ""
    for i, ch in enumerate(e):
        if not out:
            if EMOJI_RE.match(ch) or ch in "\u00A9\u00AE":
                out = ch
            continue
        if ch in "\uFE0F\u200D" or "\U0001F3FB" <= ch <= "\U0001F3FF" or (out.endswith("\u200D") and EMOJI_RE.match(ch)) \
                or "\U000E0020" <= ch <= "\U000E007F":
            out += ch
        else:
            break
    return out or None


VALID_NAME = re.compile(r"^[\u3041-\u3096\u30A1-\u30FA\u30FC\u4E00-\u9FFF\u3005\u3006\u30F6々〆ヶ]+$")


_TOK = None


def toks(name):
    global _TOK
    if _TOK is None:
        from janome.tokenizer import Tokenizer
        _TOK = Tokenizer()
    return [(t.surface, t.part_of_speech) for t in _TOK.tokenize(name)]


KANJI_ONLY = re.compile(r"^[一-鿿々]+$")


def is_coinage(name, a, b):
    """辞書（IPAdic）で1語にならず、2字の漢字だけ、または入力の字を並べ替えただけの語は造語とみなす。"""
    ts = toks(name)
    if len(ts) <= 1:
        return False
    if len(name) == 2 and KANJI_ONLY.match(name):
        return True
    if set(name) <= set(a + b):
        return True
    return False


PHRASE_OK = {"海の幸", "春の七草", "秋の七草", "雪の結晶", "竜の髭"}


def is_phrase(name):
    """「砂漠の米」「海苔の湯」のような助詞でつないだ句（辞書で1語になるもの・一部の定番は除く）。"""
    if name in PHRASE_OK:
        return False
    ts = toks(name)
    return len(ts) > 1 and any(p.startswith("助詞") for _, p in ts)


def needs_word_check(name):
    """辞書（IPAdic）で1語にならない語は、AIに「辞書に載る語・一般に使う語か」を聞く。"""
    return len(toks(name)) > 1


def is_person_name(name):
    ts = toks(name)
    has = any("人名" in p for _, p in ts)
    return has and all(("人名" in p) or p.startswith("名詞,接尾") for _, p in ts)


def name_problem(name, a, b):
    if not name:
        return "空"
    if len(name) > MAX_LEN:
        return "長すぎ"
    if not VALID_NAME.match(name):
        return "文字種"  # 英数字・記号まじり（商品名・型番になりやすい）
    if name in (a, b):
        return "入力と同じ"
    r = ng_reason(name)
    if r:
        return "NG語:" + r
    if is_coinage(name, a, b):
        return "造語"
    if is_phrase(name):
        return "句（助詞でつないだ語）"
    return None


# ---------------- LLM ----------------
SYS = """あなたは、日本の文化にとても詳しい言葉あそびゲームの作者です。
プレイヤーが2つの「要素」をまぜると、新しい要素が1つできます。その答えを考えてください。

ルール:
- 答えは名詞1つ（ひらがな・カタカナ・漢字で8文字以内）と、その語に合う絵文字1つ。
- 2つの要素から「なるほど」と思える、自然でわかりやすいもの。
- できれば日本らしいもの（和食・郷土料理、妖怪・伝説、昔話、季節の行事や季語、都道府県や名所、伝統工芸や道具、職業、自然）を選ぶ。ただし無理にこじつけない。
- 入力と同じ語や、入力の字をくっつけただけの辞書にない造語（例「水火」「潮桜」「桜土」）は答えない。辞書や日常で使われる語にする。
- 実在の人物名、商品名・会社名・キャラクター名、差別的な語、性的な語、むごい語は答えない。
- JSONだけを出力する。説明は書かない。"""

SHOTS = [
    ("水", "火", "湯気", "♨️"),
    ("米", "水", "お酒", "🍶"),
    ("人", "水", "河童", "🥒"),
    ("木", "火", "炭", "⚫"),
    ("風", "水", "波", "🌊"),
]

SCHEMA = {"type": "object", "properties": {"name": {"type": "string", "maxLength": 12},
                                           "emoji": {"type": "string", "maxLength": 8}},
          "required": ["name", "emoji"]}

CATS = ["自然", "天気・季節", "食べもの", "生きもの", "植物", "妖怪・伝説", "昔話・物語", "場所・名所", "建物",
        "道具・もの", "行事・文化", "人・職業", "からだ・こころ", "乗りもの", "ことば・考え",
        "実在の人物", "商品名・会社名・作品名", "不適切", "意味が通らない"]
EXCLUDE_CATS = {"実在の人物", "商品名・会社名・作品名", "不適切", "意味が通らない"}
CLS_SYS = ("あなたは日本語の辞書編集者です。与えられた語を、次のカテゴリのどれか1つに分類してください。\n"
           + "、".join(CATS) + "\n"
           "注意: 歴史上の人物も含め実在した個人の名前は「実在の人物」。商標・ブランド・企業・漫画やアニメの固有のキャラクターは"
           "「商品名・会社名・作品名」（昔話や伝説の登場人物は「昔話・物語」）。差別語・性的な語・残酷な語は「不適切」。"
           "辞書にない造語や、意味がわからない語は「意味が通らない」。JSONだけを出力する。")
CLS_SCHEMA = {"type": "object", "properties": {"category": {"type": "string", "enum": CATS}}, "required": ["category"]}


def post(body, timeout=300):
    req = urllib.request.Request(BASE + "/v1/chat/completions", data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def seed_of(*xs):
    return int(hashlib.md5("|".join(xs).encode()).hexdigest()[:8], 16)


BATCH_SHOT_IN = [("水", "火"), ("米", "水"), ("人", "水"), ("木", "火"), ("風", "水"), ("人", "米")]
BATCH_SHOT_OUT = ["湯気 ♨️", "お酒 🍶", "河童 🥒", "炭 ⚫", "波 🌊", "農家 👨‍🌾"]
LINE_RE = re.compile(r"^\s*(\d+)\s*[.．)）:：]\s*(.+?)\s*$")
NAME_HEAD = re.compile(r"^([^\s←-⯿☀-➿🀀-🫿]+)\s*(.*)$")


def _fmt_pairs(pairs):
    return "\n".join(f"{i+1}. {a} + {b}" for i, (a, b) in enumerate(pairs))


def _call(msgs, max_tokens, seed, temperature):
    body = {"messages": msgs, "max_tokens": max_tokens, "temperature": temperature, "top_p": 0.9, "seed": seed,
            "cache_prompt": True}
    for attempt in range(4):
        try:
            j = post(body)
            return j["choices"][0]["message"].get("content") or ""
        except Exception as ex:  # noqa: BLE001
            log("retry", ex)
            time.sleep(3 + attempt * 5)
    raise RuntimeError("LLM unreachable")


def _parse_lines(txt, n):
    got = {}
    for line in txt.splitlines():
        m = LINE_RE.match(line)
        if m:
            i = int(m.group(1)) - 1
            if 0 <= i < n and i not in got:
                got[i] = m.group(2)
    return got


def ask_pairs(pairs):
    """複数の組をまとめて1回で聞く（番号つきの行で返させる）。返らなかった組は1つずつ聞き直す。"""
    sys_msg = SYS.replace("JSONだけを出力する。説明は書かない。",
                          "番号ごとに「番号. 答えの語 絵文字」の1行で、入力と同じ数だけ答える。説明は書かない。")
    msgs = [{"role": "system", "content": sys_msg},
            {"role": "user", "content": _fmt_pairs(BATCH_SHOT_IN)},
            {"role": "assistant", "content": "\n".join(f"{i+1}. {o}" for i, o in enumerate(BATCH_SHOT_OUT))},
            {"role": "user", "content": _fmt_pairs(pairs)}]
    txt = _call(msgs, 14 * len(pairs) + 16, seed_of(*[a + b for a, b in pairs]), 0.3)
    got = _parse_lines(txt, len(pairs))
    out = []
    for i, (a, b) in enumerate(pairs):
        if i not in got and len(pairs) > 1:
            out.extend(ask_pairs([(a, b)]))
            continue
        line = got.get(i, "")
        m = NAME_HEAD.match(line)
        name, emo = (m.group(1), m.group(2)) if m else ("", "")
        out.append({"a": a, "b": b, "raw": line, "name": name, "emoji": emo})
    return out


CLS_SHOT_IN = ["きりたんぽ", "織田信長", "ぴろぽん", "雪女"]
CLS_SHOT_OUT = ["食べもの", "実在の人物", "意味が通らない", "妖怪・伝説"]


def ask_classes(names):
    sys_msg = CLS_SYS.replace("JSONだけを出力する。", "番号ごとに「番号. カテゴリ」の1行で答える。説明は書かない。")
    fmt = lambda xs: "\n".join(f"{i+1}. {x}" for i, x in enumerate(xs))
    msgs = [{"role": "system", "content": sys_msg},
            {"role": "user", "content": fmt(CLS_SHOT_IN)},
            {"role": "assistant", "content": fmt(CLS_SHOT_OUT)},
            {"role": "user", "content": fmt(names)}]
    txt = _call(msgs, 12 * len(names) + 16, 1, 0)
    got = _parse_lines(txt, len(names))
    out = []
    for i, n in enumerate(names):
        if i not in got and len(names) > 1:
            out.extend(ask_classes([n]))
            continue
        c = got.get(i, "").strip("「」 ")
        out.append({"name": n, "category": c if c in CATS else "意味が通らない", "raw": got.get(i, "")})
    return out


WORD_SYS = ("あなたは国語辞典の編集者です。与えられた語が、国語辞典や百科事典に載っている語、または日本で一般に使われている言葉かを判定します。"
            "その場で作った言い回し・造語・不自然な組み合わせは「いいえ」。番号ごとに「番号. はい」または「番号. いいえ」の1行で答える。")


def ask_words(names):
    fmt = lambda xs: "\n".join(f"{i+1}. {x}" for i, x in enumerate(xs))
    msgs = [{"role": "system", "content": WORD_SYS}, {"role": "user", "content": fmt(names)}]
    txt = _call(msgs, 8 * len(names) + 16, 1, 0)
    got = _parse_lines(txt, len(names))
    out = []
    for i, n in enumerate(names):
        if i not in got and len(names) > 1:
            out.extend(ask_words([n]))
            continue
        out.append({"name": n, "word": got.get(i, "").startswith("はい"), "raw": got.get(i, "")})
    return out


# ---------------- server ----------------
def serve():
    cmd = [f"{LLAMA_DIR}/llama-server.exe", "-m", MODEL, "--host", "127.0.0.1", "--port", str(PORT),
           "-c", str(1536 * NP), "-np", str(NP), "-fa", "auto", "-ngl", "all", "--fit", "off", "-cram", "0",
           "-ub", "256", "-b", "1024", "--chat-template-kwargs", '{"enable_thinking":false}']
    log(" ".join(cmd))
    fh = open(os.path.join(WORK, "server.log"), "w", encoding="utf-8", errors="replace")
    p = subprocess.Popen(cmd, stdout=fh, stderr=subprocess.STDOUT)
    open(os.path.join(WORK, "server.pid"), "w").write(str(p.pid))
    p.wait()


def wait_server(max_s=600):
    t0 = time.time()
    while time.time() - t0 < max_s:
        try:
            with urllib.request.urlopen(BASE + "/health", timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError("server not ready")


# ---------------- 生成本体 ----------------
def load_jsonl(path, keyf):
    d = {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except Exception:
                continue
            d[keyf(r)] = r
    return d


def pk(a, b):
    return (a, b) if a <= b else (b, a)


class Gen:
    def __init__(self, dry=False):
        self.dry = dry
        self.pairs = load_jsonl(PAIRS, lambda r: pk(r["a"], r["b"]))
        self.classes = load_jsonl(CLASSES, lambda r: r["name"])
        self.words = load_jsonl(WORDS, lambda r: r["name"])
        self.fw = open(WORDS, "a", encoding="utf-8")
        self.lock = threading.Lock()
        self.fp = open(PAIRS, "a", encoding="utf-8")
        self.fc = open(CLASSES, "a", encoding="utf-8")
        self.elems = [n for n, _ in BASES]
        self.emoji = {n: e for n, e in BASES}
        self.cat = {n: "自然" for n, _ in BASES}
        self.cat["米"] = "食べもの"; self.cat["人"] = "人・職業"; self.cat["木"] = "植物"
        self.byKey = {key_of(n): n for n in self.elems}
        self.recipes = {}  # (a,b) -> result name
        self.rejects = {}  # reason -> count
        self.reject_samples = {}
        self.processed = 0
        self.llm_calls = 0

    def partners(self, idx):
        e = self.elems[idx]
        bases = [n for n, _ in BASES]
        out = list(bases) + [e]
        earlier = [x for x in self.elems[:idx] if x not in bases]
        rng = random.Random(seed_of("p", e))
        core = earlier[:60]
        out += rng.sample(core, min(3, len(core)))
        rest = [x for x in earlier if x not in out]
        out += rng.sample(rest, min(3, len(rest)))
        seen, res = set(), []
        for p in out:
            if p not in seen:
                seen.add(p); res.append(p)
        return res

    def _call_pairs(self, todo):
        if self.dry or not todo:
            return
        todo = list(todo)
        random.Random(seed_of("w", *todo[0])).shuffle(todo)  # 同じ要素の組が1回に並ぶと「水蔵・火蔵…」と型をなぞるので混ぜる
        chunks = [todo[i:i + PAIR_BATCH] for i in range(0, len(todo), PAIR_BATCH)]
        with ThreadPoolExecutor(NP) as ex:
            for r in (x for rs in ex.map(ask_pairs, chunks) for x in rs):
                with self.lock:
                    self.pairs[pk(r["a"], r["b"])] = r
                    self.fp.write(json.dumps(r, ensure_ascii=False) + "\n")
                    self.llm_calls += 1
        self.fp.flush()

    def _call_classes(self, names):
        if self.dry or not names:
            return
        chunks = [names[i:i + CLS_BATCH] for i in range(0, len(names), CLS_BATCH)]
        with ThreadPoolExecutor(NP) as ex:
            for r in (x for rs in ex.map(ask_classes, chunks) for x in rs):
                with self.lock:
                    self.classes[r["name"]] = r
                    self.fc.write(json.dumps(r, ensure_ascii=False) + "\n")
                    self.llm_calls += 1
        self.fc.flush()

    def _call_words(self, names):
        if self.dry or not names:
            return
        chunks = [names[i:i + CLS_BATCH] for i in range(0, len(names), CLS_BATCH)]
        with ThreadPoolExecutor(NP) as ex:
            for r in (x for rs in ex.map(ask_words, chunks) for x in rs):
                with self.lock:
                    self.words[r["name"]] = r
                    self.fw.write(json.dumps(r, ensure_ascii=False) + "\n")
                    self.llm_calls += 1
        self.fw.flush()

    def reject(self, reason, sample):
        self.rejects[reason] = self.rejects.get(reason, 0) + 1
        lst = self.reject_samples.setdefault(reason, [])
        if len(lst) < 40:
            lst.append(sample)

    def _process(self, jobs):
        """組を聞いて（キャッシュになければ）、門を通して表に入れる。dry でキャッシュが足りなければ False。"""
        todo = [k for k in jobs if k not in self.pairs]
        self._call_pairs(todo)
        if self.dry and any(k not in self.pairs for k in jobs):
            return False
        # 候補名を正規化し、新しい語は分類にかける
        cand = []
        for k in jobs:
            r = self.pairs[k]
            n = clean_name(r["name"])
            n = self.byKey.get(key_of(n), n)
            cand.append((k, n, r))
        new_names, wnames = [], []
        for k, n, r in cand:
            if n in self.emoji or name_problem(n, *k):
                continue
            if n not in self.classes and n not in new_names:
                new_names.append(n)
            if n not in self.words and n not in wnames and needs_word_check(n):
                wnames.append(n)
        if len(self.elems) < CAP_ELEMS:
            self._call_classes(new_names)
            self._call_words(wnames)
        if self.dry and len(self.elems) < CAP_ELEMS and (any(n not in self.classes for n in new_names)
                                                         or any(n not in self.words for n in wnames)):
            return False
        for k, n, r in cand:
            if k in self.recipes:
                continue
            prob = name_problem(n, *k)
            if prob:
                self.reject(prob, f"{k[0]}+{k[1]}={r['name']}")
                self.recipes[k] = None
                continue
            if n not in self.emoji:
                if len(self.elems) >= CAP_ELEMS:
                    self.reject("上限後の新語", f"{k[0]}+{k[1]}={n}")
                    self.recipes[k] = None
                    continue
                c = self.classes.get(n, {}).get("category")
                if c not in ("昔話・物語", "妖怪・伝説") and is_person_name(n):
                    self.reject("人名(辞書)", f"{k[0]}+{k[1]}={n}")
                    self.recipes[k] = None
                    continue
                if c in EXCLUDE_CATS:
                    self.reject("分類:" + c, f"{k[0]}+{k[1]}={n}")
                    self.recipes[k] = None
                    continue
                if needs_word_check(n) and not self.words.get(n, {}).get("word"):
                    self.reject("辞書にない語(AI判定)", f"{k[0]}+{k[1]}={n}")
                    self.recipes[k] = None
                    continue
                em = clean_emoji(r.get("emoji"))
                if not em:
                    self.reject("絵文字なし(✨で補完)", n)
                    em = "✨"
                self.elems.append(n); self.emoji[n] = em; self.cat[n] = c
                self.byKey[key_of(n)] = n
            self.recipes[k] = n
        return True

    def run(self, wave=8):
        t0 = time.time()
        last_log = 0
        while self.processed < len(self.elems) and len(self.recipes) + 1 < MAX_PAIRS:
            idxs = list(range(self.processed, min(self.processed + wave, len(self.elems))))
            jobs = []
            for i in idxs:
                e = self.elems[i]
                for p in self.partners(i):
                    k = pk(e, p)
                    if k not in jobs and k not in self.recipes:
                        jobs.append(k)
            if not self._process(jobs):
                break
            self.processed = idxs[-1] + 1
            if time.time() - last_log > 30 or self.processed >= len(self.elems):
                last_log = time.time()
                ok = sum(1 for v in self.recipes.values() if v)
                log(f"processed {self.processed}/{len(self.elems)} elems, pairs {len(self.recipes)} (ok {ok}), "
                    f"llm calls {self.llm_calls}, {time.time()-t0:.0f}s")
                self.save_state()
        self.save_state()
        return self

    def densify(self, extra, wave=8):
        """全要素について、相手をさらに extra 個ずつ足して組を増やす（要素数は上限に達しているので、答えは既存の要素だけが残る）。"""
        t0 = time.time()
        last_log = 0
        for start in range(0, len(self.elems), wave):
            jobs = []
            for i in range(start, min(start + wave, len(self.elems))):
                e = self.elems[i]
                rng = random.Random(seed_of("d", e))
                for p in rng.sample(self.elems, min(extra + 1, len(self.elems))):
                    k = pk(e, p)
                    if p != e and k not in jobs and k not in self.recipes:
                        jobs.append(k)
                    if sum(1 for j in jobs if e in j) >= extra:
                        break
            if not self._process(jobs):
                break
            if time.time() - last_log > 30:
                last_log = time.time()
                ok = sum(1 for v in self.recipes.values() if v)
                log(f"densify {start}/{len(self.elems)} elems, pairs {len(self.recipes)} (ok {ok}), "
                    f"llm calls {self.llm_calls}, {time.time()-t0:.0f}s")
                self.save_state()
        self.save_state()
        return self

    def save_state(self):
        if self.dry:
            return
        ok = sum(1 for v in self.recipes.values() if v)
        json.dump({"time": time.strftime("%Y-%m-%d %H:%M:%S"), "model": MODEL_NAME, "elems": len(self.elems),
                   "processed": self.processed, "pairs_tried": len(self.recipes), "pairs_ok": ok,
                   "rejects": self.rejects, "cap": CAP_ELEMS, "max_pairs": MAX_PAIRS},
                  open(STATE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    def export(self, path):
        out = {"model": MODEL_NAME, "bases": [n for n, _ in BASES],
               "words": {n: self.words.get(n, {}).get("word") for n in self.elems if needs_word_check(n)},
               "elems": [{"name": n, "emoji": self.emoji[n], "cat": self.cat.get(n)} for n in self.elems],
               "recipes": [[a, b, r] for (a, b), r in self.recipes.items() if r],
               "rejects": self.rejects, "reject_samples": self.reject_samples,
               "pairs_tried": len(self.recipes)}
        json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "serve":
        serve()
    elif cmd == "run":
        dry = "--dry" in sys.argv
        if not dry:
            wait_server()
        g = Gen(dry=dry).run()
        if int(os.environ.get("MAZERU_DENSE", "0")):
            g.densify(int(os.environ["MAZERU_DENSE"]))
        g.export(os.path.join(WORK, "raw_graph_dry.json" if dry else "raw_graph.json"))
        log("done", len(g.elems), "elems", sum(1 for v in g.recipes.values() if v), "recipes")
    elif cmd == "test":
        wait_server()
        t = time.time()
        print(ask_pairs([("水", "土"), ("火", "土"), ("米", "人"), ("木", "風"), ("人", "人"), ("水", "米")]), f"{time.time()-t:.2f}s")
        print(ask_classes(["徳川家康", "きりたんぽ", "ぴろぽん", "ドラえもん", "桜餅"]))
