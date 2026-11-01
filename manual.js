// ---------- manual ----------
// The full reference, opened from the top bar. Each section is one tab.
const MAN_PRE = s => `<pre class="mpre">${esc(s)}</pre>`;
const MAN_TABLE = (head, rows) => `<div class="mtablewrap"><table class="mtable"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const K = s => `<kbd>${s}</kbd>`;
const C = s => `<code>${esc(s)}</code>`;
// a screenshot from manual-images.js, shown at its natural size (or narrower on small screens)
const FIG = (k, cap, alt) => { const i = (typeof MAN_IMG !== 'undefined' && MAN_IMG[k]) || null; return i ? `<figure class="mfig"><img src="${i.src}" width="${i.w}" height="${i.h}" alt="${esc(alt || cap)}" loading="lazy">${cap ? `<figcaption>${cap}</figcaption>` : ''}</figure>` : ''; };
const LEGEND = items => `<ol class="mlegend">${items.map(t => `<li>${t}</li>`).join('')}</ol>`;

const MANUAL = [
{ id: 'start', title: 'Start here', group: 'Basics', html: () => `
<h2>Turing World</h2>
<p class="lead">A sandbox of complexity theory. Machines and tapes live together on one grid. Machines read and write shared tapes, call each other as oracles, branch nondeterministically, flip coins and run each other's descriptions, so a whole construction (an NP verifier and its certificate, an oracle hierarchy, a reduction chain) runs as one world you can watch step by step.</p>
${FIG('start', 'A Turing machine wired to its tape. The machine card shows its state graph; the tag under the tape marks where its head is.', 'A machine card connected by a wire to a paper tape')}
<p>New to the theory behind it? The <b>Theory</b> chapters at the end of this list are a short course on everything the app implements, starting with <a data-man="th-intro">About this course</a>.</p>
<h3>A first tour</h3>
<ol class="msteps">
  <li>Open <b>Worlds</b> and load <b>Palindromes in n² time</b>. The panel at the bottom left is the guide for that world.</li>
  <li>Press <b>Step</b> a few times (or ${K('S')}). The head moves on the tape; the machine's screen lights up its current line or state; the meters show time and space against the budget.</li>
  <li>Press <b>Run</b> (${K('Space')}) to play, and drag the <b>speed</b> slider. Press <b>◀</b> on the timeline (or ${K('B')}) to step back in time.</li>
  <li>Click the machine to open its window: <b>Program</b> to edit, <b>State graph</b> to see the control flow, <b>Wiring</b> to connect tapes and sockets, <b>Budgets</b> (or <b>Class &amp; budgets</b>) to set resource bounds, <b>Tools</b> for experiments.</li>
  <li>Click the tape to change its contents. Then load another world, or start from <b>Empty world</b> and use <b>+ Add</b>.</li>
</ol>
<h3>How the pieces fit</h3>
${MAN_TABLE(['Piece', 'What it is', 'More'], [
  ['Tape', 'A two-way infinite row of cells, a world object any number of machines can share.', '<a data-man="tapes">Tapes</a>'],
  ['Machine', 'A program, Turing machine table, DFA/NFA, pushdown automaton, Boolean circuit or script. Its <b>ports</b> are wired to tapes.', '<a data-man="machines">Machines</a>'],
  ['Run target', 'The machine the Run button starts. Everything else runs only when called.', '<a data-man="running">Running</a>'],
  ['Calls', 'A machine can hand control to another one, which works on its own wired tapes and returns accept or reject.', '<a data-man="calls">Calls and oracles</a>'],
  ['Reduction', 'A card claiming A ≤ B through a transducer, with a checker.', '<a data-man="reductions">Reductions</a>'],
])}
<p class="note">This manual covers every feature. The <b>Language reference</b> inside each machine's Program tab is a one-screen summary of the same syntax.</p>` },

{ id: 'world', title: 'The world', group: 'Basics', html: () => `
<h2>The world</h2>
<p class="lead">The grid is the whole state: every tape and machine on it, how they are wired, and which machine is the run target.</p>
<h3>Top bar</h3>
${FIG('barL', '', 'The left half of the top bar with numbered controls')}
${LEGEND(['Manual', 'Inform and Operate mode', 'Look of machines, tapes and devices', 'Worlds', '+ Add', 'Undo and Redo', 'Tidy', 'Guide'])}
${FIG('barR', '', 'The right half of the top bar with numbered controls')}
${LEGEND(['Reset', 'Step', 'Run / pause', 'Animate on or off', 'Speed', 'Run target', 'Step counter', 'Status'])}
${MAN_TABLE(['Control', 'Does'], [
  ['<b>Manual</b> (book)', 'This reference.'],
  ['<b>Inform / Operate</b> (ⓘ and sunglasses)', 'Inform mode shows explanations of the theory next to every control. Operate mode hides them, so windows show just the controls and results; the guide no longer opens by itself when you load a world. The choice is remembered in this browser.'],
  ['<b>Worlds</b>', 'Loads a prepared example world, grouped by topic. <b>Save or load a world…</b> at the bottom exports and imports files.'],
  ['<b>+ Add</b>', 'Adds a tape, a machine of any kind, or a reduction card. New elements land in a free spot and open their window.'],
  ['<b>Undo / Redo</b>', 'Every change to the world (sources, wiring, budgets, positions, tape contents) is undoable. Lab settings and results are not part of the history.'],
  ['<b>Tidy</b> (four squares)', 'Arranges machines in a column with their tapes beside them.'],
  ['<b>Guide</b> (map)', 'Shows or hides the guide for the loaded example.'],
  ['<b>Tree</b> (branching nodes)', 'Appears when the run target is nondeterministic, and opens the computation tree.'],
  ['<b>Reset · Step · Run · lightning · speed</b>', 'Run controls; the lightning button switches animation off, so runs just compute. See <a data-man="running">Running</a> and <a data-man="devices">Buttons and displays</a>.'],
  ['<b>Look</b> (dial)', 'How machines, tapes and devices are drawn: brass and glass, aluminium and glass, or flat panel.'],
  ['<b>+ Add → Button, Switch, Number input, Text input, Clock, Display</b>', 'Devices wired to tapes; see <a data-man="devices">Buttons and displays</a>.'],
  ['<b>Run</b> selector', 'Chooses the run target.'],
])}
<h3>Elements</h3>
<ul>
  <li><b>Drag</b> a machine by its body, a tape by its label or reel, a reduction card anywhere, a window by its title bar. The bottom-right corner of a tape resizes it.</li>
  <li><b>Click</b> an element to open its window. Several windows can be open; ${K('Esc')} closes the top one.</li>
  <li>The <b>eye / code / graph</b> button on a machine cycles what its screen shows: the program text, the state graph, or nothing (a compact card).</li>
  <li><b>Wires</b> run from a machine's port jacks to the tapes they are connected to. A wire glows while that machine is running and is dashed while it waits for a call. Call arrows join callers to callees, labelled with the socket name; reduction arrows join cards to their deciders.</li>
  <li>Any element can hide its own lines: <b>Hide this machine's wires and arrows</b> (Wiring tab), <b>Hide the wires to this tape</b> (tape window), <b>Hide this reduction's arrows</b> (reduction window).</li>
</ul>
<h3>Zoom</h3>
<p>Use the zoom box at the top right, ${K('+')} ${K('−')} ${K('0')} (100%) and ${K('F')} (fit everything), Ctrl/⌘ + mouse wheel, or pinch on a touch screen.</p>
<h3>Keyboard</h3>
${MAN_TABLE(['Key', 'Action'], [
  [K('Space'), 'Run / pause'], [`${K('S')} or ${K('→')}`, 'Step'], [`${K('B')} or ${K('←')}`, 'Step back in time'], [K('R'), 'Reset'],
  [`${K('+')} ${K('−')} ${K('0')} ${K('F')}`, 'Zoom in, out, 100%, fit'], [`${K('Ctrl/⌘')} ${K('Z')}`, 'Undo'], [`${K('Ctrl/⌘')} ${K('Y')} or ${K('⇧')} ${K('Z')}`, 'Redo'],
  [K('Esc'), 'Close the top window'], [`${K('Ctrl/⌘')} ${K('Enter')}`, 'Apply the source you are editing (in a lab generator: run the lab)'], [K('Tab'), 'Indents inside a source editor'],
])}
<h3>Saving</h3>
<p>The world is kept in this browser automatically and comes back when you reopen the page. To move it elsewhere, use <b>Worlds → Save or load a world…</b>: <b>Save as file</b> downloads a .json file (you confirm the download), <b>Copy as text</b> puts the same text on the clipboard. To load, choose a file or paste the text. Loading replaces the current world, and Undo brings the old one back.</p>` },

