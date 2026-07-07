# cabin 物語モード v2「灯を継ぐもの ―七つの夜―」実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans（インライン）。Steps は checkbox。

**Goal:** 既存3章物語を7章大河へ拡張し、記憶の断片を実3D位置で集める謎解き・二人の過去(号泣)・章セレクト＋セーブを、cabin.html 単一ファイルに非破壊で実装する。

**Architecture:** v1（`STORY`/`window.CabinStory`/`_storyFx`/`_storyEnding`, commit 22ca438）を土台に拡張。3D断片は `fragmentGroup`（markerGroupと並列）＋`onMarker('frag:*')`。UI(StoryEngine)↔3D(CabinRoom) は window API で橋渡し。セーブは localStorage `cabin_story` を後方互換で拡張。

**Tech Stack:** バニラJS＋Three.js（既存importmap）＋CSS＋localStorage＋HTMLAudio。BGMは君の音。vol.2をffmpeg抽出。

## Global Constraints
- 単一 cabin.html に追記。**commit前 `python C:/tmp/check_dup_const.py cabin.html` が exit 0**。
- 既存の瞑想/環境音/BGM/マーカー/掛け合いゲート/i18n/水切り/屋外/訪問カウントは非破壊。
- 立ち絵: `assets/guide-witch.png`=灯里 / `assets/guide-boy.png`=蒼。話者色 灯里`#f7e7ec`/蒼`#e6eefa`/narr`#d8cdb8`/you`#f3ead6`。
- BGMクレジット必須（締め画面＋章セレクト脚注）: 「♪ 物語音楽: 君の音。(真島こころ)『映画風ピアノ音楽素材集 vol.2 水のうつろい』」。
- v1保存 `{ch,beat,lit,cleared}` と後方互換。どの選択でもエンディング到達（詰ませない）。Conventional Commits。
- 号泣の核＝§3.2（蒼=安堵の罪／灯里=強さの嘘）の赦し合い。安易に軽くしない。[[feedback_niwa_world_design]][[feedback_no_quality_compromise]]

## BGMマッピング（確定）
vol.2 FLAC → `assets/bgm/*.mp3`（mp3 128k, ffmpeg）。既存3本＋新規5本。
| 章 | ファイル | 原曲 |
|---|---|---|
| ①灯る | story-ch1-yoru-no-hotori.mp3（既存） | 05.夜のほとり |
| ②蒼のかけら | **story-ame.mp3**（新） | 04.雨模様 |
| ③蒼の夜 | story-ch2-minasoko.mp3（既存） | 01.水底の記憶 |
| ④灯里のかけら | **story-utsuroi.mp3**（新） | 02.水のうつろい |
| ⑤灯里の夜 | **story-shiroi-door.mp3**（新） | 09.白いドア |
| ⑥秘密 | **story-sorekara.mp3**（新） | 03.それから私達は |
| ⑦継ぐ | story-ch3-kizuna.mp3（既存） | 12.結びつける絆 |
| エンディング | **story-hikari.mp3**（新） | 10.光射す |
源: `P:\My Music\Lossless\Indies\素材\[2024.11.09] 君の音。 (真島こころ) — 映画風ピアノ音楽素材集 vol.2 - 水のうつろい - [WEB-FLAC]`

---

### Task 1: BGM抽出＋セーブv2（fragments/unlocked・後方互換）

**Files:** 追加 `assets/bgm/story-ame.mp3` `story-utsuroi.mp3` `story-shiroi-door.mp3` `story-sorekara.mp3` `story-hikari.mp3`。Modify `cabin.html`（CabinStory の save/load）

