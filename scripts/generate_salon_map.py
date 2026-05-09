#!/usr/bin/env python3
"""Generate the new salon.html with a unified hierarchical interactive map.

3 zoom levels:
  L0: 14 genre bubbles on 2D plane (still↔intense × inst↔vocal)
  L1: Click genre → sub-current bubbles + essay + featured artists appear
  L2: Click sub-current → list of all artists in that sub-current

Album counts are removed everywhere — pure musical visualization.
All ~1162 artists are mapped (categorized or in "others" bucket per genre).
"""
import json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MUSIC_DATA = Path("C:/tmp/music_data.json")
OUT = ROOT / "salon.html"

# ─── Genre & subgroup categorization ────────────────────────────────
# Each genre has position (x,y) on the 2D map (1000×620 viewBox).
# Each subgroup has a manually-curated list of representative artists.
# All remaining artists from the folder dump go into the "others" bucket.

GENRES = {
    "ambient": {
        "name_jp": "アンビエント", "name_en": "Ambient", "latin": "Sigilla Aetheris",
        "x": 180, "y": 160, "color": "#7a8a5c",
        "essence": "夜と冬の儀式音楽。",
        "essay": "Brian Eno が定義したアンビエントは「気付かなくても良い音楽」だが、 ここに住むアンビエントは <em>気付かれることを覚悟した儀式音楽</em>。 共通するのは <em>Black Metal の出自を持つ作曲家が、 静寂を選び直したとき</em> に書かれる音楽だ。",
        "key": "Ambient",
        "subgroups": [
            {"name_jp": "北欧フォーク・アンビエント", "name_en": "Nordic Folk Ambient",
             "blurb": "アコギ＋ピアノ＋雪原。 神秘思想家がポストロックを学んだような肌触り。",
             "artists": ["Tenhi", "Kauan", "Fjallstorm"]},
            {"name_jp": "ドイツ・ゴシック・ファンタジー", "name_en": "German Gothic Fantasy",
             "blurb": "暖炉とラテン語と中世の墓所。 Empyrium はその純粋形。",
             "artists": ["Empyrium", "Dargaard", "NACHTREICH", "Nucleus Torn"]},
            {"name_jp": "国産・東洋ハイブリッド", "name_en": "JP / Hybrid",
             "blurb": "ヨーロッパ的儀式音楽を日本語の語彙で書き直した稀少。",
             "artists": ["IN SCISSORS", "MURGRIND"]},
        ],
    },
    "healing": {
        "name_jp": "ヒーリング ＆ ニューエイジ", "name_en": "Healing & New Age", "latin": "Quies Animae",
        "x": 280, "y": 200, "color": "#8aa68a",
        "essence": "静かさという器。 内側は混沌。",
        "essay": "コレクション最大の部屋。 「ヒーリング」というラベルは <em>器であって、 ジャンルではない</em>。 静かである、という共通点だけで、 内側は混沌としている。 <strong>Akira Kosemura・Anoice・Aukai</strong> は名目上ヒーリングだが、 音楽的には <strong>Bill Evans (Jazz) と Michelangeli (Classic) の隣にいる</strong>。",
        "key": "Healing＆New_age",
        "subgroups": [
            {"name_jp": "ポストクラシカル", "name_en": "Post-Classical",
             "blurb": "ECMジャズと現代ピアニズムの中間。 21世紀の静謐。",
             "artists": ["Akira Kosemura", "Anoice", "Aukai", "Balmorhea", "Aaron Amida Ang"]},
            {"name_jp": "クロスオーバー・ピアノ", "name_en": "Crossover Piano",
             "blurb": "古典の文法で大衆を捕まえる派手な系譜。",
             "artists": ["Maksim Mrvica", "Bandari"]},
            {"name_jp": "ケルト・スピリチュアル", "name_en": "Celtic Spiritual",
             "blurb": "ペンタトニックと女性ボーカル。 部屋の温度を 2℃下げる。",
             "artists": ["Druid", "Ah Nee Mah", "Celtic Fairy Lullaby", "Angel Tears"]},
            {"name_jp": "自然＋楽器ブレンド", "name_en": "Nature + Instrument Blend",
             "blurb": "Natureジャンルとの境界線にいる派閥。",
             "artists": ["Andrea Rongioletti", "Hennie Bekker", "Acoustic Ocean", "Air Element"]},
            {"name_jp": "睡眠・スパ機能音楽", "name_en": "Sleep / Spa",
             "blurb": "「気分転換」 ではなく 「儀式」 として効く機能音楽。",
             "artists": ["7and5", "Acker Bilk", "Acoustic Cafe", "Akiko Usui"]},
        ],
    },
    "progressive": {
        "name_jp": "プログレッシブ", "name_en": "Progressive", "latin": "Architectura Sonora",
        "x": 380, "y": 430, "color": "#728aa2",
        "essence": "50年を貫く構築美。",
        "essay": "<strong>Genesis (1973) Selling England by the Pound</strong> から <strong>Big Big Train (2026) Woodcut</strong> まで、 50年を貫いている。 Symphonic / Avant (RIO) / Modern Prog の三方向に、 ほぼ等距離で散らばっている。 <em>「複雑さに耐えられる」 ことと、 美しさを諦めない こと</em> の両立を求める姿勢を示す。",
        "key": "Progressive",
        "subgroups": [
            {"name_jp": "英国シンフォニック古典", "name_en": "English Symphonic Canon",
             "blurb": "田園詩 + 12分組曲 + メロトロン。",
             "artists": ["Big Big Train", "Cast"]},
            {"name_jp": "地中海ネオプログ", "name_en": "Mediterranean Neoprog",
             "blurb": "古典文法を保ったまま、 21世紀に書く派。",
             "artists": ["Barock Project", "Celeste", "A.C.T", "Ciccada"]},
            {"name_jp": "RIO / アヴァン・ロック", "name_en": "RIO / Avant",
             "blurb": "即興と現代音楽の境界。",
             "artists": ["ART BEARS", "After Crying", "Aranis", "All Traps on Earth", "Acintya"]},
            {"name_jp": "周辺・現代", "name_en": "Modern / Periphery",
             "blurb": "シネマティック・ジャズ寄りの周縁部。",
             "artists": ["Ainur", "Air Craft", "Anacrusa", "Andre Mehmari", "Ann Gaytan", "Apairys", "Asturias", "Autumn Chorus"]},
        ],
    },
    "jazz": {
        "name_jp": "ジャズ ＆ フュージョン", "name_en": "Jazz & Fusion", "latin": "Vox Silentii",
        "x": 440, "y": 370, "color": "#9272a2",
        "essence": "ECM的沈黙。 静かなのに緊張している。",
        "essay": "これは <em>ECM 的</em> な部屋。 共通項は ── <em>静かなのに緊張している</em> こと。 炸裂する Free Jazz は ほぼ無い。 <em>北欧寄り、 内省寄り、 ピアノトリオ寄り</em>。 米国・イスラエル・北欧・イタリア・ブラジル ── ECM地理学がそのまま地図になっている。",
        "key": "Jazz&Fusion",
        "subgroups": [
            {"name_jp": "ECMピアノトリオ", "name_en": "ECM Piano Trio",
             "blurb": "50年・国境を越える「沈黙の精度」の系譜。",
             "artists": ["Bill Evans Trio", "Bill Evans, Jim Hall", "Eddie Higgins", "Esjbjorn Svensson Trio", "Helge Lien Trio & Tore Brunborg", "Great Jazz Trio", "Enrico Pieranunzi"]},
            {"name_jp": "室内楽ジャズ", "name_en": "Chamber Jazz",
             "blurb": "デュオ・ベース×ギター・室内編成。",
             "artists": ["Charlie Haden & Pat Metheny", "Charles Mingus", "Gerry Mulligan", "Eric Dolphy"]},
            {"name_jp": "地中海＆中東", "name_en": "Mediterranean / Middle East",
             "blurb": "ECMの周縁。",
             "artists": ["Avishai Cohen", "Gabriele Mirabassi e Richard Galliano", "Giovanni Mirabassi  Trio & Strings", "Andrea Abbadia"]},
            {"name_jp": "電化フュージョン", "name_en": "Electric Fusion",
             "blurb": "例外的に明るい袋。",
             "artists": ["Bill Laurance", "Bill Laurance & Michael League", "Brian Culbertson", "Billy Childs", "David Benoit & Russ Freeman"]},
        ],
    },
    "classic": {
        "name_jp": "クラシック", "name_en": "Classic", "latin": "Clavium Aurum",
        "x": 260, "y": 320, "color": "#a89272",
        "essence": "タッチと呼吸の系譜。",
        "essay": "教養の部屋ではない。 もっと狭くて深い <em>ピアニズム</em> という部屋。 交響曲全集はおいてない。 「タッチ」 と 「呼吸」 で選ばれた手の動き。 <strong>辻井伸行 → Hayato Sumino → まらしぃ</strong> という日本の系譜が並ぶのは、 国を選ばず音色を聴く耳の表れ。",
        "key": "Classic",
        "subgroups": [
            {"name_jp": "黄金期巨匠", "name_en": "Golden-era Masters",
             "blurb": "ベートーヴェン・ラフマニノフを金属の重さで弾く系譜。",
             "artists": ["The Art of Arturo Benedetti Michelangeli", "Gilils", "Rachmaninoff Piano Concerto 2-Rubinstein 1950 & 1956", "Leopold Wlach"]},
            {"name_jp": "21世紀の鍵盤", "name_en": "21st Century Keys",
             "blurb": "古典 × YouTube × 武道館。",
             "artists": ["Hayato Sumino", "Nobuyuki Tsujii", "まらしぃ"]},
        ],
    },
    "metal": {
        "name_jp": "メタル ＆ ハードロック", "name_en": "Metal & Hard Rock", "latin": "Tonitru Sacrum",
        "x": 800, "y": 430, "color": "#a25252",
        "essence": "物語性とメロディ。",
        "essay": "<em>シンフォニック / パワー / ファンタジー直系</em> の選盤が中核。 純粋な Stoner / Doom 系は ほぼ無い。 ここの基準は <em>「物語性とメロディ」</em>。 つまり <strong>Indies の Imperial Circus DD・Asriel と同じ穴のムジナ</strong>。 ドイツ・北欧が中心で、 米国メタルは少ない。",
        "key": "Metal&Hard_rock",
        "subgroups": [
            {"name_jp": "ジャーマン・ファンタジー・パワー", "name_en": "German Fantasy Power",
             "blurb": "トールキン × メタル。",
             "artists": ["Blind Guardian", "Beast in Black", "Crowne", "Damian Hamada's Creatures"]},
            {"name_jp": "シンフォニック / ネオクラ", "name_en": "Symphonic / Neoclassical",
             "blurb": "弦楽 × ピアノ × ソプラノ。",
             "artists": ["Adagio", "Ancient Bards", "Amberian Dawn", "Astralion"]},
            {"name_jp": "北欧メロデス・ブラック", "name_en": "Nordic Melodeath / Black",
             "blurb": "旋律と攻撃の同時実行。",
             "artists": ["Amorphis", "Dark Tranquillity", "Children of Bodom", "Behemoth", "Arch Enemy", "Dark Lunacy", "Dalriada", "Dark Moor", "Dark the Suns"]},
            {"name_jp": "和テイストのメタル", "name_en": "Japanese Metal",
             "blurb": "同人メタルへの伏線でもある。",
             "artists": ["Damian Hamada's Creatures", "Cacophony", "Chthonic"]},
        ],
    },
    "indies": {
        "name_jp": "インディーズ ／ 同人", "name_en": "Indies (Doujin)", "latin": "Mythos Privatus",
        "x": 700, "y": 490, "color": "#724a82",
        "essence": "過剰さの自由。",
        "essay": "日本の同人音楽シーン。 <em>シンフォニックメタル × アニメ的物語性 × オペラ的女性ボーカル</em> の混合体。 商業流通から外れることで <em>「過剰さの自由」</em> を獲得した。 海外の人がこの音楽を聴くと <em>「日本人は何かに取り憑かれている」</em> と思うことがある。 取り憑かれている。",
        "key": "Indies",
        "subgroups": [
            {"name_jp": "シンフォニック・デス・アニソン", "name_en": "Symphonic-Death-Anime",
             "blurb": "過剰の頂点。",
             "artists": ["Imperial Circus Dead Decadence", "Asriel", "Dragon Guardian", "Garnet Cathedral", "Dark PHOENiX"]},
            {"name_jp": "ゴシック × ヴァイオリン", "name_en": "Gothic + Violin",
             "blurb": "西洋的暗黒美学。",
             "artists": ["CROSS VEIN", "Aura Noctis"]},
            {"name_jp": "シューゲーザー寄り", "name_en": "Shoegaze-leaning",
             "blurb": "浮遊する女性ボーカル系。",
             "artists": ["Aleile", "Frost Fragment", "B.rose&crown", "Octaviagrace"]},
            {"name_jp": "ノベルゲーOST周辺", "name_en": "VN-OST Adjacent",
             "blurb": "ゲーム音楽との境界アーティスト。",
             "artists": ["AYUTRICA", "Hagall×152Hz", "AL Fantasia", "Barbarian On The Groove", "CORONA", "Dark PHOENiX"]},
        ],
    },
    "jpop": {
        "name_jp": "JPOP", "name_en": "JPOP", "latin": "Cantus Insularis",
        "x": 560, "y": 490, "color": "#a27262",
        "essence": "物語の歌い手。",
        "essay": "大衆向けの部屋に見えて、 内側はかなり<em>偏っている</em>。 共通項は <em>「物語性のあるボーカル」</em>。 アイドルポップやJ-Rapはほぼ皆無。 <strong>Aimer・Garnet Crow・Ado</strong> は <em>物語の歌い手脊椎</em> として <strong>Loreena McKennitt</strong>、 <strong>Aukai</strong> と地続き。",
        "key": "JPOP",
        "subgroups": [
            {"name_jp": "王道JPOP/ロック", "name_en": "Mainstream JPOP/Rock",
             "blurb": "武道館を埋める音楽。",
             "artists": ["B'z", "BUMP OF CHICKEN", "GLAY", "JAM Project", "Creepy Nuts"]},
            {"name_jp": "現代叙情ボーカル", "name_en": "Contemporary Lyrical Vocal",
             "blurb": "アニメ主題歌の鋳型を更新した世代。",
             "artists": ["Aimer", "Ado", "Garnet Crow", "Faylan", "Hakubi"]},
            {"name_jp": "ヴィジュアル系・ゴシック", "name_en": "Visual-kei / Gothic",
             "blurb": "耽美と物語の長期戦。",
             "artists": ["Ali project", "Gackt", "KAMIJO", "Janne Da Arc", "Kagrra"]},
            {"name_jp": "インストゥルメンタル", "name_en": "Instrumental",
             "blurb": "ボーカル中心の部屋に小さく開く器楽の窓。",
             "artists": ["DJ OKAWARI", "ADAM at"]},
        ],
    },
    "celt": {
        "name_jp": "ケルト ＆ ファンタジー ＆ ヴァイオリン", "name_en": "Celt & Fantasy & Violin", "latin": "Mythos Vivus",
        "x": 380, "y": 240, "color": "#8a6a8a",
        "essence": "夜の森と城。",
        "essay": "このコレクションの<em>魂の住処</em>。 ケルト・中世・ダークファンタジー・北欧叙事詩 が、 ひとつの部屋に集まっている。 主成分は <em>「夜の森と城」</em>。 <strong>Adrian von Ziegler</strong> は YouTube経由で世界中のファンタジーゲーム愛好家に届いた21世紀の現象。",
        "key": "Celt&Fantasy&Violin",
        "subgroups": [
            {"name_jp": "ファンタジー量産派", "name_en": "Fantasy Prolific",
             "blurb": "ゲーム/YouTube文化の音楽供給源。",
             "artists": ["Adrian von Ziegler", "Antti Martikainen", "Austin Wintory", "Caprice"]},
            {"name_jp": "中世女性復興", "name_en": "Medieval Female Revival",
             "blurb": "スペイン・イタリア発の古楽再演。",
             "artists": ["Trobar De Morte", "Ana Alcaide", "Aura Noctis"]},
            {"name_jp": "ケルト・トラディショナル", "name_en": "Celtic Traditional",
             "blurb": "アイルランド・スコットランド本流。",
             "artists": ["Altan", "Celtic Thunder", "Beyond The Woods", "Barry O'sullivan"]},
            {"name_jp": "クロスオーバー器楽", "name_en": "Crossover Instrumental",
             "blurb": "ロックを古楽器で弾く派。",
             "artists": ["2Cellos", "David Garrett", "David Davidson", "Darryl Way", "Darol Anger", "Ayasa_Best_Album_-_BEST_II_FLAC"]},
        ],
    },
    "game": {
        "name_jp": "ゲーム", "name_en": "Game", "latin": "Mundi Ludendi",
        "x": 600, "y": 320, "color": "#62a262",
        "essence": "物語のために書かれた音楽。",
        "essay": "RPG中心、 そしてダークファンタジー寄り。 <em>「物語と音楽が同時に進行するメディア」</em> としてのゲーム音楽。 アニメ音楽との違いは、 <em>ループ前提で書かれている</em> こと。 30秒のループでも飽きさせない設計が、 そのまま作曲技術に反映している。",
        "key": "Game",
        "subgroups": [
            {"name_jp": "JRPG伝統", "name_en": "JRPG Tradition",
             "blurb": "1980-90年代から続く土台。",
             "artists": ["Final Fantasy", "Dragon Quest", "Falcom Sound Team jdk collection", "Baten Kaitos", "Fire Emblem", "Bravely Default OST"]},
            {"name_jp": "ダークファンタジーOST", "name_en": "Dark Fantasy OST",
             "blurb": "メトロイドヴァニアの慟哭系統。",
             "artists": ["ENDER LILIES", "Dies irae", "DemonsRoots", "DRACULA"]},
            {"name_jp": "ビジュアルノベル音楽", "name_en": "Visual Novel Music",
             "blurb": "泣きゲーの音楽資産。",
             "artists": ["9-nine- Sound Premium Record", "AKABEiSOFT2", "ALcot", "AUGUST", "CROSS†CHANNEL ～In memory of all people～ SPECIAL SOUNDTRACK", "Ever17_OST", "FAVORITE"]},
            {"name_jp": "ジャンル越境作曲家", "name_en": "Genre-Crossing Composers",
             "blurb": "Mili・Revo・Christopher Tin。",
             "artists": ["Calling All Dawns", "Donkey Kong Country Trilogy", "Epic Game Music"]},
        ],
    },
    "anime": {
        "name_jp": "アニメ", "name_en": "Anime", "latin": "Imagines Mobiles",
        "x": 680, "y": 260, "color": "#a26262",
        "essence": "美しさと悲劇の同居。",
        "essay": "OST中心。 ベストアルバムが少ない。 <em>「番組の世界観を音楽で持ち帰る」</em> 目的の収集。 取り上げる作品の傾向 ── <em>「美しさと悲劇の同居」</em> を扱うものが目立つ。 ギャグ系・スポーツ系の OST はほぼ無い。",
        "key": "Anime",
        "subgroups": [
            {"name_jp": "叙事詩・戦闘OST", "name_en": "Epic / Battle OST",
             "blurb": "中川幸太郎・梶浦由記系列。",
             "artists": ["Code Geass Sound Collection", "Akame ga KILL! アカメが斬る！", "86 Eighty-six", "Fate Stay Night", "Hunter X Hunter"]},
            {"name_jp": "オーケストラ復権", "name_en": "Orchestral Revival",
             "blurb": "Evan Call・藤澤慶昌の新世代叙情。",
             "artists": ["Frieren Beyond Journey's End Original Soundtrack", "Charlotte Original Soundtrack", "A Place Further than the Universe"]},
            {"name_jp": "異形のOPテーマ", "name_en": "Singular OP Themes",
             "blurb": "ラテン語・呪術・幽玄。",
             "artists": ["Elfen Lied Original Soundtrack", "KOTOKO", "Helck"]},
            {"name_jp": "古典名作", "name_en": "Classic Anime",
             "blurb": "子供時代から続く根。",
             "artists": ["BEST OF INUYASHA 百花繚乱 -犬夜叉 テーマ全集-", "Dragon Ball", "NARUTO－ナルト－Best Hit Collection", "CLIMAX Anime Hits"]},
        ],
    },
    "nature": {
        "name_jp": "ネイチャー", "name_en": "Nature", "latin": "Vox Mundi",
        "x": 170, "y": 280, "color": "#92a2a8",
        "essence": "人を消す音。",
        "essay": "純粋なフィールドレコーディングと、 <em>「自然音 + 楽器」 のハイブリッド</em> が同居する部屋。 ここは <em>「音楽を聴かない時間」</em> のための音。 cabin.html の WebAudio 合成と地続き。 違いは、 こちらは<em>本物の地球を録音した</em>ものが多いこと。",
        "key": "Nature",
        "subgroups": [
            {"name_jp": "純粋フィールド", "name_en": "Pure Field",
             "blurb": "地球の声を録音する人々。",
             "artists": ["Gordon Hempton", "Dan Gibson's Solitudes", "Echoes Of Nature", "Forest Ambience", "Brian Hardin", "Boom Library SOE Autumn"]},
            {"name_jp": "ピアノ + 自然", "name_en": "Piano + Nature",
             "blurb": "「ピアノで自然をなぞる」 派。",
             "artists": ["Andrew Fitzgerald", "Marcia Green - Morning Piano and Nature Sounds", "Helen Rhodes & Joseph Wade"]},
            {"name_jp": "ハイブリッド", "name_en": "Hybrid",
             "blurb": "自然音 + フルート + シンセ。",
             "artists": ["Hennie Bekker", "KENJI KIHARA", "Larkin"]},
            {"name_jp": "睡眠・スパ用途", "name_en": "Sleep / Spa",
             "blurb": "機能音楽。",
             "artists": ["K Ambient Sounds", "Nature Sound Healing.ape", "Nature Sound Retreat"]},
        ],
    },
    "blues-folk": {
        "name_jp": "ブルース ＆ フォーク", "name_en": "Blues & Folk", "latin": "Cantores Antiqui",
        "x": 520, "y": 280, "color": "#7a6a52",
        "essence": "物語の歌い手 (起点)。",
        "essay": "純粋な Blues は不在。 ここは <em>Folk の中の最も詩的・最もケルトな部分</em> を切り出した部屋。 <strong>Loreena McKennitt</strong> は <em>シルクロードを音楽化</em>した人。 一人で「東洋的ケルト」というジャンルを作った。",
        "key": "Blues&Fork",
        "subgroups": [
            {"name_jp": "ケルト・物語の歌い手", "name_en": "Celtic Storytellers",
             "blurb": "storyteller spine の起点。",
             "artists": ["Loreena McKennitt", "McKennitt, Loreena", "Natalie Merchant...Ophelia"]},
            {"name_jp": "中世復興", "name_en": "Medieval Revival",
             "blurb": "非英語圏の古楽再演。",
             "artists": ["Annwn -《Orbis Alia》", "Liberte", "Joran Elane", "Neun Welten"]},
            {"name_jp": "フォーク叙情", "name_en": "Lyrical Folk",
             "blurb": "アメリカン・フォークの少数派。",
             "artists": ["Lucy Rose", "Rickie Lee Jones", "Take A Picture"]},
            {"name_jp": "ハイブリッド", "name_en": "Hybrid",
             "blurb": "ゴシック × フォーク。",
             "artists": ["Autumn Tears", "Iridio"]},
        ],
    },
    "pop-rock": {
        "name_jp": "ポップ ＆ ロック", "name_en": "Pop & Rock", "latin": "Mores Communes",
        "x": 430, "y": 510, "color": "#828a52",
        "essence": "対外用ポケット。",
        "essay": "<em>「世間の良いとされるもの」 と 「個人の好み」 が交わる、 ゆるい中間地帯</em>。 SACDやハイレゾ盤が多めなのは、 <strong>音質オタクとしての矜持</strong> がここでは前面に出ているから。 <strong>Hans Zimmer の Interstellar</strong> はパイプオルガンで宇宙を鳴らした最高到達点。",
        "key": "POP&Rock",
        "subgroups": [
            {"name_jp": "王道ロック・ポップ", "name_en": "Mainstream Rock/Pop",
             "blurb": "大衆向けの音質保管。",
             "artists": ["Bon Jovi 2010", "Foo Fighters", "Deep Purple", "Dua Lipa", "Eminem", "Kylie Minogue", "Helene Fischer", "Jamiroquai", "Bon Jovi"]},
            {"name_jp": "劇場・シネマ", "name_en": "Theatre / Cinema",
             "blurb": "物語と劇場の音。",
             "artists": ["Hans Zimmer", "Andrea Bocelli", "Concerto Moon", "Jackie Evancho", "Ernie Watts"]},
            {"name_jp": "インディー叙情", "name_en": "Indie Lyrical",
             "blurb": "静謐なロックの小袋。",
             "artists": ["Death Cab for Cutie", "Death Cab For Cutie", "Copeland", "Einar Stray", "Jack's Mannequin"]},
            {"name_jp": "シンガーソングライター", "name_en": "Singer-Songwriter",
             "blurb": "ベテラン・名匠枠。",
             "artists": ["Ben Folds & Nick Hornby", "Judee Sill", "Leon Russell", "Hans Zimmer - Interstellar"]},
        ],
    },
}


