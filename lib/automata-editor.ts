/**
 * Student Automaton Editor Engine & Reference Verifier
 * Supports interactive DFA/NFA editing, live validation, transition table manipulation,
 * sink completion, text import/export, and language equivalence verification against reference models.
 */

import {
  type Automaton,
  type AutoState,
  EPSILON,
  syncEdgesFromDelta,
  findReachableStates,
  completeDfaWithSink,
  runAutomatonDetailed,
  type DetailedRunResult,
} from './automata'
import { convertNfaToDfa } from './subset-construction'
import { compareAutomata } from './equivalence'
import { parseQuestion } from './nlp-parser'
import { solveProblem } from './automata-solver'
import { buildRegexPipeline } from './thompson-construction'

export interface DetailedEditorValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
  isDeterministic: boolean
  isCompleteDfa: boolean
  missingTransitions: { state: string; symbol: string }[]
  conflictingTransitions: { state: string; symbol: string; targets: string[] }[]
  unreachableStates: string[]
  hasStart: boolean
  hasAccept: boolean
}

export interface ReferenceVerificationResult {
  hasReference: boolean
  referenceName?: string
  referenceAutomaton?: Automaton
  equivalent: boolean
  explanation: string
  counterexample?: string
  acceptedByStudent?: boolean
  acceptedByReference?: boolean
  studentTrace?: DetailedRunResult
  referenceTrace?: DetailedRunResult
  statesCountComparison?: {
    student: number
    reference: number
  }
}

/**
 * Creates a clean baseline automaton with 2 states.
 */
export function createBlankAutomaton(
  isNfa: boolean = false,
  alphabet: string[] = ['0', '1'],
): Automaton {
  const cleanAlphabet = alphabet.filter((s) => s.trim() !== '' && s !== EPSILON)
  const states: AutoState[] = [
    { id: 'q0', x: 120, y: 180, accept: false },
    { id: 'q1', x: 280, y: 180, accept: true },
  ]
  const delta: Record<string, Record<string, string[]>> = {
    q0: {},
    q1: {},
  }

  // Set default sample transitions
  for (const sym of cleanAlphabet) {
    delta.q0[sym] = ['q1']
    delta.q1[sym] = ['q1']
  }

  return {
    id: `custom-${isNfa ? 'nfa' : 'dfa'}-${Date.now().toString(36)}`,
    name: `Custom ${isNfa ? 'NFA' : 'DFA'}`,
    description: `User-defined ${isNfa ? 'nondeterministic' : 'deterministic'} finite automaton.`,
    language: 'User-specified language',
    alphabet: cleanAlphabet,
    start: 'q0',
    states,
    edges: syncEdgesFromDelta(states, delta),
    delta,
    nondeterministic: isNfa,
  }
}

/**
 * Adds a new state with auto-generated coordinates to prevent overlap.
 */
export function addStateToAutomaton(
  auto: Automaton,
  stateId: string,
  isAccept = false,
): Automaton {
  const cleanId = stateId.trim()
  if (!cleanId) {
    throw new Error('State identifier cannot be empty.')
  }
  if (auto.states.some((s) => s.id === cleanId)) {
    throw new Error(`State with identifier "${cleanId}" already exists.`)
  }

  // Calculate position: grid offset from existing states
  const n = auto.states.length
  const col = n % 4
  const row = Math.floor(n / 4)
  const x = 120 + col * 140
  const y = 140 + row * 130

  const newState: AutoState = {
    id: cleanId,
    x,
    y,
    accept: isAccept,
  }

  const updatedStates = [...auto.states, newState]
  const updatedDelta: Record<string, Record<string, string[]>> = {
    ...auto.delta,
    [cleanId]: {},
  }

  return {
    ...auto,
    states: updatedStates,
    delta: updatedDelta,
    edges: syncEdgesFromDelta(updatedStates, updatedDelta),
  }
}

/**
 * Removes a state and all incoming / outgoing transitions referencing it.
 */
