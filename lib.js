function actFor(mid) {
  if (!run) return null;
  for (let i = run.stack.length - 1; i >= 0; i--) if (run.stack[i].m.id === mid) return { act: run.stack[i], live: true, top: i === run.stack.length - 1 };
  const s = run.seen.get(mid); return s ? { act: s, live: false } : null;
}
function confText(act) {
  const c = act.c;
  if (c.kind === 'dfa' || c.kind === 'tm') return `state <em>${esc(act.state)}</em>`;
  if (c.kind === 'pda') { const sp = act.ports.stack; let st = ''; for (let i = 0; i <= sp.head && sp.rt.cells.has(i); i++) st += sp.rt.cells.get(i); return `state <em>${esc(act.state)}</em> · stack <em>${st ? esc(st.length > 14 ? '…' + st.slice(-13) : st) : 'empty'}</em>`; }
  if (c.kind === 'nfa') return `states <em>{${esc(act.set.join(', '))}}</em>`;
  if (c.kind === 'script') return 'one opaque step · <em>uncertified</em>';
  if (c.kind === 'circuit') return act.circ ? `layer <em>${act.layer}</em> of ${act.circ.depth}${act.budgetFail ? ' · <em>over budget</em>' : ''}` : `<em>no circuit</em>`;
  const n = c.nodes[act.pc];
  const regs = c.regs.filter(r => !r.builtin || act.regs.ret !== 'none').map(r => `${esc(r.name)}=<em>${esc(act.regs[r.name])}</em>`).join(' ');
  return `${n && n.line ? 'line <em>' + n.line + '</em>' : 'end'}${regs ? ' · ' + regs : ''}`;
}

// ---------- graph ----------
function exprStr(e) { return e.k === 'read' ? `read(${e.tape})` : e.k === 'reg' ? e.name : (e.v === '_' ? '_' : e.v); }
function condStr(c) {
  switch (c.k) {
    case 'or': return `${condStr(c.a)} || ${condStr(c.b)}`;
    case 'and': return `${condStr(c.a)} && ${condStr(c.b)}`;
    case 'not': return `!${condStr(c.a)}`;
    case 'atstart': return `atstart(${c.tape})`;
    case 'cmp': return `${exprStr(c.a)} ${{ '!=': '≠', '<=': '≤', '>=': '≥' }[c.op] || c.op} ${exprStr(c.b)}`;
  }
}
function nodeLabel(n) {
  switch (n.op) {
    case 'branch': return condStr(n.cond) + ' ?';
    case 'write': return `write ${n.tape} ${exprStr(n.expr)}`;
    case 'move': return `move ${n.tape} ${n.dir}`;
    case 'assign': return `${n.reg} ← ${exprStr(n.expr)}`;
    case 'inc': case 'dec': return `${n.op} ${n.reg}`;
    case 'call': return `call ${n.name}`;
    case 'push': return `push ${n.tape} ${exprStr(n.expr)}`;
    case 'pop': return `pop ${n.tape}`;
    case 'send': return `send ${n.tape} ${exprStr(n.expr)}`;
    case 'seek': return `seek ${n.tape} ${n.addr.k === 'tape' ? '⟨' + n.addr.name + '⟩' : exprStr(n.addr)}`;
    case 'simulate': return `simulate ⟨${n.code}⟩${n.on ? ' on ' + n.on.join(',') : ''}${n.time ? ' time≤' + n.time : ''}${n.space ? ' space≤' + n.space : ''}`;
    case 'writestr': return n.self ? `write ⟨self⟩ on ${n.tape}` : `write ${n.tape} "${n.text.length > 12 ? n.text.slice(0, 11) + '…' : n.text}"`;
    case 'choose': { const kw = n.q === 'A' ? '∀ forall' : n.q === 'E' ? '∃ exists' : 'choose'; return n.guess ? `${kw} ${n.guess}` : `${kw} (${n.targets.length} ways)`; }
    case 'halt': return n.implicit ? 'end: reject' : n.acc ? 'accept' : 'reject';
  }
}

