import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  type Automaton,
  validateAutomaton,
  completeDfaWithSink,
  runAutomatonDetailed,
  syncEdgesFromDelta,
  generateTransitionTable,
  DFA_EVEN_ZEROS,
  DFA_ENDS_01,
  NFA_THIRD_FROM_END,
  NFA_EPSILON,
  EPSILON,
} from '../lib/automata'
import {
  buildDfaEndsWith,
  buildDfaStartsWith,
  buildDfaContainsSubstring,
  buildDfaLengthAtLeast,
  buildDfaSymbolCountAtLeast,
  buildDfaLengthExact,
  buildDfaEmptyLanguage,
  buildDfaUniversalLanguage,
  buildDfaOnlyEmptyString,
  buildDfaDualParity,
  solveProblem,
} from '../lib/automata-solver'
import { convertNfaToDfa, epsilonClosure } from '../lib/subset-construction'
import { minimizeDfa, REDUNDANT_DFA } from '../lib/minimize'
import { compareAutomata } from '../lib/equivalence'
import { parseQuestion } from '../lib/nlp-parser'
import { layoutAutomaton } from '../lib/graph-layout'

/* -------------------------------------------------------------------------- */
/*             1. Empty String and Empty Alphabet Edge Cases                 */
/* -------------------------------------------------------------------------- */

test('Empty language DFA correctly rejects all inputs including empty string', () => {
  const { automaton } = buildDfaEmptyLanguage(['0', '1'])
  const val = validateAutomaton(automaton)
  assert.equal(val.valid, true)
  assert.equal(val.isCompleteDfa, true)

  const testInputs = ['', '0', '1', '00', '01', '10', '11', '010101']
  for (const w of testInputs) {
    const res = runAutomatonDetailed(automaton, w)
    assert.equal(res.accepted, false, `Expected rejection for "${w}" in empty language`)
  }
})

test('Universal language DFA correctly accepts all inputs including empty string', () => {
  const { automaton } = buildDfaUniversalLanguage(['0', '1'])
  const val = validateAutomaton(automaton)
  assert.equal(val.valid, true)
  assert.equal(val.isCompleteDfa, true)

  const testInputs = ['', '0', '1', '00', '01', '10', '11', '010101']
  for (const w of testInputs) {
    const res = runAutomatonDetailed(automaton, w)
    assert.equal(res.accepted, true, `Expected acceptance for "${w}" in universal language`)
  }
})

test('Only-empty-string DFA accepts epsilon and rejects all non-empty strings', () => {
  const { automaton } = buildDfaOnlyEmptyString(['a', 'b'])
  const val = validateAutomaton(automaton)
  assert.equal(val.valid, true)
  assert.equal(val.isCompleteDfa, true)

  assert.equal(runAutomatonDetailed(automaton, '').accepted, true)
  assert.equal(runAutomatonDetailed(automaton, 'a').accepted, false)
  assert.equal(runAutomatonDetailed(automaton, 'b').accepted, false)
  assert.equal(runAutomatonDetailed(automaton, 'ab').accepted, false)
  assert.equal(runAutomatonDetailed(automaton, 'ba').accepted, false)
})

test('Validation fails when alphabet is empty', () => {
  const emptyAlphaAutomaton: Automaton = {
    id: 'empty-alpha',
    name: 'Empty Alphabet',
    description: '',
    language: '',
    alphabet: [],
    start: 'q0',
    states: [{ id: 'q0', x: 0, y: 0, accept: true }],
    edges: [],
    delta: { q0: {} },
    nondeterministic: false,
  }
  const val = validateAutomaton(emptyAlphaAutomaton)
  assert.equal(val.valid, false)
  assert.ok(val.errors.some((e) => e.includes('Alphabet Σ cannot be empty')))
})

/* -------------------------------------------------------------------------- */
/*           2. Missing DFA Transitions and Sink State Completion             */
/* -------------------------------------------------------------------------- */

