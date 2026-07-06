# cabin 物語モード「灯を継ぐもの」実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** cabin.html に、灯里・蒼と「小屋の謎」を解く3章の選択肢対話ADV「物語モード」を、既存の360°小屋を非破壊で活かして追加し、エンディングで感動を届ける。

**Architecture:** 単一 cabin.html に自己完結モジュールを追加。台本を `STORY`(JSデータ)、進行を `StoryEngine`(IIFE)、描画を `#story` オーバーレイDOM+CSS。既存の焚き火・環境音・パノラマ・瞑想・掛け合いゲートは非破壊。

**Tech Stack:** バニラJS(既存cabin.html流儀)、CSS、localStorage、HTMLAudio、既存 `window.CabinRoom` API。

## Global Constraints
- 単一ファイル cabin.html に追記。**commit前 `python C:/tmp/check_dup_const.py cabin.html` が exit 0**。
- 既存の瞑想/環境音/BGM/マーカー/掛け合いゲート/i18n/訪問カウントは非破壊。
- 立ち絵: `assets/guide-witch.png`=灯里 / `assets/guide-boy.png`=蒼。話者色: 灯里 `#f0d6e0` / 蒼 `#cfe0f4`。
- BGM: `assets/bgm/story-ch1-yoru-no-hotori.mp3` / `story-ch2-minasoko.mp3` / `story-ch3-kizuna.mp3`(音量0.42, loop)。
- クレジット必須: 「♪ 物語音楽: 君の音。(真島こころ)『映画風ピアノ音楽素材集 vol.2 水のうつろい』」。
- localStorage キー `cabin_story = {ch, beat, lit, cleared}`。
- どの選択でもエンディング到達(分岐で詰ませない)。Conventional Commits。

---

### Task 1: 物語オーバーレイの骨格 + 起動ボタン + HUD隠し

**Files:** Modify `cabin.html`(`</body>`直前にDOM、`<style>`にCSS、`#enterGate`と`#hud`にボタン)

**Produces:** `#story` レイヤー、`#storyStart` ボタン(ゲート+HUD)、`body.story-mode` でHUD/reticle/マーカー非表示、`#story-bgm` audio。

- [ ] **Step 1: DOM追加**（`</body>` 直前、既存 `#caption` の近く）
```html
<audio id="story-bgm" loop preload="none"></audio>
<div id="story" aria-hidden="true">
  <img class="story-guide sg-left"  id="sgBoy"  src="assets/guide-boy.png"   alt="蒼" onerror="this.style.display='none'">
  <img class="story-guide sg-right" id="sgGirl" src="assets/guide-witch.png" alt="灯里" onerror="this.style.display='none'">
  <div class="story-look" id="storyLook" hidden></div>
  <div class="story-box" id="storyBox">
    <div class="sb-name" id="sbName"></div>
    <div class="sb-text" id="sbText"></div>
    <div class="sb-choices" id="sbChoices"></div>
    <div class="sb-hint" id="sbHint">▸ クリック / Space</div>
  </div>
  <div class="story-fx" id="storyFx" hidden></div>
  <button class="story-quit" id="storyQuit" aria-label="物語をとじる">✕</button>
</div>
```

- [ ] **Step 2: 起動ボタンをゲートとHUDに追加**
ゲート(`<span class="gate-enter">中へ入る</span>` の直後):
```html
  <span class="gate-story" id="storyStartGate" role="button" tabindex="0">小屋の謎をとく · a tale to unravel</span>
```
HUD(`id="hud"` 内、`musicBtn` の並び付近の適切な場所):
```html
      <button type="button" class="hud-btn" id="storyStart">✦ <span>物語</span></button>
```

