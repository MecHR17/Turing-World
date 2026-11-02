// ===== Turing World UI v3: workbench + floating windows =====
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SAVE_KEY = 'turing-world-v1';
const KIND_LABEL = { regex: 'regex', cfg: 'grammar', dfa: 'DFA', nfa: 'NFA', pda: 'PDA', tm: 'TM', prog: 'program', script: 'script', circuit: 'circuit' };
const GRID = 20, snap = v => Math.max(0, Math.round(v / GRID) * GRID);
const narrow = () => window.innerWidth <= 760;

let world = null, run = null, playing = false, selId = null, zoom = 1;
const wins = new Map(); let winZ = 200;
const screenMaps = new Map();

function machineById(id) { return world.machines.find(m => m.id === id); }
function tapeById(id) { return world.tapes.find(t => t.id === id); }
function abbr(name) { const caps = name.replace(/[^A-Z0-9]/g, ''); return (caps.length >= 2 ? caps.slice(0, 3) : name.slice(0, 3)); }

// ---------- persistence ----------
function worldData() {
  return { key: world.key, origin: world.origin || world.key || null, targetId: world.targetId, bps: world.bps || [], reductions: world.reductions || [], devices: (world.devices || []).map(({ running, pending, next, ticks, draft, ...x }) => x), tapes: world.tapes, machines: world.machines.map(m => ({ id: m.id, kind: m.kind, name: m.name, src: m.src, bind: m.bind, budgetTime: m.budgetTime, budgetSpace: m.budgetSpace, budgetSize: m.budgetSize, budgetDepth: m.budgetDepth, budgetFanin: m.budgetFanin, budgetRand: m.budgetRand, budgetQuery: m.budgetQuery, altMode: m.altMode, altBlocks: m.altBlocks, altStart: m.altStart, accMode: m.accMode, countK: m.countK, oracle: m.oracle, color: m.color, pos: m.pos, view: m.view, lab: m.lab, gen: m.gen, role: m.role, links: m.links, hideWires: !!m.hideWires, sim: m.sim || undefined })) };
}
function worldFromData(d) {
  if (!d || !Array.isArray(d.tapes) || !Array.isArray(d.machines)) throw new Error('this is not a Turing World file');
  const tapes = d.tapes.map(t => ({ id: String(t.id), name: String(t.name || 'tape'), kind: ['normal', 'cert', 'random', 'stack', 'channel', 'advice', 'proof'].includes(t.kind) ? t.kind : 'normal', advice: t.advice ? String(t.advice) : '', adviceMax: t.adviceMax ? String(t.adviceMax) : '', init: String(t.init || ''), alphabet: String(t.alphabet || 'ab'), seed: +t.seed || 1, public: !!t.public, maxLen: +t.maxLen || 6, pos: t.pos && isFinite(t.pos.x) ? { x: +t.pos.x, y: +t.pos.y } : null, w: +t.w || 440, hideWires: !!t.hideWires }));
  const kinds = ['dfa', 'nfa', 'pda', 'regex', 'cfg', 'tm', 'prog', 'script', 'circuit'];
  const machines = d.machines.filter(m => kinds.includes(m.kind)).map(m => compileMachine(Object.assign({}, m, { id: String(m.id), src: String(m.src || ''), bind: m.bind || {}, links: m.links || {}, pos: m.pos && isFinite(m.pos.x) ? { x: +m.pos.x, y: +m.pos.y } : null, color: /^m[1-6]$/.test(m.color) ? m.color : 'm1', sim: m.sim && typeof m.sim === 'object' ? { model: ['free', 'multi', 'single'].includes(m.sim.model) ? m.sim.model : 'free', timeCheck: !!m.sim.timeCheck, spaceCheck: !!m.sim.spaceCheck, loopDetect: !!m.sim.loopDetect } : undefined })));
  const mids = new Set(machines.map(m => m.id));
  const reductions = (Array.isArray(d.reductions) ? d.reductions : []).map(r => ({ id: String(r.id), from: mids.has(r.from) ? r.from : null, to: mids.has(r.to) ? r.to : null, via: (Array.isArray(r.via) ? r.via : []).filter(x => mids.has(x)), pos: r.pos && isFinite(r.pos.x) ? { x: +r.pos.x, y: +r.pos.y } : null, gen: r.gen ? String(r.gen) : null, check: r.check || null, status: r.status || null, hideWires: !!r.hideWires }));
  const tids = new Set(tapes.map(t => t.id));
  const devices = (Array.isArray(d.devices) ? d.devices : []).filter(x => x && DEV_KINDS[x.kind]).map(x => Object.assign({}, x, { id: String(x.id), tape: tids.has(x.tape) ? x.tape : null, run: mids.has(x.run) ? x.run : null, pos: x.pos && isFinite(x.pos.x) ? { x: +x.pos.x, y: +x.pos.y } : null }));
  const w = { key: d.key || null, origin: d.origin || d.key || null, targetId: d.targetId, bps: Array.isArray(d.bps) ? d.bps.map(String) : [], reductions, devices, tapes, machines };
  if (!machines.some(m => m.id === w.targetId)) w.targetId = machines[0] ? machines[0].id : null;
  _uid = Math.max(_uid, ...[...tapes, ...machines, ...reductions, ...devices].map(x => parseInt(String(x.id).slice(1), 10) || 0)) + 1;
  return w;
}

// ---------- persistence and undo ----------
// Every saved change pushes the previous state onto the undo stack. Lab settings are left
// out of the comparison so that opening a tools tab does not create an undo step.
let undoStack = [], redoStack = [], lastState = null, lastKey = null;
const undoKey = d => JSON.stringify(Object.assign({}, d, { machines: d.machines.map(m => Object.assign({}, m, { lab: null, gen: null })), reductions: (d.reductions || []).map(r => Object.assign({}, r, { status: null, check: null, gen: null })) }));
function save() {
  const d = worldData(); const s = JSON.stringify(d); const k = undoKey(d);
  if (lastKey != null && k !== lastKey) { undoStack.push(lastState); if (undoStack.length > 100) undoStack.shift(); redoStack = []; }
  lastState = s; lastKey = k;
  try { localStorage.setItem(SAVE_KEY, s); } catch (e) { }
  updateUndoButtons();
}
function restore() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null; return worldFromData(JSON.parse(raw)); } catch (e) { return null; }
}
function applyState(s) {
  world = worldFromData(JSON.parse(s)); lastState = s; lastKey = undoKey(JSON.parse(s));
  try { localStorage.setItem(SAVE_KEY, s); } catch (e) { }
  resetRun(); renderStructure(); renderWins(); renderLive(); updateUndoButtons();
}
function undo() { if (!undoStack.length) return; redoStack.push(lastState); applyState(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(lastState); applyState(redoStack.pop()); }
function updateUndoButtons() { const u = $('#bUndo'), r = $('#bRedo'); if (u) u.disabled = !undoStack.length; if (r) r.disabled = !redoStack.length; }

// ---------- run control ----------
let tree = null;
// Tape contents as they are right now (cells from 0; random tapes keep drawing from their seed).
function currentTapes() {
  const base = liveRun(); const o = {}; if (!base) return o;
  for (const [tid, rt] of base.tapes) {
    if (rt.spec.kind === 'random') continue;
    const keys = [...rt.cells.keys()].filter(k => k >= 0); const hi = keys.length ? Math.max(...keys) : -1;
    let s = ''; for (let i = 0; i <= hi; i++) s += rt.cells.get(i) ?? '_';
    o[tid] = s;
  }
  return o;
}
// Switching the run target continues on the tapes as they are; Reset goes back to the initial contents.
function switchTarget(id) {
  const carry = currentTapes(); const changedAny = world.tapes.some(t => t.kind !== 'random' && (carry[t.id] ?? '') !== (t.init || '').replace(/_+$/, ''));
  world.targetId = id; save(); resetRun(changedAny ? carry : null);
  if (changedAny) run.logMsg('starts on the tapes as they are now (Reset restores the initial contents)');
  renderStructure(); renderWins(); renderLive();
}
function resetRun(carry) {
  const prev = carry && typeof run !== 'undefined' && run ? (runLive || run) : null;
  playing = false; tree = null; runLive = null; bpNote = '';
  run = new Run(world, world.targetId, carry ? { overrides: carry } : {}); run.tl = []; run.trace = []; captureRow(run);
  if (prev) for (const [id, rt] of run.tapes) { // a carried channel keeps who sent each symbol
    const old = prev.tapes.get(id); if (!old || !old.who || rt.spec.kind !== 'channel') continue;
    for (const [i, v] of old.who) if (rt.cells.get(i) === old.cells.get(i)) rt.who.set(i, v);
  }
  const tw = wins.get('tree:tree'); if (tw) renderWin(tw);
  for (const w of wins.values()) if (w.type === 'st') w.stKey = '';
}
function finished() { if (runLive) return false; return tree ? tree.done : run.status === 'halted'; }

// ---------- time travel ----------
// The live run keeps snapshots (run.tl). Viewing the past swaps in a run rebuilt from the nearest
// snapshot; stepping forward from the past replays deterministically until it rejoins the live run.
let runLive = null, bpNote = '';
function record(r) {
  if (!r.tl) r.tl = [];
  const last = r.tl[r.tl.length - 1];
  if (last && last.step >= r.steps) return;
  const every = r.steps < 3000 ? 1 : 25;
  if (last && r.steps - last.step < every) return;
  if (r.tl.length > 8000) return;
  const s = r.clone(false); r.tl.push({ step: r.steps, snap: s });
}
function liveRun() { return runLive || run; }
function reconstruct(base, t) {
  const tl = base.tl || []; let lo = 0, hi = tl.length - 1, best = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (tl[mid].step <= t) { best = mid; lo = mid + 1; } else hi = mid - 1; }
  if (best < 0) return null;
  const r = tl[best].snap.clone(false);
  while (r.steps < t && r.status === 'running') r.step();
  r.tl = null; r.trace = null; r.isPast = true;
  return r;
}
function goTo(t) {
  const base = liveRun(); t = Math.max(0, Math.min(base.steps, t | 0));
  if (t >= base.steps) { run = base; runLive = null; return; }
  const r = reconstruct(base, t); if (!r) return;
  runLive = base; run = r;
}

// one row of the space-time diagram: every tape's cells and the heads on it
function captureRow(r) {
  if (!r.trace) return;
  if (r.trace.length && r.trace[r.trace.length - 1].step === r.steps) r.trace.pop();
  if (r.trace.length > 5000) return;
  const row = { step: r.steps, tapes: {} };
  for (const [tid, rt] of r.tapes) {
    const keys = [...rt.cells.keys()]; const lo = keys.length ? Math.min(...keys) : 0, hi = keys.length ? Math.max(...keys) : -1;
    let s = ''; for (let i = lo; i <= hi; i++) s += rt.cells.get(i) ?? '_';
    row.tapes[tid] = { lo, s, w: rt.lastWriteStep === r.steps ? rt.lastWrite : null, heads: [] };
  }
  r.stack.forEach((act, i) => {
    for (const p of Object.values(act.ports)) { const t = row.tapes[p.rt.spec.id]; if (t) t.heads.push({ p: p.head, c: act.m.color, top: i === r.stack.length - 1 }); }
  });
  r.trace.push(row);
}

// ---------- breakpoints ----------
function bpSet() { if (!world.bps) world.bps = []; return world.bps; }
function toggleBp(key) { const b = bpSet(); const i = b.indexOf(key); if (i >= 0) b.splice(i, 1); else b.push(key); save(); }
function bpHit(r) {
  const b = world.bps; if (!b || !b.length) return null;
  const act = r.stack[r.stack.length - 1]; if (!act) return null;
  const m = act.m, c = act.c;
  if (c.kind === 'prog') { const n = c.nodes[act.pc]; if (n && n.line && b.includes(`${m.id}:L${n.line}`) && act._bpLine !== n.line) { act._bpLine = n.line; return `${m.name}, line ${n.line}`; } if (n) act._bpLine = n.line; return null; }
  if (c.kind === 'nfa') { const s = act.set.find(q => b.includes(`${m.id}:S${q}`)); return s ? `${m.name}, state ${s}` : null; }
  if (act.state != null) {
    const enter = act._bpState !== act.state; act._bpState = act.state;
    if (enter && b.includes(`${m.id}:S${act.state}`)) return `${m.name}, enters state ${act.state}`;
  }
  return null;
}
function markAllBps() {
  for (const w of wins.values()) {
    if (w.type !== 'machine') continue; const m = machineById(w.id); if (!m) continue;
    markBps(w.el.querySelector('[data-r=code]'), m);
    if (w.map) markBps(w.el.querySelector('[data-r=gbox]'), m, new Map([...w.map].map(([k, v]) => [v, k])));
  }
  for (const m of world.machines) {
    const el = document.querySelector(`.mach[data-mid="${m.id}"] .mcode`); if (el) markBps(el, m);
    const sg = document.querySelector(`.mach[data-mid="${m.id}"] .screen[data-pfx]`); const map = screenMaps.get(m.id);
    if (sg && map) markBps(sg, m, new Map([...map].map(([k, v]) => [v, k])));
  }
}
function markBps(box, m, idxToId) {
  if (!box) return; const b = world.bps || [];
  box.querySelectorAll('[data-line]').forEach(el => el.classList.toggle('bp', b.includes(`${m.id}:L${el.dataset.line}`)));
  if (idxToId) box.querySelectorAll('[data-n]').forEach(el => { const id = idxToId.get(+el.dataset.n); el.classList.toggle('bp', id != null && b.includes(m.kind === 'prog' ? `${m.id}:L${(m.compiled.nodes[id] || {}).line}` : `${m.id}:S${id}`)); });
}

// ---------- nondeterminism and alternation: computation tree ----------
// ∃ nodes are OR (accept if some child accepts), ∀ nodes are AND (accept if every child accepts).
let treeSeq = 0;
function mkNode(r, parent, label) {
  const st = r.status === 'halted' ? r.result : r.status === 'branch' ? 'branch' : 'open';
  return { id: 'n' + (treeSeq++), run: r, parent, children: [], label, status: st, q: r.branch ? r.branch.q : null, value: null, depth: parent ? parent.depth + 1 : 0, w: 1n };
}
const treePrefs = { mode: 'dfs', short: true };
function ensureTree() {
  if (tree) return;
  const root = mkNode(run, null, ''); root.status = 'branch'; root.q = run.branch ? run.branch.q : 'E';
  const rule = accOf(machineById(world.targetId));
  tree = { root, focus: root, frontier: [], count: 1, acc: 0, rej: 0, cut: 0, pruned: 0, done: false, verdict: null, mode: treePrefs.mode, short: rule.mode === 'exists' && treePrefs.short, cap: TREE_CAP, alt: false, rule };
  if (!wins.has('tree:tree')) openWin('tree', 'tree');
}
function usesNondet(m) { return machineNondet(world, m); }
function updateTreeButton() {
  const b = $('#bTree'); const show = !!tree || run.status === 'branch' || usesNondet(machineById(world.targetId));
  b.hidden = !show; b.classList.toggle('on', wins.has('tree:tree'));
}
// Finished nodes drop their copy of the world (only the root and the nodes still being explored
// keep one); viewing a finished node rebuilds it by replaying its choices from the root.
function focusNode(node) {
  runLive = null; const prev = tree.focus;
  if (prev && prev !== node && prev !== tree.root && prev.status !== 'open' && prev.status !== 'running') prev.run = null;
  tree.focus = node; run = node.run || replayNode(node);
}
function replayNode(node) {
  const path = []; let a = node; while (a && !a.run) { path.unshift(a); a = a.parent; }
  let r = a.run;
  for (const n of path) {
    r = r.fork(n.parent.children.indexOf(n));
    while (r.status === 'running') { record(r); r.step(); captureRow(r); }
  }
  node.run = r; return r;
}
function finishTree(verdict) {
  tree.done = true; playing = false;
  if (tree.rule && tree.rule.mode !== 'exists') {
    const d = decideCount(tree.rule, tree.acc, tree.acc + tree.rej + tree.cut, tree.accP || { n: 0n, d: 1n });
    tree.decision = d; tree.verdict = tree.cut && tree.count >= tree.cap ? 'timeout' : d.result; return;
  }
  tree.verdict = verdict || tree.root.value || 'timeout';
  if (tree.verdict === 'accept') { // show the world as an accepting branch left it: a witness
    let n = tree.root;
    while (n.children.length) { const c = n.children.find(x => (x.children.length ? x.value : leafVal(x)) === 'accept'); if (!c) break; n = c; }
    if (n !== tree.focus && !n.children.length) focusNode(n);
  }
}
const leafVal = n => n.status === 'accept' || n.status === 'reject' || n.status === 'timeout' ? n.status : null;
function nodeValue(n) {
  if (!n.children.length) return leafVal(n);
  let acc = false, rej = false, unk = false, open = false;
  for (const c of n.children) { const v = c.children.length ? c.value : leafVal(c); if (v === 'accept') acc = true; else if (v === 'reject') rej = true; else if (v === 'timeout') unk = true; else open = true; }
  if (n.q === 'A') return rej ? 'reject' : open ? null : unk ? 'timeout' : 'accept';
  return acc ? 'accept' : open ? null : unk ? 'timeout' : 'reject';
}
function prune(n) {
  for (const c of n.children) {
    if (c.status === 'open' || c.status === 'running') { c.status = 'pruned'; tree.pruned++; }
    if (c.children.length && c.value == null) { c.pruned = true; prune(c); }
  }
}
function propagate(n) {
  if (tree.rule && tree.rule.mode !== 'exists') return;   // counting rules need every path
  for (let p = n.parent; p; p = p.parent) {
    if (p.value != null) break;
    const v = nodeValue(p); if (v == null) break;
    p.value = v; if (tree.short) prune(p);
  }
  if (tree.root.value != null && tree.short) finishTree(tree.root.value);
}
function advance() {
  if (tree.done) return;
  let next;
  while ((next = tree.frontier.shift()) && next.status !== 'open');
  if (!next) return finishTree(tree.root.value || 'timeout');
  focusNode(next); next.status = 'running';
}
function expand() {
  const node = tree.focus;
  if (node.children.length) return advance();
  const b = run.branch; node.q = b.q || 'E'; if (node.q === 'A') tree.alt = true;
  if (tree.count + b.k > tree.cap) { tree.cut++; node.status = 'timeout'; propagate(node); return advance(); }
  node.children = b.labels.map((lab, i) => mkNode(run.fork(i), node, lab));
  for (const ch of node.children) ch.w = node.w * BigInt(b.k);   // probability 1/w: each option equally likely
  node.status = 'branch'; tree.count += b.k;
  if (tree.mode === 'dfs') tree.frontier.unshift(...node.children); else tree.frontier.push(...node.children);
  advance();
}
function stepWorld() {
  if (runLive) { goTo(run.steps + 1); return; }
  if (run.status === 'running') {
    record(run);
    run.step();
    captureRow(run);
    if (tree && tree.focus.status === 'open') tree.focus.status = 'running';
    if (run.status === 'branch') { ensureTree(); tree.focus.status = 'branch'; tree.focus.q = run.branch.q || 'E'; }
    else if (run.status === 'halted' && tree) {
      const n = tree.focus; n.status = run.result === 'accept' || run.result === 'reject' ? run.result : 'timeout';
      if (n.status === 'accept') { tree.acc++; tree.accP = ratAdd(tree.accP || { n: 0n, d: 1n }, { n: 1n, d: n.w }); } else if (n.status === 'reject') tree.rej++; else tree.cut++;
      propagate(n);
    }
    return;
  }
  if (run.status === 'branch') { ensureTree(); expand(); return; }
  if (tree && !tree.done) advance();
}
function changed(structural) { resetRun(); save(); if (structural) renderStructure(); renderWins(); renderLive(); }
function setWorld(w) {
  stopClocks();
  for (const k of [...wins.keys()]) closeWin(k);
  world = w; selId = null; resetRun(); renderStructure(); renderLive(); save();
  showGuide(!narrow() && !opsMode); $('#canvas').scrollTo(0, 0);
  if (usesNondet(machineById(world.targetId))) openWin('tree', 'tree');
  updateTreeButton();
}

