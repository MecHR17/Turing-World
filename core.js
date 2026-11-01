// ===== Turing World core engine (pure, no DOM) =====
const BLANK = '_';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class TWError extends Error {
  constructor(msg, line) { super(line ? `line ${line}: ${msg}` : msg); this.line = line; }
}

// ---------- Budgets ----------
function compileBudget(expr) {
  if (expr == null || String(expr).trim() === '') return null;
  const s = String(expr).trim();
  if (!/^[\sn0-9+\-*\/^().,a-z]*$/.test(s)) throw new TWError(`budget "${s}" may only use n, numbers, + - * / ^ ( ), log, sqrt, min, max`);
  const words = s.match(/[a-z]+/g) || [];
  for (const w of words) if (!['n', 'log', 'sqrt', 'min', 'max'].includes(w)) throw new TWError(`unknown name "${w}" in budget`);
  const js = s.replace(/\^/g, '**').replace(/\blog\b/g, 'L').replace(/\bsqrt\b/g, 'Math.sqrt').replace(/\bmin\b/g, 'Math.min').replace(/\bmax\b/g, 'Math.max');
  let f;
  try { f = new Function('n', 'L', `return (${js});`); f(4, x => Math.log2(Math.max(x, 2))); }
  catch (e) { throw new TWError(`budget "${s}" is not a valid expression`); }
  return n => f(n, x => Math.log2(Math.max(x, 2)));
}

// ---------- Program language ----------
function tokenize(src) {
  const toks = []; let i = 0, line = 1;
  const two = ['==', '!=', '<=', '>=', '&&', '||', '..'];
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c) || c === ';') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === "'") {
      if (src[i + 2] !== "'") throw new TWError(`quoted symbol must be one character, like '#'`, line);
      toks.push({ pos: i, t: 'sym', v: src[i + 1], line }); i += 3; continue;
    }
    if (c === '"') {
      let j = i + 1; while (j < src.length && src[j] !== '"' && src[j] !== '\n') j++;
      if (src[j] !== '"') throw new TWError('missing closing " in a string', line);
      const v = src.slice(i + 1, j);
      if (/[\s_]/.test(v)) throw new TWError('strings cannot contain spaces or blanks (_)', line);
      toks.push({ pos: i, t: 'str', v, line }); i = j + 1; continue;
    }
    const tw = src.substr(i, 2);
    if (two.includes(tw)) { toks.push({ pos: i, t: 'op', v: tw, line }); i += 2; continue; }
    if ('{}(),:=<>!'.includes(c)) { toks.push({ pos: i, t: 'op', v: c, line }); i++; continue; }
    if (c === '_' && !/[A-Za-z0-9_]/.test(src[i + 1] || '')) { toks.push({ pos: i, t: 'sym', v: '_', line }); i++; continue; }
    if (/[A-Za-z0-9_]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      toks.push({ pos: i, t: 'word', v: src.slice(i, j), line }); i = j; continue;
    }
    if ('#$@*+-|&.%^/'.includes(c)) { toks.push({ pos: i, t: 'sym', v: c, line }); i++; continue; }
    throw new TWError(`unexpected character "${c}"`, line);
  }
  toks.push({ pos: i, t: 'eof', v: '', line });
  return toks;
}

const KEYWORDS = new Set(['while', 'if', 'else', 'write', 'move', 'inc', 'dec', 'call', 'accept', 'reject', 'tape', 'reg', 'machine', 'read', 'atstart', 'choose', 'guess', 'oracle', 'exists', 'forall', 'simulate', 'writeself', 'push', 'pop', 'send', 'seek']);

function parseProgram(src) {
  const toks = tokenize(src); let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];
  const isOp = v => peek().t === 'op' && peek().v === v;
  const isWord = v => peek().t === 'word' && peek().v === v;
  const expectOp = v => { const t = next(); if (t.t !== 'op' || t.v !== v) throw new TWError(`expected "${v}" but found "${t.v || 'end'}"`, t.line); return t; };
  const expectWord = v => { const t = next(); if (t.t !== 'word' || t.v !== v) throw new TWError(`expected "${v}" but found "${t.v || 'end'}"`, t.line); return t; };
  const ident = what => { const t = next(); if (t.t !== 'word' || !/^[A-Za-z_]/.test(t.v)) throw new TWError(`expected ${what} name but found "${t.v || 'end'}"`, t.line); return t.v; };
  const value = () => {
    const t = next();
    if (t.t === 'sym' || t.t === 'word') return t.v;
    throw new TWError(`expected a value but found "${t.v || 'end'}"`, t.line);
  };

  const prog = { name: 'Program', dialect: null, tapes: [], regs: [], body: [], sockets: [] };
  expectWord('machine');
  prog.name = ident('machine');
  if (isWord('dfa')) { next(); prog.dialect = 'dfa'; }
  expectOp('{');

  function parseExpr() {
    const t = peek();
    if (t.t === 'word' && t.v === 'read') {
      next(); expectOp('('); const tape = ident('tape'); expectOp(')');
      return { k: 'read', tape, line: t.line };
    }
    if (t.t === 'word' && (!KEYWORDS.has(t.v) || t.v === 'accept' || t.v === 'reject')) { next(); return { k: 'name', v: t.v, line: t.line }; }
    if (t.t === 'sym') { next(); return { k: 'lit', v: t.v, line: t.line }; }
    throw new TWError(`expected read(tape), a register or a value but found "${t.v || 'end'}"`, t.line);
  }
  function parseAtom() {
    const t = peek();
    if (isOp('(')) { next(); const c = parseCond(); expectOp(')'); return c; }
    if (t.t === 'word' && t.v === 'atstart') { next(); expectOp('('); const tape = ident('tape'); expectOp(')'); return { k: 'atstart', tape, line: t.line }; }
    const a = parseExpr();
    const op = peek();
    if (op.t === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(op.v)) {
      next(); const b = parseExpr(); return { k: 'cmp', op: op.v, a, b, line: t.line };
    }
    throw new TWError(`expected a comparison like read(in) == 1`, t.line);
  }
  function parseNot() { if (isOp('!')) { next(); return { k: 'not', a: parseNot() }; } return parseAtom(); }
  function parseAnd() { let a = parseNot(); while (isOp('&&')) { next(); a = { k: 'and', a, b: parseNot() }; } return a; }
  function parseCond() { let a = parseAnd(); while (isOp('||')) { next(); a = { k: 'or', a, b: parseAnd() }; } return a; }

  // a bound: a number, n, or a budget expression in parentheses, like (n^2 + 5)
  function bound() {
    const t = peek();
    if (t.t === 'word' && (/^\d+$/.test(t.v) || t.v === 'n')) { next(); return t.v; }
    if (!isOp('(')) throw new TWError('a bound is a number, n, or an expression in parentheses like (n^2)', t.line);
    const open = next(); let depth = 1, close = null;
    while (depth) { const x = next(); if (x.t === 'eof') throw new TWError('missing ")" in the bound', open.line); if (x.t === 'op' && x.v === '(') depth++; if (x.t === 'op' && x.v === ')') { depth--; close = x; } }
    const raw = src.slice(open.pos + 1, close.pos).trim(); if (!raw) throw new TWError('the bound is empty', open.line);
    return raw;
  }
  function parseBlock() {
    expectOp('{'); const out = [];
    while (!isOp('}')) { if (peek().t === 'eof') throw new TWError('missing "}"', peek().line); out.push(parseStmt()); }
    next(); return out;
  }
  function parseStmt() {
    const t = peek();
    if (t.t !== 'word') throw new TWError(`expected a statement but found "${t.v}"`, t.line);
    switch (t.v) {
      case 'while': { next(); const cond = parseCond(); return { k: 'while', cond, body: parseBlock(), line: t.line }; }
      case 'if': {
        next(); const cond = parseCond(); const then = parseBlock(); let els = [];
        if (isWord('else')) { next(); els = isWord('if') ? [parseStmt()] : parseBlock(); }
        return { k: 'if', cond, then, els, line: t.line };
      }
      case 'write': {
        next(); const tape = ident('tape');
        if (peek().t === 'str') return { k: 'writestr', tape, text: next().v, line: t.line };
        return { k: 'write', tape, expr: parseExpr(), line: t.line };
      }
      case 'push': { next(); const tape = ident('tape'); return { k: 'push', tape, expr: parseExpr(), line: t.line }; }
      case 'pop': { next(); return { k: 'pop', tape: ident('tape'), line: t.line }; }
      case 'seek': { next(); const tape = ident('tape'); return { k: 'seek', tape, addr: parseExpr(), line: t.line }; }
      case 'send': { next(); const tape = ident('tape'); return { k: 'send', tape, expr: parseExpr(), line: t.line }; }
      case 'writeself': { next(); return { k: 'writestr', tape: ident('tape'), self: true, line: t.line }; }
      case 'simulate': {
        next(); const code = ident('tape'); let on = null, time = null, space = null;
        if (isWord('on')) {
          next(); expectOp('('); on = [];
          while (!isOp(')')) { on.push(ident('tape')); if (isOp(',')) next(); else if (!isOp(')')) throw new TWError('expected "," or ")" in the tape list', t.line); }
          next();
        }
        if (isWord('within')) {
          // within 100 · within time (n^2) · within space (n) time (8*n*n)
          next(); let first = true;
          for (;;) {
            let kind = 'time';
            if (isWord('time') || isWord('space')) kind = next().v; else if (!first) break;
            const b = bound(); if (kind === 'time') time = b; else space = b; first = false;
            if (!isWord('time') && !isWord('space')) break;
          }
        }
        return { k: 'simulate', code, on, time, space, line: t.line };
      }
      case 'move': {
        next(); const tape = ident('tape'); const d = next();
        if (d.t !== 'word' || !['L', 'R', 'S'].includes(d.v)) throw new TWError('move direction must be L, R or S', d.line);
        return { k: 'move', tape, dir: d.v, line: t.line };
      }
      case 'inc': case 'dec': { next(); return { k: t.v, reg: ident('register'), line: t.line }; }
      case 'call': { next(); return { k: 'call', name: ident('machine'), line: t.line }; }
      case 'exists': case 'forall': {
        next(); const q = t.v === 'exists' ? 'E' : 'A';
        if (isOp('{')) {
          const blocks = [parseBlock()];
          while (isWord('or')) { next(); blocks.push(parseBlock()); }
          if (blocks.length < 2) throw new TWError(`${t.v} needs at least two blocks: ${t.v} { ... } or { ... }`, t.line);
          return { k: 'choose', blocks, q, line: t.line };
        }
        return { k: 'guess', reg: ident('register'), q, line: t.line };
      }
      case 'choose': {
        next(); const blocks = [parseBlock()];
        while (isWord('or')) { next(); blocks.push(parseBlock()); }
        if (blocks.length < 2) throw new TWError('choose needs at least two blocks: choose { ... } or { ... }', t.line);
        return { k: 'choose', blocks, line: t.line };
      }
      case 'guess': { next(); return { k: 'guess', reg: ident('register'), line: t.line }; }
      case 'accept': case 'reject': {
        next();
        if (isWord('if')) {
          next(); const cond = parseCond(); const acc = t.v === 'accept';
          return { k: 'if', cond, then: [{ k: 'halt', acc, line: t.line }], els: [{ k: 'halt', acc: !acc, line: t.line }], line: t.line };
        }
        return { k: 'halt', acc: t.v === 'accept', line: t.line };
      }
      case 'tape': case 'reg': case 'oracle': throw new TWError(`declare ${t.v}s at the top of the machine, before statements`, t.line);
      default: {
        next();
        if (isOp('=')) { next(); return { k: 'assign', reg: t.v, expr: parseExpr(), line: t.line }; }
        throw new TWError(`unknown statement "${t.v}"`, t.line);
      }
    }
  }

  // declarations
  while (isWord('tape') || isWord('reg') || isWord('oracle')) {
    const t = next();
    if (t.v === 'oracle') {
      const name = ident('oracle socket');
      if (prog.sockets.includes(name)) throw new TWError(`oracle "${name}" declared twice`, t.line);
      prog.sockets.push(name);
    } else if (t.v === 'tape') {
      const name = ident('tape'); let alphabet = null; let readonly = false, oneway = false;
      if (isOp(':')) {
        next(); expectOp('{'); alphabet = [];
        while (!isOp('}')) { const v = value(); if (v.length !== 1) throw new TWError(`tape symbols are single characters ("${v}")`, t.line); alphabet.push(v); if (isOp(',')) next(); }
        next();
      }
      let output = false;
      while (isWord('readonly') || isWord('oneway') || isWord('output')) { const mv = next().v; if (mv === 'readonly') readonly = true; else if (mv === 'output') { output = true; oneway = true; } else oneway = true; }
      if (output && readonly) throw new TWError('an output tape cannot be read-only', t.line);
      if (prog.tapes.some(x => x.name === name)) throw new TWError(`tape "${name}" declared twice`, t.line);
      prog.tapes.push({ name, alphabet, readonly, oneway, output, line: t.line });
    } else {
      const name = ident('register'); expectOp(':'); let domain, numeric = false;
      if (isOp('{')) {
        next(); domain = [];
        while (!isOp('}')) { domain.push(value()); if (isOp(',')) next(); }
        next();
      } else {
        const a = next(); expectOp('..'); const b = next();
        const lo = parseInt(a.v, 10), hi = parseInt(b.v, 10);
        if (isNaN(lo) || isNaN(hi) || hi < lo) throw new TWError('register range must look like 0..5', t.line);
        if (hi - lo > 4096) throw new TWError('register ranges are capped at 4096 values', t.line);
        domain = []; for (let i = lo; i <= hi; i++) domain.push(String(i)); numeric = true;
      }
      if (!domain.length) throw new TWError(`register "${name}" needs at least one value`, t.line);
      let init = domain[0];
      if (isOp('=')) { next(); init = value(); if (!domain.includes(init)) throw new TWError(`initial value ${init} is not in the domain of ${name}`, t.line); }
      if (name === 'ret') throw new TWError('"ret" is a built-in register', t.line);
      prog.regs.push({ name, domain, numeric, init, line: t.line });
    }
  }
  while (!isOp('}')) { if (peek().t === 'eof') throw new TWError('missing "}" at end of machine', peek().line); prog.body.push(parseStmt()); }
  next();
  if (peek().t !== 'eof') throw new TWError('text after the end of the machine', peek().line);
  return prog;
}

