#!/usr/bin/env python3
"""Generate salon.html with unified hierarchical interactive map.

3 zoom levels:
  L0: 14 genre bubbles on 2D plane
  L1: Click genre → sub-current bubbles + essay panel
  L2: Click sub-current → list of all artists

All ~1187 artists are mapped. Manually-categorized artists go into named
sub-currents; everything else is auto-bucketed into alphabetical Periphery
sub-groups (A-F / G-M / N-S / T-Z + Others-Symbols/JP). No counts shown.
"""
import json, sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MUSIC_DATA = Path("C:/tmp/music_data.json")
OUT = ROOT / "salon.html"
PCLOUD_JSON = Path("C:/tmp/salon_clips_pcloud.json")  # optional — for audio playback

# Known categorizations per genre. Add as many as you can identify.
# Anything not listed here goes into alphabetical periphery buckets.
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
             "artists": ["Tenhi", "KAUAN", "Fjallstorm"]},
            {"name_jp": "ドイツ・ゴシック・ファンタジー", "name_en": "German Gothic Fantasy",
             "blurb": "暖炉とラテン語と中世の墓所。 Empyrium はその純粋形。",
             "artists": ["Empyrium", "Dargaard", "NACHTREICH", "Nucleus Torn"]},
            {"name_jp": "国産・東洋ハイブリッド", "name_en": "JP / Hybrid",
             "blurb": "ヨーロッパ的儀式音楽を日本語の語彙で書き直した稀少。",
             "artists": ["IN SCISSORS", "MURGRIND"]},
            {"name_jp": "周辺", "name_en": "Periphery",
             "blurb": "上記カテゴリから外れる例外枠。",
             "artists": ["Bruno Mars", "2008 The Cycle of Fifths"]},
        ],
    },
    "healing": {
        "name_jp": "ヒーリング ＆ ニューエイジ", "name_en": "Healing & New Age", "latin": "Quies Animae",
        "x": 280, "y": 200, "color": "#8aa68a",
        "essence": "静かさという器。 内側は混沌。",
        "essay": "コレクション最大の部屋。 「ヒーリング」というラベルは <em>器であって、 ジャンルではない</em>。 静かである、という共通点だけで、 内側は混沌としている。 <strong>Akira Kosemura・Anoice・Aukai</strong> は名目上ヒーリングだが、 音楽的には <strong>Bill Evans (Jazz) と Michelangeli (Classic) の隣にいる</strong>。",
        "key": "Healing＆New_age",
        "subgroups": [
            {"name_jp": "ポストクラシカル / 静謐", "name_en": "Post-Classical Quiet",
             "blurb": "ECMジャズと現代ピアニズムの中間。 21世紀の静謐。",
             "artists": ["Akira Kosemura", "Anoice", "Aukai", "Balmorhea", "Library Tapes", "Poppy Ackroyd", "Sofiane Pamart", "some kind of peace â€” piano re", "Bill Douglas", "Brian Crain", "Fiona Joy Hawkins", "Fiona-Joy", "Helen Jane Long", "Greg Maroney", "Robin Spielberg", "Robin Meloy Goldsby", "Lisa Swerdlow", "Owsey", "Cecilie", "cicada", "Stefano mocini"]},
            {"name_jp": "ソロピアノ・ニューエイジ", "name_en": "Solo Piano New Age",
             "blurb": "George Winston 以降の、 鍵盤一台で部屋を満たす派。",
             "artists": ["George Winston", "Jim Brickman", "Yiruma", "Kevin Kern", "David Lanz", "Brian Crain", "Peter Kater", "Philip Wesley", "Phillip Keveren", "Robin Spielberg", "Michele McLaughlin", "Michael Logozar", "Michael Allen Harrison", "Michael Gettel", "Michael Martinez", "Vladimir Sterzer", "Yukie Nishimura", "Yuriko Nakamura", "Louis Landon", "Marc Enfroy", "Matthew Mayer", "Max Highstein", "Peter Bence", "Scott D. Davis", "Stuart Hoffman", "Steven Daane", "Ryan Stewart", "Richard Clayderman", "Giovanni Marradi", "Danny Wright", "David Tolk", "David Wayne", "James Michael Stevens", "Kyle Pederson", "Laura Sullivan", "PIANO DANCE", "PIANO FORESTY", "Piano Healing", "Ghost Piano"]},
            {"name_jp": "シンセ・エピック / シネマティック", "name_en": "Synth Epic / Cinematic",
             "blurb": "Vangelis 以降、 Yanni・Kitaro 系の壮大シンセ。",
             "artists": ["Yanni", "kitaro", "Two Steps From Hell", "Jo Blankenburg", "Mars Lasar", "Bjørn Lynne", "Logos", "Zero-Project", "Robert Haig Coxon", "Steven Halpern", "Eric Tingstad", "Tim janis", "Timothy Wenzel", "Wychazel", "Wolfsheart", "Tron Syversen"]},
            {"name_jp": "世界・スピリチュアル", "name_en": "World / Spiritual",
             "blurb": "ペンタトニックと女性ボーカル。 民族楽器も。",
             "artists": ["Druid", "Ah Nee Mah", "Celtic Fairy Lullaby", "Angel Tears", "Karunesh", "Deuter", "Govi", "Sojiro", "OSHO", "Bodhi", "Carlyle Fraser", "Cathal MacDara", "Domo records", "Douglas Blue Feather", "Eric Hilton", "Gandalf", "Gerald Krampl", "Niall", "Nicholas Gunn", "Phil Coulter", "Robert Tree Cody", "Ron Korb", "R. Carlos Nakai", "Pablo Arellano", "Lisa Lynne & George Tortorelli", "Llewellyn", "Pacific Moon Records", "Mustafa Avşaroğlu", "Natobi & Wa Kan", "Wang Sanpu", "Edward Simoni", "Henry Arland", "Eleni Karaindrou", "Eric Chiryoku", "Ron Korb", "Wonders Of Nature", "CUSCO", "Image", "Kailash Project", "Kuara", "Sheila's Disciples", "Threefold", "Roger Subirana", "Remi Orts Project", "Vadim Kiselev", "Pascal Coppe", "Hands two Hands"]},
            {"name_jp": "クロスオーバー・ピアノ", "name_en": "Crossover Piano",
             "blurb": "古典の文法で大衆を捕まえる派手な系譜。",
             "artists": ["Maksim Mrvica", "Bandari", "Daishi Dance", "DEPAPEPE", "Nujabes", "re plus", "S.E.N.S", "Ryuichi Sakamoto", "sakamoto ryuichi", "Della", "Hiromi Haneda"]},
            {"name_jp": "和テイスト / JP New Age", "name_en": "JP New Age",
             "blurb": "日本語のヒーリング・コンピレや作家枠。",
             "artists": ["Akiko Usui", "ALIAKE", "Eiko Yamashita", "Fuji Misaki+", "HIKO", "Himekami", "Hiromi Haneda", "Jun Fukamachi", "Kenio Fuke", "Makiko Hirohashi", "Masako", "NOBUYA KOBORI", "Otokaze", "Sojiro", "Suzuya", "Takashi Kokubo", "Takeshi Terauchi & _Blue Jeans", "V.K", "Yoshihiro Andoh", "α波オルゴール", "ヨルシカ ピアノコレクション", "ロマンティック･サックス", "平沼有梨", "朝まで深く眠れるスローピアノ", "米津玄師ピアノコレクション", "自律神経にやさしいα波", "至極のα波 ジブリの名曲を小川のせせらぎと小鳥たちのさえずりの中で聴く", "relaxing piano 斉藤恒芳"]},
            {"name_jp": "アコースティック / フォーク・ヒーリング", "name_en": "Acoustic Folk Healing",
             "blurb": "アコースティックギター・木管・自然の組み合わせ。",
             "artists": ["7and5", "Acker Bilk", "Acoustic Cafe", "Acoustic Ocean", "Aaron Amida Ang", "Air Element", "Alex Roe", "Andrea Rongioletti", "Aurio Corra", "Autumn's Grey Solace", "Back to Earth", "Beautiful Fantasy II", "Bernadette Bevans", "Casey Crosby", "CHILDHOOD", "David Agnew", "Dean Evenson & Tom Barabas", "Dulce Joya Leon", "Elevation", "Elk Camp Music", "Emily Rowe", "Evenfall", "feel", "Fly North", "Hennie Bekker", "Ian Bullough", "Jonathan Harrington", "Kebin Keller", "Medwyn Goodall", "Minstrel Streams", "Music 2 Hues", "Sleep & Meditation Manifestation", "Stuart Jones", "Terry Oldfield", "Thors"]},
        ],
    },
    "progressive": {
        "name_jp": "プログレッシブ", "name_en": "Progressive", "latin": "Architectura Sonora",
        "x": 380, "y": 430, "color": "#728aa2",
        "essence": "50年を貫く構築美。",
        "essay": "<strong>Genesis (1973)</strong> から <strong>Big Big Train (2026)</strong> まで、 50年を貫いている。 Symphonic / Avant (RIO) / Modern Prog の三方向に、 ほぼ等距離で散らばっている。 <em>「複雑さに耐えられる」 ことと、 美しさを諦めない こと</em> の両立を求める姿勢。",
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
             "artists": ["Ainur", "Air Craft", "Anacrusa", "Andre Mehmari", "Ann Gaytan", "Apairys", "Asturias", "Autumn Chorus", "B. J. Lindh", "Black Tape For A Blue Girl", "Blazing Bronze", "Bruno Sanfilippo", "Charlie Cawood", "Chris", "Clarinet Factory", "Concerto Moon"]},
        ],
    },
    "jazz": {
        "name_jp": "ジャズ ＆ フュージョン", "name_en": "Jazz & Fusion", "latin": "Vox Silentii",
        "x": 440, "y": 370, "color": "#9272a2",
        "essence": "ECM的沈黙。 静かなのに緊張している。",
        "essay": "これは <em>ECM 的</em> な部屋。 共通項は ── <em>静かなのに緊張している</em> こと。 炸裂する Free Jazz は ほぼ無い。 <em>北欧寄り、 内省寄り、 ピアノトリオ寄り</em>。",
        "key": "Jazz&Fusion",
        "subgroups": [
            {"name_jp": "ECMピアノトリオ", "name_en": "ECM Piano Trio",
             "blurb": "50年・国境を越える「沈黙の精度」の系譜。",
             "artists": ["Bill Evans Trio", "Bill Evans, Jim Hall", "Eddie Higgins", "Esjbjorn Svensson Trio", "Helge Lien Trio & Tore Brunborg", "Great Jazz Trio", "Enrico Pieranunzi", "Bill Evans"]},
            {"name_jp": "室内楽ジャズ", "name_en": "Chamber Jazz",
             "blurb": "デュオ・ベース×ギター・室内編成。",
             "artists": ["Charlie Haden & Pat Metheny", "Charles Mingus", "Gerry Mulligan", "Eric Dolphy", "Diederik Wissels"]},
            {"name_jp": "地中海＆中東", "name_en": "Mediterranean / Middle East",
             "blurb": "ECMの周縁。",
             "artists": ["Avishai Cohen", "Gabriele Mirabassi e Richard Galliano", "Giovanni Mirabassi  Trio & Strings", "Andrea Abbadia", "EGEA", "Giovanni Guidi, Gianluca Petrella, Louis Sclavis, Gerald Cleaver"]},
            {"name_jp": "電化フュージョン", "name_en": "Electric Fusion",
             "blurb": "例外的に明るい袋。",
             "artists": ["Bill Laurance", "Bill Laurance & Michael League", "Brian Culbertson", "Billy Childs", "David Benoit & Russ Freeman"]},
            {"name_jp": "周辺 / その他", "name_en": "Periphery / Others",
             "blurb": "ボーカルジャズ・南米・北欧周縁等。",
             "artists": ["acro jazz", "Autumn Tears", "Hiromi", "Joshua Redman", "Sonny Rollins", "Diana Krall"]},
        ],
    },
    "classic": {
        "name_jp": "クラシック", "name_en": "Classic", "latin": "Clavium Aurum",
        "x": 260, "y": 320, "color": "#a89272",
        "essence": "タッチと呼吸の系譜。",
        "essay": "教養の部屋ではない。 もっと狭くて深い <em>ピアニズム</em> という部屋。 交響曲全集はおいてない。 「タッチ」 と 「呼吸」 で選ばれた手の動き。",
        "key": "Classic",
        "subgroups": [
            {"name_jp": "黄金期巨匠", "name_en": "Golden-era Masters",
             "blurb": "金属の重さで弾く系譜。",
             "artists": ["The Art of Arturo Benedetti Michelangeli", "Gilils", "Rachmaninoff Piano Concerto 2-Rubinstein 1950 & 1956", "Leopold Wlach"]},
            {"name_jp": "21世紀の鍵盤", "name_en": "21st Century Keys",
             "blurb": "古典 × YouTube × 武道館。",
             "artists": ["Hayato Sumino", "Nobuyuki Tsujii", "まらしぃ"]},
            {"name_jp": "コンピレーション・周辺", "name_en": "Compilations / Periphery",
             "blurb": "ピアノ・コンピや個別音源。",
             "artists": ["Healing Piano", "accelerate", "Piano Master", "share", "クラシックBest9", "クラシック音楽による 目覚めがすっきりするCD", "フジ子・ヘミング　チャイコフスキー：ピアノ協奏曲第一番 他", "スプリングコンサート", "Great.Pianists.of.the.20th.Century"]},
        ],
    },
    "metal": {
        "name_jp": "メタル ＆ ハードロック", "name_en": "Metal & Hard Rock", "latin": "Tonitru Sacrum",
        "x": 800, "y": 430, "color": "#a25252",
        "essence": "物語性とメロディ。",
        "essay": "<em>シンフォニック / パワー / ファンタジー直系</em> が中核。 純粋な Stoner / Doom はほぼ無い。 ここの基準は <em>「物語性とメロディ」</em>。",
        "key": "Metal&Hard_rock",
        "subgroups": [
            {"name_jp": "ジャーマン・ファンタジー・パワー", "name_en": "German Fantasy Power",
             "blurb": "トールキン × メタル。",
             "artists": ["Blind Guardian", "Beast in Black", "Crowne", "Damian Hamada's Creatures", "Edguy", "Helloween", "Gamma Ray", "Avantasia", "Kamelot"]},
            {"name_jp": "シンフォニック / ネオクラ", "name_en": "Symphonic / Neoclassical",
             "blurb": "弦楽 × ピアノ × ソプラノ。",
             "artists": ["Adagio", "Ancient Bards", "Amberian Dawn", "Astralion", "DGM", "Derdian", "Epica", "Nightwish", "Within Temptation", "Lacuna Coil", "After Forever", "Therion"]},
            {"name_jp": "北欧メロデス・ブラック", "name_en": "Nordic Melodeath / Black",
             "blurb": "旋律と攻撃の同時実行。",
             "artists": ["Amorphis", "Dark Tranquillity", "Children of Bodom", "Behemoth", "Arch Enemy", "Dark Lunacy", "Dalriada", "Dark Moor", "Dark the Suns", "In Flames", "At The Gates", "Ensiferum", "Eluveitie", "Insomnium"]},
            {"name_jp": "和テイスト・JP メタル", "name_en": "Japanese Metal",
             "blurb": "同人メタルへの伏線でもある。",
             "artists": ["Damian Hamada's Creatures", "Cacophony", "Chthonic", "X JAPAN", "Loudness", "Galneryus", "Sex Machineguns", "Anthem"]},
            {"name_jp": "プログ・テクニカル・モダン", "name_en": "Prog / Technical / Modern",
             "blurb": "Dream Theater 系から Djent まで。",
             "artists": ["Alchemy Crystal", "Alesana", "Angra", "Azrael", "Beat Weil", "Behemoth", "Blaze", "Blood Incantation", "Bloody Cumshot", "Breaking Benjamin", "Crowne"]},
        ],
    },
    "indies": {
        "name_jp": "インディーズ ／ 同人", "name_en": "Indies (Doujin)", "latin": "Mythos Privatus",
        "x": 700, "y": 490, "color": "#724a82",
        "essence": "過剰さの自由。",
        "essay": "日本の同人音楽シーン。 <em>シンフォニックメタル × アニメ的物語性 × オペラ的女性ボーカル</em> の混合体。 商業流通から外れることで <em>「過剰さの自由」</em> を獲得した。",
        "key": "Indies",
        "subgroups": [
            {"name_jp": "シンフォニック・デス・アニソン", "name_en": "Symphonic-Death-Anime",
             "blurb": "過剰の頂点。",
             "artists": ["Imperial Circus Dead Decadence", "Asriel", "Dragon Guardian", "Garnet Cathedral", "Dark PHOENiX"]},
            {"name_jp": "ゴシック × ヴァイオリン", "name_en": "Gothic + Violin",
             "blurb": "西洋的暗黒美学。",
             "artists": ["CROSS VEIN", "Aura Noctis", "Imperial Circus Dead Decadence"]},
            {"name_jp": "シューゲーザー寄り", "name_en": "Shoegaze-leaning",
             "blurb": "浮遊する女性ボーカル系。",
             "artists": ["Aleile", "Frost Fragment", "B.rose&crown", "Octaviagrace", "-LostFairy"]},
            {"name_jp": "ノベルゲーOST周辺", "name_en": "VN-OST Adjacent",
             "blurb": "ゲーム音楽との境界アーティスト。",
             "artists": ["AYUTRICA", "Hagall×152Hz", "AL Fantasia", "Barbarian On The Groove", "CORONA", "Dark PHOENiX", "AYUTRICA 1.0"]},
            {"name_jp": "ピアノ・アコースティック", "name_en": "Piano / Acoustic",
             "blurb": "オルゴール・カバー・カノン編。",
             "artists": ["arcane", "ARForest x nayuta", "Hoshineko Sounds 1.0"]},
            {"name_jp": "東方アレンジ周辺", "name_en": "Touhou Arrange & Friends",
             "blurb": "東方Project周辺サークル。",
             "artists": ["AriableyeS", "AYUTRICA", "Dragon Guardian"]},
            {"name_jp": "ハードコア・メタル", "name_en": "Hardcore / Metal",
             "blurb": "シンフォメタル以外の重量系。",
             "artists": ["5150", "78", "Imperial Circus Dead Decadence", "Elixir Nocturne", "Imperial Circus Dead Decadence"]},
        ],
    },
    "jpop": {
        "name_jp": "JPOP", "name_en": "JPOP", "latin": "Cantus Insularis",
        "x": 560, "y": 490, "color": "#a27262",
        "essence": "物語の歌い手。",
        "essay": "大衆向けの部屋に見えて、 内側はかなり<em>偏っている</em>。 共通項は <em>「物語性のあるボーカル」</em>。 アイドルポップやJ-Rapはほぼ皆無。",
        "key": "JPOP",
        "subgroups": [
            {"name_jp": "王道JPOP/ロック", "name_en": "Mainstream JPOP/Rock",
             "blurb": "武道館を埋める音楽。",
             "artists": ["B'z", "BUMP OF CHICKEN", "GLAY", "JAM Project", "Creepy Nuts", "ポルノグラフィティ"]},
            {"name_jp": "現代叙情ボーカル", "name_en": "Contemporary Lyrical Vocal",
             "blurb": "アニメ主題歌の鋳型を更新した世代。",
             "artists": ["Aimer", "Ado", "Garnet Crow", "Faylan", "Hakubi", "Ayahi Takagaki", "Ceui", "binaria"]},
            {"name_jp": "ヴィジュアル系・ゴシック", "name_en": "Visual-kei / Gothic",
             "blurb": "耽美と物語の長期戦。",
             "artists": ["Ali project", "Gackt", "KAMIJO", "Janne Da Arc", "Kagrra"]},
            {"name_jp": "アニソン・声優", "name_en": "Anison / VA Vocalists",
             "blurb": "アニメ主題歌からソロ展開した歌い手。",
             "artists": ["水樹奈々", "GRANRODEO", "林原めぐみ", "茶太", "三月のパンタシア", "イヤホンズ", "鬼頭明里", "西川貴教", "mao"]},
            {"name_jp": "インストゥルメンタル / プロデューサー", "name_en": "Instrumental / Producer",
             "blurb": "ボーカル中心の部屋に小さく開く器楽の窓。",
             "artists": ["DJ OKAWARI", "ADAM at", "ヘブンバーンズレッド 麻枝准×やなぎなぎ", "orange pekoe"]},
            {"name_jp": "オルタナ・夜明け系", "name_en": "Alt / Late-night",
             "blurb": "ずっと真夜中・神聖かまってちゃん 系統。",
             "artists": ["ずっと真夜中でいいのに。", "神聖かまってちゃん", "あたらよ", "Omoinotake", "Blueberry & Yogurt"]},
        ],
    },
    "celt": {
        "name_jp": "ケルト ＆ ファンタジー ＆ ヴァイオリン", "name_en": "Celt & Fantasy & Violin", "latin": "Mythos Vivus",
        "x": 380, "y": 240, "color": "#8a6a8a",
        "essence": "夜の森と城。",
        "essay": "このコレクションの<em>魂の住処</em>。 ケルト・中世・ダークファンタジー・北欧叙事詩 が、 ひとつの部屋に集まっている。 主成分は <em>「夜の森と城」</em>。",
        "key": "Celt&Fantasy&Violin",
        "subgroups": [
            {"name_jp": "ファンタジー量産派", "name_en": "Fantasy Prolific",
             "blurb": "ゲーム/YouTube文化の音楽供給源。",
             "artists": ["Adrian von Ziegler", "Antti Martikainen", "Austin Wintory", "Caprice", "Derek Fiecher", "Erang", "Fantasy World"]},
            {"name_jp": "中世女性復興", "name_en": "Medieval Female Revival",
             "blurb": "スペイン・イタリア発の古楽再演。",
             "artists": ["Trobar De Morte", "Ana Alcaide", "Aura Noctis", "Faun", "Estampie", "Mediaeval Baebes"]},
            {"name_jp": "ケルト・トラディショナル", "name_en": "Celtic Traditional",
             "blurb": "アイルランド・スコットランド本流。",
             "artists": ["Altan", "Celtic Thunder", "Beyond The Woods", "Barry O'sullivan", "Celtic Woman", "Clannad", "Carlyle Fraser", "Cathal MacDara"]},
            {"name_jp": "クロスオーバー器楽", "name_en": "Crossover Instrumental",
             "blurb": "ロックを古楽器で弾く派。",
             "artists": ["2Cellos", "David Garrett", "David Davidson", "Darryl Way", "Darol Anger", "Ayasa_Best_Album_-_BEST_II_FLAC", "92 Keys"]},
            {"name_jp": "シネマ・トレイラー音楽", "name_en": "Cinematic Trailer",
             "blurb": "Two Steps From Hell 系の壮大派。",
             "artists": ["benedikt", "Two Steps From Hell"]},
        ],
    },
    "game": {
        "name_jp": "ゲーム", "name_en": "Game", "latin": "Mundi Ludendi",
        "x": 600, "y": 320, "color": "#62a262",
        "essence": "物語のために書かれた音楽。",
        "essay": "RPG中心、 そしてダークファンタジー寄り。 <em>「物語と音楽が同時に進行するメディア」</em>。 アニメ音楽との違いは、 <em>ループ前提で書かれている</em> こと。",
        "key": "Game",
        "subgroups": [
            {"name_jp": "JRPG伝統", "name_en": "JRPG Tradition",
             "blurb": "1980-90年代から続く土台。",
             "artists": ["Final Fantasy", "Dragon Quest", "Falcom Sound Team jdk collection", "Baten Kaitos", "Fire Emblem", "Bravely Default OST", "イースシリーズ", "Saga", "Chrono", "テイルズ", "ロマンシング サ・ガ"]},
            {"name_jp": "ダークファンタジーOST", "name_en": "Dark Fantasy OST",
             "blurb": "メトロイドヴァニアの慟哭系統。",
             "artists": ["ENDER LILIES", "Dies irae", "DemonsRoots", "DRACULA", "Castlevania"]},
            {"name_jp": "ビジュアルノベル音楽", "name_en": "Visual Novel Music",
             "blurb": "泣きゲーの音楽資産。",
             "artists": ["9-nine- Sound Premium Record", "AKABEiSOFT2", "ALcot", "AUGUST", "CROSS†CHANNEL ～In memory of all people～ SPECIAL SOUNDTRACK", "Ever17_OST", "FAVORITE", "A New Story", "うたわれるもの 偽りの仮面＆二人の白皇 歌集", "双星の陰陽師 Music Collection Album", "細井聡司ワークス", "CUFFS SONGS BEST", "SAGA PLANETS 四季ボーカルコレクション", "GIGA BEST ALBUM", "戯画ベストアルバム", "ファタモルガーナの館", "Marica ワークスベストアルバム"]},
            {"name_jp": "ジャンル越境作曲家", "name_en": "Genre-Crossing Composers",
             "blurb": "Mili・Revo・Christopher Tin。",
             "artists": ["Calling All Dawns", "Donkey Kong Country Trilogy", "Epic Game Music", "BALDR MASTERPIECE CHRONICLE Complete Vocal Collection", "Ar tonelico Hymmnos Musical Vocal Mini Album ~Cocona~"]},
            {"name_jp": "コナミ・カプコン・SE", "name_en": "Konami / Capcom / SE",
             "blurb": "メーカー音楽集。",
             "artists": ["KONAMI", "オリジナル・サウンド・オブ・グラディウス＆沙羅曼蛇 バトル ミュージック コレクション", "capcom 30周年", "NAMCO SOUND TEAM", "ダライアスバースト", "田中勝己", "細井聡司", "浜渦正志", "志倉千代丸"]},
            {"name_jp": "ボーカル・キャラソン", "name_en": "Vocal / Character Songs",
             "blurb": "キャラソン・ベスト・ライブ。",
             "artists": ["Job for a Rockstar_rar", "FamilyJules", "春眠旅団", "御伽櫻"]},
        ],
    },
    "anime": {
        "name_jp": "アニメ", "name_en": "Anime", "latin": "Imagines Mobiles",
        "x": 680, "y": 260, "color": "#a26262",
        "essence": "美しさと悲劇の同居。",
        "essay": "OST中心。 ベストアルバムが少ない。 <em>「番組の世界観を音楽で持ち帰る」</em> 目的の収集。 取り上げる作品の傾向 ── <em>「美しさと悲劇の同居」</em>。",
        "key": "Anime",
        "subgroups": [
            {"name_jp": "叙事詩・戦闘OST", "name_en": "Epic / Battle OST",
             "blurb": "中川幸太郎・梶浦由記系列。",
             "artists": ["Code Geass Sound Collection", "Akame ga KILL! アカメが斬る！", "86 Eighty-six", "Fate Stay Night", "Hunter X Hunter", "ドラゴンクエスト ダイの大冒険", "鋼の錬金術師"]},
            {"name_jp": "オーケストラ復権", "name_en": "Orchestral Revival",
             "blurb": "Evan Call・藤澤慶昌の新世代叙情。",
             "artists": ["Frieren Beyond Journey's End Original Soundtrack", "Charlotte Original Soundtrack", "A Place Further than the Universe", "サイレント・ウィッチ", "メイドインアビス 烈日の黄金郷"]},
            {"name_jp": "異形のOPテーマ", "name_en": "Singular OP Themes",
             "blurb": "ラテン語・呪術・幽玄。",
             "artists": ["Elfen Lied Original Soundtrack", "KOTOKO", "Helck", "Vitalization", "イグジスト/暗夜航路", "真実の黙示録", "Exterminate", "Butter-Fly"]},
            {"name_jp": "古典名作", "name_en": "Classic Anime",
             "blurb": "子供時代から続く根。",
             "artists": ["BEST OF INUYASHA 百花繚乱 -犬夜叉 テーマ全集-", "Dragon Ball", "NARUTO－ナルト－Best Hit Collection", "CLIMAX Anime Hits", "サイレントメビウス", "アルマギア -Project", "黄金の輝き"]},
            {"name_jp": "コンピレーション", "name_en": "Compilations",
             "blurb": "ベスト・コンピ枠。",
             "artists": ["animage 2 ~NEW ANIMATION SONGS~", "animage ~NEW ANIMATION SONGS~", "Anime", "Anime collection ACG", "Anime Piano", "ave;new", "BEST OF CHIHIROX", "Anime Piano Works", "Anime [Collection]", "Never Let You Go", "魔法少女リリカルなのは", "蒼穹のファフナー EXODUS", "クロスアンジュ 天使と竜の輪舞", "戦姫絶唱シンフォギアGX"]},
            {"name_jp": "アニソン名歌手", "name_en": "Anison Vocalists",
             "blurb": "MARASY (ピアノ) や水樹奈々など作品横断。",
             "artists": ["MARASY", "高橋洋子", "水樹奈々", "宮本駿一"]},
        ],
    },
    "nature": {
        "name_jp": "ネイチャー", "name_en": "Nature", "latin": "Vox Mundi",
        "x": 170, "y": 280, "color": "#92a2a8",
        "essence": "人を消す音。",
        "essay": "純粋なフィールドレコーディングと、 <em>「自然音 + 楽器」 のハイブリッド</em> が同居する部屋。 ここは <em>「音楽を聴かない時間」</em> のための音。",
        "key": "Nature",
        "subgroups": [
            {"name_jp": "純粋フィールド", "name_en": "Pure Field",
             "blurb": "地球の声を録音する人々。",
             "artists": ["Gordon Hempton", "Dan Gibson's Solitudes", "Echoes Of Nature", "Forest Ambience", "Brian Hardin", "Boom Library SOE Autumn", "Nature Sound Healing.ape", "Nature Sound Retreat", "Echoes Of Nature"]},
            {"name_jp": "ピアノ + 自然", "name_en": "Piano + Nature",
             "blurb": "「ピアノで自然をなぞる」 派。",
             "artists": ["Andrew Fitzgerald", "Marcia Green - Morning Piano and Nature Sounds", "Helen Rhodes & Joseph Wade", "Andrea Rongioletti"]},
            {"name_jp": "ハイブリッド・笛系", "name_en": "Hybrid / Flute",
             "blurb": "自然音 + フルート + シンセ。",
             "artists": ["Hennie Bekker", "KENJI KIHARA", "Larkin", "Dan Gibson's Solitudes", "Jamie Llewellyn", "Wisp X", "ELF"]},
            {"name_jp": "睡眠・スパ用途", "name_en": "Sleep / Spa",
             "blurb": "機能音楽。",
             "artists": ["K Ambient Sounds", "Nature Sound Healing.ape", "Nature Sound Retreat", "Sleeping Music", "Ambient Music for Cats", "2019ボロヴィツィ村の朝"]},
            {"name_jp": "海・水", "name_en": "Ocean / Water",
             "blurb": "海岸線・川・雨。",
             "artists": ["David Sun", "Criss Howell", "Sounds of the Sea", "Larkin"]},
            {"name_jp": "周辺", "name_en": "Periphery",
             "blurb": "コンピレや作家枠。",
             "artists": ["4CD-2004FLAC", "Giovanni", "Global Journey"]},
        ],
    },
    "blues-folk": {
        "name_jp": "ブルース ＆ フォーク", "name_en": "Blues & Folk", "latin": "Cantores Antiqui",
        "x": 520, "y": 280, "color": "#7a6a52",
        "essence": "物語の歌い手 (起点)。",
        "essay": "純粋な Blues は不在。 ここは <em>Folk の中の最も詩的・最もケルトな部分</em> を切り出した部屋。",
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
        "essay": "<em>「世間の良いとされるもの」 と 「個人の好み」 が交わる、 ゆるい中間地帯</em>。 SACDやハイレゾ盤が多めなのは、 <strong>音質オタクとしての矜持</strong>。",
        "key": "POP&Rock",
        "subgroups": [
            {"name_jp": "王道ロック・ポップ", "name_en": "Mainstream Rock/Pop",
             "blurb": "大衆向けの音質保管。",
             "artists": ["Bon Jovi 2010", "Foo Fighters", "Deep Purple", "Dua Lipa", "Eminem", "Kylie Minogue", "Helene Fischer", "Jamiroquai", "Bon Jovi"]},
            {"name_jp": "劇場・シネマ", "name_en": "Theatre / Cinema",
             "blurb": "物語と劇場の音。",
             "artists": ["Hans Zimmer", "Andrea Bocelli", "Concerto Moon", "Jackie Evancho", "Ernie Watts", "Hans Zimmer - Interstellar"]},
            {"name_jp": "インディー叙情", "name_en": "Indie Lyrical",
             "blurb": "静謐なロックの小袋。",
             "artists": ["Death Cab for Cutie", "Death Cab For Cutie", "Copeland", "Einar Stray", "Jack's Mannequin"]},
            {"name_jp": "シンガーソングライター", "name_en": "Singer-Songwriter",
             "blurb": "ベテラン・名匠枠。",
             "artists": ["Ben Folds & Nick Hornby", "Judee Sill", "Leon Russell", "Between the Senses", "Dream"]},
        ],
    },
}


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
    """Merge GENRES (curated subgroups) + ADDITIONS (per-genre extra
    classifications) → final data. Any artist still missing → safety bucket."""
    import unicodedata
    def norm(s): return unicodedata.normalize("NFC", s).lower()
    # Lazy import additions to keep this file self-contained-ish
    import importlib.util
    add_path = Path(__file__).parent / "salon_additions.py"
    spec = importlib.util.spec_from_file_location("salon_additions", add_path)
    add_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(add_mod)
    ADDITIONS = add_mod.ADDITIONS

    # Load per-artist descriptions (optional)
    desc_path = Path(__file__).parent / "salon_descriptions.py"
    DESCRIPTIONS = {}
    if desc_path.exists():
        try:
            spec2 = importlib.util.spec_from_file_location("salon_descriptions", desc_path)
            mod2 = importlib.util.module_from_spec(spec2)
            spec2.loader.exec_module(mod2)
            DESCRIPTIONS = getattr(mod2, "DESCRIPTIONS", {})
        except Exception as e:
            print(f"  WARN: failed to load descriptions: {e}")

    # Load per-artist recommended albums + display name overrides (optional)
    albums_path = Path(__file__).parent / "salon_albums.py"
    ALBUMS = {}
    DISPLAY_NAMES = {}
    if albums_path.exists():
        try:
            spec3 = importlib.util.spec_from_file_location("salon_albums", albums_path)
            mod3 = importlib.util.module_from_spec(spec3)
            spec3.loader.exec_module(mod3)
            ALBUMS = getattr(mod3, "ALBUMS", {})
            DISPLAY_NAMES = getattr(mod3, "DISPLAY_NAMES", {})
        except Exception as e:
            print(f"  WARN: failed to load albums: {e}")

    music = json.loads(MUSIC_DATA.read_text(encoding="utf-8"))
    out = {}
    for slug, g in GENRES.items():
        all_artists = music.get(g["key"], [])

        # Deep-copy subgroups so we can extend without mutating GENRES
        subgroups = [dict(sg, artists=list(sg["artists"])) for sg in g["subgroups"]]

        # Apply additions
        ad = ADDITIONS.get(slug, {})
        # Add to existing subgroups (match by name_jp)
        for sg_name, artists in ad.get("to_existing", {}).items():
            target = next((sg for sg in subgroups if sg["name_jp"] == sg_name), None)
            if target is None:
                print(f"  WARN: {slug}: existing subgroup '{sg_name}' not found, creating")
                target = {"name_jp": sg_name, "name_en": sg_name,
                          "blurb": "", "artists": []}
                subgroups.append(target)
            for a in artists:
                if a not in target["artists"]:
                    target["artists"].append(a)
        # New subgroups
        for new_sg in ad.get("new_subgroups", []):
            subgroups.append(dict(new_sg, artists=list(new_sg["artists"])))

        # Compute NFC-normalized case-insensitive set of all categorized
        cat_set = set()
        for sg in subgroups:
            for a in sg["artists"]:
                cat_set.add(norm(a))

        # Anything still uncategorized → safety bucket
        residual = [a for a in all_artists if norm(a) not in cat_set]
        if residual:
            print(f"  {slug}: {len(residual)} residual not classified, adding to misc bucket")
            subgroups.append({
                "name_jp": "未分類", "name_en": "Unclassified",
                "blurb": "システム的に振り分けられなかった残り (要 手動確認)。",
                "artists": sorted(residual, key=lambda s: s.lower()),
                "auto": True,
            })

        # Build per-artist description map for this genre.
        # Priority: explicit per-artist description > subgroup blurb > empty
        descs_for_genre = DESCRIPTIONS.get(slug, {})
        desc_lookup = {norm(k): v for k, v in descs_for_genre.items()}

        # Display name overrides + recommended album per artist
        names_for_genre = DISPLAY_NAMES.get(slug, {})
        names_lookup = {norm(k): v for k, v in names_for_genre.items()}
        albums_for_genre = ALBUMS.get(slug, {})
        albums_lookup = {norm(k): v for k, v in albums_for_genre.items()}

        artist_descs = {}
        artist_displays = {}
        artist_albums = {}
        for sg in subgroups:
            for a in sg["artists"]:
                if a in artist_descs:
                    continue
                key = norm(a)
                artist_descs[a] = desc_lookup.get(key, sg.get("blurb", ""))
                artist_displays[a] = names_lookup.get(key, a)
                alb = albums_lookup.get(key)
                if alb:
                    title, year = alb if isinstance(alb, (list, tuple)) and len(alb) == 2 else (alb, None)
                    artist_albums[a] = {"title": title, "year": year}

        out[slug] = {
            "name_jp": g["name_jp"], "name_en": g["name_en"], "latin": g["latin"],
            "x": g["x"], "y": g["y"], "color": g["color"],
            "essence": g["essence"], "essay": g["essay"],
            "subgroups": subgroups,
            "all_artists": all_artists,
            "artist_descs": artist_descs,
            "artist_displays": artist_displays,
            "artist_albums": artist_albums,
        }
    return out, SPINES


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Salon des Sons — 音の客間 / 音楽性の地図</title>
<meta name="description" content="個人音楽コレクションの音楽性可視化。14ジャンル × 60+サブクラスタ × 全アーティスト。階層化地図をクリックで詳細化。">
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