- [ ] **Step 1: BGM 5本抽出**
```bash
SRC="P:/My Music/Lossless/Indies/素材/[2024.11.09] 君の音。 (真島こころ) — 映画風ピアノ音楽素材集 vol.2 - 水のうつろい - [WEB-FLAC]"
FF="C:/Users/yuich/Downloads/ffmpeg-7.0.2-full_build/bin/ffmpeg.exe"   # 無ければ which ffmpeg
cd "C:/projects/yuichi916.github.io/assets/bgm"
"$FF" -y -i "$SRC/04.雨模様.flac"        -b:a 128k story-ame.mp3
"$FF" -y -i "$SRC/02.水のうつろい.flac"    -b:a 128k story-utsuroi.mp3
"$FF" -y -i "$SRC/09.白いドア.flac"       -b:a 128k story-shiroi-door.mp3
"$FF" -y -i "$SRC/03.それから私達は.flac"  -b:a 128k story-sorekara.mp3
"$FF" -y -i "$SRC/10.光射す.flac"         -b:a 128k story-hikari.mp3
ls -la story-*.mp3   # 8本(既存3+新5)、各~1-2MB
```
（ffmpeg実体パスは `feedback_video_rendering` 参照。無ければ `where ffmpeg`/既存 music-*.mp3 生成時のパス）

- [ ] **Step 2: セーブスキーマ拡張（後方互換）**
`window.CabinStory` の `st` 既定と load を拡張:
```js
let st={ch:0, beat:0, lit:0, fragments:{}, unlocked:0, cleared:false};
function _load(){ try{ const s=JSON.parse(localStorage.getItem(LS)||'null');
  if(s&&s.ch!=null){ st={ch:s.ch||0, beat:s.beat||0, lit:s.lit||0,
    fragments:s.fragments||{}, unlocked:s.unlocked||s.ch||0, cleared:!!s.cleared }; } }catch(e){} return st; }
```
save は `st` 全体を書く（既存 `_save` のまま）。`unlocked` は章遷移で `Math.max` 更新。

- [ ] **Step 3: 検証 + commit**
Run: `python C:/tmp/check_dup_const.py "C:/projects/yuichi916.github.io/cabin.html"` → exit 0。BGM 8本存在＋再生可(HTTP HEAD 200)。
```bash
cd "C:/projects/yuichi916.github.io" && git add assets/bgm cabin.html && git commit -m "feat(cabin): add 5 story BGM tracks (Kimi no Ne vol.2) + save schema v2 (fragments/unlocked, backward-compatible)"
```

---

### Task 2: 3D記憶の断片システム（実位置・クリック収集）

**Files:** Modify `cabin.html`（3Dモジュール: fragmentGroup/FRAGMENTS/buildFragments/raycaster/CabinRoom拡張、onMarker、CSS、#fragBar DOM）

**Produces:** `CabinRoom.showFragments(keys)` / `hideFragments()` / `setFragmentCollected(key)`；`onMarker('frag:<key>')`→`CabinStory.collectFragment(key)`；`body.story-investigate` CSS；`#fragBar` プロンプト。

- [ ] **Step 1: FRAGMENTS＋fragmentGroup（3Dモジュール, markerGroup定義の直後 ~L2136）**
```js
// 記憶の断片（方位は _probe で較正。初期値は実測ベース）
const FRAGMENTS = [
  { key:'fire',  lon:0,   lat:-20, r:5.2, jp:'消えない焚き火' },
  { key:'tea',   lon:28,  lat:-13, r:4.6, jp:'冷めない茶' },
  { key:'chair', lon:-40, lat:-12, r:4.8, jp:'二脚目の椅子' },
  { key:'clock', lon:44,  lat:-4,  r:5.0, jp:'止まった時計' },
  { key:'tally', lon:-70, lat:-3,  r:5.2, jp:'柱の刻み' },
  { key:'snow',  lon:-63, lat:2,   r:6.0, jp:'窓の外の足跡' },
];
function fragTex(){ const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'); x.translate(64,64);
  const g=x.createRadialGradient(0,0,2,0,0,34); g.addColorStop(0,'rgba(255,236,190,.98)'); g.addColorStop(.5,'rgba(255,210,150,.55)'); g.addColorStop(1,'rgba(255,210,150,0)');
  x.fillStyle=g; x.beginPath(); x.arc(0,0,34,0,6.28); x.fill();
  x.strokeStyle='rgba(255,246,220,.95)'; x.lineWidth=2.4; x.beginPath(); x.arc(0,0,15,0,6.28); x.stroke();
  return new THREE.CanvasTexture(c); }
const fTex=fragTex();
const fragmentGroup=new THREE.Group(); fragmentGroup.visible=false; scene.add(fragmentGroup);
let fragmentSprites=[];
function buildFragments(keys){
  fragmentSprites.forEach(s=>{ fragmentGroup.remove(s); s.material.dispose(); }); fragmentSprites=[];
  const set=keys&&keys.length?FRAGMENTS.filter(f=>keys.indexOf(f.key)>=0):FRAGMENTS;
  fragmentSprites = set.map(m=>{ const s=new THREE.Sprite(new THREE.SpriteMaterial({ map:fTex, blending:THREE.AdditiveBlending, depthWrite:false, transparent:true, opacity:.95 }));
    s.position.copy(bearing(m.lon,m.lat,m.r)); s.scale.set(0.85,0.85,1); s.userData={ key:'frag:'+m.key, fkey:m.key }; s.userData._done=false; fragmentGroup.add(s); return s; });
}
```

