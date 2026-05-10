"""Manual classification additions for previously-uncategorized artists.

This file contains 'additions to existing subgroups' and 'new subgroups'
per genre. The main generator (generate_salon_map.py) merges these in.

Source: hand-curated by reviewing each artist's musical character.
Goal: replace alphabet-bucketed Periphery with proper musical classification.
"""

# Format:
# ADDITIONS[slug] = {
#   "to_existing": {"既存サブクラスタ名_jp": [artist1, artist2, ...]},
#   "new_subgroups": [
#     {"name_jp": "...", "name_en": "...", "blurb": "...", "artists": [...]},
#     ...
#   ]
# }

ADDITIONS = {

# ─── Healing ───────────────────────────────────────────────────
"healing": {
    "to_existing": {
        "ポストクラシカル / 静謐": [
            "Ashram (Luigi Rubino & Edo Notarloberti)", "Carsten Dahl",
            "Jo Gabriel", "Ophelia's Dream", "Arris",
        ],
        "ソロピアノ・ニューエイジ": [
            "Ann Sweeten", "Deborah Offenhauser", "Derek Wille",
            "Matias Baconsky", "Stefano Busa",
        ],
        "シンセ・エピック / シネマティック": [
            "Kevin Kendle", "Ronald Van Deurzen", "Violet Sky",
            "Martin Czerny", "Two Steps From Hell",
        ],
        "世界・スピリチュアル": [
            "Ann Licater", "Derek Fiechter", "Jean-Marc Staehle",
            "Michel Pepe", "Omar Akram", "Ricardo Caliente & Los De La Flauta",
            "Secret garden", "sToa", "Didier Squiban",
        ],
        "クロスオーバー・ピアノ": [
            "Peggy Duquesnel", "See Siang Wong",
        ],
        "和テイスト / JP New Age": [
            "Dream Dolphin", "Rovo",
        ],
    },
    "new_subgroups": [
        {"name_jp": "コンピレーション・整理用", "name_en": "Compilations / Misc",
         "blurb": "ヒーリング系のコンピレ盤や、 整理ミスのフォルダ等。",
         "artists": ["Any_flac", "Best of _The World Heritage", "Corcioll",
                     "Dream Paradise vol.1+vol.2+vol.3", "earthgrooves vol.2",
                     "emu2 most touching", "Ethan Averton;Jared Kraft",
                     "flow_healing compilation", "HEALING on THE MOON",
                     "Healing Waves", "Neil H", "Oiegano", "Richard Evans",
                     "Rick Sparks", "Silence", "study", "The Great Northern",
                     "VA", "Zen_Mindfullness", "新しいフォルダー"]},
    ],
},

# ─── Progressive ──────────────────────────────────────────────
"progressive": {
    "to_existing": {
        "英国シンフォニック古典": [
            "Genesis", "Marillion", "Pendragon", "Mike Oldfield",
            "Jon Anderson", "Galahad", "Pallas", "Mystery", "Mandalaband",
            "Tiger Moth Tales", "Willowglass", "ESP Project", "IO Earth",
            "IOEarth", "The Pineapple Thief", "Subsignal",
            "Lifesigns_-_2017_-_Cardington__FLAC",
        ],
        "地中海ネオプログ": [
            "Arti E Mestieri", "Eris Pluvia", "Gatto Marte", "Hostsonaten",
            "Il Balletto Di Bronzo", "La Coscienza di Zeno", "Latte E Miele",
            "LOCANDA DELLE FATE", "Maxophone", "New Trolls",
            "Premiata Forneria Marconi", "Quella Vecchia Locanda",
            "Syndone", "Tortilla Flat", "Homunculus Res",
        ],
        "RIO / アヴァン・ロック": [
            "Magma", "Opus Avantra", "Yugen", "UNIVERSAL TOTEM ORCHESTRA",
            "Kalacakra", "Wapassou", "Stéphane Collin", "Katzen Kapell",
            "Tin Hat Trio", "seffer", "Phaedra", "Russkaja",
        ],
    },
    "new_subgroups": [
        {"name_jp": "アメリカン・プログ", "name_en": "American Prog",
         "blurb": "Kansas 系から Pattern-Seeking Animals まで、 米国産プログ。",
         "artists": ["Kansas", "Pattern-Seeking Animals", "Thank You Scientist",
                     "Joey Frevola", "Hardscore", "Inner Drive",
                     "Vienna", "Sanhedrin"]},
        {"name_jp": "北欧プログ", "name_en": "Nordic Prog",
         "blurb": "Anglagard 後継・スウェーデン・フィンランド勢。",
         "artists": ["Moon Safari", "Isildurs Bane", "Lost World", "Malady",
                     "Kaizen", "UZVA", "Tirill", "Mr. sirius",
                     "Susanne Lundeng", "Lindh Par and Bjorn Johansson",
                     "Kimmo Porsti", "Yuka & Chronoship", "STELLA LEE JONES"]},
        {"name_jp": "東欧・ロシア・スラヴ", "name_en": "Eastern Europe / Slavic",
         "blurb": "ロシア・ウクライナ・チェコ・ポーランド・バルカン圏のプログ。",
         "artists": ["Karfagen", "Pesniary", "Wojciech Ciuraj",
                     "Quaterna Requiem", "Diego Schissi", "Sedmina",
                     "Zypressen", "Marco Antonio Araújo1984 Lucas [Brazil PRW 016].ape",
                     "SAGRADO", "Stamatis Spanoudakis", "Taxidi",
                     "Savina Yannatou"]},
        {"name_jp": "ジャズロック・カンタベリー", "name_en": "Jazz-Rock / Canterbury",
         "blurb": "Cordame・Maraca 系のフュージョン寄り、 古典カンタベリー。",
         "artists": ["Cordame", "Maraca", "Outer Limits", "Tai Phong",
                     "NU", "MUSIC 4 A WHILE", "Tin Hat Trio",
                     "Musica Urbana", "Fruupp", "Mauro Pagani",
                     "Marco Antonio Araújo1984 Lucas [Brazil PRW 016].ape"]},
        {"name_jp": "プログ・メタル境界", "name_en": "Prog/Metal Border",
         "blurb": "Dream Theater 系・Subsignal 等メタル寄り。",
         "artists": ["Jordan Rudess", "Rick Wakeman", "Darryl Way",
                     "David Minasian", "Pallas"]},
        {"name_jp": "シネマティック・ポストプログ", "name_en": "Cinematic / Post-Prog",
         "blurb": "Pineapple Thief・iamthemorning 系 21世紀の叙情。",
         "artists": ["iamthemorning", "Nova Cascade", "Syrinx Call",
                     "Pikapika TeArt", "PTF", "Organic Noises",
                     "Rodrigo Leão & Cinema Ensemble"]},
        {"name_jp": "プログ・コンピレーション", "name_en": "Prog Compilations",
         "blurb": "VAコンピや特殊ボックス。",
         "artists": []},
        {"name_jp": "アヴァン古典・ジャーマン", "name_en": "Avant Classic / Krautrock",
         "blurb": "Popol Vuh・Magma 周辺ドイツ語圏の前衛。",
         "artists": ["Popol Vuh", "Parzzival", "Vivo",
                     "Mauro Pagani", "Wapassou", "Maxophone"]},
        {"name_jp": "周辺・モダン折衷", "name_en": "Eclectic / Misc Modern",
         "blurb": "ジャンル特定が難しい多彩な現代プログ。",
         "artists": ["Emmett Elvin", "Er.J.Orchestra", "Fall of Episteme",
                     "Finnegans Wake 4th", "Flairck", "Galahad",
                     "Guranfoe", "Harmonium", "Ibis", "Island", "La Maquina Cinematica",
                     "Mr. sirius", "Maraca", "Miguel Czachowski",
                     "Minimum Vital", "Opus Arise", "Premiata Forneria Marconi",
                     "Premiata Forneria Marconi", "Russkaja", "The Samurai Of Prog",
                     "Ser un Peyjalero", "Silhouette", "Tortilla Flat"]},
    ],
},

# ─── Jazz & Fusion ───────────────────────────────────────────
"jazz": {
    "to_existing": {
        "ECMピアノトリオ": [
            "Emil Brandqvist Trio", "Tingvall Trio-Pax", "RUSCONI",
            "the great jazz trio", "Steve Kuhn", "Walter Bishop Jr",
            "Keith Jarrett", "The Koln Concert",
        ],
        "室内楽ジャズ": [
            "Louis Sclavis", "Marbin", "Playwright",
        ],
        "地中海＆中東": [
            "Giovanni Mirabassi Trio & Strings", "Michel Camilo & Tomatito",
            "Pavol Bodnár & InterJAZZional Band", "Musique à Neuf",
            "Musicazur", "Nocni Optika",
        ],
        "電化フュージョン": [
            "Jaco Pastorius", "Hiromi Uehara", "Incognito", "Indigo Jam Unit",
            "Kamasi Washington", "Richard Tee", "Tiger Okoshi",
            "The Bad Plus", "Uptown Jazz Underground", "jizue",
        ],
        "周辺 / その他": [
            "Debussy, Arturo Benedetti Michelangeli", "Milton Nascimiento",
            "Mingui Ingaramo", "Juan Garcia", "Nakagawa Poesy 1996",
            "MA_Recordings",
        ],
    },
    "new_subgroups": [
        {"name_jp": "ビッグバンド・古典", "name_en": "Big Band / Classic",
         "blurb": "Ellington 系から The Bill Holman Band まで。",
         "artists": ["Masterpieces By Ellington", "The Bill Holman Band"]},
        {"name_jp": "コンピレーション・サウンドトラック", "name_en": "Compilations / Soundtracks",
         "blurb": "ジャズで奏でるアニメ・サントラ。",
         "artists": ["DLRAW.TO_Oto_no_hazure_no_renkinjutsushi vol 01-06",
                     "SUPER SOUND COLLECTION スタジオジブリ吹奏楽",
                     "XRCD 国府弘子NEWYORK UNCOVER"]},
    ],
},

# ─── Classic ──────────────────────────────────────────────────
"classic": {
    "to_existing": {
        "黄金期巨匠": [
            "『Great.Pianists.of.the.20th.Century』.Vol.58.-.Evgeny.Kissin",
        ],
        "コンピレーション・周辺": [
            "フジ子・ヘミング チャイコフスキー：ピアノ協奏曲第一番 他 (UCCD-1086『トロイカ』)",
        ],
    },
    "new_subgroups": [],
},

# ─── Metal & Hard Rock ────────────────────────────────────────
"metal": {
    "to_existing": {
        "ジャーマン・ファンタジー・パワー": [
            "DragonForce", "Edu Falaschi", "Fair Warning", "Frozen Crown",
            "Gloryhammer", "Hyperion", "Last Autumn's Dream", "Light Bringer",
            "Lione", "Luca Turilli (Symphonic Power Metal • Italy)",
            "Majestica", "MinstreliX", "Nocturnal Rites (Power Metal • Sweden)",
            "Pathfinder", "Powerwolf", "Primal Fear",
            "Rhapsody Of Fire", "Sonata Arctica", "Symphonity",
            "Theocracy", "Twilight Force", "Victorius", "WarKings",
            "Heavenly", "Kamelot (Progressive Melodic Power Metal • United States)",
            "Kelly Simonz's Blind Faith", "Vision Divine",
        ],
        "シンフォニック / ネオクラ": [
            "Lacrimosa", "Serenity 2016", "Serenity In Murder",
            "Serenity In Murder 2017", "Wuthering Heights", "Xandria 2017",
            "Haggard", "Elend", "Ten", "Thousand Eyes", "Volcano",
            "Tina Guo", "Thomas Bergersen",
        ],
        "北欧メロデス・ブラック": [
            "Embraced", "Emperor", "Equilibrium", "Graveworm", "GYZE",
            "Ihsahn", "Kalmah", "Meadows End", "Moonsorrow",
            "Profugus Mortis", "Sad Legend", "Sentenced", "Sigh",
            "Swallow the Sun", "Whispered", "Sunburst 2016",
            "Sunset Wings", "Titanium 2016", "Zeno",
        ],
        "和テイスト・JP メタル": [
            "Dir En Grey", "Hagane", "Lareine", "MALICE MIZER",
            "Matenrou Opera", "MY MATERIAL SEASON", "NoGoD", "Onmyo-Za",
            "Ryujin", "She-Ja", "SKYWINGS", "Volcano", "浜田麻里",
            "聖飢魔II", "LOVEBITES", "Mai Yajima", "GYZE",
            "Japanese Folk Metal (2018.11.07) Japanese Folk Metal",
            "Shiver of Frontier", "Zemeth",
        ],
        "プログ・テクニカル・モダン": [
            "Dream Theater", "Evergrey", "Leprous", "Liquid Tension Experement",
            "Obscura", "Opeth", "Persefone", "Queensryche", "Seventh Wonder",
            "SYMPHONY X", "Eternity's End", "Steve Vai", "Uli Jon Roth",
            "Sixx.A.M", "Myrath", "Delirion",
        ],
    },
    "new_subgroups": [
        {"name_jp": "クラシック・ロック / ハードロック", "name_en": "Classic Rock / Hard Rock",
         "blurb": "Judas Priest・Megadeth など80sハードロック&スラッシュ古典。",
         "artists": ["Judas Priest", "Megadeth", "Slayer", "Guns N' Roses",
                     "Gary Moore Gold", "Vow Wow"]},
        {"name_jp": "ゴシック・メタル", "name_en": "Gothic Metal",
         "blurb": "Lacrimosa 系の暗黒美学・女性ボーカル。",
         "artists": ["The Elysian Fields", "Malevolence", "Gire",
                     "Fugatta", "Rising.Shadows"]},
        {"name_jp": "コンピレーション・周辺", "name_en": "Compilations / Periphery",
         "blurb": "整理ミスフォルダや特殊エントリ。",
         "artists": ["Serpent", "Waltari", "新しいフォルダー"]},
    ],
},

# ─── Indies (Doujin) ──────────────────────────────────────────
"indies": {
    "to_existing": {
        "シンフォニック・デス・アニソン": [
            "Unlucky Morpheus", "Marchen Station", "TEARS OF TRAGEDY",
            "黒夜葬「創作音源集 -骸-」", "狂奏楽団",
        ],
        "ゴシック × ヴァイオリン": [
            "Klaus -Nostalgias", "Liz Triangle", "Tears Nocturn",
            "Theodor Bastard", "Zephyr Violin Duo",
        ],
        "シューゲーザー寄り": [
            "Lost my Proust", "LostFairy", "Rejection", "Release Hallucination",
            "Resonecia", "Roman so Words", "Sana", "soLi (2021.12.08) My Garden …",
            "Symholic", "夢想茶館", "星猫音楽",
        ],
        "ノベルゲーOST周辺": [
            "Iyunaline Feat. 中原涼", "Krik／Krak", "Laqshe",
            "Link to You？ (SHIKI) 1.0", "MALIKLIYA",
            "Queen of Wand", "RoyReine", "SiMPLE EQUATiON",
            "Souwer", "stellatram", "SUNRISE FACTORY", "Tinkerbell sound label",
            "Tinkerbell Sound Label (CrossingYourself)", "Tynwald music",
            "Voltage of Imagination 2.1", "Yuria Miyazono",
            "Studio A'", "yucat",
        ],
        "ピアノ・アコースティック": [
            "Arthur", "Clinochlore", "CORONA －Orgel Collection－",
            "kano", "kaoling", "mamomo", "morinoco_studio",
            "西本梨江 ピアノ, 村川千尋 バイオリン", "オトノネ。音楽集-第一楽章- [CD][FLAC+CUE+LOG+BK]",
            "][Hi-Res]祈りの丘", "なぐもりずの音楽室",
        ],
        "東方アレンジ周辺": [
            "TAMUSIC", "Liz Triangle", "Diverse System 4.0",
            "love solfege", "k-waves LAB", "Rokugen Alice 3.0",
            "Roman so Words", "Lost my Proust",
        ],
        "ハードコア・メタル": [
            "Sound of Swing", "WAVE", "M-Groove", "RESOUND WAV",
            "Rigel Theatre",
        ],
    },
    "new_subgroups": [
        {"name_jp": "ボカロ・合成音声系", "name_en": "Vocaloid / Synth Voice",
         "blurb": "初音ミク等のボーカロイド使用、 ボカロP系。",
         "artists": ["Melnik／ニャントロ人／初音ミク", "Wolpis Carter",
                     "wowaka", "Voltage of Imagination 2.1"]},
        {"name_jp": "エレクトロニカ・テクノ系", "name_en": "Electronica / Techno",
         "blurb": "踊れる/沈む電子音楽の同人サークル。",
         "artists": ["bermei.inazawa", "cy：cle", "Electro.muster",
                     "Diverse System 4.0", "ffffff Records",
                     "el ma Riu", "Mag2 Software", "ZIZZ Studio music collection",
                     "M-Groove", "Sound of Swing"]},
        {"name_jp": "フォーク・民族系同人", "name_en": "Folk / World Doujin",
         "blurb": "ケルト・中世風・民族楽器を使った同人。",
         "artists": ["Tuatha De Danann", "forest", "el ma Riu",
                     "MALIKLIYA", "Krik／Krak", "Theodor Bastard"]},
        {"name_jp": "コーラス・合唱系", "name_en": "Chorus / Choral",
         "blurb": "合唱・コーラス重視の同人作品。",
         "artists": ["Fiorista Felice", "love solfege", "yucat",
                     "Yuria Miyazono"]},
        {"name_jp": "実験・前衛系", "name_en": "Experimental / Avant",
         "blurb": "ノイズ・即興・カットアップなど特殊な音作り。",
         "artists": ["Ether&エルム凪", "MiddleIsland", "Noah",
                     "notte", "onoken", "RoyReine", "Symholic",
                     "Klaus -Nostalgias"]},
        {"name_jp": "コンピレーション / 整理用", "name_en": "Compilations / Misc",
         "blurb": "ベスト・コンピや整理ミスのフォルダ。",
         "artists": ["Barbarian On The Groove 3.0", "dama",
                     "Elliot Hsu", "Elymusia", "himajin-sound (たけやん)",
                     "Klaus -Nostalgias", "maracy", "MiddleIsland",
                     "mozell kuhu", "nayuta", "pub house himari",
                     "Rokugen Alice 3.0", "Sana", "sea-no",
                     "SiMPLE EQUATiON", "soLi (2021.12.08) My Garden …",
                     "Souwer", "Street", "Studio A'", "stellatram",
                     "SUNRISE FACTORY", "Symholic", "TAMUSIC",
                     "timeless melody 茶太", "Tinkerbell sound label",
                     "Tinkerbell Sound Label (CrossingYourself)",
                     "toyKasket", "Tynwald music", "Unknown",
                     "WAVE", "yucat", "Yuria Miyazono", "なぐもりずの音楽室",
                     "オトノネ。音楽集-第一楽章- [CD][FLAC+CUE+LOG+BK]",
                     "埼玉最終兵器 & Aether", "夢想茶館", "新しいフォルダー",
                     "星猫音楽", "柊南(ひいな)＆clan(くらん)", "狂奏楽団",
                     "黒夜葬「創作音源集 -骸-」", "TAMUSIC"]},
    ],
},

# ─── JPOP ─────────────────────────────────────────────────────
"jpop": {
    "to_existing": {
        "王道JPOP/ロック": [
            "L'Arc en Ciel", "L’Arc en Ciel", "Official髭男dism",
            "SARD UNDERGROUND", "SEKAI NO OWARI 7thアルバム「Nautilus」[96kHz／24bit]",
            "TM NET", "WANDS", "ZARD Forever", "倍賞千恵子",
            "宇多田ヒカル 25周年記念アルバム「SCIENCE FICTION」[96kHz／24bit]",
            "ポルノグラフィティ 25周年記念ベストアルバム「ポルノグラフィティ全書",
            "森山直太朗 -素晴らしい世界",
            "米津玄師 6thアルバム「LOST CORNER」[48kHz／24bit]",
            "Miyuki Nakajima", "美空ひばり",
        ],
        "現代叙情ボーカル": [
            "kokia", "majiko", "Mili", "Rurutia", "Suara", "Uru",
            "Yoasobi", "ReoNa", "あたらよ 1stアルバム「極夜において月は語らず」",
            "三月のパンタシア 10周年記念ベストアルバム「多彩透明なブルーだった」",
            "三月のパンタシア 5th Album「愛の不可思議」[48kHz／24bit]",
            "亜咲花 3rd Album「Who’s Me？」",
            "ヘブンバーンズレッド 麻枝准×やなぎなぎ 2ndアルバム「Welcome to the Dying Season」",
            "こはならむ", "fhána", "eufonius", "ORIGA",
            "May’n", "Reol", "Reol 4th Album「美辞学」[48kHz／24bit]",
        ],
        "ヴィジュアル系・ゴシック": [
            "hizaki", "Moi dix Mois", "MUCC", "Yousei Teikoku 3.0",
            "The Rose",
        ],
        "アニソン・声優": [
            "Kalafina", "Yuki Kajiura", "fripSide", "MELL", "Lia",
            "Tiara", "Zwei", "TWO-MIX 25th Anniversary ALL TIME",
            "GRANRODEO 20th BEST ALBUM「DOUBLE DECADES OF GR」",
            "mao Best Album「voice」", "水樹奈々 4thベストアルバム「THE MUSEUM Ⅳ」",
            "林原めぐみ 30th Anniversary Best Album「VINTAGE DENIM」",
            "茶太 Works", "茶太 Works Best Ⅱ", "Wakana",
            "vip店長",
        ],
        "インストゥルメンタル / プロデューサー": [
            "Pia-no-jaC", "SUEMITSU & THE SUEMITH", "Sound Horizon",
            "Sound Horizon + Revo 2.0", "『ULTRAPANIC』Lanndo",
        ],
        "オルタナ・夜明け系": [
            "Luz", "mol-74", "ずっと真夜中でいいのに。 4thアルバム「形藻土」",
            "神聖かまってちゃん 15周年記念ベストアルバム『聖なる交差点』",
            "Wolpis Carter", "wowaka", "Yuria Miyazono",
        ],
    },
    "new_subgroups": [
        {"name_jp": "コンピレーション・童謡", "name_en": "Compilations / Standards",
         "blurb": "NHKみんなのうた等の歌コンピや童謡集。",
         "artists": ["NHK みんなのうたより ベストセレクション",
                     "CrosSing", "CLIMAX", "好きです かわさき♪",
                     "いつも何度でも-いのちの名前", "永遠のSEED",
                     "Healing", "HAWAIIAN6"]},
    ],
},

# ─── Celt & Fantasy & Violin ───────────────────────────────
"celt": {
    "to_existing": {
        "ファンタジー量産派": [
            "David Arkenstone", "Diane Arkenstone", "Fox Amoore",
            "Peter Crowley", "Logan Epic Canto", "Jeff Victor",
            "Epic Background", "Vladimir Cosma", "Solaris",
        ],
        "中世女性復興": [
            "Mediavolo", "Marketa Irglova", "FLEUR & Elena Voynarovskaya",
            "Savina Yannatou", "The Wong Janice", "Donis",
            "Sally Doherty & The Sumacs", "Spiro",
            "Genevieve Walker",
        ],
        "ケルト・トラディショナル": [
            "The Chieftains", "Flook", "Joanie Madden", "Leahy",
            "Mick McAuley, Winifred Horan", "Luar na Lubre",
            "Green Hill_ 30 Years Of Celtic", "The Swell Season",
            "The Swell Season, Glen Hansard & Marketa Irglova-Forward",
            "Hevia", "River Song", "Gloaming",
        ],
        "クロスオーバー器楽": [
            "Lindsey Stirling", "Tina Guo", "Jenny Oaks Baker",
            "Jean-Luc Ponty", "Jerry Goodman", "Enigma Quartet",
            "Tin-Tin Quartet-Confrontation", "Julia Okrusko",
            "David Davidson_Rock Me Classical",
            "西本梨江 ピアノ, 村川千尋 バイオリン",
        ],
        "シネマ・トレイラー音楽": [
            "Logan Epic Canto", "The London Studio Orchestra",
            "Mychael & Jeff Danna", "Nino rota",
            "Les Fragments de la Nuit",
        ],
    },
    "new_subgroups": [
        {"name_jp": "ダーク・ネオフォーク", "name_en": "Dark Neofolk",
         "blurb": "ゴシック・ペイガン・幽玄な森のフォーク。",
         "artists": ["Corde Oblique", "The Moon And The Nightspirit",
                     "Ordo Funebris, Narsilion", "Keltania", "Kryptik Wood",
                     "Theodor Bastard", "Za frumi", "Uriel"]},
        {"name_jp": "ヒーリング・ヴァイオリニスト", "name_en": "Healing Violinists",
         "blurb": "ヴァイオリン中心の癒し系・現代奏者。",
         "artists": ["Leah", "Opium Moon", "Nawang Dautar",
                     "Enrico Fabio Cortese"]},
        {"name_jp": "東欧・地中海・世界", "name_en": "Eastern Europe / Mediterranean / World",
         "blurb": "東欧・スラヴ・地中海圏のトラディショナル。",
         "artists": ["Theodor Bastard", "Nor Dar", "Paulo Cesar Escobedo",
                     "Jessita Reyes", "Zhao Kun Yu", "Gallo"]},
        {"name_jp": "コンピレーション・周辺", "name_en": "Compilations / Periphery",
         "blurb": "オリジナル盤・コンピやコンセプト盤。",
         "artists": ["Chapitre Bleu-青の章", "Legend of Excalibur",
                     "style-3!", "V-A"]},
    ],
},

# ─── Game ─────────────────────────────────────────────────────
"game": {
    "to_existing": {
        "JRPG伝統": [
            "GRANBLUE FANTASY", "Grand Knights History Original Soundtrack",
            "GRANDIA", "ICO", "Kingdom Hearts", "Live A Live",
            "MOTHER 1+2 Original Soundtrack", "OCTOPATH TRAVELER Original Soundtrack",
            "Star Ocean", "Tales of", "TalesWeaver Original Soundtrack",
            "Xenoblade Original Soundtrack", "Sekaiju no MeiQ",
            "Yoko Shimomura", "Yu-peng Chen",
            "英雄伝説I-IV ピアノ コレクション",
            "Symphony Sounds Record", "LORD of VERMILION Re-2 FAN KIT",
            "Yasunori Mitsuda Vocal Collection",
        ],
        "ダークファンタジーOST": [
            "ENDER LILIES：Quietus of the Knights Original Soundtrack",
            "NieR", "Hentai Prison", "OMORI OST",
            "Ori and the Blind Forest by Gareth Coker", "Undertale",
            "腐り姫 劇伴集", "メメントモリ",
        ],
        "ビジュアルノベル音楽": [
            "CROSS†CHANNEL", "CUFFS SONGS", "fengヴォーカルコレクション",
            "Frontwing", "Katahane", "Key", "KiRite (SBPS-0008~9)",
            "Laplacian", "Leaf", "Liar soft", "Quartett!",
            "PHANTASM 榊原ゆい", "Pulltop Vocal Collection", "purple software",
            "Sakura Musubi", "SNOW ORIGINAL SOUNDTRACK", "Symphonic Rain",
            "âge", "キラ☆キラ", "借金姉妹２ SoundTrack", "最果てのイマ ORIGINAL SOUND TRACK",
            "Marica ワークスベストアルバム「UNDER THE SUN」",
            "GIGA BEST ALBUM -戯画ベストアルバム",
            "duca", "yozuca＊", "I've Girls Compilation",
            "MANYO WORKS BEST!!", "YUZUSOFT VOCAL COLLECTION 2006-2016",
            "nine- Sound Premium Record", "Stein Gate",
        ],
        "ジャンル越境作曲家": [
            "Christopher Tin", "flashygoodness", "Ori and the Blind Forest by Gareth Coker",
            "TPR", "trabling", "zircon", "wac", "Laurence Manning",
            "dai", "松本文紀", "細井聡司ワークス -Vocalists",
            "トラベリング・オーガスト2015 ピアノアレンジ集 “Primary Notes”",
            "メモオフ ピアノコレクション第２集",
            "ZIZZ Studio music collection",
        ],
        "コナミ・カプコン・SE": [
            "namco", "SQUARE ENIX", "Gust",
            "Game Music Graffiti 任天堂大全集", "Kid Icarus Uprising Original Soundtrack",
            "Rockman Theme Song Collection", "Metal Gear Solid Vocal Tracks",
            "Monster Hunter", "R4 -THE 20TH ANNIV. SOUNDS",
            "Pluto Original Soundtrack", "NOSTALGIA Music Collection Op.1 & Op.2",
            "RAIL SOUND THE BEST [N,A]",
            "オリジナル・サウンド・オブ・グラディウス＆沙羅曼蛇 バトル ミュージック コレクション [CD][FLAC+CUE+LOG+BK]",
            "双星の陰陽師 Music Collection",
            "Sakuna：Of Rice and Ruin original soundtrack[USA]／音楽：大嶋啓之",
        ],
        "ボーカル・キャラソン": [
            "eufonius", "KOTOKO's GAME SONG COMPLETE BOX 「The Bible」",
            "Love Song from the Water", "Neko Sound Collection",
            "Single", "Shade Music Laboratory",
            "The Greatest Video Game Music",
        ],
    },
    "new_subgroups": [
        {"name_jp": "インディーゲーム・2D", "name_en": "Indie / 2D Games",
         "blurb": "Cave Story・OMORI 等のインディー・2D系。",
         "artists": ["CaveStory", "Undertale", "OMORI OST", "Dragon Ball"]},
        {"name_jp": "東方Project公式", "name_en": "Touhou Official",
         "blurb": "ZUNオリジナル音源集。",
         "artists": ["ZUN Touhou Official Music Collection"]},
        {"name_jp": "コンピレーション・整理用", "name_en": "Compilations / Misc",
         "blurb": "オリジナルサウンドトラック・複合コンピ・整理ミス。",
         "artists": ["Complete Collection", "オリジナルサウンドトラック",
                     "いますぐ", "Single"]},
    ],
},

# ─── Anime ─────────────────────────────────────────────────────
"anime": {
    "to_existing": {
        "叙事詩・戦闘OST": [
            "Gunslinger girl", "Pluto Original Soundtrack",
            "WOLF'S RAIN O.S.T", "violet evergarden",
            "TVアニメ「蒼穹のファフナー EXODUS」OP&EDテーマ「イグジスト／暗夜航路」／angela",
            "TVアニメ「クロスアンジュ 天使と竜の輪舞」OP2テーマ「真実の黙示録」／高橋洋子",
            "TVアニメ「戦姫絶唱シンフォギアG」OPテーマ -「Vitalization」／水樹奈々",
            "「Exterminate」水樹奈々",
            "｢Los! Los! Los!｣／ターニャ・デグレチャフ",
            "TVアニメ「転生貴族、鑑定スキルで成り上がる」OPテーマ「ReCoda／ブルーデイズ」／TRUE [鑑定スキル盤]",
        ],
        "オーケストラ復権": [
            "Grimgar of Fantasy and Ash", "TVアニメ メイドインアビス 烈日の黄金郷 オリジナルサウンドトラック",
            "TVアニメ『サイレント・ウィッチ 沈黙の魔女の隠しごと』Original Soundtrack",
            "Heart of Magic Garden", "DEAREST DROP",
        ],
        "異形のOPテーマ": [
            "TVアニメ「魔法少女リリカルなのは」オリジナルサウンドトラック",
            "片霧烈火", "機動天使エンジェリックレイヤー OP",
            "ISEKAI",
            "『とある科学の超電磁砲』OP「only my railgun -version 2024- & -15th Anniversary version-」fripSide[96kHz／24bit]",
        ],
        "古典名作": [
            "BEST OF INUYASHA 百花繚乱 -犬夜叉 テーマ全集",
            "Slam Dunk", "Shangri-La",
            "ヒカルの碁 主題歌全集-ベスト オブ ヒカルの碁",
            "サイレントメビウス THE BEST MUSIC COLLECTION FLAC",
            "双星の陰陽師",
        ],
        "コンピレーション": [
            "Chameleon Jazz with ANIME Flavor",
            "P.A.WORKS 20th Anniversary Theme Song Collection",
            "Jyukai_BEST", "森口博子 アニソンカバーアルバム 第2弾「ANISON COVERS 2」[96kHz／24bit]",
            "OST", "Project", "THE",
        ],
        "アニソン名歌手": [
            "Wakana",
        ],
    },
    "new_subgroups": [
        {"name_jp": "ジブリ・劇場映画", "name_en": "Ghibli / Theatrical",
         "blurb": "宮崎駿作品・スタジオジブリ系列。",
         "artists": ["Studio Ghibli"]},
    ],
},

# ─── Nature ──────────────────────────────────────────────────
"nature": {
    "to_existing": {
        "純粋フィールド": [
            "Nature Sound Healing. ape", "Nature Sounds",
            "Nature Sounds Collection_ Forest Stream & Birds",
            "Sounds Of The Earth", "Sounds of Wildlife-Alone with the Rain",
            "The Sound Of Nature", "The Sounds Of Nature[2 Box Set",
            "WW Nature Sounds", "Tropical Jungle (Stereo)",
            "walk in forest",
        ],
        "ピアノ + 自然": [
            "Marcia Green", "Nichole Reed", "Pau Viguer",
            "Retiro De Yoga Con Lluvia Serena De Piano",
        ],
        "睡眠・スパ用途": [
            "Relaxation", "Thomas Skymund",
        ],
    },
    "new_subgroups": [
        {"name_jp": "シネマティック・サウンドパック", "name_en": "Cinematic Sound Pack",
         "blurb": "映像制作向けの効果音・素材集。",
         "artists": ["Studio Planet – Cinematic Sound Pack Collection",
                     "Neal Robinson"]},
    ],
},

# ─── Pop & Rock ───────────────────────────────────────────────
"pop-rock": {
    "to_existing": {
        "王道ロック・ポップ": [
            "Mae", "Something Corporate", "The Zombies", "Waltari",
            "Tarja", "Susan Boyle", "Waterflame",
        ],
        "劇場・シネマ": [
            "Vienna Boys' Choir", "Voces8", "Real Group",
        ],
        "インディー叙情": [
            "High Llamas", "Miracles of Modern Science",
            "Priscilla Ahn", "Sigur Rós", "Waking Ashland",
            "Dream State",
        ],
        "シンガーソングライター": [
            "Paco de Lucía",
        ],
    },
    "new_subgroups": [],
},

}
