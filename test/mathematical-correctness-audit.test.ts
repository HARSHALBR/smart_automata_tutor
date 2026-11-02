import test from 'node:test'
import assert from 'node:assert/strict'
import {
  type Automaton,
  type AutoState,
  EPSILON,
  runAutomaton,
  runAutomatonDetailed,
  isAccepting,
  validateAutomaton,
  completeDfaWithSink,
  findReachableStates,
  syncEdgesFromDelta,
  generateTransitionTable,
  formatTransitionTableMarkdown,
} from '../lib/automata'
import { convertNfaToDfa, epsilonClosure as nfaEpsilonClosure } from '../lib/subset-construction'
import { minimizeDfa } from '../lib/minimize'
import { compareAutomata, areAutomataEquivalent } from '../lib/equivalence'
import {
  parseRegex,
  tokenizeRegex,
  RegexParseError,
  formatRegexAst,
} from '../lib/regex-parser'
import {
  buildThompsonNfa,
  buildRegexPipeline,
} from '../lib/thompson-construction'
import {
  createBlankAutomaton,
  addStateToAutomaton,
  removeStateFromAutomaton,
  setAutomatonStartState,
  toggleAutomatonAcceptState,
  setAutomatonTransition,
  setAutomatonAlphabet,
  toggleAutomatonNfa,
  validateEditorAutomaton,
  verifyAgainstReference,
  parseTransitionTableText,
  exportTransitionTableText,
  SAMPLE_LEARNING_AUTOMATA,
} from '../lib/automata-editor'
import {
  solveProblem,
  buildDfaEndsWith,
  buildDfaContainsSubstring,
  buildDfaSymbolParity,
  buildDfaBinaryDivisibleBy,
  buildDfaLengthModulo,
  buildDfaSymbolCountModulo,
  buildDfaEmptyLanguage,
  buildDfaUniversalLanguage,
  combineDfas,
  complementDfa,
  differenceDfas,
} from '../lib/automata-solver'
import { parseQuestion } from '../lib/nlp-parser'

const testAccept = (auto: Automaton, str: string): boolean => {
  const trace = runAutomaton(auto, str)
  return isAccepting(auto, trace.at(-1)!.active)
}

// =========================================================================
// TASK 2A: DFA / NFA Semantics
// =========================================================================

test('semantics 1: empty input string ε behavior on DFA and NFA', () => {
  // DFA accepting epsilon (start state is accepting)
  const dfaAcceptsEmpty: Automaton = {
    id: 'dfa-empty-acc',
    name: 'DFA accepts epsilon',
    description: '',
    language: 'Strings with even zeros',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 0, y: 0, accept: true },
      { id: 'q1', x: 0, y: 0, accept: false },
    ],
    edges: [],
    delta: {
      q0: { '0': ['q1'], '1': ['q0'] },
      q1: { '0': ['q0'], '1': ['q1'] },
    },
    nondeterministic: false,
  }
  assert.equal(testAccept(dfaAcceptsEmpty, ''), true)

  // DFA rejecting epsilon (start state is non-accepting)
  const dfaRejectsEmpty: Automaton = {
    ...dfaAcceptsEmpty,
    states: [
      { id: 'q0', x: 0, y: 0, accept: false },
      { id: 'q1', x: 0, y: 0, accept: true },
    ],
  }
  assert.equal(testAccept(dfaRejectsEmpty, ''), false)
})

test('semantics 2: missing transitions in partial DFAs safely reject without throwing', () => {
  // Partial DFA: state q0 has transition on '0' only, no transition on '1'
  const partialDfa: Automaton = {
    id: 'partial-dfa',
    name: 'Partial DFA',
    description: '',
    language: '',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 0, y: 0, accept: false },
      { id: 'q1', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      q0: { '0': ['q1'] },
      q1: {},
    },
    nondeterministic: false,
  }

  // Reading '1' from q0 enters dead state and rejects safely
  const trace1 = runAutomaton(partialDfa, '1')
  assert.equal(isAccepting(partialDfa, trace1.at(-1)!.active), false)
  assert.equal(trace1.at(-1)!.active.length, 0)

  // Reading '0' reaches q1 (accepting)
  const trace0 = runAutomaton(partialDfa, '0')
  assert.equal(isAccepting(partialDfa, trace0.at(-1)!.active), true)

  // Completing with sink state makes it total and preserves language
  const completed = completeDfaWithSink(partialDfa)
  assert.equal(testAccept(completed, '0'), true)
  assert.equal(testAccept(completed, '1'), false)
  assert.equal(areAutomataEquivalent(partialDfa, completed), true)
})

