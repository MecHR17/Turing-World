// ===== World construction =====
const PALETTE = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];
let _uid = 1;
function uid(p) { return p + (_uid++); }

function makeTape(spec) {
  return { id: uid('t'), name: spec.name, kind: spec.kind || 'normal', init: spec.init || '', alphabet: spec.alphabet || (spec.kind === 'random' ? '01' : 'ab'), seed: spec.seed || 1, public: !!spec.public, advice: spec.advice || '', adviceMax: spec.adviceMax || '', maxLen: spec.maxLen || 6, pos: spec.pos ? { ...spec.pos } : null, w: spec.w || 440 };
}
function makeMachine(spec, world) {
  const m = { id: uid('m'), kind: spec.kind, name: spec.name || 'Machine', src: spec.src, bind: {}, budgetTime: spec.budgetTime || '', budgetSpace: spec.budgetSpace || '', budgetSize: spec.budgetSize || '', budgetDepth: spec.budgetDepth || '', budgetFanin: spec.budgetFanin || '', budgetRand: spec.budgetRand || '', budgetQuery: spec.budgetQuery || '', oracle: !!spec.oracle, pos: spec.pos ? { ...spec.pos } : null, gen: spec.gen || null, lab: spec.lab ? { ...spec.lab } : null, role: spec.role || 'normal', altMode: spec.altMode || 'E', altBlocks: spec.altBlocks || '', altStart: spec.altStart || '', accMode: spec.accMode || 'exists', countK: spec.countK || '1', links: {}, sim: spec.sim ? { ...spec.sim } : undefined, color: PALETTE[world.machines.length % PALETTE.length] };
  for (const [port, tname] of Object.entries(spec.bind || {})) { const t = world.tapes.find(x => x.name === tname); if (t) m.bind[port] = t.id; }
  compileMachine(m);
  return m;
}
function loadExample(ex) {
  const world = { key: ex.key, tapes: [], machines: [], reductions: [], targetId: null };
  ex.tapes.forEach(t => world.tapes.push(makeTape(t)));
  ex.machines.forEach(s => world.machines.push(makeMachine(s, world)));
  ex.machines.forEach((s, i) => { for (const [sock, name] of Object.entries(s.links || {})) { const t = world.machines.find(x => x.name === name); if (t) world.machines[i].links[sock] = t.id; } });
  const byName = n => world.machines.find(x => x.name === n);
  world.reductions = (ex.reductions || []).map(r => ({ id: uid('r'), from: (byName(r.from) || {}).id || null, to: (byName(r.to) || {}).id || null, via: r.via.map(n => (byName(n) || {}).id).filter(Boolean), pos: r.pos ? { x: r.pos[0], y: r.pos[1] } : null, gen: r.gen || null }));
  ex.tapes.forEach((t, i) => { if (t.describe) { const m = world.machines.find(x => x.name === t.describe); if (m && m.compiled) world.tapes[i].init = encodeMachine(m); } });
  world.devices = (ex.devices || []).map(d => Object.assign({}, d, { id: uid('d'), tape: d.tape ? (world.tapes.find(t => t.name === d.tape) || {}).id || null : null, run: d.run ? (byName(d.run) || {}).id || null : null, pos: d.pos ? { x: d.pos[0], y: d.pos[1] } : null }));
  const tgt = world.machines.find(m => m.name === ex.target) || world.machines[0];
  world.targetId = tgt ? tgt.id : null;
  return world;
}
if (typeof module !== 'undefined') module.exports = { loadExample, makeTape, makeMachine };
