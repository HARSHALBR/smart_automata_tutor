import test from 'node:test'
import assert from 'node:assert/strict'
import {
  type Automaton,
  EPSILON,
  runAutomaton,
  runAutomatonDetailed,
  isAccepting,
  validateAutomaton,
  completeDfaWithSink,
} from '../lib/automata'
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
import { compareAutomata } from '../lib/equivalence'
import { parseQuestion } from '../lib/nlp-parser'
import { solveProblem } from '../lib/automata-solver'
import { buildRegexPipeline } from '../lib/thompson-construction'

const testAccept = (auto: Automaton, str: string): boolean => {
  const trace = runAutomaton(auto, str)
  return isAccepting(auto, trace.at(-1)!.active)
}

// =========================================================================
// 1. Valid and Invalid DFAs
// =========================================================================
test('editor: validates valid complete DFA', () => {
  const dfa: Automaton = {
    id: 'test-dfa-1',
    name: 'Test DFA',
    description: 'Ends with 01',
    language: 'Ends with 01',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 0, y: 0, accept: false },
      { id: 'q1', x: 0, y: 0, accept: false },
      { id: 'q2', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      q0: { '0': ['q1'], '1': ['q0'] },
      q1: { '0': ['q1'], '1': ['q2'] },
      q2: { '0': ['q1'], '1': ['q0'] },
    },
    nondeterministic: false,
  }

  const val = validateEditorAutomaton(dfa)
  assert.equal(val.valid, true)
  assert.equal(val.isDeterministic, true)
  assert.equal(val.isCompleteDfa, true)
  assert.equal(val.missingTransitions.length, 0)
  assert.equal(val.conflictingTransitions.length, 0)
  assert.equal(val.errors.length, 0)
})

test('editor: detects invalid DFA with missing start state or empty states', () => {
  const emptyAuto: Automaton = {
    id: 'empty',
    name: 'Empty',
    description: '',
    language: '',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [],
    edges: [],
    delta: {},
    nondeterministic: false,
  }

  const valEmpty = validateEditorAutomaton(emptyAuto)
  assert.equal(valEmpty.valid, false)
  assert.ok(valEmpty.errors.some((e) => e.includes('at least one state')))

  const badStartAuto: Automaton = {
    ...emptyAuto,
    states: [{ id: 'q0', x: 0, y: 0 }],
    start: 'non_existent_start',
  }
  const valBadStart = validateEditorAutomaton(badStartAuto)
  assert.equal(valBadStart.valid, false)
  assert.ok(valBadStart.errors.some((e) => e.includes('Start state "non_existent_start" is not defined')))
})

test('editor: detects empty alphabet in automaton', () => {
  const noAlphaAuto: Automaton = {
    id: 'no-alpha',
    name: 'No Alpha',
    description: '',
    language: '',
    alphabet: [],
    start: 'q0',
    states: [{ id: 'q0', x: 0, y: 0 }],
    edges: [],
    delta: { q0: {} },
    nondeterministic: false,
  }

  const val = validateEditorAutomaton(noAlphaAuto)
  assert.equal(val.valid, false)
  assert.ok(val.errors.some((e) => e.includes('Alphabet Σ cannot be empty')))
})

// =========================================================================
// 2. Valid NFAs with multiple destinations
// =========================================================================
test('editor: validates valid NFA with multiple branch targets', () => {
  const nfa: Automaton = {
    id: 'nfa-branch',
    name: 'Branching NFA',
    description: 'NFA with multiple targets on 0',
    language: 'Contains 0',
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

  const val = validateEditorAutomaton(nfa)
  assert.equal(val.valid, true)
  assert.equal(val.isDeterministic, false)
  assert.equal(val.errors.length, 0)
  assert.equal(testAccept(nfa, '1110'), true)
  assert.equal(testAccept(nfa, '111'), false)
})

// =========================================================================
// 3. Epsilon transitions and cycles
// =========================================================================
test('editor: handles epsilon transitions and cycles in NFA, disallows in DFA', () => {
  const nfaWithEps: Automaton = {
    id: 'nfa-eps-cycle',
    name: 'Epsilon Cycle NFA',
    description: 'NFA with eps loop',
    language: 'Strings',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 0, y: 0, accept: false },
      { id: 'q1', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      q0: { [EPSILON]: ['q1'] },
      q1: { [EPSILON]: ['q0'], '0': ['q1'] },
    },
    nondeterministic: true,
  }

  const valNfa = validateEditorAutomaton(nfaWithEps)
  assert.equal(valNfa.valid, true)
  assert.equal(valNfa.isDeterministic, false)

  // Simulation must terminate and resolve epsilon closure cycle
  const trace = runAutomatonDetailed(nfaWithEps, '0')
  assert.equal(trace.accepted, true)

  // Disallow epsilon transition in DFA
  const dfaWithEps: Automaton = {
    ...nfaWithEps,
    nondeterministic: false,
  }
  const valDfa = validateEditorAutomaton(dfaWithEps)
  assert.equal(valDfa.valid, false)
  assert.ok(valDfa.errors.some((e) => e.includes('contains ε-transition, which is only allowed in NFAs')))
})