- [ ] **Step 3: CSS追加**（既存 `<style>` 末尾付近）
```css
#story{position:fixed;inset:0;z-index:90;opacity:0;visibility:hidden;transition:opacity .6s;pointer-events:none}
body.story-mode #story{opacity:1;visibility:visible;pointer-events:auto}
body.story-mode #hud,body.story-mode #reticle,body.story-mode #lookHint2{opacity:0;pointer-events:none}
.story-guide{position:fixed;bottom:0;height:min(66vh,560px);width:auto;opacity:.28;
  filter:drop-shadow(0 6px 26px rgba(0,0,0,.6)) saturate(.85);transition:opacity .5s,filter .5s;pointer-events:none;z-index:1}
.sg-left{left:clamp(0px,3vw,60px)}.sg-right{right:clamp(0px,3vw,60px)}
.story-guide.talk{opacity:.98;filter:drop-shadow(0 6px 30px rgba(255,220,150,.35))}
.story-box{position:fixed;left:50%;bottom:0;transform:translateX(-50%);width:min(720px,94vw);
  margin:0 auto 3vh;padding:26px 30px 20px;border-radius:14px;z-index:2;
  background:linear-gradient(180deg,rgba(28,24,18,.9),rgba(20,16,11,.94));border:1px solid rgba(201,180,140,.3);
  box-shadow:0 10px 40px rgba(0,0,0,.5);font-family:"Shippori Mincho",serif}
.sb-name{font-size:.86rem;letter-spacing:.14em;margin-bottom:10px;color:#e9dfce;opacity:.9}
.sb-text{color:#efe6d4;line-height:2.0;font-size:clamp(15px,1.9vw,18px);min-height:3.2em}
.sb-choices{display:flex;flex-direction:column;gap:10px;margin-top:16px}
.sb-choices button{font-family:"Shippori Mincho",serif;text-align:left;padding:12px 16px;border-radius:10px;
  background:rgba(240,225,190,.06);border:1px solid rgba(201,180,140,.35);color:#efe6d4;cursor:pointer;
  font-size:.96rem;line-height:1.6;transition:.2s}
.sb-choices button:hover{background:rgba(240,200,120,.14);border-color:rgba(240,200,120,.6)}
.sb-hint{margin-top:12px;font-size:.72rem;color:#c9bfa8;opacity:.55;text-align:right}
.sb-hint.gone{opacity:0}
.story-look{position:fixed;inset:0;z-index:1}
.look-spot{position:absolute;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;cursor:pointer;
  background:radial-gradient(circle,rgba(255,220,150,.5),rgba(255,220,150,0) 70%);animation:lookPulse 1.8s ease-in-out infinite}
.look-spot.done{animation:none;opacity:.2;pointer-events:none}
@keyframes lookPulse{0%,100%{transform:scale(.85);opacity:.55}50%{transform:scale(1.15);opacity:1}}
.story-fx{position:fixed;inset:0;z-index:3;background:#000;opacity:0;transition:opacity 1.4s;
  display:flex;align-items:center;justify-content:center;pointer-events:none}
.story-fx.black{opacity:1}
.story-fx .fx-lines{max-width:640px;padding:0 30px;text-align:center;color:#f3ead6;font-family:"Shippori Mincho",serif;
  line-height:2.4;font-size:clamp(16px,2.1vw,20px);opacity:0;transition:opacity 2s}
.story-fx.show-lines .fx-lines{opacity:1}
.story-quit{position:fixed;top:16px;right:16px;z-index:4;width:40px;height:40px;border-radius:50%;
  background:rgba(30,24,16,.7);border:1px solid rgba(201,180,140,.4);color:#e9dfce;cursor:pointer;font-size:15px}
.gate-story{margin-top:20px;font-family:"Shippori Mincho",serif;font-size:clamp(12px,1.7vw,15px);
  letter-spacing:.14em;color:#c9b98a;cursor:pointer;opacity:.82;transition:.3s;border-bottom:1px solid rgba(201,180,140,.3);padding-bottom:3px}
.gate-story:hover{color:#f0d9a6;opacity:1}
```