function compileProgram(src) {
  const prog = parseProgram(src);
  const tapeNames = new Set(prog.tapes.map(t => t.name));
  const regMap = new Map(prog.regs.map(r => [r.name, r]));
  regMap.set('ret', { name: 'ret', domain: ['none', 'accept', 'reject'], numeric: false, init: 'none', builtin: true });
  const usesCall = { v: false };
  const checkTape = (n, line) => { if (!tapeNames.has(n)) throw new TWError(`unknown tape "${n}"`, line); };
  const resolve = e => {
    if (e.k === 'read') { checkTape(e.tape, e.line); return e; }
    if (e.k === 'name') return regMap.has(e.v) ? { k: 'reg', name: e.v } : { k: 'lit', v: e.v };
    return e;
  };
  const resolveCond = c => {
    switch (c.k) {
      case 'or': case 'and': return { k: c.k, a: resolveCond(c.a), b: resolveCond(c.b) };
      case 'not': return { k: 'not', a: resolveCond(c.a) };
      case 'atstart': checkTape(c.tape, c.line); return c;
      case 'cmp': return { k: 'cmp', op: c.op, a: resolve(c.a), b: resolve(c.b) };
    }
  };
  const nodes = [];
  const mk = n => { n.id = nodes.length; nodes.push(n); return n; };
  const endNode = mk({ op: 'halt', acc: false, implicit: true, line: null });
  function compileList(list, next) { for (let i = list.length - 1; i >= 0; i--) next = compileStmt(list[i], next); return next; }
  function compileStmt(s, next) {
    switch (s.k) {
      case 'while': { const b = mk({ op: 'branch', cond: resolveCond(s.cond), line: s.line, loop: true }); b.t = compileList(s.body, b.id); b.f = next; return b.id; }
      case 'if': { const b = mk({ op: 'branch', cond: resolveCond(s.cond), line: s.line }); b.t = compileList(s.then, next); b.f = compileList(s.els, next); return b.id; }
      case 'write': checkTape(s.tape, s.line); return mk({ op: 'write', tape: s.tape, expr: resolve(s.expr), line: s.line, next }).id;
      case 'move': checkTape(s.tape, s.line); return mk({ op: 'move', tape: s.tape, dir: s.dir, line: s.line, next }).id;
      case 'assign': {
        const r = regMap.get(s.reg); if (!r) throw new TWError(`unknown register "${s.reg}"`, s.line);
        if (r.builtin) throw new TWError('"ret" is set by call and cannot be assigned', s.line);
        return mk({ op: 'assign', reg: s.reg, expr: resolve(s.expr), line: s.line, next }).id;
      }
      case 'inc': case 'dec': {
        const r = regMap.get(s.reg); if (!r) throw new TWError(`unknown register "${s.reg}"`, s.line);
        if (!r.numeric) throw new TWError(`${s.k} needs a numeric range register like 0..5`, s.line);
        return mk({ op: s.k, reg: s.reg, line: s.line, next }).id;
      }
      case 'push': checkTape(s.tape, s.line); return mk({ op: 'push', tape: s.tape, expr: resolve(s.expr), line: s.line, next }).id;
      case 'pop': checkTape(s.tape, s.line); return mk({ op: 'pop', tape: s.tape, line: s.line, next }).id;
      case 'seek': checkTape(s.tape, s.line); return mk({ op: 'seek', tape: s.tape, addr: s.addr.k === 'name' && tapeNames.has(s.addr.v) ? { k: 'tape', name: s.addr.v } : resolve(s.addr), line: s.line, next }).id;
      case 'send': checkTape(s.tape, s.line); return mk({ op: 'send', tape: s.tape, expr: resolve(s.expr), line: s.line, next }).id;
      case 'writestr': checkTape(s.tape, s.line); if (!s.self && !s.text) return next; return mk({ op: 'writestr', tape: s.tape, text: s.text || null, self: !!s.self, line: s.line, next }).id;
      case 'simulate': {
        checkTape(s.code, s.line); (s.on || []).forEach(n => checkTape(n, s.line)); usesCall.v = true;
        const ret = regMap.get('ret');
        if (s.time != null && !ret.domain.includes('timeout')) ret.domain.push('timeout');
        if (s.space != null && !ret.domain.includes('spaceout')) ret.domain.push('spaceout');
        const fn = raw => { if (raw == null) return null; try { return compileBudget(raw); } catch (e) { throw new TWError(e.message.replace(/^budget/, 'bound'), s.line); } };
        return mk({ op: 'simulate', code: s.code, on: s.on, time: s.time, space: s.space, timeFn: fn(s.time), spaceFn: fn(s.space), line: s.line, next }).id;
      }
      case 'call': usesCall.v = true; return mk({ op: 'call', name: s.name, socket: prog.sockets.includes(s.name), line: s.line, next }).id;
      case 'choose': {
        const targets = s.blocks.map(b => compileList(b, next));
        return mk({ op: 'choose', q: s.q || null, targets, labels: s.blocks.map((_, i) => String(i + 1)), line: s.line }).id;
      }
      case 'guess': {
        const r = regMap.get(s.reg); if (!r) throw new TWError(`unknown register "${s.reg}"`, s.line);
        if (r.builtin) throw new TWError('cannot guess "ret"', s.line);
        const targets = r.domain.map(v => mk({ op: 'assign', reg: s.reg, expr: { k: 'lit', v }, guessed: true, line: s.line, next }).id);
        return mk({ op: 'choose', q: s.q || null, guess: s.reg, targets, labels: r.domain.slice(), line: s.line }).id;
      }
      case 'halt': return mk({ op: 'halt', acc: s.acc, line: s.line }).id;
    }
  }
  const entry = compileList(prog.body, endNode.id);
  // dialect check
  if (prog.dialect === 'dfa') {
    if (prog.tapes.length !== 1) throw new TWError('a dfa machine has exactly one tape');
    const t = prog.tapes[0];
    if (!t.alphabet) throw new TWError('a dfa tape needs an alphabet, e.g. tape in : {0,1} readonly oneway', t.line);
    t.readonly = true; t.oneway = true;
    for (const n of nodes) {
      if (n.op === 'write' || n.op === 'writestr' || n.op === 'push' || n.op === 'pop' || n.op === 'send') throw new TWError('dfa machines cannot write', n.line);
      if (n.op === 'simulate') throw new TWError('dfa machines cannot simulate other machines', n.line);
      if (n.op === 'seek') throw new TWError('dfa machines cannot seek', n.line);
      if (n.op === 'call') throw new TWError('dfa machines cannot call other machines', n.line);
      if (n.op === 'choose') throw new TWError('dfa machines are deterministic (use an NFA for guessing)', n.line);
      if (n.op === 'move' && n.dir === 'L') throw new TWError('dfa heads only move right', n.line);
    }
    const walk = c => { if (!c) return; if (c.k === 'atstart') throw new TWError('atstart is not allowed in dfa machines', c.line); walk(c.a); walk(c.b); };
    nodes.forEach(n => n.op === 'branch' && walk(n.cond));
  }
  const regs = [...regMap.values()];
  let product = nodes.length;
  for (const r of regs) if (!r.builtin || usesCall.v) product *= r.domain.length;
  return {
    kind: 'prog', name: prog.name, dialect: prog.dialect, sockets: prog.sockets, nondet: nodes.some(n => n.op === 'choose'),
    ports: prog.tapes.map(t => ({ name: t.name, readonly: t.readonly, oneway: t.oneway, output: !!t.output, alphabet: t.alphabet })),
    regs, nodes, entry, productStates: product,
  };
}

// ---------- Table formats ----------
function splitList(s) { return s.split(/[\s,]+/).filter(Boolean); }

