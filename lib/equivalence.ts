import {
  type Automaton,
  runAutomatonDetailed,
  completeDfaWithSink,
  type DetailedRunResult,
} from './automata'
import { convertNfaToDfa } from './subset-construction'

export interface AutomatonComparisonResult {
  equivalent: boolean
  alphabet: string[]
  statesChecked: number
  counterexample?: string
  acceptedBy?: 'A' | 'B'
  traceA?: DetailedRunResult
  traceB?: DetailedRunResult
  explanation: string
}

/**
 * Checks whether two automata (DFA or NFA) recognize the exact same language (L(A) = L(B)).
 * If they are not equivalent, finds the shortest counterexample string w where
 * w in L(A) XOR w in L(B), with detailed simulation traces on both machines.
 */
export function compareAutomata(
  automatonA: Automaton,
  automatonB: Automaton,
): AutomatonComparisonResult {
  // Check start states presence
  if (!automatonA.start || !automatonA.states.some((s) => s.id === automatonA.start)) {
    return {
      equivalent: false,
      alphabet: [...automatonA.alphabet],
      statesChecked: 0,
      explanation: `Automaton A (${automatonA.name}) has no valid start state.`,
    }
  }
  if (!automatonB.start || !automatonB.states.some((s) => s.id === automatonB.start)) {
    return {
      equivalent: false,
      alphabet: [...automatonB.alphabet],
      statesChecked: 0,
      explanation: `Automaton B (${automatonB.name}) has no valid start state.`,
    }
  }

  // 1. Convert any NFA to DFA
  const dfaA = automatonA.nondeterministic ? convertNfaToDfa(automatonA).dfa : automatonA
  const dfaB = automatonB.nondeterministic ? convertNfaToDfa(automatonB).dfa : automatonB

  // 2. Unify alphabet
  const alphabetUnion = Array.from(
    new Set([...dfaA.alphabet, ...dfaB.alphabet]),
  ).sort()

  const hasAlphabetMismatch =
    dfaA.alphabet.length !== dfaB.alphabet.length ||
    !dfaA.alphabet.every((sym) => dfaB.alphabet.includes(sym))

  // 3. Complete both DFAs over the common alphabet
  const completeA = completeDfaWithSink({ ...dfaA, alphabet: alphabetUnion }, 'sink_A')
  const completeB = completeDfaWithSink({ ...dfaB, alphabet: alphabetUnion }, 'sink_B')

  const acceptSetA = new Set(completeA.states.filter((s) => s.accept).map((s) => s.id))
  const acceptSetB = new Set(completeB.states.filter((s) => s.accept).map((s) => s.id))

  // 4. Breadth-First Search on Product Automaton State Space (Q_A x Q_B)
  // Queue contains: [stateA, stateB, pathString]
  const queue: [string, string, string][] = [[completeA.start, completeB.start, '']]
  const visited = new Set<string>()
  visited.add(`${completeA.start}\u0000${completeB.start}`)

  while (queue.length > 0) {
    const [u, v, path] = queue.shift()!

    const uAccept = acceptSetA.has(u)
    const vAccept = acceptSetB.has(v)

    // Check symmetric difference condition: (u in F_A) XOR (v in F_B)
    if (uAccept !== vAccept) {
      const counterexample = path
      const acceptedBy = uAccept ? 'A' : 'B'
      const traceA = runAutomatonDetailed(automatonA, counterexample)
      const traceB = runAutomatonDetailed(automatonB, counterexample)

      const displayString = counterexample === '' ? 'ε (the empty string)' : `"${counterexample}"`
      const mismatchNote = hasAlphabetMismatch
        ? ` (Note: The automata have different declared alphabets: Σ_A = {${dfaA.alphabet.join(
            ', ',
          )}} vs Σ_B = {${dfaB.alphabet.join(', ')}}).`
        : ''
      const explanation =
        `The automata are NOT equivalent. The shortest distinguishing counterexample is ${displayString}.\n` +
        `• Automaton A (${automatonA.name}) ${uAccept ? 'ACCEPTS' : 'REJECTS'} this string.\n` +
        `• Automaton B (${automatonB.name}) ${vAccept ? 'ACCEPTS' : 'REJECTS'} this string.` +
        mismatchNote

      return {
        equivalent: false,
        alphabet: alphabetUnion,
        statesChecked: visited.size,
        counterexample,
        acceptedBy,
        traceA,
        traceB,
        explanation,
      }
    }

    // Expand transitions in both machines for each symbol in the alphabet
    for (const sym of alphabetUnion) {
      const nextU = completeA.delta[u]?.[sym]?.[0]
      const nextV = completeB.delta[v]?.[sym]?.[0]

      if (nextU !== undefined && nextV !== undefined) {
        const key = `${nextU}\u0000${nextV}`
        if (!visited.has(key)) {
          visited.add(key)
          queue.push([nextU, nextV, path + sym])
        }
      }
    }
  }

  // BFS exhausted all reachable product states without discrepancy
  if (hasAlphabetMismatch) {
    return {
      equivalent: false,
      alphabet: alphabetUnion,
      statesChecked: visited.size,
      explanation: `The automata recognize no distinguishing strings within their combined reach, but have different declared alphabets: Σ_A = {${dfaA.alphabet.join(
        ', ',
      )}} vs Σ_B = {${dfaB.alphabet.join(', ')}}.`,
    }
  }

  return {
    equivalent: true,
    alphabet: alphabetUnion,
    statesChecked: visited.size,
    explanation:
      `The automata are mathematically EQUIVALENT (L(A) = L(B)). ` +
      `The product automaton exploration verified that across all ${visited.size} reachable joint state pairs, ` +
      `both machines agree on acceptance for every possible input string.`,
  }
}

/**
 * Convenience helper returning a boolean equivalence verdict.
 */
export function areAutomataEquivalent(a: Automaton, b: Automaton): boolean {
  return compareAutomata(a, b).equivalent
}