- [ ] **Step 2: raycaster拡張（クリック検出 ~L2199）＋pulse（animate ~L2483）**
既存の click 判定（markerGroup intersect）を断片にも:
```js
// 既存: const hit=ray.intersectObjects(markerGroup.children,false)[0];
const grp = fragmentGroup.visible ? fragmentGroup.children : markerGroup.children;
const hit = ray.intersectObjects(grp,false)[0];
if(hit && hit.object.userData) window.onMarker && window.onMarker(hit.object.userData.key);
```
animate: `fragmentGroup.visible` の時、collected でないスプライトを脈動、collected は減光:
```js
if(fragmentGroup.visible){ fragmentSprites.forEach(s=>{ const b=0.78+0.14*Math.sin(t*2.6+s.position.x);
  s.scale.set(b,b,1); s.material.opacity = s.userData._done? 0.16 : (0.6+0.32*Math.sin(t*2.6+s.position.x)); }); }
```
gaze強調（中央注視で拡大）は任意（markerと同様の hovered 判定に fragmentGroup を含めれば流用可）。

- [ ] **Step 3: CabinRoom に断片API追加（window.CabinRoom 内 ~L2178）**
```js
    showFragments(keys){ buildFragments(keys||[]); fragmentGroup.visible=true; },
    hideFragments(){ fragmentGroup.visible=false; },
    setFragmentCollected(key){ const s=fragmentSprites.find(s=>s.userData.fkey===key); if(s) s.userData._done=true; },
    _probe(lon,lat){ /* 較正用: 指定方位へ向く */ tLon=lon; tLat=lat; },
```

- [ ] **Step 4: onMarker に frag 分岐（UI IIFE ~L2647）**
```js
    else if(key.indexOf('frag:')===0){ if(window.CabinStory) window.CabinStory.collectFragment(key.slice(5)); }
```

- [ ] **Step 5: CSS＋#fragBar DOM**
CSS（story CSSブロックに追記）:
```css
body.story-investigate #story{pointer-events:none}
body.story-investigate .story-box{opacity:0;pointer-events:none}
body.story-investigate #reticle{opacity:.75!important}
#fragBar{position:fixed;left:50%;top:22px;transform:translateX(-50%);z-index:92;opacity:0;transition:opacity .5s;
  font-family:"Shippori Mincho",serif;color:#f0e6d2;background:rgba(24,20,14,.72);border:1px solid rgba(201,180,140,.34);
  border-radius:99px;padding:9px 20px;font-size:.86rem;letter-spacing:.06em;pointer-events:none;white-space:nowrap}
body.story-investigate #fragBar{opacity:1}
#fragReveal{position:fixed;left:50%;bottom:16vh;transform:translateX(-50%);z-index:92;max-width:min(560px,90vw);
  text-align:center;font-family:"Shippori Mincho",serif;color:#efe6d4;font-style:italic;line-height:2.0;
  background:linear-gradient(180deg,rgba(24,20,14,0),rgba(20,16,11,.86) 30%);padding:22px 24px;border-radius:12px;
  opacity:0;transition:opacity .6s;pointer-events:none}
#fragReveal.show{opacity:1}
```
DOM（`#story` の直後）:
```html
<div id="fragBar" aria-hidden="true"></div>
<div id="fragReveal" aria-hidden="true"></div>
```

