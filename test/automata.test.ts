import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DFA_EXAMPLES,
  NFA_EXAMPLES,
  EPSILON,
  runAutomaton,
  runAutomatonDetailed,
  isAccepting,
  validateAutomaton,
  completeDfaWithSink,
  syncEdgesFromDelta,
  syncDeltaFromEdges,
  generateTransitionTable,
  formatTransitionTableMarkdown,
  findReachableStates,
  type Automaton,
} from '../lib/automata'

test('DFA Even Zeros simulation', () => {
  const dfa = DFA_EXAMPLES[0] // Even number of 0s
  assert.equal(isAccepting(dfa, runAutomaton(dfa, '')[0].active), true) // ε has 0 zeros (even)
  assert.equal(isAccepting(dfa, runAutomaton(dfa, '0')[1].active), false)
  assert.equal(isAccepting(dfa, runAutomaton(dfa, '00')[2].active), true)
  assert.equal(isAccepting(dfa, runAutomaton(dfa, '111')[3].active), true)
  assert.equal(isAccepting(dfa, runAutomaton(dfa, '01010')[5].active), false)
  assert.equal(isAccepting(dfa, runAutomaton(dfa, '010100')[6].active), true)
})

test('DFA Ends with 01 simulation and detailed tracing', () => {
  const dfa = DFA_EXAMPLES[1] // Ends with 01
  const resultAccepted = runAutomatonDetailed(dfa, '1001')
  assert.equal(resultAccepted.accepted, true)
  assert.equal(resultAccepted.steps.length, 5) // 0 + 4 steps
  assert.ok(resultAccepted.verdictExplanation.includes('Accepted'))

  const resultRejected = runAutomatonDetailed(dfa, '1010')
  assert.equal(resultRejected.accepted, false)
  assert.ok(resultRejected.verdictExplanation.includes('Rejected'))
})

test('NFA with epsilon-transitions simulation', () => {
  const nfa = NFA_EXAMPLES[1] // Multiples of 2 or 3 in 'a's
  const step0 = runAutomaton(nfa, '')[0]
  // ε-closure of 's' should include s, t0, h0
  assert.ok(step0.active.includes('s'))
  assert.ok(step0.active.includes('t0'))
  assert.ok(step0.active.includes('h0'))
  // Length 0 is multiple of 2 and 3 -> accept
  assert.equal(isAccepting(nfa, step0.active), true)

  // 'a' (length 1) -> neither
  const step1 = runAutomaton(nfa, 'a')[1]
  assert.equal(isAccepting(nfa, step1.active), false)

  // 'aa' (length 2) -> multiple of 2 -> accept
  const step2 = runAutomaton(nfa, 'aa')[2]
  assert.equal(isAccepting(nfa, step2.active), true)

  // 'aaa' (length 3) -> multiple of 3 -> accept
  const step3 = runAutomaton(nfa, 'aaa')[3]
  assert.equal(isAccepting(nfa, step3.active), true)

  // 'aaaaa' (length 5) -> reject
  const step5 = runAutomaton(nfa, 'aaaaa')[5]
  assert.equal(isAccepting(nfa, step5.active), false)

  // 'aaaaaa' (length 6) -> accept
  const step6 = runAutomaton(nfa, 'aaaaaa')[6]
  assert.equal(isAccepting(nfa, step6.active), true)
})

test('validateAutomaton identifies valid DFAs and NFAs', () => {
  const dfaCheck = validateAutomaton(DFA_EXAMPLES[0], { completeDfaRequired: true })
  assert.equal(dfaCheck.valid, true)
  assert.equal(dfaCheck.errors.length, 0)
  assert.equal(dfaCheck.isDeterministic, true)
  assert.equal(dfaCheck.isCompleteDfa, true)

  const nfaCheck = validateAutomaton(NFA_EXAMPLES[0])
  assert.equal(nfaCheck.valid, true)
  assert.equal(nfaCheck.isDeterministic, false)
})

test('validateAutomaton catches structural defects', () => {
  const broken: Automaton = {
    id: 'broken',
    name: 'Broken',
    description: '',
    language: '',
    alphabet: ['0', '1'],
    start: 'missing_start',
    states: [{ id: 'q0', x: 0, y: 0 }],
    edges: [],
    delta: {
      q0: {
        '2': ['q0'], // invalid symbol '2'
        '0': ['ghost_state'], // invalid destination
      },
    },
  }

  const check = validateAutomaton(broken)
  assert.equal(check.valid, false)
  assert.ok(check.errors.some((e) => e.includes('missing_start')))
  assert.ok(check.errors.some((e) => e.includes('not in alphabet')))
  assert.ok(check.errors.some((e) => e.includes('ghost_state')))
})

test('validateAutomaton detects incomplete DFA and unreachable states', () => {
  const incomplete: Automaton = {
    id: 'incomplete',
    name: 'Incomplete DFA',
    description: '',
    language: '',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 0, y: 0 },
      { id: 'unreachable', x: 100, y: 100, accept: true },
    ],
    edges: [],
    delta: {
      q0: { '0': ['q0'] }, // missing '1'
      unreachable: { '0': ['unreachable'], '1': ['unreachable'] },
    },
  }

  const check = validateAutomaton(incomplete, { completeDfaRequired: true })
  assert.equal(check.valid, false) // because completeDfaRequired is true
  assert.equal(check.isCompleteDfa, false)
  assert.ok(check.warnings.some((w) => w.includes('unreachable')))
  assert.ok(check.unreachableStates.includes('unreachable'))
})

test('completeDfaWithSink adds sink state and routes missing transitions', () => {
  const incomplete: Automaton = {
    id: 'incomplete',
    name: 'Incomplete DFA',
    description: '',
    language: '',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [{ id: 'q0', x: 0, y: 0, accept: true }],
    edges: [],
    delta: {
      q0: { '0': ['q0'] }, // missing '1'
    },
  }

  const completed = completeDfaWithSink(incomplete)
  const check = validateAutomaton(completed, { completeDfaRequired: true })
  assert.equal(check.valid, true)
  assert.equal(check.isCompleteDfa, true)
  assert.ok(completed.states.some((s) => s.id === 'q_sink' && !s.accept))
  assert.deepEqual(completed.delta['q0']['1'], ['q_sink'])
  assert.deepEqual(completed.delta['q_sink']['0'], ['q_sink'])
  assert.deepEqual(completed.delta['q_sink']['1'], ['q_sink'])
})

test('syncEdgesFromDelta and syncDeltaFromEdges roundtrip', () => {
  const dfa = DFA_EXAMPLES[1]
  const edges = syncEdgesFromDelta(dfa.states, dfa.delta)
  const delta = syncDeltaFromEdges(dfa.states, edges)
  assert.deepEqual(delta, dfa.delta)
})

test('generateTransitionTable and markdown formatting', () => {
  const dfa = DFA_EXAMPLES[0]
  const table = generateTransitionTable(dfa)
  assert.equal(table.rows.length, 2)
  assert.equal(table.rows[0].state, 'even')
  assert.equal(table.rows[0].isStart, true)
  assert.equal(table.rows[0].isAccept, true)

  const md = formatTransitionTableMarkdown(dfa)
  assert.ok(md.includes('| State | 0 | 1 |'))
  assert.ok(md.includes('→ * even'))
})