// ---------- menus, guide, console ----------
const WORLD_GROUPS = [
  ['Machines and languages', ['dfa', 'nfa', 'lang', 'pda', 'inc', 'pal', 'rev', 'blank']],
  ['Interactive worlds', ['panel', 'life']],
  ['Nondeterminism and chance', ['np', 'npguess', 'bpp', 'count']],
  ['Alternation', ['ph', 'game']],
  ['Oracles, proofs and communication', ['oracle', 'ip', 'pcp', 'comm']],
  ['Circuits and advice', ['circuit', 'family', 'advice']],
  ['Reductions and computability', ['reduce', 'halt', 'rice', 'hier', 'construct']],
];
// ---------- world files ----------
// build.py bundles every worlds/*.json file (a world saved with Save as file) into WORLD_FILES. A file whose key
// matches a built-in world replaces that world's content, and its title, tag and guide if it has them; any other
// file becomes a new world, listed under its "group" (or under More).
function applyWorldFiles() {
  for (const f of (typeof WORLD_FILES !== 'undefined' ? WORLD_FILES : [])) {
    if (!f || !f.world || !f.key) continue;
    let ex = EXAMPLES.find(e => e.key === f.key);
    if (!ex) { ex = { key: f.key, title: f.title || f.key, tag: f.tag || 'NEW', guide: f.guide || '', tapes: [], machines: [] }; EXAMPLES.push(ex); }
    if (f.title) ex.title = f.title; if (f.tag) ex.tag = f.tag; if (f.guide != null) ex.guide = f.guide;
    ex.data = f.world;
    if (f.group) { const g = WORLD_GROUPS.find(g => g[0] === f.group); if (g) { if (!g[1].includes(f.key)) { WORLD_GROUPS.forEach(h => h[1] = h[1].filter(k => k !== f.key)); g[1].push(f.key); } } else { WORLD_GROUPS.forEach(h => h[1] = h[1].filter(k => k !== f.key)); WORLD_GROUPS.push([f.group, [f.key]]); } }
  }
}
function openExample(ex) {
  if (!ex.data) { const w = loadExample(ex); w.origin = ex.key; return w; }
  const w = worldFromData(JSON.parse(JSON.stringify(ex.data))); w.key = ex.key; w.origin = ex.key; return w;
}
function renderWorldsMenu() {
  const btn = e => `<button data-ex="${e.key}" class="${world && (world.key || world.origin) === e.key ? 'on' : ''}"><span class="cls">${esc(e.tag)}</span><span>${esc(e.title)}</span></button>`;
  const used = new Set(WORLD_GROUPS.flatMap(g => g[1]));
  const groups = WORLD_GROUPS.map(([h, keys]) => [h, keys.map(k => EXAMPLES.find(e => e.key === k)).filter(Boolean)]);
  const rest = EXAMPLES.filter(e => !used.has(e.key)); if (rest.length) groups.push(['More', rest]);
  $('#mWorlds').innerHTML = `<div class="wgroups">${groups.map(([h, es]) => `<div class="wgroup"><div class="wgh">${h}</div>${es.map(btn).join('')}</div>`).join('')}</div>` +
    `<div class="menusep"></div><button data-io="open"><span class="cls">FILE</span><span>Save or load a world…<small>Export to a file, or import one</small></span></button>`;
}
function closeMenus() { document.querySelectorAll('.menu').forEach(m => m.hidden = true); }
function showGuide(on) {
  const g = $('#guide'); const ex = world && EXAMPLES.find(e => e.key === (world.key || world.origin));   // an edited world keeps the guide of the world it started from
  g.innerHTML = `<button class="ib x" data-act="closeGuide" aria-label="Close guide">×</button>
    <h3>${ex ? `<span class="cls">${esc(ex.tag)}</span>${esc(ex.title)}` : 'Your world'}</h3>
    <p>${ex ? ex.guide : 'Add tapes and machines from the + Add menu, click any element to open its settings, and drag them around the grid. Load a prepared world from the Worlds menu.'}</p>
    <p class="note" style="margin-top:6px">Click a machine or tape to edit it. Drag to move. Wires follow the tape ports. Every feature is explained in the <a href="#" data-man="start">manual</a>.</p>`;
  g.hidden = !on; $('#bGuide').classList.toggle('on', on);
}
function renderTargetSelect() {
  $('#target').innerHTML = world.machines.map(m => `<option value="${m.id}" ${m.id === world.targetId ? 'selected' : ''}>${esc(m.name)}</option>`).join('') || '<option>no machines</option>';
}

// ---------- layout ----------
function autoLayout(force) {
  const hOf = (q, d) => { const el = document.querySelector(q); return el ? el.offsetHeight : d; };
  let y = 40;
  world.machines.forEach(m => { if (force || !m.pos) m.pos = { x: 40, y }; y = snap(Math.max(y, m.pos.y) + hOf(`.mach[data-mid="${m.id}"]`, 300) + 30); });
  y = 40;
  world.tapes.forEach(t => { if (!t.w) t.w = 440; if (force || !t.pos) t.pos = { x: 380, y }; y = snap(Math.max(y, t.pos.y) + hOf(`.tape[data-tid="${t.id}"]`, 100) + 40); });
}
function freeSpot(w, h) {
  const cv = $('#canvas'); const x0 = snap(cv.scrollLeft / zoom + 40), y0 = snap(cv.scrollTop / zoom + 40);
  const boxes = [...document.querySelectorAll('.world > .mach, .world > .tape, .world > .red')].map(el => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }));
  for (let r = 0; r < 80; r++) for (let c = 0; c < 6; c++) {
    const x = x0 + c * 160, y = y0 + r * 40;
    if (!boxes.some(b => x < b.x + b.w + 30 && x + w + 30 > b.x && y < b.y + b.h + 30 && y + h + 30 > b.y)) return { x, y };
  }
  return { x: x0, y: y0 };
}
function sizePlane() {
  const plane = $('#world'); let w = 0, h = 0;
  plane.querySelectorAll('.mach, .tape, .red, .dev').forEach(el => { w = Math.max(w, el.offsetLeft + el.offsetWidth); h = Math.max(h, el.offsetTop + el.offsetHeight); });
  const cv = $('#canvas');
  const W = Math.max(w + 500, cv.clientWidth / zoom), H = Math.max(h + 400, cv.clientHeight / zoom);
  plane.style.width = W + 'px'; plane.style.height = H + 'px';
  $('#sizer').style.width = W * zoom + 'px'; $('#sizer').style.height = H * zoom + 48 + 'px';
}

// ---------- world elements ----------
const ICON_EYE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>';
const ICON_CODE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5"/></svg>';
const ICON_GRAPH = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="3.5" cy="8" r="2"/><circle cx="12.5" cy="4" r="2"/><circle cx="12.5" cy="12" r="2"/><path d="M5.4 7.2 10.6 4.8M5.4 8.8l5.2 2.4"/></svg>';
function views(m) { return m.kind === 'prog' || m.kind === 'cfg' ? ['code', 'graph', 'none'] : m.kind === 'regex' ? ['graph', 'code', 'none'] : m.kind === 'script' ? ['code', 'none'] : m.kind === 'circuit' ? ['graph', 'code', 'none'] : ['graph', 'none']; }
function viewOf(m) {
  if (!m.compiled) return 'none';
  if (m.view && views(m).includes(m.view)) return m.view;
  if (m.kind === 'prog' || m.kind === 'script') return 'code';
  if (m.kind === 'circuit') return 'graph';
  return m.compiled.states.length <= 16 ? 'graph' : 'none';
}
function machineHTML(m) {
  const ports = m.compiled ? m.compiled.ports : []; const v = viewOf(m);
  const nextV = views(m)[(views(m).indexOf(v) + 1) % views(m).length];
  let screen = '';
  if (v === 'graph' && m.kind === 'circuit') screen = `<div class="screen" data-f="screen" data-circ="s${m.id}"></div>`;
  else if (v === 'graph') { const g = graphSVG(m, 's' + m.id); screenMaps.set(m.id, g.idx); screen = `<div class="screen" data-f="screen" data-pfx="s${m.id}">${g.svg.replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" ')}</div>`; }
  else if (v === 'code') screen = `<div class="screen" data-f="screen"><div class="mcode">${highlightSrc(m.src)}</div></div>`;
  return `<div class="mach drag ${m.color} ${v === 'none' ? 'compact' : ''} ${m.role === 'prover' ? 'prover' : ''}" data-mid="${m.id}" tabindex="0" role="button" aria-label="Machine ${esc(m.name)}" style="left:${m.pos.x}px;top:${m.pos.y}px">
    <span class="chipleds" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><div class="plate"><span class="led" data-f="led"></span><b title="${esc(m.name)}">${esc(m.name)}</b><span class="kind">${KIND_LABEL[m.kind]}</span>${m.budgetRand && m.budgetQuery ? `<span class="cls-badge" title="PCP(${esc(m.budgetRand)}, ${esc(m.budgetQuery)}): budgets for random bits and proof queries">${(m.budgetRand + m.budgetQuery).length > 9 ? 'PCP' : `PCP(${esc(m.budgetRand)}, ${esc(m.budgetQuery)})`}</span>` : ''}${m.compiled && m.compiled.nondet ? `<span class="cls-badge" title="Class set in Wiring & budgets">${esc(altLabel(m))}</span>` : ''}${m.role === 'prover' ? '<span class="tgt prov" title="Unbounded prover">PROVER ∞</span>' : ''}${m.id === world.targetId ? '<span class="tgt" title="Run target">RUN</span>' : ''}
      ${m.compiled ? `<button class="ib" data-act="view" title="${nextV === 'none' ? 'Hide internals' : nextV === 'code' ? 'Show program' : 'Show state graph'}">${nextV === 'none' ? ICON_EYE : nextV === 'code' ? ICON_CODE : ICON_GRAPH}</button>` : ''}</div>
    ${m.error ? `<div class="merr">Does not compile. Click to fix.</div>` : ''}
    ${screen}
    <div class="readout" data-f="conf"></div>
    <div class="gauges" data-f="met"></div>
    <div class="jacks">${ports.map(p => {
      const t = tapeById(m.bind[p.name]);
      return `<div class="jack ${t ? '' : 'none'}" ${t ? `data-wire="${m.id}|${t.id}"` : ''} title="${esc(p.name)}${p.readonly ? ' (read-only)' : ''}${p.oneway ? ' (one-way)' : ''}"><i></i><span>${esc(p.name)}</span>${p.readonly ? '<span class="mod">ro</span>' : ''}${t ? '' : '<span class="to">unwired</span>'}</div>`;
    }).join('')}${((m.compiled && m.compiled.sockets) || []).map(s => {
      const t = machineById((m.links || {})[s]);
      return `<div class="jack sock ${t ? '' : 'none'}" data-link="${m.id}|${esc(s)}" title="Oracle socket ${esc(s)}"><i></i><span>${esc(s)}</span><span class="to">${t ? '→ ' + esc(t.name) : 'empty'}</span></div>`;
    }).join('')}${ports.length || (m.compiled && m.compiled.sockets && m.compiled.sockets.length) ? '' : '<span class="note">no tape ports</span>'}</div>
  </div>`;
}
// aluminium look: an upright drum at each end of the tape. When a head moves right the tape slides left under it,
// so the lines on the drums' faces slide left too; moving left slides them right.
function rollSVG(cls) { // seen from the side: a drum whose surface lines slide as it turns
  return `<span class="roll ${cls}" aria-hidden="true"><span class="rface" data-f="spinr"></span></span>`;
}
function reelSVG() {
  const spokes = [0, 120, 240].map(a => `<path transform="rotate(${a} 28 28)" d="M24 9 h8 l-1.5 11 h-5 z"/>`).join('');
  return `<svg class="rl-reel" viewBox="0 0 56 56" aria-hidden="true"><circle class="rim" cx="28" cy="28" r="26"/><circle class="wind" cx="28" cy="28" r="21"/><circle class="wind" cx="28" cy="28" r="17"/><g class="spokes" data-f="spin">${spokes}<circle class="hub" cx="28" cy="28" r="5"/></g></svg>`
    + `<svg class="rl-gear" viewBox="0 0 56 56" aria-hidden="true"><g class="spokes" data-f="spin"><path class="cog" d="M25.43 6.65 L26.18 2.06 L29.82 2.06 L30.57 6.65 L36.44 8.23 L39.39 4.63 L42.54 6.45 L40.90 10.80 L45.20 15.10 L49.55 13.46 L51.37 16.61 L47.77 19.56 L49.35 25.43 L53.94 26.18 L53.94 29.82 L49.35 30.57 L47.77 36.44 L51.37 39.39 L49.55 42.54 L45.20 40.90 L40.90 45.20 L42.54 49.55 L39.39 51.37 L36.44 47.77 L30.57 49.35 L29.82 53.94 L26.18 53.94 L25.43 49.35 L19.56 47.77 L16.61 51.37 L13.46 49.55 L15.10 45.20 L10.80 40.90 L6.45 42.54 L4.63 39.39 L8.23 36.44 L6.65 30.57 L2.06 29.82 L2.06 26.18 L6.65 25.43 L8.23 19.56 L4.63 16.61 L6.45 13.46 L10.80 15.10 L15.10 10.80 L13.46 6.45 L16.61 4.63 L19.56 8.23Z"/><circle class="cog-in" cx="28" cy="28" r="16"/>${[0, 60, 120, 180, 240, 300].map(a => `<circle class="cog-hole" cx="${(28 + 10 * Math.sin(a * Math.PI / 180)).toFixed(2)}" cy="${(28 - 10 * Math.cos(a * Math.PI / 180)).toFixed(2)}" r="3.2"/>`).join('')}<circle class="cog-hub" cx="28" cy="28" r="4.5"/></g></svg>`
    + rollSVG('feed-l');
}
const STACK_SHOW = 6; // plates drawn in a stack's well; deeper plates fold into one
function mouthSVG() { // the open end of a stack: push goes in, pop comes out, nothing else
  return `<svg viewBox="0 0 132 22" aria-hidden="true"><path class="lip" d="M2 21 Q6 15 14 15 H118 Q126 15 130 21"/><text x="30" y="10" text-anchor="end">push</text><path class="arr in" d="M38 1v10M34.5 7.5 38 11l3.5-3.5"/><path class="arr out" d="M94 11V1M90.5 4.5 94 1l3.5 3.5"/><text x="102" y="10">pop</text></svg>`;
}
function tapeHTML(t) {
  if (t.kind === 'stack') return `<div class="tape stack" data-tid="${t.id}" style="left:${t.pos.x}px;top:${t.pos.y}px">
    <div class="tbody">
      <div class="tlabel drag"><b>${esc(t.name)}</b><span class="kind">stack</span><span class="meta" data-f="meta"></span><button class="ib stbtn" data-st="${t.id}" title="Space-time diagram of this stack" aria-label="Space-time diagram of ${esc(t.name)}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2" width="12" height="12" rx="1"/><path d="M2 6h12M2 10h12M6 2v12M10 2v12"/></svg></button></div>
      <div class="stackcol">
        <div class="reel mouth drag" tabindex="0" role="button" aria-label="Stack ${esc(t.name)}" title="Push in, pop out: only the top is reachable">${mouthSVG()}</div>
        <div class="tscroll"><div class="well" style="height:${STACK_SHOW * 27 + 6}px"><div class="cells"></div></div><div class="heads"></div></div>
      </div>
    </div>
  </div>`;
  return `<div class="tape ${t.kind}" data-tid="${t.id}" style="left:${t.pos.x}px;top:${t.pos.y}px;width:${t.w}px">
    <div class="reel drag" tabindex="0" role="button" aria-label="Tape ${esc(t.name)}">${reelSVG()}</div>
    <div class="tbody">
      <div class="tlabel drag"><b>${esc(t.name)}</b>${t.kind !== 'normal' ? `<span class="kind">${t.kind === 'cert' ? 'certificate' : t.kind === 'random' ? (t.public ? 'public coins' : 'private coins') : t.kind}</span>` : ''}<span class="meta" data-f="meta"></span><button class="ib stbtn" data-st="${t.id}" title="Space-time diagram of this tape" aria-label="Space-time diagram of ${esc(t.name)}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2" width="12" height="12" rx="1"/><path d="M2 6h12M2 10h12M6 2v12M10 2v12"/></svg></button></div>
      <div class="tscroll"><div class="strip"><div class="sprocket"></div><div class="cells"></div><div class="heads"></div></div></div>
    </div>
    ${rollSVG('feed-r')}
    <span class="grip" title="Drag to resize the tape"></span>
  </div>`;
}
function renderStructure() {
  renderTargetSelect(); renderWorldsMenu();
  const plane = $('#world');
  plane.querySelectorAll('.mach, .tape, .red, .dev, .empty').forEach(el => el.remove()); if (!world.devices) world.devices = [];
  if (!world.reductions) world.reductions = [];
  world.reductions.forEach((r, i) => { if (!r.pos) r.pos = { x: 420, y: 60 + i * 160 }; });
  autoLayout(false);
  let html = world.machines.map(machineHTML).join('') + world.tapes.map(tapeHTML).join('') + world.reductions.map(reductionHTML).join('') + world.devices.map(deviceHTML).join('');
  if (!world.machines.length && !world.tapes.length) html = '<p class="note empty" style="position:absolute;left:40px;top:30px">Empty world. Use + Add to place tapes and machines.</p>';
  plane.insertAdjacentHTML('beforeend', html);
  sizePlane(); markSelection(); markAllBps();
}
function markSelection() {
  document.querySelectorAll('.mach').forEach(el => el.classList.toggle('sel', el.dataset.mid === selId));
  document.querySelectorAll('.tape').forEach(el => el.classList.toggle('sel', el.dataset.tid === selId));
}

// ---------- live rendering ----------
function statusOf(a) { if (!a) return 'idle'; if (a.live) return a.top ? 'running' : 'waiting'; return a.act.status; }
function renderTimeline() {
  const base = liveRun(); const rg = $('#tlRange');
  rg.max = base.steps; rg.value = run.steps;
  const past = !!runLive;
  $('#tlLabel').innerHTML = bpNote ? `<span class="bpnote">${esc(bpNote)}</span>` : past ? `step ${run.steps} of ${base.steps} <span class="pill waiting">rewound</span>` : `step ${run.steps}`;
  $('#timeline').classList.toggle('past', past);
  document.querySelectorAll('[data-tl=start],[data-tl=back]').forEach(b => b.disabled = run.steps === 0);
  document.querySelectorAll('[data-tl=fwd],[data-tl=end]').forEach(b => b.disabled = !past);
}
// When a computation tree is finished, the answer is the tree's, not the answer of the branch on show.
function treeOutcome() {
  if (!tree || !tree.done) return null;
  if (tree.decision && tree.decision.unclear) return { cls: 'waiting', text: 'no clear answer' };
  return { cls: tree.verdict, text: tree.verdict === 'accept' ? 'accepted' : tree.verdict === 'reject' ? 'rejected' : tree.verdict };
}
function renderLive() {
  if (!run) return;
  renderTimeline();
  const st = tree ? (tree.done ? tree.verdict : playing ? 'exploring' : 'paused') : run.status === 'halted' ? run.result : (run.steps === 0 && !playing ? 'ready' : playing ? 'running' : run.status === 'branch' ? 'at a choice' : 'paused');
  const pill = $('#status'); pill.textContent = st === 'accept' ? 'accepted' : st === 'reject' ? 'rejected' : st; pill.className = 'pill ' + (st === 'paused' || st === 'ready' || st === 'at a choice' ? '' : st === 'exploring' ? 'running' : st);
  if (tree && tree.done && tree.decision && tree.decision.unclear) { pill.textContent = 'no clear answer'; pill.className = 'pill waiting'; }
  $('#counter').textContent = `${run.steps} step${run.steps === 1 ? '' : 's'}`;
  $('#bPlay').textContent = playing ? 'Pause' : 'Run';
  const top0 = run.stack[0] || run.final;
  if (!tree && top0 && top0.c.kind === 'circuit' && top0.circ) $('#counter').textContent = `layer ${top0.layer} of ${top0.circ.depth}`;
  if (tree) $('#counter').textContent = `${run.steps} steps · tree ${tree.count} nodes, ${tree.acc} ✓ ${tree.rej} ✗`;
  $('#bStep').disabled = $('#bPlay').disabled = finished();
  updateTreeButton();

  for (const m of world.machines) {
    const el = document.querySelector(`.mach[data-mid="${m.id}"]`); if (!el) continue;
    const a = actFor(m.id); const status = statusOf(a);
    const to = m.id === world.targetId && treeOutcome();
    el.querySelector('[data-f=led]').className = 'led ' + (to ? (to.cls === 'waiting' ? 'unclear' : to.cls) : status === 'idle' ? '' : status);
    el.classList.toggle('top', !!(a && a.live && a.top && run.status === 'running'));
    const gi = a && a.live ? run.stack.indexOf(a.act) : -1; const guest = gi >= 0 && run.stack[gi + 1] && run.stack[gi + 1].m.guest ? run.stack[gi + 1] : null;
    const depth = guest ? run.stack.filter(x => x.m.guest).length : 0;
    el.querySelector('[data-f=conf]').innerHTML = a ? (guest ? `simulating <em>⟨${esc(guest.m.name)}⟩</em> · ${confText(guest)}${depth > 1 ? ` · ${depth} simulations deep` : ''}` : confText(a.act) + (a.act.reason && !a.live ? ` · ${esc(a.act.reason)}` : '')) : (m.compiled ? 'idle' : '');
    let met = '';
    const gauge = (label, v, lim) => `<span>${label}</span><div class="meter ${lim != null && v > lim ? 'over' : ''}"><i style="width:${lim != null ? Math.min(100, v / Math.max(1, lim) * 100) : 0}%"></i></div><span>${v}${lim != null ? '/' + lim : ''}</span>`;
    if (a && a.act.c.kind === 'circuit') {
      const C = a.act.circ;
      if (C) met = gauge('size', C.size, a.act.sizeLimit) + gauge('depth', C.depth, a.act.depthLimit) + gauge('fan-in', C.fanin, a.act.faninLimit);
    } else if (!a && m.kind === 'circuit' && m.compiled && m.compiled.circ) {
      const C = m.compiled.circ; met = gauge('size', C.size, null) + gauge('depth', C.depth, null) + gauge('fan-in', C.fanin, m.budgetFanin ? parseInt(m.budgetFanin, 10) : null);
    } else if (a) {
      const act = a.act, sp = run.space(act), tl = act.timeLimit, sl = act.spaceLimit;
      met += `<span>T</span><div class="meter ${tl != null && act.cost > tl ? 'over' : ''}"><i style="width:${tl != null ? Math.min(100, act.cost / Math.max(1, tl) * 100) : 0}%"></i></div><span>${fmtBig(act.cost)}${tl != null ? '/' + tl : ''}</span>`;
      met += `<span>S</span><div class="meter ${sl != null && sp > sl ? 'over' : ''}"><i style="width:${sl != null ? Math.min(100, sp / Math.max(1, sl) * 100) : 0}%"></i></div><span>${sp}${sl != null ? '/' + sl : ''}</span>`;
    }
    el.querySelector('[data-f=met]').innerHTML = met;
    const scr = el.querySelector('[data-f=screen]');
    if (scr) {
      if (scr.dataset.circ) updateCircuitBox(scr, m, a, scr.dataset.circ);
      else if (scr.dataset.pfx) highlightGraph(scr, screenMaps.get(m.id), a, scr.dataset.pfx, false);
      else {
        const box = scr.querySelector('.mcode');
        if (guest && guest.c.kind === 'prog') {
          if (box.dataset.guest !== guest.m.id) { box.innerHTML = `<div class="guesthd">⟨${esc(guest.m.name)}⟩ read from the tape, running inside ${esc(m.name)}</div>` + highlightSrc(guest.m.src); box.dataset.guest = guest.m.id; box.classList.add('guestcode'); }
          highlightCode(box, { act: guest });
        } else {
          if (box.dataset.guest) { box.innerHTML = highlightSrc(m.src); delete box.dataset.guest; box.classList.remove('guestcode'); markBps(box, m); }
          highlightCode(box, a);
        }
      }
    }
  }
  renderTapes(); updateDevices(); drawWires(); renderConsole();   // devices first: a display's size depends on its tape, and the wires follow the sizes
  for (const w of wins.values()) updateWinLive(w);
}

