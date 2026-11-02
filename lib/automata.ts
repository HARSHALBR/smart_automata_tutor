export const EPSILON = 'ε'

export interface AutoState {
  id: string
  x: number
  y: number
  accept?: boolean
}

export interface AutoEdge {
  from: string
  to: string
  /** symbols shown on this edge (already grouped) */
  label: string
}

export interface Automaton {
  id: string
  name: string
  description: string
  /** Plain-English language this machine recognizes. */
  language: string
  alphabet: string[]
  start: string
  states: AutoState[]
  edges: AutoEdge[]
  /** delta[stateId][symbol] -> list of destination states */
  delta: Record<string, Record<string, string[]>>
  nondeterministic?: boolean
}

export interface RunStep {
  /** symbols consumed so far */
  consumed: number
  /** the symbol that triggered this step (undefined for the initial step) */
  symbol?: string
  /** active states after this step */
  active: string[]
}

/** epsilon-closure of a set of states */
function epsilonClosure(
  automaton: Automaton,
  states: string[],
): string[] {
  const valid = states.filter((s) => Boolean(s))
  const stack = [...valid]
  const seen = new Set(valid)
  while (stack.length) {
    const s = stack.pop() as string
    const next = automaton.delta[s]?.[EPSILON] ?? []
    for (const n of next) {
      if (!seen.has(n)) {
        seen.add(n)
        stack.push(n)
      }
    }
  }
  return [...seen]
}

/**
 * Runs an automaton over the input and returns the full trace of active
 * state sets. Works for both DFAs and NFAs (with ε-moves).
 */
export function runAutomaton(automaton: Automaton, input: string): RunStep[] {
  let active = epsilonClosure(automaton, [automaton.start])
  const steps: RunStep[] = [{ consumed: 0, active }]

  for (let i = 0; i < input.length; i++) {
    const symbol = input[i]
    const next = new Set<string>()
    for (const state of active) {
      const dests = automaton.delta[state]?.[symbol] ?? []
      for (const d of dests) next.add(d)
    }
    active = epsilonClosure(automaton, [...next])
    steps.push({ consumed: i + 1, symbol, active })
  }
  return steps
}

export function isAccepting(automaton: Automaton, active: string[]): boolean {
  const accepts = new Set(
    automaton.states.filter((s) => s.accept).map((s) => s.id),
  )
  return active.some((id) => accepts.has(id))
}

export function validInput(automaton: Automaton, input: string): boolean {
  return [...input].every((c) => automaton.alphabet.includes(c))
}

/* ----------------------------- example machines ---------------------------- */

export const DFA_EVEN_ZEROS: Automaton = {
  id: 'even-zeros',
  name: 'Even number of 0s',
  description:
    'Accepts exactly the binary strings that contain an even number of 0s.',
  language: 'Strings over {0,1} with an even count of 0s',
  alphabet: ['0', '1'],
  start: 'even',
  states: [
    { id: 'even', x: 150, y: 150, accept: true },
    { id: 'odd', x: 420, y: 150 },
  ],
  edges: [
    { from: 'even', to: 'odd', label: '0' },
    { from: 'odd', to: 'even', label: '0' },
    { from: 'even', to: 'even', label: '1' },
    { from: 'odd', to: 'odd', label: '1' },
  ],
  delta: {
    even: { '0': ['odd'], '1': ['even'] },
    odd: { '0': ['even'], '1': ['odd'] },
  },
}

export const DFA_ENDS_01: Automaton = {
  id: 'ends-01',
  name: 'Ends with 01',
  description: 'Accepts every binary string whose last two symbols are 0 then 1.',
  language: 'Strings over {0,1} ending in 01',
  alphabet: ['0', '1'],
  start: 'q0',
  states: [
    { id: 'q0', x: 110, y: 220 },
    { id: 'q1', x: 320, y: 110 },
    { id: 'q2', x: 520, y: 220, accept: true },
  ],
  edges: [
    { from: 'q0', to: 'q1', label: '0' },
    { from: 'q0', to: 'q0', label: '1' },
    { from: 'q1', to: 'q1', label: '0' },
    { from: 'q1', to: 'q2', label: '1' },
    { from: 'q2', to: 'q1', label: '0' },
    { from: 'q2', to: 'q0', label: '1' },
  ],
  delta: {
    q0: { '0': ['q1'], '1': ['q0'] },
    q1: { '0': ['q1'], '1': ['q2'] },
    q2: { '0': ['q1'], '1': ['q0'] },
  },
}