{ id: 'running', title: 'Running and time travel', group: 'Basics', html: () => `
<h2>Running and time travel</h2>
<p class="lead">One machine is the <b>run target</b>, marked RUN on its card. Run starts it; it calls the others.</p>
${FIG('timeline', 'The timeline: drag it, or use the arrows, to rewind and replay the run.', 'The timeline slider with step buttons')}
<h3>Controls</h3>
${MAN_TABLE(['Control', 'Does'], [
  ['<b>Step</b>', 'One step of whichever machine is on top of the call stack. A circuit evaluates one layer per step.'],
  ['<b>Run / Pause</b>', 'Steps continuously at the chosen speed, from 1 to about 2,000 steps a second; all the way right runs as fast as the browser allows (hundreds of thousands of steps a second) while staying responsive.'],
  ['<b>Reset</b>', 'Restarts the run on every tape\'s <b>initial contents</b>.'],
  ['Status pill', 'ready, running, paused, at a choice, accepted, rejected, or no clear answer (a counting rule that cannot decide).'],
])}
<p>Switching the run target keeps the tapes <b>as they are now</b>, so you can run a transducer and then run a decider on what it wrote. Reset restores the initial contents. You can also make a machine the target from its Wiring &amp; budgets tab.</p>
<h3>Console</h3>
<p>The console at the bottom right shows the <b>call stack</b> (bottom frame first; the highlighted frame is running; ⟨dashed⟩ frames are machines being simulated from a description) and the <b>event log</b>: calls, returns, choices, budget violations and errors, each with its step number. Collapse it with ▾.</p>
<h3>Time travel</h3>
<p>Every run is recorded. The timeline bar at the top left has ⏮ (start), ◀ (step back), a scrubber, ▶ (step forward) and ⏭ (back to the latest step). While you look at the past, the label says <b>rewound</b> and every card, tape, meter and window shows the world as it was. Stepping forward from the past replays the run exactly until it rejoins the present.</p>
<h3>Breakpoints</h3>
<p>Click a <b>line number</b> in a program's Program tab, or a <b>node</b> in any machine's State graph tab, to toggle a breakpoint (a red dot). Run pauses when a machine reaches that line or enters that state, and the timeline names the breakpoint. Breakpoints are saved with the world.</p>
<h3>Space-time diagram</h3>
<p>The grid button on a tape's label (or <b>Space-time diagram</b> in its window) draws the run as a <b>tableau</b>: one row per step, one column per cell, heads coloured by machine, freshly written cells tinted. Click a row to travel to that step. This is the Cook–Levin picture: each cell depends only on the few cells above it.</p>` },

{ id: 'tapes', title: 'Tapes', group: 'Elements', html: () => `
<h2>Tapes</h2>
<p class="lead">A tape is a two-way infinite row of cells, each holding one character or blank (${C('_')}). Cell 0 is marked; contents are written from cell 0. Any number of machines can be wired to the same tape.</p>
${FIG('tape', 'A tape. Cell 0 is marked with a blue line and numbered every five cells; the tag below a cell is a machine’s head.', 'A paper tape on a reel with a head tag under cell 0')}
<h3>Kinds</h3>
${MAN_TABLE(['Kind', 'Behaves', 'Typical use'], [
  ['<b>normal</b>', 'Holds what you put there and what machines write.', 'Inputs, work tapes, output tapes, question tapes for oracles.'],
  ['<b>certificate</b>', 'A normal tape with a <b>Find witness</b> button: it tries every string over the tape\'s alphabet, shortest first (up to the maximum length, 30 000 tries at most), running the run target on each, and keeps the first one it accepts. This is the unbounded prover for an NP verifier.', 'NP certificates.'],
  ['<b>stack</b>', 'Cell 0 is the bottom and the head sits on the top symbol. Machines may only push and pop: ' + C('push t x') + ' and ' + C('pop t') + ' in programs, the push and pop fields of a PDA\'s rules. read(t) is the top, or _ when empty. Popping an empty stack, or writing or moving on a stack, is an error.', 'Pushdown automata; programs with one or two stacks.'],
  ['<b>proof</b>', 'A proof for a probabilistic verifier, fixed before it runs: verifiers can read it but not write it (provers can). ' + C('seek t a') + ' jumps the head to any cell; every distinct cell a verifier reads is a query, and queried cells are outlined.', 'PCP verifiers.'],
  ['<b>advice</b>', 'Filled when a run starts with a(n), from a table (' + C('3: 101') + ') or a function ' + C('(n) => …') + ' in the tape window, where n is the length of the run target\'s input. Read-only, with an optional length budget.', 'P/poly, non-uniform circuits.'],
  ['<b>channel</b>', 'Append-only. ' + C('send ch x') + ' (or io.send in a script) adds a symbol at the end, tinted with the sender\'s colour; machines read the transcript with ordinary reads and moves. The label counts the symbols each machine sent.', 'Communication complexity.'],
  ['<b>random coins</b>', 'Every cell is a fair coin flip (0 or 1), drawn the first time a head reads it. Heads on it are read-only and one-way, and keep their position between calls, so each call sees fresh coins. <b>Re-roll coins</b> picks a new seed. Coins are <b>private</b> unless <b>Public coins</b> is ticked: a machine with the prover role cannot read private coins.', 'BPP machines, interactive proofs.'],
])}
<h3>The tape window</h3>
<ul>
  <li><b>Initial contents</b>: what the tape holds at the start of every run and after Reset.</li>
  <li><b>Current contents</b>: what it holds right now. Editing it restarts the run on every tape as it is, with your change. Reset still restores the initial contents; <b>Keep current contents</b> makes the current contents the new initial contents.</li>
  <li><b>Alphabet</b>: the symbols used for random inputs in the tools and for witness search.</li>
  <li><b>Hide the wires to this tape</b>. The bin icon in the title bar deletes the tape (Undo brings it back).</li>
  <li>The <b>Tools</b> tab holds the <b>Space-time diagram</b>, <b>Machines as data</b> (writes any machine's description ⟨M⟩ onto the tape; see <a data-man="data">Machines as data</a>) and, on certificate tapes, <b>Find witness</b>.</li>
</ul>
<h3>Ports and modifiers</h3>
<p>Machines reach tapes through named <b>ports</b>, wired in the machine's Wiring tab. A port declares how it may use its tape:</p>
${MAN_TABLE(['Modifier', 'Meaning'], [
  [C('readonly'), 'Writing is an error. Read-only tapes do not count toward space, as for log-space machines.'],
  [C('oneway'), 'The head never moves left.'],
  [C('output'), 'Write-only and one-way. Output tapes do not count toward space, as in log-space transducers.'],
])}
<p>Each machine's <b>input length n</b> is the number of cells on its first port's tape, from cell 0 up to the first blank. Budgets are functions of this n.</p>
<p>On the card, each head is a small flag below the tape labelled with the machine's initials; a faded flag belongs to a machine that is not running.</p>` },

