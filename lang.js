// ===== Regular expressions and grammars =====
// Regex: single-character symbols, | union, * star, + one or more, ? optional, ( ) grouping,
// ε (or empty parentheses) the empty string, ∅ the empty language, \x a literal x. Spaces are ignored.
function parseRegex(s) {
  let i = 0;
  const skip = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  function alt() { let a = cat(); skip(); while (s[i] === '|') { i++; a = { t: 'alt', a, b: cat() }; skip(); } return a; }
  function cat() {
    const parts = [];
    for (;;) { skip(); const c = s[i]; if (c === undefined || c === '|' || c === ')') break; parts.push(post()); }
    return parts.length ? parts.reduce((a, b) => ({ t: 'cat', a, b })) : { t: 'eps' };
  }
  function post() {
    let a = atom();
    for (;;) {
      skip(); const c = s[i];
      if (c === '*') { i++; a = { t: 'star', a }; }
      else if (c === '+') { i++; a = { t: 'cat', a, b: { t: 'star', a } }; }
      else if (c === '?') { i++; a = { t: 'alt', a, b: { t: 'eps' } }; }
      else return a;
    }
  }
  function atom() {
    skip(); const c = s[i];
    if (c === '(') { i++; const a = alt(); skip(); if (s[i] !== ')') throw new TWError('missing ")" in the expression'); i++; return a; }
    if (c === 'ε') { i++; return { t: 'eps' }; }
    if (c === '∅') { i++; return { t: 'empty' }; }
    if (c === '\\') { if (i + 1 >= s.length) throw new TWError('"\\" needs a character after it'); i += 2; return { t: 'sym', c: s[i - 1] }; }
    if (c === undefined) throw new TWError('the expression ends too early');
    if ('*+?|)'.includes(c)) throw new TWError(`"${c}" has nothing before it`);
    if (c === BLANK) throw new TWError('_ is the blank and cannot be a symbol');
    i++; return { t: 'sym', c };
  }
  const r = alt(); skip();
  if (i < s.length) throw new TWError(`unexpected "${s[i]}" in the expression`);
  return r;
}
// Thompson's construction; states are renamed q0, q1, … in breadth-first order
function thompson(ast) {
  let n = 0; const edges = [];
  const st = () => n++;
  const build = r => {
    if (r.t === 'cat') { const A = build(r.a), B = build(r.b); edges.push([A.f, 'eps', B.s]); return { s: A.s, f: B.f }; }
    const s = st(), f = st();
    if (r.t === 'sym') edges.push([s, r.c, f]);
    else if (r.t === 'eps') edges.push([s, 'eps', f]);
    else if (r.t === 'alt') { const A = build(r.a), B = build(r.b); edges.push([s, 'eps', A.s], [s, 'eps', B.s], [A.f, 'eps', f], [B.f, 'eps', f]); }
    else if (r.t === 'star') { const A = build(r.a); edges.push([s, 'eps', A.s], [s, 'eps', f], [A.f, 'eps', A.s], [A.f, 'eps', f]); }
    return { s, f };
  };
  const top = build(ast);
  const order = [top.s], seen = new Set(order);
  for (let k = 0; k < order.length; k++) for (const [a, , b] of edges) if (a === order[k] && !seen.has(b)) { seen.add(b); order.push(b); }
  if (!seen.has(top.f)) order.push(top.f);
  const name = new Map(order.map((x, i) => [x, 'q' + i]));
  return nfaFromEdges(edges.filter(e => name.has(e[0]) && name.has(e[2])).map(([a, c, b]) => [name.get(a), c, name.get(b)]), name.get(top.s), [name.get(top.f)], [...name.values()]);
}
function nfaFromEdges(edges, start, accept, states) {
  const delta = {}; const alphabet = new Set();
  for (const [a, c, b] of edges) { delta[a] = delta[a] || {}; (delta[a][c] = delta[a][c] || []).includes(b) || delta[a][c].push(b); if (c !== 'eps') alphabet.add(c); }
  return { kind: 'nfa', start, accept: new Set(accept), delta, states: states.slice(), alphabet: [...alphabet], ports: [{ name: 'in', readonly: true, oneway: true }] };
}
function langHeader(src, word) {
  const lines = src.split('\n').map(l => l.replace(/\/\/.*$/, '').trim());
  const k = lines.findIndex(Boolean); const m = k >= 0 && lines[k].match(new RegExp('^' + word + '\\s+([A-Za-z_]\\w*)$'));
  if (!m) throw new TWError(`the first line should be "${word} Name"`, k + 1);
  return { name: m[1], rest: lines.slice(k + 1), offset: k + 1 };
}
function compileRegex(src) {
  const h = langHeader(src, 'regex'); let alpha = null; const body = [];
  h.rest.forEach(l => { const m = l.match(/^alphabet\s*:\s*(.*)$/); if (m) alpha = splitList(m[1]); else if (l) body.push(l); });
  if (!body.length) throw new TWError('write the expression on the line after "regex Name"');
  const text = body.join(' ');
  const c = thompson(parseRegex(text));
  if (alpha) for (const a of alpha) if (!c.alphabet.includes(a)) c.alphabet.push(a);
  return Object.assign(c, { name: h.name, regex: text });
}
function nfaText(c, header) {
  const out = [header, `alphabet: ${c.alphabet.join(' ')}`, `start: ${c.start}`, `accept: ${[...c.accept].join(' ')}`];
  for (const q of c.states) for (const [a, ts] of Object.entries(c.delta[q] || {})) out.push(`${q}, ${a} -> ${[].concat(ts).join(' ')}`);
  return out.join('\n');
}

