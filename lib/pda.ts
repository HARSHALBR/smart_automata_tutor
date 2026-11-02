/**
 * Comprehensive Pushdown Automata (PDA) Engine:
 * - Formal 7-tuple representation: M = (Q, Σ, Γ, δ, q0, Z0, F)
 * - Support for acceptance by final state, empty stack, or both
 * - Nondeterministic branching with principled cycle detection and loop limits
 * - Detailed configuration trace: (state, remaining input, stack)
 * - Text grammar/transition parser and formal LaTeX formatter
 * - Full backward compatibility with existing curriculum PDA lab
 */

export const BOTTOM = '$'

// --- Backward-Compatible Types ---
export interface PdaTransition {
  state: string
  /** symbol to read, or '' for an ε-move */
  read: string
  /** required stack top, or '' to ignore the top */
  pop: string
  /** symbols to push, top-of-stack first; [] pushes nothing */
  push: string[]
  to: string
}

export interface Pda {
  id: string
  name: string
  description: string
  start: string
  accept: string[]
  alphabet: string[]
  transitions: PdaTransition[]
  examples: string[]
}

export interface PdaStep {
  state: string
  consumed: number
  stack: string[]
  note: string
}

export interface PdaRun {
  steps: PdaStep[]
  accepted: boolean
}

// --- Formal 7-Tuple Architecture ---
export interface PdaRule {
  from: string
  /** Input symbol to read, or 'ε' / '' to consume no input */
  input: string
  /** Stack top symbol to pop, or 'ε' / '' to ignore / pop nothing */
  pop: string
  to: string
  /** String/symbols to push onto stack; push[0] becomes the new top of stack. [] means push nothing (pop). */
  push: string[]
  description?: string
}

export interface FormalPda {
  id?: string
  name?: string
  description?: string
  states: string[]
  alphabet: string[]
  stackAlphabet: string[]
  startState: string
  startStackSymbol: string
  acceptStates: string[]
  acceptanceMode: 'final_state' | 'empty_stack' | 'both'
  rules: PdaRule[]
  examples?: string[]
}

export interface PdaConfig {
  state: string
  remainingInput: string
  consumedCount: number
  /** Stack contents: index 0 is top of stack */
  stack: string[]
  stepIndex: number
  appliedRule?: PdaRule
  actionNote: string
}

export interface PdaSimulationResult {
  input: string
  accepted: boolean
  acceptanceReason: string
  path: PdaConfig[]
  totalConfigurationsExplored: number
  truncatedDueToLimit: boolean
}

export interface PdaValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validates a formal Pushdown Automaton M = (Q, Σ, Γ, δ, q0, Z0, F).
 */