function renderTapes() {
  const heads = new Map();
  for (const m of world.machines) {
    const a = actFor(m.id); if (!a) continue;
    for (const [pname, p] of Object.entries(a.act.ports)) {
      const tid = p.rt.spec.id; if (!heads.has(tid)) heads.set(tid, []);
      const multi = a.act.c.ports.filter(x => m.bind[x.name] === tid).length > 1;
      heads.get(tid).push({ pos: p.head, m, ghost: !a.live, top: a.live && a.top && run.status === 'running', label: abbr(m.name) + (multi ? '.' + pname : '') });
    }
  }
  const g = [...run.stack].reverse().find(a => a.m.guest);
  if (g) for (const [pname, p] of Object.entries(g.ports)) {
    const tid = p.rt.spec.id; if (!heads.has(tid)) heads.set(tid, []);
    heads.get(tid).push({ pos: p.head, m: g.m, ghost: false, top: g === run.stack[run.stack.length - 1] && run.status === 'running', label: '⟨' + abbr(g.m.name) + '⟩' + (g.c.ports.length > 1 ? '.' + pname : '') });
  }
  for (const t of world.tapes) {
    const el = document.querySelector(`.tape[data-tid="${t.id}"]`); if (!el) continue;
    const rt = run.tapes.get(t.id); const hs = heads.get(t.id) || [];
    if (t.kind === 'stack') { renderStack(t, el, rt, hs); continue; }
    const keys = [...rt.cells.keys()];
    let lo = Math.min(0, ...keys, ...hs.map(h => h.pos)) - 1;
    let hi = Math.max(9, ...keys, ...hs.map(h => h.pos)) + 3;
    if (t.kind === 'random') { lo = 0; hi = Math.max(11, ...keys, ...hs.map(h => h.pos)) + 4; }
    hi = Math.max(hi, lo + Math.floor(((t.w || 440) - 60) / 30) - 1);
    if (hi - lo > 600) hi = lo + 600;
    let cells = '';
    for (let i = lo; i <= hi; i++) {
      const has = rt.cells.has(i); const v = has ? rt.cells.get(i) : '';
      const unk = !has && t.kind === 'random' && i >= 0;
      const wh = rt.who && rt.who.get(i);
      const cls = [rt.queried && rt.queried.has(i) ? 'qd' : '', 'cell', i === 0 ? 'origin' : '', !has ? (unk ? 'unk' : 'blank') : '', rt.lastWrite === i && rt.lastWriteStep === run.steps ? 'w' : '', wh ? 'sent ' + wh.c : ''].join(' ');
      cells += `<div class="${cls}">${i % 5 === 0 ? `<span class="ix">${i}</span>` : ''}${has ? esc(v) : (unk ? '?' : '_')}</div>`;
    }
    el.querySelector('.cells').innerHTML = cells;
    const count = new Map(); let rows = 1;
    el.querySelector('.heads').innerHTML = hs.map(h => {
      const k = count.get(h.pos) || 0; count.set(h.pos, k + 1); rows = Math.max(rows, k + 1);
      return `<div class="head ${h.m.color} ${h.ghost ? 'ghost' : ''} ${h.top ? 'top' : ''}" style="left:calc(var(--cw) * ${h.pos - lo}); top:${k * 22}px"><span>${esc(h.label)}</span></div>`;
    }).join('');
    el.querySelector('.heads').style.height = (rows * 22) + 'px';
    let len = 0; while (rt.cells.has(len)) len++;
    let meta = t.kind === 'random' ? `seed ${t.seed} · ${rt.cells.size} coins drawn` : `n = ${len}`;
    if (t.kind === 'proof') meta = `${len} cells · ${rt.queried.size} queried`;
    if (t.kind === 'advice') meta = rt.adviceN != null ? `a(${rt.adviceN}) · ${len} symbol${len === 1 ? '' : 's'}` : meta;
    if (t.kind === 'channel') { const by = new Map(); for (const v of rt.who.values()) by.set(v.n, (by.get(v.n) || 0) + 1); meta = `${len} sent` + (by.size ? ' · ' + [...by].map(([k, v]) => `${k} ${v}`).join(' · ') : ''); }
    el.querySelector('[data-f=meta]').textContent = meta;
    const spin = hs.reduce((s, h) => s + h.pos, 0) * 30 + (rt.lastWriteStep || 0) * 0;
    el.querySelectorAll('[data-f=spin]').forEach(g => g.style.transform = `rotate(${spin}deg)`);
    el.querySelectorAll('[data-f=spinr]').forEach(g => g.style.backgroundPositionX = `${-spin / 30 * 4}px`);
    const top = hs.find(h => h.top);
    if (top) {
      const sc = el.querySelector('.tscroll'); const x = (top.pos - lo) * 30;
      if (x < sc.scrollLeft + 20 || x > sc.scrollLeft + sc.clientWidth - 50) sc.scrollLeft = Math.max(0, x - sc.clientWidth / 2);
    }
  }
}

function renderStack(t, el, rt, hs) {
  let len = 0; while (rt.cells.has(len)) len++;
  const show = len > STACK_SHOW ? STACK_SHOW - 1 : len; const hidden = len - show;
  let html = '';
  for (let i = len - 1; i >= len - show; i--) {
    const wh = rt.who && rt.who.get(i);
    html += `<div class="splate ${i === len - 1 ? 'top' : ''} ${rt.lastWrite === i && rt.lastWriteStep === run.steps ? 'w' : ''} ${wh ? 'sent ' + wh.c : ''}"><span class="ix">${i}</span>${esc(rt.cells.get(i))}</div>`;
  }
  if (hidden) html += `<div class="splate more">⋮ ${hidden} more below</div>`;
  if (!len) html = '<div class="splate none">empty</div>';
  const cells = el.querySelector('.cells'); if (cells.dataset.h !== html) { cells.innerHTML = html; cells.dataset.h = html; }
  // every head of a stack sits on its top: one tag per machine, pointing at the top plate
  const tags = [...new Map(hs.map(h => [h.label, h])).values()];
  const hd = el.querySelector('.heads'); const tp = cells.querySelector('.splate.top') || cells.lastElementChild;
  hd.style.top = (tp ? tp.offsetTop + 6 : 4) + 'px';
  hd.innerHTML = tags.map((h, k) => `<div class="head ${h.m.color} ${h.ghost ? 'ghost' : ''} ${h.top ? 'top' : ''}" style="top:${k * 18}px"><span>${esc(h.label)}</span></div>`).join('');
  el.querySelector('[data-f=meta]').textContent = len ? `depth ${len}` : 'empty';
}
function drawWires() {
  const plane = $('#world'); const box = plane.getBoundingClientRect(); const svg = $('#wires');
  svg.setAttribute('width', plane.offsetWidth); svg.setAttribute('height', plane.offsetHeight);
  let paths = '', dots = '';
  document.querySelectorAll('.jack[data-wire]').forEach(j => {
    const [mid, tid] = j.dataset.wire.split('|'); const m = machineById(mid);
    const tEl = document.querySelector(`.tape[data-tid="${tid}"]`); if (!tEl || !m) return;
    const tp = world.tapes.find(x => x.id === tid); if (m.hideWires || (tp && tp.hideWires)) return;
    const ji = j.querySelector('i').getBoundingClientRect(); const reel = tEl.querySelector('.reel').getBoundingClientRect(); const sc = tEl.querySelector('.tscroll').getBoundingClientRect();
    const Z = zoom; const x1 = (ji.left + ji.width / 2 - box.left) / Z, y1 = (ji.top + ji.height / 2 - box.top) / Z;
    const fr = tEl.querySelector('.feed-r'); const frb = fr && fr.getClientRects().length ? fr.getBoundingClientRect() : null;
    const ends = [{ x: (reel.left + reel.width / 2 - box.left) / Z, y: (reel.top + reel.height / 2 - box.top) / Z, d: -1 }, frb ? { x: (frb.left + frb.width / 2 - box.left) / Z, y: (frb.top + frb.height / 2 - box.top) / Z, d: 1 } : { x: (sc.right - box.left) / Z, y: (sc.top - box.top) / Z + 25, d: 1 }];
    const e = ends.reduce((b, c) => (Math.hypot(c.x - x1, c.y - y1) < Math.hypot(b.x - x1, b.y - y1) ? c : b));
    const dist = Math.hypot(e.x - x1, e.y - y1); const k = Math.max(40, dist / 2.5);
    const a = actFor(mid); const on = a && a.live && a.top && run.status === 'running'; const wait = a && a.live && !a.top;
    const sx = Math.sign(e.x - x1) || 1;
    const d = `M${x1},${y1} C${x1 + sx * k * 0.45},${y1 + Math.min(70, k * 0.6)} ${e.x + e.d * k},${e.y} ${e.x},${e.y}`;
    paths += `<path class="${m.color} ${on ? 'on' : ''} ${wait ? 'wait' : ''}" d="${d}"/>`;
    dots += `<circle class="${m.color}" cx="${e.x}" cy="${e.y}" r="4"/>`;
  });
  // calls between machines: oracle sockets and calls by name
  let links = '';
  const geo = el => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
  const drawn = new Set();
  for (const m of world.machines) {
    const c = m.compiled; if (!c || (c.kind !== 'prog' && c.kind !== 'tm') || m.hideWires) continue;
    const from = document.querySelector(`.mach[data-mid="${m.id}"]`); if (!from) continue;
    for (const n of (c.kind === 'tm' ? Object.values(c.calls || {}) : c.nodes.filter(x => x.op === 'call'))) {
      const tgt = n.socket ? machineById((m.links || {})[n.name]) : world.machines.find(x => x.name === n.name);
      const key = m.id + '>' + n.name; if (!tgt || drawn.has(key)) continue; drawn.add(key);
      const to = document.querySelector(`.mach[data-mid="${tgt.id}"]`); if (!to) continue;
      const A = geo(from), B = geo(to); let x1, y1;
      const sj = n.socket && from.querySelector(`.jack.sock[data-link="${m.id}|${n.name}"] i`);
      if (sj) { const r = sj.getBoundingClientRect(); x1 = (r.left + r.width / 2 - box.left) / zoom; y1 = (r.top + r.height / 2 - box.top) / zoom; }
      else { x1 = B.x > A.x ? A.x + A.w : A.x; y1 = A.y + 22; }
      const right = B.x + B.w / 2 >= x1; const x2 = right ? B.x : B.x + B.w, y2 = B.y + 22;
      if (tgt.id === m.id || tgt.hideWires) continue;
      const k = Math.max(50, Math.abs(x2 - x1) / 2);
      const live = run.stack.some(s => s.m.id === tgt.id) && run.stack.some(s => s.m.id === m.id);
      const c1x = sj ? x1 + (right ? 1 : -1) * k * 0.5 : x1 + (right ? k : -k), c1y = sj ? y1 + 60 : y1;
      links += `<path class="link ${m.color} ${live ? 'on' : ''}" d="M${x1},${y1} C${c1x},${c1y} ${x2 + (right ? -k : k)},${y2} ${x2},${y2}" marker-end="url(#linkArrow)"/>`;
      links += `<text class="linklabel ${m.color}" x="${(x1 + x2) / 2}" y="${Math.min(y1, y2) - 8 + Math.abs(y2 - y1) / 2}" text-anchor="middle">${esc(n.socket ? n.name : 'calls')}</text>`;
    }
  }
  // reductions: A → card → B, and a dotted line to each transducer
  let reds = '';
  const edge = (A, B) => { // from the side of A facing B
    const ax = A.x + A.w / 2, ay = A.y + A.h / 2, bx = B.x + B.w / 2, by = B.y + B.h / 2;
    if (Math.abs(bx - ax) > Math.abs(by - ay) * 1.2) return { x: bx > ax ? A.x + A.w : A.x, y: ay, dx: bx > ax ? 1 : -1, dy: 0 };
    return { x: ax, y: by > ay ? A.y + A.h : A.y, dx: 0, dy: by > ay ? 1 : -1 };
  };
  const curve = (P, Q, cls) => { const d = Math.max(40, Math.hypot(Q.x - P.x, Q.y - P.y) / 3); return `<path class="${cls}" d="M${P.x},${P.y} C${P.x + P.dx * d},${P.y + P.dy * d} ${Q.x + Q.dx * d},${Q.y + Q.dy * d} ${Q.x},${Q.y}" marker-end="url(#redArrow)"/>`; };
  for (const r of world.reductions || []) {
    const card = document.querySelector(`.red[data-rid="${r.id}"]`); if (!card || r.hideWires) continue; const C = geo(card);
    const hid = id => { const x = machineById(id); return !x || x.hideWires; };
    const aEl = r.from && !hid(r.from) && document.querySelector(`.mach[data-mid="${r.from}"]`), bEl = r.to && !hid(r.to) && document.querySelector(`.mach[data-mid="${r.to}"]`);
    if (aEl) { const A = geo(aEl); reds += curve(edge(A, C), edge(C, A), 'redline'); }
    if (bEl) { const B = geo(bEl); reds += curve(edge(C, B), edge(B, C), 'redline'); }
    for (const id of r.via) { const fEl = !hid(id) && document.querySelector(`.mach[data-mid="${id}"]`); if (!fEl) continue; const F = geo(fEl); const P = edge(C, F), Q = edge(F, C); reds += `<path class="redvia" d="M${P.x},${P.y} L${Q.x},${Q.y}"/>`; }
  }
  for (const d of world.devices || []) { // a device's lead to its tape
    if (d.hideWires) continue; const de = document.querySelector(`.dev[data-did="${d.id}"]`), te = d.tape && document.querySelector(`.tape[data-tid="${d.tape}"] .reel`); if (!de || !te) continue;
    const a = de.getBoundingClientRect(), b = te.getBoundingClientRect(), Z = zoom;
    const x1 = (a.left + a.width / 2 - box.left) / Z, y1 = (a.top + a.height / 2 - box.top) / Z, x2 = (b.left + b.width / 2 - box.left) / Z, y2 = (b.top + b.height / 2 - box.top) / Z;
    reds += `<path class="devline" d="M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}"/>`;
  }
  svg.innerHTML = `<defs><marker id="linkArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="linkhead"/></marker><marker id="redArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="redhead"/></marker></defs>` + reds + paths + links + dots;
}

let consoleOpen = !narrow();
function renderConsole() {
  $('#consoleBody').hidden = !consoleOpen; $('#consoleToggle').textContent = consoleOpen ? '▾' : '▴';
  $('#consoleToggle').setAttribute('aria-label', consoleOpen ? 'Collapse console' : 'Expand console');
  const S = run.stack; const cut = S.length > 9 ? [3, S.length - 5] : null;
  const frames = S.map((a, i) => {
    if (cut && i >= cut[0] && i < cut[1]) return i === cut[0] ? `<span>›</span><span class="note" style="display:inline">${cut[1] - cut[0]} more</span>` : '';
    return `${i ? '<span>›</span>' : ''}<span class="frame ${a.m.color} ${i === S.length - 1 ? 'top' : ''} ${a.m.guest ? 'guest' : ''}" ${a.m.guest ? 'title="A simulated machine: its description is on a tape"' : ''}>${a.m.guest ? '⟨' + esc(a.m.name) + '⟩' : esc(a.m.name)}</span>`;
  }).join('');
  const to = treeOutcome();
  const fin = to ? `<span class="pill ${to.cls}">${to.text}</span>` : run.status === 'halted' ? `<span class="pill ${run.result}">${run.result === 'accept' ? 'accepted' : run.result === 'reject' ? 'rejected' : run.result}</span>` : '';
  const treeBtn = tree || run.status === 'branch' ? `<button class="btn small" data-act="openTree">Tree</button>` : '';
  $('#stackMini').innerHTML = consoleOpen ? '' : (frames || fin) + treeBtn;
  if (!consoleOpen) return;
  $('#stack').innerHTML = (frames || '<span class="note">empty</span>') + (treeBtn ? ' ' + treeBtn.replace('>Tree<', '>Computation tree<') : '');
  $('#result').innerHTML = to ? `${fin} <span class="note" style="display:inline">the whole computation tree${tree.decision ? ': ' + esc(tree.decision.why) : ''}. The log below is the branch on show${run.status === 'halted' ? `, which ${run.result === 'accept' ? 'accepted' : run.result === 'reject' ? 'rejected' : 'stopped: ' + esc(run.result)}` : ''}.</span>` : run.status === 'halted' ? `${fin} <span class="note" style="display:inline">${esc(run.reason || '')} · ${run.steps} total steps</span>` : '';
  $('#log').innerHTML = run.log.slice().reverse().map(l => `<div><span>${l.step}</span>${esc(l.s)}</div>`).join('');
}

// ---------- shared highlighting ----------
function highlightGraph(box, map, a, pfx, scroll) {
  if (!box || !map) return;
  box.querySelectorAll('.on').forEach(e => e.classList.remove('on'));
  box.querySelectorAll(`path[marker-end="url(#${pfx}ahon)"]`).forEach(p => p.setAttribute('marker-end', `url(#${pfx}ah)`));
  if (!a) return;
  const act = a.act, c = act.c; const on = [], es = [];
  if (c.kind === 'nfa') { act.set.forEach(s => on.push(map.get(s))); if (act.last) act.last.edges.forEach(e => es.push(map.get(e.from) + '-' + map.get(e.to))); }
  else if (c.kind === 'prog') { on.push(map.get(act.pc)); if (act.last && act.last.to != null) es.push(map.get(act.last.from) + '-' + map.get(act.last.to)); }
  else { on.push(map.get(act.state)); if (act.last) es.push(map.get(act.last.from) + '-' + map.get(act.last.to)); }
  let first = null;
  on.forEach(i => { const g = box.querySelector(`[data-n="${i}"]`); if (g) { g.classList.add('on'); first = first || g; } });
  es.forEach(k => { const g = box.querySelector(`[data-e="${k}"]`); if (g) { g.classList.add('on'); g.querySelector('path').setAttribute('marker-end', `url(#${pfx}ahon)`); } });
  if (scroll && first && (playing || a.live)) {
    const r = first.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r.top < b.top || r.bottom > b.bottom) box.scrollTop += r.top - b.top - b.height / 2;
    if (r.left < b.left || r.right > b.right) box.scrollLeft += r.left - b.left - b.width / 2;
  }
}
function highlightCode(box, a) {
  if (!box) return;
  box.querySelectorAll('.on').forEach(e => e.classList.remove('on'));
  if (!a || a.act.c.kind !== 'prog') return;
  const n = a.act.c.nodes[a.act.pc]; if (!n || !n.line) return;
  const ln = box.querySelector(`[data-line="${n.line}"]`); if (!ln) return;
  ln.classList.add('on');
  const top = ln.offsetTop - box.offsetTop;
  if (top < box.scrollTop + 8 || top > box.scrollTop + box.clientHeight - 24) box.scrollTop = Math.max(0, top - box.clientHeight / 2);
}

