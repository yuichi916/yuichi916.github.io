// 一筆花火 2 — 夜明けの頁（灯の物語）。夜を越えるたびに 1 頁。負けても続きから読める。DOM に触らない
// 11/23 第 4 版（依頼主「最後が弱い。起承転結とオチ、最初は掛け合いでコミカル、最後は泣けるように」）: 持ちネタ 3 つ（二本引いちゃう・つけ・うそはつけない）と「ごはん、できたよ」を三度ずつ編み、最後の 2 頁（山場と後日談）で回収。jii=じいちゃん（声は追ってきた火と同じ）
// 11/22 第 3 版: 前半はボケとツッコミで本質的・短く、後半は物語の根幹（依頼主）
// 11/21 第 2 版（依頼主「情景が分からない・漫才みたいなテンポのかけあい・最初は背景を知らなくても分かって先を読みたくなる・進むほど真相」）
// 筋は「送り火」: いなくなったのは、じいちゃんではなく灯のほうだった。追ってくる火は、じいちゃんの迎え火。コンは、じいちゃんが灯のために詰めた赤い玉の火の子
// 人: akari=灯（ツッコミ） / kon=相棒の子狐（食いしん坊のボケ、語尾コン） / tora=屋台のねこ / note=じいちゃんの秘伝帳 / yokai=妖怪 / mem=灯の記憶 / hinoko=追ってきた火（じいちゃんの声）
// 声があるのは akari・kon・hinoko。f は灯の顔（tale/img/akari_<f>.webp）
// gate: b1〜b3=その世界の大一番（第 4 夜）に勝った / r1〜r3=その世界の大妖怪（第 8 夜）に勝った。w=その世界まで来ている（いまの周で）
const L = (w, ja, en, f) => ({ w, ja, en, ...(f ? { f } : {}) });
export const TALE = [
  // ── 第一の世界 川辺の夏祭り: 前半はボケとツッコミ。遊びの本質（一筆・追ってくる火・屋台）で短く笑わせ、謎はひとさじ
  { scene: { ja: `花火のあと、河原の屋台。灯と、相棒の子狐コン。`, en: `After the fireworks, at a riverside stall. Akari and her fox-cub partner, Kon.` }, lines: [
    L('kon', `灯、なんで線を一本しか引かないコン？`, `Akari, why do you only ever draw one line, kon?`),
    L('akari', `一筆花火だからだよ。とちゅうで指を離したら、おしまい`, `Because it's one-stroke fireworks. Lift your finger and it's over.`, 'smile'),
    L('kon', `コンなら、二本引いちゃうコン`, `I'd just draw two, kon.`),
    L('akari', `それはもう、ただの落書き！`, `Then it's just doodling!`, 'angry'),
  ] },
  { gap: 2, scene: { ja: `線を引くと、うしろから火が追ってくる。`, en: `Every line she draws, a flame chases it.` }, lines: [
    L('kon', `灯！ うしろから火が来てるコン！`, `Akari! The fire's right behind you, kon!`),
    L('akari', `知ってる！ だから急いで引いてるの！`, `I know! That's why I'm drawing fast!`, 'angry'),
    L('kon', `たいへんコン！ コンの尻尾にも火がついてるコン！`, `Oh no, kon! My tail's on fire too, kon!`),
    L('akari', `それ、もともと花火の模様でしょ！`, `That's just the firework pattern on your tail!`, 'angry'),
  ] },
  { gap: 2, scene: { ja: `屋台のトラが、小判を数えている。`, en: `Tora is counting coins at the stall.` }, lines: [
    L('kon', `トラ、お守りちょうだいコン。お代は、つけでコン`, `Tora, give me a charm, kon. Put it on my tab, kon.`),
    L('tora', `去年の分のつけは……まあ、いいさ`, `Last year's tab...? Eh, never mind.`),
    L('kon', `コンは、うそはつけないコン。……払ってないコン`, `I can't tell a lie, kon. ...I never paid, kon.`),
    L('akari', `去年……？ わたしたち、去年もここに来たの？`, `Last year...? We were here last year too?`, 'surprise'),
    L('tora', `……灯は毎年、おなじことを聞くんだよ`, `...Every year, Akari asks me the same thing.`),
  ] },
  { gate: 'b1', scene: { ja: `大一番に負けた妖怪が、屋台の屋根から灯を見下ろしている。`, en: `The yokai you beat at the boss night looks down from the stall roof.` }, lines: [
    L('yokai', `……強くなったな。だが、まだ帰さぬ`, `...You've grown strong. But you're not going home yet.`),
    L('akari', `帰さないって、どういうこと？`, `Not going home? What do you mean?`, 'angry'),
    L('yokai', `頼まれているのでな`, `We were asked to keep you here.`),
    L('kon', `だれにコン？ 名前と住所を言うコン！`, `By who, kon? Name and address, kon!`),
    L('akari', `取り調べじゃないんだから……`, `This isn't a police interview...`, 'angry'),
    L('yokai', `いずれ分かる。おまえがいちばんよく知っている者だ`, `You'll see. Someone you know better than anyone.`),
  ] },
  // ここから物語の根幹へ: 一筆花火とは何か・追ってくる火・手を放した記憶
  { scene: { ja: `屋台の棚に、古い帳面の切れはしが一枚。「秘伝帳」とある。`, en: `A torn scrap of an old notebook on the stall shelf. It says "Secret Notes."` }, lines: [
    L('akari', `……あ。この字、知ってる。じいちゃんの字だ`, `...Oh. I know this handwriting. It's Grandpa's.`, 'surprise'),
    L('note', `一筆花火は、帰り道を空に描く花火。——源`, `Hitofude Hanabi: fireworks that draw the way home across the sky. —Gen`),
    L('note', `振り返るな。尺玉だけは、追いかけるな`, `Don't look back. And never chase the great shell.`),
    L('kon', `尺玉って、いちばん大きい花火コン！ 追いかけたいコン！`, `The great shell is the biggest firework, kon! I wanna chase it, kon!`),
    L('akari', `だめって書いてあるでしょ`, `It literally says don't.`, 'angry'),
  ] },
  { scene: { ja: `今夜も、ぎりぎりで火から逃げきった。`, en: `Tonight, she barely escaped the flame again.` }, lines: [
    L('akari', `ねえトラ。あの火、なんでわたしを追ってくるの？`, `Hey, Tora. Why does that flame keep chasing me?`, 'angry'),
    L('tora', `怖いかい`, `Scared?`),
    L('akari', `怖いよ！ 毎晩追いかけられてるんだよ！`, `Of course! It chases me every single night!`, 'angry'),
    L('kon', `コンは、あの火、ちょっと好きコン。あったかいにおいがするコン`, `I kind of like it, kon. It smells warm, kon.`),
    L('tora', `……そのにおい、覚えておおき`, `...Remember that smell.`),
  ] },
  { scene: { ja: `綿あめの屋台の前で、灯がふいに立ち止まった。`, en: `In front of the cotton-candy stall, Akari suddenly stops.` }, lines: [
    L('kon', `綿あめ！ 灯、買ってほしいコン！`, `Cotton candy! Buy me some, Akari, kon!`),
    L('akari', `はいはい……`, `Okay, okay...`, 'smile'),
    L('mem', `（綿あめの匂い。大きな手。……その手を、わたしが放した）`, `(The smell of cotton candy. A big, warm hand. ...And I let go of it.)`),
    L('akari', `……ごめん、コン。いまの、なに……？`, `...Sorry, Kon. What was that...?`, 'sad'),
    L('kon', `灯、顔がまっさおだコン。綿あめは、あしたでいいコン`, `You've gone pale, kon. Cotton candy can wait till tomorrow, kon.`),
  ] },
  { gate: 'r1', scene: { ja: `討たれた大妖怪が、雪の山の奥を指さした。`, en: `The defeated great yokai points deep into the snowy mountains.` }, lines: [
    L('yokai', `思い出したか。あの夏の夜、おまえは祭りの灯りを離れて、川へ走った`, `Remember now? That summer night, you left the festival lights and ran to the river.`),
    L('akari', `川へ……？ わたし、なんで……`, `To the river...? Why would I...`, 'sad'),
    L('yokai', `あの火に捕まるな。捕まれば、おまえの祭りは終わる`, `Don't let that flame catch you. If it does, your festival is over.`),
    L('yokai', `……負けは負けだ。知りたければ、雪の山の奥へ行け。あの男が待っている`, `...A loss is a loss. If you want to know, go deep into the snowy mountains. That man is waiting.`),
    L('kon', `あの男って、だれコン？`, `What man, kon?`),
    L('akari', `……じいちゃんだ`, `...Grandpa.`, 'surprise'),
  ] },
  // ── 第二の世界 雪の山里: じいちゃんの側
  { w: 2, scene: { ja: `雪の山里。灯りのついた家で、老人がひとり、花火の玉を詰めている。`, en: `A snowy village. In a lit house, an old man is packing firework shells alone.` }, lines: [
    L('akari', `じいちゃん！ じいちゃーん！`, `Grandpa! Grandpaaa!`, 'joy'),
    L('kon', `……灯、聞こえてないみたいコン`, `...He can't hear you, kon.`),
    L('akari', `なんで？ こんなに近くにいるのに`, `Why? I'm right here.`, 'surprise'),
    L('tora', `ここは、じいちゃんの冬だよ。花火のない季節に、ああしてひとりで玉を詰めるのさ`, `This is your grandpa's winter. In the season without fireworks, he packs shells all alone.`),
    L('akari', `ひとりで……？ わたし、ここにいるのに`, `Alone...? But I'm here.`, 'sad'),
    L('jii', `ごはん、できたよ。灯`, `Dinner's ready, Akari.`),
  ] },
  { w: 2, scene: { ja: `作業台に、詰めたばかりの赤い玉。秘伝帳が開いている。`, en: `A freshly packed red shell on the workbench. The notebook lies open.` }, lines: [
    L('note', `今年も、あの子の分の玉を詰めた。三寸、赤。あの子の好きな色`, `Packed her shell again this year. Three-inch, red. Her favorite color.`),
    L('akari', `赤……わたしの好きな色だ`, `Red... that's my favorite color.`, 'smile'),
    L('kon', `コンも赤が好きコン。……なんでか、わかんないけどコン`, `I like red too, kon. ...Not sure why, kon.`),
    L('akari', `「あの子の分」って、わたしのことだよね。なんで毎年……？`, `"Her shell" means me, right? Why every year...?`, 'surprise'),
  ] },
  { w: 2, scene: { ja: `家の戸口で、小さな火が焚かれている。雪の中でも消えない。`, en: `A small fire burns at the doorway. Even in the snow, it won't go out.` }, lines: [
    L('kon', `灯、あの火、見たことあるコン`, `Akari, I've seen that fire before, kon.`),
    L('akari', `え、どこで？`, `Huh? Where?`, 'surprise'),
    L('kon', `毎晩、灯のうしろで見てるコン`, `Behind you. Every night, kon.`),
    L('akari', `……わたしを追ってくる火と、同じ色`, `...It's the same color as the flame that chases me.`, 'surprise'),
    L('tora', `盆の夜に焚く、迎え火さ。……じいちゃんは、冬でも消さないんだ`, `A welcoming fire, for Obon nights. ...Your grandpa never lets it go out, not even in winter.`),
    L('akari', `迎え火って……帰ってくる人を、迎える火だよね`, `A welcoming fire... for welcoming someone who comes home.`, 'sad'),
  ] },
  { gate: 'b2', scene: { ja: `大一番に負けた雪女が、灯の肩にそっと手を置いた。`, en: `The snow woman you beat lays a hand gently on Akari's shoulder.` }, lines: [
    L('yokai', `冷たくないのか`, `Isn't it cold?`),
    L('akari', `ぜんぜん。雪女さんの手、やさしいね`, `Not at all. Your hand is gentle.`, 'smile'),
    L('yokai', `……雪は、生きた者の肩にしか積もらぬ`, `...Snow only settles on the shoulders of the living.`),
    L('kon', `コンの背中にも、ひとつも積もってないコン`, `Not one flake on my back either, kon.`),
    L('akari', `……ほんとだ。ひとつも、積もってない`, `...You're right. Not a single flake.`, 'sad'),
  ] },
  { w: 2, scene: { ja: `花火が上がるたび、雪の上にみんなの影がのびる。`, en: `Every firework stretches everyone's shadow across the snow.` }, lines: [
    L('kon', `影ふみしようコン！ 灯の影、ふむコン！`, `Let's play shadow tag, kon! I'll step on yours, kon!`),
    L('akari', `いいよ、ほら……`, `Sure, here...`, 'joy'),
    L('kon', `……灯の影、どこコン？`, `...Where's your shadow, kon?`),
    L('akari', `え？`, `Huh?`, 'surprise'),
    L('tora', `……影ふみは、また今度にしな`, `...Save shadow tag for another time.`),
  ] },
  { w: 2, scene: { ja: `秘伝帳の、まんなかあたりの頁。`, en: `A page near the middle of the notebook.` }, lines: [
    L('note', `七年。待つのには慣れた。ただ、あの子が迷っていないかだけが、気がかりだ`, `Seven years. I'm used to waiting. I only worry that she's lost her way.`),
    L('akari', `七年……？ わたし、七年もどこにいたの？`, `Seven years...? Where have I been for seven years?`, 'surprise'),
    L('kon', `灯は迷子じゃないコン。コンがついてるコン`, `You're not lost, kon. You've got me, kon.`),
    L('akari', `……コンのほうが、すぐ迷子になるくせに`, `...You're the one who always gets lost.`, 'smile'),
    L('kon', `それはそれ、これはこれコン`, `That's a different story, kon.`),
    L('kon', `迷子になったら、コンが二本目で道を引くコン`, `If we get lost, I'll draw a second line to show the way, kon.`),
    L('kon', `「それはもう、ただの落書き！」……って言うコン？`, `"Then it's just doodling!"... is what you'll say, right, kon?`),
    L('akari', `……先に言わないで`, `...Don't steal my line.`, 'smile'),
  ] },
  { w: 2, scene: { ja: `凍った川をわたるとき、灯の足がすくんだ。`, en: `Crossing the frozen river, Akari's legs freeze.` }, lines: [
    L('mem', `（尺玉の火を追って、川へ。冷たい水。遠くで、じいちゃんがわたしの名前を呼んでいた）`, `(I chased the great shell's fire into the river. Cold water. Far away, Grandpa was calling my name.)`),
    L('akari', `……ねえ、コン。いまの、夢だよね`, `...Hey, Kon. That was a dream, right?`, 'sad'),
    L('kon', `……`, `...`),
    L('akari', `夢だって、言ってよ`, `Tell me it was a dream.`, 'sad'),
    L('kon', `コンは、うそはつけないコン`, `I can't lie to you, kon.`),
  ] },
  { gate: 'r2', scene: { ja: `討たれた大妖怪が、花火を見上げる顔のない見物の衆を見わたした。`, en: `The defeated great yokai looks out over the faceless crowd watching the fireworks.` }, lines: [
    L('yokai', `見物の衆は、みな盆に帰ってきた者たち`, `The crowd are all souls who came home for Obon.`),
    L('akari', `帰ってきた……って、どこから？`, `Came home... from where?`, 'surprise'),
    L('yokai', `あの世からだ。……おまえと同じだ`, `From the other side. ...Just like you.`),
    L('akari', `わたしと、同じ……。じゃあ、いなくなったのは——`, `Just like me... Then the one who disappeared was—`, 'sad'),
    L('kon', `灯、その先は宵山で聞くコン。百鬼の祭りが、呼んでるコン`, `Akari, ask the rest at the demon festival, kon. It's calling us, kon.`),
  ] },
  // ── 第三の世界 百鬼の宵山: 真相
  { w: 3, scene: { ja: `妖怪たちの夜祭り、百鬼の宵山。トラが、いつもの屋台で待っていた。`, en: `The Night of a Hundred Demons. Tora is waiting at the usual stall.` }, lines: [
    L('akari', `トラ。いなくなったの、わたしのほうだよね`, `Tora. I'm the one who went missing, aren't I?`, 'sad'),
    L('tora', `……ああ`, `...Yes.`),
    L('akari', `ほんとは、ずっと前から知ってた`, `Deep down, I always knew.`, 'sad'),
    L('kon', `灯……`, `Akari...`),
    L('akari', `じゃあ、なんでわたし、帰らないで逃げてるの？`, `Then why do I keep running instead of going home?`, 'sad'),
    L('tora', `それは、この祭りの主に聞くといい`, `Ask the master of this festival.`),
  ] },
  { w: 3, scene: { ja: `秘伝帳の、終わり近くの頁。`, en: `A page near the end of the notebook.` }, lines: [
    L('note', `盆の祭りの夜だけ、あの子は帰ってくる。帰り道を、空に描く`, `Only on the festival nights of Obon does she come home. I draw her way home in the sky.`),
    L('akari', `一筆花火は、わたしの帰り道だったんだ`, `Hitofude Hanabi was my way home.`, 'sad'),
    L('kon', `じゃあ、花火をたどれば帰れるコン！`, `Then just follow the fireworks home, kon!`),
    L('akari', `なのに、いつも届かないの。なんでだろう`, `But I never reach it. Why?`, 'sad'),
    L('kon', `コンが二本目を引いたら、届くコン？`, `What if I draw a second line, kon? Would it reach, kon?`),
    L('akari', `だから、それは落書きだってば`, `I keep telling you, that's doodling.`, 'smile'),
    L('kon', `……灯が、うしろの火から逃げてるからコン`, `...Because you keep running from the fire behind you, kon.`),
    L('tora', `……それと、二本目はやめときな。引いた火の子は燃えつきる。次の玉で生まれても、なにも覚えてないよ`, `...And forget the second line. A spark that draws it burns out. Even reborn in a new shell, it remembers nothing.`),
  ] },
  { w: 3, scene: { ja: `宵山の行列から、次の大一番の妖怪が顔を出した。`, en: `From the demon parade, the next boss yokai peers out.` }, lines: [
    L('yokai', `祭りを終わらせるな、と、わしらに頼んだのは誰だと思う`, `Who do you think asked us never to let the festival end?`),
    L('kon', `……トラ、なにか知ってるコン？`, `...Tora, do you know something, kon?`),
    L('tora', `わたしじゃないよ`, `Not me.`),
    L('akari', `……待って。まさか`, `...Wait. No way.`, 'surprise'),
  ] },
  { gate: 'b3', scene: { ja: `大一番に負けた妖怪が、灯の前にひざをついた。`, en: `The yokai you beat kneels before Akari.` }, lines: [
    L('yokai', `この祭りの主は、おまえだ、灯。「帰さないで。帰ったら、じいちゃんが泣くから」と`, `The master of this festival is you, Akari. "Don't send me home. If I go back, Grandpa will cry."`),
    L('akari', `……だって、わたしが手を放したから。じいちゃんは、ひとりになったんだもん`, `...Because I let go of his hand. And he ended up all alone.`, 'sad'),
    L('kon', `ちがうコン！ じいちゃん、泣いてないコン。待ってるだけコン`, `No, kon! Grandpa isn't crying, kon. He's just waiting, kon.`),
    L('akari', `コン……？`, `Kon...?`, 'surprise'),
  ] },
  { w: 3, scene: { ja: `灯の線のうしろで、あの火が、今夜もゆらゆら燃えている。`, en: `Behind Akari's line, that flame flickers again tonight.` }, lines: [
    L('tora', `あの火はね、じいちゃんの迎え火なんだよ`, `That flame is your grandpa's welcoming fire.`),
    L('akari', `わたしを捕まえに来てたんじゃ、ないの？`, `It wasn't coming to catch me?`, 'surprise'),
    L('tora', `迎えに来ていたんだ`, `It was coming to bring you home.`),
    L('kon', `やっぱり、あったかいにおいだったコン`, `I knew it smelled warm, kon.`),
    L('akari', `……ほんとだ。あったかい`, `...You're right. It's warm.`, 'sad'),
  ] },
  { w: 3, scene: { ja: `秘伝帳の、最後の頁。`, en: `The last page of the notebook.` }, lines: [
    L('note', `あの子が帰ってきたら、言うことは決めてある。叱らない。ひとことだけだ`, `When she comes home, I know what I'll say. No scolding. Just one word.`),
    L('kon', `ひとことって、なにコン？ 「つけを払え」コン？`, `One word? Like "Pay your tab," kon?`),
    L('akari', `それは、トラの言いたいことでしょ`, `That's what TORA wants to say.`, 'smile'),
    L('akari', `……でも、なんて言ってくれるのかな`, `...But I wonder what he'll say.`, 'smile'),
    L('kon', `聞きに行くコン、灯！`, `Let's go find out, Akari, kon!`),
  ] },
  { w: 3, scene: { ja: `最後の夜の前。トラが、屋台の灯りを消した。`, en: `Before the last night, Tora puts out the stall lantern.` }, lines: [
    L('kon', `トラ、お守りちょうだいコン。お代は、つけでコン`, `Tora, give me a charm, kon. Put it on my tab, kon.`),
    L('tora', `つけは、ないよ`, `There is no tab.`),
    L('tora', `毎年、じいちゃんが払っていったのさ。「あの子が来たら、好きなだけ持たせてやってくれ」ってね`, `Your grandpa paid it every year. "When she comes, let her take whatever she likes," he said.`),
    L('akari', `……じいちゃん`, `...Grandpa.`, 'sad'),
    L('tora', `……振り返るんじゃないよ`, `...Don't look back.`),
    L('akari', `……うん。こんどは、逃げない`, `...Okay. This time, I won't run.`, 'joy'),
    L('kon', `コンも、いっしょに帰るコン！`, `I'm coming home with you, kon!`),
    L('tora', `いっておいで。最後の一筆だ`, `Go on. One last stroke.`),
  ] },
  // ── 結末: 祭りを大団円で終えたときだけ（runOver）
  { gate: 'r3', end: 1, scene: { ja: `最後の花火が消えかけた空。灯は、もう逃げなかった。うしろの迎え火が、あと少しのところで、灯の背に届かない。`, en: `The last firework is fading. Akari has stopped running. Behind her, the welcoming fire falls just short of reaching her back.` }, lines: [
    L('akari', `届かない……！ あと少しなのに`, `I can't reach it...! I'm so close!`, 'hurt'),
    L('kon', `灯、コンが二本目を引くコン`, `Akari, I'll draw the second line, kon.`),
    L('akari', `だめ！ それは、ただの落書き……`, `No! That's just doodling...`, 'surprise'),
    L('kon', `落書きでいいコン。尻尾の火は、もともと花火の模様コン`, `Doodling's fine, kon. The fire on my tail was always a firework pattern, kon.`),
    L('nar', `コンの火が、灯の線のとなりを走って、つないだ。迎え火が、灯の背に届く。大きな手の、温度だった。灯は、指を離さなかった。`, `Kon's fire raced beside Akari's line and joined it. The welcoming fire reached her back. It was the warmth of a big hand. Akari did not lift her finger.`),
    L('jii', `ごはん、できたよ。灯`, `Dinner's ready, Akari.`),
    L('akari', `……ただいま、じいちゃん`, `...I'm home, Grandpa.`, 'sad'),
    L('jii', `……今年も、返事はなしか`, `...No answer again this year.`),
    L('akari', `ここだよ。じいちゃん、ここにいるよ`, `I'm here, Grandpa. I'm right here.`, 'hurt'),
    L('jii', `……あったかいな。おかえり、灯`, `...It's warm. Welcome home, Akari.`),
    L('akari', `コン……？ コン、どこ？`, `Kon...? Kon, where are you?`, 'surprise'),
    L('kon', `また来年も、会えるコン`, `We'll meet again next year, kon.`),
    L('akari', `……うそつき。綿あめ、まだ買ってあげてないのに`, `...Liar. I still haven't bought you that cotton candy.`, 'sad'),
  ] },
  // ── 後日談: 大団円の 24 頁のあとに続けて（図鑑からも）。次の年の盆、新しい赤い玉の火の子は、覚えていないはずの灯を覚えていた（第 4.4 版・ハッピーエンド）。
  // 24 頁の自分の言葉を思わず言う→約束（綿あめ）は尻尾の火に残る→トラが 18 頁の決まりを破れた理由を言う→「うそはつけない」で 24 頁の「また来年も」が本当になる→じいちゃん「ふたり分」
  { gate: 'r3', scene: { ja: `次の年の盆。河原の屋台に灯りがともる。棚の上に、新しい赤い玉がひとつ。`, en: `The next Obon. The riverside stall lights up. On the shelf sits one new red shell.` }, lines: [
    L('tora', `今年は、まっすぐ来たね`, `You came straight here this year.`),
    L('akari', `うん。ぜんぶ、覚えてるよ`, `Yeah. I remember everything.`, 'smile'),
    L('akari', `……ねえトラ、その赤い玉は？`, `...Hey, Tora, what's that red shell?`, 'surprise'),
    L('tora', `じいちゃんが、今年も詰めていったのさ。三寸、赤`, `Your grandpa packed it again this year. Three-inch, red.`),
    L('kon', `はじめましてコン。線、二本引いていいコン？`, `Nice to meet you, kon. Can I draw two lines, kon?`),
    L('akari', `それはもう、ただの落書き！`, `Then it's just doodling!`, 'angry'),
    L('kon', `落書きでいいコン。尻尾の火は、もともと花火の模様コン`, `Doodling's fine, kon. The fire on my tail was always a firework pattern, kon.`),
    L('akari', `コン……？ コン、覚えてるの？`, `Kon...? Kon, you remember?`, 'smile'),
    L('kon', `綿あめ、まだ買ってもらってないコン。約束は、尻尾の火に残るコン`, `You still haven't bought me cotton candy, kon. Promises stay in the fire on my tail, kon.`),
    L('tora', `……覚えてないはずなんだがね。よっぽど熱い約束だったんだね`, `...He shouldn't remember a thing. That must have been one hot promise.`),
    L('akari', `……うそつきって言って、ごめん。ちゃんと来てくれた`, `...Sorry I called you a liar. You really came back.`, 'smile'),
    L('kon', `コンは、うそはつけないコン`, `I can't lie to you, kon.`),
    L('jii', `ごはん、できたよ。今年は、ふたり分だ`, `Dinner's ready. This year, it's for two.`),
  ], tail: { ja: `トラ「さあ、ふたり分の一筆だ」`, en: `Tora: "Now then. A stroke for two."` } },
];
export const TALE_N = TALE.length;
// 物語の出しはじめ: これまでに越えた夜がこの数になってから（第 1〜2 夜で帰る人が多い。まずは遊びだけ）
export const TALE_START = 3;
// 頁がどの世界の話か（8 頁ずつ）。前の世界の頁が残っていたら、一晩に 2 頁まで続けて読ませて追いつく
export const pageWorld = (i) => Math.floor(i / 8) + 1;

