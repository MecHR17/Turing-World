// ===== Tools: scaling lab, trials, conversions =====
const DEFAULT_LAB = { mode: 'auto', from: 0, to: 16, step: 1, per: 40, exact: 300, cap: 100000, metric: 'time' };
function labOf(m) { m.lab = Object.assign({}, DEFAULT_LAB, m.lab || {}); return m.lab; }
function inputTapeFor(m) { const p = m.compiled && m.compiled.ports[0]; return p ? tapeById(m.bind[p.name]) : null; }
function alphaOf(t) { return [...new Set([...((t && t.alphabet) || 'ab')])].filter(ch => ch !== '_' && ch !== ' ').join('') || 'ab'; }
function defaultGen(m) {
  const t = inputTapeFor(m); const a = alphaOf(t);
  return `// Called once per input. n is the size you asked for.
// Return a string for the first tape (${t ? t.name : 'input'}),
// or an object { tapeName: contents, ... } to fill several tapes.
// rand() is a seeded number in [0,1); pick(s) picks a random character of s.
(n, rand, pick) => {
  let s = '';
  for (let i = 0; i < n; i++) s += pick('${a.replace(/[\\']/g, '')}');
  return s;
}`;
}
function genOf(m) { return m.gen || defaultGen(m); }

function usesRandom(m, seen = new Set()) {
  if (!m || seen.has(m.id) || !m.compiled) return false; seen.add(m.id);
  if (m.compiled.ports.some(p => { const t = tapeById(m.bind[p.name]); return t && t.kind === 'random'; })) return true;
  if (m.kind === 'prog') for (const n of m.compiled.nodes) if (n.op === 'call' && usesRandom(world.machines.find(x => x.name === n.name), seen)) return true;
  return false;
}

// which machine the lab runs, and whether X can be reached from it
function callees(m) {
  if (!m || !m.compiled || (m.kind !== 'prog' && m.kind !== 'tm')) return [];
  return (m.kind === 'tm' ? Object.values(m.compiled.calls || {}) : m.compiled.nodes.filter(n => n.op === 'call')).map(n => n.socket ? machineById((m.links || {})[n.name]) : world.machines.find(x => x.name === n.name)).filter(Boolean);
}
function reaches(a, b, seen = new Set()) {
  if (!a || seen.has(a.id)) return false; if (a === b) return true; seen.add(a.id);
  return callees(a).some(c => reaches(c, b, seen));
}
function labRunMachine(m) {
  const L = labOf(m); let r = L.runId && machineById(L.runId);
  if (r && reaches(r, m)) return r;
  const t = machineById(world.targetId);
  return t && t !== m && reaches(t, m) ? t : m;
}
const METRICS = { comm: 'communication (symbols sent)', time: 'time (steps)', space: 'space (cells)', size: 'size (gates)', depth: 'depth (layers)', fanin: 'fan-in' };
function metricsFor(m) { const base = m.kind === 'circuit' ? ['size', 'depth', 'fanin'] : ['time', 'space']; return world.tapes.some(t => t.kind === 'channel') ? [...base, 'comm'] : base; }

function toolsBody(w, m) {
  const c = m.compiled; if (!c) return '<p class="note">Fix the source first to use the tools.</p>';
  const L = labOf(m); if (!metricsFor(m).includes(L.metric)) L.metric = metricsFor(m)[0];
  const R = labRunMachine(m); const rnd = usesRandom(m); const t = inputTapeFor(R);
  const opt = (v, cur, label) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;
  const runners = world.machines.filter(x => reaches(x, m));
  const conv = [];
  if (c.kind === 'prog' && c.dialect === 'dfa') conv.push(`<button class="btn small" data-act="todfa">Compile to DFA</button><span class="note">Builds the equivalent minimal DFA from this dfa-dialect program.</span>`);
  if (m.kind === 'regex' || (m.kind === 'cfg' && c.kind === 'nfa')) conv.push(`<button class="btn small" data-act="tonfa">Convert to NFA</button><span class="note">${m.kind === 'regex' ? 'Thompson’s construction, as a table you can edit.' : 'One state per nonterminal, plus a final state.'}</span>`);
  if (c.kind === 'nfa') conv.push(`<button class="btn small" data-act="det">${m.kind === 'nfa' ? 'Determinize' : 'Convert to DFA'}</button><span class="note">Subset construction, then minimization.</span>`);
  if ((c.kind === 'nfa' || c.kind === 'dfa') && m.kind !== 'regex') conv.push(`<button class="btn small" data-act="torx">To a regular expression</button><span class="note">State elimination: remove states one by one, labelling edges with expressions.</span>`);
  if ((c.kind === 'nfa' || c.kind === 'dfa') && m.kind !== 'cfg') conv.push(`<button class="btn small" data-act="togram">To a right-linear grammar</button><span class="note">One nonterminal per state: p –a→ q becomes P → aQ.</span>`);
  if (m.kind === 'cfg' && c.kind === 'pda') conv.push(`<button class="btn small" data-act="topda">Convert to PDA</button><span class="note">The standard one-loop PDA: expand a nonterminal on top, match a terminal, accept on the bottom marker ⊥.</span>`);
  const running = w.labRun && !w.labRun.done;
  const isC = m.kind === 'circuit';
  return `
  <section class="sec">
    <h4 class="th4">Scaling lab</h4>
    <p class="note">Runs <b>${esc(R.name)}</b> on many inputs of each size and measures <b>${esc(m.name)}</b>${R !== m ? ' each time it is called' : ''}, plotting the worst case against the input length ${esc(m.name)} sees. ${isC ? 'For a circuit family this shows how the circuits grow with n.' : 'It shows how running time or space grows with n.'} It also checks against the declared budget. It measures; it does not prove a bound.</p>
    <div class="formgrid">
      ${runners.length > 1 ? `<label class="field wide"><span class="lbl">Run</span><select data-lab="runId">${runners.map(x => opt(x.id, R.id, esc(x.name) + (x === m ? ' (this machine on its own)' : ' (calls ' + esc(m.name) + ')'))).join('')}</select><span class="note">Offered because ${runners.filter(x => x !== m).map(x => esc(x.name)).join(', ')} call${runners.length === 2 ? 's' : ''} ${esc(m.name)}, directly or through other machines.</span></label>` : ''}
      <label class="field"><span class="lbl">Measure</span><select data-lab="metric">${metricsFor(m).map(k => opt(k, L.metric, METRICS[k])).join('')}</select></label>
      <label class="field wide"><span class="lbl">Inputs</span><select data-lab="mode">
        ${opt('auto', L.mode, 'Every string when few enough, else random')}${opt('random', L.mode, 'Random strings')}${opt('gen', L.mode, 'My generator function')}</select></label>
      <label class="field"><span class="lbl">Sizes from</span><input type="number" min="0" max="500" data-lab="from" value="${L.from}"></label>
      <label class="field"><span class="lbl">to</span><input type="number" min="0" max="500" data-lab="to" value="${L.to}"></label>
      <label class="field"><span class="lbl">step</span><input type="number" min="1" max="100" data-lab="step" value="${L.step}"></label>
      <label class="field"><span class="lbl">Inputs per size</span><input type="number" min="1" max="2000" data-lab="per" value="${L.per}"></label>
      ${L.mode === 'auto' ? `<label class="field"><span class="lbl">Try all if ≤</span><input type="number" min="1" max="5000" data-lab="exact" value="${L.exact}"></label>` : ''}
      <label class="field"><span class="lbl">Step cap per run</span><input type="number" min="100" max="2000000" data-lab="cap" value="${L.cap}"></label>
    </div>
    ${L.mode !== 'gen' ? `<p class="note">Strings go on tape <b>${t ? esc(t.name) : '—'}</b>, the first tape of ${esc(R.name)}, using its alphabet (${esc(alphaOf(t))}), which you set in the tape's window.</p>` : `
      <label class="field"><span class="lbl">Generator (JavaScript) — fills the tapes of ${esc(R.name)}</span><textarea class="edit gen" data-gen spellcheck="false" aria-label="Input generator">${esc(genOf(m))}</textarea></label>
      <div class="row"><button class="btn small" data-act="genreset">Reset to a plain random generator</button></div>`}
    <div class="row"><button class="btn primary small" data-act="lab" ${running ? 'disabled' : ''}>Run lab</button>${running ? '<button class="btn small" data-act="labstop">Stop</button>' : ''}<span class="note" data-r="labprog">${running ? 'starting…' : ''}</span></div>
    ${w.labHTML ? `<div class="labout ${m.color}">${w.labHTML}</div>` : ''}
  </section>
  ${isC ? truthSection(w, m, R) : `
  <section class="sec">
    <h4 class="th4">Run trials</h4>
    <p class="note">Runs the current world many times, each with fresh coins, and reports how often <b>${esc(m.name)}</b> accepts. This estimates the acceptance probability that defines BPP-style machines: for a good machine it is at least 2/3 or at most 1/3 on every input.</p>
    ${rnd ? `<div class="row"><label class="field" style="flex:0 0 120px"><span class="lbl">Trials</span><input type="number" min="10" max="20000" data-lab="trials" value="${L.trials || 500}"></label><button class="btn small" data-act="trials" style="align-self:flex-end">Run trials</button></div>
      ${w.trialHTML ? `<div class="labout ${m.color}">${w.trialHTML}</div>` : ''}`
    : `<p class="note brief keep">Needs a random tape.</p><p class="note disabled">Not available: neither this machine nor anything it calls reads a random tape, so every run gives the same answer. Wire a port to a tape of kind <b>random coins</b> to use it.</p>`}
  </section>`}
  ${compareSection(w, m)}
  ${grammarSection(w, m)}
  ${pcpSection(w, m)}
  ${diagSection(w, m)}
  ${conv.length ? `<section class="sec"><h4 class="th4">Convert</h4>${conv.map(x => `<div class="row">${x}</div>`).join('')}${w.toolMsg ? `<p class="note">${w.toolMsg}</p>` : ''}</section>` : ''}`;
}