function graphModel(m) {
  const c = m.compiled; const nodes = [], edges = []; let start, dir = 'LR';
  const add = (id, o) => { nodes.push(Object.assign({ id, idx: nodes.length }, o)); };
  if (c.kind === 'dfa' || c.kind === 'nfa' || c.kind === 'tm' || c.kind === 'pda') {
    const qlab = s => c.kind !== 'tm' ? s : c.calls && c.calls[s] ? s + ' ?' : c.universal && c.universal.has(s) ? '∀ ' + s : c.existential && c.existential.has(s) ? '∃ ' + s : s;
    c.states.forEach(s => add(s, { label: qlab(s), shape: 'circle', accept: c.kind === 'tm' ? s === c.accept : c.accept.has(s), reject: c.kind === 'tm' && s === c.reject }));
    start = c.start; const g = new Map();
    const put = (f, t, lab) => { const k = f + '\u0000' + t; if (!g.has(k)) g.set(k, { from: f, to: t, labels: [] }); g.get(k).labels.push(lab); };
    if (c.kind === 'pda') c.rules.forEach(r => put(r.from, r.to, `${r.input === 'eps' ? 'ε' : r.input},${r.pop === 'eps' ? 'ε' : r.pop}→${r.push.length ? r.push.join('') : 'ε'}`));
    else if (c.kind === 'tm') { c.rules.forEach(r => put(r.from, r.to, `${r.reads.join('')}→${r.writes.join('')},${r.moves.join('')}`)); for (const [q, cl] of Object.entries(c.calls || {})) { put(q, cl.yes, `${cl.name} ✓`); put(q, cl.no, `${cl.name} ✗`); } }
    else for (const [f, row] of Object.entries(c.delta)) for (const [s, to] of Object.entries(row)) for (const t of [].concat(to)) put(f, t, s === 'eps' ? 'ε' : s);
    for (const e of g.values()) edges.push({ from: e.from, to: e.to, label: c.kind === 'tm' || c.kind === 'pda' ? e.labels : [e.labels.join(',')] });
  } else {
    dir = 'TB'; start = c.entry;
    const reach = new Set(); const q = [c.entry];
    while (q.length) { const i = q.pop(); if (reach.has(i)) continue; reach.add(i); const n = c.nodes[i]; for (const t of [n.next, n.t, n.f, ...(n.targets || [])]) if (t != null) q.push(t); }
    c.nodes.forEach(n => { if (reach.has(n.id)) add(n.id, { label: nodeLabel(n), shape: n.op === 'branch' || n.op === 'choose' ? 'diamond' : 'box', halt: n.op === 'halt' ? (n.acc ? 'a' : 'r') : null, line: n.line }); });
    c.nodes.forEach(n => {
      if (!reach.has(n.id)) return;
      if (n.op === 'choose') n.targets.forEach((t, i) => edges.push({ from: n.id, to: t, label: [n.labels[i]], kind: 'c' }));
      else if (n.op === 'branch') { edges.push({ from: n.id, to: n.t, label: ['yes'], kind: 't' }); edges.push({ from: n.id, to: n.f, label: ['no'], kind: 'f' }); }
      else if (n.next != null && n.op !== 'halt') edges.push({ from: n.id, to: n.next, label: [] });
    });
  }
  return { nodes, edges, start, dir };
}

