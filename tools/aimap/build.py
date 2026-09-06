"""AI能力アトラス: 調査JSON(scratch) を統合・検証して data/ai-map.json を作る。
usage: python tools/aimap/build.py <scratch_dir> [--check-only]
"""
import json, sys, os, re

SRC = sys.argv[1]
CHECK = '--check-only' in sys.argv
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'data', 'ai-map.json')
TP = ["2022", "2023", "2024", "2025", "2026", "2027e", "2028e", "2030e"]
DOMS = [  # id, name, name_en, color, summary
    ("content", "コンテンツ制作", "Content Creation", "#c43d2a", "文章・画像・動画・音楽・3D・デザイン。生成は速いが、長さと一貫性と「声」で差がつく"),
    ("dev", "ソフトウェア開発", "Software Development", "#2d5f8a", "最も海岸線が動いた領域。検証できる仕事から順に自律化する"),
    ("research", "研究・問題解決", "Research & Problem Solving", "#5a7d2a", "数学・科学・データ分析・文献調査。検証可能な問題ほど強く、問題設定そのものは人"),
    ("business", "事務・ビジネス", "Business & Office Work", "#8a6d2d", "文書・表計算・連絡・サポート。定型は強いが、社内事情と責任は人に残る"),
    ("professional", "専門職サービス", "Professional Services", "#6b3f8a", "医療・法務・金融・教育・建築・心理。技術より資格と責任の構造が天井を決める"),
    ("physical", "物理世界・ロボット", "Physical World & Robotics", "#3f7d7a", "自動運転・人型・家庭・産業。ソフトより2〜4年遅れ、器用さと安全性が壁"),
    ("personal", "個人の生活", "Personal Life", "#b0662d", "調べもの・予約・健康・学習・対話。決済と本人確認と感情の責任が境界"),
    ("foundation", "基盤能力（横断）", "Foundation Capabilities", "#444444", "時間地平・計画・ツール・記憶・検証・安全。全領域の海岸線を動かす地下水脈"),
]
# サイト内実例: (正規表現 on task id+name, [examples])
SITE = [
    (r"小説|物語|長編|短編|脚本|シナリオ|novel|fiction|story|script", [
        {"title": "正解の外側 — 15話・ボイス1,593本のサウンドノベル", "url": "seikai.html", "kind": "作品"},
        {"title": "百の悪行 — 倒叙×魔王のサウンドノベル", "url": "hyaku.html", "kind": "作品"},
        {"title": "1日ノベル化パイプライン（作り方）", "url": "method/ichinichi-novel-pipeline.html", "kind": "作り方"}]),
    (r"ゲーム|game|インタラクティブ", [
        {"title": "ことつぎの星 — 読者を観測するメタフィクションADV", "url": "kototsugi/index.html", "kind": "作品"},
        {"title": "異世界立体数独 ルーン・キューブ", "url": "sudoku.html", "kind": "作品"},
        {"title": "将棋ぷよ「成」", "url": "shogi-puyo.html", "kind": "作品"}]),
    (r"画像|イラスト|image|illust|漫画|manga|comic", [
        {"title": "とびだす絵本 — 3D絵本の挿絵と世界", "url": "ehon.html", "kind": "作品"},
        {"title": "品質検問 — AI生成物は静かに壊れる", "url": "method/hinshitsu-kenmon.html", "kind": "作り方"}]),
    (r"動画|video|映像|字幕", [
        {"title": "ずんだもんのAIラボ（YouTube）", "url": "https://www.youtube.com/@zundamon_ai_lab", "kind": "動画"},
        {"title": "1分AI英語 — ニュース原文×TOEIC単語のShorts", "url": "ai-english.html", "kind": "作品"}]),
    (r"音楽|music|作曲|歌|音声|voice|tts|ナレーション|speech", [
        {"title": "Music Universe — 19,810アーティストの音楽宇宙地図", "url": "universe.html", "kind": "作品"},
        {"title": "森の小屋 — 焚き火と環境音の360°瞑想空間", "url": "cabin.html", "kind": "作品"}]),
    (r"3d|三次元|blender|空間|panorama", [
        {"title": "浮遊島 — three.js の探索世界", "url": "niwa.html", "kind": "作品"},
        {"title": "森の小屋360°（Blender Cycles→three.js）", "url": "cabin.html", "kind": "作品"}]),
    (r"翻訳|localiz|多言語|translation", [
        {"title": "lingo — YouTube動画の英日二段字幕", "url": "lingo.html", "kind": "作品"},
        {"title": "一度作って、七度出す（多言語展開の型）", "url": "method/index.html", "kind": "作り方"}]),
    (r"プロトタイプ|prototype|フルアプリ|web|アプリ|app|フロント|frontend|新規", [
        {"title": "ひとり歓迎マップ — 5,399施設の地図アプリ", "url": "hitori.html", "kind": "作品"},
        {"title": "このアトラス自体（d3・単一HTML・JSON駆動）", "url": "ai-map.html", "kind": "作品"}]),
    (r"デバッグ|debug|障害|切り分け|テスト|test", [
        {"title": "自動テスト — 完成率は切り分けの技術から", "url": "method/jidou-test.html", "kind": "作り方"},
        {"title": "導線点検（壊れ方の記録）", "url": "method/dousen-tenken.html", "kind": "作り方"}]),
    (r"数学|math|定理|証明|未解決|erd", [
        {"title": "Erdős未解決問題ハント（計算探索・記録拡張）", "url": "https://note.com/views_of_life", "kind": "記事"}]),
    (r"データ分析|統計|data|analysis|可視化|visual", [
        {"title": "需要の露天掘り — 数万件のタイトル頻度で飽和と空白を数値化", "url": "method/juyou-no-rotenbori.html", "kind": "作り方"},
        {"title": "Music Universe（19k点のベクトル地図）", "url": "universe.html", "kind": "作品"}]),
    (r"文献|survey|調査|deep research|リサーチ|情報探索|検索|search", [
        {"title": "ひとり基準 — 公式サイト634施設ぶんの根拠抽出", "url": "method/hitori-kijun.html", "kind": "作り方"}]),
    (r"抽出|extract|rag|ナレッジ|knowledge|定型|自動化|browser|ブラウザ|pc操作|rpa", [
        {"title": "ひとり歓迎マップの抽出パイプライン（5.6k tok/施設）", "url": "method/hitori-kijun.html", "kind": "作り方"}]),
    (r"学習|語学|language|英語|english|tutor|指導", [
        {"title": "lingo — 英日二段字幕でリスニング", "url": "lingo.html", "kind": "作品"},
        {"title": "1分AI英語", "url": "ai-english.html", "kind": "作品"}]),
    (r"瞑想|睡眠|sleep|健康|health|孤独|companion|対話", [
        {"title": "行かなくていい場所 — 移動せず没入する場所体験", "url": "method/ikanakute-ii-basho.html", "kind": "作り方"},
        {"title": "森の小屋 — 瞑想空間", "url": "cabin.html", "kind": "作品"}]),
    (r"旅行|travel|ひとり|solo|外食|店|施設", [
        {"title": "ひとり歓迎マップ", "url": "hitori.html", "kind": "作品"}]),
    (r"長時間|long|time horizon|時間地平|計画|plan|分解|マルチエージェント|multi-agent|委任", [
        {"title": "質問の解像度 — 壁打ちの型", "url": "method/shitsumon-no-kaizoudo.html", "kind": "作り方"},
        {"title": "ことつぎの星 開発記（AIと二人で作った全工程）", "url": "devlog/01-building-kototsugi-with-ai.html", "kind": "記事"}]),
    (r"自己検証|検証|hallucin|幻覚|信頼|reliab|verif", [
        {"title": "品質検問（三つの検問所）", "url": "method/hinshitsu-kenmon.html", "kind": "作り方"}]),
]


