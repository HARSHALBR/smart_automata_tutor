/**
 * Multi-Tape Turing Machine Engine:
 * - Separate, dedicated engine for k-tape Turing Machines (k >= 2)
 * - Independent tape heads with read/write and L/R/S movement on each tape
 * - Step-by-step multi-tape simulation with instantaneous configuration snapshots
 * - Built-in canonical multi-tape algorithms demonstrating speedups (e.g. O(n) palindrome check)
 */

import { BLANK, type Direction } from './turing'

export interface MultiTapeTMTransition {
  fromState: string
  readSymbols: string[] // Length k
  toState: string
  writeSymbols: string[] // Length k
  moves: Direction[] // Length k ('L' | 'R' | 'S')
  description?: string
}

export interface MultiTapeTuringMachine {
  id: string
  name: string
  description: string
  numTapes: number
  states: string[]
  inputAlphabet: string[]
  tapeAlphabet: string[]
  transitions: MultiTapeTMTransition[]
  startState: string
  blankSymbol: string
  acceptStates: string[]
  rejectStates: string[]
  examples?: string[]
}

export interface MultiTapeStep {
  stepIndex: number
  state: string
  tapes: string[][]
  heads: number[]
  readSymbols: string[]
  transitionApplied?: MultiTapeTMTransition
  isAccepted: boolean
  isRejected: boolean
  isInconclusive: boolean
}

export interface MultiTapeSimulationResult {
  accepted: boolean
  rejected: boolean
  inconclusive: boolean
  totalSteps: number
  finalTapes: string[][]
  finalHeads: number[]
  finalState: string
  history: MultiTapeStep[]
  statusReason: string
}

export function validateMultiTapeTM(tm: MultiTapeTuringMachine): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (tm.numTapes < 2) {
    errors.push(`Multi-tape TM must have at least 2 tapes (found ${tm.numTapes}).`)
  }
  const stateSet = new Set(tm.states)
  if (!stateSet.has(tm.startState)) {
    errors.push(`Start state "${tm.startState}" is not in state set.`)
  }
  for (let i = 0; i < tm.transitions.length; i++) {
    const t = tm.transitions[i]
    if (t.readSymbols.length !== tm.numTapes) {
      errors.push(`Rule #${i + 1} readSymbols count (${t.readSymbols.length}) does not match numTapes (${tm.numTapes}).`)
    }
    if (t.writeSymbols.length !== tm.numTapes) {
      errors.push(`Rule #${i + 1} writeSymbols count (${t.writeSymbols.length}) does not match numTapes (${tm.numTapes}).`)
    }
    if (t.moves.length !== tm.numTapes) {
      errors.push(`Rule #${i + 1} moves count (${t.moves.length}) does not match numTapes (${tm.numTapes}).`)
    }
  }
  return { valid: errors.length === 0, errors }
}

/**
 * Simulates a multi-tape Turing machine on an input string.
 * Tape 1 receives the input string; tapes 2..k start with [blankSymbol].
 */