body::after{content:"";position:fixed;inset:0;z-index:200;pointer-events:none;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.7 0 0 0 0 0.6 0 0 0 0 0.4 0 0 0 0.04 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  opacity:.3;mix-blend-mode:overlay;}

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
  font-size:clamp(36px,5vw,72px);letter-spacing:.02em;color:var(--paper);margin-bottom:14px;
  text-shadow:0 0 24px rgba(240,200,120,.18);}
.hero-title-jp{font-family:"Shippori Mincho",serif;font-weight:700;
  font-size:clamp(48px,7vw,88px);letter-spacing:.08em;color:var(--paper);margin-bottom:36px;line-height:1.1;
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

.map-wrap{position:relative;width:100%;
  background:radial-gradient(ellipse at 50% 50%, rgba(28,20,40,.6), rgba(10,8,20,.3) 70%, transparent),var(--night-2);
  border:1px solid rgba(212,160,80,.18);border-radius:8px;padding:18px;}
.map-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px;flex-wrap:wrap}
.map-breadcrumb{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:14px;color:var(--paper-dim);letter-spacing:.06em}
.map-breadcrumb .sep{color:var(--ink-soft);margin:0 10px}
.map-breadcrumb a{color:var(--amber);cursor:pointer;text-decoration:underline;text-decoration-color:rgba(240,200,120,.35)}
.map-breadcrumb a:hover{color:var(--amber-soft)}
.map-breadcrumb .current{color:var(--paper)}
.map-back{font-family:"Inter",sans-serif;font-size:14px;font-weight:600;color:var(--paper);
  background:var(--velvet);border:1px solid var(--amber);
  padding:9px 22px;border-radius:4px;cursor:pointer;letter-spacing:.06em;
  transition:all .25s;display:inline-flex;align-items:center;gap:8px;}