export const NFA_THIRD_FROM_END: Automaton = {
  id: 'third-1',
  name: 'Third symbol from the end is 1',
  description:
    'A nondeterministic machine that "guesses" when the third-to-last symbol arrives. Tiny to describe, but its DFA equivalent needs 8 states.',
  language: 'Strings over {0,1} whose 3rd symbol from the end is 1',
  alphabet: ['0', '1'],
  start: 'a',
  nondeterministic: true,
  states: [
    { id: 'a', x: 90, y: 170 },
    { id: 'b', x: 250, y: 170 },
    { id: 'c', x: 410, y: 170 },
    { id: 'd', x: 570, y: 170, accept: true },
  ],
  edges: [
    { from: 'a', to: 'a', label: '0,1' },
    { from: 'a', to: 'b', label: '1' },
    { from: 'b', to: 'c', label: '0,1' },
    { from: 'c', to: 'd', label: '0,1' },
  ],
  delta: {
    a: { '0': ['a'], '1': ['a', 'b'] },
    b: { '0': ['c'], '1': ['c'] },
    c: { '0': ['d'], '1': ['d'] },
    d: {},
  },
}

export const NFA_EPSILON: Automaton = {
  id: 'eps-multiples',
  name: 'Multiples of 2 or 3 (unary)',
  description:
    'Uses ε-transitions to nondeterministically choose between two loops: one counting by 2s, one by 3s.',
  language: 'Strings of a’s whose length is a multiple of 2 or of 3',
  alphabet: ['a'],
  start: 's',
  nondeterministic: true,
  states: [
    { id: 's', x: 90, y: 200 },
    { id: 't0', x: 280, y: 90, accept: true },
    { id: 't1', x: 470, y: 90 },
    { id: 'h0', x: 280, y: 320, accept: true },
    { id: 'h1', x: 430, y: 320 },
    { id: 'h2', x: 580, y: 320 },
  ],
  edges: [
    { from: 's', to: 't0', label: EPSILON },
    { from: 's', to: 'h0', label: EPSILON },
    { from: 't0', to: 't1', label: 'a' },
    { from: 't1', to: 't0', label: 'a' },
    { from: 'h0', to: 'h1', label: 'a' },
    { from: 'h1', to: 'h2', label: 'a' },
    { from: 'h2', to: 'h0', label: 'a' },
  ],
  delta: {
    s: { [EPSILON]: ['t0', 'h0'] },
    t0: { a: ['t1'] },
    t1: { a: ['t0'] },
    h0: { a: ['h1'] },
    h1: { a: ['h2'] },
    h2: { a: ['h0'] },
  },
}

export const DFA_EXAMPLES: Automaton[] = [DFA_EVEN_ZEROS, DFA_ENDS_01]
export const NFA_EXAMPLES: Automaton[] = [NFA_THIRD_FROM_END, NFA_EPSILON]

/* -------------------- Mathematical Engine & Validation -------------------- */

export interface FormalTuple {
  states: string[]
  alphabet: string[]
  start: string
  accept: string[]
  transitionsCount: number
}

export interface ValidationIssue {
  type: 'error' | 'warning'
  code: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  isDeterministic: boolean
  isCompleteDfa: boolean
  reachableStates: string[]
  unreachableStates: string[]
  formalTuple: FormalTuple
}

export interface DetailedRunStep {
  stepIndex: number
  consumed: number
  symbol?: string
  activeStates: string[]
  transitionsTaken: { from: string; symbol: string; to: string }[]
  explanation: string
}

export interface DetailedRunResult {
  accepted: boolean
  steps: DetailedRunStep[]
  finalStates: string[]
  verdictExplanation: string
}

export interface TransitionTableRow {
  state: string
  isStart: boolean
  isAccept: boolean
  targets: Record<string, string[]>
}

