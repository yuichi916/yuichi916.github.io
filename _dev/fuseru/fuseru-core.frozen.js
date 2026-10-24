/* fuseru-core.js — 「AIに貼る前に、伏せる。」の検出・置き換え・戻すの本体
 *
 * ブラウザでも Node でも動く（UMD）。通信は一切しない（fetch / XHR / WebSocket / sendBeacon を使わない）。
 * 地名は data/fuseru/places.js（総務省 全国地方公共団体コード）、名字は data/fuseru/surnames.js（自作）を
 * グローバル変数 FUSERU_PLACES / FUSERU_SURNAMES から読む。無ければ住所・名字の補助なしで動く。
 *
 * 使い方:
 *   var spans = Fuseru.detect(text, { enabled: {person:true,...}, include:[{type,value}], exclude:['person\u0000田中'] });
 *   var out = Fuseru.mask(text, spans);          // { text, table:[{token,type,label,value}] }
 *   var back = Fuseru.restore(aiReply, out.table); // { text, count }
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Fuseru = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  // ------------------------------------------------------------------ 種類
  var TYPES = [
    { key: 'person',    label: '人名',       on: true,  desc: '敬称（様・さん・氏…）の前、「氏名：」「担当：」の後、署名欄など' },
    { key: 'company',   label: '会社名',     on: true,  desc: '株式会社・有限会社・（株）などが付いた名前' },
    { key: 'address',   label: '住所',       on: true,  desc: '市区町村＋番地まで。都道府県だけ・市区町村だけは伏せない' },
    { key: 'postal',    label: '郵便番号',   on: true,  desc: '〒つき、または住所の直前の 123-4567' },
    { key: 'phone',     label: '電話',       on: true,  desc: '固定・携帯・0120/0800・050・+81。全角やハイフン無しも' },
    { key: 'email',     label: 'メール',     on: true,  desc: 'メールアドレス' },
    { key: 'url',       label: 'URL',        on: true,  desc: 'http(s):// か www. で始まるもの' },
    { key: 'ip',        label: 'IP',         on: true,  desc: 'IPv4・IPv6（バージョン番号らしいものは除く）' },
    { key: 'mynumber',  label: 'マイナンバー', on: true, desc: '12桁でチェックデジットが合うもの（「個人番号」の後なら合わなくても）' },
    { key: 'card',      label: 'カード番号', on: true,  desc: '13〜19桁で Luhn 検査が通るもの' },
    { key: 'bank',      label: '口座',       on: true,  desc: '銀行名・支店・種別・口座番号の並び' },
    { key: 'birthdate', label: '生年月日',   on: true,  desc: '「生年月日」「生まれ」などの近くの日付' },
    { key: 'date',      label: '日付',       on: false, desc: 'そのほかの年月日・月日（初期はオフ）' }
  ];
  var LABEL = {}, PRIORITY = {
    url: 100, email: 98, card: 92, mynumber: 91, bank: 90, ip: 86, phone: 84, postal: 82,
    birthdate: 80, address: 72, date: 64, company: 58, person: 52
  };
  TYPES.forEach(function (t) { LABEL[t.key] = t.label; });
  var LABEL_TO_TYPE = {};
  TYPES.forEach(function (t) { LABEL_TO_TYPE[t.label] = t.key; });

  // ------------------------------------------------------------------ 文字の正規化（長さを変えない）
  var HYPHENS = '‐‑‒–—―−ｰ─━・'.split('');
  function isDigitCode(c) { return (c >= 48 && c <= 57) || (c >= 0xFF10 && c <= 0xFF19); }
  /** 全角英数記号→半角、全角空白→空白、ハイフンの仲間→'-'。数字にはさまれた「ー」も '-'。
   *  1文字を1文字に置き換えるだけなので、位置は元の文と一致する。 */
  function normalize(text) {
    var out = new Array(text.length);
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i), ch = text[i];
      if (c >= 0xFF01 && c <= 0xFF5E) ch = String.fromCharCode(c - 0xFEE0);
      else if (c === 0x3000 || c === 0x00A0) ch = ' ';
      else if (c === 0x30FB) ch = ch; // 中黒はそのまま（カタカナ名の区切り）
      else if (HYPHENS.indexOf(ch) >= 0) ch = '-';
      else if (c === 0x30FC && i > 0 && i + 1 < text.length &&
               isDigitCode(text.charCodeAt(i - 1)) && isDigitCode(text.charCodeAt(i + 1))) ch = '-';
      out[i] = ch;
    }
    return out.join('');
  }
  function digitsOf(s) { return s.replace(/[^0-9]/g, ''); }

  // ------------------------------------------------------------------ 検査用の計算
  /** Luhn（クレジットカード番号の検査）。数字だけの文字列を渡す */
  function luhnValid(d) {
    if (!/^[0-9]{2,}$/.test(d)) return false;
    var sum = 0, dbl = false;
    for (var i = d.length - 1; i >= 0; i--) {
      var n = d.charCodeAt(i) - 48;
      if (dbl) { n *= 2; if (n > 9) n -= 9; }
      sum += n; dbl = !dbl;
    }
    return sum % 10 === 0;
  }
  /** マイナンバーの検査用数字（行政手続における特定の個人を識別するための番号の利用等に関する法律施行令 第8条）。
   *  上11桁を右から P1..P11、Qn = n+1 (n≤6) / n-5 (n≥7)、r = Σ Pn×Qn mod 11、r≤1 → 0、それ以外 11-r */
  function myNumberCheckDigit(d11) {
    if (!/^[0-9]{11}$/.test(d11)) return -1;
    var sum = 0;
    for (var n = 1; n <= 11; n++) {
      var p = d11.charCodeAt(11 - n) - 48;
      var q = n <= 6 ? n + 1 : n - 5;
      sum += p * q;
    }
    var r = sum % 11;
    return r <= 1 ? 0 : 11 - r;
  }
  function myNumberValid(d12) {
    return /^[0-9]{12}$/.test(d12) && myNumberCheckDigit(d12.slice(0, 11)) === d12.charCodeAt(11) - 48;
  }

  // ------------------------------------------------------------------ 文字の種類
  var H = '[\\p{Script=Han}々〆ヵヶ]';
  var HIRA = '[ぁ-ゖ]';
  var KATA = '[ァ-ヺー]';
  var reH = new RegExp('^' + H + '$', 'u');
  var reHira = /^[ぁ-ゖ]$/;
  var reKata = /^[ァ-ヺー]$/;
  function isH(ch) { return !!ch && reH.test(ch); }
  function isHira(ch) { return !!ch && reHira.test(ch); }
  function isKata(ch) { return !!ch && reKata.test(ch); }
  function isLatin(ch) { return !!ch && /^[A-Za-z]$/.test(ch); }
  /** 直前の1文字（サロゲートペアも1文字として） */
  function charBefore(s, i) {
    if (i <= 0) return '';
    var c = s.charCodeAt(i - 1);
    if (c >= 0xDC00 && c <= 0xDFFF && i >= 2) return s.slice(i - 2, i);
    return s[i - 1];
  }
  function charAt(s, i) {
    if (i >= s.length) return '';
    var c = s.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) return s.slice(i, i + 2);
    return s[i];
  }
  function cpLen(s) { return Array.from(s).length; }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // ------------------------------------------------------------------ 人名の判定に使う語
  function setOf(str) { var o = Object.create(null); str.split(/\s+/).forEach(function (w) { if (w) o[w] = true; }); return o; }
  // 敬称の前に来ても人名ではない語（完全一致）
  var KANJI_STOP = setOf(
    '皆 皆々 各位 客 神 仏 王 姫 殿 奥 嫁 婿 娘 息子 孫 父 母 兄 姉 弟 妹 叔父 叔母 伯父 伯母 祖父 祖母 爺 婆 坊 赤 隣 ' +
    '主人 旦那 家族 親御 子供 子 先輩 後輩 同僚 上司 部下 社員 職員 店員 生徒 学生 新人 担当 担当者 責任者 患者 利用者 会員 顧客 ' +
    '先方 相手 業者 大家 運転手 医者 看護師 社長 部長 課長 係長 会長 店長 所長 室長 院長 校長 園長 教頭 署長 船長 機長 駅長 村長 町長 ' +
    '市長 知事 総理 大臣 議員 監督 先生 講師 教授 選手 諸 同 両 貴 俺 僕 私 我 自分 誰 何 某 御 各 一同 関係者 参加者 出席者 応募者 ' +
    '購入者 契約者 申込者 依頼者 保護者 受講者 来場者 視聴者 読者 作家 作者 筆者 著者 編集者 営業 事務 経理 総務 人事 広報 受付 窓口 ' +
    '現場 本人 当人 家主 地主 住人 隣人 友人 知人 恋人 彼氏 彼女 彼 夫 妻 主婦 主夫 奥方 若 大将 女将 親方 師匠 弟子 王子 王女 皇子 ' +
    '殿下 陛下 神主 和尚 住職 牧師 神父 巫女 天使 悪魔 鬼 魔王 勇者 社会人 大人 子ども 老人 若者 外国人 日本人 刑事 警察 警官 弁護士 ' +
    '税理士 司法書士 行政書士 会計士 医師 歯医者 薬剤師 獣医 保育士 介護士 美容師 理容師 大工 職人 農家 漁師 料理人 板前 店主 編集 担任 ' +
    '主治医 理事長 理事 幹事 委員長 委員 局長 次長 主任 支店長 本部長 事業部長 取締役 専務 常務 副社長 代表 代表取締役 執行役員 役員 ' +
    '監査役 顧問 相談役 当社 弊社 御社 貴社 同社 某社 各社 先様 相方 仲間 同期 新入社員 派遣 方 方々 人 人々 他 未定 不明 同上 空欄 ' +
    '記入 任意 必須 省略 匿名 名無 名無し 各自 全員 一人 二人 本日 明日 昨日 今日 毎日 以上 以下 宛 様方 御一同 御家族 ご家族 家内 ' +
    '愚妻 夫婦 両親 親 姪 甥 従兄弟 親戚 親族 遺族 故人 新郎 新婦 喪主 施主 来賓 主賓 司会 議長 書記 幹事長 副会長 会計 監事 番頭 ' +
    '女中 殿方 女房 亭主 長男 長女 次男 次女 三男 三女 末っ子 赤子 乳児 幼児 児童 少年 少女 青年 中年 紳士 淑女 婦人 奥様 ' +
    '神様 仏様 王様 姫様 殿様 天皇 皇后 上様 母上 父上 兄上 姉上 坊主 小僧 大臣 首相 社主 家元 宗家 本家 分家 隠居 先代 当主 ' +
    '利用 管理人 管理者 発注者 受注者 落札者 出品者 投稿者 送信者 差出人 受取人 名義人 申請者 届出人 被保険者 世帯主 配偶者 保証人'
  );
  // 敬称の前に来ても人名ではないカタカナ語
  var KATA_STOP = setOf(
    'ユーザー ユーザ スタッフ ドライバー オーナー メンバー ゲスト クライアント カスタマー マネージャー マネジャー リーダー パパ ママ ' +
    'コーチ ファン サンタ ドクター ナース パート バイト アルバイト ベビー クルー ホスト キャスト オペレーター エンジニア デザイナー ' +
    'ライター プロ アーティスト チーム ショップ メーカー ベンダー パートナー ボス マスター シェフ パティシエ ガイド サポート ヘルパー ' +
    'ケアマネ ケアマネージャー トレーナー インストラクター モデル タレント アイドル セラピスト スポンサー フォロワー リスナー ゲーマー ' +
    'プレイヤー プレーヤー キャラ ヒーロー ヒロイン パイロット ボランティア インターン サラリーマン カメラマン ネコ イヌ クマ ウサギ ' +
    'パンダ キツネ タヌキ ペンギン ゾウ ライオン ハムスター ロボット オバケ オジサン オバサン オジイサン オバアサン ミナサン オキャクサマ ' +
    'カスタマーサポート サポートチーム ベテラン ルーキー レジェンド エース キャプテン マネ ドライバ ショップスタッフ バイヤー セラー ' +
    'ワン ワンコ ニャン ニャンコ ディーラー ブロガー ユーチューバー ストリーマー インフルエンサー クリエイター イラストレーター ミュージシャン バンド ファミリー'
  );
  var HIRA_STOP = setOf('おじい おばあ おにい おねえ おじ おば じい ばあ ねえ にい あか ぼく わたし うち みな みんな おとう おかあ ' +
    'おまわり おいしゃ おきゃく おくさ おねいさ ちび ぼっ わんこ にゃん ねこ いぬ くま うさぎ ぶた ぱぱ まま たく おく みなさ');
  // 名前の後ろに来ると組織・役職を示す語（敬称の前の語がこれで終わるなら人名ではない）
  var ORG_TAIL = ['企画', '商事', '商店', '商会', '工業', '産業', '物産', '建設', '工務店', '電機', '電気', '製作所', '不動産', '運輸', '設計',
    '事務所', '銀行', '病院', '医院', 'クリニック', '薬局', '歯科', '協会', '組合', '財団', '法人', '会社', 'ホールディングス', 'グループ',
    'システムズ', 'システム', 'ソリューションズ', 'テクノロジー', 'テクノロジーズ', 'サービス', 'ジャパン', '出版', '新聞', '放送', '大学',
    '高校', '学園', '学校', '役所', '役場', 'センター', 'ストア', 'ショップ', '研究所', 'チーム', '御中', '各位', '保険', '証券', '信金',
    '信用金庫', '印刷', '食品', '製薬', '化学', '自動車', '鉄道', 'ラボ', 'スタジオ', 'デザイン', 'プロダクション', 'エージェンシー'];
  var ORG_TAIL_CH = '者員長師士官係客部課室所社店局署院校園会団庁省県市区屋業科班隊軍組寮館庫協連党塾寺堂舎亭';
  var TITLES = ['部長', '課長', '係長', '社長', '専務', '常務', '次長', '主任', '室長', '所長', '店長', '会長', '副社長', '取締役', '教授',
    '准教授', '講師', '医師', '弁護士', '税理士', '選手', '監督', '議員', '先輩', '支店長', '本部長', '局長', '理事長', '院長', '代表'];
  var RELATION = setOf('母 父 夫 妻 兄 姉 弟 妹 祖父 祖母 息子 娘 長男 長女 次男 次女 叔父 叔母 伯父 伯母 配偶者 本人 子 孫 義母 義父');

  // ------------------------------------------------------------------ 辞書（地名・名字）
  var DATA = null;
  function getData() {
    if (DATA) return DATA;
    var P = root.FUSERU_PLACES || { prefs: [], munis: [] };
    var S = root.FUSERU_SURNAMES || [];
    var surname = Object.create(null);
    var maxSur = 1;
    S.forEach(function (s) { surname[s] = true; if (cpLen(s) > maxSur) maxSur = cpLen(s); });
    var prefAlt = P.prefs.map(escRe).join('|') || '(?!)';
    var muniAlt = P.munis.map(function (m) { return escRe(m[0]); }).join('|') || '(?!)';
    var GUN = '(?:' + H + '{1,4}?郡\\s?)';
    var GENERIC = '(?:' + H + '{1,5}?[市区町村])';
    var muniSet = Object.create(null);
    P.munis.forEach(function (m) { muniSet[m[0]] = true; });
    DATA = {
      surname: surname, maxSur: maxSur, prefs: P.prefs, muniSet: muniSet,
      rePrefAddr: new RegExp('(?:' + prefAlt + ')\\s?(?:' + GUN + '?(?:' + muniAlt + '|' + GENERIC + '))?', 'gu'),
      reMuniAddr: new RegExp('(?<!' + H + ')' + GUN + '?(?:' + muniAlt + ')', 'gu'),
      rePrefAt: new RegExp('(?:' + prefAlt + ')', 'y'),
      prefAlt: prefAlt
    };
    return DATA;
  }
  function isSurname(s) { return !!getData().surname[s]; }
  /** s の先頭が辞書の名字なら、その長さ（コードポイント数）。最長一致 */
  function surnamePrefixLen(s) {
    var d = getData(), a = Array.from(s);
    for (var n = Math.min(d.maxSur, a.length); n >= 1; n--) if (d.surname[a.slice(0, n).join('')]) return n;
    return 0;
  }

  // ------------------------------------------------------------------ 候補の入れ物
  function Cands(T, N) { this.T = T; this.N = N; this.list = []; }
  Cands.prototype.add = function (s, e, type, rule, score) {
    if (e <= s) return;
    // 前後の空白は落とす
    while (s < e && /\s/.test(this.T[s])) s++;
    while (e > s && /\s/.test(this.T[e - 1])) e--;
    if (e <= s) return;
    this.list.push({ start: s, end: e, type: type, rule: rule, score: score != null ? score : PRIORITY[type], value: this.T.slice(s, e) });
  };

  function lineAround(N, i) {
    var a = N.lastIndexOf('\n', i - 1) + 1, b = N.indexOf('\n', i);
    if (b < 0) b = N.length;
    return { start: a, end: b, text: N.slice(a, b) };
  }
  function before(N, i, n) { return N.slice(Math.max(0, i - n), i); }

  // ------------------------------------------------------------------ メール・URL・IP
  function findEmail(C) {
    var re = /(?<![A-Za-z0-9._%+\-])[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}(?![A-Za-z0-9\-])/g, m;
    while ((m = re.exec(C.N))) C.add(m.index, m.index + m[0].length, 'email', 'email');
  }
  function findUrl(C) {
    var re = /(?<![A-Za-z0-9])(?:https?:\/\/|www\.)[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]+/g, m;
    while ((m = re.exec(C.N))) {
      var v = m[0];
      // 末尾の句読点・閉じ括弧（対応する開き括弧が無いもの）を落とす
      for (;;) {
        var last = v[v.length - 1];
        if (/[.,;:!?'"]/.test(last)) { v = v.slice(0, -1); continue; }
        if (last === ')' && (v.split('(').length - 1) < (v.split(')').length - 1)) { v = v.slice(0, -1); continue; }
        if (last === ']' && (v.split('[').length - 1) < (v.split(']').length - 1)) { v = v.slice(0, -1); continue; }
        break;
      }
      if (/^(https?:\/\/|www\.)$/.test(v)) continue;
      C.add(m.index, m.index + v.length, 'url', 'url');
    }
  }
  var VERSION_CTX = /(?:\bv|\bver\.?|version|バージョン|ver|リリース|release|ビルド|build)\s*$/i;
  function findIp(C) {
    var N = C.N, m;
    var o = '(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])';
    var re4 = new RegExp('(?<![0-9A-Za-z.])' + o + '\\.' + o + '\\.' + o + '\\.' + o + '(?:/(?:3[0-2]|[12]?[0-9]))?(?!\\.?[0-9])', 'g');
    while ((m = re4.exec(N))) {
      if (VERSION_CTX.test(before(N, m.index, 14))) continue;
      if (/^\s*(?:版|リリース)/.test(N.slice(m.index + m[0].length, m.index + m[0].length + 4))) continue;
      C.add(m.index, m.index + m[0].length, 'ip', 'ipv4');
    }
    var re6 = /(?<![0-9A-Fa-f:])[0-9A-Fa-f]{0,4}(?::{1,2}[0-9A-Fa-f]{0,4}){2,7}(?:\/[0-9]{1,3})?(?![0-9A-Fa-f:])/g;
    while ((m = re6.exec(N))) {
      var v = m[0].replace(/\/[0-9]{1,3}$/, '');
      var dbl = v.split('::').length - 1;
      if (dbl > 1) continue;
      var groups = v.split(/::?/).filter(function (g) { return g !== ''; });
      if (groups.some(function (g) { return !/^[0-9A-Fa-f]{1,4}$/.test(g); })) continue;
      if (dbl === 0 && groups.length !== 8) continue;
      if (dbl === 1 && groups.length > 7) continue;
      if (dbl === 1 && groups.length < 2 && !/[A-Fa-f]/.test(v)) continue;
      if (/:::/.test(v) || /^:[^:]/.test(v) || /[^:]:$/.test(v)) continue;
      C.add(m.index, m.index + m[0].length, 'ip', 'ipv6');
    }
  }

  // ------------------------------------------------------------------ 電話
  var PHONE_CTX = /(?:TEL|Tel|tel|電話|携帯|連絡先|FAX|Fax|fax|ファックス|ファクス|☎|📞|℡|内線|直通|代表|番号)[^\n]{0,6}$/;
  function phoneOk(d) {
    if (/^81/.test(d)) d = '0' + d.slice(2);
    if (d.length === 11) return /^0[5789]0[0-9]{8}$/.test(d) || /^0800[0-9]{7}$/.test(d);
    if (d.length === 10) return /^0[1-9][0-9]{8}$/.test(d) && !/^0[789]0/.test(d) && !/^050/.test(d);
    return false;
  }
  function findPhone(C) {
    var N = C.N, m;
    var S = '[-\\s.]';
    var res = [
      // +81 形式
      new RegExp('\\+81' + S + '?(?:\\(0\\)' + S + '?)?[1-9][0-9]{0,3}' + S + '?[0-9]{1,4}' + S + '?[0-9]{4}(?![0-9])', 'g'),
      // (03)1234-5678 / 03(1234)5678
      /(?<![0-9])\(0[0-9]{1,4}\)\s?[0-9]{1,4}[-\s]?[0-9]{4}(?![0-9])/g,
      /(?<![0-9])0[0-9]{1,4}\([0-9]{1,4}\)[0-9]{4}(?![0-9])/g,
      // 区切りあり
      new RegExp('(?<![0-9A-Za-z\\-.])0[0-9]{1,4}' + S + '[0-9]{1,4}' + S + '[0-9]{3,4}(?![0-9]|-[0-9])', 'g'),
      // 区切りなし
      /(?<![0-9A-Za-z\-.])0[0-9]{9,10}(?![0-9])/g
    ];
    res.forEach(function (re, k) {
      while ((m = re.exec(N))) {
        var d = digitsOf(m[0]);
        if (!phoneOk(d)) continue;
        if (k === 3) {
          // 区切りで分けた最後の塊は4桁（0120/0570/0990 は 3-3）
          var parts = m[0].split(/[-\s.]/);
          var last = parts[parts.length - 1];
          if (last.length === 3 && !/^0(120|570|990)/.test(d)) continue;
          // 日付（2026-10-24 など）は 0 始まりでないので来ない。空白区切りは文脈が要る
          if (/\s/.test(m[0]) && !PHONE_CTX.test(before(N, m.index, 16)) && !/^0[789]0/.test(d)) continue;
        }
        if (k === 4) {
          // 区切りなしの10桁は文脈が要る。11桁の携帯（0[789]0）は単独でも
          if (!(d.length === 11 && /^0[789]0/.test(d)) && !PHONE_CTX.test(before(N, m.index, 16))) continue;
        }
        C.add(m.index, m.index + m[0].length, 'phone', 'phone' + k);
      }
    });
  }

  // ------------------------------------------------------------------ 郵便番号
  function findPostal(C) {
    var N = C.N, m, d = getData();
    var re1 = /〒\s?([0-9]{3}-?[0-9]{4})(?![0-9])/g;
    while ((m = re1.exec(N))) { var s = m.index + m[0].length - m[1].length; C.add(s, s + m[1].length, 'postal', 'postal-mark'); }
    var re2 = /(?<![0-9\-])([0-9]{3}-[0-9]{4}|[0-9]{7})(?![0-9\-])/g;
    var after = new RegExp('^\\s?(?:' + d.prefAlt + ')');
    while ((m = re2.exec(N))) {
      var b = before(N, m.index, 10);
      if (/〒\s?$/.test(b)) continue;
      var ctx = /(?:郵便番号|郵便|ZIP|Zip|zip|postal|Postal)[^\n]{0,4}$/.test(b);
      var nextPref = d.prefs.length && after.test(N.slice(m.index + m[0].length, m.index + m[0].length + 6));
      if (m[1].length === 7 && !ctx) continue;
      if (ctx || nextPref) C.add(m.index, m.index + m[0].length, 'postal', 'postal-ctx');
    }
  }

  // ------------------------------------------------------------------ 住所
  var NUMK = '[0-9一二三四五六七八九十〇]';
  var NUMBLOCK = NUMK + '+(?:丁目|番地の?|番|号|条|線|地割|-|の|ノ)?';
  var TOWNCH = '(?:' + H + '|[ァ-ヺー]|上る|下る|入る|上ル|下ル|入ル|[がのつ](?=' + H + '|[ァ-ヺ]))';
  var BNAME = '[\\p{Script=Katakana}ーA-Za-z\\p{Script=Han}ぁ-ゖ・&]';
  var reTail = new RegExp('(?:\\s?(?:' + TOWNCH + '{0,12}?' + NUMBLOCK + ')+)' +
    '(?:\\s?' + BNAME + '{2,20}?\\s?[0-9]{1,4}(?:号室|号|室|F|階)?(?![0-9])|\\s?[0-9]{1,4}号室)?', 'uy');
  var reTown = new RegExp(TOWNCH + '{1,12}', 'uy');
  var ADDR_LABEL = /(?:住所|現住所|所在地|本社所在地|送付先|お届け先|届け先|納品先|自宅|勤務先住所|連絡先住所|Address|ADDRESS)\s*(?:[:]|】|\])?\s*$/;
  var TOWN_STOP = /^(?:在住|出身|在勤|周辺|付近|近辺|方面|内|全域|一帯|で|に|の|を|は|が|駅|役所|役場|市内|区内|都内|県内)/;
  function findAddress(C) {
    var N = C.N, d = getData(), m;
    if (!d.prefs.length) return;
    function tailFrom(pos) { reTail.lastIndex = pos; var t = reTail.exec(N); return t ? pos + t[0].length : -1; }
    function finish(s, e, rule) {
      while (e > s && /[-のノ\s]/.test(N[e - 1])) e--;
      C.add(s, e, 'address', rule);
    }
    function labeled(s) { return ADDR_LABEL.test(before(N, s, 14)); }
    d.rePrefAddr.lastIndex = 0;
    while ((m = d.rePrefAddr.exec(N))) {
      var s = m.index, e = s + m[0].length;
      var t = tailFrom(e);
      if (t > e) { finish(s, t, 'addr-pref'); d.rePrefAddr.lastIndex = t; continue; }
      if (labeled(s) && m[0].length > 4) {
        reTown.lastIndex = e; var tw = reTown.exec(N);
        var e2 = e;
        if (tw && !TOWN_STOP.test(tw[0])) e2 = e + tw[0].length;
        finish(s, e2, 'addr-label');
        d.rePrefAddr.lastIndex = e2;
      }
    }
    d.reMuniAddr.lastIndex = 0;
    while ((m = d.reMuniAddr.exec(N))) {
      var s2 = m.index, e3 = s2 + m[0].length;
      var t2 = tailFrom(e3);
      if (t2 > e3) { finish(s2, t2, 'addr-muni'); d.reMuniAddr.lastIndex = t2; }
      else if (labeled(s2)) {
        reTown.lastIndex = e3; var tw2 = reTown.exec(N);
        var e4 = e3;
        if (tw2 && !TOWN_STOP.test(tw2[0])) e4 = e3 + tw2[0].length;
        finish(s2, e4, 'addr-muni-label');
      }
    }
  }

  // ------------------------------------------------------------------ マイナンバー・カード
  var NOT_MYNUMBER_CTX = /(?:注文|伝票|受付|管理|会員|顧客|問い?合わ?せ|お問合せ|追跡|予約|請求|契約|証券|口座|品|型|製造|シリアル|ID|No|NO|№|#)[^\n]{0,8}$/;
  var MYNUMBER_CTX = /(?:マイナンバー|個人番号)[^\n]{0,10}$/;
  function findMyNumber(C) {
    var N = C.N, m;
    var re = /(?<![0-9\-])[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}(?![0-9]|-[0-9])/g;
    while ((m = re.exec(N))) {
      var dg = digitsOf(m[0]);
      if (dg.length !== 12) continue;
      var b = before(N, m.index, 20);
      var ctx = MYNUMBER_CTX.test(b);
      if (ctx || (myNumberValid(dg) && !NOT_MYNUMBER_CTX.test(b))) C.add(m.index, m.index + m[0].length, 'mynumber', ctx ? 'mynumber-ctx' : 'mynumber-cd');
    }
  }
  function findCard(C) {
    var N = C.N, m;
    var re = /(?<![0-9\-])[0-9](?:[ \-]?[0-9]){12,18}(?![0-9]|-[0-9])/g;
    while ((m = re.exec(N))) {
      var dg = digitsOf(m[0]);
      if (dg.length < 13 || dg.length > 19) continue;
      if (!/^(?:3|4|5[1-5]|6|2[2-7])/.test(dg)) continue;
      if (!luhnValid(dg)) continue;
      // 区切りは 4桁ずつ か Amex の 4-6-5 / Diners の 4-6-4 だけ
      if (/[ \-]/.test(m[0])) {
        var g = m[0].split(/[ \-]/).map(function (x) { return x.length; }).join(',');
        if (!/^(4,4,4,4|4,4,4,4,3|4,6,5|4,6,4|4,4,4,1|4,4,4,2|4,4,4,3|4,4,5)$/.test(g)) continue;
      }
      C.add(m.index, m.index + m[0].length, 'card', 'card-luhn');
    }
  }

  // ------------------------------------------------------------------ 銀行口座
  var BANK_SUF = '(?:銀行|信用金庫|信金|信用組合|信組|労働金庫|労金|農業協同組合|農協)';
  var reBank = new RegExp(
    '(?:(?<![\\p{Script=Han}\\p{Script=Katakana}A-Za-z])[\\p{Script=Han}\\p{Script=Katakana}ーA-Za-z]{0,10}?' + BANK_SUF +
    '|(?<![\\p{Script=Han}\\p{Script=Katakana}A-Za-z])JA[\\p{Script=Han}\\p{Script=Katakana}ー]{0,8})', 'gu');
  var BANK_SEP = '[\\s、,・/:]{0,3}';
  var reBankRest = new RegExp(
    '(?:' + BANK_SEP + '(?:支店名?\\s*[:]?\\s*)?[\\p{Script=Han}\\p{Script=Katakana}ーぁ-ゖA-Za-z0-9]{0,10}?(?:支店|出張所|営業部|本店|支所)(?:\\s*\\(?[0-9]{3}\\)?)?)?' +
    '(?:' + BANK_SEP + '(?:預金)?(?:種目|種別|口座種別)?\\s*[:]?\\s*(?:普通預金|当座預金|貯蓄預金|普通|当座|貯蓄|総合|\\(普\\)|\\(当\\)|普))?' +
    '(?:' + BANK_SEP + '(?:口座番号|口座No\\.?|口座|No\\.?|番号)\\s*[:]?\\s*)?' + BANK_SEP + '([0-9]{7})(?![0-9])', 'uy');
  var reAcctOnly = /(?:(?:普通預金|当座預金|貯蓄預金|普通|当座|\(普\)|\(当\))[\s、,・/:]{0,3}(?:(?:口座番号|口座|番号|No\.?)\s*:?\s*)?|(?:口座番号|口座No\.?)\s*:?\s*)([0-9]{7})(?![0-9])/g;
  var reYucho = /(?:ゆうちょ銀行|ゆうちょ)?[\s、,]{0,2}記号\s*:?\s*[0-9]{5}[\s、,\-]{0,3}番号\s*:?\s*[0-9]{6,8}(?![0-9])/g;
  function findBank(C) {
    var N = C.N, m;
    reBank.lastIndex = 0;
    while ((m = reBank.exec(N))) {
      var s = m.index, e = s + m[0].length;
      // 銀行名の前のひらがな（みずほ・きらぼし・さくら坂 など）を、助詞に当たるまで足す
      while (s > 0 && isHira(N[s - 1]) && !/[はをがにでへともの]/.test(N[s - 1])) s--;
      reBankRest.lastIndex = e;
      var r = reBankRest.exec(N);
      if (r) { C.add(s, e + r[0].length, 'bank', 'bank-seq'); reBank.lastIndex = e + r[0].length; }
    }
    reAcctOnly.lastIndex = 0;
    while ((m = reAcctOnly.exec(N))) C.add(m.index, m.index + m[0].length, 'bank', 'bank-acct', PRIORITY.bank - 1);
    reYucho.lastIndex = 0;
    while ((m = reYucho.exec(N))) C.add(m.index, m.index + m[0].length, 'bank', 'bank-yucho');
  }

  // ------------------------------------------------------------------ 日付・生年月日
  var BIRTH_BEFORE = /(?:生年月日|誕生日|生まれ|出生|DOB|Date of Birth|birth|Birth|生年)[^\n]{0,12}$/;
  var BIRTH_AFTER = /^\s?(?:\([^)\n]{0,4}\))?\s?(?:生まれ|生|誕生)/;
  function validYMD(y, mo, da) { return mo >= 1 && mo <= 12 && da >= 1 && da <= 31; }
  function findDates(C) {
    var N = C.N, m;
    var res = [
      [/(?<![0-9])((?:19|20)[0-9]{2})\s?年\s?([0-9]{1,2})\s?月\s?([0-9]{1,2})\s?日/g, 'ymd-kanji'],
      [/(?<![0-9.\/\-])((?:19|20)[0-9]{2})[\/.\-]([0-9]{1,2})[\/.\-]([0-9]{1,2})(?![0-9]|[\/.\-][0-9])/g, 'ymd-sep'],
      [/(明治|大正|昭和|平成|令和)\s?(元|[0-9]{1,2})\s?年\s?([0-9]{1,2})\s?月\s?([0-9]{1,2})\s?日/g, 'wareki'],
      [/(?<![A-Za-z0-9])([MTSHR])\s?([0-9]{1,2})[.\/]([0-9]{1,2})[.\/]([0-9]{1,2})(?![0-9])/g, 'wareki-abbr'],
      [/(?<![0-9年\/.])([0-9]{1,2})\s?月\s?([0-9]{1,2})\s?日/g, 'md'],
      [/(?<![0-9\/.])([0-9]{1,2})\/([0-9]{1,2})(?=\s?\((?:月|火|水|木|金|土|日)\))/g, 'md-slash']
    ];
    res.forEach(function (pair) {
      var re = pair[0], rule = pair[1];
      while ((m = re.exec(N))) {
        var mo, da;
        if (rule === 'ymd-kanji' || rule === 'ymd-sep') { mo = +m[2]; da = +m[3]; }
        else if (rule === 'wareki' || rule === 'wareki-abbr') { mo = +m[3]; da = +m[4]; }
        else { mo = +m[1]; da = +m[2]; }
        if (!validYMD(0, mo, da)) continue;
        var s = m.index, e = s + m[0].length;
        var birth = BIRTH_BEFORE.test(before(N, s, 24)) || BIRTH_AFTER.test(N.slice(e, e + 8));
        C.add(s, e, birth ? 'birthdate' : 'date', rule);
      }
    });
  }

  // ------------------------------------------------------------------ 会社名
  var FORMS = '(?:株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人|特定非営利活動法人|NPO法人|医療法人社団|医療法人財団|医療法人|社会福祉法人|学校法人|宗教法人|独立行政法人|\\(株\\)|\\(有\\)|\\(同\\)|㈱|㈲)';
  var CNAME = '[\\p{Script=Han}\\p{Script=Katakana}ーA-Za-z0-9&・.]';
  var CO_CUT = /(?:代表取締役|取締役|代表|社長|会長|専務|常務|御中|様|殿|各位|担当|本社|支社|支店|営業所|工場|[\p{Script=Han}]{1,4}(?:部|課|室|グループ|チーム)|[\p{Script=Han}]{1,2}$)/u;
  function findCompany(C) {
    var N = C.N, m;
    // 法人格の後ろの名前。先頭のひらがな（ほしぞら出版・みらい技研）は、後ろに漢字・カタカナが続くときだけ
    var reAfter = new RegExp(FORMS + '\\s?((?![とはがのにでをもへや])(?:[ぁ-ゖ]{1,8}(?=' + CNAME + '))?' + CNAME + '{1,24}(?: [A-Za-z0-9&.]+){0,3})', 'gu');
    while ((m = reAfter.exec(N))) {
      var name = m[1];
      // 「株式会社ミナト企画 営業部」の「営業部」以降や「代表取締役」以降を切る
      var cut = name.search(/代表取締役|取締役|代表|社長|会長|専務|常務|御中|様|殿|各位|担当|本社|支社|支店|営業所|工場/);
      if (cut === 0) continue;
      if (cut > 0) name = name.slice(0, cut);
      var dept = name.search(new RegExp('(?<=.{2})' + H + '{1,4}(?:部|課|室)$', 'u'));
      if (dept > 0) name = name.slice(0, dept);
      if (!/[^\s.・&]/.test(name)) continue;
      var s = m.index, e = m.index + m[0].length - m[1].length + name.length;
      C.add(s, e, 'company', 'co-prefix');
    }
    var reBefore = new RegExp('(?<![\\p{Script=Han}\\p{Script=Katakana}ーA-Za-z0-9&・.])((?:' + CNAME + '{1,24})(?: [A-Za-z0-9&.]+){0,3})\\s?' + FORMS, 'gu');
    while ((m = reBefore.exec(N))) {
      var nm = m[1], off = 0;
      // 先頭の「宛先：」などは CNAME に入らないので来ない。「〇〇部の」などは来ない
      if (/^[0-9.]+$/.test(nm)) continue;
      C.add(m.index + off, m.index + m[0].length, 'company', 'co-suffix');
    }
  }

  // ------------------------------------------------------------------ 人名
  var HONOR = [
    ['様', /^(?![子式相々態])/], ['さま', /^(?!ざ)/], ['さん', /^/], ['氏', /^(?![名族神])/], ['殿', /^(?![堂下中場様])/],
    ['先生', /^/], ['ちゃん', /^(?!こ|ぽ)/], ['くん', /^(?!せい|れん)/], ['君', /^(?![主臨子])/]
  ];
  function endsWithOrg(r) {
    for (var i = 0; i < ORG_TAIL.length; i++) if (r.length > ORG_TAIL[i].length && r.slice(-ORG_TAIL[i].length) === ORG_TAIL[i]) return true;
    var last = Array.from(r).pop();
    return ORG_TAIL_CH.indexOf(last) >= 0;
  }
  /** 漢字だけの語 r が人名らしいか（敬称の前） */
  function kanjiNameOk(r, strong) {
    var n = cpLen(r);
    if (KANJI_STOP[r]) return false;
    if (isSurname(r)) return true;
    var sp = surnamePrefixLen(r);
    if (sp && n - sp >= 1 && n - sp <= 3) return true;  // 名字＋名
    if (n === 1) return false;
    if (endsWithOrg(r)) return false;
    if (n > 4) return false;
    if (!strong) return false;
    return true;
  }
  /** 漢字の連なり r から、人名の部分を取り出す（長い連なりは名字の位置で切る） */
  function pickKanjiName(r, strong) {
    if (kanjiNameOk(r, strong)) return r;
    var a = Array.from(r);
    if (a.length < 3) return null;
    for (var j = 1; j < a.length - 1; j++) {
      var tail = a.slice(j).join('');
      var head = a.slice(0, j).join('');
      var sp = surnamePrefixLen(tail);
      if (sp && a.length - j <= 5 && (endsWithOrg(head) || KANJI_STOP[head] || cpLen(head) >= 2)) {
        if (!KANJI_STOP[tail]) return tail;
      }
    }
    // 「営業部田中」→ 部・課・室・社のあとを名前とみる
    for (var k = a.length - 2; k >= 1; k--) {
      if ('部課室社店局'.indexOf(a[k - 1]) >= 0) {
        var rest = a.slice(k).join('');
        if (cpLen(rest) >= 2 && cpLen(rest) <= 4 && !KANJI_STOP[rest] && !endsWithOrg(rest)) return rest;
        break;
      }
    }
    return null;
  }
  function kataNameOk(r) {
    var w = r.replace(/[・\s]/g, '');
    if (cpLen(w) < 2) return false;
    if (KATA_STOP[r] || KATA_STOP[w]) return false;
    for (var i = 0; i < ORG_TAIL.length; i++) if (/[ァ-ヺ]/.test(ORG_TAIL[i]) && w.slice(-ORG_TAIL[i].length) === ORG_TAIL[i]) return false;
    if (/^ー/.test(w)) return false;
    return true;
  }
  /** 位置 i（敬称の先頭）の手前から名前を探す。見つかれば [start,end] */
  function nameBefore(N, i, strong, titleMode) {
    var e = i;
    if (e > 0 && N[e - 1] === ' ') e--;
    var p = e, ch = charBefore(N, p);
    if (!ch) return null;
    var runStart;
    if (isH(ch)) {
      p = e; while (p > 0 && isH(charBefore(N, p))) p -= charBefore(N, p).length;
      if (/^[おご御]$/.test(charBefore(N, p)) && !titleMode) {
        // 「お客様」「ご主人様」「お父さん」
        return null;
      }
      var r1 = N.slice(p, e);
      if (titleMode && !(isSurname(r1) || surnamePrefixLen(r1))) {
        var sp0 = null, a0 = Array.from(r1);
        for (var j0 = 1; j0 < a0.length; j0++) { if (isSurname(a0.slice(j0).join(''))) { sp0 = a0.slice(j0).join(''); break; } }
        if (!sp0) return null;
        return [e - sp0.length, e];
      }
      var picked = pickKanjiName(r1, strong);
      // 「山田 太郎 様」: 空白をはさんだ名字
      if (picked === r1 && cpLen(r1) <= 3 && N[p - 1] === ' ' && isH(charBefore(N, p - 1))) {
        var q = p - 1; while (q > 0 && isH(charBefore(N, q))) q -= charBefore(N, q).length;
        var r0 = N.slice(q, p - 1);
        if (!KANJI_STOP[r0] && !endsWithOrg(r0) && (isSurname(r0) || (cpLen(r0) <= 3 && cpLen(r0) >= 2 && !/^[おご御]$/.test(charBefore(N, q)))) &&
            (isSurname(r0) || !isSurname(r1))) {
          return [q, e];
        }
      }
      if (!picked) return null;
      return [e - picked.length, e];
    }
    if (isHira(ch)) {
      p = e; while (p > 0 && isHira(charBefore(N, p)) && e - p < 6) p--;
      var hr = N.slice(p, e);
      // 漢字の名字＋ひらがなの名（田中ひろみ様）
      var q2 = p; if (N[q2 - 1] === ' ') q2--;
      if (isH(charBefore(N, q2))) {
        var q3 = q2; while (q3 > 0 && isH(charBefore(N, q3))) q3 -= charBefore(N, q3).length;
        var sur = N.slice(q3, q2);
        if (isSurname(sur) && cpLen(hr) >= 2 && cpLen(hr) <= 4) return [q3, e];
        var spx = surnamePrefixLen(sur);
        return null;
      }
      if (titleMode || !strong) return null;
      return null;
    }
    if (isKata(ch)) {
      p = e; while (p > 0 && (isKata(charBefore(N, p)) || (N[p - 1] === '・' && isKata(charBefore(N, p - 1))))) p--;
      // 「ジョン スミス様」
      if (N[p - 1] === ' ' && isKata(charBefore(N, p - 1))) {
        var q4 = p - 1; while (q4 > 0 && isKata(charBefore(N, q4))) q4--;
        if (kataNameOk(N.slice(q4, p - 1)) && kataNameOk(N.slice(p, e))) return [q4, e];
      }
      var kr = N.slice(p, e);
      // 漢字の名字＋カタカナの名（山田リサ様）
      if (isH(charBefore(N, p))) {
        var q5 = p; while (q5 > 0 && isH(charBefore(N, q5))) q5 -= charBefore(N, q5).length;
        if (isSurname(N.slice(q5, p))) return [q5, e];
      }
      if (titleMode) return null;
      if (!kataNameOk(kr) || cpLen(kr) > 12) return null;
      return [p, e];
    }
    if (isLatin(ch)) {
      var mm = /(?:[A-Z][a-z]+ )?[A-Z][a-z]+$|(?:[A-Z]{2,} )?[A-Z]{2,}$/.exec(N.slice(Math.max(0, e - 40), e));
      if (!mm) return null;
      return [e - mm[0].length, e];
    }
    return null;
  }
  function findPersonHonorific(C) {
    var N = C.N;
    HONOR.forEach(function (h) {
      var w = h[0], idx = -1;
      while ((idx = N.indexOf(w, idx + 1)) >= 0) {
        var after = N.slice(idx + w.length, idx + w.length + 3);
        if (!h[1].test(after)) continue;
        // 「様々」のほか、「様」が語の途中のもの
        var ch = charBefore(N, idx);
        // 副詞の「ちゃんと」（文頭・助詞の後）
        if (w === 'ちゃん' && after[0] === 'と' && (!ch || /[はをもがにでとっ、。\s]/.test(ch) || !(isH(ch) || isKata(ch) || isHira(ch)))) continue;
        if (w === 'ちゃん' || w === 'くん') {
          if (isHira(ch)) {
            // ひらがなの名（ゆいちゃん）: 連なりの先頭から、なければ助詞（と・や・も）の直後から始まる2〜4文字
            var best = -1, alt = -1;
            for (var L = 4; L >= 2; L--) {
              var st = idx - L; if (st < 0) continue;
              var hr = N.slice(st, idx);
              if (!/^[ぁ-ゖ]+$/.test(hr) || HIRA_STOP[hr] || /^[おごをはがでにへとやもの]/.test(hr) || /[をはがでにへ]$/.test(hr)) continue;
              var pb = charBefore(N, st);
              if (!isHira(pb)) { best = st; break; }
              if (alt < 0 && /[とやも]/.test(pb)) alt = st;
            }
            if (best < 0) best = alt;
            if (best >= 0) C.add(best, idx, 'person', 'hon-hira');
            continue;
          }
        }
        var strong = (w !== '君');
        var r = nameBefore(N, idx, strong, false);
        if (r) C.add(r[0], r[1], 'person', 'hon-' + w);
      }
    });
    TITLES.forEach(function (t) {
      var idx = -1;
      while ((idx = N.indexOf(t, idx + 1)) >= 0) {
        var r = nameBefore(N, idx, true, true);
        if (r) C.add(r[0], r[1], 'person', 'title');
      }
    });
  }

  var LABELS = '氏名|お名前|名前|ご氏名|姓名|お客様名|顧客名|担当者名|ご担当者|担当者|ご担当|担当|宛名|宛先|差出人|送信者|送り主|申請者|申込者|依頼者|' +
    '記入者|作成者|報告者|起票者|承認者|責任者|代表者|契約者|保護者|緊急連絡先|受取人|名義人|口座名義|カード名義|名義|署名|フリガナ|ふりがな|カナ|' +
    '患者名|患者|利用者名|被保険者|発注者|受注者|担当医|主治医|講師|司会|議長|書記|出席者|参加者|欠席者|記録者|面談者|面接官|応募者|紹介者|' +
    '立会人|連帯保証人|保証人|世帯主|配偶者|投稿者|対応者|対応|受付者|入力者|確認者|作業者|実施者|訪問者|Name|NAME|From|FROM|To|TO|Cc|CC';
  var reLabel = new RegExp('(?:^|[\\s、。,(【\\[■●・|/]|(?<=[】\\]]))(?:' + LABELS + ')(?:\\s*(?:\\([^)\\n]{0,8}\\)))?(?:\\s*[】\\]])?\\s*(?::|(?<=氏名|お名前|フリガナ|ふりがな|姓名|名義)\\s)\\s*', 'gm');
  var VALUE_STOP = setOf('未定 不明 同上 空欄 なし 無し 本人 任意 必須 記入 省略 調整中 未記入 確認中 TBD N/A - ー');
  function looksName(w, kanaOk) {
    if (VALUE_STOP[w]) return false;
    if (new RegExp('^' + H + '{1,5}$', 'u').test(w)) return cpLen(w) >= 2 ? !KANJI_STOP[w] && !(endsWithOrg(w) && !isSurname(w) && !surnamePrefixLen(w)) : isSurname(w);
    if (/^[ァ-ヺー・]{2,12}$/.test(w)) return kataNameOk(w);
    if (/^[ぁ-ゖ]{2,6}$/.test(w)) return kanaOk && !HIRA_STOP[w];
    if (new RegExp('^' + H + '{1,3}(?:[ぁ-ゖ]{2,4}|[ァ-ヺー]{2,5})$', 'u').test(w)) return isSurname(w.match(new RegExp('^' + H + '+', 'u'))[0]);
    if (/^[A-Za-z][A-Za-z.'\-]{1,20}$/.test(w)) return /^[A-Z]/.test(w);
    return false;
  }
  function isRoleWord(w) {
    if (RELATION[w] || KANJI_STOP[w]) return true;
    if (TITLES.indexOf(w) >= 0) return true;
    if (/(?:部|課|室|係|グループ|チーム|本部|事業部|センター|支店|営業所|担当|代表取締役|取締役|社長|会長|部長|課長|主任|係長|マネージャー|リーダー)$/.test(w) && !isSurname(w)) return true;
    if (/^(?:株式会社|有限会社|合同会社|\(株\)|㈱)/.test(w) || new RegExp(FORMS + '$').test(w)) return true;
    if (endsWithOrg(w) && !isSurname(w) && !surnamePrefixLen(w)) return true;
    return false;
  }
  function findPersonLabel(C) {
    var N = C.N, m;
    reLabel.lastIndex = 0;
    while ((m = reLabel.exec(N))) {
      var labelText = m[0];
      var kanaOk = /フリガナ|ふりがな|カナ|名義|氏名|お名前|名前/.test(labelText);
      var vs = m.index + m[0].length;
      var ve = N.indexOf('\n', vs); if (ve < 0) ve = N.length;
      parseNameList(C, vs, ve, kanaOk, 'label');
      if (reLabel.lastIndex <= m.index) reLabel.lastIndex = m.index + 1;
    }
  }
  /** N[vs,ve) に並ぶ名前（「、」区切り）を拾う */
  function parseNameList(C, vs, ve, kanaOk, rule) {
    var N = C.N;
    var seg = N.slice(vs, ve);
    // メールアドレスの <...> と、それ以降は見ない
    var lt = seg.search(/[<＜]/); if (lt >= 0) seg = seg.slice(0, lt);
    // 「（担当：橋本）」のように、値の外側の閉じ括弧（対になる開き括弧が値の中にないもの）で切る
    var depth = 0;
    for (var ci = 0; ci < seg.length; ci++) {
      if (/[(「『【\[]/.test(seg[ci])) depth++;
      else if (/[)」』】\]]/.test(seg[ci])) { if (depth === 0) { seg = seg.slice(0, ci); break; } depth--; }
    }
    var groups = [], re = /[^、,，/／]+/g, g;
    while ((g = re.exec(seg))) groups.push([vs + g.index, vs + g.index + g[0].length]);
    groups.forEach(function (gr) {
      var gs = gr[0], ge = gr[1];
      var txt = N.slice(gs, ge);
      // 括弧の中（ふりがな・所属）
      var pr = /\(([^)\n]{1,20})\)/g, pm;
      while ((pm = pr.exec(txt))) {
        var inner = pm[1].trim();
        if (/^[ァ-ヺー・\s]{2,20}$|^[ぁ-ゖ\s]{2,20}$/.test(inner) && !KATA_STOP[inner]) {
          var is = gs + pm.index + 1 + pm[1].indexOf(inner);
          C.add(is, is + inner.length, 'person', rule + '-reading');
        }
      }
      var cut = txt.search(/[(\[]/); if (cut >= 0) { ge = gs + cut; txt = txt.slice(0, cut); }
      // 単語に分ける
      var words = [], wr = /[^\s]+/g, wm;
      while ((wm = wr.exec(txt))) words.push([gs + wm.index, gs + wm.index + wm[0].length, wm[0]]);
      var i = 0;
      while (i < words.length && isRoleWord(stripHon(words[i][2]).w)) i++;
      if (i >= words.length) return;
      var w1 = stripHon(words[i][2]);
      if (/[0-9@]/.test(w1.w)) return;
      if (!looksName(w1.w, kanaOk)) {
        // 「田中太郎様」のように敬称が付いていない、漢字＋役職などは名字の位置で切る
        var pk = new RegExp('^' + H + '{2,8}$', 'u').test(w1.w) ? pickKanjiName(w1.w, true) : null;
        if (!pk) return;
        var off = w1.w.lastIndexOf(pk);
        C.add(words[i][0] + off, words[i][0] + off + pk.length, 'person', rule);
        return;
      }
      var s = words[i][0], e = words[i][0] + w1.w.length;
      if (i + 1 < words.length && w1.hon === '') {
        var w2 = stripHon(words[i + 1][2]);
        var bothH = new RegExp('^' + H + '{1,4}$', 'u');
        var pair = (bothH.test(w1.w) && (bothH.test(w2.w) || /^[ぁ-ゖ]{2,4}$|^[ァ-ヺー]{2,6}$/.test(w2.w))) ||
                   (/^[ァ-ヺー]+$/.test(w1.w) && /^[ァ-ヺー]+$/.test(w2.w)) ||
                   (/^[ぁ-ゖ]+$/.test(w1.w) && /^[ぁ-ゖ]+$/.test(w2.w)) ||
                   (/^[A-Za-z][A-Za-z.'\-]+$/.test(w1.w) && /^[A-Z][A-Za-z.'\-]+$/.test(w2.w));
        if (pair && !isRoleWord(w2.w) && !VALUE_STOP[w2.w]) e = words[i + 1][0] + w2.w.length;
      }
      C.add(s, e, 'person', rule);
    });
  }
  function stripHon(w) {
    var m = /^(.*?)(様|さま|さん|氏|殿|先生|くん|君|ちゃん|部長|課長|係長|社長|主任|宛)$/.exec(w);
    if (m && m[1]) return { w: m[1], hon: m[2] };
    return { w: w, hon: '' };
  }

  // 「〇〇の田中です」「田中と申します」
  function findPersonSelf(C) {
    var N = C.N, m;
    var re1 = new RegExp('(' + H + '{1,5}|[ァ-ヺー]{2,10}|' + H + '{1,3}\\s' + H + '{1,3})(?:と申します|と申しま|ともうします|と言います|といいます|でございます)', 'gu');
    while ((m = re1.exec(N))) {
      var r = m[1].replace(/\s/g, '');
      var ok = /^[ァ-ヺー]+$/.test(r) ? kataNameOk(r) : !!pickKanjiName(r, true);
      if (!ok) continue;
      var nm = /^[ァ-ヺー]+$/.test(r) ? m[1] : (m[1].indexOf(' ') >= 0 ? m[1] : pickKanjiName(r, true));
      var s = m.index + m[1].length - nm.length;
      C.add(s, s + nm.length, 'person', 'self');
    }
    var re2 = new RegExp('(?:の|、|。|^|\\s|(?:私|わたし|わたくし|僕|ぼく)は)(' + H + '{1,4})です', 'gmu');
    while ((m = re2.exec(N))) {
      var r2 = m[1];
      if (!(isSurname(r2) || (surnamePrefixLen(r2) && cpLen(r2) - surnamePrefixLen(r2) <= 2))) continue;
      var s2 = m.index + m[0].length - 2 - r2.length;
      C.add(s2, s2 + r2.length, 'person', 'self-desu');
    }
    // 「担当の田中が」「上司の佐藤から」
    var re3 = new RegExp('(?:' + H + '{1,6}(?:部|課|室|係|センター|事務局)|担当|担当者|上司|部下|同僚|先輩|後輩|部長|課長|社長|主任|友人|知人|妻|夫|息子|娘|母|父|患者|顧客|お客様|講師|医師|弁護士)(?:の|は|、)(' + H + '{1,4})(?=が|は|と|に|の|から|より|も|を|へ|、|。|です|まで|\\s|$)', 'gmu');
    while ((m = re3.exec(N))) {
      var r3 = m[1];
      var sp = surnamePrefixLen(r3);
      if (!(isSurname(r3) || (sp && cpLen(r3) - sp <= 2))) continue;
      var s3 = m.index + m[0].length - r3.length;
      C.add(s3, s3 + r3.length, 'person', 'role-no');
    }
    // 「代表取締役 山田太郎」「代表社員 斉藤」: 役職＋空白＋名字（辞書）
    var re5 = new RegExp('(?:代表取締役社長|代表取締役|代表社員|代表理事|取締役|代表|社長|会長|部長|課長|係長|主任|理事長|院長|所長|店長|担当)\\s(' + H + '{1,6})(?!' + H + ')', 'gu');
    while ((m = re5.exec(N))) {
      var r5 = m[1], sp5 = surnamePrefixLen(r5);
      if (!(isSurname(r5) || (sp5 && cpLen(r5) - sp5 <= 3))) continue;
      C.add(m.index + m[0].length - r5.length, m.index + m[0].length, 'person', 'title-space');
    }
    // 「— 総務 野口」「経理部 小松」: 部署＋空白＋名字（辞書）で行が終わる
    var re6 = new RegExp('(?:総務|人事|経理|営業|広報|法務|開発|企画|事務局|' + H + '{1,6}(?:部|課|室|係|センター))\\s(' + H + '{1,4}(?:\\s' + H + '{1,3})?)\\s*$', 'gmu');
    while ((m = re6.exec(N))) {
      var r6 = m[1].split(/\s/)[0];
      if (!isSurname(r6) && !(surnamePrefixLen(r6) && cpLen(r6) - surnamePrefixLen(r6) <= 3)) continue;
      var v6 = m[1], s6 = m.index + m[0].replace(/\s+$/, '').length - v6.length;
      C.add(s6, s6 + v6.length, 'person', 'dept-space');
    }
    // 文の終わりの名前だけの署名「…お願いします。山崎」
    var re7 = new RegExp('(?:[。！!？?]|^)\\s*(' + H + '{1,4})\\s*$', 'gmu');
    while ((m = re7.exec(N))) {
      var r7 = m[1], sp7 = surnamePrefixLen(r7);
      if (!(isSurname(r7) || (sp7 && cpLen(r7) - sp7 <= 2 && cpLen(r7) - sp7 >= 1))) continue;
      if (KANJI_STOP[r7]) continue;
      var s7 = m.index + m[0].replace(/\s+$/, '').length - r7.length;
      C.add(s7, s7 + r7.length, 'person', 'signoff');
    }
    // チャットの話者「オペレーター山口：」「[14:32] 佐藤：」
    var re8 = new RegExp('(?:^|\\]\\s?)(?:[ァ-ヺー]{2,10}|担当|顧客|司会|受付)?(' + H + '{1,4}(?:\\s' + H + '{1,3})?)\\s?:', 'gmu');
    while ((m = re8.exec(N))) {
      var v8 = m[1], r8 = v8.split(/\s/)[0], sp8 = surnamePrefixLen(r8);
      if (!(isSurname(r8) || (sp8 && cpLen(r8) - sp8 <= 3))) continue;
      var s8 = m.index + m[0].lastIndexOf(v8);
      C.add(s8, s8 + v8.length, 'person', 'speaker');
    }
    // 名字（辞書）＋空白＋名
    var re4 = new RegExp('(?<!' + H + ')(' + H + '{1,4}) (' + H + '{1,3})(?!' + H + ')', 'gu');
    while ((m = re4.exec(N))) {
      if (!isSurname(m[1]) || KANJI_STOP[m[2]] || endsWithOrg(m[2]) || TITLES.indexOf(m[2]) >= 0) { re4.lastIndex = m.index + 1; continue; }
      C.add(m.index, m.index + m[0].length, 'person', 'dict-space');
    }
  }

  // 署名欄・宛名行: 1行がまるごと名前（＋所属）の行
  var SEP_LINE = /^\s*(?:[-=_*~―─━ー＊※]{3,}|--)\s*$/;
  function findPersonLines(C, hasContact) {
    var N = C.N;
    var lines = [], pos = 0;
    N.split('\n').forEach(function (l) { lines.push([pos, l]); pos += l.length + 1; });
    var sigFrom = -1;
    lines.forEach(function (L, k) { if (SEP_LINE.test(L[1])) sigFrom = sigFrom < 0 ? k : sigFrom; });
    lines.forEach(function (L, k) {
      var raw = L[1], base = L[0];
      var t = raw.replace(/\s+$/, ''), lead = raw.length - raw.replace(/^\s+/, '').length;
      t = t.slice(lead);
      if (!t || t.length > 30) return;
      // 末尾の（ふりがな）
      var reading = /\s?\(([ァ-ヺー・\s]{2,20}|[ぁ-ゖ\s]{2,20})\)$/.exec(t);
      var core = reading ? t.slice(0, reading.index) : t;
      core = core.replace(/\s?(?:様|さま|さん|殿|先生|御中|宛)$/, '');   // 敬称つきの行は敬称の規則に任せる
      if (!core) return;
      var words = core.split(/\s+/);
      var offs = [], o = 0;
      words.forEach(function (w) { var i = core.indexOf(w, o); offs.push(i); o = i + w.length; });
      var i = 0;
      while (i < words.length - 1 && isRoleWord(words[i])) i++;
      var rest = words.slice(i);
      var near = sigFrom >= 0 && k > sigFrom;
      var nearContact = hasContact(k);
      var s = base + lead + offs[i], ok = false, e;
      var w0 = rest[0] || '';
      if (rest.length === 2 && new RegExp('^' + H + '{1,4}$', 'u').test(rest[0]) && new RegExp('^(?:' + H + '{1,3}|[ぁ-ゖ]{2,4}|[ァ-ヺー]{2,6})$', 'u').test(rest[1])) {
        ok = isSurname(rest[0]) || ((near || nearContact) && cpLen(rest[0]) >= 2 && !KANJI_STOP[rest[0]] && !endsWithOrg(rest[0]) && !isRoleWord(rest[1]));
        e = s + core.slice(offs[i]).length;
      } else if (rest.length === 1 && new RegExp('^' + H + '{2,5}$', 'u').test(w0)) {
        var sp = surnamePrefixLen(w0);
        ok = (isSurname(w0) && (near || nearContact || i > 0)) || (sp && cpLen(w0) - sp >= 1 && cpLen(w0) - sp <= 3 && !endsWithOrg(w0) && !KANJI_STOP[w0]);
        e = s + w0.length;
      } else if (rest.length === 2 && /^[A-Z][a-z]+$|^[A-Z]{2,}$/.test(rest[0]) && /^[A-Z][a-z]+$|^[A-Z]{2,}$/.test(rest[1])) {
        ok = near || nearContact;
        e = s + core.slice(offs[i]).length;
      } else if (rest.length === 2 && /^[ァ-ヺー]{2,8}$/.test(rest[0]) && /^[ァ-ヺー]{2,8}$/.test(rest[1])) {
        ok = (near || nearContact) && kataNameOk(rest[0]) && kataNameOk(rest[1]);
        e = s + core.slice(offs[i]).length;
      }
      if (ok) {
        C.add(s, e, 'person', 'line');
        if (reading) {
          var rs = base + lead + reading.index + reading[0].indexOf('(') + 1;
          C.add(rs, rs + reading[1].length, 'person', 'line-reading');
        }
      }
    });
  }

  // ------------------------------------------------------------------ 重なりの解消
  function resolve(list) {
    var sorted = list.slice().sort(function (a, b) {
      return (b.score - a.score) || ((b.end - b.start) - (a.end - a.start)) || (a.start - b.start);
    });
    var taken = [];
    sorted.forEach(function (c) {
      for (var i = 0; i < taken.length; i++) { var t = taken[i]; if (c.start < t.end && t.start < c.end) return; }
      taken.push(c);
    });
    return taken.sort(function (a, b) { return a.start - b.start; });
  }
  function keyOf(type, value) { return type + '\u0000' + canonical(type, value); }
  function canonical(type, v) {
    if (type === 'phone' || type === 'mynumber' || type === 'card' || type === 'postal') return digitsOf(normalize(v));
    if (type === 'email' || type === 'url') return normalize(v).toLowerCase();
    return normalize(v).replace(/\s+/g, '');
  }

  // ------------------------------------------------------------------ 検出（入口）
  function detect(text, opts) {
    opts = opts || {};
    var enabled = opts.enabled || {};
    var on = function (k) { return enabled[k] != null ? !!enabled[k] : TYPES.filter(function (t) { return t.key === k; })[0].on; };
    var exclude = Object.create(null); (opts.exclude || []).forEach(function (k) { exclude[k] = true; });
    var N = normalize(text);
    var C = new Cands(text, N);
    findUrl(C); findEmail(C); findIp(C); findCard(C); findMyNumber(C); findBank(C); findPhone(C); findPostal(C);
    findDates(C); findAddress(C); findCompany(C);
    // 連絡先（メール・電話）のある行の近くは署名欄とみる
    var contactLines = Object.create(null);
    C.list.forEach(function (c) {
      if (c.type === 'email' || c.type === 'phone' || c.type === 'company' || c.type === 'url') {
        var ln = N.slice(0, c.start).split('\n').length - 1; contactLines[ln] = true;
      }
    });
    var hasContact = function (k) { for (var d = -3; d <= 3; d++) if (contactLines[k + d]) return true; return false; };
    findPersonHonorific(C); findPersonLabel(C); findPersonSelf(C); findPersonLines(C, hasContact);

    // 手で足したもの（すべての出現）
    (opts.include || []).forEach(function (inc) {
      if (!inc.value) return;
      var i = -1;
      while ((i = text.indexOf(inc.value, i + 1)) >= 0) C.add(i, i + inc.value.length, inc.type, 'manual', 1000);
    });
    var list = C.list.filter(function (c) { return (c.rule === 'manual' || on(c.type)) && !exclude[keyOf(c.type, c.value)]; });
    var res = resolve(list);

    // 人名: 一度見つかった名前は、文中のほかの出現も伏せる（同じ人は同じ番号になる）
    if (on('person')) {
      var names = Object.create(null);
      res.forEach(function (c) {
        if (c.type !== 'person') return;
        var v = c.value; names[v] = true;
        var sp = v.split(/[\s　]+/);
        if (sp.length === 2 && cpLen(sp[0]) >= 2 && isSurname(sp[0])) names[sp[0]] = true;
        else if (/^[^\s]+$/.test(v) && new RegExp('^' + H + '+$', 'u').test(v)) {
          var n = surnamePrefixLen(v);
          if (n >= 2 && cpLen(v) - n >= 1) names[Array.from(v).slice(0, n).join('')] = true;
        }
      });
      var extra = [];
      Object.keys(names).forEach(function (v) {
        if (cpLen(v) < 2) return;
        var kanji = new RegExp('^' + H + '+$', 'u').test(v), kata = /^[ァ-ヺー・]+$/.test(v);
        var i = -1;
        while ((i = text.indexOf(v, i + 1)) >= 0) {
          var b = charBefore(N, i), a = charAt(N, i + v.length);
          if (kanji && (isH(b) || isH(a))) continue;
          if (kata && (isKata(b) || isKata(a))) continue;
          if (/^[A-Za-z]/.test(v) && (isLatin(b) || isLatin(a))) continue;
          if (exclude[keyOf('person', v)]) continue;
          extra.push({ start: i, end: i + v.length, type: 'person', rule: 'propagate', score: PRIORITY.person - 1, value: v });
        }
      });
      if (extra.length) res = resolve(res.concat(extra));
    }
    return res;
  }

  // ------------------------------------------------------------------ 置き換え・戻す
  function tokenFor(type, n) { return '[' + LABEL[type] + n + ']'; }
  /** spans（detect の結果）で text を置き換える。table は同じ値→同じ番号 */
  function mask(text, spans, prevTable) {
    var table = (prevTable || []).slice();
    var byKey = Object.create(null), count = Object.create(null);
    table.forEach(function (r) { byKey[keyOf(r.type, r.value)] = r; count[r.type] = Math.max(count[r.type] || 0, r.n); });
    var out = '', pos = 0;
    spans.slice().sort(function (a, b) { return a.start - b.start; }).forEach(function (s) {
      var k = keyOf(s.type, s.value), row = byKey[k];
      if (!row) {
        count[s.type] = (count[s.type] || 0) + 1;
        row = { token: tokenFor(s.type, count[s.type]), type: s.type, label: LABEL[s.type], n: count[s.type], value: s.value };
        byKey[k] = row; table.push(row);
      }
      out += text.slice(pos, s.start) + row.token;
      pos = s.end;
    });
    out += text.slice(pos);
    return { text: out, table: table };
  }
  var LABEL_ALT = TYPES.map(function (t) { return escRe(t.label); }).sort(function (a, b) { return b.length - a.length; }).join('|');
  var reToken = new RegExp('[\\[［【〔「『]\\s*(' + LABEL_ALT + ')\\s*([0-9０-９]+)\\s*[\\]］】〕」』]', 'g');
  /** AI の返答の [人名1] などを、対応表で元に戻す。括弧の種類・全角数字・空白の揺れは許す */
  function restore(text, table) {
    var map = Object.create(null);
    (table || []).forEach(function (r) { map[r.label + '\u0000' + r.n] = r.value; });
    var count = 0, missing = [];
    var out = text.replace(reToken, function (all, label, num) {
      var n = parseInt(normalize(num), 10), v = map[label + '\u0000' + n];
      if (v == null) { missing.push(all); return all; }
      count++; return v;
    });
    return { text: out, count: count, missing: missing };
  }
  /** 元の文に、すでに [人名1] のような書き方があるか（戻すときに区別できなくなる） */
  function hasTokenLike(text) { reToken.lastIndex = 0; var r = reToken.test(text); reToken.lastIndex = 0; return r; }

  return {
    TYPES: TYPES, LABEL: LABEL, PRIORITY: PRIORITY,
    normalize: normalize, luhnValid: luhnValid, myNumberCheckDigit: myNumberCheckDigit, myNumberValid: myNumberValid,
    detect: detect, mask: mask, restore: restore, keyOf: keyOf, hasTokenLike: hasTokenLike,
    _internal: { isSurname: isSurname, phoneOk: phoneOk, resolve: resolve }
  };
});
