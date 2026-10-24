"""まぜる日本: 除外語の辞書とルール。

差別語・性的な語・むごい語・薬物・犯罪・下品な語などを、要素名に部分一致（SUB）または
完全一致（EXACT）したら除外する。公開リポジトリに語そのものを並べないため、語は
SHA-256（UTF-8）だけを ngwords_sha256.json に置き、要素名の部分文字列をハッシュして照らす。
平文の一覧は手元にだけ置いている（判定結果が平文版と一致することは全要素・全候補で確認済み）。
ここに無い実在の人物名・商標は、LLMの分類（実在の人物／商品名・会社名・作品名）で落とす。
"""
import hashlib
import json
from pathlib import Path

_D = json.loads((Path(__file__).with_name("ngwords_sha256.json")).read_text(encoding="utf-8"))
_SUB = [(r, set(hs)) for r, hs in _D["sub"]]
_SUB_POST = [(r, set(hs)) for r, hs in _D["sub_post"]]
_EXACT = [(r, set(hs)) for r, hs in _D["exact"]]
_MAXLEN = _D["max_len"]

# 例外（部分一致で引っかかるが問題のない語）
ALLOW = {
    "おしぼり", "おしるこ", "おしゃれ", "おしろい", "押し花", "おしくら", "おしゃべり", "おしどり", "押し寿司",
    "おしんこ", "推し", "おしめ", "非人情", "春雨", "春巻", "春菊", "春一番", "青春", "春分",
    "早春", "初春", "立春", "春風", "春眠", "春霞", "春祭り", "春の七草", "ラインダンス",
    "アップルパイ", "外人墓地", "ハゲ山", "はげ山",
}


def _h(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _subs(name):
    """name の部分文字列（長さ _MAXLEN まで）と、そのハッシュ。"""
    n = len(name)
    for i in range(n):
        for j in range(i + 1, min(n, i + _MAXLEN) + 1):
            w = name[i:j]
            yield w, _h(w)


def ng_reason(name, post=False):
    """post=True で、仕上げの門の語（SUB_POST）も見る。"""
    if name in ALLOW:
        return None
    subs = list(_subs(name))
    if post:
        for reason, hs in _SUB_POST:
            if any(x in hs for _, x in subs):
                return reason
    hn = _h(name)
    for reason, hs in _EXACT:
        if hn in hs:
            return reason
    for reason, hs in _SUB:
        for w, x in subs:
            if x in hs:
                # ALLOW に入っている語を含むだけなら許す（例: 春雨 など）
                if any(a in name and w in a for a in ALLOW):
                    continue
                return reason
    return None


if __name__ == "__main__":
    for t in ["おしぼり", "春雨", "河童", "死神", "アップルパイ", "春"]:
        print(t, ng_reason(t))