export interface TransitionTableData {
  alphabet: string[]
  hasEpsilon: boolean
  rows: TransitionTableRow[]
}

/**
 * Synchronizes edge list from delta mapping, grouping common symbols for clean display.
 */
export function syncEdgesFromDelta(
  states: AutoState[],
  delta: Record<string, Record<string, string[]>>,
): AutoEdge[] {
  const edgeMap = new Map<string, Set<string>>()
  for (const [from, symbolMap] of Object.entries(delta)) {
    for (const [symbol, targets] of Object.entries(symbolMap)) {
      for (const to of targets) {
        const key = `${from}\u0000${to}`
        const set = edgeMap.get(key) ?? new Set<string>()
        set.add(symbol)
        edgeMap.set(key, set)
      }
    }
  }

  const edges: AutoEdge[] = []
  for (const [key, symbols] of edgeMap.entries()) {
    const [from, to] = key.split('\u0000')
    edges.push({
      from,
      to,
      label: Array.from(symbols).sort().join(','),
    })
  }
  return edges
}

/**
 * Synchronizes delta mapping from edge list.
 */
export function syncDeltaFromEdges(
  states: AutoState[],
  edges: AutoEdge[],
): Record<string, Record<string, string[]>> {
  const delta: Record<string, Record<string, string[]>> = {}
  for (const s of states) delta[s.id] = {}

  for (const edge of edges) {
    if (!delta[edge.from]) delta[edge.from] = {}
    const symbols = edge.label.split(',').map((s) => s.trim()).filter(Boolean)
    for (const sym of symbols) {
      const current = delta[edge.from][sym] ?? []
      if (!current.includes(edge.to)) {
        delta[edge.from][sym] = [...current, edge.to]
      }
    }
  }
  return delta
}

/**
 * Finds all states reachable from the initial state via any transitions (including ε).
 */
export function findReachableStates(automaton: Automaton): Set<string> {
  const reachable = new Set<string>()
  if (!automaton.start || !automaton.states.some((s) => s.id === automaton.start)) {
    return reachable
  }

  const queue = epsilonClosure(automaton, [automaton.start])
  for (const s of queue) reachable.add(s)

  let pointer = 0
  while (pointer < queue.length) {
    const curr = queue[pointer++]
    const symbolMap = automaton.delta[curr] ?? {}
    for (const [sym, dests] of Object.entries(symbolMap)) {
      const targets = sym === EPSILON ? dests : epsilonClosure(automaton, dests)
      for (const t of targets) {
        if (!reachable.has(t)) {
          reachable.add(t)
          queue.push(t)
        }
      }
    }
  }
  return reachable
}

/**
 * Validates formal invariants of an automaton (DFA or NFA).
 */