export function removeStateFromAutomaton(
  auto: Automaton,
  stateId: string,
): Automaton {
  if (!auto.states.some((s) => s.id === stateId)) {
    return auto
  }

  const updatedStates = auto.states.filter((s) => s.id !== stateId)

  // Clean delta: remove state row and prune target references
  const updatedDelta: Record<string, Record<string, string[]>> = {}
  for (const s of updatedStates) {
    updatedDelta[s.id] = {}
    const oldRow = auto.delta[s.id] ?? {}
    for (const [sym, targets] of Object.entries(oldRow)) {
      const filteredTargets = targets.filter((t) => t !== stateId)
      if (filteredTargets.length > 0) {
        updatedDelta[s.id][sym] = filteredTargets
      }
    }
  }

  // If start state was removed, designate the first remaining state as start
  let newStart = auto.start
  if (auto.start === stateId) {
    newStart = updatedStates[0]?.id ?? ''
  }

  return {
    ...auto,
    start: newStart,
    states: updatedStates,
    delta: updatedDelta,
    edges: syncEdgesFromDelta(updatedStates, updatedDelta),
  }
}

/**
 * Sets the start state.
 */
export function setAutomatonStartState(
  auto: Automaton,
  stateId: string,
): Automaton {
  if (!auto.states.some((s) => s.id === stateId)) {
    throw new Error(`State "${stateId}" does not exist in automaton.`)
  }
  return {
    ...auto,
    start: stateId,
  }
}

/**
 * Toggles whether a state is accepting.
 */
export function toggleAutomatonAcceptState(
  auto: Automaton,
  stateId: string,
): Automaton {
  const updatedStates = auto.states.map((s) =>
    s.id === stateId ? { ...s, accept: !s.accept } : s,
  )
  return {
    ...auto,
    states: updatedStates,
  }
}

/**
 * Updates transitions from a state on a symbol.
 */
export function setAutomatonTransition(
  auto: Automaton,
  fromState: string,
  symbol: string,
  targets: string[],
): Automaton {
  if (!auto.states.some((s) => s.id === fromState)) {
    throw new Error(`State "${fromState}" does not exist.`)
  }

  // Filter invalid targets
  const stateSet = new Set(auto.states.map((s) => s.id))
  const validTargets = Array.from(new Set(targets.filter((t) => stateSet.has(t))))

  // If DFA, only allow at most 1 destination
  const effectiveTargets = !auto.nondeterministic && validTargets.length > 1
    ? [validTargets[0]]
    : validTargets

  const updatedDelta: Record<string, Record<string, string[]>> = {
    ...auto.delta,
    [fromState]: {
      ...(auto.delta[fromState] ?? {}),
    },
  }

  if (effectiveTargets.length > 0) {
    updatedDelta[fromState][symbol] = effectiveTargets
  } else {
    delete updatedDelta[fromState][symbol]
  }

  return {
    ...auto,
    delta: updatedDelta,
    edges: syncEdgesFromDelta(auto.states, updatedDelta),
  }
}

/**
 * Updates the alphabet, preserving valid transitions.
 */
export function setAutomatonAlphabet(
  auto: Automaton,
  newAlphabet: string[],
): Automaton {
  const clean = Array.from(
    new Set(newAlphabet.map((s) => s.trim()).filter((s) => s !== '' && s !== EPSILON)),
  ).sort()

  const allowedSymbols = new Set(clean)
  if (auto.nondeterministic) {
    allowedSymbols.add(EPSILON)
  }

  // Prune transitions on symbols no longer present
  const updatedDelta: Record<string, Record<string, string[]>> = {}
  for (const s of auto.states) {
    updatedDelta[s.id] = {}
    const row = auto.delta[s.id] ?? {}
    for (const [sym, targets] of Object.entries(row)) {
      if (allowedSymbols.has(sym)) {
        updatedDelta[s.id][sym] = targets
      }
    }
  }

  return {
    ...auto,
    alphabet: clean,
    delta: updatedDelta,
    edges: syncEdgesFromDelta(auto.states, updatedDelta),
  }
}

/**
 * Converts automaton type between DFA and NFA without discarding state configurations.
 */