def site_examples(t):
    key = (t["id"] + " " + t["name"] + " " + t.get("name_en", "")).lower()
    out, seen = [], set()
    for rx, exs in SITE:
        if re.search(rx, key, re.I):
            for e in exs:
                if e["url"] not in seen:
                    seen.add(e["url"])
                    out.append(e)
        if len(out) >= 3:
            break
    return out[:3]


errors, warns = [], []
# 事前URL検査の結果（/c/tmp/aimap_urlstatus.json: url -> status）があれば 404/410 の根拠を落とす
DEAD = {}
_st = os.environ.get("AIMAP_URLSTATUS", "C:/tmp/aimap_urlstatus.json")
if os.path.exists(_st):
    DEAD = json.load(open(_st, encoding="utf-8"))


def load(name):
    p = os.path.join(SRC, name + '.json')
    if not os.path.exists(p):
        errors.append(f"missing {name}.json")
        return None
    try:
        return json.load(open(p, encoding='utf-8'))
    except Exception as e:
        errors.append(f"{name}.json invalid: {e}")
        return None


def norm_autonomy(v):
    s = str(v or "").lower()
    if "autonomous" in s:
        return "autonomous"
    if "agent" in s:
        return "agent"
    return "copilot"


domains, ids, ntask = [], set(), 0
for did, name, ne, color, summary in DOMS:
    d = load(did)
    if not d:
        continue
    areas = d.get("areas", [])
    if not (4 <= len(areas) <= 10):
        warns.append(f"{did}: {len(areas)} areas")
    for a in areas:
        a.setdefault("id", f"{did}.{re.sub(r'[^a-z0-9]+', '_', a.get('name_en', 'x').lower())}")
        if not a["id"].startswith(did + "."):
            a["id"] = did + "." + a["id"].split(".")[-1]
        for t in a.get("tasks", []):
            ntask += 1
            for k in ["id", "name", "levels", "vs_expert", "can", "cannot", "why"]:
                if not t.get(k):
                    errors.append(f"{did}: task {t.get('id')} missing {k}")
            if t.get("id") and not t["id"].startswith(a["id"] + "."):
                t["id"] = a["id"] + "." + t["id"].split(".")[-1]
            if t.get("id") in ids:
                errors.append(f"dup id {t['id']}")
            ids.add(t.get("id"))
            lv = t.get("levels", {})
            for tp in TP:
                if tp not in lv:
                    errors.append(f"{t.get('id')}: levels missing {tp}")
                else:
                    try:
                        lv[tp] = int(lv[tp])
                    except Exception:
                        errors.append(f"{t.get('id')}: level {tp} not int")
                    if not (0 <= lv.get(tp, 0) <= 5):
                        errors.append(f"{t.get('id')}: level out of range")
            seq = [lv.get(tp, 0) for tp in TP]
            if any(seq[i] > seq[i + 1] for i in range(len(seq) - 1)):
                warns.append(f"{t.get('id')}: non-monotonic {seq}")
            if DEAD:
                t["evidence"] = [e for e in t.get("evidence", []) if DEAD.get(e.get("url"), "200") not in ("404", "410")]
            if not t.get("evidence"):
                warns.append(f"{t.get('id')}: no evidence")
            for e in t.get("evidence", []):
                if not re.match(r"https?://", e.get("url", "")):
                    errors.append(f"{t.get('id')}: bad evidence url {e.get('url')}")
            if t.get("autonomy") not in ("copilot", "agent", "autonomous"):
                warns.append(f"{t.get('id')}: autonomy={t.get('autonomy')}")
                t["autonomy"] = norm_autonomy(t.get("autonomy"))
            t["site_examples"] = site_examples(t)
            for k in ("_d", "_a"):
                t.pop(k, None)
    domains.append({"id": did, "name": name, "name_en": ne, "color": color, "summary": summary, "areas": areas})