test('Incomplete DFA completion adds explicit sink and achieves completeness', () => {
  // DFA accepting '0' only, missing transitions on '1' and from q1
  const incompleteDfa: Automaton = {
    id: 'incomplete-dfa',
    name: 'Incomplete DFA',
    description: '',
    language: 'Only string "0"',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 100, y: 100, accept: false },
      { id: 'q1', x: 250, y: 100, accept: true },
    ],
    edges: [{ from: 'q0', to: 'q1', label: '0' }],
    delta: {
      q0: { '0': ['q1'] },
      q1: {},
    },
    nondeterministic: false,
  }

  const initialVal = validateAutomaton(incompleteDfa, { completeDfaRequired: true })
  assert.equal(initialVal.valid, false)
  assert.equal(initialVal.isCompleteDfa, false)

  const completed = completeDfaWithSink(incompleteDfa, 'q_sink')
  const completedVal = validateAutomaton(completed, { completeDfaRequired: true })
  assert.equal(completedVal.valid, true)
  assert.equal(completedVal.isCompleteDfa, true)

  // Verify behavior
  assert.equal(runAutomatonDetailed(completed, '0').accepted, true)
  assert.equal(runAutomatonDetailed(completed, '1').accepted, false)
  assert.equal(runAutomatonDetailed(completed, '00').accepted, false)
  assert.equal(runAutomatonDetailed(completed, '01').accepted, false)
})

/* -------------------------------------------------------------------------- */
/*      3. NFA Multiple Destinations, Epsilon-Closure & Branching            */
/* -------------------------------------------------------------------------- */

test('NFA simulation handles multi-branching epsilon-chains and cycles', () => {
  // Complex NFA with epsilon cycles: s -> a (via eps), a -> b (via eps), b -> a (via eps), b -> accept (via 'x')
  const cyclicNfa: Automaton = {
    id: 'cyclic-eps-nfa',
    name: 'Cyclic Epsilon NFA',
    description: '',
    language: 'Strings with x',
    alphabet: ['x', 'y'],
    start: 's',
    states: [
      { id: 's', x: 50, y: 100 },
      { id: 'a', x: 150, y: 100 },
      { id: 'b', x: 250, y: 100 },
      { id: 'c', x: 350, y: 100, accept: true },
    ],
    edges: [],
    delta: {
      s: { [EPSILON]: ['a'] },
      a: { [EPSILON]: ['b'] },
      b: { [EPSILON]: ['a'], x: ['c'] },
      c: { y: ['c'] },
    },
    nondeterministic: true,
  }

  // Epsilon closure of start state should include s, a, b without infinite loop
  const startClosure = epsilonClosure(cyclicNfa, ['s'])
  assert.deepEqual(startClosure.sort(), ['a', 'b', 's'])

  // Simulation
  assert.equal(runAutomatonDetailed(cyclicNfa, 'x').accepted, true)
  assert.equal(runAutomatonDetailed(cyclicNfa, 'xy').accepted, true)
  assert.equal(runAutomatonDetailed(cyclicNfa, 'xyy').accepted, true)
  assert.equal(runAutomatonDetailed(cyclicNfa, 'y').accepted, false)
})

/* -------------------------------------------------------------------------- */
/*                    4. Unreachable States Detection & Pruning               */
/* -------------------------------------------------------------------------- */

test('Minimization and validation handle unreachable states correctly', () => {
  const dfaWithUnreachable: Automaton = {
    id: 'unreachable-test',
    name: 'DFA with Unreachable States',
    description: '',
    language: 'Even length',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 100, y: 100, accept: true },
      { id: 'q1', x: 200, y: 100, accept: false },
      { id: 'ghost_accept', x: 300, y: 300, accept: true },
      { id: 'ghost_reject', x: 400, y: 300, accept: false },
    ],
    edges: [],
    delta: {
      q0: { '0': ['q1'], '1': ['q1'] },
      q1: { '0': ['q0'], '1': ['q0'] },
      ghost_accept: { '0': ['ghost_reject'], '1': ['ghost_reject'] },
      ghost_reject: { '0': ['ghost_accept'], '1': ['ghost_accept'] },
    },
    nondeterministic: false,
  }

  const val = validateAutomaton(dfaWithUnreachable)
  assert.equal(val.unreachableStates.length, 2)
  assert.ok(val.unreachableStates.includes('ghost_accept'))
  assert.ok(val.unreachableStates.includes('ghost_reject'))

  const minResult = minimizeDfa(dfaWithUnreachable)
  assert.equal(minResult.unreachableStatesRemoved.length, 2)
  assert.equal(minResult.minimized.states.length, 2)
  // Language preserved
  assert.equal(runAutomatonDetailed(minResult.minimized, '').accepted, true)
  assert.equal(runAutomatonDetailed(minResult.minimized, '0').accepted, false)
  assert.equal(runAutomatonDetailed(minResult.minimized, '01').accepted, true)
})

