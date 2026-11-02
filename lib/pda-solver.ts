/**
 * Pushdown Automata (PDA) Problem Solver & Educational Synthesizer:
 * - Synthesizes canonical PDAs for standard university-level languages
 * - Runs nondeterministic simulation with step-by-step configuration tracing
 * - Generates formal 7-tuple definitions, transition tables, and stack invariant explanations
 * - Supports CFG-to-PDA and PDA-to-CFG bidirectional conversions
 */

import {
  type FormalPda,
  type PdaSimulationResult,
  simulatePda,
  formatPdaToText,
  formatPdaFormalTuple,
} from './pda'
import {
  type CfgToPdaResult,
  type PdaToCfgResult,
  convertCfgToPda,
  convertPdaToCfg,
} from './pda-transformations'
import { type Grammar, parseCfgFromText } from './cfg'

export type PdaProblemType =
  | 'pda_from_language'
  | 'pda_simulation'
  | 'cfg_to_pda'
  | 'pda_to_cfg'

export interface PdaProblemSpec {
  type: PdaProblemType
  languagePattern?:
    | 'an_bn'
    | 'balanced_parentheses'
    | 'palindromes'
    | 'equal_zeros_ones'
    | 'custom'
  alphabet?: string[]
  targetString?: string
  givenPda?: FormalPda
  givenCfg?: Grammar
  acceptanceMode?: 'final_state' | 'empty_stack' | 'both'
}

export interface PdaTestStringResult {
  input: string
  expectedAccept: boolean
  actualAccept: boolean
  stepsCount: number
  acceptanceReason: string
}

export interface PdaSolution {
  interpretedQuestion: string
  formalPda: FormalPda
  formalDefinitionMarkdown: string
  transitionTableMarkdown: string
  stateInvariants: { state: string; role: string; isAccept: boolean }[]
  stepByStepConstruction: string[]
  stackBehaviorExplanation: string
  mathematicalProof: string
  simulationResult?: PdaSimulationResult
  cfgToPdaResult?: CfgToPdaResult
  pdaToCfgResult?: PdaToCfgResult
  testResults: PdaTestStringResult[]
  complexityAnalysis: {
    timeComplexity: string
    spaceComplexity: string
    explanation: string
  }
  finalAnswer: string
}

/**
 * Built-in catalog of canonical university-level PDAs.
 */