// =========================================================================
// 4. Missing and conflicting transitions
// =========================================================================
test('editor: flags missing transitions in incomplete DFA and fixes with sink', () => {
  const incompleteDfa: Automaton = {
    id: 'incomplete-dfa',
    name: 'Incomplete DFA',
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
      q0: { '0': ['q1'] }, // missing transition on '1'
      q1: { '0': ['q1'], '1': ['q1'] },
    },
    nondeterministic: false,
  }

  const val = validateEditorAutomaton(incompleteDfa)
  assert.equal(val.valid, true) // valid as partial automaton
  assert.equal(val.isCompleteDfa, false)
  assert.equal(val.missingTransitions.length, 1)
  assert.equal(val.missingTransitions[0].state, 'q0')
  assert.equal(val.missingTransitions[0].symbol, '1')

  // Auto-complete with sink
  const completed = completeDfaWithSink(incompleteDfa)
  const valCompleted = validateEditorAutomaton(completed)
  assert.equal(valCompleted.isCompleteDfa, true)
  assert.equal(valCompleted.missingTransitions.length, 0)
  assert.ok(completed.states.some((s) => s.id === 'sink' || s.id === 'trap' || s.id.includes('sink')))
})

test('editor: flags conflicting multiple transitions in DFA', () => {
  const conflictingDfa: Automaton = {
    id: 'conflicting-dfa',
    name: 'Conflicting DFA',
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
      q0: { '0': ['q1', 'q2'], '1': ['q0'] }, // multiple targets on '0' in DFA
      q1: { '0': ['q1'], '1': ['q1'] },
      q2: { '0': ['q2'], '1': ['q2'] },
    },
    nondeterministic: false,
  }

  const val = validateEditorAutomaton(conflictingDfa)
  assert.equal(val.valid, false)
  assert.equal(val.isDeterministic, false)
  assert.equal(val.conflictingTransitions.length, 1)
  assert.ok(val.errors.some((e) => e.includes('multiple transitions on symbol "0"')))
})

// =========================================================================
// 5. Invalid state references
// =========================================================================
test('editor: flags transition to non-existent state', () => {
  const badTargetDfa: Automaton = {
    id: 'bad-target',
    name: 'Bad Target',
    description: '',
    language: '',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [{ id: 'q0', x: 0, y: 0, accept: true }],
    edges: [],
    delta: {
      q0: { '0': ['q999'], '1': ['q0'] },
    },
    nondeterministic: false,
  }

  const val = validateEditorAutomaton(badTargetDfa)
  assert.equal(val.valid, false)
  assert.ok(val.errors.some((e) => e.includes('leads to non-existent state "q999"')))
})

// =========================================================================
// 6. Alphabet changes
// =========================================================================
test('editor: updates alphabet and prunes removed symbols while preserving valid transitions', () => {
  const baseAuto = createBlankAutomaton(false, ['0', '1'])
  assert.deepEqual(baseAuto.alphabet, ['0', '1'])

  // Expand alphabet to {0, 1, 2}
  const expanded = setAutomatonAlphabet(baseAuto, ['0', '1', '2'])
  assert.deepEqual(expanded.alphabet, ['0', '1', '2'])

  // Add transition on '2'
  const with2 = setAutomatonTransition(expanded, 'q0', '2', ['q1'])
  assert.deepEqual(with2.delta.q0['2'], ['q1'])

  // Reduce alphabet to only {'0', '1'}
  const reduced = setAutomatonAlphabet(with2, ['0', '1'])
  assert.deepEqual(reduced.alphabet, ['0', '1'])
  assert.equal(reduced.delta.q0['2'], undefined) // '2' transitions cleanly pruned
  assert.deepEqual(reduced.delta.q0['0'], ['q1']) // '0' transition preserved
})

// =========================================================================
// 7. Empty-string simulation
// =========================================================================
test('editor: correctly simulates empty string (epsilon) on DFA and NFA', () => {
  const dfaAcceptsEmpty: Automaton = {
    id: 'dfa-empty',
    name: 'Accepts Empty',
    description: '',
    language: '',
    alphabet: ['0', '1'],
    start: 'q0',
    states: [
      { id: 'q0', x: 0, y: 0, accept: true },
      { id: 'q1', x: 0, y: 0, accept: false },
    ],
    edges: [],
    delta: {
      q0: { '0': ['q1'], '1': ['q1'] },
      q1: { '0': ['q1'], '1': ['q1'] },
    },
    nondeterministic: false,
  }

  assert.equal(testAccept(dfaAcceptsEmpty, ''), true)
  assert.equal(testAccept(dfaAcceptsEmpty, '0'), false)

  const nfaRejectsEmpty: Automaton = {
    id: 'nfa-no-empty',
    name: 'Rejects Empty',
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
    nondeterministic: true,
  }

  assert.equal(testAccept(nfaRejectsEmpty, ''), false)
  assert.equal(testAccept(nfaRejectsEmpty, '0'), true)
})