/* -------------------------------------------------------------------------- */
/*      5. Equivalence with Different State Names & Counterexamples          */
/* -------------------------------------------------------------------------- */

test('compareAutomata recognizes isomorphic DFAs with completely different state names', () => {
  // DFA 1: states {q0, q1} for odd number of 1s
  const dfa1: Automaton = {
    id: 'dfa-odd-1s-standard',
    name: 'DFA 1 (q0, q1)',
    description: '',
    language: 'Odd number of 1s',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 0, y: 0, accept: false },
      { id: 'q1', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      q0: { '0': ['q0'], '1': ['q1'] },
      q1: { '0': ['q1'], '1': ['q0'] },
    },
    nondeterministic: false,
  }

  // DFA 2: states {alpha, beta} for odd number of 1s
  const dfa2: Automaton = {
    id: 'dfa-odd-1s-greek',
    name: 'DFA 2 (alpha, beta)',
    description: '',
    language: 'Odd number of 1s',
    alphabet: ['0', '1'],
    start: 'alpha',
    states: [
      { id: 'alpha', x: 0, y: 0, accept: false },
      { id: 'beta', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      alpha: { '0': ['alpha'], '1': ['beta'] },
      beta: { '0': ['beta'], '1': ['alpha'] },
    },
    nondeterministic: false,
  }

  const comp = compareAutomata(dfa1, dfa2)
  assert.equal(comp.equivalent, true)
  assert.equal(comp.counterexample, undefined)
})

test('compareAutomata finds exact shortest counterexample for non-equivalent automata', () => {
  // DFA A accepts strings ending in '01'
  const dfaA = buildDfaEndsWith(['0', '1'], '01').automaton
  // DFA B accepts strings ending in '10'
  const dfaB = buildDfaEndsWith(['0', '1'], '10').automaton

  const comp = compareAutomata(dfaA, dfaB)
  assert.equal(comp.equivalent, false)
  assert.ok(comp.counterexample !== undefined)

  const w = comp.counterexample!
  const resA = runAutomatonDetailed(dfaA, w).accepted
  const resB = runAutomatonDetailed(dfaB, w).accepted
  assert.notEqual(resA, resB, `Counterexample "${w}" must be accepted by exactly one machine`)
  assert.equal(w.length, 2, 'Shortest counterexample between ends-with-01 and ends-with-10 should have length 2')
})

test('compareAutomata detects alphabet mismatch with distinguishing counterexample', () => {
  // DFA A: {0, 1} ending in 1
  const dfaA = buildDfaEndsWith(['0', '1'], '1').automaton
  // DFA B: {0, 1, 2} ending in 1
  const dfaB = buildDfaEndsWith(['0', '1', '2'], '1').automaton

  const comp = compareAutomata(dfaA, dfaB)
  assert.equal(comp.equivalent, false)
  assert.ok(comp.explanation.includes('different declared alphabets'))
  // Counterexample containing '2' (e.g., '21' accepted by B, rejected by A)
  if (comp.counterexample) {
    const resA = runAutomatonDetailed(dfaA, comp.counterexample).accepted
    const resB = runAutomatonDetailed(dfaB, comp.counterexample).accepted
    assert.notEqual(resA, resB)
  }
})

/* -------------------------------------------------------------------------- */
/*             6. Alphabets with > 2 Symbols (Ternary & Alpha)                */
/* -------------------------------------------------------------------------- */

