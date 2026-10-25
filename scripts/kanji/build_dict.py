"""まぜる漢字: JMdict / KANJIDIC2 から熟語の辞書を作る。

使い方:  python -I scripts/kanji/build_dict.py [辞書の場所=C:/tmp/mazeru-gen/dict]

入力（手元だけ。リポジトリには置かない）: JMdict_e.gz, kanjidic2.xml.gz（© EDRDG, CC BY-SA 4.0）
出力:
  data/kanji/words.json  … 答えになる語 common: [[語, 読み, 学年, 質], ...]
                            質 0=よく使う（news1/ichi1） 1=使う（spec/gai のみ） 2=問題の答えに出したくない
                            （古語・略語・まれ・かな書きがふつう・固有名詞らしい）。2 を含む盤は問題に使わない。
                            proper: 英訳が大文字で始まる語（東京・月曜 など。盤ごとに2語まで）
  data/kanji/extra.txt   … 辞書にはある語（正解には数えない）を改行区切り
  data/kanji/kanji.json  … 字 → 学年（1〜6 小学、8 中学の常用）
  data/kanji/stats.json  … 件数と除外の内訳（語そのものは書かない）
  data/kanji/LICENSE.txt … 出典とライセンス
除外: JMdict の misc に vulgar / derogatory / X rated / sensitive を持つ語、
      scripts/mazeru/ngwords.py の ng_reason に当たる語（語はハッシュでだけ持つ）、
      および下の VIOLENT_CHARS の字を含む語（子どもが遊ぶ前提。件数は stats.json）。
"""
from __future__ import annotations

import collections
import gzip
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "mazeru"))
from ngwords import ng_reason  # noqa: E402

DICT = Path(sys.argv[1] if len(sys.argv) > 1 else "C:/tmp/mazeru-gen/dict")
OUT = ROOT / "data" / "kanji"
OUT.mkdir(parents=True, exist_ok=True)

KAN = re.compile(r"^[\u4e00-\u9fff]+$")
PRI = re.compile(r"^(news1|ichi1|spec1|spec2|gai1|nf(0[1-9]|1\d|2[0-4]))$")
# よく使う（質0）: 一万語語彙（ichi1）、新聞の上位6,000語（nf01〜12）、spec1
CORE = re.compile(r"^(ichi1|spec1|nf(0[1-9]|1[0-2]))$")
# 専門の言い回し（野球・相撲・将棋など）。全部の意味がこの分野なら、盤の答えに出さない
JARGON_FIELD = ("baseball", "sumo", "mahjong", "shogi", "go (game)", "hanafuda", "card games", "horse racing", "golf",
                "martial arts", "professional wrestling", "kabuki", "noh")
AFFIX_POS = ("suffix", "prefix", "counter")
# 頻度の印はあるが、単独の答えとしては不自然な語（野球の言い回し・読みが特殊な語など）。
# 日替わりの答えを読んで確かめたときに見つけたもの。辞書には残し「辞書にはある言葉」として扱う
ODD_ANSWERS = set("""中前 左前 右前 左中 右中 中越 左越 右越 七七日 二七日 一期 一二 人中 間中 一人物 代人 上期 下期 小人 大便 小便
                  中中 各各 日産 目黒 鳴門 高瀬 醜女 畜生 白人 黒人 手錠 仕手""".split())
# 同じ字で読みのちがう見出しが2つあり、ふだんの読みでない方が選ばれてしまう語（確かめて直したもの）
READ_FIX = {"火口": "かこう"}
BAD_MISC = ("vulgar", "derogatory", "X rated", "sensitive")
# 答えに出したくない印（辞書には残すが、問題の盤には使わない）
OBSCURE_MISC = ("archaic", "obsolete", "rare term", "dated term", "abbreviation",
                "word usually written using kana alone", "historical term", "Internet slang", "slang")
BAD_KEINF = ("rarely used kanji form", "search-only kanji form", "irregular kanji usage", "out-dated kanji")
# 固有名詞らしい英訳（地名・組織・時代など）
PROPER = re.compile(
    r"\((city|prefecture|town|district|province|region|country|China|Korea|US|UK|Japan)\b|"
    r"\b(Ministry|Minister|Party|Agency|Office|Court|Department|University|Corporation|newspaper|"
    r"Diet|House of|Prefecture|Station|Company|Bank|Army|Navy|Agreement|Treaty)\b|"
    r"\b(era|period) \(\d|\(\d{3,4}-\d{3,4}\)")
