#!/usr/bin/env python3
"""Generate 14 salon chapter HTML pages from a single data file.
Each page goes to: yuichi916.github.io/salon/<slug>.html
Run: python scripts/generate_salon_chapters.py
"""
import sys
sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8", errors="replace")
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "salon"
OUT_DIR.mkdir(exist_ok=True)


# ── Data: 14 chapters ───────────────────────────────────────────────
CHAPTERS = [
    {
        "slug": "ambient",
        "num": 1,
        "name_jp": "アンビエント",
        "name_en": "Ambient",
        "latin": "Sigilla Aetheris",
        "count": 11,
        "axes": ("牧歌 / PASTORAL", "葬礼 / FUNEREAL", "フォーク", "交響"),
        "intro": [
            "Brian Eno が定義したアンビエントは「気付かなくても良い音楽」だが、 ここに住むアンビエントは <em>気付かれることを覚悟した儀式音楽</em> である。",
            "<strong>Empyrium・Tenhi・Dargaard・Kauan・Nucleus Torn・Nachtreich</strong>。 共通するのは <em>Black Metal の出自を持つ作曲家が、 静寂を選び直したとき</em> に書かれる音楽だということ。 ドイツ語圏 (Empyrium・Dargaard) と北欧 (Tenhi・Kauan) の冷たさが基層を作る。",
            "純粋なドローン (Stars of the Lid 系) は数えるほどしか無い。 主成分は <em>「歌のない物語」</em> ── ピアノと弦と森の音だけで、 雪の降る城を描こうとする系譜。",
            "<strong>IN SCISSORS</strong> や <strong>MURGRIND</strong> のような国産がさり気なく混ざっているのは、 この種の音楽が言語を必要としないことの証明だ。",
        ],
        "subcurrents": [
            ("北欧フォーク・アンビエント", "<strong>Tenhi (FI)・Kauan (RU/UA)・Fjallstorm (SE)</strong>。 アコギ＋ピアノ＋雪原。 「神秘思想家がポストロックを学んだ」 ような肌触り。"),
            ("ドイツ・ゴシック・ファンタジー", "<strong>Empyrium・Dargaard・Nachtreich</strong>。 暖炉とラテン語と中世の墓所。 Empyrium はその<em>純粋形</em>。"),
            ("非西欧スピリチュアル", "<strong>IN SCISSORS・MURGRIND・Bruno Mars (謎)</strong>。 整理失敗1枚を含む、 雑種の余白。"),
        ],
        "albums": [
            ("Empyrium", "The Turn Of The Tides (2014)", "ドイツの森が、 降ってくる雪の重さで沈む。 <em>Black Metal の出自を持つ者だけが書ける牧歌</em>。"),
            ("Tenhi", "Folk Aesthetic", "フィンランドの夕暮れを、 ピアノとアコギだけで実演する。 聴くと<em>体温が下がる</em>。"),
            ("Dargaard", "Rise And Fall (2004)", "中世の墓所をシンセで歩く。 ゴシック × ファンタジーの<em>儀式音楽</em>。"),
            ("Kauan", "Sorni Nai", "ロシア発、 雪原の中の祈祷。 <em>言語を理解できないことがむしろ正しい</em>音楽。"),
            ("Nucleus Torn", "Submission", "スイスのアーティスト・ファミリー。 <em>合唱・チェロ・声明</em>を1枚に詰める豪奢。"),
            ("Nachtreich", "Wesen Der Leere", "Empyrium 連作の妹分。 <em>氷の奥の灯り</em>を扱う。"),
            ("Fjallstorm", "Midnattssolen (2005)", "スウェーデンの白夜。 短い盤だが<em>結晶のような完結性</em>。"),
            ("IN SCISSORS", "The Veratrine Evangelicum (2007)", "国産の異端児。 ヨーロッパ的儀式音楽を<em>日本語の語彙で書き直した</em>稀少な記録。"),
        ],
        "nodes": [
            (200, 140, "Tenhi", "FI"),
            (380, 180, "Empyrium", "DE"),
            (540, 160, "Nucleus Torn", "CH"),
            (600, 300, "Dargaard", "AT"),
            (280, 310, "Kauan", "RU"),
            (460, 360, "Nachtreich", "DE"),
            (640, 380, "IN SCISSORS", "JP"),
            (160, 280, "Fjallstorm", "SE"),
        ],
        "links": [(0, 1), (1, 2), (2, 3), (1, 4), (4, 5), (5, 6)],
        "connections": "<strong>Fantasy Spine</strong>の起点。 <strong>Celt&Fantasy&Violin (Trobar de Morte, Antti Martikainen)</strong> と <strong>Indies (帝国少女, Asriel)</strong> へと、 <em>「夜と冬」</em> という共通語で繋がる。",
        "prev": "pop-rock",
        "next": "healing",
    },
    {
        "slug": "healing",
        "num": 2,
        "name_jp": "ヒーリング ＆ ニューエイジ",
        "name_en": "Healing & New Age",
        "latin": "Quies Animae",
        "count": 259,
        "axes": ("動 / ACTIVE", "瞑想 / STILL", "ピアノ", "シンセ"),
        "intro": [
            "コレクション最大の部屋。 <em>259枚</em> という数字が、 すでに何かを物語っている。 ここで分かるのは <em>「ヒーリング」というラベルは器であって、 ジャンルではない</em> ということ。",
            "<strong>Maksim Mrvica</strong> の派手なクロスオーバーピアノから、 <strong>Akira Kosemura</strong> のささやくような無音、 <strong>Anoice</strong> のポストクラシカル、 <strong>Druid</strong> のケルト・トリロジー、 <strong>Aukai</strong> のロンロン即興まで。 静かであるという共通点だけで、 内側は混沌としている。",
            "ここに住む音楽は <em>「気分転換」 ではなく 「儀式」</em>。 仕事中のBGMには使われない。 一人で部屋を暗くしたとき、 ようやく相手をしてもらえる。",
            "Akira Kosemura・Anoice・Aukai の3人は、 名目上ヒーリングだが <strong>音楽的には Bill Evans (Jazz) と Michelangeli (Classic) の隣にいる</strong>。 <em>「ジャンルはタグであって地図ではない」</em> という当たり前のことを、 この部屋が一番強く教えてくれる。",
        ],
        "subcurrents": [
            ("ポストクラシカル", "<strong>Akira Kosemura・Anoice・Balmorhea・Aukai</strong>。 ECMジャズと現代ピアニズムの中間にある、 <em>21世紀の静謐</em>。"),
            ("クロスオーバー・ピアノ", "<strong>Maksim Mrvica・Hayato Sumino (重複)</strong>。 古典の文法で大衆を捕まえる派手な系譜。"),
            ("ケルト・スピリチュアル", "<strong>Druid Trilogy・Celtic Fairy Lullaby・Ah Nee Mah</strong>。 ペンタトニックと女性ボーカルで、 部屋の温度を2℃下げる。"),
            ("自然＋楽器ブレンド", "<strong>Andrea Rongioletti・Aaron Amida Ang・Hennie Bekker</strong>。 Natureジャンルとの境界線にいる派閥。"),
        ],
        "albums": [
            ("Akira Kosemura", "Diary 2016-2019", "日本のポストクラシカル。 <em>Bill Evans の呼吸を、 ピアノ独奏に折りたたむ</em>。"),
            ("Aukai", "Apricity / Chambers", "ロンロン (アンデスの胡弓) の余韻。 <em>砂漠のECM</em>と呼びたい音色。"),
            ("Anoice", "Catalog", "渋谷から立ち上がるドローン × 弦楽。 <em>静けさの中の緊張</em>。"),
            ("Druid", "The Druid Trilogy Vol.1 (1990)", "ケルト・スピリチュアル。 部屋の温度を<em>2℃</em>下げる。"),
            ("Maksim Mrvica", "Greatest Maksim (2009)", "クロアチアの派手ピアニスト。 <em>大衆の門</em>を一段で上げた。"),
            ("Balmorhea", "All Is Wild, All Is Silent (2009)", "テキサス・ポストクラシカル。 <em>ピアノとチェロと砂塵</em>。"),
            ("Aaron Amida Ang", "Oriental Soundscapes (2021)", "東洋的音色 × ヒーリング。 <em>異国趣味の良性版</em>。"),
            ("Hennie Bekker", "Catalog", "南アフリカ生まれのカナダ人。 <em>1980年代型ヒーリング</em>の生存者。"),
        ],
        "nodes": [
            (220, 120, "Maksim Mrvica", "HR"),
            (380, 180, "Hayato Sumino", "JP"),
            (540, 160, "Bandari", "DE"),
            (180, 280, "Akira Kosemura", "JP"),
            (320, 330, "Anoice", "JP"),
            (480, 340, "Aukai", "DE/PE"),
            (600, 300, "Hennie Bekker", "ZA"),
            (700, 220, "Druid", "UK"),
            (540, 380, "Balmorhea", "US"),
        ],
        "links": [(0, 1), (1, 2), (0, 3), (3, 4), (4, 5), (5, 6)],
        "connections": "<strong>Pianism Spine</strong> と <strong>Quiet Jazz Spine</strong> の合流地点。 <strong>Kosemura</strong>は両方の脊椎を貫通する <em>結節点アーティスト</em>。",
        "prev": "ambient",
        "next": "progressive",
    },
    {
        "slug": "progressive",
        "num": 3,
        "name_jp": "プログレッシブ",
        "name_en": "Progressive",
        "latin": "Architectura Sonora",
        "count": 146,
        "axes": ("古典 70s / CANON", "現代 / MODERN", "交響", "前衛/RIO"),
        "intro": [
            "<strong>Genesis (1973) Selling England by the Pound</strong> から <strong>Big Big Train (2026) Woodcut</strong> まで、 <em>50年を貫いている</em>。 Symphonic / Avant (RIO) / Modern Prog の三方向に、 ほぼ等距離で散らばっている。",
            "ART BEARS や After Crying のような <strong>RIO 系 (Rock In Opposition)</strong> を持っている人は珍しい。 これは <em>「複雑さに耐えられる」 ことと、 美しさを諦めない こと</em> の両立を求める姿勢を示す。",
            "Anathema や Steven Wilson 系の<em>叙情的モダンプログ</em>が見当たらないのが、 このコレクションの個性。 代わりに <strong>Big Big Train・Cast・Barock Project</strong> といった<em>古典文法を21世紀に持ち越す派</em>が中心。",
            "<strong>Aranis (BE)・After Crying (HU)・ART BEARS (UK)</strong> の東欧・ベネルクス系RIOは、 古典音楽の文法でロックを書く<em>稀有な実験</em>。 ここをコレクションしている耳は、 単なる懐古ではなく <em>構築美に飢えている</em> 耳である。",
        ],
        "subcurrents": [
            ("英国シンフォニック古典", "<strong>Genesis・Big Big Train</strong>。 田園詩 + 12分組曲 + メロトロン。"),
            ("地中海ネオプログ", "<strong>Cast (MX)・Barock Project (IT)・Celeste (IT)</strong>。 古典文法を保ったまま、 21世紀に書く派。"),
            ("RIO / アヴァン・ロック", "<strong>ART BEARS・After Crying・Aranis・All Traps on Earth</strong>。 即興と現代音楽の境界。"),
            ("北欧モダン", "<strong>A.C.T (SE)・Anglagard (SE) 周辺</strong>。 数学と合唱の融合体。"),
        ],
        "albums": [
            ("Genesis", "Selling England by the Pound (Analogue Productions SACD)", "1973年の英国田園詩。 <em>Hackett のギターは50年経っても新しい</em>。"),
            ("Big Big Train", "Woodcut (2026)", "<em>「英国の終わりの始まり」</em>を主題にした2026年盤。 Genesisから半世紀の堆積。"),
            ("A.C.T", "Discography", "スウェーデンの後継者。 <em>合唱と数学</em>の融合を毎作続ける。"),
            ("After Crying", "Hungarian Discography", "東欧のRIO代表。 古典音楽の文法でロックを書く<em>稀有な実験</em>。"),
            ("ART BEARS", "Catalog", "Henry Cow の遺族。 <em>「歌は政治である」</em>という1980年的命題を、 音楽として持続させた。"),
            ("Cast", "Catalog (MX)", "メキシコの<em>シンフォニックプログ最右翼</em>。 Yes と Genesis の遺伝子を熱帯で育てた。"),
            ("Barock Project", "Catalog (IT)", "イタリアのネオプログ。 <em>古典の凝集</em>。"),
            ("All Traps on Earth", "A Drop of Light (2018)", "Anglagard 系譜の現代盤。 <em>北欧の白く冷たい複雑さ</em>。"),
        ],
        "nodes": [
            (220, 140, "Genesis '73", "UK"),
            (360, 180, "Cast", "MX"),
            (480, 250, "After Crying", "HU"),
            (620, 310, "ART BEARS", "UK"),
            (200, 300, "Big Big Train", "UK"),
            (360, 330, "Barock Project", "IT"),
            (540, 360, "A.C.T", "SE"),
            (700, 220, "Aranis", "BE"),
            (660, 380, "All Traps on Earth", "SE"),
        ],
        "links": [(0, 1), (0, 4), (1, 2), (2, 3), (4, 5), (5, 6)],
        "connections": "Pianism や Jazz と直接の架橋は無いが、 <strong>Classic の現代ピアニスト</strong>と「構築的に聴く耳」で繋がる。 <em>「ジャズとは違う複雑性の処方箋」</em>。",
        "prev": "healing",
        "next": "jazz",
    },
    {
        "slug": "jazz",
        "num": 4,
        "name_jp": "ジャズ ＆ フュージョン",
        "name_en": "Jazz & Fusion",
        "latin": "Vox Silentii",
        "count": 67,
        "axes": ("親密 / INTIMATE", "アンサンブル / ENSEMBLE", "アコースティック", "電化"),
        "intro": [
            "これは <em>ECM 的</em> な部屋だ。 <strong>Bill Evans・Charlie Haden & Pat Metheny・Esbjörn Svensson Trio・Helge Lien Trio・Avishai Cohen</strong>。 共通項は ── <em>静かなのに緊張している</em> こと。",
            "炸裂する Free Jazz は <strong>Eric Dolphy</strong> が辛うじて1枚。 Smooth Fusion はほぼ無い。 これは <em>北欧寄り、 内省寄り、 ピアノトリオ寄り</em> の選盤である。",
            "<strong>Bill Laurance (Snarky Puppy)</strong> 数枚と <strong>Brian Culbertson</strong> あたりが「電化フュージョン」の小さな袋として混ざっている。 だが主成分は <em>1958年の Bill Evans Trio から続く一本のライン</em> ── 沈黙と沈黙の間にだけ音楽がある、 という極北。",
            "国際的でもある。 米国 (Evans, Metheny)、 イスラエル (Avishai Cohen)、 スウェーデン (e.s.t)、 ノルウェー (Helge Lien)、 イタリア (Pieranunzi, Mirabassi)、 ブラジル (Milton Nascimento)。 <em>「ECM地理学」</em> がそのまま地図になっている。",
        ],
        "subcurrents": [
            ("沈黙の精度 — ECMピアノトリオ", "<strong>Bill Evans・Esbjörn Svensson・Helge Lien・Eddie Higgins</strong>。 50年・国境を越える <em>「沈黙の精度」</em>の系譜。"),
            ("室内楽ジャズ", "<strong>Charlie Haden & Pat Metheny・Bill Evans / Jim Hall・Gerry Mulligan</strong>。 デュオ・ベース×ギター・室内編成。"),
            ("地中海＆中東", "<strong>Avishai Cohen (IL)・Enrico Pieranunzi (IT)・Giovanni Mirabassi (IT)</strong>。 ECMの周縁。"),
            ("電化フュージョン", "<strong>Bill Laurance・Brian Culbertson</strong>。 例外的に明るい袋。"),
        ],
        "albums": [
            ("Bill Evans / Jim Hall", "Undercurrent (SACD)", "沈黙と沈黙の間にだけ、 音楽がある。 <em>「これ以上は減らせない」 ジャズの極北</em>。"),
            ("Charlie Haden / Pat Metheny", "Beyond The Missouri Sky", "西部のフォークジャズ。 <em>夕暮れと地平線</em>を音にする。"),
            ("Esbjörn Svensson Trio", "Selected Works", "スウェーデンのピアノトリオ。 <em>Bill Evans を21世紀の北欧へ更新</em>した。"),
            ("Avishai Cohen", "Almah (2013)", "弦と低音の対話。 <em>イスラエル・ジャズ</em>の温かさ。"),
            ("Helge Lien Trio", "Funeral Dance (2023)", "ノルウェー。 <em>葬礼すら踊らせる</em>静謐の力。"),
            ("Eric Dolphy", "Out To Lunch! (DSD ISO)", "1964年の前衛ジャズ。 <em>このコレクションの「炸裂枠」</em>を1人で背負っている。"),
            ("Bill Laurance", "Affinity / Lumen", "Snarky Puppy のキーボード。 <em>電化フュージョンの軽い陽光</em>。"),
            ("Enrico Pieranunzi", "Selected", "イタリアのスタンダード解釈者。 <em>ヨーロッパ・ジャズの教科書</em>。"),
        ],
        "nodes": [
            (220, 120, "Bill Evans", "US"),
            (360, 160, "Haden / Metheny", "US"),
            (240, 250, "Eddie Higgins", "US"),
            (380, 280, "Esbjörn Svensson", "SE"),
            (520, 260, "Helge Lien Trio", "NO"),
            (620, 330, "Avishai Cohen", "IL"),
            (700, 200, "Bill Laurance", "UK"),
            (540, 380, "Eric Dolphy", "US"),
        ],
        "links": [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)],
        "connections": "<strong>Quiet Jazz Spine</strong> の本流。 ここから <strong>Healing (Akira Kosemura, Aukai)</strong> と <strong>Classic (Michelangeli)</strong> へ <em>「静かさの精度」</em>で橋がかかる。",
        "prev": "progressive",
        "next": "classic",
    },
    {
        "slug": "classic",
        "num": 5,
        "name_jp": "クラシック",
        "name_en": "Classic",
        "latin": "Clavium Aurum",
        "count": 16,
        "axes": ("黄金期巨匠", "現代ピアニスト", "独奏", "協奏曲"),
        "intro": [
            "たった<em>16枚</em>だが、 ピアノ独奏の精鋭が揃っている。 <strong>Michelangeli・Gilels・Rubinstein・Kissin</strong>、 そして <strong>辻井伸行・角野隼人 (Hayato Sumino)・まらしぃ・フジ子・ヘミング</strong>。",
            "これは <em>クラシック音楽という「教養」の部屋ではない</em>。 もっと狭くて深い <em>ピアニズム</em> という部屋である。 交響曲全集はおいてない。 「タッチ」 と 「呼吸」 で選ばれた17名の手の動き。",
            "<strong>辻井伸行 → Hayato Sumino → まらしぃ</strong> という日本の系譜が並ぶのは、 国を選ばず音色を聴く耳の表れ。 まらしぃ (ニコニコ動画→武道館) を Michelangeli の隣に置ける、 という階層感覚 がこの部屋の本質である。",
            "<strong>Leopold Wlach (オーストリアのクラリネット)</strong> が1人だけクラリネット枠で混ざっているのが面白い。 これは <em>音色オタクの裏側</em> ── 「鍵盤じゃなくても、 音色がきれいなら聴く」 という小さな例外。",
        ],
        "subcurrents": [
            ("黄金期ロシア・ピアニズム", "<strong>Gilels・Rubinstein</strong>。 ベートーヴェン・ラフマニノフを<em>金属の重さで弾く</em>系譜。"),
            ("禁欲のイタリア", "<strong>Michelangeli</strong>。 完璧主義の頂点。 <em>「音は鳴っているのではなく、置かれている」</em>。"),
            ("21世紀日本の鍵盤", "<strong>辻井伸行・Hayato Sumino・まらしぃ</strong>。 古典 × YouTube × 武道館。 <em>「即興と楽譜の境界」</em>を毎日攻めている。"),
            ("音色枠の例外", "<strong>Leopold Wlach (CL)・Healing Piano</strong>。 鍵盤以外に小さく開いた窓。"),
        ],
        "albums": [
            ("Michelangeli", "The Art of Arturo Benedetti Michelangeli", "完璧主義の極致。 <em>「音は鳴っているのではなく、 置かれている」</em>。"),
            ("辻井伸行", "Selected", "触覚で世界を読む人の音。 <em>視覚抜きでも美は構築できる</em>という証明。"),
            ("Hayato Sumino", "かてぃん作品", "古典 × YouTube世代。 <em>「即興と楽譜の境界」</em>を毎日攻めている。"),
            ("まらしぃ", "ちょっとつよいクラシック", "ニコニコ動画から武道館へ。 <em>大衆と古典の橋</em>を独力で架けた人。"),
            ("Gilels", "Beethoven Sonatas", "金属の重さでベートーヴェンを弾く<em>黄金期ロシア派</em>の代表。"),
            ("Rubinstein / Reiner", "Rachmaninoff Piano Concerto 2 (1956)", "古典録音の<em>到達点のひとつ</em>。"),
            ("Evgeny Kissin", "Great Pianists 20th Vol.58", "現代ロシア派の<em>知的な続き</em>。"),
            ("フジ子・ヘミング", "Tchaikovsky Piano Concerto 1 (UCCD-1086)", "<em>「遅咲きの伝説」</em>と呼ばれた人。 トロイカの一筆書き。"),
        ],
        "nodes": [
            (220, 120, "Michelangeli", "IT"),
            (360, 180, "Gilels", "RU"),
            (540, 160, "Rubinstein", "PL/US"),
            (700, 220, "Kissin", "RU"),
            (180, 300, "辻井伸行", "JP"),
            (360, 330, "Hayato Sumino", "JP"),
            (540, 310, "まらしぃ", "JP"),
            (660, 370, "フジ子・ヘミング", "JP"),
        ],
        "links": [(0, 1), (1, 2), (0, 4), (4, 5), (5, 6), (6, 7)],
        "connections": "<strong>Pianism Spine</strong> の本流。 <strong>Healing (Kosemura, Anoice)</strong> と <strong>Violin&Celt (2Cellos)</strong> へ橋。",
        "prev": "jazz",
        "next": "metal",
    },
    {
        "slug": "metal",
        "num": 6,
        "name_jp": "メタル ＆ ハードロック",
        "name_en": "Metal & Hard Rock",
        "latin": "Tonitru Sacrum",
        "count": 144,
        "axes": ("旋律 / MELODIC", "攻撃 / EXTREME", "交響/パワー", "デス/ブラック"),
        "intro": [
            "<strong>Blind Guardian・Adagio・Ancient Bards・Beast in Black・Amberian Dawn</strong>。 <em>シンフォニックメタル / パワーメタル / ファンタジー直系</em> の選盤が中核。 そこに <strong>Behemoth・Arch Enemy・Children of Bodom・Dark Tranquillity</strong> のような メロデス／ブラックも一定数。",
            "純粋な Stoner / Doom (Sleep, Sunn O))) 系) は ほぼ無い。 ここの基準は <em>「物語性とメロディ」</em>。 つまり <strong>Indies の Imperial Circus Dead Decadence・Asriel・Dragon Guardian と同じ穴のムジナ</strong> である。",
            "国際的だが偏っている。 ドイツ (Blind Guardian, Behemoth) ── ヨーロッパ ── 北欧 (Children of Bodom, Amberian Dawn, Dark Tranquillity) が中心で、 米国メタル (Pantera, Slipknot 系) は少ない。 <em>「叙事詩と神話を扱える土壌」</em>を求めた選盤。",
            "<strong>Adagio</strong> はフランス系で、 Samuel Barber 'Adagio for Strings' の <em>あの</em> Adagio から名前を取っている。 ネオクラシカルメタルの中でも一番<em>「弦楽四重奏寄り」</em>。 1枚で部屋全体の傾向を決定づけている。",
        ],
        "subcurrents": [
            ("ジャーマン・ファンタジー・パワー", "<strong>Blind Guardian・Beast in Black・Crowne</strong>。 トールキン × ピーター・ヤクソン × ダンス。"),
            ("シンフォニック / ネオクラ", "<strong>Adagio・Ancient Bards・Amberian Dawn</strong>。 弦楽 × ピアノ × ソプラノ。"),
            ("北欧メロデス・ブラック", "<strong>Amorphis・Dark Tranquillity・Children of Bodom・Behemoth</strong>。 旋律と攻撃の同時実行。"),
            ("和テイストのメタル", "<strong>Damian Hamada's Creatures・Dark Lunacy</strong>。 同人メタルへの伏線でもある。"),
        ],
        "albums": [
            ("Blind Guardian", "Discography", "トールキンを丸ごと音楽化した狂信。 <em>30年揺るがない芯</em>。"),
            ("Adagio", "French Symphonic", "フランスのネオクラ・メタル。 <em>Adagio for Strings の血統</em>がここにある。"),
            ("Beast in Black", "Selected", "フィンランド産の<em>誇張過剰なメタル80s愛</em>。 笑いながら最後まで聴かせる芸。"),
            ("Amorphis", "Catalog", "Kalevala を音楽にした北欧叙事詩メタル。 <em>森と神話の濃度</em>が他にない。"),
            ("Ancient Bards", "Catalog (IT)", "イタリアのシンフォニック・メタル。 <em>ソプラノが物語を背負う</em>派。"),
            ("Behemoth", "The Satanist (2014)", "ポーランドのブラックメタル至高峰。 <em>儀式音楽としてのメタル</em>。"),
            ("Dark Tranquillity", "Catalog (SE)", "メロデス第一世代。 <em>「メロディの重さ」</em>を更新した。"),
            ("Damian Hamada's Creatures", "Selected (JP)", "聖飢魔IIから派生した<em>和製ファンタジーメタル</em>。"),
        ],
        "nodes": [
            (200, 140, "Blind Guardian", "DE"),
            (360, 160, "Ancient Bards", "IT"),
            (540, 200, "Beast in Black", "FI"),
            (220, 250, "Amberian Dawn", "FI"),
            (380, 280, "Adagio", "FR"),
            (540, 300, "Amorphis", "FI"),
            (660, 360, "Arch Enemy", "SE"),
            (700, 180, "Children of Bodom", "FI"),
            (600, 400, "Behemoth", "PL"),
        ],
        "links": [(0, 1), (1, 2), (3, 4), (4, 5), (5, 6), (1, 4)],
        "connections": "<strong>Symphonic-Operatic Spine</strong> の主翼。 そして <strong>Indies (Imperial Circus, Dragon Guardian)</strong> とは <em>「日本の同人がこれを誤読して育てた変種」</em> の関係。",
        "prev": "classic",
        "next": "indies",
    },
    {
        "slug": "indies",
        "num": 7,
        "name_jp": "インディーズ ／ 同人",
        "name_en": "Indies (Doujin)",
        "latin": "Mythos Privatus",
        "count": 127,
        "axes": ("交響過剰 / BOMBASTIC", "叙情 / ATMOSPHERIC", "合唱/オペラ", "ボーカル主導"),
        "intro": [
            "日本の同人音楽シーン。 <strong>Imperial Circus Dead Decadence・Asriel・Dragon Guardian・Cross Vein・帝国少女・Garnet Cathedral・Octaviagrace・AYUTRICA</strong>。 <em>シンフォニックメタル × アニメ的物語性 × オペラ的女性ボーカル</em> の混合体。",
            "商業流通から外れることで <em>「過剰さの自由」</em> を獲得した音楽。 アニメOPを20曲分凝縮したような曲が、 当たり前のように10分続く。 海外の人がこの音楽を聴くと、 <em>「日本人は何かに取り憑かれている」</em> と思うことがある。 取り憑かれている。",
            "土壌は <em>東方Project / コミケ / VOCALOID / 同人ノベル</em>。 これらの文化が「物語性のある激しい音楽を、 大量に、 速く作る」 環境を生んだ。 <strong>Asriel の19CD BOX</strong> はその<em>象徴</em>だ。",
            "意外な点 ── <strong>Aleile・B.rose&crown・Frost Fragment</strong> など、 比較的<em>シューゲーザー寄り / アトモスフェリック</em>な作家もここに混ざる。 同人＝必ずしも激しいわけではない。",
        ],
        "subcurrents": [
            ("シンフォニック・デス・アニソン", "<strong>Imperial Circus Dead Decadence・Asriel・Dragon Guardian・Garnet Cathedral</strong>。 <em>過剰の頂点</em>。"),
            ("ゴシック × ヴァイオリン", "<strong>Cross Vein・Aura Noctis (重複)・Garnet Cathedral</strong>。 西洋的暗黒美学。"),
            ("シューゲーザー寄り", "<strong>Aleile・Octaviagrace・Frost Fragment</strong>。 浮遊する女性ボーカル系。"),
            ("ノベルゲーOST周辺", "<strong>Asriel・AYUTRICA・Hagall×152Hz</strong>。 ゲーム音楽との<em>境界アーティスト</em>。"),
        ],
        "albums": [
            ("Imperial Circus Dead Decadence", "Catalog", "同人音楽の<em>究極形</em>。 デスメタルとアニソンの境界を破壊する10分曲。"),
            ("Asriel", "Ragnarok ~Asriel COMPLETE BOX~", "19CDの集大成。 <em>「東方アレンジから独立した物語の壁」</em>。"),
            ("Dragon Guardian", "Discography", "RPG音楽 × メタル × 物語性。 <em>Blind Guardianの日本版偽物</em>と思いきや本物。"),
            ("Garnet Cathedral", "Albums", "ゴシック × ヴァイオリン × 女性ボーカル。 <em>同人の中でも一番西洋寄り</em>。"),
            ("Cross Vein", "Selected", "ヘヴィメタル × ソプラノ。 商業ラインに乗りかけた同人。"),
            ("Octaviagrace", "Outward Resonance (2016)", "<em>シューゲ × ファンタジー</em>のアトモスフェリック派。"),
            ("AYUTRICA", "1.0", "ノベルゲーOST周辺の<em>叙情派</em>。"),
            ("帝国少女", "Catalog", "ボカロ系から発展した<em>物語OP工房</em>。"),
        ],
        "nodes": [
            (200, 120, "Imperial Circus DD", "JP"),
            (360, 160, "Asriel", "JP"),
            (540, 180, "Dragon Guardian", "JP"),
            (240, 290, "Garnet Cathedral", "JP"),
            (380, 310, "Cross Vein", "JP"),
            (540, 330, "Octaviagrace", "JP"),
            (660, 300, "AYUTRICA", "JP"),
            (700, 180, "B.rose&crown", "JP"),
            (160, 380, "Aleile", "JP"),
        ],
        "links": [(0, 1), (1, 2), (0, 3), (3, 4), (4, 5), (5, 6)],
        "connections": "<strong>Symphonic-Operatic Spine</strong> の中盤。 <strong>Metal (Blind Guardian, Adagio)</strong> と <strong>Anime / Game</strong> を、 <em>「東方Project / コミケ文化」</em> という土壌で再融合した産物。",
        "prev": "metal",
        "next": "jpop",
    },
    {
        "slug": "jpop",
        "num": 8,
        "name_jp": "JPOP",
        "name_en": "JPOP",
        "latin": "Cantus Insularis",
        "count": 141,
        "axes": ("アンセム / EPIC", "バラード / BALLAD", "王道", "ヴィジュアル系"),
        "intro": [
            "大衆向けの部屋に見えて、 内側はかなり<em>偏っている</em>。 <strong>Aimer・Ado・Ali project・Gackt・KAMIJO・Faylan・Janne Da Arc・Kagrra,</strong>。 共通項は <em>「物語性のあるボーカル」</em>。 アイドルポップやJ-Rapはほぼ皆無。",
            "三つの方向に分かれる ── <strong>(1) BUMP OF CHICKEN・GLAY・B'z</strong> の王道勢。 <strong>(2) Ado・Aimer・Garnet Crow</strong> の現代叙情勢。 <strong>(3) Ali project・Gackt・KAMIJO・Janne Da Arc</strong> のヴィジュアル系・ゴシック勢。",
            "<strong>Aimer・Garnet Crow・Ado</strong> は <em>物語の歌い手脊椎</em> として <strong>Loreena McKennitt (Blues&Folk)</strong>、 <strong>Aukai (Healing)</strong> と地続き。 <em>国境ではなく 「語り口」 で繋がる</em>。",
            "<strong>Ali project</strong> ── 耽美 × ゴシック × 軍歌 × ロリ ── は世界で類例が少ない。 30年以上 <em>独自の語彙でしか書けない世界</em> を続けている。 <strong>KAMIJO (Versailles)</strong> も同じく <em>ヨーロッパ風中世幻想</em>を日本語で続ける作家。",
        ],
        "subcurrents": [
            ("王道JPOP/ロック", "<strong>BUMP OF CHICKEN・GLAY・B'z・JAM Project</strong>。 武道館を埋める音楽。"),
            ("現代叙情ボーカル", "<strong>Aimer・Ado・Garnet Crow・Faylan</strong>。 アニメ主題歌の鋳型を更新した世代。"),
            ("ヴィジュアル系・ゴシック", "<strong>Ali project・Gackt・KAMIJO・Janne Da Arc・Kagrra,</strong>。 <em>耽美と物語の長期戦</em>。"),
            ("インストゥルメンタル枠", "<strong>DJ OKAWARI・ADAM at</strong>。 ボーカル中心の部屋に小さく開く器楽の窓。"),
        ],
        "albums": [
            ("Aimer", "Discography", "少し枯れた声の質感が、 アニメ主題歌の鋳型を内側から変えた人。 <em>Adoの先輩</em>。"),
            ("Ado", "Catalog", "21世紀の<em>声優ボーカル</em>。 顔を出さない歌手の天井を一段上げた。"),
            ("Ali project", "Albums", "耽美 × ゴシック × 軍歌。 <em>独自の語彙でしか書けない世界</em>を30年。"),
            ("Gackt", "Selected", "マラフ × クラシック × ヴィジュアル系。 <em>「日本の唯我独尊」</em>という固有名詞。"),
            ("KAMIJO", "Versailles + Solo", "ヨーロッパ風中世幻想を日本語で続ける<em>異形の作家</em>。"),
            ("Garnet Crow", "Discography", "中村由利の声と岡本仁志のギター。 <em>2000年代の物語の歌い手</em>。"),
            ("BUMP OF CHICKEN", "Discography", "藤原基央の物語歌。 <em>21世紀日本の青春</em>そのもの。"),
            ("Janne Da Arc", "Catalog", "ヴィジュアル系の<em>正統派ロック</em>。 yasu (Acid Black Cherry) の出発点。"),
        ],
        "nodes": [
            (200, 140, "B'z", "JP"),
            (360, 180, "BUMP OF CHICKEN", "JP"),
            (540, 160, "JAM Project", "JP"),
            (700, 200, "Janne Da Arc", "JP"),
            (660, 250, "KAMIJO", "JP"),
            (240, 300, "Aimer", "JP"),
            (400, 330, "Garnet Crow", "JP"),
            (560, 310, "Ado", "JP"),
            (700, 350, "Ali project", "JP"),
            (160, 380, "Gackt", "JP"),
        ],
        "links": [(0, 1), (1, 2), (0, 5), (5, 6), (6, 7), (7, 8), (3, 4)],
        "connections": "<strong>Storyteller Spine</strong> (Aimer→Garnet Crow→Ado) と <strong>Symphonic-Operatic Spine</strong> (Ali project→Hans Zimmer) の二本が貫通。",
        "prev": "indies",
        "next": "celt",
    },
    {
        "slug": "celt",
        "num": 9,
        "name_jp": "ケルト ＆ ファンタジー ＆ ヴァイオリン",
        "name_en": "Celt & Fantasy & Violin",
        "latin": "Mythos Vivus",
        "count": 92,
        "axes": ("交響 / SYMPHONIC", "アコースティック / ACOUSTIC", "中世/ケルト", "シネマティック"),
        "intro": [
            "このコレクションの<em>魂の住処</em>かもしれない。 <strong>Adrian von Ziegler・Antti Martikainen・Trobar de Morte・Aura Noctis・Ana Alcaide・Caprice・Altan・Loreena McKennitt 周辺</strong>。 ケルト・中世・ダークファンタジー・北欧叙事詩 が、 ひとつの部屋に集まっている。",
            "<strong>2Cellos・David Garrett・Ayasa</strong> といったクロスオーバー勢は、 この部屋では<em>例外的に明るい</em>。 主成分は <em>「夜の森と城」</em>。",
            "<strong>Adrian von Ziegler (CH)</strong> は一人で大量にファンタジー音楽を量産しているスイス人で、 <em>YouTube経由で世界中のファンタジーゲーム愛好家に届いた</em> 21世紀の現象。 このコレクションでも複数枚所蔵されている。",
            "<strong>Trobar de Morte (ES)</strong> と <strong>Ana Alcaide (ES)</strong> という<em>スペイン女性勢</em>が、 中世音楽の復興を別の角度から続けている。 ニッケルハルパ (スウェーデンの古楽器) を弾くスペイン人 (Ana Alcaide) という事実だけで、 この部屋の越境性が分かる。",
        ],
        "subcurrents": [
            ("ファンタジー量産派", "<strong>Adrian von Ziegler・Antti Martikainen・Austin Wintory</strong>。 ゲーム/YouTube文化の音楽供給源。"),
            ("中世女性復興", "<strong>Trobar de Morte・Ana Alcaide・Aura Noctis</strong>。 スペイン・イタリア発の<em>古楽再演</em>。"),
            ("ケルト・トラディショナル", "<strong>Altan・Celtic Thunder・Beyond The Woods</strong>。 アイルランド・スコットランド本流。"),
            ("クロスオーバー器楽", "<strong>2Cellos・David Garrett・Darryl Way・Ayasa</strong>。 ロックを古楽器で弾く派。"),
        ],
        "albums": [
            ("Adrian von Ziegler", "Celtic Discography", "スイスから一人で出している<em>ファンタジー音楽の量産機</em>。 多作だが品質が落ちない。"),
            ("Antti Martikainen", "Creation of the World / Eternal Saga", "フィンランドの叙事詩作曲家。 <em>北欧神話を音にする</em>と決めた人。"),
            ("Trobar de Morte", "Discography", "スペインの中世音楽復興。 <em>「死を歌う中世女性」</em>という古い系譜の現代版。"),
            ("Ana Alcaide", "Selected", "ニッケルハルパ (スウェーデンの古楽器) の弾き手。 <em>ヨーロッパ周縁の音</em>。"),
            ("Aura Noctis", "Vitae Proelium (2012)", "イタリアのゴシック・ダーク・ファンタジー。"),
            ("2Cellos", "Discography", "ロックを2台のチェロで。 <em>クラシックと大衆の境界</em>を毎年攻める。"),
            ("Caprice", "Catalog", "ロシアの中世幻想音楽グループ。 <em>「Tolkien界の真の発音」</em>を試行している人々。"),
            ("Altan", "Selected", "アイルランドの正統派フォーク。 <em>歴史を保存する人々</em>。"),
        ],
        "nodes": [
            (200, 140, "Adrian von Ziegler", "CH"),
            (360, 160, "Antti Martikainen", "FI"),
            (540, 180, "Austin Wintory", "US"),
            (660, 140, "2Cellos", "HR"),
            (240, 300, "Trobar de Morte", "ES"),
            (380, 330, "Ana Alcaide", "ES"),
            (540, 310, "Aura Noctis", "IT"),
            (700, 280, "Ayasa", "JP"),
            (700, 380, "David Garrett", "DE"),
            (160, 380, "Altan", "IE"),
            (540, 400, "Caprice", "RU"),
        ],
        "links": [(0, 1), (1, 2), (2, 3), (0, 4), (4, 5), (5, 6)],
        "connections": "<strong>Fantasy Spine</strong> の中央。 <strong>Ambient (Empyrium, Tenhi)</strong>・<strong>Indies (Imperial Circus)</strong>・<strong>Game (Final Fantasy, ENDER LILIES)</strong> を地続きで繋ぐ <em>「夜の森」</em> 言語の発信源。",
        "prev": "jpop",
        "next": "game",
    },
    {
        "slug": "game",
        "num": 10,
        "name_jp": "ゲーム",
        "name_en": "Game",
        "latin": "Mundi Ludendi",
        "count": 143,
        "axes": ("英雄譚 / HEROIC", "叙情/哀歌 / ELEGIAC", "交響", "チップチューン"),
        "intro": [
            "<strong>Final Fantasy・Falcom Sound Team jdk・Bravely Default・ENDER LILIES・Donkey Kong Country・Baten Kaitos</strong>。 RPG中心、 そしてダークファンタジー寄り。 <strong>9-nine-・AKABEiSOFT2・AUGUST・FAVORITE</strong> 系のビジュアルノベルOSTも多い。",
            "<em>「物語と音楽が同時に進行するメディア」</em> としてのゲーム音楽。 アニメ音楽との違いは、 <em>ループ前提で書かれている</em> こと ── 30秒のループでも飽きさせない設計が、 そのまま作曲技術に反映している。",
            "<strong>ENDER LILIES OST (Mili作曲)</strong> や <strong>Bravely Default OST (Revo, Sound Horizon)</strong> といった、 <em>本来は別ジャンルの作曲家がゲーム音楽に手を染めた</em> 作品が複数所蔵されている。 ジャンル境界を破壊する核。",
            "<strong>Christopher Tin の Calling All Dawns (Civilization IVテーマ作曲家のグラミー作)</strong> は、 ゲーム音楽の中で<em>「世界中の言語と古楽の出会い」</em>を扱った例外的な盤。 12言語・12曲・1枚で世界一周。",
        ],
        "subcurrents": [
            ("JRPG伝統", "<strong>Final Fantasy・Dragon Quest・Falcom Sound Team・Baten Kaitos</strong>。 1980-90年代から続く土台。"),
            ("ダークファンタジーOST", "<strong>ENDER LILIES・Dies irae</strong>。 <em>「メトロイドヴァニアの慟哭」</em>系統。"),
            ("ビジュアルノベル音楽", "<strong>9-nine-・AKABEiSOFT2・AUGUST・FAVORITE・CROSS†CHANNEL・Ever17</strong>。 <em>泣きゲー</em>の音楽資産。"),
            ("ジャンル越境作曲家", "<strong>Mili (ENDER LILIES)・Revo (Bravely Default)・Christopher Tin (Calling All Dawns)</strong>。"),
        ],
        "albums": [
            ("ENDER LILIES", "Quietus of the Knights OST", "和製メトロイドヴァニアの<em>慟哭の聖歌</em>。 Mili作曲。"),
            ("Falcom Sound Team jdk", "Collection", "日本ファルコムの長きにわたる蓄積。 <em>JRPGのDNA</em>がここに。"),
            ("Bravely Default", "OST", "Revo (Sound Horizon) の音楽性が一番明確に出たゲーム音楽。 <em>叙事詩の凝縮</em>。"),
            ("Calling All Dawns", "Christopher Tin", "12言語12曲の世界一周。 <em>Civilization IV のテーマを書いた人</em>のグラミー作。"),
            ("Final Fantasy", "OST Series", "植松伸夫・浜涯隆・濱渦正志の<em>長期連載</em>。 ゲーム音楽の文法を作った。"),
            ("Baten Kaitos", "OST (Motoi Sakuraba)", "桜庭統の<em>剛直なRPG音楽</em>。 GameCube時代の偽の名作。"),
            ("Donkey Kong Country", "Trilogy OST", "<em>David Wise</em> のジャングル × アンビエント。 SFC時代の最高峰のひとつ。"),
            ("Dies irae", "Soundtrack", "ノベルゲーOSTの<em>過剰さの極限</em>。 同人音楽との境界。"),
        ],
        "nodes": [
            (200, 140, "Final Fantasy", "JP"),
            (360, 180, "Falcom Sound Team", "JP"),
            (540, 140, "Bravely Default", "JP"),
            (700, 200, "Dragon Quest", "JP"),
            (660, 290, "Donkey Kong Country", "UK"),
            (540, 330, "Baten Kaitos", "JP"),
            (380, 310, "Calling All Dawns", "US"),
            (240, 290, "ENDER LILIES", "JP"),
            (160, 380, "Dies irae", "JP"),
        ],
        "links": [(0, 1), (1, 2), (0, 7), (7, 6), (6, 5), (5, 4)],
        "connections": "<strong>Anime (Frieren, Code Geass)</strong> と <strong>Indies (Imperial Circus)</strong>、 そして <strong>Celt&Fantasy (Antti Martikainen)</strong> の重なる場所。 <em>「物語のために書かれた音楽」</em> の機能性で繋がる。",
        "prev": "celt",
        "next": "anime",
    },
    {
        "slug": "anime",
        "num": 11,
        "name_jp": "アニメ",
        "name_en": "Anime",
        "latin": "Imagines Mobiles",
        "count": 81,
        "axes": ("戦闘/大作 / EPIC", "日常/哀 / SLICE-OF-LIFE", "交響", "主題歌"),
        "intro": [
            "<strong>Frieren・Code Geass・Elfen Lied・Charlotte・86 Eighty-six・Akame ga KILL!・A Place Further than the Universe・Hunter X Hunter</strong>。 OST中心で、 ベストアルバムやコンピレーションが少ない。 <em>「番組の世界観を音楽で持ち帰る」</em> 目的の収集。",
            "取り上げる作品の傾向 ── <strong>Code Geass</strong> や <strong>Elfen Lied</strong>、 <strong>86</strong> のような <em>「美しさと悲劇の同居」</em> を扱うものが目立つ。 ギャグ系・スポーツ系の OST はほぼ無い。",
            "<strong>Frieren OST (Evan Call作曲)</strong> は2024年のアニメOSTの<em>到達点</em>のひとつ。 オーケストラ復権の旗。 葬送の音楽を、 <em>悲しみすぎないように、 希望を残しすぎないように</em> 書く技。",
            "<strong>Elfen Lied の OP テーマ「Lilium」</strong> はラテン語コーラスで、 <em>異形の聖歌</em> として孤立している。 アニメOSTと教会音楽の境界を1曲で破壊した。",
        ],
        "subcurrents": [
            ("叙事詩・戦闘OST", "<strong>Code Geass・Akame ga KILL!・86 Eighty-six・Fate/stay night・Hunter X Hunter</strong>。 中川幸太郎・梶浦由記系列。"),
            ("オーケストラ復権", "<strong>Frieren・Charlotte・A Place Further than the Universe</strong>。 Evan Call・藤澤慶昌の<em>新世代叙情</em>。"),
            ("異形のOPテーマ", "<strong>Elfen Lied (Lilium)・KOTOKO・Helck</strong>。 ラテン語・呪術・幽玄。"),
            ("古典名作", "<strong>BEST OF INUYASHA・Dragon Ball・NARUTO Best Hit</strong>。 子供時代から続く根。"),
        ],
        "albums": [
            ("Frieren", "Beyond Journey's End OST", "2024年の<em>オーケストラ復権</em>。 Evan Call作曲。 葬送のような物悲しさが芯。"),
            ("Code Geass", "Sound Collection", "中川幸太郎・黒石ひとみのドラマチック路線。 <em>2000年代後半の到達点</em>。"),
            ("Elfen Lied", "OST", "ラテン語コーラスのOPテーマ「Lilium」だけで歴史に残る。 <em>異形の聖歌</em>。"),
            ("A Place Further than the Universe", "OST", "藤澤慶昌の<em>清涼な日常</em>。 南極を歩く4人の少女のための音楽。"),
            ("86 Eighty-six", "OST", "澤野弘之系の<em>戦闘ドラマOST</em>。 暗いアニメに必要な暗い音楽。"),
            ("Charlotte", "OST", "Anant・Lia・LiSA。 <em>Key作品</em>の音楽資産。"),
            ("Akame ga KILL!", "OST (2014-2015)", "戦闘 × 悲劇 OST の<em>典型例</em>。"),
            ("Hunter X Hunter", "OST", "古典蓄積の<em>長期OST</em>。"),
        ],
        "nodes": [
            (200, 140, "Code Geass", "JP"),
            (360, 180, "Akame ga KILL!", "JP"),
            (540, 160, "86 Eighty-six", "JP"),
            (700, 200, "Fate/stay night", "JP"),
            (240, 290, "Frieren", "JP"),
            (380, 310, "Charlotte", "JP"),
            (540, 330, "A Place Further", "JP"),
            (700, 320, "Elfen Lied", "JP"),
            (160, 380, "Grimgar", "JP"),
        ],
        "links": [(0, 1), (1, 2), (0, 4), (4, 5), (5, 6)],
        "connections": "<strong>Game (Calling All Dawns, ENDER LILIES)</strong> と <strong>Indies</strong>、 そして <strong>Classic 系現代曲調</strong> を結ぶ三角形の中央。",
        "prev": "game",
        "next": "nature",
    },
    {
        "slug": "nature",
        "num": 12,
        "name_jp": "ネイチャー",
        "name_en": "Nature",
        "latin": "Vox Mundi",
        "count": 50,
        "axes": ("森 / FOREST", "水 / WATER", "フィールド純度", "楽器ブレンド"),
        "intro": [
            "純粋なフィールドレコーディングと、 <em>「自然音 + 楽器」 のハイブリッド</em> が同居する部屋。 <strong>Gordon Hempton</strong> の地球音、 <strong>Dan Gibson's Solitudes</strong>、 <strong>Andrew Fitzgerald</strong>、 <strong>KENJI KIHARA</strong>。",
            "ここは <em>「音楽を聴かない時間」</em> のための音。 cabin.html の WebAudio 合成 (雨・焚き火・森・風) と地続き。 違いは、 こちらは<em>本物の地球を録音した</em>ものが多いこと。",
            "<strong>Gordon Hempton</strong> は <em>「世界的サウンドアーキビスト」</em> として知られる人物。 'Earth - A Day in the Life of a Planet' (1992) は、 24時間の地球の音を24章で構成した盤。 このコレクションの <em>静かさ志向の根</em>のひとつ。",
            "Boom Library の SFX 集 (SOE Autumn) も入っているのが面白い。 <em>「自然音をBGMで聴く」 と 「映画/ゲーム制作のための素材として持つ」</em> の境界がここでは曖昧になっている。",
        ],
        "subcurrents": [
            ("純粋フィールド・アーキビスト", "<strong>Gordon Hempton・Dan Gibson's Solitudes・Echoes Of Nature・Forest Ambience</strong>。 <em>地球の声を録音する人々</em>。"),
            ("ピアノ + 自然", "<strong>Andrew Fitzgerald・Marcia Green・Helen Rhodes & Joseph Wade</strong>。 <em>「ピアノで自然をなぞる」</em> 派。"),
            ("睡眠・スパ用途", "<strong>K Ambient Sounds・Nature Sound Healing・Nature Sound Retreat</strong>。 機能音楽。"),
            ("ハイブリッド", "<strong>Hennie Bekker・KENJI KIHARA・Larkin O'Cean</strong>。 自然音 + フルート + シンセ。"),
        ],
        "albums": [
            ("Gordon Hempton", "Earth - A Day in the Life of a Planet (1992)", "地球の1日を24章で録音した <em>「世界的サウンドアーキビスト」</em> の代表作。"),
            ("Dan Gibson's Solitudes", "Catalog", "カナダの森と湖の音。 <em>1970年代から続く環境録音の老舗</em>。"),
            ("Andrew Fitzgerald", "A Walk In The Woods (1999)", "ピアノと弦と自然音の融合。 <em>ヒーリングの王道</em>。"),
            ("KENJI KIHARA", "作品群", "日本の山と川を録音した人。 <em>「無人の風景の音」</em>のドキュメンタリー。"),
            ("Hennie Bekker", "Catalog", "南アフリカ＋カナダ。 <em>自然＋シンセ・パッド</em>派。"),
            ("Larkin", "O'Cean Flute and Sounds of the Sea", "笛 + 海の音。 <em>1980年代型ヒーリング</em>。"),
            ("Brian Hardin", "Selected", "森のフィールドレコーディング。"),
            ("Boom Library", "SOE Autumn", "<em>SFX素材集</em>。 制作者目線の所蔵。"),
        ],
        "nodes": [
            (200, 140, "Gordon Hempton", "US"),
            (360, 180, "Echoes Of Nature", "US"),
            (540, 160, "Forest Ambience", "US"),
            (240, 290, "Dan Gibson's Solitudes", "CA"),
            (380, 310, "KENJI KIHARA", "JP"),
            (540, 330, "Andrew Fitzgerald", "UK"),
            (700, 280, "Hennie Bekker", "ZA"),
            (660, 380, "Larkin O'Cean", "US"),
        ],
        "links": [(0, 1), (0, 3), (3, 4), (4, 5)],
        "connections": "<strong>Healing</strong> と <strong>Ambient (Tenhi, Empyrium)</strong> の境界。 <em>cabin.html WebAudio 合成</em> の発想と直接連結。",
        "prev": "anime",
        "next": "blues-folk",
    },
    {
        "slug": "blues-folk",
        "num": 13,
        "name_jp": "ブルース ＆ フォーク",
        "name_en": "Blues & Folk",
        "latin": "Cantores Antiqui",
        "count": 12,
        "axes": ("物語性 / NARRATIVE", "浮遊/抽象 / ATMOSPHERIC", "米国フォーク", "ケルト/世界"),
        "intro": [
            "たった<em>12枚</em>だが、 ものすごく方向が定まっている。 <strong>Loreena McKennitt・Natalie Merchant・Annwn・Liberte・Joran Elane・Lucy Rose・Rickie Lee Jones</strong>。 <em>「ケルト＝中世＝物語の歌い手」</em> ばかり。",
            "純粋なBlues (Muddy Waters・Robert Johnson・Bo Diddley系) は不在。 ここは <em>Folk の中の最も詩的・最もケルトな部分</em> を切り出した部屋。",
            "<strong>Loreena McKennitt</strong> はカナダ出身のケルト女王。 アイルランドだけでなく <em>シルクロードを音楽化</em>した人 (An Ancient Muse, The Book of Secrets)。 一人で「東洋的ケルト」というジャンルを作った。",
            "<strong>Annwn (DE)・Liberte (LV)・Joran Elane</strong> といった <em>非英語圏のケルト/中世音楽復興</em> が複数所蔵されている。 これは、 <em>「ケルト」が音楽様式として世界共通の語彙になっている</em> 証拠。",
        ],
        "subcurrents": [
            ("ケルト・物語の歌い手", "<strong>Loreena McKennitt・Natalie Merchant</strong>。 <em>storyteller spine の起点</em>。"),
            ("中世復興", "<strong>Annwn・Liberte・Joran Elane</strong>。 <em>非英語圏の古楽再演</em>。"),
            ("フォーク叙情", "<strong>Lucy Rose・Rickie Lee Jones</strong>。 アメリカン・フォークの<em>少数派</em>。"),
            ("ハイブリッド・ゴシック", "<strong>Autumn Tears・Iridio</strong>。 ゴシック × フォーク。"),
        ],
        "albums": [
            ("Loreena McKennitt", "An Ancient Muse / The Book of Secrets", "カナダのケルト女王。 <em>シルクロードを音楽化した人</em>。"),
            ("Natalie Merchant", "Ophelia (1998)", "10,000 Maniacs ソロ転身後の最高作。 <em>米国の物語の歌い手</em>の系譜。"),
            ("Annwn", "Orbis Alia", "ドイツのケルト音楽。 <em>儀式と即興の中間</em>を歩く。"),
            ("Liberte", "Jau Aust Ausruze (2010)", "ラトビアのフォーク。 <em>東欧の女性ボーカル</em>。"),
            ("Lucy Rose", "Like I Used To (2012)", "英国のシンガーソングライター。 <em>静謐なフォーク</em>。"),
            ("Joran Elane", "Glenvore (2014)", "<em>ハイランド系フォーク</em>。"),
            ("Autumn Tears", "Discography", "ゴシック × ピアノ × 弦 + 女性ボーカル。"),
            ("Rickie Lee Jones", "Selected", "1979年デビューの<em>米国の物語の歌い手</em>。"),
        ],
        "nodes": [
            (200, 140, "Natalie Merchant", "US"),
            (360, 180, "Lucy Rose", "UK"),
            (540, 160, "Loreena McKennitt", "CA"),
            (660, 260, "Joran Elane", "UK"),
            (540, 320, "Annwn", "DE"),
            (380, 330, "Liberte", "LV"),
            (240, 300, "Rickie Lee Jones", "US"),
        ],
        "links": [(0, 1), (1, 2), (2, 3), (5, 6)],
        "connections": "<strong>Storyteller Spine</strong> の起点。 <strong>Celt&Fantasy&Violin</strong> と地続き ── <em>「歌のあるケルト」</em>がここ、 <em>「歌の少ないケルト」</em>がCelt&Fantasy。",
        "prev": "nature",
        "next": "pop-rock",
    },
    {
        "slug": "pop-rock",
        "num": 14,
        "name_jp": "ポップ ＆ ロック",
        "name_en": "Pop & Rock",
        "latin": "Mores Communes",
        "count": 42,
        "axes": ("高揚 / ENERGETIC", "叙情 / REFLECTIVE", "王道", "劇場/シネマ"),
        "intro": [
            "このコレクションの<em>「対外用ポケット」</em>。 <strong>Bon Jovi・Foo Fighters・Deep Purple・Dua Lipa・Eminem・Kylie Minogue</strong> などの王道。 ただし <strong>Hans Zimmer (Interstellar)・Andrea Bocelli・Phantom of the Opera</strong> のような <em>劇場系</em> が同じ袋に入っているのが特徴。",
            "<em>「世間の良いとされるもの」 と 「個人の好み」 が交わる、 ゆるい中間地帯</em>。 SACDやハイレゾ盤が多めなのは、 <strong>音質オタクとしての矜持</strong> がここでは前面に出ているから。",
            "<strong>Hans Zimmer の Interstellar (Expanded Edition)</strong> はパイプオルガンで宇宙を鳴らした人の<em>最高到達点</em>。 2014年以降の劇伴の天井を引き上げた。 ここから <strong>Game (Calling All Dawns)・Anime (Frieren)・Celt&Fantasy (Antti Martikainen)</strong> へ橋が繋がる。",
            "<strong>Death Cab for Cutie・Copeland・Einar Stray</strong> といった<em>米国・北欧インディーロック</em>も少数だが入っている。 静謐なロックという小さな袋。",
        ],
        "subcurrents": [
            ("王道ロック・ポップ", "<strong>Bon Jovi・Foo Fighters・Deep Purple・Dua Lipa・Kylie Minogue・Eminem</strong>。 <em>大衆向けの音質保管</em>。"),
            ("劇場・シネマ", "<strong>Hans Zimmer (Interstellar)・Andrea Bocelli・Phantom of the Opera・Jackie Evancho</strong>。 <em>「物語と劇場の音」</em>。"),
            ("インディー叙情", "<strong>Death Cab for Cutie・Copeland・Einar Stray・Jack's Mannequin</strong>。 <em>静謐なロックの小袋</em>。"),
            ("シンガーソングライター", "<strong>Ben Folds & Nick Hornby・Helene Fischer・Judee Sill・Leon Russell</strong>。"),
        ],
        "albums": [
            ("Hans Zimmer", "Interstellar (Expanded Edition) (2020)", "パイプオルガンで宇宙を鳴らした人。 <em>2014年以降の劇伴の天井</em>を引き上げた。"),
            ("Death Cab for Cutie", "Transatlanticism / Kintsugi", "米国インディーロックの叙情派。 <em>静謐の中の中産階級の哀しみ</em>。"),
            ("Phantom of the Opera", "London Cast 2022", "ミュージカルの定番。 <em>このコレクションの「合唱・劇場成分」の補給源</em>。"),
            ("Deep Purple", "Made In Japan (Steven Wilson 2025 Remix)", "1972年盤の<em>2025年再リミックス</em>。 音質オタクの真骨頂。"),
            ("Andrea Bocelli", "Duets (30th Anniversary)", "イタリアン・テナーの<em>大衆性</em>。"),
            ("Bon Jovi", "Greatest Hits - The Ultimate Collection", "<em>シングル盤の集合体</em>としての SHM-CD。"),
            ("Dua Lipa", "Future Nostalgia (24-192)", "21世紀ポップを<em>ハイレゾで保管</em>する判断。"),
            ("Foo Fighters", "Discography", "Dave Grohl の<em>米国ロックの定番</em>。"),
        ],
        "nodes": [
            (200, 140, "Bon Jovi", "US"),
            (360, 180, "Foo Fighters", "US"),
            (540, 160, "Dua Lipa", "UK"),
            (700, 200, "Phantom of Opera", "UK"),
            (240, 300, "Death Cab for Cutie", "US"),
            (380, 330, "Copeland", "US"),
            (540, 310, "Hans Zimmer", "DE"),
            (700, 320, "Andrea Bocelli", "IT"),
            (160, 380, "Deep Purple", "UK"),
        ],
        "links": [(0, 1), (1, 2), (2, 3), (4, 5), (5, 6), (6, 7)],
        "connections": "<strong>Symphonic-Operatic Spine</strong> の終点 (Hans Zimmer)。 これを介して <strong>Game・Anime・Celt&Fantasy</strong> へ橋が繋がる。 <em>「劇伴・物語性」</em> という共通言語。",
        "prev": "blues-folk",
        "next": "ambient",
    },
]


