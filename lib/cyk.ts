/**
 * Cocke–Younger–Kasami (CYK) Parsing Engine:
 * - Dynamic programming triangular parse table construction
 * - General CFG auto-normalization to CNF
 * - Cell-by-cell derivations with production witnesses and backpointers
 * - Parse tree reconstruction from dynamic-programming table
 * - Empty string handling and step-by-step educational trace
 */

import { type Grammar, type ParseNode, tokenizeInputString } from './cfg'
import { convertToCnf, validateCnf } from './cfg-transformations'

export interface CnfGrammar {
  id: string
  name: string
  description: string
  start: string
  variables: string[]
  terminals: string[]
  /** unit rules: variable -> terminals it can produce directly (A → a) */
  unit: Record<string, string[]>
  /** binary rules: variable -> list of [B, C] pairs (A → B C) */
  binary: Record<string, [string, string][]>
  examples: string[]
}

export interface CykCell {
  /** 0-based start index of the substring */
  i: number
  /** substring length (1-based span) */
  span: number
  /** the set of variables deriving substring s[i..i+span) */
  vars: string[]
}

export interface CykResult {
  input: string
  /** cells in fill order (by increasing span, then left to right) */
  cells: CykCell[]
  accepted: boolean
}

export interface CykWitness {
  variable: string
  rule: string
  splitK: number
  leftVar: string
  rightVar: string
}

export interface CykMatrixCell {
  i: number
  span: number
  substring: string
  variables: string[]
  witnesses: CykWitness[]
  terminalRules: string[]
}

export interface CykDetailedResult {
  input: string
  tokens: string[]
  matrix: CykMatrixCell[][] // matrix[span-1][i]
  fillOrder: CykCell[]
  accepted: boolean
  cnfGrammar: Grammar
  stepExplanations: string[]
  reconstructedTree?: ParseNode
}

/**
 * Converts a CnfGrammar to a standard Grammar interface
 */
export function cnfGrammarToGrammar(cg: CnfGrammar): Grammar {
  const rules: Record<string, string[][]> = {}
  for (const v of cg.variables) {
    rules[v] = []
  }

  for (const [v, terms] of Object.entries(cg.unit)) {
    if (!rules[v]) rules[v] = []
    for (const t of terms) {
      rules[v].push([t])
    }
  }

  for (const [v, pairs] of Object.entries(cg.binary)) {
    if (!rules[v]) rules[v] = []
    for (const [b, c] of pairs) {
      rules[v].push([b, c])
    }
  }

  return {
    id: cg.id,
    name: cg.name,
    description: cg.description,
    start: cg.start,
    variables: cg.variables,
    terminals: cg.terminals,
    rules,
    examples: cg.examples,
  }
}

/**
 * Converts a standard Grammar to CnfGrammar structure (for CNF grammars)
 */
export function grammarToCnfGrammar(g: Grammar, id: string = 'cnf-grammar'): CnfGrammar {
  const unit: Record<string, string[]> = {}
  const binary: Record<string, [string, string][]> = {}

  for (const v of g.variables) {
    unit[v] = []
    binary[v] = []
  }

  for (const [v, rhss] of Object.entries(g.rules)) {
    if (!unit[v]) unit[v] = []
    if (!binary[v]) binary[v] = []

    for (const rhs of rhss) {
      if (rhs.length === 1 && g.terminals.includes(rhs[0])) {
        unit[v].push(rhs[0])
      } else if (rhs.length === 2 && g.variables.includes(rhs[0]) && g.variables.includes(rhs[1])) {
        binary[v].push([rhs[0], rhs[1]])
      }
    }
  }

  return {
    id,
    name: g.name || 'CNF Grammar',
    description: g.description || 'Chomsky Normal Form Grammar',
    start: g.start,
    variables: g.variables,
    terminals: g.terminals,
    unit,
    binary,
    examples: g.examples || [],
  }
}

/**
 * Run CYK and return every cell in the order the algorithm fills them.
 * Preserved for backwards compatibility with existing UI components.
 */