export function validateAutomaton(
  automaton: Automaton,
  options?: { completeDfaRequired?: boolean },
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const stateIds = new Set(automaton.states.map((s) => s.id))
  const alphabetSet = new Set(automaton.alphabet)

  // 1. Check start state
  if (!automaton.start) {
    errors.push('No start state specified.')
  } else if (!stateIds.has(automaton.start)) {
    errors.push(`Start state "${automaton.start}" is not in the set of states.`)
  }

  // 2. Check accepting states
  for (const s of automaton.states) {
    if (s.accept && !stateIds.has(s.id)) {
      errors.push(`Accepting state "${s.id}" is not in the state set.`)
    }
  }

  // 3. Alphabet validation
  if (automaton.alphabet.length === 0) {
    errors.push('Alphabet Σ cannot be empty.')
  }
  if (alphabetSet.has(EPSILON)) {
    errors.push(`Alphabet cannot contain the empty-string symbol "${EPSILON}".`)
  }

  // 4. Check transitions for valid symbols and states
  let isDeterministic = !automaton.nondeterministic
  let isCompleteDfa = true
  let transitionsCount = 0

  for (const [fromState, symbolMap] of Object.entries(automaton.delta)) {
    if (!stateIds.has(fromState)) {
      errors.push(`Transition defined from nonexistent state "${fromState}".`)
    }
    for (const [symbol, targets] of Object.entries(symbolMap)) {
      if (symbol !== EPSILON && !alphabetSet.has(symbol)) {
        errors.push(
          `Transition on symbol "${symbol}" from state "${fromState}" uses a symbol not in alphabet Σ.`,
        )
      }
      if (symbol === EPSILON && !automaton.nondeterministic) {
        isDeterministic = false
      }
      if (targets.length > 1) {
        isDeterministic = false
      }
      for (const target of targets) {
        transitionsCount++
        if (!stateIds.has(target)) {
          errors.push(
            `Transition from "${fromState}" on "${symbol}" leads to nonexistent state "${target}".`,
          )
        }
      }
    }
  }

  // 5. Check DFA completeness
  for (const state of automaton.states) {
    for (const sym of automaton.alphabet) {
      const dests = automaton.delta[state.id]?.[sym] ?? []
      if (dests.length === 0) {
        isCompleteDfa = false
      }
      if (dests.length > 1) {
        isDeterministic = false
      }
    }
    if ((automaton.delta[state.id]?.[EPSILON]?.length ?? 0) > 0) {
      isDeterministic = false
    }
  }

  if (options?.completeDfaRequired) {
    if (!isDeterministic) {
      errors.push('Automaton is not deterministic (contains multiple targets or ε-transitions).')
    }
    if (!isCompleteDfa) {
      errors.push(
        'DFA is incomplete: some states do not have transitions defined for all alphabet symbols.',
      )
    }
  }

  // 6. Reachability check
  const reachable = findReachableStates(automaton)
  const unreachable = automaton.states.filter((s) => !reachable.has(s.id)).map((s) => s.id)
  if (unreachable.length > 0) {
    warnings.push(`Automaton contains ${unreachable.length} unreachable state(s): ${unreachable.join(', ')}.`)
  }

  const acceptStates = automaton.states.filter((s) => s.accept).map((s) => s.id)
  if (acceptStates.length === 0) {
    warnings.push('Automaton has no accepting states (it rejects all inputs).')
  }

  const formalTuple: FormalTuple = {
    states: automaton.states.map((s) => s.id),
    alphabet: [...automaton.alphabet],
    start: automaton.start,
    accept: acceptStates,
    transitionsCount,
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    isDeterministic,
    isCompleteDfa,
    reachableStates: Array.from(reachable),
    unreachableStates: unreachable,
    formalTuple,
  }
}

/**
 * Runs the automaton and returns a detailed execution trace with per-step explanations.
 */
export function runAutomatonDetailed(
  automaton: Automaton,
  input: string,
): DetailedRunResult {
  const steps: DetailedRunStep[] = []
  let active = epsilonClosure(automaton, [automaton.start])
  
  steps.push({
    stepIndex: 0,
    consumed: 0,
    activeStates: [...active],
    transitionsTaken: [],
    explanation:
      active.length === 1 && active[0] === automaton.start
        ? `Initial state: {${automaton.start}}`
        : `Initial active set via ε-closure({${automaton.start}}) = {${active.join(', ')}}`,
  })

  for (let i = 0; i < input.length; i++) {
    const symbol = input[i]
    const taken: { from: string; symbol: string; to: string }[] = []
    const rawNext = new Set<string>()

    for (const s of active) {
      const dests = automaton.delta[s]?.[symbol] ?? []
      for (const d of dests) {
        taken.push({ from: s, symbol, to: d })
        rawNext.add(d)
      }
    }

    const nextActive = epsilonClosure(automaton, Array.from(rawNext))

    let explanation: string
    if (nextActive.length === 0) {
      explanation = `Read '${symbol}' at position ${i + 1}: no transitions available. Computation enters dead state (rejecting).`
    } else {
      const transitionsSummary = taken
        .map((t) => `${t.from} → ${t.to}`)
        .join(', ')
      explanation = `Read '${symbol}' at position ${i + 1}: [${transitionsSummary}] yields active states {${nextActive.join(', ')}}.`
    }

    steps.push({
      stepIndex: i + 1,
      consumed: i + 1,
      symbol,
      activeStates: [...nextActive],
      transitionsTaken: taken,
      explanation,
    })

    active = nextActive
  }

  const accepted = isAccepting(automaton, active)
  const acceptSet = new Set(automaton.states.filter((s) => s.accept).map((s) => s.id))
  const acceptingFinalStates = active.filter((s) => acceptSet.has(s))

  let verdictExplanation: string
  if (accepted) {
    verdictExplanation = `Accepted: final active set {${active.join(', ')}} contains accepting state(s) {${acceptingFinalStates.join(', ')}}.`
  } else {
    verdictExplanation = `Rejected: final active set {${active.join(', ')}} does not contain any accepting state.`
  }

  return {
    accepted,
    steps,
    finalStates: active,
    verdictExplanation,
  }
}