test('semantics 3: multiple destinations for one NFA state-symbol pair', () => {
  // NFA: q0 on '0' can branch to q0 OR q1
  const nfaBranch: Automaton = {
    id: 'nfa-branch-test',
    name: 'NFA Branch',
    description: '',
    language: '',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 0, y: 0, accept: false },
      { id: 'q1', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      q0: { '0': ['q0', 'q1'], '1': ['q0'] },
      q1: {},
    },
    nondeterministic: true,
  }

  // String '0': q0 branches to {q0, q1}; since q1 is accepting, accepted!
  const trace0 = runAutomaton(nfaBranch, '0')
  assert.deepEqual(trace0.at(-1)!.active.sort(), ['q0', 'q1'])
  assert.equal(isAccepting(nfaBranch, trace0.at(-1)!.active), true)

  // String '1': q0 stays at {q0}; rejected!
  const trace1 = runAutomaton(nfaBranch, '1')
  assert.deepEqual(trace1.at(-1)!.active, ['q0'])
  assert.equal(isAccepting(nfaBranch, trace1.at(-1)!.active), false)
})

test('semantics 4: epsilon transitions and cycles terminate correctly', () => {
  // NFA with ε-cycle: q0 --ε--> q1 --ε--> q2 --ε--> q0
  const nfaEpsCycle: Automaton = {
    id: 'nfa-eps-cycle',
    name: 'NFA with ε-cycle',
    description: '',
    language: '',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 0, y: 0, accept: false },
      { id: 'q1', x: 0, y: 0, accept: false },
      { id: 'q2', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      q0: { [EPSILON]: ['q1'] },
      q1: { [EPSILON]: ['q2'] },
      q2: { [EPSILON]: ['q0'], '0': ['q0'] },
    },
    nondeterministic: true,
  }

  // Initial ε-closure must contain all three states without infinite loop
  const traceEmpty = runAutomaton(nfaEpsCycle, '')
  assert.deepEqual(traceEmpty[0].active.sort(), ['q0', 'q1', 'q2'])
  // Because q2 is in the initial ε-closure, empty string is accepted
  assert.equal(isAccepting(nfaEpsCycle, traceEmpty[0].active), true)

  // Reading '0' from active set {q0, q1, q2}:
  // Only q2 has transition on '0' -> destination is q0.
  // Then ε-closure(q0) gives {q0, q1, q2} again.
  const trace0 = runAutomaton(nfaEpsCycle, '0')
  assert.deepEqual(trace0.at(-1)!.active.sort(), ['q0', 'q1', 'q2'])
  assert.equal(isAccepting(nfaEpsCycle, trace0.at(-1)!.active), true)
})

test('semantics 5: epsilon transitions that reach accepting states without consuming input', () => {
  // q0 is non-accepting, but has ε-transition to accepting state q_acc
  const nfaEpsAccept: Automaton = {
    id: 'nfa-eps-acc',
    name: 'Epsilon reach accept',
    description: '',
    language: '',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 0, y: 0, accept: false },
      { id: 'q_acc', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      q0: { [EPSILON]: ['q_acc'], '0': ['q0'] },
      q_acc: {},
    },
    nondeterministic: true,
  }

  assert.equal(testAccept(nfaEpsAccept, ''), true)
})

test('semantics 6: empty alphabet and invalid state references produce validation errors', () => {
  const badAlphaAuto: Automaton = {
    id: 'bad-alpha',
    name: 'Bad Alpha',
    description: '',
    language: '',
    alphabet: [],
    start: 'q0',
    states: [{ id: 'q0', x: 0, y: 0 }],
    edges: [],
    delta: { q0: {} },
    nondeterministic: false,
  }
  const valAlpha = validateAutomaton(badAlphaAuto)
  assert.equal(valAlpha.valid, false)
  assert.ok(valAlpha.errors.some((e) => e.includes('Alphabet Σ cannot be empty')))

  const badRefAuto: Automaton = {
    id: 'bad-ref',
    name: 'Bad State Ref',
    description: '',
    language: '',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [{ id: 'q0', x: 0, y: 0 }],
    edges: [],
    delta: { q0: { '0': ['ghost_state'] } },
    nondeterministic: false,
  }
  const valRef = validateAutomaton(badRefAuto)
  assert.equal(valRef.valid, false)
  assert.ok(valRef.errors.some((e) => e.includes('nonexistent state "ghost_state"')))
})