// ---------- grammar tools ----------
function grammarSection(w, m) {
  if (m.kind !== 'cfg' || !m.compiled) return '';
  const L = labOf(m); const t = inputTapeFor(m);
  const wDef = L.cykW != null ? L.cykW : (t ? (t.init || '').replace(/_+$/, '') : '');
  return `<section class="sec">
    <h4 class="th4">Grammar tools</h4>
    <p class="note"><b>List the language</b> derives every string up to a length (leftmost derivations, pruned by length). <b>CYK</b> converts the grammar to Chomsky normal form and decides a string by dynamic programming in O(n³) time, with no guessing: context-free languages are in P.</p>
    <div class="row"><label class="field" style="flex:0 0 120px"><span class="lbl">Up to length</span><input type="number" min="0" max="12" data-lab="genLen" value="${L.genLen != null ? L.genLen : 6}"></label><button class="btn small" data-act="gengram" style="align-self:flex-end">List the language</button></div>
    <div class="row"><label class="field"><span class="lbl">String for CYK</span><input data-lab="cykW" value="${esc(wDef)}" spellcheck="false"></label><button class="btn small" data-act="cyk" style="align-self:flex-end">CYK table</button></div>
    ${w.gramHTML ? `<div class="labout ${m.color}">${w.gramHTML}</div>` : ''}
  </section>`;
}
function runGenGrammar(w, m) {
  const L = labOf(m); const k = Math.max(0, Math.min(12, L.genLen != null ? L.genLen : 6));
  const r = generateStrings(m.compiled.grammar, k);
  w.gramHTML = `<span class="lbl">${r.strings.length} string${r.strings.length === 1 ? '' : 's'} of length ≤ ${k}${r.complete ? '' : ' (stopped early: the list may be incomplete)'}</span>
    <div class="chips">${r.strings.map(s => `<code>${s ? esc(s) : 'ε'}</code>`).join('') || '<span class="note">none: the language has no strings that short</span>'}</div>`;
  renderWin(w);
}
function runCYK(w, m) {
  const L = labOf(m); const t = inputTapeFor(m);
  const s = String(L.cykW != null ? L.cykW : (t ? (t.init || '').replace(/_+$/, '') : '')).replace(/\s+/g, '');
  if (s.length > 14) { w.gramHTML = '<p class="err">CYK here is limited to strings of length 14.</p>'; renderWin(w); return; }
  const g = m.compiled.grammar; const cnf = toCNF(g); const r = cyk(cnf, [...s]); const n = s.length;
  let tab = '';
  for (let len = n; len >= 1; len--) {
    tab += '<tr>' + Array.from({ length: n - len + 1 }, (_, i) => { const set = [...r.table[len][i]]; const top = len === n; return `<td class="${top ? (r.accept ? 'A' : 'R') + ' dg' : ''}" title="${esc(s.slice(i, i + len))}">${set.length ? set.map(esc).join(' ') : '∅'}</td>`; }).join('') + `<th>${len}</th></tr>`;
  }
  tab += '<tr>' + [...s].map(ch => `<th>${esc(ch)}</th>`).join('') + '<th></th></tr>';
  w.gramHTML = `<span class="lbl">CYK on “${esc(s) || 'ε'}”: ${r.accept ? 'accepted' : 'rejected'}</span>
    ${n ? `<div class="diagwrap"><table class="diag cyk">${tab}</table></div>` : `<p class="note">The empty string is in the language exactly when the start symbol derives ε: ${r.accept ? 'it does' : 'it does not'}.</p>`}
    <p class="note">Cell (i, length) lists the nonterminals that derive that substring; hover a cell to see it. The top cell decides: does it contain the start symbol ${esc(cnf.start)}? Built from a Chomsky normal form with ${cnf.rules.length} rules.</p>
    <details class="help"><summary>The grammar in Chomsky normal form</summary><pre>${cnf.rules.map(q => `${esc(q.lhs)} → ${q.rhs.map(esc).join(' ')}`).join('\n')}${cnf.epsilon ? `\n${esc(cnf.start)} → ε` : ''}</pre></details>`;
  renderWin(w);
}