.map-back:hover{background:rgba(122,42,58,.55);box-shadow:0 0 14px rgba(240,200,120,.3)}
.map-back[disabled]{opacity:.3;cursor:default}
.map-back[disabled]:hover{background:var(--velvet);box-shadow:none}
.map-hint{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:12px;color:var(--ink-soft);letter-spacing:.06em;}

.mapsvg{display:block;width:100%;height:auto;aspect-ratio:5/3;cursor:default}
.mapsvg .axis{stroke:rgba(212,160,80,.14);stroke-dasharray:3,4;stroke-width:1}
.mapsvg .ax-label{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:11px;
  fill:var(--ink-soft);letter-spacing:.18em;text-transform:uppercase}
.mapsvg .genre-bubble{cursor:pointer;transition:opacity .4s}
.mapsvg .genre-bubble circle{transition:r .4s, fill-opacity .25s}
.mapsvg .genre-bubble:hover circle{fill-opacity:.7}
.mapsvg .genre-bubble.active circle{stroke-width:3}
.mapsvg .genre-bubble text{font-family:"Shippori Mincho",serif;font-weight:700;
  fill:var(--paper);text-anchor:middle;dominant-baseline:middle;pointer-events:none}
.mapsvg .genre-bubble .en{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:9px;fill:var(--amber);text-anchor:middle}
.mapsvg .subgroup-bubble{cursor:pointer;transition:opacity .4s}
.mapsvg .subgroup-bubble circle{transition:fill-opacity .25s,r .25s}
.mapsvg .subgroup-bubble:hover circle{fill-opacity:.95;r:36}
.mapsvg .subgroup-bubble text{font-family:"Shippori Mincho",serif;font-weight:500;
  fill:var(--paper);text-anchor:middle;dominant-baseline:middle;pointer-events:none;font-size:10px}

