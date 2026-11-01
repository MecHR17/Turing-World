// ---------- theory: a short course, chapter by chapter, tied back to the app ----------
// Each chapter is one manual tab in the group "Theory". W('key') links to a world; APP(...) is the
// "In Turing World" box that says how the app implements what the chapter describes.
const W = (key, label) => { const ex = EXAMPLES.find(e => e.key === key); return `<a href="#" data-world="${key}" class="wlink">${label || (ex ? esc(ex.title) : key)}</a>`; };
const APP = html => `<div class="mapp"><div class="mapph">In Turing World</div>${html}</div>`;
const DEF = (term, html) => `<div class="mdef"><b>${term}.</b> ${html}</div>`;
const THM = (name, html) => `<div class="mthm"><b>${name}.</b> ${html}</div>`;
const SIMPL = html => `<p class="msimpl"><b>Simplification:</b> ${html}</p>`;

MANUAL.push(
{ id: 'th-intro', title: 'About this course', group: 'Theory', html: () => `
<h2>A short course in computability and complexity</h2>
<p class="lead">These chapters explain the theory behind every part of Turing World: what each idea means, the main definitions and theorems, and the core of the proofs. Each chapter ends with how the app implements the idea and which world shows it.</p>
<h3>How to read it</h3>
<p>The chapters build on each other, in the order a university course would take: automata, then Turing machines and what they cannot do, then resources (time and space), then the classes built on nondeterminism, randomness, interaction and non-uniformity. You can also jump straight to a topic. Links like ${W('inc')} load that world; the manual closes so you can try it.</p>
<h3>Notation used throughout</h3>
<ul>
  <li>An <b>alphabet</b> Σ is a finite set of symbols. A <b>string</b> w is a finite sequence of symbols; |w| is its length and ε the empty string. Σ* is the set of all strings.</li>
  <li>A <b>language</b> is a set of strings L ⊆ Σ*. Deciding L means answering “is w ∈ L?” for every w. Almost every problem can be phrased this way by encoding its input as a string: a graph as adjacency bits, a number in binary, a machine as its source text.</li>
  <li>n always means the length of the input. Resource bounds are functions of n: “time n²” means at most n² steps on inputs of length n (for large enough n, up to constant factors when we write O(n²)).</li>
  <li>A <b>complexity class</b> is a set of languages, such as P, the languages decidable in polynomial time.</li>
</ul>
<h3>Chapters</h3>
<ol>
  <li><a data-man="th-regular">Finite automata and regular languages</a></li>
  <li><a data-man="th-cfl">Grammars and pushdown automata</a></li>
  <li><a data-man="th-tm">Turing machines</a></li>
  <li><a data-man="th-undec">Undecidability</a></li>
  <li><a data-man="th-time">Time, space and the hierarchy theorems</a></li>
  <li><a data-man="th-np">Nondeterminism and NP</a></li>
  <li><a data-man="th-ph">Oracles, alternation and the polynomial hierarchy</a></li>
  <li><a data-man="th-count">Counting and randomness</a></li>
  <li><a data-man="th-ip">Interactive proofs and PCPs</a></li>
  <li><a data-man="th-circ">Circuits and advice</a></li>
  <li><a data-man="th-comm">Communication complexity</a></li>
</ol>
<p class="note keep">The app is a model, not a proof assistant. Where it simplifies the theory, the chapter says so in a box marked <b>Simplification</b>.</p>` },

{ id: 'th-regular', title: '1 · Regular languages', group: 'Theory', html: () => `
<h2>Finite automata and regular languages</h2>
<p class="lead">The simplest model of computation: a machine with a fixed, finite memory that reads its input once, left to right. The languages it can decide are the <b>regular languages</b>.</p>
<h3>Deterministic finite automata</h3>
${DEF('DFA', 'A tuple (Q, Σ, δ, q₀, F): a finite set of states Q, an alphabet Σ, a transition function δ : Q × Σ → Q, a start state q₀ and a set of accepting states F. On input w = a₁…aₙ it moves q₀ → δ(q₀, a₁) → … and accepts if the last state is in F.')}
<p>A DFA uses no memory beyond its current state, so it can only remember a bounded amount about the input seen so far. “Even number of 1s” needs one bit of memory: two states, flipping on every 1.</p>
<h3>Nondeterminism and the subset construction</h3>
${DEF('NFA', 'Like a DFA, but δ : Q × (Σ ∪ {ε}) → 𝒫(Q) gives a <i>set</i> of next states, and ε-moves change state without reading a symbol. An NFA accepts if <i>some</i> sequence of choices ends in an accepting state.')}
${THM('Theorem (Rabin–Scott)', 'Every NFA with k states has an equivalent DFA with at most 2ᵏ states.')}
<p><i>Proof idea.</i> Run all choices at once: the DFA’s state is the <b>set</b> of NFA states that are currently possible, closed under ε-moves. Reading a symbol maps that set to the set of all its successors. The DFA accepts if the set contains an accepting state. This is the <b>subset construction</b>.</p>
<p>The blow-up can be real: “the third symbol from the end is 1” has a 4-state NFA (guess where the third-from-last symbol is), but every DFA needs 2³ = 8 states, because it must remember the last three symbols.</p>
<h3>Minimal automata</h3>
<p>Two strings u and v are <b>equivalent</b> for L if no suffix tells them apart: uz ∈ L ⇔ vz ∈ L for every z. The <b>Myhill–Nerode theorem</b> says L is regular exactly when this relation has finitely many classes, and then the classes are the states of the unique smallest DFA. Minimization finds it by <b>partition refinement</b>: start with two groups (accepting, not), and keep splitting any group whose states go to different groups on some symbol, until nothing changes (Moore’s algorithm).</p>
<h3>Regular expressions and Kleene’s theorem</h3>
${DEF('Regular expression', 'Built from ∅, ε and single symbols a by union r|s, concatenation rs and star r* (zero or more repetitions).')}
${THM('Theorem (Kleene)', 'A language is described by a regular expression exactly when some finite automaton decides it.')}
<p><i>Expression → NFA</i> (<b>Thompson’s construction</b>): build an NFA for each piece and glue them with ε-moves. A symbol is two states and one edge; r|s adds a new start with ε-edges into both; rs links r’s end to s’s start; r* adds ε-edges that loop back and skip. Each operator adds at most two states, so the NFA has size linear in the expression.</p>
<p><i>Automaton → expression</i> (<b>state elimination</b>): add a new start and a new final state, label edges with expressions, and remove the other states one by one. Removing q replaces every path p → q → r by a single edge labelled (p→q)(q→q)*(q→r), combined with | with any existing p → r edge. When only start and final remain, the label is the expression.</p>
<p>Grammars whose rules all look like A → aB or A → a or A → ε (<b>right-linear</b>) are a third equivalent description: nonterminals are states, and A → aB is an edge from A to B reading a.</p>
<h3>What regular languages cannot do</h3>
${THM('Pumping lemma', 'If L is regular, there is a p such that every w ∈ L with |w| ≥ p splits as w = xyz with |xy| ≤ p, |y| ≥ 1, and xyⁱz ∈ L for all i ≥ 0.')}
<p>The reason: a DFA with p states reading p symbols must repeat a state, and the loop between the repeats can be taken any number of times. So {aⁿbⁿ} is not regular: pumping inside the a’s breaks the balance. Counting without bound needs unbounded memory.</p>
${APP(`<ul>
  <li>${W('dfa')}: a hand-written DFA and a program in the <b>dfa</b> dialect. A program whose registers have finite ranges is a finite automaton in disguise: its states are (control node, register values). <b>Compile to DFA</b> in its Tools tab builds that product and minimizes it.</li>
  <li>${W('nfa')}: the third-from-last NFA. All possible states light up at once, which is the subset construction happening live. <b>Determinize</b> runs the subset construction and then Moore’s partition refinement, and reports the 8-state minimal DFA.</li>
  <li>${W('lang')}: <b>EndsAbb</b> is a regular expression; it runs as its Thompson NFA, which you can see in its State graph tab. <b>EvenAs</b> is a right-linear grammar, run as an NFA with one state per nonterminal. The Tools tabs convert in every direction: expression → NFA → DFA → expression by state elimination (with a simplifier that tidies the result), and automaton ↔ right-linear grammar.</li>
  <li><b>Compare languages</b> (Tools tab) runs two machines on every string up to a length and reports where they disagree, a quick check that two descriptions mean the same language.</li>
</ul>`)}` },

{ id: 'th-cfl', title: '2 · Grammars and PDAs', group: 'Theory', html: () => `
<h2>Context-free grammars and pushdown automata</h2>
<p class="lead">Add one unbounded stack to a finite automaton and it can count, match brackets and parse arithmetic. The languages it decides are the <b>context-free languages</b>, the ones generated by context-free grammars.</p>
<h3>Grammars</h3>
${DEF('Context-free grammar', 'Nonterminals V, terminals Σ, a start symbol S and rules A → α, where α is any string of terminals and nonterminals. A derivation starts from S and repeatedly replaces a nonterminal by the right side of one of its rules; the language is the set of terminal strings that can be derived.')}
<p>Example: S → aSb | ε generates {aⁿbⁿ}. A derivation that always replaces the <b>leftmost</b> nonterminal is a leftmost derivation; every string in the language has one, and they correspond to parse trees. A grammar is <b>ambiguous</b> when some string has two parse trees.</p>
<h3>Pushdown automata</h3>
${DEF('PDA', 'A finite automaton with a stack. A rule reads the current state, the next input symbol (or nothing) and the top of the stack, then moves to a new state and replaces the top by a string. It accepts by final state or by empty stack; for nondeterministic PDAs the two are equivalent.')}
${THM('Theorem', 'A language is context-free if and only if some nondeterministic PDA decides it.')}
<p><i>Grammar → PDA</i>, the direction the app uses: put S on the stack. If the top is a nonterminal A, pop it and push the right side of some rule A → α (a nondeterministic choice). If the top is a terminal, it must match the next input symbol; pop it and read on. Accept when input and stack are both empty. Each accepting run is exactly a leftmost derivation.</p>
<h3>Determinism matters here</h3>
<p>Unlike finite automata, deterministic PDAs are strictly weaker. {aⁿbⁿ} has a deterministic PDA (push for a, pop for b), but even palindromes {wwᴿ} do not: the machine must guess where the middle is.</p>
<h3>Deciding membership: CNF and CYK</h3>
<p>Any grammar (for a language without ε) can be put in <b>Chomsky normal form</b>: every rule is A → BC or A → a. Then the <b>CYK algorithm</b> decides w ∈ L by dynamic programming: for each substring of w it computes the set of nonterminals that derive it, from length 1 upward, combining two shorter pieces with a rule A → BC. That is O(n³) time for a fixed grammar, so every context-free language is in P.</p>
<h3>Limits</h3>
<p>The <b>pumping lemma for CFLs</b> (a long string has two pieces that can be pumped together) shows that {aⁿbⁿcⁿ} is not context-free: one stack can match one pair of counts, not two. Two stacks, on the other hand, can simulate a Turing machine’s tape (one stack holds what is left of the head, the other what is right of it), so two stacks are as powerful as any computer.</p>
${APP(`<ul>
  <li>Stacks are a tape kind. Cell 0 is the bottom, and the only operations are push, pop and reading the top, so the one-sided access is enforced, not just drawn.</li>
  <li>${W('pda')}: <b>AnBn</b> is deterministic; <b>EvenPal</b>’s rules overlap, so its run branches and the computation tree shows the guesses. Each PDA accepts by final state or by empty stack, as its source declares. <b>AnBnCn</b> is a program with two stacks.</li>
  <li>${W('lang')}: <b>Arith</b> is a context-free grammar run as the PDA above, so each branch of its tree applies one rule to the leftmost nonterminal and an accepting branch is a leftmost derivation. Grammars with ε-rules or unit cycles (like S → SS | ε) would give infinite trees, so the app first searches an equivalent grammar without them; each step still names the rule it came from. Right-linear grammars skip the stack entirely and run as NFAs.</li>
  <li>The grammar’s Tools tab runs <b>CYK</b> on its Chomsky normal form and shows the table, and <b>List the language</b> derives every string up to a chosen length.</li>
</ul>`)}` },

{ id: 'th-tm', title: '3 · Turing machines', group: 'Theory', html: () => `
<h2>Turing machines</h2>
<p class="lead">A finite control plus an unbounded tape it can read, write and move over in both directions. Every reasonable model of computation turns out to be equivalent to it.</p>
<h3>The model</h3>
${DEF('Turing machine', 'A finite set of states, a tape alphabet containing a blank _, and a transition function: in state q reading symbol a, write b, move the head left, right or stay, and go to state q′. The input starts on the tape; the machine halts by entering an accepting or rejecting state.')}
<p>A <b>configuration</b> (state, tape contents, head position) is a snapshot of the whole computation; a run is a sequence of configurations, each following from the last by one transition. This makes computations finite, checkable objects, which is what most proofs in this course manipulate.</p>
<p>A machine <b>decides</b> L if it halts on every input and accepts exactly the strings in L. It <b>recognizes</b> L if it accepts exactly those strings but may run forever on the others. A <b>transducer</b> computes a function: it writes its answer on an output tape.</p>
<h3>Robustness</h3>
<p>Many variations give the same power. A <b>k-tape</b> machine can be simulated by a one-tape machine that stores all tapes interleaved and sweeps across them for each step; t steps become O(t²). Two-way infinite tapes, extra symbols, random access to registers, two stacks, cellular automata such as Rule 110: all equivalent in what they can compute, though not always in how fast.</p>
${THM('Church–Turing thesis', 'Anything computable by an effective procedure is computable by a Turing machine. (Not a theorem but a definition of “computable”, supported by the fact that every proposed model has turned out equivalent.)')}
<h3>The universal machine</h3>
<p>A machine M is a finite object, so it can be written as a string ⟨M⟩. A <b>universal machine</b> U takes ⟨M⟩ and w and simulates M on w: it keeps M’s description on one tape and M’s tape and state on others, and for each step it looks up the matching rule in ⟨M⟩. U is a single fixed machine that runs every program, which is the idea behind stored-program computers and behind the proofs in the next two chapters.</p>
${APP(`<ul>
  <li>Turing machines are written as tables (see <a data-man="tm">Turing machines</a>). A table can use any number of tapes, read-only and one-way ports, and calls to other machines. Programs (see <a data-man="programs">Program language</a>) compile to a finite control plus finite registers, which is still a Turing machine: every step reads and writes tape cells and moves heads.</li>
  <li>${W('inc')} is a one-tape transducer; ${W('pal')} the classic one-tape palindrome shuttle, which needs about n²/2 steps; ${W('rev')} a two-tape transducer with a read-only input and a separate output.</li>
  <li>Machines share tapes, so one machine’s output is another’s input, and the run target can be switched without resetting the tapes.</li>
  <li>${W('life')}: a program draws elementary cellular automata, including Rule 110, which is Turing complete.</li>
  <li>${W('halt')}: <b>U</b> is a two-line universal machine. Its <b>simulate</b> statement runs whatever description ⟨M⟩ is on its code tape (see <a data-man="data">Machines as data</a>).</li>
</ul>`)}` },

{ id: 'th-undec', title: '4 · Undecidability', group: 'Theory', html: () => `
<h2>Undecidability</h2>
<p class="lead">Some languages have no deciding machine at all. The proof is diagonalization: a machine is made to contradict whatever is claimed about it.</p>
<h3>The halting problem</h3>
<p>Let K = { ⟨M⟩ : M halts on input ⟨M⟩ }.</p>
${THM('Theorem (Turing)', 'K is recognizable but not decidable.')}
<p><i>Recognizable:</i> simulate M on ⟨M⟩ with the universal machine and accept if it halts.</p>
<p><i>Not decidable:</i> suppose H decides K. Build D: on input ⟨M⟩, run H on ⟨M⟩; if H says “halts”, loop forever; if H says “does not halt”, halt. Now run D on ⟨D⟩. If D halts, H said “does not halt”, so H was wrong; if D loops, H said “halts”, wrong again. So no H exists.</p>
<p>The same argument as a table: list all machines as rows and all descriptions as columns, entry (i, j) = what Mᵢ does on ⟨Mⱼ⟩. D is built to differ from the diagonal entry in every row, so D is not any row: it cannot be in the list, yet it is a machine. That is Cantor’s diagonal argument.</p>
<h3>Self-reference without paradox</h3>
${THM('Recursion theorem (Kleene)', 'A machine can obtain its own description and compute with it.')}
<p>So “D runs H on itself” is not a trick that needs D to be given ⟨D⟩; D could print ⟨D⟩ itself. Programs that print their own source (quines) are the simplest instance.</p>
<h3>Reductions</h3>
${DEF('Many-one reduction', 'A ≤ B if there is a computable function f with w ∈ A ⇔ f(w) ∈ B for all w. Then a decider for B gives one for A (compute f, ask B), so if A is undecidable, so is B.')}
${THM('Rice’s theorem', 'Every non-trivial property of the language a machine recognizes is undecidable. (Non-trivial: some machines have it and some do not.)')}
<p><i>Proof sketch.</i> Take a property P that the empty language does not have, and a machine N whose language has it. Reduce K to P: map ⟨M⟩ to ⟨M′⟩, where M′ on any input x first runs M on ⟨M⟩, then runs N on x. If M halts, L(M′) = L(N), which has P; if not, L(M′) = ∅, which does not. The map just writes a program, so it is computable (even in log space).</p>
<p>So questions like “does this program accept the empty string?”, “does it accept anything?” or “is its language regular?” are all undecidable.</p>
${APP(`<ul>
  <li>Machines are strings: <b>Write description</b> in a tape’s Tools tab puts ⟨M⟩ on a tape, and <b>simulate</b> runs a description (see <a data-man="data">Machines as data</a>).</li>
  <li>${W('halt')}: <b>H</b> is a candidate decider for K that simulates M on ⟨M⟩ and gives up after 40 steps; <b>D</b> asks H and does the opposite. Running D on ⟨D⟩ shows H being wrong, and raising H’s bound does not help. <b>Narcissus</b> prints its own description: the recursion theorem. D’s Tools tab builds the <b>diagonal table</b>.</li>
  <li>${W('rice')}: <b>RiceBuilder</b> is the reduction in the proof, as a real machine that reads ⟨M⟩ and writes ⟨M′⟩; the reduction card checks it on random small machines.</li>
</ul>`)}
${SIMPL('H and AcceptsEmpty are bounded stand-ins: they simulate for a fixed number of steps. No real decider exists, so any machine you could put there is wrong somewhere; the bounded ones are wrong on machines that halt slowly.')}` },

{ id: 'th-time', title: '5 · Time and space', group: 'Theory', html: () => `
<h2>Time, space and the hierarchy theorems</h2>
<p class="lead">Complexity theory asks not whether a problem can be solved, but with how much of a resource. The two basic resources are time (steps) and space (tape cells).</p>
<h3>Measuring</h3>
${DEF('TIME(f), SPACE(f)', 'The languages decided by some multi-tape Turing machine that, on every input of length n, halts within O(f(n)) steps, or visits O(f(n)) work-tape cells.')}
<p>For space below n to make sense, the input is on a <b>read-only</b> tape and an output (if any) on a <b>write-only</b> tape; only work tapes count. Then L = SPACE(log n) is meaningful: a few counters and pointers into the input.</p>
<ul>
  <li><b>P</b> = ⋃ₖ TIME(nᵏ), <b>PSPACE</b> = ⋃ₖ SPACE(nᵏ), <b>EXP</b> = ⋃ₖ TIME(2<sup>nᵏ</sup>).</li>
  <li>Polynomial time is robust: one-tape versus multi-tape, or a RAM, changes the exponent but not membership in P.</li>
</ul>
<h3>Space bounds time</h3>
<p>A machine using s(n) ≥ log n cells has at most 2<sup>O(s(n))</sup> <b>configurations</b> (state, head positions, work-tape contents). A halting run never repeats one, or it would loop forever. So SPACE(s) ⊆ TIME(2<sup>O(s)</sup>), and in particular L ⊆ P and PSPACE ⊆ EXP. It also means a space-bounded machine can detect its own loops by counting steps up to the number of configurations.</p>
<p>The known chain is L ⊆ NL ⊆ P ⊆ NP ⊆ PSPACE ⊆ EXP. Which of these inclusions are strict is mostly open, but the hierarchy theorems prove that some must be: L ≠ PSPACE and P ≠ EXP.</p>
<h3>The hierarchy theorems</h3>
${THM('Time hierarchy theorem', 'If g is time-constructible and f(n) log f(n) = o(g(n)), then TIME(f) ⊊ TIME(g).')}
${THM('Space hierarchy theorem', 'If g is space-constructible and f = o(g), then SPACE(f) ⊊ SPACE(g).')}
<p><i>Proof idea (time).</i> Diagonalize, but with a clock. D, on input ⟨M⟩, simulates M on ⟨M⟩ for at most g(n) of D’s own steps and does the opposite of what M does if M finishes, rejecting otherwise. D runs in time O(g), so its language is in TIME(g). If some machine M decided it within time f, then for long enough descriptions of M the simulation (with its overhead) fits in g, so D does the opposite of M on ⟨M⟩: a contradiction.</p>
<p>Where the gap comes from: the simulation is not free. A universal machine pays for looking up rules in ⟨M⟩, for moving M’s tapes around, and for keeping and checking a step counter. On multi-tape machines the overhead is a log factor (Hennie–Stearns), which is why time needs f log f = o(g). Space simulation costs only a constant factor, so space needs only f = o(g). D must also be able to compute the bound g(n) itself within the budget; that is what <b>constructible</b> means.</p>
${DEF('Constructible functions', 'f is <b>time-constructible</b> if some machine, on every input of length n, halts after exactly f(n) steps (equivalently, up to constants: writes f(n) in binary within O(f(n)) steps). f is <b>space-constructible</b> if some machine marks off exactly f(n) cells while using O(f(n)) space.')}
<p>A time-constructible machine is a <b>clock</b>: run it alongside a simulation and stop when it rings. A space-constructible one is a <b>ruler</b>: mark f(n) cells first, and stop any simulation that steps outside them. All the usual bounds are constructible (n, n log n, n², 2ⁿ for time; log n, n, n² for space). Time-constructible functions grow at least like n, because a machine that halts in fewer than n steps never sees the end of its input; space-constructible ones grow at least like log n, the space of a counter up to n. Without constructibility the hierarchy theorems can fail: Borodin’s gap theorem gives a computable g with TIME(g) = TIME(2<sup>g</sup>).</p>
${APP(`<ul>
  <li>Every machine has a <b>T</b> and an <b>S</b> meter. Time is the number of steps, including the steps of machines it calls (see <a data-man="calls">Calls and oracles</a>). Space is the number of distinct cells visited on writable work tapes; read-only inputs and write-only outputs are free, as in the definition. The Budgets tab sets time ≤ f(n) and space ≤ f(n); a run that exceeds one is stopped and rejected.</li>
  <li>The <b>Scaling lab</b> (Tools tab) runs a machine on many inputs of each length and plots its worst-case time or space against n, e.g. ${W('pal')}’s n² against ${W('rev')}’s linear bound.</li>
  <li>${W('construct')}: a clock for n² + n + 1 whose T meter fills exactly as it halts, and a ruler for log n that marks its cells by counting the input in binary but needs linear time to do it.</li>
  <li>${W('hier')}: <b>DTime</b> and <b>DSpace</b> are the diagonalizers of both proofs, using <b>simulate … within time (…) space (…)</b>. A simulation that runs out returns timeout or spaceout.</li>
  <li><b>Simulation cost</b> (Budgets tab of a machine that uses simulate) chooses how the overhead is charged: free (one step per simulated step), a multi-tape universal machine (|⟨M⟩| + log t per step) or a single-tape one (|⟨M⟩| + cells in use per step). Further options charge for computing and checking the bounds, and for detecting loops by counting configurations. With the charges on, DTime breaks its own budget, which is exactly the gap the theorem needs. Nested simulations compound: each level pays its overhead on the level below.</li>
</ul>`)}` },

{ id: 'th-np', title: '6 · NP', group: 'Theory', html: () => `
<h2>Nondeterminism and NP</h2>
<p class="lead">NP is the class of problems whose solutions are easy to check. Whether they are also easy to find, P versus NP, is the central open question of the field.</p>
<h3>Two equivalent definitions</h3>
${DEF('NP, by verifiers', 'L ∈ NP if there is a polynomial-time machine V and a polynomial p such that w ∈ L exactly when some certificate c with |c| ≤ p(|w|) makes V(w, c) accept.')}
${DEF('NP, by nondeterminism', 'L ∈ NP if a nondeterministic machine decides it in polynomial time: at each step it may choose among several transitions, and it accepts if some sequence of choices leads to acceptance.')}
<p>The two agree: a nondeterministic machine can guess the certificate bit by bit and then verify; a verifier’s certificate is the record of the choices along an accepting path. The <b>computation tree</b> has one branch per choice sequence; the machine accepts if some leaf accepts.</p>
<p>Example: SUBSET-SUM. Given numbers and a target, is there a subset summing to it? The certificate is the subset; checking it is one addition per number. Finding one by trying all subsets takes 2ⁿ tries, and nobody knows a polynomial algorithm.</p>
<h3>Reductions and completeness</h3>
${DEF('Polynomial-time reduction', 'A ≤ₚ B if a polynomial-time f has w ∈ A ⇔ f(w) ∈ B. Reductions compose: A ≤ₚ B and B ≤ₚ C give A ≤ₚ C.')}
${DEF('NP-complete', 'B is NP-hard if every L ∈ NP reduces to B, and NP-complete if it is also in NP. If any NP-complete problem is in P, then P = NP.')}
${THM('Cook–Levin theorem', 'SAT, satisfiability of Boolean formulas, is NP-complete.')}
<p><i>Idea.</i> An accepting computation of a polynomial-time verifier is a polynomial-size table of configurations. A formula can say, with one clause group per cell and step, “this table starts with w, follows the transition rules, and ends accepting”; it is satisfiable exactly when a certificate exists.</p>
<p>From SAT, hardness spreads by reductions: 3-SAT, CLIQUE, INDEPENDENT SET, VERTEX COVER, SUBSET-SUM and thousands more. For instance, G has an independent set of size k exactly when its complement graph has a clique of size k, so flipping every edge reduces one to the other.</p>
<h3>coNP</h3>
<p>coNP is the set of complements of NP languages: problems where a “no” answer has a short certificate, or equivalently where <i>every</i> branch must accept. Unsatisfiability and tautology are coNP-complete. Whether NP = coNP is open; it would follow from P = NP.</p>
${APP(`<ul>
  <li>${W('np')}: the verifier view. The certificate is a tape of kind certificate. <b>Find witness</b> (tape window, Tools tab) plays an unbounded prover: it tries every string over the tape’s alphabet, shortest first, until the verifier accepts. That exhaustive search is exactly what we do not know how to avoid.</li>
  <li>${W('npguess')}: the nondeterministic view. <b>choose</b> (or rules that overlap, in a table) forks the whole world, tapes included. The computation tree window explores the branches depth-first or breadth-first, and can skip branches that can no longer change the answer: once one branch accepts, an ∃ node is decided.</li>
  <li>${W('reduce')}: reduction cards state A ≤ B through a transducer. <b>Check</b> runs both deciders and the transducer on many inputs and tests A(w) = B(f(w)), and measures the transducer against its budget. Chaining two cards composes the reductions: IndSet ≤ Clique ≤ SAT.</li>
</ul>`)}
${SIMPL('the tree is explored up to 25,000 nodes; beyond that it stays undecided. Real nondeterministic machines are polynomial-time by definition, so small inputs are what you can watch.')}` },

{ id: 'th-ph', title: '7 · Oracles and PH', group: 'Theory', html: () => `
<h2>Oracles, alternation and the polynomial hierarchy</h2>
<p class="lead">Give a machine free answers to another problem, or let its choices alternate between “some” and “all”, and you climb a hierarchy of classes between NP and PSPACE.</p>
<h3>Oracle machines</h3>
${DEF('Oracle machine', 'A machine M with a query tape and an oracle A. It writes a string q, enters a query state, and in one step learns whether q ∈ A. P<sup>A</sup> is polynomial time with oracle A; for a class C, P<sup>C</sup> means P<sup>A</sup> for some A ∈ C.')}
<p>Oracles ask “what if this problem were free?”. For example, NP<sup>NP</sup> is the class of problems solvable by an NP machine that can ask an NP oracle questions at unit cost.</p>
<p>The Baker–Gill–Solovay theorem gives oracles A and B with P<sup>A</sup> = NP<sup>A</sup> and P<sup>B</sup> ≠ NP<sup>B</sup>. So any proof technique that works the same relative to every oracle, such as plain diagonalization and simulation, cannot settle P versus NP.</p>
<h3>Quantifiers and the hierarchy</h3>
${DEF('Σₖ and Πₖ', 'L ∈ Σₖᴾ if w ∈ L ⇔ ∃y₁ ∀y₂ ∃y₃ … Qyₖ R(w, y₁, …, yₖ), with polynomially long yᵢ and a polynomial-time R. Πₖᴾ starts with ∀. Σ₁ = NP, Π₁ = coNP. The polynomial hierarchy PH is the union of all levels.')}
<p>Equivalently, Σₖ₊₁ = NP<sup>Σₖ</sup>: one more ∃ block is one more level of NP oracle. For example, Σ₂ asks “is there an x such that for all y, Φ(x, y)?”, which an NP machine can answer by guessing x and asking an NP oracle “is there a y with ¬Φ(x, y)?”.</p>
<h3>Alternating machines</h3>
${DEF('Alternating Turing machine', 'Each state is existential (∃) or universal (∀). In the computation tree, an ∃ node accepts if some child accepts, a ∀ node if all children accept.')}
<p>Polynomial-time alternating machines with at most k alternation blocks, starting with ∃, decide exactly Σₖ. With no bound on alternations:</p>
${THM('Theorem (Chandra–Kozen–Stockmeyer)', 'AP = PSPACE: alternating polynomial time equals deterministic polynomial space.')}
<p>A two-player game is the natural example: “can the first player force a win?” is ∃ my move ∀ your move ∃ my move …. Many games of polynomial length, and TQBF (true quantified Boolean formulas), are PSPACE-complete.</p>
${APP(`<ul>
  <li>Calls are oracle queries through shared tapes. By default a caller pays for every step of the machine it calls; ticking <b>Oracle</b> in the callee’s Wiring tab charges each call 1 step instead. ${W('oracle')}: a program and an oracle Turing machine (query state, yes/no states, a socket for the oracle).</li>
  <li>${W('ph')}: the same Σ₂ language twice. <b>SigmaTwo</b> is an alternating machine with two quantifier blocks; <b>SigmaTwoOracle</b> is an NP machine asking an NP oracle. A nondeterministic oracle’s tree is resolved on the side and only its answer comes back. Compare languages shows they agree.</li>
  <li>Every nondeterministic machine’s Class &amp; budgets tab sets the quantifier kind of plain choices, a limit on the number of blocks, and the first block. A branch that alternates more than allowed is rejected. The card shows the resulting class (NP, coNP, Σ₂, …, AP).</li>
  <li>${W('game')}: TakeAway, a game whose number of rounds grows with n, so no Σₖ bound holds: AP = PSPACE. In the tree window ∃ nodes need one winning child, ∀ nodes need all, and skipped branches are the ones that could not change the answer (game-tree pruning).</li>
</ul>`)}` },

{ id: 'th-count', title: '8 · Counting and randomness', group: 'Theory', html: () => `
<h2>Counting and randomness</h2>
<p class="lead">NP asks whether some branch accepts. Asking how many branches accept, or what fraction, gives #P, PP, ⊕P and BPP. Randomness turns out to be the same idea seen differently: random coins pick one branch.</p>
<h3>Counting classes</h3>
${DEF('#P', 'The functions f(w) = the number of accepting paths of a nondeterministic polynomial-time machine on w. #SAT (how many satisfying assignments?) is #P-complete, and so is computing the permanent of a 0/1 matrix (Valiant), even though deciding whether a perfect matching exists is easy.')}
${DEF('PP', 'w ∈ L if more than half of the paths accept. PP contains NP and is closed under complement; MAJ-SAT is complete.')}
${DEF('⊕P', 'w ∈ L if the number of accepting paths is odd.')}
<p>These classes are powerful: Toda’s theorem says PH ⊆ P<sup>#P</sup>, so one counting oracle is worth the whole polynomial hierarchy.</p>
<h3>Randomized algorithms</h3>
${DEF('BPP', 'L ∈ BPP if a polynomial-time machine with access to random coins answers correctly with probability at least 2/3 on every input.')}
<p>Think of the coin sequence as choosing one branch of a computation tree: BPP says at least 2/3 of the branches give the right answer, either way. RP allows error only on “no” instances (one-sided), and ZPP never errs but has random running time.</p>
<p><b>Amplification.</b> 2/3 is arbitrary. Run the algorithm k times with fresh coins and take the majority: by the Chernoff bound the error falls exponentially in k. For example, a test that is right with probability 3/4, repeated 5 times with a majority vote, is wrong only when at least 3 runs are wrong: probability 106/1024, about 10%.</p>
<p>Known: P ⊆ BPP ⊆ PP, and BPP ⊆ Σ₂ ∩ Π₂ (Sipser–Gács–Lautemann). Most researchers believe BPP = P, because good pseudorandom generators would follow from plausible circuit lower bounds.</p>
${APP(`<ul>
  <li>${W('count')}: five machines that pick a position of the input, differing in how the computation tree decides: ∃ (NP), count (#P, with a threshold), probability above 1/2 (PP), a 2/3 margin either way (BPP, with “no clear answer” in between) and odd count (⊕P). The setting is in each machine’s Class &amp; budgets tab.</li>
  <li>#P and ⊕P count accepting paths, however long they are. PP and BPP use probabilities exactly as defined above: every choice is a fair coin (or die) over its options, so a path below choices with k₁, k₂, … options has probability 1/(k₁·k₂·…), and the tree window shows the probability of each path you view. That is why the PP and BPP machines in the counting world pick their position with one coin per bit of n, the textbook way of making every position equally likely, with one extra coin for indices past the end.</li>
  <li>Randomness is a tape of kind random coins. Its cells are fair coin flips, drawn the first time a head reads them; heads on it are read-only and one-way, and keep their position between calls, so every call sees fresh coins. <b>Re-roll coins</b> changes the seed.</li>
  <li>${W('bpp')}: <b>NoisyFirstBit</b> is right 3/4 of the time; <b>Majority5</b> amplifies it. <b>Run trials</b> (Tools tab) estimates each machine’s acceptance rate over many seeds; <b>Exact acceptance probability</b> runs every coin sequence and reports the true probability.</li>
</ul>`)}
` },

{ id: 'th-ip', title: '9 · Interaction and PCP', group: 'Theory', html: () => `
<h2>Interactive proofs and probabilistically checkable proofs</h2>
<p class="lead">An NP proof is a string the verifier reads in full. Allowing interaction and randomness changes what can be proved, and how little of a proof needs to be read.</p>
<h3>Interactive proofs</h3>
${DEF('IP', 'A randomized polynomial-time verifier exchanges messages with an all-powerful prover. L ∈ IP if for w ∈ L some prover makes the verifier accept with probability ≥ 2/3 (completeness), and for w ∉ L every prover makes it accept with probability ≤ 1/3 (soundness).')}
<p><b>Graph non-isomorphism</b> is the classic example. Nobody knows short NP certificates for “G₀ and G₁ are not isomorphic”, but there is a protocol: the verifier secretly picks b ∈ {0, 1}, sends a randomly relabelled copy of G_b, and asks which graph it came from. If the graphs differ, the prover can always tell. If they are isomorphic, the copy carries no information about b, so any prover is right with probability 1/2. Repeating k times drives the cheating probability to 2⁻ᵏ.</p>
${THM('Theorem (Shamir)', 'IP = PSPACE.')}
<h3>Private versus public coins</h3>
<p>The protocol above depends on the coins being <b>private</b>: a prover who could see b would just repeat it. In <b>Arthur–Merlin</b> protocols (AM) the verifier’s coins are public. Surprisingly, public coins cost little: Goldwasser and Sipser showed any private-coin protocol can be simulated with public coins and two extra rounds, so graph non-isomorphism is in AM too, by a different protocol.</p>
<h3>Probabilistically checkable proofs</h3>
${DEF('PCP(r, q)', 'Languages with a polynomial-time verifier that, given w and random access to a proof π, tosses r(n) coins, reads q(n) positions of π, and: if w ∈ L, some π is always accepted; if w ∉ L, every π is rejected with probability ≥ 1/2.')}
${THM('PCP theorem (Arora–Safra; Arora–Lund–Motwani–Sudan–Szegedy)', 'NP = PCP(log n, 1): every NP statement has a proof that can be checked by reading a constant number of its bits.')}
<p>Why a naive proof fails: for 3-SAT, take the proof to be an assignment and check one random clause. If the formula is unsatisfiable, an assignment can still satisfy all clauses but one, so a single check catches it with probability only 1/m. The PCP theorem needs the proof to be encoded so that any error spreads out and becomes visible everywhere. The resulting “gap” is also why many problems are NP-hard even to approximate.</p>
<p>A key ingredient is the <b>linearity test</b> (Blum–Luby–Rubinfeld): to check that a table f is a linear function over GF(2), pick random x and y and check f(x) ⊕ f(y) = f(x ⊕ y). Three queries. If f is far from every linear function, the test fails with constant probability. Linear functions are the codewords of the Hadamard code used in the simplest PCP construction.</p>
${APP(`<ul>
  <li>${W('ip')}: the graph non-isomorphism protocol with 3 rounds. Machines with the <b>prover</b> role are unbounded: callers are not charged for their steps, and their budgets are ignored. A random tape is private by default, and a prover that tries to read it gets an error; ticking <b>Public coins</b> makes it Arthur–Merlin, and the PeekingProver then cheats perfectly.</li>
  <li>Proofs are a tape kind: fixed before the verifier runs, readable but not writable by verifiers. <b>seek</b> jumps a head to any cell (random access), and every distinct cell read counts as one query; queried cells are outlined.</li>
  <li>Budgets for random bits r(n) and proof queries q(n) appear once a machine is wired to a random tape and a proof tape; with both set, the card shows PCP(r, q).</li>
  <li>${W('pcp')}: <b>SpotCheck</b> is the naive 3-SAT verifier, and <b>Best proof</b> shows an unsatisfiable formula with an assignment passing 7 of 8 checks. <b>Linearity</b> is the BLR test; Best proof finds exactly the 8 linear functions on 3 bits. <b>Exact acceptance probability</b> runs every coin sequence and shows how often each proof cell is queried.</li>
</ul>`)}` },

{ id: 'th-circ', title: '10 · Circuits and advice', group: 'Theory', html: () => `
<h2>Circuits and advice</h2>
<p class="lead">A circuit is hardware for one input length. Studying circuit size and depth gives the non-uniform view of complexity, and depth measures parallel time.</p>
<h3>Circuits</h3>
${DEF('Boolean circuit', 'A directed acyclic graph of gates (AND, OR, NOT, XOR, …) over input bits x₀ … xₙ₋₁, with one output gate. Its size is the number of gates, its depth the longest path from an input to the output, its fan-in the most inputs any gate has.')}
<p>A circuit only handles one input length, so a language needs a <b>family</b> C₀, C₁, C₂, …, one circuit per length. Every function on n bits has a circuit of size O(2ⁿ/n), and Shannon’s counting argument shows most functions need about that many: there are far more functions than small circuits.</p>
<h3>Non-uniformity and advice</h3>
${DEF('P/poly', 'Languages decided by a family of polynomial-size circuits, with no requirement that the circuits can be computed. Equivalently, polynomial time with polynomial-length advice: a string a(n) that depends only on the input length.')}
<p>P ⊆ P/poly, because a polynomial-time machine can be unrolled into a circuit for each length. But P/poly is strictly bigger: every unary language, even an undecidable one, is in it, since one advice bit per length can just say whether 1ⁿ is in the language. Advice is given, not computed. Showing that NP has no polynomial-size circuits would prove P ≠ NP; the Karp–Lipton theorem says that if it did, the polynomial hierarchy would collapse to Σ₂.</p>
<h3>Uniformity and parallel time</h3>
<p>A family is <b>uniform</b> if a machine can build Cₙ from n (in log space, say). Uniform polynomial-size families are exactly P again. Depth is parallel time: with one processor per gate, a circuit evaluates one layer per step.</p>
<ul>
  <li><b>NCᵏ</b>: polynomial size, depth O(logᵏ n), fan-in 2. NC¹ ⊆ L ⊆ NC².</li>
  <li><b>AC⁰</b>: polynomial size, constant depth, unbounded fan-in. PARITY is not in AC⁰ (Furst–Saxe–Sipser, Håstad): one of the few unconditional lower bounds we have.</li>
</ul>
<p>PARITY is in NC¹ though: a balanced tree of XOR gates has depth log n, while a chain of XORs has depth n − 1.</p>
${APP(`<ul>
  <li>Circuits are a machine kind. Their inputs are tape cells, their output is written to a tape, and they evaluate one layer per step, so the step count is the depth. The Budgets tab limits size, depth and fan-in, with presets for NC¹, AC⁰ and P/poly; a circuit over budget is rejected before it runs. ${W('circuit')} has two fixed circuits.</li>
  <li>${W('family')}: a uniform family. A generator writes circuit n onto a tape (in postfix), and a circuit machine reads its gates from that tape. The chain-shaped generator breaks the NC¹ depth budget; plugging in the balanced one fixes it. The Scaling lab plots depth against n, and the truth table checks the circuit against a DFA for parity.</li>
  <li>${W('advice')}: advice is a tape kind, filled when a run starts with a(n), from a table or a function in the tape window, where n is the run target’s input length. Machines can read it but not compute it. <b>ParityByAdvice</b> reads its whole circuit from advice: P/poly as circuits, literally.</li>
</ul>`)}` },

{ id: 'th-comm', title: '11 · Communication', group: 'Theory', html: () => `
<h2>Communication complexity</h2>
<p class="lead">Split the input between two players and count only the bits they exchange. Computation is free; communication is the resource. It is one of the few settings where strong lower bounds are provable.</p>
<h3>The model (Yao)</h3>
${DEF('Deterministic communication complexity D(f)', 'Alice holds x, Bob holds y, both n bits. They alternate sending bits according to a protocol and must both learn f(x, y). D(f) is the number of bits exchanged by the best protocol on the worst inputs.')}
<p>A trivial protocol always works: Alice sends all of x (n bits) and Bob replies with the answer (1 bit), so D(f) ≤ n + 1.</p>
<h3>Lower bounds: equality</h3>
${THM('Theorem', 'For equality, EQ(x, y) = [x = y], D(EQ) = n + 1.')}
<p><i>Idea.</i> A protocol’s transcript partitions the input pairs into combinatorial rectangles A × B on which the answer is constant. The 2ⁿ pairs (x, x) form a <b>fooling set</b>: no rectangle with answer 1 can contain two of them, since it would also contain (x, x′) with x ≠ x′. So there are at least 2ⁿ rectangles with answer 1, plus at least one with answer 0, and therefore at least n + 1 transcript bits.</p>
<h3>Randomness helps enormously</h3>
<p>With shared (public) random strings r₁, …, rₖ, Alice sends the parities ⟨x, rᵢ⟩ mod 2 and Bob compares them with ⟨y, rᵢ⟩. If x = y they always match; if x ≠ y each one differs with probability 1/2. So k + 1 bits give error 2⁻ᵏ, independent of n. With private coins, Newman’s theorem shows O(log n) bits suffice.</p>
<p>Some functions stay hard even with randomness: disjointness (do the sets x and y intersect?) needs Ω(n) bits. Such lower bounds feed into results on streaming algorithms, data structures and circuits.</p>
${APP(`<ul>
  <li>Private inputs are a matter of wiring: Alice is not wired to Bob’s tape. They talk through a <b>channel</b> tape, which is append-only; <b>send</b> adds one symbol tinted with the sender’s colour, and the tape’s label counts how many each player sent. That count is the communication cost, and the steps they take do not matter.</li>
  <li>${W('comm')}: <b>Alice</b> and <b>Bob</b> run the trivial n + 1 protocol; <b>AliceR</b> and <b>BobR</b> run the random-parity protocol with 6 rounds over a public coin tape: 7 bits for every n, error 1/64 when x ≠ y. The Scaling lab measures communication against n (a line against a constant), and Run trials shows the error.</li>
</ul>`)}` }
);

// links to worlds from the theory chapters: close the manual and load the world
document.addEventListener('click', e => {
  const a = e.target.closest('[data-world]'); if (!a) return;
  e.preventDefault(); const ex = EXAMPLES.find(x => x.key === a.dataset.world); if (!ex) return;
  closeManual(); setWorld(openExample(ex));
});