// =========================================================================
// 8. State and transition editing operations
// =========================================================================
test('editor: state addition, removal, start/accept toggle, and transition edits', () => {
  let auto = createBlankAutomaton(false, ['0', '1'])

  // Add state q2
  auto = addStateToAutomaton(auto, 'q2', true)
  assert.equal(auto.states.length, 3)
  assert.ok(auto.states.some((s) => s.id === 'q2' && s.accept === true))

  // Prevent duplicate state
  assert.throws(() => addStateToAutomaton(auto, 'q2'), /already exists/)

  // Toggle accept state
  auto = toggleAutomatonAcceptState(auto, 'q2')
  assert.equal(auto.states.find((s) => s.id === 'q2')?.accept, false)

  // Set start state
  auto = setAutomatonStartState(auto, 'q2')
  assert.equal(auto.start, 'q2')

  // Set transition
  auto = setAutomatonTransition(auto, 'q2', '0', ['q0'])
  assert.deepEqual(auto.delta.q2['0'], ['q0'])

  // Remove state q0 and verify cleanup
  auto = removeStateFromAutomaton(auto, 'q0')
  assert.equal(auto.states.some((s) => s.id === 'q0'), false)
  assert.equal(auto.delta.q2['0'], undefined) // target q0 pruned

  // Converting to NFA and back
  auto = toggleAutomatonNfa(auto, true)
  assert.equal(auto.nondeterministic, true)
  auto = setAutomatonTransition(auto, 'q2', '1', ['q1', 'q2'])
  assert.deepEqual(auto.delta.q2['1'], ['q1', 'q2'])

  auto = toggleAutomatonNfa(auto, false)
  assert.equal(auto.nondeterministic, false)
  // Converting back to DFA clamps multiple destinations to first
  assert.deepEqual(auto.delta.q2['1'], ['q1'])
})