{ id: 'machines', title: 'Machines', group: 'Elements', html: () => `
<h2>Machines</h2>
<p class="lead">Nine kinds, all interchangeable: any of them can be a run target, a callee or an oracle.</p>
<h3>The machine card</h3>
${FIG('card', '', 'A machine card with numbered parts')}
${LEGEND(['Status light: lit while running, green when it accepted, red when it rejected', 'Name (click the card to open its window)', 'Kind, then class badges and RUN for the run target', 'Show the program, the state graph, or nothing', 'Screen: the program or state graph, with the current line or state lit', 'Readout: current state or registers', 'Meters: time and space used, against the budgets if set', 'Tape ports: each wire runs from here to a tape'])}
${FIG('wiring', 'A machine’s window, on the Wiring tab: connect each tape port to a tape.', 'The machine window open on the Wiring tab')}
${MAN_TABLE(['Kind', 'Written as', 'Good for'], [
  ['<a data-man="programs">Program</a>', 'A small structured language with tapes and finite registers.', 'Most constructions: verifiers, oracles, provers, reductions, universal machines.'],
  ['<a data-man="tm">Turing machine</a>', 'A transition table over one or more tapes.', 'The classical model, including nondeterministic, alternating and oracle TMs.'],
  ['<a data-man="automata">DFA / NFA</a>', 'A transition table on one read-only input.', 'Regular languages; subset construction and minimization.'],
  ['<a data-man="lang">Regular expression</a>', 'An expression with | * + ? and parentheses.', 'Regular languages; runs as its Thompson NFA.'],
  ['<a data-man="lang">Grammar</a>', 'Rules like S -> aSb | eps.', 'Right-linear grammars run as NFAs; context-free ones as PDAs whose branches are derivations.'],
  ['<a data-man="pda">Pushdown automaton</a>', 'A transition table on an input and a stack tape.', 'Context-free languages, deterministic and nondeterministic.'],
  ['<a data-man="circuits">Boolean circuit</a>', 'Named gates over input bits, or a description read from a tape.', 'Circuit size and depth, circuit families, NC and AC.'],
  ['<a data-man="scripts">Script</a>', 'Free-form JavaScript.', 'Provers, generators and helpers whose cost should not count. Uncertified.'],
])}
<h3>The machine window</h3>
${MAN_TABLE(['Tab', 'Contains'], [
  ['<b>Program / Table / Source</b>', 'The source editor. <b>Apply</b> (or Ctrl/⌘ + Enter) compiles it; errors show the line. The Language reference summarizes the syntax.'],
  ['<b>State graph</b>', 'The control-flow graph (programs) or state diagram (tables), highlighting the current node and the last transition. Click a node to set a breakpoint.'],
  ['<b>Wiring</b>', 'Name, run target, tape ports, oracle sockets, how callers are charged (oracle, prover), hiding its wires.'],
  ['<b>Budgets</b> / <b>Class &amp; budgets</b>', 'Nondeterminism and acceptance (only for machines that branch), time and space budgets, random-bit and query budgets (only once wired to a random or proof tape), simulation cost (only for programs that use simulate). The bin icon in the title bar deletes the machine; Undo brings it back.'],
  ['<b>Tools</b>', 'Scaling lab, trials, compare languages, diagonal table, truth table (circuits), conversions. See <a data-man="tools">Tools</a>.'],
])}
<p>The card shows a status light (idle, running, waiting, accepted, rejected), the current line or state with register values, and time and space meters filled against the budget. A badge shows the machine's class (NP, coNP, Σ₂, AP, #P, PP, BPP, ⊕P) when it branches.</p>
<h3>Roles</h3>
<ul>
  <li><b>Act as oracle</b>: each call to this machine costs the caller one step instead of its full running time. A nondeterministic oracle is resolved on its own: its whole computation tree is explored on the side and only the answer comes back, as an oracle answers.</li>
  <li><b>Unbounded prover</b>: callers are not charged for its steps, and its own budgets are ignored. Use it for the prover of an interactive proof.</li>
</ul>` },

{ id: 'programs', title: 'Program language', group: 'Machine kinds', html: () => `
<h2>The program language</h2>
<p class="lead">Structured code over tapes and <b>finite</b> registers, so every program is a finite-state machine with tapes: a Turing machine in readable form. Statements are separated by line breaks or spaces; ${C('//')} starts a comment.</p>
${MAN_PRE(`machine Name {
  tape in : {a, b} readonly     // ports, with an optional alphabet
  tape work
  reg phase : {scan, back} = scan   // a register over a finite set
  reg k : 0..9 = 0                  // a numeric register (up to 4096 values)
  oracle P                          // a socket for an oracle

  while read(in) != _ {
    if read(in) == a { inc k } else { phase = back }
    move in R
  }
  accept if k == 2
}`)}
<h3>Declarations (at the top)</h3>
${MAN_TABLE(['Form', 'Meaning'], [
  [C('tape name [: {x, y}] [readonly] [oneway] [output]'), 'A port. The alphabet is optional, except in the dfa dialect.'],
  [C('reg r : {v1, v2, …} = v1'), 'A register over a finite set of values; the first value is the default.'],
  [C('reg k : 0..9 = 0'), 'A numeric register; allows inc, dec and < > <= >=. Leaving the range is an error.'],
  [C('oracle P'), 'A socket. call P runs whichever machine is plugged into P in the Wiring tab.'],
])}
<h3>Statements</h3>
${MAN_TABLE(['Statement', 'Meaning'], [
  [C('write t x') + ' · ' + C('write t read(u)') + ' · ' + C('write t r'), 'Writes one symbol at t\'s head (a literal, a symbol read elsewhere, or a register\'s value). Writing _ blanks the cell.'],
  [C('write t "abc"'), 'Writes a string, moving right after each symbol (one step per cell). No spaces or _ inside.'],
  [C('move t L') + ' · ' + C('R') + ' · ' + C('S'), 'Moves the head left, right, or not at all.'],
  [C('r = x') + ' · ' + C('r = read(t)'), 'Assigns a register. The value must be in its domain.'],
  [C('inc k') + ' · ' + C('dec k'), 'Numeric registers.'],
  [C('if c { … } else { … }') + ' · ' + C('else if'), 'Branching.'],
  [C('while c { … }'), 'Looping. An empty body is a loop that runs forever.'],
  [C('accept') + ' · ' + C('reject') + ' · ' + C('accept if c'), 'Halts. Falling off the end of the program rejects.'],
  [C('call M'), 'Runs machine M (by name) or the machine in socket M, then continues; sets ret. See <a data-man="calls">Calls</a>.'],
  [C('exists r') + ' · ' + C('forall r'), 'Forks once per value of register r: ∃ (OR) or ∀ (AND). See <a data-man="nondet">Nondeterminism</a>.'],
  [C('exists { … } or { … }'), 'Forks once per block; forall works the same way.'],
  [C('choose { … } or { … }') + ' · ' + C('guess r'), 'Like exists, or forall if the machine\'s mode says so.'],
  [C('seek pi a'), 'Jump the head of a proof tape to cell a: the binary number written on tape a, or the value of a register or literal.'],
  [C('send ch x'), 'Append a symbol to a channel tape. See <a data-man="comm">Communication complexity</a>.'],
  [C('push s x') + ' · ' + C('pop s'), 'Push a symbol onto, or pop the top of, a tape of kind stack. read(s) is the top. See <a data-man="pda">Pushdown automata</a>.'],
  [C('simulate code on (a, b) within time (n^2) space (n)'), 'Runs the machine described on tape code, optionally with bounds. See <a data-man="data">Machines as data</a>.'],
  [C('writeself t'), 'Writes this machine\'s own description ⟨M⟩ (the recursion theorem).'],
])}
<h3>Conditions and values</h3>
${MAN_TABLE(['Form', 'Meaning'], [
  [C('read(t)'), 'The symbol under t\'s head; _ when blank.'],
  [C('r') + ', ' + C('a') + ', ' + C('1') + ', ' + C("'#'"), 'A register, or a literal symbol. Quote symbols that are not letters or digits, like \'#\'.'],
  [C('== != < > <= >='), 'Comparisons; the ordered ones compare numbers.'],
  [C('atstart(t)'), 'True when t\'s head is on cell 0.'],
  [C('&& || ! ( )'), 'Logic.'],
  [C('ret'), 'Built-in register set by call and simulate: none, accept, reject (and timeout after a bounded simulate).'],
])}
<h3>The dfa dialect</h3>
<p>${C('machine Name dfa { … }')} restricts a program to one read-only, one-way tape with an alphabet, no writes, no calls, no choices and no left moves. Its Tools tab then offers <b>Compile to DFA</b>, which builds the equivalent minimal DFA as a new machine.</p>
<h3>Errors</h3>
<p>Compile errors show the line in the editor and on the card. Run-time errors (writing a read-only tape, a register out of range, a missing tape) reject the machine with the reason in the log.</p>` },