function compileAutomaton(src, kind) {
  const lines = src.split('\n');
  let start = null; const accept = new Set(); const delta = {}; const states = []; const alphabet = new Set();
  const addState = s => { if (!states.includes(s)) states.push(s); };
  lines.forEach((raw, idx) => {
    const line = idx + 1; const l = raw.replace(/#.*$/, '').replace(/\/\/.*$/, '').trim();
    if (!l) return;
    let m;
    if ((m = l.match(/^start\s*:\s*(\S+)$/))) { start = m[1]; addState(start); return; }
    if ((m = l.match(/^accept\s*:\s*(.*)$/))) { splitList(m[1]).forEach(s => { accept.add(s); addState(s); }); return; }
    if ((m = l.match(/^alphabet\s*:\s*(.*)$/))) { splitList(m[1]).forEach(a => alphabet.add(a)); return; }
    const arrow = l.split('->');
    if (arrow.length !== 2) throw new TWError('expected "state, symbol -> state"', line);
    const left = arrow[0].trim(); const ci = left.indexOf(',');
    if (ci < 0) throw new TWError('expected "state, symbol -> state"', line);
    const from = left.slice(0, ci).trim(); const syms = splitList(left.slice(ci + 1));
    const tos = splitList(arrow[1]);
    if (!from || !syms.length || !tos.length) throw new TWError('expected "state, symbol -> state"', line);
    if (kind === 'dfa' && tos.length !== 1) throw new TWError('a DFA transition goes to exactly one state', line);
    addState(from); tos.forEach(addState);
    delta[from] = delta[from] || {};
    for (let s of syms) {
      if (s === 'ε') s = 'eps';
      if (s !== 'eps' && s.length !== 1) throw new TWError(`symbol "${s}" must be one character`, line);
      if (s === 'eps' && kind === 'dfa') throw new TWError('DFAs have no eps moves (use an NFA)', line);
      if (s === BLANK) throw new TWError('"_" is the end-of-input blank and cannot label a transition', line);
      if (s !== 'eps') alphabet.add(s);
      if (kind === 'dfa') {
        if (delta[from][s] && delta[from][s] !== tos[0]) throw new TWError(`two transitions from ${from} on ${s}`, line);
        delta[from][s] = tos[0];
      } else {
        delta[from][s] = [...new Set([...(delta[from][s] || []), ...tos])];
      }
    }
  });
  if (!start) throw new TWError('missing "start: <state>"');
  return { kind, start, accept, delta, states, alphabet: [...alphabet], ports: [{ name: 'in', readonly: true, oneway: true }] };
}

function compileTM(src) {
  const lines = src.split('\n');
  let tapes = null, start = null, accept = null, reject = null; const rules = []; const states = [];
  const addState = s => { if (!states.includes(s)) states.push(s); };
  let nondet = false; const universal = new Set(), existential = new Set(), sockets = [], calls = {};
  lines.forEach((raw, idx) => {
    const line = idx + 1; const l = raw.replace(/#.*$/, '').replace(/\/\/.*$/, '').trim();
    if (!l) return; let m;
    if ((m = l.match(/^tapes\s*:\s*(.*)$/))) {
      tapes = m[1].split(',').map(x => x.trim()).filter(Boolean).map(x => {
        const [name, ...mods] = x.split(/\s+/);
        return { name, readonly: mods.includes('readonly'), oneway: mods.includes('oneway') || mods.includes('output'), output: mods.includes('output') };
      });
      return;
    }
    if ((m = l.match(/^start\s*:\s*(\S+)$/))) { start = m[1]; addState(start); return; }
    if ((m = l.match(/^accept\s*:\s*(\S+)$/))) { accept = m[1]; addState(accept); return; }
    if ((m = l.match(/^reject\s*:\s*(\S+)$/))) { reject = m[1]; addState(reject); return; }
    if (/^nondeterministic(\s*:\s*yes)?$/.test(l)) { nondet = true; return; }
    if ((m = l.match(/^(exists|forall)\s*:\s*(.*)$/))) { nondet = true; for (const q of splitList(m[2])) { (m[1] === 'exists' ? existential : universal).add(q); addState(q); } return; }
    if ((m = l.match(/^oracle\s*:\s*(.*)$/))) { for (const q of splitList(m[1])) { if (!/^[A-Za-z_]\w*$/.test(q)) throw new TWError(`bad oracle name "${q}"`, line); if (!sockets.includes(q)) sockets.push(q); } return; }
    if (/^call\b/.test(l)) {
      m = l.match(/^call\s*:\s*(\S+)\s+([A-Za-z_]\w*)\s*->\s*([^,\s]+)\s*,?\s*([^,\s]+)$/);
      if (!m) throw new TWError('expected "call: qask Machine -> qyes, qno"', line);
      if (calls[m[1]]) throw new TWError(`state ${m[1]} already makes a call`, line);
      calls[m[1]] = { name: m[2], yes: m[3], no: m[4], line }; addState(m[1]); addState(m[3]); addState(m[4]); return;
    }
    if (!tapes) throw new TWError('declare "tapes: name, ..." before transitions', line);
    const arrow = l.split('->');
    if (arrow.length !== 2) throw new TWError('expected "state, reads -> state, writes, moves"', line);
    const L = arrow[0].split(','), R = arrow[1].split(',');
    if (L.length !== 2 || R.length !== 3) throw new TWError('expected "state, reads -> state, writes, moves"', line);
    const from = L[0].trim(), reads = splitList(L[1]), to = R[0].trim(), writes = splitList(R[1]), moves = splitList(R[2]);
    const k = tapes.length;
    if (reads.length !== k || writes.length !== k || moves.length !== k) throw new TWError(`need ${k} read, write and move entries (one per tape)`, line);
    for (const s of [...reads, ...writes]) if (s.length !== 1) throw new TWError(`symbol "${s}" must be one character`, line);
    for (const mv of moves) if (!['L', 'R', 'S'].includes(mv)) throw new TWError('moves must be L, R or S', line);
    addState(from); addState(to);
    rules.push({ from, reads, to, writes, moves, line });
  });
  if (!tapes || !tapes.length) throw new TWError('missing "tapes: ..." line');
  if (!start) throw new TWError('missing "start: <state>"');
  for (const q of universal) if (existential.has(q)) throw new TWError(`state ${q} cannot be both exists and forall`);
  for (const [q, cl] of Object.entries(calls)) { cl.socket = sockets.includes(cl.name); if (rules.some(r => r.from === q)) throw new TWError(`state ${q} makes a call, so it cannot also have transitions`, cl.line); }
  return { kind: 'tm', ports: tapes, start, accept, reject, rules, states, nondet, universal, existential, sockets, calls };
}

// ---------- pushdown automata ----------
// state, input, pop -> state, push   (eps for "nothing"; push lists symbols top first)
function pdaLabel(r) { return `${r.input === 'eps' ? 'ε' : r.input}, ${r.pop === 'eps' ? 'ε' : r.pop} → ${r.push.length ? r.push.join('') : 'ε'} (${r.to})`; }
function compilePDA(src) {
  let start = null, byEmpty = false; const accept = new Set(), rules = [], states = [], alphabet = new Set(), stackAlpha = new Set();
  const addState = s => { if (!states.includes(s)) states.push(s); };
  const sym = (s, what, line) => { if (s === 'ε') s = 'eps'; if (s !== 'eps' && s.length !== 1) throw new TWError(`${what} "${s}" must be one character or eps`, line); if (s === BLANK) throw new TWError(`use eps, not _, for "nothing"`, line); return s; };
  src.split('\n').forEach((raw, idx) => {
    const line = idx + 1; const l = raw.replace(/#.*$/, '').replace(/\/\/.*$/, '').trim(); if (!l) return; let m;
    if ((m = l.match(/^start\s*:\s*(\S+)$/))) { start = m[1]; addState(start); return; }
    if ((m = l.match(/^accept\s*:\s*(.*)$/))) { splitList(m[1]).forEach(s => { accept.add(s); addState(s); }); return; }
    if (/^accept\s+by\s+empty\s+stack$/.test(l)) { byEmpty = true; return; }
    if ((m = l.match(/^alphabet\s*:\s*(.*)$/))) { splitList(m[1]).forEach(a => alphabet.add(a)); return; }
    if ((m = l.match(/^stack\s*:\s*(.*)$/))) { splitList(m[1]).forEach(a => stackAlpha.add(a)); return; }
    const arrow = l.split('->');
    if (arrow.length !== 2) throw new TWError('expected "state, input, pop -> state, push"', line);
    const L = arrow[0].split(',').map(x => x.trim()), R = arrow[1].split(',').map(x => x.trim());
    if (L.length !== 3 || R.length !== 2 || !L[0] || !R[0]) throw new TWError('expected "state, input, pop -> state, push"', line);
    const input = sym(L[1], 'input symbol', line), pop = sym(L[2], 'stack symbol', line);
    const pushRaw = R[1] === 'eps' || R[1] === 'ε' ? '' : R[1].replace(/\s+/g, '');
    if (pushRaw.includes(BLANK)) throw new TWError('cannot push _', line);
    addState(L[0]); addState(R[0]);
    if (input !== 'eps') alphabet.add(input);
    rules.push({ from: L[0], input, pop, to: R[0], push: [...pushRaw], line });
  });
  if (!start) throw new TWError('missing "start: <state>"');
  if (!byEmpty && !accept.size) throw new TWError('missing "accept: <states>" (or "accept by empty stack")');
  const ov = (x, y) => x === 'eps' || y === 'eps' || x === y;
  const nondet = rules.some((r, i) => rules.some((s, j) => j > i && r.from === s.from && ov(r.input, s.input) && ov(r.pop, s.pop)));
  return { kind: 'pda', ports: [{ name: 'in', readonly: true, oneway: true }, { name: 'stack', readonly: false, oneway: false, stack: true }], start, accept, byEmpty, rules, states, alphabet, nondet };
}

// ---------- script machines (free-form JS, uncertified) ----------
function compileScript(src) {
  const m = src.match(/^\s*(?:\/\/[^\n]*\n\s*)*script\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}\s*$/);
  if (!m) throw new TWError('expected: script Name(port1, port2) { ...JavaScript... }');
  const ports = m[2].split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const [name, ...mods] = s.split(/\s+/);
    if (!/^[A-Za-z_]\w*$/.test(name)) throw new TWError(`bad port name "${name}"`);
    return { name, readonly: mods.includes('readonly'), oneway: false, output: mods.includes('output') };
  });
  let fn;
  try { fn = new Function('io', '"use strict";\n' + m[3]); } catch (e) { throw new TWError('JavaScript error: ' + e.message); }
  return { kind: 'script', name: m[1], ports, fn };
}

// ---------- circuits ----------
const GATE_OPS = { AND: [1, 99], OR: [1, 99], XOR: [1, 99], NAND: [1, 99], NOR: [1, 99], XNOR: [1, 99], NOT: [1, 1], BUF: [1, 1] };
function evalGate(op, xs) {
  switch (op) {
    case 'AND': return xs.every(Boolean) ? 1 : 0;
    case 'OR': return xs.some(Boolean) ? 1 : 0;
    case 'XOR': return xs.reduce((a, b) => a ^ b, 0);
    case 'NAND': return xs.every(Boolean) ? 0 : 1;
    case 'NOR': return xs.some(Boolean) ? 0 : 1;
    case 'XNOR': return xs.reduce((a, b) => a ^ b, 0) ^ 1;
    case 'NOT': return xs[0] ^ 1;
    case 'BUF': return xs[0];
    case 'CONST': return xs[0];
  }
}
// postfix: v = next input, 0/1 constants, & | ^ binary, ! not, d dup, s swap
function parsePostfix(text) {
  const gates = []; const stack = []; let nIn = 0;
  const OPS = { '&': 'AND', '|': 'OR', '^': 'XOR' };
  for (const ch of text) {
    if (ch === 'v') { stack.push({ in: nIn++ }); }
    else if (ch === '0' || ch === '1') { gates.push({ op: 'CONST', args: [{ const: +ch }], label: ch }); stack.push({ gate: gates.length - 1 }); }
    else if (OPS[ch]) { if (stack.length < 2) throw new Error(`"${ch}" needs two operands`); const b = stack.pop(), a = stack.pop(); gates.push({ op: OPS[ch], args: [a, b] }); stack.push({ gate: gates.length - 1 }); }
    else if (ch === '!') { if (!stack.length) throw new Error('"!" needs an operand'); gates.push({ op: 'NOT', args: [stack.pop()] }); stack.push({ gate: gates.length - 1 }); }
    else if (ch === 'd') { if (!stack.length) throw new Error('"d" needs an operand'); stack.push(stack[stack.length - 1]); }
    else if (ch === 's') { if (stack.length < 2) throw new Error('"s" needs two operands'); const b = stack.pop(), a = stack.pop(); stack.push(b, a); }
    else if (/\s|_|;/.test(ch)) continue;
    else throw new Error(`unknown symbol "${ch}" in circuit description`);
  }
  if (stack.length !== 1) throw new Error(`description leaves ${stack.length} values on the stack (expected 1)`);
  const top = stack[0];
  if (top.in != null) { gates.push({ op: 'BUF', args: [top] }); }
  else if (top.const != null) { gates.push({ op: 'CONST', args: [top] }); }
  else if (top.gate !== gates.length - 1) { gates.push({ op: 'BUF', args: [top] }); }
  return finishCircuit(gates, nIn, gates.length - 1);
}
function finishCircuit(gates, nIn, out) {
  const depth = []; gates.forEach((g, i) => { depth[i] = 1 + Math.max(0, ...g.args.map(a => a.gate != null ? depth[a.gate] : 0)); g.depth = depth[i]; g.label = g.label || g.name || g.op; });
  const D = gates.length ? Math.max(...depth) : 0;
  const layers = []; for (let d = 1; d <= D; d++) layers.push(gates.map((g, i) => g.depth === d ? i : -1).filter(i => i >= 0));
  const real = gates.filter(g => g.op !== 'BUF' && g.op !== 'CONST');
  return { gates, nIn, out, layers, size: real.length, depth: gates.length ? depth[out] : 0, fanin: Math.max(0, ...real.map(g => g.args.length)) };
}
function evalCircuit(C, bits) {
  const v = [];
  C.gates.forEach((g, i) => { v[i] = evalGate(g.op, g.args.map(a => a.in != null ? bits[a.in] : a.const != null ? a.const : v[a.gate])); });
  return v[C.out];
}
function compileCircuit(src) {
  let name = 'Circuit', fromTape = null, outPort = null; const gates = []; const names = new Map(); let nIn = 0, outName = null;
  src.split('\n').forEach((raw, idx) => {
    const line = idx + 1; const l = raw.replace(/#.*$/, '').replace(/\/\/.*$/, '').trim(); if (!l) return; let m;
    if ((m = l.match(/^circuit\s+([A-Za-z_]\w*)$/))) { name = m[1]; return; }
    if ((m = l.match(/^gates\s+from\s+([A-Za-z_]\w*)$/))) { fromTape = m[1]; return; }
    if ((m = l.match(/^output\s+to\s+([A-Za-z_]\w*)$/))) { outPort = m[1]; return; }
    if ((m = l.match(/^output\s+([A-Za-z_]\w*)$/))) { outName = m[1]; return; }
    if ((m = l.match(/^([A-Za-z_]\w*)\s*=\s*([A-Za-z]+)\s+(.+)$/))) {
      const [, gname, opRaw, argStr] = m; const op = opRaw.toUpperCase();
      if (!GATE_OPS[op]) throw new TWError(`unknown gate "${opRaw}" (use AND, OR, XOR, NAND, NOR, XNOR, NOT)`, line);
      if (/^x\d+$/.test(gname)) throw new TWError(`"${gname}" is an input name`, line);
      if (names.has(gname)) throw new TWError(`gate "${gname}" defined twice`, line);
      const args = argStr.split(/[\s,]+/).filter(Boolean).map(a => {
        if (/^x\d+$/.test(a)) { const i = +a.slice(1); nIn = Math.max(nIn, i + 1); return { in: i }; }
        if (a === '0' || a === '1') return { const: +a };
        if (!names.has(a)) throw new TWError(`"${a}" is not an input (x0, x1, …) or an earlier gate`, line);
        return { gate: names.get(a) };
      });
      const [lo, hi] = GATE_OPS[op];
      if (args.length < lo || args.length > hi) throw new TWError(`${op} takes ${lo === hi ? lo : 'at least ' + lo} argument${lo === 1 && hi === 1 ? '' : 's'}`, line);
      gates.push({ op, args, name: gname }); names.set(gname, gates.length - 1); return;
    }
    throw new TWError('expected "name = OP args", "output name", "gates from <port>" or "output to <port>"', line);
  });
  const ports = [{ name: 'in', readonly: true, oneway: false }];
  if (fromTape) { if (fromTape === 'in') throw new TWError('the description tape needs its own port name'); ports.push({ name: fromTape, readonly: true, oneway: false }); }
  if (outPort) ports.push({ name: outPort, readonly: false, oneway: false });
  let circ = null;
  if (!fromTape) {
    if (!gates.length) throw new TWError('the circuit has no gates (or add "gates from <port>")');
    const out = outName ? names.get(outName) : (names.has('out') ? names.get('out') : gates.length - 1);
    if (out == null) throw new TWError(`no gate called "${outName}"`);
    circ = finishCircuit(gates, nIn, out);
  } else if (gates.length) throw new TWError('a circuit reads its gates either from a tape or from this text, not both');
  return { kind: 'circuit', name, ports, circ, fromTape, outPort };
}

function compileMachine(m) {
  try {
    let c;
    if (m.kind === 'prog') { c = compileProgram(m.src); m.name = c.name; }
    else if (m.kind === 'script') { c = compileScript(m.src); m.name = c.name; }
    else if (m.kind === 'circuit') { c = compileCircuit(m.src); m.name = c.name; }
    else if (m.kind === 'tm') c = compileTM(m.src);
    else if (m.kind === 'pda') c = compilePDA(m.src);
    else if (m.kind === 'regex') { c = compileRegex(m.src); m.name = c.name; }
    else if (m.kind === 'cfg') { c = compileGrammar(m.src); m.name = c.name; }
    else c = compileAutomaton(m.src, m.kind);
    m.compiled = c; m.error = null;
  } catch (e) { m.compiled = null; m.error = e.message; }
  try { m.timeFn = compileBudget(m.budgetTime); m.spaceFn = compileBudget(m.budgetSpace); m.sizeFn = compileBudget(m.budgetSize); m.depthFn = compileBudget(m.budgetDepth); m.randFn = compileBudget(m.budgetRand); m.queryFn = compileBudget(m.budgetQuery); }
  catch (e) { m.timeFn = m.spaceFn = m.sizeFn = m.depthFn = m.randFn = m.queryFn = null; m.error = m.error || e.message; }
  return m;
}

function epsClosure(c, set) {
  const out = new Set(set); const stack = [...set];
  while (stack.length) { const q = stack.pop(); for (const r of (c.delta[q] && c.delta[q].eps) || []) if (!out.has(r)) { out.add(r); stack.push(r); } }
  return [...out];
}

// ---------- Machines as data ----------
// ⟨M⟩: the source with comments and indentation removed, one tape cell per character.
// Spaces become ·, line breaks ¶, and _ becomes ␣ (a _ cell would be blank). Strings and
// quoted symbols are kept as written. Table machines (tm, dfa, nfa) start with a "kind Name" line.
const ENC = { ' ': '·', '\n': '¶', '_': '␣' }, DEC = { '·': ' ', '¶': '\n', '␣': '_' };
function stripComments(line, prog) {
  if (!prog) return line.replace(/#.*$/, '').replace(/\/\/.*$/, '');
  let out = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && line[i + 2] === "'") { out += line.substr(i, 3); i += 2; continue; }
    if (c === '"') { const j = line.indexOf('"', i + 1); if (j < 0) return out + line.slice(i); out += line.slice(i, j + 1); i = j; continue; }
    if (c === '/' && line[i + 1] === '/') break;
    out += c;
  }
  return out;
}
function mapOutside(text, table) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { const j = text.indexOf('"', i + 1); if (j >= 0) { out += text.slice(i, j + 1); i = j; continue; } }
    if (c === "'" && text[i + 2] === "'") { const m = text[i + 1]; out += "'" + (table[m] && m !== ' ' && m !== '\n' ? table[m] : m) + "'"; i += 2; continue; }
    out += table[c] || c;
  }
  return out;
}
function encodeSource(kind, name, src) {
  if (kind === 'script') throw new Error('scripts are JavaScript, not machines, and have no description');
  const prog = kind === 'prog', lang = kind === 'regex' || kind === 'cfg';
  const lines = String(src).split('\n').map(l => (lang ? l.replace(/\/\/.*$/, '') : stripComments(l, prog)).trim().replace(/\s+/g, ' ')).filter(Boolean);
  if (kind === 'tm' || kind === 'dfa' || kind === 'nfa' || kind === 'pda') lines.unshift(kind + ' ' + name);
  return mapOutside(lines.join('\n'), ENC);
}
function encodeMachine(m) {
  if (m._encSrc !== m.src || m._encName !== m.name) { m._enc = encodeSource(m.kind, m.name, m.src); m._encSrc = m.src; m._encName = m.name; }
  return m._enc;
}
function decodeDescription(text) {
  const src = mapOutside(text, DEC);
  const first = src.split('\n')[0].trim(); let mm;
  if ((mm = first.match(/^(tm|dfa|nfa|pda) ([A-Za-z_]\w*)$/))) return { kind: mm[1], name: mm[2], src: src.split('\n').slice(1).join('\n') };
  if (/^machine\b/.test(first)) return { kind: 'prog', src };
  if (/^regex\s/.test(first)) return { kind: 'regex', src };
  if (/^grammar\s/.test(first)) return { kind: 'cfg', src };
  if (/^circuit\b/m.test(src)) return { kind: 'circuit', src };
  throw new Error('it should start with "machine", "circuit", "tm", "pda", "dfa" or "nfa"');
}
const GUESTS = new Map();
function guestFrom(text, world) {
  if (!text) return { error: 'the tape is empty' };
  let g = GUESTS.get(text);
  if (!g) {
    try {
      const d = decodeDescription(text);
      const m = compileMachine({ id: 'g' + GUESTS.size, guest: true, kind: d.kind, name: d.name || 'Guest', src: d.src, bind: {}, links: {}, role: 'normal', accMode: 'exists', altMode: 'E', color: 'm6' });
      g = m.compiled ? { m } : { error: m.error };
    } catch (e) { g = { error: e.message }; }
    if (GUESTS.size > 500) GUESTS.clear();
    GUESTS.set(text, g);
  }
  if (g.m) { // a described machine keeps the oracle wiring of the world machine with its name
    const twin = world.machines.find(x => x.name === g.m.name);
    g.m.links = twin ? (twin.links || {}) : {}; g.m.sim = twin ? twin.sim : undefined; g.m.color = twin ? twin.color : 'm6'; g.m.twin = twin ? twin.id : null;
  }
  return g;
}