- [ ] **Step 6: 方位較正（_probe スイープ）**
HTTP :8377 + Playwright で story-investigate に入れ、各断片が実オブジェクトに乗るか `CabinRoom._probe(lon,lat)`＋screenshot で確認。ズレたら FRAGMENTS の lon/lat を調整（`lon=180-360u` 教訓）。fire=炎/tea=卓上/chair=揺り椅子/clock=時計/tally=柱/snow=窓 に乗せる。

- [ ] **Step 7: 検証 + commit**
Playwright: `document.body.classList.add('story-investigate'); CabinRoom.showFragments([])` で6スプライト可視→`onMarker('frag:tea')` で `_done` 化。check_dup_const exit 0。
```bash
cd "C:/projects/yuichi916.github.io" && python C:/tmp/check_dup_const.py cabin.html && git add cabin.html && git commit -m "feat(cabin): 3D memory-fragment system (fragmentGroup at real bearings, click-to-collect, story-investigate mode)"
```

---

### Task 3: STORY v2 全7章＋StoryEngine 断片連携

**Files:** Modify `cabin.html`（`STORY` を7章に、`CabinStory` に investigate/collectFragment/exitInvestigate）

**Consumes:** Task2 の CabinRoom.showFragments/hideFragments/setFragmentCollected。
**Produces:** 7章の完全な台本；`enterInvestigate(need,prompt,done)`/`collectFragment(key)`/`exitInvestigate()`；Beat型 `{investigate:{prompt,need,done}}`/`{fragment:{key,line}}`。

- [ ] **Step 1: Beat拡張＋探索エンジン**（`render` に投機分岐、engineに関数追加）
```js
// render() に追加
} else if(b.investigate){ startInvestigate(b.investigate); }
} else if(b.fragment){ talk(null); el('sbName').textContent=''; el('sbText').textContent=b.fragment.line; el('sbText').style.fontStyle='italic'; }
```
```js
let inv=null; // {need:Set, got:Set, done}
function startInvestigate(cfg){ locked=true; inv={need:new Set(cfg.need), got:new Set(), done:cfg.done};
  document.body.classList.add('story-investigate');
  try{ window.CabinRoom.showFragments(cfg.need); }catch(e){}
  updateFragBar(cfg.prompt); }
function updateFragBar(prompt){ const bar=el('fragBar'); if(bar) bar.textContent=(prompt||'小屋を調べる')+' ― かけら '+((inv&&inv.got.size)||0)+' / '+((inv&&inv.need.size)||0); }
function collectFragment(key){ if(!inv||!inv.need.has(key)||inv.got.has(key)) return; inv.got.add(key);
  try{ window.CabinRoom.setFragmentCollected(key); }catch(e){}
  const f=FRAG_LINES[key]||''; const rv=el('fragReveal'); if(rv){ rv.textContent=f; rv.classList.add('show'); setTimeout(()=>rv.classList.remove('show'), 3600); }
  try{ if(window.__skipChime) window.__skipChime(inv.got.size); }catch(e){}
  updateFragBar(); if(inv.got.size>=inv.need.size) setTimeout(exitInvestigate, 1500); }
function exitInvestigate(){ const d=inv&&inv.done; document.body.classList.remove('story-investigate');
  try{ window.CabinRoom.hideFragments(); }catch(e){} inv=null; el('fragReveal') && el('fragReveal').classList.remove('show');
  if(d){ el('sbName').textContent=''; el('sbText').style.fontStyle='italic'; el('sbText').textContent=d; }
  locked=false; setTimeout(()=>step(), d?1600:200); }
```
`FRAG_LINES`（断片の気づき）:
```js
const FRAG_LINES={
  fire:'消えない焚き火。薪は絶えず、灰の底に、いつも次の火種がある。……誰かが、ずっと継いできた。',
  tea:'冷めない茶が、一杯。あなたが来るのを、知っていたみたいに。ずっと、あたたかいまま。',
  chair:'火を挟んで、椅子がふたつ。ひとつは灯里、ひとつは蒼。……最初から、ふたつ。',
  clock:'古い時計は、止まっている。針はいつも同じ刻。……"その夜"で、時間が止まったみたいに。',
  tally:'柱に、いくつもの小さな刻み。名前ではなく——ここで救われて、旅立った人の、数だけ。',
  snow:'窓の外の雪。入ってきた足跡は、ひとつ。……出ていった足跡は、どこにもない。',
};
```
`collectFragment`/`exitInvestigate` を `window.CabinStory` に公開。