// ---------- probabilistically checkable proofs ----------
// tapes a machine (or anything it calls) reads, by kind
function tapesOfKind(m, kind, seen = new Set()) {
  if (!m || seen.has(m.id)) return []; seen.add(m.id);
  const own = Object.values(m.bind || {}).map(tapeById).filter(t => t && t.kind === kind);
  return [...new Set([...own, ...callees(m).flatMap(c => tapesOfKind(c, kind, seen))])];
}
function pcpSection(w, m) {
  const coins = tapesOfKind(m, 'random'); if (!coins.length || !m.compiled) return '';
  const proofs = tapesOfKind(m, 'proof'); const L = labOf(m); const t = inputTapeFor(m);
  const n = t ? (t.init || '').replace(/_+$/, '').length : 0;
  const rDef = m.randFn ? Math.max(0, Math.floor(m.randFn(n))) : 8;
  const r = Math.min(16, L.pcpR != null ? L.pcpR : rDef); const pf = proofs[0];
  const running = w.pcpRun && !w.pcpRun.done;
  return `<section class="sec">
    <h4 class="th4">Exact acceptance probability</h4>
    <p class="note">Runs the machine once for every sequence of r coins on <b>${esc(coins[0].name)}</b> and counts acceptances: the exact probability, not an estimate. ${pf ? `With a proof tape it also shows how often each proof cell is queried, and <b>Best proof</b> tries every proof of a length (soundness: for an input not in the language, no proof should be accepted with probability above 1/2).` : ''}</p>
    <div class="row"><label class="field" style="flex:0 0 140px"><span class="lbl">Random bits r</span><input type="number" min="0" max="16" data-lab="pcpR" value="${r}"></label>
      <button class="btn primary small" data-act="pcpExact" style="align-self:flex-end" ${running ? 'disabled' : ''}>Exact probability</button>
      ${pf ? `<label class="field" style="flex:0 0 120px"><span class="lbl">Proof length</span><input type="number" min="0" max="16" data-lab="pcpLen" value="${L.pcpLen != null ? L.pcpLen : (pf.init || '').replace(/_+$/, '').length}"></label><button class="btn small" data-act="pcpBest" style="align-self:flex-end" ${running ? 'disabled' : ''}>Best proof</button>` : ''}
      ${running ? '<button class="btn small" data-act="pcpStop" style="align-self:flex-end">Stop</button>' : ''}<span class="note" data-r="pcpprog" style="align-self:flex-end"></span></div>
    ${w.pcpHTML ? `<div class="labout ${m.color}">${w.pcpHTML}</div>` : ''}
  </section>`;
}
function coinStrings(r) { const out = []; for (let x = 0; x < 2 ** r; x++) out.push(x.toString(2).padStart(r, '0').slice(-r || undefined) || ''); return r ? out : ['']; }
async function runPcp(w, m, best) {
  const L = labOf(m); const coins = tapesOfKind(m, 'random')[0]; const pf = tapesOfKind(m, 'proof')[0];
  const t = inputTapeFor(m); const n = t ? (t.init || '').replace(/_+$/, '').length : 0;
  const r = Math.max(0, Math.min(16, L.pcpR != null ? L.pcpR : (m.randFn ? Math.floor(m.randFn(n)) : 8)));
  const cs = coinStrings(r); const job = { done: false }; w.pcpRun = job; w.pcpHTML = ''; renderWin(w);
  const prog = d => { const p = w.el.querySelector('[data-r=pcpprog]'); if (p) p.textContent = `${d.toLocaleString()} runs${job.where === 'background' ? ' · in the background' : ''}`; };
  const stats = res => { let acc = 0, beyond = 0, q = 0; const heat = new Map(); for (const o of res) { if (o.result === 'accept') acc++; if (o.coinsRead > r) beyond++; q = Math.max(q, (o.queried || []).length); for (const i of o.queried || []) heat.set(i, (heat.get(i) || 0) + 1); } return { acc, beyond, q, heat }; };
  const pct = x => (x * 100).toFixed(x === 1 || x === 0 ? 0 : 1) + '%';
  const warn = s => s.beyond ? `<p class="note keep" style="color:var(--warn)">${s.beyond} runs read more than ${r} coins, so those coins were not fixed: raise r.</p>` : '';
  if (!best) {
    const jobs = cs.map(c => ({ target: m.id, overrides: { [coins.id]: c }, maxSteps: L.cap || 100000, pcp: { coins: coins.id, proof: pf ? pf.id : null } }));
    const res = await runJobs(jobs, job, prog); job.done = true; if (job.stopped) { w.pcpHTML = '<p class="note">Stopped.</p>'; renderWin(w); return; }
    const s = stats(res); const p = s.acc / cs.length;
    const proofStr = pf ? (pf.init || '').replace(/_+$/, '') : '';
    const cells = pf ? Math.max(proofStr.length, ...[...s.heat.keys()].map(i => i + 1)) : 0;
    const maxH = Math.max(1, ...s.heat.values());
    w.pcpHTML = `<div class="row" style="align-items:baseline"><span class="bigstat">${pct(p)}</span><span class="note keep">accepted: ${s.acc} of ${cs.length} coin sequences (r = ${r})${pf ? ` · at most ${s.q} queries per run` : ''}</span></div>${warn(s)}
      ${pf && cells ? `<span class="lbl">How often each proof cell is queried</span><div class="heat">${Array.from({ length: Math.min(cells, 128) }, (_, i) => { const h = s.heat.get(i) || 0; return `<div class="hc" title="cell ${i}: queried in ${h} of ${cs.length} runs"><i style="height:${Math.round(h / maxH * 100)}%"></i><b>${esc(proofStr[i] || '_')}</b></div>`; }).join('')}</div>` : ''}`;
    renderWin(w); return;
  }
  const len = Math.max(0, Math.min(16, L.pcpLen != null ? L.pcpLen : (pf.init || '').replace(/_+$/, '').length));
  const alpha = alphaOf(pf); const total = alpha.length ** len;
  if (total * cs.length > 400000) { job.done = true; w.pcpHTML = `<p class="err">${total.toLocaleString()} proofs × ${cs.length} coin sequences is too many runs (limit 400,000). Shorten the proof or use fewer random bits.</p>`; renderWin(w); return; }
  const proofs = []; for (let x = 0; x < total; x++) { let s = '', y = x; for (let i = 0; i < len; i++) { s = alpha[y % alpha.length] + s; y = Math.floor(y / alpha.length); } proofs.push(s); }
  const jobs = []; for (const pr of proofs) for (const c of cs) jobs.push({ target: m.id, overrides: { [coins.id]: c, [pf.id]: pr }, maxSteps: L.cap || 100000, pcp: { coins: coins.id, proof: pf.id } });
  const res = await runJobs(jobs, job, prog); job.done = true; if (job.stopped) { w.pcpHTML = '<p class="note">Stopped.</p>'; renderWin(w); return; }
  let bestP = -1, bestS = '', perfect = 0, beyond = 0;
  proofs.forEach((pr, k) => { const sl = res.slice(k * cs.length, (k + 1) * cs.length); const s = stats(sl); beyond += s.beyond; const p = s.acc / cs.length; if (p === 1) perfect++; if (p > bestP) { bestP = p; bestS = pr; } });
  w.pcpHTML = `<div class="row" style="align-items:baseline"><span class="bigstat">${pct(bestP)}</span><span class="note keep">the best of ${total.toLocaleString()} proofs of length ${len}: <code>${esc(bestS || 'ε')}</code> · ${perfect} accepted with certainty</span></div>
    ${warn({ beyond })}<p class="note keep">${bestP === 1 ? 'Some proof makes the verifier always accept: as it should when the input is in the language.' : bestP <= 0.5 ? 'Every proof is rejected at least half the time: the verifier is sound on this input.' : `No proof convinces it always, but the best gets ${pct(bestP)}: above 1/2, so repeating the test (or a better verifier) is needed for soundness 1/2.`}</p>
    <div class="row"><button class="btn small" data-act="pcpUse" data-proof="${esc(bestS)}">Put the best proof on ${esc(pf.name)}</button></div>`;
  renderWin(w);
}

// ---------- diagonal table ----------
// Row Mᵢ, column j: what Mᵢ does when its input tape holds ⟨Mⱼ⟩.
function diagMachines(m) {
  const ok = x => x.compiled && x.kind !== 'script' && inputTapeFor(x);
  const list = world.machines.filter(ok);
  const out = list.slice(0, 9); if (ok(m) && !out.includes(m)) out[out.length - 1] = m;
  return out;
}
function diagSection(w, m) {
  if (m.kind === 'script' || !inputTapeFor(m)) return '';
  const L = labOf(m); const ms = diagMachines(m); const running = w.diagRun && !w.diagRun.done;
  return `<section class="sec">
    <h4 class="th4">Diagonal table</h4>
    <p class="note">Every machine is also a string ⟨M⟩. This runs each machine in the world on the description of each machine (row Mᵢ, column ⟨Mⱼ⟩) and marks the diagonal, where a machine reads its own description. A machine that flips the diagonal differs from every row, so no table of machines contains it. A run with no answer within the step cap is shown as ∞: it may still halt later.</p>
    <p class="note keep">Machines: ${ms.map(x => `<b>${esc(x.name)}</b>`).join(', ')}${world.machines.filter(x => x.compiled && x.kind !== 'script' && inputTapeFor(x)).length > ms.length ? ' (the first 9)' : ''}.</p>
    <div class="row"><label class="field" style="flex:0 0 150px"><span class="lbl">Step cap per run</span><input type="number" min="50" max="200000" data-lab="diagCap" value="${L.diagCap || 3000}"></label>
      <button class="btn primary small" data-act="diag" style="align-self:flex-end" ${running ? 'disabled' : ''}>Build table</button><span class="note" data-r="diagprog" style="align-self:flex-end"></span></div>
    ${w.diagHTML ? `<div class="labout ${m.color}">${w.diagHTML}</div>` : ''}
  </section>`;
}
async function runDiag(w, m) {
  const L = labOf(m); const cap = Math.max(50, Math.min(200000, L.diagCap || 3000));
  const ms = diagMachines(m); const job = { done: false }; w.diagRun = job; w.diagHTML = ''; renderWin(w);
  const jobs = [];
  for (const r of ms) for (const c of ms) jobs.push({ target: r.id, overrides: { [inputTapeFor(r).id]: encodeMachine(c) }, maxSteps: cap });
  const res = await runJobs(jobs, job, d => { const p = w.el.querySelector('[data-r=diagprog]'); if (p) p.textContent = `${d} of ${jobs.length} runs`; });
  job.done = true;
  if (job.stopped) { w.diagHTML = '<p class="note">Stopped.</p>'; renderWin(w); return; }
  const N = ms.length; const v = (i, j) => { const r = res[i * N + j]; return r.result === 'accept' ? 'A' : r.result === 'reject' ? 'R' : 'L'; };
  const why = (i, j) => { const r = res[i * N + j]; return r.result === 'accept' ? 'accepts' : r.result === 'reject' ? 'rejects' + (r.reason ? ': ' + r.reason : '') : 'no answer within ' + cap + ' steps'; };
  const sym = x => x === 'A' ? '✓' : x === 'R' ? '✗' : '∞';
  const k = ms.indexOf(m);
  const flip = ms.map((_, i) => v(i, i) === 'A' ? 'R' : 'A');
  let html = `<div class="diagwrap"><table class="diag"><thead><tr><th></th>${ms.map(c => `<th title="⟨${esc(c.name)}⟩, ${encodeMachine(c).length} cells">⟨${esc(abbr(c.name))}⟩</th>`).join('')}</tr></thead><tbody>`;
  ms.forEach((r, i) => {
    html += `<tr class="${i === k ? 'me' : ''}"><th title="${esc(r.name)}">${esc(r.name)}</th>${ms.map((c, j) => `<td class="${v(i, j)} ${i === j ? 'dg' : ''}" title="${esc(r.name)} on ⟨${esc(c.name)}⟩: ${esc(why(i, j))}">${sym(v(i, j))}</td>`).join('')}</tr>`;
  });
  html += `<tr class="flip"><th title="Accepts ⟨Mᵢ⟩ exactly when Mᵢ does not accept it">flipped</th>${flip.map(x => `<td class="${x} dg">${sym(x)}</td>`).join('')}</tr></tbody></table></div>
    <p class="note">✓ accepts · ✗ rejects · ∞ no answer within ${cap} steps. Diagonal cells are outlined. The <b>flipped</b> row accepts ⟨Mᵢ⟩ exactly when Mᵢ does not, so it disagrees with every row in its own column: it is none of these machines.</p>`;
  if (k >= 0) {
    const others = ms.map((x, i) => i).filter(i => i !== k);
    const same = others.filter(i => (v(k, i) === 'A') === (v(i, i) === 'A'));
    html += `<p style="margin:0"><b>${esc(m.name)}</b> ${same.length ? `agrees with the diagonal at ${same.map(i => `⟨${esc(ms[i].name)}⟩`).join(', ')}, so this table does not separate it from ${same.length === 1 ? 'that machine' : 'those machines'}` : `disagrees with every other machine on that machine's own description, so it is none of them`}. On its own description ⟨${esc(m.name)}⟩ it ${esc(why(k, k))}.</p>`;
  }
  w.diagHTML = html; renderWin(w);
}