- [ ] **Step 4: 検証 + commit**
Run: `python C:/tmp/check_dup_const.py "C:/projects/yuichi916.github.io/cabin.html"` → exit 0。
Playwright: ゲートで `#storyStartGate` が見える。`document.body.classList.add('story-mode')` で `#story` が可視・`#hud` が不可視になる(computed opacity)。
```bash
cd "C:/projects/yuichi916.github.io" && git add cabin.html && git commit -m "feat(cabin): story-mode overlay scaffold + start buttons + hud hiding"
```

---

### Task 2: 台本データ STORY(全3章)+ StoryEngine コア

**Files:** Modify `cabin.html`(メインscript内、`window.onMarker` 定義の近くに追加)

**Consumes:** Task 1 の DOM(`#story` 系 id)。
**Produces:** `const STORY`(3章の完全な台本)、`window.CabinStory = { start(fresh), resume(), advance(), choose(i), lookSpot(key), _save(), _load() }`。

- [ ] **Step 1: 台本 STORY を実装**（**全文・プレースホルダ禁止**。Beat型: `{say,text}` / `{choose:[{label,reply:[...]}]}` / `{look:{prompt,spots:[{key,label,line}],done}}` / `{fx}` / `{end}`）

```js
/* ============ 物語モード「灯を継ぐもの」============ */
const STORY = {
  ch1: { title:'一章 灯る', bgm:'story-ch1-yoru-no-hotori.mp3', beats:[
    {say:'narr', text:'——気づくと、あなたは知らない小屋の中にいた。'},
    {say:'narr', text:'暖炉で火が燃えている。乾いた薪がぱちりとはぜて、火の粉が舞いあがる。'},
    {say:'tomori', text:'「……あ。目が、さめた?」'},
    {say:'sou', text:'「よかった。ずいぶん、冷えてたから。」'},
    {say:'tomori', text:'「わたしは灯里(ともり)。この小屋で、火を守ってるの。」'},
    {say:'sou', text:'「ぼくは蒼(そう)。……ふたりで、ここにいるんだ。」'},
    {say:'tomori', text:'「あなた、雪の中を歩いてきたでしょう。……どうして?」'},
    {choose:[
      {label:'「……わからない。ただ、どこか遠くへ行きたかった」', reply:[
        {say:'sou', text:'「うん。……遠くへ、ね。ぼくも、そうだった。」'},
        {say:'tomori', text:'「ここまで来たなら、もう歩かなくていいよ。」'},
      ]},
      {label:'「消えてしまいたかったのかもしれない」', reply:[
        {say:'tomori', text:'「……そっか。」'},
        {say:'tomori', text:'「その言葉、わたしも、昔ここで言ったの。」'},
        {say:'sou', text:'「……。」'},
      ]},
      {label:'何も言わず、火を見つめる', reply:[
        {say:'sou', text:'「……いいよ。無理に、話さなくて。」'},
        {say:'tomori', text:'「火は、だまってても、あたためてくれるから。」'},
      ]},
    ]},
    {say:'narr', text:'——ふと、部屋の様子に目がとまる。'},
    {look:{ prompt:'小屋を見回してみる', done:'——誰かが、あなたが来るのを、知っていたみたいに。', spots:[
      {key:'tea',   label:'湯気を立てる茶',   line:'小卓に、あたたかい茶が一杯。まるで、あなたのために。'},
      {key:'chair', label:'ふたつの椅子',     line:'火を挟んで、椅子がふたつ。……最初から、ふたつ。'},
      {key:'snow',  label:'窓の外の雪',       line:'外は静かな雪。足跡は、もう消えかけている。'},
    ]}},
    {say:'tomori', text:'「気づいた? この小屋の火はね、ずっと消えないの。」'},
    {say:'sou', text:'「道に迷った人が来たとき、いつでもあたたかいように。」'},
    {say:'tomori', text:'「……ねえ。もう少し、いっしょにいてくれる?」'},
    {end:true},
  ]},
  ch2: { title:'二章 秘密', bgm:'story-ch2-minasoko.mp3', beats:[
    {say:'narr', text:'火のそばで、蒼が、ぽつりと話しはじめた。'},
    {say:'sou', text:'「……ぼくもね、雪の夜に、ここに来たんだ。」'},
    {say:'sou', text:'「もう、どこにも居場所がなくて。消えるつもりで、森に入った。」'},
    {say:'tomori', text:'「わたしも。同じ夜だった。」'},
    {say:'tomori', text:'「凍えて、たどり着いたら……火が、燃えてたの。茶が、一杯あったの。」'},
    {say:'sou', text:'「火を挟んで、はじめて会った。おたがい、同じ目をしてた。」'},
    {say:'tomori', text:'「わたし、言ったの。『消えちゃおうと思って、ここまで来た』って。」'},
    {say:'sou', text:'「ぼくは、息を呑んだ。……それ、ぼくが誰にも言えなかった言葉だったから。」'},
    {choose:[
      {label:'「……その言葉、わたしにも、わかる気がする」', reply:[
        {say:'tomori', text:'「うん。……わかってくれる人が、いるだけで。」'},
        {say:'sou', text:'「凍えた心が、少しだけ、ほどけるんだ。」'},
      ]},
      {label:'「ふたりは、それから、どうなったの?」', reply:[
        {say:'sou', text:'「朝まで、火を見てた。ただ、それだけ。」'},
        {say:'tomori', text:'「でも、朝が来たとき……歩いてみようって、思えたの。」'},
      ]},
    ]},
    {say:'tomori', text:'「この火は、前の灯守が、わたしたちのために灯してくれてた。」'},
    {say:'sou', text:'「その人は、ぼくらが来た朝、静かに旅立った。役目を、渡すみたいに。」'},
    {say:'narr', text:'——もう一度、小屋を見回す。今度は、ちがって見える。'},
    {look:{ prompt:'ふたりの面影をさがす', done:'——ふたりは、ずっと、次の誰かのために火を守ってきた。', spots:[
      {key:'cups',  label:'古い茶碗の数',   line:'棚に、いくつもの茶碗。ここで救われた人の、数だけ。'},
      {key:'names', label:'柱の小さな印',   line:'柱に、小さな刻み。名前ではなく、通り過ぎた温もりの記録。'},
      {key:'fire2', label:'絶えない焚き火', line:'火は、一度も消えていない。誰かが、ずっと継いできたから。'},
    ]}},
    {say:'tomori', text:'「ねえ。……気づいてる? 火が、少し弱いこと。」'},
    {say:'sou', text:'「ぼくらが、そろそろ……旅立つ時なんだ。」'},
    {end:true},
  ]},
  ch3: { title:'三章 継ぐ', bgm:'story-ch3-kizuna.mp3', beats:[
    {say:'tomori', text:'「わたしたちも、いつまでも、ここにはいられないの。」'},
    {say:'sou', text:'「救われた者は、いつか、次の誰かのために火を継ぐ。」'},
    {say:'tomori', text:'「そうして、この火は、消えずに続いてきた。」'},
    {say:'sou', text:'「……あなたが来てくれたのは、きっと、そういうことなんだと思う。」'},
    {say:'tomori', text:'「ねえ。——この火を、継いでくれる?」'},
    {say:'narr', text:'火が、あなたの答えを待っている。'},
    {choose:[
      {label:'「うん。……わたしが、火を継ぐ」', reply:[
        {say:'tomori', text:'「……ありがとう。」'},
      ]},
      {label:'「わたしなんかに、できるのかな」', reply:[
        {say:'sou', text:'「だいじょうぶ。あなたは、もう火のそばに座れた。」'},
        {say:'tomori', text:'「凍えた人の気持ちが、わかるでしょう? それだけで、いいの。」'},
        {say:'tomori', text:'「……継いでくれる?」'},
        {say:'you', text:'「……うん。継ぐ。」'},
      ]},
    ]},
    {say:'narr', text:'あなたが火に手をかざすと、焚き火が、大きく燃えあがった。'},
    {fx:'flareFire'},
    {say:'tomori', text:'「あったかいでしょう。……これが、あなたの火。」'},
    {say:'sou', text:'「もう、ひとりじゃないよ。誰かが、火を灯して待っててくれる。」'},
    {say:'tomori', text:'「そして今度は、あなたが……次の、道に迷った誰かのために。」'},
    {say:'sou', text:'「ぼくらは、ずっと、この火のなかにいるから。」'},
    {say:'tomori', text:'「……ありがとう。やっと、安心して、旅立てる。」'},
    {fx:'dissolveGuides'},
    {say:'narr', text:'灯里と蒼は、やわらかい光になって、火のなかへ溶けていった。'},
    {fx:'fadeEnding'},
    {end:true},
  ]},
};
```