export function toggleAutomatonNfa(auto: Automaton, toNfa: boolean): Automaton {
  if (auto.nondeterministic === toNfa) return auto

  const updatedDelta: Record<string, Record<string, string[]>> = {}

  if (!toNfa) {
    // Converting NFA -> DFA:
    // 1. Keep only first target if multiple exist.
    // 2. Remove ε transitions.
    for (const s of auto.states) {
      updatedDelta[s.id] = {}
      for (const [sym, targets] of Object.entries(auto.delta[s.id] ?? {})) {
        if (sym !== EPSILON && targets.length > 0) {
          updatedDelta[s.id][sym] = [targets[0]]
        }
      }
    }
  } else {
    // Converting DFA -> NFA: copy delta directly
    for (const s of auto.states) {
      updatedDelta[s.id] = { ...(auto.delta[s.id] ?? {}) }
    }
  }

  return {
    ...auto,
    nondeterministic: toNfa,
    name: auto.name.replace(/DFA|NFA/g, toNfa ? 'NFA' : 'DFA'),
    delta: updatedDelta,
    edges: syncEdgesFromDelta(auto.states, updatedDelta),
  }
}

/**
 * Validates the student's automaton with detailed actionable feedback.
 */
export function validateEditorAutomaton(
  auto: Automaton,
): DetailedEditorValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const stateSet = new Set(auto.states.map((s) => s.id))
  const alphabetSet = new Set(auto.alphabet)

  // 1. State existence and uniqueness
  if (auto.states.length === 0) {
    errors.push('Automaton must have at least one state.')
  }

  // 2. Start state check
  const hasStart = !!auto.start && stateSet.has(auto.start)
  if (!hasStart) {
    errors.push(`Start state "${auto.start}" is not defined among the automaton states.`)
  }

  // 3. Accept states check
  const acceptStates = auto.states.filter((s) => s.accept)
  const hasAccept = acceptStates.length > 0
  if (!hasAccept) {
    warnings.push('Automaton has no accepting states (it will reject every string).')
  }

  // 4. Alphabet check
  if (auto.alphabet.length === 0) {
    errors.push('Alphabet Σ cannot be empty. Specify at least one symbol.')
  }
  if (alphabetSet.has(EPSILON)) {
    errors.push(`Alphabet cannot contain the empty-string symbol "${EPSILON}".`)
  }

  // 5. Transitions analysis
  const missingTransitions: { state: string; symbol: string }[] = []
  const conflictingTransitions: { state: string; symbol: string; targets: string[] }[] = []
  let isDeterministic = !auto.nondeterministic
  let isCompleteDfa = true

  for (const s of auto.states) {
    const row = auto.delta[s.id] ?? {}

    // Check for ε-transitions in DFA
    if (!auto.nondeterministic && (row[EPSILON]?.length ?? 0) > 0) {
      errors.push(`DFA state "${s.id}" contains ε-transition, which is only allowed in NFAs.`)
      isDeterministic = false
    }

    for (const sym of auto.alphabet) {
      const targets = row[sym] ?? []

      if (targets.length === 0) {
        if (!auto.nondeterministic) {
          missingTransitions.push({ state: s.id, symbol: sym })
          isCompleteDfa = false
        }
      } else if (targets.length > 1) {
        if (!auto.nondeterministic) {
          conflictingTransitions.push({ state: s.id, symbol: sym, targets })
          errors.push(
            `DFA state "${s.id}" has multiple transitions on symbol "${sym}" to: {${targets.join(', ')}}.`,
          )
          isDeterministic = false
        }
      }

      // Check target existence
      for (const t of targets) {
        if (!stateSet.has(t)) {
          errors.push(`Transition from "${s.id}" on "${sym}" leads to non-existent state "${t}".`)
        }
      }
    }

    // Check for transitions on symbols not in alphabet
    for (const sym of Object.keys(row)) {
      if (sym !== EPSILON && !alphabetSet.has(sym)) {
        errors.push(`State "${s.id}" contains transition on "${sym}", which is not in alphabet Σ.`)
      }
    }
  }

  if (!auto.nondeterministic && missingTransitions.length > 0) {
    warnings.push(
      `DFA is incomplete: missing ${missingTransitions.length} transition(s). Use "Complete with Sink" to make it total.`,
    )
  }

  // 6. Reachable states analysis
  const reachable = auto.states.length > 0 && hasStart ? findReachableStates(auto) : new Set<string>()
  const unreachableStates = auto.states.filter((s) => !reachable.has(s.id)).map((s) => s.id)
  if (unreachableStates.length > 0) {
    warnings.push(`Unreachable state(s) detected: {${unreachableStates.join(', ')}}.`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    isDeterministic,
    isCompleteDfa: !auto.nondeterministic && isCompleteDfa && isDeterministic,
    missingTransitions,
    conflictingTransitions,
    unreachableStates,
    hasStart,
    hasAccept,
  }
}