// ---------- automaton → regular expression (state elimination) ----------
const RX = {
  empty: { t: 'empty' }, eps: { t: 'eps' },
  sym: c => ({ t: 'sym', c }),
  alt(a, b) {
    if (a.t === 'empty') return b; if (b.t === 'empty') return a;
    if (rxStr(a) === rxStr(b)) return a;
    if (a.t === 'eps') [a, b] = [b, a];              // keep ε on the right, printed as ?
    if (b.t === 'eps' && (a.t === 'star' || (a.t === 'alt' && a.b.t === 'eps'))) return a;
    if (b.t === 'eps' && a.t === 'cat' && a.b.t === 'star' && rxStr(a.a) === rxStr(a.b.a)) return a.b;   // (x x*)? = x*
    return { t: 'alt', a, b };
  },
  cat(a, b) { if (a.t === 'empty' || b.t === 'empty') return RX.empty; if (a.t === 'eps') return b; if (b.t === 'eps') return a; return { t: 'cat', a, b }; },
  star(a) { if (a.t === 'empty' || a.t === 'eps') return RX.eps; if (a.t === 'star') return a; if (a.t === 'alt' && a.b.t === 'eps') return RX.star(a.a); return { t: 'star', a }; },
};
function rxStr(r, prec = 0) {
  const wrap = (s, p) => p < prec ? '(' + s + ')' : s;
  switch (r.t) {
    case 'empty': return '∅';
    case 'eps': return 'ε';
    case 'sym': return /[|*+?()\\εØ∅\s]/.test(r.c) ? '\\' + r.c : r.c;
    case 'star': return rxStr(r.a, 3) + '*';
    case 'cat': if (r.b.t === 'star' && rxStr(r.a) === rxStr(r.b.a)) return rxStr(r.a, 3) + '+';
      return wrap(rxStr(r.a, 2) + rxStr(r.b, 2), 2);
    case 'alt': return r.b.t === 'eps' ? rxStr(r.a, 3) + '?' : wrap(rxStr(r.a, 1) + '|' + rxStr(r.b, 1), 1);
  }
}
function automatonToRegex(c) {
  const S = '⊢', F = '⊣'; const E = new Map(); const key = (a, b) => a + '\u0000' + b;
  const get = (a, b) => E.get(key(a, b)) || RX.empty;
  const put = (a, b, r) => E.set(key(a, b), RX.alt(get(a, b), r));
  for (const [q, row] of Object.entries(c.delta || {})) for (const [a, ts] of Object.entries(row)) for (const t of [].concat(ts)) put(q, t, a === 'eps' ? RX.eps : RX.sym(a));
  put(S, c.start, RX.eps); for (const q of c.accept) put(q, F, RX.eps);
  let rest = c.states.slice();
  while (rest.length) {
    const deg = q => rest.filter(p => p !== q && get(p, q).t !== 'empty').length * rest.filter(p => p !== q && get(q, p).t !== 'empty').length;
    rest.sort((x, y) => deg(x) - deg(y)); const q = rest.shift();
    const loop = RX.star(get(q, q)); const ins = [S, ...rest].filter(p => get(p, q).t !== 'empty'), outs = [...rest, F].filter(p => get(q, p).t !== 'empty');
    for (const p of ins) for (const r of outs) put(p, r, RX.cat(get(p, q), RX.cat(loop, get(q, r))));
    for (const k of [...E.keys()]) { const [a, b] = k.split('\u0000'); if (a === q || b === q) E.delete(k); }
  }
  return rxStr(get(S, F));
}