function layoutGraph(G) {
  const byId = new Map(G.nodes.map(n => [n.id, n]));
  const depth = new Map(); const order = [];
  const adj = new Map(); G.edges.forEach(e => { if (!adj.has(e.from)) adj.set(e.from, []); adj.get(e.from).push(e.to); });
  const q = [G.start]; depth.set(G.start, 0);
  while (q.length) { const v = q.shift(); order.push(v); for (const w of adj.get(v) || []) if (!depth.has(w) && byId.has(w)) { depth.set(w, depth.get(v) + 1); q.push(w); } }
  let maxD = Math.max(0, ...depth.values());
  G.nodes.forEach(n => { if (!depth.has(n.id)) { depth.set(n.id, maxD + 1); order.push(n.id); } });
  const layers = []; order.forEach(id => { const d = depth.get(id); (layers[d] = layers[d] || []).push(byId.get(id)); });
  for (const n of G.nodes) {
    if (n.shape === 'circle') { n.r = Math.max(19, n.label.length * 4 + 9); n.w = n.h = n.r * 2; }
    else { n.w = Math.max(70, n.label.length * 6.7 + 22); n.h = n.shape === 'diamond' ? 30 : 26; }
  }
  if (G.dir === 'LR' && G.nodes.length >= 5 && G.edges.length / G.nodes.length > 1.4) {
    G.circle = true; const N = G.nodes.length; const maxR = Math.max(...G.nodes.map(n => n.r));
    const R = Math.max(110, N * (maxR * 2 + 34) / (2 * Math.PI)); G.cx = R + 80; G.cy = R + 80;
    order.forEach((id, i) => { const n = byId.get(id); const ang = -Math.PI / 2 - Math.PI / N + 2 * Math.PI * i / N; n.x = G.cx + R * Math.cos(ang); n.y = G.cy + R * Math.sin(ang); });
  } else if (G.dir === 'LR') {
    let x = 46; const colH = layers.map(L => (L || []).reduce((s, n) => s + n.h + 46, -46));
    const H = Math.max(...colH, 40);
    layers.forEach((L, i) => {
      if (!L) return; const w = Math.max(...L.map(n => n.w)); let y = (H - colH[i]) / 2 + 60;
      L.forEach(n => { n.x = x + w / 2; n.y = y + n.h / 2; y += n.h + 46; });
      x += w + 92;
    });
  } else if (G.dir === 'TB' && G.src) {
    const lines = G.src.split('\n'); const seen = new Set(); const pre = [];
    const out = new Map(); G.edges.forEach(e => { if (!out.has(e.from)) out.set(e.from, []); out.get(e.from).push(e); });
    const visit = id => { if (seen.has(id) || !byId.has(id)) return; seen.add(id); pre.push(id); for (const e of out.get(id) || []) visit(e.to); };
    visit(G.start); G.nodes.forEach(n => { if (!seen.has(n.id)) pre.push(n.id); });
    pre.forEach((id, i) => {
      const n = byId.get(id); const ln = n.line ? lines[n.line - 1] || '' : '';
      const ind = (ln.match(/^\s*/)[0] || '').replace(/\t/g, '  ').length;
      n.x = 70 + ind * 9 + n.w / 2; n.y = 26 + i * 44 + n.h / 2; depth.set(id, i);
    });
  } else {
    let y = 26; const rowW = layers.map(L => (L || []).reduce((s, n) => s + n.w + 28, -28));
    const W = Math.max(...rowW, 100);
    layers.forEach((L, i) => {
      if (!L) return; let x = (W - rowW[i]) / 2 + 70;
      L.forEach(n => { n.x = x + n.w / 2; n.y = y + n.h / 2; x += n.w + 28; });
      y += 30 + 30;
    });
  }
  G.depth = depth;
  return G;
}

function boundary(n, tx, ty) {
  const dx = tx - n.x, dy = ty - n.y; const d = Math.hypot(dx, dy) || 1;
  if (n.shape === 'circle') return [n.x + dx / d * n.r, n.y + dy / d * n.r];
  const sx = Math.abs(dx) / (n.w / 2), sy = Math.abs(dy) / (n.h / 2); const s = Math.max(sx, sy) || 1;
  return [n.x + dx / s, n.y + dy / s];
}
const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; };

