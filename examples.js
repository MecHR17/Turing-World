// ===== Example worlds =====
const EXAMPLES = [
{
  key: 'dfa', title: 'Even number of 1s', tag: 'REG',
  guide: 'The same language three ways: a hand-drawn DFA, and a program in the <b>dfa</b> dialect. Both read the shared tape <b>input</b>. Select <b>EvenOnesProg</b> and press <b>Compile to DFA</b> to turn the program into a state graph. Change the run target to compare them.',
  target: 'EvenOnes',
  tapes: [{ name: 'input', init: '1101', alphabet: '01' }],
  machines: [
    { kind: 'dfa', name: 'EvenOnes', bind: { in: 'input' }, src:
`# hand-built DFA: accepts strings with an even number of 1s
alphabet: 0 1
start: even
accept: even
even, 0 -> even
even, 1 -> odd
odd, 0 -> odd
odd, 1 -> even` },
    { kind: 'prog', bind: { in: 'input' }, src:
`machine EvenOnesProg dfa {
  tape in : {0,1}
  reg parity : {even, odd} = even

  while read(in) != _ {
    if read(in) == 1 {
      if parity == even { parity = odd } else { parity = even }
    }
    move in R
  }
  accept if parity == even
}` },
  ],
},
{
  key: 'nfa', title: 'Third symbol from the end', tag: 'REG',
  guide: 'An NFA that guesses where the third-from-last symbol is. Every active state lights up at once. Press <b>Determinize</b> to run the subset construction and get the equivalent minimal DFA (8 states).',
  target: 'ThirdFromLast',
  tapes: [{ name: 'input', init: '0110100', alphabet: '01' }],
  machines: [
    { kind: 'nfa', name: 'ThirdFromLast', bind: { in: 'input' }, src:
`# accepts strings whose third symbol from the end is 1
alphabet: 0 1
start: s
accept: c
s, 0 1 -> s
s, 1 -> a
a, 0 1 -> b
b, 0 1 -> c` },
  ],
},
{
  key: 'pda', title: 'Pushdown automata: context-free languages', tag: 'CFL',
  guide: 'A <b>pushdown automaton</b> is a finite automaton with a stack, here a tape of kind <b>stack</b>: cell 0 is the bottom, the head sits on the top symbol, and only push and pop are allowed. Rules read <i>state, input, pop → state, push</i>. <b>AnBn</b> decides { aⁿbⁿ } deterministically: a DFA cannot, because it would have to count. <b>EvenPal</b> decides even palindromes { w wᴿ }. Its rules overlap (it must guess where the middle is), so the run branches: open the tree, and note that no deterministic PDA can do this. Programs can use stack tapes too, with <b>push</b> and <b>pop</b>. <b>AnBnCn</b> needs <b>two</b> stacks for { aⁿbⁿcⁿ }, which is not context-free. Two stacks can simulate a Turing machine’s tape, so one stack sits strictly between regular and decidable, and two stacks are already everything.',
  target: 'EvenPal',
  tapes: [{ name: 'input', init: 'abba', alphabet: 'ab' }, { name: 'stack', kind: 'stack', init: '', alphabet: 'AZ' }, { name: 'stack2', kind: 'stack', init: '', alphabet: 'abZ' }, { name: 'abc', init: 'aabbcc', alphabet: 'abc' }, { name: 's1', kind: 'stack', init: '', alphabet: 'a' }, { name: 's2', kind: 'stack', init: '', alphabet: 'b' }],
  machines: [
    { kind: 'pda', name: 'AnBn', bind: { in: 'input', stack: 'stack' }, src:
`alphabet: a b
start: q0
accept: q0 q3
# state, input, pop -> state, push   (push lists symbols top first)
q0, a, eps -> q1, AZ    # first a: Z marks the bottom, one A on top
q1, a, A -> q1, AA      # one more A per a
q1, b, A -> q2, eps     # the b's pop them
q2, b, A -> q2, eps
q2, eps, Z -> q3, eps   # bottom reached: as many b's as a's` },
    { kind: 'pda', name: 'EvenPal', bind: { in: 'input', stack: 'stack2' }, src:
`alphabet: a b
start: s
accept: f
s, eps, eps -> p, Z     # bottom marker
p, a, eps -> p, a       # push the first half
p, b, eps -> p, b
p, eps, eps -> m, eps   # guess: this is the middle
m, a, a -> m, eps       # pop it against the second half
m, b, b -> m, eps
m, eps, Z -> f, eps` },
    { kind: 'prog', bind: { in: 'abc', s1: 's1', s2: 's2' }, src:
`machine AnBnCn {
  tape in readonly oneway
  tape s1                // two stack tapes
  tape s2
  while read(in) == a { push s1 a  move in R }
  while read(in) == b {
    if read(s1) == _ { reject }
    pop s1  push s2 b     // move the count to the second stack
    move in R
  }
  if read(s1) != _ { reject }
  while read(in) == c {
    if read(s2) == _ { reject }
    pop s2  move in R
  }
  accept if read(in) == _ && read(s2) == _
}` },
  ],
},
{
  key: 'lang', title: 'Regular expressions and grammars', tag: 'RE CFG',
  guide: 'Three ways to write a language. <b>EndsAbb</b> is a regular expression, run as its Thompson NFA (open its State graph tab). <b>EvenAs</b> is a right-linear grammar, so it is regular too: it runs as an NFA with one state per nonterminal and no stack. <b>Arith</b> is a context-free grammar for expressions over a. It runs as the standard PDA on the tape <b>stack</b>: each branch of its computation tree applies one rule to the leftmost nonterminal, so an accepting branch is a leftmost derivation. Make Arith the target to watch it parse <b>a+a*a</b>. The Tools tab of each machine closes Kleene’s loop: expression → NFA → DFA → expression, automaton ↔ right-linear grammar. A context-free grammar converts to a PDA, lists its strings, and decides a string with the <b>CYK</b> table in O(n³) time.',
  target: 'EndsAbb',
  tapes: [{ name: 'word', init: 'babb', alphabet: 'ab' }, { name: 'expr', init: 'a+a*a', alphabet: 'a+*()' }, { name: 'stack', kind: 'stack', init: '' }],
  machines: [
    { kind: 'regex', bind: { in: 'word' }, src:
`regex EndsAbb
// strings over a, b that end in abb
(a|b)*abb` },
    { kind: 'cfg', bind: { in: 'word' }, src:
`grammar EvenAs
// right-linear (one nonterminal, at the end), so the language is regular
S -> aT | bS | eps      // S: an even number of a's so far
T -> aS | bT            // T: an odd number` },
    { kind: 'cfg', bind: { in: 'expr', stack: 'stack' }, src:
`grammar Arith
// expressions with + and *, where * binds tighter
E -> E+T | T
T -> T*F | F
F -> (E) | a` },
  ],
},
{
  key: 'inc', title: 'Binary increment', tag: 'FP',
  guide: 'A one-tape Turing machine that reads a binary number and writes n+1 <b>in the same place</b>. Try input 1011 or 111. The tape extends to the left when the carry runs off the front.',
  target: 'Increment',
  tapes: [{ name: 'tape', init: '1011', alphabet: '01' }],
  machines: [
    { kind: 'tm', name: 'Increment', bind: { t: 'tape' }, budgetTime: '2*n + 3', src:
`tapes: t
start: right
accept: done
# walk to the end of the number
right, 0 -> right, 0, R
right, 1 -> right, 1, R
right, _ -> carry, _, L
# add one, propagating the carry
carry, 1 -> carry, 0, L
carry, 0 -> done, 1, S
carry, _ -> done, 1, S` },
  ],
},
{
  key: 'pal', title: 'Palindromes in n² time', tag: 'P',
  guide: 'A classic one-tape palindrome decider. It erases matching ends and shuttles back and forth, so it needs about n²/2 steps. The world enforces the declared budget <b>n^2 + 2*n + 5</b>. Open <b>Scaling lab</b> to plot steps against n. <b>EndsMatch</b> is a tempting shortcut that only compares the first and last symbols: in IsPal\'s Tools tab, <b>Compare languages</b> with EndsMatch finds the shortest string where they disagree.',
  target: 'IsPal',
  tapes: [{ name: 'tape', init: 'abbaba', alphabet: 'ab' }],
  machines: [
    { kind: 'tm', name: 'IsPal', bind: { t: 'tape' }, budgetTime: 'n^2 + 2*n + 5', src: null },
    { kind: 'prog', bind: { t: 'tape' }, src:
`machine EndsMatch {
  tape t readonly
  reg first : {a, b, _} = _
  reg last : {a, b, _} = _

  // a tempting shortcut: only compare the two ends
  first = read(t)
  while read(t) != _ { last = read(t)  move t R }
  accept if first == last
}` },
  ],
},
{
  key: 'rev', title: 'Reverse onto an output tape', tag: 'FL',
  guide: 'A transducer with a read-only input tape and a separate output tape. Space is only charged for writable tapes, so the budget is <b>n + 1</b> cells.',
  target: 'Reverse',
  tapes: [{ name: 'input', init: 'turing', alphabet: 'ab' }, { name: 'output', init: '' }],
  machines: [
    { kind: 'prog', bind: { in: 'input', out: 'output' }, budgetTime: '6*n + 5', budgetSpace: 'n + 1', src:
`machine Reverse {
  tape in readonly
  tape out

  // run to the end of the input
  while read(in) != _ { move in R }
  move in L
  // copy it backwards onto the output tape
  while read(in) != _ {
    write out read(in)
    move out R
    move in L
  }
  accept
}` },
  ],
},
{
  key: 'oracle', title: 'Oracle calls through a shared tape', tag: 'P^A',
  guide: '<b>BothPalindromes</b> reads <i>u#v</i>. It writes <i>u</i> onto the question tape <b>X</b>, hands control to <b>IsPal</b> (wired to X), reads the answer, then does the same for <i>v</i>. Watch the call stack. Tick <b>Act as oracle</b> on IsPal to charge each call one step instead of its full running time. <b>NotPalTM</b> is an oracle Turing machine: it copies the tape <b>word</b> onto X, then enters the query state <i>ask</i>, which runs whatever is plugged into its socket P and continues in <i>qr</i> or <i>qa</i>.',
  target: 'BothPalindromes',
  tapes: [{ name: 'input', init: 'abba#aba', alphabet: 'ab#', pos: { x: 300, y: 20 }, w: 300 }, { name: 'X', init: '', pos: { x: 300, y: 220 }, w: 300 }, { name: 'word', init: 'abab', alphabet: 'ab', pos: { x: 300, y: 580 }, w: 300 }],
  machines: [
    { kind: 'prog', bind: { in: 'input', q: 'X' }, pos: { x: 20, y: 40 }, src:
`machine BothPalindromes {
  tape in readonly oneway
  tape q

  // question 1: copy u onto the question tape
  while read(in) != # && read(in) != _ {
    write q read(in)
    move q R
    move in R
  }
  if read(in) == _ { reject }
  while !atstart(q) { move q L }
  call IsPal
  if ret == reject { reject }

  // question 2: copy v onto the question tape
  move in R
  while read(in) != _ {
    write q read(in)
    move q R
    move in R
  }
  while !atstart(q) { move q L }
  call IsPal
  accept if ret == accept
}` },
    { kind: 'tm', name: 'IsPal', bind: { t: 'X' }, pos: { x: 640, y: 200 }, src: null },
    { kind: 'tm', name: 'NotPalTM', bind: { in: 'word', x: 'X' }, links: { P: 'IsPal' }, pos: { x: 640, y: 520 }, src:
`tapes: in readonly, x
start: copy
accept: qa
reject: qr
oracle: P
# copy the input onto x (clearing what is left there), then ask the oracle
copy, a * -> copy, * a, R R
copy, b * -> copy, * b, R R
copy, _ a -> copy, * _, S R
copy, _ b -> copy, * _, S R
copy, _ _ -> ask, * *, S S
call: ask P -> qr, qa    # entering ask runs P on x: a palindrome means reject` },
  ],
},
{
  key: 'np', title: 'Subset sum with a certificate', tag: 'NP',
  guide: 'NP as a verifier plus a certificate. Input <b>11#111#1$1111</b> lists 2, 3, 1 in unary with target 4. The certificate tape picks numbers (1 = take it). <b>101</b> sums to 3, so the verifier rejects. Select the <b>certificate</b> tape and press <b>Find witness</b>: an unbounded prover tries every certificate.',
  target: 'SubsetSum',
  tapes: [{ name: 'input', init: '11#111#1$1111', alphabet: '1#$', pos: { x: 320, y: 0 } }, { name: 'certificate', init: '101', kind: 'cert', alphabet: '01', maxLen: 6, pos: { x: 320, y: 140 } }, { name: 'work', init: '', pos: { x: 320, y: 280 } }],
  machines: [
    { kind: 'prog', bind: { in: 'input', cert: 'certificate', work: 'work' }, pos: { x: 20, y: 80 }, budgetTime: '6*n^2 + 20', src:
`machine SubsetSum {
  tape in readonly
  tape cert readonly
  tape work
  reg sel : {0, 1, _} = 0

  // phase 1: add the chosen numbers, in unary, onto work
  write work '>'
  move work R
  while read(in) != $ {
    if read(in) == _ { reject }
    sel = read(cert)
    if sel == _ { reject }
    while read(in) == 1 {
      if sel == 1 { write work 1  move work R }
      move in R
    }
    if read(in) == # { move in R }
    move cert R
  }
  if read(cert) != _ { reject }   // certificate too long
  move in R

  // phase 2: compare the sum with the target
  while read(work) != '>' { move work L }
  move work R
  while read(in) == 1 && read(work) == 1 { move in R  move work R }
  accept if read(in) == _ && read(work) == _
}` },
  ],
},
{
  key: 'bpp', title: 'Amplifying a noisy machine', tag: 'BPP',
  guide: 'Randomness is a tape. <b>NoisyFirstBit</b> answers "does the input start with 1?" but flips its answer when two coins both land 1, so it is right 75% of the time. <b>Majority5</b> calls it five times and takes the majority. Coins are consumed, so every call sees fresh ones. Use <b>Run trials</b> on each machine to compare their accuracy.',
  target: 'Majority5',
  tapes: [{ name: 'input', init: '1010', alphabet: '01', pos: { x: 300, y: 20 }, w: 300 }, { name: 'coins', kind: 'random', seed: 7, pos: { x: 300, y: 220 }, w: 300 }],
  machines: [
    { kind: 'prog', bind: { in: 'input' }, pos: { x: 20, y: 20 }, src:
`machine Majority5 {
  tape in readonly
  reg runs : 0..5 = 0
  reg yes : 0..5 = 0

  while runs < 5 {
    call NoisyFirstBit
    if ret == accept { inc yes }
    inc runs
  }
  accept if yes >= 3
}` },
    { kind: 'prog', bind: { in: 'input', coins: 'coins' }, pos: { x: 640, y: 100 }, src:
`machine NoisyFirstBit {
  tape in readonly
  tape coins
  reg c1 : {0, 1} = 0
  reg ans : {yes, no} = no

  // the true answer
  if read(in) == 1 { ans = yes }
  // flip it with probability 1/4
  c1 = read(coins)
  move coins R
  if c1 == 1 && read(coins) == 1 {
    if ans == yes { ans = no } else { ans = yes }
  }
  move coins R
  accept if ans == yes
}` },
  ],
},
{
  key: 'npguess', title: 'Subset sum by guessing', tag: 'NP ∃',
  guide: 'The same NP language as the certificate world, decided by a <b>nondeterministic</b> machine instead. At each number it runs <b>exists sel</b>, which forks the whole world, one branch per value. Press Run to explore the computation tree: the machine accepts if <b>some</b> branch accepts. Click any node in the tree window to see the world as that branch left it.',
  target: 'SubsetSumGuess',
  tapes: [{ name: 'input', init: '11#111#1$1111', alphabet: '1#$' }, { name: 'work', init: '' }],
  machines: [
    { kind: 'prog', bind: { in: 'input', work: 'work' }, altMode: 'E', altBlocks: '1', altStart: 'E', src:
`machine SubsetSumGuess {
  tape in readonly
  tape work
  reg sel : {0, 1} = 0

  // phase 1: guess which numbers to take, add them on work
  write work '>'
  move work R
  while read(in) != $ {
    if read(in) == _ { reject }
    exists sel                // forks: sel = 0 and sel = 1
    while read(in) == 1 {
      if sel == 1 { write work 1  move work R }
      move in R
    }
    if read(in) == # { move in R }
  }
  move in R

  // phase 2: compare the sum with the target
  while read(work) != '>' { move work L }
  move work R
  while read(in) == 1 && read(work) == 1 { move in R  move work R }
  accept if read(in) == _ && read(work) == _
}` },
  ],
},
{
  key: 'ip', title: 'Interactive proof: graph non-isomorphism', tag: 'IP',
  guide: 'The input holds two 4-vertex graphs G0#G1 as adjacency bits. Three times, the verifier flips a private coin b, has <b>Shuffle</b> write a random relabelling of G_b to the message tape, and asks the <b>prover</b> which graph it came from. It accepts if the prover is right every time. G0 (a path) and G1 (a star) are not isomorphic, so the honest prover always wins: use <b>Run trials</b> on GNIVerifier. For soundness, set the input to <b>100101#101001</b> (two paths, isomorphic), or plug <b>LazyProver</b> into the Prover socket in the Wiring tab: acceptance drops to about 1/8. <b>Private coins matter</b>: plug <b>PeekingProver</b> into the Prover socket. It does no graph work and simply answers with the verifier’s coin. While the tape <b>coins</b> is private, a prover cannot read it, so PeekingProver can only guess (about 1/8 on isomorphic graphs). Tick <b>Public coins</b> in that tape’s window, which makes this an Arthur–Merlin protocol, and it wins every round, even on isomorphic graphs: this protocol is unsound with public coins. GNI is still in AM, by a different protocol (Goldwasser–Sipser): in general, public coins cost only two extra rounds.',
  target: 'GNIVerifier',
  tapes: [{ name: 'input', init: '100101#111000', alphabet: '01#' }, { name: 'coins', kind: 'random', seed: 3 }, { name: 'msg', init: '' }, { name: 'shuffleCoins', kind: 'random', seed: 11 }],
  machines: [
    { kind: 'prog', bind: { in: 'input', coins: 'coins', msg: 'msg' }, links: { Shuffle: 'Shuffle', Prover: 'HonestProver' }, src:
`machine GNIVerifier {
  tape in readonly
  tape coins
  tape msg
  oracle Shuffle      // the verifier's own helper
  oracle Prover       // the unbounded prover
  reg b : {0, 1} = 0
  reg round : 0..3 = 0
  reg wins : 0..3 = 0

  while round < 3 {
    b = read(coins)          // private coin
    move coins R
    write msg b              // tell Shuffle which graph to send
    call Shuffle             // msg := random relabelling of G_b
    call Prover              // the prover writes its guess in cell 0
    if read(msg) == b { inc wins }
    inc round
  }
  accept if wins == 3
}` },
    { kind: 'script', bind: { in: 'input', msg: 'msg', rnd: 'shuffleCoins' }, src:
`script Shuffle(in, msg, rnd) {
  // Part of the verifier. Reads the secret bit b from msg, then writes a
  // randomly relabelled copy of G_b over it. Polynomial time, but it is a
  // script, so the world cannot certify its cost.
  const graphs = io.get('in').split('#');
  const g = graphs[Number(io.read('msg', 0))];
  const k = Math.round((1 + Math.sqrt(1 + 8 * g.length)) / 2);
  const randInt = m => {              // uniform in 0..m-1 from fair coins
    let bits = 1; while ((1 << bits) < m) bits++;
    for (;;) { let x = 0; for (let i = 0; i < bits; i++) x = 2 * x + Number(io.coin('rnd')); if (x < m) return x; }
  };
  const perm = [...Array(k).keys()];
  for (let i = k - 1; i > 0; i--) { const j = randInt(i + 1); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  io.set('msg', relabel(g, perm, k));
  return true;

  function relabel(g, p, k) {
    const adj = {}; let e = 0;
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) if (g[e++] === '1') adj[Math.min(p[i], p[j]) + ',' + Math.max(p[i], p[j])] = 1;
    let s = '';
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) s += adj[i + ',' + j] ? '1' : '0';
    return s;
  }
}` },
    { kind: 'script', role: 'prover', bind: { in: 'input', msg: 'msg' }, src:
`script HonestProver(in, msg) {
  // Unbounded prover: tries every relabelling of G0 to see whether the
  // graph it was sent is a copy of G0. Answers 0 if so, otherwise 1.
  const g0 = io.get('in').split('#')[0];
  const h = io.get('msg');
  const k = Math.round((1 + Math.sqrt(1 + 8 * g0.length)) / 2);
  const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
  const copyOfG0 = perms([...Array(k).keys()]).some(p => relabel(g0, p, k) === h);
  io.set('msg', copyOfG0 ? '0' : '1');
  return true;

  function relabel(g, p, k) {
    const adj = {}; let e = 0;
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) if (g[e++] === '1') adj[Math.min(p[i], p[j]) + ',' + Math.max(p[i], p[j])] = 1;
    let s = '';
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) s += adj[i + ',' + j] ? '1' : '0';
    return s;
  }
}` },
    { kind: 'script', role: 'prover', bind: { msg: 'msg' }, src:
`script LazyProver(msg) {
  // A dishonest prover that does no work and always answers 0.
  io.set('msg', '0');
  return true;
}` },
    { kind: 'script', role: 'prover', bind: { coins: 'coins', msg: 'msg' }, src:
`script PeekingProver(coins, msg) {
  // A cheating prover that does no graph work: it reads the verifier's coin for
  // this round and answers with it. That only works when the coins are public.
  let b;
  try { b = io.coin('coins'); }
  catch (e) { io.log('cannot see private coins, so it guesses 0'); b = '0'; }
  io.set('msg', b);
  return true;
}` },
  ],
},
{
  key: 'comm', title: 'Communication complexity: equality', tag: 'CC',
  guide: 'Alice holds <b>x</b>, Bob holds <b>y</b>, and they want to know whether x = y. Neither is wired to the other’s tape, so their inputs are private; they talk only through a <b>channel</b> tape. <b>send</b> appends one symbol, coloured by its sender, and the channel’s label counts what each one sent: that count is the communication cost, and computation is free. <b>Alice</b> runs the trivial protocol: she sends all of x and Bob answers, n + 1 bits. For EQ, every deterministic protocol needs about n bits. <b>AliceR</b> and <b>BobR</b> share the <b>public coins</b> tape: in each of 6 rounds both compute the parity of their input against the same random string, Alice sends hers, and Bob compares. That is 7 bits for every n, and if x ≠ y each round catches it with probability 1/2, so they wrongly accept with probability 1/64. In each Alice’s Tools tab, the scaling lab measures <b>communication</b> against n: a line against a constant. Use <b>Run trials</b> on AliceR with y ≠ x to see the error. Inputs are assumed to have equal length.',
  target: 'Alice',
  tapes: [{ name: 'x', init: '1011', alphabet: '01' }, { name: 'y', init: '1001', alphabet: '01' }, { name: 'ch', kind: 'channel' }, { name: 'coins', kind: 'random', seed: 5, public: true }, { name: 'ch2', kind: 'channel' }],
  machines: [
    { kind: 'prog', bind: { x: 'x', ch: 'ch' }, links: { Bob: 'Bob' }, src:
`machine Alice {
  tape x readonly        // Alice's private input
  tape ch                // the channel
  oracle Bob             // Bob's turn to speak
  // the trivial protocol: send all of x, then Bob answers
  while read(x) != _ { send ch read(x)  move x R }
  call Bob
  accept if ret == accept
}` },
    { kind: 'prog', bind: { y: 'y', ch: 'ch' }, src:
`machine Bob {
  tape y readonly        // Bob's private input
  tape ch
  reg same : {yes, no} = yes
  while read(y) != _ {
    if read(ch) != read(y) { same = no }
    move y R  move ch R
  }
  if read(ch) != _ { same = no }   // x was longer
  if same == yes { send ch 1  accept }
  send ch 0
  reject
}` },
    { kind: 'prog', bind: { x: 'x', coins: 'coins', ch: 'ch2' }, links: { Bob: 'BobR' }, src:
`machine AliceR {
  tape x readonly
  tape coins             // public coins, shared with Bob
  tape ch
  oracle Bob
  reg p : {0, 1} = 0
  reg k : 0..6 = 0
  while k < 6 {          // 6 rounds: parity of x against a random string r
    p = 0
    while !atstart(x) { move x L }
    while read(x) != _ {
      if read(x) == 1 && read(coins) == 1 { if p == 0 { p = 1 } else { p = 0 } }
      move x R  move coins R
    }
    send ch p
    inc k
  }
  call Bob
  accept if ret == accept
}` },
    { kind: 'prog', bind: { y: 'y', coins: 'coins', ch: 'ch2' }, src:
`machine BobR {
  tape y readonly
  tape coins             // the same random strings, read in the same order
  tape ch
  reg p : {0, 1} = 0
  reg k : 0..6 = 0
  while k < 6 {
    p = 0
    while !atstart(y) { move y L }
    while read(y) != _ {
      if read(y) == 1 && read(coins) == 1 { if p == 0 { p = 1 } else { p = 0 } }
      move y R  move coins R
    }
    if read(ch) != p { send ch 0  reject }   // a parity differs: x != y
    move ch R
    inc k
  }
  send ch 1
  accept
}` },
  ],
},
{
  key: 'construct', title: 'Constructible bounds: clocks and rulers', tag: 'CONSTR',
  guide: 'The hierarchy theorems need the bound itself to be computable within the bound. A function f is <b>time-constructible</b> if some machine, on every input of length n, runs for exactly f(n) steps (or writes f(n) in binary in O(f(n)) steps): it is a <b>clock</b> for f. It is <b>space-constructible</b> if some machine marks off exactly f(n) cells using O(f(n)) space: a <b>ruler</b>. Inputs here are unary, 1ⁿ. <b>ClockN2</b> runs for exactly n² + n + 1 steps and uses no work space at all: its second head sweeps the input back and forth once per symbol under the first head. Its time budget is that very function, so the T meter fills exactly as it halts; in its Tools tab the Scaling lab shows time following the parabola for every n. <b>RulerLog</b> counts the input in binary on its work tape, so it marks ⌊log₂ n⌋ + 1 cells (plus the blank cell it turns on): log n is space-constructible. But its time grows linearly (about 5n steps), never like log n: a machine running fewer than n steps never reaches the end of its input, so its behaviour cannot depend on n beyond a fixed length. That is why time-constructible functions grow at least like n, and space-constructible ones at least like log n (fewer cells cannot even hold a counter up to n). The usual functions (n, n log n, n², 2ⁿ) are all constructible; strange ones that jump around are not, and for those the hierarchy theorems can fail (Borodin’s gap theorem). In the hierarchy world, ticking the time-bound charge in DTime’s Budgets tab makes it pay for running such a clock.',
  target: 'ClockN2',
  tapes: [{ name: 'input', init: '11111', alphabet: '1' }, { name: 'ruler', init: '', alphabet: '01' }],
  machines: [
    { kind: 'tm', name: 'ClockN2', bind: { a: 'input', b: 'input' }, budgetTime: 'n^2 + n + 1', src: `tapes: a readonly, b readonly
start: r
accept: done
# a clock for n² + n + 1, on input 1ⁿ: a moves one cell per pass,
# b sweeps the whole input on every pass, right then left
r, 1 1 -> r, * *, S R
r, 1 _ -> l, * *, R L
l, 1 1 -> l, * *, S L
l, 1 _ -> r, * *, R R
# a has run off the end: n passes done
r, _ 1 -> done, * *, S S
r, _ _ -> done, * *, S S
l, _ 1 -> done, * *, S S
l, _ _ -> done, * *, S S` },
    { kind: 'tm', name: 'RulerLog', bind: { in: 'input', c: 'ruler' }, budgetSpace: 'log(n) + 2', src: `tapes: in readonly, c
start: scan
accept: done
# a ruler for log n: count the input in binary on c,
# least significant bit first, then stop
scan, 1 * -> inc, * *, R S
scan, _ * -> done, * *, S S
# add one: turn trailing 1s into 0s, then the first 0 or blank into 1
inc, * 1 -> inc, * 0, S R
inc, * 0 -> back, * 1, S L
inc, * _ -> back, * 1, S L
# walk back to the counter's first cell
back, * 0 -> back, * *, S L
back, * 1 -> back, * *, S L
back, * _ -> scan, * *, S R` },
  ],
},
{
  key: 'hier', title: 'Hierarchy theorems: more time, more space', tag: 'HIER',
  guide: 'Diagonalization with a <b>bounded</b> universal machine separates complexity classes. <b>DTime</b> runs M on its own description ⟨M⟩ for at most 4n² steps (n = |⟨M⟩|) and does the opposite: it accepts unless M accepted in time. So DTime disagrees with every machine that halts within 4n² steps on its own description, and its language is not in TIME(4n²). Yet DTime itself only needs about 4n² steps plus a little, so a bit more time decides strictly more: that is the <b>time hierarchy theorem</b> (with a real universal machine the overhead is a log factor: TIME(f) ⊊ TIME(f log f)). <b>DSpace</b> does the same with at most n work cells: SPACE(f) ⊊ SPACE(g) whenever g grows faster than f. The tape <b>desc</b> holds ⟨Square⟩: run DTime and watch it simulate Square, which fits in time, then flip its answer. Put ⟨Forever⟩ or ⟨Copy2⟩ on desc with Write description in the tape window’s Tools tab to see a simulation cut off (ret becomes timeout or spaceout). Open DTime’s Tools tab and build the <b>diagonal table</b>: its row differs from the diagonal wherever the simulation finished. By default the simulation is idealized: one step per simulated step, and the bounds are checked for free. A real D pays for all of that, which is exactly why the theorems need g to grow faster than f. In DTime’s Budgets tab, set <b>Simulation cost</b> to the multi-tape universal machine and tick the time-bound charge: the T meter now shows the overhead, DTime breaks its own 4n² + 10 budget, and the gap the theorem needs appears. (Here the lookup cost |⟨M⟩| equals n; the textbook proof pads the input so that it is a constant.) DSpace gives up after 10n² steps, where a real proof waits 2^O(n) steps (the number of configurations): tick <b>Detect loops</b> and the space charges in its settings, then run it on ⟨Forever⟩ to see the loop counter’s cost charged in full.',
  target: 'DTime',
  tapes: [{ name: 'desc', describe: 'Square' }, { name: 'work', init: '' }],
  machines: [
    { kind: 'prog', bind: { in: 'desc', w: 'work' }, budgetTime: '4*n^2 + 10', src:
`machine DTime {
  tape in readonly       // ⟨M⟩, so n = |⟨M⟩|
  tape w                 // work tape lent to M
  // diagonalize against TIME(4n²): run M on ⟨M⟩ for at most 4n² steps
  simulate in on (in, w) within time (4*n^2)
  accept if ret != accept   // the opposite; running out of time counts as "not accepted"
}` },
    { kind: 'prog', bind: { in: 'desc', w: 'work' }, src:
`machine DSpace {
  tape in readonly
  tape w
  // diagonalize against SPACE(n): run M on ⟨M⟩ in at most n work cells
  // (and give up after 10n² steps; a real proof waits for 2^O(n))
  simulate in on (in, w) within space (n) time (10*n^2)
  accept if ret != accept
}` },
    { kind: 'prog', bind: { in: 'desc' }, src:
`machine Scan {
  tape in readonly
  reg p : {0, 1} = 0
  // linear time: accept inputs of even length
  while read(in) != _ { if p == 0 { p = 1 } else { p = 0 }  move in R }
  accept if p == 0
}` },
    { kind: 'prog', bind: { in: 'desc', w: 'work' }, src:
`machine Square {
  tape in readonly
  tape w
  // quadratic time: from every cell, walk back to the start and return
  while read(in) != _ {
    write w x                                  // mark this position
    while !atstart(in) { move in L  move w L }
    while read(w) != x { move in R  move w R }
    write w y                                  // done with it
    move in R
    if read(in) != _ { move w R }
  }
  accept
}` },
    { kind: 'prog', bind: { in: 'desc' }, src:
`machine Forever {
  tape in readonly
  while read(in) == read(in) { }   // never halts
}` },
    { kind: 'prog', bind: { in: 'desc', w: 'work' }, src:
`machine Copy {
  tape in readonly
  tape w
  // n work cells: copy the input
  while read(in) != _ { write w read(in)  move in R  if read(in) != _ { move w R } }
  accept
}` },
    { kind: 'prog', bind: { in: 'desc', w: 'work' }, src:
`machine Copy2 {
  tape in readonly
  tape w
  // 2n work cells: copy the input twice
  while read(in) != _ { write w read(in)  move w R  move in R }
  while !atstart(in) { move in L }
  while read(in) != _ { write w read(in)  move w R  move in R }
  reject
}` },
  ],
},
{
  key: 'advice', title: 'Advice: P/poly', tag: '/poly',
  guide: 'A machine with <b>advice</b> also gets a string a(n) that depends only on the input length. Advice tapes are filled when a run starts, from the table or function in the tape window, and machines can read but never compute them. <b>Unary</b> decides a unary language in linear time with one advice bit per length. The bits here are made up, but they could just as well say whether the n-th Turing machine halts: every unary language, even an undecidable one, is in P/poly. Advice is given, not computed. <b>ParityByAdvice</b> is a circuit whose gates come from the advice tape: the advice for length n is the circuit for length n. P/poly is exactly the languages with polynomial-size circuit families, with no requirement that any machine can build them (compare the uniform circuit family world). The advice tape <b>circ</b> has the budget length ≤ 2n + 1.',
  target: 'ParityByAdvice',
  tapes: [{ name: 'bits', init: '1011', alphabet: '01' }, { name: 'circ', kind: 'advice', advice: "(n) => n ? 'v' + 'v^'.repeat(n - 1) : '0'", adviceMax: '2*n + 1' }, { name: 'unary', init: '111', alphabet: '1' }, { name: 'bit', kind: 'advice', advice: '0: 1\n1: 0\n2: 0\n3: 1\n4: 1\n5: 0\n6: 1\n7: 0\n8: 1\n9: 1', adviceMax: '1' }],
  machines: [
    { kind: 'circuit', bind: { in: 'bits', adv: 'circ' }, src:
`circuit ParityByAdvice
# the circuit for length n is the advice for n, in postfix: v = next input bit, ^ = XOR
gates from adv` },
    { kind: 'prog', bind: { in: 'unary', a: 'bit' }, budgetTime: '2*n + 4', src:
`machine Unary {
  tape in readonly       // 1^n
  tape a readonly        // advice: one bit for this length
  while read(in) == 1 { move in R }
  if read(in) != _ { reject }      // not a unary string
  accept if read(a) == 1
}` },
  ],
},
{
  key: 'pcp', title: 'Probabilistically checkable proofs', tag: 'PCP',
  guide: 'A PCP verifier tosses r(n) coins and reads only q(n) cells of a proof tape, jumping to them with <b>seek</b>; queried cells are outlined. Its Budgets tab sets both, so the badge reads PCP(r, q). Use the <b>Exact acceptance probability</b> tool in its Tools tab: it runs the verifier for every coin sequence. <b>SpotCheck</b> reads a 3-CNF formula (8 clauses, literals like +0 or -3) and a proof that is an assignment. It picks a random clause with 3 coins and queries its 3 variables. A satisfying proof is always accepted. Now replace the formula with the unsatisfiable <code>+0+1+2|+0+1-2|+0-1+2|+0-1-2|-0+1+2|-0+1-2|-0-1+2|-0-1-2</code> and press <b>Best proof</b>: some assignment still passes 7 of 8 checks. That is the weakness of spot checks. The PCP theorem says every NP language has a verifier with O(log n) coins, a constant number of queries, and soundness 1/2. <b>Linearity</b> is the Blum–Luby–Rubinfeld test, the heart of the Hadamard-code PCP: the proof <b>f</b> is the truth table of a function on 3 bits, and the verifier checks f(x) ⊕ f(y) = f(x ⊕ y) for random x and y, using 6 coins and 3 queries. Best proof finds exactly the 8 linear functions; a table far from linear, such as majority <code>00010111</code>, fails often.',
  target: 'SpotCheck',
  tapes: [{ name: 'cnf', init: '+0+1+2|+0+1-2|+0-1+2|+0-1-2|-0+1+2|-0+1-2|-0-1+2|-0-1+3', alphabet: '+-0123|' }, { name: 'coins', kind: 'random', seed: 4 }, { name: 'pi', kind: 'proof', init: '11110000', alphabet: '01' }, { name: 'f', kind: 'proof', init: '01101001', alphabet: '01' }, { name: 'ax', init: '' }, { name: 'ay', init: '' }, { name: 'az', init: '' }],
  machines: [
    { kind: 'prog', bind: { in: 'cnf', coins: 'coins', pi: 'pi' }, budgetRand: 'log(n)', budgetQuery: '3', src:
`machine SpotCheck {
  tape in readonly       // a 3-CNF: clauses like +0-1+2, separated by |
  tape coins
  tape pi readonly       // the proof: an assignment, cell i = variable i
  reg c : 0..7 = 0       // the clause to check
  reg k : 0..3 = 0
  reg v : 0..7 = 0
  reg sign : {'+', '-'} = '+'
  reg sat : {no, yes} = no
  // c = three random bits
  if read(coins) == 1 { inc c inc c inc c inc c }  move coins R
  if read(coins) == 1 { inc c inc c }  move coins R
  if read(coins) == 1 { inc c }
  // walk to clause c
  while c > 0 {
    while read(in) != '|' && read(in) != _ { move in R }
    move in R  dec c
  }
  if read(in) == _ { accept }      // fewer than 8 clauses: nothing to check
  // query its three variables
  while k < 3 {
    sign = read(in)  move in R
    v = read(in)  move in R
    seek pi v
    if sign == '+' && read(pi) == 1 { sat = yes }
    if sign == '-' && read(pi) == 0 { sat = yes }
    inc k
  }
  accept if sat == yes
}` },
    { kind: 'prog', bind: { f: 'f', coins: 'coins', ax: 'ax', ay: 'ay', az: 'az' }, budgetRand: '2*log(n)', budgetQuery: '3', src:
`machine Linearity {
  tape f readonly        // the proof: f on 3 bits as a table of 8 cells
  tape coins
  tape ax                // the addresses x, y and x xor y, in binary
  tape ay
  tape az
  reg b : {0, 1} = 0
  reg c : {0, 1} = 0
  reg k : 0..3 = 0
  // x and y: three coins each
  while k < 3 { write ax read(coins)  move coins R  move ax R  inc k }
  k = 0
  while k < 3 { write ay read(coins)  move coins R  move ay R  inc k }
  k = 0
  while k < 3 { move ax L  move ay L  inc k }
  // z = x xor y
  k = 0
  while k < 3 {
    if read(ax) == read(ay) { write az 0 } else { write az 1 }
    move ax R  move ay R  move az R  inc k
  }
  // three queries: is f(x) xor f(y) = f(x xor y)?
  seek f ax  b = read(f)
  seek f ay  c = read(f)
  seek f az
  if b == c { accept if read(f) == 0 }
  accept if read(f) == 1
}` },
  ],
},
{
  key: 'panel', title: 'A control panel: buttons and displays', tag: 'I/O',
  guide: 'Inputs and displays are wired to tapes, like machines. An input only writes symbols to its tape, and a display only draws its tape, so all the computing is done by the machines. <b>+1</b> runs <b>Counter</b>, a Turing machine that adds one to a decimal number stored least significant digit first; the digit display draws those cells. Start the clock <b>Tick</b> with its ▶ key and it presses +1 for you once a second; it waits whenever a run is still going. Type numbers into <b>a</b> and <b>b</b> (written in binary, least significant bit first) and press <b>=</b>: <b>Add</b> is a three-tape Turing machine, and the number display reads its output tape back. Each switch flips one cell of <b>sw</b> and runs the circuit <b>Parity4</b>, which writes its answer to the lamp’s tape. The text input writes <b>text</b> and runs <b>Reverse</b>. Inputs are blocked while a run is in progress. The lightning button next to Speed turns animation off, so presses just compute and the panel updates when the run ends.',
  target: 'Counter',
  tapes: [{ name: 'count', init: '0', alphabet: '0123456789' }, { name: 'a', init: '101', alphabet: '01' }, { name: 'b', init: '11', alphabet: '01' }, { name: 'sum', init: '' }, { name: 'sw', init: '0000', alphabet: '01' }, { name: 'light', init: '' }, { name: 'text', init: 'turing' }, { name: 'out', init: '' }],
  machines: [
    { kind: 'tm', name: 'Counter', bind: { t: 'count' }, src: `tapes: t
start: inc
accept: done
# decimal, least significant digit first: add one with a carry
inc, 9 -> inc, 0, R
inc, 0 -> done, 1, S
inc, 1 -> done, 2, S
inc, 2 -> done, 3, S
inc, 3 -> done, 4, S
inc, 4 -> done, 5, S
inc, 5 -> done, 6, S
inc, 6 -> done, 7, S
inc, 7 -> done, 8, S
inc, 8 -> done, 9, S
inc, _ -> done, 1, S` },
    { kind: 'tm', name: 'Add', bind: { a: 'a', b: 'b', s: 'sum' }, src: `tapes: a readonly, b readonly, s
start: c0
accept: done
# binary, least significant bit first; c0 and c1 remember the carry
c0, 0 0 * -> c0, * * 0, R R R
c0, 0 1 * -> c0, * * 1, R R R
c0, 0 _ * -> c0, * * 0, R S R
c0, 1 0 * -> c0, * * 1, R R R
c0, 1 1 * -> c1, * * 0, R R R
c0, 1 _ * -> c0, * * 1, R S R
c0, _ 0 * -> c0, * * 0, S R R
c0, _ 1 * -> c0, * * 1, S R R
c0, _ _ * -> clear, * * *, S S S
c1, 0 0 * -> c0, * * 1, R R R
c1, 0 1 * -> c1, * * 0, R R R
c1, 0 _ * -> c0, * * 1, R S R
c1, 1 0 * -> c1, * * 0, R R R
c1, 1 1 * -> c1, * * 1, R R R
c1, 1 _ * -> c1, * * 0, R S R
c1, _ 0 * -> c0, * * 1, S R R
c1, _ 1 * -> c1, * * 0, S R R
c1, _ _ * -> last, * * 1, S S R
last, * * * -> clear, * * *, S S S
# erase what is left of an older, longer sum
clear, * * 0 -> clear, * * _, S S R
clear, * * 1 -> clear, * * _, S S R
clear, * * _ -> done, * * *, S S S` },
    { kind: 'circuit', bind: { in: 'sw', light: 'light' }, src: `circuit Parity4
# odd number of switches on?
p = XOR x0 x1
q = XOR x2 x3
out = XOR p q
output to light` },
    { kind: 'prog', bind: { in: 'text', out: 'out' }, src: `machine Reverse {
  tape in readonly
  tape out
  while read(out) != _ { write out _  move out R }   // clear the old output
  while !atstart(out) { move out L }
  while read(in) != _ { move in R }
  move in L
  while read(in) != _ { write out read(in)  move out R  move in L }
  accept
}` },
  ],
  devices: [
    { kind: 'button', name: 'Add one', label: '+1', color: 'green', action: 'none', run: 'Counter', pos: [40, 40] },
    { kind: 'button', name: 'Reset counter', label: '0', color: 'white', action: 'set', value: '0', tape: 'count', pos: [220, 40] },
    { kind: 'display', name: 'Counter', fmt: 'digits', count: 4, reverse: true, tape: 'count', pos: [400, 40] },
    { kind: 'clock', name: 'Tick', interval: 1, action: 'none', run: 'Counter', pos: [620, 40] },
    { kind: 'numin', name: 'a', enc: 'binLSB', tape: 'a', pos: [40, 210] },
    { kind: 'numin', name: 'b', enc: 'binLSB', tape: 'b', pos: [300, 210] },
    { kind: 'button', name: 'Equals', label: '=', color: 'amber', action: 'none', run: 'Add', pos: [560, 210] },
    { kind: 'display', name: 'a + b', fmt: 'number', enc: 'binLSB', tape: 'sum', pos: [740, 210] },
    { kind: 'switch', name: 'Switch 1', cell: 0, tape: 'sw', run: 'Parity4', pos: [40, 380] },
    { kind: 'switch', name: 'Switch 2', cell: 1, tape: 'sw', run: 'Parity4', pos: [220, 380] },
    { kind: 'switch', name: 'Switch 3', cell: 2, tape: 'sw', run: 'Parity4', pos: [400, 380] },
    { kind: 'switch', name: 'Switch 4', cell: 3, tape: 'sw', run: 'Parity4', pos: [580, 380] },
    { kind: 'display', name: 'Odd?', fmt: 'lamps', count: 1, on: '1', tape: 'light', pos: [760, 380] },
    { kind: 'textin', name: 'Text', tape: 'text', run: 'Reverse', pos: [40, 540] },
    { kind: 'display', name: 'Reversed', fmt: 'text', tape: 'out', pos: [360, 540] },
  ],
},
{
  key: 'life', title: 'Cellular automata on a pixel display', tag: 'CA',
  guide: 'A pixel display shows the tape <b>grid</b> as 12 rows of 16 cells. <b>Rule30</b> and <b>Rule110</b> are programs with two heads on that one tape: <i>prev</i> reads a row while <i>next</i> writes the row below it, so each run draws the whole history of an elementary cellular automaton, one generation per row. The buttons only write a first row and start a run. Rule 30 grows a chaotic triangle from a single cell; Rule 110, which is Turing complete, grows its leftward structures from the right edge. Turn animation off with the lightning button to see the picture appear at once.',
  target: 'Rule30',
  tapes: [{ name: 'grid', init: '0000000100000000', alphabet: '01' }],
  machines: [
    { kind: 'prog', bind: { prev: 'grid', next: 'grid' }, src: `machine Rule30 {
  tape prev readonly     // the grid, read one row behind
  tape next              // the same grid, written one row ahead
  reg c : 0..15 = 0      // column
  reg row : 0..11 = 0
  reg l : {0, 1} = 0
  reg m : {0, 1} = 0
  reg r : {0, 1} = 0
  reg t : {0, 1} = 0
  reg out : {0, 1} = 0
  reg done : {no, yes} = no
  while c < 15 { move next R  inc c }       // next starts 16 cells (one row) ahead
  move next R
  while row < 11 {
    l = 0
    if read(prev) == 1 { m = 1 } else { m = 0 }
    move prev R
    c = 0  done = no
    while done == no {
      if c == 15 { r = 0 } else { if read(prev) == 1 { r = 1 } else { r = 0 } }
    if (m == 1 || r == 1) { t = 1 } else { t = 0 }
    if (l == t) { out = 0 } else { out = 1 }     // rule 30: l xor (m or r)
      write next out  move next R
      l = m  m = r
      if c == 15 { done = yes } else { move prev R  inc c }
    }
    inc row
  }
  accept
}` },
    { kind: 'prog', bind: { prev: 'grid', next: 'grid' }, src: `machine Rule110 {
  tape prev readonly     // the grid, read one row behind
  tape next              // the same grid, written one row ahead
  reg c : 0..15 = 0      // column
  reg row : 0..11 = 0
  reg l : {0, 1} = 0
  reg m : {0, 1} = 0
  reg r : {0, 1} = 0
  reg t : {0, 1} = 0
  reg out : {0, 1} = 0
  reg done : {no, yes} = no
  while c < 15 { move next R  inc c }       // next starts 16 cells (one row) ahead
  move next R
  while row < 11 {
    l = 0
    if read(prev) == 1 { m = 1 } else { m = 0 }
    move prev R
    c = 0  done = no
    while done == no {
      if c == 15 { r = 0 } else { if read(prev) == 1 { r = 1 } else { r = 0 } }
    out = 0
    if (m != r) { out = 1 }
    if (m == 1 && l == 0) { out = 1 }            // rule 110
      write next out  move next R
      l = m  m = r
      if c == 15 { done = yes } else { move prev R  inc c }
    }
    inc row
  }
  accept
}` },
  ],
  devices: [
    { kind: 'button', name: 'Rule 30', label: '30', color: 'blue', action: 'set', value: '0000000100000000', tape: 'grid', run: 'Rule30', pos: [40, 360] },
    { kind: 'button', name: 'Rule 110', label: '110', color: 'green', action: 'set', value: '0000000000000001', tape: 'grid', run: 'Rule110', pos: [220, 360] },
    { kind: 'button', name: 'Clear', label: 'C', color: 'white', action: 'clear', tape: 'grid', pos: [400, 360] },
    { kind: 'display', name: 'Grid', fmt: 'pixels', w: 16, h: 12, tape: 'grid', pos: [880, 40] },
  ],
},
{
  key: 'circuit', title: 'Boolean circuits', tag: 'CIRC',
  guide: 'Two fixed circuits read bits from the same tape. <b>Majority3</b> outputs the majority of x0..x2 and writes it to tape <b>res</b>. <b>Equal3</b> checks whether the bits x0 x1 x2 equal x3 x4 x5. Each step evaluates one gate: lit gates are 1, dark gates are 0. Switch the run target to compare them, and see size and depth in the window.',
  target: 'Majority3',
  tapes: [{ name: 'input', init: '101100', alphabet: '01' }, { name: 'res', init: '' }],
  machines: [
    { kind: 'circuit', bind: { in: 'input', res: 'res' }, src:
`circuit Majority3
# inputs x0, x1, x2 are cells 0, 1, 2 of the tape on port "in"
a = AND x0 x1
b = AND x0 x2
c = AND x1 x2
out = OR a b c
output to res` },
    { kind: 'circuit', bind: { in: 'input' }, src:
`circuit Equal3
# is x0 x1 x2 equal to x3 x4 x5 ?
e0 = XNOR x0 x3
e1 = XNOR x1 x4
e2 = XNOR x2 x5
out = AND e0 e1 e2` },
  ],
},
{
  key: 'family', title: 'A uniform circuit family', tag: 'UNIF',
  guide: 'A circuit family has one circuit per input length. It is <b>uniform</b> when a machine can build circuit n. <b>Parity</b> calls whatever is in its <b>Gen</b> socket to write circuit n onto tape <b>desc</b> (postfix: v = next input, ^ = XOR), then calls <b>ParityCircuit</b> to evaluate it, one layer per step. ParityCircuit carries an <b>NC¹</b> budget: depth ≤ 2·log n + 2, fan-in 2. <b>ParityGen</b> builds a chain of depth n − 1, which breaks that budget from n = 10 (try input 1011011010). Plug <b>BalancedGen</b> into the Gen socket for a depth-log n tree. In ParityCircuit\'s Tools tab, the scaling lab plots depth while running Parity, and the truth table checks the circuit against the <b>OddOnes</b> DFA.',
  target: 'Parity',
  tapes: [{ name: 'input', init: '1011', alphabet: '01' }, { name: 'desc', init: '' }, { name: 'out', init: '' }],
  machines: [
    { kind: 'prog', bind: { in: 'input' }, links: { Gen: 'ParityGen', Circuit: 'ParityCircuit' }, src:
`machine Parity {
  tape in readonly
  oracle Gen          // builds circuit n
  oracle Circuit      // evaluates it

  call Gen
  call Circuit
  accept if ret == accept
}` },
    { kind: 'prog', bind: { in: 'input', desc: 'desc' }, budgetSpace: '2*n + 2', src:
`machine ParityGen {
  tape in readonly oneway
  tape desc

  // empty input: the constant-0 circuit
  if read(in) == _ { write desc 0  accept }
  write desc v
  move desc R
  move in R
  // every further input bit adds "v^": XOR it in
  while read(in) != _ {
    write desc v
    move desc R
    write desc '^'
    move desc R
    move in R
  }
  accept
}` },
    { kind: 'circuit', bind: { in: 'input', desc: 'desc', out: 'out' }, budgetSize: 'n^2', budgetDepth: '2*log(n) + 2', budgetFanin: '2', src:
`circuit ParityCircuit
# the gates are read from the tape on port "desc" when the circuit runs
gates from desc
output to out` },
    { kind: 'script', bind: { in: 'input', desc: 'desc' }, src:
`script BalancedGen(in, desc) {
  // Writes a balanced XOR tree for this input length: depth about log n.
  // A script, so its own cost is uncertified (an easy logspace job in principle).
  const n = io.get('in').length;
  const tree = k => k === 1 ? 'v' : tree(Math.floor(k / 2)) + tree(Math.ceil(k / 2)) + '^';
  io.set('desc', n === 0 ? '0' : tree(n));
  return true;
}` },
    { kind: 'dfa', name: 'OddOnes', bind: { in: 'input' }, src:
`# the parity language, as a two-state DFA
alphabet: 0 1
start: even
accept: odd
even, 0 -> even
even, 1 -> odd
odd, 0 -> odd
odd, 1 -> even` },
  ],
},
{
  key: 'ph', title: 'Σ₂ two ways: alternation and an NP oracle', tag: 'Σ₂',
  guide: 'The language: two input bits z such that <b>∃x ∀y Phi(z, x, y)</b>, where <b>Phi</b> is a small circuit (it holds exactly when z starts with 1). <b>SigmaTwo</b> is an alternating machine: two <b>exists</b> choices, then one <b>forall</b>, so its tree has 2 quantifier blocks (Σ₂). <b>SigmaTwoOracle</b> guesses x and asks an NP oracle, <b>CounterY</b>, whether some y falsifies Phi: that is the NP<sup>NP</sup> definition. CounterY is marked as an oracle, so its own tree is resolved on the side and only its answer comes back. Use <b>Compare languages</b> to see that the two definitions agree.',
  target: 'SigmaTwo',
  tapes: [{ name: 'input', init: '10', alphabet: '01' }, { name: 'assign', init: '' }],
  machines: [
    { kind: 'prog', bind: { in: 'input', a: 'assign' }, altMode: 'E', altBlocks: '2', altStart: 'E', src:
`machine SigmaTwo {
  tape in readonly
  tape a              // the assignment: z0 z1 x0 x1 y
  reg bit : {0, 1} = 0

  // copy the input bits z0 z1
  if read(in) == _ { reject }
  write a read(in)  move a R  move in R
  if read(in) == _ { reject }
  write a read(in)  move a R

  // ∃ x0 x1  ∀ y  :  Phi(z, x, y)
  exists bit
  write a bit  move a R
  exists bit
  write a bit  move a R
  forall bit
  write a bit
  call Phi
  accept if ret == accept
}` },
    { kind: 'prog', bind: { in: 'input', a: 'assign' }, links: { NP: 'CounterY' }, altMode: 'E', altBlocks: '1', altStart: 'E', src:
`machine SigmaTwoOracle {
  tape in readonly
  tape a
  oracle NP           // "is there a y that makes Phi false?"
  reg bit : {0, 1} = 0

  if read(in) == _ { reject }
  write a read(in)  move a R  move in R
  if read(in) == _ { reject }
  write a read(in)  move a R

  // ∃ x0 x1, then one question to the NP oracle
  exists bit
  write a bit  move a R
  exists bit
  write a bit
  call NP
  accept if ret == reject   // no y falsifies Phi: it holds for every y
}` },
    { kind: 'prog', bind: { a: 'assign' }, oracle: true, altMode: 'E', altBlocks: '1', altStart: 'E', src:
`machine CounterY {
  tape a
  reg bit : {0, 1} = 0

  // the y slot is cell 4 of the assignment
  move a R  move a R  move a R  move a R
  exists bit
  write a bit
  call Phi
  accept if ret == reject   // found a y where Phi fails
}` },
    { kind: 'circuit', bind: { in: 'assign' }, src:
`circuit Phi
# inputs: x0 x1 = z, x2 x3 = the guessed x, x4 = the universal y
c1 = OR x2 x4
ny = NOT x4
c2 = OR x3 ny x1
nx = NOT x2
c3 = OR nx x0
out = AND c1 c2 c3` },
  ],
},
{
  key: 'game', title: 'A game: alternation without a bound', tag: 'AP',
  guide: 'A pile of n stones (the input, in unary). Players take 1 or 2 stones in turn; whoever takes the last stone wins. <b>TakeAway</b> asks whether the first player can force a win: its moves are <b>exists</b>; the opponent&rsquo;s are <b>forall</b>. The number of quantifier blocks grows with n, so no Σₖ bound holds; polynomial time with unbounded alternation is AP = PSPACE. The answer is "yes" exactly when n is not a multiple of 3: <b>Compare languages</b> with the <b>NotMult3</b> DFA. In the tree window, ∃ nodes need one winning child and ∀ nodes need all of them; grey branches were skipped because they could not change the answer. <b>TakeAwayTM</b> is the same game as an alternating Turing machine: <i>exists: me</i> and <i>forall: you</i> mark its ∃ and ∀ states.',
  target: 'TakeAway',
  tapes: [{ name: 'pile', init: '1111', alphabet: '1' }],
  machines: [
    { kind: 'prog', bind: { in: 'pile' }, altMode: 'E', altBlocks: '', altStart: 'E', budgetTime: '14*n + 10', src:
`machine TakeAway {
  tape in               // the pile, in unary
  reg take : {1, 2} = 1
  reg turn : {me, you} = me

  // stones are taken from the right end
  while read(in) != _ { move in R }
  move in L
  while read(in) == 1 {
    if turn == me { exists take } else { forall take }
    write in _
    move in L
    if take == 2 {
      // taking 2 from a pile of 1 is illegal: the mover loses
      if read(in) != 1 { accept if turn == you }
      write in _
      move in L
    }
    if turn == me { turn = you } else { turn = me }
  }
  // the pile is empty: whoever moved last took the last stone
  accept if turn == you
}` },
    { kind: 'dfa', name: 'NotMult3', bind: { in: 'pile' }, src:
`# n is not a multiple of 3
alphabet: 1
start: r0
accept: r1 r2
r0, 1 -> r1
r1, 1 -> r2
r2, 1 -> r0` },
    { kind: 'tm', name: 'TakeAwayTM', bind: { in: 'pile' }, src:
`tapes: in readonly
start: me
accept: win
reject: lose
exists: me       # my moves: some move must win
forall: you      # your moves: every reply must still lose for you
# The pile is in unary; taking a stone moves the head right.
me, _ -> lose, *, S     # empty on my turn: you took the last stone
me, 1 -> you, *, R      # take one
me, 1 -> me2, *, R      # take two: the first stone
me2, 1 -> you, *, R     #           and the second
me2, _ -> lose, *, S    # only one was left: not a legal move
you, _ -> win, *, S     # empty on your turn: I took the last stone
you, 1 -> me, *, R
you, 1 -> you2, *, R
you2, 1 -> me, *, R
you2, _ -> win, *, S    # you cannot take two from one` },
  ],
},
{
  key: 'count', title: 'One machine, five acceptance rules', tag: '#P PP',
  guide: 'Five machines that each pick one position of the input and accept on that path if the bit there is 1. They differ in how the computation tree decides. <b>PickNP</b> (∃: some path accepts) decides “contains a 1”. <b>PickCount</b> (#P) reports the number of accepting paths, here the number of 1s. <b>PickParity</b> (⊕P) accepts when that number is odd: PARITY. These three walk along the input and branch at each cell (stop here, or go on), giving one path per cell. Counting paths does not care how long each path is, so that is fine. <b>PickPP</b> and <b>PickBPP</b> decide by the <b>probability</b> of acceptance, treating every choice as a fair coin, so a path deep in the tree is less likely than a short one. To make every position equally likely they flip one coin per bit of n, choosing an index i uniformly from 2ᵏ > n values (the work tapes <b>len</b> and <b>idx</b> hold n and i in binary). An index past the end flips one more coin and accepts on one side only, which adds exactly 1/2 of its weight and keeps the balance: PickPP accepts with probability above 1/2 exactly when more than half the bits are 1, so it decides MAJORITY. On <b>11010</b> (3 ones of 5) the probability is 9/16: PP says yes, but it is between 1/3 and 2/3, so the BPP-style rule has no clear answer. Open the tree window to see each path’s probability. Compare PickParity with the <b>OddOnes</b> DFA and PickNP with <b>HasOne</b>. <b>CountOnesTM</b> is the counting idea as a nondeterministic Turing machine: its table has two rules for <i>scan</i> on 1, which makes a branch; its acceptance rule (here #P) is set in its Class &amp; budgets tab.',
  target: 'PickCount',
  tapes: [{ name: 'input', init: '11010', alphabet: '01' }, { name: 'len', init: '', alphabet: '01' }, { name: 'idx', init: '', alphabet: '01' }],
  machines: [
    { kind: 'prog', bind: { in: 'input' }, accMode: 'exists', src:
`machine PickNP {
  tape in readonly
  // NP: accept if SOME path accepts (the input contains a 1)
  // Guess one position of the input: one computation path per cell.
  while read(in) != _ {
    move in R
    if read(in) == _ { move in L  accept if read(in) == 1 }   // last cell: stop here
    move in L
    choose { accept if read(in) == 1 } or { move in R }
  }
  reject   // empty input
}` },
    { kind: 'prog', bind: { in: 'input' }, accMode: 'count', src:
`machine PickCount {
  tape in readonly
  // #P: count the accepting paths (the number of 1s)
  // Guess one position of the input: one computation path per cell.
  while read(in) != _ {
    move in R
    if read(in) == _ { move in L  accept if read(in) == 1 }   // last cell: stop here
    move in L
    choose { accept if read(in) == 1 } or { move in R }
  }
  reject   // empty input
}` },
    { kind: 'prog', bind: { in: 'input', len: 'len', idx: 'idx' }, accMode: 'majority', src:
`machine PickPP {
  tape in readonly
  tape len           // work: n in binary, least significant bit first
  tape idx           // work: a random index i with as many bits as n
  reg b : {0, 1} = 0
  reg zero : {yes, no} = yes
  reg phase : {walk, done} = walk
  // PP: accept with probability MORE THAN 1/2 (majority of 1s)
  // Choose a position UNIFORMLY: every path gets the same probability.
  // Clear the work tapes (a previous run may have left something there).
  while read(len) != _ { write len _  move len R }
  while !atstart(len) { move len L }
  while read(idx) != _ { write idx _  move idx R }
  while !atstart(idx) { move idx L }
  // 1. Count the input in binary on len: k = number of bits of n.
  while read(in) != _ {
    while read(len) == 1 { write len 0  move len R }
    write len 1
    while !atstart(len) { move len L }
    move in R
  }
  while !atstart(in) { move in L }
  // 2. Flip k coins for the bits of i: 2^k equally likely indices, 2^k > n.
  while read(len) != _ {
    guess b
    write idx b
    move len R  move idx R
  }
  while !atstart(idx) { move idx L }
  // 3. Walk i cells to the right, subtracting 1 from i per cell.
  while phase == walk {
    zero = yes
    while read(idx) != _ { if read(idx) == 1 { zero = no }  move idx R }
    while !atstart(idx) { move idx L }
    if zero == yes { phase = done } else {
      while read(idx) == 0 { write idx 1  move idx R }
      write idx 0
      while !atstart(idx) { move idx L }
      move in R
    }
  }
  // 4. Past the end (i >= n): one more coin, accept on one side only.
  //    These paths add exactly 1/2 times their weight, so the balance is kept.
  if read(in) == _ { guess b  accept if b == 1  reject }
  accept if read(in) == 1
  reject
}` },
    { kind: 'prog', bind: { in: 'input', len: 'len', idx: 'idx' }, accMode: 'bpp', src:
`machine PickBPP {
  tape in readonly
  tape len           // work: n in binary, least significant bit first
  tape idx           // work: a random index i with as many bits as n
  reg b : {0, 1} = 0
  reg zero : {yes, no} = yes
  reg phase : {walk, done} = walk
  // BPP-style: accept at probability 2/3 or more, reject at 1/3 or less
  // Choose a position UNIFORMLY: every path gets the same probability.
  // Clear the work tapes (a previous run may have left something there).
  while read(len) != _ { write len _  move len R }
  while !atstart(len) { move len L }
  while read(idx) != _ { write idx _  move idx R }
  while !atstart(idx) { move idx L }
  // 1. Count the input in binary on len: k = number of bits of n.
  while read(in) != _ {
    while read(len) == 1 { write len 0  move len R }
    write len 1
    while !atstart(len) { move len L }
    move in R
  }
  while !atstart(in) { move in L }
  // 2. Flip k coins for the bits of i: 2^k equally likely indices, 2^k > n.
  while read(len) != _ {
    guess b
    write idx b
    move len R  move idx R
  }
  while !atstart(idx) { move idx L }
  // 3. Walk i cells to the right, subtracting 1 from i per cell.
  while phase == walk {
    zero = yes
    while read(idx) != _ { if read(idx) == 1 { zero = no }  move idx R }
    while !atstart(idx) { move idx L }
    if zero == yes { phase = done } else {
      while read(idx) == 0 { write idx 1  move idx R }
      write idx 0
      while !atstart(idx) { move idx L }
      move in R
    }
  }
  // 4. Past the end (i >= n): one more coin, accept on one side only.
  //    These paths add exactly 1/2 times their weight, so the balance is kept.
  if read(in) == _ { guess b  accept if b == 1  reject }
  accept if read(in) == 1
  reject
}` },
    { kind: 'prog', bind: { in: 'input' }, accMode: 'parity', src:
`machine PickParity {
  tape in readonly
  // ⊕P: accept if an ODD number of paths accept (parity of 1s)
  // Guess one position of the input: one computation path per cell.
  while read(in) != _ {
    move in R
    if read(in) == _ { move in L  accept if read(in) == 1 }   // last cell: stop here
    move in L
    choose { accept if read(in) == 1 } or { move in R }
  }
  reject   // empty input
}` },
    { kind: 'dfa', name: 'OddOnes', bind: { in: 'input' }, src:
`alphabet: 0 1
start: even
accept: odd
even, 0 -> even
even, 1 -> odd
odd, 0 -> odd
odd, 1 -> even` },
    { kind: 'dfa', name: 'HasOne', bind: { in: 'input' }, src:
`alphabet: 0 1
start: none
accept: seen
none, 0 -> none
none, 1 -> seen
seen, 0 1 -> seen` },
    { kind: 'tm', name: 'CountOnesTM', bind: { in: 'input' }, accMode: 'count', src:
`tapes: in readonly
start: scan
accept: yes
reject: no
nondeterministic   # two rules for the same state and symbol make a branch
scan, 1 -> yes, *, S    # stop on this 1 and accept
scan, 1 -> scan, *, R   # or keep looking
scan, 0 -> scan, *, R
scan, _ -> no, *, S` },
  ],
},
{
  key: 'reduce', title: 'Reductions: Independent Set ≤ Clique ≤ SAT', tag: '≤',
  guide: 'A graph is written as <b>1ⁿ # adjacency bits # 1ᵏ</b>: n vertices in unary, one bit per pair (0,1), (0,2), …, (n−2,n−1), then k. <b>IndSet</b> and <b>Clique</b> are nondeterministic deciders: they guess a set of vertices. <b>Complement</b> flips every adjacency bit, a log-space transducer: G has an independent set of size k exactly when its complement has a clique of size k. <b>CliqueToSAT</b> writes a CNF formula that is satisfiable exactly when the graph has a k-clique. Each card between deciders is a <b>reduction</b>: click one and press <b>Check</b> to test A(w) = B(f(w)) on many graphs and measure the transducer against its budget. The third card composes both, so Independent Set reduces to SAT: that chain is how NP-completeness spreads.',
  target: 'IndSet',
  tapes: [{ name: 'graph', init: '1111#110011#11', alphabet: '1#0' }, { name: 'graph2', init: '', alphabet: '1#0' }, { name: 'formula', init: '' }, { name: 'pickA', init: '' }, { name: 'pickB', init: '' }],
  machines: [
    { kind: 'prog', bind: { in: 'graph', pick: 'pickA' }, altMode: 'E', altBlocks: '1', altStart: 'E', src:
`machine IndSet {
  tape in readonly
  tape pick            // pick[v] = 1 when vertex v is in the guessed set
  reg n : 0..9 = 0
  reg c : 0..9 = 0
  reg i : 0..9 = 0
  reg j : 0..9 = 0
  reg t : 0..9 = 0
  reg bi : {0, 1, _} = 0
  reg bit : {0, 1} = 0

  // n in unary: guess, for each vertex, whether it is in the set
  while read(in) == 1 {
    exists bit
    write pick bit  move pick R
    if bit == 1 { inc c }
    inc n  move in R
  }
  if read(in) != # { reject }
  move in R
  // every pair i < j, in input order: two chosen vertices must NOT be adjacent
  while i < n {
    while !atstart(pick) { move pick L }
    t = i
    while t > 0 { move pick R  dec t }
    bi = read(pick)
    j = i
    inc j
    while j < n {
      if read(in) != 0 && read(in) != 1 { reject }
      if bi == 1 && read(in) == 1 {
        while !atstart(pick) { move pick L }
        t = j
        while t > 0 { move pick R  dec t }
        if read(pick) == 1 { reject }
      }
      move in R
      inc j
    }
    inc i
  }
  if read(in) != # { reject }
  move in R
  // the set must have at least k vertices
  while read(in) == 1 { if c == 0 { reject }  dec c  move in R }
  accept
}` },
    { kind: 'prog', bind: { in: 'graph2', pick: 'pickB' }, altMode: 'E', altBlocks: '1', altStart: 'E', src:
`machine Clique {
  tape in readonly
  tape pick            // pick[v] = 1 when vertex v is in the guessed set
  reg n : 0..9 = 0
  reg c : 0..9 = 0
  reg i : 0..9 = 0
  reg j : 0..9 = 0
  reg t : 0..9 = 0
  reg bi : {0, 1, _} = 0
  reg bit : {0, 1} = 0

  // n in unary: guess, for each vertex, whether it is in the set
  while read(in) == 1 {
    exists bit
    write pick bit  move pick R
    if bit == 1 { inc c }
    inc n  move in R
  }
  if read(in) != # { reject }
  move in R
  // every pair i < j, in input order: two chosen vertices MUST be adjacent
  while i < n {
    while !atstart(pick) { move pick L }
    t = i
    while t > 0 { move pick R  dec t }
    bi = read(pick)
    j = i
    inc j
    while j < n {
      if read(in) != 0 && read(in) != 1 { reject }
      if bi == 1 && read(in) == 0 {
        while !atstart(pick) { move pick L }
        t = j
        while t > 0 { move pick R  dec t }
        if read(pick) == 1 { reject }
      }
      move in R
      inc j
    }
    inc i
  }
  if read(in) != # { reject }
  move in R
  // the set must have at least k vertices
  while read(in) == 1 { if c == 0 { reject }  dec c  move in R }
  accept
}` },
    { kind: 'prog', bind: { in: 'graph', out: 'graph2' }, budgetSpace: '2*log(n) + 4', budgetTime: '6*n + 10', src:
`machine Complement {
  tape in readonly oneway
  tape out output       // one-way and write-only: not counted as space

  // copy n
  while read(in) == 1 { write out 1  move out R  move in R }
  write out read(in)  move out R  move in R      // the '#'
  // flip every adjacency bit: an edge becomes a non-edge and back
  while read(in) == 0 || read(in) == 1 {
    if read(in) == 1 { write out 0 } else { write out 1 }
    move out R  move in R
  }
  // copy the rest: '#' and k
  while read(in) != _ { write out read(in)  move out R  move in R }
  accept
}` },
    { kind: 'script', bind: { in: 'graph2', out: 'formula' }, src:
`script CliqueToSAT(in, out output) {
  // Writes a CNF formula that is satisfiable exactly when the graph has a k-clique.
  // Variable (r, v) means "slot r of the clique holds vertex v".
  // Clauses are separated by ';', literals by ',', a minus sign negates.
  const m = io.get('in').match(/^(1*)#([01]*)#(1*)/);
  const n = m ? m[1].length : -1, k = m ? m[3].length : 0;
  if (!m || n > 9 || m[2].length !== n * (n - 1) / 2) { io.set('out', '1;-1'); return true; }   // malformed: unsatisfiable
  const edge = {}; let e = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edge[i + ',' + j] = m[2][e++] === '1';
  const adj = (a, b) => edge[Math.min(a, b) + ',' + Math.max(a, b)];
  const x = (r, v) => r * n + v + 1;
  const cls = [];
  for (let r = 0; r < k; r++) cls.push([...Array(n).keys()].map(v => x(r, v)));        // every slot is filled
  for (let r = 0; r < k; r++) for (let s = r + 1; s < k; s++) for (let v = 0; v < n; v++) {
    cls.push([-x(r, v), -x(s, v)]);                                                  // no vertex used twice
    for (let u = 0; u < n; u++) if (u !== v && !adj(u, v)) cls.push([-x(r, v), -x(s, u)]);   // slots must be adjacent
  }
  if (cls.some(c => !c.length)) { io.set('out', '1;-1'); return true; }   // an empty clause (k > 0 slots, no vertices): unsatisfiable
  io.set('out', cls.map(c => c.join(',')).join(';'));
  return true;
}` },
    { kind: 'script', bind: { in: 'formula' }, src:
`script SatSolver(in) {
  // Decides CNF satisfiability by backtracking (DPLL). An empty formula is true.
  const s = io.get('in');
  const cls = s.length ? s.split(';').map(c => c.split(',').filter(Boolean).map(Number)) : [];
  if (cls.some(c => c.some(l => !Number.isInteger(l) || l === 0))) return false;
  const solve = (cs, asg) => {
    cs = cs.filter(c => !c.some(l => asg[Math.abs(l)] === (l > 0)))
           .map(c => c.filter(l => asg[Math.abs(l)] === undefined));
    if (!cs.length) return true;
    if (cs.some(c => !c.length)) return false;
    const unit = cs.find(c => c.length === 1);
    const l = unit ? unit[0] : cs[0][0], v = Math.abs(l);
    for (const val of unit ? [l > 0] : [l > 0, l < 0]) { if (solve(cs, Object.assign({}, asg, { [v]: val }))) return true; }
    return false;
  };
  return solve(cls, {});
}` },
  ],
  reductions: [
    { from: 'IndSet', to: 'Clique', via: ['Complement'], pos: [520, 470] },
    { from: 'Clique', to: 'SatSolver', via: ['CliqueToSAT'], pos: [520, 640] },
    { from: 'IndSet', to: 'SatSolver', via: ['Complement', 'CliqueToSAT'], pos: [520, 810] },
  ],
},
{
  key: 'halt', title: 'Machines as data: the halting problem', tag: '⟨M⟩',
  guide: 'A machine is also a string: its <b>description ⟨M⟩</b> is its source, one character per cell. <b>U</b> is the universal machine, two lines long: <code>simulate code on (in)</code> runs whatever is described on the tape <b>code</b> (now ⟨EvenAs⟩) on the tape <b>input</b>; its screen shows the program it is reading. <b>H</b> is a candidate decider for the halting problem K = { ⟨M⟩ : M halts on ⟨M⟩ }: it simulates M on ⟨M⟩ and gives up after 40 steps. <b>D</b> asks H about its input and does the opposite. The tape <b>desc</b> holds ⟨D⟩, so running D asks H whether D halts on itself. Press Step and watch the stack: H simulates ⟨D⟩, which calls H, which simulates ⟨D⟩ again. H gives up and answers “does not halt”, so D halts at once: H is wrong on ⟨D⟩. Raise H’s bound and it is wrong again. Plug <b>Optimist</b> into D’s socket (Wiring tab) and D runs forever instead. Every candidate fails on its own D, so K is undecidable. Open D’s Tools for the <b>diagonal table</b>. <b>Narcissus</b> writes its own description: the recursion theorem.',
  target: 'D',
  tapes: [{ name: 'code', describe: 'EvenAs' }, { name: 'input', init: 'abab', alphabet: 'ab' }, { name: 'desc', describe: 'D' }, { name: 'mirror', init: '' }],
  machines: [
    { kind: 'prog', bind: { code: 'code', in: 'input' }, src:
`machine U {
  tape code readonly     // ⟨M⟩
  tape in                // M's input
  // The universal machine: run the machine described on code.
  simulate code on (in)
  accept if ret == accept
}` },
    { kind: 'prog', bind: { in: 'input' }, src:
`machine EvenAs {
  tape in readonly
  reg p : {0, 1} = 0     // parity of the a's so far
  while read(in) != _ {
    if read(in) == a { if p == 0 { p = 1 } else { p = 0 } }
    move in R
  }
  accept if p == 0
}` },
    { kind: 'prog', bind: { in: 'input' }, src:
`machine Loop {
  tape in readonly
  while read(in) == read(in) { }   // never halts
}` },
    { kind: 'prog', bind: { in: 'desc' }, links: { H: 'H' }, src:
`machine D {
  tape in readonly       // ⟨M⟩
  oracle H               // plug in any candidate halting decider
  call H                 // does M halt on ⟨M⟩?
  while ret == accept { }   // H says yes: run forever
  accept                 // H says no: halt at once
}` },
    { kind: 'prog', bind: { in: 'desc' }, src: `machine H {
  tape in readonly       // ⟨M⟩
  // A candidate decider for K = { ⟨M⟩ : M halts on input ⟨M⟩ }.
  // It runs M on its own description and gives up after 40 steps.
  simulate in on (in) within 40
  accept if ret != timeout
}` },
    { kind: 'prog', bind: { in: 'desc' }, src:
`machine Optimist {
  tape in readonly
  accept                 // claims every machine halts on its own description
}` },
    { kind: 'prog', bind: { out: 'mirror' }, src:
`machine Narcissus {
  tape out
  // The recursion theorem: a machine can obtain its own description.
  writeself out
  accept
}` },
  ],
},
{
  key: 'rice', title: 'Rice’s theorem: halting reduces to any property', tag: 'Rice',
  guide: '<b>Rice’s theorem</b>: no machine decides a nontrivial property of the language a machine accepts. The proof is a reduction from the halting problem K, and here it is an actual machine. <b>RiceBuilder</b> reads ⟨M⟩ and writes ⟨M′⟩, where M′ ignores its own input, runs M on ⟨M⟩, then accepts. If M halts on ⟨M⟩, M′ accepts everything; if not, M′ accepts nothing. So a decider for “accepts the empty string” (<b>AcceptsEmpty</b>) would decide K (<b>H</b>). RiceBuilder only copies, so it is log-space. Run it (the tape <b>desc</b> holds ⟨Countdown⟩), then make AcceptsEmpty the target to run on what it wrote. Change desc to ⟨Spin⟩ with “Write description” in its window. The card checks the reduction on random small machines. H and AcceptsEmpty are bounded stand-ins (no real decider exists), so they agree on machines that halt quickly or never.',
  target: 'RiceBuilder',
  tapes: [{ name: 'desc', describe: 'Countdown' }, { name: 'built', init: '' }, { name: 'x', init: '' }, { name: 'y', init: '' }],
  machines: [
    { kind: 'prog', bind: { in: 'desc' }, src: `machine H {
  tape in readonly       // ⟨M⟩
  // A candidate decider for K = { ⟨M⟩ : M halts on input ⟨M⟩ }.
  // It runs M on its own description and gives up after 200 steps.
  simulate in on (in) within 200
  accept if ret != timeout
}` },
    { kind: 'prog', bind: { in: 'desc', out: 'built' }, budgetSpace: '2*log(n) + 4', budgetTime: '5*n + 150', src:
`machine RiceBuilder {
  tape in readonly       // ⟨M⟩
  tape out output        // ⟨M'⟩
  // M' ignores its input x, writes ⟨M⟩ on its tape c, runs M on it, then accepts.
  write out "machine·Mx·{¶tape·x¶tape·c¶write·c·"
  write out '"'  move out R
  while read(in) != _ { write out read(in)  move out R  move in R }
  write out '"'  move out R
  write out "¶while·!atstart(c)·{·move·c·L·}¶simulate·c·on·(c)¶accept¶}"
  accept
}` },
    { kind: 'prog', bind: { in: 'built', x: 'x', y: 'y' }, src:
`machine AcceptsEmpty {
  tape in readonly       // ⟨N⟩
  tape x                 // N's input, left blank
  tape y                 // N's second tape, if it has one
  // Stands in for a decider of P = { ⟨N⟩ : N accepts the empty string }.
  simulate in on (x, y) within 3000
  accept if ret == accept
}` },
    { kind: 'prog', bind: { in: 'x' }, src:
`machine Countdown {
  tape in readonly
  reg i : 0..3 = 0
  while i < 3 { inc i  move in R }   // three steps, then halt
  reject
}` },
    { kind: 'prog', bind: { in: 'x' }, src:
`machine Spin {
  tape in readonly
  while read(in) == read(in) { }     // never halts
}` },
  ],
  reductions: [{ from: 'H', to: 'AcceptsEmpty', via: ['RiceBuilder'], pos: [470, 330] }],
},
{
  key: 'blank', title: 'Empty world', tag: '∅',
  guide: 'A blank world with one tape and a starter program. Add tapes and machines with the buttons above the world, wire their ports in the inspector, and press Step.',
  target: 'Hello',
  tapes: [{ name: 'tape', init: 'abc' }],
  machines: [
    { kind: 'prog', bind: { t: 'tape' }, src:
`machine Hello {
  tape t
  reg seen : 0..20 = 0

  while read(t) != _ {
    write t x
    inc seen
    move t R
  }
  accept if seen > 2
}` },
  ],
},
];

