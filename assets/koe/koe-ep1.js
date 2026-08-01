/* ============ 声を、あげる ep1 — スタブ台本 ============
   本文はすべて仮。構造だけが本番と同じ:
     - 起承転結の場割り（承＝採取4か所）
     - 採取4か所の主素材は mem-01 / mem-07 / mem-13 / mem-19 固定
       （koe.html の finalKey() が直に見ているキーなので変更禁止）
     - エンジンが対応する全ビート種を最低1回ずつ通す（map は本作で不使用。
       koe.html 側コメント「本作はミニマップ非搭載」の通り、真の台本でも
       使われない予定のため、意図的にここでも使わない）
   プレースホルダの目印は台詞の話者で分けてある:
     - narr/ren は "（仮）" 始まり（全角丸括弧）。
     - kanata だけ "仮：" 始まり — koe.html の renderSay() は
       "（"/"(" で始まる kanata/toki の台詞を（心の声）とみなしてボイスを
       鳴らさない(mono判定)。全員 "（仮）" にすると kanata のボイス経路が
       スタブ全体で一度も通らなくなる（実際に旧版で起きた）ので、
       kanata の行だけ丸括弧を避けている。仮の目印であることに変わりはない。
   本編執筆時は、この構造の上に本文を差し替えるだけで良いようにしてある。 */
window.KOE = window.KOE || {};
window.KOE.ep1 = { scenes: [

  /* --- 起 --- */
  { bg:'zanky', bgm:'hibi',
    card:{ no:'01', ttl:'（仮）残響区', sub:'（仮）音を売り買いする街の底' },
    beats:[
      {say:'narr', text:'（仮）音が減っていた。'},
      {show:'kanata', pos:'center'},
      {expr:'smile', who:'kanata'},
      {say:'kanata', text:'仮：今日も拾いに行く。'},
      {se:'page'},
      {fx:'flash'},
      {wait:400},
      {bg:'soko', bgm:'deai'},
      {amb:1},
      {show:'ren', pos:'right'},
      {say:'ren', text:'（仮）（文字盤を指す）'},
      {say:'kanata', text:'仮：きみの声、作ってやるよ。'},
      {tryvoice:1},
      {hide:'ren'},
      {end:1}
    ]
  },

  /* --- 承：採取1/4（市場） --- */
  { bg:'ichiba', bgm:'tansaku', beats:[
    {explore:{label:'（仮）光る印を探せ'}},
    {pickup:'mem-01', main:1}, {tryvoice:1},
    {se:'chime'},
    {pickup:'mem-02'},
    {say:'narr', text:'（仮）市場の音がひとつ減った。'},
    {end:1}
  ]},

  /* --- 承：採取2/4（水路） --- */
  { bg:'suiro', bgm:'mizu', beats:[
    {pickup:'mem-07', main:1}, {tryvoice:1},
    {fx:'shake'},
    {pickup:'mem-08'},
    {end:1}
  ]},

  /* --- 承：採取3/4（劇場跡） --- */
  { bg:'gekijo', bgm:'fuon', beats:[
    {pickup:'mem-13', main:1}, {tryvoice:1},
    {pickup:'mem-14'},
    {choose:[
      {label:'（仮）先に進む', set:'push', reply:[{say:'kanata', text:'仮：行こう。'}]},
      {label:'（仮）少し休む', reply:[{say:'kanata', text:'仮：少しだけ。'}]}
    ]},
    {when:'push', reply:[{say:'narr', text:'（仮）足を速めた。'}]},
    {end:1}
  ]},

  /* --- 承：採取4/4（塔） --- */
  { bg:'tou', bgm:'fuon', beats:[
    {pickup:'mem-19', main:1}, {tryvoice:1},
    {pickup:'mem-20'},
    {end:1}
  ]},

  /* --- 転 --- */
  { bg:'soko', bgm:'shoutai', beats:[
    {amb:0},
    {card:{no:'05', ttl:'（仮）転', sub:'（仮）声の正体', hold:1200}},
    {say:'narr', text:'（仮）拾ってきた音は、全部だれかの声だった。'},
    {montage:1},
    {show:'ren', pos:'right'},
    {fx:'sepia_on'},
    {say:'ren', text:'（仮）（後ずさる）'},
    {fx:'sepia_off'},
    {end:1}
  ]},

  /* --- 結 --- */
  { bg:'soko', bgm:'kansei', beats:[
    {finalvoice:1},
    {say:'ren', text:'（仮）ありがとう', v:1},
    {narrator:'ren'},
    {say:'narr', text:'（仮）——ここから先は、わたしの声で話す。'},
    {bg:'zanky', bgm:'ed'},
    {cg:'cg-owari'},
    {say:'ren', text:'（仮）——おはよう', v:1},
    {cg:null},
    {title:1}
  ]}
]};