test('semantics 7: start state also being an accepting state', () => {
  const startIsAccept: Automaton = {
    id: 'start-is-accept',
    name: 'Start is Accept',
    description: '',
    language: '',
    alphabet: ['a', 'b'],
    start: 'q0',
    states: [
      { id: 'q0', x: 0, y: 0, accept: true },
      { id: 'q1', x: 0, y: 0, accept: false },
    ],
    edges: [],
    delta: {
      q0: { a: ['q1'], b: ['q0'] },
      q1: { a: ['q0'], b: ['q1'] },
    },
    nondeterministic: false,
  }

  assert.equal(testAccept(startIsAccept, ''), true)
  assert.equal(testAccept(startIsAccept, 'b'), true)
  assert.equal(testAccept(startIsAccept, 'bb'), true)
  assert.equal(testAccept(startIsAccept, 'a'), false)
  assert.equal(testAccept(startIsAccept, 'ab'), false)
  assert.equal(testAccept(startIsAccept, 'aa'), true)
})

test('semantics 8: unreachable states and dead states do not alter language', () => {
  // DFA for strings containing '0':
  // q0 (start) -> 0 -> q1 (accept, loop)
  // q0 -> 1 -> q0
  // q_unreachable: accept: true, disconnected!
  // q_dead: accept: false, self loops
  const dfaWithUnreachable: Automaton = {
    id: 'unreachable-test',
    name: 'DFA with unreachable',
    description: '',
    language: 'Contains 0',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 0, y: 0, accept: false },
      { id: 'q1', x: 0, y: 0, accept: true },
      { id: 'q_unreachable', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      q0: { '0': ['q1'], '1': ['q0'] },
      q1: { '0': ['q1'], '1': ['q1'] },
      q_unreachable: { '0': ['q_unreachable'], '1': ['q_unreachable'] },
    },
    nondeterministic: false,
  }

  const reachable = findReachableStates(dfaWithUnreachable)
  assert.equal(reachable.has('q0'), true)
  assert.equal(reachable.has('q1'), true)
  assert.equal(reachable.has('q_unreachable'), false)

  // Simulation never visits unreachable state
  assert.equal(testAccept(dfaWithUnreachable, '111'), false)
  assert.equal(testAccept(dfaWithUnreachable, '101'), true)

  // Minimization strips the unreachable state
  const minResult = minimizeDfa(dfaWithUnreachable)
  assert.ok(minResult.unreachableStatesRemoved.includes('q_unreachable'))
  assert.equal(testAccept(minResult.minimized, '111'), false)
  assert.equal(testAccept(minResult.minimized, '101'), true)
})

test('semantics 9: empty-language and epsilon-only automata behave according to formal definitions', () => {
  const { automaton: emptyLangDfa } = buildDfaEmptyLanguage(['0', '1'])
  assert.equal(testAccept(emptyLangDfa, ''), false)
  assert.equal(testAccept(emptyLangDfa, '0'), false)
  assert.equal(testAccept(emptyLangDfa, '1'), false)
  assert.equal(testAccept(emptyLangDfa, '0101'), false)

  // Epsilon-only DFA
  const dfaEpsOnly: Automaton = {
    id: 'eps-only',
    name: 'Epsilon Only',
    description: '',
    language: '{ε}',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 0, y: 0, accept: true },
      { id: 'q_sink', x: 0, y: 0, accept: false },
    ],
    edges: [],
    delta: {
      q0: { '0': ['q_sink'], '1': ['q_sink'] },
      q_sink: { '0': ['q_sink'], '1': ['q_sink'] },
    },
    nondeterministic: false,
  }
  assert.equal(testAccept(dfaEpsOnly, ''), true)
  assert.equal(testAccept(dfaEpsOnly, '0'), false)
  assert.equal(testAccept(dfaEpsOnly, '1'), false)
  assert.equal(testAccept(dfaEpsOnly, '01'), false)
})

// =========================================================================
// TASK 2B: Subset Construction and Minimization
// =========================================================================

test('subset & minimization: epsilon closure terminates and includes start state', () => {
  const nfa: Automaton = {
    id: 'nfa-closure-test',
    name: 'NFA',
    description: '',
    language: '',
    alphabet: ['a'],
    start: 's0',
    states: [
      { id: 's0', x: 0, y: 0 },
      { id: 's1', x: 0, y: 0 },
    ],
    edges: [],
    delta: {
      s0: { [EPSILON]: ['s1'] },
      s1: {},
    },
    nondeterministic: true,
  }

  const closure = nfaEpsilonClosure(nfa, ['s0'])
  assert.deepEqual(closure, ['s0', 's1'])
  // Closure of an empty list is empty
  assert.deepEqual(nfaEpsilonClosure(nfa, []), [])
})