- [ ] **Step 2: StoryEngine コアを実装**（描画・送り・選択・stack合流・保存）

```js
window.CabinStory = (function(){
  const box=()=>document.getElementById('storyBox');
  const el=id=>document.getElementById(id);
  const CH=['ch1','ch2','ch3'];
  let st={ch:0, beat:0, lit:0, cleared:false};
  let stack=[];            // 選択reply中の合流用: 現在再生中のBeat配列とindex
  let cur=null;            // {beats,i}
  const LS='cabin_story';

  function _save(){ try{ localStorage.setItem(LS, JSON.stringify(st)); }catch(e){} }
  function _load(){ try{ const s=JSON.parse(localStorage.getItem(LS)||'null'); if(s&&s.ch!=null) st=s; }catch(e){} }

  function setBGM(file){
    const a=el('story-bgm'); if(!a) return;
    if(a.dataset.file===file) return;
    a.dataset.file=file; a.src='assets/bgm/'+file; a.volume=0.42;
    a.play().catch(()=>{});
  }
  function stopExistingMusic(){ /* 既存BGMを止める */
    document.querySelectorAll('#musicPanel .mp-track.on').forEach(b=>{ try{ b.click(); }catch(e){} });
  }

  function open(){
    document.body.classList.add('story-mode');
    el('story').setAttribute('aria-hidden','false');
    stopExistingMusic();
  }
  function close(){
    document.body.classList.remove('story-mode');
    el('story').setAttribute('aria-hidden','true');
    const a=el('story-bgm'); if(a){ a.pause(); a.dataset.file=''; }
  }

  function talk(who){
    el('sgGirl').classList.toggle('talk', who==='tomori');
    el('sgBoy').classList.toggle('talk', who==='sou');
  }
  const NAME={tomori:'灯里', sou:'蒼', narr:'', you:'あなた'};

  function render(b){
    el('sbChoices').innerHTML=''; el('storyLook').hidden=true; el('storyLook').innerHTML='';
    el('sbHint').classList.remove('gone');
    if(b.say!=null){
      talk(b.say);
      el('sbName').textContent=NAME[b.say]||'';
      el('sbText').textContent=b.text;
      el('sbText').style.color = b.say==='tomori'?'#f7e7ec' : b.say==='sou'?'#e6eefa' : '#efe6d4';
    } else if(b.choose){
      el('sbHint').classList.add('gone');
      b.choose.forEach((c,i)=>{ const btn=document.createElement('button'); btn.textContent=c.label;
        btn.addEventListener('click',()=>choose(i)); el('sbChoices').appendChild(btn); });
    } else if(b.look){
      el('sbName').textContent=''; el('sbText').textContent=b.look.prompt; el('sbHint').classList.add('gone');
      renderLook(b.look);
    } else if(b.fx){ runFx(b.fx); }
  }

  function step(){
    if(!cur){ return; }
    if(cur.i>=cur.beats.length){                 // 現配列おわり
      if(stack.length){ cur=stack.pop(); return step(); }   // reply合流→本流の続き
      return nextChapterOrEnd();
    }
    const b=cur.beats[cur.i++];
    if(b.end){ if(stack.length){cur=stack.pop(); return step();} return nextChapterOrEnd(); }
    render(b);
    // 選択/観察/fx は入力待ち or 自動。台詞はクリックで advance。
    if(b.choose){ /* wait for choose() */ }
    else if(b.look){ /* wait for all spots */ }
    else if(b.fx){ /* fx自身が進める or クリック */ if(b.fx==='fadeEnding'){ /* エンディングへ */ } }
    st.beat=cur.i; _save();
  }

  function advance(){ // 台詞送り(クリック/Space)
    const cheating=el('sbChoices').children.length || !el('storyLook').hidden;
    if(cheating) return;             // 選択/観察中は送らない
    step();
  }
  function choose(i){
    st.lit++; _save();
    const b=cur.beats[cur.i-1];
    const rep=b.choose[i].reply||[];
    stack.push(cur);                 // 本流を退避
    cur={beats:rep, i:0};
    step();
  }

  function renderLook(look){
    const layer=el('storyLook'); layer.hidden=false; layer.innerHTML='';
    let remaining=look.spots.length;
    const POS=[{l:'42%',t:'56%'},{l:'27%',t:'52%'},{l:'70%',t:'40%'}];
    look.spots.forEach((sp,idx)=>{
      const d=document.createElement('div'); d.className='look-spot';
      d.style.left=POS[idx%3].l; d.style.top=POS[idx%3].t; d.title=sp.label;
      d.addEventListener('click',()=>{
        if(d.classList.contains('done')) return;
        d.classList.add('done');
        el('sbName').textContent=''; el('sbText').textContent=sp.line;
        if(--remaining===0){ setTimeout(()=>{ el('sbText').textContent=look.done;
          el('storyLook').hidden=true; setTimeout(()=>step(), 1400); }, 1200); }
      });
      layer.appendChild(d);
    });
  }

  function nextChapterOrEnd(){
    if(st.ch < CH.length-1){ st.ch++; st.beat=0; _save(); startChapter(); }
    else { ending(); }
  }
  function startChapter(){
    const c=STORY[CH[st.ch]]; setBGM(c.bgm);
    cur={beats:c.beats, i:st.beat||0}; stack=[]; step();
  }
  function start(fresh){
    if(fresh){ st={ch:0,beat:0,lit:0,cleared:false}; }
    open(); startChapter();
  }
  function resume(){ _load(); open(); startChapter(); }

  /* fx と ending は Task 5 で実装 */
  function runFx(kind){ if(window._storyFx) window._storyFx(kind); else step(); }
  function ending(){ if(window._storyEnding) window._storyEnding(st.lit); }

  el('storyBox') && document.getElementById('story').addEventListener('click', e=>{
    if(e.target.closest('.sb-choices')||e.target.closest('.look-spot')||e.target.closest('#storyQuit')) return;
    advance();
  });
  document.addEventListener('keydown', e=>{ if(document.body.classList.contains('story-mode') && (e.key===' '||e.key==='Enter'||e.key==='ArrowRight')){ e.preventDefault(); advance(); }});
  el('storyQuit') && el('storyQuit').addEventListener('click', close);

  return { start, resume, close, _state:()=>st, _save, _load };
})();
```