- [ ] **Step 2: STORY 7章を実装（全文・プレースホルダ禁止）**
構成と**必須の crux 台詞**（連結の地の文は同トーンで補筆可、crux は原文どおり）:
- **ch1 灯る**（bgm ch1）: 目覚め→灯里/蒼の自己紹介（v1の温かい導入を流用・短縮）→「この小屋、なにかが変」→ `{investigate:{prompt:'小屋を調べる',need:['fire','tea','chair','clock','tally','snow'],done:'——誰かが、あなたのために、火を絶やさずにいてくれた。二人のことを、もっと知りたい。'}}`→灯里「わたしたちのこと……聞いてくれる?」→end。
- **ch2 蒼のかけら**（bgm ame）: 蒼が語る。母の看病の日々／手放した学校・友・夢／眠れぬ夜。crux: 蒼「ぼくの世界は、母さんの部屋の、あの窓だけになっていった。」 選択（そっと寄り添う/黙って聞く）。end。
- **ch3 蒼の夜**（bgm minasoko）: crux（原文厳守）: 蒼「その夜、ぼくは……疲れて、眠ってしまったんだ。母さんが呼ぶ声に、気づかないまま。」／蒼「朝、母さんは冷たくなっていた。ぼくは、間に合わなかった。」／蒼「——ううん、ちがう。ほんとうの罪は、それじゃない。」／蒼「亡骸を見つけたとき……悲しみの底で、ぼくは、ほっとしたんだ。『やっと、終わった。やっと、眠れる』って。」／蒼「母さんが死んで、安心した。ぼくは、化け物だ。」→雪山へ。選択（否定しない/そっと手を伸ばす）→end。
- **ch4 灯里のかけら**（bgm utsuroi）: 灯里が語る。強く笑う姉／弱音を隠す癖／幼い弟に「強くね、笑ってね、人に迷惑をかけないで」。crux: 灯里「わたしが笑っていれば、みんな安心した。だから、ずっと笑ってた。」 end。
- **ch5 灯里の夜**（bgm shiroi-door）: crux（原文厳守）: 灯里「弟はね、わたしの真似をしたの。つらくても笑って、なんでもないふりをして。」／灯里「ある朝、あの子は、目を覚まさなかった。ずっと、ひとりで抱えてたのに——わたしは、何も気づかなかった。」／灯里「わたしの笑顔が、あの子に『隠すこと』を教えたの。すぐそばにいたのに。わたしは、自分の弟に……間に合わなかった。」→雪山へ→end。
- **ch6 秘密**（bgm sorekara）: 二人が同じ雪の夜に、この火のそばで出会った。互いに「消えちゃおうと思った」と打ち明ける。**赦し合い（原文厳守）**: 灯里→蒼「何年も、たったひとりで母さんを愛したんでしょう。その果ての『ほっとした』は……罪じゃないよ。体は、こわれる。眠ってしまったのは、殺意じゃない。」／蒼→灯里「見えなかったことは、そうさせたことじゃない。弟くんが隠したのは、君の笑顔のせいじゃない。……君の笑顔は、ほんとうに、あの子を愛してた証だよ。」／灯里「自分では、どうしても赦せなかった。……でも、この人になら、赦してもらえた。」／蒼「前の灯守が、ぼくらのために火を灯してくれてた。その人も、消えるつもりで、ここへ来た人だった。」→止まった時計＝二人が出会った刻。灯里「火が、弱ってきてる。……わたしたちの番が、終わろうとしてる。」→end。
- **ch7 継ぐ**（bgm kizuna）: 「あなたにも、言えない夜があったでしょう。」→「この火を、継いでくれる?」→選択（継ぐ/わたしなんかに→蒼が背を押す→継ぐ）→`{fx:'flareFire'}`→灯里/蒼の感謝→「ぼくらは、ずっとこの火の中にいる」→`{fx:'dissolveGuides'}`→地の文→`{fx:'fadeEnding'}`→end。