test('subset & minimization: subset construction preserves language equivalence across test strings', () => {
  // NFA recognizing strings where 2nd symbol from end is '1'
  const nfa = SAMPLE_LEARNING_AUTOMATA.nfa_ends_01.automaton
  const { dfa } = convertNfaToDfa(nfa)

  assert.equal(validateAutomaton(dfa, { completeDfaRequired: true }).valid, true)

  const testStrings = ['', '0', '1', '01', '11', '001', '101', '0101', '011']
  for (const str of testStrings) {
    const nfaResult = testAccept(nfa, str)
    const dfaResult = testAccept(dfa, str)
    assert.equal(dfaResult, nfaResult, `Discrepancy on string "${str}"`)
  }

  // Equivalence checker confirms language equivalence
  assert.equal(areAutomataEquivalent(nfa, dfa), true)
})

test('subset & minimization: DFA minimization preserves language and merges equivalent states', () => {
  // 5-state redundant DFA for strings containing 'ab' (s1 and s2 are equivalent)
  const redundantDfa: Automaton = {
    id: 'redundant-ab',
    name: 'Redundant ab',
    description: '',
    language: 'Contains ab',
    alphabet: ['a', 'b'],
    start: 's0',
    states: [
      { id: 's0', x: 0, y: 0, accept: false },
      { id: 's1', x: 0, y: 0, accept: false },
      { id: 's2', x: 0, y: 0, accept: false },
      { id: 's3', x: 0, y: 0, accept: true },
      { id: 's4', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      s0: { a: ['s1'], b: ['s2'] },
      s1: { a: ['s1'], b: ['s3'] },
      s2: { a: ['s1'], b: ['s2'] },
      s3: { a: ['s3'], b: ['s3'] },
      s4: { a: ['s4'], b: ['s4'] },
    },
    nondeterministic: false,
  }

  const { minimized, minimizedStateCount } = minimizeDfa(redundantDfa)
  // Canonical minimal DFA for "contains ab" has 3 states: (haven't seen 'a', seen 'a', seen 'ab')
  assert.equal(minimizedStateCount, 3)
  assert.equal(areAutomataEquivalent(redundantDfa, minimized), true)

  // Test representative strings
  const testSet = ['', 'a', 'b', 'ab', 'aab', 'bab', 'aba', 'ba', 'bb']
  for (const s of testSet) {
    assert.equal(testAccept(minimized, s), testAccept(redundantDfa, s))
  }
})

// =========================================================================
// TASK 2C: Language Equivalence & Counterexamples
// =========================================================================

test('equivalence 1: recognizes equivalent DFAs with completely different state names', () => {
  const dfa1 = SAMPLE_LEARNING_AUTOMATA.dfa_ends_01.automaton // states: q0, q1, q2
  const dfa2: Automaton = {
    id: 'dfa-isomorphic',
    name: 'Isomorphic Ends 01',
    description: '',
    language: 'Ends with 01',
    alphabet: ['0', '1'],
    start: 'alpha',
    states: [
      { id: 'alpha', x: 0, y: 0, accept: false },
      { id: 'beta', x: 0, y: 0, accept: false },
      { id: 'gamma', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      alpha: { '0': ['beta'], '1': ['alpha'] },
      beta: { '0': ['beta'], '1': ['gamma'] },
      gamma: { '0': ['beta'], '1': ['alpha'] },
    },
    nondeterministic: false,
  }

  const res = compareAutomata(dfa1, dfa2)
  assert.equal(res.equivalent, true)
  assert.equal(res.counterexample, undefined)
})

test('equivalence 2: shortest counterexample must truly be minimal and produce opposite verdicts', () => {
  // Machine A: accepts all strings ending in '01'
  const dfaA = SAMPLE_LEARNING_AUTOMATA.dfa_ends_01.automaton

  // Machine B: accepts all strings ending in '1'
  const dfaB: Automaton = {
    id: 'ends-with-1',
    name: 'Ends with 1',
    description: '',
    language: 'Ends with 1',
    alphabet: ['0', '1'],
    start: 's0',
    states: [
      { id: 's0', x: 0, y: 0, accept: false },
      { id: 's1', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      s0: { '0': ['s0'], '1': ['s1'] },
      s1: { '0': ['s0'], '1': ['s1'] },
    },
    nondeterministic: false,
  }

  const comp = compareAutomata(dfaA, dfaB)
  assert.equal(comp.equivalent, false)
  assert.notEqual(comp.counterexample, undefined)

  const w = comp.counterexample!
  // Distinguishing string on shortest check:
  // '' -> A rejects, B rejects (agree)
  // '0' -> A rejects, B rejects (agree)
  // '1' -> A rejects, B ACCEPTS (disagree!) -> shortest counterexample must be "1" of length 1!
  assert.equal(w, '1')

  const acceptA = testAccept(dfaA, w)
  const acceptB = testAccept(dfaB, w)
  assert.notEqual(acceptA, acceptB, 'Counterexample must produce strictly opposite results')
  assert.equal(acceptA, false)
  assert.equal(acceptB, true)
})

test('equivalence 3: empty-string counterexample when one machine accepts ε and the other rejects', () => {
  const dfaAcceptsEmpty = SAMPLE_LEARNING_AUTOMATA.dfa_even_zeros.automaton // accepts ''
  const dfaRejectsEmpty = SAMPLE_LEARNING_AUTOMATA.dfa_ends_01.automaton // rejects ''

  const comp = compareAutomata(dfaAcceptsEmpty, dfaRejectsEmpty)
  assert.equal(comp.equivalent, false)
  assert.equal(comp.counterexample, '', 'Shortest counterexample must be empty string ε')
})

test('equivalence 4: boolean operations union, intersection, complement, difference obey formal definitions', () => {
  // L(A) = strings ending with 0
  const dfaA: Automaton = {
    id: 'ends-0',
    name: 'Ends with 0',
    description: '',
    language: '',
    alphabet: ['0', '1'],
    start: 'a0',
    states: [
      { id: 'a0', x: 0, y: 0, accept: false },
      { id: 'a1', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      a0: { '0': ['a1'], '1': ['a0'] },
      a1: { '0': ['a1'], '1': ['a0'] },
    },
    nondeterministic: false,
  }

  // L(B) = strings with an even number of 0s
  const dfaB = SAMPLE_LEARNING_AUTOMATA.dfa_even_zeros.automaton

  // Union
  const union = combineDfas(dfaA, dfaB, 'union').automaton
  // Intersection
  const intersect = combineDfas(dfaA, dfaB, 'intersect').automaton
  // Complement of A
  const compA = complementDfa(dfaA).automaton
  // Difference A \ B
  const diffAB = differenceDfas(dfaA, dfaB).automaton

  const samples = ['', '0', '1', '00', '01', '10', '11', '000', '010', '100', '101']
  for (const s of samples) {
    const inA = testAccept(dfaA, s)
    const inB = testAccept(dfaB, s)

    assert.equal(testAccept(union, s), inA || inB, `Union failed on "${s}"`)
    assert.equal(testAccept(intersect, s), inA && inB, `Intersect failed on "${s}"`)
    assert.equal(testAccept(compA, s), !inA, `Complement failed on "${s}"`)
    assert.equal(testAccept(diffAB, s), inA && !inB, `Difference failed on "${s}"`)
  }
})

// =========================================================================
// TASK 2D: Regular Expressions
// =========================================================================

test('regex: precedence and language semantics for standard canonical expressions', () => {
  const cases: { expr: string; accepts: string[]; rejects: string[] }[] = [
    {
      expr: '0|1',
      accepts: ['0', '1'],
      rejects: ['', '00', '01', '10'],
    },
    {
      expr: '01',
      accepts: ['01'],
      rejects: ['', '0', '1', '10', '010'],
    },
    {
      expr: '0*1',
      accepts: ['1', '01', '001', '0001'],
      rejects: ['', '0', '00', '10', '011'],
    },
    {
      expr: '(0|1)*',
      accepts: ['', '0', '1', '00', '01', '1101'],
      rejects: [],
    },
    {
      expr: '(0|1)*01',
      accepts: ['01', '001', '101', '1101'],
      rejects: ['', '0', '1', '10', '010'],
    },
    {
      expr: '(01)*',
      accepts: ['', '01', '0101', '010101'],
      rejects: ['0', '1', '00', '10', '011'],
    },
    {
      expr: '0*',
      accepts: ['', '0', '00', '000'],
      rejects: ['1', '01', '10'],
    },
    {
      expr: 'ε',
      accepts: [''],
      rejects: ['0', '1', '00'],
    },
    {
      expr: '∅',
      accepts: [],
      rejects: ['', '0', '1', '00'],
    },
  ]

  for (const { expr, accepts, rejects } of cases) {
    const pipeline = buildRegexPipeline(expr, ['0', '1'])
    const { nfa, dfa, minimizedDfa } = pipeline

    // Verify all three machines in pipeline recognize the exact same language
    assert.equal(areAutomataEquivalent(nfa, dfa), true, `NFA and DFA not equivalent for "${expr}"`)
    assert.equal(areAutomataEquivalent(dfa, minimizedDfa), true, `DFA and MinDFA not equivalent for "${expr}"`)

    for (const w of accepts) {
      assert.equal(testAccept(minimizedDfa, w), true, `"${expr}" should accept "${w}"`)
    }
    for (const w of rejects) {
      assert.equal(testAccept(minimizedDfa, w), false, `"${expr}" should reject "${w}"`)
    }
  }
})

test('regex: handles nested parentheses and repeated Kleene stars', () => {
  // Repeated Kleene star: 0** is equivalent to 0*
  const p1 = buildRegexPipeline('0**', ['0', '1'])
  const p2 = buildRegexPipeline('0*', ['0', '1'])
  assert.equal(areAutomataEquivalent(p1.minimizedDfa, p2.minimizedDfa), true)

  // (0*)* is equivalent to 0*
  const p3 = buildRegexPipeline('(0*)*', ['0', '1'])
  assert.equal(areAutomataEquivalent(p3.minimizedDfa, p2.minimizedDfa), true)

  // Nested parentheses: ((0|1)*)* is equivalent to (0|1)*
  const p4 = buildRegexPipeline('((0|1)*)*', ['0', '1'])
  const p5 = buildRegexPipeline('(0|1)*', ['0', '1'])
  assert.equal(areAutomataEquivalent(p4.minimizedDfa, p5.minimizedDfa), true)
})

test('regex: rejects malformed expressions with actionable error messages', () => {
  const malformed = [
    { expr: '', err: 'empty' },
    { expr: '|', err: 'operand' },
    { expr: '0|', err: 'operand' },
    { expr: '*0', err: 'Kleene star' },
    { expr: '(0|1', err: 'Unclosed' },
    { expr: '0|1)', err: 'Unmatched' },
    { expr: '0||1', err: 'Consecutive' },
  ]

  for (const { expr, err } of malformed) {
    assert.throws(
      () => parseRegex(expr),
      (e: any) => e instanceof RegexParseError && e.message.toLowerCase().includes(err.toLowerCase()),
      `Expected error containing "${err}" for expression "${expr}"`,
    )
  }
})

// =========================================================================
// TASK 2E: Student Automaton Studio Editing & Serialization
// =========================================================================

test('editor studio: state addition, deletion, transitions, and round trips', () => {
  let auto = createBlankAutomaton(false, ['a', 'b'])

  // Add state s_new
  auto = addStateToAutomaton(auto, 's_new', true)
  assert.equal(auto.states.some((s) => s.id === 's_new' && s.accept === true), true)

  // Add transition
  auto = setAutomatonTransition(auto, 'q0', 'a', ['s_new'])
  assert.deepEqual(auto.delta.q0.a, ['s_new'])

  // Update alphabet to {a, b, c}
  auto = setAutomatonAlphabet(auto, ['a', 'b', 'c'])
  assert.deepEqual(auto.alphabet, ['a', 'b', 'c'])

  // Export to markdown table and re-import
  const exportedMd = exportTransitionTableText(auto)
  const importRes = parseTransitionTableText(exportedMd, false)
  assert.equal(importRes.success, true)
  assert.ok(importRes.automaton)

  // Verify exported & imported are equivalent
  assert.equal(areAutomataEquivalent(auto, importRes.automaton!), true)
})

test('editor studio: imports CSV and TSV tables properly', () => {
  // CSV format
  const csvTable = `State, 0, 1
->q0, q1, q0
*q1, q1, q0`

  const parsedCsv = parseTransitionTableText(csvTable, false)
  assert.equal(parsedCsv.success, true)
  assert.equal(parsedCsv.automaton!.start, 'q0')
  assert.equal(parsedCsv.automaton!.states.length, 2)
  assert.equal(parsedCsv.automaton!.states.find((s) => s.id === 'q1')?.accept, true)

  // TSV format
  const tsvTable = `State\t0\t1
->q0\tq1\tq0
*q1\tq1\tq0`

  const parsedTsv = parseTransitionTableText(tsvTable, false)
  assert.equal(parsedTsv.success, true)
  assert.equal(parsedTsv.automaton!.start, 'q0')
  assert.equal(parsedTsv.automaton!.states.length, 2)
})

test('editor studio: rejects malformed imported table with actionable error', () => {
  const badTable1 = ''
  const res1 = parseTransitionTableText(badTable1)
  assert.equal(res1.success, false)
  assert.ok(res1.error!.includes('header line and at least one state row'))

  const badTable2 = 'State\n->q0'
  const res2 = parseTransitionTableText(badTable2)
  assert.equal(res2.success, false)
  assert.ok(res2.error!.includes('at least one alphabet symbol'))
})

// =========================================================================
// TASK 3: Cross-Mode Integration (NL Solver vs Regex Pipeline vs Studio)
// =========================================================================

test('cross-mode 1: "Ends with 01" is consistent across NL solver, Regex, and Studio', () => {
  // 1. Natural Language Solver
  const nlSol = solveProblem({
    type: 'dfa_from_language',
    alphabet: ['0', '1'],
    languagePattern: { kind: 'ends_with', paramString: '01' },
  }).automaton

  // 2. Regular Expression Pipeline: (0|1)*01
  const regexDfa = buildRegexPipeline('(0|1)*01', ['0', '1']).minimizedDfa

  // 3. Studio Sample Preset
  const studioDfa = SAMPLE_LEARNING_AUTOMATA.dfa_ends_01.automaton

  // Cross-compare formal equivalence
  assert.equal(areAutomataEquivalent(nlSol, regexDfa), true, 'NL Solver and Regex DFA must be equivalent')
  assert.equal(areAutomataEquivalent(nlSol, studioDfa), true, 'NL Solver and Studio DFA must be equivalent')
  assert.equal(areAutomataEquivalent(regexDfa, studioDfa), true, 'Regex DFA and Studio DFA must be equivalent')

  // Sample test strings
  const testStrings = [
    { str: '01', accept: true },
    { str: '1001', accept: true },
    { str: '0', accept: false },
    { str: '1', accept: false },
    { str: '10', accept: false },
    { str: '', accept: false },
  ]
  for (const { str, accept } of testStrings) {
    assert.equal(testAccept(nlSol, str), accept)
    assert.equal(testAccept(regexDfa, str), accept)
    assert.equal(testAccept(studioDfa, str), accept)
  }
})

test('cross-mode 2: "Contains 101" is consistent across NL solver and Regex', () => {
  const nlSol = solveProblem({
    type: 'dfa_from_language',
    alphabet: ['0', '1'],
    languagePattern: { kind: 'contains_substring', paramString: '101' },
  }).automaton

  const regexDfa = buildRegexPipeline('(0|1)*101(0|1)*', ['0', '1']).minimizedDfa

  assert.equal(areAutomataEquivalent(nlSol, regexDfa), true)

  const testStrings = [
    { str: '101', accept: true },
    { str: '01010', accept: true },
    { str: '111011', accept: true },
    { str: '1001', accept: false },
    { str: '010', accept: false },
    { str: '', accept: false },
  ]
  for (const { str, accept } of testStrings) {
    assert.equal(testAccept(nlSol, str), accept)
    assert.equal(testAccept(regexDfa, str), accept)
  }
})

test('cross-mode 3: "Even number of zeros" is consistent across NL solver, Regex, and Studio', () => {
  const nlSol = solveProblem({
    type: 'dfa_from_language',
    alphabet: ['0', '1'],
    languagePattern: { kind: 'symbol_parity', symbol: '0', parity: 'even' },
  }).automaton

  // Regex for even number of zeros: 1*(01*01*)*
  const regexDfa = buildRegexPipeline('1*(01*01*)*', ['0', '1']).minimizedDfa
  const studioDfa = SAMPLE_LEARNING_AUTOMATA.dfa_even_zeros.automaton

  assert.equal(areAutomataEquivalent(nlSol, regexDfa), true)
  assert.equal(areAutomataEquivalent(nlSol, studioDfa), true)

  const testStrings = [
    { str: '', accept: true }, // 0 zeros is even
    { str: '00', accept: true },
    { str: '111', accept: true },
    { str: '01011', accept: true },
    { str: '0', accept: false },
    { str: '000', accept: false },
    { str: '101', accept: false },
  ]
  for (const { str, accept } of testStrings) {
    assert.equal(testAccept(nlSol, str), accept)
    assert.equal(testAccept(regexDfa, str), accept)
    assert.equal(testAccept(studioDfa, str), accept)
  }
})

test('cross-mode 4: "Count of ones divisible by 3" is consistent across NL solver and Regex', () => {
  const nlSol = solveProblem({
    type: 'dfa_from_language',
    alphabet: ['0', '1'],
    languagePattern: { kind: 'symbol_count_divisible', symbol: '1', divisor: 3, remainder: 0 },
  }).automaton

  // Regex for count of 1s divisible by 3: 0*(10*10*10*)*
  const regexDfa = buildRegexPipeline('0*(10*10*10*)*', ['0', '1']).minimizedDfa

  assert.equal(areAutomataEquivalent(nlSol, regexDfa), true)

  const testStrings = [
    { str: '', accept: true },
    { str: '111', accept: true },
    { str: '0101010', accept: true },
    { str: '1', accept: false },
    { str: '11', accept: false },
    { str: '1111', accept: false },
  ]
  for (const { str, accept } of testStrings) {
    assert.equal(testAccept(nlSol, str), accept)
    assert.equal(testAccept(regexDfa, str), accept)
  }
})

test('cross-mode 5: "Binary value divisible by 3" adheres to Horner rule and leading zero convention', () => {
  const nlSol = solveProblem({
    type: 'dfa_from_language',
    alphabet: ['0', '1'],
    languagePattern: { kind: 'binary_divisible', divisor: 3 },
  }).automaton

  // In binary, empty string evaluates to 0, which is divisible by 3
  assert.equal(testAccept(nlSol, ''), true)
  assert.equal(testAccept(nlSol, '0'), true) // 0 mod 3 == 0
  assert.equal(testAccept(nlSol, '00'), true) // 0 mod 3 == 0
  assert.equal(testAccept(nlSol, '11'), true) // 3 mod 3 == 0
  assert.equal(testAccept(nlSol, '110'), true) // 6 mod 3 == 0
  assert.equal(testAccept(nlSol, '1001'), true) // 9 mod 3 == 0
  assert.equal(testAccept(nlSol, '1100'), true) // 12 mod 3 == 0

  assert.equal(testAccept(nlSol, '1'), false) // 1 mod 3 == 1
  assert.equal(testAccept(nlSol, '10'), false) // 2 mod 3 == 2
  assert.equal(testAccept(nlSol, '100'), false) // 4 mod 3 == 1
  assert.equal(testAccept(nlSol, '101'), false) // 5 mod 3 == 2
  assert.equal(testAccept(nlSol, '111'), false) // 7 mod 3 == 1
})

test('cross-mode 6: "Length divisible by 3" is consistent across NL solver and Regex', () => {
  const nlSol = solveProblem({
    type: 'dfa_from_language',
    alphabet: ['0', '1'],
    languagePattern: { kind: 'length_divisible', divisor: 3, remainder: 0 },
  }).automaton

  // Regex: ((0|1)(0|1)(0|1))*
  const regexDfa = buildRegexPipeline('((0|1)(0|1)(0|1))*', ['0', '1']).minimizedDfa

  assert.equal(areAutomataEquivalent(nlSol, regexDfa), true)

  const testStrings = [
    { str: '', accept: true }, // len 0
    { str: '010', accept: true }, // len 3
    { str: '111000', accept: true }, // len 6
    { str: '0', accept: false }, // len 1
    { str: '01', accept: false }, // len 2
    { str: '1111', accept: false }, // len 4
  ]
  for (const { str, accept } of testStrings) {
    assert.equal(testAccept(nlSol, str), accept)
    assert.equal(testAccept(regexDfa, str), accept)
  }
})

test('cross-mode 7: Empty language and Epsilon-only language cross-mode consistency', () => {
  // Empty language
  const nlEmpty = solveProblem({
    type: 'dfa_from_language',
    alphabet: ['0', '1'],
    languagePattern: { kind: 'empty_language' },
  }).automaton

  const regexEmpty = buildRegexPipeline('∅', ['0', '1']).minimizedDfa
  assert.equal(areAutomataEquivalent(nlEmpty, regexEmpty), true)

  // Epsilon-only language
  const nlEps = solveProblem({
    type: 'dfa_from_language',
    alphabet: ['0', '1'],
    languagePattern: { kind: 'empty_string_only' },
  }).automaton

  const regexEps = buildRegexPipeline('ε', ['0', '1']).minimizedDfa
  assert.equal(areAutomataEquivalent(nlEps, regexEps), true)
})

// =========================================================================
// TASK 4: Reliability & Error Handling
// =========================================================================

test('reliability: ambiguous or unsupported queries request clarification instead of returning wrong automaton', () => {
  // Ambiguous divisibility without context
  const res1 = parseQuestion('Construct a machine divisible by 3')
  assert.equal(res1.needsClarification, true)
  assert.equal(res1.problemSpec, undefined)
  assert.ok(res1.clarificationPrompt!.includes('divisible by 3'))
  assert.ok(res1.clarificationOptions!.length >= 2)

  // Vague query
  const res2 = parseQuestion('hello can you help me')
  assert.equal(res2.needsClarification, true)
  assert.equal(res2.problemSpec, undefined)
})