/**
 * Compares the student's edited automaton against a reference automaton or problem spec.
 */
export function verifyAgainstReference(
  studentAuto: Automaton,
  referenceInput:
    | { type: 'automaton'; automaton: Automaton }
    | { type: 'nl_query'; query: string }
    | { type: 'regex'; regex: string },
): ReferenceVerificationResult {
  // Validate student's automaton structurally first
  const studentVal = validateEditorAutomaton(studentAuto)
  if (!studentVal.valid) {
    return {
      hasReference: false,
      equivalent: false,
      explanation: `Student automaton has structural errors: ${studentVal.errors.join(' ')}`,
    }
  }

  // Resolve reference automaton
  let refAuto: Automaton
  let refName = 'Reference Solution'

  try {
    if (referenceInput.type === 'automaton') {
      refAuto = referenceInput.automaton
      refName = refAuto.name || 'Reference Automaton'
    } else if (referenceInput.type === 'nl_query') {
      const parsed = parseQuestion(referenceInput.query)
      if (!parsed.success || !parsed.problemSpec) {
        return {
          hasReference: false,
          equivalent: false,
          explanation: `Cannot resolve reference problem: ${parsed.clarificationPrompt || 'Unsupported query.'}`,
        }
      }
      const sol = solveProblem(parsed.problemSpec)
      refAuto = sol.automaton
      refName = sol.title
    } else {
      const pipeline = buildRegexPipeline(referenceInput.regex, studentAuto.alphabet)
      refAuto = pipeline.minimizedDfa
      refName = `Regex Reference: ${pipeline.normalizedRegex}`
    }
  } catch (err: any) {
    return {
      hasReference: false,
      equivalent: false,
      explanation: `Failed to construct reference automaton: ${err.message || err}`,
    }
  }

  // Run formal language equivalence check
  const comp = compareAutomata(studentAuto, refAuto)

  let acceptedByStudent: boolean | undefined
  let acceptedByReference: boolean | undefined
  let studentTrace: DetailedRunResult | undefined
  let referenceTrace: DetailedRunResult | undefined

  if (comp.counterexample !== undefined) {
    studentTrace = runAutomatonDetailed(studentAuto, comp.counterexample)
    referenceTrace = runAutomatonDetailed(refAuto, comp.counterexample)
    acceptedByStudent = studentTrace.accepted
    acceptedByReference = referenceTrace.accepted
  }

  let explanation: string
  if (comp.equivalent) {
    explanation =
      `Correct! Your ${studentAuto.nondeterministic ? 'NFA' : 'DFA'} recognizes the exact same language as "${refName}". ` +
      `Even though state names or counts may differ (Student: ${studentAuto.states.length} states vs Reference: ${refAuto.states.length} states), ` +
      `the machines are mathematically equivalent across all possible strings.`
  } else {
    const formattedCounter = comp.counterexample === '' ? 'ε (empty string)' : `"${comp.counterexample}"`
    explanation =
      `Not equivalent: Distinguishable on test string ${formattedCounter}. ` +
      `Your automaton ${acceptedByStudent ? 'ACCEPTS' : 'REJECTS'} this string, ` +
      `whereas the reference solution ${acceptedByReference ? 'ACCEPTS' : 'REJECTS'} it.`
  }

  return {
    hasReference: true,
    referenceName: refName,
    referenceAutomaton: refAuto,
    equivalent: comp.equivalent,
    explanation,
    counterexample: comp.counterexample,
    acceptedByStudent,
    acceptedByReference,
    studentTrace,
    referenceTrace,
    statesCountComparison: {
      student: studentAuto.states.length,
      reference: refAuto.states.length,
    },
  }
}

/**
 * Text-based transition table parser (CSV, Markdown, or tab-delimited).
 * Format example:
 * State, 0, 1
 * ->q0, q1, q0
 * *q1, q1, q2
 * q2, q1, q0
 */