{ id: 'tm', title: 'Turing machines', group: 'Machine kinds', html: () => `
<h2>Turing machine tables</h2>
<p class="lead">One rule per line. A rule matches on the state and the symbols under every head, then writes, moves and changes state.</p>
${MAN_PRE(`tapes: in readonly, work      # ports, with modifiers
start: q0
accept: qa
reject: qr
q0, a _ -> q0, * a, R R       # state, reads -> state, writes, moves
q0, b _ -> q0, * b, R R
q0, _ _ -> qa, * *, S S`)}
${MAN_TABLE(['Line', 'Meaning'], [
  [C('tapes: t1 [readonly|oneway|output], t2 …'), 'The ports, in the order rules list their symbols.'],
  [C('start:') + ' · ' + C('accept:') + ' · ' + C('reject:'), 'The start state and the two halting states. Entering accept or reject halts.'],
  [C('state, r1 r2 -> state, w1 w2, m1 m2'), 'One read, write and move per tape. Moves are L, R or S.'],
  [C('*'), 'In reads: any symbol. In writes: leave the cell as it is.'],
  [C('_'), 'The blank.'],
  [C('# …') + ' · ' + C('// …'), 'Comments. Because of this, # cannot be a tape symbol in tables.'],
])}
<p>If no rule matches, the machine rejects. In a deterministic table the first matching rule wins, so specific rules can come before a ${C('*')} fallback.</p>
<h3>Nondeterministic, alternating and oracle TMs</h3>
${MAN_TABLE(['Line', 'Meaning'], [
  [C('nondeterministic'), 'Every matching rule is a branch, so δ is a relation. Branching states follow the machine\'s mode (∃ unless set to ∀).'],
  [C('exists: q1 q2'), 'Marks ∃ states (OR). Implies nondeterministic.'],
  [C('forall: q3'), 'Marks ∀ states (AND). Implies nondeterministic.'],
  [C('oracle: P'), 'Declares a socket, wired in the Wiring tab.'],
  [C('call: qask P -> qyes, qno'), 'Entering qask runs P (a machine name or a socket) on its own tapes, then continues in qyes if P accepted, qno if not. A query state has no other rules.'],
])}
<p>A branching table gets the same class settings, budgets, acceptance rules and computation tree as a program; see <a data-man="nondet">Nondeterminism</a>. The state graph marks ∃ and ∀ states and draws query states with ✓ and ✗ edges.</p>
${MAN_PRE(`tapes: in readonly           # an alternating TM for a game
start: me
accept: win
reject: lose
exists: me
forall: you
me, 1 -> you, *, R
me, 1 -> me2, *, R
me2, 1 -> you, *, R
me, _ -> lose, *, S
you, 1 -> me, *, R
you, _ -> win, *, S`)}` },