export function validatePda(m: FormalPda): PdaValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!m.states || m.states.length === 0) {
    errors.push('State set Q cannot be empty.')
  }

  const stateSet = new Set(m.states)
  if (!m.startState || !stateSet.has(m.startState)) {
    errors.push(`Start state "${m.startState}" must belong to Q.`)
  }

  const stackSet = new Set(m.stackAlphabet)
  if (!m.startStackSymbol || !stackSet.has(m.startStackSymbol)) {
    errors.push(`Initial stack symbol "${m.startStackSymbol}" must belong to Γ.`)
  }

  for (const acc of m.acceptStates || []) {
    if (!stateSet.has(acc)) {
      errors.push(`Accept state "${acc}" must belong to Q.`)
    }
  }

  const alphaSet = new Set(m.alphabet)

  for (let i = 0; i < (m.rules || []).length; i++) {
    const r = m.rules[i]
    if (!stateSet.has(r.from)) {
      errors.push(`Rule #${i + 1} from-state "${r.from}" is not in Q.`)
    }
    if (!stateSet.has(r.to)) {
      errors.push(`Rule #${i + 1} to-state "${r.to}" is not in Q.`)
    }
    if (r.input !== '' && r.input !== 'ε' && !alphaSet.has(r.input)) {
      errors.push(`Rule #${i + 1} reads input symbol "${r.input}" which is not in declared Σ.`)
    }
    if (r.pop !== '' && r.pop !== 'ε' && !stackSet.has(r.pop)) {
      errors.push(`Rule #${i + 1} pops stack symbol "${r.pop}" which is not in declared Γ.`)
    }
    for (const p of r.push) {
      if (p !== '' && p !== 'ε' && !stackSet.has(p)) {
        errors.push(`Rule #${i + 1} pushes stack symbol "${p}" which is not in declared Γ.`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Parses textual PDA rules into a FormalPda structure.
 * Supports lines like:
 * q0, 0, Z0 -> q1, 0Z0
 * q1, 1, 0 -> q2, ε
 */
export function parsePdaFromText(
  text: string,
  startState: string = 'q0',
  startStackSymbol: string = 'Z0',
  acceptStates: string[] = ['qacc'],
): { pda?: FormalPda; error?: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'))

  if (lines.length === 0) {
    return { error: 'PDA rule input is empty. Please enter transitions.' }
  }

  const rules: PdaRule[] = []
  const statesSet = new Set<string>([startState, ...acceptStates])
  const alphaSet = new Set<string>()
  const stackSet = new Set<string>([startStackSymbol])

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Format: fromState, input, pop -> toState, push
    const match = line.match(/^([A-Za-z0-9_']+)\s*,\s*([^,]*)\s*,\s*([^->]+)\s*(?:->|→)\s*([A-Za-z0-9_']+)\s*(?:,\s*(.*))?$/)
    if (!match) {
      return { error: `Malformed rule on line ${i + 1}: "${line}". Expected: state, input, pop -> nextState, push` }
    }

    const from = match[1].trim()
    let input = match[2].trim()
    let pop = match[3].trim()
    const to = match[4].trim()
    let pushStr = (match[5] || '').trim()

    if (input === 'ε' || input === 'epsilon' || input === "''" || input === '""') input = 'ε'
    if (pop === 'ε' || pop === 'epsilon' || pop === "''" || pop === '""') pop = 'ε'
    if (pushStr === 'ε' || pushStr === 'epsilon' || pushStr === "''" || pushStr === '""') pushStr = ''

    statesSet.add(from)
    statesSet.add(to)
    if (input !== 'ε' && input !== '') alphaSet.add(input)
    if (pop !== 'ε' && pop !== '') stackSet.add(pop)

    // Tokenize push string (e.g. "0Z0" -> ["0", "Z0"] or single chars)
    let pushArr: string[] = []
    if (pushStr.includes(' ')) {
      pushArr = pushStr.split(/\s+/).filter(Boolean)
    } else {
      // Deconstruct into stack alphabet tokens if possible, else individual characters
      let idx = 0
      while (idx < pushStr.length) {
        let matched = false
        for (const sym of stackSet) {
          if (pushStr.startsWith(sym, idx)) {
            pushArr.push(sym)
            idx += sym.length
            matched = true
            break
          }
        }
        if (!matched) {
          pushArr.push(pushStr[idx])
          idx++
        }
      }
    }

    for (const p of pushArr) {
      if (p !== 'ε' && p !== '') stackSet.add(p)
    }

    rules.push({ from, input, pop, to, push: pushArr })
  }

  const pda: FormalPda = {
    states: Array.from(statesSet),
    alphabet: Array.from(alphaSet).sort(),
    stackAlphabet: Array.from(stackSet).sort(),
    startState,
    startStackSymbol,
    acceptStates,
    acceptanceMode: 'final_state',
    rules,
  }

  const val = validatePda(pda)
  if (!val.valid) {
    return { error: val.errors.join(' ') }
  }

  return { pda }
}

/**
 * Formats FormalPda into standard transition table / text string.
 */
export function formatPdaToText(m: FormalPda): string {
  return m.rules
    .map((r) => {
      const inp = r.input === '' ? 'ε' : r.input
      const pop = r.pop === '' ? 'ε' : r.pop
      const push = r.push.length === 0 ? 'ε' : r.push.join('')
      return `${r.from}, ${inp}, ${pop} → ${r.to}, ${push}`
    })
    .join('\n')
}

/**
 * Formats formal 7-tuple M = (Q, Σ, Γ, δ, q0, Z0, F) in LaTeX / Markdown.
 */
export function formatPdaFormalTuple(m: FormalPda): string {
  const qList = `{ ${m.states.join(', ')} }`
  const sigmaList = `{ ${m.alphabet.length > 0 ? m.alphabet.join(', ') : '∅'} }`
  const gammaList = `{ ${m.stackAlphabet.join(', ')} }`
  const fList = `{ ${m.acceptStates.length > 0 ? m.acceptStates.join(', ') : '∅'} }`
  const rulesText = formatPdaToText(m)

  return `### Formal Pushdown Automaton Definition

$$M = (Q, \\Sigma, \\Gamma, \\delta, q_0, Z_0, F)$$

- **States ($Q$):** $${qList}$
- **Input Alphabet ($\\Sigma$):** $${sigmaList}$
- **Stack Alphabet ($\\Gamma$):** $${gammaList}$
- **Initial State ($q_0$):** $${m.startState}$
- **Initial Stack Symbol ($Z_0$):** $${m.startStackSymbol}$
- **Accepting States ($F$):** $${fList}$
- **Acceptance Criterion:** ${
    m.acceptanceMode === 'empty_stack'
      ? 'Acceptance by Empty Stack ($N(M)$)'
      : m.acceptanceMode === 'both'
      ? 'Acceptance by Final State or Empty Stack'
      : 'Acceptance by Final State ($L(M)$)'
  }

\`\`\`pda
${rulesText}
\`\`\`
`
}

/**
 * Simulates a Pushdown Automaton nondeterministically using Breadth-First Search.
 * - Tracks visited configurations to prevent infinite ε-transition cycles.
 * - Enforces step and configuration limits.
 * - Reconstructs the exact winning sequence of configurations if accepted.
 */
export function simulatePda(
  m: FormalPda,
  input: string,
  maxSteps: number = 800,
): PdaSimulationResult {
  const initialConfig: PdaConfig = {
    state: m.startState,
    remainingInput: input,
    consumedCount: 0,
    stack: [m.startStackSymbol],
    stepIndex: 0,
    actionNote: `Initial configuration: state=${m.startState}, stack=[${m.startStackSymbol}]`,
  }

  // Acceptance helper
  function isAccepting(config: PdaConfig): boolean {
    const inputEmpty = config.remainingInput.length === 0
    if (!inputEmpty) return false

    if (m.acceptanceMode === 'empty_stack') {
      return config.stack.length === 0
    }
    if (m.acceptanceMode === 'both') {
      return m.acceptStates.includes(config.state) || config.stack.length === 0
    }
    return m.acceptStates.includes(config.state)
  }

  // If initial configuration is immediately accepting
  if (isAccepting(initialConfig)) {
    return {
      input,
      accepted: true,
      acceptanceReason:
        m.acceptanceMode === 'empty_stack'
          ? 'Accepted on initial configuration by empty stack.'
          : `Accepted on initial configuration in final state "${initialConfig.state}".`,
      path: [initialConfig],
      totalConfigurationsExplored: 1,
      truncatedDueToLimit: false,
    }
  }

  // Node in BFS exploration tree
  interface SearchNode {
    config: PdaConfig
    parent?: SearchNode
  }

  const queue: SearchNode[] = [{ config: initialConfig }]
  const visited = new Set<string>()
  const startKey = `${initialConfig.state}|${initialConfig.consumedCount}|${initialConfig.stack.join(',')}`
  visited.add(startKey)

  let exploredCount = 0
  let truncated = false
  let winningNode: SearchNode | null = null
  let longestPathNode: SearchNode = queue[0]

  while (queue.length > 0) {
    exploredCount++
    if (exploredCount > maxSteps) {
      truncated = true
      break
    }

    const current = queue.shift()!
    const cfg = current.config

    if (cfg.stepIndex > longestPathNode.config.stepIndex) {
      longestPathNode = current
    }

    // Check if current is accepting
    if (isAccepting(cfg)) {
      winningNode = current
      break
    }

    const topOfStack = cfg.stack[0] || ''
    const nextChar = cfg.remainingInput[0] || ''

    // Find all applicable transitions
    for (const r of m.rules) {
      if (r.from !== cfg.state) continue

      // Check input match
      const inputMatches =
        r.input === '' || r.input === 'ε' || (cfg.remainingInput.length > 0 && r.input === nextChar)
      if (!inputMatches) continue

      // Check stack pop match
      const popMatches =
        r.pop === '' || r.pop === 'ε' || (cfg.stack.length > 0 && r.pop === topOfStack)
      if (!popMatches) continue

      // Execute transition
      const nextRemaining =
        r.input === '' || r.input === 'ε' ? cfg.remainingInput : cfg.remainingInput.slice(1)
      const nextConsumed =
        r.input === '' || r.input === 'ε' ? cfg.consumedCount : cfg.consumedCount + 1

      // Modify stack: pop
      let nextStack = r.pop === '' || r.pop === 'ε' ? [...cfg.stack] : cfg.stack.slice(1)
      // Modify stack: push (push[0] becomes new top of stack)
      if (r.push.length > 0 && !(r.push.length === 1 && (r.push[0] === 'ε' || r.push[0] === ''))) {
        nextStack = [...r.push, ...nextStack]
      }

      const actionDetails: string[] = []
      if (r.input !== '' && r.input !== 'ε') actionDetails.push(`read '${r.input}'`)
      else actionDetails.push('ε-move')

      if (r.pop !== '' && r.pop !== 'ε') actionDetails.push(`pop ${r.pop}`)
      else actionDetails.push('pop ε')

      if (r.push.length > 0 && !(r.push.length === 1 && (r.push[0] === 'ε' || r.push[0] === ''))) {
        actionDetails.push(`push ${r.push.join('')}`)
      } else {
        actionDetails.push('push ε')
      }

      const actionNote = `${actionDetails.join(', ')} → ${r.to}`

      const nextConfig: PdaConfig = {
        state: r.to,
        remainingInput: nextRemaining,
        consumedCount: nextConsumed,
        stack: nextStack,
        stepIndex: cfg.stepIndex + 1,
        appliedRule: r,
        actionNote,
      }

      const configKey = `${nextConfig.state}|${nextConfig.consumedCount}|${nextConfig.stack.join(',')}`
      if (!visited.has(configKey)) {
        visited.add(configKey)
        const childNode: SearchNode = { config: nextConfig, parent: current }

        // Short-circuit if accepting
        if (isAccepting(nextConfig)) {
          winningNode = childNode
          break
        }

        queue.push(childNode)
      }
    }

    if (winningNode) break
  }

  // Reconstruct path
  if (winningNode) {
    const path: PdaConfig[] = []
    let curr: SearchNode | undefined = winningNode
    while (curr) {
      path.unshift(curr.config)
      curr = curr.parent
    }

    const last = path[path.length - 1]
    const reason =
      m.acceptanceMode === 'empty_stack'
        ? `Accepted: input completely consumed and stack emptied in state "${last.state}".`
        : `Accepted: input completely consumed and halted in final state "${last.state}".`

    return {
      input,
      accepted: true,
      acceptanceReason: reason,
      path,
      totalConfigurationsExplored: exploredCount,
      truncatedDueToLimit: truncated,
    }
  }

  // Reconstruct longest representative rejection path
  const rejectPath: PdaConfig[] = []
  let curr: SearchNode | undefined = longestPathNode
  while (curr) {
    rejectPath.unshift(curr.config)
    curr = curr.parent
  }

  const last = rejectPath[rejectPath.length - 1]
  const rejectReason = truncated
    ? `Exploration limit reached (${maxSteps} configurations). Halting to prevent infinite ε-cycles. String rejected.`
    : last.remainingInput.length > 0
    ? `Rejected: No valid transition exists from state "${last.state}" to consume remaining input "${last.remainingInput}".`
    : `Rejected: Input consumed, but halted in non-accepting configuration (state "${last.state}", stack [${last.stack.join(', ')}]).`

  return {
    input,
    accepted: false,
    acceptanceReason: rejectReason,
    path: rejectPath,
    totalConfigurationsExplored: exploredCount,
    truncatedDueToLimit: truncated,
  }
}

// --- Backward-Compatible Simulator Implementation ---
export function runPda(pda: Pda, input: string): PdaRun {
  const steps: PdaStep[] = []
  let state = pda.start
  let pos = 0
  let stack: string[] = []
  steps.push({ state, consumed: 0, stack: [], note: 'Initial configuration.' })

  const LIMIT = 400
  for (let guard = 0; guard < LIMIT; guard++) {
    const top = stack[stack.length - 1] ?? ''
    const symbol = input[pos]

    const candidate =
      pda.transitions.find(
        (t) =>
          t.state === state &&
          t.read !== '' &&
          t.read === symbol &&
          (t.pop === '' || t.pop === top),
      ) ??
      pda.transitions.find(
        (t) =>
          t.state === state &&
          t.read === '' &&
          (t.pop === '' || t.pop === top),
      )

    if (!candidate) break

    if (candidate.pop !== '') stack = stack.slice(0, -1)
    if (candidate.push.length) stack = [...stack, ...[...candidate.push].reverse()]
    if (candidate.read !== '') pos += 1
    state = candidate.to

    const action: string[] = []
    if (candidate.read !== '') action.push(`read '${candidate.read}'`)
    else action.push('ε-move')
    if (candidate.pop !== '') action.push(`pop ${candidate.pop}`)
    if (candidate.push.length) action.push(`push ${candidate.push.join('')}`)

    steps.push({
      state,
      consumed: pos,
      stack: [...stack],
      note: `${action.join(', ')} → ${state}`,
    })
  }

  const accepted = pos === input.length && pda.accept.includes(state)
  return { steps, accepted }
}

// --- Curated Preset PDAs ---
export const PDAS: Pda[] = [
  {
    id: 'anbn',
    name: '0ⁿ1ⁿ (n ≥ 0)',
    description:
      'Push a marker for each 0, pop one for each 1. If the stack empties exactly as the input ends, the counts matched.',
    start: 'q0',
    accept: ['qacc'],
    alphabet: ['0', '1'],
    transitions: [
      { state: 'q0', read: '', pop: '', push: [BOTTOM], to: 'q1' },
      { state: 'q1', read: '0', pop: '', push: ['0'], to: 'q1' },
      { state: 'q1', read: '1', pop: '0', push: [], to: 'q2' },
      { state: 'q2', read: '1', pop: '0', push: [], to: 'q2' },
      { state: 'q2', read: '', pop: BOTTOM, push: [], to: 'qacc' },
      { state: 'q1', read: '', pop: BOTTOM, push: [], to: 'qacc' },
    ],
    examples: ['0011', '000111', '01', ''],
  },
  {
    id: 'balanced',
    name: 'Balanced ( )',
    description:
      'Push on every "(" and pop on every ")". Accept when the stack returns to empty at end of input.',
    start: 'q0',
    accept: ['qacc'],
    alphabet: ['(', ')'],
    transitions: [
      { state: 'q0', read: '', pop: '', push: [BOTTOM], to: 'q1' },
      { state: 'q1', read: '(', pop: '', push: ['('], to: 'q1' },
      { state: 'q1', read: ')', pop: '(', push: [], to: 'q1' },
      { state: 'q1', read: '', pop: BOTTOM, push: [], to: 'qacc' },
    ],
    examples: ['(())', '()()', '(()())', '(()'],
  },
]
