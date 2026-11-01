// ---------- buttons, inputs and displays ----------
// Devices only touch tapes. An input writes to its tape (and may then start a run of a machine);
// a display draws its tape's cells and nothing else. Inputs are blocked while a run is in progress,
// so every run still starts from fixed tapes.
const DEV_KINDS = { button: 'Button', switch: 'Switch', numin: 'Number input', textin: 'Text input', clock: 'Clock', display: 'Display' };
const DISPLAY_FMTS = { lamps: 'Lamps: one per cell', pixels: 'Pixel grid', digits: 'Seven-segment digits', number: 'Number', text: 'Text' };
const NUM_ENCS = { binLSB: 'binary, least significant bit first', binMSB: 'binary, most significant bit first', unary: 'unary (1ⁿ)', dec: 'decimal digits' };
function devById(id) { return (world.devices || []).find(d => d.id === id); }
function devTape(d) { return d && d.tape ? tapeById(d.tape) : null; }
function tapeCells(t) { // what the displayed run holds on this tape, from cell 0 to the first blank
  const rt = t && run && run.tapes.get(t.id); if (!rt) return '';
  let s = ''; for (let i = 0; rt.cells.has(i) && i < 4096; i++) s += rt.cells.get(i); return s;
}
function cellAt(t, i) { const rt = t && run && run.tapes.get(t.id); return rt ? (rt.cells.get(i) ?? '_') : '_'; }
function busyRun() { return !runLive && !finished() && (playing || run.steps > 0 || !!tree); }

function encodeNum(v, enc) {
  const n = Math.max(0, Math.floor(v));
  if (enc === 'unary') return '1'.repeat(Math.min(n, 4000));
  if (enc === 'dec') return String(n);
  const b = n.toString(2); return enc === 'binLSB' ? [...b].reverse().join('') : b;
}
function decodeNum(s, enc) {
  if (enc === 'unary') { let k = 0; while (s[k] === '1') k++; return { v: k, ok: k === s.length }; }
  if (enc === 'dec') { const m = s.match(/^\d+/); return { v: m ? Number(m[0]) : 0, ok: !!m && m[0].length === s.length }; }
  const m = s.match(/^[01]+/); if (!m) return { v: 0, ok: s === '' };
  const b = enc === 'binLSB' ? [...m[0]].reverse().join('') : m[0];
  return { v: parseInt(b, 2), ok: m[0].length === s.length };
}

const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g' };
function sevenSeg(ch) {
  const on = ch === '_' ? '' : SEG[ch] !== undefined ? SEG[ch] : SEG['-'];
  const P = { a: 'M3,1 h10', b: 'M14,2 v10', c: 'M14,14 v10', d: 'M3,25 h10', e: 'M2,14 v10', f: 'M2,2 v10', g: 'M3,13 h10' };
  return `<svg viewBox="0 0 16 26" class="seg7" aria-hidden="true">${Object.entries(P).map(([k, d]) => `<path d="${d}" class="${on.includes(k) ? 'on' : ''}"/>`).join('')}</svg>`;
}