// ---------- windows ----------
function openWin(type, id) {
  const key = type + ':' + id;
  if (narrow()) for (const k of [...wins.keys()]) if (k !== key) closeWin(k);
  let w = wins.get(key);
  if (!w) {
    const m = type === 'machine' ? machineById(id) : null;
    w = { key, type, id, tab: m && m.error ? 'source' : (type === 'machine' ? 'source' : null), editing: false, editText: '', editErr: '', labHTML: '', toolMsg: '' };
    const el = document.createElement('div'); el.className = 'win'; el.dataset.win = key; $('#layer').appendChild(el); w.el = el; wins.set(key, w);
    const src = type === 'dev' ? document.querySelector(`.dev[data-did="${id}"]`) : type === 'red' ? document.querySelector(`.red[data-rid="${id}"]`) : type === 'tree' || type === 'st' || type === 'io' ? null : document.querySelector(type === 'machine' ? `.mach[data-mid="${id}"]` : `.tape[data-tid="${id}"]`);
    const L = $('#layer').getBoundingClientRect();
    let x = 16, y = 16;
    if (type === 'tree') { x = L.width - 470; y = 64; }
    if (type === 'io') { x = (L.width - 460) / 2; y = 60; }
    if (type === 'st') { const te = document.querySelector(`.tape[data-tid="${id}"]`); if (te) { const r = te.getBoundingClientRect(); x = r.left - L.left; y = r.bottom - L.top + 12; } }
    if (src) { const r = src.getBoundingClientRect(); x = r.right - L.left + 18; if (x + 450 > L.width - 8) x = r.left - L.left - 468; y = r.top - L.top; }
    w.x = Math.max(8, Math.min(x, L.width - 458)); w.y = Math.max(8, Math.min(y, L.height - 320));
    while ([...wins.values()].some(o => o !== w && Math.abs((o.x || 0) - w.x) < 12 && Math.abs((o.y || 0) - w.y) < 12)) { w.x += 28; w.y += 28; }
    el.style.left = w.x + 'px'; el.style.top = w.y + 'px';
  }
  w.el.style.zIndex = ++winZ; if (type !== 'tree' && type !== 'st' && type !== 'io' && type !== 'red') { selId = id; markSelection(); } renderWin(w);
}
function closeWin(key) { const w = wins.get(key); if (!w) return; w.el.remove(); wins.delete(key); if (key === 'tree:tree' && $('#bTree')) $('#bTree').classList.remove('on'); if (selId === w.id) { selId = null; markSelection(); } }
function renderWins() { for (const w of [...wins.values()]) renderWin(w); }
function winOf(el) { const e = el.closest('.win'); return e ? wins.get(e.dataset.win) : null; }

const TRASH_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 9h6.6l.7-9M6.8 7v4.5M9.2 7v4.5"/></svg>';
function delBtn(act, what) { return `<button class="ib del" data-act="${act}" title="Delete ${what} (Undo brings it back)" aria-label="Delete ${what}">${TRASH_SVG}</button>`; }
function renderWin(w) {
  const ta = w.el.querySelector('textarea.edit'); if (ta && w.editing) w.editText = ta.value;
  if (w.type === 'io') { w.el.className = 'win iowin'; w.el.innerHTML = ioHTML(); return; }
  if (w.type === 'dev') {
    const d = devById(w.id); if (!d) return closeWin(w.key);
    w.el.className = 'win devwin';
    w.el.innerHTML = `<div class="wtitle"><b>${esc(d.name || DEV_KINDS[d.kind])}</b><span class="kind">${esc(DEV_KINDS[d.kind].toLowerCase())}</span>${delBtn('devDelete', 'device')}<button class="ib" data-act="close" aria-label="Close">×</button></div><div class="wbody">${devBody(w, d)}</div>`;
    return;
  }
  if (w.type === 'red') {
    const r = redById(w.id); if (!r) return closeWin(w.key);
    const sc = w.el.querySelector('.wbody'); const st = sc ? sc.scrollTop : 0;
    w.el.className = 'win redwin';
    w.el.innerHTML = `<div class="wtitle"><b>${esc(redTitle(r))}</b><span class="kind">reduction</span>${delBtn('redDelete', 'reduction')}<button class="ib" data-act="close" aria-label="Close">×</button></div><div class="wbody">${redBody(w, r)}</div>`;
    const nb = w.el.querySelector('.wbody'); if (nb) nb.scrollTop = st;
    return;
  }
  if (w.type === 'st') {
    const t = tapeById(w.id); if (!t) return closeWin(w.key);
    w.el.className = 'win stwin'; w.stKey = '';
    w.el.innerHTML = `<div class="wtitle"><b>Space-time · ${esc(t.name)}</b><span class="kind">tableau</span><button class="ib" data-act="close" aria-label="Close">×</button></div>
      <div class="wbody"><p class="note">Each row is the tape after one step: time runs down, cells run across. Colored cells are heads, tinted cells were just written. Click a row to travel to that step.</p>
      <div class="stbox" data-r="stbox"><canvas aria-label="Space-time diagram of tape ${esc(t.name)}"></canvas></div>
      <p class="note">This grid is the <b>tableau</b> from the Cook–Levin theorem. Each cell depends only on the few cells just above it, so checking a whole run is a local, uniform job. That is why a polynomial-time machine can be turned into a polynomial-size circuit, and why SAT is NP-complete.</p>
      <p class="note" data-r="stinfo"></p></div>`;
    updateSt(w); return;
  }
  if (w.type === 'tree') {
    w.el.className = 'win treewin';
    w.el.innerHTML = `<div class="wtitle"><b>Computation tree</b><span class="kind">nondeterminism</span><button class="ib" data-act="close" aria-label="Close">×</button></div><div class="wbody">${treeBody()}</div>`;
    updateTreeWin(w); return;
  }
  if (w.type === 'tape') {
    const t = tapeById(w.id); if (!t) return closeWin(w.key);
    w.el.className = 'win';
    if (w.tab !== 'tools') w.tab = 'tape';
    const tabs = [['tape', 'Tape'], ['tools', 'Tools']];
    w.el.innerHTML = `<div class="wtitle"><b>${esc(t.name)}</b><span class="kind">${t.kind === 'cert' ? 'certificate' : t.kind} tape</span>${delBtn('delt', 'tape')}<button class="ib" data-act="close" aria-label="Close">×</button></div>
      <div class="wtabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${w.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div><div class="wbody">${w.tab === 'tools' ? tapeTools(w, t) : tapeBody(w, t)}</div>`;
    return;
  }
  const m = machineById(w.id); if (!m) return closeWin(w.key);
  w.el.className = 'win ' + m.color;
  const tabs = [['source', { prog: 'Program', script: 'Script', circuit: 'Circuit', regex: 'Expression', cfg: 'Grammar' }[m.kind] || 'Table'], ['graph', m.kind === 'circuit' ? 'Diagram' : 'State graph'], ['wiring', 'Wiring'], ['budgets', m.compiled && m.compiled.nondet ? 'Class & budgets' : 'Budgets'], ['tools', 'Tools']];
  if (w.tab === 'setup') w.tab = 'wiring';
  const scroll = w.el.querySelector('.wbody'); const st = scroll ? scroll.scrollTop : 0;
  w.el.innerHTML = `<div class="wtitle"><span class="led" data-f="led"></span><b>${esc(m.name)}</b><span class="kind">${KIND_LABEL[m.kind]}</span>${m.id === world.targetId ? '<span class="tgt">RUN</span>' : ''}${delBtn('delm', 'machine')}<button class="ib" data-act="close" aria-label="Close">×</button></div>
    <div class="wtabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${w.tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="wbody">${machineBody(w, m)}<dl class="live" data-r="live"></dl></div>`;
  if (w.tab === 'graph' && m.compiled) { /* map stored in machineBody */ }
  const nb = w.el.querySelector('.wbody'); if (nb && !w.editing) nb.scrollTop = st;
  markAllBps();
  updateWinLive(w);
}

function machineBody(w, m) {
  const c = m.compiled;
  if (w.tab === 'source') {
    if (w.editing) return `<textarea class="edit" spellcheck="false" aria-label="Machine source">${esc(w.editText)}</textarea>
      ${w.editErr ? `<div class="err">${esc(w.editErr)}</div>` : ''}
      <div class="row"><button class="btn primary small" data-act="apply">Apply</button><button class="btn small" data-act="cancel">Cancel</button><span class="note">Ctrl/⌘ + Enter applies</span></div>
      ${helpHTML()}`;
    let info = '';
    if (c) {
      if (c.kind === 'prog') info = `${c.nodes.length} control nodes × registers = <b>${c.productStates.toLocaleString()}</b> finite states${c.dialect ? ' · dialect <b>dfa</b>' : ''}`;
      else if (m.kind === 'regex') info = `Thompson’s construction: an NFA with <b>${c.states.length}</b> states and ε-moves. Run it, or convert it in the Tools tab.`;
      else if (m.kind === 'cfg') { const g = c.grammar; info = `${g.prods.length} rules · ${g.nts.length} nonterminals · ${g.terms.length} terminals · ` + (g.rightLinear ? '<b>right-linear, so regular</b>: it runs as an NFA with one state per nonterminal, no stack needed' : `<b>context-free</b>: it runs as the standard PDA, expanding the leftmost nonterminal on top of the stack, so each branch is a leftmost derivation${c.searchRules && c.searchRules.derived ? '. To make every branch end, it searches an equivalent grammar without ε-rules' + (c.searchRules.cyclic ? ' or unit cycles' : '') + '; each step names the rule it came from' : ''}`); }
      else if (c.kind === 'pda') info = `${c.states.length} states · ${c.rules.length} rules · ${c.nondet ? 'nondeterministic: rules overlap, so runs branch' : 'deterministic (a DPDA)'} · accepts by ${c.byEmpty ? 'empty stack' : 'final state'}`;
      else if (c.kind === 'tm') info = `${c.states.length} states · ${c.rules.length} rules · ${c.ports.length} tape${c.ports.length > 1 ? 's' : ''}`;
      else if (c.kind === 'script') info = 'Free-form JavaScript, run as one opaque step. Its time and space are not certified.';
      else if (c.kind === 'circuit') info = c.circ ? `${c.circ.size} gates · depth ${c.circ.depth} · ${c.circ.nIn} inputs` : `gates are read from tape port <b>${esc(c.fromTape)}</b> when the circuit runs`;
      else info = `${c.states.length} states · alphabet {${c.alphabet.join(', ')}}`;
    }
    return `${m.error ? `<div class="err">${esc(m.error)}</div>` : ''}${info ? `<p class="note">${info}</p>` : ''}
      <div class="code" data-r="code">${highlightSrc(m.src)}</div>
      ${m.kind === 'prog' ? '<p class="note">Click a line number to set a breakpoint: Run pauses when that line is reached.</p>' : ''}
      <div class="row"><button class="btn small" data-act="edit">Edit ${{ prog: 'program', script: 'script', circuit: 'circuit' }[m.kind] || 'table'}</button></div>`;
  }
  if (w.tab === 'graph') {
    if (!c) return `<div class="err">Fix the source first: ${esc(m.error)}</div>`;
    if (c.kind === 'script') return '<p class="note">A script has no state graph: it runs as one opaque step, so the world can neither show nor certify what happens inside it.</p>';
    if (c.kind === 'circuit') return `<div class="graphbox circbox" data-r="cbox" data-circ="w${m.id}"></div><p class="note">Lit gates output 1, dark gates 0. The double-bordered gate is the output. Size counts gates; depth is the longest input-to-output path, the circuit's parallel time.</p>`;
    const g = graphSVG(m, 'w' + m.id); w.map = g.idx;
    return `<div class="graphbox" data-r="gbox" data-pfx="w${m.id}">${g.svg}</div><p class="note">${m.kind === 'prog' ? 'Each box is one step of the compiled control graph.' : 'Double circle = accepting state.'} Click a ${m.kind === 'prog' ? 'box' : 'state'} to set a breakpoint.</p>`;
  }
  if (w.tab === 'wiring') {
    const ports = c ? c.ports : [];
    const opts = cur => `<option value="">— not wired —</option>` + world.tapes.map(t => `<option value="${t.id}" ${t.id === cur ? 'selected' : ''}>${esc(t.name)}${t.kind !== 'normal' ? ` (${t.kind === 'cert' ? 'certificate' : t.kind})` : ''}</option>`).join('');
    return `${m.kind !== 'prog' && m.kind !== 'script' && m.kind !== 'circuit' ? `<label class="field"><span class="lbl">Name (used by call)</span><input data-field="name" value="${esc(m.name)}"></label>` : `<p class="note">The name comes from the first line of the source.</p>`}
      <div class="row">${m.id !== world.targetId ? `<button class="btn small" data-act="target">Make this the run target</button>` : '<span class="note keep">This machine is the run target.</span>'}</div>
      ${ports.length ? `<div class="sec"><span class="lbl">Tape ports</span>${ports.map(p => `<div class="row"><span style="font-family:var(--f-mono);min-width:6ch">${esc(p.name)}</span><select class="inp" data-field="bind:${esc(p.name)}" style="flex:1" aria-label="Tape for port ${esc(p.name)}">${opts(m.bind[p.name])}</select></div>`).join('')}</div>` : ''}
      ${c && c.sockets && c.sockets.length ? `<div class="sec"><span class="lbl">Oracle sockets</span><p class="note">Each <b>call</b> to a socket runs whichever machine is plugged in here.</p>${c.sockets.map(s => `<div class="row"><span style="font-family:var(--f-mono);min-width:6ch">${esc(s)}</span><select class="inp" data-field="link:${esc(s)}" style="flex:1" aria-label="Machine for socket ${esc(s)}"><option value="">— empty —</option>${world.machines.filter(x => x !== m).map(x => `<option value="${x.id}" ${(m.links || {})[s] === x.id ? 'selected' : ''}>${esc(x.name)}${x.role === 'prover' ? ' (prover)' : ''}</option>`).join('')}</select></div>`).join('')}</div>` : ''}
      <div class="sec"><span class="lbl">When other machines call it</span>
        <label class="check"><input type="checkbox" data-field="oracle" ${m.oracle ? 'checked' : ''}> Oracle: each call costs the caller 1 step, whatever it runs inside</label>
        <label class="check"><input type="checkbox" data-field="prover" ${m.role === 'prover' ? 'checked' : ''}> Unbounded prover: callers are not charged for its steps, and its budgets are ignored</label></div>
      <label class="check"><input type="checkbox" data-field="hideWires" ${m.hideWires ? 'checked' : ''}> Hide this machine's wires and arrows</label>`;
  }
  if (w.tab === 'budgets') {
    const kinds = new Set(Object.values(m.bind || {}).map(id => { const t = tapeById(id); return t && t.kind; }));
    const rand = kinds.has('random') || !!m.budgetRand, query = kinds.has('proof') || !!m.budgetQuery;
    const sim = c && c.kind === 'prog' && c.nodes.some(n => n.op === 'simulate');
    return `${c && c.nondet ? altHTML(m) : ''}
      ${m.kind === 'circuit' ? circuitBudgetHTML(m) : `<div class="sec"><span class="lbl">Resource budgets</span>
        <div class="row"><label class="field"><span class="note keep">time ≤ f(n)</span><input data-field="bTime" value="${esc(m.budgetTime)}" placeholder="e.g. n^2 + 5"></label>
        <label class="field"><span class="note keep">space ≤ f(n)</span><input data-field="bSpace" value="${esc(m.budgetSpace)}" placeholder="e.g. 2*log(n)"></label></div>
        ${rand || query ? `<div class="row">${rand ? `<label class="field"><span class="note keep">random bits ≤ r(n)</span><input data-field="bRand" value="${esc(m.budgetRand || '')}" placeholder="e.g. log(n)"></label>` : ''}
        ${query ? `<label class="field"><span class="note keep">proof queries ≤ q(n)</span><input data-field="bQuery" value="${esc(m.budgetQuery || '')}" placeholder="e.g. 3"></label>` : ''}</div>
        <p class="note">${rand ? 'Random bits are the distinct coins it reads. ' : ''}${query ? 'Queries are the distinct cells of proof tapes it reads. ' : ''}${rand && query ? 'With both set the machine is a PCP(r, q) verifier.' : ''}</p>` : ''}
        <p class="note">n is the length of the run target's input. A run that goes over a budget is stopped and rejected. ${!rand ? 'A budget for random bits appears once the machine is wired to a random tape' + (!query ? ', and one for proof queries once it is wired to a proof tape.' : '.') : !query ? 'A budget for proof queries appears once the machine is wired to a proof tape.' : ''}</p>
      </div>`}
      ${sim ? simCostHTML(m) : ''}`;
  }
  return toolsBody(w, m);
}

const ALT_PRESETS = {
  np: { label: 'NP = Σ₁: exists only', mode: 'E', blocks: '1', start: 'E' },
  conp: { label: 'coNP = Π₁: forall only', mode: 'A', blocks: '1', start: 'A' },
  s2: { label: 'Σ₂: ∃ then ∀', mode: 'E', blocks: '2', start: 'E' },
  p2: { label: 'Π₂: ∀ then ∃', mode: 'A', blocks: '2', start: 'A' },
  s3: { label: 'Σ₃: ∃ ∀ ∃', mode: 'E', blocks: '3', start: 'E' },
  p3: { label: 'Π₃: ∀ ∃ ∀', mode: 'A', blocks: '3', start: 'A' },
  ap: { label: 'AP = PSPACE: unbounded alternation', mode: 'E', blocks: '', start: '' },
};
const ACC_MODES = { exists: '∃ / ∀ (some path; alternation)', count: '#P: count accepting paths', majority: 'PP: accept with probability > 1/2', bpp: 'BPP-style: probability ≥ 2/3 or ≤ 1/3', parity: '⊕P: odd number of accepting paths' };
function altLabel(m) {
  const am = m.accMode || 'exists';
  if (am !== 'exists') return { count: '#P', majority: 'PP', bpp: 'BPP', parity: '⊕P' }[am];
  if (m.compiled && m.compiled.kind === 'pda' && !m.altBlocks && (m.altMode || 'E') === 'E') return 'CFL';
  const k = m.altBlocks ? parseInt(m.altBlocks, 10) : null; const sub = '₀₁₂₃₄₅₆₇₈₉';
  const c = m.compiled; let qs;
  if (c && c.kind === 'tm') { qs = new Set(); if (c.universal.size) qs.add('A'); if (c.existential.size) qs.add('E'); if (!qs.size) qs.add(m.altMode || 'E'); }
  else if (c && c.kind === 'prog') qs = new Set(c.nodes.filter(n => n.op === 'choose').map(n => n.q || m.altMode || 'E'));
  else qs = new Set([m.altMode || 'E']);
  if (k == null && qs.size === 1) return qs.has('A') ? 'coNP' : 'NP';   // only one kind of choice: one block
  if (k == null) return 'AP';
  const s = m.altStart || m.altMode || 'E'; const ks = String(k).split('').map(d => sub[+d]).join('');
  if (k === 1) return s === 'A' ? 'coNP' : 'NP';
  return (s === 'A' ? 'Π' : 'Σ') + ks;
}
function altHTML(m) {
  const cur = Object.entries(ALT_PRESETS).find(([, p]) => p.mode === (m.altMode || 'E') && p.blocks === (m.altBlocks || '') && p.start === (m.altStart || ''));
  const o = (v, curv, l) => `<option value="${v}" ${v === curv ? 'selected' : ''}>${l}</option>`;
  const am = m.accMode || 'exists';
  const accSel = `<label class="field"><span class="note">How the computation tree decides</span><select data-field="accMode">${Object.entries(ACC_MODES).map(([k, l]) => o(k, am, l)).join('')}</select></label>`;
  if (am !== 'exists') return `<div class="sec"><span class="lbl">Nondeterminism and acceptance</span>${accSel}
    ${am === 'count' ? `<label class="field" style="flex:0 0 160px"><span class="note">accept when the count is at least</span><input type="number" min="1" max="999" data-field="countK" value="${esc(m.countK || '1')}"></label>` : ''}
    <p class="note">Every choice forks the computation. #P and ⊕P count accepting paths; PP and BPP use the probability of acceptance, with every choice a fair coin (or die) over its options. ${{ count: 'The answer is the number of accepting paths (a #P function); the machine accepts when that number reaches the threshold, so threshold 1 is NP again.', majority: 'Accepts when the probability of acceptance is more than 1/2. PP is not bounded away from 1/2, so a tiny change in probability can flip the answer.', bpp: 'Accepts when the probability of acceptance is at least 2/3 and rejects at 1/3 or less. In between there is no clear answer (it counts as a rejection): a BPP machine must never land there.', parity: 'Accepts when the number of accepting paths is odd. ⊕P counts modulo 2.' }[am]} Exists and forall both count as ordinary branches here, so the alternation budget does not apply.</p>
  </div>`;
  return `<div class="sec"><span class="lbl">Nondeterminism and alternation</span>
    ${accSel}
    <label class="field"><span class="note">Class preset</span><select data-field="altPreset"><option value="">custom</option>${Object.entries(ALT_PRESETS).map(([k, p]) => o(k, cur && cur[0], p.label)).join('')}</select></label>
    <div class="row">
      <label class="field"><span class="note">${m.kind === 'tm' ? 'unmarked branching states mean' : 'plain choose / guess means'}</span><select data-field="altMode">${o('E', m.altMode || 'E', '∃ exists')}${o('A', m.altMode || 'E', '∀ forall')}</select></label>
      <label class="field" style="flex:0 0 110px"><span class="note">quantifier blocks ≤</span><input type="number" min="1" max="20" data-field="altBlocks" value="${esc(m.altBlocks || '')}" placeholder="any"></label>
      <label class="field"><span class="note">first block</span><select data-field="altStart">${o('', m.altStart || '', 'either')}${o('E', m.altStart || '', '∃')}${o('A', m.altStart || '', '∀')}</select></label>
    </div>
    <p class="note">A quantifier block is a run of choices of the same kind along one branch. Σₖ allows k blocks starting with ∃; Πₖ starts with ∀. A branch that alternates more than allowed is rejected. With a polynomial time budget this places the machine in the polynomial hierarchy; with no block limit it is AP, which equals PSPACE.</p>
  </div>`;
}
const CIRCUIT_PRESETS = {
  nc1: { label: 'NC¹ — depth O(log n), fan-in 2', size: 'n^3', depth: '2*log(n) + 2', fanin: '2' },
  ac0: { label: 'AC⁰ — constant depth, unbounded fan-in', size: 'n^3', depth: '4', fanin: '' },
  ppoly: { label: 'P/poly — polynomial size', size: 'n^3', depth: '', fanin: '2' },
};
function circuitBudgetHTML(m) {
  const cur = Object.entries(CIRCUIT_PRESETS).find(([, p]) => p.size === (m.budgetSize || '') && p.depth === (m.budgetDepth || '') && p.fanin === (m.budgetFanin || ''));
  return `<div class="sec"><span class="lbl">Circuit budgets</span>
    <label class="field"><span class="note">Preset</span><select data-field="preset"><option value="">custom</option>${Object.entries(CIRCUIT_PRESETS).map(([k, p]) => `<option value="${k}" ${cur && cur[0] === k ? 'selected' : ''}>${p.label}</option>`).join('')}</select></label>
    <div class="row"><label class="field"><span class="note">size ≤ f(n)</span><input data-field="bSize" value="${esc(m.budgetSize || '')}" placeholder="e.g. n^3"></label>
    <label class="field"><span class="note">depth ≤ f(n)</span><input data-field="bDepth" value="${esc(m.budgetDepth || '')}" placeholder="e.g. 2*log(n)"></label>
    <label class="field" style="flex:0 0 96px"><span class="note">fan-in ≤</span><input data-field="bFanin" type="number" min="1" max="64" value="${esc(m.budgetFanin || '')}" placeholder="any"></label></div>
    <p class="note">n is the length of the input tape. Budgets are checked when the circuit is built, before any gate runs: a circuit over budget is rejected. A circuit runs one layer per step, so depth is its parallel time.</p>
  </div>`;
}