function splitTableRow(line: string): string[] {
  const trimmed = line.trim()
  if (trimmed.includes('|')) {
    const inner = trimmed.replace(/^\||\|$/g, '')
    return inner.split('|').map((c) => c.trim())
  }
  if (trimmed.includes('\t')) {
    return trimmed.split('\t').map((c) => c.trim())
  }
  return trimmed.split(',').map((c) => c.trim())
}

function isDividerLine(line: string): boolean {
  const cleaned = line.replace(/[\s|:-]/g, '')
  return cleaned === ''
}

export function parseTransitionTableText(
  text: string,
  isNfa: boolean = false,
): { success: boolean; automaton?: Automaton; error?: string } {
  try {
    const rawLines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && !isDividerLine(l))

    if (rawLines.length < 2) {
      return { success: false, error: 'Table must have a header line and at least one state row.' }
    }

    // Parse header: "State, 0, 1" or "| State | 0 | 1 |"
    const headerParts = splitTableRow(rawLines[0]).filter(Boolean)

    if (headerParts.length < 2) {
      return { success: false, error: 'Header must contain "State" followed by at least one alphabet symbol.' }
    }

    const alphabetSymbols = headerParts.slice(1).map((s) => (s === 'ε' || s === 'eps' ? EPSILON : s))
    const alphabet = alphabetSymbols.filter((s) => s !== EPSILON)

    const states: AutoState[] = []
    const delta: Record<string, Record<string, string[]>> = {}
    let startState = ''

    for (let r = 1; r < rawLines.length; r++) {
      const parts = splitTableRow(rawLines[r])
      if (parts.length < 1 || !parts[0]) continue

      let rawState = parts[0]
      const isStart = rawState.includes('->') || rawState.includes('→')
      const isAccept = rawState.includes('*')

      const cleanStateId = rawState.replace(/->|→|\*/g, '').trim()
      if (!cleanStateId) continue

      if (isStart && !startState) {
        startState = cleanStateId
      }

      states.push({
        id: cleanStateId,
        x: 100 + ((r - 1) % 4) * 140,
        y: 120 + Math.floor((r - 1) / 4) * 120,
        accept: isAccept,
      })
      delta[cleanStateId] = {}

      for (let c = 0; c < alphabetSymbols.length; c++) {
        const sym = alphabetSymbols[c]
        const cell = parts[c + 1]?.trim() ?? ''
        if (!cell || cell === '—' || cell === '-' || cell === '∅') continue

        // Cell can have multiple comma-separated states or curly braces: "{q0, q1}"
        const cleanCell = cell.replace(/[{}]/g, '')
        const targets = cleanCell.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean)
        if (targets.length > 0) {
          delta[cleanStateId][sym] = isNfa ? targets : [targets[0]]
        }
      }
    }

    if (states.length === 0) {
      return { success: false, error: 'No valid states found in table.' }
    }

    if (!startState) {
      startState = states[0].id
    }

    const auto: Automaton = {
      id: `imported-${isNfa ? 'nfa' : 'dfa'}-${Date.now().toString(36)}`,
      name: `Imported ${isNfa ? 'NFA' : 'DFA'}`,
      description: 'Automaton imported from transition table text.',
      language: 'Imported language',
      alphabet,
      start: startState,
      states,
      edges: syncEdgesFromDelta(states, delta),
      delta,
      nondeterministic: isNfa,
    }

    return { success: true, automaton: auto }
  } catch (err: any) {
    return { success: false, error: `Failed to parse table: ${err.message || err}` }
  }
}

/**
 * Exports transition table into cleanly formatted Markdown.
 */
export function exportTransitionTableText(auto: Automaton): string {
  const symbols = [...auto.alphabet]
  if (auto.nondeterministic) {
    const hasEps = auto.states.some((s) => (auto.delta[s.id]?.[EPSILON]?.length ?? 0) > 0)
    if (hasEps) symbols.push(EPSILON)
  }

  const header = `| State | ${symbols.join(' | ')} |`
  const divider = `| :--- | ${symbols.map(() => ':---').join(' | ')} |`

  const rows = auto.states.map((s) => {
    const prefix = `${s.id === auto.start ? '→ ' : ''}${s.accept ? '* ' : ''}${s.id}`
    const cols = symbols.map((sym) => {
      const targets = auto.delta[s.id]?.[sym] ?? []
      if (targets.length === 0) return '—'
      return targets.length === 1 ? targets[0] : `{${targets.join(', ')}}`
    })
    return `| ${prefix} | ${cols.join(' | ')} |`
  })

  return [header, divider, ...rows].join('\n')
}