export function runCyk(g: CnfGrammar, input: string): CykResult {
  const n = input.length
  const table: Set<string>[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => new Set<string>()),
  )
  const cells: CykCell[] = []

  if (n === 0) {
    return { input, cells, accepted: false }
  }

  // span 1: unit terminal rules
  for (let i = 0; i < n; i++) {
    const ch = input[i]
    const vars = new Set<string>()
    for (const v of g.variables) {
      if ((g.unit[v] ?? []).includes(ch)) vars.add(v)
    }
    table[0][i] = vars
    cells.push({ i, span: 1, vars: [...vars] })
  }

  // spans 2..n
  for (let span = 2; span <= n; span++) {
    for (let i = 0; i + span <= n; i++) {
      const vars = new Set<string>()
      for (let k = 1; k < span; k++) {
        const left = table[k - 1][i]
        const right = table[span - k - 1][i + k]
        if (!left.size || !right.size) continue
        for (const v of g.variables) {
          for (const [b, c] of g.binary[v] ?? []) {
            if (left.has(b) && right.has(c)) vars.add(v)
          }
        }
      }
      table[span - 1][i] = vars
      cells.push({ i, span, vars: [...vars] })
    }
  }

  const top = table[n - 1][0]
  return { input, cells, accepted: top.has(g.start) }
}

/**
 * Advanced CYK Parser:
 * - Accepts any Grammar (auto-converts to CNF if needed).
 * - Accepts tokenized input strings (e.g. ['0', '1'] or ['id', '+', 'id']).
 * - Populates full matrix with rule witnesses and split points.
 * - Reconstructs a valid parse tree if accepted.
 * - Handles empty string (ε).
 */