function graphSVG(m, pfx = 'g') {
  const GM = graphModel(m); if (m.kind === 'prog') GM.src = m.src; const G = layoutGraph(GM); const byId = new Map(G.nodes.map(n => [n.id, n]));
  let edgesSvg = '', nodesSvg = ''; let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
  G.nodes.forEach(n => { grow(n.x - n.w / 2, n.y - n.h / 2); grow(n.x + n.w / 2, n.y + n.h / 2); });
  const pairs = new Set(G.edges.map(e => e.from + '\u0000' + e.to));
  let backCount = 0; const edgeIdx = new Map();
  G.edges.forEach(e => {
    const a = byId.get(e.from), b = byId.get(e.to); if (!a || !b) return;
    let d, lp; const p0 = [a.x, a.y];
    if (e.from === e.to && G.circle) {
      const ux = (a.x - G.cx), uy = (a.y - G.cy), ul = Math.hypot(ux, uy) || 1; const ox = ux / ul, oy = uy / ul, px = -oy, py = ox;
      const b1 = [a.x + ox * a.r + px * 8, a.y + oy * a.r + py * 8], b2 = [a.x + ox * a.r - px * 8, a.y + oy * a.r - py * 8];
      const c1 = [b1[0] + ox * 44 + px * 22, b1[1] + oy * 44 + py * 22], c2 = [b2[0] + ox * 44 - px * 22, b2[1] + oy * 44 - py * 22];
      d = `M${b1[0]},${b1[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${b2[0]},${b2[1]}`; lp = [a.x + ox * (a.r + 44), a.y + oy * (a.r + 44) + 3];
    } else if (G.circle) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; const dx = b.x - a.x, dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1;
      const off = 16 + L * 0.06; const cx = mx + (-dy / L) * off, cy = my + (dx / L) * off;
      const s = boundary(a, cx, cy), t = boundary(b, cx, cy);
      d = `M${s[0]},${s[1]} Q${cx},${cy} ${t[0]},${t[1]}`;
      lp = [0.25 * s[0] + 0.5 * cx + 0.25 * t[0], 0.25 * s[1] + 0.5 * cy + 0.25 * t[1]];
    } else if (e.from === e.to) {
      if (G.dir === 'LR') { const y = a.y - a.r; d = `M${a.x - 9},${y + 2} C${a.x - 34},${y - 46} ${a.x + 34},${y - 46} ${a.x + 9},${y + 2}`; lp = [a.x, y - 40]; }
      else { const x = a.x + a.w / 2; d = `M${x},${a.y - 6} C${x + 40},${a.y - 22} ${x + 40},${a.y + 22} ${x},${a.y + 6}`; lp = [x + 38, a.y]; }
    } else if (G.dir === 'LR') {
      const fwd = G.depth.get(e.to) > G.depth.get(e.from);
      const both = pairs.has(e.to + '\u0000' + e.from);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; const dx = b.x - a.x, dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1;
      let off = fwd ? (both ? -22 : 0) : 34 + 10 * Math.abs(G.depth.get(e.to) - G.depth.get(e.from));
      if (!fwd && Math.abs(dy) > Math.abs(dx)) off = 30;
      const cx = mx + (-dy / L) * off * (fwd ? 1 : -1), cy = my + (dx / L) * off * (fwd ? 1 : -1);
      const s = boundary(a, cx, cy), t = boundary(b, cx, cy);
      d = `M${s[0]},${s[1]} Q${cx},${cy} ${t[0]},${t[1]}`;
      lp = [0.25 * s[0] + 0.5 * cx + 0.25 * t[0], 0.25 * s[1] + 0.5 * cy + 0.25 * t[1]];
    } else {
      const fwd = G.depth.get(e.to) > G.depth.get(e.from);
      const jump = G.depth.get(e.to) - G.depth.get(e.from);
      if (fwd && jump === 1) {
        const s = [a.x, a.y + a.h / 2], t = [b.x, b.y - b.h / 2];
        const c1 = [s[0], s[1] + 16], c2 = [t[0], t[1] - 16];
        d = `M${s[0]},${s[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${t[0]},${t[1]}`; lp = bez(s, c1, c2, t, 0.45);
      } else {
        const right = fwd; backCount++;
        const side = right ? 1 : -1;
        const s = [a.x + side * a.w / 2, a.y], t = [b.x + side * b.w / 2, b.y];
        let ext = 0; for (const n of G.nodes) { const dd = G.depth.get(n.id); if (dd >= Math.min(G.depth.get(e.from), G.depth.get(e.to)) && dd <= Math.max(G.depth.get(e.from), G.depth.get(e.to))) ext = right ? Math.max(ext, n.x + n.w / 2) : Math.min(ext || Infinity, n.x - n.w / 2); }
        const span = Math.abs(G.depth.get(e.to) - G.depth.get(e.from));
        const xr = ext + side * (14 + Math.min(span, 14) * 4 + (backCount % 2) * 3);
        const c1 = [xr, s[1]], c2 = [xr, t[1]];
        d = `M${s[0]},${s[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${t[0]},${t[1]}`; lp = bez(s, c1, c2, t, 0.5);
        grow(xr + side * 8, a.y);
      }
    }
    const lines = e.label; const ei = `${a.idx}-${b.idx}`;
    edgeIdx.set(ei, true);
    const lab = lines.map((l, i) => `<tspan x="${lp[0]}" dy="${i ? 12 : -((lines.length - 1) * 6) + 3}">${esc(l)}</tspan>`).join('');
    edgesSvg += `<g class="g-edge" data-e="${ei}"><path d="${d}" marker-end="url(#${pfx}ah)"/>${lines.length ? `<text text-anchor="middle" x="${lp[0]}" y="${lp[1]}">${lab}</text>` : ''}</g>`;
    lines.forEach((l, i) => { const w = l.length * 3.3; grow(lp[0] - w, lp[1] - 10 - (lines.length - 1) * 6); grow(lp[0] + w, lp[1] + 8 + (lines.length - 1) * 6); });
    if (e.from === e.to) grow(lp[0], lp[1] - 10);
  });
  G.nodes.forEach(n => {
    let shape;
    if (n.shape === 'circle') shape = `<circle cx="${n.x}" cy="${n.y}" r="${n.r}"/>${n.accept ? `<circle class="acc2" cx="${n.x}" cy="${n.y}" r="${n.r - 4}"/>` : ''}`;
    else if (n.shape === 'diamond') { const hw = n.w / 2, hh = n.h / 2; shape = `<polygon points="${n.x - hw},${n.y} ${n.x - hw + 12},${n.y - hh} ${n.x + hw - 12},${n.y - hh} ${n.x + hw},${n.y} ${n.x + hw - 12},${n.y + hh} ${n.x - hw + 12},${n.y + hh}"/>`; }
    else shape = `<rect x="${n.x - n.w / 2}" y="${n.y - n.h / 2}" width="${n.w}" height="${n.h}" rx="${n.halt ? 13 : 4}"/>`;
    const cls = ['g-node', n.shape === 'circle' ? '' : 'box', n.halt ? 'halt-' + n.halt : '', n.reject ? 'halt-r' : ''].join(' ');
    nodesSvg += `<g class="${cls}" data-n="${n.idx}">${shape}<text text-anchor="middle" x="${n.x}" y="${n.y + 4}">${esc(n.label)}</text></g>`;
  });
  const s = byId.get(G.start);
  let startSvg = '';
  if (s) {
    if (G.dir === 'LR') { const x0 = s.x - s.r; startSvg = `<path class="g-start" d="M${x0 - 30},${s.y} L${x0 - 2},${s.y}" marker-end="url(#${pfx}ah)"/>`; grow(x0 - 34, s.y); }
    else { const y0 = s.y - s.h / 2; startSvg = `<path class="g-start" d="M${s.x},${y0 - 20} L${s.x},${y0 - 2}" marker-end="url(#${pfx}ah)"/>`; grow(s.x, y0 - 22); }
  }
  const pad = 12; const vb = [minX - pad, minY - pad, maxX - minX + 2 * pad, maxY - minY + 2 * pad];
  const svg = `<svg class="${m.color}" width="${Math.ceil(vb[2])}" height="${Math.ceil(vb[3])}" viewBox="${vb.join(' ')}" role="img" aria-label="State graph of ${esc(m.name)}">
    <defs><marker id="${pfx}ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ah" d="M0,0 L10,5 L0,10 z"/></marker>
    <marker id="${pfx}ahon" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ah-on" d="M0,0 L10,5 L0,10 z"/></marker></defs>
    ${startSvg}${edgesSvg}${nodesSvg}</svg>`;
  return { svg, idx: new Map(G.nodes.map(n => [n.id, n.idx])), count: G.nodes.length };
}