const ISPAL_SRC = `# erase matching ends, shuttle back, repeat
tapes: t
start: q0
accept: yes
reject: no
q0, _ -> yes, _, S
q0, a -> haveA, _, R
q0, b -> haveB, _, R
haveA, a -> haveA, a, R
haveA, b -> haveA, b, R
haveA, _ -> checkA, _, L
haveB, a -> haveB, a, R
haveB, b -> haveB, b, R
haveB, _ -> checkB, _, L
checkA, a -> back, _, L
checkA, _ -> yes, _, S
checkA, b -> wipe, _, L
checkB, b -> back, _, L
checkB, _ -> yes, _, S
checkB, a -> wipe, _, L
back, a -> back, a, L
back, b -> back, b, L
back, _ -> q0, _, R
# mismatch: wipe the rest so the tape is clean for the caller
wipe, a -> wipe, _, L
wipe, b -> wipe, _, L
wipe, _ -> no, _, S`;
EXAMPLES.forEach(e => e.machines.forEach(m => { if (m.src === null) m.src = ISPAL_SRC; }));

const TEMPLATES = {
  script: `script NewScript(t) {
  // Free-form JavaScript. Runs as one opaque step, so its cost is not certified.
  // io.get(p) / io.set(p, s)       whole tape contents
  // io.read(p, i) / io.write(p, i, c)  single cells
  // io.coin(p)                      next coin from a random tape
  // return true to accept, false to reject
  const s = io.get('t');
  io.set('t', s.split('').reverse().join(''));
  return true;
}`,
  circuit: `circuit NewCircuit
# inputs x0, x1, ... are cells of the tape on port "in"
a = AND x0 x1
out = OR a x2`,
  prog: `machine NewProgram {
  tape t
  reg count : 0..9 = 0

  while read(t) != _ {
    move t R
  }
  accept
}`,
  tm: `tapes: t
start: q0
accept: qa
# nondeterministic            several rules for one state and reads = a branch
# exists: q1   forall: q2     ∃ and ∀ states (NP, coNP, the hierarchy)
# oracle: P    call: q3 P -> qyes, qno     oracle queries
q0, 0 -> q0, 1, R
q0, 1 -> q0, 0, R
q0, _ -> qa, _, S`,
  regex: `regex NewRegex
// | union, * star, + one or more, ? optional, ( ) grouping, ε empty string
(a|b)*abb`,
  cfg: `grammar NewGrammar
// nonterminals are capital letters; eps (or ε) is the empty string
S -> aSb | eps`,
  pda: `alphabet: a b
start: q0
accept: q0 q3          # or: accept by empty stack
# state, input, pop -> state, push    (eps = nothing; push lists symbols top first)
q0, a, eps -> q1, AZ   # first a: Z marks the bottom, A on top
q1, a, A -> q1, AA
q1, b, A -> q2, eps
q2, b, A -> q2, eps
q2, eps, Z -> q3, eps`,
  dfa: `alphabet: a b
start: q0
accept: q1
q0, a -> q1
q0, b -> q0
q1, a b -> q1`,
  nfa: `alphabet: a b
start: s
accept: f
s, a b -> s
s, a -> f
f, eps -> s`,
};