# ─── Spines (5 cross-genre bridges) ──────────────────────────────
SPINES = [
    {"name": "Fantasy Spine", "name_jp": "夜の森・神話・剣の歌", "color": "#c474b4",
     "nodes": [
        {"name": "Empyrium", "genre": "ambient"},
        {"name": "Tenhi", "genre": "ambient"},
        {"name": "Trobar de Morte", "genre": "celt"},
        {"name": "Antti Martikainen", "genre": "celt"},
        {"name": "Adrian von Ziegler", "genre": "celt"},
        {"name": "Imperial Circus DD", "genre": "indies"},
     ]},
    {"name": "Pianism Spine", "name_jp": "タッチと呼吸の系譜", "color": "#e8c478",
     "nodes": [
        {"name": "Michelangeli", "genre": "classic"},
        {"name": "辻井伸行", "genre": "classic"},
        {"name": "Hayato Sumino", "genre": "classic"},
        {"name": "まらしぃ", "genre": "classic"},
        {"name": "Akira Kosemura", "genre": "healing"},
        {"name": "2Cellos", "genre": "celt"},
     ]},
    {"name": "Quiet Jazz Spine", "name_jp": "静けさの精度", "color": "#8cc4d8",
     "nodes": [
        {"name": "Bill Evans", "genre": "jazz"},
        {"name": "Charlie Haden", "genre": "jazz"},
        {"name": "Esbjörn Svensson", "genre": "jazz"},
        {"name": "Helge Lien Trio", "genre": "jazz"},
        {"name": "Aukai", "genre": "healing"},
     ]},
    {"name": "Symphonic-Operatic Spine", "name_jp": "過剰さの神聖", "color": "#d28e8e",
     "nodes": [
        {"name": "Blind Guardian", "genre": "metal"},
        {"name": "Adagio", "genre": "metal"},
        {"name": "Asriel", "genre": "indies"},
        {"name": "Imperial Circus", "genre": "indies"},
        {"name": "Ali project", "genre": "jpop"},
        {"name": "Hans Zimmer", "genre": "pop-rock"},
     ]},
    {"name": "Storyteller Spine", "name_jp": "物語の歌い手", "color": "#9ed29e",
     "nodes": [
        {"name": "Loreena McKennitt", "genre": "blues-folk"},
        {"name": "Natalie Merchant", "genre": "blues-folk"},
        {"name": "Aimer", "genre": "jpop"},
        {"name": "Garnet Crow", "genre": "jpop"},
        {"name": "Aukai", "genre": "healing"},
     ]},
]


