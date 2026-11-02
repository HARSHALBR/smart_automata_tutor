/**
 * Comprehensive Turing Machine Engine:
 * - Formal 7-tuple representation: M = (Q, Σ, Γ, δ, q0, B, F)
 * - Support for input alphabet, tape alphabet, blank symbol, accept and reject states
 * - Two-way infinite tape with dynamic left/right expansion
 * - Deterministic single-tape simulation with step-by-step instantaneous descriptions (ID)
 * - Safe step-bounded execution with explicit INCONCLUSIVE halting on limits
 * - Strict formal validation and rule parsing/formatting
 * - Preserves backward compatibility for existing lab components
 */

export const BLANK = '_'

export type Move = 'L' | 'R'
export type Direction = 'L' | 'R' | 'S'

/* ---------------- Backward-compatible types for turing-lab.tsx ---------------- */

export interface TMTransition {
  write: string
  move: Move
  next: string
}

export interface TuringMachine {
  id: string
  name: string
  description: string
  task: string
  inputAlphabet: string[]
  accept: string
  reject: string
  start: string
  /** delta[state][symbol] -> transition; missing entries reject */
  delta: Record<string, Record<string, TMTransition>>
  samples: string[]
}

export interface TMConfig {
  tape: string[]
  head: number
  state: string
  halted: 'accept' | 'reject' | null
  steps: number
}

export function initConfig(tm: TuringMachine, input: string): TMConfig {
  const tape = input.length ? [...input] : [BLANK]
  return { tape, head: 0, state: tm.start, halted: null, steps: 0 }
}

/** Advances the machine by one step, returning a new immutable config. */
export function stepTM(tm: TuringMachine, c: TMConfig): TMConfig {
  if (c.halted) return c
  const tape = [...c.tape]
  if (c.head < 0) {
    tape.unshift(BLANK)
  }
  let head = c.head < 0 ? 0 : c.head
  if (head >= tape.length) tape.push(BLANK)

  const symbol = tape[head] ?? BLANK
  const rule = tm.delta[c.state]?.[symbol]

  if (!rule) {
    return { ...c, tape, head, halted: 'reject' }
  }

  tape[head] = rule.write
  head = rule.move === 'R' ? head + 1 : head - 1
  if (head < 0) {
    tape.unshift(BLANK)
    head = 0
  }
  if (head >= tape.length) tape.push(BLANK)

  const halted =
    rule.next === tm.accept
      ? 'accept'
      : rule.next === tm.reject
        ? 'reject'
        : null

  return {
    tape,
    head,
    state: rule.next,
    halted,
    steps: c.steps + 1,
  }
}

/* ---------------- Formal 7-Tuple Turing Machine Specification ---------------- */

export interface FormalTMTransition {
  fromState: string
  readSymbol: string
  toState: string
  writeSymbol: string
  move: Direction
  description?: string
}

export interface FormalTuringMachine {
  id: string
  name: string
  description: string
  states: string[]
  inputAlphabet: string[]
  tapeAlphabet: string[]
  transitions: FormalTMTransition[]
  startState: string
  blankSymbol: string
  acceptStates: string[]
  rejectStates: string[]
  examples?: string[]
}

export interface TMValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface TMSimulationStep {
  stepIndex: number
  state: string
  tape: string[]
  head: number
  tapeOffset: number // Tracks negative left shifts
  readSymbol: string
  transitionApplied?: FormalTMTransition
  instantaneousDescription: string
  isAccepted: boolean
  isRejected: boolean
  isInconclusive: boolean
}

export interface TMSimulationResult {
  accepted: boolean
  rejected: boolean
  inconclusive: boolean
  totalSteps: number
  finalTape: string[]
  finalHead: number
  finalState: string
  history: TMSimulationStep[]
  statusReason: string
}

/**
 * Validates a Formal Turing Machine according to standard mathematical theory:
 * M = (Q, Σ, Γ, δ, q0, B, F)
 */