# ── HTML Template ──────────────────────────────────────────────────
TEMPLATE = """<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{name_en} — Salon des Sons / 音の客間</title>
<meta name="description" content="{name_jp} ({count}枚) — {latin}。 {meta_desc}">
<meta name="theme-color" content="#0a0814">
<link rel="canonical" href="https://yuichi916.github.io/salon/{slug}.html">
<link rel="icon" type="image/svg+xml" href="../favicon.svg">
<script data-goatcounter="https://viewsengineer.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Shippori+Mincho:wght@500;700;900&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{{
  --night:#0a0814;--night-2:#14101a;--night-3:#1c1428;--velvet:#2a1822;
  --wine:#7a2a3a;--gold:#d4a050;--amber:#f0c878;--amber-soft:#f8e0a0;
  --paper:#ece2c8;--paper-dim:#c9beaa;--ink-soft:#897b65;--ink-faint:#5a4f42;
}}
*{{box-sizing:border-box;margin:0;padding:0}}
html{{scroll-behavior:smooth;background:var(--night)}}
body{{
  background:var(--night);color:var(--paper-dim);
  font-family:"Shippori Mincho","Cormorant Garamond",serif;
  font-feature-settings:"palt";line-height:1.85;
  -webkit-font-smoothing:antialiased;overflow-x:hidden;
}}
.serif{{font-family:"Shippori Mincho","Cormorant Garamond",serif}}
.eng{{font-family:"Cormorant Garamond",serif;font-style:italic}}
.mono{{font-family:"JetBrains Mono",monospace;letter-spacing:.06em}}
a{{color:var(--amber);text-decoration:none}}a:hover{{color:var(--amber-soft)}}
body::after{{content:"";position:fixed;inset:0;z-index:200;pointer-events:none;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.7 0 0 0 0 0.6 0 0 0 0 0.4 0 0 0 0.04 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  opacity:.3;mix-blend-mode:overlay;}}

.bar{{position:fixed;top:0;left:0;right:0;z-index:60;
  display:flex;align-items:center;justify-content:space-between;
  padding:18px 32px;background:linear-gradient(180deg, rgba(10,8,20,.92), rgba(10,8,20,0));
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}}
.bar .brand{{display:flex;align-items:center;gap:14px;
  font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:18px;color:var(--amber);letter-spacing:.06em;}}
.bar .brand .vinyl{{width:18px;height:18px;border-radius:50%;
  background:radial-gradient(circle at 40% 40%, var(--amber-soft), var(--amber) 30%, var(--velvet) 70%, var(--night) 100%);
  box-shadow:0 0 14px rgba(240,200,120,.5);
  animation:rotate 24s linear infinite;}}
@keyframes rotate{{from{{transform:rotate(0)}}to{{transform:rotate(360deg)}}}}
.bar .nav{{display:flex;gap:24px;font-family:"Inter",sans-serif;font-size:13px;letter-spacing:.06em}}
.bar .nav a{{color:var(--paper-dim)}}.bar .nav a:hover{{color:var(--amber)}}
.bar .back{{font-family:"Inter",sans-serif;font-size:13px;color:var(--ink-soft);letter-spacing:.06em}}
.bar .back:hover{{color:var(--amber)}}
@media(max-width:780px){{.bar{{padding:14px 18px}}.bar .nav{{display:none}}}}

.hero{{position:relative;padding:140px 32px 80px;
  background:radial-gradient(ellipse 60% 40% at 50% 60%, rgba(212,160,80,.06), transparent 70%),
    radial-gradient(ellipse 80% 60% at 80% 20%, rgba(122,42,58,.18), transparent 60%),var(--night);
  overflow:hidden;}}
.hero-content{{position:relative;text-align:center;max-width:900px;margin:0 auto;z-index:5}}
.chap-num{{font-family:"Cormorant Garamond",serif;font-style:italic;font-weight:500;
  font-size:80px;color:var(--amber);text-shadow:0 0 24px rgba(240,200,120,.3);
  display:block;line-height:1;margin-bottom:18px;}}
.chap-name-jp{{font-family:"Shippori Mincho",serif;font-weight:700;
  font-size:clamp(36px,5vw,68px);color:var(--paper);letter-spacing:.06em;
  text-shadow:0 0 28px rgba(240,200,120,.2);margin-bottom:8px;}}
.chap-name-en{{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:clamp(20px,2.4vw,28px);color:var(--amber);margin-bottom:14px;}}
.chap-latin{{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:14px;letter-spacing:.4em;text-transform:uppercase;color:var(--ink-soft);}}
.chap-count{{font-family:"JetBrains Mono",monospace;font-size:12px;
  letter-spacing:.3em;text-transform:uppercase;color:var(--ink-soft);margin-top:14px;}}

.sec{{position:relative;padding:80px 32px;border-top:1px solid rgba(212,160,80,.1)}}
.sec-inner{{max-width:900px;margin:0 auto}}
.sec-eyebrow{{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:13px;letter-spacing:.32em;text-transform:uppercase;
  color:var(--amber);margin-bottom:24px;
  display:flex;align-items:center;gap:14px;}}
.sec-eyebrow::before{{content:"";width:36px;height:1px;background:var(--amber)}}
.sec-title{{font-family:"Shippori Mincho",serif;font-weight:700;
  font-size:clamp(26px,3.4vw,42px);line-height:1.4;letter-spacing:.04em;
  color:var(--paper);margin-bottom:32px;}}
.sec-title em{{font-style:normal;color:var(--amber);text-shadow:0 0 18px rgba(240,200,120,.3)}}

.essay{{font-family:"Shippori Mincho",serif;font-size:17px;line-height:2.05;color:var(--paper-dim);}}
.essay p{{margin-bottom:20px}}
.essay p strong{{color:var(--paper);font-weight:700}}
.essay p em{{color:var(--amber);font-style:italic}}

.minimap{{position:relative;background:radial-gradient(ellipse at 50% 50%, rgba(28,20,40,.5), rgba(10,8,20,.2) 70%, transparent),var(--night-2);
  border:1px solid rgba(212,160,80,.16);border-radius:6px;padding:24px;margin-top:24px;}}
.minimap-svg{{display:block;width:100%;height:auto;aspect-ratio:16/9}}
.minimap-svg .axis{{stroke:rgba(212,160,80,.16);stroke-dasharray:2,4;stroke-width:1}}
.minimap-svg .ax-label{{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:10px;
  fill:var(--ink-soft);letter-spacing:.2em;text-transform:uppercase;}}
.minimap-svg .link{{stroke:rgba(240,200,120,.18);stroke-dasharray:2,3;stroke-width:.8;fill:none}}
.minimap-svg .node circle{{fill:var(--amber);fill-opacity:.18;stroke:var(--amber);stroke-opacity:.7;stroke-width:1.2;transition:fill-opacity .25s,r .25s}}
.minimap-svg .node:hover circle{{fill-opacity:.7;r:9}}
.minimap-svg .node text{{font-family:"Shippori Mincho",serif;font-size:11px;fill:var(--paper);text-anchor:middle;dominant-baseline:hanging}}
.minimap-svg .node .country{{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:9px;fill:var(--amber);text-anchor:middle;dominant-baseline:hanging}}

.subcurrents{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:20px;}}
.subcurrent{{background:rgba(28,20,40,.55);border:1px solid rgba(212,160,80,.14);
  border-radius:4px;padding:22px;}}
.subcurrent .t{{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:14px;letter-spacing:.16em;text-transform:uppercase;color:var(--amber);margin-bottom:10px;}}
.subcurrent .d{{font-family:"Shippori Mincho",serif;font-size:14px;line-height:1.85;color:var(--paper-dim)}}
.subcurrent .d em{{color:var(--amber);font-style:italic}}.subcurrent .d strong{{color:var(--paper)}}

.albums{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;margin-top:24px}}
.album{{background:rgba(28,20,40,.55);border:1px solid rgba(212,160,80,.12);border-radius:4px;
  padding:22px;transition:transform .25s,border-color .25s,background .25s;}}
.album:hover{{transform:translateY(-3px);border-color:rgba(240,200,120,.35);background:rgba(42,24,34,.6)}}
.album .ar{{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:13px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--amber);margin-bottom:6px;}}
.album .ti{{font-family:"Shippori Mincho",serif;font-weight:700;font-size:17px;color:var(--paper);
  line-height:1.4;margin-bottom:10px;}}
.album .blurb{{font-family:"Shippori Mincho",serif;font-size:13.5px;color:var(--paper-dim);line-height:1.85}}
.album .blurb em{{color:var(--amber);font-style:italic}}

.connection{{margin-top:32px;padding:22px 28px;
  background:linear-gradient(180deg,rgba(122,42,58,.18),rgba(28,20,40,.4));
  border-left:2px solid var(--gold);border-radius:0 4px 4px 0;}}
.connection .lbl{{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:12px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold);margin-bottom:8px;}}
.connection p{{font-family:"Shippori Mincho",serif;font-size:15px;color:var(--paper);line-height:1.95}}
.connection p em{{color:var(--amber);font-style:italic}}.connection p strong{{color:var(--paper)}}

.nav-bottom{{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:48px;padding-top:32px;
  border-top:1px solid rgba(212,160,80,.1);}}
.nav-bottom a{{display:block;padding:18px 22px;background:rgba(28,20,40,.4);
  border:1px solid rgba(212,160,80,.14);border-radius:4px;text-decoration:none;
  transition:all .25s;}}
.nav-bottom a:hover{{background:rgba(42,24,34,.55);border-color:rgba(240,200,120,.4)}}
.nav-bottom .lbl{{font-family:"Cormorant Garamond",serif;font-style:italic;
  font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--ink-soft);}}
.nav-bottom .ti{{font-family:"Shippori Mincho",serif;font-weight:700;font-size:18px;
  color:var(--paper);margin-top:6px;}}
.nav-bottom .next{{text-align:right}}
@media(max-width:680px){{.nav-bottom{{grid-template-columns:1fr}}.nav-bottom .next{{text-align:left}}}}

.foot{{padding:40px 32px;text-align:center;font-family:"Cormorant Garamond",serif;
  font-style:italic;font-size:13px;color:var(--ink-soft);letter-spacing:.1em;
  border-top:1px solid rgba(212,160,80,.1);}}
.foot a{{color:var(--ink-soft);margin:0 12px}}.foot a:hover{{color:var(--amber)}}

.reveal{{opacity:0;transform:translateY(28px);transition:opacity 1.1s ease,transform 1.1s cubic-bezier(.2,.8,.2,1)}}
.reveal.in{{opacity:1;transform:none}}
</style>
</head>
<body>

<header class="bar">
  <a href="../salon.html" class="brand"><span class="vinyl"></span><span>Salon des Sons</span></a>
  <nav class="nav">
    <a href="../salon.html#galaxy">Galaxy</a>
    <a href="../salon.html#chapters">Chapters</a>
    <a href="../salon.html#spines">Spines</a>
  </nav>
  <a href="../index.html" class="back">← Views Engineer</a>
</header>

<section class="hero">
  <div class="hero-content">
    <span class="chap-num eng">{num:02d}</span>
    <h1 class="chap-name-jp">{name_jp}</h1>
    <div class="chap-name-en">{name_en}</div>
    <div class="chap-latin">{latin}</div>
  </div>
</section>

<section class="sec">
  <div class="sec-inner">
    <div class="sec-eyebrow eng">Essay · 部屋について</div>
    <h2 class="sec-title serif">この部屋の <em>輪郭</em>。</h2>
    <div class="essay">
{essay_html}
    </div>
  </div>
</section>

<section class="sec">
  <div class="sec-inner">
    <div class="sec-eyebrow eng">Sub-currents · 内部の支流</div>
    <h2 class="sec-title serif">同じ部屋の中の <em>{subcurrent_count}つの支流</em>。</h2>
    <div class="subcurrents">
{subcurrents_html}
    </div>
  </div>
</section>

<section class="sec">
  <div class="sec-inner">
    <div class="sec-eyebrow eng">Map · 音楽性の地図</div>
    <h2 class="sec-title serif">アーティストを、<em>2軸</em>の上に置く。</h2>
    <div class="minimap">
      <svg class="minimap-svg" viewBox="0 0 800 450">
        <line class="axis" x1="400" y1="20" x2="400" y2="430"/>
        <line class="axis" x1="20" y1="225" x2="780" y2="225"/>
        <text class="ax-label" x="400" y="14" text-anchor="middle">↑ {axis_top}</text>
        <text class="ax-label" x="400" y="446" text-anchor="middle">{axis_bottom} ↓</text>
        <text class="ax-label" x="18" y="228" text-anchor="end">{axis_left} ←</text>
        <text class="ax-label" x="782" y="228" text-anchor="start">→ {axis_right}</text>
{links_html}
{nodes_html}
      </svg>
    </div>
  </div>
</section>

<section class="sec">
  <div class="sec-inner">
    <div class="sec-eyebrow eng">Featured Albums · 代表盤</div>
    <h2 class="sec-title serif">{album_count}枚の <em>代表盤</em>。</h2>
    <div class="albums">
{albums_html}
    </div>
    <div class="connection">
      <div class="lbl eng">Cross-Genre Bridges · 脊椎との接続</div>
      <p>{connections}</p>
    </div>
  </div>
</section>

<section class="sec">
  <div class="sec-inner">
    <div class="nav-bottom">
      <a href="{prev}.html"><div class="lbl">← 前の部屋</div><div class="ti">{prev_label}</div></a>
      <a href="{next}.html" class="next"><div class="lbl">次の部屋 →</div><div class="ti">{next_label}</div></a>
    </div>
  </div>
</section>

<footer class="foot">
  <div>© <span id="year"></span> Salon des Sons · <a href="../salon.html">客間トップ</a> · <a href="../index.html">Views Engineer</a></div>
</footer>

<script>
document.getElementById('year').textContent = new Date().getFullYear();
document.querySelectorAll('.sec').forEach(el => el.classList.add('reveal'));
const io = new IntersectionObserver(es => es.forEach(e => {{ if (e.isIntersecting) {{ e.target.classList.add('in'); io.unobserve(e.target); }} }}), {{ threshold: 0 }});
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
</script>
</body>
</html>
"""