// ---------- background jobs ----------
// Long experiments run in a Web Worker built from the engine's own source, so the page stays
// responsive. If a worker cannot start here, the same jobs run on the page in small slices.
function runJob(W, j) {
  if (j.reduce) { try { return runReduction(W, j.reduce, j.w, { maxSteps: j.maxSteps }); } catch (e) { return { w: j.w, err: String(e && e.message || e), steps: [] }; } }
  let r;
  try { r = headless(W, j.target, { overrides: j.overrides || {}, seed: j.seed || 0, maxSteps: j.maxSteps || 200000 }); }
  catch (e) { return { result: 'error', reason: String(e && e.message || e) }; }
  const o = { result: r.result, reason: r.reason, cost: r.cost, space: r.space, n: r.n, accepting: r.accepting, leaves: r.leaves, unclear: !!r.unclear };
  if (j.measure) {
    const acts = r.run.history.filter(a => a.m.id === j.measure.id); let best = null, by = -1;
    for (const a of acts) { const y = metricOf(r.run, a, j.measure.metric); if (y != null && y > by) { by = y; best = a; } }
    o.m = best ? { y: by, n: best.n, over: acts.some(a => a.reason && /budget/.test(a.reason)) } : null;
  }
  if (j.pcp) { const pt = r.run.tapes.get(j.pcp.proof), ct = r.run.tapes.get(j.pcp.coins); o.queried = pt ? [...pt.queried] : []; o.coinsRead = ct ? ct.maxRead + 1 : 0; }
  if (j.circOf) { const a = r.run.history.find(x => x.m.id === j.circOf); o.circ = a && a.circ ? a.circ : null; o.circError = a ? (a.circError || null) : 'never ran'; }
  return o;
}
function metricOf(run, act, metric) {
  if (metric === 'comm') { let s = 0; for (const rt of run.tapes.values()) if (rt.spec.kind === 'channel') for (const k of rt.cells.keys()) if (k >= 0) s++; return s; }
  if (metric === 'time') return act.cost;
  if (metric === 'space') return run.space(act);
  if (!act.circ) return null;
  return metric === 'size' ? act.circ.size : metric === 'depth' ? act.circ.depth : act.circ.fanin;
}
const Jobs = { url: null, broken: false };
function workerURL() {
  if (Jobs.url) return Jobs.url;
  const src = CORE_SRC + '\n' + runJob.toString() + '\n' + metricOf.toString() + `
let W = null;
self.onmessage = e => {
  const d = e.data;
  if (d.type === 'ping') { self.postMessage({ type: 'pong' }); return; }
  if (d.type === 'world') { W = { tapes: d.world.tapes, machines: d.world.machines.map(m => compileMachine(m)), targetId: d.world.targetId }; return; }
  if (d.type === 'jobs') { const out = d.jobs.map(j => runJob(W, j)); self.postMessage({ type: 'done', id: d.id, out }); }
};`;
  Jobs.url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  return Jobs.url;
}
function startWorker() {
  if (Jobs.broken || typeof Worker === 'undefined') return Promise.resolve(null);
  return new Promise(res => {
    let w; try { w = new Worker(workerURL()); } catch (e) { Jobs.broken = true; return res(null); }
    const t = setTimeout(() => { Jobs.broken = true; try { w.terminate(); } catch (e) { } res(null); }, 3000);
    w.onmessage = e => { if (e.data.type === 'pong') { clearTimeout(t); w.onmessage = null; res(w); } };
    w.onerror = () => { clearTimeout(t); Jobs.broken = true; res(null); };
    w.postMessage({ type: 'ping' });
  });
}
// Runs jobs, reporting progress; ctrl.stop() ends early and returns the results so far.
async function runJobs(jobs, ctrl, onProgress) {
  const out = []; ctrl.stopped = false;
  const w = await startWorker();
  ctrl.where = w ? 'background' : 'page';
  if (w) {
    w.postMessage({ type: 'world', world: worldData() });
    let size = 8, seq = 0;
    ctrl.stop = () => { ctrl.stopped = true; if (ctrl._cancel) ctrl._cancel(); };
    for (let i = 0; i < jobs.length && !ctrl.stopped; ) {
      const chunk = jobs.slice(i, i + size); const t0 = performance.now(); const id = ++seq;
      const res = await new Promise(r => {
        ctrl._cancel = () => { try { w.terminate(); } catch (e) { } r(null); };
        w.onmessage = e => { if (e.data.type === 'done' && e.data.id === id) r(e.data.out); };
        w.onerror = ev => { ev.preventDefault && ev.preventDefault(); r(chunk.map(() => ({ result: 'error', reason: 'the background worker failed' }))); };
        w.postMessage({ type: 'jobs', id, jobs: chunk });
      });
      if (!res) break;
      out.push(...res); i += chunk.length;
      const dt = performance.now() - t0; size = Math.max(1, Math.min(400, Math.round(size * (dt < 60 ? 2 : dt > 250 ? 0.5 : 1))));
      if (onProgress) onProgress(out.length, jobs.length);
    }
    try { w.terminate(); } catch (e) { }
    return out;
  }
  ctrl.stop = () => { ctrl.stopped = true; };
  let t0 = performance.now();
  for (const j of jobs) {
    if (ctrl.stopped) break;
    out.push(runJob(world, j));
    if (performance.now() - t0 > 40) { if (onProgress) onProgress(out.length, jobs.length); await new Promise(r => setTimeout(r, 0)); t0 = performance.now(); }
  }
  return out;
}
function progText(ctrl, done, total, what) { return `${done.toLocaleString()} of ${total.toLocaleString()} ${what}${ctrl.where === 'background' ? ' · running in the background' : ''}`; }