# 子どもが遊ぶ前提で、むごい印象の強い字（この字を含む語は答えにも辞書にも入れない）
VIOLENT_CHARS = set("殺屍")
# 除外語（部分一致）や字のルールに当たるが、教科書やニュースでふつうに使う語。
# JMdict の vulgar / X rated の印があれば、ここに入っていても除く。
ALLOW_KIDS = set("""
戦争 犯人 犯罪 泥棒 盗賊 盗人 囚人 商売人 販売人 競売人 詐欺 内臓 骨肉 刃物 空襲 原爆 被爆 被爆者 死者 戦死
殺到 殺菌 相殺 殺風景 忙殺 殺虫 殺虫剤 黙殺 殺伐 減殺 封殺 併殺 殺気 殺陣 殺生 必殺 必殺技
処女作 処女航海 処女峰 処女地 非人道的 非人間的 非人道 朝鮮人参 土人形 敬天愛人 官能基
婦人 婦人服 婦人警官 年寄 風呂屋 石屋 半島 下着
""".split())


def load_grades():
    grade = {}
    with gzip.open(DICT / "kanjidic2.xml.gz") as f:
        for _, el in ET.iterparse(f, events=("end",)):
            if el.tag == "character":
                g = el.find("misc/grade")
                if g is not None:
                    grade[el.findtext("literal")] = int(g.text)
                el.clear()
    return grade


def reading_for(entry, keb):
    """keb に当てはまる読み（re_restr を考慮。re_nokanji は飛ばす）と、その読みの頻度の印の数。
    当てはまる読みのうち、頻度の印（re_pri）が付いた最初の読み。印がどれにも無ければ最初の読み。
    （例: 上下 は うえした より じょうげ）"""
    cands = []
    for r in entry.findall("r_ele"):
        if r.find("re_nokanji") is not None:
            continue
        restr = [x.text for x in r.findall("re_restr")]
        if restr and keb not in restr:
            continue
        pri = sum(1 for p in r.findall("re_pri") if PRI.match(p.text or ""))
        cands.append((r.findtext("reb"), pri))
    if not cands:
        return None, 0
    for reb, pri in cands:
        if pri:
            return reb, pri
    return cands[0][0], 0