// world positions [x, y, tape width]
const LAYOUT = {
  dfa: { EvenOnes: [40, 40], EvenOnesProg: [860, 40], input: [400, 160, 400] },
  nfa: { ThirdFromLast: [40, 40], input: [400, 140, 420] },
  inc: { Increment: [40, 40], tape: [400, 140, 420] },
  pal: { IsPal: [40, 40], tape: [400, 140, 440], EndsMatch: [900, 40] },
  rev: { Reverse: [40, 40], input: [400, 60, 420], output: [400, 240, 420] },
  oracle: { BothPalindromes: [40, 40], input: [400, 40, 380], X: [400, 240, 380], IsPal: [860, 140] },
  np: { SubsetSum: [40, 40], input: [400, 20, 460], certificate: [400, 170, 460], work: [400, 320, 460] },
  bpp: { Majority5: [40, 40], input: [400, 60, 380], coins: [400, 260, 380], NoisyFirstBit: [860, 40] },
  blank: { Hello: [40, 40], tape: [400, 140, 420] },
  ph: { SigmaTwo: [40, 40], SigmaTwoOracle: [40, 440], input: [400, 80, 300], assign: [400, 260, 320], Phi: [780, 40], CounterY: [780, 440] },
  game: { TakeAway: [40, 40], pile: [400, 120, 380], NotMult3: [860, 40], TakeAwayTM: [860, 420] },
  reduce: { IndSet: [40, 40], Clique: [880, 40], Complement: [460, 40], CliqueToSAT: [880, 420], SatSolver: [880, 800], graph: [40, 470, 380], graph2: [40, 640, 380], formula: [40, 810, 380], pickA: [40, 980, 300], pickB: [380, 980, 300] },
  count: { PickNP: [40, 40], PickCount: [40, 420], PickPP: [40, 800], input: [400, 200, 400], len: [400, 60, 360], idx: [400, 1140, 360], HasOne: [400, 420], OddOnes: [400, 760], PickBPP: [860, 40], PickParity: [860, 420], CountOnesTM: [860, 800] },
  npguess: { SubsetSumGuess: [40, 40], input: [400, 60, 460], work: [400, 240, 460] },
  comm: { Alice: [40, 40], Bob: [860, 40], x: [400, 40, 340], y: [400, 200, 340], ch: [400, 360, 420], AliceR: [40, 440], BobR: [860, 440], coins: [400, 560, 420], ch2: [400, 720, 420] },
  construct: { ClockN2: [40, 40], RulerLog: [40, 420], input: [400, 120, 440], ruler: [400, 480, 300] },
  hier: { DTime: [40, 40], DSpace: [40, 420], desc: [400, 120, 460], work: [400, 300, 460], Scan: [900, 40], Square: [1220, 40], Forever: [900, 420], Copy: [1220, 420], Copy2: [1220, 800] },
  advice: { ParityByAdvice: [40, 40], bits: [400, 60, 340], circ: [400, 220, 400], Unary: [40, 420], unary: [400, 460, 340], bit: [400, 620, 340] },
  pcp: { SpotCheck: [40, 40], cnf: [400, 40, 520], coins: [400, 200, 400], pi: [400, 360, 340], Linearity: [40, 440], f: [400, 520, 340], ax: [400, 680, 220], ay: [640, 680, 220], az: [880, 680, 220] },
  panel: { Counter: [40, 720], Add: [380, 720], Parity4: [720, 720], Reverse: [1060, 720], count: [1000, 40, 300], a: [1000, 180, 300], b: [1000, 320, 300], sum: [1000, 460, 300], sw: [1060, 1100, 300], light: [1060, 1240, 300], text: [40, 1100, 300], out: [400, 1100, 300] },
  life: { Rule30: [40, 40], Rule110: [440, 40], grid: [40, 520, 820] },
  ip: { PeekingProver: [1180, 20], GNIVerifier: [40, 40], input: [400, 20, 380], coins: [400, 160, 300], msg: [400, 300, 380], shuffleCoins: [400, 440, 300], Shuffle: [860, 20], HonestProver: [860, 380], LazyProver: [1180, 380] },
  circuit: { Majority3: [40, 40], Equal3: [860, 40], input: [400, 120, 380], res: [400, 300, 300] },
  lang: { EndsAbb: [40, 40], EvenAs: [40, 420], word: [400, 160, 380], Arith: [860, 40], expr: [860, 420, 380], stack: [860, 560, 360] },
  pda: { AnBn: [40, 40], EvenPal: [40, 420], input: [400, 120, 400], stack: [400, 250, 360], stack2: [620, 250, 360], AnBnCn: [860, 40], abc: [860, 420, 380], s1: [860, 560, 300], s2: [1080, 560, 300] },
  halt: { U: [40, 40], code: [400, 40, 460], input: [400, 200, 300], EvenAs: [900, 40], Loop: [1220, 40], D: [40, 420], desc: [400, 470, 460], H: [900, 420], Optimist: [1220, 420], Narcissus: [40, 800], mirror: [400, 860, 460] },
  rice: { H: [40, 40], RiceBuilder: [460, 40], AcceptsEmpty: [880, 40], desc: [40, 470, 380], built: [440, 470, 400], x: [40, 640, 300], y: [380, 640, 300], Countdown: [880, 420], Spin: [1200, 420] },
  family: { Parity: [40, 40], ParityGen: [40, 420], ParityCircuit: [860, 40], BalancedGen: [400, 560], OddOnes: [860, 420], input: [400, 60, 380], desc: [400, 240, 380], out: [400, 420, 300] },
};
EXAMPLES.forEach(e => {
  const L = LAYOUT[e.key]; if (!L) return;
  e.tapes.forEach(t => { const p = L[t.name]; if (p) { t.pos = { x: p[0], y: p[1] }; if (p[2]) t.w = p[2]; } });
  e.machines.forEach(m => { const nm = m.name || (m.src.match(/(?:machine|script|circuit)\s+(\w+)/) || [])[1]; const p = L[nm]; if (p) m.pos = { x: p[0], y: p[1] }; });
});