// ---------- compare languages ----------
// A machine "runs on its own" if it has an input tape and needs nothing built for it first.
function standalone(m) { return !!(m && m.compiled && inputTapeFor(m) && !(m.kind === 'circuit' && !m.compiled.circ)); }
function compareRunner(m) {
  if (standalone(m)) return m;
  const t = machineById(world.targetId);
  if (t && reaches(t, m) && standalone(t)) return t;
  return world.machines.find(x => x !== m && reaches(x, m) && standalone(x)) || null;
}
function compareSection(w, m) {
  const A = compareRunner(m); if (!A) return '';
  const L = labOf(m); const cands = world.machines.filter(x => x !== m && x !== A && standalone(x));
  const B = machineById(L.cmpWith) && cands.includes(machineById(L.cmpWith)) ? machineById(L.cmpWith) : cands[0];
  const alpha = L.cmpAlpha || alphaOf(inputTapeFor(A));
  const running = w.cmpRun && !w.cmpRun.done;
  return `<section class="sec">
    <h4 class="th4">Compare languages</h4>
    <p class="note">Runs ${A === m ? `<b>${esc(m.name)}</b>` : `<b>${esc(A.name)}</b> (it builds and runs ${esc(m.name)}, which cannot run on its own)`} and another machine on the same strings and lists every string where one accepts and the other does not. Every string up to the length you choose is tried, plus random longer ones. Agreement on all of them is evidence of equal languages, not a proof.</p>
    ${cands.length ? `<div class="formgrid">
      <label class="field wide"><span class="lbl">Compare with</span><select data-lab="cmpWith">${cands.map(x => `<option value="${x.id}" ${x === B ? 'selected' : ''}>${esc(x.name)} (${KIND_LABEL[x.kind]})</option>`).join('')}</select></label>
      <label class="field"><span class="lbl">Alphabet</span><input data-lab="cmpAlpha" value="${esc(alpha)}" spellcheck="false"></label>
      <label class="field"><span class="lbl">Every string up to length</span><input type="number" min="0" max="16" data-lab="cmpLen" value="${L.cmpLen != null ? L.cmpLen : 6}"></label>
      <label class="field"><span class="lbl">Random strings</span><input type="number" min="0" max="5000" data-lab="cmpRand" value="${L.cmpRand != null ? L.cmpRand : 200}"></label>
      <label class="field"><span class="lbl">up to length</span><input type="number" min="0" max="200" data-lab="cmpRandLen" value="${L.cmpRandLen != null ? L.cmpRandLen : 14}"></label>
    </div>
    <div class="row"><button class="btn primary small" data-act="compare" ${running ? 'disabled' : ''}>Compare</button>${running ? '<button class="btn small" data-act="cmpstop">Stop</button>' : ''}<span class="note" data-r="cmpprog"></span></div>
    ${w.cmpHTML ? `<div class="labout ${m.color}">${w.cmpHTML}</div>` : ''}` : '<p class="note disabled">There is no other machine with an input tape to compare with. Add one from + Add.</p>'}
  </section>`;
}
async function runCompare(w, m) {
  const A = compareRunner(m); const L = labOf(m);
  const cands = world.machines.filter(x => x !== m && x !== A && standalone(x));
  const B = (machineById(L.cmpWith) && cands.includes(machineById(L.cmpWith))) ? machineById(L.cmpWith) : cands[0];
  if (!A || !B) return;
  const alpha = [...new Set([...(L.cmpAlpha || alphaOf(inputTapeFor(A)))])].filter(c => c !== '_' && c !== ' ');
  const fail = msg => { w.cmpRun = { done: true }; w.cmpHTML = `<div class="err">${esc(msg)}</div>`; renderWin(w); };
  if (!alpha.length) return fail('The alphabet is empty.');
  const k = Math.max(0, Math.min(16, L.cmpLen != null ? L.cmpLen : 6));
  const strs = [];
  for (let len = 0; len <= k; len++) {
    const tot = Math.pow(alpha.length, len); if (strs.length + tot > 20000) break;
    for (let x = 0; x < tot; x++) { let s = '', y = x; for (let i = 0; i < len; i++) { s = alpha[y % alpha.length] + s; y = Math.floor(y / alpha.length); } strs.push(s); }
  }
  const exhaustiveTo = strs.length ? strs[strs.length - 1].length : -1;
  const rnd = mulberry32(777); const rl = Math.max(exhaustiveTo + 1, L.cmpRandLen != null ? L.cmpRandLen : 14);
  for (let i = 0; i < (L.cmpRand != null ? L.cmpRand : 200); i++) { const len = exhaustiveTo + 1 + Math.floor(rnd() * Math.max(1, rl - exhaustiveTo)); let s = ''; for (let j = 0; j < len; j++) s += alpha[Math.floor(rnd() * alpha.length)]; strs.push(s); }
  const ta = inputTapeFor(A), tb = inputTapeFor(B);
  const ta_n = usesRandom(A) ? 15 : 1, tb_n = usesRandom(B) ? 15 : 1;
  const jobs = [];
  for (const s of strs) {
    for (let i = 0; i < ta_n; i++) jobs.push({ target: A.id, overrides: { [ta.id]: s }, seed: i + 1, maxSteps: L.cap });
    for (let i = 0; i < tb_n; i++) jobs.push({ target: B.id, overrides: { [tb.id]: s }, seed: i + 1, maxSteps: L.cap });
  }
  const job = { done: false }; w.cmpRun = job; w.cmpHTML = ''; renderWin(w);
  const res = await runJobs(jobs, job, (d, n) => { const p = w.el.querySelector('[data-r=cmpprog]'); if (p) p.textContent = progText(job, Math.floor(d / (ta_n + tb_n)), strs.length, 'strings'); });
  const verdict = rs => { if (rs.length === 1) return rs[0].result === 'timeout' ? 'loop' : rs[0].result === 'accept' ? 'acc' : 'rej'; return rs.filter(r => r.result === 'accept').length * 2 > rs.length ? 'acc' : 'rej'; };
  const byLen = new Map(); const diffs = []; let done = 0, aAcc = 0, bAcc = 0, loopsSeen = 0;
  const per = ta_n + tb_n;
  for (let i = 0; (i + 1) * per <= res.length; i++) {
    const s = strs[i]; const chunk = res.slice(i * per, (i + 1) * per);
    const va = verdict(chunk.slice(0, ta_n)), vb = verdict(chunk.slice(ta_n));
    if (!byLen.has(s.length)) byLen.set(s.length, { n: 0, d: 0, a: 0, b: 0, ex: s.length <= exhaustiveTo });
    const row = byLen.get(s.length); row.n++; if (va === 'acc') { row.a++; aAcc++; } if (vb === 'acc') { row.b++; bAcc++; }
    if (va === 'loop' || vb === 'loop') loopsSeen++;
    if ((va === 'acc') !== (vb === 'acc')) { row.d++; diffs.push({ s, va, vb }); }
    done++;
  }
  job.done = true;
  const V = { acc: 'accepts', rej: 'rejects', loop: 'hits step cap' };
  const probabilistic = usesRandom(A) || usesRandom(B);
  const head = diffs.length
    ? `<p class="note" style="color:var(--bad)"><b>The languages differ.</b> ${diffs.length} of ${done} strings are accepted by only one machine. Shortest: <b style="font-family:var(--f-mono)">${esc(diffs.slice().sort((x, y) => x.s.length - y.s.length || (x.s < y.s ? -1 : 1))[0].s || 'ε (empty)')}</b>.</p>`
    : `<p class="note" style="color:var(--ok)"><b>No difference found</b> on ${done} strings${exhaustiveTo >= 0 ? `, including every string up to length ${exhaustiveTo}` : ''}.</p>`;
  const lens = [...byLen.entries()].sort((a, b) => a[0] - b[0]);
  const lenTable = `<div class="tablewrap"><table class="rtable"><thead><tr><th>length</th><th>strings</th><th>${esc(A.name)} accepts</th><th>${esc(B.name)} accepts</th><th>differ</th></tr></thead><tbody>${lens.map(([n, r]) => `<tr class="${r.d ? 'miss' : ''}"><td>${n}</td><td>${r.n}${r.ex ? ' (all)' : ''}</td><td>${r.a}</td><td>${r.b}</td><td>${r.d}</td></tr>`).join('')}</tbody></table></div>`;
  const sorted = diffs.sort((x, y) => x.s.length - y.s.length || (x.s < y.s ? -1 : 1)).slice(0, 200);
  const diffTable = diffs.length ? `<span class="lbl">Strings where they disagree (click one to put it on the tape)</span><div class="tablewrap"><table class="rtable tt cex"><thead><tr><th>string</th><th>${esc(A.name)}</th><th>${esc(B.name)}</th></tr></thead><tbody>${sorted.map(d => `<tr data-act="loadcex" data-cex="${esc(d.s)}" tabindex="0"><td>${esc(d.s || 'ε')}</td><td>${V[d.va]}</td><td>${V[d.vb]}</td></tr>`).join('')}</tbody></table></div>` : '';
  w.cmpHTML = `<span class="lbl">${esc(A.name)} vs ${esc(B.name)} · alphabet {${esc(alpha.join(','))}}${job.stopped ? ' · stopped early' : ''}</span>${head}${diffTable}${lenTable}
    <p class="note">${esc(A.name)} accepts ${aAcc} and ${esc(B.name)} accepts ${bAcc} of these strings.${probabilistic ? ' A randomized machine is judged by majority vote over 15 runs per string.' : ''}${loopsSeen ? ` ${loopsSeen} runs hit the step cap of ${L.cap.toLocaleString()} and count as not accepting.` : ''}</p>`;
  renderWin(w);
}

