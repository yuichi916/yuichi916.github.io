/* 年末調整の計算機（令和8年分）— 画面に依存しない計算
 * 規定の数値は data/nencho-2026/rules.json にだけ書き、ここには書かない（rules を引数で受け取る）。
 * ブラウザでは window.Nencho2026、Node では module.exports で使う。
 * scripts/nencho_2026/test_core.mjs がこのファイルをそのまま読み込み、国税庁の設例と表の全行で検査する。
 * 金額はすべて整数の円。端数処理は国税庁「年末調整のしかた」の記載どおり（各関数のコメント）。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Nencho2026 = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------ 共通
  const int = (v) => {
    const n = Math.floor(Number(v) || 0);
    return n > 0 ? n : 0;
  };
  const cnt = (v) => Math.min(20, int(v));

  /** rules.years[key] を返す。inherit があれば元の年を写して overrides を重ねる */
  function yearRules(rules, key) {
    const y = rules.years[key];
    if (!y) throw new Error('unknown year ' + key);
    if (!y.inherit) return y;
    const base = yearRules(rules, y.inherit);
    const out = {};
    for (const k of Object.keys(base)) out[k] = base[k];
    for (const k of ['label', 'short', 'status', 'src']) if (y[k] !== undefined) out[k] = y[k];
    for (const k of Object.keys(y.overrides || {})) out[k] = Object.assign({}, base[k], y.overrides[k]);
    return out;
  }

  /** 区分の式 [{upTo, num, den, add} ..., {flat}] に当てはめる（1円未満切上げ） */
  function piecewise(x, steps) {
    x = int(x);
    if (x === 0) return 0;
    for (const s of steps) {
      if (s.flat !== undefined && s.upTo === undefined) return s.flat;
      if (x <= s.upTo) {
        if (s.flat !== undefined) return s.flat;
        return Math.ceil((x * s.num) / s.den) + s.add;
      }
    }
    throw new Error('piecewise: no step');
  }

  // ------------------------------------------------------------ 給与所得
  /** 給与等の収入金額 → 給与所得控除後の給与等の金額（年末調整等のための表と同じ値。660万円以上は算式で1円未満切捨て） */
  function salaryIncome(salary, k) {
    const a = int(salary);
    if (a < k.zeroBelow) return 0;
    if (a >= k.linear.from && a < k.linear.to) return a - k.linear.minus;
    for (const [lo, hi, v] of k.fixed) if (a >= lo && a < hi) return v;
    for (const b of k.bands) {
      if (a >= b.from && a < b.to) {
        const floor = b.from + Math.floor((a - b.from) / b.step) * b.step;
        return Math.floor((floor * b.num) / b.den) - b.minus;
      }
    }
    for (const f of k.formula) {
      if (a >= f.from && a < f.to) return Math.floor((a * f.num) / f.den) - f.minus;
    }
    return null; // 2,000万円超は年末調整の表の範囲外
  }

  /** 所得金額調整控除（1円未満切上げ・最高15万円） */
  function incomeAdjustment(salary, applies, r) {
    const a = int(salary);
    if (!applies || a <= r.threshold) return 0;
    return Math.min(r.max, Math.ceil((Math.min(a, r.cap) - r.threshold) / r.den));
  }

  // ------------------------------------------------------------ 所得控除
  function basicDeduction(totalIncome, r) {
    for (const [max, amt] of r.table) if (totalIncome <= max) return amt;
    return 0;
  }

  /** 配偶者控除・配偶者特別控除。earnerIncome＝所得者の合計所得金額、spouseIncome＝配偶者の合計所得金額 */
  function spouseDeduction(earnerIncome, spouseIncome, elderly, r) {
    const tier = r.earnerTiers.findIndex((t) => earnerIncome <= t);
    if (tier < 0) return { kind: null, amount: 0, note: '所得者の合計所得金額が1,000万円を超えるため適用なし' };
    if (spouseIncome <= r.deductionMaxIncome) {
      return { kind: elderly ? '配偶者控除（老人控除対象配偶者）' : '配偶者控除', amount: (elderly ? r.elderly : r.deduction)[tier] };
    }
    for (const [max, amts] of r.special) if (spouseIncome <= max) return { kind: '配偶者特別控除', amount: amts[tier] };
    return { kind: null, amount: 0, note: '配偶者の合計所得金額が133万円を超えるため適用なし' };
  }

  function tokuteiShinzokuDeduction(income, r) {
    if (income <= r.minIncomeExclusive) return 0;
    for (const [max, amt] of r.table) if (income <= max) return amt;
    return 0;
  }

  /** 生命保険料控除。p = {genNew, genOld, care, penNew, penOld}（年間の支払額） */
  function lifeDeduction(p, under23, r) {
    const special = under23 && r.under23Special && r.formulaNewUnder23;
    const genNew = int(p.genNew), genOld = int(p.genOld);
    const g1 = piecewise(genNew, special ? r.formulaNewUnder23 : r.formulaNew);
    const g2 = piecewise(genOld, r.formulaOld);
    const g3 = genNew && genOld ? Math.min(g1 + g2, special ? r.bothCapUnder23 : r.bothCap) : 0;
    const general = Math.max(g1, g2, g3);
    const care = piecewise(p.care, r.formulaNew);
    const penNew = int(p.penNew), penOld = int(p.penOld);
    const p1 = piecewise(penNew, r.formulaNew);
    const p2 = piecewise(penOld, r.formulaOld);
    const p3 = penNew && penOld ? Math.min(p1 + p2, r.bothCap) : 0;
    const pension = Math.max(p1, p2, p3);
    return { general, care, pension, total: Math.min(r.totalCap, general + care + pension), special: !!special && genNew > 0 };
  }

  /** 地震保険料控除。q = {quake, oldLong} */
  function earthquakeDeduction(q, r) {
    const a = Math.min(int(q.quake), r.max);
    const b = piecewise(q.oldLong, r.formulaOldLong);
    return Math.min(r.max, a + b);
  }

  /** 算出所得税額（速算表）。taxable は1,000円未満切捨て済み */
  function rateTax(taxable, r) {
    if (taxable <= 0) return 0;
    for (const [max, pct, minus] of r.table) {
      if (taxable <= max) return Math.floor((taxable * pct) / 100) - minus;
    }
    return null; // 18,050,000円超は年末調整の対象外
  }

  // ------------------------------------------------------------ 入力の正規化
  /** 画面の入力をそろえる。金額は円。 */
  function normalize(input) {
    const i = input || {};
    const d = i.dependents || {};
    const sp = i.spouse || null;
    const dis = i.disabled || {};
    return {
      salary: int(i.salary),
      bonus: Math.min(int(i.salary), int(i.bonus)), // 年収のうち賞与（源泉徴収の見込みだけに使う）
      socialInsurance: i.socialInsurance === null || i.socialInsurance === undefined || i.socialInsurance === '' ? null : int(i.socialInsurance),
      spouse: sp && sp.has !== false ? {
        salary: sp.income !== undefined ? null : int(sp.salary),
        income: sp.income !== undefined ? int(sp.income) : null,
        elderly: !!sp.elderly,
      } : null,
      dependents: {
        u16: cnt(d.u16), a16_18: cnt(d.a16_18), a23_69: cnt(d.a23_69),
        a70cohab: cnt(d.a70cohab), a70other: cnt(d.a70other),
        // 16〜18歳・23〜69歳のうち、合計所得金額が58万円超62万円以下（給与だけなら123万円超136万円以下）の人。
        // 令和8年分（改正後）は扶養親族、令和7年分・改正前の令和8年分・11月までの源泉徴収では扶養親族にならない
        betweenLines: Math.min(cnt(d.betweenLines), cnt(d.a16_18) + cnt(d.a23_69)),
        // 19〜22歳の子など。{salary} か {income}（合計所得金額）
        students: (d.students || []).slice(0, 20).map((s) => (s && s.income !== undefined ? { income: int(s.income) } : { salary: int(s && s.salary) })),
      },
      disabled: {
        self: ['general', 'special'].includes(dis.self) ? dis.self : 'none',
        familyGeneral: cnt(dis.familyGeneral), familySpecial: cnt(dis.familySpecial), familySpecialCohabiting: cnt(dis.familySpecialCohabiting),
      },
      selfStatus: ['widow', 'singleParent'].includes(i.selfStatus) ? i.selfStatus : 'none',
      life: { genNew: int((i.life || {}).genNew), genOld: int((i.life || {}).genOld), care: int((i.life || {}).care), penNew: int((i.life || {}).penNew), penOld: int((i.life || {}).penOld) },
      quake: { quake: int((i.quake || {}).quake), oldLong: int((i.quake || {}).oldLong) },
      smallBiz: int(i.smallBiz),
      housing: int(i.housing),
      withheld: i.withheld === null || i.withheld === undefined || i.withheld === '' ? null : int(i.withheld),
    };
  }

  /** 家族の合計所得金額（給与だけとして、その年の表で計算。income 指定ならそのまま） */
  function personIncome(p, y) {
    if (p.income !== null && p.income !== undefined) return p.income;
    const v = salaryIncome(p.salary, y.kyuyo);
    return v === null ? Infinity : v;
  }

  // ------------------------------------------------------------ 社会保険料の目安
  function estimateSocialInsurance(salary, est) {
    const a = int(salary);
    const monthly = Math.floor(a / 12);
    const pension = Math.round((Math.min(monthly, est.pension.monthlyCap) * est.pension.ratePpm) / 1e6) * 12;
    const health = Math.round((Math.min(monthly, est.health.monthlyCap) * est.health.ratePpm) / 1e6) * 12;
    const employment = Math.round((a * est.employment.ratePpm) / 1e6);
    return { pension, health, employment, total: pension + health + employment };
  }

  // ------------------------------------------------------------ 1年分の年税額
  /**
   * 国税庁「年末調整のしかた」3 年税額の計算 の順に計算する。
   * 戻り値の steps は内訳表示用（label・amount・note）。
   */
  function computeYear(rules, key, inp, si) {
    const y = yearRules(rules, key);
    const steps = [];
    const res = { key, label: y.label, eligible: true, steps };
    if (inp.salary > y.eligibility.maxSalary) {
      res.eligible = false;
      res.reason = y.eligibility.text;
      return res;
    }
    const dep = inp.dependents;
    // 学生など（19〜22歳）を、その年の所得要件で 特定扶養親族／特定親族／対象外 に分ける
    const students = dep.students.map((s) => {
      const income = personIncome(s, y);
      if (income <= y.dependents.maxIncome) return { income, kind: 'specific' };
      if (income <= y.tokuteiShinzoku.table[y.tokuteiShinzoku.table.length - 1][0]) return { income, kind: 'tokutei', amount: tokuteiShinzokuDeduction(income, y.tokuteiShinzoku) };
      return { income, kind: 'none' };
    });
    const nSpecific = students.filter((s) => s.kind === 'specific').length;
    // 去年の扶養の線（58万円）では扶養親族にならない人を除く。どの年齢区分の人かは問わないので、
    // 23歳未満かどうかの判定では 23〜69歳 から先に除く
    const excluded = y.dependents.maxIncome < 620000 ? dep.betweenLines : 0;
    const exA23 = Math.min(excluded, dep.a23_69), exA16 = excluded - exA23;
    const nGeneral = dep.a16_18 - exA16 + dep.a23_69 - exA23;
    const under23 = dep.u16 + (dep.a16_18 - exA16) + nSpecific; // 23歳未満の扶養親族
    const specialDisabled = inp.disabled.self === 'special' || inp.disabled.familySpecial + inp.disabled.familySpecialCohabiting > 0;

    // 1) 給与所得控除後の給与等の金額
    const kyuyo = salaryIncome(inp.salary, y.kyuyo);
    steps.push({ id: 'salary', label: '給与の収入金額', amount: inp.salary });
    steps.push({ id: 'kyuyo', label: '給与所得控除後の給与等の金額', amount: kyuyo, note: y.kyuyo.minimumDeductionText });
    // 2) 所得金額調整控除
    const adj = incomeAdjustment(inp.salary, under23 > 0 || specialDisabled, y.incomeAdjustment);
    if (adj) steps.push({ id: 'adj', label: '所得金額調整控除', amount: -adj, note: '給与850万円超で23歳未満の扶養親族などがいる' });
    const total = kyuyo - adj; // 合計所得金額（給与だけ）
    steps.push({ id: 'total', label: '合計所得金額（給与所得）', amount: total });

    // 3) 所得控除
    const ded = [];
    const siAmount = si.amount;
    ded.push({ id: 'si', label: '社会保険料控除', amount: siAmount, note: si.estimated ? '年収からの目安（入力がないため）' : '' });
    if (inp.smallBiz) ded.push({ id: 'smallbiz', label: '小規模企業共済等掛金控除（iDeCoなど）', amount: inp.smallBiz });
    const life = lifeDeduction(inp.life, under23 > 0, y.life);
    if (life.total) ded.push({ id: 'life', label: '生命保険料控除', amount: life.total, note: life.special ? '23歳未満の扶養親族がいるため一般の生命保険料は最高6万円' : '', detail: life });
    const quake = earthquakeDeduction(inp.quake, y.earthquake);
    if (quake) ded.push({ id: 'quake', label: '地震保険料控除', amount: quake });
    let spouse = null;
    if (inp.spouse) {
      const sIncome = personIncome(inp.spouse, y);
      spouse = spouseDeduction(total, sIncome, inp.spouse.elderly, y.spouse);
      spouse.spouseIncome = sIncome;
      ded.push({ id: 'spouse', label: spouse.kind || '配偶者（特別）控除', amount: spouse.amount, note: (spouse.note || '') + '（配偶者の合計所得金額 ' + (sIncome === Infinity ? '—' : sIncome.toLocaleString('ja-JP')) + '円）' });
    }
    const tokutei = students.filter((s) => s.kind === 'tokutei').reduce((a, s) => a + s.amount, 0);
    if (tokutei) ded.push({ id: 'tokutei', label: '特定親族特別控除', amount: tokutei });
    const d = y.dependents;
    const fuyo = nGeneral * d.general + nSpecific * d.specific + dep.a70other * d.elderly + dep.a70cohab * d.elderlyCohabiting;
    const p = y.personal;
    let personal = 0;
    personal += inp.disabled.familyGeneral * p.disabledGeneral + inp.disabled.familySpecial * p.disabledSpecial + inp.disabled.familySpecialCohabiting * p.disabledSpecialCohabiting;
    if (inp.disabled.self === 'general') personal += p.disabledGeneral;
    if (inp.disabled.self === 'special') personal += p.disabledSpecial;
    let statusNote = '';
    if (inp.selfStatus !== 'none') {
      if (total <= p.widowSingleParentMaxIncome) personal += inp.selfStatus === 'widow' ? p.widow : p.singleParent;
      else statusNote = '合計所得金額が500万円を超えるため寡婦・ひとり親控除は適用なし';
    }
    if (fuyo + personal) ded.push({ id: 'fuyo', label: '扶養控除・障害者控除など', amount: fuyo + personal, note: statusNote });
    else if (statusNote) ded.push({ id: 'fuyo', label: '扶養控除・障害者控除など', amount: 0, note: statusNote });
    const basic = basicDeduction(total, y.basic);
    ded.push({ id: 'basic', label: '基礎控除', amount: basic });
    const dedTotal = ded.reduce((a, x) => a + x.amount, 0);
    for (const x of ded) steps.push(Object.assign({ group: 'deduction' }, x, { amount: -x.amount }));
    steps.push({ id: 'dedTotal', label: '所得控除の合計', amount: -dedTotal });

    // 4) 課税給与所得金額（1,000円未満切捨て）→ 算出所得税額
    const taxable = Math.max(0, Math.floor((total - dedTotal) / y.rate.roundTo) * y.rate.roundTo);
    steps.push({ id: 'taxable', label: '課税給与所得金額（1,000円未満切捨て）', amount: taxable });
    const calc = rateTax(taxable, y.rate);
    if (calc === null) {
      res.eligible = false;
      res.reason = '課税給与所得金額が18,050,000円を超えるため年末調整の対象外';
      return res;
    }
    steps.push({ id: 'calc', label: '算出所得税額', amount: calc });
    // 5) 住宅借入金等特別控除（引ききれない分は切り捨て）
    const housing = Math.min(inp.housing, calc);
    if (inp.housing) steps.push({ id: 'housing', label: '住宅借入金等特別控除', amount: -housing, note: inp.housing > calc ? '引ききれない ' + (inp.housing - calc).toLocaleString('ja-JP') + '円は年末調整では差し引けない' : '' });
    const nenchoShotoku = calc - housing;
    steps.push({ id: 'nenchoShotoku', label: '年調所得税額', amount: nenchoShotoku });
    // 6) 年調年税額 ＝ 年調所得税額 × 102.1%（100円未満切捨て）
    const s = y.surtax;
    const annual = Math.floor(Math.floor((nenchoShotoku * s.num) / s.den) / s.roundTo) * s.roundTo;
    steps.push({ id: 'annual', label: '年調年税額（復興特別所得税を含む・100円未満切捨て）', amount: annual });

    Object.assign(res, {
      kyuyo, adjustment: adj, totalIncome: total, deductions: ded, deductionTotal: dedTotal,
      taxable, calcTax: calc, housing, nenchoShotoku, annualTax: annual,
      basic, spouse, students, under23, life, quake,
    });
    return res;
  }

  // ------------------------------------------------------------ 毎月の源泉徴収（見込み）
  /** 財務省告示の電算機計算の特例（令和8年分・月額表甲欄）。A＝その月の社会保険料等控除後の給与等の金額 */
  function withholdingMonthly(A, n, w) {
    A = int(A);
    let kd = 0;
    for (const s of w.kyuyoDeduction) {
      if (s.upTo === undefined || A <= s.upTo) {
        kd = s.flat !== undefined ? s.flat : Math.ceil((A * s.num) / s.den) + s.add;
        break;
      }
    }
    let basic = 0;
    for (const [max, amt] of w.basic) if (max === null || A <= max) { basic = amt; break; }
    const B = A - kd - w.perDependent * n - basic;
    if (B <= 0) return 0;
    for (const [max, rate, minus] of w.tax) {
      if (max === null || B <= max) {
        // 税額＝B×税率−控除額。10円未満四捨五入。整数で計算する（rate は 1/100000 単位）
        const v = B * rate - minus * w.taxRateDen; // ×1/100000 円
        const unit = w.taxRateDen * w.roundTo;
        return v <= 0 ? 0 : Math.floor((v + unit / 2) / unit) * w.roundTo;
      }
    }
    return 0;
  }

  /** 毎月の源泉徴収で数える「扶養親族等の数」（令和8年11月までの所得要件） */
  function withholdingDependents(rules, inp) {
    const w = rules.withholding.dependentRules;
    const y = yearRules(rules, w.useYear);
    let n = 0;
    const why = [];
    const earner = (salaryIncome(inp.salary, y.kyuyo) || 0);
    if (inp.spouse && earner <= w.spouseEarnerMaxIncome && personIncome(inp.spouse, y) <= w.spouseMaxIncome) { n++; why.push('源泉控除対象配偶者 1'); }
    const dep = inp.dependents;
    const adults = dep.a16_18 + dep.a23_69 - (y.dependents.maxIncome < 620000 ? dep.betweenLines : 0) + dep.a70cohab + dep.a70other;
    let st = 0;
    for (const s of dep.students) {
      const inc = personIncome(s, y);
      if (inc <= y.dependents.maxIncome || inc <= w.tokuteiMaxIncome) st++;
    }
    if (adults + st) { n += adults + st; why.push('源泉控除対象親族 ' + (adults + st)); }
    const dis = inp.disabled;
    const extra = (dis.self !== 'none' ? 1 : 0) + (inp.selfStatus !== 'none' ? 1 : 0) + dis.familyGeneral + dis.familySpecial + dis.familySpecialCohabiting;
    if (extra) { n += extra; why.push('障害者・寡婦・ひとり親 ' + extra); }
    return { n, why };
  }

  /** 賞与に対する源泉徴収税額の算出率の表（甲欄）の率（1/100000 単位）。prevA＝前月の社会保険料等控除後の給与 */
  function bonusRate(prevA, n, b) {
    const col = b.boundsThousandYen[Math.min(n, b.boundsThousandYen.length - 1)];
    let i = 0;
    while (i < col.length && prevA >= col[i] * 1000) i++;
    return b.ratesPer100000[i];
  }

  /** 賞与1回分の源泉徴収税額。bonusNet＝社会保険料を引いた後の賞与 */
  function bonusWithholding(bonusNet, prevA, n, w) {
    bonusNet = int(bonusNet); prevA = int(prevA);
    if (!bonusNet) return { tax: 0, method: 'none' };
    if (prevA <= 0 || bonusNet > prevA * 10) {
      // 前月の給与がない・賞与が前月の給与の10倍超: 賞与の1/6を足した月額の税額の差 ×6
      const d = w.bonus.tenfoldDivisor;
      const t = (withholdingMonthly(prevA + Math.floor(bonusNet / d), n, w) - withholdingMonthly(prevA, n, w)) * d;
      return { tax: Math.max(0, t), method: 'tenfold' };
    }
    const rate = bonusRate(prevA, n, w.bonus);
    return { tax: Math.floor((bonusNet * rate) / w.taxRateDen), method: 'rate', rate };
  }

  function estimateWithholding(rules, inp, siAmount) {
    const w = rules.withholding;
    const deps = withholdingDependents(rules, inp);
    const bonus = inp.bonus;
    // 社会保険料は給与と賞与の額の割合で分ける
    const siBonus = inp.salary ? Math.round((siAmount * bonus) / inp.salary) : 0;
    const A = Math.floor(Math.max(0, inp.salary - bonus - (siAmount - siBonus)) / 12);
    const monthly = withholdingMonthly(A, deps.n, w);
    const b = bonusWithholding(Math.max(0, bonus - siBonus), A, deps.n, w);
    return {
      monthlyBase: A, dependents: deps.n, why: deps.why, monthly, monthlyAnnual: monthly * 12,
      bonus, bonusNet: Math.max(0, bonus - siBonus), bonusTax: b.tax, bonusMethod: b.method, bonusRate: b.rate,
      annual: monthly * 12 + b.tax,
    };
  }

  // ------------------------------------------------------------ まとめ
  /**
   * input（normalize 参照）→ 令和8年分・令和7年分・令和8年分（改正前）の年税額、源泉徴収の見込み、戻る目安。
   */
  function compute(rules, input) {
    const inp = normalize(input);
    const est = estimateSocialInsurance(inp.salary, rules.socialInsuranceEstimate);
    const si = inp.socialInsurance === null ? { amount: est.total, estimated: true, breakdown: est } : { amount: inp.socialInsurance, estimated: false };
    const r8 = computeYear(rules, 'r8', inp, si);
    const r7 = computeYear(rules, 'r7', inp, si);
    const r8pre = computeYear(rules, 'r8pre', inp, si);
    const out = { input: inp, socialInsurance: si, r8, r7, r8pre };
    if (!r8.eligible) return out;
    const wh = estimateWithholding(rules, inp, si.amount);
    const withheld = inp.withheld !== null ? { amount: inp.withheld, estimated: false } : { amount: wh.annual, estimated: true };
    out.withholding = Object.assign({ estimate: wh }, withheld);
    out.refund = withheld.amount - r8.annualTax; // ＋なら戻る、−なら12月に追加で引かれる
    out.diffFromLastYear = r7.eligible ? r8.annualTax - r7.annualTax : null;
    out.reformEffect = r8pre.eligible ? r8pre.annualTax - r8.annualTax : null;
    return out;
  }

  return {
    yearRules, piecewise, salaryIncome, incomeAdjustment, basicDeduction, spouseDeduction,
    tokuteiShinzokuDeduction, lifeDeduction, earthquakeDeduction, rateTax, normalize,
    estimateSocialInsurance, computeYear, withholdingMonthly, withholdingDependents, bonusRate, bonusWithholding, estimateWithholding, compute,
  };
});