.panel{position:relative;margin-top:24px;padding:24px;
  background:rgba(28,20,40,.55);border:1px solid rgba(212,160,80,.18);border-radius:6px;display:none;}
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
.subgroup-card.auto{border-style:dashed;border-color:rgba(212,160,80,.25)}
.subgroup-card .sg-jp{font-family:"Shippori Mincho",serif;font-weight:700;font-size:16px;color:var(--paper);letter-spacing:.04em;margin-bottom:4px}
.subgroup-card .sg-en{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:12px;color:var(--amber);letter-spacing:.06em;margin-bottom:8px}
.subgroup-card .sg-blurb{font-family:"Shippori Mincho",serif;font-size:13.5px;line-height:1.85;color:var(--paper-dim)}
.subgroup-card .sg-arrow{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:12px;color:var(--amber);letter-spacing:.06em;margin-top:10px;display:block;}

.artist-list{margin-top:18px;padding:18px;background:rgba(10,8,16,.55);border:1px dashed rgba(212,160,80,.2);border-radius:4px;display:none;}
.artist-list.open{display:block;animation:panel-in .35s ease}
.artist-list-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:12px;flex-wrap:wrap}
.artist-list-title{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:14px;letter-spacing:.18em;color:var(--amber);text-transform:uppercase}
.artist-list-close{font-family:"Inter",sans-serif;font-size:11px;color:var(--ink-soft);
  background:transparent;border:1px solid rgba(212,160,80,.2);padding:4px 12px;border-radius:3px;cursor:pointer;letter-spacing:.06em;}