const GRAPH_GEN = `// A random graph with n vertices (edge probability 1/2) and a random k.
(n, rand, pick) => {
  let bits = '';
  for (let i = 0; i < n * (n - 1) / 2; i++) bits += rand() < 0.5 ? '1' : '0';
  const k = Math.floor(rand() * (n + 1));
  return '1'.repeat(n) + '#' + bits + '#' + '1'.repeat(k);
}`;
// input generators and lab settings for the scaling lab
EXAMPLES.find(x => x.key === 'reduce').reductions.forEach(r => { r.gen = GRAPH_GEN; });
EXAMPLES.find(x => x.key === 'rice').reductions.forEach(r => { r.gen = `// A random small machine M, given as its description ⟨M⟩. It walks k cells, then
// accepts, rejects or loops forever. Some inputs are junk: by convention a string
// that describes no machine stands for one that rejects at once.
(n, rand, pick) => {
  if (rand() < 0.15) { let s = ''; for (let i = 0; i < n + 3; i++) s += pick('ab{}'); return s; }
  const k = Math.floor(rand() * (n + 1));
  const end = ['accept', 'reject', 'while·i·==·i·{·}'][Math.floor(rand() * 3)];
  return 'machine·Walk' + k + '·{¶tape·in·readonly¶reg·i·:·0..' + k + '·=·0¶while·i·<·' + k + '·{·inc·i·move·in·R·}¶' + end + '¶}';
}`; });
const EQ_GEN = `// Alice's x and Bob's y: equal half the time, otherwise one bit apart.
(n, rand, pick) => {
  let x = ''; for (let i = 0; i < n; i++) x += pick('01');
  let y = x;
  if (n && rand() < 0.5) { const i = Math.floor(rand() * n); y = x.slice(0, i) + (x[i] === '0' ? '1' : '0') + x.slice(i + 1); }
  return { x, y };
}`;
const GENS = {
  Alice: { lab: { metric: 'comm', mode: 'gen', from: 1, to: 24, step: 1, per: 6 }, gen: EQ_GEN },
  AliceR: { lab: { metric: 'comm', mode: 'gen', from: 1, to: 24, step: 1, per: 6 }, gen: EQ_GEN },
  IsPal: { lab: { mode: 'gen', from: 0, to: 40, step: 2, per: 12 }, gen: `// Palindromes are the worst case: the machine must check every pair.
// Every 4th input is a near-miss (one symbol flipped in the middle).
(n, rand, pick) => {
  let half = '';
  for (let i = 0; i < Math.floor(n / 2); i++) half += pick('ab');
  const mid = n % 2 ? pick('ab') : '';
  let s = half + mid + [...half].reverse().join('');
  if (rand() < 0.25 && n > 1) {
    const i = Math.floor(n / 2) - 1;
    s = s.slice(0, i) + (s[i] === 'a' ? 'b' : 'a') + s.slice(i + 1);
  }
  return s;
}` },
  BothPalindromes: { lab: { mode: 'gen', from: 2, to: 40, step: 2, per: 8 }, gen: `// Inputs of the form u#v where u and v are palindromes,
// so both oracle calls do their full amount of work.
(n, rand, pick) => {
  const pal = k => {
    let h = '';
    for (let i = 0; i < Math.floor(k / 2); i++) h += pick('ab');
    return h + (k % 2 ? pick('ab') : '') + [...h].reverse().join('');
  };
  const a = Math.floor(rand() * (n + 1));
  return pal(a) + '#' + pal(n - a);
}` },
  SubsetSum: { lab: { mode: 'gen', from: 1, to: 24, step: 1, per: 20 }, gen: `// A subset-sum instance together with a correct certificate.
// Returning an object fills several tapes at once, by tape name.
(n, rand, pick) => {
  const k = Math.max(1, Math.round(Math.sqrt(n)));   // how many numbers
  const nums = [], cert = [];
  let target = 0;
  for (let i = 0; i < k; i++) {
    const v = 1 + Math.floor(rand() * n);
    const take = rand() < 0.5 ? 1 : 0;
    nums.push('1'.repeat(v)); cert.push(take); target += take * v;
  }
  return { input: nums.join('#') + '$' + '1'.repeat(target), certificate: cert.join('') };
}` },
  SubsetSumGuess: { lab: { mode: 'gen', from: 1, to: 12, step: 1, per: 6 }, gen: `// A subset-sum instance (no certificate: the machine guesses one).
(n, rand, pick) => {
  const k = Math.max(1, Math.round(Math.sqrt(n)));
  const nums = []; let target = 0;
  for (let i = 0; i < k; i++) {
    const v = 1 + Math.floor(rand() * n); nums.push('1'.repeat(v));
    if (rand() < 0.5) target += v;
  }
  return nums.join('#') + '$' + '1'.repeat(target);
}` },
  ParityCircuit: { lab: { mode: 'random', from: 1, to: 32, step: 1, per: 2, metric: 'depth' } },
  TakeAway: { lab: { mode: 'auto', from: 0, to: 12, step: 1, per: 1 } },
  IndSet: { lab: { mode: 'gen', from: 1, to: 6, step: 1, per: 6 }, gen: GRAPH_GEN },
  Reverse: { lab: { mode: 'random', from: 0, to: 40, step: 2, per: 10 } },
  ClockN2: { lab: { mode: 'random', from: 0, to: 30, step: 1, per: 1, metric: 'time' } },
  RulerLog: { lab: { mode: 'random', from: 1, to: 64, step: 3, per: 1, metric: 'space' } },
  Majority5: { lab: { mode: 'random', from: 1, to: 20, step: 1, per: 20 } },
};
EXAMPLES.forEach(e => e.machines.forEach(m => {
  const nm = m.name || (m.src.match(/(?:machine|script|circuit)\s+(\w+)/) || [])[1]; const g = GENS[nm];
  if (g) { if (g.gen) m.gen = g.gen; if (g.lab) m.lab = g.lab; }
}));
if (typeof module !== 'undefined') module.exports = { EXAMPLES, TEMPLATES };