- [ ] **Step 3: 章遷移で unlocked/BGM更新**（`startChapter` 拡張）
`STORY` を配列化 `CH=['ch1'..'ch7']`；各章 `{title,bgm,beats}`。`nextChapterOrEnd`＝`st.ch<6? ch++ : ending`。`startChapter` で `st.unlocked=Math.max(st.unlocked,st.ch)`＋`setBGM(c.bgm)`。

- [ ] **Step 4: 検証 + commit**
Playwright: ch1で investigate 起動→3D断片6個クリック→過去編解錠→ch2..ch7 通し→エンディング。各章BGM切替＋fragments収集＋lit加算を assert。check_dup_const exit 0。
```bash
cd "C:/projects/yuichi916.github.io" && python C:/tmp/check_dup_const.py cabin.html && git add cabin.html && git commit -m "feat(cabin): full 7-chapter story v2 (Sou & Tomori backstories, memory-fragment investigation, mutual absolution)"
```

---

### Task 4: 章セレクト＋セーブUI

**Files:** Modify `cabin.html`（`#chapterSelect` DOM＋CSS、`openChapterSelect()`/`startChapter(idx)`、ゲート/HUD配線）

- [ ] **Step 1: #chapterSelect DOM（ゲート `#enterGate` 内、`gate-sub` の後）**
```html
<div id="chapterSelect" hidden>
  <div class="cs-title">灯を継ぐもの ―七つの夜―</div>
  <div class="cs-sub" id="csProgress"></div>
  <div class="cs-list" id="csList"></div>
  <div class="cs-actions">
    <button type="button" id="csResume">つづきから</button>
    <button type="button" id="csRestart">最初から</button>
    <button type="button" id="csClose">とじる</button>
  </div>
  <div class="cs-credit">♪ 物語音楽: 君の音。(真島こころ)『映画風ピアノ音楽素材集 vol.2 水のうつろい』</div>
</div>
```

