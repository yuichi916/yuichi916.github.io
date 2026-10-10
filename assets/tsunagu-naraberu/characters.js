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
      c1: 'えいっ！', c2: 'それそれっ！', c3: 'まだまだー！', c4: 'いっけぇぇ！', c5: 'ひなたスペシャルー！',
      ouch: 'うわわっ！', danger: 'や、やばいかもっ！', win: 'やったー！ひなたの勝ちっ！', lose: 'くぅ〜、次は負けないもん！',
    },
  },
  {
    id: 'momo', voice: true, name: 'もも', faction: 'tsunagu', partner: 'punimaru', trait: 'おっとり・天然',
    color: { main: '#ff8fb8', sub: '#fff1d6' },
    lines: {
      select: 'ももで〜す、よろしくね〜', start: 'のんびりいこうね〜',
      c1: 'え〜いっ', c2: 'ふわっ', c3: 'それ〜っ', c4: 'もも、がんばっちゃう〜！', c5: 'ふわふわ・ふぃなーれ〜！',
      ouch: 'きゃっ…！', danger: 'あわわ、いっぱいだよ〜', win: 'わ〜い、勝っちゃった〜', lose: 'うぅ…まけちゃった〜',
    },
  },
  {
    id: 'rin', voice: true, name: 'りん', faction: 'naraberu', partner: 'kakutan', trait: 'クール・秀才',
    color: { main: '#3fc8e4', sub: '#2a3f8f' },
    lines: {
      select: 'りん。…計算どおりに', start: '始めましょう',
      c1: 'そこ', c2: 'つながる', c3: '計算どおり', c4: 'これで終わり', c5: '完全解答…！',
      ouch: 'くっ…！', danger: 'まずい…立て直す', win: '当然の結果ね', lose: '…計算ミス、ね',
    },
  },
  {
    id: 'suzu', voice: true, name: 'すず', faction: 'naraberu', partner: 'kakutan', trait: 'いたずら好き',
    color: { main: '#7fdcb4', sub: '#a77bff' },
    lines: {
      select: 'すずにおまかせっ♪', start: 'いたずら開始〜！',
      c1: 'にひっ', c2: 'ほいっと！', c3: 'まだまだあるよ〜', c4: 'どっかーん！', c5: 'すずちゃん大爆発〜！',
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