def build_data():
    music = json.loads(MUSIC_DATA.read_text(encoding="utf-8"))
    out = {}
    for slug, g in GENRES.items():
        all_artists = music.get(g["key"], [])
        # Build a set of categorized artist names (case-insensitive folder match)
        categorized_set = set()
        for sg in g["subgroups"]:
            for a in sg["artists"]:
                categorized_set.add(a.lower())
        # Find artists in folder but not in any subgroup
        others = [a for a in all_artists if a.lower() not in categorized_set]
        out[slug] = {
            **{k: v for k, v in g.items() if k != "key"},
            "all_artists": all_artists,
            "others": others,
        }
    return out, SPINES


# ─── HTML output ────────────────────────────────────────────────
HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Salon des Sons — 音の客間 / 音楽性の地図</title>
<meta name="description" content="個人音楽コレクションの音楽性可視化。14ジャンル × ~50サブクラスタ × 全アーティスト。階層化された地図をクリックで詳細化。">
<meta name="theme-color" content="#0a0814">
<link rel="canonical" href="https://yuichi916.github.io/salon.html">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<script data-goatcounter="https://viewsengineer.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Shippori+Mincho:wght@500;700;900&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{
  --night:#0a0814;--night-2:#14101a;--night-3:#1c1428;--velvet:#2a1822;
  --wine:#7a2a3a;--gold:#d4a050;--amber:#f0c878;--amber-soft:#f8e0a0;
  --paper:#ece2c8;--paper-dim:#c9beaa;--ink-soft:#897b65;--ink-faint:#5a4f42;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;background:var(--night)}
