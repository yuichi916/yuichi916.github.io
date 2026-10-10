// 操作の設定画面: キーの割り当て（1P・2P）、連続移動の調整（DAS/ARR）、スマホの操作方式、振動。
// 変えたらすぐ settings に入れて保存し、onChange で入力に反映する。
import { ACTIONS, DEFAULTS, rebind } from './settings.js';

const LABEL = { left: '左', right: '右', up: '上（つなぐ派: すぐ落とす）', down: '下（つなぐ派: 速く落とす）', a: 'A（左回転／入れ替え）', b: 'B（右回転／せり上げ）' };
const keyName = code => code
  .replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', '')
  .replace('Left', '←').replace('Right', '→').replace('Up', '↑').replace('Down', '↓')
  .replace('Semicolon', ';').replace('Quote', "'").replace('Space', 'スペース');

export function mountControls({ root, settings, save, onChange, mobile }) {
  let waiting = null; // {player, action}

  function render() {
    const keys = settings.keys;
    const rows = ACTIONS.map(a => `<tr><th>${LABEL[a]}</th>${['p1', 'p2'].map(p => {
      const w = waiting && waiting.player === p && waiting.action === a;
      return `<td><button type="button" data-bind="${p}:${a}" class="${w ? 'wait' : ''}">${w ? 'キーを押して…' : keys[p][a].map(keyName).join(' / ') || '（なし）'}</button></td>`;
    }).join('')}</tr>`).join('');
    const chip = (key, val, text) => `<button class="chip${settings[key] === val ? ' sel' : ''}" type="button" data-opt="${key}:${val}">${text}</button>`;
    root.innerHTML = `
      ${mobile ? '' : `<table class="ctable"><thead><tr><th></th><th>1P（CPU戦のあなた）</th><th>2P</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="keys" style="margin:0 0 12px">CPU戦では、1P と 2P のどちらのキーでも操作できます。ゲームパッドは、つないだ順に 1P・2P です（十字キー・A・B・Start）。</p>`}
      <div class="slider"><span>連続移動が始まるまで</span><input type="range" min="4" max="20" step="1" value="${settings.das}" data-range="das"><b>${(settings.das / 60).toFixed(2)}秒</b></div>
      <div class="slider"><span>連続移動の間隔</span><input type="range" min="1" max="6" step="1" value="${settings.arr}" data-range="arr"><b>${(settings.arr / 60).toFixed(3)}秒</b></div>
      <div class="row" style="margin-top:12px"><label>スマホ操作</label>${chip('touch', 'gesture', '指でなぞる')}${chip('touch', 'buttons', 'ボタンだけ')}</div>
      <div class="row"><label>振動</label>${chip('vibrate', true, 'あり')}${chip('vibrate', false, 'なし')}</div>`;
  }

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-bind]');
    if (b) { const [player, action] = b.dataset.bind.split(':'); waiting = { player, action }; render(); return; }
    const o = e.target.closest('[data-opt]');
    if (o) {
      const [key, val] = o.dataset.opt.split(':');
      settings[key] = val === 'true' ? true : val === 'false' ? false : val;
      save(); onChange(); render();
    }
  });
  root.addEventListener('input', e => {
    const r = e.target.closest('[data-range]');
    if (!r) return;
    settings[r.dataset.range] = +r.value;
    save(); onChange();
    r.nextElementSibling.textContent = r.dataset.range === 'das' ? `${(+r.value / 60).toFixed(2)}秒` : `${(+r.value / 60).toFixed(3)}秒`;
  });
  // 割り当て待ちのときに押したキーを取る（Esc で取り消し）
  addEventListener('keydown', e => {
    if (!waiting) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code !== 'Escape') { rebind(settings.keys, waiting.player, waiting.action, e.code); save(); onChange(); }
    waiting = null; render();
  }, true);

  return {
    render,
    resetDefaults() {
      const d = JSON.parse(JSON.stringify(DEFAULTS));
      settings.keys = d.keys; settings.das = d.das; settings.arr = d.arr; settings.touch = d.touch; settings.vibrate = d.vibrate;
      save(); onChange(); render();
    },
    get waiting() { return waiting; },
  };
}