test('DFA synthesis works correctly over 3-symbol alphabet {a, b, c}', () => {
  const alphabet = ['a', 'b', 'c']
  const { automaton } = buildDfaEndsWith(alphabet, 'abc')

  const val = validateAutomaton(automaton, { completeDfaRequired: true })
  assert.equal(val.valid, true)
  assert.equal(val.isCompleteDfa, true)

  assert.equal(runAutomatonDetailed(automaton, 'abc').accepted, true)
  assert.equal(runAutomatonDetailed(automaton, 'cbaabc').accepted, true)
  assert.equal(runAutomatonDetailed(automaton, 'abcabc').accepted, true)
  assert.equal(runAutomatonDetailed(automaton, 'ab').accepted, false)
  assert.equal(runAutomatonDetailed(automaton, 'abcb').accepted, false)
})

/* -------------------------------------------------------------------------- */
/*             7. Long Patterns and KMP Prefix-Suffix Transitions            */
/* -------------------------------------------------------------------------- */

test('Substring DFA handles longer patterns (10101) with correct fallback transitions', () => {
  const { automaton } = buildDfaContainsSubstring(['0', '1'], '10101')
  const val = validateAutomaton(automaton, { completeDfaRequired: true })
  assert.equal(val.valid, true)
  assert.equal(val.isCompleteDfa, true)

  // Test overlapping occurrences
  assert.equal(runAutomatonDetailed(automaton, '10101').accepted, true)
  assert.equal(runAutomatonDetailed(automaton, '1010101').accepted, true)
  assert.equal(runAutomatonDetailed(automaton, '00010101000').accepted, true)
  assert.equal(runAutomatonDetailed(automaton, '10100101').accepted, false)
  assert.equal(runAutomatonDetailed(automaton, '1010').accepted, false)
})

/* -------------------------------------------------------------------------- */
/*             8. State Names with Unusual Characters                        */
/* -------------------------------------------------------------------------- */

test('Automata algorithms handle state names with unusual characters (colons, arrows, braces)', () => {
  const specialDfa: Automaton = {
    id: 'special-names',
    name: 'Special Characters DFA',
    description: '',
    language: 'Strings with 1',
    alphabet: ['0', '1'],
    start: 'q->init:0',
    states: [
      { id: 'q->init:0', x: 100, y: 100, accept: false },
      { id: '{q1,q2}[accept]', x: 250, y: 100, accept: true },
    ],
    edges: [],
    delta: {
      'q->init:0': { '0': ['q->init:0'], '1': ['{q1,q2}[accept]'] },
      '{q1,q2}[accept]': { '0': ['{q1,q2}[accept]'], '1': ['{q1,q2}[accept]'] },
    },
    nondeterministic: false,
  }

  // Edge synchronization with null delimiter
  specialDfa.edges = syncEdgesFromDelta(specialDfa.states, specialDfa.delta)
  assert.equal(specialDfa.edges.length, 3)

  // Layout handles long special label
  const layout = layoutAutomaton(specialDfa)
  assert.equal(layout.states.length, 2)
  const acceptNode = layout.states.find((s) => s.id === '{q1,q2}[accept]')!
  assert.ok(acceptNode.rx > 30, 'Dynamic capsule rx should accommodate long label')

  // Validation
  const val = validateAutomaton(specialDfa, { completeDfaRequired: true })
  assert.equal(val.valid, true)

  // Simulation
  assert.equal(runAutomatonDetailed(specialDfa, '0010').accepted, true)
  assert.equal(runAutomatonDetailed(specialDfa, '0000').accepted, false)
})

/* -------------------------------------------------------------------------- */
/*      9. Ambiguity Detection & Clarification Handling in NLP Parser        */
/* -------------------------------------------------------------------------- */

test('Parser requests clarification for ambiguous divisibility without binary/length context', () => {
  const parsed = parseQuestion('Construct a DFA divisible by 3')
  assert.equal(parsed.success, false)
  assert.equal(parsed.needsClarification, true)
  assert.ok(parsed.clarificationPrompt?.includes('binary numerical value'))
  assert.ok(parsed.clarificationPrompt?.includes('string length'))
})

test('Parser parses unambiguous binary divisibility vs length divisibility correctly', () => {
  const parsedBinary = parseQuestion('Construct a DFA binary value divisible by 3')
  assert.equal(parsedBinary.success, true)
  assert.equal(parsedBinary.problemSpec?.languagePattern?.kind, 'binary_divisible')

  const parsedLength = parseQuestion('Construct a DFA whose string length is divisible by 3')
  assert.equal(parsedLength.success, true)
  assert.equal(parsedLength.problemSpec?.languagePattern?.kind, 'length_divisible')
})