export function simulateMultiTapeTM(
  tm: MultiTapeTuringMachine,
  input: string,
  maxSteps = 1000,
): MultiTapeSimulationResult {
  const blank = tm.blankSymbol || BLANK
  const k = tm.numTapes

  // Initialize tapes
  const tapes: string[][] = []
  const heads: number[] = new Array(k).fill(0)

  // Tape 1: input string
  tapes.push(input.length > 0 && input !== 'ε' ? input.split('') : [blank])

  // Tapes 2..k: blank
  for (let t = 1; t < k; t++) {
    tapes.push([blank])
  }

  let currentState = tm.startState
  const acceptSet = new Set(tm.acceptStates)
  const rejectSet = new Set(tm.rejectStates)

  // Map: key = `${state}:::${read1},${read2},...`
  const deltaMap = new Map<string, MultiTapeTMTransition>()
  for (const tr of tm.transitions) {
    deltaMap.set(`${tr.fromState}:::${tr.readSymbols.join(',')}`, tr)
  }

  const history: MultiTapeStep[] = []
  let stepCount = 0

  while (true) {
    // Current read symbols
    const reads: string[] = []
    for (let t = 0; t < k; t++) {
      reads.push(tapes[t][heads[t]] ?? blank)
    }

    const isAccepted = acceptSet.has(currentState)
    const isRejected = rejectSet.has(currentState)

    if (isAccepted) {
      history.push({
        stepIndex: stepCount,
        state: currentState,
        tapes: tapes.map((tp) => [...tp]),
        heads: [...heads],
        readSymbols: reads,
        isAccepted: true,
        isRejected: false,
        isInconclusive: false,
      })
      return {
        accepted: true,
        rejected: false,
        inconclusive: false,
        totalSteps: stepCount,
        finalTapes: tapes,
        finalHeads: heads,
        finalState: currentState,
        history,
        statusReason: `Multi-tape TM accepted in state "${currentState}" after ${stepCount} steps.`,
      }
    }

    if (isRejected) {
      history.push({
        stepIndex: stepCount,
        state: currentState,
        tapes: tapes.map((tp) => [...tp]),
        heads: [...heads],
        readSymbols: reads,
        isAccepted: false,
        isRejected: true,
        isInconclusive: false,
      })
      return {
        accepted: false,
        rejected: true,
        inconclusive: false,
        totalSteps: stepCount,
        finalTapes: tapes,
        finalHeads: heads,
        finalState: currentState,
        history,
        statusReason: `Multi-tape TM explicitly rejected in state "${currentState}" after ${stepCount} steps.`,
      }
    }

    if (stepCount >= maxSteps) {
      history.push({
        stepIndex: stepCount,
        state: currentState,
        tapes: tapes.map((tp) => [...tp]),
        heads: [...heads],
        readSymbols: reads,
        isAccepted: false,
        isRejected: false,
        isInconclusive: true,
      })
      return {
        accepted: false,
        rejected: false,
        inconclusive: true,
        totalSteps: stepCount,
        finalTapes: tapes,
        finalHeads: heads,
        finalState: currentState,
        history,
        statusReason: `Execution bound of ${maxSteps} steps reached. Computation is inconclusive.`,
      }
    }

    // Lookup transition
    const key = `${currentState}:::${reads.join(',')}`
    const transition = deltaMap.get(key)

    if (!transition) {
      history.push({
        stepIndex: stepCount,
        state: currentState,
        tapes: tapes.map((tp) => [...tp]),
        heads: [...heads],
        readSymbols: reads,
        isAccepted: false,
        isRejected: true,
        isInconclusive: false,
      })
      return {
        accepted: false,
        rejected: true,
        inconclusive: false,
        totalSteps: stepCount,
        finalTapes: tapes,
        finalHeads: heads,
        finalState: currentState,
        history,
        statusReason: `Halted and rejected: no transition defined for state "${currentState}" with reads (${reads.join(', ')}).`,
      }
    }

    // Record step
    history.push({
      stepIndex: stepCount,
      state: currentState,
      tapes: tapes.map((tp) => [...tp]),
      heads: [...heads],
      readSymbols: reads,
      transitionApplied: transition,
      isAccepted: false,
      isRejected: false,
      isInconclusive: false,
    })

    // Apply writes and moves on all k tapes
    for (let t = 0; t < k; t++) {
      tapes[t][heads[t]] = transition.writeSymbols[t]
      const mv = transition.moves[t]
      if (mv === 'L') {
        heads[t]--
        if (heads[t] < 0) {
          tapes[t].unshift(blank)
          heads[t] = 0
        }
      } else if (mv === 'R') {
        heads[t]++
        if (heads[t] >= tapes[t].length) {
          tapes[t].push(blank)
        }
      }
    }

    currentState = transition.toState
    stepCount++
  }
}

/**
 * Canonical 2-Tape Palindrome Decider:
 * Achieves O(n) linear-time palindrome verification:
 * - Tape 1: Input w
 * - Tape 2: Used as copy destination
 * - Phase 1: Copy Tape 1 to Tape 2 while moving both heads right.
 * - Phase 2: Rewind Tape 2 head to start while keeping Tape 1 at the end.
 * - Phase 3: Simultaneously move Tape 1 left and Tape 2 right, checking that symbols match.
 */
