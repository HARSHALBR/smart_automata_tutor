/**
 * DFA minimization via partition refinement (Moore's algorithm), producing a
 * step-by-step trace of the partitions and detailed mathematical explanations.
 */
import {
  type Automaton,
  type AutoState,
  findReachableStates,
  completeDfaWithSink,
  syncEdgesFromDelta,
} from './automata'

export interface PartitionStep {
  /** human-readable description of what happened */
  note: string
  /** the current partition: groups of state ids */
  groups: string[][]
}

export interface MergeRationale {
  minimizedState: string
  originalStates: string[]
  reason: string
}

export interface MinimizeResult {
  steps: PartitionStep[]
  minimized: Automaton
  originalStateCount: number
  reachableStateCount: number
  minimizedStateCount: number
  unreachableStatesRemoved: string[]
  mergeRationales: MergeRationale[]
}

/** first transition target of a state on a symbol (DFAs are deterministic) */
function step(dfa: Automaton, state: string, sym: string): string | undefined {
  return dfa.delta[state]?.[sym]?.[0]
}

/** index of the group containing `state` in the given partition */
function groupOf(partition: string[][], state: string): number {
  return partition.findIndex((g) => g.includes(state))
}

export function minimizeDfa(originalDfa: Automaton): MinimizeResult {
  const steps: PartitionStep[] = []
  const originalStateCount = originalDfa.states.length

  // Step 1: Remove unreachable states
  const reachable = findReachableStates(originalDfa)
  const unreachableStatesRemoved = originalDfa.states
    .filter((s) => !reachable.has(s.id))
    .map((s) => s.id)

  let dfa = originalDfa
  if (unreachableStatesRemoved.length > 0) {
    const reachableStates = dfa.states.filter((s) => reachable.has(s.id))
    const reachableDelta: Record<string, Record<string, string[]>> = {}
    for (const s of reachableStates) {
      reachableDelta[s.id] = {}
      for (const [sym, targets] of Object.entries(dfa.delta[s.id] ?? {})) {
        reachableDelta[s.id][sym] = targets.filter((t) => reachable.has(t))
      }
    }
    dfa = {
      ...dfa,
      states: reachableStates,
      delta: reachableDelta,
      edges: syncEdgesFromDelta(reachableStates, reachableDelta),
    }
    steps.push({
      note: `Pre-processing: Removed ${unreachableStatesRemoved.length} unreachable state(s): {${unreachableStatesRemoved.join(', ')}}.`,
      groups: [dfa.states.map((s) => s.id)],
    })
  }

  // Ensure DFA is complete over its alphabet (add sink if missing transitions)
  dfa = completeDfaWithSink(dfa)
  const reachableStateCount = dfa.states.length

  const accepting = new Set(
    dfa.states.filter((s) => s.accept).map((s) => s.id),
  )
  const accept = dfa.states.filter((s) => accepting.has(s.id)).map((s) => s.id)
  const reject = dfa.states.filter((s) => !accepting.has(s.id)).map((s) => s.id)

  let partition: string[][] = [reject, accept].filter((g) => g.length > 0)
  steps.push({
    note:
      partition.length === 2
        ? 'Initial partition P0: Split states into Non-accepting { ' +
          reject.join(', ') +
          ' } and Accepting { ' +
          accept.join(', ') +
          ' }.'
        : 'Initial partition P0: All states belong to the same acceptance class.',
    groups: partition.map((g) => [...g]),
  })

  let changed = true
  let iteration = 1

  while (changed) {
    changed = false
    const next: string[][] = []
    const splitNotes: string[] = []

    for (const group of partition) {
      if (group.length <= 1) {
        next.push(group)
        continue
      }

      // signature: for each state, which group does each symbol lead to?
      const buckets = new Map<string, string[]>()
      for (const state of group) {
        const sig = dfa.alphabet
          .map((sym) => {
            const t = step(dfa, state, sym)
            return t === undefined ? 'x' : groupOf(partition, t)
          })
          .join(',')
        const list = buckets.get(sig) ?? []
        list.push(state)
        buckets.set(sig, list)
      }

      if (buckets.size > 1) {
        changed = true
        const subGroups = Array.from(buckets.values())
        for (const list of subGroups) next.push(list)
        splitNotes.push(
          `Group {${group.join(', ')}} splits into ${subGroups
            .map((sg) => `{${sg.join(', ')}}`)
            .join(' and ')} due to differing transition destinations.`,
        )
      } else {
        next.push(group)
      }
    }

    if (changed) {
      partition = next
      steps.push({
        note: `Refinement step P${iteration}: ${splitNotes.join(' ')}`,
        groups: partition.map((g) => [...g]),
      })
      iteration++
    }
  }

  steps.push({
    note: `Fixpoint reached at P${iteration}: No group can be partitioned further. The minimized DFA has ${partition.length} state(s).`,
    groups: partition.map((g) => [...g]),
  })

  // Build the minimized automaton, one state per partition group
  const startGroup = groupOf(partition, dfa.start)
  const name = (idx: number) => (partition.length <= 8 ? `q${idx}` : `G${idx}`)

  const states: AutoState[] = partition.map((group, idx) => {
    const angle = (idx / partition.length) * Math.PI * 2 - Math.PI / 2
    const radiusX = Math.min(260, 140 + partition.length * 15)
    const radiusY = Math.min(180, 100 + partition.length * 10)
    return {
      id: name(idx),
      x: 320 + Math.cos(angle) * radiusX,
      y: 200 + Math.sin(angle) * radiusY,
      accept: group.some((s) => accepting.has(s)),
    }
  })

  const delta: Record<string, Record<string, string[]>> = {}
  const edgeMap = new Map<string, Set<string>>()
  const mergeRationales: MergeRationale[] = []

  partition.forEach((group, idx) => {
    const stateName = name(idx)
    delta[stateName] = {}
    const rep = group[0]

    for (const sym of dfa.alphabet) {
      const t = step(dfa, rep, sym)
      if (t === undefined) continue
      const targetGroup = groupOf(partition, t)
      const targetName = name(targetGroup)
      delta[stateName][sym] = [targetName]

      const key = `${stateName}->${targetName}`
      const syms = edgeMap.get(key) ?? new Set<string>()
      syms.add(sym)
      edgeMap.set(key, syms)
    }

    mergeRationales.push({
      minimizedState: stateName,
      originalStates: group,
      reason:
        group.length > 1
          ? `Original states {${group.join(', ')}} are indistinguishable under all possible input strings and merge into state ${stateName}.`
          : `State ${group[0]} is unique in its equivalence class and maps to ${stateName}.`,
    })
  })

  const edges = syncEdgesFromDelta(states, delta)

  const minimized: Automaton = {
    id: `${originalDfa.id}-min`,
    name: `${originalDfa.name} (minimized)`,
    description: `Minimal DFA for ${originalDfa.name} with ${states.length} states.`,
    language: originalDfa.language,
    alphabet: originalDfa.alphabet,
    start: name(startGroup),
    states,
    edges,
    delta,
    nondeterministic: false,
  }

  return {
    steps,
    minimized,
    originalStateCount,
    reachableStateCount,
    minimizedStateCount: states.length,
    unreachableStatesRemoved,
    mergeRationales,
  }
}