.artist-list-close:hover{color:var(--amber);border-color:var(--amber)}
.artist-chips{display:flex;flex-wrap:wrap;gap:8px}
.artist-chip{font-family:"Shippori Mincho",serif;font-size:13px;
  padding:6px 14px;background:rgba(28,20,40,.7);border:1px solid rgba(212,160,80,.18);
  border-radius:999px;color:var(--paper-dim);transition:all .2s;
  user-select:none;display:inline-flex;align-items:center;gap:0;
  text-decoration:none;cursor:pointer;}
.artist-chip:hover{background:rgba(122,42,58,.3);border-color:var(--amber);color:var(--paper);transform:translateY(-1px)}
.artist-chip::after{content:"📦";font-size:10px;opacity:.5;transition:opacity .2s;margin-left:6px}
.artist-chip:hover::after{opacity:1}

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

.artist-popover{position:fixed;display:none;z-index:90;
  width:380px;max-width:calc(100vw - 24px);
  background:rgba(20,16,26,.97);
  border:1px solid var(--amber);border-radius:6px;
  padding:18px 20px 16px;
  box-shadow:0 14px 40px rgba(0,0,0,.7), 0 0 24px rgba(212,160,80,.18);
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);}
.artist-popover.has-player{width:420px}
.artist-popover.open{display:block;animation:panel-in .2s ease}
.ap-close{position:absolute;top:6px;right:10px;
  background:transparent;border:none;color:var(--ink-soft);
  font-size:20px;cursor:pointer;padding:2px 8px;line-height:1;
  font-family:"Inter",sans-serif;}