export function runCykDetailed(
  grammarInput: Grammar | CnfGrammar,
  input: string,
): CykDetailedResult {
  const rawGrammar = 'unit' in grammarInput ? cnfGrammarToGrammar(grammarInput) : grammarInput
  const cnfCheck = validateCnf(rawGrammar)

  // Ensure grammar is in CNF
  let cnfGrammar = rawGrammar
  if (!cnfCheck.isStrictCnf) {
    const conv = convertToCnf(rawGrammar)
    cnfGrammar = conv.finalCnfGrammar
  }

  const tokens = tokenizeInputString(input, cnfGrammar.terminals)
  const n = tokens.length
  const stepExplanations: string[] = []

  // Check for empty string case
  if (n === 0 || input === '' || input === 'ε') {
    const startRules = cnfGrammar.rules[cnfGrammar.start] || []
    const acceptsEpsilon = startRules.some(
      (r) => r.length === 0 || (r.length === 1 && r[0] === 'ε'),
    )
    return {
      input,
      tokens: [],
      matrix: [],
      fillOrder: [],
      accepted: acceptsEpsilon,
      cnfGrammar,
      stepExplanations: [
        acceptsEpsilon
          ? `Input is empty string ε. Start symbol "${cnfGrammar.start} → ε" accepts ε directly.`
          : `Input is empty string ε. Start symbol "${cnfGrammar.start}" has no ε-production, so ε is rejected.`,
      ],
      reconstructedTree: acceptsEpsilon
        ? { symbol: cnfGrammar.start, children: [{ symbol: 'ε' }] }
        : undefined,
    }
  }

  // Pre-index CNF rules for O(1) matching:
  // terminalRulesMap: terminal -> list of LHS variables
  const terminalRulesMap: Record<string, string[]> = {}
  // binaryRulesList: list of { lhs, b, c }
  const binaryRulesList: { lhs: string; b: string; c: string }[] = []

  for (const [lhs, rhss] of Object.entries(cnfGrammar.rules)) {
    for (const rhs of rhss) {
      if (rhs.length === 1) {
        const term = rhs[0]
        if (!terminalRulesMap[term]) terminalRulesMap[term] = []
        if (!terminalRulesMap[term].includes(lhs)) {
          terminalRulesMap[term].push(lhs)
        }
      } else if (rhs.length === 2) {
        binaryRulesList.push({ lhs, b: rhs[0], c: rhs[1] })
      }
    }
  }

  // matrix[span - 1][i]
  const matrix: CykMatrixCell[][] = Array.from({ length: n }, (_, spanIdx) => {
    const span = spanIdx + 1
    return Array.from({ length: n - span + 1 }, (_, i) => ({
      i,
      span,
      substring: tokens.slice(i, i + span).join(''),
      variables: [],
      witnesses: [],
      terminalRules: [],
    }))
  })

  const fillOrder: CykCell[] = []

  // Step 1: Base row (span = 1, single terminal matches)
  stepExplanations.push(`=== Span 1 (Length 1 Substrings) ===`)
  for (let i = 0; i < n; i++) {
    const tok = tokens[i]
    const matchingVars = terminalRulesMap[tok] || []
    const cell = matrix[0][i]
    cell.variables = [...matchingVars].sort()
    cell.terminalRules = matchingVars.map((v) => `${v} → ${tok}`)

    fillOrder.push({ i, span: 1, vars: cell.variables })
    stepExplanations.push(
      `Cell (span 1, pos ${i}): substring "${tok}" derives variables { ${cell.variables.join(', ') || '∅'} } via terminal rules.`,
    )
  }

  // Step 2: Higher spans (span = 2..n)
  for (let span = 2; span <= n; span++) {
    stepExplanations.push(`=== Span ${span} (Length ${span} Substrings) ===`)
    for (let i = 0; i + span <= n; i++) {
      const cell = matrix[span - 1][i]
      const varSet = new Set<string>()
      const witnesses: CykWitness[] = []

      // Test split points: left part length k (1..span-1)
      for (let k = 1; k < span; k++) {
        const leftCell = matrix[k - 1][i]
        const rightCell = matrix[span - k - 1][i + k]

        if (leftCell.variables.length === 0 || rightCell.variables.length === 0) continue

        const leftSet = new Set(leftCell.variables)
        const rightSet = new Set(rightCell.variables)

        for (const { lhs, b, c } of binaryRulesList) {
          if (leftSet.has(b) && rightSet.has(c)) {
            varSet.add(lhs)
            witnesses.push({
              variable: lhs,
              rule: `${lhs} → ${b} ${c}`,
              splitK: k,
              leftVar: b,
              rightVar: c,
            })
          }
        }
      }

      cell.variables = Array.from(varSet).sort()
      cell.witnesses = witnesses
      fillOrder.push({ i, span, vars: cell.variables })

      stepExplanations.push(
        `Cell (span ${span}, pos ${i}): substring "${cell.substring}" derives { ${cell.variables.join(', ') || '∅'} }` +
          (witnesses.length > 0 ? ` via ${witnesses.map((w) => `${w.rule} [split ${w.splitK}]`).join(', ')}` : ''),
      )
    }
  }

  const topCell = matrix[n - 1][0]
  const accepted = topCell.variables.includes(cnfGrammar.start)

  stepExplanations.push(
    `=== CYK Conclusion ===\n` +
      `Start symbol "${cnfGrammar.start}" ${accepted ? 'IS' : 'IS NOT'} in top cell (span ${n}, pos 0). ` +
      `String "${input}" is therefore ${accepted ? 'ACCEPTED' : 'REJECTED'}.`,
  )

  // Reconstruct parse tree if accepted
  let reconstructedTree: ParseNode | undefined
  if (accepted) {
    function buildTree(v: string, span: number, i: number): ParseNode {
      const currentCell = matrix[span - 1][i]
      if (span === 1) {
        return {
          symbol: v,
          children: [{ symbol: tokens[i] }],
        }
      }
      // Find a witness for variable v
      const witness = currentCell.witnesses.find((w) => w.variable === v)
      if (witness) {
        const leftTree = buildTree(witness.leftVar, witness.splitK, i)
        const rightTree = buildTree(witness.rightVar, span - witness.splitK, i + witness.splitK)
        return {
          symbol: v,
          children: [leftTree, rightTree],
        }
      }
      return { symbol: v }
    }

    try {
      reconstructedTree = buildTree(cnfGrammar.start, n, 0)
    } catch {
      // Fallback if tree traversal encounters cycle
    }
  }

  return {
    input,
    tokens,
    matrix,
    fillOrder,
    accepted,
    cnfGrammar,
    stepExplanations,
    reconstructedTree,
  }
}

export const CNF_GRAMMARS: CnfGrammar[] = [
  {
    id: 'anbn-cnf',
    name: '0ⁿ1ⁿ (n ≥ 1)',
    description:
      'Equal 0s then 1s, written in Chomsky Normal Form. S → A C | A B, C → S B, A → 0, B → 1.',
    start: 'S',
    variables: ['S', 'C', 'A', 'B'],
    terminals: ['0', '1'],
    unit: { A: ['0'], B: ['1'] },
    binary: {
      S: [
        ['A', 'B'],
        ['A', 'C'],
      ],
      C: [['S', 'B']],
    },
    examples: ['01', '0011', '000111'],
  },
  {
    id: 'balanced-cnf',
    name: 'Balanced brackets',
    description:
      'Non-empty balanced strings of ( and ) in CNF. Captures nesting and concatenation.',
    start: 'S',
    variables: ['S', 'T', 'L', 'R'],
    terminals: ['(', ')'],
    unit: { L: ['('], R: [')'] },
    binary: {
      S: [
        ['L', 'R'],
        ['L', 'T'],
        ['S', 'S'],
      ],
      T: [['S', 'R']],
    },
    examples: ['()', '(())', '()()', '(()())'],
  },
]