# 校正（重複除去・判定修正・表記修正）を適用
CAL = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "calibration.json"), encoding="utf-8"))
_all = {t["id"]: t for dm in domains for ar in dm["areas"] for t in ar["tasks"]}
for r in CAL.get("remove", []):
    if r["id"] not in _all:
        errors.append(f"calibration remove: unknown id {r['id']}")
    for dm in domains:
        for ar in dm["areas"]:
            ar["tasks"] = [t for t in ar["tasks"] if t["id"] != r["id"]]
for r in CAL.get("levels", []):
    if r["id"] not in _all:
        errors.append(f"calibration levels: unknown id {r['id']}")
        continue
    _all[r["id"]]["levels"].update({k: int(v) for k, v in r["levels"].items()})
    _all[r["id"]]["calibrated"] = r["reason"]
for r in CAL.get("rename", []):
    if r["id"] not in _all:
        errors.append(f"calibration rename: unknown id {r['id']}")
        continue
    _all[r["id"]]["name"] = r["name"]
ntask = sum(len(ar["tasks"]) for dm in domains for ar in dm["areas"])

models = load("models") or {}
for m in models.get("milestones", []):
    if not re.match(r"\d{4}-\d{2}", m.get("date", "")):
        errors.append(f"milestone bad date {m}")
    if DEAD.get(m.get("url"), "200") in ("404", "410"):
        m["url"] = ""
# 古い記述の修正: ARC-AGI-2 の予測文は2025年時点の数値のままなので、指標データと矛盾しないよう差し替える
for f in models.get("forecasts", []):
    if "ARC" in f.get("who", ""):
        f["claim"] = "ARC-AGI-2 は2025年前半に最先端でも一桁%だったが、2026年3月には8割超に達した（指標参照）。財団は次世代の ARC-AGI-3（対話型）を「人には易しくAIには難しい」次の基準として提示しており、達成時期は明言していない"
for met in models.get("metrics", []):
    if met.get("id") in ("metr_time_horizon", "context_window", "price_per_mtok"):
        met["scale"] = "log"

print(f"tasks={ntask} domains={len(domains)} milestones={len(models.get('milestones', []))} metrics={len(models.get('metrics', []))}")
for w in warns[:40]:
    print("WARN", w)
if len(warns) > 40:
    print(f"... {len(warns) - 40} more warnings")
for e in errors:
    print("ERROR", e)
if errors:
    sys.exit(1)
if CHECK:
    sys.exit(0)
out = {"meta": {"asof": "2026-09-06", "version": "1.0", "timepoints": TP,
                "changelog": [{"date": "2026-09-06", "note": "初版公開"}]},
       "domains": domains, "models": models}
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("wrote", OUT, os.path.getsize(OUT), "bytes")