// ---------- truth table / equivalence ----------
function truthSection(w, m, R) {
  const c = m.compiled; const L = labOf(m);
  const fixed = !!c.circ; const t = inputTapeFor(R);
  const curLen = (() => { if (!t) return 4; let n = 0; const s = t.init || ''; for (const ch of s) { if (ch === '_') break; n++; } return n; })();
  const k = fixed ? c.circ.nIn : (L.ttLen != null ? L.ttLen : curLen);
  const others = world.machines.filter(x => x !== m && x.compiled && inputTapeFor(x));
  const cmp = L.ttCmp && machineById(L.ttCmp) ? L.ttCmp : '';
  return `<section class="sec">
    <h4 class="th4">Truth table</h4>
    <p class="note">Evaluates the circuit on every input of its length${fixed ? '' : `. Circuit n is built by running <b>${esc(R.name)}</b> on an input of length n`}. To check it against another machine, use <b>Compare languages</b> below.</p>
    <div class="formgrid">
      ${fixed ? `<span class="note">This circuit reads ${k} input bits: ${Math.pow(2, k)} rows.</span>` : `<label class="field"><span class="lbl">Input length n</span><input type="number" min="0" max="12" data-lab="ttLen" value="${k}"></label>`}

    </div>
    <div class="row"><button class="btn primary small" data-act="truth">Build truth table</button><span class="note" data-r="ttprog"></span></div>
    ${w.truthHTML ? `<div class="labout ${m.color}">${w.truthHTML}</div>` : ''}
  </section>`;
}
async function runTruth(w, m) {
  const c = m.compiled; const L = labOf(m); const R = labRunMachine(m);
  const fail = msg => { w.truthHTML = `<div class="err">${esc(msg)}</div>`; renderWin(w); };
  let C = c.circ, nLabel = '';
  if (!C) {
    const k = Math.max(0, Math.min(12, L.ttLen != null ? L.ttLen : 4)); const t = inputTapeFor(R);
    if (!t) return fail(`${R.name} has no input tape to build the circuit from.`);
    const [r] = await runJobs([{ target: R.id, overrides: { [t.id]: '0'.repeat(k) }, maxSteps: L.cap, circOf: m.id }], {});
    if (!r || r.circError === 'never ran') return fail(`${m.name} never ran when ${R.name} was given an input of length ${k}.`);
    if (!r.circ) return fail(`The description ${R.name} wrote does not parse: ${r.circError}`);
    C = r.circ; nLabel = ` for n = ${k}`;
  }
  if (C.nIn > 12) return fail(`${C.nIn} input bits is ${Math.pow(2, C.nIn)} rows; the truth table stops at 12 bits.`);
  const M = null, mt = null;
  if (M && !mt) return fail(`${M.name} has no input tape to feed the bits to.`);
  const rows = []; const N = Math.pow(2, C.nIn); let t0 = performance.now(), bad = 0;
  for (let x = 0; x < N; x++) {
    const bits = []; for (let i = 0; i < C.nIn; i++) bits.push((x >> (C.nIn - 1 - i)) & 1);
    const out = evalCircuit(C, bits); let other = null;
    if (M) { const r = headless(world, M.id, { overrides: { [mt.id]: bits.join('') }, maxSteps: L.cap }); other = r.result === 'accept' ? 1 : r.result === 'reject' ? 0 : '?'; if (other !== out) bad++; }
    rows.push({ bits: bits.join(''), out, other });
    if (performance.now() - t0 > 40) { const p = w.el.querySelector('[data-r=ttprog]'); if (p) p.textContent = `${x + 1} of ${N}`; await new Promise(r => setTimeout(r, 0)); t0 = performance.now(); }
  }
  const shown = (M ? [...rows.filter(r => r.other !== r.out), ...rows.filter(r => r.other === r.out)] : rows).slice(0, 256);
  const ones = rows.filter(r => r.out === 1).length;
  w.truthHTML = `<span class="lbl">Circuit${esc(nLabel)} · ${C.nIn} inputs · size ${C.size} · depth ${C.depth} · fan-in ${C.fanin}</span>
    ${M ? (bad ? `<p class="note" style="color:var(--bad)"><b>Disagrees with ${esc(M.name)} on ${bad} of ${N} inputs</b>, listed first. The first is ${esc(rows.find(r => r.other !== r.out).bits || '(empty)')}.</p>` : `<p class="note" style="color:var(--ok)"><b>Agrees with ${esc(M.name)} on all ${N} inputs</b> of length ${C.nIn}.</p>`) : `<p class="note">Outputs 1 on ${ones} of ${N} inputs.</p>`}
    <div class="tablewrap"><table class="rtable tt"><thead><tr><th>input</th><th>circuit</th>${M ? `<th>${esc(M.name)}</th><th></th>` : ''}</tr></thead><tbody>${shown.map(r => `<tr class="${M && r.other !== r.out ? 'miss' : ''}"><td>${esc(r.bits || 'ε')}</td><td>${r.out}</td>${M ? `<td>${r.other}</td><td>${r.other === r.out ? '✓' : '✗'}</td>` : ''}</tr>`).join('')}</tbody></table></div>
    ${rows.length > 256 ? `<p class="note">Showing 256 of ${rows.length} rows.</p>` : ''}`;
  renderWin(w);
}

// ---------- scaling lab ----------
function compileGen(src) {
  let f;
  try { f = new Function('return (' + src + '\n)')(); } catch (e) { throw new Error('generator does not parse: ' + e.message); }
  if (typeof f !== 'function') throw new Error('the generator must be a function, like (n, rand, pick) => "..."');
  return f;
}
function resolveOverrides(m, out) {
  const first = inputTapeFor(m);
  if (typeof out === 'string') { if (!first) throw new Error('the machine has no first tape to put the string on'); return { [first.id]: out }; }
  if (!out || typeof out !== 'object') throw new Error('the generator returned ' + typeof out + ', expected a string or an object');
  const o = {};
  for (const [k, v] of Object.entries(out)) {
    let t = world.tapes.find(x => x.name === k);
    if (!t && m.bind[k]) t = tapeById(m.bind[k]);
    if (!t) throw new Error(`no tape or port called "${k}"`);
    o[t.id] = String(v);
  }
  return o;
}

async function runLab(w, m) {
  const L = labOf(m); const R = labRunMachine(m); const t = inputTapeFor(R);
  const job = { done: false }; w.labRun = job; w.labHTML = ''; renderWin(w);
  const prog = () => w.el.querySelector('[data-r=labprog]');
  const fail = msg => { job.done = true; w.labHTML = `<div class="err">${esc(msg)}</div>`; renderWin(w); };
  if (L.mode !== 'gen' && (!t || t.kind === 'random')) return fail(`Wire the first port of ${R.name} to a normal input tape first.`);
  let gen = null;
  if (L.mode === 'gen') { try { gen = compileGen(genOf(m)); } catch (e) { return fail(e.message); } }
  const alpha = alphaOf(t);
  const sizes = []; for (let n = Math.max(0, L.from); n <= Math.min(500, L.to) && sizes.length < 400; n += Math.max(1, L.step)) sizes.push(n);
  if (!sizes.length) return fail('The size range is empty.');
  const rnd = mulberry32(12345); const pick = s => { s = String(s); return s[Math.floor(rnd() * s.length)]; };
  const runs = []; let seed = 1, timeouts = 0, missed = 0;
  const fan = m.budgetFanin ? parseInt(m.budgetFanin, 10) : null;
  const budget = { time: m.timeFn, space: m.spaceFn, size: m.sizeFn, depth: m.depthFn, fanin: fan != null ? () => fan : null }[L.metric] || null;
  const jobs = [], meta = [];
  for (const n of sizes) {
    const exact = L.mode === 'auto' && Math.pow(alpha.length, n) <= L.exact;
    const push = ov => { jobs.push({ target: R.id, overrides: ov, seed: seed++, maxSteps: L.cap, measure: { id: m.id, metric: L.metric } }); meta.push({ size: n, exact }); };
    if (exact) { const tot = Math.pow(alpha.length, n); for (let k = 0; k < tot; k++) { let s = '', x = k; for (let i = 0; i < n; i++) { s += alpha[x % alpha.length]; x = Math.floor(x / alpha.length); } push({ [t.id]: s }); } }
    else for (let i = 0; i < L.per; i++) {
      if (gen) { let out; try { out = gen(n, rnd, pick); } catch (e) { return fail(`generator failed at n=${n}: ${e.message}`); } try { push(resolveOverrides(R, out)); } catch (e) { return fail(e.message); } }
      else { let s = ''; for (let j = 0; j < n; j++) s += alpha[Math.floor(rnd() * alpha.length)]; push({ [t.id]: s }); }
    }
    if (jobs.length > 200000) return fail('That is more than 200,000 runs. Narrow the size range or use fewer inputs per size.');
  }
  w.labRun = job;
  const res = await runJobs(jobs, job, d => { const p = prog(); if (p) p.textContent = progText(job, d, jobs.length, 'runs'); });
  res.forEach((r, i) => {
    if (r.result === 'timeout') timeouts++;
    if (!r.m) missed++; else runs.push({ size: meta[i].size, n: r.m.n, y: r.m.y, acc: r.result === 'accept', exact: meta[i].exact, over: r.m.over });
  });
  job.done = true; w.labHTML = labResultHTML(m, runs, L, budget, timeouts, job.stopped, missed, R); renderWin(w);
}