// Σ_{t=1..T} ⌈log₂(t+1)⌉: the tape-movement overhead of a Hennie–Stearns style simulation
function logSum(T) {
  if (!isFinite(T)) return Infinity; let s = 0, k = 1, lo = 1;
  while (lo <= T) { const hi = Math.min(T, 2 * lo - 1); s += k * (hi - lo + 1); lo *= 2; k++; }
  return s;
}
function fmtBig(x) { return x === Infinity ? '∞' : x >= 1e9 ? x.toExponential(2).replace('e+', '·10^') : String(Math.round(x)); }

// advice: a table of lines "n: string", or a JavaScript function (n) => string
function adviceFn(src) {
  const s = String(src || '').trim(); if (!s) return () => '';
  if (/^(\(?\s*n\s*\)?\s*=>|function\b)/.test(s)) { const f = new Function('return (' + s + '\n)')(); return n => { const v = f(n); return v == null ? '' : String(v); }; }
  const map = new Map();
  for (const line of s.split('\n')) { const l = line.replace(/\/\/.*$/, '').trim(); if (!l) continue; const mm = l.match(/^(\d+)\s*:\s*(\S*)$/); if (!mm) throw new Error('advice lines look like "3: 101"; or write a function (n) => ...'); map.set(+mm[1], mm[2]); }
  return n => map.get(n) ?? '';
}