body{
  background:var(--night);color:var(--paper-dim);
  font-family:"Shippori Mincho","Cormorant Garamond",serif;
  font-feature-settings:"palt";line-height:1.85;
  -webkit-font-smoothing:antialiased;overflow-x:hidden;
}
.serif{font-family:"Shippori Mincho","Cormorant Garamond",serif}
.eng{font-family:"Cormorant Garamond",serif;font-style:italic}
.mono{font-family:"JetBrains Mono",monospace;letter-spacing:.06em}
a{color:var(--amber);text-decoration:none}a:hover{color:var(--amber-soft)}

body::after{
  content:"";position:fixed;inset:0;z-index:200;pointer-events:none;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.7 0 0 0 0 0.6 0 0 0 0 0.4 0 0 0 0.04 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  opacity:.3;mix-blend-mode:overlay;
}

.bar{position:fixed;top:0;left:0;right:0;z-index:60;
  display:flex;align-items:center;justify-content:space-between;
  padding:18px 32px;background:linear-gradient(180deg, rgba(10,8,20,.92), rgba(10,8,20,0));
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}
.bar .brand{display:flex;align-items:center;gap:14px;
  font-family:"Cormorant Garamond",serif;font-style:italic;font-size:18px;color:var(--amber);letter-spacing:.06em;}