const SIM_MODELS = { free: 'Free (idealized): 1 step per simulated step', multi: 'Multi-tape universal machine: |⟨M⟩| + log t per step', single: 'Single-tape universal machine: |⟨M⟩| + cells in use per step' };
function simCostHTML(m) {
  const s = m.sim || {}; const o = (v) => `<option value="${v}" ${(s.model || 'free') === v ? 'selected' : ''}>${SIM_MODELS[v]}</option>`;
  return `<div class="sec"><span class="lbl">Simulation cost</span>
    <label class="field"><span class="note">How simulate charges this machine for each step of the machine it simulates</span><select data-field="simModel">${o('free')}${o('multi')}${o('single')}</select></label>
    <label class="check"><input type="checkbox" data-field="simTime" ${s.timeCheck ? 'checked' : ''}> Charge for enforcing time bounds: compute f(n) in binary (n + log² f steps) and decrement a step counter (2 per step)</label>
    <label class="check"><input type="checkbox" data-field="simSpace" ${s.spaceCheck ? 'checked' : ''}> Charge for enforcing space bounds: mark off f(n) cells (time and space) and keep a loop counter of log(#configurations) cells (2 per step)</label>
    <label class="check"><input type="checkbox" data-field="simLoop" ${s.loopDetect ? 'checked' : ''}> Detect loops in space-bounded simulations: when a configuration repeats, cut the run off and charge the steps the loop counter would need to overflow</label>
    <p class="note">Unticked parts are free, as if the engine did them. Charges are an accounting model, not extra animation: the step counter keeps counting what actually ran, while the charged time (and the T meter and budgets) includes the overhead. A simulated machine uses the settings of the world machine with its name, so nested simulations compound: each level pays its model's overhead on the level below, overhead included.</p>
  </div>`;
}
function adviceNow(t) {
  const rt = run && run.tapes.get(t.id); const n = rt && rt.adviceN != null ? rt.adviceN : null; if (n == null) return '';
  let s = ''; for (let i = 0; rt.cells.has(i); i++) s += rt.cells.get(i);
  return `a(${n}) = ${esc(s || 'ε')} (${s.length} symbols)`;
}
const TAPE_KINDS = { normal: 'normal', cert: 'certificate', random: 'random coins', stack: 'stack', channel: 'channel', proof: 'proof', advice: 'advice' };
function tapeBody(w, t) {
  const plain = t.kind !== 'random' && t.kind !== 'advice';
  return `<div class="row"><label class="field"><span class="lbl">Name</span><input data-field="tName" value="${esc(t.name)}"></label>
      <label class="field"><span class="lbl">Kind</span><select data-field="tKind">${Object.entries(TAPE_KINDS).map(([k, l]) => `<option value="${k}" ${t.kind === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
    ${t.kind === 'random' ? '' : `<label class="field"><span class="lbl">Alphabet</span><input data-field="tAlpha" value="${esc(t.alphabet)}" spellcheck="false" placeholder="e.g. 01"></label>
    <p class="note">The symbols this tape is meant to hold, one character each. Random inputs, witness search and the language tools draw from it.</p>`}
    ${t.kind === 'proof' ? '<p class="note">A proof for a probabilistic verifier, fixed before it runs: verifiers read it but cannot write it (machines with the prover role can). <b>seek t a</b> jumps the head to the cell whose number is on tape a in binary, or in a register. Every distinct cell a verifier reads is one <b>query</b>; queried cells are outlined.</p>' : ''}
    ${t.kind === 'advice' ? `<label class="field"><span class="lbl">Advice a(n): lines like 3: 101, or a function (n) =&gt; ...</span><textarea class="edit gen" data-field="tAdvice" spellcheck="false" aria-label="Advice">${esc(t.advice || '')}</textarea></label>
      <div class="row"><label class="field" style="flex:0 0 160px"><span class="lbl">Length ≤ f(n)</span><input data-field="tAdvMax" value="${esc(t.adviceMax || '')}" placeholder="e.g. n^2"></label><span class="note keep" style="align-self:flex-end">${adviceNow(t)}</span></div>
      <p class="note">Machines read the advice but cannot compute it: when a run starts the tape is filled with a(n), where n is the length of the run target's input. Polynomial time with polynomially long advice is P/poly.</p>` : ''}
    ${t.kind === 'channel' ? '<p class="note">A channel between machines: append-only. <b>send ch x</b> (io.send in scripts) adds one symbol at the end, coloured by the machine that sent it; anyone wired to it can read the transcript. The label counts the symbols each machine sent: that is the communication cost.</p>' : ''}
    ${t.kind === 'random' ? `<label class="check"><input type="checkbox" data-field="tPublic" ${t.public ? 'checked' : ''}> Public coins: provers may read these coins (Arthur–Merlin). Unticked, the coins are private, and a machine with the prover role that tries to read them gets an error.</label>
      <div class="row"><span class="note keep">seed ${t.seed}</span><button class="btn small" data-act="reroll">Re-roll coins</button></div>` : ''}
    ${t.kind === 'stack' ? '<p class="note">A stack: cell 0 is the bottom and the head sits on the top symbol. Machines may only <b>push</b> and <b>pop</b> (a PDA does so through its rules), and read(t) reads the top, or _ when the stack is empty.</p>' : ''}
    ${plain ? `<label class="field"><span class="lbl">Initial contents (from cell 0, _ = blank)</span><input data-field="tInit" value="${esc(t.init)}" spellcheck="false"></label>
    <label class="field"><span class="lbl">Current contents</span><input data-field="tCur" data-r="tcur" value="${esc(currentTapes()[t.id] ?? '')}" spellcheck="false"></label>
    <div class="row"><button class="btn small" data-act="tKeep">Keep current contents</button><span class="note">Makes what the tape holds now its initial contents, so Reset keeps it.</span></div>
    <p class="note">Editing the current contents restarts the run on every tape as it is now, with your change. Reset still restores the initial contents.</p>` : t.kind === 'random' ? `<p class="note">Cells hold fair coin flips, drawn the first time a head reads them. Heads on a random tape are read-only and one-way, and keep their position between calls, so every call sees fresh coins.</p>` : ''}
    <label class="check"><input type="checkbox" data-field="tHide" ${t.hideWires ? 'checked' : ''}> Hide the wires to this tape</label>
    ${w.toolMsg ? `<div class="labout">${w.toolMsg}</div>` : ''}`;
}
function tapeTools(w, t) {
  const tgt = machineById(world.targetId); const plain = t.kind !== 'random' && t.kind !== 'advice';
  return `<div class="sec"><span class="lbl">Space-time diagram</span><p class="note">Every step of the run as one row of this tape, so you can see how its contents evolve.</p><div class="row"><button class="btn small" data-st="${t.id}">Open diagram</button></div></div>
    ${plain ? `<div class="sec"><span class="lbl">Machines as data</span><div class="row"><select class="inp" data-r="descm" style="flex:1" aria-label="Machine to describe">${world.machines.filter(x => x.compiled && x.kind !== 'script').map(x => `<option value="${x.id}">⟨${esc(x.name)}⟩ · ${encodeMachine(x).length} cells</option>`).join('')}</select><button class="btn small" data-act="tDesc">Write description</button></div>
      <p class="note">Puts a machine's description ⟨M⟩ on this tape as its initial contents: its source without comments, one character per cell (· is a space, ¶ a line break, ␣ an underscore). <b>simulate</b> runs a description; any machine can read it as plain input.</p></div>` : ''}
    ${t.kind === 'cert' ? `<div class="sec"><span class="lbl">Witness search</span><div class="row" style="align-items:flex-end"><label class="field" style="flex:0 0 110px"><span class="note keep">max length</span><input data-field="tMax" type="number" min="0" max="16" value="${t.maxLen}"></label><button class="btn small primary" data-act="witness">Find witness</button></div>
      <p class="note">Acts as an unbounded prover: it tries every string over the alphabet, shortest first, running <b>${tgt ? esc(tgt.name) : 'the run target'}</b> on each, and keeps the first one it accepts.</p></div>` : ''}
    ${w.toolMsg ? `<div class="labout">${w.toolMsg}</div>` : ''}`;
}

function updateWinLive(w) {
  if (w.type === 'tree') return updateTreeWin(w);
  if (w.type === 'st') return updateSt(w);
  if (w.type === 'tape') { const i = w.el.querySelector('[data-r=tcur]'); if (i && document.activeElement !== i) { const v = currentTapes()[w.id] ?? ''; if (i.value !== v) i.value = v; } return; }
  if (w.type !== 'machine') return;
  const m = machineById(w.id); if (!m || !m.compiled) return;
  const a = actFor(m.id);
  const led = w.el.querySelector('[data-f=led]'); if (led) { const s = statusOf(a); led.className = 'led ' + (s === 'idle' ? '' : s); }
  const live = w.el.querySelector('[data-r=live]');
  if (live) {
    if (!a) live.innerHTML = `<dt>status</dt><dd>${m.id === world.targetId ? 'ready to run' : 'idle until called'}</dd>`;
    else {
      const act = a.act, c = act.c;
      let rows = `<dt>status</dt><dd>${a.live ? (a.top ? 'running' : 'waiting for a call to return') : (act.status === 'accept' ? 'accepted' : 'rejected') + (act.reason ? ' — ' + esc(act.reason) : '')}</dd>`;
      rows += `<dt>input n</dt><dd>${act.n}</dd>` + (c.kind === 'circuit' ? '' : `<dt>steps</dt><dd>${act.own} own, ${fmtBig(act.cost)} charged</dd>${act.simLookup || act.simTape || act.simBound || act.simLoop ? `<dt>overhead</dt><dd>lookup ${fmtBig(act.simLookup || 0)} · tape ${fmtBig(act.simTape || 0)} · bounds ${fmtBig(act.simBound || 0)}${act.simLoop ? ' · loop counter ' + fmtBig(act.simLoop) : ''}</dd>` : ''}<dt>space</dt><dd>${run.space(act)} cells</dd>${act.randLimit != null || run.coinsUsed(act) ? `<dt>random bits</dt><dd>${run.coinsUsed(act)}${act.randLimit != null ? ' / ' + act.randLimit : ''}</dd>` : ''}${act.queryLimit != null || run.queries(act) ? `<dt>queries</dt><dd>${run.queries(act)}${act.queryLimit != null ? ' / ' + act.queryLimit : ''}</dd>` : ''}`);
      if (c.kind === 'circuit') rows += act.circ ? `<dt>layer</dt><dd>${act.layer} of ${act.circ.depth} (${Math.min(act.k, act.circ.gates.length)} of ${act.circ.gates.length} gates)</dd><dt>size</dt><dd>${act.circ.size}${act.sizeLimit != null ? ' / budget ' + act.sizeLimit : ''}</dd><dt>depth</dt><dd>${act.circ.depth}${act.depthLimit != null ? ' / budget ' + act.depthLimit : ''}</dd><dt>fan-in</dt><dd>${act.circ.fanin}${act.faninLimit != null ? ' / budget ' + act.faninLimit : ''}</dd>` : `<dt>circuit</dt><dd>${esc(act.circError || 'none')}</dd>`;
      else if (c.kind === 'script') rows += `<dt>cost</dt><dd>one opaque step (uncertified)</dd>`;
      else if (c.kind === 'prog') rows += `<dt>registers</dt><dd>${c.regs.map(r => `${esc(r.name)}=${esc(act.regs[r.name])}`).join('  ')}</dd>`;
      else rows += `<dt>${c.kind === 'nfa' ? 'states' : 'state'}</dt><dd>${esc(c.kind === 'nfa' ? '{' + act.set.join(', ') + '}' : act.state)}</dd>`;
      rows += `<dt>heads</dt><dd>${Object.entries(act.ports).map(([k, p]) => `${esc(k)}@${p.head}`).join('  ')}</dd>`;
      const gi = a.live ? run.stack.indexOf(act) : -1; const g = gi >= 0 && run.stack[gi + 1] && run.stack[gi + 1].m.guest ? run.stack[gi + 1] : null;
      if (g) rows += `<dt>simulating</dt><dd>⟨${esc(g.m.name)}⟩ · ${confText(g)} · ${g.own} steps${g.simLimit ? ` of at most ${g.simLimit}` : ''}${g.simSpace != null ? ` · ${run.space(g)} of at most ${g.simSpace} cells` : ''}</dd>`;
      live.innerHTML = rows;
    }
  }
  const cbox = w.el.querySelector('[data-r=cbox]'); if (cbox) updateCircuitBox(cbox, m, a, cbox.dataset.circ);
  const gbox = w.el.querySelector('[data-r=gbox]'); if (gbox) highlightGraph(gbox, w.map, a, gbox.dataset.pfx, true);
  const code = w.el.querySelector('[data-r=code]'); if (code) highlightCode(code, a);
}

// ---------- dragging (elements and windows) ----------
let drag = null, suppressClick = false;
document.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const wt = e.target.closest('.wtitle');
  if (wt && !e.target.closest('button')) {
    const w = winOf(wt); w.el.style.zIndex = ++winZ;
    if (narrow()) return;
    drag = { win: w, sx: e.clientX, sy: e.clientY, ox: w.el.offsetLeft, oy: w.el.offsetTop, moved: false }; wt.setPointerCapture(e.pointerId); return;
  }
  const winEl = e.target.closest('.win'); if (winEl) { winEl.style.zIndex = ++winZ; return; }
  if (e.target.closest('button, .tscroll, input, select, textarea')) return;
  if (e.target.closest('.dev input, .dev button')) return;   // pressing a device's controls never drags it
  const grip = e.target.closest('.grip'); const handle = e.target.closest('.drag');
  if (!grip && !handle) return;
  const el = (grip || handle).closest('.mach, .tape, .red, .dev'); if (!el) return;
  const obj = el.dataset.mid ? machineById(el.dataset.mid) : el.dataset.rid ? redById(el.dataset.rid) : el.dataset.did ? devById(el.dataset.did) : tapeById(el.dataset.tid);
  drag = { el, obj, resize: !!grip, sx: e.clientX, sy: e.clientY, ox: obj.pos.x, oy: obj.pos.y, ow: obj.w || el.offsetWidth, moved: false };
  (grip || handle).setPointerCapture(e.pointerId);
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  drag.moved = true;
  if (drag.win) {
    const L = $('#layer').getBoundingClientRect(); const el = drag.win.el;
    el.style.left = Math.max(-el.offsetWidth + 80, Math.min(L.width - 80, drag.ox + dx)) + 'px';
    el.style.top = Math.max(0, Math.min(L.height - 40, drag.oy + dy)) + 'px';
    return;
  }
  drag.el.classList.add('dragging');
  if (drag.resize) { drag.obj.w = Math.max(240, snap(drag.ow + dx / zoom)); drag.el.style.width = drag.obj.w + 'px'; renderTapes(); }
  else {
    drag.obj.pos = { x: Math.max(0, drag.ox + dx / zoom), y: Math.max(0, drag.oy + dy / zoom) };
    drag.el.style.left = drag.obj.pos.x + 'px'; drag.el.style.top = drag.obj.pos.y + 'px';
  }
  drawWires();
});
function endDrag() {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.win || !d.moved) { if (d.moved) { suppressClick = true; setTimeout(() => suppressClick = false, 0); } return; }
  d.el.classList.remove('dragging');
  if (!d.resize) { d.obj.pos = { x: snap(d.obj.pos.x), y: snap(d.obj.pos.y) }; d.el.style.left = d.obj.pos.x + 'px'; d.el.style.top = d.obj.pos.y + 'px'; }
  suppressClick = true; setTimeout(() => suppressClick = false, 0);
  sizePlane(); drawWires(); save();
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// ---------- actions ----------
function addMachine(kind) {
  let src = TEMPLATES[kind]; const name = uniqueName({ regex: 'NewRegex', cfg: 'NewGrammar', prog: 'NewProgram', pda: 'NewPDA', tm: 'NewTM', dfa: 'NewDFA', nfa: 'NewNFA', script: 'NewScript', circuit: 'NewCircuit' }[kind]);
  if (kind === 'prog') src = src.replace('machine NewProgram', 'machine ' + name);
  if (kind === 'script') src = src.replace('script NewScript', 'script ' + name);
  if (kind === 'circuit') src = src.replace('circuit NewCircuit', 'circuit ' + name);
  if (kind === 'regex') src = src.replace('regex NewRegex', 'regex ' + name);
  if (kind === 'cfg') src = src.replace('grammar NewGrammar', 'grammar ' + name);
  const m = addMachineFromText(kind, name, src, world.tapes[0] && world.tapes[0].id);
  ensureStackTape(m);
  if (!world.targetId) world.targetId = m.id;
  world.key = null; changed(true); openWin('machine', m.id);
}
// a PDA (or a context-free grammar, which runs as one) gets its own empty stack tape
function ensureStackTape(m) {
  const p = m.compiled && m.compiled.ports.find(x => x.stack); if (!p || (m.bind[p.name] && tapeById(m.bind[p.name]))) return;
  let i = 1, tn; do { tn = 'stack' + (i++ > 1 ? i - 1 : ''); } while (world.tapes.some(t => t.name === tn));
  const st = makeTape({ name: tn, kind: 'stack', init: '', alphabet: 'AZ' }); st.w = 360; st.pos = freeSpot(360, 90); world.tapes.push(st); m.bind[p.name] = st.id;
  if (!m.bind.in || m.bind.in === st.id) { const t0 = world.tapes.find(t => t.kind !== 'stack' && t.kind !== 'channel' && t.kind !== 'random'); if (t0) m.bind.in = t0.id; else delete m.bind.in; }
}
function addTape() {
  let i = world.tapes.length + 1, name; do { name = 'tape' + i++; } while (world.tapes.some(t => t.name === name));
  const t = makeTape({ name, init: '' }); t.w = 440; t.pos = freeSpot(440, 90); world.tapes.push(t);
  world.key = null; changed(true); openWin('tape', t.id);
}

document.addEventListener('click', e => {
  if (suppressClick) return;
  const menuBtn = e.target.closest('#bWorlds, #bAdd, #bLook');
  if (menuBtn) {
    const menu = menuBtn.nextElementSibling; const was = !menu.hidden; closeMenus();
    // measure the screen before the menu opens: an open menu that sticks out widens a phone's layout
    const vw = document.documentElement.clientWidth; menu.hidden = was;
    if (!menu.hidden) { // keep the whole menu on screen: shift it left if needed, scroll it if tall
      menu.style.left = ''; menu.style.maxHeight = ''; menu.style.maxWidth = (vw - 16) + 'px';
      const r = menu.getBoundingClientRect();
      if (r.right > vw - 8) menu.style.left = Math.round(Math.max(8 - (r.left - (parseFloat(getComputedStyle(menu).left) || 0)), vw - 8 - r.right)) + 'px';
      menu.style.maxHeight = Math.max(160, Math.floor(innerHeight - r.top - 10)) + 'px';
    }
    return;
  }
  const lookb = e.target.closest('[data-look]'); if (lookb) { closeMenus(); setDevLook(lookb.dataset.look); return; }
  if (!e.target.closest('.menu')) closeMenus();
  const exb = e.target.closest('[data-ex]');
  if (exb) { closeMenus(); setWorld(openExample(EXAMPLES.find(x => x.key === exb.dataset.ex))); return; }
  const ck = e.target.closest('.dev [data-clock]'); if (ck) { const d = devById(ck.closest('.dev').dataset.did); if (d) toggleClock(d); return; }
  const pr = e.target.closest('.dev [data-press]'); if (pr) { const d = devById(pr.closest('.dev').dataset.did); if (d) pressDevice(d, pr); return; }
  if (e.target.closest('.dev [data-devin]')) return;
  const dv = e.target.closest('.dev'); if (dv && !e.target.closest('.win')) { openWin('dev', dv.dataset.did); return; }
  const addb = e.target.closest('[data-add]');
  if (addb && addb.dataset.dev) { closeMenus(); addDevice(addb.dataset.dev, addb.dataset.fmt); return; }
  if (addb) { closeMenus(); if (addb.dataset.add === 'reduction') addReduction(); else if (addb.dataset.add === 'tape') addTape(); else addMachine(addb.dataset.add); return; }
  const stb = e.target.closest('[data-st]'); if (stb) { openWin('st', stb.dataset.st); return; }
  const iob = e.target.closest('[data-io="open"]'); if (iob) { closeMenus(); openWin('io', 'io'); return; }
  if (e.target.closest('#consoleHead') && !e.target.closest('[data-act]')) { consoleOpen = !consoleOpen; renderConsole(); return; }
  const ab = e.target.closest('[data-act]');
  const w = winOf(e.target);
  if (ab && !w) {
    const act = ab.dataset.act;
    if (act === 'closeGuide') { showGuide(false); return; }
    if (act === 'openTree') { openWin('tree', 'tree'); return; }
    if (act === 'view') {
      const m = machineById(ab.closest('.mach').dataset.mid); const vs = views(m);
      m.view = vs[(vs.indexOf(viewOf(m)) + 1) % vs.length]; save(); renderStructure(); renderLive(); return;
    }
  }
  if (w) {
    const gut = w.type === 'machine' && e.target.closest('[data-r=code] [data-line] > i');
    if (gut) { toggleBp(`${w.id}:L${gut.parentElement.dataset.line}`); markAllBps(); return; }
    const gn = w.type === 'machine' && e.target.closest('[data-r=gbox] [data-n]');
    if (gn && w.map) {
      const m = machineById(w.id); const rev = new Map([...w.map].map(([k, v]) => [v, k])); const id = rev.get(+gn.dataset.n);
      if (id != null) { toggleBp(m.kind === 'prog' ? `${m.id}:L${(m.compiled.nodes[id] || {}).line}` : `${m.id}:S${id}`); markAllBps(); }
      return;
    }
    const strow = w.type === 'st' && e.target.closest('canvas');
    if (strow) { stClick(w, e); return; }
    const tn = e.target.closest('[data-tnode]');
    if (tn && tree) { const node = tree.index && tree.index.get(tn.dataset.tnode); if (node) { playing = false; focusNode(node); renderLive(); } return; }
    const tb = e.target.closest('[data-tab]');
    if (tb) { w.tab = tb.dataset.tab; w.editing = false; if (w.type === 'tape') w.toolMsg = ''; renderWin(w); return; }
    if (ab) return winAction(w, ab.dataset.act, ab);
    return;
  }
  const rEl = e.target.closest('.red');
  if (rEl) { openWin('red', rEl.dataset.rid); return; }
  const mEl = e.target.closest('.mach');
  if (mEl) { openWin('machine', mEl.dataset.mid); return; }
  const tEl = e.target.closest('.tape');
  if (tEl && !e.target.closest('.tscroll')) { openWin('tape', tEl.dataset.tid); return; }
  if (tEl) { openWin('tape', tEl.dataset.tid); return; }
  if (e.target.closest('#canvas')) { selId = null; markSelection(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.target.matches('.mach') || e.target.matches('.reel') || e.target.matches('tr[data-cex]'))) { e.preventDefault(); e.target.click(); }
});

function winAction(w, act, el) {
  const m = w.type === 'machine' ? machineById(w.id) : null; const t = w.type === 'tape' ? tapeById(w.id) : null;
  switch (act) {
    case 'close': closeWin(w.key); break;
    case 'redCheck': runReductionCheck(w, redById(w.id)); break;
    case 'redStop': if (w.redRun && w.redRun.stop) w.redRun.stop(); break;
    case 'redAddStep': { const r = redById(w.id); const tr = world.machines.find(x => isTransducer(x) && !r.via.includes(x.id)) || world.machines.find(isTransducer); if (tr) { r.via.push(tr.id); r.status = null; changed(true); } break; }
    case 'redDelStep': { const r = redById(w.id); r.via.splice(+el.dataset.i, 1); r.status = null; changed(true); break; }
    case 'redCompose': { const r = redById(w.id), r2 = redById(el.dataset.with); if (!r2) break; const nr = { id: uid('r'), from: r.from, to: r2.to, via: [...r.via, ...r2.via], pos: { x: (r.pos.x + r2.pos.x) / 2 + 40, y: Math.max(r.pos.y, r2.pos.y) + 150 }, gen: r.gen || r2.gen || null, status: null }; world.reductions.push(nr); world.key = null; changed(true); openWin('red', nr.id); break; }
    case 'redBudget': { const f = machineById(el.dataset.mid); if (!f) break; if (el.dataset.kind === 'log') { f.budgetSpace = '2*log(n) + 4'; } else { f.budgetTime = 'n^3 + 20'; } compileMachine(f); const r = redById(w.id); if (r) r.status = null; changed(true); break; }
    case 'devDelete': { world.devices = world.devices.filter(x => x.id !== w.id); closeWin(w.key); world.key = null; changed(true); break; }
    case 'redDelete': { world.reductions = world.reductions.filter(x => x.id !== w.id); closeWin(w.key); world.key = null; changed(true); break; }
    case 'redLoad': { const r = redById(w.id); const A = machineById(r.from); const t = A && inputTapeFor(A); if (t) { t.init = el.dataset.w; world.targetId = A.id; changed(true); } break; }
    case 'redGenReset': { const r = redById(w.id); r.gen = null; save(); renderWin(w); break; }
    case 'ioSave': exportSave(w); break;
    case 'ioCopy': exportCopy(w); break;
    case 'ioLoad': { const ta = w.el.querySelector('[data-io=paste]'); importText(w, ta.value); break; }
    case 'target': switchTarget(m.id); break;
    case 'tDesc': { const sel = w.el.querySelector('[data-r=descm]'); const dm = sel && machineById(sel.value); if (dm) { t.init = encodeMachine(dm); w.toolMsg = `⟨${esc(dm.name)}⟩ is now on ${esc(t.name)}: ${t.init.length} cells.`; world.key = null; changed(true); } break; }
    case 'tKeep': { const c = currentTapes(); if (c[t.id] != null) { t.init = c[t.id]; w.toolMsg = 'The current contents are now this tape\'s initial contents.'; changed(true); } break; }
    case 'edit': w.editing = true; w.editText = m.src; w.editErr = ''; renderWin(w); w.el.querySelector('textarea').focus(); break;
    case 'cancel': w.editing = false; renderWin(w); break;
    case 'apply': {
      const text = w.el.querySelector('textarea').value; w.editText = text; const old = { src: m.src, name: m.name };
      m.src = text; compileMachine(m);
      if (!m.compiled) { w.editErr = m.error; m.src = old.src; m.name = old.name; compileMachine(m); renderWin(w); return; }
      if (m.kind === 'prog' && world.machines.some(x => x !== m && x.name === m.name)) { w.editErr = `another machine is already called ${m.name}`; m.src = old.src; compileMachine(m); renderWin(w); return; }
      w.editing = false; w.editErr = ''; w.labHTML = '';
      for (const k of Object.keys(m.bind)) if (!m.compiled.ports.some(p => p.name === k)) delete m.bind[k];
      ensureStackTape(m);
      world.key = null; changed(true); break;
    }
    case 'gengram': runGenGrammar(w, m); break;
    case 'cyk': runCYK(w, m); break;
    case 'tonfa': case 'torx': case 'togram': case 'topda': {
      try {
        const c = m.compiled; const inTape = m.bind[c.ports[0].name]; let made;
        if (act === 'tonfa') { const nm = uniqueName(m.name + 'NFA'); made = addMachineFromText('nfa', nm, nfaText(c, m.kind === 'regex' ? `# Thompson NFA of ${c.regex}` : `# NFA of the grammar ${m.name}`), inTape); w.toolMsg = `Created <b>${esc(nm)}</b> with ${c.states.length} states.`; }
        if (act === 'torx') { const nm = uniqueName(m.name + 'Regex'); const rx = automatonToRegex(c); made = addMachineFromText('regex', nm, `regex ${nm}\n// from ${m.name}, by state elimination\n${rx}`, inTape); w.toolMsg = `Created <b>${esc(nm)}</b>: <code>${esc(rx)}</code>`; }
        if (act === 'togram') { const nm = uniqueName(m.name + 'Grammar'); made = addMachineFromText('cfg', nm, automatonToGrammar(c, nm), inTape); w.toolMsg = `Created <b>${esc(nm)}</b>, a right-linear grammar.`; }
        if (act === 'topda') { const nm = uniqueName(m.name + 'PDA'); made = addMachineFromText('pda', nm, grammarPdaText(c.grammar), inTape); ensureStackTape(made); w.toolMsg = `Created <b>${esc(nm)}</b>. Unlike the grammar, it does not prune hopeless branches, so a left-recursive or ε-heavy grammar can make its tree grow without end.`; }
        world.key = null; changed(true); openWin('machine', made.id);
      } catch (err) { w.toolMsg = `<span style="color:var(--bad)">${esc(err.message)}</span>`; renderWin(w); }
      break;
    }
    case 'todfa': case 'det': {
      try {
        const r = act === 'todfa' ? programToDFA(m.compiled) : determinize(m.compiled); const nm = uniqueName(m.name + 'DFA');
        const created = addMachineFromText('dfa', nm, r.text, m.bind[m.compiled.ports[0].name]);
        w.toolMsg = act === 'todfa' ? `Created <b>${esc(nm)}</b>: ${r.raw} reachable configurations minimized to ${r.count} states.` : `Created <b>${esc(nm)}</b>: ${r.raw} reachable subsets, ${r.count} states after minimization.`;
        world.key = null; changed(true); openWin('machine', created.id); const nw = wins.get('machine:' + created.id); nw.tab = 'graph'; renderWin(nw);
      } catch (err) { w.toolMsg = `<span style="color:var(--bad)">${esc(err.message)}</span>`; renderWin(w); }
      break;
    }
    case 'lab': saveGen(w, m); runLab(w, m); break;
    case 'labstop': if (w.labRun && w.labRun.stop) w.labRun.stop(); break;
    case 'trials': runTrials(w, m); break;
    case 'truth': runTruth(w, m); break;
    case 'diag': runDiag(w, m); break;
    case 'pcpExact': runPcp(w, m, false); break;
    case 'pcpBest': runPcp(w, m, true); break;
    case 'pcpStop': if (w.pcpRun && w.pcpRun.stop) w.pcpRun.stop(); break;
    case 'pcpUse': { const pf = tapesOfKind(m, 'proof')[0]; if (pf) { pf.init = el.dataset.proof; world.key = null; changed(true); } break; }
    case 'compare': runCompare(w, m); break;
    case 'cmpstop': if (w.cmpRun && w.cmpRun.stop) w.cmpRun.stop(); break;
    case 'loadcex': {
      const A = compareRunner(m); const L = labOf(m); const B = machineById(L.cmpWith);
      const s = el.dataset.cex; const ta = inputTapeFor(A); if (ta) ta.init = s;
      const tb = B && inputTapeFor(B); if (tb && tb !== ta) tb.init = s;
      world.key = null; changed(true);
      const p = w.el.querySelector('[data-r=cmpprog]'); if (p) p.textContent = `Put “${s || 'ε'}” on the tape. Press Run to watch.`;
      break;
    }
    case 'genreset': m.gen = null; save(); renderWin(w); break;
    case 'delm':
      world.machines = world.machines.filter(x => x !== m);
      (world.reductions || []).forEach(r => { if (r.from === m.id) r.from = null; if (r.to === m.id) r.to = null; r.via = r.via.filter(x => x !== m.id); r.status = null; });
      if (world.targetId === m.id) world.targetId = world.machines[0] ? world.machines[0].id : null;
      closeWin(w.key); world.key = null; changed(true); break;
    case 'delt':
      world.tapes = world.tapes.filter(x => x !== t);
      world.machines.forEach(mm => { for (const k of Object.keys(mm.bind)) if (mm.bind[k] === t.id) delete mm.bind[k]; });
      closeWin(w.key); world.key = null; changed(true); break;
    case 'reroll': t.seed++; w.toolMsg = ''; changed(true); break;
    case 'witness': {
      const mx = w.el.querySelector('[data-field=tMax]'); t.maxLen = Math.max(0, Math.min(16, parseInt(mx.value, 10) || 0));
      w.toolMsg = '<span class="note" data-r="witprog">searching…</span>'; renderWin(w);
      findWitness(w, t).then(html => { w.toolMsg = html; changed(true); });
      break;
    }
  }
}