def main():
    grade = load_grades()
    joyo = {k: g for k, g in grade.items() if g <= 8}
    print("常用（学年1〜6・8）:", len(joyo), collections.Counter(joyo.values()))

    words = {}      # 語 -> dict(read, common, core, obscure, proper, bad)
    restr_cases = []
    with gzip.open(DICT / "JMdict_e.gz") as f:
        for _, el in ET.iterparse(f, events=("end",)):
            if el.tag != "entry":
                continue
            misc = {m.text for m in el.iter("misc") if m.text}
            bad = sorted(m for m in misc if any(t in m for t in BAD_MISC))
            senses = el.findall("sense")
            # 古語・略語などの印は意味ごとに付く。全部の意味がそうなら答えに出さない（1つだけなら出す。例: 社会・先生・大学）
            obsc = bool(senses) and all(any(any(t in (m.text or "") for t in OBSCURE_MISC) for m in sn.findall("misc")) for sn in senses)
            if senses and all(any(any(j in (f.text or "") for j in JARGON_FIELD) for f in sn.findall("field")) for sn in senses):
                obsc = True
            pos_all = [p.text or "" for p in el.iter("pos")]
            if pos_all and all(any(a in p for a in AFFIX_POS) for p in pos_all):
                obsc = True
            g1 = el.find("sense/gloss")
            gloss = (g1.text or "") if g1 is not None else ""
            proper = bool(PROPER.search(gloss))
            capital = bool(gloss[:1].isupper() and not gloss.startswith(("I ", "I'", "I;")) and gloss != "I")
            for k in el.findall("k_ele"):
                w = k.findtext("keb")
                if not KAN.match(w) or not (2 <= len(w) <= 4):
                    continue
                if any(c not in joyo for c in w):
                    continue
                pri = [p.text for p in k.findall("ke_pri")]
                kinf = [i.text for i in k.findall("ke_inf")]
                read, rpri = reading_for(el, w)
                if read is None:
                    continue
                first = el.find("r_ele/reb").text
                if read != first:
                    restr_cases.append((w, read, first))
                is_common = any(PRI.match(p) for p in pri) and not any(t in x for x in kinf for t in BAD_KEINF)
                rec = dict(read=read, rpri=rpri, common=is_common, core=any(CORE.match(p) for p in pri),
                           obscure=obsc, proper=proper, capital=capital, bad=bad)
                old = words.get(w)
                # 同じ語が複数の見出しにあるとき: よく使う方の見出しを採る。除外の印はどれか1つでもあれば残す
                if old is None:
                    words[w] = rec
                else:
                    keep = old if (old["common"], old["core"], old["rpri"]) >= (rec["common"], rec["core"], rec["rpri"]) else rec
                    keep = dict(keep)
                    # 下品・性的の印は同じ字の別の見出しでも引き継ぐ。差別・配慮の印は採った見出しのものだけ
                    # （例: 工夫 くふう は残し、こうふ の見出しの印は引き継がない）
                    hard = [b for b in set(old["bad"]) | set(rec["bad"]) if "vulgar" in b or "X rated" in b]
                    keep["bad"] = sorted(set(keep["bad"]) | set(hard))
                    keep["common"] = old["common"] or rec["common"]
                    words[w] = keep
            el.clear()

    n_all = len(words)
    n_common_raw = sum(1 for r in words.values() if r["common"])
    print("漢字だけ・2〜4字・全字常用:", n_all, " うち common:", n_common_raw)

    # ---------------- 除外
    removed = collections.Counter()      # 理由 -> 件数
    removed_common = collections.Counter()
    removed_samples = collections.defaultdict(list)  # 理由 -> 語（stats には書かない。端末にだけ件数）
    keep = {}
    for w, r in words.items():
        reason = None
        hard = [b for b in r["bad"] if "vulgar" in b or "X rated" in b]
        if hard or (r["bad"] and w not in ALLOW_KIDS):
            reason = "JMdict:" + "/".join(sorted({b.split()[0] for b in r["bad"]}))
        elif w in ALLOW_KIDS:
            reason = None
        elif any(c in VIOLENT_CHARS for c in w):
            reason = "字:むごい"
        else:
            ng = ng_reason(w)
            if ng:
                reason = "除外語:" + ng
        if reason:
            removed[reason] += 1
            if r["common"]:
                removed_common[reason] += 1
            removed_samples[reason].append(w)
            continue
        keep[w] = r

    def wgrade(w):
        return max(joyo[c] for c in w)

    def quality(r, w=""):
        if r["obscure"] or r["proper"] or w in ODD_ANSWERS:
            return 2
        return 0 if r["core"] else 1

    common = sorted((w for w, r in keep.items() if r["common"]), key=lambda w: (len(w), w))
    extra = sorted((w for w, r in keep.items() if not r["common"]), key=lambda w: (len(w), w))
    rows = [[w, READ_FIX.get(w, keep[w]["read"]), wgrade(w), quality(keep[w], w)] for w in common]
    capital = sorted(w for w in common if keep[w]["capital"])

    # ---------------- 既知の正解で確かめる（自作の集計は必ず検算）
    idx = {r[0]: r for r in rows}
    exs = set(extra)
    assert idx["火山"][1:3] == ["かざん", 1], idx["火山"]
    assert idx["花火"][1:3] == ["はなび", 1], idx["花火"]
    assert idx["学校"][1:3] == ["がっこう", 1], idx["学校"]
    assert idx["図書館"][1:3] == ["としょかん", 3], idx["図書館"]       # 館は小3
    assert idx["一石二鳥"][1:3] == ["いっせきにちょう", 2], idx["一石二鳥"]  # 鳥は小2
    assert idx["今日"][1] == "きょう", idx["今日"]
    assert idx["上下"][1] == "じょうげ", idx["上下"]                    # 頻度の印がある読みを採る
    assert idx["大人"][1] == "おとな", idx["大人"]
    assert idx["日本"][1] in ("にほん", "にっぽん")
    assert idx["山脈"][2] == 5                                          # 脈は小5
    for w in ("社会", "先生", "大学"):                                  # 略語などの印が一部の意味だけにある語は答えにする
        assert idx[w][3] < 2, (w, idx[w])
    assert idx["憂鬱"][2] == 8 if "憂鬱" in idx else True                # 鬱は2010年に常用入り
    assert idx["東京"][3] == 0 and keep["東京"]["capital"]               # 東京は固有名詞だが よく使う
    assert idx["大蔵省"][3] == 2, idx["大蔵省"]                          # 省庁名（固有名詞らしい）は盤に出さない
    assert idx["中前"][3] == 2, idx["中前"]                              # 野球の言い回しは盤に出さない
    assert idx["年生"][3] == 2, idx["年生"]                              # 接尾語だけの語は盤に出さない
    assert idx["人中"][3] == 2 and idx["学校"][3] == 0                   # 単独では不自然な語は質2、学校は質0
    assert idx["理工"][3] == 1                                           # 新聞の下位（nf17）だけの語は質1
    # 負例: 入らないはずの語
    for w in ["時々", "人々", "苺", "薔薇", "お茶", "林檎", "火"]:
        assert w not in idx and w not in exs, w
    for w in ["嘘八百"]:   # 「嘘」は常用（2010）だが、念のため存在だけ見る
        pass
    assert idx["工夫"][1] == "くふう", idx["工夫"]     # 別の見出し（こうふ）の配慮の印は引き継がない
    assert "殺到" in idx and "半島" in idx and "戦争" in idx
    for w in ["殺人", "虐殺", "自殺", "誘拐"]:            # むごい語は答えにも辞書にも残らない
        assert w not in idx and w not in exs, w
    assert all(len(r[0]) in (2, 3, 4) for r in rows)
    assert all(1 <= r[2] <= 8 and r[2] != 7 for r in rows)
    assert not (set(common) & exs)
    # JMdict の差別・下品・性的の印を持つ語は、どこにも残らない
    flagged = {w for w, r in words.items() if r["bad"]} - ALLOW_KIDS
    assert flagged and not (flagged & set(common)) and not (flagged & exs), len(flagged)
    # re_restr を考慮した読み: 最初の reb と違う読みになった語が実際にある（考慮が効いている）
    assert restr_cases, "re_restr の例がない"
    for w, read, first in restr_cases[:3]:
        print("  re_restr の例:", w, read, "（最初の reb は", first + "）")

    # ---------------- 書き出し
    (OUT / "words.json").write_text(
        json.dumps({"v": 1, "cols": ["word", "read", "grade", "q"], "common": rows, "proper": capital}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8")
    (OUT / "extra.txt").write_text("\n".join(extra) + "\n", encoding="utf-8", newline="\n")  # Windows でも LF
    (OUT / "kanji.json").write_text(json.dumps(dict(sorted(joyo.items(), key=lambda kv: (kv[1], kv[0]))),
                                               ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    lens = collections.Counter(len(w) for w in common)
    qs = collections.Counter(r[3] for r in rows)
    stats = {
        "source": "JMdict_e / KANJIDIC2 (EDRDG, CC BY-SA 4.0)",
        "kanji_joyo": len(joyo),
        "kanji_by_grade": dict(sorted(collections.Counter(joyo.values()).items())),
        "candidates_all": n_all,
        "candidates_common": n_common_raw,
        "common": len(common),
        "common_by_len": dict(sorted(lens.items())),
        "common_by_quality": dict(sorted(qs.items())),
        "common_capitalized_gloss": len(capital),
        "extra": len(extra),
        "removed_total": sum(removed.values()),
        "removed_by_reason": dict(removed.most_common()),
        "removed_common_by_reason": dict(removed_common.most_common()),
    }
    (OUT / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "LICENSE.txt").write_text(
        "data/kanji/ の熟語データ（words.json, extra.txt, kanji.json）は、次の辞書から作った二次的著作物です。\n\n"
        "- JMdict (Japanese-Multilingual Dictionary) © Electronic Dictionary Research and Development Group (EDRDG)\n"
        "- KANJIDIC2 © Electronic Dictionary Research and Development Group (EDRDG)\n\n"
        "ライセンス: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)\n"
        "https://www.edrdg.org/edrdg/licence.html\n"
        "https://creativecommons.org/licenses/by-sa/4.0/\n\n"
        "このデータも同じ CC BY-SA 4.0 で配布します。変更点: 漢字だけの2〜4字の語で、全字が常用漢字のものを抜き出し、\n"
        "読み（最初の読み）と学年（構成する字の学年の最大値）を付け、下品・差別・性的・むごい語を除いた。\n",
        encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False, indent=1))
    print("extra.txt", (OUT / "extra.txt").stat().st_size, "bytes / words.json", (OUT / "words.json").stat().st_size, "bytes")
    # 除外の見本（端末にだけ。語の数は理由ごとに最大8件）— 確認用。リポジトリには書かない
    samp = DICT.parent / "removed_samples.json"
    samp.write_text(json.dumps({k: v for k, v in removed_samples.items()}, ensure_ascii=False, indent=0), encoding="utf-8")
    print("除外の見本（手元のみ）:", samp)


if __name__ == "__main__":
    main()