export function getStandardPda(pattern: string, alphabet?: string[]): FormalPda {
  switch (pattern) {
    case 'an_bn': {
      const a = alphabet?.[0] || '0'
      const b = alphabet?.[1] || '1'
      return {
        id: 'pda_an_bn',
        name: `${a}ⁿ${b}ⁿ (n ≥ 0)`,
        description: `Recognizes strings with equal number of ${a}'s followed by ${b}'s.`,
        states: ['q0', 'q1', 'q2', 'qacc'],
        alphabet: [a, b],
        stackAlphabet: ['Z0', a],
        startState: 'q0',
        startStackSymbol: 'Z0',
        acceptStates: ['qacc'],
        acceptanceMode: 'final_state',
        rules: [
          // q0: push start marker or immediately accept empty string
          { from: 'q0', input: 'ε', pop: 'Z0', to: 'q1', push: ['Z0'], description: 'Start parsing' },
          { from: 'q0', input: 'ε', pop: 'Z0', to: 'qacc', push: ['Z0'], description: 'Accept empty string ε' },

          // q1: push all 'a's
          { from: 'q1', input: a, pop: 'Z0', to: 'q1', push: [a, 'Z0'], description: `Push first ${a}` },
          { from: 'q1', input: a, pop: a, to: 'q1', push: [a, a], description: `Push subsequent ${a}` },

          // Transition to q2 on first 'b'
          { from: 'q1', input: b, pop: a, to: 'q2', push: [], description: `Match first ${b}, pop ${a}` },

          // q2: pop an 'a' for every 'b'
          { from: 'q2', input: b, pop: a, to: 'q2', push: [], description: `Match ${b}, pop ${a}` },

          // Accept when Z0 is reached at end of input
          { from: 'q2', input: 'ε', pop: 'Z0', to: 'qacc', push: ['Z0'], description: 'Acceptance: stack matched' },
        ],
        examples: [`${a}${b}`, `${a}${a}${b}${b}`, `${a}${a}${a}${b}${b}${b}`, ''],
      }
    }

    case 'balanced_parentheses':
      return {
        id: 'pda_balanced_parentheses',
        name: 'Balanced Parentheses',
        description: 'Accepts well-formed strings of nested and concatenated parentheses.',
        states: ['q0', 'q1', 'qacc'],
        alphabet: ['(', ')'],
        stackAlphabet: ['Z0', '('],
        startState: 'q0',
        startStackSymbol: 'Z0',
        acceptStates: ['qacc'],
        acceptanceMode: 'final_state',
        rules: [
          // Start move
          { from: 'q0', input: 'ε', pop: 'Z0', to: 'q1', push: ['Z0'], description: 'Initialize stack' },
          { from: 'q0', input: 'ε', pop: 'Z0', to: 'qacc', push: ['Z0'], description: 'Accept empty string ε' },

          // In q1: push '(' on '('
          { from: 'q1', input: '(', pop: 'Z0', to: 'q1', push: ['(', 'Z0'], description: "Push '(' over bottom marker" },
          { from: 'q1', input: '(', pop: '(', to: 'q1', push: ['(', '('], description: "Push nested '('" },

          // In q1: pop '(' on ')'
          { from: 'q1', input: ')', pop: '(', to: 'q1', push: [], description: "Match and pop '(' on ')'" },

          // Accept when Z0 is reached
          { from: 'q1', input: 'ε', pop: 'Z0', to: 'qacc', push: ['Z0'], description: 'Acceptance: balanced nesting' },
        ],
        examples: ['()', '(())', '()()', '(()())', ''],
      }

    case 'palindromes': {
      const a = alphabet?.[0] || '0'
      const b = alphabet?.[1] || '1'
      return {
        id: 'pda_palindromes',
        name: `Palindromes over {${a}, ${b}} (w = wᴿ)`,
        description: 'Nondeterministic PDA guessing the center of arbitrary binary palindromes.',
        states: ['q0', 'q1', 'qacc'],
        alphabet: [a, b],
        stackAlphabet: ['Z0', a, b],
        startState: 'q0',
        startStackSymbol: 'Z0',
        acceptStates: ['qacc'],
        acceptanceMode: 'final_state',
        rules: [
          // Push symbols in first half
          { from: 'q0', input: a, pop: 'Z0', to: 'q0', push: [a, 'Z0'], description: `Push ${a}` },
          { from: 'q0', input: b, pop: 'Z0', to: 'q0', push: [b, 'Z0'], description: `Push ${b}` },
          { from: 'q0', input: a, pop: a, to: 'q0', push: [a, a], description: `Push ${a}` },
          { from: 'q0', input: b, pop: a, to: 'q0', push: [b, a], description: `Push ${b}` },
          { from: 'q0', input: a, pop: b, to: 'q0', push: [a, b], description: `Push ${a}` },
          { from: 'q0', input: b, pop: b, to: 'q0', push: [b, b], description: `Push ${b}` },

          // Nondeterministic midpoint transitions:
          // 1. Even palindrome midpoint (ε-transition without consuming input)
          { from: 'q0', input: 'ε', pop: 'Z0', to: 'q1', push: ['Z0'], description: 'Guess even center (Z0)' },
          { from: 'q0', input: 'ε', pop: a, to: 'q1', push: [a], description: `Guess even center (${a})` },
          { from: 'q0', input: 'ε', pop: b, to: 'q1', push: [b], description: `Guess even center (${b})` },

          // 2. Odd palindrome midpoint (consumes center symbol without stack change)
          { from: 'q0', input: a, pop: a, to: 'q1', push: [a], description: `Odd center ${a}` },
          { from: 'q0', input: b, pop: a, to: 'q1', push: [a], description: `Odd center ${b}` },
          { from: 'q0', input: a, pop: b, to: 'q1', push: [b], description: `Odd center ${a}` },
          { from: 'q0', input: b, pop: b, to: 'q1', push: [b], description: `Odd center ${b}` },
          { from: 'q0', input: a, pop: 'Z0', to: 'q1', push: ['Z0'], description: `Odd center single ${a}` },
          { from: 'q0', input: b, pop: 'Z0', to: 'q1', push: ['Z0'], description: `Odd center single ${b}` },

          // Match reversed second half in q1
          { from: 'q1', input: a, pop: a, to: 'q1', push: [], description: `Match and pop ${a}` },
          { from: 'q1', input: b, pop: b, to: 'q1', push: [], description: `Match and pop ${b}` },

          // Acceptance on Z0
          { from: 'q1', input: 'ε', pop: 'Z0', to: 'qacc', push: ['Z0'], description: 'Palindrome accepted' },
          { from: 'q0', input: 'ε', pop: 'Z0', to: 'qacc', push: ['Z0'], description: 'Empty string accepted' },
        ],
        examples: [`${a}${b}${a}`, `${a}${b}${b}${a}`, `${a}${a}${a}`, a, b, ''],
      }
    }

    case 'equal_zeros_ones': {
      const a = alphabet?.[0] || '0'
      const b = alphabet?.[1] || '1'
      return {
        id: 'pda_equal_zeros_ones',
        name: `Equal number of ${a}'s and ${b}'s`,
        description: `Maintains the excess count of ${a}'s or ${b}'s on the stack.`,
        states: ['q0', 'qacc'],
        alphabet: [a, b],
        stackAlphabet: ['Z0', a, b],
        startState: 'q0',
        startStackSymbol: 'Z0',
        acceptStates: ['qacc'],
        acceptanceMode: 'final_state',
        rules: [
          // On empty stack (Z0): push whichever symbol arrives
          { from: 'q0', input: a, pop: 'Z0', to: 'q0', push: [a, 'Z0'], description: `Excess ${a}` },
          { from: 'q0', input: b, pop: 'Z0', to: 'q0', push: [b, 'Z0'], description: `Excess ${b}` },

          // If excess 'a' on stack:
          { from: 'q0', input: a, pop: a, to: 'q0', push: [a, a], description: `Increase excess ${a}` },
          { from: 'q0', input: b, pop: a, to: 'q0', push: [], description: `Cancel ${a} with ${b}` },

          // If excess 'b' on stack:
          { from: 'q0', input: b, pop: b, to: 'q0', push: [b, b], description: `Increase excess ${b}` },
          { from: 'q0', input: a, pop: b, to: 'q0', push: [], description: `Cancel ${b} with ${a}` },

          // Accept on Z0 when input empty
          { from: 'q0', input: 'ε', pop: 'Z0', to: 'qacc', push: ['Z0'], description: 'Equal count accepted' },
        ],
        examples: [`${a}${b}`, `${b}${a}`, `${a}${a}${b}${b}`, `${a}${b}${a}${b}`, ''],
      }
    }

    default:
      return getStandardPda('an_bn', alphabet)
  }
}

