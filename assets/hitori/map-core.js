// 新しい地図UIの純関数。DOM・fetch・Leaflet に触らない。
// 距離・営業時間・駅名検索・県判定は既存の core.js を使う（再実装しない）。
import { haversineM, openState, parseOpeningHours } from './core.js';

// --- 表示カテゴリ ---
// データ側の cat は stay に museum/library が混ざっている（「宿泊」に博物館が出ていた）。
// 表示は kind から決め直す。データは触らない。
export const DISPLAY_CATS = [
  { key: 'eat', label: '飲食' },
  { key: 'bath', label: '温浴' },
  { key: 'play', label: '体験' },
  { key: 'quiet', label: '静かに過ごす' },
  { key: 'stay', label: '宿' },
];

const KIND_CAT = {
  ramen: 'eat', soba_udon: 'eat', gyudon: 'eat', curry: 'eat', standing: 'eat',
  sento: 'bath', sauna: 'bath', onsen: 'bath', footbath: 'bath', private_sauna: 'bath',
  spa: 'bath', capsule_hotel_sauna: 'bath', private_sauna_hotel: 'bath',
  karaoke: 'play', netcafe: 'play', cinema: 'play',
  library: 'quiet', museum: 'quiet',
  hostel: 'stay',
};

const KIND_JA = {
  ramen: 'ラーメン', soba_udon: 'そば・うどん', gyudon: '牛丼・定食', curry: 'カレー', standing: '立ち食い',
  sento: '銭湯', sauna: 'サウナ', onsen: '温泉', footbath: '足湯', private_sauna: '個室サウナ',
  spa: 'スパ', capsule_hotel_sauna: 'カプセル&サウナ', private_sauna_hotel: '個室サウナ付き宿',
  karaoke: 'カラオケ', netcafe: 'ネットカフェ', cinema: '映画館',
  library: '図書館', museum: '博物館・美術館', hostel: 'ホステル',
};

// 未確認施設に見せる唯一の「見立て」。数字は出さない。業態の性質だけを言う。
const FIT_NOTE = {
  ramen: '一人客が普通の業態', gyudon: '一人客が普通の業態', curry: '一人客が普通の業態',
  standing: '一人客が普通の業態', sento: '一人客が普通の業態', netcafe: '一人客が普通の業態',
  library: '一人客が普通の業態', museum: '一人客が普通の業態', cinema: '一人客が普通の業態',
  soba_udon: '一人客が多い業態', karaoke: 'ヒトカラ対応は要確認',
  hostel: 'ドミトリー中心。個室は要確認', onsen: '一人利用は一般的', sauna: '一人利用は一般的',
  private_sauna: '個室型', private_sauna_hotel: '個室型', footbath: '一人客が普通の業態',
};

export function displayCat(kind, cat) { return KIND_CAT[kind] || cat; }
export function kindJa(kind) { return KIND_JA[kind] || kind; }
export function fitNote(kind) { return FIT_NOTE[kind] || ''; }

// --- 営業中ラベル ---
function _closingText(rules, now) {
  const day = now.getDay(), prev = (day + 6) % 7;
  const min = now.getHours() * 60 + now.getMinutes();
  let end = null;
  for (const r of rules) {
    if (r.days.includes(day)) for (const [a, b] of r.spans) if (min >= a && min < b) end = b;
    if (end === null && r.days.includes(prev)) {
      for (const [a, b] of r.spans) if (b > 1440 && min + 1440 >= a && min + 1440 < b) end = b - 1440;
    }
  }
  if (end === null) return '';
  const next = end > 1440;
  const m = next ? end - 1440 : end;
  const hh = Math.floor(m / 60), mm = m % 60;
  return `〜${next ? '翌' : ''}${hh}:${String(mm).padStart(2, '0')}`;
}

export function openLabel(item, hoursFact, now) {
  const candidates = [];
  if (hoursFact && typeof hoursFact.v === 'string') {
    candidates.push([hoursFact.v, hoursFact.official ? '公式サイト' : '確認済み情報']);
  }
  if (item && item.oh) candidates.push([item.oh, 'OpenStreetMap']);
  for (const [str, source] of candidates) {
    const rules = parseOpeningHours(str);
    if (!rules) continue;
    const st = openState(str, now);
    if (st === 'open') return { state: 'open', text: `営業中 ${_closingText(rules, now)}`.trim(), source };
    return { state: 'closed', text: '営業時間外', source };
  }
  return { state: 'unknown', text: '営業時間は要確認', source: '' };
}