// ---------- grammars ----------
// One nonterminal = one capital letter. Every other character is a terminal; eps or ε is the empty string.
const GRAMMAR_BOTTOM = '⊥';
function parseGrammar(src) {
  const h = langHeader(src, 'grammar'); let start = null; const prods = [];
  h.rest.forEach((l, k) => {
    const line = h.offset + k + 1; if (!l) return; let m;
    if ((m = l.match(/^start\s*:\s*(\S+)$/))) { if (!/^[A-Z]$/.test(m[1])) throw new TWError('the start symbol must be one capital letter', line); start = m[1]; return; }
    if (!(m = l.match(/^([A-Z])\s*(?:->|→)\s*(.*)$/))) throw new TWError('expected "A -> right side | right side" (nonterminals are single capital letters)', line);
    for (const alt of m[2].split('|')) {
      const t = alt.replace(/\s+/g, '');
      if (!t) throw new TWError('an empty alternative: write eps (or ε) for the empty string', line);
      const rhs = t === 'eps' || t === 'ε' ? [] : [...t];
      for (const x of rhs) if (x === BLANK || x === GRAMMAR_BOTTOM || x === 'ε') throw new TWError(`"${x}" cannot be used in a grammar`, line);
      prods.push({ lhs: m[1], rhs, line });
    }
  });
  if (!prods.length) throw new TWError('the grammar has no rules');
  start = start || prods[0].lhs;
  const nts = new Set([start, ...prods.map(p => p.lhs)]); const terms = new Set();
  for (const p of prods) for (const x of p.rhs) { if (/^[A-Z]$/.test(x)) { if (!prods.some(q => q.lhs === x)) throw new TWError(`${x} has no rules`, p.line); } else terms.add(x); }
  if (!prods.some(p => p.lhs === start)) throw new TWError(`the start symbol ${start} has no rules`);
  const nullable = new Set(); let ch = true;
  while (ch) { ch = false; for (const p of prods) if (!nullable.has(p.lhs) && p.rhs.every(x => nullable.has(x))) { nullable.add(p.lhs); ch = true; } }
  const isNT = x => /^[A-Z]$/.test(x);
  const rightLinear = prods.every(p => p.rhs.every((x, i) => !isNT(x) || i === p.rhs.length - 1));
  return { name: h.name, start, prods, nts: [...nts], terms: [...terms], nullable, isNT, rightLinear };
}
const prodStr = p => `${p.lhs} → ${p.rhs.length ? p.rhs.join('') : 'ε'}`;
function compileGrammar(src) {
  const g = parseGrammar(src);
  if (g.rightLinear) {
    // a regular grammar: nonterminals become states of an NFA, no stack needed
    const edges = []; let k = 0; const states = [...g.nts];
    for (const p of g.prods) {
      const last = p.rhs.length && g.isNT(p.rhs[p.rhs.length - 1]) ? p.rhs[p.rhs.length - 1] : 'end';
      const word = last === 'end' ? p.rhs : p.rhs.slice(0, -1);
      let from = p.lhs;
      word.forEach((a, i) => { const to = i === word.length - 1 ? last : 'p' + (++k); if (to !== last) states.push(to); edges.push([from, a, to]); from = to; });
      if (!word.length) edges.push([from, 'eps', last]);
    }
    states.push('end');
    return Object.assign(nfaFromEdges(edges, g.start, ['end'], states), { name: g.name, grammar: g });
  }
  // context-free: the expand/match PDA; its branches are leftmost derivations. It runs on an
  // equivalent grammar without ε-rules or unit cycles, so every branch ends.
  const run = searchForm(g);
  const rules = [{ from: 'start', input: 'eps', pop: 'eps', to: 'loop', push: [g.start, GRAMMAR_BOTTOM], prod: 'begin with ' + g.start }];
  if (g.nullable.has(g.start)) rules.push({ from: 'start', input: 'eps', pop: 'eps', to: 'accept', push: [], prod: g.start + ' ⇒* ε' });
  for (const p of run.prods) rules.push({ from: 'loop', input: 'eps', pop: p.lhs, to: 'loop', push: p.rhs.slice(), prod: p.label });
  for (const a of g.terms) rules.push({ from: 'loop', input: a, pop: a, to: 'loop', push: [], prod: 'match ' + a });
  rules.push({ from: 'loop', input: 'eps', pop: GRAMMAR_BOTTOM, to: 'accept', push: [], prod: 'done' });
  const prune = new Set([...g.terms, ...g.nts]);
  return { kind: 'pda', name: g.name, grammar: g, searchRules: run, prune, ports: [{ name: 'in', readonly: true, oneway: true }, { name: 'stack', readonly: false, oneway: false, stack: true }], start: 'start', accept: new Set(['accept']), byEmpty: false, rules, states: ['start', 'loop', 'accept'], alphabet: new Set(g.terms), nondet: true };
}
// ε-free, unit-cycle-free version used for searching; each rule remembers the rule it came from
function searchForm(g) {
  const out = []; const seen = new Set(); let derived = 0;
  const add = (lhs, rhs, label) => { const k = lhs + '>' + rhs.join(''); if (seen.has(k) || !rhs.length) return; seen.add(k); out.push({ lhs, rhs, label }); };
  for (const p of g.prods) {
    const opt = p.rhs.map((x, i) => g.nullable.has(x) ? i : -1).filter(i => i >= 0);
    for (let mask = 0; mask < 1 << Math.min(opt.length, 10); mask++) {
      const drop = new Set(opt.filter((_, j) => mask >> j & 1));
      const rhs = p.rhs.filter((_, i) => !drop.has(i));
      if (rhs.length === p.rhs.length) add(p.lhs, rhs, prodStr(p));
      else if (rhs.length) { add(p.lhs, rhs, `${prodStr({ lhs: p.lhs, rhs })}  (from ${prodStr(p)}, dropping symbols that derive ε)`); derived++; }
    }
  }
  // unit rules A → B that can loop back to A are replaced by what B derives
  const unit = (a, b) => out.some(r => r.lhs === a && r.rhs.length === 1 && r.rhs[0] === b);
  const reach = new Map(g.nts.map(a => [a, new Set()]));
  for (let ch = true; ch;) { ch = false; for (const r of out) if (r.rhs.length === 1 && g.isNT(r.rhs[0])) for (const a of g.nts) if ((a === r.lhs || reach.get(a).has(r.lhs)) && !reach.get(a).has(r.rhs[0])) { reach.get(a).add(r.rhs[0]); ch = true; } }
  const cyclic = g.nts.some(a => reach.get(a).has(a));
  if (!cyclic) return { prods: out, derived, cyclic };
  const res = []; const seen2 = new Set();
  for (const a of g.nts) for (const b of [a, ...reach.get(a)]) for (const r of out) if (r.lhs === b && !(r.rhs.length === 1 && g.isNT(r.rhs[0]))) {
    const k = a + '>' + r.rhs.join(''); if (seen2.has(k)) continue; seen2.add(k);
    res.push({ lhs: a, rhs: r.rhs, label: b === a ? r.label : `${prodStr({ lhs: a, rhs: r.rhs })}  (through ${a} ⇒* ${b})` });
  }
  return { prods: res, derived: derived + 1, cyclic };
}
function grammarPdaText(g) {
  const L = ['# the standard PDA of the grammar: expand a nonterminal on top, or match a terminal', `alphabet: ${g.terms.join(' ')}`, 'start: start', 'accept: accept', `start, eps, eps -> loop, ${g.start}${GRAMMAR_BOTTOM}`];
  for (const p of g.prods) L.push(`loop, eps, ${p.lhs} -> loop, ${p.rhs.length ? p.rhs.join('') : 'eps'}    # ${prodStr(p)}`);
  for (const a of g.terms) L.push(`loop, ${a}, ${a} -> loop, eps`);
  L.push(`loop, eps, ${GRAMMAR_BOTTOM} -> accept, eps`);
  return L.join('\n');
}
// right-linear grammar from a DFA or NFA: one nonterminal per state
function automatonToGrammar(c, name) {
  if (c.states.length > 26) throw new Error('more than 26 states: not enough capital letters for the nonterminals');
  const free = 'SABCDEFGHIJKLMNOPQRTUVWXYZ'.split('');
  const nt = new Map([[c.start, 'S']]); let i = 1; for (const q of c.states) if (!nt.has(q)) nt.set(q, free[i++]);
  const rows = new Map(c.states.map(q => [q, []]));
  for (const [q, row] of Object.entries(c.delta || {})) for (const [a, ts] of Object.entries(row)) for (const t of [].concat(ts)) rows.get(q).push((a === 'eps' ? '' : a) + nt.get(t));
  for (const q of c.accept) rows.get(q).push('eps');
  const out = [`grammar ${name}`, `// right-linear: one nonterminal per state of the automaton`, `start: S`];
  for (const q of c.states) { const r = rows.get(q); if (r.length) out.push(`${nt.get(q)} -> ${r.join(' | ')}    // state ${q}`); }
  return out.join('\n');
}
// all strings of the grammar up to length k, by leftmost derivation with length pruning
function generateStrings(g, k, cap = 300) {
  const need = form => form.filter(x => !g.isNT(x) || !g.nullable.has(x)).length;
  const out = new Set(); const seen = new Set(); const queue = [[g.start]]; let work = 0;
  while (queue.length && out.size < cap && work < 40000) {
    const f = queue.shift(); work++;
    const i = f.findIndex(g.isNT);
    if (i < 0) { out.add(f.join('')); continue; }
    for (const p of g.prods) if (p.lhs === f[i]) {
      const nf = [...f.slice(0, i), ...p.rhs, ...f.slice(i + 1)];
      if (need(nf) > k) continue; const key = nf.join(''); if (seen.has(key) || nf.length > 3 * k + 6) continue; seen.add(key); queue.push(nf);
    }
  }
  return { strings: [...out].sort((a, b) => a.length - b.length || (a < b ? -1 : 1)), complete: !queue.length };
}
// Chomsky normal form, then CYK
function toCNF(g) {
  let P = g.prods.map(p => ({ lhs: p.lhs, rhs: p.rhs.slice() })); let n = 0; const isNT = x => !g.terms.includes(x);
  const S0 = 'S₀'; P.unshift({ lhs: S0, rhs: [g.start] });
  const T = new Map(); const tnt = a => { if (!T.has(a)) { T.set(a, 'T' + a); P.push({ lhs: 'T' + a, rhs: [a] }); } return T.get(a); };
  for (const p of P.slice()) if (p.rhs.length >= 2) p.rhs = p.rhs.map(x => isNT(x) ? x : tnt(x));
  const bin = []; for (const p of P) { while (p.rhs.length > 2) { const x = 'X' + (++n); bin.push({ lhs: x, rhs: p.rhs.slice(1) }); p.rhs = [p.rhs[0], x]; } } P.push(...bin);
  // the binarized rules can themselves be long: repeat
  for (let again = true; again;) { again = false; for (const p of P.slice()) if (p.rhs.length > 2) { const x = 'X' + (++n); P.push({ lhs: x, rhs: p.rhs.slice(1) }); p.rhs = [p.rhs[0], x]; again = true; } }
  const nullable = new Set(); for (let ch = true; ch;) { ch = false; for (const p of P) if (!nullable.has(p.lhs) && p.rhs.every(x => nullable.has(x))) { nullable.add(p.lhs); ch = true; } }
  const Q = []; const add = (lhs, rhs) => { if (!Q.some(q => q.lhs === lhs && q.rhs.join('\u0000') === rhs.join('\u0000'))) Q.push({ lhs, rhs }); };
  for (const p of P) {
    if (!p.rhs.length) continue;
    if (p.rhs.length === 1) add(p.lhs, p.rhs);
    else { const [a, b] = p.rhs; add(p.lhs, [a, b]); if (nullable.has(a)) add(p.lhs, [b]); if (nullable.has(b)) add(p.lhs, [a]); }
  }
  // remove unit rules A → B
  const nts = [...new Set(Q.map(q => q.lhs))]; const unit = new Map(nts.map(a => [a, new Set([a])]));
  for (let ch = true; ch;) { ch = false; for (const q of Q) if (q.rhs.length === 1 && isNT(q.rhs[0])) for (const a of nts) if (unit.get(a).has(q.lhs) && !unit.get(a).has(q.rhs[0])) { unit.get(a).add(q.rhs[0]); ch = true; } }
  const R = [];
  for (const a of nts) for (const b of unit.get(a)) for (const q of Q) if (q.lhs === b && !(q.rhs.length === 1 && isNT(q.rhs[0]))) if (!R.some(r => r.lhs === a && r.rhs.join('\u0000') === q.rhs.join('\u0000'))) R.push({ lhs: a, rhs: q.rhs });
  return { start: S0, rules: R, epsilon: nullable.has(S0) };
}
function cyk(cnf, w) {
  const n = w.length; const T = [];
  for (let len = 1; len <= n; len++) { T[len] = []; for (let i = 0; i + len <= n; i++) {
    const cell = new Set();
    if (len === 1) { for (const r of cnf.rules) if (r.rhs.length === 1 && r.rhs[0] === w[i]) cell.add(r.lhs); }
    else for (let k = 1; k < len; k++) { const L = T[k][i], Rr = T[len - k][i + k]; for (const r of cnf.rules) if (r.rhs.length === 2 && L.has(r.rhs[0]) && Rr.has(r.rhs[1])) cell.add(r.lhs); }
    T[len][i] = cell;
  } }
  return { table: T, accept: n === 0 ? cnf.epsilon : T[n][0].has(cnf.start) };
}
