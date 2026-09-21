// 本文 → 特徴ベクトル。ブラウザ側。
//
// Python 版（shinsa_bench/interest/featurize.py）と**一字一句同じ計算**をする。
// 差が出たら採点がずれるので、テストで完全一致を確認している。
//
// ここが公開されても困らないように作ってある。
// やっているのは「文字n-gramをハッシュして数える」だけで、
// 重み・idf・較正・参照分布はサーバにある。
// 送るのは (バケット番号, 個数) の並びだけで、原稿は復元できない。

const NB = {
  BITS: 18,
  NGRAM_MIN: 2,
  NGRAM_MAX: 4,
  HEAD_CHARS: 12000,

  // 前処理。Python 側と順序までそろえること
  //  1. NFKC
  //  2. 空白（全角・改行を含む）を半角1つに
  //  3. 前後を落として先頭 HEAD_CHARS 字
  normalize(text) {
    let t = (text || '').normalize('NFKC');
    t = t.replace(/[\s　]+/g, ' ');
    t = t.trim();
    // ここもコードポイント単位。UTF-16 の slice だとサロゲートペアが割れる
    const cp = Array.from(t);
    t = cp.length <= this.HEAD_CHARS ? t : cp.slice(0, this.HEAD_CHARS).join('');
    return this.maskContent(t);
  },

  // 題材を消す。漢字→K、カタカナ→T、英字→E
  //
  // 潰さずに学習すると「婚約破棄」「悪役令嬢」「転生」が低評価の目印として
  // 最上位に並び、題材の流行を当てる装置になってしまう（実測で確認）。
  // それでは、その題材で良い作品を書いた人に不当な点が出る。
  //
  // ★英字を先に潰すこと。K と T はラテン文字なので、後から英字を潰すと
  //   せっかく分けた漢字とカタカナまで E に collapse する（実際にやらかした）
  maskContent(t) {
    t = t.replace(/[A-Za-z]/g, 'E');
    t = t.replace(/[一-鿿㐀-䶿豈-﫿]/g, 'K');
    return t.replace(/[゠-ヿｦ-ﾟ]/g, 'T');
  },

  // FNV-1a（32bit）を UTF-8 バイト列に対して回す
  fnv1a(s) {
    let h = 0x811C9DC5;
    const bytes = new TextEncoder().encode(s);
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      // h * 16777619 を 32bit で。Math.imul でオーバーフローを合わせる
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  },

  // 文字 n-gram をハッシュしてバケットごとに数える
  //
  // ★コードポイント単位で切ること。
  // JavaScript の文字列は UTF-16 なので、絵文字や𠮷・𩸽のような文字は
  // 2つ分として数えられてしまう。Python は1文字として扱うため、
  // slice をそのまま使うと n-gram の切り出しがずれる（実測で不一致を検出した）。
  // 人名の異体字は普通に出てくるので、ここは必ずそろえる。
  buckets(text, bits) {
    bits = bits || this.BITS;
    const cp = Array.from(this.normalize(text));   // コードポイントの配列
    const n = cp.length;
    const mask = (1 << bits) - 1;
    const m = new Map();
    for (let size = this.NGRAM_MIN; size <= this.NGRAM_MAX; size++) {
      if (n < size) break;
      for (let i = 0; i + size <= n; i++) {
        const b = this.fnv1a(cp.slice(i, i + size).join('')) & mask;
        m.set(b, (m.get(b) || 0) + 1);
      }
    }
    return m;
  },

  // (バケット番号, 個数) の並び。バケット番号の昇順
  toPairs(text, bits) {
    return [...this.buckets(text, bits).entries()].sort((a, b) => a[0] - b[0]);
  },

  // 送信用。番号の差分を取って詰めるので、そのまま並べるより小さい
  encode(text, bits) {
    const pairs = this.toPairs(text, bits);
    const idx = new Int32Array(pairs.length);
    const cnt = new Int32Array(pairs.length);
    let prev = 0;
    pairs.forEach(([b, c], i) => { idx[i] = b - prev; prev = b; cnt[i] = c; });
    return { n: pairs.length, idx: Array.from(idx), cnt: Array.from(cnt) };
  },
};

if (typeof module !== 'undefined') module.exports = NB;