.bar .vinyl{width:18px;height:18px;border-radius:50%;
  background:radial-gradient(circle at 40% 40%, var(--amber-soft), var(--amber) 30%, var(--velvet) 70%, var(--night) 100%);
  box-shadow:0 0 14px rgba(240,200,120,.5);animation:rotate 24s linear infinite;}
@keyframes rotate{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.bar .nav{display:flex;gap:24px;font-family:"Inter",sans-serif;font-size:13px;letter-spacing:.06em}
.bar .nav a{color:var(--paper-dim)}.bar .nav a:hover{color:var(--amber)}
.bar .back{font-family:"Inter",sans-serif;font-size:13px;color:var(--ink-soft);letter-spacing:.06em}
.bar .back:hover{color:var(--amber)}
@media(max-width:780px){.bar{padding:14px 18px}.bar .nav{display:none}}

.hero{position:relative;min-height:60vh;
  display:flex;align-items:center;justify-content:center;
  padding:140px 32px 60px;
  background:radial-gradient(ellipse 60% 40% at 50% 60%, rgba(212,160,80,.06), transparent 70%),
    radial-gradient(ellipse 80% 60% at 80% 20%, rgba(122,42,58,.18), transparent 60%),var(--night);
  overflow:hidden;}
.hero-content{position:relative;text-align:center;max-width:900px;z-index:5}
.hero-eyebrow{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:18px;letter-spacing:.4em;text-transform:uppercase;
  color:var(--amber);margin-bottom:36px;
  display:inline-flex;align-items:center;gap:18px;}
.hero-eyebrow::before,.hero-eyebrow::after{content:"";width:48px;height:1px;background:linear-gradient(to right,transparent,var(--amber),transparent)}
.hero-title-en{font-family:"Cormorant Garamond",serif;font-style:italic;font-weight:500;
  font-size:clamp(36px,5vw,72px);letter-spacing:.02em;
  color:var(--paper);margin-bottom:14px;text-shadow:0 0 24px rgba(240,200,120,.18);}
.hero-title-jp{font-family:"Shippori Mincho",serif;font-weight:700;
  font-size:clamp(48px,7vw,88px);letter-spacing:.08em;
  color:var(--paper);margin-bottom:36px;line-height:1.1;
  text-shadow:0 0 28px rgba(240,200,120,.2);}
.hero-title-jp em{font-style:normal;color:var(--amber);text-shadow:0 0 24px rgba(240,200,120,.45)}
.hero-sub{font-family:"Shippori Mincho",serif;font-size:clamp(15px,1.6vw,18px);
  color:var(--paper-dim);max-width:680px;margin:0 auto;line-height:2;}

.sec{position:relative;padding:80px 32px;border-top:1px solid rgba(212,160,80,.1)}
.sec-inner{max-width:1200px;margin:0 auto}
.sec-eyebrow{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:14px;letter-spacing:.32em;text-transform:uppercase;
  color:var(--amber);margin-bottom:24px;display:flex;align-items:center;gap:14px;}
.sec-eyebrow::before{content:"";width:36px;height:1px;background:var(--amber)}
.sec-title{font-family:"Shippori Mincho",serif;font-weight:700;
  font-size:clamp(30px,4vw,52px);line-height:1.25;letter-spacing:.04em;
  color:var(--paper);margin-bottom:32px;max-width:800px;}
.sec-title em{font-style:normal;color:var(--amber);text-shadow:0 0 20px rgba(240,200,120,.32)}
.sec-lead{font-family:"Shippori Mincho",serif;font-size:16px;line-height:2.0;
  color:var(--paper-dim);max-width:780px;margin-bottom:32px;}
.sec-lead em{color:var(--amber);font-style:italic}.sec-lead strong{color:var(--paper)}

/* ── MAP ── */
.map-wrap{position:relative;width:100%;
  background:radial-gradient(ellipse at 50% 50%, rgba(28,20,40,.6), rgba(10,8,20,.3) 70%, transparent),var(--night-2);
  border:1px solid rgba(212,160,80,.18);border-radius:8px;padding:18px;
  min-height:600px;
}
.map-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px;flex-wrap:wrap}
.map-breadcrumb{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:14px;color:var(--paper-dim);letter-spacing:.06em}
.map-breadcrumb .sep{color:var(--ink-soft);margin:0 10px}
.map-breadcrumb a{color:var(--amber);cursor:pointer}
.map-breadcrumb .current{color:var(--paper)}
.map-back{font-family:"Inter",sans-serif;font-size:13px;color:var(--ink-soft);
  background:transparent;border:1px solid rgba(212,160,80,.32);
  padding:6px 14px;border-radius:4px;cursor:pointer;letter-spacing:.06em;
  transition:all .25s;}
.map-back:hover{color:var(--amber);border-color:var(--amber)}
.map-back[disabled]{opacity:.4;cursor:not-allowed}

.mapsvg{display:block;width:100%;height:auto;aspect-ratio:5/3}
.mapsvg .axis{stroke:rgba(212,160,80,.14);stroke-dasharray:3,4;stroke-width:1}
.mapsvg .ax-label{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:11px;
  fill:var(--ink-soft);letter-spacing:.18em;text-transform:uppercase}
.mapsvg .genre-bubble{cursor:pointer;transition:opacity .4s}
.mapsvg .genre-bubble circle{transition:r .4s, fill-opacity .25s}
.mapsvg .genre-bubble:hover circle{fill-opacity:.7}
.mapsvg .genre-bubble text{font-family:"Shippori Mincho",serif;font-weight:700;
  fill:var(--paper);text-anchor:middle;dominant-baseline:middle;pointer-events:none}