/**
 * Formats PDA rules into Markdown table format.
 */
export function formatPdaTableMarkdown(m: FormalPda): string {
  const header = '| From State | Input ($a$) | Stack Top Pop ($X$) | To State | Stack Push ($\\alpha$) |\n|---|---|---|---|---|'
  const rows = m.rules.map((r) => {
    const inp = r.input === '' || r.input === 'ε' ? '$\\epsilon$' : `\`${r.input}\``
    const pop = r.pop === '' || r.pop === 'ε' ? '$\\epsilon$' : `\`${r.pop}\``
    const push =
      r.push.length === 0 || (r.push.length === 1 && (r.push[0] === '' || r.push[0] === 'ε'))
        ? '$\\epsilon$'
        : `\`${r.push.join('')}\``
    return `| \`${r.from}\` | ${inp} | ${pop} | \`${r.to}\` | ${push} |`
  })
  return [header, ...rows].join('\n')
}

/**
 * Solves a Pushdown Automaton problem and produces a complete mathematical solution object.
 */
export function solvePdaProblem(
  questionPrompt: string,
  spec: PdaProblemSpec,
): PdaSolution {
  let pda: FormalPda
  let cfgToPdaResult: CfgToPdaResult | undefined
  let pdaToCfgResult: PdaToCfgResult | undefined

  if (spec.type === 'cfg_to_pda' && spec.givenCfg) {
    cfgToPdaResult = convertCfgToPda(spec.givenCfg)
    pda = cfgToPdaResult.pda
  } else if (spec.givenPda) {
    pda = spec.givenPda
  } else if (spec.languagePattern) {
    pda = getStandardPda(spec.languagePattern, spec.alphabet)
  } else {
    pda = getStandardPda('an_bn', spec.alphabet)
  }

  if (spec.type === 'pda_to_cfg') {
    pdaToCfgResult = convertPdaToCfg(pda)
  }

  const stateInvariants = pda.states.map((s) => ({
    state: s,
    role:
      s === pda.startState
        ? 'Initial state preparing the bottom-of-stack marker.'
        : pda.acceptStates.includes(s)
        ? 'Accepting state reached upon successful string and stack completion.'
        : `Active computing state managing push/pop transitions.`,
    isAccept: pda.acceptStates.includes(s),
  }))

  const stepByStepConstruction: string[] = [
    `1. Interpreted prompt: "${questionPrompt}".`,
    `2. Defined formal 7-tuple M = (Q, Σ, Γ, δ, q0, Z0, F) with states Q = {${pda.states.join(', ')}}, input alphabet Σ = {${pda.alphabet.join(', ')}}, and stack alphabet Γ = {${pda.stackAlphabet.join(', ')}}.`,
    `3. Formulated transition function δ encoding stack actions (a, X → α) ensuring memory invariants.`,
  ]

  const targetStr = spec.targetString || pda.examples?.[0] || '01'
  const simulationResult = simulatePda(pda, targetStr)
  stepByStepConstruction.push(
    `4. Executed nondeterministic configuration simulation for input "${targetStr}": result is ${simulationResult.accepted ? 'ACCEPTED' : 'REJECTED'} (${simulationResult.acceptanceReason}).`,
  )

  const testBattery = (pda.examples || ['01', '0011', '000111']).slice(0, 4)
  const testResults: PdaTestStringResult[] = testBattery.map((t) => {
    const sim = simulatePda(pda, t)
    return {
      input: t === '' ? 'ε' : t,
      expectedAccept: true,
      actualAccept: sim.accepted,
      stepsCount: sim.path.length,
      acceptanceReason: sim.acceptanceReason,
    }
  })

  const stackBehaviorExplanation =
    `The stack acts as an unbounded Last-In First-Out (LIFO) store. Top of stack is read and popped, ` +
    `and replacement strings are pushed. When symbols are pushed, the stack height grows; ` +
    `when symbols are popped, the stack height shrinks. Acceptance occurs when the bottom marker "${pda.startStackSymbol}" ` +
    `is detected at the end of input.`

  const mathematicalProof =
    `Correctness Invariant:\n` +
    `1. Base Step: On empty string ε or initial configuration (q0, w, Z0), the stack accurately reflects the initial symbol Z0.\n` +
    `2. Inductive Hypothesis: After consuming prefix u, the stack contains the precise counter or reversal image of u.\n` +
    `3. Inductive Step: Matching transitions consume input while popping corresponding symbols, preserving language equivalence.\n` +
    `4. Acceptance: The machine reaches an accepting state in F if and only if the complete input satisfies the language requirements.`

  const complexityAnalysis = {
    timeComplexity: 'O(n) for deterministic runs; bounded BFS prevents infinite ε-loops',
    spaceComplexity: 'O(n) maximum stack depth proportional to input length',
    explanation:
      'A deterministic PDA processes an input of length n in O(n) steps. For general nondeterministic PDAs, ' +
      'a breadth-first configuration search with visited-state hashing explores valid paths in polynomial time ' +
      'relative to the stack depth and halts gracefully on cycles.',
  }

  const finalAnswer =
    spec.type === 'cfg_to_pda'
      ? `Successfully constructed equivalent Pushdown Automaton with ${pda.states.length} states and ${pda.rules.length} transition rules from CFG.`
      : spec.type === 'pda_to_cfg' && pdaToCfgResult
      ? `Successfully converted PDA into Context-Free Grammar with ${pdaToCfgResult.grammar.variables.length} variables and ${pdaToCfgResult.simplifiedProductionCount} simplified productions.`
      : `Pushdown Automaton M = (Q, Σ, Γ, δ, q0, Z0, F) synthesized. Input "${targetStr}" is ${simulationResult.accepted ? 'ACCEPTED' : 'REJECTED'}.`

  return {
    interpretedQuestion: questionPrompt,
    formalPda: pda,
    formalDefinitionMarkdown: formatPdaFormalTuple(pda),
    transitionTableMarkdown: formatPdaTableMarkdown(pda),
    stateInvariants,
    stepByStepConstruction,
    stackBehaviorExplanation,
    mathematicalProof,
    simulationResult,
    cfgToPdaResult,
    pdaToCfgResult,
    testResults,
    complexityAnalysis,
    finalAnswer,
  }
}

