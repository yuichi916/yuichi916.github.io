// ランキングの名前（自由入力のニックネーム）を確かめる（ページとサーバーで同じもの）。
// 1〜12 字。字の形をそろえ（NFKC・前後の空白を落とす）、制御文字・URL・メールの形・禁止語を含む名前は受けない。
// 禁止語は、よくある悪口・性的な言葉・差別の言葉の一部。すり抜けた名前は、管理用の合言葉でサーバーから隠せる。
// ふつうの言葉の一部によく出る語（「わすれず」の「れず」、skill の kill など）は、単語や名前全体のときだけ引っかける。

export const NAME_MAX = 12;

// どこに含まれていてもだめな語（照らし合わせは、ひらがな → カタカナ・英字は小文字・空白と記号と長音を抜いた形）
const NG_SUB = [
  '死ね', 'ころす', '殺す', 'ころせ', 'きえろ', '消えろ', 'くたばれ', '馬鹿', '阿呆', 'きもい', 'うざい',
  'ちんこ', 'ちんぽ', 'まんこ', 'せっくす', 'せふれ', 'おっぱい', 'ぱいぱん', 'れいぷ', 'ふぇら', 'うんこ', 'うんち', 'しっこ', 'おなに',
  'きちがい', '気違い', 'がいじ', 'しょうがいしゃ', 'めくら', 'つんぼ', 'しなじん', '支那', '部落', 'ちょうせんじん', 'ざいにち',
  'じさつ', '自殺', 'なちす', 'ひとらー', '麻薬', 'まやく', 'かくせいざい', '覚醒剤',
  'fuck', 'shit', 'bitch', 'cunt', 'pussy', 'penis', 'vagina', 'porn', 'slut', 'whore', 'bastard', 'asshole', 'nigg', 'retard', 'hitler', 'nazi', 'suicide',
];
// 英語の単語として出たときだけだめな語（前後が英字でないとき）
const NG_WORD = ['kill', 'anal', 'sex', 'sexy', 'dick', 'cock', 'fag', 'spic', 'chink', 'gook', 'kike', 'terror', 'nude', 'boob', 'boobs', 'tits', 'rape', 'isis', 'kys', 'cum', 'fuk', 'wtf'];
// 名前全体がその語のときだけだめな語（短くて、ふつうの言葉の一部によく出る）
const NG_EXACT = ['しね', 'ばか', 'あほ', 'かす', 'くず', 'ごみ', 'えろ', 'おし', 'えた', 'ひにん', 'ちょん', 'かたわ', 'てろ', 'ほも', 'れず', 'おかま', 'ぶらく'];

function kata(s) { return s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)); }
const INVISIBLE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff<>]');
const SEP = /[\s　・\-_.~ー〜'"!?！？*＊@#$%^&()（）[\]{}<>|\\/+=:;,，。、…‥]/g;
function leet(s) { return s.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/\$/g, 's'); }
function fold(s) { return leet(kata(String(s).normalize('NFKC').toLowerCase()).replace(SEP, '')); }
const NG_SUB_F = NG_SUB.map(fold).filter(Boolean);
const NG_EXACT_F = NG_EXACT.map(fold);

// 受けられる名前ならそろえた名前、受けられなければ null
export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  const len = [...s].length;
  if (len < 1 || len > NAME_MAX) return null;
  if (INVISIBLE.test(s)) return null; // 見えない字・向きを変える字・タグ
  if (/(https?:|www\.|\.(com|net|org|jp|io|gg|xyz|me|ly)\b|@[a-z0-9])/i.test(s)) return null; // URL・メール・SNS の名前
  const f = fold(s);
  if (!f) return null;
  if (NG_EXACT_F.includes(f)) return null;
  if (NG_SUB_F.some((w) => f.includes(w))) return null;
  const words = leet(s.toLowerCase()).split(/[^a-z]+/).filter(Boolean);
  if (words.some((w) => NG_WORD.includes(w))) return null;
  return s;
}
