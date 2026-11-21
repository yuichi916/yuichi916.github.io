// 一筆花火 2 — 夜明けの頁（灯の物語）。夜を越えるたびに 1 頁。負けても続きから読める。DOM に触らない
// 筋は _dev/hanabi-story-design.md の「送り火」: いなくなったのは、じいちゃんではなく灯のほうだった。追ってくる火は、じいちゃんの迎え火
// who: tora=ねこ屋のトラ / note=じいちゃんの秘伝帳 / yokai=倒した妖怪（gate の相手）・まだなら次の大一番の相手 / mem=灯の記憶 / hinoko=追ってくる火
// gate: b1〜b3=その世界の大一番（第 4 夜）に勝った / r1〜r3=その世界の大妖怪（第 8 夜）に勝った。w=その世界まで来ている（いまの周で）
// a: 灯の返し（声つき）。face は tale/img/akari_<face>.webp
export const TALE = [
  // 第一の世界 川辺の夏祭り — 灯は名前しか覚えていない
  { who: 'tora', ja: 'おかえり、灯。……今年も来たんだね', en: 'Welcome back, Akari. ...So you came again this year.',
    a: { face: 'surprise', ja: '今年も……？ わたし、ここに来たこと、あったっけ', en: 'Again...? Have I been here before?' },
    tail: { ja: '（足もとで、花火の尻尾の子狐が「コン」と鳴いた。灯の相棒だ）', en: '(At her feet, a little fox with a firework tail yips "Kon!" Akari\'s partner.)' } },
  { who: 'note', ja: '一筆花火は、帰り道を空に描く花火。　——源', en: 'Hitofude Hanabi: fireworks that draw the way home across the sky. —Gen',
    a: { face: 'smile', ja: 'じいちゃんの字だ。……帰り道って、誰の？', en: "That's Grandpa's handwriting. ...The way home for who?" } },
  { who: 'tora', ja: '見物の衆を見てごらん。今夜も、顔がひとりもないだろう', en: 'Look at the crowd. Not a single face again tonight.',
    a: { face: 'sad', ja: 'ほんとだ……。あの人たち、どこから来たの？', en: "You're right... Where did all those people come from?" } },
  { who: 'yokai', gate: 'b1', ja: '……まだ帰さぬ。頼まれているのでな', en: "...You're not going home yet. We were asked to keep you here.",
    a: { face: 'angry', ja: '頼まれた？ 誰に？ わたし、帰りたいなんて言ってない', en: 'Asked? By who? I never said I wanted to go home.' } },
  { who: 'tora', ja: '後ろから追ってくる火、怖いかい。……あれの正体は、まだ言えない', en: "Scared of the flame chasing you? ...I can't tell you what it is. Not yet.",
    a: { face: 'angry', ja: 'トラはいつも、いちばん大事なところで黙るんだから', en: 'You always go quiet at the most important part, Tora.' } },
  { who: 'note', ja: '振り返るな。尺玉だけは、追いかけるな', en: "Don't look back. And never chase the great shell.",
    a: { face: 'surprise', ja: '尺玉……？ じいちゃん、何を知ってたの？', en: 'The great shell...? Grandpa, what did you know?' } },
  { who: 'mem', ja: '（綿あめの匂い。大きな手。……その手を、わたしが放した）', en: '(The smell of cotton candy. A big, warm hand. ...And I let go of it.)',
    a: { face: 'sad', ja: '放したのは、わたし……？ どうして', en: "I'm the one who let go...? Why?" } },
  { who: 'yokai', gate: 'r1', ja: '思い出したか。あの夏の夜、おまえは祭りの灯りを離れて、川のほうへ走っていった', en: 'Do you remember now? That summer night, you left the festival lights and ran toward the river.',
    a: { face: 'sad', ja: 'じいちゃん、ずっとわたしを探してたのかな。……いま、どこにいるの？', en: 'Has Grandpa been looking for me all this time? ...Where is he now?' } },
  // 第二の世界 雪の山里 — じいちゃんの側
  { who: 'tora', w: 2, ja: 'ここは、じいちゃんの冬だよ。花火のない季節に、あの人はひとりで玉を詰める', en: "This is your grandpa's winter. In the season without fireworks, he packs shells all alone.",
    a: { face: 'surprise', ja: 'じいちゃんは……いなくなったんじゃなかったの？', en: 'Grandpa... I thought he was the one who disappeared?' } },
  { who: 'note', w: 2, ja: '今年も、あの子の分の玉を詰めた。三寸、赤。あの子の好きな色', en: 'Packed her shell again this year. Three-inch, red. Her favorite color.',
    a: { face: 'smile', ja: '赤は、わたしの好きな色……。どうして毎年、わたしの分を作るの？', en: 'Red is my favorite color... Why does he make one for me every year?' } },
  { who: 'tora', w: 2, ja: '戸口に、小さな火が焚いてあるだろう。毎年、盆のこの夜にだけ', en: 'See the small fire at the doorway? He lights it every year, only on this Obon night.',
    a: { face: 'surprise', ja: '迎え火……？ 誰を迎えるための火なの？', en: 'A welcoming fire...? Who is it meant to welcome?' } },
  { who: 'yokai', gate: 'b2', ja: 'おまえも、こちら側だろう。……雪は、生きた者の肩にしか積もらぬ', en: 'You belong on our side too. ...Snow only settles on the shoulders of the living.',
    a: { face: 'sad', ja: 'わたしの肩……雪が、ひとつも積もってない', en: "My shoulders... there isn't a single flake on them." } },
  { who: 'tora', w: 2, ja: '灯、花火の下で、自分の影を見たことはあるかい', en: 'Akari, have you ever looked for your own shadow under the fireworks?',
    a: { face: 'surprise', ja: '影……。みんなの影はあるのに、わたしのだけ、どこにもない', en: 'My shadow... Everyone has one. Mine is nowhere.' } },
  { who: 'note', w: 2, ja: '七年。待つのには慣れた。ただ、あの子が迷っていないかだけが、気がかりだ', en: "Seven years. I'm used to waiting. I only worry that she's lost her way.",
    a: { face: 'sad', ja: '七年……？ 迷ってるのは、わたしのほうなの？', en: "Seven years...? Am I the one who's lost?" } },
  { who: 'mem', w: 2, ja: '（冷たい水。遠くで、じいちゃんがわたしの名前を呼んでいた）', en: '(Cold water. Far away, Grandpa was calling my name.)',
    a: { face: 'sad', ja: '……あれは、夢だよね。ねえ、夢だって言って', en: '...That was a dream, right? Please, tell me it was a dream.' } },
  { who: 'yokai', gate: 'r2', ja: '見物の衆は、みな盆に帰ってきた者たち。……おまえと同じだ', en: 'The crowd are all souls come home for Obon. ...Just like you.',
    a: { face: 'sad', ja: 'わたしと、同じ……。じゃあ、いなくなったのは——', en: 'Just like me... Then the one who disappeared was—' } },
  // 第三の世界 百鬼の宵山 — 真相
  { who: 'tora', w: 3, ja: 'そうだよ、灯。いなくなったのは、じいちゃんじゃない。おまえのほうだ', en: "That's right, Akari. It wasn't your grandpa who went missing. It was you.",
    a: { face: 'sad', ja: '……知ってた。じゃあ、どうしてわたしは、帰らずに逃げてるの？', en: '...I knew. Then why do I keep running instead of going home?' } },
  { who: 'note', w: 3, ja: '盆の三日だけ、あの子は帰ってくる。帰り道を、今年も空に描く', en: "For the three days of Obon, she comes home. This year again, I'll draw her way home in the sky.",
    a: { face: 'smile', ja: '一筆花火は、わたしの帰り道だったんだ……。なのに、どうして届かないの？', en: "Hitofude Hanabi was my way home... So why can't I reach it?" } },
  { who: 'yokai', w: 3, ja: '祭りを終わらせるなと、わしらに頼んだのは誰だと思う', en: 'Who do you think asked us never to let the festival end?',
    a: { face: 'surprise', ja: '……まさか', en: '...No way.' } },
  { who: 'yokai', gate: 'b3', ja: 'おまえだ、灯。「帰さないで。帰ったら、じいちゃんが泣くから」と', en: "It was you, Akari. 'Don't send me home. If I go back, Grandpa will cry.'",
    a: { face: 'sad', ja: 'だって……わたしが手を放したせいで、じいちゃんはひとりになったんだもの', en: "Because... it's my fault for letting go. Grandpa ended up all alone." } },
  { who: 'tora', w: 3, ja: '後ろの火はね、親方の迎え火なんだよ。おまえを捕まえに来ていたんじゃない。迎えに来ていたんだ', en: "That flame behind you is the master's welcoming fire. It never came to catch you. It came to bring you home.",
    a: { face: 'surprise', ja: 'ずっと逃げてた火が……じいちゃんの？', en: "The fire I've been running from... was Grandpa's?" } },
  { who: 'note', w: 3, ja: 'あの子が帰ってきたら、言うことは決めてある。叱らない。ひとことだけだ', en: "When she comes home, I know what I'll say. No scolding. Just one word.",
    a: { face: 'smile', ja: 'ひとこと……。じいちゃん、なんて言うつもりなの？', en: 'Just one word... Grandpa, what are you going to say?' } },
  { who: 'tora', w: 3, ja: '「振り返るな」はね、火から逃げろって意味じゃない。後ろを気にせず、まっすぐ帰っておいで、って意味さ', en: "'Don't look back' never meant 'run from the fire.' It meant: don't worry about what's behind you. Come straight home.",
    a: { face: 'joy', ja: '……うん。こんどは、逃げない', en: "...Okay. This time, I won't run." } },
  // 結末: 祭りを大団円で終えたときだけ（runOver）
  { who: 'hinoko', gate: 'r3', end: 1, ja: 'やっと、追いついた。……おかえり、灯', en: 'Finally, I caught up. ...Welcome home, Akari.',
    a: { face: 'laugh', ja: 'ただいま、じいちゃん', en: "I'm home, Grandpa." }, tail: { ja: 'トラ「また来年の盆に、おいで」', en: 'Tora: "Come again next Obon."' } },
];
export const TALE_N = TALE.length;

// 声のファイル名: 灯の返しの本文から（台詞を直すと名前が変わり、古い声は使われない）
export function voiceKey(text) { let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0; return 'a' + (h >>> 0).toString(36); }

// 次に読む頁。読める条件がそろっていなければ null。gates = これまでに勝った相手 { b1: 'kamaitachi', r1: ..., }
export function nextPage(read, gates, world, opts = {}) {
  const p = TALE[read]; if (!p) return null;
  if (p.end && !opts.end) return null;
  if (!p.end && opts.end) return null;
  if (p.gate && !gates[p.gate]) return null;
  if (p.w && world < p.w) return null;
  return p;
}
// 読めない頁の手前で、何をすれば続きが読めるか（負けた画面の一言）
export function lockReason(read, gates, world) {
  const p = TALE[read]; if (!p) return null;
  if (p.gate && !gates[p.gate]) { const w = +p.gate[1]; return p.gate[0] === 'b' ? { kind: 'boss', w } : { kind: 'raid', w }; }
  if (p.w && world < p.w) return { kind: 'world', w: p.w };
  return null;
}