.mapsvg .genre-bubble .en{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:9px;fill:var(--amber);text-anchor:middle}
.mapsvg .subgroup-bubble{cursor:pointer;transition:opacity .4s, transform .4s}
.mapsvg .subgroup-bubble circle{transition:fill-opacity .25s}
.mapsvg .subgroup-bubble:hover circle{fill-opacity:.85}
.mapsvg .subgroup-bubble text{font-family:"Shippori Mincho",serif;font-weight:500;
  fill:var(--paper);text-anchor:middle;dominant-baseline:middle;pointer-events:none;font-size:11px}

/* ── PANEL ── */
.panel{position:relative;margin-top:24px;padding:24px;
  background:rgba(28,20,40,.55);border:1px solid rgba(212,160,80,.18);border-radius:6px;
  display:none;}
.panel.open{display:block;animation:panel-in .35s ease}
@keyframes panel-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.panel-head{display:flex;align-items:baseline;gap:18px;margin-bottom:18px;flex-wrap:wrap}
.panel-jp{font-family:"Shippori Mincho",serif;font-weight:700;font-size:30px;color:var(--paper);letter-spacing:.04em}
.panel-en{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:18px;color:var(--amber)}
.panel-latin{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:11px;
  letter-spacing:.32em;text-transform:uppercase;color:var(--ink-soft)}
.panel-essence{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:18px;color:var(--amber-soft);margin-bottom:14px;letter-spacing:.04em}
.panel-essay{font-family:"Shippori Mincho",serif;font-size:15.5px;line-height:2.0;color:var(--paper-dim);margin-bottom:22px}
.panel-essay em{color:var(--amber);font-style:italic}
.panel-essay strong{color:var(--paper);font-weight:700}

.subgroup-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:14px}
.subgroup-card{background:rgba(20,16,26,.6);border:1px solid rgba(212,160,80,.14);
  border-radius:5px;padding:18px;cursor:pointer;transition:all .25s;}
.subgroup-card:hover{background:rgba(42,24,34,.6);border-color:rgba(240,200,120,.4);transform:translateY(-2px)}
.subgroup-card.active{background:rgba(122,42,58,.25);border-color:var(--amber)}
.subgroup-card .sg-jp{font-family:"Shippori Mincho",serif;font-weight:700;font-size:16px;color:var(--paper);letter-spacing:.04em;margin-bottom:4px}
.subgroup-card .sg-en{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:12px;color:var(--amber);letter-spacing:.06em;margin-bottom:8px}
.subgroup-card .sg-blurb{font-family:"Shippori Mincho",serif;font-size:13.5px;line-height:1.85;color:var(--paper-dim)}
.subgroup-card .sg-count{font-family:"JetBrains Mono",monospace;font-size:10px;color:var(--ink-soft);letter-spacing:.18em;margin-top:8px}

.artist-list{margin-top:18px;padding:18px;background:rgba(10,8,16,.55);border:1px dashed rgba(212,160,80,.2);border-radius:4px;display:none;}
.artist-list.open{display:block;animation:panel-in .35s ease}
.artist-list-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.artist-list-title{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:14px;letter-spacing:.18em;color:var(--amber);text-transform:uppercase}
.artist-list-count{font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--ink-soft);letter-spacing:.18em}
.artist-chips{display:flex;flex-wrap:wrap;gap:8px}
.artist-chip{font-family:"Shippori Mincho",serif;font-size:13px;
  padding:6px 14px;background:rgba(28,20,40,.7);border:1px solid rgba(212,160,80,.18);
  border-radius:999px;color:var(--paper-dim);transition:all .2s;}
.artist-chip:hover{background:rgba(122,42,58,.3);border-color:var(--amber);color:var(--paper)}
.artist-chip.uncategorized{font-style:italic;color:var(--ink-soft);font-size:12px}

/* ── Spines ── */
.spines{position:relative;width:100%;background:radial-gradient(ellipse at 50% 50%, rgba(122,42,58,.1), rgba(10,8,20,.2) 70%, transparent),rgba(20,16,26,.8);
  border:1px solid rgba(212,160,80,.18);border-radius:6px;padding:24px;}
.spines-svg{display:block;width:100%;height:auto;aspect-ratio:16/10}
.spines-svg .spine{stroke-width:1.6;fill:none;stroke-linecap:round;opacity:.85}
.spines-svg .node circle{fill:var(--night-3);stroke-width:1.4}
.spines-svg .node text{font-family:"Shippori Mincho",serif;font-size:11px;fill:var(--paper);text-anchor:middle}
.spines-svg .spine-label{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:13px}
.spines-legend{display:flex;flex-direction:column;gap:14px;margin-top:24px}
.spines-legend .item{display:flex;align-items:flex-start;gap:14px;
  font-family:"Shippori Mincho",serif;font-size:14px;color:var(--paper-dim);line-height:1.85;}
.spines-legend .item .swatch{width:32px;height:3px;flex-shrink:0;margin-top:9px;}
.spines-legend .item strong{color:var(--paper);margin-right:6px}

.closer{text-align:center;padding:120px 32px;
  background:radial-gradient(ellipse 60% 40% at 50% 50%, rgba(122,42,58,.12), transparent 70%),var(--night-2);}
.closer .quote{font-family:"Shippori Mincho",serif;font-weight:500;
  font-size:clamp(22px,3vw,36px);line-height:1.85;letter-spacing:.04em;
  color:var(--paper);max-width:740px;margin:0 auto 32px;}
.closer .quote em{color:var(--amber);font-style:normal}
.closer .src{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:14px;letter-spacing:.22em;color:var(--ink-soft);}

.foot{padding:40px 32px;text-align:center;
  font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:13px;color:var(--ink-soft);letter-spacing:.1em;
  border-top:1px solid rgba(212,160,80,.1);}
.foot a{color:var(--ink-soft);margin:0 12px}.foot a:hover{color:var(--amber)}
</style>
</head>
<body>

<header class="bar">
  <a href="#top" class="brand"><span class="vinyl"></span><span>Salon des Sons</span></a>
  <nav class="nav">
    <a href="#map">Map</a>
    <a href="#spines">Spines</a>
  </nav>
  <a href="index.html" class="back">← Views Engineer</a>
</header>

<section class="hero" id="top">
  <div class="hero-content">
    <div class="hero-eyebrow">A Personal Atlas of Sound</div>
    <h1 class="hero-title-en">Salon des Sons</h1>
    <h1 class="hero-title-jp">音 の <em>客間</em>。</h1>
    <p class="hero-sub serif">
      14 の ジャンル と、 50 の サブクラスタ と、 すべての アーティスト を、<br>
      <em>ひとつの 階層化 された 地図</em> として 並べる。<br>
      クリック で どんどん 詳細化 する。
    </p>
  </div>
</section>