test('Parser parses dual parity: even number of zeros and odd number of ones', () => {
  const parsed = parseQuestion('Construct a DFA with an even number of zeros and an odd number of ones')
  assert.equal(parsed.success, true)
  assert.equal(parsed.problemSpec?.languagePattern?.kind, 'dual_parity')
  assert.equal(parsed.problemSpec?.languagePattern?.symbol, '0')
  assert.equal(parsed.problemSpec?.languagePattern?.parity, 'even')
  assert.equal(parsed.problemSpec?.languagePattern?.secondSymbol, '1')
  assert.equal(parsed.problemSpec?.languagePattern?.secondParity, 'odd')

  const solution = solveProblem(parsed.problemSpec!)
  assert.equal(solution.automaton.states.length, 4)
  // Verify dual parity behavior
  // '001': two 0s (even), one 1 (odd) -> ACCEPT
  assert.equal(runAutomatonDetailed(solution.automaton, '001').accepted, true)
  // '01': one 0 (odd), one 1 (odd) -> REJECT
  assert.equal(runAutomatonDetailed(solution.automaton, '01').accepted, false)
  // '': zero 0s (even), zero 1s (even) -> REJECT
  assert.equal(runAutomatonDetailed(solution.automaton, '').accepted, false)
})

test('Parser parses multi-character starts and ends condition', () => {
  const parsed = parseQuestion('Construct a DFA that starts with 01 and ends with 10')
  assert.equal(parsed.success, true)
  assert.equal(parsed.problemSpec?.languagePattern?.kind, 'starts_and_ends')
  assert.equal(parsed.problemSpec?.languagePattern?.startSymbol, '01')
  assert.equal(parsed.problemSpec?.languagePattern?.endSymbol, '10')

  const solution = solveProblem(parsed.problemSpec!)
  assert.equal(runAutomatonDetailed(solution.automaton, '0110').accepted, true)
  assert.equal(runAutomatonDetailed(solution.automaton, '010010').accepted, true)
  assert.equal(runAutomatonDetailed(solution.automaton, '01').accepted, false)
  assert.equal(runAutomatonDetailed(solution.automaton, '10').accepted, false)
})

/* -------------------------------------------------------------------------- */
/*      10. Regression Tests for Existing Curricula & Pre-existing Assets    */
/* -------------------------------------------------------------------------- */

test('Pre-existing curriculum DFAs and NFAs maintain invariant validity', () => {
  // DFA Even Zeros
  const valEven = validateAutomaton(DFA_EVEN_ZEROS, { completeDfaRequired: true })
  assert.equal(valEven.valid, true)
  assert.equal(valEven.isDeterministic, true)
  assert.equal(valEven.isCompleteDfa, true)

  // DFA Ends 01
  const valEnds = validateAutomaton(DFA_ENDS_01, { completeDfaRequired: true })
  assert.equal(valEnds.valid, true)
  assert.equal(valEnds.isDeterministic, true)
  assert.equal(valEnds.isCompleteDfa, true)

  // NFA Third from End
  const valNfa3 = validateAutomaton(NFA_THIRD_FROM_END)
  assert.equal(valNfa3.valid, true)

  // NFA Epsilon
  const valEps = validateAutomaton(NFA_EPSILON)
  assert.equal(valEps.valid, true)

  // Redundant DFA for contains "ab" (5 states) minimizes to exactly 3 states
  const minRedundant = minimizeDfa(REDUNDANT_DFA)
  assert.equal(minRedundant.minimized.states.length, 3)
  assert.equal(compareAutomata(REDUNDANT_DFA, minRedundant.minimized).equivalent, true)
})

test('Transition table generation matches automaton delta exactly', () => {
  const table = generateTransitionTable(DFA_ENDS_01)
  assert.equal(table.rows.length, DFA_ENDS_01.states.length)
  for (const row of table.rows) {
    for (const sym of DFA_ENDS_01.alphabet) {
      assert.deepEqual(row.targets[sym], DFA_ENDS_01.delta[row.state]?.[sym] ?? [])
    }
  }
})
