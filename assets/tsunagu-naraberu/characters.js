// キャラ定義。強さは全員同じで、見た目と声だけが違う。絵と声のファイル名はここだけが知っている。
// 設定の正本: docs/tsunagu-naraberu-stylebook.md
export const EXPRESSIONS = ['normal', 'happy', 'attack', 'ouch', 'pinch', 'win', 'lose'];
export const LINE_KEYS = ['select', 'start', 'c1', 'c2', 'c3', 'c4', 'c5', 'ouch', 'danger', 'win', 'lose'];

export const CHARACTERS = [
  {
    id: 'hinata', voice: true, name: 'ひなた', faction: 'tsunagu', partner: 'punimaru', trait: '元気・負けず嫌い',
    color: { main: '#ff8a3d', sub: '#ffd23f' },
    lines: {
      select: 'ひなた、いっくよー！', start: 'よーし、負けないよっ！',
      c1: 'えいっ！', c2: 'それそれっ！', c3: 'サンシャイン！', c4: 'サンライズ・ブースト！', c5: 'ひなたスペシャル、フルバーストー！',
      ouch: 'いったぁ〜い！', danger: 'や、やばいかもっ！', win: 'やったー！ひなたの勝ちっ！', lose: 'くぅ〜、次は負けないもん！',
    },
  },
  {
    id: 'momo', voice: true, name: 'もも', faction: 'tsunagu', partner: 'punimaru', trait: 'おっとり・天然',
    color: { main: '#ff8fb8', sub: '#fff1d6' },
    lines: {
      select: 'ももで〜す、よろしくね〜', start: 'のんびりいこうね〜',
      c1: 'え〜いっ', c2: 'ふわり〜', c3: 'マシュマロ・レイン〜', c4: 'ピーチ・ハリケーン〜！', c5: 'ふわふわ・ふぃなーれ〜！',
      ouch: 'きゃっ…！', danger: 'あわわ、いっぱいだよ〜', win: 'わ〜い、勝っちゃった〜', lose: 'うぅ…まけちゃった〜',
    },
  },
  {
    id: 'rin', voice: true, name: 'りん', faction: 'naraberu', partner: 'kakutan', trait: 'クール・秀才',
    color: { main: '#3fc8e4', sub: '#2a3f8f' },
    lines: {
      select: 'りん。…計算どおりに', start: '始めましょう',
      c1: 'そこ', c2: 'つながる', c3: '解析完了', c4: 'これが最適解…！', c5: '証明、終了…！',
      ouch: 'くっ…！', danger: 'まずい…立て直す', win: '当然の結果ね', lose: '…計算ミス、ね',
    },
  },
  {
    id: 'suzu', voice: true, name: 'すず', faction: 'naraberu', partner: 'kakutan', trait: 'いたずら好き',
    color: { main: '#7fdcb4', sub: '#a77bff' },
    lines: {
      select: 'すずにおまかせっ♪', start: 'いたずら開始〜！',
      c1: 'にひっ', c2: 'ほいほいっ！', c3: 'びっくり箱〜！', c4: 'どか〜ん、だよ！', c5: 'すずちゃん、大・爆・発〜っ！',
      ouch: 'にゃあっ！', danger: 'ちょ、ちょっとピンチかも〜', win: 'にっしし、すずの勝ち〜♪', lose: 'むぅ〜、ずるいずるい〜！',
    },
  },
];

export const CHAR = Object.fromEntries(CHARACTERS.map(c => [c.id, c]));
export const charsOf = faction => CHARACTERS.filter(c => c.faction === faction);
export const spritePath = (id, expr) => `chara/${id}/${expr}.webp`;
export const voicePath = (id, key) => `voice/${id}_${key}.mp3`;
// 声のファイルがあるキャラだけ（ElevenLabs で作ったもの）
export const hasVoice = id => !!(CHAR[id] && CHAR[id].voice);