// ---------- Run ----------
function rngNext(r) {
  let a = r.s; a = (a + 0x6D2B79F5) | 0; r.s = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function tapeRuntime(spec, initOverride, seed) {
  const cells = new Map();
  const init = initOverride != null ? initOverride : (spec.init || '');
  if (spec.kind !== 'random') [...init].forEach((ch, i) => { if (ch !== BLANK && ch !== ' ') cells.set(i, ch); });
  else if (initOverride != null) [...initOverride].forEach((ch, i) => { if (ch === '0' || ch === '1') cells.set(i, ch); });   // a fixed coin sequence
  return { spec, cells, who: new Map(), queried: new Set(), maxRead: -1, rng: spec.kind === 'random' ? { s: ((spec.seed || 1) * 7919 + (seed || 0)) | 0 } : null, lastWrite: null };
}

class Run {
  constructor(world, targetId, opts = {}) {
    this.world = world; this.opts = opts;
    this.tapes = new Map();
    for (const t of world.tapes) this.tapes.set(t.id, tapeRuntime(t, opts.overrides && opts.overrides[t.id], opts.seed || 0));
    this.stack = []; this.status = 'running'; this.result = null; this.reason = '';
    this.steps = 0; this.log = []; this.persist = new Map(); this.seen = new Map(); this.history = []; this.lastActive = null; this.lastHalted = null;
    const m = world.machines.find(x => x.id === targetId);
    if (!m) { this.finish('reject', 'no machine selected to run'); return; }
    // advice tapes hold a(n), where n is the length of the run target's input
    const adv = world.tapes.filter(t => t.kind === 'advice');
    if (adv.length) {
      const p0 = m.compiled && m.compiled.ports[0]; const it = p0 && m.bind && this.tapes.get(m.bind[p0.name]);
      const n = it && it.spec.kind !== 'advice' ? this.inputLength(it) : 0;
      for (const t of adv) {
        const rt = this.tapes.get(t.id); rt.cells.clear(); let a;
        try { a = adviceFn(t.advice)(n); } catch (e) { this.logMsg(`advice on ${t.name}: ${e.message}`); a = ''; }
        const lim = t.adviceMax ? (() => { try { return Math.floor(compileBudget(t.adviceMax)(n)); } catch (e) { return null; } })() : null;
        if (lim != null && a.length > lim) { this.push(m, null); this.finish('reject', `the advice on ${t.name} for n = ${n} has ${a.length} symbols, more than its budget ${lim}`); return; }
        [...a].forEach((ch, i) => { if (ch !== BLANK) rt.cells.set(i, ch); });
        rt.adviceN = n;
      }
    }
    this.push(m, null);
  }
  // reads that matter for the budgets: distinct proof cells (queries) and coins
  note(p, i = p.head) {
    if (p.proof) { (p.q || (p.q = new Set())).add(i); p.rt.queried.add(i); }
    if (p.random) (p.coins || (p.coins = new Set())).add(i);
  }
  logMsg(s) { this.log.push({ step: this.steps, s }); if (this.log.length > 200) this.log.shift(); }
  read(rt, i) {
    if (rt.rng) { if (i > rt.maxRead) rt.maxRead = i; if (!rt.cells.has(i)) { if (i < 0) return BLANK; rt.cells.set(i, rngNext(rt.rng) < 0.5 ? '0' : '1'); } }
    return rt.cells.get(i) ?? BLANK;
  }
  inputLength(rt) { let n = 0; while (rt.cells.has(n)) n++; return n; }
  push(m, caller, binds) {
    if (!m.compiled) return this.failAct(null, `${m.name} has errors: ${m.error}`);
    if (this.stack.length >= 64) {
      // a regress of nested simulations: each level costs time, so the outermost bounded one would run out
      const i = this.stack.findIndex(a => a.simLimit != null);
      if (i >= 0) {
        const g = this.stack[i];
        for (const a of this.stack.slice(i + 1)) { a.status = 'reject'; a.reason = 'cut off with its simulator'; }
        this.stack.splice(i + 1); g.cost = this.steps - g.simStart;
        this.halt(g, 'timeout', 'simulations nested more than 64 deep, so its time bound would run out'); return null;
      }
      return this.failAct(caller, 'call depth limit (64) reached');
    }
    const c = m.compiled; const ports = {};
    for (const p of c.ports) {
      const b = binds && binds[p.name];
      const tid = b ? b.rt.spec.id : m.bind && m.bind[p.name];
      const rt = b ? b.rt : tid && this.tapes.get(tid);
      if (!rt) return this.failAct(caller, `${m.name}: tape port "${p.name}" is not connected to a tape`);
      const isRandom = rt.spec.kind === 'random'; const isStack = rt.spec.kind === 'stack' || !!p.stack;
      const key = m.id + ':' + p.name;
      let top = 0; if (isStack) for (const k of rt.cells.keys()) if (k > top) top = k;
      const isChan = rt.spec.kind === 'channel', hidden = isRandom && !rt.spec.public && m.role === 'prover';
      const isProof = rt.spec.kind === 'proof', fixed = (isProof && m.role !== 'prover') || rt.spec.kind === 'advice';   // the proof is fixed before the verifier runs
      ports[p.name] = { stack: isStack, channel: isChan, proof: isProof, hidden, rt, head: isRandom ? (this.persist.get(key) || 0) : isStack ? top : 0, readonly: p.readonly || isRandom || fixed || !!(b && b.readonly), oneway: p.oneway || isRandom || !!(b && b.oneway), output: !!p.output, random: isRandom, key, visited: new Set() };
    }
    const first = c.ports[0] && ports[c.ports[0].name];
    const n = first ? this.inputLength(first.rt) : 0;
    const unb = m.role === 'prover' || c.kind === 'circuit';
    const act = { m, c, ports, own: 0, cost: 0, n, timeLimit: !unb && m.timeFn ? Math.floor(m.timeFn(n)) : null, spaceLimit: !unb && m.spaceFn ? Math.floor(m.spaceFn(n)) : null, status: 'running', last: null };
    if (!unb && m.randFn) act.randLimit = Math.floor(m.randFn(n));
    if (!unb && m.queryFn) act.queryLimit = Math.floor(m.queryFn(n));
    for (const p of Object.values(ports)) if (!p.readonly) p.visited.add(p.head);
    if (c.kind === 'dfa') act.state = c.start;
    else if (c.kind === 'nfa') act.set = epsClosure(c, [c.start]);
    else if (c.kind === 'tm' || c.kind === 'pda') act.state = c.start;
    else if (c.kind === 'script') { act.pc = 0; }
    else if (c.kind === 'circuit') {
      act.k = 0; act.circ = c.circ;
      if (c.fromTape) {
        const p = ports[c.fromTape]; let s = '', i = 0; while (p.rt.cells.has(i)) s += p.rt.cells.get(i++);
        try { act.circ = parsePostfix(s); } catch (e) { act.circError = e.message; }
      }
      act.layer = 0;
      if (m.role !== 'prover') {
        act.sizeLimit = m.sizeFn ? Math.floor(m.sizeFn(n)) : null;
        act.depthLimit = m.depthFn ? Math.floor(m.depthFn(n)) : null;
        act.faninLimit = m.budgetFanin ? parseInt(m.budgetFanin, 10) : null;
      }
      if (act.circ) {
        act.vals = new Array(act.circ.gates.length).fill(null); act.xs = new Array(act.circ.nIn).fill(null);
        const C = act.circ;
        if (act.sizeLimit != null && C.size > act.sizeLimit) act.budgetFail = `size ${C.size} exceeds budget ${act.sizeLimit}`;
        else if (act.depthLimit != null && C.depth > act.depthLimit) act.budgetFail = `depth ${C.depth} exceeds budget ${act.depthLimit}`;
        else if (act.faninLimit != null && C.fanin > act.faninLimit) act.budgetFail = `fan-in ${C.fanin} exceeds budget ${act.faninLimit}`;
      }
    }
    else { act.pc = c.entry; act.regs = {}; for (const r of c.regs) act.regs[r.name] = r.init; }
    const nm = x => x.guest ? '⟨' + x.name + '⟩' : x.name;
    if (caller) { caller.status = 'waiting'; this.logMsg(m.guest ? `${nm(caller.m)} simulates ⟨${m.name}⟩ (n=${n})` : `${nm(caller.m)} calls ${m.name} (n=${n})`); }
    else this.logMsg(`start ${m.name} (n=${n})`);
    this.stack.push(act);
    return act;
  }
  failAct(act, reason) {
    if (!act) { this.finish('reject', reason); return null; }
    this.halt(act, 'reject', reason); return null;
  }
  // space counts cells visited on work tapes: read-only inputs and one-way output tapes are free
  space(act) { let s = act.extraSpace || 0; for (const p of Object.values(act.ports)) if (!p.readonly && !p.output && !p.channel) s += p.visited.size; return s; }
  finish(res, reason) { this.status = 'halted'; this.result = res; this.reason = reason || ''; }
  halt(act, res, reason) {
    const idx = this.stack.indexOf(act);
    this.stack.splice(idx);
    act.status = res; act.reason = reason || '';
    for (const p of Object.values(act.ports)) if (p.random) this.persist.set(p.key, p.head);
    this.lastHalted = act; this.seen.set(act.m.id, act); if (this.history.length < 5000) this.history.push(act);
    const who = act.m.guest ? '⟨' + act.m.name + '⟩' : act.m.name;
    this.logMsg(res === 'timeout' ? `${who} has not halted after ${act.cost} steps: the simulation is cut off` : res === 'spaceout' ? `${who} needs more than ${act.simSpace} cells: the simulation is cut off` : `${who} ${res === 'accept' ? 'accepts' : 'rejects'}${reason ? ' (' + reason + ')' : ''} after ${act.cost} steps, space ${this.space(act)}`);
    const caller = this.stack[this.stack.length - 1];
    if (!caller) { this.finish(res, reason); this.final = act; return; }
    caller.status = 'running';
    if (act.m.guest) for (const p of Object.values(act.ports)) { // a simulation's work cells are the simulator's work cells
      const cp = Object.values(caller.ports).find(q => q.rt === p.rt && !q.readonly && !q.output && !q.channel); if (cp) for (const v of p.visited) cp.visited.add(v);
    }
    if (caller.c.kind === 'tm') { const cl = caller.c.calls[caller.state]; const to = res === 'accept' ? cl.yes : cl.no; caller.last = { from: caller.state, to, call: true }; caller.state = to; }
    else { caller.regs.ret = res; caller.pc = caller.c.nodes[caller.pc].next; }
    if (act.m.oracle && act.m.role !== 'prover') this.charge(this.stack.length - 1, 1);
    if (act.m.guest) this.logMsg(`${caller.m.guest ? '⟨' + caller.m.name + '⟩' : caller.m.name} has paid ${fmtBig(caller.cost)} charged steps so far` + (caller.simLookup || caller.simTape || caller.simBound || caller.simLoop ? ` (simulation overhead: lookup ${fmtBig(caller.simLookup || 0)}, tape ${fmtBig(caller.simTape || 0)}, bound counting ${fmtBig(caller.simBound || 0)}${caller.simLoop ? ', loop counter ' + fmtBig(caller.simLoop) : ''})` : ''));
    this.checkBudget(caller);
  }
  queries(act) { let s = 0; for (const p of Object.values(act.ports)) if (p.q) s += p.q.size; return s; }
  coinsUsed(act) { let s = 0; for (const p of Object.values(act.ports)) if (p.coins) s += p.coins.size; return s; }
  checkBudget(act) {
    if (act.queryLimit != null && this.queries(act) > act.queryLimit) { this.halt(act, 'reject', `query budget ${act.queryLimit} exceeded`); return false; }
    if (act.randLimit != null && this.coinsUsed(act) > act.randLimit) { this.halt(act, 'reject', `random-bit budget ${act.randLimit} exceeded`); return false; }
    if (act.timeLimit != null && act.cost > act.timeLimit) { this.halt(act, 'reject', `time budget ${act.timeLimit} exceeded`); return false; }
    if (act.spaceLimit != null && this.space(act) > act.spaceLimit) { this.halt(act, 'reject', `space budget ${act.spaceLimit} exceeded`); return false; }
    return true;
  }
  doMove(act, port, dir) {
    if (dir === 'S') return;
    if (port.stack) throw new Error('a stack tape only allows push and pop');
    if (dir === 'L' && port.oneway) throw new Error('head is one-way and cannot move left');
    port.head += dir === 'R' ? 1 : -1;
    if (!port.readonly) port.visited.add(port.head);
  }
  doWrite(act, port, sym) {
    if (port.readonly) throw new Error('tape port is read-only');
    if (port.stack && !this._stackOp) throw new Error('a stack tape only allows push and pop');
    if (port.channel && !this._chanOp) throw new Error('a channel only allows send (it is append-only)');
    if (sym.length !== 1) throw new Error(`cannot write "${sym}" (symbols are one character)`);
    if (sym === BLANK) port.rt.cells.delete(port.head); else port.rt.cells.set(port.head, sym);
    port.rt.lastWrite = port.head; port.rt.lastWriteStep = this.steps;
  }
  // stack discipline: cells 0..head hold the stack, the head sits on the top symbol
  push1(act, p, sym) {
    if (!p.stack) throw new Error('push needs a tape of kind stack');
    if (sym === BLANK || sym.length !== 1) throw new Error(`cannot push "${sym}"`);
    this._stackOp = true;
    try { if (p.rt.cells.has(p.head)) { p.head++; p.visited.add(p.head); } this.doWrite(act, p, sym); } finally { this._stackOp = false; }
  }
  // channel: append one symbol at the end of the transcript, remembering who sent it
  send1(act, p, sym) {
    if (!p.channel) throw new Error('send needs a tape of kind channel');
    if (sym === BLANK || sym.length !== 1) throw new Error(`cannot send "${sym}"`);
    let len = 0; while (p.rt.cells.has(len)) len++;
    p.rt.cells.set(len, sym); p.rt.who.set(len, { c: act.m.color, n: act.m.name }); p.rt.lastWrite = len; p.rt.lastWriteStep = this.steps;
  }
  see(p) { if (p.hidden) throw new Error(`the coins on ${p.rt.spec.name} are private: a prover cannot see them (tick Public coins on that tape)`); return p; }
  pop1(act, p) {
    if (!p.stack) throw new Error('pop needs a tape of kind stack');
    if (!p.rt.cells.has(p.head)) throw new Error('pop on an empty stack');
    this._stackOp = true;
    try { this.doWrite(act, p, BLANK); } finally { this._stackOp = false; }
    if (p.head > 0) p.head--;
  }
  step() {
    if (this.status !== 'running') return;
    for (let i = 0; i < this.stack.length; i++) {
      const g = this.stack[i];
      // a machine waiting for a call is charged as the callee runs, so its time budget can run out mid-call
      if (i < this.stack.length - 1 && g.timeLimit != null && g.cost > g.timeLimit) {
        for (const a of this.stack.slice(i + 1)) { a.status = 'reject'; a.reason = 'cut off: its caller ran out of time'; }
        this.stack.splice(i + 1); this.halt(g, 'reject', `time budget ${g.timeLimit} exceeded`); return;
      }
      if (g.simLimit != null && g.cost >= g.simLimit) {
        for (const a of this.stack.slice(i + 1)) { a.status = 'reject'; a.reason = 'cut off with its simulator'; }
        this.stack.splice(i + 1);
        this.halt(g, 'timeout', `not halted within ${g.simLimit} steps`); return;
      }
      if (g.simSpace != null && this.space(g) > g.simSpace) {
        for (const a of this.stack.slice(i + 1)) { a.status = 'reject'; a.reason = 'cut off with its simulator'; }
        this.stack.splice(i + 1); this.halt(g, 'spaceout', `used more than ${g.simSpace} cells`); return;
      }
    }
    const act = this.stack[this.stack.length - 1];
    this.lastActive = act;
    this.steps++; act.own++; const paid = this.charge(this.stack.length - 1, 1);
    try {
      const r = this.exec(act);
      if (r && r.halt) { this.halt(act, r.halt, r.reason); return; }
      if (r && r.branch) { this.steps--; act.own--; for (const [a, d, f, v] of paid) { a.cost -= d; if (f) a[f] -= v; } this.status = 'branch'; this.branch = { k: r.branch, labels: r.labels, q: r.q, machine: act.m.name }; return; }
      if (r && r.simulate) { this.simulate(act, r.simulate); return; }
      if (r && r.call) {
        let callee;
        if (r.socket) {
          const id = act.m.links && act.m.links[r.call];
          callee = id && this.world.machines.find(x => x.id === id);
          if (!callee) { this.halt(act, 'reject', `oracle socket ${r.call} is not connected to a machine`); return; }
        } else callee = this.world.machines.find(x => x.name === r.call);
        if (!callee) { this.halt(act, 'reject', `no machine named ${r.call}`); return; }
        if (!this.checkBudget(act)) return;
        if (callee.oracle && machineNondet(this.world, callee)) {
          // an oracle answers yes/no: explore its computation tree on the side, return only the answer
          const sub = this.clone(); sub.stack = []; sub.status = 'running'; sub.final = null; sub.history = []; sub.log = [];
          const top = sub.push(callee, null);
          const res = top ? exploreRun(sub, { maxSteps: 200000, maxNodes: 4000, acc: accOf(callee) }) : { result: 'reject', leaves: 0 };
          const a2 = this.push(callee, act); if (!a2) return;
          a2.oracleTree = res;
          this.halt(a2, res.result === 'accept' ? 'accept' : 'reject', `answered as an oracle; its ${res.leaves}-branch tree was resolved separately`);
          return;
        }
        this.push(callee, act); return;
      }
      this.checkBudget(act);
      this.loopCheck();
    } catch (e) { this.halt(act, 'reject', 'error: ' + e.message); }
  }
  // Charged time flows down the stack as it is spent: a caller pays for its callee's steps
  // (an oracle costs 1 when it answers, a prover nothing), and a simulator pays for each step
  // of its guest's charged time with the overhead of its own cost model. So nested simulations
  // compound: the outer simulator pays its overhead on the inner one's overhead too.
  charge(i, delta) {
    const paid = [];
    while (delta > 0 && i >= 0) {
      const a = this.stack[i]; const before = a.cost; a.cost += delta; paid.push([a, delta]);
      if (i === 0) break;
      const host = this.stack[i - 1];
      if (a.m.guest) delta = this.overhead(host, a, before, delta, paid);
      else if (a.m.role === 'prover' || a.m.oracle) delta = 0;
      i--;
    }
    return paid;
  }
  overhead(host, g, before, delta, paid) {
    const s = host.m.sim || {}; let lookup = 0, tape = 0, bound = 0;
    if (s.model === 'multi') { lookup = delta * g.descLen; tape = logSum(before + delta) - logSum(before); }
    else if (s.model === 'single') { lookup = delta * g.descLen; tape = delta * (g.n + this.space(g)); }
    if (s.timeCheck && g.simLimit != null) bound += 2 * delta;    // decrement a binary step counter (amortized)
    if (s.spaceCheck && g.simSpace != null) bound += 2 * delta;   // advance the loop counter (amortized)
    const add = (f, v) => { if (v) { host[f] = (host[f] || 0) + v; paid.push([host, 0, f, v]); } };
    add('simLookup', lookup); add('simTape', tape); add('simBound', bound);
    return delta + lookup + tape + bound;
  }
  // configuration-repeat detection for space-bounded simulations: a repeat means the guest loops
  // forever; a real simulator would only notice when its loop counter overflows, so charge that
  loopCheck() {
    const g = this.stack[this.stack.length - 1]; if (!g || !g.m.guest || g.simSpace == null || !g.loopDetect) return;
    const parts = [g.pc, g.state, g.set && g.set.join(','), JSON.stringify(g.regs || null)];
    for (const [k, p] of Object.entries(g.ports)) {
      let cells = ''; if (!p.readonly) for (const v of [...p.visited].sort((x, y) => x - y)) cells += (p.rt.cells.get(v) ?? '_');
      parts.push(k + '@' + p.head + ':' + cells);
    }
    const key = parts.join('|');
    if (!g.cfgSeen.has(key)) { g.cfgSeen.add(key); return; }
    const i = this.stack.indexOf(g); const host = this.stack[i - 1];
    const left = Math.max(0, g.configs - g.cost);
    this.charge(i, left);
    host.simLoop = (host.simLoop || 0) + left;
    this.halt(g, 'timeout', `a configuration repeated, so it loops; a real simulator notices only after counting to ~${fmtBig(g.configs)} configurations`);
  }
  // ∃/∀ bookkeeping shared by programs and Turing machines: counts quantifier blocks
  quantCheck(act, q) {
    const nb = (act.altBlocks || 0) + (act.lastQ !== q ? 1 : 0);
    if (act.m.role !== 'prover' && (act.m.accMode || 'exists') === 'exists') {
      const lim = act.m.altBlocks ? parseInt(act.m.altBlocks, 10) : null; const start = act.m.altStart || '';
      if (start && !act.lastQ && q !== start) return { halt: 'reject', reason: `alternation budget: must start with ${start === 'E' ? '∃' : '∀'}` };
      if (lim != null && nb > lim) return { halt: 'reject', reason: `alternation budget: ${nb} quantifier blocks, at most ${lim} allowed` };
    }
    return { nb };
  }
  simulate(act, node) {
    const cp = act.ports[node.code]; let text = '';
    for (let i = 0; i < 100000; i++) { const ch = this.read(cp.rt, i); if (ch === BLANK) break; text += ch; }
    const fail = why => { this.logMsg(`${act.m.name}: ${why}, so the simulated machine rejects at once`); act.regs.ret = 'reject'; act.pc = act.c.nodes[act.pc].next; };
    const g = guestFrom(text, this.world);
    if (g.error) return fail(`the tape ${node.code} does not hold a machine description (${g.error})`);
    const gm = g.m, gp = gm.compiled.ports;
    if (gm.compiled.nondet || machineNondet(this.world, gm)) return fail(`⟨${gm.name}⟩ is nondeterministic, and simulate runs deterministic machines`);
    const names = Object.keys(act.ports); const binds = {};
    let pool = node.on ? node.on.slice() : names.filter(n => n !== node.code);
    for (let i = 0; i < gp.length; i++) {
      let use;
      if (node.on) use = pool[i];
      else { use = pool.includes(gp[i].name) ? gp[i].name : pool.find(n => !gp.some(q => q.name === n)); pool = pool.filter(n => n !== use); }
      if (!use) return fail(`⟨${gm.name}⟩ has ${gp.length} tape${gp.length === 1 ? '' : 's'} but ${act.m.name} passes ${node.on ? node.on.length : 'fewer'}`);
      const p = act.ports[use]; binds[gp[i].name] = { rt: p.rt, readonly: p.readonly, oneway: p.oneway };
    }
    const a2 = this.push(gm, act, binds); if (!a2) return;
    a2.text = text; a2.descLen = text.length;
    const s = act.m.sim || {}; const hi = this.stack.indexOf(act); let setup = 0;
    if (node.timeFn) {
      a2.simLimit = Math.max(1, Math.floor(node.timeFn(a2.n))); a2.simStart = this.steps;
      if (s.timeCheck) { const b = Math.ceil(Math.log2(a2.simLimit + 1)); setup += a2.n + b * b; act.extraSpace = Math.max(act.extraSpace || 0, b); }   // count n, compute f(n) in binary
    }
    if (node.spaceFn) {
      a2.simSpace = Math.max(0, Math.floor(node.spaceFn(a2.n)));
      // configurations: control states × head positions × tape contents
      const Q = gm.compiled.productStates || (gm.compiled.states ? gm.compiled.states.length : 1) || 1;
      const G = Math.max(2, 1 + new Set([...gm.compiled.ports.flatMap(p => p.alphabet || []), ...Object.values(binds).flatMap(b => [...(b.rt.spec.alphabet || '')])]).size);
      const lg = Math.log2(Q) + gm.compiled.ports.length * Math.log2(a2.n + a2.simSpace + 2) + a2.simSpace * Math.log2(G);
      a2.configs = lg > 1000 ? Infinity : Math.ceil(Math.pow(2, lg));
      if (s.spaceCheck) { const bits = Math.ceil(lg); setup += a2.simSpace; act.extraSpace = Math.max(act.extraSpace || 0, a2.simSpace + bits); }   // mark f(n) cells, keep a loop counter
      if (s.loopDetect) { a2.loopDetect = true; a2.cfgSeen = new Set(); }
    }
    if (setup) { this.charge(hi, setup); act.simBound = (act.simBound || 0) + setup; }
  }
  exec(act) {
    const c = act.c;
    if (c.kind === 'dfa' || c.kind === 'nfa') {
      const p = act.ports.in; const sym = this.read(p.rt, p.head);
      if (c.kind === 'dfa') {
        if (sym === BLANK) return { halt: c.accept.has(act.state) ? 'accept' : 'reject', reason: 'end of input' };
        const to = c.delta[act.state] && c.delta[act.state][sym];
        if (!to) return { halt: 'reject', reason: `no transition from ${act.state} on ${sym}` };
        act.last = { from: act.state, to, sym }; act.state = to; this.doMove(act, p, 'R'); return;
      }
      if (sym === BLANK) return { halt: act.set.some(q => c.accept.has(q)) ? 'accept' : 'reject', reason: 'end of input' };
      const nxt = new Set(); const edges = [];
      for (const q of act.set) for (const r of (c.delta[q] && c.delta[q][sym]) || []) { nxt.add(r); edges.push({ from: q, to: r }); }
      act.set = epsClosure(c, [...nxt]); act.last = { edges, sym };
      this.doMove(act, p, 'R');
      if (!act.set.length) return { halt: 'reject', reason: 'no active states left' };
      return;
    }
    if (c.kind === 'pda') {
      const ip = act.ports.in, sp = act.ports.stack;
      const sym = this.read(ip.rt, ip.head), top = this.read(sp.rt, sp.head);
      const end = sym === BLANK;
      if (end && (c.byEmpty ? top === BLANK : c.accept.has(act.state))) return { halt: 'accept', reason: c.byEmpty ? 'input read, stack empty' : 'input read, accepting state' };
      let opts = c.rules.filter(r => r.from === act.state && (r.input === 'eps' || r.input === sym) && (r.pop === 'eps' || r.pop === top));
      if (c.prune && opts.length) { // a grammar: drop expansions whose stack needs more symbols than the input has left
        let nn = 0; for (let i = 0; i <= sp.head; i++) { const x = sp.rt.cells.get(i); if (x !== undefined && c.prune.has(x)) nn++; }
        let rem = 0; while (ip.rt.cells.has(ip.head + rem)) rem++;
        const fits = opts.filter(r => nn - (r.pop !== 'eps' && c.prune.has(r.pop) ? 1 : 0) + r.push.filter(x => c.prune.has(x)).length <= rem - (r.input === 'eps' ? 0 : 1));
        if (!fits.length) return { halt: 'reject', reason: 'no derivation fits the input that is left' };
        opts = fits;
      }
      if (!opts.length) return { halt: 'reject', reason: end ? `input read, ${c.byEmpty ? 'stack not empty' : 'not in an accepting state'}` : `no rule for ${act.state} reading ${sym} with ${top === BLANK ? 'an empty stack' : top + ' on top'}` };
      let rule = opts[0];
      if (opts.length > 1) {
        const q = act.m.altMode || 'E';
        const chk = this.quantCheck(act, q); if (chk.halt) return chk;
        if (this.force == null) return { branch: opts.length, labels: opts.map(r => r.prod || pdaLabel(r)), q };
        const i = this.force; this.force = null; act.altBlocks = chk.nb; act.lastQ = q; rule = opts[i];
        this.logMsg(`${act.m.name} ${q === 'A' ? '∀' : '∃'} in ${act.state}: ${rule.prod || pdaLabel(rule)}`);
      }
      if (rule.pop !== 'eps') this.pop1(act, sp);
      for (let k = rule.push.length - 1; k >= 0; k--) this.push1(act, sp, rule.push[k]);
      if (rule.input !== 'eps') this.doMove(act, ip, 'R');
      act.last = { from: act.state, to: rule.to, rule }; act.state = rule.to;
      return;
    }
    if (c.kind === 'tm') {
      if (act.state === c.accept) return { halt: 'accept' };
      if (act.state === c.reject) return { halt: 'reject' };
      const names = c.ports.map(p => p.name);
      const syms = names.map(n => { const p = this.see(act.ports[n]); this.note(p); return this.read(p.rt, p.head); });
      const cl = c.calls && c.calls[act.state];
      if (cl) return { call: cl.name, socket: cl.socket };
      const match = r => r.from === act.state && r.reads.every((s, i) => s === '*' || s === syms[i]);
      let rule;
      if (c.nondet) {
        const opts = c.rules.filter(match);
        if (!opts.length) return { halt: 'reject', reason: `no rule for ${act.state} reading ${syms.join(' ')}` };
        if (opts.length === 1) rule = opts[0];
        else {
          const q = c.universal.has(act.state) ? 'A' : c.existential.has(act.state) ? 'E' : (act.m.altMode || 'E');
          const chk = this.quantCheck(act, q); if (chk.halt) return chk;
          if (this.force == null) return { branch: opts.length, labels: opts.map(r => `${r.to}: ${r.writes.join('')},${r.moves.join('')}`), q };
          const i = this.force; this.force = null; act.altBlocks = chk.nb; act.lastQ = q; rule = opts[i];
          this.logMsg(`${act.m.name} ${q === 'A' ? '∀' : '∃'} in ${act.state}: rule ${i + 1} of ${opts.length} (→ ${rule.to})`);
        }
      } else rule = c.rules.find(match);
      if (!rule) return { halt: 'reject', reason: `no rule for ${act.state} reading ${syms.join(' ')}` };
      names.forEach((n, i) => { const w = rule.writes[i]; if (w !== '*' && w !== syms[i]) this.doWrite(act, act.ports[n], w); });
      names.forEach((n, i) => this.doMove(act, act.ports[n], rule.moves[i]));
      act.last = { rule, from: act.state, to: rule.to }; act.state = rule.to;
      if (act.state === c.accept) return { halt: 'accept' };
      if (act.state === c.reject) return { halt: 'reject' };
      return;
    }
    if (c.kind === 'script') {
      const io = this.scriptIO(act); let out;
      try { out = c.fn(io); } catch (e) { return { halt: 'reject', reason: 'script error: ' + e.message }; }
      const acc = out === true || out === 'accept' || out === 1;
      return { halt: acc ? 'accept' : 'reject', reason: 'script' };
    }
    if (c.kind === 'circuit') {
      if (!act.circ) return { halt: 'reject', reason: 'bad circuit description: ' + (act.circError || 'missing') };
      if (act.budgetFail) return { halt: 'reject', reason: act.budgetFail };
      const C = act.circ; const inp = act.ports.in;
      if (act.layer < C.layers.length) {
        const L = C.layers[act.layer];
        for (const gi of L) {
          const g = C.gates[gi]; const xs = [];
          for (const a of g.args) {
            if (a.in != null) {
              const s = this.read(inp.rt, a.in); inp.head = a.in;
              if (s !== '0' && s !== '1') return { halt: 'reject', reason: `input bit x${a.in} is "${s}", expected 0 or 1` };
              act.xs[a.in] = +s; xs.push(+s);
            } else if (a.const != null) xs.push(a.const); else xs.push(act.vals[a.gate]);
          }
          act.vals[gi] = evalGate(g.op, xs);
        }
        act.layer++; act.k += L.length; act.last = { layer: act.layer };
        return;
      }
      const v = act.vals[C.out];
      if (c.outPort) { const p = act.ports[c.outPort]; p.head = 0; this.doWrite(act, p, String(v)); }
      return { halt: v ? 'accept' : 'reject', reason: `output ${v}` };
    }
    // program
    const node = c.nodes[act.pc]; act.last = { from: act.pc };
    const val = e => {
      if (e.k === 'read') { const p = this.see(act.ports[e.tape]); this.note(p); return this.read(p.rt, p.head); }
      if (e.k === 'reg') return act.regs[e.name];
      return e.v;
    };
    const cond = k => {
      switch (k.k) {
        case 'or': return cond(k.a) || cond(k.b);
        case 'and': return cond(k.a) && cond(k.b);
        case 'not': return !cond(k.a);
        case 'atstart': return act.ports[k.tape].head === 0;
        case 'cmp': {
          const a = val(k.a), b = val(k.b);
          if (k.op === '==') return String(a) === String(b);
          if (k.op === '!=') return String(a) !== String(b);
          const x = Number(a), y = Number(b);
          if (isNaN(x) || isNaN(y)) throw new Error(`cannot compare ${a} ${k.op} ${b}`);
          return k.op === '<' ? x < y : k.op === '>' ? x > y : k.op === '<=' ? x <= y : x >= y;
        }
      }
    };
    const regDef = n => c.regs.find(r => r.name === n);
    switch (node.op) {
      case 'halt': return { halt: node.acc ? 'accept' : 'reject', reason: node.implicit ? 'reached end of program' : '' };
      case 'branch': { const b = cond(node.cond); act.pc = b ? node.t : node.f; act.last.to = act.pc; return; }
      case 'write': this.doWrite(act, act.ports[node.tape], String(val(node.expr))); break;
      case 'move': this.doMove(act, act.ports[node.tape], node.dir); break;
      case 'assign': {
        const v = String(val(node.expr)); const r = regDef(node.reg);
        if (!r.domain.includes(v)) throw new Error(`value "${v}" is outside register ${node.reg} {${r.domain.join(',')}}`);
        act.regs[node.reg] = v; break;
      }
      case 'inc': case 'dec': {
        const r = regDef(node.reg); const v = String(Number(act.regs[node.reg]) + (node.op === 'inc' ? 1 : -1));
        if (!r.domain.includes(v)) throw new Error(`register ${node.reg} overflowed its range`);
        act.regs[node.reg] = v; break;
      }
      case 'call': return { call: node.name, socket: node.socket };
      case 'simulate': return { simulate: node };
      case 'push': this.push1(act, act.ports[node.tape], String(val(node.expr))); break;
      case 'pop': this.pop1(act, act.ports[node.tape]); break;
      case 'seek': {
        const p = act.ports[node.tape]; if (!p.proof) throw new Error('seek needs a tape of kind proof');
        let i;
        if (node.addr.k === 'tape') { const ap = act.ports[node.addr.name]; let s = ''; for (let j = 0; j < 64; j++) { const ch = this.read(ap.rt, j); if (ch !== '0' && ch !== '1') break; s += ch; } i = s ? parseInt(s, 2) : 0; }
        else { i = parseInt(val(node.addr), 10); if (isNaN(i)) throw new Error(`seek needs a number, not "${val(node.addr)}"`); }
        p.head = i; break;
      }
      case 'send': this.send1(act, act.ports[node.tape], String(val(node.expr))); break;
      case 'writestr': {
        const text = node.self ? encodeMachine(act.m) : node.text; const p = act.ports[node.tape];
        const i = act.wsi || 0; this.doWrite(act, p, text[i]); this.doMove(act, p, 'R');
        if (i + 1 < text.length) { act.wsi = i + 1; act.last.to = act.pc; return; }
        act.wsi = 0; break;
      }
      case 'choose': {
        const q = node.q || act.m.altMode || 'E';
        const chk = this.quantCheck(act, q); if (chk.halt) return chk; const nb = chk.nb;
        if (this.force == null) return { branch: node.targets.length, labels: node.labels, q };
        const i = this.force; this.force = null; act.altBlocks = nb; act.lastQ = q;
        act.pc = node.targets[i]; act.last.to = act.pc; act.last.choice = node.labels[i];
        this.logMsg(`${act.m.name} ${q === 'A' ? '∀' : '∃'} ${node.guess ? node.guess + ' = ' + node.labels[i] : 'branch ' + node.labels[i]}`);
        return;
      }
    }
    act.pc = node.next; act.last.to = act.pc;
  }
  scriptIO(act) {
    const run = this;
    const port = name => { const p = act.ports[name]; if (!p) throw new Error(`no port "${name}"`); return run.see(p); };
    const wr = (p, i, ch) => { if (p.readonly) throw new Error('port is read-only'); if (p.channel) throw new Error('a channel only allows io.send'); if (p.stack) throw new Error('a stack tape only allows push and pop'); ch = String(ch); if (ch.length !== 1) throw new Error(`cannot write "${ch}"`); if (ch === BLANK) p.rt.cells.delete(i); else p.rt.cells.set(i, ch); p.rt.lastWrite = i; p.rt.lastWriteStep = run.steps; p.visited.add(i); };
    return {
      n: act.n,
      read: (name, i) => { const p = port(name); run.note(p, i); return run.read(p.rt, i); },
      write: (name, i, ch) => wr(port(name), i, ch),
      get: name => { const p = port(name); let s = '', i = 0; while (true) { run.note(p, i); const ch = run.read(p.rt, i); if (ch === BLANK) break; s += ch; i++; if (i > 1e6) break; } return s; },
      set: (name, s) => { const p = port(name); if (p.readonly) throw new Error('port is read-only'); if (p.channel || p.stack) throw new Error('io.set cannot rewrite a ' + (p.channel ? 'channel' : 'stack')); for (const k of [...p.rt.cells.keys()]) p.rt.cells.delete(k); [...String(s)].forEach((ch, i) => wr(p, i, ch)); p.head = 0; },
      coin: name => { const p = port(name); run.note(p); const ch = run.read(p.rt, p.head); p.head++; return ch; },
      send: (name, ch) => run.send1(act, port(name), String(ch)),
      log: msg => run.logMsg(`${act.m.name}: ${msg}`),
    };
  }
  clone(keepHistory = true) {
    const r = Object.create(Run.prototype); Object.assign(r, this);
    r.tl = keepHistory && this.tl ? this.tl.slice() : null;
    r.trace = keepHistory && this.trace ? this.trace.slice() : null;
    r.tapes = new Map();
    for (const [id, rt] of this.tapes) r.tapes.set(id, { spec: rt.spec, cells: new Map(rt.cells), who: new Map(rt.who || []), queried: new Set(rt.queried || []), maxRead: rt.maxRead, rng: rt.rng ? { s: rt.rng.s } : null, lastWrite: rt.lastWrite, lastWriteStep: rt.lastWriteStep });
    const map = new Map();
    const ca = a => {
      if (!a) return a; if (map.has(a)) return map.get(a);
      const b = Object.assign({}, a); map.set(a, b);
      b.ports = {}; for (const [k, p] of Object.entries(a.ports)) b.ports[k] = Object.assign({}, p, { rt: r.tapes.get(p.rt.spec.id), visited: new Set(p.visited) });
      for (const k of Object.keys(b.ports)) { const p = a.ports[k]; if (p.q) b.ports[k].q = new Set(p.q); if (p.coins) b.ports[k].coins = new Set(p.coins); }
      if (a.regs) b.regs = Object.assign({}, a.regs); if (a.set) b.set = a.set.slice(); if (a.cfgSeen) b.cfgSeen = new Set(a.cfgSeen); if (a.vals) b.vals = a.vals.slice(); if (a.xs) b.xs = a.xs.slice();
      return b;
    };
    r.stack = this.stack.map(ca); r.seen = new Map([...this.seen].map(([k, a]) => [k, ca(a)]));
    r.final = ca(this.final); r.lastHalted = ca(this.lastHalted); r.lastActive = ca(this.lastActive);
    r.persist = new Map(this.persist); r.log = this.log.slice(); r.history = this.history.map(ca); r.branch = this.branch; r.force = this.force;
    return r;
  }
  fork(i) {
    const r = this.clone(); r.force = i; r.status = 'running'; r.branch = null;
    if (r.tl) r.tl = r.tl.filter(e => e.step < this.steps);   // the child's own snapshot (with its choice) is taken on its first step
    return r;
  }
  runToEnd(maxSteps = 200000) {
    while (this.status === 'running' && this.steps < maxSteps) this.step();
    if (this.status === 'running') this.finish('timeout', `stopped after ${maxSteps} steps`);
    return this;
  }
}

function machineNondet(world, m, seen = new Set()) {
  if (!m || seen.has(m.id) || !m.compiled) return false; seen.add(m.id);
  if (m.compiled.nondet) return true;
  const calls = m.kind === 'prog' ? m.compiled.nodes.filter(n => n.op === 'call') : m.kind === 'tm' ? Object.values(m.compiled.calls || {}) : [];
  for (const n of calls) {
    const t = n.socket ? world.machines.find(x => x.id === (m.links || {})[n.name]) : world.machines.find(x => x.name === n.name);
    if (t && !t.oracle && machineNondet(world, t, seen)) return true;
  }
  return false;
}
// Acceptance rules for a whole computation tree. 'exists' is ∃/∀ alternation. 'count' (#P) and
// 'parity' (⊕P) count accepting paths. 'majority' (PP) and 'bpp' use the probability of acceptance:
// every choice splits its weight equally among its options, as if each were a fair coin (or die),
// so a leaf below choices with k₁, k₂, … options has probability 1/(k₁·k₂·…). This is what the
// textbook definitions mean; they assume machines whose paths all have the same number of binary
// choices, where it is the same as the fraction of paths.
function bigGcd(a, b) { if (a < 0n) a = -a; while (b) [a, b] = [b, a % b]; return a || 1n; }
function ratAdd(p, q) { const n = p.n * q.d + q.n * p.d, d = p.d * q.d, g = bigGcd(n, d); return { n: n / g, d: d / g }; }
function fmtRat(p) { if (p.n === 0n) return '0'; if (p.n === p.d) return '1'; return p.d <= 1000000n ? `${p.n}/${p.d}` : (Number(p.n * 1000000n / p.d) / 1e6).toFixed(6); }
function accOf(m) { return { mode: (m && m.accMode) || 'exists', k: Math.max(1, parseInt((m && m.countK) || '1', 10) || 1) }; }
function decideCount(acc, a, n, P) {
  P = P || { n: BigInt(a), d: BigInt(n || 1) };   // without weights, all paths equally likely
  const ps = fmtRat(P);
  switch (acc.mode) {
    case 'count': return { result: a >= acc.k ? 'accept' : 'reject', why: `${a} accepting path${a === 1 ? '' : 's'}; accepts when at least ${acc.k}` };
    case 'majority': return { result: 2n * P.n > P.d ? 'accept' : 'reject', why: `accepts with probability ${ps}, ${2n * P.n > P.d ? 'more' : 'not more'} than 1/2 (${a} of ${n} paths)` };
    case 'bpp': return 3n * P.n >= 2n * P.d ? { result: 'accept', why: `accepts with probability ${ps}: at least 2/3` } : 3n * P.n <= P.d ? { result: 'reject', why: `accepts with probability ${ps}: at most 1/3` } : { result: 'reject', unclear: true, why: `accepts with probability ${ps}: between 1/3 and 2/3, no clear answer` };
    case 'parity': return { result: a % 2 ? 'accept' : 'reject', why: `${a} accepting paths: ${a % 2 ? 'odd' : 'even'}` };
  }
  return { result: a ? 'accept' : 'reject', why: '' };
}
function countRun(r0, opts, acc) {
  const max = opts.maxSteps || 200000, cap = opts.maxNodes || TREE_CAP;
  const st = { nodes: 1, leaves: 0, a: 0, P: { n: 0n, d: 1n }, timeouts: 0, cost: 0, space: 0, n: 0, found: null, last: r0, cut: false };
  const stack = [[r0, 1n]];   // each entry: a run and the inverse of its probability
  while (stack.length) {
    const [r1, w] = stack.pop(); const r = r1.runToEnd(max); st.last = r;
    if (r.status === 'branch') {
      if (st.nodes + r.branch.k > cap) { st.cut = true; break; }
      for (let i = r.branch.k - 1; i >= 0; i--) stack.push([r.fork(i), w * BigInt(r.branch.k)]);
      st.nodes += r.branch.k; continue;
    }
    if (r.result === 'accept') st.P = ratAdd(st.P, { n: 1n, d: w });
    st.leaves++; const fin = r.final;
    if (fin) { st.cost = Math.max(st.cost, fin.cost); st.space = Math.max(st.space, r.space(fin)); st.n = fin.n; }
    if (r.result === 'accept') { st.a++; if (!st.found) st.found = r; } else if (r.result !== 'reject') st.timeouts++;
  }
  const d = decideCount(acc, st.a, st.leaves, st.P);
  const result = st.cut ? 'timeout' : d.result;
  return { result, reason: st.cut ? 'search cut off before every path was counted' : d.why, steps: st.cost, cost: st.cost, space: st.space, n: st.n, run: st.found || st.last, nodes: st.nodes, leaves: st.leaves, accepting: st.a, timeouts: st.timeouts, unclear: !!d.unclear, nondet: true, counted: true };
}

// Evaluate an alternating computation tree: ∃ nodes are OR, ∀ nodes are AND.
const TREE_CAP = 25000;   // nodes in a computation tree, in the tree window and in the tools alike
function exploreRun(r0, opts = {}) {
  const acc = opts.acc || { mode: 'exists' };
  if (acc.mode !== 'exists') return countRun(r0, opts, acc);
  const max = opts.maxSteps || 200000, cap = opts.maxNodes || TREE_CAP, all = !!opts.all;
  const st = { nodes: 1, leaves: 0, accepting: 0, cost: 0, space: 0, n: 0, found: null, last: r0, cut: false, alt: false };
  const ev = r => {
    r.runToEnd(max); st.last = r;
    if (r.status !== 'branch') {
      st.leaves++; const fin = r.final;
      if (fin) { st.cost = Math.max(st.cost, fin.cost); st.space = Math.max(st.space, r.space(fin)); st.n = fin.n; }
      if (r.result === 'accept') { st.accepting++; if (!st.found) st.found = r; }
      return r.result === 'accept' || r.result === 'reject' ? r.result : 'timeout';
    }
    const q = r.branch.q || 'E'; if (q === 'A') st.alt = true;
    let acc = false, rej = false, unk = false;
    for (let i = 0; i < r.branch.k; i++) {
      if (st.nodes >= cap) { st.cut = true; unk = true; break; }
      st.nodes++;
      const v = ev(r.fork(i));
      if (v === 'accept') acc = true; else if (v === 'reject') rej = true; else unk = true;
      if (!all && ((q === 'E' && acc) || (q === 'A' && rej))) break;
    }
    if (q === 'E') return acc ? 'accept' : unk ? 'timeout' : 'reject';
    return rej ? 'reject' : unk ? 'timeout' : 'accept';
  };
  const result = ev(r0);
  return { result, reason: `${st.leaves} branches explored${st.cut ? ', search cut off' : ''}`, steps: st.cost, cost: st.cost, space: st.space, n: st.n, run: st.found || st.last, nodes: st.nodes, leaves: st.leaves, accepting: st.accepting, nondet: true };
}

// ---------- reductions ----------
function tapeString(rt) { let s = '', i = 0; while (rt && rt.cells.has(i)) s += rt.cells.get(i++); return s; }
function outputPortOf(m) { const ps = m && m.compiled ? m.compiled.ports : []; return ps.find(p => p.output) || ps.find(p => p.name === 'out') || ps[1] || null; }
function firstTapeOf(m) { const p = m && m.compiled && m.compiled.ports[0]; return p ? m.bind[p.name] : null; }
// Check one string: does A accept w exactly when B accepts f(w)? f may be a chain of transducers.
function runReduction(world, red, w, opts = {}) {
  const max = opts.maxSteps || 200000; const byId = id => world.machines.find(x => x.id === id);
  const A = byId(red.from), B = byId(red.to);
  const out = { w, a: null, b: null, fw: null, steps: [], err: null };
  if (!A || !B) { out.err = 'choose both languages'; return out; }
  if (!firstTapeOf(A) || !firstTapeOf(B)) { out.err = 'both deciders need an input tape'; return out; }
  out.a = headless(world, A.id, { overrides: { [firstTapeOf(A)]: w }, maxSteps: max }).result;
  let cur = w;
  for (const fid of red.via || []) {
    const f = byId(fid);
    if (!f || !f.compiled) { out.err = 'a transducer is missing or does not compile'; break; }
    const op = outputPortOf(f); const inT = firstTapeOf(f), outT = op && f.bind[op.name];
    if (!inT || !outT || inT === outT) { out.err = `${f.name} needs separate input and output tapes`; break; }
    const r = new Run(world, f.id, { overrides: { [inT]: cur, [outT]: '' } }).runToEnd(max);
    const fin = r.final;
    const s = { id: f.id, n: cur.length, cost: fin ? fin.cost : r.steps, space: fin ? r.space(fin) : 0, result: r.status === 'branch' ? 'nondeterministic' : r.result, reason: r.reason || '', over: !!(fin && /budget/.test(fin.reason || '')) };
    cur = tapeString(r.tapes.get(outT)); s.outLen = cur.length; out.steps.push(s);
    if (r.status !== 'halted' || r.result === 'timeout') { out.err = `${f.name} ${r.status === 'branch' ? 'made a nondeterministic choice (a reduction must be deterministic)' : 'did not halt within ' + max.toLocaleString() + ' steps'}`; break; }
  }
  out.fw = cur.length > 400 ? cur.slice(0, 400) + '…' : cur; out.fwLen = cur.length;
  if (!out.err) out.b = headless(world, B.id, { overrides: { [firstTapeOf(B)]: cur }, maxSteps: max }).result;
  return out;
}

function headless(world, targetId, opts = {}) {
  const max = opts.maxSteps || 200000;
  const r = new Run(world, targetId, opts).runToEnd(max);
  if (r.status !== 'branch') {
    const fin = r.final;
    const out = { result: r.result, reason: r.reason, steps: r.steps, cost: fin ? fin.cost : r.steps, space: fin ? r.space(fin) : 0, n: fin ? fin.n : 0, run: r };
    const tm0 = world.machines.find(x => x.id === targetId);
    if (accOf(tm0).mode !== 'exists' && (r.result === 'accept' || r.result === 'reject')) {
      // a run with no choices is a tree with a single path
      const a = r.result === 'accept' ? 1 : 0; const d = decideCount(accOf(tm0), a, 1);
      Object.assign(out, { result: d.result, reason: d.why, accepting: a, leaves: 1, counted: true, unclear: !!d.unclear });
    }
    return out;
  }
  const tm = world.machines.find(x => x.id === targetId);
  return exploreRun(r, Object.assign({ acc: accOf(tm) }, opts));
}

// ---------- DFA construction & minimization ----------
function minimizeDFA(states, alphabet, delta, start, accept) {
  let part = new Map(states.map(s => [s, accept.has(s) ? 1 : 0]));
  for (;;) {
    const sigs = new Map(); const next = new Map();
    for (const s of states) {
      const sig = part.get(s) + '|' + alphabet.map(a => part.get(delta[s][a])).join(',');
      if (!sigs.has(sig)) sigs.set(sig, sigs.size);
      next.set(s, sigs.get(sig));
    }
    const same = new Set(part.values()).size === sigs.size;
    part = next; if (same) break;
  }
  // rename by BFS from start
  const names = new Map(); const order = []; const q = [part.get(start)];
  const rep = new Map(); for (const s of states) if (!rep.has(part.get(s))) rep.set(part.get(s), s);
  while (q.length) { const b = q.shift(); if (names.has(b)) continue; names.set(b, 'q' + names.size); order.push(b); for (const a of alphabet) { const t = part.get(delta[rep.get(b)][a]); if (!names.has(t)) q.push(t); } }
  const out = { start: 'q0', accept: [], rows: [] };
  for (const b of order) {
    const s = rep.get(b);
    if (accept.has(s)) out.accept.push(names.get(b));
    for (const a of alphabet) out.rows.push([names.get(b), a, names.get(part.get(delta[s][a]))]);
  }
  out.count = order.length;
  return out;
}

function dfaText(min, alphabet, header) {
  const lines = [header, `alphabet: ${alphabet.join(' ')}`, `start: ${min.start}`, `accept: ${min.accept.join(' ')}`];
  // group rows with same from/to
  const g = new Map();
  for (const [f, a, t] of min.rows) { const k = f + '>' + t; if (!g.has(k)) g.set(k, { f, t, syms: [] }); g.get(k).syms.push(a); }
  for (const { f, t, syms } of g.values()) lines.push(`${f}, ${syms.join(' ')} -> ${t}`);
  return lines.join('\n');
}

function programToDFA(c) {
  if (c.dialect !== 'dfa') throw new TWError('only "machine Name dfa { ... }" programs compile to a DFA');
  const port = c.ports[0]; const alphabet = port.alphabet;
  const key = (pc, regs) => pc + '|' + c.regs.map(r => regs[r.name]).join(',');
  const evalCond = (k, regs, sym) => {
    const val = e => e.k === 'read' ? sym : e.k === 'reg' ? regs[e.name] : e.v;
    switch (k.k) {
      case 'or': return evalCond(k.a, regs, sym) || evalCond(k.b, regs, sym);
      case 'and': return evalCond(k.a, regs, sym) && evalCond(k.b, regs, sym);
      case 'not': return !evalCond(k.a, regs, sym);
      case 'cmp': {
        const a = val(k.a), b = val(k.b);
        if (k.op === '==') return String(a) === String(b);
        if (k.op === '!=') return String(a) !== String(b);
        const x = Number(a), y = Number(b);
        if (isNaN(x) || isNaN(y)) throw new TWError(`cannot compare ${a} ${k.op} ${b}`);
        return k.op === '<' ? x < y : k.op === '>' ? x > y : k.op === '<=' ? x <= y : x >= y;
      }
    }
  };
  // run from config with a fixed symbol until move R (return config) or halt
  const segment = (pc, regs0, sym, blankMode) => {
    let regs = { ...regs0 }; const seen = new Set();
    for (let guard = 0; guard < 100000; guard++) {
      const k = key(pc, regs);
      if (seen.has(k)) return { halt: 'reject' }; // loops forever
      seen.add(k);
      const n = c.nodes[pc];
      switch (n.op) {
        case 'halt': return { halt: n.acc ? 'accept' : 'reject' };
        case 'branch': pc = evalCond(n.cond, regs, sym) ? n.t : n.f; break;
        case 'move': if (n.dir === 'R') { if (!blankMode) return { pc: n.next, regs }; seen.clear(); } pc = n.next; break;
        case 'assign': { const v = n.expr.k === 'read' ? sym : n.expr.k === 'reg' ? regs[n.expr.name] : n.expr.v; const r = c.regs.find(x => x.name === n.reg); if (!r.domain.includes(String(v))) return { halt: 'reject' }; regs[n.reg] = String(v); pc = n.next; break; }
        case 'inc': case 'dec': { const r = c.regs.find(x => x.name === n.reg); const v = String(Number(regs[n.reg]) + (n.op === 'inc' ? 1 : -1)); if (!r.domain.includes(v)) return { halt: 'reject' }; regs[n.reg] = v; pc = n.next; break; }
        default: pc = n.next;
      }
    }
    return { halt: 'reject' };
  };
  const init = {}; c.regs.forEach(r => init[r.name] = r.init);
  const configs = new Map(); const queue = [];
  const id = (pc, regs) => { const k = key(pc, regs); if (!configs.has(k)) { configs.set(k, { pc, regs }); queue.push(k); } return k; };
  const startK = id(c.entry, init);
  const delta = { ACC: {}, REJ: {} }; const accept = new Set(['ACC']);
  alphabet.forEach(a => { delta.ACC[a] = 'ACC'; delta.REJ[a] = 'REJ'; });
  while (queue.length) {
    const k = queue.shift(); const { pc, regs } = configs.get(k); delta[k] = {};
    if (configs.size > 5000) throw new TWError('more than 5000 configurations; the DFA is too large');
    for (const a of alphabet) { const r = segment(pc, regs, a, false); delta[k][a] = r.halt ? (r.halt === 'accept' ? 'ACC' : 'REJ') : id(r.pc, r.regs); }
    if (segment(pc, regs, BLANK, true).halt === 'accept') accept.add(k);
  }
  const states = ['ACC', 'REJ', ...configs.keys()];
  const raw = configs.size + 2;
  const min = minimizeDFA(states, alphabet, delta, startK, accept);
  return { text: dfaText(min, alphabet, `# compiled from program ${c.name}: ${raw} configurations -> ${min.count} states`), raw, count: min.count };
}

function determinize(c) {
  const alphabet = c.alphabet; const k = s => [...s].sort().join(',');
  const start = epsClosure(c, [c.start]); const map = new Map(); const queue = [];
  const id = set => { const key = k(set); if (!map.has(key)) { map.set(key, set); queue.push(key); } return key; };
  const s0 = id(start); const delta = {}; const accept = new Set();
  while (queue.length) {
    const key = queue.shift(); const set = map.get(key); delta[key] = {};
    if (set.some(q => c.accept.has(q))) accept.add(key);
    for (const a of alphabet) { const nx = new Set(); for (const q of set) for (const r of (c.delta[q] && c.delta[q][a]) || []) nx.add(r); delta[key][a] = id(epsClosure(c, [...nx])); }
    if (map.size > 4096) throw new TWError('subset construction exceeded 4096 states');
  }
  const raw = map.size;
  const min = minimizeDFA([...map.keys()], alphabet, delta, s0, accept);
  return { text: dfaText(min, alphabet, `# subset construction: ${raw} subsets -> ${min.count} states after minimization`), raw, count: min.count };
}

if (typeof module !== 'undefined') module.exports = { BLANK, logSum, fmtBig, compilePDA, encodeMachine, encodeSource, decodeDescription, guestFrom, runReduction, outputPortOf, accOf, decideCount, compileMachine, parsePostfix, evalCircuit, exploreRun, machineNondet, compileCircuit, compileScript, compileProgram, compileTM, compileAutomaton, Run, headless, programToDFA, determinize, compileBudget, TWError };
