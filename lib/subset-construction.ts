import {
  EPSILON,
  type Automaton,
  type AutoState,
  syncEdgesFromDelta,
  findReachableStates,
} from './automata'

/** epsilon-closure of a set of NFA state ids */
export function epsilonClosure(nfa: Automaton, ids: string[]): string[] {
  const valid = ids.filter((id) => Boolean(id))
  const stack = [...valid]
  const seen = new Set(valid)
  while (stack.length) {
    const s = stack.pop() as string
    for (const n of nfa.delta[s]?.[EPSILON] ?? []) {
      if (!seen.has(n)) {
        seen.add(n)
        stack.push(n)
      }
    }
  }
  return Array.from(seen).sort()
}

/** Compute the set of states reachable on a symbol from a set of states (without ε-closure) */
export function move(nfa: Automaton, ids: string[], symbol: string): string[] {
  const out = new Set<string>()
  for (const id of ids) {
    for (const d of nfa.delta[id]?.[symbol] ?? []) out.add(d)
  }
  return Array.from(out).sort()
}

export interface DfaNode {
  /** sorted NFA state ids that make up this DFA state */
  members: string[]
  /** display label like {a,b} or ∅ */
  label: string
  accept: boolean
}

export interface SubsetStep {
  /** human description of what happened in this step */
  note: string
  /** the DFA state being processed (label), null for the initial step */
  processing: string | null
  /** symbol being followed in this step, if any */
  symbol?: string
  /** the resulting DFA state label produced, if any */
  produced?: string
  /** snapshot of all DFA nodes discovered so far */
  nodes: DfaNode[]
  /** snapshot of DFA transitions discovered: [from,symbol,to] */
  transitions: { from: string; symbol: string; to: string }[]
  /** labels still waiting to be processed after this step */
  queue: string[]
}

export interface IntermediateTableRow {
  subsetLabel: string
  members: string[]
  isStart: boolean
  isAccept: boolean
  acceptReason?: string
  transitions: Record<
    string,
    {
      moveResult: string[]
      closureResult: string[]
      targetLabel: string
      derivation: string
    }
  >
}

export interface NfaToDfaResult {
  dfa: Automaton
  steps: SubsetStep[]
  intermediateTable: IntermediateTableRow[]
  summary: string
}

export const labelOf = (members: string[]): string =>
  members.length === 0 ? '∅' : `{${members.join(',')}}`

/**
 * Full subset construction converting an NFA to an equivalent DFA with complete
 * mathematical derivations, intermediate transition table, and animated steps.
 */
export function convertNfaToDfa(nfa: Automaton): NfaToDfaResult {
  const acceptSet = new Set(
    nfa.states.filter((s) => s.accept).map((s) => s.id),
  )
  const symbols = [...nfa.alphabet].filter((s) => s !== EPSILON)
  const steps: SubsetStep[] = []

  const nodes: DfaNode[] = []
  const transitions: { from: string; symbol: string; to: string }[] = []
  const byLabel = new Map<string, DfaNode>()
  const queue: string[] = []
  const tableRows: IntermediateTableRow[] = []

  function ensure(members: string[]): string {
    const label = labelOf(members)
    if (!byLabel.has(label)) {
      const isAccept = members.some((m) => acceptSet.has(m))
      const node: DfaNode = {
        members,
        label,
        accept: isAccept,
      }
      byLabel.set(label, node)
      nodes.push(node)
      queue.push(label)
    }
    return label
  }

  // Initial state of DFA = ε-closure of NFA start state
  const startMembers = epsilonClosure(nfa, [nfa.start])
  const startLabel = ensure(startMembers)

  steps.push({
    note: `Start DFA state = ε-closure of {${nfa.start}} = ${startLabel}. Add it to the worklist.`,
    processing: null,
    produced: startLabel,
    nodes: nodes.map((n) => ({ ...n })),
    transitions: [...transitions],
    queue: [...queue],
  })

  const delta: Record<string, Record<string, string[]>> = {}

  while (queue.length > 0) {
    const label = queue.shift() as string
    const node = byLabel.get(label)!
    delta[label] = {}

    const matchingAccepts = node.members.filter((m) => acceptSet.has(m))
    const acceptReason = node.accept
      ? `Accepting because it contains NFA accepting state(s): ${matchingAccepts.join(', ')}`
      : 'Non-accepting (contains no NFA accepting states)'

    const rowTransitions: IntermediateTableRow['transitions'] = {}

    for (const symbol of symbols) {
      const rawMove = move(nfa, node.members, symbol)
      const reached = epsilonClosure(nfa, rawMove)
      const toLabel = ensure(reached)

      transitions.push({ from: label, symbol, to: toLabel })
      delta[label][symbol] = [toLabel]

      const isNew = queue.includes(toLabel) && byLabel.get(toLabel)!.members === reached
      const moveStr = rawMove.length === 0 ? '∅' : `{${rawMove.join(',')}}`
      const derivation = `δ(${label}, '${symbol}') = ε-close(move(${label}, '${symbol}') = ${moveStr}) = ${toLabel}`

      rowTransitions[symbol] = {
        moveResult: rawMove,
        closureResult: reached,
        targetLabel: toLabel,
        derivation,
      }

      steps.push({
        note: `From ${label}, read '${symbol}': move gives ${moveStr}, then ε-closure gives ${toLabel}.${
          isNew ? ' This is a new DFA state — enqueue it.' : ''
        }`,
        processing: label,
        symbol,
        produced: toLabel,
        nodes: nodes.map((n) => ({ ...n })),
        transitions: [...transitions],
        queue: [...queue],
      })
    }

    tableRows.push({
      subsetLabel: label,
      members: node.members,
      isStart: label === startLabel,
      isAccept: node.accept,
      acceptReason,
      transitions: rowTransitions,
    })
  }

  steps.push({
    note: `Subset construction complete. The worklist is empty. The equivalent DFA has ${nodes.length} states.`,
    processing: null,
    nodes: nodes.map((n) => ({ ...n })),
    transitions: [...transitions],
    queue: [],
  })

  // Lay out states in an arranged circle/grid
  const states: AutoState[] = nodes.map((n, idx) => {
    const total = nodes.length
    const angle = (idx / total) * Math.PI * 2 - Math.PI / 2
    const radiusX = Math.min(260, 140 + total * 15)
    const radiusY = Math.min(180, 100 + total * 10)
    return {
      id: n.label,
      x: 340 + Math.cos(angle) * radiusX,
      y: 200 + Math.sin(angle) * radiusY,
      accept: n.accept,
    }
  })

  const dfaEdges = syncEdgesFromDelta(states, delta)

  const dfa: Automaton = {
    id: `${nfa.id}-dfa`,
    name: `${nfa.name} (DFA equivalent)`,
    description: `Deterministic finite automaton constructed via subset construction from ${nfa.name}.`,
    language: nfa.language,
    alphabet: symbols,
    start: startLabel,
    states,
    edges: dfaEdges,
    delta,
    nondeterministic: false,
  }

  const summary = `Subset construction converted ${nfa.states.length}-state NFA into an equivalent ${nodes.length}-state DFA over Σ = {${symbols.join(', ')}}. Every subset state represents a set of simultaneous active NFA states.`

  return {
    dfa,
    steps,
    intermediateTable: tableRows,
    summary,
  }
}

/**
 * Backward-compatible entrypoint used by existing tutorial labs.
 */
export function subsetConstruction(nfa: Automaton): SubsetStep[] {
  return convertNfaToDfa(nfa).steps
}