- [ ] **Step 3: 起動ボタン配線**（メインscript内、DOMContentLoaded系の初期化付近）
```js
(function wireStory(){
  const has=()=>{ try{ const s=JSON.parse(localStorage.getItem('cabin_story')||'null'); return s&&(s.ch>0||s.beat>0); }catch(e){ return false; } };
  function launch(){ if(has()) window.CabinStory.resume(); else window.CabinStory.start(true); }
  document.getElementById('storyStartGate')?.addEventListener('click', e=>{ e.stopPropagation();
    document.getElementById('enterGate')?.classList.add('gone'); launch(); });
  document.getElementById('storyStart')?.addEventListener('click', e=>{ e.stopPropagation(); launch(); });
})();
```

- [ ] **Step 4: 検証 + commit**
Playwright: `#storyStartGate` クリック→第一章の最初のセリフ「——気づくと…」が `#sbText` に出る。クリック連打で灯里→蒼→…と進む。選択肢が3つ出て、選ぶと reply→本流合流。`sbName` が話者名に、`.talk` が話者側に付く。
```bash
cd "C:/projects/yuichi916.github.io" && python C:/tmp/check_dup_const.py cabin.html && git add cabin.html && git commit -m "feat(cabin): STORY script (3 chapters) + StoryEngine core (dialogue/choice/observe)"
```