// ボス戦の会話（カットイン）。intro は世界ごとの大一番（b）・大妖怪（r）の始まり、atk は攻めが決まったとき、hurt はやられたとき
export const BATTLE = {
  intro: {
    b1: [L('akari', `なにあれ、顔こわっ！`, `Whoa, that face is scary!`, 'surprise'), L('kon', `灯、コンのうしろに隠れていいコン！`, `Hide behind me, Akari, kon!`)],
    b2: [L('akari', `寒っ……！ でも、火は消えないよ！`, `So cold...! But my fire won't go out!`, 'angry'), L('kon', `コンの尻尾で、あっためるコン！`, `I'll warm you up with my tail, kon!`)],
    b3: [L('akari', `もう逃げない。正面から行く！`, `No more running. Straight at it!`, 'angry'), L('kon', `灯、かっこいいコン！`, `Akari, you're so cool, kon!`)],
    r1: [L('akari', `でっか……！`, `It's huge...!`, 'surprise'), L('kon', `でも、花火のほうがでっかいコン！`, `But fireworks are huger, kon!`)],
    r2: [L('akari', `ここで負けたら、じいちゃんに会えない！`, `If I lose here, I'll never see Grandpa!`, 'angry'), L('kon', `灯、いくコン！`, `Let's go, Akari, kon!`)],
    r3: [L('akari', `これが最後。いっしょに行こう、コン！`, `This is the last one. Come with me, Kon!`, 'angry'), L('kon', `どこまでも、いっしょだコン！`, `Anywhere, together, kon!`)],
  },
  atk: [
    L('akari', `いっけええ！`, `Gooo!`, 'angry'), L('kon', `コーーン！`, `Koooon!`),
    L('akari', `これでどうだ！`, `Take that!`, 'angry'), L('kon', `灯、かっこいいコン！`, `So cool, Akari, kon!`),
    L('akari', `花火は、まだまだあるよ！`, `I've got plenty more fireworks!`, 'joy'),
  ],
  hurt: [
    L('akari', `きゃっ……！`, `Kyah...!`, 'hurt'), L('kon', `灯！ けが、ないコン！？`, `Akari! Are you okay, kon!?`),
    L('akari', `いったぁ……！`, `Owww...!`, 'hurt'), L('kon', `よくも灯を！ ゆるさないコン！`, `How dare you hurt Akari, kon!`),
    L('akari', `まだ……負けない！`, `I'm... not done yet!`, 'hurt'),
  ],
};