// =========================================================================
// 9. Equivalent automata with different state names
// =========================================================================
test('editor: recognizes language equivalence despite different state names', () => {
  // Reference DFA: Ends with 01 using state names {q0, q1, q2}
  const refDfa: Automaton = SAMPLE_LEARNING_AUTOMATA.dfa_ends_01.automaton

  // Student DFA: Same language using states {State_A, State_B, State_C}
  const studentDfa: Automaton = {
    id: 'student-dfa',
    name: 'Student DFA',
    description: '',
    language: 'Ends with 01',
    alphabet: ['0', '1'],
    start: 'State_A',
    states: [
      { id: 'State_A', x: 0, y: 0, accept: false },
      { id: 'State_B', x: 0, y: 0, accept: false },
      { id: 'State_C', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      State_A: { '0': ['State_B'], '1': ['State_A'] },
      State_B: { '0': ['State_B'], '1': ['State_C'] },
      State_C: { '0': ['State_B'], '1': ['State_A'] },
    },
    nondeterministic: false,
  }

  const verif = verifyAgainstReference(studentDfa, {
    type: 'automaton',
    automaton: refDfa,
  })

  assert.equal(verif.hasReference, true)
  assert.equal(verif.equivalent, true)
  assert.ok(verif.explanation.includes('exact same language'))
  assert.equal(verif.counterexample, undefined)
})

// =========================================================================
// 10. Non-equivalent automata and distinguishing counterexamples
// =========================================================================
test('editor: detects non-equivalence and produces shortest counterexample with traces', () => {
  // Reference: ends with 01
  const refDfa: Automaton = SAMPLE_LEARNING_AUTOMATA.dfa_ends_01.automaton

  // Student automaton: accepts anything ending in 0 (wrong language)
  const studentDfa: Automaton = {
    id: 'student-wrong',
    name: 'Student Wrong DFA',
    description: '',
    language: 'Ends with 0',
    alphabet: ['0', '1'],
    start: 's0',
    states: [
      { id: 's0', x: 0, y: 0, accept: false },
      { id: 's1', x: 0, y: 0, accept: true },
    ],
    edges: [],
    delta: {
      s0: { '0': ['s1'], '1': ['s0'] },
      s1: { '0': ['s1'], '1': ['s0'] },
    },
    nondeterministic: false,
  }

  const verif = verifyAgainstReference(studentDfa, {
    type: 'automaton',
    automaton: refDfa,
  })

  assert.equal(verif.hasReference, true)
  assert.equal(verif.equivalent, false)
  assert.notEqual(verif.counterexample, undefined)
  assert.ok(verif.studentTrace !== undefined)
  assert.ok(verif.referenceTrace !== undefined)
  // The two machines must disagree on the counterexample
  assert.notEqual(verif.acceptedByStudent, verif.acceptedByReference)
})

// =========================================================================
// 11. NFA comparison through equivalent DFA conversion
// =========================================================================
test('editor: verifies student NFA against reference DFA via subset construction', () => {
  // Reference DFA: Ends with 01
  const refDfa: Automaton = SAMPLE_LEARNING_AUTOMATA.dfa_ends_01.automaton

  // Student NFA: 3-state NFA guessing suffix 01
  const studentNfa: Automaton = SAMPLE_LEARNING_AUTOMATA.nfa_ends_01.automaton

  const verif = verifyAgainstReference(studentNfa, {
    type: 'automaton',
    automaton: refDfa,
  })

  assert.equal(verif.hasReference, true)
  assert.equal(verif.equivalent, true)
  assert.ok(verif.explanation.includes('exact same language'))
})

test('editor: verifies student DFA against natural-language query reference', () => {
  const studentDfa: Automaton = SAMPLE_LEARNING_AUTOMATA.dfa_ends_01.automaton

  const verif = verifyAgainstReference(studentDfa, {
    type: 'nl_query',
    query: 'Construct a DFA that accepts strings ending with 01',
  })

  assert.equal(verif.hasReference, true)
  assert.equal(verif.equivalent, true)
})

test('editor: verifies student DFA against regular expression reference', () => {
  const studentDfa: Automaton = SAMPLE_LEARNING_AUTOMATA.dfa_ends_01.automaton

  const verif = verifyAgainstReference(studentDfa, {
    type: 'regex',
    regex: '(0|1)*01',
  })

  assert.equal(verif.hasReference, true)
  assert.equal(verif.equivalent, true)
})

// =========================================================================
// 12. Transition table and diagram consistency (Import & Export)
// =========================================================================
test('editor: exports and re-imports transition table preserving automaton structure', () => {
  const original = SAMPLE_LEARNING_AUTOMATA.dfa_ends_01.automaton

  const mdTable = exportTransitionTableText(original)
  assert.ok(mdTable.includes('| State | 0 | 1 |'))
  assert.ok(mdTable.includes('→ q0'))
  assert.ok(mdTable.includes('* q2'))

  const parsedResult = parseTransitionTableText(mdTable, false)
  assert.equal(parsedResult.success, true)
  assert.ok(parsedResult.automaton)

  const imported = parsedResult.automaton!
  assert.equal(imported.start, 'q0')
  assert.equal(imported.states.length, 3)
  assert.deepEqual(imported.alphabet, ['0', '1'])
  assert.equal(imported.states.find((s) => s.id === 'q2')?.accept, true)

  // Language equivalence test between original and re-imported
  const eq = compareAutomata(original, imported)
  assert.equal(eq.equivalent, true)
})

test('editor: imports NFA table with set-based transitions', () => {
  const tableText = `
| State | 0 | 1 |
| :--- | :--- | :--- |
| → q0 | {q0, q1} | q0 |
| * q1 | — | — |
`
  const result = parseTransitionTableText(tableText, true)
  assert.equal(result.success, true)
  assert.ok(result.automaton)
  const nfa = result.automaton!
  assert.equal(nfa.nondeterministic, true)
  assert.deepEqual(nfa.delta.q0['0'], ['q0', 'q1'])
  assert.deepEqual(nfa.delta.q0['1'], ['q0'])
})

// =========================================================================
// 13. Regression tests for existing solver and regex pipeline
// =========================================================================
test('regression: natural-language question solver continues to solve exam questions', () => {
  const parsed = parseQuestion('Construct a DFA over {0,1} that accepts strings ending with 01.')
  assert.equal(parsed.success, true)
  assert.ok(parsed.problemSpec)

  const sol = solveProblem(parsed.problemSpec!)
  assert.ok(sol.automaton)
  assert.equal(validateAutomaton(sol.automaton).valid, true)
  assert.equal(testAccept(sol.automaton, '01'), true)
  assert.equal(testAccept(sol.automaton, '1001'), true)
  assert.equal(testAccept(sol.automaton, '100'), false)
})

test('regression: regular expression pipeline continues to function correctly', () => {
  const pipeline = buildRegexPipeline('(0|1)*01', ['0', '1'])
  assert.equal(validateAutomaton(pipeline.nfa).valid, true)
  assert.equal(validateAutomaton(pipeline.dfa).valid, true)
  assert.equal(validateAutomaton(pipeline.minimizedDfa).valid, true)
  assert.equal(pipeline.equivalence.equivalent, true)
})