---

### Task 3: エンディング演出 fx + クリア画面 + クレジット

**Files:** Modify `cabin.html`(StoryEngine の近く、`window._storyFx` と `window._storyEnding` を定義)

**Consumes:** Task 2 の `runFx`/`ending` フック、`st.lit`。CabinRoom.setBreath/lookFire。
**Produces:** `window._storyFx(kind)`(flareFire/dissolveGuides/fadeEnding)、`window._storyEnding(lit)`。

- [ ] **Step 1: fx とエンディングを実装**
```js
window._storyFx=function(kind){
  const fx=document.getElementById('storyFx');
  if(kind==='flareFire'){
    try{ window.CabinRoom&&window.CabinRoom.lookFire&&window.CabinRoom.lookFire();
         window.CabinRoom&&window.CabinRoom.setBreath&&window.CabinRoom.setBreath(1); }catch(e){}
    setTimeout(()=>{ try{ window.CabinRoom&&window.CabinRoom.setBreath&&window.CabinRoom.setBreath(0);}catch(e){} }, 2600);
    setTimeout(()=>window.CabinStory && document.getElementById('story').dispatchEvent(new MouseEvent('click')), 1600);
  } else if(kind==='dissolveGuides'){
    document.getElementById('sgGirl').style.transition='opacity 2.4s,filter 2.4s';
    document.getElementById('sgBoy').style.transition='opacity 2.4s,filter 2.4s';
    document.getElementById('sgGirl').style.filter='drop-shadow(0 0 40px rgba(255,230,180,.9)) brightness(2.4) blur(3px)';
    document.getElementById('sgBoy').style.filter ='drop-shadow(0 0 40px rgba(255,230,180,.9)) brightness(2.4) blur(3px)';
    document.getElementById('sgGirl').style.opacity='0'; document.getElementById('sgBoy').style.opacity='0';
    setTimeout(()=>document.getElementById('story').dispatchEvent(new MouseEvent('click')), 2600);
  } else if(kind==='fadeEnding'){
    fx.hidden=false; fx.classList.add('black');
    setTimeout(()=>window._storyEnding(window.CabinStory._state().lit), 1500);
  }
};
window._storyEnding=function(lit){
  const st=window.CabinStory._state(); st.cleared=true; window.CabinStory._save();
  const fx=document.getElementById('storyFx'); fx.hidden=false; fx.classList.add('black');
  fx.innerHTML='<div class="fx-lines">'
    +'<p>あなたは、火のそばに座っている。</p>'
    +'<p>誰かが、あなたのために灯してくれた火。</p>'
    +'<p>今度は、あなたが継ぐ番。</p>'
    +'<p style="margin-top:26px;color:#e7c98a">— あなたが灯した、小さな灯 : '+lit+' —</p>'
    +'<p style="margin-top:28px;font-size:.8em;opacity:.7">やがて、また誰かが、雪をかき分けてやってくる。<br>その時、この火は、きっとあたたかい。</p>'
    +'<p style="margin-top:24px;font-size:.66em;opacity:.5">♪ 物語音楽: 君の音。(真島こころ)『映画風ピアノ音楽素材集 vol.2 水のうつろい』</p>'
    +'<button id="storyBackBtn" style="margin-top:30px;font-family:\'Shippori Mincho\',serif;padding:10px 26px;border-radius:99px;background:rgba(240,225,190,.1);border:1px solid rgba(201,180,140,.5);color:#efe6d4;cursor:pointer">火のそばへ戻る</button>'
    +'</div>';
  setTimeout(()=>fx.classList.add('show-lines'), 300);
  document.getElementById('storyBackBtn')?.addEventListener('click',()=>{
    fx.classList.remove('black','show-lines'); fx.hidden=true; fx.innerHTML='';
    window.CabinStory.close();
    /* 暖炉に新しい茶 = 演出的に既存の火をそのまま。カメラを火へ */
    try{ window.CabinRoom&&window.CabinRoom.lookFire&&window.CabinRoom.lookFire(); }catch(e){}
  });
};
```

