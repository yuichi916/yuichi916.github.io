/* ============ 声を、あげる ep1 — 本編台本 ============
 *
 * ■ 地の文(narr)の鉄則 ————————————————————————————
 * 地の文は「カナタが、声の出ない彼女に向けて、声に出して喋っている言葉」である。
 * だから彼女はそれを持っている（＝2周目に彼女の声で鳴る）。この一点を守るかぎり、
 * 同じ文が 1周目=彼の語り / 2周目=彼女の語り直し として両方成立する。
 *   - 一人称は「俺」。彼女を指すときは「きみ」。2周目は「きみ」の指す相手が反転する。
 *   - 彼が声に出さなかった内心を地の文に書かない。書きたいときは kanata の台詞にする。
 *   - 彼女が居合わせていない出来事を地の文で語らない。
 *
 * ■ エンジン制約 ————————————————————————————
 *   - 1ビートに say と他の命令を同居させない（assertNoLostKey が throw する）
 *   - 1ビートに bg と bgm を同居させない。シーン直下は同居してよい
 *   - {say:'ren'} は既定で無音。鳴らすのは v:1 のビートだけ（結パートのみ）
 *   - {narrator:'ren'} は {say:'ren', v:1} より後にしか置けない
 *   - kanata/toki の台詞は「（」始まりだとボイスが鳴らない（心内描写扱い）
 *   - 主素材は mem-01 / mem-07 / mem-13 / mem-19 固定（finalKey() が直に見ている）
 */