// ---------- inspector ----------
function highlightSrc(src) {
  return src.split('\n').map((l, i) => {
    let h = esc(l);
    const ci = l.indexOf('//') >= 0 ? l.indexOf('//') : (/^\s*#/.test(l) ? l.indexOf('#') : -1);
    let code = h, cm = '';
    if (ci >= 0 && !/"[^"]*\/\/[^"]*"/.test(l)) { code = esc(l.slice(0, ci)); cm = `<span class="cm">${esc(l.slice(ci))}</span>`; }
    const strs = []; code = code.replace(/&quot;[^&]*?&quot;|"[^"]*"/g, x => { strs.push(x); return '\u0001' + (strs.length - 1) + '\u0001'; });
    code = code.replace(/\b(machine|dfa|tape|reg|while|if|else|write|move|inc|dec|call|accept|reject|read|atstart|readonly|oneway|tapes|start|alphabet|exists|forall|choose|guess|oracle|script|circuit|or|simulate|writeself|within|on|push|pop|send|seek|regex|grammar)\b/g, '<span class="kw">$1</span>');
    code = code.replace(/\u0001(\d+)\u0001/g, (_, k) => `<span class="str">${strs[+k]}</span>`);
    return `<div data-line="${i + 1}"><i>${i + 1}</i><span>${code}${cm}</span></div>`;
  }).join('');
}

function helpHTML() {
  return `<details class="help"><summary>Language reference</summary><p class="note">The <a href="#" data-man="programs">manual</a> explains every statement in detail.</p>
<pre>machine Name [dfa] {
  tape in : {0,1} readonly oneway   // ports
  reg r : {a, b, c} = a             // finite register
  reg k : 0..9 = 0                  // numeric register
  while cond { ... }    if cond { } else { }
  write in 1    write out read(in)  write t r
  move in L|R|S    r = read(in)    inc k  dec k
  call OtherMachine   // shares tapes, sets ret
  oracle P            // a socket: call P runs whatever is plugged in
  exists r            // ∃: fork once per value of r (OR)
  forall r            // ∀: fork once per value of r (AND)
  exists { ... } or { ... }   // ∃ over blocks; forall { } or { } too
  choose / guess      // like exists, or forall if the machine's mode says so
  accept   reject   accept if cond
  write t "abc"       // writes a string, moving right (one step per cell)
  push s x   pop s    // on a tape of kind stack: read(s) is the top
  send ch x           // append x to a channel tape (counted)
  seek pi a           // jump to cell a of a proof tape (a: binary
                      // number on tape a, or a register)
  writeself t         // writes ⟨this machine⟩ (the recursion theorem)
  simulate code on (a, b) within time (n^2) space (n)
                      // or: within 500
                      // runs the machine described on tape code,
                      // its tapes wired to a, b; sets ret to
                      // accept, reject, timeout or spaceout
}
cond: read(t) == x, r != y, k &lt; 5, atstart(t),
      &amp;&amp;  ||  !  ( )        blank: _   quoted: '#'</pre>
<pre># TM table                # DFA / NFA table
tapes: in readonly, work  alphabet: 0 1
start: q0                 start: s
accept: qa                accept: f
reject: qr                s, 0 1 -> s
q0, 1 _ -> q0, 1 1, R R   s, 1 -> f     (NFA: eps)
* reads anything, * writes nothing
nondeterministic   # several matching rules = a branch
exists: q1 q2      # ∃ states (OR); implies nondeterministic
forall: q3         # ∀ states (AND); other states follow the mode
oracle: P          # a socket, wired in the Wiring tab
call: qask P -> qyes, qno   # entering qask runs P on its tapes</pre><pre># PDA: ports in and stack (a stack tape)
alphabet: a b
start: q0
accept: q0 q2          # or: accept by empty stack
q0, a, eps -> q0, A    # state, input, pop -> state, push
q0, b, A -> q1, eps    # push lists symbols top first; eps = nothing
q1, eps, Z -> q2, eps  # several matching rules = a branch</pre><pre># circuit                     # script (free-form, uncertified)
circuit Name                  script Name(t, out) {
a = AND x0 x1                   const s = io.get('t');
n = NOT x2                      io.set('out', s.length % 2);
output to res   # optional      return true;   // accept
gates from desc # postfix:    }
  v next input, 0 1, &amp; | ^ ! d(up) s(wap)</pre></details>`;
}

// ---------- tools ----------
function uniqueName(base) { let n = base, i = 2; while (world.machines.some(m => m.name === n)) n = base + i++; return n; }

async function findWitness(w, t) {
  const tgt = machineById(world.targetId); if (!tgt) return '<p class="err">Pick a run target first.</p>';
  const alpha = [...new Set([...(t.alphabet || '01')])].filter(ch => ch !== '_' && ch !== ' ');
  let tried = 0; const cap = 30000; const maxLen = Math.min(16, Math.max(0, t.maxLen | 0));
  const ctrl = {}; w.witnessRun = ctrl;
  for (let len = 0; len <= maxLen; len++) {
    const total = alpha.length ** len; if (tried + total > cap) return `<p class="note">Stopped after ${tried} certificates (cap ${cap}). No witness up to length ${len - 1}.</p>`;
    for (let start = 0; start < total; start += 2000) {
      const cands = [];
      for (let k = start; k < Math.min(total, start + 2000); k++) { let s = '', x = k; for (let i = 0; i < len; i++) { s = alpha[x % alpha.length] + s; x = Math.floor(x / alpha.length); } cands.push(s); }
      const res = await runJobs(cands.map(s => ({ target: tgt.id, overrides: { [t.id]: s }, maxSteps: 60000 })), ctrl, d => { const p = w.el.querySelector('[data-r=witprog]'); if (p) p.textContent = `trying length ${len} · ${(tried + d).toLocaleString()} tried${ctrl.where === 'background' ? ' · in the background' : ''}`; });
      const hit = res.findIndex(r => r.result === 'accept');
      if (hit >= 0) { tried += hit + 1; t.init = cands[hit]; return `<p style="margin:0">Witness <b style="font-family:var(--f-mono)">${esc(cands[hit] || '(empty)')}</b> found after ${tried} tries. It is now on the tape; press Run to watch ${esc(tgt.name)} check it.</p>`; }
      tried += res.length;
      if (ctrl.stopped) return `<p class="note">Stopped after ${tried} certificates.</p>`;
    }
  }
  return `<p style="margin:0">No certificate up to length ${maxLen} makes ${esc(tgt.name)} accept (${tried} tried). If the verifier is sound, the input is not in the language.</p>`;
}

function addMachineFromText(kind, name, src, bindTapeId) {
  const spec = { kind, name, src, bind: {} };
  const m = makeMachine(spec, world);
  if (m.compiled) { const p0 = m.compiled.ports[0]; if (p0 && bindTapeId) m.bind[p0.name] = bindTapeId; }
  m.pos = freeSpot(280, 300); world.machines.push(m); return m;
}