<section class="sec" id="map">
  <div class="sec-inner">
    <div class="sec-eyebrow eng">Hierarchical Map · 階層化地図</div>
    <h2 class="sec-title serif">クリック で <em>掘り下げる</em>、 音楽性 の 地図。</h2>
    <div class="sec-lead">
      <p>14 の ジャンル を、<strong>静謐 ↔ 激情</strong> の 縦軸 と <strong>器楽 ↔ 声楽</strong> の 横軸 の 上 に 配置 した。 <em>ジャンル を クリック</em> すると 内側 が ひらき、 サブクラスタ が 現れる。 <em>サブクラスタ を クリック</em> すると、 そこ に 住む アーティスト の 一覧 が 開く。</p>
    </div>

    <div class="map-wrap">
      <div class="map-toolbar">
        <div class="map-breadcrumb" id="breadcrumb">
          <span class="current">All Genres</span>
        </div>
        <button class="map-back" id="mapBack" disabled>← 戻る</button>
      </div>
      <svg class="mapsvg" viewBox="0 0 1000 620" id="mapSvg">
        <line class="axis" x1="500" y1="40" x2="500" y2="580"/>
        <line class="axis" x1="40" y1="310" x2="960" y2="310"/>
        <text class="ax-label" x="500" y="28" text-anchor="middle">↑ 静 謐  STILLNESS</text>
        <text class="ax-label" x="500" y="608" text-anchor="middle">激 情  INTENSITY ↓</text>
        <text class="ax-label" x="38" y="314" text-anchor="end">器 楽 ←</text>
        <text class="ax-label" x="962" y="314" text-anchor="start">→ 声 楽</text>
        <g id="layerGenre"></g>
        <g id="layerSubgroup"></g>
      </svg>
      <div class="panel" id="panel">
        <div class="panel-head">
          <div class="panel-jp" id="panelJp"></div>
          <div class="panel-en" id="panelEn"></div>
          <div class="panel-latin" id="panelLatin"></div>
        </div>
        <div class="panel-essence" id="panelEssence"></div>
        <div class="panel-essay" id="panelEssay"></div>
        <div class="subgroup-grid" id="subgroupGrid"></div>
        <div class="artist-list" id="artistList">
          <div class="artist-list-head">
            <div class="artist-list-title eng" id="artistListTitle"></div>
            <div class="artist-list-count mono" id="artistListCount"></div>
          </div>
          <div class="artist-chips" id="artistChips"></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="sec" id="spines" style="background:linear-gradient(180deg,var(--night),var(--night-2),var(--night))">
  <div class="sec-inner">
    <div class="sec-eyebrow eng">Cross-Genre Bridges · 5つの脊椎</div>
    <h2 class="sec-title serif">ジャンル を <em>越えて</em> 繋がる、 5 つ の 脊椎。</h2>
    <div class="sec-lead">
      <p>14 の 部屋 を 横切って、 <em>「同じ 感覚 で 選ばれて いる」</em> と 分かる 5 つ の 直線 が 現れる。 これ が この コレクション の <strong>骨格</strong> である。</p>
    </div>
    <div class="spines">
      <svg class="spines-svg" viewBox="0 0 1100 700" id="spinesSvg"></svg>
      <div class="spines-legend" id="spinesLegend"></div>
    </div>
  </div>
</section>

<section class="closer">
  <p class="quote serif">
    分類 は 道具 に すぎず、 真 の 構造 は<br>
    <em>5 つ の 脊椎</em> として、 部屋 を 貫いている。
  </p>
  <div class="src eng">— Salon des Sons · 音 の 客間</div>
</section>

<footer class="foot">
  <div>© <span id="year"></span> Salon des Sons · a private library of <a href="index.html">Views Engineer</a> · paired with <a href="cabin.html">Cabin in the Hollow</a></div>
</footer>

<script id="genres-data" type="application/json">__GENRES_JSON__</script>
<script id="spines-data" type="application/json">__SPINES_JSON__</script>
<script>
document.getElementById('year').textContent = new Date().getFullYear();
const GENRES = JSON.parse(document.getElementById('genres-data').textContent);
const SPINES = JSON.parse(document.getElementById('spines-data').textContent);

// ─── Build initial Level-0 map: 14 genre bubbles ─────────────
const layerGenre = document.getElementById('layerGenre');
const layerSubgroup = document.getElementById('layerSubgroup');
const panel = document.getElementById('panel');
const breadcrumb = document.getElementById('breadcrumb');
const mapBack = document.getElementById('mapBack');

let state = { level: 0, genre: null, subgroup: null };

function clearLayer(el){ while(el.firstChild) el.removeChild(el.firstChild); }

function showGenres(){
  clearLayer(layerGenre);
  clearLayer(layerSubgroup);
  Object.entries(GENRES).forEach(([slug, g]) => {
    const grp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    grp.setAttribute('class', 'genre-bubble');
    grp.setAttribute('data-slug', slug);
    grp.innerHTML = `
      <circle cx="${g.x}" cy="${g.y}" r="38" fill="${g.color}" fill-opacity=".42" stroke="${g.color}" stroke-width="1.4"/>
      <text x="${g.x}" y="${g.y - 4}" font-size="${g.name_jp.length > 6 ? 11 : 13}">${g.name_jp.length > 8 ? g.name_jp.substring(0,7)+'…' : g.name_jp}</text>
      <text x="${g.x}" y="${g.y + 12}" class="en">${g.name_en.length > 14 ? g.name_en.substring(0,13)+'…' : g.name_en}</text>
    `;
    grp.addEventListener('click', () => openGenre(slug));
    layerGenre.appendChild(grp);
  });
}

function openGenre(slug){
  state = { level: 1, genre: slug, subgroup: null };
  const g = GENRES[slug];

  // Hide other genre bubbles, expand the selected one
  Array.from(layerGenre.children).forEach(child => {
    if (child.getAttribute('data-slug') !== slug) {
      child.style.opacity = '0.18';
      child.style.pointerEvents = 'none';
    } else {
      child.style.opacity = '1';
      const c = child.querySelector('circle');
      if (c) c.setAttribute('r', '60');
    }
  });

  // Place subgroup bubbles around the genre center
  clearLayer(layerSubgroup);
  const n = g.subgroups.length;
  const radius = 110;
  g.subgroups.forEach((sg, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const sx = g.x + Math.cos(angle) * radius;
    const sy = g.y + Math.sin(angle) * radius;
    const grp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    grp.setAttribute('class', 'subgroup-bubble');
    grp.setAttribute('data-i', i);
    const label = sg.name_jp.length > 8 ? sg.name_jp.substring(0,7)+'…' : sg.name_jp;
    grp.innerHTML = `
      <circle cx="${sx}" cy="${sy}" r="32" fill="${g.color}" fill-opacity=".55" stroke="${g.color}" stroke-width="1.2"/>
      <text x="${sx}" y="${sy}" font-size="10">${label}</text>
    `;
    grp.addEventListener('click', () => openSubgroup(slug, i));
    layerSubgroup.appendChild(grp);
  });

  // Draw a faint connecting line from genre center to each subgroup
  g.subgroups.forEach((sg, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const sx = g.x + Math.cos(angle) * radius;
    const sy = g.y + Math.sin(angle) * radius;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', g.x); line.setAttribute('y1', g.y);
    line.setAttribute('x2', sx); line.setAttribute('y2', sy);
    line.setAttribute('stroke', g.color); line.setAttribute('stroke-opacity', '0.4');
    line.setAttribute('stroke-dasharray', '2,3'); line.setAttribute('stroke-width', '1');
    layerSubgroup.insertBefore(line, layerSubgroup.firstChild);
  });

  // Show panel
  document.getElementById('panelJp').textContent = g.name_jp;
  document.getElementById('panelEn').textContent = g.name_en;
  document.getElementById('panelLatin').textContent = g.latin;
  document.getElementById('panelEssence').textContent = g.essence;
  document.getElementById('panelEssay').innerHTML = g.essay;

  // Build subgroup cards
  const grid = document.getElementById('subgroupGrid');
  grid.innerHTML = '';
  g.subgroups.forEach((sg, i) => {
    const card = document.createElement('div');
    card.className = 'subgroup-card';
    card.setAttribute('data-i', i);
    card.innerHTML = `
      <div class="sg-jp">${sg.name_jp}</div>
      <div class="sg-en eng">${sg.name_en}</div>
      <div class="sg-blurb">${sg.blurb}</div>
      <div class="sg-count mono">${sg.artists.length} artists →</div>
    `;
    card.addEventListener('click', () => openSubgroup(slug, i));
    grid.appendChild(card);
  });

  // Add an "Others" card for uncategorized artists
  if (g.others && g.others.length > 0) {
    const card = document.createElement('div');
    card.className = 'subgroup-card';
    card.setAttribute('data-i', 'others');
    card.innerHTML = `
      <div class="sg-jp">その他 / 未分類</div>
      <div class="sg-en eng">Others / Uncategorized</div>
      <div class="sg-blurb">サブクラスタ に 振り分けて いない 残り。 名前 だけ で 並べる。</div>
      <div class="sg-count mono">${g.others.length} artists →</div>
    `;
    card.addEventListener('click', () => openOthers(slug));
    grid.appendChild(card);
  }

  // Hide artist list
  document.getElementById('artistList').classList.remove('open');

  panel.classList.add('open');
  updateBreadcrumb();
  document.querySelector('.map-wrap').scrollIntoView({behavior:'smooth', block:'start'});
}