export function validateTuringMachine(m: FormalTuringMachine): TMValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!m.states || m.states.length === 0) {
    errors.push('State set Q cannot be empty.')
  }
  const stateSet = new Set(m.states || [])

  if (!m.startState || !stateSet.has(m.startState)) {
    errors.push(`Start state "${m.startState}" must belong to state set Q.`)
  }

  const blank = m.blankSymbol || BLANK
  const tapeSet = new Set(m.tapeAlphabet || [])
  const inputSet = new Set(m.inputAlphabet || [])

  if (!tapeSet.has(blank)) {
    errors.push(`Blank symbol "${blank}" must belong to tape alphabet Γ.`)
  }

  if (inputSet.has(blank)) {
    errors.push(`Blank symbol "${blank}" cannot belong to input alphabet Σ.`)
  }

  for (const sym of inputSet) {
    if (!tapeSet.has(sym)) {
      errors.push(`Input symbol "${sym}" must belong to tape alphabet Γ (Σ ⊆ Γ).`)
    }
  }

  const acceptSet = new Set(m.acceptStates || [])
  const rejectSet = new Set(m.rejectStates || [])

  if (acceptSet.size === 0) {
    errors.push('At least one accept state must be specified in F.')
  }

  for (const acc of acceptSet) {
    if (!stateSet.has(acc)) {
      errors.push(`Accept state "${acc}" must belong to state set Q.`)
    }
    if (rejectSet.has(acc)) {
      errors.push(`State "${acc}" cannot be both an accept state and a reject state.`)
    }
  }

  for (const rej of rejectSet) {
    if (!stateSet.has(rej)) {
      errors.push(`Reject state "${rej}" must belong to state set Q.`)
    }
  }

  // Validate transitions δ: Q × Γ → Q × Γ × {L, R, S}
  const seenRuleKeys = new Map<string, number>()

  for (let i = 0; i < (m.transitions || []).length; i++) {
    const t = m.transitions[i]
    const ruleNum = i + 1

    if (!stateSet.has(t.fromState)) {
      errors.push(`Rule #${ruleNum}: from-state "${t.fromState}" is not in Q.`)
    }
    if (!stateSet.has(t.toState)) {
      errors.push(`Rule #${ruleNum}: to-state "${t.toState}" is not in Q.`)
    }
    if (!tapeSet.has(t.readSymbol)) {
      errors.push(`Rule #${ruleNum}: read symbol "${t.readSymbol}" is not in tape alphabet Γ.`)
    }
    if (!tapeSet.has(t.writeSymbol)) {
      errors.push(`Rule #${ruleNum}: write symbol "${t.writeSymbol}" is not in tape alphabet Γ.`)
    }
    if (t.move !== 'L' && t.move !== 'R' && t.move !== 'S') {
      errors.push(`Rule #${ruleNum}: direction "${t.move}" must be 'L', 'R', or 'S'.`)
    }

    // Check for deterministic conflict
    const key = `${t.fromState}:::${t.readSymbol}`
    if (seenRuleKeys.has(key)) {
      warnings.push(
        `Deterministic warning: rule #${ruleNum} has duplicate condition for state "${t.fromState}" and symbol "${t.readSymbol}" (first seen at rule #${seenRuleKeys.get(key)}).`,
      )
    } else {
      seenRuleKeys.set(key, ruleNum)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Formats instantaneous description (ID): u [q] v
 * where u is tape left of head, q is current state, and v is tape from head onwards.
 */
export function formatInstantaneousDescription(
  tape: string[],
  head: number,
  state: string,
  blankSymbol: string = BLANK,
): string {
  const left = tape.slice(0, head).join('') || blankSymbol
  const current = tape[head] ?? blankSymbol
  const right = tape.slice(head + 1).join('')
  return `${left}[${state}]${current}${right}`
}

/**
 * Parses textual Turing Machine transition rules into a FormalTuringMachine structure.
 * Supports lines like:
 * q0, 0 -> q1, x, R
 * q1, y -> q1, y, R
 * q2, _ -> qacc, _, S
 */
export function parseTMFromText(
  text: string,
  startState = 'q0',
  blankSymbol = BLANK,
  acceptStates = ['qacc'],
  rejectStates = ['qreject'],
): { tm?: FormalTuringMachine; error?: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'))

  if (lines.length === 0) {
    return { error: 'Turing machine transition specification is empty. Please enter transition rules.' }
  }

  const transitions: FormalTMTransition[] = []
  const statesSet = new Set<string>([startState, ...acceptStates, ...rejectStates])
  const inputSet = new Set<string>()
  const tapeSet = new Set<string>([blankSymbol])

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Format: fromState, readSymbol -> toState, writeSymbol, move
    const match = line.match(
      /^([A-Za-z0-9_']+)\s*,\s*([^,]+)\s*(?:->|→)\s*([A-Za-z0-9_']+)\s*,\s*([^,]+)\s*,\s*([LRS])\s*(?:;\s*(.*))?$/i,
    )
    if (!match) {
      return {
        error: `Malformed transition on line ${i + 1}: "${line}". Expected format: state, readSymbol -> nextState, writeSymbol, L|R|S`,
      }
    }

    const fromState = match[1].trim()
    let readSymbol = match[2].trim()
    const toState = match[3].trim()
    let writeSymbol = match[4].trim()
    const move = match[5].trim().toUpperCase() as Direction
    const description = match[6]?.trim()

    if (readSymbol === 'BLANK' || readSymbol === 'blank' || readSymbol === '␣') readSymbol = blankSymbol
    if (writeSymbol === 'BLANK' || writeSymbol === 'blank' || writeSymbol === '␣') writeSymbol = blankSymbol

    statesSet.add(fromState)
    statesSet.add(toState)
    tapeSet.add(readSymbol)
    tapeSet.add(writeSymbol)

    if (readSymbol !== blankSymbol) inputSet.add(readSymbol)

    transitions.push({
      fromState,
      readSymbol,
      toState,
      writeSymbol,
      move,
      description,
    })
  }

  const tm: FormalTuringMachine = {
    id: 'custom_tm',
    name: 'Custom Turing Machine',
    description: 'User-specified Turing machine',
    states: Array.from(statesSet),
    inputAlphabet: Array.from(inputSet),
    tapeAlphabet: Array.from(tapeSet),
    transitions,
    startState,
    blankSymbol,
    acceptStates,
    rejectStates,
  }

  const validation = validateTuringMachine(tm)
  if (!validation.valid) {
    return { error: validation.errors.join(' ') }
  }

  return { tm }
}

/**
 * Formats a FormalTuringMachine back into standard transition text.
 */
export function formatTMToText(m: FormalTuringMachine): string {
  return m.transitions
    .map((t) => {
      const desc = t.description ? ` ; ${t.description}` : ''
      return `${t.fromState}, ${t.readSymbol} → ${t.toState}, ${t.writeSymbol}, ${t.move}${desc}`
    })
    .join('\n')
}

/**
 * Formats the formal 7-tuple definition M = (Q, Σ, Γ, δ, q0, B, F) in LaTeX/Markdown.
 */
export function formatTMFormalTuple(m: FormalTuringMachine): string {
  const qList = `{ ${m.states.join(', ')} }`
  const sigmaList = `{ ${m.inputAlphabet.length > 0 ? m.inputAlphabet.join(', ') : '∅'} }`
  const gammaList = `{ ${m.tapeAlphabet.join(', ')} }`
  const fList = `{ ${m.acceptStates.join(', ')} }`
  const rejList = m.rejectStates.length > 0 ? `{ ${m.rejectStates.join(', ')} }` : '∅'

  return `### Formal Turing Machine Definition

$$M = (Q, \\Sigma, \\Gamma, \\delta, q_0, B, F)$$

- **State Set ($Q$):** $${qList}$
- **Input Alphabet ($\\Sigma$):** $${sigmaList}$
- **Tape Alphabet ($\\Gamma$):** $${gammaList}$
- **Initial State ($q_0$):** $${m.startState}$
- **Blank Symbol ($B$):** \`${m.blankSymbol}\`
- **Accept States ($F$):** $${fList}$
- **Reject States ($Q_{\\text{rej}}$):** $${rejList}$`
}

/**
 * Simulates a Formal Turing Machine step-by-step on an input string.
 * Supports configurable step limit.
 * If step limit is reached without halting, returns INCONCLUSIVE (never falsely rejected!).
 */
export function simulateTuringMachine(
  tm: FormalTuringMachine,
  input: string,
  maxSteps = 1000,
): TMSimulationResult {
  const blank = tm.blankSymbol || BLANK
  let tape = input.length > 0 && input !== 'ε' ? input.split('') : [blank]
  let head = 0
  let tapeOffset = 0
  let currentState = tm.startState
  const history: TMSimulationStep[] = []

  const acceptSet = new Set(tm.acceptStates || [])
  const rejectSet = new Set(tm.rejectStates || [])

  // Transition map: key = `${state}:::${symbol}`
  const deltaMap = new Map<string, FormalTMTransition>()
  for (const t of tm.transitions) {
    deltaMap.set(`${t.fromState}:::${t.readSymbol}`, t)
  }

  let stepCount = 0

  while (true) {
    // Check acceptance / rejection prior to step execution
    const isAccepted = acceptSet.has(currentState)
    const isRejected = rejectSet.has(currentState)
    const readSym = tape[head] ?? blank

    const id = formatInstantaneousDescription(tape, head, currentState, blank)

    if (isAccepted) {
      history.push({
        stepIndex: stepCount,
        state: currentState,
        tape: [...tape],
        head,
        tapeOffset,
        readSymbol: readSym,
        instantaneousDescription: id,
        isAccepted: true,
        isRejected: false,
        isInconclusive: false,
      })
      return {
        accepted: true,
        rejected: false,
        inconclusive: false,
        totalSteps: stepCount,
        finalTape: tape,
        finalHead: head,
        finalState: currentState,
        history,
        statusReason: `Accepted in state "${currentState}" after ${stepCount} step${stepCount === 1 ? '' : 's'}.`,
      }
    }

    if (isRejected) {
      history.push({
        stepIndex: stepCount,
        state: currentState,
        tape: [...tape],
        head,
        tapeOffset,
        readSymbol: readSym,
        instantaneousDescription: id,
        isAccepted: false,
        isRejected: true,
        isInconclusive: false,
      })
      return {
        accepted: false,
        rejected: true,
        inconclusive: false,
        totalSteps: stepCount,
        finalTape: tape,
        finalHead: head,
        finalState: currentState,
        history,
        statusReason: `Explicitly rejected in state "${currentState}" after ${stepCount} step${stepCount === 1 ? '' : 's'}.`,
      }
    }

    // Step limit check -> Inconclusive
    if (stepCount >= maxSteps) {
      history.push({
        stepIndex: stepCount,
        state: currentState,
        tape: [...tape],
        head,
        tapeOffset,
        readSymbol: readSym,
        instantaneousDescription: id,
        isAccepted: false,
        isRejected: false,
        isInconclusive: true,
      })
      return {
        accepted: false,
        rejected: false,
        inconclusive: true,
        totalSteps: stepCount,
        finalTape: tape,
        finalHead: head,
        finalState: currentState,
        history,
        statusReason: `Execution limit of ${maxSteps} steps reached without halting. The computation is inconclusive.`,
      }
    }

    // Lookup transition
    const ruleKey = `${currentState}:::${readSym}`
    const transition = deltaMap.get(ruleKey)

    if (!transition) {
      // No applicable transition: halts and rejects implicitly by standard TM definition
      history.push({
        stepIndex: stepCount,
        state: currentState,
        tape: [...tape],
        head,
        tapeOffset,
        readSymbol: readSym,
        instantaneousDescription: id,
        isAccepted: false,
        isRejected: true,
        isInconclusive: false,
      })
      return {
        accepted: false,
        rejected: true,
        inconclusive: false,
        totalSteps: stepCount,
        finalTape: tape,
        finalHead: head,
        finalState: currentState,
        history,
        statusReason: `Halted and rejected: no transition defined for state "${currentState}" reading symbol "${readSym}".`,
      }
    }

    // Record step in history
    history.push({
      stepIndex: stepCount,
      state: currentState,
      tape: [...tape],
      head,
      tapeOffset,
      readSymbol: readSym,
      transitionApplied: transition,
      instantaneousDescription: id,
      isAccepted: false,
      isRejected: false,
      isInconclusive: false,
    })

    // Execute transition: write
    tape[head] = transition.writeSymbol
    currentState = transition.toState

    // Move head
    if (transition.move === 'L') {
      head--
      if (head < 0) {
        tape.unshift(blank)
        head = 0
        tapeOffset--
      }
    } else if (transition.move === 'R') {
      head++
      if (head >= tape.length) {
        tape.push(blank)
      }
    }
    // 'S' leaves head unchanged

    stepCount++
  }
}

/* ------------------------------- examples -------------------------------- */

const TM_ANBN: TuringMachine = {
  id: 'anbn',
  name: '{ 0ⁿ1ⁿ }',
  description:
    'Decides the classic non-regular language of equal numbers of 0s followed by 1s. It crosses off one 0 (→x) and one matching 1 (→y) on each pass.',
  task: 'Accept exactly the strings 0ⁿ1ⁿ for n ≥ 0',
  inputAlphabet: ['0', '1'],
  accept: 'qACC',
  reject: 'qREJ',
  start: 'q0',
  delta: {
    q0: {
      '0': { write: 'x', move: 'R', next: 'q1' },
      y: { write: 'y', move: 'R', next: 'q3' },
      [BLANK]: { write: BLANK, move: 'R', next: 'qACC' },
    },
    q1: {
      '0': { write: '0', move: 'R', next: 'q1' },
      y: { write: 'y', move: 'R', next: 'q1' },
      '1': { write: 'y', move: 'L', next: 'q2' },
    },
    q2: {
      '0': { write: '0', move: 'L', next: 'q2' },
      y: { write: 'y', move: 'L', next: 'q2' },
      x: { write: 'x', move: 'R', next: 'q0' },
    },
    q3: {
      y: { write: 'y', move: 'R', next: 'q3' },
      [BLANK]: { write: BLANK, move: 'R', next: 'qACC' },
    },
  },
  samples: ['0011', '000111', '001', '0101'],
}

const TM_INCREMENT: TuringMachine = {
  id: 'increment',
  name: 'Binary +1',
  description:
    'A transducer that adds one to a binary number. It runs to the right end, then ripples a carry leftward, accepting when the new value is written.',
  task: 'Compute n + 1 on a binary input, then halt',
  inputAlphabet: ['0', '1'],
  accept: 'qACC',
  reject: 'qREJ',
  start: 'qR',
  delta: {
    qR: {
      '0': { write: '0', move: 'R', next: 'qR' },
      '1': { write: '1', move: 'R', next: 'qR' },
      [BLANK]: { write: BLANK, move: 'L', next: 'qADD' },
    },
    qADD: {
      '1': { write: '0', move: 'L', next: 'qADD' },
      '0': { write: '1', move: 'L', next: 'qDONE' },
      [BLANK]: { write: '1', move: 'L', next: 'qDONE' },
    },
    qDONE: {
      '0': { write: '0', move: 'L', next: 'qDONE' },
      '1': { write: '1', move: 'L', next: 'qDONE' },
      [BLANK]: { write: BLANK, move: 'R', next: 'qACC' },
    },
  },
  samples: ['1011', '111', '0', '10011'],
}

export const TM_EXAMPLES: TuringMachine[] = [TM_ANBN, TM_INCREMENT]
