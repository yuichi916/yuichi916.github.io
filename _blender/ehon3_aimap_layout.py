# -*- coding: utf-8 -*-
"""AIエージェント能力アトラス (ai-map.html) の地図 (326 タスクのツリーマップ) を、実際に描かれた位置のまま取り出す。
絵本の飛び出し (ehon.html の buildAtlas) が、本物の地図と同じ並び・同じ色の段で立ち上がるようにするため。
出力: _ehon_assets/ehon/popup/aimap_layout_v1.json
  size: [W, H] (地図の座標の大きさ)、years: 年の並び、
  doms: [{name, color, x0, y0, x1, y1}]、tasks: [[x0, y0, x1, y1, 領域の番号, [年ごとのレベル 0..5]]]
usage: python _blender/ehon3_aimap_layout.py   (リポジトリ直下で http サーバーが 18931 番で動いていること)
"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, '_ehon_assets', 'ehon', 'popup', 'aimap_layout_v1.json')
URL = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:18931') + '/ai-map.html'

with sync_playwright() as p:
    b = p.chromium.launch(headless=False, channel='chrome', args=['--mute-audio', '--window-position=-2600,0', '--window-size=1456,1000'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    ctx.route('**/*goatcounter*', lambda r: r.abort())
    ctx.route('https://*.goatcounter.com/**', lambda r: r.abort())
    ctx.route('**/gc.zgo.at/**', lambda r: r.abort())
    page = ctx.new_page()
    page.goto(URL, wait_until='load')
    page.wait_for_function("() => document.querySelectorAll('#atlas g.leaf').length > 300 || document.getElementById('ovnext')", timeout=30000)
    if page.evaluate("() => document.querySelectorAll('#atlas g.leaf').length") < 300:
        page.click('#ovnext')
        page.wait_for_function("() => document.querySelectorAll('#atlas g.leaf').length > 300", timeout=30000)
    data = page.evaluate("""() => {
      const svg = document.querySelector('#atlas svg'), vb = svg.viewBox.baseVal;
      const doms = [...document.querySelectorAll('#atlas g.dom')].map(g => { const d = g.__data__;
        return { id: d.data.id, name: d.data.name, color: d.data.color, x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 }; });
      const leaves = [...document.querySelectorAll('#atlas g.leaf')].map(g => g.__data__).filter(d => d.data._k === 'task');
      const years = Object.keys(leaves[0].data.levels);
      const tasks = leaves.map(d => { let dom = d; while (dom.depth > 1) dom = dom.parent;
        return [d.x0, d.y0, d.x1, d.y1, doms.findIndex(x => x.id === dom.data.id), years.map(y => d.data.levels[y])]; });
      return { size: [vb.width, vb.height], years, doms, tasks };
    }""")
    b.close()
assert len(data['tasks']) == 326, len(data['tasks'])
assert len(data['doms']) == 8, len(data['doms'])
assert all(len(t[5]) == len(data['years']) and all(0 <= v <= 5 for v in t[5]) for t in data['tasks'])
json.dump(data, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('years', data['years'], 'size', data['size'], 'tasks', len(data['tasks']), os.path.getsize(OUT) // 1024, 'KB')
lv = [t[5][data['years'].index('2026')] for t in data['tasks']]
print('2026: >=3', sum(v >= 3 for v in lv), '>=4', sum(v >= 4 for v in lv), '<=1', sum(v <= 1 for v in lv))