/* ------------------------------ example DFAs ------------------------------- */

/**
 * A deliberately redundant DFA: several states are equivalent and collapse
 * under minimization. Recognizes strings over {a,b} that contain "ab".
 */
export const REDUNDANT_DFA: Automaton = {
  id: 'contains-ab-redundant',
  name: 'Contains “ab” (redundant)',
  description:
    'A bloated 5-state DFA recognizing strings that contain the substring ab. Two of its states turn out to be equivalent.',
  language: 'Strings over {a,b} containing the substring ab',
  alphabet: ['a', 'b'],
  start: 's0',
  states: [
    { id: 's0', x: 90, y: 200 },
    { id: 's1', x: 250, y: 110 },
    { id: 's2', x: 250, y: 300 },
    { id: 's3', x: 470, y: 110, accept: true },
    { id: 's4', x: 470, y: 300, accept: true },
  ],
  edges: [
    { from: 's0', to: 's1', label: 'a' },
    { from: 's0', to: 's2', label: 'b' },
    { from: 's1', to: 's1', label: 'a' },
    { from: 's1', to: 's3', label: 'b' },
    { from: 's2', to: 's1', label: 'a' },
    { from: 's2', to: 's2', label: 'b' },
    { from: 's3', to: 's3', label: 'a,b' },
    { from: 's4', to: 's4', label: 'a,b' },
  ],
  delta: {
    s0: { a: ['s1'], b: ['s2'] },
    s1: { a: ['s1'], b: ['s3'] },
    s2: { a: ['s1'], b: ['s2'] },
    s3: { a: ['s3'], b: ['s3'] },
    s4: { a: ['s4'], b: ['s4'] },
  },
}