export function get2TapePalindromeTM(): MultiTapeTuringMachine {
  return {
    id: 'multitape_palindrome_2tape',
    name: '2-Tape Palindrome Decider (O(n) Time)',
    description: 'Decides binary palindromes in linear time by copying input to Tape 2, then comparing Tape 1 in reverse against Tape 2 forward.',
    numTapes: 2,
    states: ['q_copy', 'q_rewind', 'q_compare', 'q_acc', 'q_rej'],
    inputAlphabet: ['0', '1'],
    tapeAlphabet: ['0', '1', BLANK],
    startState: 'q_copy',
    blankSymbol: BLANK,
    acceptStates: ['q_acc'],
    rejectStates: ['q_rej'],
    examples: ['0110', '1001', '010', '1', ''],
    transitions: [
      // Phase 1: Copy Tape 1 onto Tape 2
      { fromState: 'q_copy', readSymbols: ['0', BLANK], toState: 'q_copy', writeSymbols: ['0', '0'], moves: ['R', 'R'], description: 'Copy 0 to Tape 2' },
      { fromState: 'q_copy', readSymbols: ['1', BLANK], toState: 'q_copy', writeSymbols: ['1', '1'], moves: ['R', 'R'], description: 'Copy 1 to Tape 2' },
      // When Tape 1 hits BLANK, input is copied. Empty string check:
      { fromState: 'q_copy', readSymbols: [BLANK, BLANK], toState: 'q_rewind', writeSymbols: [BLANK, BLANK], moves: ['L', 'L'], description: 'End of input reached: begin rewind' },

      // Phase 2: Rewind Tape 2 head back to cell 0 while holding Tape 1 at the rightmost character
      { fromState: 'q_rewind', readSymbols: ['0', '0'], toState: 'q_rewind', writeSymbols: ['0', '0'], moves: ['S', 'L'], description: 'Rewinding Tape 2' },
      { fromState: 'q_rewind', readSymbols: ['0', '1'], toState: 'q_rewind', writeSymbols: ['0', '1'], moves: ['S', 'L'], description: 'Rewinding Tape 2' },
      { fromState: 'q_rewind', readSymbols: ['1', '0'], toState: 'q_rewind', writeSymbols: ['1', '0'], moves: ['S', 'L'], description: 'Rewinding Tape 2' },
      { fromState: 'q_rewind', readSymbols: ['1', '1'], toState: 'q_rewind', writeSymbols: ['1', '1'], moves: ['S', 'L'], description: 'Rewinding Tape 2' },
      // When Tape 2 rewinds past the beginning and hits BLANK:
      { fromState: 'q_rewind', readSymbols: ['0', BLANK], toState: 'q_compare', writeSymbols: ['0', BLANK], moves: ['S', 'R'], description: 'Tape 2 rewound to start: begin simultaneous comparison' },
      { fromState: 'q_rewind', readSymbols: ['1', BLANK], toState: 'q_compare', writeSymbols: ['1', BLANK], moves: ['S', 'R'], description: 'Tape 2 rewound to start: begin simultaneous comparison' },
      { fromState: 'q_rewind', readSymbols: [BLANK, BLANK], toState: 'q_acc', writeSymbols: [BLANK, BLANK], moves: ['S', 'S'], description: 'Empty string accepts' },

      // Phase 3: Compare Tape 1 backward (L) with Tape 2 forward (R)
      { fromState: 'q_compare', readSymbols: ['0', '0'], toState: 'q_compare', writeSymbols: ['0', '0'], moves: ['L', 'R'], description: 'Symbols match (0 == 0)' },
      { fromState: 'q_compare', readSymbols: ['1', '1'], toState: 'q_compare', writeSymbols: ['1', '1'], moves: ['L', 'R'], description: 'Symbols match (1 == 1)' },
      // Mismatch
      { fromState: 'q_compare', readSymbols: ['0', '1'], toState: 'q_rej', writeSymbols: ['0', '1'], moves: ['S', 'S'], description: 'Mismatch: 0 != 1' },
      { fromState: 'q_compare', readSymbols: ['1', '0'], toState: 'q_rej', writeSymbols: ['1', '0'], moves: ['S', 'S'], description: 'Mismatch: 1 != 0' },
      // Finished comparison: when both tapes hit BLANK, string is a palindrome!
      { fromState: 'q_compare', readSymbols: [BLANK, BLANK], toState: 'q_acc', writeSymbols: [BLANK, BLANK], moves: ['S', 'S'], description: 'All characters matched: palindrome verified!' },
    ],
  }
}