- [ ] **Step 2: CSS（章セレクト盤・羊皮紙トーン）**
```css
#chapterSelect{position:fixed;inset:0;z-index:85;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;
  background:radial-gradient(ellipse at 50% 40%,rgba(30,24,17,.94),rgba(12,10,7,.98));font-family:"Shippori Mincho",serif;color:#efe6d4;padding:24px}
#chapterSelect.open{display:flex}
#chapterSelect .cs-title{font-size:clamp(20px,3.4vw,30px);letter-spacing:.12em;color:#f0d9a6}
#chapterSelect .cs-sub{font-size:.82rem;opacity:.7}
#chapterSelect .cs-list{display:flex;flex-direction:column;gap:8px;width:min(460px,92vw);max-height:52vh;overflow:auto}
.cs-item{display:flex;align-items:center;gap:12px;padding:11px 16px;border-radius:10px;border:1px solid rgba(201,180,140,.3);
  background:rgba(240,225,190,.05);cursor:pointer;transition:.2s;text-align:left;font-size:.95rem;color:#efe6d4}
.cs-item:hover:not(.locked){background:rgba(240,200,120,.13);border-color:rgba(240,200,120,.5)}
.cs-item.locked{opacity:.4;cursor:not-allowed}
.cs-item .cs-no{color:#c9b98a;font-size:.8rem;min-width:2.4em}
.cs-item .cs-mark{margin-left:auto;font-size:.9rem;opacity:.8}
.cs-actions{display:flex;gap:10px;margin-top:6px;flex-wrap:wrap;justify-content:center}
.cs-actions button{font-family:"Shippori Mincho",serif;padding:9px 20px;border-radius:99px;background:rgba(240,225,190,.08);
  border:1px solid rgba(201,180,140,.4);color:#efe6d4;cursor:pointer;font-size:.9rem}
.cs-actions button:hover{background:rgba(240,200,120,.14)}
#chapterSelect .cs-credit{font-size:.62rem;opacity:.45;margin-top:8px;text-align:center;max-width:90vw}
```

- [ ] **Step 3: openChapterSelect() ＋ startChapter(idx)（CabinStory）**
```js
const CH_TITLES=['一章 灯る','二章 蒼のかけら','三章 蒼の夜','四章 灯里のかけら','五章 灯里の夜','六章 秘密','七章 継ぐ'];
function openChapterSelect(){ _load(); const list=el('csList'); if(!list) return; list.innerHTML='';
  const maxu = st.cleared?6:(st.unlocked||0);
  CH_TITLES.forEach((tt,i)=>{ const it=document.createElement('button'); it.type='button'; it.className='cs-item'+(i>maxu?' locked':'');
    const mark = st.cleared?'✓' : (i<st.ch?'✓' : i===st.ch?'▸' : i>maxu?'🔒':'');
    it.innerHTML='<span class="cs-no">'+['①','②','③','④','⑤','⑥','⑦'][i]+'</span><span>'+tt+'</span><span class="cs-mark">'+mark+'</span>';
    if(i<=maxu) it.addEventListener('click',()=>{ el('chapterSelect').classList.remove('open'); el('chapterSelect').hidden=true; $('#enterGate') && $('#enterGate').classList.add('gone'); startChapter(i,0,true); });
    list.appendChild(it); });
  el('csProgress').textContent = st.cleared?('物語を見届けた · あなたが灯した灯 '+st.lit):('あなたが灯した灯 : '+st.lit);
  el('chapterSelect').hidden=false; el('chapterSelect').classList.add('open'); }
```
`startChapter(idx, fromBeat, openStory)`: `st.ch=idx; st.beat=fromBeat||0;` open()（story-mode）→BGM→再生。`resume`/`start` は openChapterSelect 経由に統一（従来の直起動も残す）。

- [ ] **Step 4: 配線（ゲート/HUDボタン→章セレクト）**
`#storyStartGate` と HUD `#storyStart` のクリックを `openChapterSelect()` に。`#csResume`=保存位置から（`st.ch,st.beat`）、`#csRestart`=`start(true)`、`#csClose`=閉じる。断片は `st.fragments` で既収集ならスキップ（investigate開始時 got に反映）。

- [ ] **Step 5: 検証 + commit**
Playwright: ゲート→章セレクト表示（解放済み✓/現在▸/未解放🔒）→三章まで進め保存→リロード→「つづきから」で三章復元／②をクリックで頭出し／クリア後全解放。check_dup_const exit 0。
```bash
cd "C:/projects/yuichi916.github.io" && python C:/tmp/check_dup_const.py cabin.html && git add cabin.html && git commit -m "feat(cabin): chapter-select board on gate + save/resume (unlocked chapters, jump, progress)"
```

---

### Task 5: エンディング拡張（7章の重み・光射すBGM）

**Files:** Modify `cabin.html`（`_storyFx('fadeEnding')`/`_storyEnding`）