def render_chapter(ch, all_chs):
    # Build essay HTML
    essay_html = "\n".join(f"      <p>{p}</p>" for p in ch["intro"])

    # Build subcurrents
    subc_html = "\n".join(
        f'      <div class="subcurrent"><div class="t">{i+1:02d}. {t}</div><div class="d">{d}</div></div>'
        for i, (t, d) in enumerate(ch["subcurrents"])
    )

    # Build SVG nodes
    nodes_html = "\n".join(
        f'        <g class="node"><circle cx="{x}" cy="{y}" r="6"/><text x="{x}" y="{y+18}">{name}</text><text x="{x}" y="{y+32}" class="country">{country}</text></g>'
        for x, y, name, country in ch["nodes"]
    )

    # Build SVG links
    links_html = "\n".join(
        f'        <path class="link" d="M {ch["nodes"][a][0]},{ch["nodes"][a][1]} L {ch["nodes"][b][0]},{ch["nodes"][b][1]}"/>'
        for a, b in ch["links"]
    )

    # Build albums
    albums_html = "\n".join(
        f'      <div class="album"><div class="ar">{ar}</div><div class="ti">{ti}</div><div class="blurb">{bl}</div></div>'
        for ar, ti, bl in ch["albums"]
    )

    # Find prev/next labels
    prev_ch = next(c for c in all_chs if c["slug"] == ch["prev"])
    next_ch = next(c for c in all_chs if c["slug"] == ch["next"])

    # Meta description
    meta_desc = ch["intro"][0].replace("<em>", "").replace("</em>", "").replace("<strong>", "").replace("</strong>", "")[:120]

    axis_top, axis_bottom, axis_left, axis_right = ch["axes"]

    return TEMPLATE.format(
        slug=ch["slug"], num=ch["num"], name_jp=ch["name_jp"], name_en=ch["name_en"],
        latin=ch["latin"], count=ch["count"],
        meta_desc=meta_desc,
        essay_html=essay_html,
        subcurrent_count=len(ch["subcurrents"]),
        subcurrents_html=subc_html,
        axis_top=axis_top, axis_bottom=axis_bottom,
        axis_left=axis_left, axis_right=axis_right,
        nodes_html=nodes_html, links_html=links_html,
        album_count=len(ch["albums"]),
        albums_html=albums_html,
        connections=ch["connections"],
        prev=ch["prev"], next=ch["next"],
        prev_label=prev_ch["name_jp"], next_label=next_ch["name_jp"],
    )


def main():
    for ch in CHAPTERS:
        out = OUT_DIR / f"{ch['slug']}.html"
        out.write_text(render_chapter(ch, CHAPTERS), encoding="utf-8")
        print(f"  saved: salon/{ch['slug']}.html  ({out.stat().st_size // 1024} KB)")
    print(f"\n[OK] Generated {len(CHAPTERS)} chapter pages in {OUT_DIR}")


if __name__ == "__main__":
    main()