- [ ] **Step 2: 検証 + commit**
Playwright: 第三章の「継ぐ」選択後、`flareFire`→`dissolveGuides`(立ち絵が光って消える)→`fadeEnding`(暗転)→締め文+「あなたが灯した、小さな灯 : N」+クレジット+「火のそばへ戻る」ボタン。押すと物語が閉じ小屋へ戻る。`localStorage.cabin_story.cleared===true`。
```bash
cd "C:/projects/yuichi916.github.io" && python C:/tmp/check_dup_const.py cabin.html && git add cabin.html && git commit -m "feat(cabin): ending fx (flare/dissolve/fade) + closing screen with lit count + credit"
```

---

### Task 4: 通し検証 + デプロイ + 本番エンディング確認

- [ ] **Step 1: 通しPlaywright(swiftshader)**
起動→第一章(セリフ・選択・観察3点)→第二章(セリフ・選択・観察3点)→第三章(継ぐ選択)→エンディング演出→締め画面。各章で `#story-bgm` の src が `story-ch1/ch2/ch3` に切替わることを assert。エンディングの締め文と灯数、クレジットを assert。コンソール pageerror 0。スクショ: `C:\tmp\ehon2\story_ch1.jpg` `story_look.jpg` `story_ending.jpg`。
- [ ] **Step 2: エンディングを実機スクショで目視吟味**（立ち絵の光溶け・締め文・灯数・クレジット・戻るボタン）。感情の要なので妥協しない。
- [ ] **Step 3: localStorage 再開**: 二章途中で保存→リロード→「小屋の謎をとく」で続きから。
- [ ] **Step 4: デプロイ**
```bash
cd "C:/projects/yuichi916.github.io" && git push origin main
```
Pages built 確認 → 本番 cabin.html で起動→エンディングまで通し確認(BGM切替含む)→ユーザーへ最終報告(物語モード追加・3章・エンディング感動演出・君の音BGM・クレジット)。

---

## Self-Review(実施済み)
1. Spec coverage: §3アーク=STORY全文(Task2)。§4機構(対話/選択/観察/灯カウンタ/起動保存/エンディング)=Task1-3。§5コード構造(STORY/StoryEngine/DOM/CSS/連携)=Task1-3。§6アセット(BGM3+立ち絵流用+クレジット)=Task2-3+既存。§7エラー処理=try/catch/onerror(各所)。§8検証=Task4。§10不変条件=body.story-modeで隠すのみ・CabinRoom非破壊。
2. Placeholder scan: 台詞は全文記載。fx/ending の実コードあり。灯カウンタ・保存・合流stackの実装あり。プレースホルダ無し。
3. Type consistency: `window.CabinStory.start/resume/close/_state/_save`、`window._storyFx(kind)`、`window._storyEnding(lit)`、`st={ch,beat,lit,cleared}`、Beat型キー(say/text/choose/label/reply/look/prompt/spots/key/label/line/done/fx/end)が Task間で一貫。BGMファイル名が STORY と assets と一致。話者色 灯里#f0d6e0系/蒼#cfe0f4系が CSS と render で一貫。