const DEV_LOOKS = ['brass', 'flat', 'alu'];
let devLook = 'flat'; try { const l = localStorage.getItem('tw-look'); if (DEV_LOOKS.includes(l)) devLook = l; } catch (e) { }
let flatDev = devLook !== 'brass'; // flat and aluminium both draw digits and text as segment and screen readouts
function setDevLook(look) {
  if (!DEV_LOOKS.includes(look)) look = 'flat';
  devLook = look; flatDev = look !== 'brass';
  document.body.classList.toggle('flatdev', look === 'flat'); document.body.classList.toggle('aludev', look === 'alu'); document.body.classList.toggle('brassdev', look === 'brass');
  document.querySelectorAll('#mLook [data-look]').forEach(b => { b.classList.toggle('on', b.dataset.look === look); b.setAttribute('aria-pressed', String(b.dataset.look === look)); });
  try { localStorage.setItem('tw-look', look); } catch (e) { }
  if (typeof updateDevices === 'function' && typeof world !== 'undefined' && world) updateDevices();
}
const DEV_COLORS = { red: 'Red', amber: 'Amber', green: 'Green', blue: 'Blue', white: 'White' };
function deviceBody(d) {
  const lab = d.label || '';
  if (d.kind === 'button') return `<button class="pushbtn c-${d.color || 'red'}" data-press aria-label="${esc(lab || d.name || 'Button')}"><span class="cap">${esc(lab.slice(0, 3))}</span></button>`;
  if (d.kind === 'switch') return `<button class="toggle ${run && cellAt(devTape(d), d.cell | 0) === '1' ? 'on' : ''}" data-press role="switch" aria-label="${esc(lab || d.name || 'Switch')}"><span class="plate"><em class="t-on">ON</em><em class="t-off">OFF</em></span><span class="bat"></span><span class="pivot"></span></button>`;
  if (d.kind === 'numin' || d.kind === 'textin') {
    const num = d.kind === 'numin';
    return `<div class="carriage"><input class="slip ${num ? 'num' : ''}" ${num ? 'type="number" min="0" step="1"' : 'spellcheck="false"'} data-devin value="${esc(d.draft ?? d.last ?? '')}" placeholder="${num ? '0' : 'type…'}" aria-label="${esc(lab || d.name || (num ? 'Number' : 'Text'))}"><button class="typekey" data-press aria-label="${d.run ? 'Write and run' : 'Write'}"><span>${num ? '#' : '↵'}</span></button></div>`;
  }
  if (d.kind === 'clock') return `<div class="clockdev"><div class="face" aria-hidden="true"><b class="hand" style="transform:rotate(${(d.ticks || 0) * 30}deg)"></b><span class="hub"></span></div><div class="clockside"><button class="crown" data-clock aria-label="${d.running ? 'Stop the clock' : 'Start the clock'}" aria-pressed="${!!d.running}"><span>${d.running ? '■' : '▶'}</span></button><span class="every">${fmtInterval(d.interval)}</span></div></div>`;
  return `<div class="devscreen" data-r="devscreen"></div>`;
}
function fmtInterval(s) { s = Number(s) || 1; return s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${+s.toFixed(2)} s`; }
function deviceHTML(d) {
  if (!d.pos) d.pos = freeSpot(200, 90);
  const t = devTape(d); const runM = d.run && machineById(d.run); const none = (d.kind === 'button' || d.kind === 'clock') && (d.action || (d.kind === 'clock' ? 'none' : 'set')) === 'none';
  const tag = d.kind === 'clock' && (d.action || 'none') === 'none' ? '' : none ? '' : t ? `${d.kind === 'display' ? 'shows' : 'writes'} ${esc(t.name)}` : '<span style="color:var(--bad)">no tape</span>';
  const lab = '';
  return `<div class="dev drag k-${d.kind} ${d.kind === 'clock' && d.running ? 'running' : ''} ${d.kind === 'display' ? 'f-' + (d.fmt || 'lamps') : ''}" data-did="${d.id}" style="left:${d.pos.x}px;top:${d.pos.y}px">
    <div class="devlabel"><b>${esc(d.name || DEV_KINDS[d.kind])}</b><span class="meta" title="${tag}${runM ? `${tag ? ' · ' : ''}runs ${esc(runM.name)}` : ''}">${tag}${runM ? `${tag ? ' · ' : ''}runs ${esc(runM.name)}` : ''}${lab}</span><button class="ib devcfg" data-devcfg title="Settings" aria-label="Settings of ${esc(d.name || DEV_KINDS[d.kind])}">⋯</button></div>
    <div class="devbody">${deviceBody(d)}</div>
  </div>`;
}
function nixie(ch) { const lit = ch !== '_'; return `<span class="tube"><span class="mesh"></span><b class="${lit ? 'lit' : ''}">${lit ? esc(ch) : ''}</b></span>`; }
function updateDevices() {
  const busy = busyRun(); let resized = false;
  for (const d of world.devices || []) {
    const el = document.querySelector(`.dev[data-did="${d.id}"]`); if (!el) continue;
    el.classList.toggle('busy', busy && d.kind !== 'display' && d.kind !== 'clock');
    if (d.kind !== 'clock') el.querySelectorAll('[data-press], [data-devin]').forEach(b => { b.disabled = busy; b.title = busy ? 'A run is in progress: inputs wait until it ends (or press Reset)' : (b.getAttribute('aria-label') || ''); });
    const t = devTape(d);
    if (d.kind === 'switch') { const on = cellAt(t, d.cell | 0) === '1'; const sw = el.querySelector('.toggle'); sw.classList.toggle('on', on); sw.setAttribute('aria-checked', String(on)); }
    if (d.kind === 'clock') { el.classList.toggle('running', !!d.running); el.classList.toggle('waiting', !!(d.running && d.pending && busy)); const h = el.querySelector('.hand'); if (h) h.style.transform = `rotate(${(d.ticks || 0) * 30}deg)`; continue; }
    if (d.kind !== 'display') continue;
    const scr = el.querySelector('[data-r=devscreen]'); if (!scr) continue;
    const s = tapeCells(t); const fmt = d.fmt || 'lamps'; let html = '';
    const onSym = d.on || '1'; const col = d.color || (fmt === 'pixels' ? 'green' : 'amber');
    if (!t) html = '<span class="nowire">no tape wired</span>';
    else if (fmt === 'lamps') { const k = Math.max(1, Math.min(64, d.count || 8)); html = `<div class="lamps c-${col}">${Array.from({ length: k }, (_, i) => `<span class="jewel ${cellAt(t, i) === onSym ? 'on' : ''}" title="cell ${i}: ${esc(cellAt(t, i))}"><i></i>${k > 1 ? `<em>${i}</em>` : ''}</span>`).join('')}</div>`; }
    else if (fmt === 'pixels') { const w = Math.max(1, Math.min(64, d.w || 8)), h = Math.max(1, Math.min(64, d.h || 8)); html = `<div class="ledpanel"><div class="pix c-${col}" style="grid-template-columns:repeat(${w}, 1fr); width:${Math.min(300, w * 16)}px">${Array.from({ length: w * h }, (_, i) => `<i class="${cellAt(t, i) === onSym ? 'on' : ''}"></i>`).join('')}</div></div>`; }
    else if (fmt === 'digits' && flatDev) { const k = Math.max(1, Math.min(16, d.count || 4)); const cs = Array.from({ length: k }, (_, i) => cellAt(t, i)); if (d.reverse) cs.reverse(); html = `<div class="lcd">${cs.map(sevenSeg).join('')}</div>`; }
    else if (fmt === 'number' && flatDev) { const r = decodeNum(s, d.enc || 'binLSB'); html = `<div class="lcd">${[...String(r.v).padStart(4, '_')].map(sevenSeg).join('')}</div>${r.ok ? '' : '<div class="nowire">leading part of the tape</div>'}`; }
    else if (fmt === 'text' && flatDev) html = `<div class="lcd"><div class="lcdtext">${esc(s) || '&nbsp;'}</div></div>`;
    else if (fmt === 'digits') { const k = Math.max(1, Math.min(16, d.count || 4)); const cs = Array.from({ length: k }, (_, i) => cellAt(t, i)); if (d.reverse) cs.reverse(); html = `<div class="nixies">${cs.map(nixie).join('')}</div>`; }
    else if (fmt === 'number') { const r = decodeNum(s, d.enc || 'binLSB'); const digits = String(r.v).padStart(Math.max(4, String(r.v).length), '0'); html = `<div class="odometer">${[...digits].map(c => `<span class="drum">${c}</span>`).join('')}</div>${r.ok ? '' : '<div class="nowire">leading part of the tape</div>'}`; }
    else html = `<div class="ticker"><div class="holes"></div><div class="typed">${esc(s) || '&nbsp;'}</div></div>`;
    if (scr.dataset.h !== html) { scr.innerHTML = html; scr.dataset.h = html; resized = true; }
  }
  if (resized) requestAnimationFrame(() => drawWires());   // a display that changed size moves its lead
}
function pressDevice(d, el) {
  if (busyRun()) return;
  const clock = d.kind === 'clock';
  const t = devTape(d); const only = (d.kind === 'button' || clock) && (d.action || (clock ? 'none' : 'set')) === 'none';
  if (clock && !t && !only) { d.running = false; d.pending = false; updateClockFace(d); return; }
  if (!t && !only) { openWin('dev', d.id); return; }
  const carry = currentTapes(); let s = t ? (carry[t.id] ?? (t.kind === 'random' ? '' : (t.init || ''))) : '';
  if (d.kind === 'button' || clock) {
    const a = d.action || (clock ? 'none' : 'set');
    if (a === 'set') s = d.value || '';
    else if (a === 'append') s = s + (d.value || '');
    else if (a === 'clear') s = '';
    else if (a === 'time') { const n = new Date(); s = [n.getHours(), n.getMinutes(), n.getSeconds()].map(x => String(x).padStart(2, '0')).join(''); }
    else if (a === 'toggle') { const i = d.cell | 0; const a2 = s.padEnd(i + 1, '_').split(''); a2[i] = a2[i] === '1' ? '0' : '1'; s = a2.join(''); }
  } else if (d.kind === 'switch') { const i = d.cell | 0; const a2 = s.padEnd(i + 1, '_').split(''); a2[i] = a2[i] === '1' ? '0' : '1'; s = a2.join(''); }
  else if (d.kind === 'numin') { const inp = el.closest('.dev').querySelector('[data-devin]'); const v = Number(inp.value); if (!isFinite(v) || v < 0) { inp.setCustomValidity('a whole number ≥ 0'); inp.reportValidity(); return; } inp.setCustomValidity(''); d.last = String(Math.floor(v)); s = encodeNum(v, d.enc || 'binLSB'); }
  else if (d.kind === 'textin') { const inp = el.closest('.dev').querySelector('[data-devin]'); d.last = inp.value; s = inp.value.replace(/\s/g, '·'); }
  if (!only) carry[t.id] = s.replace(/_+$/, '');
  const m = d.run && machineById(d.run);
  const retarget = m && m.id !== world.targetId;
  if (retarget) { world.targetId = m.id; save(); renderTargetSelect(); }
  resetRun(carry);
  run.logMsg(`${d.name || DEV_KINDS[d.kind]} ${clock ? 'ticked' : only ? 'pressed' : 'wrote ' + t.name}${clock && !only ? ', wrote ' + t.name : ''}${m ? `, then runs ${m.name}` : ''}`);
  if (m) { playing = true; last = performance.now(); }
  if (clock && !retarget) { renderWins(); renderLive(); } else { renderStructure(); renderWins(); renderLive(); }
}
// Clocks: a clock is an input that presses itself. Each beat it writes to its tape (or writes nothing)
// and starts its machine, exactly like a button. A beat that falls during a run waits until the run
// ends; beats are not queued, so at most one waits.
document.addEventListener('input', e => { const i = e.target.closest && e.target.closest('.dev [data-devin]'); if (i) { const d = devById(i.closest('.dev').dataset.did); if (d) d.draft = i.value; } });
function updateClockFace(d) {
  const el = document.querySelector(`.dev[data-did="${d.id}"]`); if (!el) return;
  el.classList.toggle('running', !!d.running);
  const b = el.querySelector('[data-clock]'); if (b) { b.querySelector('span').textContent = d.running ? '■' : '▶'; b.setAttribute('aria-pressed', String(!!d.running)); b.setAttribute('aria-label', d.running ? 'Stop the clock' : 'Start the clock'); }
}
function toggleClock(d) {
  d.running = !d.running; d.pending = false;
  if (d.running) d.next = performance.now() + Math.max(0.1, Number(d.interval) || 1) * 1000;
  updateClockFace(d); updateDevices();
}
function stopClocks() { for (const d of (typeof world !== 'undefined' && world && world.devices) || []) if (d.kind === 'clock') { d.running = false; d.pending = false; } }
setInterval(() => {
  if (typeof world === 'undefined' || !world || !world.devices) return;
  const now = performance.now(); const busy = busyRun();
  for (const d of world.devices) {
    if (d.kind !== 'clock' || !d.running) continue;
    const ms = Math.max(0.1, Number(d.interval) || 1) * 1000;
    if (now >= d.next) { d.pending = true; d.next = Math.max(d.next + ms, now + ms * 0.5); }
    if (d.pending && !busy && !document.querySelector('.dev.dragging')) {
      d.pending = false; d.ticks = (d.ticks || 0) + 1;
      const el = document.querySelector(`.dev[data-did="${d.id}"]`);
      pressDevice(d, el);
      if (el) { el.classList.remove('beat'); void el.offsetWidth; el.classList.add('beat'); }
      break; // one beat per check: a beat's run makes the world busy for the others
    }
  }
  if (world.devices.some(d => d.kind === 'clock' && d.running)) updateDevices();
}, 40);
function addDevice(kind, fmt) {
  if (!world.devices) world.devices = [];
  const tape = world.tapes.find(t => t.kind !== 'random' && t.kind !== 'advice');
  const d = { id: uid('d'), kind, name: kind === 'display' ? DISPLAY_FMTS[fmt || 'lamps'].split(':')[0] : DEV_KINDS[kind], tape: tape ? tape.id : null, pos: freeSpot(220, 110) };
  if (kind === 'button') Object.assign(d, { label: 'Press', action: 'append', value: '1' });
  if (kind === 'switch') Object.assign(d, { label: '', cell: 0 });
  if (kind === 'numin') Object.assign(d, { enc: 'binLSB' });
  if (kind === 'clock') Object.assign(d, { interval: 1, action: 'none' });
  if (kind === 'display') Object.assign(d, { fmt: fmt || 'lamps', count: 8, w: 8, h: 8, enc: 'binLSB', on: '1' });
  world.devices.push(d); world.key = null; changed(true); openWin('dev', d.id);
}
function devBody(w, d) {
  const sel = (f, cur, opts) => `<select data-dev="${f}">${Object.entries(opts).map(([k, v]) => `<option value="${esc(k)}" ${String(cur) === String(k) ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
  const tapes = Object.fromEntries([['', '— none —'], ...world.tapes.map(t => [t.id, t.name + (t.kind !== 'normal' ? ` (${t.kind})` : '')])]);
  const machines = Object.fromEntries([['', '— nothing: only write —'], ...world.machines.map(m => [m.id, m.name])]);
  const field = (lbl, f, v, ph, type = 'text') => `<label class="field"><span class="lbl">${lbl}</span><input data-dev="${f}" type="${type}" value="${esc(v ?? '')}" placeholder="${esc(ph || '')}"${type === 'number' ? ' min="0"' : ''}></label>`;
  let x = `<div class="formgrid">${field('Name', 'name', d.name)}<label class="field"><span class="lbl">Tape</span>${sel('tape', d.tape || '', tapes)}</label></div>`;
  if (d.kind === 'button') {
    x += `<div class="formgrid"><label class="field"><span class="lbl">Cap label</span><input data-dev="label" maxlength="3" value="${esc((d.label || '').slice(0, 3))}" placeholder="+1"></label><label class="field"><span class="lbl">Colour</span>${sel('color', d.color || 'red', DEV_COLORS)}</label></div>
      <div class="formgrid"><label class="field wide"><span class="lbl">On press</span>${sel('action', d.action || 'set', { set: 'set the tape to…', append: 'append to the tape…', toggle: 'toggle one cell (0 ↔ 1)', clear: 'clear the tape', none: 'write nothing (just run)' })}</label>
      ${d.action === 'toggle' ? field('Cell', 'cell', d.cell || 0, '', 'number') : d.action === 'clear' || d.action === 'none' ? '' : field(d.action === 'append' ? 'Symbols to append' : 'New contents', 'value', d.value, 'e.g. 1')}</div>`;
  }
  if (d.kind === 'clock') {
    x += `<div class="formgrid">${field('Beat every (seconds)', 'interval', d.interval ?? 1, '1')}</div><div class="formgrid"><label class="field wide"><span class="lbl">On each beat</span>${sel('action', d.action || 'none', { none: 'write nothing (just run)', append: 'append to the tape', set: 'set the tape to', toggle: 'toggle one cell (0 ↔ 1)', clear: 'clear the tape', time: 'write the time of day (HHMMSS)' })}</label>
      ${d.action === 'toggle' ? field('Cell', 'cell', d.cell || 0, '', 'number') : d.action === 'append' || d.action === 'set' ? field(d.action === 'append' ? 'Symbols to append' : 'New contents', 'value', d.value, 'e.g. 1') : ''}</div>
      <p class="note">A clock is a button that presses itself. Start it with its ▶ key. Each beat does what a press would, then runs the machine below. A clock never counts: to count beats, let it run a counter machine. A beat that falls while a run is in progress waits for the run to end (the dial goes dim), and beats do not pile up, so a slow machine just slows the clock down. The time of day is an outside input, like a real clock chip: six decimal digits, hours first.</p>`;
  }
  if (d.kind === 'switch') x += `<div class="formgrid">${field('Label', 'label', d.label)}${field('Cell', 'cell', d.cell || 0, '', 'number')}</div><p class="note">The switch shows whether that cell holds 1, and flips it between 0 and 1 when pressed.</p>`;
  if (d.kind === 'numin') x += `<label class="field"><span class="lbl">Write the number as</span>${sel('enc', d.enc || 'binLSB', NUM_ENCS)}</label>`;
  if (d.kind !== 'display') x += `<label class="field"><span class="lbl">Then run</span>${sel('run', d.run || '', machines)}</label>
    <p class="note">An input only writes symbols to its tape: the machines do all the computing. With a machine chosen, the press then runs it on the tapes as they are. Animated or not follows the Animate switch in the top bar. While a run is in progress, inputs are blocked.</p>`;
  else {
    x += `<label class="field"><span class="lbl">Format</span>${sel('fmt', d.fmt || 'lamps', DISPLAY_FMTS)}</label><div class="formgrid">`;
    if (d.fmt === 'lamps' || d.fmt === 'digits') x += field(d.fmt === 'lamps' ? 'Lamps (cells 0…k−1)' : 'Digits (cells 0…k−1)', 'count', d.count, '', 'number');
    if (d.fmt === 'pixels') x += field('Width', 'w', d.w, '', 'number') + field('Height', 'h', d.h, '', 'number');
    if (d.fmt === 'lamps' || d.fmt === 'pixels' || !d.fmt) x += field('Lit by symbol', 'on', d.on || '1') + `<label class="field"><span class="lbl">Colour</span>${sel('color', d.color || (d.fmt === 'pixels' ? 'green' : 'amber'), DEV_COLORS)}</label>`;
    if (d.fmt === 'number') x += `<label class="field"><span class="lbl">Read the tape as</span>${sel('enc', d.enc || 'binLSB', NUM_ENCS)}</label>`;
    if (d.fmt === 'digits') x += `<label class="check"><input type="checkbox" data-dev="reverse" ${d.reverse ? 'checked' : ''}> Cell 0 is the rightmost digit</label>`;
    x += `</div><p class="note">A display draws its tape and nothing else: lamps and pixels light for one symbol, digits draw each cell’s symbol, a number reads the cells in an encoding, text shows them as they are. It follows the run as it animates, and the past when you rewind.</p>`;
  }
  x += `<label class="check"><input type="checkbox" data-dev="hideWires" ${d.hideWires ? 'checked' : ''}> Hide its lead to the tape</label>
`;
  return x;
}
