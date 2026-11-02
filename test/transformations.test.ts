import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DFA_EXAMPLES,
  NFA_EXAMPLES,
  validateAutomaton,
  runAutomaton,
  type Automaton,
} from '../lib/automata'
import { convertNfaToDfa } from '../lib/subset-construction'
import { minimizeDfa, REDUNDANT_DFA } from '../lib/minimize'
import { compareAutomata, areAutomataEquivalent } from '../lib/equivalence'

test('convertNfaToDfa produces a valid equivalent DFA', () => {
  const nfa = NFA_EXAMPLES[0] // Third symbol from end is 1
  const result = convertNfaToDfa(nfa)

  // 1. Structural validity
  const val = validateAutomaton(result.dfa, { completeDfaRequired: true })
  assert.equal(val.valid, true, `Validation failed: ${val.errors.join(', ')}`)
  assert.equal(result.dfa.nondeterministic, false)

  // 2. Intermediate table verification
  assert.ok(result.intermediateTable.length > 0)
  assert.ok(result.intermediateTable[0].isStart)
  assert.ok(result.intermediateTable[0].transitions['0'] !== undefined)
  assert.ok(result.intermediateTable[0].transitions['1'] !== undefined)

  // 3. Language equivalence test across sample strings
  const testStrings = [
    '100', // 3rd from end is 1 -> accept
    '101', // 3rd from end is 1 -> accept
    '1111', // 3rd from end is 1 -> accept
    '000100', // 3rd from end is 1 -> accept
    '000', // reject
    '001', // reject
    '010', // reject
    '0', // reject
    '1', // reject
    '', // reject
    '1010', // 3rd from end is 0 -> reject
  ]

  for (const str of testStrings) {
    const nfaSteps = runAutomaton(nfa, str)
    const nfaAccepts = nfaSteps[nfaSteps.length - 1].active.some((s) =>
      nfa.states.find((st) => st.id === s)?.accept,
    )

    const dfaSteps = runAutomaton(result.dfa, str)
    const dfaAccepts = dfaSteps[dfaSteps.length - 1].active.some((s) =>
      result.dfa.states.find((st) => st.id === s)?.accept,
    )

    assert.equal(
      dfaAccepts,
      nfaAccepts,
      `Mismatch on string "${str}": NFA=${nfaAccepts}, DFA=${dfaAccepts}`,
    )
  }
})

test('minimizeDfa minimizes redundant states and preserves language', () => {
  const res = minimizeDfa(REDUNDANT_DFA)

  // Original had 5 states
  assert.equal(res.originalStateCount, 5)
  // Minimized should have fewer states (3 or 4)
  assert.ok(res.minimizedStateCount < res.originalStateCount)
  assert.ok(res.steps.length >= 2)
  assert.ok(res.mergeRationales.length > 0)

  // Verify minimal DFA is valid
  const val = validateAutomaton(res.minimized, { completeDfaRequired: true })
  assert.equal(val.valid, true, `Validation failed: ${val.errors.join(', ')}`)

  // Verify mathematical language equivalence
  const equiv = compareAutomata(REDUNDANT_DFA, res.minimized)
  assert.equal(equiv.equivalent, true, `Minimized DFA is not equivalent to original: ${equiv.explanation}`)
})

test('minimizeDfa prunes unreachable states first', () => {
  const dfaWithUnreachable: Automaton = {
    id: 'unreachable-test',
    name: 'Unreachable Test',
    description: '',
    language: 'Strings ending in 0',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 0, y: 0 },
      { id: 'q1', x: 100, y: 0, accept: true },
      { id: 'ghost_reject', x: 200, y: 0 },
      { id: 'ghost_accept', x: 200, y: 100, accept: true },
    ],
    edges: [],
    delta: {
      q0: { '0': ['q1'], '1': ['q0'] },
      q1: { '0': ['q1'], '1': ['q0'] },
      ghost_reject: { '0': ['ghost_reject'], '1': ['ghost_reject'] },
      ghost_accept: { '0': ['ghost_accept'], '1': ['ghost_accept'] },
    },
  }

  const res = minimizeDfa(dfaWithUnreachable)
  assert.ok(res.unreachableStatesRemoved.includes('ghost_reject'))
  assert.ok(res.unreachableStatesRemoved.includes('ghost_accept'))
  assert.equal(res.minimized.states.length, 2)
})

test('compareAutomata detects equivalence and shortest counterexamples', () => {
  const evenZeros = DFA_EXAMPLES[0]
  const ends01 = DFA_EXAMPLES[1]

  // Self comparison -> equivalent
  const selfComp = compareAutomata(evenZeros, evenZeros)
  assert.equal(selfComp.equivalent, true)

  // Different automata -> not equivalent
  const diffComp = compareAutomata(evenZeros, ends01)
  assert.equal(diffComp.equivalent, false)
  assert.notEqual(diffComp.counterexample, undefined)

  // For "" (empty string): evenZeros accepts, ends01 rejects -> shortest counterexample is ""
  assert.equal(diffComp.counterexample, '')
  assert.equal(diffComp.acceptedBy, 'A')
  assert.ok(diffComp.traceA !== undefined)
  assert.ok(diffComp.traceB !== undefined)
})