function saveGen(w, m) { const g = w.el.querySelector('[data-gen]'); if (g) { m.gen = g.value; save(); } }
document.addEventListener('input', e => { if (e.target.matches('[data-gen]')) { const w = winOf(e.target); const m = w && machineById(w.id); if (m) { m.gen = e.target.value; save(); } } });
document.addEventListener('change', e => {
  if (e.target.id === 'target') { switchTarget(e.target.value); return; }
  if (e.target.dataset && e.target.dataset.lab) {
    const w = winOf(e.target); const m = w && machineById(w.id); if (!m) return;
    const L = labOf(m); const k = e.target.dataset.lab; const v = e.target.value;
    L[k] = (k === 'mode' || k === 'metric' || k === 'runId' || k === 'ttCmp' || k === 'cmpWith' || k === 'cmpAlpha' || k === 'cykW') ? (k === 'cmpAlpha' || k === 'cykW' ? String(v).replace(/\s+/g, '') : v) : Math.max(0, parseInt(v, 10) || 0);
    if (k === 'to' && L.to < L.from) L.to = L.from;
    save(); if (k === 'mode' || k === 'runId' || k === 'metric' || k === 'cmpWith') { saveGen(w, m); renderWin(w); } return;
  }
  if (e.target.dataset && e.target.dataset.dev) {
    const w = winOf(e.target); const d = w && devById(w.id); if (!d) return;
    const k = e.target.dataset.dev; let v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (['count', 'w', 'h', 'cell'].includes(k)) v = Math.max(0, parseInt(v, 10) || 0);
    if (k === 'interval') v = Math.min(3600, Math.max(0.1, parseFloat(v) || 1));
    if (k === 'tape' || k === 'run') v = v || null;
    d[k] = v; world.key = null; save(); renderStructure(); renderWin(w); renderLive(); return;
  }
  if (e.target.dataset && e.target.dataset.red) {
    const w = winOf(e.target); const r = w && redById(w.id); if (!r) return;
    const k = e.target.dataset.red; const v = e.target.value;
    if (k === 'from' || k === 'to') { r[k] = v || null; r.status = null; changed(true); return; }
    if (k.startsWith('via:')) { r.via[+k.slice(4)] = v; r.status = null; changed(true); return; }
    if (k === 'gen') { r.gen = v; save(); return; }
    if (k === 'hide') { r.hideWires = e.target.checked; save(); drawWires(); return; }
    r.check = Object.assign(redCheckOf(r), { [k]: k === 'mode' ? v : Math.max(0, parseInt(v, 10) || 0) });
    save(); if (k === 'mode') renderWin(w); return;
  }
  if (e.target.dataset && e.target.dataset.tree) {
    const k = e.target.dataset.tree;
    if (k === 'mode') { treePrefs.mode = e.target.value; if (tree) tree.mode = e.target.value; }
    if (k === 'short' && tree && tree.rule && tree.rule.mode !== 'exists') { e.target.checked = false; return; }
    if (k === 'short') {
      treePrefs.short = e.target.checked;
      if (tree) {
        tree.short = e.target.checked;
        if (!tree.short) {
          const revive = []; const walk = n => { if (n.status === 'pruned') { n.status = 'open'; revive.push(n); } n.children.forEach(walk); }; walk(tree.root);
          if (revive.length) { tree.frontier.push(...revive); tree.pruned = 0; tree.done = false; tree.verdict = null; }
        }
      }
    }
    renderLive(); return;
  }
  const f = e.target.dataset && e.target.dataset.field; if (!f) return;
  const w = winOf(e.target); if (!w) return;
  const m = w.type === 'machine' ? machineById(w.id) : null; const t = w.type === 'tape' ? tapeById(w.id) : null;
  const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (m) {
    if (f.startsWith('bind:')) { const p = f.slice(5); if (v) m.bind[p] = v; else delete m.bind[p]; world.key = null; changed(true); return; }
    if (f === 'altPreset') { const p = ALT_PRESETS[v]; if (p) { m.altMode = p.mode; m.altBlocks = p.blocks; m.altStart = p.start; changed(true); } return; }
    if (f === 'altMode') { m.altMode = v; changed(true); return; }
    if (f === 'accMode') { m.accMode = v; changed(true); return; }
    if (f === 'countK') { const k = parseInt(v, 10); m.countK = k > 0 ? String(k) : '1'; changed(true); return; }
    if (f === 'altStart') { m.altStart = v; changed(true); return; }
    if (f === 'altBlocks') { const k = parseInt(v, 10); m.altBlocks = k > 0 ? String(k) : ''; changed(true); return; }
    if (f === 'preset') { const p = CIRCUIT_PRESETS[v]; if (p) { m.budgetSize = p.size; m.budgetDepth = p.depth; m.budgetFanin = p.fanin; compileMachine(m); changed(true); } return; }
    if (f === 'bFanin') { const k = parseInt(v, 10); m.budgetFanin = k > 0 ? String(k) : ''; changed(true); return; }
    if (f === 'bSize' || f === 'bDepth') {
      const s = String(v).trim();
      try { compileBudget(s); } catch (err) { e.target.setCustomValidity(err.message); e.target.reportValidity(); return; }
      e.target.setCustomValidity(''); if (f === 'bSize') m.budgetSize = s; else m.budgetDepth = s; compileMachine(m); changed(true); return;
    }
    if (f === 'bTime' || f === 'bSpace' || f === 'bRand' || f === 'bQuery') {
      const s = String(v).trim();
      try { compileBudget(s); } catch (err) { e.target.setCustomValidity(err.message); e.target.reportValidity(); return; }
      e.target.setCustomValidity(''); m[{ bTime: 'budgetTime', bSpace: 'budgetSpace', bRand: 'budgetRand', bQuery: 'budgetQuery' }[f]] = s; compileMachine(m); changed(f === 'bRand' || f === 'bQuery'); return;
    }
    if (f === 'oracle') { m.oracle = v; changed(false); return; }
    if (f === 'simModel' || f === 'simTime' || f === 'simSpace' || f === 'simLoop') {
      m.sim = Object.assign({ model: 'free' }, m.sim || {}, { [{ simModel: 'model', simTime: 'timeCheck', simSpace: 'spaceCheck', simLoop: 'loopDetect' }[f]]: v });
      changed(false); return;
    }
    if (f === 'hideWires') { m.hideWires = !!v; save(); drawWires(); return; }
    if (f === 'prover') { m.role = v ? 'prover' : 'normal'; changed(true); return; }
    if (f.startsWith('link:')) { m.links = m.links || {}; const s = f.slice(5); if (v) m.links[s] = v; else delete m.links[s]; world.key = null; changed(true); return; }
    if (f === 'name') {
      const s = String(v).trim();
      if (!/^[A-Za-z_]\w*$/.test(s) || world.machines.some(x => x !== m && x.name === s)) { e.target.value = m.name; return; }
      m.name = s; world.key = null; changed(true); return;
    }
  }
  if (t) {
    if (f === 'tName') { const s = String(v).trim(); if (s) t.name = s; }
    if (f === 'tKind') t.kind = v;
    if (f === 'tAdvice') { try { adviceFn(v); } catch (err) { w.toolMsg = `<span style="color:var(--bad)">${esc(err.message)}</span>`; renderWin(w); return; } t.advice = String(v); }
    if (f === 'tAdvMax') { const s = String(v).trim(); try { compileBudget(s); } catch (err) { e.target.setCustomValidity(err.message); e.target.reportValidity(); return; } e.target.setCustomValidity(''); t.adviceMax = s; }
    if (f === 'tPublic') { t.public = !!v; w.toolMsg = ''; world.key = null; changed(true); return; }
    if (f === 'tHide') { t.hideWires = !!v; save(); drawWires(); return; }
    if (f === 'tCur') {
      const carry = currentTapes(); carry[t.id] = String(v).replace(/\s+/g, '');
      resetRun(carry); run.logMsg(`restarted with ${t.name} edited (Reset restores the initial contents)`);
      renderStructure(); renderWins(); renderLive(); return;
    }
    if (f === 'tInit') t.init = String(v).replace(/\s+/g, '');
    if (f === 'tAlpha') t.alphabet = String(v).replace(/\s+/g, '');
    if (f === 'tMax') { t.maxLen = Math.max(0, Math.min(16, parseInt(v, 10) || 0)); save(); return; }
    w.toolMsg = ''; world.key = null; changed(true);
  }
});