/**
 * Educational sample automata library for learning and reference.
 */
export const SAMPLE_LEARNING_AUTOMATA: Record<string, { label: string; automaton: Automaton }> = {
  dfa_ends_01: {
    label: 'DFA: Ends with "01"',
    automaton: {
      id: 'sample-dfa-ends-01',
      name: 'DFA: Ends with "01"',
      description: 'Standard 3-state complete DFA accepting strings ending in 01.',
      language: 'Strings over {0,1} ending in 01',
      alphabet: ['0', '1'],
      start: 'q0',
      states: [
        { id: 'q0', x: 100, y: 180, accept: false },
        { id: 'q1', x: 260, y: 180, accept: false },
        { id: 'q2', x: 420, y: 180, accept: true },
      ],
      edges: [],
      delta: {
        q0: { '0': ['q1'], '1': ['q0'] },
        q1: { '0': ['q1'], '1': ['q2'] },
        q2: { '0': ['q1'], '1': ['q0'] },
      },
      nondeterministic: false,
    },
  },
  dfa_even_zeros: {
    label: 'DFA: Even number of 0s',
    automaton: {
      id: 'sample-dfa-even-zeros',
      name: 'DFA: Even number of 0s',
      description: '2-state DFA tracking parity of zeros.',
      language: 'Strings over {0,1} with an even count of 0s',
      alphabet: ['0', '1'],
      start: 'q_even',
      states: [
        { id: 'q_even', x: 140, y: 180, accept: true },
        { id: 'q_odd', x: 320, y: 180, accept: false },
      ],
      edges: [],
      delta: {
        q_even: { '0': ['q_odd'], '1': ['q_even'] },
        q_odd: { '0': ['q_even'], '1': ['q_odd'] },
      },
      nondeterministic: false,
    },
  },
  nfa_ends_01: {
    label: 'NFA: Ends with "01" (Non-deterministic guess)',
    automaton: {
      id: 'sample-nfa-ends-01',
      name: 'NFA: Ends with "01"',
      description: 'Compact 3-state NFA guessing the start of suffix 01.',
      language: 'Strings over {0,1} ending in 01',
      alphabet: ['0', '1'],
      start: 'q0',
      states: [
        { id: 'q0', x: 100, y: 180, accept: false },
        { id: 'q1', x: 260, y: 180, accept: false },
        { id: 'q2', x: 420, y: 180, accept: true },
      ],
      edges: [],
      delta: {
        q0: { '0': ['q0', 'q1'], '1': ['q0'] },
        q1: { '1': ['q2'] },
        q2: {},
      },
      nondeterministic: true,
    },
  },
  nfa_third_from_end: {
    label: 'NFA: 3rd symbol from end is 1',
    automaton: {
      id: 'sample-nfa-third-from-end',
      name: 'NFA: 3rd from end is 1',
      description: '4-state NFA guessing the symbol 3 positions from the end.',
      language: 'Strings over {0,1} whose 3rd symbol from end is 1',
      alphabet: ['0', '1'],
      start: 'q0',
      states: [
        { id: 'q0', x: 80, y: 180, accept: false },
        { id: 'q1', x: 200, y: 180, accept: false },
        { id: 'q2', x: 320, y: 180, accept: false },
        { id: 'q3', x: 440, y: 180, accept: true },
      ],
      edges: [],
      delta: {
        q0: { '0': ['q0'], '1': ['q0', 'q1'] },
        q1: { '0': ['q2'], '1': ['q2'] },
        q2: { '0': ['q3'], '1': ['q3'] },
        q3: {},
      },
      nondeterministic: true,
    },
  },
}

// Sync edges on export for sample automata
for (const sample of Object.values(SAMPLE_LEARNING_AUTOMATA)) {
  sample.automaton.edges = syncEdgesFromDelta(sample.automaton.states, sample.automaton.delta)
}