/**
 * Builds structured transition table data for display and export.
 */
export function generateTransitionTable(automaton: Automaton): TransitionTableData {
  const hasEpsilon = automaton.states.some(
    (s) => (automaton.delta[s.id]?.[EPSILON]?.length ?? 0) > 0,
  )
  const symbols = [...automaton.alphabet]
  if (hasEpsilon) symbols.push(EPSILON)

  const rows: TransitionTableRow[] = automaton.states.map((s) => {
    const targets: Record<string, string[]> = {}
    for (const sym of symbols) {
      targets[sym] = automaton.delta[s.id]?.[sym] ?? []
    }
    return {
      state: s.id,
      isStart: s.id === automaton.start,
      isAccept: !!s.accept,
      targets,
    }
  })

  return {
    alphabet: automaton.alphabet,
    hasEpsilon,
    rows,
  }
}

/**
 * Formats transition table into standard academic Markdown / LaTeX compatible format.
 */
export function formatTransitionTableMarkdown(automaton: Automaton): string {
  const table = generateTransitionTable(automaton)
  const cols = ['State', ...table.alphabet]
  if (table.hasEpsilon) cols.push('ε')

  const header = `| ${cols.join(' | ')} |`
  const separator = `| ${cols.map(() => '---').join(' | ')} |`

  const rows = table.rows.map((row) => {
    const marker = `${row.isStart ? '→ ' : ''}${row.isAccept ? '* ' : ''}${row.state}`
    const targetCols = (table.hasEpsilon ? [...table.alphabet, EPSILON] : table.alphabet).map(
      (sym) => {
        const dests = row.targets[sym] ?? []
        if (dests.length === 0) return '—'
        return dests.length === 1 ? dests[0] : `{${dests.join(', ')}}`
      },
    )
    return `| ${[marker, ...targetCols].join(' | ')} |`
  })

  return [header, separator, ...rows].join('\n')
}

/**
 * Completes an incomplete DFA by adding an explicit sink (trap) state and routing missing transitions to it.
 */
export function completeDfaWithSink(
  automaton: Automaton,
  sinkId: string = 'q_sink',
): Automaton {
  const copy: Automaton = JSON.parse(JSON.stringify(automaton))
  let needsSink = false

  for (const s of copy.states) {
    if (!copy.delta[s.id]) copy.delta[s.id] = {}
    for (const sym of copy.alphabet) {
      if (!copy.delta[s.id][sym] || copy.delta[s.id][sym].length === 0) {
        needsSink = true
      }
    }
  }

  if (!needsSink) return copy

  // Ensure sinkId is unique
  let finalSinkId = sinkId
  let counter = 1
  while (copy.states.some((s) => s.id === finalSinkId)) {
    finalSinkId = `${sinkId}_${counter++}`
  }

  // Add sink state
  copy.states.push({
    id: finalSinkId,
    x: 400,
    y: 350,
    accept: false,
  })
  copy.delta[finalSinkId] = {}
  for (const sym of copy.alphabet) {
    copy.delta[finalSinkId][sym] = [finalSinkId]
  }

  // Route missing transitions to sink
  for (const s of copy.states) {
    if (s.id === finalSinkId) continue
    for (const sym of copy.alphabet) {
      if (!copy.delta[s.id][sym] || copy.delta[s.id][sym].length === 0) {
        copy.delta[s.id][sym] = [finalSinkId]
      }
    }
  }

  copy.edges = syncEdgesFromDelta(copy.states, copy.delta)
  return copy
}