// 夜のあとのひとこと（11/22 依頼主「1 夜以降の会話がでなくなることがある」）: 読める頁がない夜に、屋台の上で 2 行だけ。
// 物語の頁は先へ進むと読める作りなので、同じ周回では頁がない夜が続く。そこを埋める。筋の核心には触れず、遊びのこつをボケとツッコミで
export const BANTER = {
  1: [
    [L('kon', `灯、お守りって食べられるコン？`, `Akari, can we eat charms, kon?`), L('akari', `食べない！ 持ち物を押すと売れるよ`, `No! Tap one you hold to sell it.`, 'angry')],
    [L('kon', `金の玉、かじったら固かったコン`, `I bit a gold shell. So hard, kon.`), L('akari', `小判じゃないから！`, `It's not a coin!`, 'angry')],
    [L('kon', `火がこわいなら、線を短くするコン`, `Scared of the fire? Draw short lines, kon.`), L('akari', `短いと、点も短いの`, `Short line, short score.`, 'smile')],
    [L('kon', `提灯の玉のあとは、ぜんぶ二倍コン？`, `After a Lantern, it's all double, kon?`), L('akari', `そう。だから、つなぐ順番が大事`, `Yes. So the order you link them matters.`, 'smile')],
    [L('kon', `トラのつけ、また増えたコン`, `My tab with Tora grew again, kon.`), L('akari', `わたしの小判で払わないでね`, `Don't pay it with my coins.`, 'angry')],
  ],
  2: [
    [L('kon', `雪、冷たいコン。しっぽを巻くコン`, `Snow's cold, kon. Tail scarf time.`), L('akari', `わたしの首に巻かないで！`, `Not around my neck!`, 'angry')],
    [L('kon', `氷の玉、線を引いてもひらかないコン`, `Ice shells won't open with a line, kon.`), L('akari', `近くの花火で、とかすの`, `Melt them with a blast nearby.`, 'smile')],
    [L('kon', `風が吹くと、玉が流れていくコン`, `The wind blows the shells away, kon.`), L('akari', `白い輪が出たら、先回り！`, `See a white ring? Get ahead!`, 'joy')],
    [L('kon', `お守りの袋、もういっぱいコン`, `The charm bag is full, kon.`), L('akari', `弱いのを売って、空ければいいよ`, `Sell a weak one to make room.`, 'smile')],
    [L('kon', `雪だるまに、花火の目をつけたコン`, `I gave the snowman firework eyes, kon.`), L('akari', `燃えてる！ とけてる！`, `They're burning! It's melting!`, 'surprise')],
  ],
  3: [
    [L('kon', `妖怪の屋台、おいしそうコン`, `The yokai stalls smell good, kon.`), L('akari', `中身は、聞かないでおこう`, `Let's not ask what's inside.`, 'surprise')],
    [L('kon', `大妖怪、ちょっとこわいコン`, `The great yokai is kinda scary, kon.`), L('akari', `技をしのげば、ボーナスだよ`, `Survive its technique for a bonus.`, 'smile')],
    [L('kon', `灯の線、前よりまっすぐコン`, `Your lines are straighter now, kon.`), L('akari', `まっすぐじゃなくて、迷わなくなったの`, `Not straighter. I just don't hesitate.`, 'laugh')],
    [L('kon', `小判、ためるとふえるコン？`, `Do coins grow if we save them, kon?`), L('akari', `利息がつくよ。使いどきも大事`, `They earn interest. Spend them in time.`, 'smile')],
    [L('kon', `最後の夜まで、あと少しコン`, `Almost at the last night, kon.`), L('akari', `うん。ちゃんと咲かせよう`, `Yeah. Let's make it bloom.`, 'joy')],
  ],
};