window.KOE = window.KOE || {};
window.KOE.ep1 = { title:'声を、あげる', scenes: [

/* ══════════════════ 起 ══════════════════ */
{ bg:'zanky', bgm:'hibi',
  card:{ no:'', ttl:'声を、あげる', sub:'残響区', hold:3400 },
  beats:[
  {say:'narr', text:'——これは、もう終わってしまったことの話だ。'},
  {say:'narr', text:'だから最初に言っておく。俺はきみに、ひどいことをした。'},
  {wait:700},

  {say:'narr', text:'クワイエタスは、沈みかけの街だ。'},
  {say:'narr', text:'地面の下がまるごと空洞で、その上に千年ぶんの建物が積み上がっている。'},
  {say:'narr', text:'俺がいるのは、いちばん下の残響区。'},
  {amb:1},
  {say:'narr', text:'それと、この街からは音が減っていく。'},
  {say:'narr', text:'去年まであった雨だれの音が、今年はもう鳴らない。'},
  {say:'narr', text:'誰も理由を知らない。知ろうともしない。'},

  {show:'kanata', pos:'left'},
  {say:'kanata', text:'……いた。'},
  {say:'narr', text:'廃墟の梁に、音がひとつ引っかかっていた。'},
  {say:'narr', text:'目には見えない。耳の裏側が、ちりっとする。'},
  {se:'chime'},
  {say:'kanata', text:'笑い声だな、これ。子どもの。'},
  {say:'kanata', text:'……売れる。', ex:'smile'},

  {say:'narr', text:'俺は音の拾い屋だ。'},
  {say:'narr', text:'廃墟に残った音を採って、トキのじいさんに売る。'},
  {say:'narr', text:'この一年、やたらと拾えるようになった。'},
  {say:'narr', text:'街から音が減るのと同じ速さで、瓦礫からは湧いてくる。'},
  {say:'kanata', text:'変な話だよな。減った分が、どっかから漏れてるみたいでさ。'},

  {bg:'ichiba'},
  {bgm:'shigoto'},
  {hide:'all'},
  {show:'toki', pos:'right'},
  {show:'kanata', pos:'left'},
  {say:'toki', text:'また子どもの笑いか。よう拾うのう、おまえは。'},
  {say:'kanata', text:'耳がいいだけだよ。'},
  {say:'toki', text:'耳のええ奴なら他にもおる。おまえは、探しとるから拾えるんじゃ。'},
  {wait:500},
  {say:'toki', text:'まだ見つからんか。母さんの声。', ex:'grave'},
  {say:'kanata', text:'うるさいな。', ex:'pained'},

  {say:'narr', text:'母さんは三年前に声を失くした。病気じゃない。ある朝、起きたら無かった。'},
  {say:'narr', text:'この街では珍しくもない。'},
  {say:'narr', text:'珍しくないから、誰も探さない。'},
  {say:'kanata', text:'……じいさん。今日はもう一本、奥まで行く。'},
  {say:'toki', text:'放送塔か。やめとけ。あすこは底が抜けとる。'},
  {say:'kanata', text:'だから誰も拾ってない。'},

  {bg:'tou'},
  {bgm:'fuon'},
  {hide:'all'},
  {say:'narr', text:'放送塔は、街ができたときからあるらしい。'},
  {say:'narr', text:'何を放送していたのかは、誰も覚えていない。'},
  {say:'narr', text:'降りるほど静かになった。'},
  {say:'narr', text:'いや——静かじゃない。'},
  {say:'narr', text:'音が、吸われていた。'},

  {bg:'soko'},
  {bgm:'deai'},
  {fx:'flash'},
  {say:'narr', text:'最下層に、女の子がいた。'},
  {show:'ren', pos:'right'},
  {show:'kanata', pos:'left'},
  {say:'kanata', text:'……え。'},
  {say:'kanata', text:'あんた、こんなとこで何やって——'},
  {say:'ren', text:'（口が動く。音は出ない）', ex:'blank'},
  {say:'kanata', text:'……声、出ないのか。'},
  {say:'ren', text:'（うなずく）', ex:'nod'},

  {say:'narr', text:'きみは床に指で字を書いた。埃の上に、ゆっくり。'},
  {say:'ren', text:'『ここが どこか わからない』', ex:'write'},
  {say:'ren', text:'『わたしが だれかも』'},
  {say:'kanata', text:'……記憶が無いってことか。'},
  {say:'ren', text:'（うなずく）', ex:'nod'},
  {say:'kanata', text:'名前は。'},
  {say:'ren', text:'『ない』', ex:'down'},
  {say:'kanata', text:'……そっか。'},
  {wait:700},

  {say:'narr', text:'塔の壁に、剥がれかけた文字が残っていた。'},
  {say:'narr', text:'SEIREN。たぶん、昔の警報装置の名前だ。'},
  {say:'kanata', text:'じゃあ、セイレンでいいや。'},
  {say:'ren', text:'『いいの?』', ex:'look'},
  {say:'kanata', text:'嫌なら変えればいい。名前って、そういうもんだろ。'},
  {say:'ren', text:'（少し笑った、と思う）', ex:'smile2'},

  {say:'narr', text:'きみは何か言おうとするたび、喉に手をあてた。'},
  {say:'narr', text:'そこに声があると思っている手の置き方だった。'},
  {wait:600},
  {say:'narr', text:'無いのに。'},

  {say:'kanata', text:'なあ。俺、音の拾い屋なんだ。'},
  {say:'kanata', text:'街じゅうの音を採って売ってる。'},
  {say:'kanata', text:'……声だって、音だ。'},
  {say:'ren', text:'（顔を上げる）', ex:'surprise'},
  {say:'kanata', text:'集めて、組めば、作れるかもしれない。'},
  {say:'kanata', text:'きみの声。'},

  {say:'narr', text:'言ってから、俺は自分の口を殴りたくなった。'},
  {say:'narr', text:'できる保証なんて、ひとつも無かった。'},
  {say:'ren', text:'『つくれるの』', ex:'reach'},
  {say:'kanata', text:'……作る。'},
  {wait:600},
  {say:'narr', text:'それが、俺がきみについた最初の嘘だ。'},
  {wait:800},

  {say:'kanata', text:'あ、そうだ。'},
  {say:'kanata', text:'俺の声、録っといてやるよ。'},
  {say:'ren', text:'『？』', ex:'tilt'},
  {say:'kanata', text:'喋れないと退屈だろ。俺の声で埋めとけ。返さなくていいから。'},
  {say:'ren', text:'（口を押さえて、肩が揺れた）', ex:'laugh'},
  {say:'kanata', text:'笑うなよ。', ex:'smile'},

  {say:'narr', text:'それから俺は、ずっと喋りっぱなしだった。'},
  {say:'narr', text:'きみが黙っているぶん、俺が喋る。それでちょうどよかった。'},
  {say:'narr', text:'——この話が全部、俺の声でできているのは、そういうわけだ。'},
  {tryvoice:1},
  {say:'kanata', text:'……いまのが、素材ゼロの音。ひどいな。'},
  {say:'ren', text:'『ひどい』', ex:'smile'},
  {say:'kanata', text:'書くなよ。'},
  {hide:'all'},
  {end:1}
]},

/* ══════════════════ 承1・市場 ══════════════════ */
{ bg:'ichiba', bgm:'tansaku',
  card:{ no:'一', ttl:'母音', sub:'市場・第七区画', hold:2600 },
  beats:[
  {say:'narr', text:'声を作るには、まず母音がいる。'},
  {say:'narr', text:'「あ」の形をした音。人が最初に出す音だ。'},
  {say:'narr', text:'市場は、この街でいちばん音が濃い。'},
  {say:'narr', text:'濃いということは、それだけ落ちているということだ。'},

  {explore:{label:'耳をすませ。落ちている音を探す'}},
  {pickup:'mem-01', main:1},
  {show:'kanata', pos:'left'},
  {say:'kanata', text:'……拾えた。あ、の音だ。'},
  {say:'narr', text:'音を採ると、一瞬だけ景色が見える。'},
  {say:'narr', text:'その音が昔どこにあったか、の景色だ。'},
  {say:'narr', text:'いま見えたのは、朝の露店。誰かが値段を読み上げていた。'},
  {tryvoice:1},
  {say:'kanata', text:'二十五パーセント。まだ言葉になってないな。'},
  {show:'ren', pos:'right'},
  {say:'ren', text:'『でも おとが した』', ex:'look'},
  {say:'kanata', text:'……ああ。したな。'},

  {pickup:'mem-02'},
  {pickup:'mem-03'},
  {say:'narr', text:'ついでに拾った端切れみたいな音も、袋に入れておく。'},
  {say:'narr', text:'いつか使うかもしれないし、使わないかもしれない。'},

  {hide:'all'},
  {show:'toki', pos:'right'},
  {show:'kanata', pos:'left'},
  {say:'toki', text:'その子は、どこの子じゃ。', ex:'wry'},
  {say:'kanata', text:'塔の下にいた。名前は俺がつけた。'},
  {say:'toki', text:'……ふん。', ex:'away'},
  {say:'toki', text:'カナタ。昔な、この街は音を捨てる約束をしたんじゃ。'},
  {say:'kanata', text:'捨てる?'},
  {say:'toki', text:'下が空洞じゃからの。音が響けば、地盤が崩れる。'},
  {say:'toki', text:'じゃから街は、音を溜めておく器を最下層に据えた。そういう話じゃ。'},
  {say:'kanata', text:'器って、何だよ。箱か?'},
  {say:'toki', text:'さあの。誰も見た者はおらん。'},
  {wait:500},
  {say:'toki', text:'——人は、人の形にしか声を預けんからな。', ex:'grave'},
  {say:'kanata', text:'……なんだそれ。'},

  {say:'narr', text:'じいさんは、それ以上は言わなかった。'},
  {say:'narr', text:'俺も、その日は聞き流した。'},
  {say:'narr', text:'聞き流したことを、あとで死ぬほど悔やんだ。'},

  {hide:'all'},
  {show:'ren', pos:'right'},
  {show:'kanata', pos:'left'},
  {say:'kanata', text:'なあセイレン。ひとつ決めごとしないか。'},
  {say:'ren', text:'『きめごと』', ex:'tilt'},
  {say:'kanata', text:'寝る前に、その日いちばんの音を一個だけ言う。'},
  {say:'kanata', text:'俺が言うから、きみは書けばいい。'},
  {say:'kanata', text:'……声ができたら、きみが言えばいい。'},
  {say:'ren', text:'『きょうの いちばん は』', ex:'smile2'},
  {say:'kanata', text:'俺は、市場の朝の「あ」。'},
  {say:'ren', text:'『わたしは あなたが わらった おと』', ex:'smile'},
  {say:'kanata', text:'……それ、音じゃなくて俺だろ。'},
  {say:'ren', text:'『おとだよ』', ex:'smile2'},
  {hide:'all'},
  {end:1}
]},

/* ══════════════════ 承2・水路 ══════════════════ */
{ bg:'suiro', bgm:'mizu',
  card:{ no:'二', ttl:'息', sub:'旧配水路', hold:2600 },
  beats:[
  {amb:1},
  {say:'narr', text:'次にいるのは、息だ。'},
  {say:'narr', text:'声は、息の上に乗っかっているだけの薄いものだ。'},
  {say:'narr', text:'水路は音がよく残る。壁が濡れているからだと思う。'},

  {explore:{label:'水の音の隙間を探す'}},
  {pickup:'mem-07', main:1},
  {show:'kanata', pos:'left'},
  {say:'kanata', text:'……息、採れた。'},
  {say:'narr', text:'見えた景色は、走っている誰かの背中だった。'},
  {say:'narr', text:'息が切れていた。急いでいた。何かに間に合わせようとしていた。'},
  {tryvoice:1},
  {say:'kanata', text:'五十パーセント。'},
  {say:'kanata', text:'……単語の切れ端が混じってきたな。'},

  {pickup:'mem-08'},
  {pickup:'mem-09'},

  {show:'ren', pos:'right'},
  {say:'narr', text:'その日、きみは水路の縁に足を垂らして、ずっと水を見ていた。'},
  {say:'kanata', text:'どうした。'},
  {say:'ren', text:'『みずの おとが きこえると ねむれる』', ex:'peace'},
  {say:'kanata', text:'ふうん。'},
  {say:'ren', text:'『でも きのう ここの おとが すこし へった』', ex:'down'},
  {say:'kanata', text:'……分かるのか、それ。'},
  {say:'ren', text:'『わかる』'},
  {say:'ren', text:'『わたしは おとが へるのが わかる』', ex:'throat'},

  {say:'narr', text:'きみは、街から音が消えるのを、いつも先に知っていた。'},
  {say:'narr', text:'俺はそれを、耳がいいんだな、と言って済ませた。'},
  {wait:600},
  {say:'narr', text:'済ませたことにしていた。'},

  {say:'kanata', text:'なあ。声ができたら、最初に何て言う。'},
  {say:'ren', text:'『きめてる』', ex:'smile2'},
  {say:'kanata', text:'教えろよ。'},
  {say:'ren', text:'『いま いったら つまらない』', ex:'smile'},
  {say:'kanata', text:'ずるいなあ。'},
  {say:'ren', text:'『きょうの いちばんは あなたの ずるいなあ』', ex:'smile2'},
  {say:'kanata', text:'俺ばっかじゃねえか。'},
  {hide:'all'},
  {end:1}
]},

/* ══════════════════ 承3・旧劇場 ══════════════════ */
{ bg:'gekijo', bgm:'tansaku',
  card:{ no:'三', ttl:'笑い', sub:'旧劇場', hold:2600 },
  beats:[
  {say:'narr', text:'三つめは笑い声にした。'},
  {say:'narr', text:'理由はある。きみは笑うとき、いつも音を出そうとして失敗していた。'},
  {say:'narr', text:'旧劇場は、笑い声が染みついている。'},
  {say:'narr', text:'千年ぶん染みていれば、少しは残る。'},

  {explore:{label:'客席の奥を探す'}},
  {pickup:'mem-13', main:1},
  {show:'kanata', pos:'left'},
  {say:'kanata', text:'……あった。笑い声だ。'},
  {say:'narr', text:'見えたのは、舞台じゃなくて客席だった。'},
  {say:'narr', text:'誰かが、隣の誰かの肩を叩いて笑っていた。'},
  {tryvoice:1},
  {say:'kanata', text:'七十五パーセント。'},
  {say:'kanata', text:'……片言だけど、言葉だ。'},

  {pickup:'mem-14'},
  {pickup:'mem-15'},

  {show:'ren', pos:'right'},
  {say:'narr', text:'そのあと、俺たちは初めて喧嘩をした。'},
  {say:'kanata', text:'……セイレン。この一年で、街の音が減る速さが倍になってる。'},
  {say:'kanata', text:'きみ、知ってたよな。'},
  {say:'ren', text:'（喉に手をあてる）', ex:'throat'},
  {say:'kanata', text:'先に分かるんだろ。なんで言わなかった。'},
  {say:'ren', text:'『いっても とめられない』', ex:'down'},
  {say:'kanata', text:'言えよ。言われなきゃ、こっちは何も——', ex:'shout'},
  {wait:600},
  {say:'kanata', text:'……悪い。', ex:'pained'},
  {say:'kanata', text:'言えないんだよな、きみは。'},

  {say:'narr', text:'言葉が出ないやつに、言えと怒鳴った。'},
  {say:'narr', text:'俺は、自分がいちばん醜い形で正しいことを言った。'},

  {choose:[
    {label:'謝る', set:'ayamaru', reply:[
      {say:'kanata', text:'ごめん。ほんとに、ごめん。', ex:'pained'},
      {say:'ren', text:'『いいよ』', ex:'sad'},
      {say:'ren', text:'『はじめて あなたの ことばが まっすぐ あたった』', ex:'look'},
      {say:'kanata', text:'……最悪の当たり方だろ、それ。'}
    ]},
    {label:'黙って隣に座る', reply:[
      {say:'narr', text:'俺は何も言わずに、きみの隣に座った。'},
      {say:'ren', text:'『すわった』', ex:'smile2'},
      {say:'kanata', text:'座った。'},
      {say:'ren', text:'『それで いい』', ex:'peace'}
    ]}
  ]},

  {say:'ren', text:'『でも ひとつ いう』', ex:'resolve'},
  {say:'ren', text:'『おとが きえるとき わたしの なかが すこし あたたかくなる』', ex:'down'},
  {say:'kanata', text:'……なんだよ、それ。'},
  {say:'ren', text:'『わからない』', ex:'shake'},
  {say:'ren', text:'『きょうの いちばんは あなたの ごめん』', ex:'sad'},
  {when:'ayamaru', reply:[
    {say:'kanata', text:'……いちばんが謝罪って、どういう一日だよ。'}
  ]},
  {hide:'all'},
  {end:1}
]},

/* ══════════════════ 承4・塔 ══════════════════ */
{ bg:'tou', bgm:'fuon',
  card:{ no:'四', ttl:'泣き声', sub:'放送塔・中層', hold:2600 },
  beats:[
  {say:'narr', text:'最後は、泣き声だった。'},
  {say:'narr', text:'声を作るのに泣き声がいるなんて、俺も知らなかった。'},
  {say:'narr', text:'でも人の声は、泣き方の分だけ違うらしい。'},

  {explore:{label:'塔の中層を探す'}},
  {pickup:'mem-19', main:1},
  {show:'kanata', pos:'left'},
  {say:'kanata', text:'……採れた。'},
  {say:'narr', text:'見えた景色は、暗い部屋だった。'},
  {say:'narr', text:'誰かが、誰かの名前を呼びながら泣いていた。'},
  {say:'narr', text:'名前は、聞き取れなかった。'},
  {tryvoice:1},
  {wait:800},
  {say:'kanata', text:'……できた。'},
  {say:'kanata', text:'百パーセントだ。'},

  {pickup:'mem-20'},
  {pickup:'mem-21'},

  {show:'ren', pos:'right'},
  {say:'narr', text:'その日、街の鐘が鳴らなくなった。'},
  {say:'narr', text:'千年鳴っていたものが、予告もなく止まった。'},
  {fx:'shake'},
  {say:'ren', text:'（喉を押さえて、うずくまる）', ex:'curl'},
  {say:'kanata', text:'セイレン? おい——'},
  {say:'ren', text:'『いっぱいに なる』', ex:'pained'},
  {say:'kanata', text:'何が。'},
  {say:'ren', text:'『わからない』', ex:'shake'},
  {say:'ren', text:'『でも もうすぐ あふれる』', ex:'pained'},

  {say:'narr', text:'俺は、きみを抱えて塔を降りた。'},
  {say:'narr', text:'降りながら、まだ何も分かっていなかった。'},
  {wait:600},
  {say:'narr', text:'——ここまでが、俺が幸せだった部分だ。'},
  {hide:'all'},
  {end:1}
]},

/* ══════════════════ 転 ══════════════════ */
{ bg:'soko', bgm:'shoutai',
  card:{ no:'五', ttl:'返せない音', sub:'放送塔・最下層', hold:2800 },
  beats:[
  {amb:1},
  {show:'kanata', pos:'left'},
  {say:'narr', text:'声が完成した夜、俺は最後の確認をしていた。'},
  {say:'narr', text:'集めた音を一つずつ鳴らして、混ざり具合を見る。'},
  {say:'narr', text:'四つめの、泣き声。'},
  {fx:'flash'},
  {wait:700},
  {say:'kanata', text:'……え。'},
  {wait:700},
  {say:'kanata', text:'いま、名前——'},
  {say:'kanata', text:'「カナタ」って、言った。'},

  {say:'narr', text:'暗い部屋で、誰かが誰かの名前を呼んで泣いていた。'},
  {say:'narr', text:'その誰かは、母さんだった。'},
  {say:'narr', text:'呼ばれていたのは、俺だった。'},
  {wait:900},

  {say:'kanata', text:'……なんで。', ex:'pained'},
  {say:'kanata', text:'なんで母さんの声が、瓦礫に落ちてるんだよ。', ex:'shout'},
  {say:'narr', text:'俺は、袋をひっくり返した。'},
  {say:'narr', text:'拾った音を、全部いっぺんに鳴らした。'},
  {montage:1},
  {wait:500},

  {say:'narr', text:'市場の「あ」は、露店の男が失くした挨拶だった。'},
  {say:'narr', text:'水路の息は、間に合わなかった誰かの最後の呼吸だった。'},
  {say:'narr', text:'劇場の笑いは、笑えなくなった客席のものだった。'},
  {wait:600},
  {say:'narr', text:'——全部、この街の誰かが失くした声だった。'},
  {wait:700},
  {say:'narr', text:'俺は一年かけて、盗まれたものを拾い集めて、売っていた。'},
  {say:'narr', text:'街の人は、自分から奪われた声を、それと知らずに買い戻していた。'},

  {show:'ren', pos:'right'},
  {say:'kanata', text:'……セイレン。'},
  {say:'kanata', text:'この音、どこから漏れてる。'},
  {say:'ren', text:'（後ずさる）', ex:'step'},
  {say:'kanata', text:'塔の最下層だ。きみがいた場所だ。'},
  {say:'ren', text:'（喉に手をあてる）', ex:'throat'},
  {say:'kanata', text:'——きみ、なんだよな。', ex:'pained'},
  {wait:900},

  {say:'ren', text:'『わたしは』', ex:'down'},
  {say:'ren', text:'『しずかにする ための うつわ』', ex:'blank'},
  {say:'ren', text:'『いま おもいだした』', ex:'shock'},

  {say:'narr', text:'この街は、音が響けば崩れる空洞の上にある。'},
  {say:'narr', text:'だから千年前、街は最下層に器を据えた。'},
  {say:'narr', text:'音を吸って、溜めて、二度と出さないための器を。'},
  {say:'narr', text:'人の形をしているのは——人は、人の形にしか声を預けないからだ。'},
  {wait:600},
  {say:'narr', text:'声が無いのは、当たり前だった。'},
  {say:'narr', text:'器に、出す機能はいらない。'},

  {say:'ren', text:'『いっぱいに なったから あふれてる』', ex:'down'},
  {say:'ren', text:'『こぼれた ぶんを あなたが ひろってた』', ex:'sad'},
  {say:'kanata', text:'じゃあ、記憶が無かったのは。'},
  {say:'ren', text:'『ためた おとが おおいと ひとに なる』'},
  {say:'ren', text:'『だから ときどき からに される』', ex:'blank'},
  {say:'ren', text:'『わたしは このまえ からに された ばかり』', ex:'down'},

  {say:'narr', text:'俺が出会ったのは、空にされたばかりのきみだった。'},
  {say:'narr', text:'名前が無かったのは、そういうことだった。'},
  {wait:800},

  {say:'kanata', text:'……なあ。'},
  {say:'kanata', text:'声を渡したら、どうなる。'},
  {say:'ren', text:'『すう あなと はく あなは おなじ』'},
  {say:'ren', text:'『かたほうを ひらくと かたほうが しまる』'},
  {say:'kanata', text:'つまり、もう吸えなくなる。'},
  {say:'ren', text:'『ためた おとは ぜんぶ まちに かえる』', ex:'resolve'},
  {say:'kanata', text:'……じゃあ、それでいいじゃんか。'},
  {wait:700},
  {say:'ren', text:'『わたしの なかみは ぬすんだ おとで できてる』', ex:'cry'},
  {say:'ren', text:'『かえしたら わたしは のこらない』', ex:'tears'},

  {say:'narr', text:'きみは逃げなかった。'},
  {say:'narr', text:'俺のほうが、後ずさった。'},

  {choose:[
    {label:'それでも声を渡す', set:'watasu', reply:[
      {say:'kanata', text:'……渡す。', ex:'pained'},
      {say:'kanata', text:'きみが一回も喋らないまま消えるのは、俺が耐えられない。'}
    ]},
    {label:'渡さない、と言ってみる', reply:[
      {say:'kanata', text:'渡さない。器のままでいい。'},
      {say:'ren', text:'『それだと また からに される』', ex:'sad'},
      {say:'ren', text:'『つぎの わたしは あなたを しらない』', ex:'down'},
      {say:'kanata', text:'……ずるいだろ、それ。'},
      {say:'ren', text:'『わたしは ずるい』', ex:'smile2'}
    ]}
  ]},

  {say:'ren', text:'『ひとつ おねがいが ある』', ex:'look'},
  {say:'kanata', text:'なんだよ。'},
  {say:'ren', text:'『きょうの いちばんを いわせて』', ex:'resolve'},
  {say:'kanata', text:'……声、まだ渡してないだろ。'},
  {say:'ren', text:'『かくよ』', ex:'smile2'},
  {wait:600},
  {say:'ren', text:'『きょうの いちばんは あなたが なまえを くれた おと』', ex:'smile'},
  {when:'watasu', reply:[
    {say:'kanata', text:'……それ、一年前だろ。'},
    {say:'ren', text:'『ずっと いちばん』', ex:'smile'}
  ]},
  {hide:'all'},
  {end:1}
]},

/* ══════════════════ 結 ══════════════════ */
{ bg:'soko', bgm:'kansei', beats:[
  {show:'ren', pos:'right'},
  {show:'kanata', pos:'left'},
  {say:'narr', text:'俺は、組み上げた声をきみに渡した。'},
  {say:'narr', text:'渡す、というのが正しいのかは分からない。'},
  {say:'narr', text:'ただ、鳴らした。'},
  {wait:800},
  {finalvoice:1},
  {wait:600},

  {say:'narr', text:'きみは自分の喉に手をあてて、それから、手を離した。'},
  {say:'narr', text:'ずっとそこにあると思って置いていた手を、初めて離した。'},

  {say:'narr', text:'そのあとのことは、うまく思い出せない。'},
  {fx:'flash'},
  {say:'narr', text:'千年ぶんの音が、いっぺんに街へ還った。'},
  {say:'narr', text:'鐘が鳴った。水が鳴った。市場が鳴った。'},
  {wait:600},
  {say:'narr', text:'——母さんが、俺の名前を呼んだ。'},
  {wait:900},

  {say:'narr', text:'きみは、還すたびに薄くなっていった。'},
  {say:'narr', text:'盗んだ音でできた体から、盗んだ音が抜けていくんだから、当たり前だ。'},
  {say:'kanata', text:'セイレン。'},
  {say:'kanata', text:'いるか。'},
  {say:'kanata', text:'……返事しろよ。声、あるだろ。', ex:'shout'},
  {wait:800},

  {say:'narr', text:'最後にひとつだけ、還らない音が残った。'},
  {say:'narr', text:'きみの中で、それだけがどうしても外れなかった。'},
  {wait:700},
  {say:'narr', text:'俺の声だった。'},
  {wait:900},
  {say:'narr', text:'当たり前だ。'},
  {say:'narr', text:'あれは、奪ったものじゃない。'},
  {say:'narr', text:'俺が、返さなくていいと言って、渡したものだ。'},
  {wait:600},
  {say:'narr', text:'奪った音は返せる。'},
  {say:'narr', text:'もらったものは、返せない。'},
  {wait:800},

  {say:'ren', text:'『ありがとう』', ex:'speak', v:1},
  {wait:1000},

  {narrator:'ren'},
  {say:'narr', text:'——だから、わたしは消えなかった。'},
  {say:'narr', text:'あなたの声ひとつを抱えたまま、器をやめた。'},
  {wait:600},
  {say:'narr', text:'ここまでの話を、わたしはあなたの声で喋っていた。'},
  {say:'narr', text:'それしか持っていなかったから。'},
  {wait:700},
  {say:'narr', text:'あなたが聞いていた「俺」は、ぜんぶ、わたしだった。'},
  {wait:1000},

  {cg:'cg-owari'},
  {wait:1200},
  {say:'narr', text:'音が還った日、街の記録から、器の項目が消えた。'},
  {say:'narr', text:'器がいた事実ごと、きれいに。'},
  {wait:600},
  {say:'narr', text:'——だから、あなたはわたしを覚えていない。'},
  {wait:900},
  {cg:null},

  {bg:'zanky'},
  {bgm:'ed'},
  {hide:'all'},
  {say:'narr', text:'残響区の朝は、うるさい。'},
  {say:'narr', text:'雨だれが鳴って、鐘が鳴って、市場が鳴っている。'},
  {say:'narr', text:'わたしは、その音の中を歩いている。'},
  {wait:600},

  {show:'kanata', pos:'left'},
  {show:'ren', pos:'right'},
  {say:'narr', text:'路地の角で、音の拾い屋の少年とすれ違った。'},
  {say:'narr', text:'耳の裏を掻きながら、何か拾えないかと歩いている。'},
  {say:'narr', text:'あなたは、わたしを知らない。'},
  {wait:900},
  {say:'narr', text:'それでもいい。'},
  {say:'narr', text:'返せないものを、ひとつ持っている。'},
  {wait:700},

  {say:'narr', text:'わたしは息を吸って——'},
  {say:'narr', text:'生まれて初めて、自分の声を、あげた。'},
  {wait:1000},

  {say:'ren', text:'——おはよう', ex:'speak', v:1},
  {wait:1400},

  {say:'narr', text:'あなたが、振り返る。'},
  {wait:1600},

  {card:{ no:'', ttl:'声を、あげる', sub:'——おわり', hold:5000 }},
  {title:1}
]}

]};