{ id: 'automata', title: 'DFA and NFA', group: 'Machine kinds', html: () => `
<h2>Finite automata</h2>
<p class="lead">A DFA or NFA reads its one port, ${C('in')}, left to right, and accepts at the end of the input if it is in an accepting state.</p>
${MAN_PRE(`alphabet: a b
start: s
accept: f g          # several accepting states
s, a b -> s          # several symbols on one line
s, a -> f            # NFA: several rules (or targets) per symbol
f, eps -> g          # NFA: an ε move (eps or ε)`)}
<ul>
  <li>A DFA needs exactly one target per state and symbol; a missing transition rejects.</li>
  <li>An NFA may list several targets (${C('s, a -> s f')}) and ε moves. The card shows the whole set of active states, as the subset construction would.</li>
  <li>${C('_')} cannot label a transition: it marks the end of the input.</li>
</ul>
<h3>Conversions (Tools tab)</h3>
<ul>
  <li><b>Determinize</b> (NFA): subset construction, then minimization; adds the DFA as a new machine.</li>
  <li><b>Compile to DFA</b> (programs in the dfa dialect): builds the minimal DFA of the program.</li>
</ul>
<p>Use <b>Compare languages</b> to check two automata (or an automaton and a program) accept the same strings.</p>` },

{ id: 'lang', title: 'Expressions and grammars', group: 'Machine kinds', html: () => `
<h2>Regular expressions and grammars</h2>
<p class="lead">Two more ways to describe a language, each run by the automaton that matches it. Both read one input port, ${C('in')}.</p>
<h3>Regular expressions</h3>
${MAN_PRE(`regex EndsAbb
// strings over a, b that end in abb
(a|b)*abb`)}
${MAN_TABLE(['Syntax', 'Meaning'], [
  [C('ab'), 'Concatenation: any single character is a symbol.'], [C('a|b'), 'Union.'], [C('a*') + ' · ' + C('a+') + ' · ' + C('a?'), 'Zero or more, one or more, optional.'],
  [C('( )'), 'Grouping. Empty parentheses are the empty string.'], [C('ε') + ' · ' + C('∅'), 'The empty string; the empty language.'], [C('\\*'), 'A literal special character.'],
  [C('alphabet: a b c'), 'Optional line: extra symbols for the DFA conversion.'],
])}
<p>Spaces are ignored. The expression compiles by <b>Thompson's construction</b> to an NFA with ε-moves, which runs like any NFA: the State graph tab shows the construction, and the card lights up the current set of states.</p>
<h3>Grammars</h3>
${MAN_PRE(`grammar Arith
start: E              // optional: otherwise the first rule's left side
E -> E+T | T
T -> T*F | F
F -> (E) | a`)}
<p>A nonterminal is a single capital letter; every other character is a terminal, and ${C('eps')} or ${C('ε')} is the empty string. Spaces are ignored.</p>
${MAN_TABLE(['Grammar', 'Runs as'], [
  ['<b>right-linear</b>: at most one nonterminal per rule, at the end (A → aB, A → ab, A → ε)', 'An <b>NFA</b> with one state per nonterminal and no stack: these grammars describe exactly the regular languages.'],
  ['<b>context-free</b>: anything else', 'The standard <b>PDA</b> on a stack tape (adding one creates the tape). It expands the nonterminal on top of the stack with one of its rules, or matches a terminal against the input, so every branch of the computation tree is a leftmost derivation, labelled with the rule it applies.'],
])}
<p>Left recursion and ε-rules would make that search endless, so a context-free grammar runs on an equivalent grammar without ε-rules or unit cycles, and discards any branch whose stack needs more symbols than the input has left. The tree stays finite, and each step names the rule of your grammar it came from. The Grammar tab says which kind of grammar you wrote.</p>
<h3>Tools</h3>
${MAN_TABLE(['Tool', 'Does'], [
  ['Convert to NFA / DFA', 'For expressions and right-linear grammars.'],
  ['To a regular expression', 'For DFAs, NFAs and right-linear grammars, by state elimination.'],
  ['To a right-linear grammar', 'For DFAs and NFAs: p –a→ q becomes P → aQ, accepting states get P → ε.'],
  ['Convert to PDA', 'For context-free grammars: the standard PDA as an editable table (without the pruning).'],
  ['List the language', 'Every string up to a length.'],
  ['CYK table', 'Converts to Chomsky normal form and fills the triangle for a string: a deterministic O(n³) decider.'],
])}` },

{ id: 'pda', title: 'Pushdown automata', group: 'Machine kinds', html: () => `
<h2>Pushdown automata</h2>
<p class="lead">A finite automaton with a stack: exactly the context-free languages. A PDA has two ports: ${C('in')}, read once left to right, and ${C('stack')}, wired to a tape of kind <b>stack</b> (adding a PDA creates one).</p>
${FIG('stack', 'A stack tape: the top plate is outlined, and only the top can be read, pushed or popped.', 'A stack with plates and a head tag at the top')}
${MAN_PRE(`alphabet: a b
start: q0
accept: q0 q3            # or the line: accept by empty stack
# state, input, pop -> state, push
q0, a, eps -> q1, AZ     # push lists symbols top first: A ends on top of Z
q1, a, A -> q1, AA
q1, b, A -> q2, eps
q2, b, A -> q2, eps
q2, eps, Z -> q3, eps`)}
${MAN_TABLE(['Field', 'Meaning'], [
  ['input', 'A symbol, consumed (the input head moves right), or ' + C('eps') + ' / ' + C('ε') + ' to read nothing.'],
  ['pop', 'A symbol that must be on top and is popped, or ' + C('eps') + ' to leave the stack alone.'],
  ['push', 'Symbols to push, written top first (' + C('AZ') + ' leaves A on top of Z), or ' + C('eps') + '.'],
  [C('accept: q …'), 'Accept by final state: the whole input has been read and the PDA is in one of these states.'],
  [C('accept by empty stack'), 'Accept by empty stack instead: the whole input has been read and the stack is empty.'],
  [C('stack: A Z'), 'Optional: documents the stack alphabet.'],
])}
<h3>Determinism</h3>
<p>Two rules <b>overlap</b> when they leave the same state, their inputs are equal or one is eps, and their pops are equal or one is eps. A PDA with no overlapping rules is a <b>DPDA</b> and runs as a single path. Otherwise, whenever several rules apply the run branches, the computation tree opens, and the PDA accepts if some branch does (∃), as with an NFA. The Table tab says which kind the PDA is.</p>
<p>If no rule applies, the PDA rejects. A PDA can loop on eps moves that push forever, so the step caps and the tree's node limit apply.</p>
<h3>Stacks in programs</h3>
<p>Any program can use stack tapes with ${C('push s x')}, ${C('pop s')} and ${C('read(s)')}. A program with finite registers and one stack is a PDA in program form. With <b>two</b> stacks it can simulate a Turing machine's tape, so the <b>Pushdown automata</b> example world decides aⁿbⁿcⁿ, which is not context-free, with two stacks.</p>` },

{ id: 'circuits', title: 'Circuits', group: 'Machine kinds', html: () => `
<h2>Boolean circuits</h2>
<p class="lead">Gates over input bits. Input xᵢ is cell i of the tape on the port ${C('in')} and must be 0 or 1. The circuit accepts when its output is 1.</p>
${FIG('circuit', 'A circuit card showing its diagram. Lit gates output 1.', 'A circuit card with input bits and XOR gates')}
${MAN_PRE(`circuit Majority3
a = AND x0 x1
b = AND x0 x2
c = AND x1 x2
m = OR a b c
output m            # optional: otherwise the last gate is the output
output to res       # optional: also write the output bit to port res`)}
${MAN_TABLE(['Line', 'Meaning'], [
  [C('name = OP args'), 'A gate. OP is AND, OR, XOR, NAND, NOR, XNOR (any number of inputs) or NOT (one). Arguments are inputs x0, x1, …, constants 0 and 1, or earlier gates.'],
  [C('output name'), 'Chooses the output gate.'],
  [C('output to port'), 'Adds a port that receives the output bit.'],
  [C('gates from port'), 'Builds the circuit from a description on a tape instead (below).'],
])}
<h3>Running</h3>
<p>A circuit evaluates <b>one layer per step</b>, so its depth is its parallel time; the counter shows the layer instead of steps. The card draws the gates and colours each wire with its value as the layers fire.</p>
<h3>Circuit families</h3>
<p>With ${C('gates from desc')}, the circuit reads a postfix description from the tape on port desc when it is called. Another machine, the family's generator, writes circuit n for an input of length n and then calls the circuit: that is a uniform circuit family.</p>
${MAN_TABLE(['Symbol', 'Postfix meaning'], [
  [C('v'), 'The next input bit (x0, then x1, …).'], [C('0') + ' ' + C('1'), 'Constants.'],
  [C('&') + ' ' + C('|') + ' ' + C('^'), 'AND, OR, XOR of the top two.'], [C('!'), 'NOT of the top.'], [C('d') + ' ' + C('s'), 'Duplicate the top; swap the top two.'],
])}
<h3>Budgets and tools</h3>
<p>Circuits have <b>size</b> (gates), <b>depth</b> (layers) and <b>fan-in</b> budgets instead of time and space, with presets for <b>NC¹</b>, <b>AC⁰</b> and <b>P/poly</b>. Budgets are checked when the circuit is built, before any gate runs, and a circuit over budget rejects. The Tools tab has a <b>truth table</b> and a scaling lab that measures size, depth or fan-in as n grows (for a family, by running its generator).</p>` },

{ id: 'scripts', title: 'Scripts', group: 'Machine kinds', html: () => `
<h2>Scripts</h2>
<p class="lead">Free-form JavaScript for things that should not be measured: provers, oracles you only want answers from, quick helpers.</p>
${MAN_PRE(`script Reverse(t, out output) {
  const s = io.get('t');
  io.set('out', s.split('').reverse().join(''));
  return true;          // true, 'accept' or 1 accepts
}`)}
${MAN_TABLE(['API', 'Does'], [
  [C("io.get(p)") + ' · ' + C("io.set(p, s)"), 'Read a whole tape from cell 0 to the first blank; replace its contents.'],
  [C("io.read(p, i)") + ' · ' + C("io.write(p, i, c)"), 'Single cells.'],
  [C("io.coin(p)"), 'The next coin from a random tape.'],
  [C("io.n"), 'The input length.'],
  [C("io.log(msg)"), 'Writes to the event log.'],
])}
<p>Ports take ${C('readonly')} and ${C('output')} after the name. A script runs as <b>one opaque step</b>, so its cost is <b>uncertified</b>: budgets cannot see inside it, and a reduction through a script is marked as such. Scripts have no description ⟨M⟩, so they cannot be simulated.</p>` },

{ id: 'devices', title: 'Buttons and displays', group: 'Elements', html: () => `
<h2>Buttons, inputs and displays</h2>
<p class="lead">Devices connect the world to you. Like machines they are wired to tapes, and they only touch tapes: an input writes symbols, a display draws them. All computing stays with the machines.</p>
${FIG('devices', 'Part of the control panel world: buttons, digit displays, a clock and number inputs, in the flat look.', 'Buttons, displays, a clock and number inputs on the grid')}
${MAN_TABLE(['Device', 'Does'], [
  ['<b>Button</b>', 'On press: set the tape to a string, append symbols, toggle one cell between 0 and 1, clear it, or write nothing.'],
  ['<b>Switch</b>', 'Shows whether one cell holds 1, and flips it when pressed.'],
  ['<b>Number input</b>', 'Writes a whole number in binary (either bit order), unary or decimal digits.'],
  ['<b>Text input</b>', 'Writes text, one character per cell (spaces become ·).'],
  ['<b>Clock</b>', 'A button that presses itself every so many seconds. Start and stop it with its ▶ key. Each beat does what a button press does (or writes the time of day as six digits, HHMMSS), then runs its machine.'],
  ['<b>Display</b>', 'Draws its tape: <b>lamps</b> (cells 0…k−1, lit by one symbol), a <b>pixel grid</b> (w × h cells, row by row), <b>seven-segment digits</b> (one cell each, optionally with cell 0 rightmost), a <b>number</b> (the cells read in an encoding), or <b>text</b>.'],
])}
<h3>Pressing and running</h3>
<ul>
  <li>Any input can <b>then run</b> a machine: the press writes, makes that machine the run target, and runs it on the tapes as they are (not their initial contents).</li>
  <li>While a run is in progress, inputs are <b>blocked</b> (greyed out). Wait for it to end or press Reset. Every run therefore starts from fixed tapes, so time travel, trees and the tools work as always.</li>
  <li>A nondeterministic machine that accepts leaves the world as an accepting branch left it, so displays show a witness.</li>
  <li>Displays follow whatever run you are looking at: the animation, a rewound step, or a branch of the tree.</li>
  <li>Presses are not edits to the world, so they are not in Undo; Reset restores the tapes' initial contents.</li>
</ul>
<h3>Clocks</h3>
<ul>
  <li>A clock does not count. Its hand moves on each beat, but the beats leave nothing on any tape unless the beat writes something or runs a machine. To count seconds, let it run a counter: in <b>A control panel</b>, <b>Tick</b> runs <b>Counter</b> once a second.</li>
  <li>A clock obeys the same rule as every input: a beat that falls during a run waits until the run ends (the dial dims), and at most one beat waits. A slow machine therefore slows its clock down instead of being interrupted, and a machine that never halts stops it.</li>
  <li>Clocks stop when you load another world. Whether a clock is running is not saved with the world.</li>
  <li>Writing the time of day is an outside input, like the clock chip in a computer: the machines still do all the work with it.</li>
</ul>
<h3>Animate or just compute</h3>
<p>The lightning button next to Speed turns animation off. Runs then finish as fast as possible without drawing each step; the status reads <b>processing</b> with the step count while it works, and everything updates when the run ends. Turn it back on to watch.</p>
<p>Add devices from <b>+ Add</b>. Click a device's title to move it, and its ⋯ button for its settings. Examples: <b>A control panel</b> and <b>Cellular automata</b>.</p>
<h3>Look</h3><p>The dial button next to the Inform and Operate buttons picks how machines and devices are drawn. Machines are bronze contraptions plumbed with copper pipes and an old CRT screen (brass), black chips with legs and LEDs that blink while they work (aluminium), or plain panels (flat). Tapes turn on a bronze cog between brass rails (brass), run between two aluminium drums whose lines slide the way the tape travels (aluminium), or wind on a paper reel (flat). Devices are drawn as <b>Brass and glass</b> (enamel buttons, toggle levers, jewel lamps, nixie tubes, odometer, ticker tape), <b>Aluminium and glass</b> (machined metal, soft-touch keys, latching switches with LED rings, OLED readouts) or <b>Flat panel</b> (plain faceplates, slide switches, LEDs, seven-segment and LCD readouts). It only changes the drawing: both read and write the same tapes. The choice is kept in your browser, not in the world.</p>` },

{ id: 'calls', title: 'Calls and oracles', group: 'Computation', html: () => `
<h2>Calls and oracles</h2>
<p class="lead">A call hands control to another machine. The callee works on <b>its own wired tapes</b>, so caller and callee talk through the tapes they share; the caller waits, then continues with the answer.</p>
<ul>
  <li>In a program: ${C('call M')} by machine name, or ${C('oracle P')} plus ${C('call P')} through a socket. Afterwards ${C('ret')} is accept or reject.</li>
  <li>In a Turing machine table: ${C('call: qask P -> qyes, qno')}.</li>
  <li>A callee's heads start at cell 0 on every call (except on random tapes, which keep their position).</li>
  <li>Calls can nest up to 64 deep.</li>
</ul>
<h3>What a call costs</h3>
${MAN_TABLE(['Callee', 'Caller is charged'], [
  ['ordinary machine', 'all the callee\'s steps (and its callees\')'],
  ['<b>Act as oracle</b> ticked', '1 step per call: an oracle answers instantly'],
  ['<b>Unbounded prover</b> role', 'nothing'],
])}
<h3>Sockets</h3>
<p>A socket names a slot rather than a machine. Plug a machine in under <b>Oracle sockets</b> in the Wiring tab; the call arrow on the grid is labelled with the socket. Swapping what is plugged in changes the oracle without touching the code, which is how relativized classes like P<sup>A</sup> and NP<sup>NP</sup> are built.</p>
<p>A <b>nondeterministic</b> machine with Act as oracle ticked is resolved on its own: its tree is explored on the side and only the answer returns, so the caller does not branch. That is how an NP oracle behaves inside Σ₂ = NP<sup>NP</sup>.</p>` },

{ id: 'nondet', title: 'Nondeterminism and alternation', group: 'Computation', html: () => `
<h2>Nondeterminism and alternation</h2>
<p class="lead">A choice forks the whole world, tapes included. The <b>computation tree</b> window grows as the run explores the branches.</p>
${FIG('tree', 'The computation tree of a guessing machine. Green branches accept, red ones reject; the outlined node is the branch on show.', 'A computation tree window with accepting and rejecting branches')}
<h3>The computation tree</h3>
<ul>
  <li>Open it with <b>Tree</b> in the top bar. It opens by itself when the run target branches.</li>
  <li>Step and Run explore the tree in <b>depth-first</b> or <b>breadth-first</b> order.</li>
  <li>An ∃ node accepts if <b>some</b> child accepts; a ∀ node only if <b>every</b> child does. With <b>Skip branches that can no longer change the answer</b>, branches that cannot matter are greyed out and not run.</li>
  <li>Click a node to see the world as that branch left it (finished branches are rebuilt by replaying their choices, so this can take a moment on long branches). The summary counts nodes, accepting and rejecting leaves, and quantifier blocks.</li>
  <li>A tree can grow to 25,000 nodes, the same limit the tools use; beyond that the answer is "undecided". The window draws at most 1,500 nodes, top levels first plus the branch you are viewing, and labels folded parts "+k folded".</li>
</ul>
<h3>Setting the class (Class &amp; budgets tab)</h3>
${MAN_TABLE(['Setting', 'Meaning'], [
  ['<b>Class preset</b>', 'NP = Σ₁ (∃ only), coNP = Π₁ (∀ only), Σ₂, Π₂, Σ₃, Π₃, or AP = PSPACE (unbounded alternation).'],
  ['<b>plain choose / guess means</b>', 'What choose and guess (or unmarked branching TM states) mean: ∃ or ∀. exists and forall always mean themselves.'],
  ['<b>quantifier blocks ≤</b>', 'A block is a run of choices of the same kind along one branch. A branch that alternates more than allowed rejects.'],
  ['<b>first block</b>', 'Forces the first block to be ∃ (Σₖ) or ∀ (Πₖ).'],
])}
<p>With a polynomial time budget, k blocks place the machine in Σₖᵖ or Πₖᵖ.</p>
<h3>Acceptance rules: counting and probability</h3>
<p><b>How the computation tree decides</b> switches from ∃/∀ to counting. No branch is skipped, and the alternation budget does not apply. #P and ⊕P count accepting paths. PP and BPP use the <b>probability of acceptance</b>: every choice is a fair coin (or die) over its options, so a path below choices with k₁, k₂, … options has probability 1/(k₁·k₂·…). That is the textbook definition; on a machine whose paths all make the same number of binary choices it equals the fraction of accepting paths.</p>
${MAN_TABLE(['Rule', 'Accepts when'], [
  ['∃ / ∀', 'The root evaluates to true (NP, coNP, PH, AP).'],
  ['<b>#P</b>', 'The number of accepting paths reaches the threshold k (k = 1 is NP again). The count itself is the #P function.'],
  ['<b>PP</b>', 'The probability of acceptance is more than 1/2.'],
  ['<b>BPP-style</b>', 'The probability of acceptance is at least 2/3; rejects at 1/3 or less; in between there is no clear answer.'],
  ['<b>⊕P</b>', 'The number of accepting paths is odd.'],
])}
<p>Branches from ${C('exists r')} over a register give one path per value, each equally likely. The tree window shows the probability of the path you are viewing and, for PP and BPP, the probability of acceptance found so far.</p>` },

{ id: 'random', title: 'Randomness and proofs', group: 'Computation', html: () => `
<h2>Randomness, certificates and interactive proofs</h2>
<h3>Random tapes</h3>
<p>Wire a port to a tape of kind <b>random coins</b>. Coins are drawn as heads reach them, from the tape's seed, so a run is reproducible until you <b>Re-roll coins</b>. The tape shows ? on cells nobody has read yet.</p>
<p><b>Run trials</b> (Tools tab) runs the world many times with fresh coins and reports how often the machine accepts, with a confidence interval. A BPP machine should be at least 2/3 or at most 1/3 on every input. Trials are offered only when the machine or something it calls reads a random tape.</p>
<h3>Certificates (NP as verification)</h3>
<p>Give a verifier a tape of kind <b>certificate</b>. <b>Find witness</b> in that tape's window plays the unbounded prover: it tries every certificate, shortest first, and keeps one the verifier accepts. The other view of NP, guessing, is in <a data-man="nondet">Nondeterminism</a>.</p>
<h3>Private and public coins</h3>
<p>A random tape's window has a <b>Public coins</b> checkbox. Unticked (the default), the coins are the verifier's secret: a machine with the <b>Unbounded prover</b> role that tries to read them gets an error. Ticked, provers may read them, which turns the protocol into an <b>Arthur–Merlin</b> (public-coin) protocol. In the interactive proof world, PeekingProver answers with the verifier's own coin: it can only guess while the coins are private, and it fools the verifier every time once they are public.</p>
<h3>Probabilistically checkable proofs</h3>
<p>A PCP verifier reads its input, tosses r(n) coins, and reads only q(n) cells of a <b>proof</b> tape, jumping to them with ${C('seek')}. Set both budgets in the Budgets tab (random bits ≤ r(n), proof queries ≤ q(n)) and the badge reads PCP(r, q). In the Tools tab, <b>Exact acceptance probability</b> runs the verifier once for every sequence of r coins (up to 16 bits) and reports the exact probability, with a bar for how often each proof cell is queried. <b>Best proof</b> tries every proof of a given length and reports the highest probability any of them reaches: completeness asks for 1 when the input is in the language, soundness for at most 1/2 when it is not. A run that reads more coins than r is flagged.</p>
<h3>Advice</h3>
<p>A tape of kind <b>advice</b> gives a machine a string a(n) that depends only on the input length, filled in when the run starts. The machine reads it but cannot compute it. With polynomial time and polynomially long advice this is P/poly, the class of polynomial-size circuit families; a circuit can even take its gates from an advice tape (${C('gates from adv')}). A callee sees the advice for the run target's n.</p>
<h3>Interactive proofs</h3>
<p>Give a machine the <b>Unbounded prover</b> role: callers are not charged for its steps and its budgets are ignored. A bounded, randomized verifier exchanges messages with it through shared tapes, calling it once per round. Compare an honest prover with a cheating one by plugging each into the verifier's socket and running trials; the <b>Interactive proof</b> example world does this for graph non-isomorphism.</p>` },

{ id: 'comm', title: 'Communication complexity', group: 'Computation', html: () => `
<h2>Communication complexity</h2>
<p class="lead">Two parties with private inputs compute a function of both, and only the bits they exchange count.</p>
<h3>Setting it up</h3>
<ul>
  <li><b>Private inputs</b>: give each party its own input tape and wire it only to that party. Nothing else can read it.</li>
  <li><b>The channel</b>: a tape of kind <b>channel</b>, wired to both. It is append-only: ${C('send ch x')} adds x at the end, tinted with the sender's colour. Parties read the transcript with ${C('read(ch)')} and ${C('move ch R')}; the head starts at cell 0 on every call.</li>
  <li><b>Turns</b>: one party is the run target and calls the other (a socket works well) whenever it is the other's turn. A call starts the callee afresh, so each message is a function of the callee's input and the transcript so far, exactly as in the definition of a protocol.</li>
  <li><b>Shared randomness</b>: wire both parties to the same random tape. Read in the same order, they see the same coins: the public-coin model.</li>
</ul>
<h3>Counting</h3>
<p>The channel's label shows the total number of symbols and how many each machine sent. In the Tools tab the scaling lab offers the metric <b>communication</b>, the number of symbols on all channels after the run, so you can plot the worst case against n. Computation costs nothing here: time and space are still measured, but they are not the point.</p>
${MAN_PRE(`machine Alice {
  tape x readonly      // Alice's private input
  tape ch              // the channel
  oracle Bob
  while read(x) != _ { send ch read(x)  move x R }
  call Bob             // Bob compares and sends the answer bit
  accept if ret == accept
}`)}
<p>The <b>Communication complexity: equality</b> world compares this n + 1-bit protocol with a randomized one: 6 inner-product bits over shared coins plus Bob's answer, 7 bits for every n, with error 1/64.</p>` },

{ id: 'budgets', title: 'Budgets and resources', group: 'Computation', html: () => `
<h2>Budgets and resources</h2>
<p class="lead">A budget turns a machine into a member of a class: a run that goes over budget <b>rejects</b>, with the reason in the log.</p>
<h3>Time and space (Budgets tab)</h3>
<p>Write a function of n, the length of the machine's first tape: numbers, ${C('n')}, ${C('+ - * / ^ ( )')}, ${C('log')} (base 2), ${C('sqrt')}, ${C('min')}, ${C('max')}. For example ${C('n^2 + 5')} or ${C('2*log(n) + 4')}.</p>
${MAN_TABLE(['Resource', 'Counts'], [
  ['time', 'Every step the machine takes, plus what its calls cost it (see <a data-man="calls">Calls</a>). Callees are charged to the caller as they run, so a caller that is waiting for a call can run out of time mid-call: it is then cut off and rejects.'],
  ['space', 'Distinct cells visited on work tapes. Read-only inputs, output tapes and channels are free, so log-space machines and transducers are expressible.'],
  ['random bits', 'Distinct coins read from random tapes.'],
  ['proof queries', 'Distinct cells of proof tapes read. With random bits, this places the machine in PCP(r, q).'],
  ['communication', 'Symbols sent over channel tapes (see <a data-man="comm">Communication complexity</a>). Measured by the scaling lab; there is no budget for it.'],
  ['alternation', 'Quantifier blocks per branch (see <a data-man="nondet">Nondeterminism</a>).'],
  ['size / depth / fan-in', 'For circuits (see <a data-man="circuits">Circuits</a>).'],
])}
<p>The card's T and S meters fill toward the budget and turn red when it is exceeded. Budgets apply on every call, with n taken from that call's tape.</p>
<p>A budget is enforced on the runs you make, not proved for all inputs. The <a data-man="tools">scaling lab</a> measures how the cost grows and checks it against the budget across many inputs.</p>` },

{ id: 'tools', title: 'Tools', group: 'Experiments', html: () => `
<h2>Tools</h2>
<p class="lead">Each machine's Tools tab runs experiments on it. Long experiments run in the background, so the world stays usable; each has a Stop button.</p>
<h3>Scaling lab</h3>
<p>Runs the machine on many inputs of each size and plots the worst case of a metric against n, with the declared budget as a dashed red line and an estimate of the growth rate (polynomial, exponential or logarithmic). Filled dots are exact worst cases (every string of that length was tried); hollow dots are samples.</p>
${MAN_TABLE(['Setting', 'Meaning'], [
  ['<b>Run</b>', 'Shown when other machines call this one: run one of them and measure this machine each time it is called (for example, a circuit inside its family generator).'],
  ['<b>Measure</b>', 'time or space; size, depth or fan-in for circuits.'],
  ['<b>Inputs</b>', 'Every string when there are few enough, random strings, or your own generator.'],
  ['<b>Sizes · step · inputs per size · step cap</b>', 'The range of n and how hard to look.'],
])}
<p>A generator is a JavaScript function ${C('(n, rand, pick) => …')} returning the input string for the first tape, or an object mapping tape (or port) names to strings to fill several tapes. ${C('rand()')} is uniform in [0, 1) and ${C("pick('ab')")} picks a symbol.</p>
<h3>Run trials</h3>
<p>For machines that read random tapes: the acceptance rate over fresh coins, with a confidence interval.</p>
<h3>Compare languages</h3>
<p>Runs this machine and another on every string up to a length plus random longer ones, and lists every string where one accepts and the other does not. Click a counterexample to load it onto the tape.</p>
<h3>Diagonal table</h3>
<p>Runs every machine in the world on every machine's description ⟨M⟩ and outlines the diagonal. The flipped diagonal row differs from every row, so it is no machine in the table. See <a data-man="data">Machines as data</a>.</p>
<h3>Truth table (circuits)</h3>
<p>Evaluates the circuit on every input of its length. For a circuit read from a tape, choose n and the family generator builds circuit n first.</p>
<h3>Convert</h3>
<p><b>Determinize</b> for NFAs and <b>Compile to DFA</b> for programs in the dfa dialect. Between the descriptions of regular languages: expression → NFA (Thompson) → DFA (subsets, then minimization) → expression (state elimination), and automaton ↔ right-linear grammar. A context-free grammar converts to a PDA. Each conversion adds a new machine on the same input tape, so <b>Compare languages</b> can confirm the result.</p>
<h3>Grammar tools</h3>
<p>For grammars: <b>List the language</b> up to a length, and the <b>CYK table</b> for a string (Chomsky normal form, then dynamic programming).</p>
<p class="note">Agreement on many inputs is evidence, not proof: every tool says so in its result.</p>` },

{ id: 'reductions', title: 'Reductions', group: 'Experiments', html: () => `
<h2>Reductions</h2>
<p class="lead">A reduction card states <b>A ≤ B</b>: a transducer f with w ∈ A exactly when f(w) ∈ B. Add one from <b>+ Add → Reduction</b>.</p>
${FIG('reduce', 'A reduction card on the grid: IndSet ≤ Clique via the transducer Complement.', 'A reduction card reading IndSet ≤ Clique via Complement')}
<h3>Parts</h3>
${MAN_TABLE(['Part', 'Is'], [
  ['<b>A</b> and <b>B</b>', 'Deciders: machines with an input tape. Arrows join them to the card.'],
  ['<b>Transducers</b>', 'Machines with an input tape and an <b>output</b> tape (declare <code>tape out output</code>), applied in order: a chain f₁, f₂, … composes them.'],
  ['<b>log-space / poly-time</b>', 'Buttons that set a transducer\'s budget to space ≤ 2·log n + 4 or time ≤ n³ + 20.'],
  ['Kind', 'The card shows ≤ₗ (log-space), ≤ₚ (poly-time) or ≤ (unbudgeted, or through a script, which is uncertified).'],
])}
<h3>Checking</h3>
<p><b>Check</b> runs f on many inputs w (every string up to a length plus random ones, or your generator), then A on w and B on f(w). It lists every input where the answers differ, and records each transducer's time, space and output length against its budget. The card shows the result: checked, failed, or over budget. Click a counterexample to load it onto A's tape.</p>
<p>When one card's B is another card's A, the window offers to <b>compose</b> them into a new card: reductions chain, which is how hardness spreads.</p>
<h3>A claim and a checker</h3>
<p>The card itself computes nothing on the tapes. To actually reduce an instance, make the transducer the run target and run it: its output tape then holds f(w). Switch the target to B and it starts on the tapes as they are, so B decides f(w).</p>` },

{ id: 'data', title: 'Machines as data', group: 'Experiments', html: () => `
<h2>Machines as data</h2>
<p class="lead">Every machine (except scripts) is also a string: its <b>description ⟨M⟩</b>, one character per cell. That makes universal machines, diagonalization and self-reference runnable.</p>
<h3>The encoding</h3>
<p>⟨M⟩ is the source without comments or indentation. A space becomes ${C('·')}, a line break ${C('¶')}, and ${C('_')} becomes ${C('␣')} (a _ cell would be blank). Strings and quoted symbols are kept as written. Tables start with a line naming their kind and name, like ${C('tm·Name')}. To put ⟨M⟩ on a tape, use <b>Machines as data → Write description</b> in the tape's window.</p>
<h3>simulate</h3>
${MAN_PRE(`machine U {
  tape code readonly    // ⟨M⟩
  tape in               // M's input
  simulate code on (in)
  accept if ret == accept
}`)}
<ul>
  <li>${C('simulate code')} decodes the machine on tape code and runs it as a guest; ${C('ret')} becomes its answer.</li>
  <li>${C('on (a, b)')} wires the guest's tapes to the caller's ports a, b in order. Without it, tapes are matched by name, then by position.</li>
  <li>${C('within time (f)')} cuts the guest off after f(n) steps, counting everything it calls, and sets ret to <b>timeout</b>. ${C('within space (f)')} cuts it off once it has visited more than f(n) work cells and sets ret to <b>spaceout</b>. Both can be given, in either order: ${C('within space (n) time (10*n^2)')}. A bound is a number, ${C('n')}, or a budget expression in parentheses, and n is the length of the guest's first tape. ${C('within 500')} means 500 steps.</li>
  <li>The guest's work cells count toward the simulator's space, and its steps toward the simulator's time.</li>
  <li><b>Simulation cost</b> (Budgets tab of a machine that uses simulate) chooses what that time is. <b>Free</b>: one step per simulated step. <b>Multi-tape universal machine</b>: |⟨M⟩| per step to look up the transition plus ⌈log₂ t⌉ to move tape blocks (Hennie–Stearns), O(|⟨M⟩|·t log t) in all. <b>Single-tape universal machine</b>: |⟨M⟩| plus the cells in use per step, O(t²). Separately you can charge for enforcing bounds: computing f(n) and a step counter for time; marking f(n) cells and a loop counter of log(#configurations) cells for space. And you can detect loops: when a space-bounded guest repeats a configuration it is cut off with timeout, and the simulator is charged the steps its loop counter would have needed. These are accounting models: the step counter shows what actually ran, the charged time includes the overhead, and the machine window breaks it down.</li>
  <li>Costs compound through nested simulations: each simulator pays its own model's overhead on every step of its guest's charged time, the guest's own overhead included. A described machine uses the settings of the world machine with its name.</li>
  <li>A regress of simulations nested more than 64 deep (D simulating D simulating D …) is cut off as if the outermost time bound ran out, which is where it would end anyway.</li>
  <li>A tape that holds no valid description stands for a machine that rejects at once. Nondeterministic guests are not supported.</li>
  <li>Each guest step costs one step (an idealized universal machine).</li>
  <li>A guest keeps the oracle-socket wiring of the world machine with the same name.</li>
</ul>
<p>While a guest runs, the host's screen shows the program it read off the tape with the current line lit, the guest's heads appear on the tapes as ⟨name⟩, and the call stack shows it in a dashed frame.</p>
<h3>Self-reference</h3>
<p>${C('writeself t')} writes the machine's own description onto t: Kleene's recursion theorem as a statement. The <b>halting problem</b> world builds D, which asks a candidate decider H about ⟨M⟩ and does the opposite; run on ⟨D⟩, every H is wrong. The <b>Rice's theorem</b> world turns that into a log-space reduction card from halting to "accepts the empty string". The <a data-man="tools">diagonal table</a> shows the diagonal argument as a grid. The <b>Hierarchy theorems</b> world bounds the simulation: DTime diagonalizes against TIME(4n²) and DSpace against SPACE(n).</p>` },
];

let manTab = 'start';
try { const t = localStorage.getItem('tw-manual-tab'); if (t && MANUAL.some(s => s.id === t)) manTab = t; } catch (e) { }
function openManual(id) {
  if (id && MANUAL.some(s => s.id === id)) manTab = id;
  const el = $('#manual');
  const groups = [...new Set(MANUAL.map(s => s.group))];
  el.innerHTML = `<div class="mpanel" role="dialog" aria-modal="true" aria-label="Turing World manual">
    <div class="mhead"><b>Manual</b><button class="ib" data-man-close aria-label="Close manual">×</button></div>
    <nav class="mtabs" role="tablist" aria-label="Manual sections">${groups.map(g => `<div class="mgroup"><span class="mgh">${g}</span>${MANUAL.filter(s => s.group === g).map(s => `<button role="tab" data-man="${s.id}" aria-selected="${s.id === manTab}" class="${s.id === manTab ? 'on' : ''}">${s.title}</button>`).join('')}</div>`).join('')}</nav>
    <article class="mbody" role="tabpanel" tabindex="0"></article></div>`;
  showManualTab(manTab); el.hidden = false; $('#bManual').classList.add('on');
}
function showManualTab(id) {
  const s = MANUAL.find(x => x.id === id) || MANUAL[0]; manTab = s.id;
  try { localStorage.setItem('tw-manual-tab', s.id); } catch (e) { }
  const el = $('#manual'); if (!el.querySelector('.mbody')) return;
  el.querySelectorAll('.mtabs [data-man]').forEach(b => { const on = b.dataset.man === s.id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  const i = MANUAL.indexOf(s), prev = MANUAL[i - 1], next = MANUAL[i + 1];
  const body = el.querySelector('.mbody');
  body.innerHTML = s.html() + `<div class="mnav">${prev ? `<button class="btn small" data-man="${prev.id}">← ${prev.title}</button>` : '<span></span>'}${next ? `<button class="btn small" data-man="${next.id}">${next.title} →</button>` : ''}</div>`;
  body.scrollTop = 0;
  const tab = el.querySelector(`.mtabs [data-man="${s.id}"]`); if (tab) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function closeManual() { $('#manual').hidden = true; $('#bManual').classList.remove('on'); }
document.addEventListener('click', e => {
  const m = e.target.closest('[data-man]');
  if (m) { e.preventDefault(); if ($('#manual').hidden) openManual(m.dataset.man); else showManualTab(m.dataset.man); return; }
  if (e.target.closest('[data-man-close]') || e.target.id === 'manual') closeManual();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#manual').hidden) { e.stopImmediatePropagation(); closeManual(); } }, true);
$('#bManual').addEventListener('click', () => { if ($('#manual').hidden) openManual(); else closeManual(); });