$('#bUndo').addEventListener('click', undo);
$('#bRedo').addEventListener('click', redo);
// Inform mode shows explanations of the theory next to every control; Operate mode hides them
let opsMode = false;
try { opsMode = localStorage.getItem('tw-mode') === 'ops'; } catch (e) { }
function setMode(ops) {
  opsMode = ops; document.body.classList.toggle('ops', ops);
  $('#bInform').classList.toggle('on', !ops); $('#bOperate').classList.toggle('on', ops);
  $('#bInform').setAttribute('aria-pressed', String(!ops)); $('#bOperate').setAttribute('aria-pressed', String(ops));
  try { localStorage.setItem('tw-mode', ops ? 'ops' : 'inform'); } catch (e) { }
}
setMode(opsMode);
$('#bInform').addEventListener('click', () => setMode(false));
$('#bOperate').addEventListener('click', () => { setMode(true); if (!$('#guide').hidden) showGuide(false); });
$('#bTidy').addEventListener('click', () => { autoLayout(true); renderStructure(); renderLive(); save(); $('#canvas').scrollTo(0, 0); });
$('#bGuide').addEventListener('click', () => showGuide($('#guide').hidden));
$('#bTree').addEventListener('click', () => { if (wins.has('tree:tree')) closeWin('tree:tree'); else openWin('tree', 'tree'); updateTreeButton(); });
$('#bReset').addEventListener('click', () => { resetRun(); renderLive(); });
$('#bStep').addEventListener('click', () => { playing = false; bpNote = ''; stepWorld(); renderLive(); });
function timeAction(k) {
  playing = false; bpNote = '';
  const base = liveRun();
  if (k === 'start') goTo(0); else if (k === 'back') goTo(run.steps - 1); else if (k === 'fwd') goTo(run.steps + 1); else if (k === 'end') goTo(base.steps);
  renderLive();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-tl]'); if (b) timeAction(b.dataset.tl); });
$('#tlRange').addEventListener('input', e => { playing = false; bpNote = ''; goTo(+e.target.value); renderLive(); });
$('#bPlay').addEventListener('click', () => { if (finished()) return; playing = !playing; last = performance.now(); acc = 0; renderLive(); });
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.target.closest('input, textarea, select') && (e.key === 'z' || e.key === 'Z' || e.key === 'y')) {
    e.preventDefault(); if (e.key === 'y' || e.shiftKey) redo(); else undo(); return;
  }
  if (e.target.closest('input, textarea, select')) {
    if (e.target.matches('textarea.edit') && e.key === 'Tab') { e.preventDefault(); const ta = e.target; ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); }
    if (e.target.matches('textarea.edit') && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); const w = winOf(e.target); if (w) winAction(w, e.target.matches('[data-gen]') ? 'lab' : 'apply'); }
    return;
  }
  if (e.key === 'Escape') { closeMenus(); const top = [...wins.values()].sort((a, b) => Number(b.el.style.zIndex) - Number(a.el.style.zIndex))[0]; if (top) closeWin(top.key); }
  else if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); $('#bPlay').click(); }
  else if (e.key === 's' || e.key === 'ArrowRight') $('#bStep').click();
  else if (e.key === 'b' || e.key === 'ArrowLeft') timeAction('back');
  else if (e.key === 'r') $('#bReset').click();
  else if (e.key === '+' || e.key === '=') setZoom(zoom * 1.2);
  else if (e.key === '-' || e.key === '_') setZoom(zoom / 1.2);
  else if (e.key === '0') setZoom(1);
  else if (e.key === 'f') zoomToFit();
});

// ---------- tree window ----------
function treeBody() {
  return `<p class="note">Every choice forks the whole world, tapes included. An <b>∃</b> node (exists, OR) accepts if <b>some</b> child accepts; a <b>∀</b> node (forall, AND) accepts only if <b>every</b> child accepts. A plain nondeterministic (NP) machine has only ∃ nodes. Click a node to see the world as that branch left it.</p>
    <div class="row"><label class="field" style="flex:0 0 160px"><span class="lbl">Search order</span><select data-tree="mode"><option value="dfs" ${treePrefs.mode === 'dfs' ? 'selected' : ''}>depth-first</option><option value="bfs" ${treePrefs.mode === 'bfs' ? 'selected' : ''}>breadth-first</option></select></label>
    <label class="check" style="align-self:flex-end"><input type="checkbox" data-tree="short" ${treePrefs.short ? 'checked' : ''}> Skip branches that can no longer change the answer</label></div>
    <div class="treesum" data-r="treesum"></div>
    <div class="graphbox treebox" data-r="treebox"></div>
    <div class="row treelegend"><span><i class="tl t-open"></i>unexplored</span><span><i class="tl t-running"></i>current</span><span><i class="tl t-und">∃</i>undecided</span><span><i class="tl t-accept"></i>accepts</span><span><i class="tl t-reject"></i>rejects</span><span><i class="tl t-pruned"></i>skipped</span></div>`;
}
const TREE_SHOW = 1500;   // nodes drawn at most; deeper parts of a large tree are folded
function treeSVG() {
  const vis = new Set([tree.root]); const q = [tree.root];
  for (let k = 0; k < q.length && vis.size < TREE_SHOW; k++) for (const c of q[k].children) { if (vis.size >= TREE_SHOW) break; vis.add(c); q.push(c); }
  for (let n = tree.focus; n; n = n.parent) vis.add(n);
  const kids = n => n.children.filter(c => vis.has(c));
  const size = new Map(), accN = new Map();
  const measure = n => { let s = 1, a = n.children.length ? 0 : n.status === 'accept' ? 1 : 0; for (const c of n.children) { measure(c); s += size.get(c); a += accN.get(c); } size.set(n, s); accN.set(n, a); };
  measure(tree.root);
  const countAcc = n => accN.get(n) || 0;
  const leaves = []; const walk = n => { const ks = kids(n); if (!ks.length) { leaves.push(n); return; } ks.forEach(walk); }; walk(tree.root);
  const many = leaves.length > 48; const gap = many ? 14 : 34, dy = many ? 32 : 50, r = many ? 5 : 9;
  const pos = new Map(); let i = 0; tree.index = new Map();
  const place = n => {
    tree.index.set(n.id, n);
    let x;
    const ks = kids(n);
    if (!ks.length) { x = 26 + i * gap; i++; }
    else { const xs = ks.map(place); x = (xs[0] + xs[xs.length - 1]) / 2; }
    pos.set(n, { x, y: 24 + n.depth * dy }); return x;
  };
  place(tree.root);
  let maxY = 0; for (const p of pos.values()) maxY = Math.max(maxY, p.y);
  const W = Math.max(200, 26 + i * gap + 26), H = maxY + 32;
  let edges = '', nodes = '', labels = '';
  for (const [n, p] of pos) {
    const hidden = n.children.length - kids(n).length;
    if (hidden) labels += `<text class="t-lab" x="${p.x}" y="${p.y + r + 11}" text-anchor="middle">+${size.get(n) - 1} folded</text>`;
    for (const ch of kids(n)) {
      const q = pos.get(ch);
      edges += `<path class="t-edge ${ch.status === 'pruned' || ch.pruned ? 'skip' : ''}" d="M${p.x},${p.y + r} C${p.x},${(p.y + q.y) / 2} ${q.x},${(p.y + q.y) / 2} ${q.x},${q.y - r}"/>`;
      if (!many) labels += `<text class="t-lab" x="${(p.x + q.x) / 2 + (q.x >= p.x ? 4 : -4)}" y="${(p.y + q.y) / 2 + 3}" text-anchor="${q.x >= p.x ? 'start' : 'end'}">${esc(ch.label)}</text>`;
    }
    const f = n === tree.focus; const internal = n.children.length > 0;
    const counting = tree.rule && tree.rule.mode !== 'exists';
    const cls = internal ? 't-int ' + (counting ? 't-und' : n.value ? 't-v-' + n.value : 't-und') + (n.pruned ? ' t-skipnode' : '') : 't-' + n.status;
    const sym = counting ? String(countAcc(n)) : n.q === 'A' ? '∀' : '∃';
    const shape = internal && n.q === 'A'
      ? `<rect x="${p.x - r}" y="${p.y - r}" width="${2 * r}" height="${2 * r}" rx="${r * 0.3}"></rect>`
      : `<circle cx="${p.x}" cy="${p.y}" r="${r}"></circle>`;
    const title = internal && counting ? `${countAcc(n)} accepting path${countAcc(n) === 1 ? '' : 's'} found below this choice` : internal ? `${sym} node (${n.q === 'A' ? 'AND: every child must accept' : 'OR: some child must accept'}) · ${n.value || 'undecided'}` : `${n.status}${n.label ? ' · choice ' + esc(n.label) : ''}`;
    nodes += `<g class="t-node ${cls}" data-tnode="${n.id}">${f ? `<circle class="t-ring" cx="${p.x}" cy="${p.y}" r="${r + 4.5}"/>` : ''}${shape}${internal && !many ? `<text class="t-sym" x="${p.x}" y="${p.y + 4}" text-anchor="middle">${sym}</text>` : ''}<title>${title} · depth ${n.depth}</title></g>`;
  }
  return { svg: `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Computation tree">${edges}${labels}${nodes}</svg>`, focus: pos.get(tree.focus) };
}
function countAcc(n) { return n.children.length ? n.children.reduce((s, c) => s + countAcc(c), 0) : n.status === 'accept' ? 1 : 0; }
function quantBlocks() {
  // the largest number of quantifier blocks on any explored root-to-node path
  let best = 0; const walk = (n, last, k) => { if (!n.children.length) { best = Math.max(best, k); return; } const kk = n.q !== last ? k + 1 : k; best = Math.max(best, kk); n.children.forEach(c => walk(c, n.q, kk)); };
  walk(tree.root, null, 0); return best;
}
function updateTreeWin(w) {
  const sum = w.el.querySelector('[data-r=treesum]'), box = w.el.querySelector('[data-r=treebox]'); if (!sum || !box) return;
  const tt = w.el.querySelector('.wtitle b'); if (tt) tt.textContent = tree && tree.alt ? 'Alternating computation tree' : 'Computation tree';
  const cb = w.el.querySelector('[data-tree=short]'); if (cb) { const cnt = !!(tree && tree.rule && tree.rule.mode !== 'exists'); cb.disabled = cnt; if (cnt) cb.checked = false; }
  if (!tree) {
    sum.innerHTML = `<div class="note">${run.status === 'branch' ? 'The run is at its first choice point. Step to fork it.' : 'No branches yet. Press Run or Step: the tree grows as the machine makes its first <b>exists</b> or <b>forall</b> choice.'}</div>`;
    box.innerHTML = ''; box.dataset.key = ''; return;
  }
  const open = tree.frontier.filter(n => n.status === 'open').length;
  const path = []; for (let n = tree.focus; n && n.parent; n = n.parent) path.unshift((n.parent.q === 'A' ? '∀' : '∃') + n.label);
  const why = tree.verdict === 'accept' ? (tree.alt ? 'the root evaluates to true' : 'an accepting branch exists') : tree.verdict === 'reject' ? (tree.alt ? 'the root evaluates to false' : 'every branch rejects') : `the search was cut off at ${tree.cap} nodes`;
  const verdict = tree.done ? `<span class="pill ${tree.verdict}">${tree.verdict === 'accept' ? 'accepts' : tree.verdict === 'reject' ? 'rejects' : 'undecided'}</span> ${why}` : `<span class="pill running">exploring</span>`;
  if (tree.rule && tree.rule.mode !== 'exists') {
    const R = { count: '#P: count the accepting paths', majority: 'PP: accept if the probability of acceptance is more than 1/2', bpp: 'BPP-style: accept at probability ≥ 2/3, reject at ≤ 1/3', parity: '⊕P: accept if the number of accepting paths is odd' }[tree.rule.mode];
    const n = tree.acc + tree.rej + tree.cut; const d = tree.done ? tree.decision || decideCount(tree.rule, tree.acc, n, tree.accP || { n: 0n, d: 1n }) : null;
    const pill = tree.done ? `<span class="pill ${d && d.unclear ? 'waiting' : tree.verdict}">${d && d.unclear ? 'no clear answer' : tree.verdict === 'accept' ? 'accepts' : tree.verdict === 'reject' ? 'rejects' : 'undecided'}</span> ${esc(d ? d.why : '')}` : `<span class="pill running">counting</span>`;
    sum.innerHTML = `<div>${pill}</div><div class="countline"><b>${tree.acc}</b> accepting of <b>${n}</b> paths so far${tree.rule.mode === 'majority' || tree.rule.mode === 'bpp' ? ` · probability of acceptance so far ${fmtRat(tree.accP || { n: 0n, d: 1n })}` : ''}${tree.cut ? ` · ${tree.cut} cut off` : ''} · ${open} waiting</div><div class="note">Rule: ${R}. Counting needs every path, so no branch is skipped. Numbers on choice nodes count the accepting paths below them.${tree.rule.mode === 'majority' || tree.rule.mode === 'bpp' ? ' Each choice is a fair coin (or die) over its options, so a path below choices with k₁, k₂, … options has probability 1/(k₁·k₂·…).' : ''}</div>${tree.rule.mode === 'majority' || tree.rule.mode === 'bpp' ? `<div class="note">Viewing a path of probability <b>${fmtRat({ n: 1n, d: tree.focus.w || 1n })}</b></div>` : ''}`;
  } else {
  const qb = quantBlocks();
  sum.innerHTML = `<div>${verdict}</div><div class="note">${tree.count} nodes · ${tree.acc} accepting and ${tree.rej} rejecting leaves${tree.pruned ? ` · ${tree.pruned} skipped` : ''}${tree.cut ? ` · ${tree.cut} cut off` : ''} · ${open} waiting · ${qb} quantifier block${qb === 1 ? '' : 's'}</div><div class="note">Viewing branch: <b style="font-family:var(--f-mono)">${path.length ? esc(path.join(' → ')) : 'root'}</b></div>`;
  }
  const key = tree.count + '|' + tree.focus.id + '|' + tree.acc + '|' + tree.rej + '|' + tree.pruned + '|' + tree.focus.status + '|' + open + '|' + (tree.root.value || '');
  if (box.dataset.key === key) return;
  // a large tree is redrawn at most a few times a second while it grows
  if (tree.count > 800 && playing && !tree.done && performance.now() - (+box.dataset.t || 0) < 400) return;
  box.dataset.key = key; box.dataset.t = performance.now();
  const t = treeSVG(); box.innerHTML = t.svg;
  if (t.focus) {
    if (t.focus.x < box.scrollLeft + 20 || t.focus.x > box.scrollLeft + box.clientWidth - 20) box.scrollLeft = t.focus.x - box.clientWidth / 2;
    if (box.scrollHeight > box.clientHeight && (t.focus.y < box.scrollTop + 20 || t.focus.y > box.scrollTop + box.clientHeight - 20)) box.scrollTop = Math.max(0, t.focus.y - box.clientHeight / 2);
  }
}

// ---------- space-time diagram ----------
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function updateSt(w) {
  const base = liveRun(); const rows = base.trace || []; const box = w.el.querySelector('[data-r=stbox]'); if (!box) return;
  const key = rows.length + '|' + run.steps + '|' + (rows.length ? rows[rows.length - 1].step : 0) + '|' + document.documentElement.dataset.theme;
  if (w.stKey === key) return; w.stKey = key;
  const tid = w.id; const MAXR = 600; const shown = rows.slice(-MAXR);
  let lo = 0, hi = 9;
  for (const r of shown) { const t = r.tapes[tid]; if (!t) continue; if (t.s.length) { lo = Math.min(lo, t.lo); hi = Math.max(hi, t.lo + t.s.length - 1); } for (const h of t.heads) { lo = Math.min(lo, h.p); hi = Math.max(hi, h.p); } }
  lo -= 1; hi += 2; if (hi - lo > 160) hi = lo + 160;
  const big = shown.length <= 160; const cw = big ? 20 : 12, rh = big ? 18 : 7, gut = 40;
  const W = gut + (hi - lo + 1) * cw, H = Math.max(rh, shown.length * rh) + 18;
  const cv = box.querySelector('canvas'); const dpr = window.devicePixelRatio || 1;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const C = { tape: cssVar('--tape'), cell: cssVar('--cell'), edge: cssVar('--tape-edge'), ink: cssVar('--ink'), muted: cssVar('--muted'), write: cssVar('--accent-soft'), acc: cssVar('--accent'), bg: cssVar('--surface-2') };
  const mc = {}; for (let i = 1; i <= 6; i++) mc['m' + i] = cssVar('--m' + i);
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  g.font = `600 ${big ? 12 : 9}px ${cssVar('--f-mono') || 'monospace'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  // column index header
  g.fillStyle = C.muted; g.font = `9px ${cssVar('--f-mono') || 'monospace'}`;
  for (let i = lo; i <= hi; i++) if (i % 5 === 0) g.fillText(String(i), gut + (i - lo) * cw + cw / 2, 8);
  g.font = `600 ${big ? 12 : 9}px ${cssVar('--f-mono') || 'monospace'}`;
  shown.forEach((r, k) => {
    const y = 18 + k * rh; const t = r.tapes[tid];
    for (let i = lo; i <= hi; i++) {
      const x = gut + (i - lo) * cw; const ch = t && i >= t.lo && i < t.lo + t.s.length ? t.s[i - t.lo] : '_';
      g.fillStyle = t && t.w === i ? C.write : ch === '_' ? C.tape : C.cell; g.fillRect(x, y, cw - (big ? 1 : 0), rh - (big ? 1 : 0));
      if (big && ch !== '_') { g.fillStyle = C.ink; g.fillText(ch, x + cw / 2, y + rh / 2 + 1); }
    }
    if (t) for (const h of t.heads) {
      if (h.p < lo || h.p > hi) continue; const x = gut + (h.p - lo) * cw;
      g.strokeStyle = mc[h.c] || C.acc; g.lineWidth = big ? 2 : 1.5;
      if (big) g.strokeRect(x + 1, y + 1, cw - 3, rh - 3); else { g.fillStyle = mc[h.c] || C.acc; g.fillRect(x, y, cw, rh); }
    }
    if (big || r.step % 10 === 0) { g.fillStyle = C.muted; g.textAlign = 'right'; g.font = `9px ${cssVar('--f-mono') || 'monospace'}`; g.fillText(String(r.step), gut - 6, y + rh / 2 + 1); g.textAlign = 'center'; g.font = `600 ${big ? 12 : 9}px ${cssVar('--f-mono') || 'monospace'}`; }
  });
  const vk = shown.findIndex(r => r.step === run.steps);
  if (vk >= 0) { g.strokeStyle = runLive ? cssVar('--warn') : C.acc; g.lineWidth = 2; g.strokeRect(gut - 2, 18 + vk * rh - 1, (hi - lo + 1) * cw + 3, rh + 1); }
  w.stGeom = { rows: shown, rh, top: 18 };
  const info = w.el.querySelector('[data-r=stinfo]');
  if (info) info.textContent = `${rows.length} rows${rows.length > MAXR ? `, showing the last ${MAXR}` : ''} · cells ${lo}…${hi}${runLive ? ` · viewing step ${run.steps}` : ''}`;
  if (vk >= 0) { const y = 18 + vk * rh; if (y < box.scrollTop + 10 || y > box.scrollTop + box.clientHeight - 30) box.scrollTop = Math.max(0, y - box.clientHeight / 2); }
}
function stClick(w, e) {
  const G = w.stGeom; if (!G) return; const cv = e.target.closest('canvas'); const r = cv.getBoundingClientRect();
  const k = Math.floor((e.clientY - r.top - G.top) / G.rh); const row = G.rows[k]; if (!row) return;
  playing = false; bpNote = ''; goTo(row.step); renderLive();
}

// ---------- circuit drawing ----------
function circuitSVG(C, vals, xs, cur) {
  const cols = new Map(); const add = (d, key) => { if (!cols.has(d)) cols.set(d, []); cols.get(d).push(key); };
  for (let i = 0; i < C.nIn; i++) add(0, 'x' + i);
  C.gates.forEach((g, j) => add(g.depth, 'g' + j));
  const maxRows = Math.max(...[...cols.values()].map(c => c.length));
  const pos = {}; const GX = 86, GY = 38, W = 58, H = 24;
  for (const [d, keys] of cols) keys.forEach((k, i) => { pos[k] = { x: 34 + d * GX, y: 24 + (i + (maxRows - keys.length) / 2) * GY }; });
  const val = a => a.in != null ? xs[a.in] : a.const != null ? a.const : vals[a.gate];
  let edges = '', nodes = '';
  C.gates.forEach((g, j) => {
    const p = pos['g' + j];
    g.args.forEach((a, ai) => {
      if (a.const != null) return;
      const s = pos[a.in != null ? 'x' + a.in : 'g' + a.gate]; const v = val(a);
      const sx = s.x + (a.in != null ? 12 : W / 2), ty = p.y + (g.args.length > 1 ? (ai - (g.args.length - 1) / 2) * 6 : 0);
      edges += `<path class="c-edge ${v === 1 ? 'v1' : v === 0 ? 'v0' : ''}" d="M${sx},${s.y} C${sx + 30},${s.y} ${p.x - W / 2 - 30},${ty} ${p.x - W / 2},${ty}"/>`;
    });
    const v = vals[j]; const lab = g.op === 'CONST' ? String(g.args[0].const) : g.op === 'BUF' ? 'out' : g.op;
    nodes += `<g class="c-node ${v === 1 ? 'v1' : v === 0 ? 'v0' : ''} ${j === C.out ? 'outg' : ''} ${g.depth === cur ? 'cur' : ''}"><rect x="${p.x - W / 2}" y="${p.y - H / 2}" width="${W}" height="${H}" rx="${g.op === 'NOT' ? 12 : 5}"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle">${esc(lab)}</text>${g.name && g.name !== lab ? `<title>${esc(g.name)} = ${esc(g.op)}</title>` : ''}</g>`;
  });
  for (let i = 0; i < C.nIn; i++) {
    const p = pos['x' + i]; const v = xs[i];
    nodes += `<g class="c-node ${v === 1 ? 'v1' : v === 0 ? 'v0' : ''}"><circle cx="${p.x}" cy="${p.y}" r="12"/><text x="${p.x}" y="${p.y + 4}" text-anchor="middle">x${i}</text></g>`;
  }
  const w = 34 + (Math.max(...cols.keys()) * GX) + W / 2 + 14, h = 24 + maxRows * GY;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Circuit">${edges}${nodes}</svg>`;
}
function updateCircuitBox(box, m, a, pfx) {
  const c = m.compiled; if (!c) return;
  let C = a && a.act.circ, preview = '';
  if (!C && !a) {
    C = c.circ;
    if (!C && c.fromTape) { const rt = run.tapes.get(m.bind[c.fromTape]); if (rt) { let i = 0; while (rt.cells.has(i)) preview += rt.cells.get(i++); } try { if (preview) C = parsePostfix(preview); } catch (e) { C = null; } }
  }
  const vals = a && a.act.vals ? a.act.vals : [], xs = a && a.act.xs ? a.act.xs : [], k = a ? a.act.k : -1;
  const key = (C ? C.gates.length + ':' + C.nIn : 'none') + '|' + k + '|' + vals.join('') + '|' + xs.join('') + '|' + preview + '|' + (a ? a.act.circError : '');
  if (box.dataset.key === key) return; box.dataset.key = key;
  if (!C) { box.innerHTML = `<div class="cempty">${a && a.act.circError ? esc(a.act.circError) : c.fromTape ? `Waiting for a circuit description on tape port “${esc(c.fromTape)}”.` : 'No circuit.'}</div>`; return; }
  box.innerHTML = circuitSVG(C, vals, xs, a ? a.act.layer : -1);
}