.ap-close:hover{color:var(--amber)}
.ap-name{font-family:"Shippori Mincho",serif;font-weight:700;
  font-size:18px;color:var(--paper);letter-spacing:.04em;
  margin-right:24px;margin-bottom:2px;line-height:1.4;}
.ap-sub{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:11px;color:var(--ink-soft);letter-spacing:.18em;
  text-transform:uppercase;margin-bottom:10px;}
.ap-desc{font-family:"Shippori Mincho",serif;font-size:13px;
  color:var(--paper-dim);line-height:1.75;margin-bottom:10px;}
.ap-album{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:12.5px;color:var(--amber);letter-spacing:.04em;
  margin-bottom:14px;padding-bottom:12px;
  border-bottom:1px dashed rgba(212,160,80,.18);min-height:1em;}
.ap-album:empty{display:none}
.ap-album .ap-album-label{font-style:normal;color:var(--ink-soft);
  letter-spacing:.18em;text-transform:uppercase;font-size:10px;margin-right:8px;}
.ap-player-row{display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.ap-player{display:none;margin-bottom:12px;border-radius:4px;overflow:hidden;
  background:#000;aspect-ratio:16/9;width:100%;}
.ap-player.open{display:block}
.ap-player iframe{width:100%;height:100%;border:0;display:block}
.ap-btn-play{background:linear-gradient(180deg,#e23a4e,#a02030);color:#fff;
  border:1px solid #c02838;font-size:12.5px;padding:8px 14px;font-weight:700;}
.ap-btn-play:hover{background:linear-gradient(180deg,#ff5060,#c03040);
  transform:translateY(-1px);box-shadow:0 4px 12px rgba(226,58,78,.45);}
.ap-btn-play.playing{background:linear-gradient(180deg,#444,#222);border-color:#555}
.ap-btn-yt-tab{background:transparent;color:var(--ink-soft);
  border:1px solid rgba(212,160,80,.25);font-size:11px;padding:7px 10px;}
.ap-btn-yt-tab:hover{color:var(--paper);border-color:var(--amber)}
.ap-amazon-row{display:flex;gap:6px;flex-wrap:wrap}
.ap-btn{font-family:"Inter",sans-serif;font-size:11.5px;font-weight:600;
  padding:7px 12px;border-radius:4px;text-decoration:none;
  letter-spacing:.04em;transition:all .2s;cursor:pointer;
  display:inline-flex;align-items:center;gap:4px;
  border:1px solid transparent;}
.ap-btn-primary{background:linear-gradient(180deg,#f5c878,#d4a050);
  color:var(--night);border-color:#d4a050;}
.ap-btn-primary:hover{background:linear-gradient(180deg,#ffd890,#e0b060);
  transform:translateY(-1px);box-shadow:0 4px 12px rgba(212,160,80,.4);}
.ap-btn-secondary{background:transparent;
  border:1px solid rgba(212,160,80,.4);color:var(--paper-dim);}
.ap-btn-secondary:hover{border-color:var(--amber);color:var(--paper);
  background:rgba(212,160,80,.1);}
.ap-btn-prime{background:rgba(0,168,225,.15);
  border:1px solid #00a8e1;color:#5fc8ff;}
.ap-btn-prime:hover{background:rgba(0,168,225,.28);color:#a0e0ff;
  transform:translateY(-1px);}
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
      14 の ジャンル と、 60+ の サブクラスタ と、 全 アーティスト を、<br>
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
      <p>14 の ジャンル を、<strong>静謐 ↔ 激情</strong> の 縦軸 と <strong>器楽 ↔ 声楽</strong> の 横軸 の 上 に 配置 した。 <em>ジャンル を クリック</em> すると 内側 が ひらき、 サブクラスタ が 現れる。 もう一度 同じ ジャンル を クリック すると 戻る (ESC キー / 「← 戻る」 ボタン / パンくず でも 可)。 <em>サブクラスタ を クリック</em> すると、 そこ に 住む アーティスト の 一覧 が 開く。</p>
    </div>

    <div class="map-wrap">
      <div class="map-toolbar">
        <div class="map-breadcrumb" id="breadcrumb">
          <span class="current">All Genres</span>
        </div>
        <div style="display:flex;align-items:center;gap:14px">
          <span class="map-hint" id="mapHint">クリック で 掘り下げ · ESC で 戻る</span>
          <button class="map-back" id="mapBack" disabled>← 戻る</button>
        </div>
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
            <button class="artist-list-close" id="artistListClose">閉じる ×</button>
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
      <p>14 の 部屋 を 横切って、 <em>「同じ 感覚 で 選ばれて いる」</em> と 分かる 5 つ の 直線 が 現れる。 これ が この コレクション の <strong>骨格</strong>。</p>
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

<div class="artist-popover" id="artistPopover">
  <button class="ap-close" id="apClose" aria-label="閉じる">×</button>
  <div class="ap-name" id="apName"></div>
  <div class="ap-sub" id="apSub"></div>
  <div class="ap-desc" id="apDesc"></div>
  <div class="ap-album" id="apAlbum"></div>
  <div class="ap-player-row">
    <button class="ap-btn ap-btn-play" id="apBtnPlayHere" type="button">▶ 即試聴</button>
    <a class="ap-btn ap-btn-yt-tab" id="apBtnYtTab" href="#" target="_blank" rel="noopener">YouTubeで開く ↗</a>
  </div>
  <div class="ap-player" id="apPlayer"></div>
  <div class="ap-amazon-row">
    <a class="ap-btn ap-btn-primary" id="apBtnMp3" href="#" target="_blank" rel="noopener sponsored">🎧 MP3 試聴/購入</a>
    <a class="ap-btn ap-btn-secondary" id="apBtnAll" href="#" target="_blank" rel="noopener sponsored">💿 CD/全商品</a>
    <a class="ap-btn ap-btn-prime" id="apBtnAmzMusic" href="#" target="_blank" rel="noopener sponsored">Amazon Music ↗</a>
  </div>
</div>

<script id="genres-data" type="application/json">__GENRES_JSON__</script>
<script id="spines-data" type="application/json">__SPINES_JSON__</script>
<script id="audio-data" type="application/json">__AUDIO_JSON__</script>
<script>
document.getElementById('year').textContent = new Date().getFullYear();
const GENRES = JSON.parse(document.getElementById('genres-data').textContent);
const SPINES = JSON.parse(document.getElementById('spines-data').textContent);
const AUDIO = JSON.parse(document.getElementById('audio-data').textContent);

const AMAZON_TAG = AUDIO.amazon_tag || 'viewsengineer-22';
const ASINS = AUDIO.amazon_asins || {};
function amazonAsin(artist){ return ASINS[artist] || null; }
// Direct product page when ASIN is known; search fallback otherwise.
function amazonProductUrl(artist, displayName, album){
  const asin = amazonAsin(artist);
  if (asin) return `https://www.amazon.co.jp/dp/${asin}?tag=${AMAZON_TAG}`;
  // Fallback: digital-music search using album-aware query
  const name = displayName || artist;
  const q = album ? `${name} ${album}` : name;
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(q)}&i=digital-music&tag=${AMAZON_TAG}`;
}
function amazonMusicAlbumUrl(artist){
  // Returns null when no ASIN — caller should hide the button.
  const asin = amazonAsin(artist);
  if (!asin) return null;
  return `https://music.amazon.co.jp/albums/${asin}?tag=${AMAZON_TAG}&ref=dm_sh_${AMAZON_TAG}`;
}
function amazonAllUrl(artist, displayName, album){
  // CD / Vinyl / 全商品 — physical media has different ASINs, so we keep search.
  const name = displayName || artist;
  const q = album ? `${name} ${album}` : name;
  return `https://www.amazon.co.jp/s?k=${encodeURIComponent(q)}&tag=${AMAZON_TAG}`;
}

// ─── Artist popover ───────────────────────────────
const apEl = document.getElementById('artistPopover');
const apName = document.getElementById('apName');
const apSub = document.getElementById('apSub');
const apDesc = document.getElementById('apDesc');
const apBtnPlayHere = document.getElementById('apBtnPlayHere');
const apBtnYtTab = document.getElementById('apBtnYtTab');
const apPlayer = document.getElementById('apPlayer');
const apBtnMp3 = document.getElementById('apBtnMp3');
const apBtnAll = document.getElementById('apBtnAll');
const apBtnAmzMusic = document.getElementById('apBtnAmzMusic');
let apHideTimer = null;
let apCurrentChip = null;
let apPinned = false;

function positionPopover(targetEl){
  const r = targetEl.getBoundingClientRect();
  const pop = apEl;
  pop.style.left = '0px'; pop.style.top = '0px'; // reset for measurement
  // Show first to measure
  pop.style.visibility = 'hidden';
  pop.classList.add('open');
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = r.left + r.width / 2 - pw / 2;
  let top = r.top - ph - 12;
  // Clamp horizontal
  const margin = 12;
  if (left < margin) left = margin;
  if (left + pw > window.innerWidth - margin) left = window.innerWidth - pw - margin;
  // Flip vertically if no room above
  if (top < margin) top = r.bottom + 12;
  if (top + ph > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - ph - margin);
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
  pop.style.visibility = 'visible';
}

const YT_IDS = AUDIO.youtube_ids || {};
function youtubeVideoId(artist){
  return YT_IDS[artist] || null;
}
function youtubeEmbedUrl(artist){
  const vid = youtubeVideoId(artist);
  if (vid) return `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&rel=0`;
  return null;
}
function youtubeWatchUrl(artist, displayName, album){
  const vid = youtubeVideoId(artist);
  if (vid) return `https://www.youtube.com/watch?v=${vid}`;
  // Fallback: search with display name + album when available, else artist + " full album"
  const q = album ? `${displayName || artist} ${album}` : `${displayName || artist} full album`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function clearPlayer(){
  apPlayer.classList.remove('open');
  apPlayer.innerHTML = '';
  apEl.classList.remove('has-player');
  apBtnPlayHere.classList.remove('playing');
  apBtnPlayHere.textContent = '▶ 即試聴';
}

let apCurrentArtist = null;
function startPlayer(){
  if (!apCurrentArtist) return;
  const url = youtubeEmbedUrl(apCurrentArtist);
  if (!url){
    // No pre-baked id — open YouTube search in a new tab as fallback
    window.open(youtubeWatchUrl(apCurrentArtist), '_blank', 'noopener');
    return;
  }
  apPlayer.innerHTML = `<iframe src="${url}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  apPlayer.classList.add('open');
  apEl.classList.add('has-player');
  apBtnPlayHere.classList.add('playing');
  apBtnPlayHere.textContent = '■ 停止';
  apPinned = true;
  if (apCurrentChip) positionPopover(apCurrentChip);
}

const apAlbum = document.getElementById('apAlbum');
let apCurrentDisplay = null;
let apCurrentAlbum = null;

function showPopover(slug, artist, sgName, desc, chipEl, display, album){
  clearTimeout(apHideTimer);
  if (apCurrentArtist !== artist) clearPlayer();
  apCurrentChip = chipEl;
  apCurrentArtist = artist;
  apCurrentDisplay = display || artist;
  apCurrentAlbum = album || null;
  apName.textContent = apCurrentDisplay;
  apSub.textContent = sgName;
  apDesc.textContent = desc || '(詳細未登録)';
  if (apCurrentAlbum && apCurrentAlbum.title){
    const yr = apCurrentAlbum.year ? ` (${apCurrentAlbum.year})` : '';
    apAlbum.innerHTML = `<span class="ap-album-label">推奨盤</span>${apCurrentAlbum.title}${yr}`;
  } else {
    apAlbum.innerHTML = '';
  }
  // Search/embed queries use display name + album when available
  const searchName = apCurrentDisplay;
  const albumTitle = apCurrentAlbum ? apCurrentAlbum.title : null;
  apBtnYtTab.href = youtubeWatchUrl(artist, searchName, albumTitle);
  apBtnMp3.href = amazonProductUrl(artist, searchName, albumTitle);
  apBtnAll.href = amazonAllUrl(artist, searchName, albumTitle);
  // Amazon Music: only show when we have a direct ASIN link
  const amzMusicUrl = amazonMusicAlbumUrl(artist);
  if (amzMusicUrl){
    apBtnAmzMusic.href = amzMusicUrl;
    apBtnAmzMusic.style.display = '';
  } else {
    apBtnAmzMusic.style.display = 'none';
  }
  // Update MP3 button label: "アルバムへ" when ASIN-direct, "MP3 試聴/購入" when search
  if (amazonAsin(artist)){
    apBtnMp3.textContent = '🎧 アルバムへ';
    apBtnMp3.title = 'Amazon でこの推奨盤を直接開く';
  } else {
    apBtnMp3.textContent = '🎧 MP3 試聴/購入';
    apBtnMp3.title = 'Amazon MP3 検索結果';
  }
  apBtnPlayHere.title = youtubeVideoId(artist) ? 'YouTube で即試聴' : '即試聴IDが未登録 — YouTubeを新規タブで開きます';
  positionPopover(chipEl);
}

function hidePopover(){
  clearPlayer();
  apEl.classList.remove('open');
  apEl.style.visibility = '';
  apCurrentChip = null;
  apCurrentArtist = null;
  apPinned = false;
}

apBtnPlayHere.addEventListener('click', (e) => {
  e.stopPropagation();
  apPinned = true;
  clearTimeout(apHideTimer);
  if (apPlayer.classList.contains('open')) {
    clearPlayer();
    if (apCurrentChip) positionPopover(apCurrentChip);
  } else {
    startPlayer();
  }
});

function scheduleHide(){
  clearTimeout(apHideTimer);
  apHideTimer = setTimeout(hidePopover, 200);
}

apEl.addEventListener('mouseenter', () => clearTimeout(apHideTimer));
apEl.addEventListener('mouseleave', scheduleHide);
document.getElementById('apClose').addEventListener('click', hidePopover);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePopover(); });
document.addEventListener('click', (e) => {
  if (!apEl.contains(e.target) && !e.target.closest('.artist-chip')) hidePopover();
});

const layerGenre = document.getElementById('layerGenre');
const layerSubgroup = document.getElementById('layerSubgroup');
const panel = document.getElementById('panel');
const breadcrumb = document.getElementById('breadcrumb');
const mapBack = document.getElementById('mapBack');
const mapSvg = document.getElementById('mapSvg');

let state = { level: 0, genre: null, subgroup: null };

function clearLayer(el){ while(el.firstChild) el.removeChild(el.firstChild); }
function clamp(s, n){ return s.length > n ? s.substring(0, n-1)+'…' : s; }

function showGenres(){
  clearLayer(layerGenre);
  clearLayer(layerSubgroup);
  Object.entries(GENRES).forEach(([slug, g]) => {
    const grp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    grp.setAttribute('class', 'genre-bubble');
    grp.setAttribute('data-slug', slug);
    grp.style.opacity = '1';
    grp.innerHTML = `
      <circle cx="${g.x}" cy="${g.y}" r="38" fill="${g.color}" fill-opacity=".42" stroke="${g.color}" stroke-width="1.4"/>
      <text x="${g.x}" y="${g.y - 4}" font-size="${g.name_jp.length > 6 ? 11 : 13}">${clamp(g.name_jp, 8)}</text>
      <text x="${g.x}" y="${g.y + 12}" class="en">${clamp(g.name_en, 14)}</text>
    `;
    grp.addEventListener('click', (ev) => { ev.stopPropagation(); openGenre(slug); });
    layerGenre.appendChild(grp);
  });
}

function openGenre(slug){
  // If clicking the already-active genre, toggle back to L0
  if (state.level >= 1 && state.genre === slug) {
    resetToL0();
    return;
  }

  state = { level: 1, genre: slug, subgroup: null };
  const g = GENRES[slug];

  // Highlight selected, dim others (but keep them clickable to switch)
  Array.from(layerGenre.children).forEach(child => {
    const isActive = child.getAttribute('data-slug') === slug;
    child.style.opacity = isActive ? '1' : '0.32';
    child.classList.toggle('active', isActive);
    const c = child.querySelector('circle');
    if (c) c.setAttribute('r', isActive ? '60' : '38');
  });

  // Place subgroup bubbles around the genre center
  clearLayer(layerSubgroup);
  const n = g.subgroups.length;
  // Adaptive radius based on subgroup count (more = bigger ring)
  const radius = Math.min(140, 90 + n * 4);
  g.subgroups.forEach((sg, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const sx = g.x + Math.cos(angle) * radius;
    const sy = g.y + Math.sin(angle) * radius;
    const grp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    grp.setAttribute('class', 'subgroup-bubble');
    grp.setAttribute('data-i', i);
    const label = clamp(sg.name_jp, 8);
    const isAuto = !!sg.auto;
    const fillOpacity = isAuto ? '.32' : '.55';
    grp.innerHTML = `
      <circle cx="${sx}" cy="${sy}" r="28" fill="${g.color}" fill-opacity="${fillOpacity}" stroke="${g.color}" stroke-width="1.2" ${isAuto ? 'stroke-dasharray="2,3"' : ''}/>
      <text x="${sx}" y="${sy}" font-size="9">${label}</text>
    `;
    grp.addEventListener('click', (ev) => { ev.stopPropagation(); openSubgroup(slug, i); });
    layerSubgroup.appendChild(grp);

    // Connection line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', g.x); line.setAttribute('y1', g.y);
    line.setAttribute('x2', sx); line.setAttribute('y2', sy);
    line.setAttribute('stroke', g.color); line.setAttribute('stroke-opacity', '0.4');
    line.setAttribute('stroke-dasharray', '2,3'); line.setAttribute('stroke-width', '1');
    line.setAttribute('pointer-events', 'none');
    layerSubgroup.insertBefore(line, layerSubgroup.firstChild);
  });

  // Panel content
  document.getElementById('panelJp').textContent = g.name_jp;
  document.getElementById('panelEn').textContent = g.name_en;
  document.getElementById('panelLatin').textContent = g.latin;
  document.getElementById('panelEssence').textContent = g.essence;
  document.getElementById('panelEssay').innerHTML = g.essay;

  const grid = document.getElementById('subgroupGrid');
  grid.innerHTML = '';
  g.subgroups.forEach((sg, i) => {
    const card = document.createElement('div');
    card.className = 'subgroup-card' + (sg.auto ? ' auto' : '');
    card.setAttribute('data-i', i);
    card.innerHTML = `
      <div class="sg-jp">${sg.name_jp}</div>
      <div class="sg-en eng">${sg.name_en}</div>
      <div class="sg-blurb">${sg.blurb}</div>
      <div class="sg-arrow">クリック で アーティスト 一覧 →</div>
    `;
    card.addEventListener('click', () => openSubgroup(slug, i));
    grid.appendChild(card);
  });

  document.getElementById('artistList').classList.remove('open');
  panel.classList.add('open');
  updateBreadcrumb();
  document.querySelector('.map-wrap').scrollIntoView({behavior:'smooth', block:'start'});
}

function openSubgroup(slug, idx){
  state = { level: 2, genre: slug, subgroup: idx };
  const g = GENRES[slug];
  const sg = g.subgroups[idx];

  document.querySelectorAll('.subgroup-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`.subgroup-card[data-i="${idx}"]`)?.classList.add('active');

  document.getElementById('artistListTitle').textContent = `${sg.name_jp} · ${sg.name_en}`;
  const chips = document.getElementById('artistChips');
  chips.innerHTML = '';
  const descs = g.artist_descs || {};
  const displays = g.artist_displays || {};
  const albums = g.artist_albums || {};
  sg.artists.forEach(a => {
    const span = document.createElement('span');
    span.className = 'artist-chip';
    const display = displays[a] || a;
    span.textContent = display;
    const album = albums[a] || null;
    const desc = descs[a] || sg.blurb;
    span.title = album ? `${display} — ${album.title}${album.year?` (${album.year})`:''}` : `${display} — ${desc}`;
    span.addEventListener('click', (ev) => {
      ev.stopPropagation();
      apPinned = true;
      clearTimeout(apHideTimer);
      showPopover(slug, a, `${g.name_jp} · ${sg.name_jp}`, desc, span, display, album);
    });
    span.addEventListener('mouseenter', () => {
      if (apPinned) return;
      clearTimeout(apHideTimer);
      showPopover(slug, a, `${g.name_jp} · ${sg.name_jp}`, desc, span, display, album);
    });
    span.addEventListener('mouseleave', () => { if (!apPinned) scheduleHide(); });
    chips.appendChild(span);
  });
  document.getElementById('artistList').classList.add('open');
  updateBreadcrumb();
  document.getElementById('artistList').scrollIntoView({behavior:'smooth', block:'nearest'});
}

function resetToL0(){
  state = { level: 0, genre: null, subgroup: null };
  showGenres();
  panel.classList.remove('open');
  document.getElementById('artistList').classList.remove('open');
  updateBreadcrumb();
  document.querySelector('.map-wrap').scrollIntoView({behavior:'smooth', block:'start'});
}

function back(){
  if (state.level === 2) {
    state.subgroup = null;
    state.level = 1;
    document.querySelectorAll('.subgroup-card').forEach(c => c.classList.remove('active'));
    document.getElementById('artistList').classList.remove('open');
    updateBreadcrumb();
  } else if (state.level === 1) {
    resetToL0();
  }
}

function updateBreadcrumb(){
  const parts = [];
  if (state.level === 0) {
    parts.push('<span class="current">All Genres</span>');
  } else {
    parts.push('<a id="bcRoot">All Genres</a>');
  }
  if (state.level >= 1 && state.genre) {
    parts.push(`<span class="sep">›</span>`);
    parts.push(state.level === 1
      ? `<span class="current">${GENRES[state.genre].name_jp}</span>`
      : `<a id="bcGenre">${GENRES[state.genre].name_jp}</a>`);
  }
  if (state.level >= 2) {
    parts.push(`<span class="sep">›</span>`);
    const sgName = GENRES[state.genre].subgroups[state.subgroup].name_jp;
    parts.push(`<span class="current">${sgName}</span>`);
  }
  breadcrumb.innerHTML = parts.join('');
  document.getElementById('bcRoot')?.addEventListener('click', () => resetToL0());
  document.getElementById('bcGenre')?.addEventListener('click', () => back());
  mapBack.disabled = (state.level === 0);
}

mapBack.addEventListener('click', back);

// ESC key — go back one level
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.level > 0) back();
});

// Click on SVG empty space → reset to L0
mapSvg.addEventListener('click', (e) => {
  if (e.target === mapSvg && state.level > 0) resetToL0();
});

// "Close" button on artist list → step up to L1
document.getElementById('artistListClose')?.addEventListener('click', back);

showGenres();
updateBreadcrumb();

// ─── Spines ────────────────────────────────────────────
const spinesSvg = document.getElementById('spinesSvg');
const spinesLegend = document.getElementById('spinesLegend');

SPINES.forEach((sp, idx) => {
  const y = 100 + idx * 130;
  const xs = sp.nodes.map((_, i) => 100 + i * (900 / Math.max(1, sp.nodes.length - 1)));
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('class', 'spine');
  path.setAttribute('stroke', sp.color);
  let d = '';
  xs.forEach((x, i) => { d += (i === 0 ? `M ${x},${y}` : ` L ${x},${y + (i % 2 ? 18 : -8)}`); });
  path.setAttribute('d', d);
  spinesSvg.appendChild(path);
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('class', 'spine-label');
  label.setAttribute('x', 100); label.setAttribute('y', y - 24);
  label.setAttribute('fill', sp.color);
  label.textContent = `${'①②③④⑤'[idx]} ${sp.name} — ${sp.name_jp}`;
  spinesSvg.appendChild(label);
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


AMAZON_TAG = "viewsengineer-22"

def amazon_url(artist):
    """Build Amazon JP affiliate search URL for an artist name."""
    import urllib.parse
    q = urllib.parse.quote(artist, safe="")
    # i=digital-music focuses on music products (CD/MP3/streaming)
    return f"https://www.amazon.co.jp/s?k={q}&i=digital-music&tag={AMAZON_TAG}"


YT_IDS_FILE = Path(__file__).parent / "youtube_ids.json"
ASIN_FILE = Path(__file__).parent / "amazon_asins.json"

def load_youtube_ids():
    """Load pre-baked artist→videoId mapping (built by fetch_youtube_ids.py)."""
    if not YT_IDS_FILE.exists():
        return {}
    d = json.loads(YT_IDS_FILE.read_text(encoding="utf-8"))
    return {k: v for k, v in d.items() if v}


def load_amazon_asins():
    """Load pre-baked artist→ASIN mapping (built by fetch_amazon_asins.py).

    Returns { artist_name: asin } — only entries with successful asin lookups.
    """
    if not ASIN_FILE.exists():
        return {}
    d = json.loads(ASIN_FILE.read_text(encoding="utf-8"))
    out = {}
    for k, v in d.items():
        if isinstance(v, dict) and v.get("asin"):
            out[k] = v["asin"]
    return out


def load_audio_mapping():
    """Load pCloud publink + fileid mapping if available; build Amazon URLs."""
    yt_ids = load_youtube_ids()
    asins = load_amazon_asins()
    base = {
        "publink_code": None, "mapping": {}, "amazon_tag": AMAZON_TAG,
        "youtube_ids": yt_ids, "amazon_asins": asins,
    }
    if not PCLOUD_JSON.exists():
        return base
    d = json.loads(PCLOUD_JSON.read_text(encoding="utf-8"))
    base.update({
        "publink_code": d.get("publink_code"),
        "mapping": d.get("mapping", {}),
    })
    return base


def main():
    data, spines = build_data()
    audio = load_audio_mapping()
    html = HTML_TEMPLATE.replace("__GENRES_JSON__", json.dumps(data, ensure_ascii=False))
    html = html.replace("__SPINES_JSON__", json.dumps(spines, ensure_ascii=False))
    html = html.replace("__AUDIO_JSON__", json.dumps(audio, ensure_ascii=False))
    OUT.write_text(html, encoding="utf-8")
    print(f"  audio-mapped: {len(audio['mapping'])} (code: {audio['publink_code'] or 'none'})")
    print(f"  youtube-ids: {len(audio.get('youtube_ids') or {})}")
    print(f"  amazon-asins: {len(audio.get('amazon_asins') or {})}")

    total = sum(len(g["all_artists"]) for g in data.values())
    cat = sum(sum(len(sg["artists"]) for sg in g["subgroups"] if not sg.get("auto"))
              for g in data.values())
    auto = sum(sum(len(sg["artists"]) for sg in g["subgroups"] if sg.get("auto"))
               for g in data.values())
    sg_count = sum(len(g["subgroups"]) for g in data.values())
    print(f"  saved: salon.html  ({OUT.stat().st_size // 1024} KB)")
    print(f"  total artists: {total}, manually categorized: {cat}, auto-bucketed: {auto}")
    print(f"  total subgroups (curated + auto): {sg_count}")


if __name__ == "__main__":
    main()