// 声のファイル名: 話し手と本文から（台詞を直すと名前が変わり、古い声は使われない）
export function voiceKey(who, text) { const s = who + '|' + text; let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return 'v' + (h >>> 0).toString(36); }
export const VOICED = new Set(['akari', 'kon', 'hinoko', 'jii', 'tora', 'note', 'mem', 'nar']); // 11/23 依頼主「2 人以外も声をつけたい」: トラ・秘伝帳（じいちゃんの声）・灯の記憶（灯のささやき）・語り。妖怪は 'yokai.<名>' で妖怪ごとの声

// 次に読む頁。読める条件がそろっていなければ null。gates = これまでに勝った相手 { b1: 'kamaitachi', r1: ..., }
// opts.nights = これまでに越えた夜の数・opts.last = 前の頁を出したときの nights。ボスに勝った頁（gate）は間を待たない
export function nextPage(read, gates, world, opts = {}) {
  const p = TALE[read]; if (!p) return null;
  if (!!p.end !== !!opts.end) return null;
  if (p.gate && !gates[p.gate]) return null;
  if (p.w && world < p.w) return null;
  if (!p.gate && opts.nights != null) {
    if (read === 0 && opts.nights < TALE_START) return null;
    if (read > 0 && opts.nights - (opts.last || 0) < (p.gap || 1)) return null;
  }
  return p;
}
// 読めない頁の手前で、何をすれば続きが読めるか（負けた画面の一言）
export function lockReason(read, gates, world) {
  const p = TALE[read]; if (!p) return null;
  if (p.gate && !gates[p.gate]) { const w = +p.gate[1]; return p.gate[0] === 'b' ? { kind: 'boss', w } : { kind: 'raid', w }; }
  if (p.w && world < p.w) return { kind: 'world', w: p.w };
  return null;
}