// ---------- reductions ----------
function redById(id) { return (world.reductions || []).find(r => r.id === id); }
function isTransducer(m) { return !!(m && m.compiled && m.compiled.ports.length >= 2 && outputPortOf(m)); }
function nameOf(id) { const m = machineById(id); return m ? m.name : '—'; }
function redTitle(r) { return `${nameOf(r.from)} ≤ ${nameOf(r.to)}`; }
// which kind of reduction the transducers certify: log-space, poly-time, or uncertified
function redKind(r) {
  const fs = r.via.map(machineById);
  if (!fs.length || fs.some(f => !f || !f.compiled)) return { sym: '≤', label: 'incomplete' };
  if (fs.some(f => f.kind === 'script')) return { sym: '≤', label: 'uncertified (a script)' };
  if (fs.every(f => f.spaceFn)) return { sym: '≤ₗ', label: 'log-space' };
  if (fs.every(f => f.timeFn || f.spaceFn)) return { sym: '≤ₚ', label: 'poly-time' };
  return { sym: '≤', label: 'no budget declared' };
}
function reductionHTML(r) {
  const k = redKind(r); const st = r.status;
  return `<div class="red drag ${st ? 'rs-' + st.state : ''}" data-rid="${r.id}" tabindex="0" role="button" aria-label="Reduction ${esc(redTitle(r))}" style="left:${r.pos.x}px;top:${r.pos.y}px">
    <div class="redsym" title="${esc(k.label)}">${k.sym}</div>
    <div class="redtxt"><b>${esc(nameOf(r.from))} ≤ ${esc(nameOf(r.to))}</b><span>via ${r.via.length ? r.via.map(id => esc(nameOf(id))).join(' → ') : '—'}</span>
      <span class="redstat">${st ? esc(st.text) : 'not checked yet'}</span></div>
  </div>`;
}
function addReduction() {
  const deciders = world.machines.filter(m => m.compiled && inputTapeFor(m) && !isTransducer(m));
  const tr = world.machines.find(isTransducer);
  const r = { id: uid('r'), from: deciders[0] ? deciders[0].id : null, to: deciders[1] ? deciders[1].id : null, via: tr ? [tr.id] : [], pos: freeSpot(240, 90), gen: null, status: null };
  world.reductions.push(r); world.key = null; changed(true); openWin('red', r.id);
}
const RED_CHECK = { mode: 'strings', len: 5, rand: 100, randLen: 12, from: 1, to: 5, per: 20, cap: 100000 };
function redCheckOf(r) { r.check = Object.assign({}, RED_CHECK, r.gen ? { mode: 'gen' } : {}, r.check || {}); return r.check; }
function redBody(w, r) {
  const C = redCheckOf(r); const k = redKind(r);
  const deciders = world.machines.filter(m => m.compiled && inputTapeFor(m));
  const opt = (id, cur) => `<option value="${id}" ${id === cur ? 'selected' : ''}>${esc(nameOf(id))}</option>`;
  const sel = (key, cur, list) => `<select class="inp" data-red="${key}"><option value="">—</option>${list.map(m => opt(m.id, cur)).join('')}</select>`;
  const trs = world.machines.filter(isTransducer);
  const steps = r.via.map((id, i) => {
    const f = machineById(id);
    const bud = f ? [f.budgetTime ? `time ≤ ${esc(f.budgetTime)}` : '', f.budgetSpace ? `space ≤ ${esc(f.budgetSpace)}` : ''].filter(Boolean).join(', ') : '';
    return `<div class="redstep"><span class="redidx">f${r.via.length > 1 ? sub(i + 1) : ''}</span>${sel('via:' + i, id, trs)}
      <span class="note">${!f ? '' : f.kind === 'script' ? 'script: cost not certified' : bud || 'no budget yet'}</span>
      ${f && f.kind !== 'script' ? `<button class="btn small" data-act="redBudget" data-kind="log" data-mid="${f.id}" title="Set space ≤ 2·log n + 4">log-space</button><button class="btn small" data-act="redBudget" data-kind="poly" data-mid="${f.id}" title="Set time ≤ n³ + 20">poly-time</button>` : ''}
      <button class="ib" data-act="redDelStep" data-i="${i}" title="Remove this step" aria-label="Remove this step">×</button></div>`;
  }).join('');
  const nexts = world.reductions.filter(x => x !== r && x.from && x.from === r.to);
  const running = w.redRun && !w.redRun.done;
  return `<p class="note">A <b>reduction</b> from A to B is a transducer f with <b>w ∈ A exactly when f(w) ∈ B</b>. If f is cheap (log-space or polynomial time) and B is easy, so is A; if A is hard, so is B. Here: <b>${k.sym}</b> ${esc(k.label)}.</p>
    <label class="check"><input type="checkbox" data-red="hide" ${r.hideWires ? 'checked' : ''}> Hide this reduction's arrows</label>
    <div class="redform">
      <label class="field"><span class="lbl">A (decider)</span>${sel('from', r.from, deciders)}</label>
      <span class="redrel">≤</span>
      <label class="field"><span class="lbl">B (decider)</span>${sel('to', r.to, deciders)}</label>
    </div>
    <div class="sec"><span class="lbl">Transducers, applied in order</span>${steps || '<p class="note keep">No transducer yet.</p>'}
      <div class="row"><button class="btn small" data-act="redAddStep" ${trs.length ? '' : 'disabled'}>+ Add a step</button><span class="note">A transducer is any machine with an input tape and an <b>output</b> tape (declare <code>tape out output</code>). Output tapes are one-way and are not counted as space, as in the definition of log-space reductions.</span></div>
    </div>
    <section class="sec"><h4 class="th4">Check</h4>
      <p class="note">Runs f on many inputs w, then A on w and B on f(w), and lists every input where the two answers differ. It also records each transducer's time, space and output length against its budget. Agreement on every input is evidence, not a proof.</p>
      <div class="formgrid">
        <label class="field wide"><span class="lbl">Inputs</span><select data-red="mode"><option value="strings" ${C.mode === 'strings' ? 'selected' : ''}>Every string up to a length, plus random ones</option><option value="gen" ${C.mode === 'gen' ? 'selected' : ''}>My generator function</option></select></label>
        ${C.mode === 'strings' ? `<label class="field"><span class="lbl">every string up to length</span><input type="number" min="0" max="14" data-red="len" value="${C.len}"></label><label class="field"><span class="lbl">random strings</span><input type="number" min="0" max="5000" data-red="rand" value="${C.rand}"></label><label class="field"><span class="lbl">up to length</span><input type="number" min="0" max="200" data-red="randLen" value="${C.randLen}"></label>`
        : `<label class="field"><span class="lbl">sizes from</span><input type="number" min="0" max="50" data-red="from" value="${C.from}"></label><label class="field"><span class="lbl">to</span><input type="number" min="0" max="50" data-red="to" value="${C.to}"></label><label class="field"><span class="lbl">inputs per size</span><input type="number" min="1" max="2000" data-red="per" value="${C.per}"></label>`}
        <label class="field"><span class="lbl">step cap per run</span><input type="number" min="100" max="2000000" data-red="cap" value="${C.cap}"></label>
      </div>
      ${C.mode === 'gen' ? `<label class="field"><span class="lbl">Generator (JavaScript) — returns w</span><textarea class="edit gen" data-red="gen" spellcheck="false" aria-label="Input generator">${esc(r.gen || defaultGen(machineById(r.from)))}</textarea></label><div class="row"><button class="btn small" data-act="redGenReset">Reset to a plain random generator</button></div>` : `<p class="note">Strings use the alphabet of A's input tape (${esc(alphaOf(inputTapeFor(machineById(r.from))))}).</p>`}
      <div class="row"><button class="btn primary small" data-act="redCheck" ${running || !r.from || !r.to || !r.via.length ? 'disabled' : ''}>Check</button>${running ? '<button class="btn small" data-act="redStop">Stop</button>' : ''}<span class="note" data-r="redprog"></span></div>
      ${w.redHTML ? `<div class="labout">${w.redHTML}</div>` : ''}
    </section>
    ${nexts.length ? `<section class="sec"><h4 class="th4">Compose</h4><p class="note">Reductions chain: if A ≤ B and B ≤ C then A ≤ C, by running one transducer after the other. This is how hardness travels from one problem to the next.</p>${nexts.map(x => `<div class="row"><button class="btn small" data-act="redCompose" data-with="${x.id}">Compose with ${esc(redTitle(x))}</button></div>`).join('')}</section>` : ''}
`;
}
function sub(n) { return String(n).split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[+d]).join(''); }

// ---------- export / import ----------
// Saving a file depends on where the page is hosted, so build.py adds a small host file that defines
// HOST.fileSaver(): it resolves to an object with save({ filename, data }), or to null when saving is impossible.
let fileSaver = null;
(async () => { try { fileSaver = typeof HOST !== 'undefined' && HOST.fileSaver ? await HOST.fileSaver() : null; } catch (e) { fileSaver = null; } for (const w of wins.values()) if (w.type === 'io') renderWin(w); })();
function exportName() { const ex = EXAMPLES.find(e => e.key === (world.key || world.origin)); return (ex ? ex.title : 'my turing world').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'turing-world'; }
function exportText(name) {
  // a world that started from a built-in one carries its key, title, tag, group and guide, so the file can go
  // straight into worlds/ (see build.py) and replace that world, or be edited by hand first
  const ex = EXAMPLES.find(e => e.key === (world.key || world.origin));
  const g = ex && WORLD_GROUPS.find(g => g[1].includes(ex.key));
  const meta = ex ? { key: ex.key, title: ex.title, tag: ex.tag, group: g ? g[0] : undefined, guide: ex.guide } : {};
  return JSON.stringify({ format: 'turing-world', version: 1, name, ...meta, exportedAt: new Date().toISOString(), world: worldData() }, null, 2);
}
function ioHTML() {
  const name = exportName();
  return `<div class="wtitle"><b>Save or load a world</b><span class="kind">file</span><button class="ib" data-act="close" aria-label="Close">×</button></div>
  <div class="wbody">
    <section class="sec"><h4 class="th4">Export this world</h4>
      <p class="note">Everything is included: tapes, machines and their source, wiring, budgets, positions, breakpoints and lab settings.</p>
      <label class="field"><span class="lbl">File name</span><input data-io="name" value="${esc(name)}" spellcheck="false"></label>
      <div class="row">${fileSaver ? '<button class="btn primary small" data-act="ioSave">Save as file</button>' : ''}<button class="btn small" data-act="ioCopy">Copy as text</button><span class="note" data-r="iomsg">${fileSaver ? '' : 'Saving a file directly is not available in this view: copy the text and save it as a .json file.'}</span></div>
      <details class="help"><summary>Show the file contents</summary><textarea class="edit io" data-io="out" readonly spellcheck="false">${esc(exportText(name))}</textarea></details>
    </section>
    <section class="sec"><h4 class="th4">Import a world</h4>
      <p class="note">Choose a .json file exported from Turing World, or paste its contents. This replaces the current world; Undo brings the old one back.</p>
      <input type="file" accept=".json,application/json,text/plain" data-io="file" aria-label="Choose a world file">
      <textarea class="edit io" data-io="paste" spellcheck="false" placeholder="…or paste a saved world here" aria-label="Paste a saved world"></textarea>
      <div class="row"><button class="btn small" data-act="ioLoad">Load pasted world</button><span class="note" data-r="ioerr"></span></div>
    </section>
  </div>`;
}
function ioMsg(w, sel, text, bad) { const el = w.el.querySelector(sel); if (el) { el.textContent = text; el.style.color = bad ? 'var(--bad)' : ''; } }
async function exportSave(w) {
  const name = (w.el.querySelector('[data-io=name]').value.trim() || 'turing-world').replace(/\.json$/i, '');
  try { await fileSaver.save({ filename: name + '.json', data: exportText(name) }); ioMsg(w, '[data-r=iomsg]', 'Saved.'); }
  catch (e) { const c = e && e.code; ioMsg(w, '[data-r=iomsg]', c === 'declined' ? 'Not saved.' : c === 'rate_limited' ? 'A save prompt is already open.' : 'Saving is not available here: use Copy as text instead.', c !== 'declined'); }
}
function exportCopy(w) {
  const name = (w.el.querySelector('[data-io=name]').value.trim() || 'turing-world'); const text = exportText(name);
  const ta = w.el.querySelector('[data-io=out]'); ta.value = text;
  const fallback = () => { const d = ta.closest('details'); if (d) d.open = true; ta.focus(); ta.select(); ioMsg(w, '[data-r=iomsg]', 'Copying is blocked here: the text is selected below, press Ctrl/⌘ C.'); };
  try { navigator.clipboard.writeText(text).then(() => ioMsg(w, '[data-r=iomsg]', 'Copied. Paste it into a .json file to keep it.'), fallback); } catch (e) { fallback(); }
}
function importText(w, text) {
  let d;
  try { d = JSON.parse(text); } catch (e) { return ioMsg(w, '[data-r=ioerr]', 'That is not valid JSON.', true); }
  if (d && d.format === 'turing-world' && d.world) d = d.world;
  let nw; try { nw = worldFromData(d); } catch (e) { return ioMsg(w, '[data-r=ioerr]', e.message, true); }
  nw.key = null; setWorld(nw);
}
document.addEventListener('change', e => {
  if (!e.target.matches('[data-io=file]')) return;
  const w = winOf(e.target); const f = e.target.files && e.target.files[0]; if (!f || !w) return;
  const rd = new FileReader(); rd.onload = () => importText(w, String(rd.result)); rd.onerror = () => ioMsg(w, '[data-r=ioerr]', 'Could not read that file.', true); rd.readAsText(f);
});

// ---------- zoom ----------
const ZMIN = 0.3, ZMAX = 2;
function applyZoom() {
  $('#world').style.transform = `scale(${zoom})`;
  $('#canvas').style.backgroundSize = `${20 * zoom}px ${20 * zoom}px`;
  $('#zoomPct').textContent = Math.round(zoom * 100) + '%';
  sizePlane(); drawWires();
}
function setZoom(z, cx, cy) {
  const cv = $('#canvas'); z = Math.max(ZMIN, Math.min(ZMAX, Math.round(z * 100) / 100));
  if (cx == null) { cx = cv.clientWidth / 2; cy = cv.clientHeight / 2; }
  const wx = (cv.scrollLeft + cx) / zoom, wy = (cv.scrollTop + cy) / zoom;
  zoom = z; applyZoom();
  cv.scrollLeft = wx * zoom - cx; cv.scrollTop = wy * zoom - cy;
  try { localStorage.setItem(SAVE_KEY + '-zoom', String(zoom)); } catch (e) { }
}
function zoomToFit() {
  const els = [...document.querySelectorAll('.world > .mach, .world > .tape, .world > .red')]; if (!els.length) return setZoom(1);
  let x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;
  els.forEach(el => { x0 = Math.min(x0, el.offsetLeft); y0 = Math.min(y0, el.offsetTop); x1 = Math.max(x1, el.offsetLeft + el.offsetWidth); y1 = Math.max(y1, el.offsetTop + el.offsetHeight); });
  const cv = $('#canvas'); const pad = 40;
  zoom = Math.max(ZMIN, Math.min(1.25, Math.min(cv.clientWidth / (x1 - x0 + 2 * pad), (cv.clientHeight - 60) / (y1 - y0 + 2 * pad))));
  applyZoom(); $('#canvas').scrollLeft = (x0 - pad) * zoom; $('#canvas').scrollTop = Math.max(0, (y0 - pad) * zoom);
  try { localStorage.setItem(SAVE_KEY + '-zoom', String(zoom)); } catch (e) { }
}
document.addEventListener('click', e => {
  const z = e.target.closest('[data-zoom]'); if (!z) return;
  const k = z.dataset.zoom;
  if (k === 'in') setZoom(zoom * 1.2); else if (k === 'out') setZoom(zoom / 1.2); else if (k === 'reset') setZoom(1); else zoomToFit();
});
$('#canvas').addEventListener('wheel', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  const r = $('#canvas').getBoundingClientRect();
  setZoom(zoom * Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
let pinch = null;
$('#canvas').addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    const [a, b] = e.touches; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: zoom };
    if (drag) { drag = null; }
  }
}, { passive: true });
$('#canvas').addEventListener('touchmove', e => {
  if (!pinch || e.touches.length !== 2) return;
  e.preventDefault();
  const [a, b] = e.touches; const r = $('#canvas').getBoundingClientRect();
  const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  setZoom(pinch.z * d / pinch.d, (a.clientX + b.clientX) / 2 - r.left, (a.clientY + b.clientY) / 2 - r.top);
}, { passive: false });
$('#canvas').addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });

// ---------- animation loop ----------
let last = performance.now(), acc = 0;
function stepsPerSecond() { const v = +$('#speed').value; return v >= 100 ? Infinity : Math.round(Math.pow(10, v / 100 * 3.3)); }
let animate = true;
try { animate = localStorage.getItem('tw-animate') !== 'off'; } catch (e) { }
function setAnimate(on) {
  animate = on; const b = $('#bAnim'); b.classList.toggle('on', !on); b.setAttribute('aria-pressed', String(!on));
  b.title = on ? 'Animating every step. Click to just compute: runs finish as fast as possible and the world updates when they end' : 'Not animating: runs finish as fast as possible. Click to animate again';
  $('#speed').disabled = !on;
  try { localStorage.setItem('tw-animate', on ? 'on' : 'off'); } catch (e) { }
}
setAnimate(animate);
setDevLook(devLook);
// phones: hide or show the timeline and zoom (remembered in this browser)
function setFloats(on) {
  document.body.classList.toggle('nofloats', !on); $('#bFloats').setAttribute('aria-pressed', String(on));
  try { localStorage.setItem('tw-floats', on ? 'on' : 'off'); } catch (e) { }
}
try { setFloats(localStorage.getItem('tw-floats') !== 'off'); } catch (e) { setFloats(true); }
$('#bFloats').addEventListener('click', () => setFloats(document.body.classList.contains('nofloats')));
$('#bAnim').addEventListener('click', () => { setAnimate(!animate); renderLive(); });
function frame(now) {
  if (playing && !finished() && !animate) {
    // just compute: fill most of each frame with steps and only show that the world is processing
    const t0 = performance.now(); let k = 0;
    while (!finished() && performance.now() - t0 < 30) { stepWorld(); if (!runLive && bpHit(run)) { playing = false; bpNote = 'Paused at a breakpoint'; break; } if (++k > 2e6) break; }
    if (finished() || !playing) { playing = playing && !finished(); renderLive(); }
    else { const p = $('#status'); p.textContent = 'processing'; p.className = 'pill running proc'; $('#counter').textContent = tree ? `${run.steps} steps · tree ${tree.count} nodes` : `${run.steps.toLocaleString()} steps`; updateDevices(); }
    last = now; requestAnimationFrame(frame); return;
  }
  if (playing && !finished()) {
    const sps = stepsPerSecond(); const t0 = performance.now();
    let k;
    if (sps === Infinity) { k = 1e7; acc = 0; } else { acc += (now - last) / 1000 * sps; k = Math.min(Math.floor(acc), 5000); acc -= k; }
    while (k-- > 0 && !finished()) {
      if (sps === Infinity && (k & 63) === 0 && performance.now() - t0 > 14) break;   // max speed: fill the frame, keep it responsive
      stepWorld();
      const hit = !runLive && bpHit(run);
      if (hit) { playing = false; bpNote = `Paused at breakpoint: ${hit}`; break; }
    }
    if (finished()) playing = false;
    renderLive();
  }
  last = now; requestAnimationFrame(frame);
}
window.addEventListener('resize', () => { sizePlane(); drawWires(); });

// ---------- boot ----------
try { const z = parseFloat(localStorage.getItem(SAVE_KEY + '-zoom')); if (z >= ZMIN && z <= ZMAX) zoom = z; } catch (e) { }
applyWorldFiles();
setWorld(restore() || openExample(EXAMPLES[0]));
applyZoom();
requestAnimationFrame(frame);