function fitGrowth(pts) {
  const use = pts.filter(p => p.n >= 2 && p.y > 0); if (use.length < 4) return null;
  const lin = (xs, ys) => { const k = xs.length, mx = xs.reduce((a, b) => a + b) / k, my = ys.reduce((a, b) => a + b) / k;
    const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0), sxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
    const b = sxx ? sxy / sxx : 0; const ssr = ys.reduce((s, y, i) => s + (y - (my + b * (xs[i] - mx))) ** 2, 0), sst = ys.reduce((s, y) => s + (y - my) ** 2, 0);
    return { b, r2: sst ? 1 - ssr / sst : 1 }; };
  const ly = use.map(p => Math.log(p.y));
  const poly = lin(use.map(p => Math.log(p.n)), ly), expo = lin(use.map(p => p.n), ly);
  const logf = lin(use.map(p => Math.log2(p.n)), use.map(p => p.y));
  return { poly, expo, logf };
}

function labResultHTML(m, runs, L, budget, timeouts, stopped, missed, RM) {
  const mname = { time: 'steps', space: 'space', size: 'size', depth: 'depth', fanin: 'fan-in', comm: 'communication' }[L.metric];
  if (!runs.length) return `<p class="note">${missed ? `${esc(m.name)} never ran in ${missed} runs of ${esc(RM.name)}.` : 'No runs finished.'}</p>`;
  const byN = new Map();
  for (const r of runs) { if (!byN.has(r.n)) byN.set(r.n, []); byN.get(r.n).push(r); }
  const pts = [...byN.entries()].sort((a, b) => a[0] - b[0]).map(([n, rs]) => ({ n, y: Math.max(...rs.map(r => r.y)), mean: rs.reduce((s, r) => s + r.y, 0) / rs.length, k: rs.length, acc: rs.filter(r => r.acc).length, exact: rs.every(r => r.exact), over: rs.filter(r => r.over).length }));
  const nMin = Math.min(...pts.map(p => p.n)), nMax = Math.max(nMin + 1, ...pts.map(p => p.n));
  const yData = Math.max(1, ...runs.map(r => r.y));
  let ymax = yData;
  if (budget) for (const p of pts) ymax = Math.max(ymax, Math.min(budget(p.n), yData * 3));
  const W = 400, H = 210, Lp = 44, R = 12, T = 12, B = 30;
  const X = n => Lp + (n - nMin) / (nMax - nMin) * (W - Lp - R), Y = v => T + (1 - v / ymax) * (H - T - B);
  const nice = v => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : String(Math.round(v));
  let svg = `<svg class="chart ${m.color}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Worst-case ${L.metric} by input length">`;
  [0, 0.5, 1].forEach(f => { const v = ymax * f; svg += `<line class="grid" x1="${Lp}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${Lp - 5}" y="${Y(v) + 3}" text-anchor="end">${nice(v)}</text>`; });
  const tickStep = Math.max(1, Math.ceil((nMax - nMin) / 6));
  for (let n = nMin; n <= nMax; n += tickStep) svg += `<text x="${X(n)}" y="${H - 15}" text-anchor="middle">${n}</text>`;
  svg += `<line class="axis" x1="${Lp}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}"/><text x="${(Lp + W - R) / 2}" y="${H - 2}" text-anchor="middle">input length n (as ${esc(m.name)} sees it)</text>`;
  if (budget) { let d = ''; for (let n = nMin; n <= nMax; n += (nMax - nMin) / 80) { const v = budget(n); if (v > ymax * 1.02) break; d += (d ? 'L' : 'M') + X(n).toFixed(1) + ',' + Y(v).toFixed(1); } if (d) svg += `<path class="bud" d="${d}"/>`; }
  const cloud = runs.length > 1500 ? runs.filter((_, i) => i % Math.ceil(runs.length / 1500) === 0) : runs;
  cloud.forEach(r => { svg += `<circle class="cloud" cx="${X(r.n).toFixed(1)}" cy="${Y(r.y).toFixed(1)}" r="1.6"/>`; });
  svg += `<path class="ln" d="${pts.map((p, i) => (i ? 'L' : 'M') + X(p.n).toFixed(1) + ',' + Y(p.y).toFixed(1)).join('')}"/>`;
  pts.forEach(p => { svg += `<circle class="pt ${p.exact ? '' : 'hollow'}" cx="${X(p.n).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3"><title>n=${p.n}: worst ${p.y}, mean ${p.mean.toFixed(1)} over ${p.k} inputs</title></circle>`; });
  svg += '</svg>';
  const fit = fitGrowth(pts);
  let growth = '';
  if (fit) {
    if (fit.logf.r2 > fit.poly.r2 + 0.02 && fit.logf.r2 > fit.expo.r2 && fit.logf.b > 0) growth = `Worst case grows roughly like <b>${fit.logf.b.toFixed(2)}·log₂ n</b> (logarithmic fit r² ${fit.logf.r2.toFixed(3)}, polynomial r² ${fit.poly.r2.toFixed(3)}).`;
    else if (fit.expo.r2 > fit.poly.r2 + 0.02 && fit.expo.b > 0.05) growth = `Worst case grows roughly like <b>${Math.exp(fit.expo.b).toFixed(2)}<sup>n</sup></b> (exponential fit r² ${fit.expo.r2.toFixed(3)}, polynomial r² ${fit.poly.r2.toFixed(3)}).`;
    else growth = `Worst case grows roughly like <b>n<sup>${fit.poly.b.toFixed(2)}</sup></b> on this range (polynomial fit r² ${fit.poly.r2.toFixed(3)}).`;
  }
  const overs = pts.reduce((s, p) => s + p.over, 0);
  const rows = pts.map(p => `<tr><td>${p.n}</td><td>${p.k}${p.exact ? ' (all)' : ''}</td><td>${p.y}</td><td>${p.mean.toFixed(1)}</td><td>${Math.round(p.acc / p.k * 100)}%</td></tr>`).join('');
  return `<span class="lbl">Worst-case ${mname} of ${esc(m.name)} by input length · ${runs.length} runs${RM !== m ? ' of ' + esc(RM.name) : ''}${stopped ? ' (stopped early)' : ''}</span>${svg}
    <p class="note">Line: worst case at each n. Filled dot: every string of that length was tried, so it is the true worst case. Hollow dot: a sample. Faint dots: individual runs.${budget ? ' Dashed red: the declared budget.' : ''}</p>
    ${growth ? `<p class="note">${growth} A fit over a finite range is evidence, not a proof.</p>` : ''}
    ${overs ? `<p class="note" style="color:var(--bad)">${overs} runs broke a budget of ${esc(m.name)}.</p>` : ''}${missed ? `<p class="note">${missed} runs never reached ${esc(m.name)} and are not plotted.</p>` : ''}${timeouts ? `<p class="note" style="color:var(--bad)">${timeouts} runs hit the step cap of ${L.cap.toLocaleString()} and were cut off.</p>` : ''}
    <div class="tablewrap"><table class="rtable"><thead><tr><th>n</th><th>inputs</th><th>worst</th><th>mean</th><th>${RM !== m ? esc(RM.name) + ' accepted' : 'accepted'}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ---------- trials ----------
async function runTrials(w, m) {
  const L = labOf(m); const N = Math.max(10, Math.min(20000, L.trials || 500));
  w.trialHTML = '<p class="note" data-r="trprog">running…</p>'; renderWin(w);
  const job = {}; const jobs = []; for (let i = 0; i < N; i++) jobs.push({ target: m.id, seed: i + 1, maxSteps: L.cap });
  const res = await runJobs(jobs, job, d => { const p = w.el.querySelector('[data-r=trprog]'); if (p) p.textContent = progText(job, d, N, 'runs'); });
  let acc = 0, steps = 0, to = 0;
  for (const r of res) { if (r.result === 'accept') acc++; if (r.result === 'timeout') to++; steps += r.cost || 0; }
  const p = acc / N, z = 1.96, den = 1 + z * z / N, mid = (p + z * z / (2 * N)) / den, half = z * Math.sqrt(p * (1 - p) / N + z * z / (4 * N * N)) / den;
  const lo = Math.max(0, mid - half), hi = Math.min(1, mid + half);
  const verdict = lo >= 2 / 3 ? 'accepts with probability at least 2/3 on this input.' : hi <= 1 / 3 ? 'rejects with probability at least 2/3 on this input.' : 'is too close to 1/2 on this input to meet the 2/3 bound, or needs more trials to tell.';
  const inp = inputTapeFor(m);
  w.trialHTML = `<span class="lbl">${N} runs on ${inp ? `input “${esc(inp.init || '')}”` : 'the current tapes'}</span>
    <div class="row" style="align-items:baseline"><span class="bigstat">${(p * 100).toFixed(1)}%</span><span class="note">accepted · 95% interval ${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}% · mean ${(steps / N).toFixed(1)} steps${to ? ` · ${to} timeouts` : ''}</span></div>
    <div class="bar2"><i style="width:${p * 100}%"></i><b style="left:${100 / 3}%"></b><b style="left:${200 / 3}%"></b></div>
    <p class="note">The machine ${verdict} The two marks on the bar are 1/3 and 2/3.</p>`;
  renderWin(w);
}

// ---------- reduction checker ----------
async function runReductionCheck(w, r) {
  const C = redCheckOf(r); const A = machineById(r.from), B = machineById(r.to);
  const fail = msg => { w.redRun = { done: true }; w.redHTML = `<div class="err">${esc(msg)}</div>`; renderWin(w); };
  if (!A || !B || !r.via.length) return fail('Choose A, B and at least one transducer.');
  const inputs = [];
  if (C.mode === 'gen') {
    let gen; try { gen = compileGen(r.gen || defaultGen(A)); } catch (e) { return fail(e.message); }
    const rnd = mulberry32(4242); const pick = s => { s = String(s); return s[Math.floor(rnd() * s.length)]; };
    for (let n = C.from; n <= C.to; n++) for (let i = 0; i < C.per; i++) {
      let out; try { out = gen(n, rnd, pick); } catch (e) { return fail(`generator failed at n=${n}: ${e.message}`); }
      if (typeof out !== 'string') return fail('For a reduction the generator must return a string w.');
      inputs.push(out);
    }
  } else {
    const alpha = [...alphaOf(inputTapeFor(A))];
    for (let len = 0; len <= C.len; len++) {
      const tot = Math.pow(alpha.length, len); if (inputs.length + tot > 20000) break;
      for (let x = 0; x < tot; x++) { let s = '', y = x; for (let i = 0; i < len; i++) { s = alpha[y % alpha.length] + s; y = Math.floor(y / alpha.length); } inputs.push(s); }
    }
    const rnd = mulberry32(99); const lo = inputs.length ? inputs[inputs.length - 1].length + 1 : 0;
    for (let i = 0; i < C.rand; i++) { const len = lo + Math.floor(rnd() * Math.max(1, C.randLen - lo + 1)); let s = ''; for (let j = 0; j < len; j++) s += alpha[Math.floor(rnd() * alpha.length)]; inputs.push(s); }
  }
  const red = { from: r.from, to: r.to, via: r.via.slice() };
  const job = { done: false }; w.redRun = job; w.redHTML = ''; renderWin(w);
  const res = await runJobs(inputs.map(s => ({ reduce: red, w: s, maxSteps: C.cap })), job, d => { const p = w.el.querySelector('[data-r=redprog]'); if (p) p.textContent = progText(job, d, inputs.length, 'inputs'); });
  job.done = true;
  const V = { accept: 'accepts', reject: 'rejects', timeout: 'hits step cap' };
  const bad = [], errs = [], overIn = [];
  const per = r.via.map(() => new Map());
  for (const o of res) {
    if (o.err) errs.push(o); else if ((o.steps || []).some(s => s.over)) overIn.push(o); else if ((o.a === 'accept') !== (o.b === 'accept')) bad.push(o);
    (o.steps || []).forEach((s, i) => {
      if (!per[i]) return; const m = per[i]; if (!m.has(s.n)) m.set(s.n, { k: 0, cost: 0, space: 0, out: 0, over: 0 });
      const e = m.get(s.n); e.k++; e.cost = Math.max(e.cost, s.cost); e.space = Math.max(e.space, s.space); e.out = Math.max(e.out, s.outLen); if (s.over) e.over++;
    });
  }
  const overs = overIn.length;
  const byLen = (x, y) => x.w.length - y.w.length || (x.w < y.w ? -1 : 1);
  bad.sort(byLen); errs.sort(byLen); overIn.sort(byLen);
  let head, state, text;
  if (errs.length) { state = 'fail'; text = `f fails on ${errs.length} input${errs.length === 1 ? '' : 's'}`; head = `<p class="note" style="color:var(--bad)"><b>Not a reduction yet:</b> on ${errs.length} input${errs.length === 1 ? '' : 's'} the transducer did not produce an answer. First: <b style="font-family:var(--f-mono)">${esc(errs[0].w || 'ε')}</b>: ${esc(errs[0].err)}.</p>`; }
  else if (bad.length) { state = 'fail'; text = `wrong on ${bad.length} input${bad.length === 1 ? '' : 's'}`; head = `<p class="note" style="color:var(--bad)"><b>Not a reduction:</b> on ${bad.length} of ${res.length} inputs, A and B disagree. Shortest: <b style="font-family:var(--f-mono)">${esc(bad[0].w || 'ε')}</b>.</p>`; }
  else if (overs) { state = 'over'; text = `over budget on ${overs} input${overs === 1 ? '' : 's'}`; head = `<p class="note" style="color:var(--bad)">A transducer <b>broke its budget</b> on ${overs} of ${res.length} inputs (it was stopped there, so its output is cut short). Shortest: <b style="font-family:var(--f-mono)">${esc(overIn[0].w || 'ε')}</b>. Every other input agrees. Loosen the budget or make the transducer cheaper.</p>`; }
  else { state = 'ok'; text = `verified on ${res.length} inputs`; head = `<p class="note" style="color:var(--ok)"><b>A(w) = B(f(w)) on all ${res.length} inputs</b>, and every transducer stayed within its budget.</p>`; }
  if (job.stopped) text += ' (stopped early)';
  r.status = { state, text };
  const showBad = [...errs, ...bad, ...overIn.map(o => Object.assign({}, o, { err: 'over its budget: ' + ((o.steps.find(s => s.over) || {}).reason || '') }))].slice(0, 150);
  const badTable = showBad.length ? `<span class="lbl">Inputs where it fails (click one to put it on A's tape)</span><div class="tablewrap"><table class="rtable cex"><thead><tr><th>w</th><th>f(w)</th><th>${esc(A.name)}(w)</th><th>${esc(B.name)}(f(w))</th></tr></thead><tbody>${showBad.map(o => `<tr data-act="redLoad" data-w="${esc(o.w)}" tabindex="0"><td>${esc(o.w || 'ε')}</td><td>${esc(o.err ? '—' : (o.fw || 'ε'))}</td><td>${esc(V[o.a] || o.a || '')}</td><td>${esc(o.err ? o.err : V[o.b] || o.b || '')}</td></tr>`).join('')}</tbody></table></div>` : '';
  const resTables = r.via.map((id, i) => {
    const f = machineById(id); if (!f) return ''; const rows = [...per[i].entries()].sort((x, y) => x[0] - y[0]);
    const tb = n => f.timeFn ? Math.floor(f.timeFn(n)) : null, sb = n => f.spaceFn ? Math.floor(f.spaceFn(n)) : null;
    return `<span class="lbl">${esc(f.name)}${r.via.length > 1 ? ` (step ${i + 1})` : ''}: cost by input length${f.kind === 'script' ? ' · a script: its steps and space are not meaningful' : ''}</span>
      <div class="tablewrap"><table class="rtable"><thead><tr><th>n</th><th>inputs</th><th>max steps</th><th>budget</th><th>max space</th><th>budget</th><th>max |output|</th></tr></thead><tbody>${rows.map(([n, e]) => `<tr class="${e.over ? 'miss' : ''}"><td>${n}</td><td>${e.k}</td><td>${e.cost}</td><td>${tb(n) ?? '—'}</td><td>${e.space}</td><td>${sb(n) ?? '—'}</td><td>${e.out}</td></tr>`).join('')}</tbody></table></div>`;
  }).join('');
  w.redHTML = `<span class="lbl">${esc(A.name)} ≤ ${esc(B.name)} via ${r.via.map(id => esc(nameOf(id))).join(' → ')}${job.stopped ? ' · stopped early' : ''}</span>${head}${badTable}${resTables}
    <p class="note">Space counts work-tape cells only: the read-only input and the one-way output tape are free, as in the definition of a log-space transducer.</p>`;
  save(); renderStructure(); renderLive(); renderWin(w);
}