- [ ] **Step 1: fadeEnding で BGM を story-hikari にクロスフェード＋締め文を7章版に**
`_storyFx('fadeEnding')`: `setBGM('story-hikari.mp3')`（フェード）後に暗転。`_storyEnding(lit)` の締め文（v1を基に、7章の重みを受けた一文を追加）:
```
あなたにも、誰にも言えない夜があった。
けれど、ここでは、誰かがその罪ごと、あなたを赦してくれた。
今度は——あなたが、火のそばで、次の誰かを待つ番。
— あなたが灯した、小さな灯 : N —
（やがて、また誰かが、雪をかき分けてやってくる。その時、この火は、きっとあたたかい。）
♪ 物語音楽: 君の音。(真島こころ)『映画風ピアノ音楽素材集 vol.2 水のうつろい』
[火のそばへ戻る]
```
`st.cleared=true; st.unlocked=6; _save()`。「火のそばへ戻る」で close→lookFire。

- [ ] **Step 2: 検証 + commit**
Playwright: ch7 継ぐ→flare→dissolve→fadeEnding（hikari再生）→締め画面（7章版文＋灯数＋クレジット＋戻る）。cleared/unlocked=6。check_dup_const exit 0。
```bash
cd "C:/projects/yuichi916.github.io" && python C:/tmp/check_dup_const.py cabin.html && git add cabin.html && git commit -m "feat(cabin): 7-chapter ending (hikari BGM crossfade, absolution-themed closing)"
```

---

### Task 6: 通し検証・デプロイ・本番確認

- [ ] **Step 1: 通しPlaywright（swiftshader, HTTP :8377）**
章セレクト→①灯る→**3D断片6個収集**→②〜⑤過去編→⑥秘密（赦し）→⑦継ぐ→エンディング。assert: 8トラックのBGM切替（ch1/ame/minasoko/utsuroi/shiroi-door/sorekara/kizuna/hikari）、fragments 6/6、lit加算、cleared、締め文＋クレジット＋灯数、pageerror 0。スクショ: 断片探索/⑥赦し/⑦エンディング。
- [ ] **Step 2: 感情の要を実機スクショで目視吟味**（断片が実オブジェクトに乗る／⑥赦しの対話／⑦エンディング）。妥協しない。
- [ ] **Step 3: セーブ/章セレクト検証**（保存→リロード→つづき／章ジャンプ／クリア後全解放／v1保存からの後方互換）。
- [ ] **Step 4: デプロイ＋本番確認**
```bash
cd "C:/projects/yuichi916.github.io" && git push origin main
```
Pages built 確認（`gh api ...pages/builds/latest`、詰まれば `-X POST .../pages/builds`）→本番URLで通しスモーク再実行（BGM 8本配信込み）→ユーザーへ最終報告（7章・断片謎解き・章セレクト＋セーブ・二人の過去・号泣エンディング・BGM＋クレジット）。

---

## Self-Review（実施済み）
1. Spec coverage: §3アーク=Task3全7章。§4断片メカ（実3D位置）=Task2＋Task3 investigate。§5章選択＋セーブ=Task1(schema)+Task4(UI)。§6 BGM=Task1抽出＋各章割当。§7コード構造=Task2-5。§8エラー処理=try/catch＋fragmentGroup無し時フォールバック（Task2/3）。§9検証=Task6。§10不変条件=非破壊・後方互換。
2. Placeholder scan: BGM実ファイル名確定、断片初期方位は数値ありで_probe較正（Task2 Step6）、crux台詞は原文記載。ffmpegパスのフォールバック明記。プレースホルダ無し。
3. Type consistency: `CabinRoom.showFragments/hideFragments/setFragmentCollected/_probe`、`onMarker('frag:'+key)`、`CabinStory.collectFragment/exitInvestigate`、`st={ch,beat,lit,fragments,unlocked,cleared}`、Beat型 `{investigate:{prompt,need,done}}`/`{fragment:{key,line}}`、`CH`/`CH_TITLES` 7要素、BGMファイル名が Task間・§6一致。話者色一貫。