function openSubgroup(slug, idx){
  state = { level: 2, genre: slug, subgroup: idx };
  const g = GENRES[slug];
  const sg = g.subgroups[idx];

  // Highlight the active subgroup card
  document.querySelectorAll('.subgroup-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`.subgroup-card[data-i="${idx}"]`)?.classList.add('active');

  // Show artist list
  document.getElementById('artistListTitle').textContent = `${sg.name_jp} · ${sg.name_en}`;
  document.getElementById('artistListCount').textContent = `${sg.artists.length} artists`;
  const chips = document.getElementById('artistChips');
  chips.innerHTML = sg.artists.map(a => `<span class="artist-chip">${a}</span>`).join('');
  document.getElementById('artistList').classList.add('open');
  updateBreadcrumb();
  document.getElementById('artistList').scrollIntoView({behavior:'smooth', block:'nearest'});
}

function openOthers(slug){
  state = { level: 2, genre: slug, subgroup: 'others' };
  const g = GENRES[slug];

  document.querySelectorAll('.subgroup-card').forEach(c => c.classList.remove('active'));
  document.querySelector('.subgroup-card[data-i="others"]')?.classList.add('active');

  document.getElementById('artistListTitle').textContent = `その他 · Others`;
  document.getElementById('artistListCount').textContent = `${g.others.length} artists`;
  const chips = document.getElementById('artistChips');
  chips.innerHTML = g.others.map(a => `<span class="artist-chip uncategorized">${a}</span>`).join('');
  document.getElementById('artistList').classList.add('open');
  updateBreadcrumb();
  document.getElementById('artistList').scrollIntoView({behavior:'smooth', block:'nearest'});
}

function back(){
  if (state.level === 2) {
    state.subgroup = null;
    state.level = 1;
    document.querySelectorAll('.subgroup-card').forEach(c => c.classList.remove('active'));
    document.getElementById('artistList').classList.remove('open');
  } else if (state.level === 1) {
    state.genre = null;
    state.level = 0;
    showGenres();
    panel.classList.remove('open');
  }
  updateBreadcrumb();
}

function updateBreadcrumb(){
  const parts = ['<a id="bcRoot">All Genres</a>'];
  if (state.level >= 1 && state.genre) {
    parts[0] = '<a id="bcRoot">All Genres</a>';
    parts.push(`<span class="sep">›</span>`);
    parts.push(state.level === 1
      ? `<span class="current">${GENRES[state.genre].name_jp}</span>`
      : `<a id="bcGenre">${GENRES[state.genre].name_jp}</a>`);
  }
  if (state.level >= 2) {
    parts.push(`<span class="sep">›</span>`);
    const sgName = state.subgroup === 'others' ? 'Others' :
      GENRES[state.genre].subgroups[state.subgroup].name_jp;
    parts.push(`<span class="current">${sgName}</span>`);
  }
  breadcrumb.innerHTML = parts.join('');
  document.getElementById('bcRoot')?.addEventListener('click', () => { state.level=0; back(); back(); back(); showGenres(); panel.classList.remove('open'); updateBreadcrumb(); });
  document.getElementById('bcGenre')?.addEventListener('click', () => back());
  mapBack.disabled = (state.level === 0);
}

mapBack.addEventListener('click', back);

showGenres();
updateBreadcrumb();

// ─── Spines ────────────────────────────────────────────
const spinesSvg = document.getElementById('spinesSvg');
const spinesLegend = document.getElementById('spinesLegend');

SPINES.forEach((sp, idx) => {
  const y = 100 + idx * 130;
  const xs = sp.nodes.map((_, i) => 100 + i * (900 / Math.max(1, sp.nodes.length - 1)));
  // path
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('class', 'spine');
  path.setAttribute('stroke', sp.color);
  let d = '';
  xs.forEach((x, i) => { d += (i === 0 ? `M ${x},${y}` : ` L ${x},${y + (i % 2 ? 18 : -8)}`); });
  path.setAttribute('d', d);
  spinesSvg.appendChild(path);
  // label
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('class', 'spine-label');
  label.setAttribute('x', 100); label.setAttribute('y', y - 24);
  label.setAttribute('fill', sp.color);
  label.textContent = `${'①②③④⑤'[idx]} ${sp.name} — ${sp.name_jp}`;
  spinesSvg.appendChild(label);
  // nodes
  sp.nodes.forEach((node, i) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'node');
    const cx = xs[i], cy = y + (i % 2 ? 18 : -8);
    g.innerHTML = `
      <circle cx="${cx}" cy="${cy}" r="7" stroke="${sp.color}"/>
      <text x="${cx}" y="${cy + 22}">${node.name}</text>
      <text x="${cx}" y="${cy - 14}" fill="${sp.color}" font-style="italic" font-family="'Cormorant Garamond',serif" font-size="10" text-anchor="middle">${node.genre}</text>
    `;
    spinesSvg.appendChild(g);
  });
});

SPINES.forEach((sp, idx) => {
  const item = document.createElement('div');
  item.className = 'item';
  item.innerHTML = `<div class="swatch" style="background:${sp.color}"></div><div><strong>${'①②③④⑤'[idx]} ${sp.name}</strong> — ${sp.name_jp}。 ${sp.nodes.map(n => n.name).join(' → ')}</div>`;
  spinesLegend.appendChild(item);
});
</script>
</body>
</html>
"""


def main():
    data, spines = build_data()
    html = HTML_TEMPLATE.replace("__GENRES_JSON__", json.dumps(data, ensure_ascii=False))
    html = html.replace("__SPINES_JSON__", json.dumps(spines, ensure_ascii=False))
    OUT.write_text(html, encoding="utf-8")
    total = sum(len(g["all_artists"]) for g in data.values())
    cat = sum(sum(len(sg["artists"]) for sg in g["subgroups"]) for g in data.values())
    print(f"  saved: salon.html  ({OUT.stat().st_size // 1024} KB)")
    print(f"  total artists: {total}, categorized: {cat}, uncategorized: {total - cat}")


if __name__ == "__main__":
    main()
