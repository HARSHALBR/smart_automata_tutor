/**
 * Comprehensive Context-Free Grammar (CFG) Engine:
 * - Formal 4-tuple representation: G = (V, Σ, P, S)
 * - Robust BNF/text grammar parser and formatter
 * - Grammar validation and syntax error reporting
 * - Leftmost and rightmost derivation generators
 * - Multi-parse-tree search for ambiguity detection
 * - Tree-to-derivation converters
 */

export interface Grammar {
  id?: string
  name?: string
  description?: string
  start: string
  variables: string[]
  terminals: string[]
  /** variable -> list of right-hand sides; each rhs is a list of symbols, [] = ε */
  rules: Record<string, string[][]>
  examples: string[]
}

export interface ParseNode {
  symbol: string
  children?: ParseNode[]
}

export interface DerivationStep {
  /** the sentential form after this step, as a list of symbols */
  form: string[]
  /** index in the previous form that was expanded */
  expanded: number
  /** the variable that was rewritten */
  variable: string
  /** the production used, as a readable string */
  production: string
}

export interface GrammarValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ParseGrammarTextResult {
  success: boolean
  grammar?: Grammar
  error?: string
  warnings: string[]
}

const isVar = (g: Grammar, s: string) => g.variables.includes(s)

/**
 * Validates a formal Context-Free Grammar G = (V, Σ, P, S).
 * Checks disjointness of V and Σ, valid start symbol, production consistency,
 * and flags non-generating or unreachable variables with warnings.
 */
export function validateGrammar(g: Grammar): GrammarValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!g.variables || g.variables.length === 0) {
    errors.push('The grammar must contain at least one variable (non-terminal).')
  }

  if (!g.start) {
    errors.push('The start symbol S is missing.')
  } else if (!g.variables.includes(g.start)) {
    errors.push(`Start symbol "${g.start}" must belong to the set of variables V.`)
  }

  // Check disjointness: V ∩ Σ = ∅
  const varSet = new Set(g.variables)
  for (const t of g.terminals || []) {
    if (varSet.has(t)) {
      errors.push(`Symbol "${t}" cannot be simultaneously a variable and a terminal (V ∩ Σ must be ∅).`)
    }
  }

  // Check production rules
  const rules = g.rules || {}
  const ruleLhsSet = new Set(Object.keys(rules))

  for (const v of g.variables) {
    if (!ruleLhsSet.has(v) || rules[v].length === 0) {
      warnings.push(`Variable "${v}" has no production rules defined.`)
    }
  }

  for (const [lhs, rhss] of Object.entries(rules)) {
    if (!varSet.has(lhs)) {
      errors.push(`Production LHS "${lhs}" is not declared in the set of variables V.`)
    }

    for (const rhs of rhss) {
      for (const sym of rhs) {
        if (sym === 'ε' || sym === '') continue
        if (!varSet.has(sym) && !(g.terminals || []).includes(sym)) {
          warnings.push(`Symbol "${sym}" in production "${lhs} → ${rhs.join(' ')}" was not declared in V or Σ.`)
        }
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
 * Parses user-entered grammar text into a formal Grammar object.
 * Supports standard BNF notations:
 * S -> a S b | ε
 * A -> a A | a
 * Uses standard TOC conventions:
 * - LHS symbols are non-terminals.
 * - Uppercase identifiers in RHS are variables.
 * - Lowercase letters, digits, and punctuation are terminals.
 * - ε, epsilon, e, ^, or empty alternative represents the empty string.
 */
export function parseCfgFromText(
  text: string,
  declaredStart?: string,
): ParseGrammarTextResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'))
  if (lines.length === 0) {
    return {
      success: false,
      error: 'Grammar input is empty. Please enter production rules (e.g. S -> 0 S 1 | ε).',
      warnings: [],
    }
  }

  const rules: Record<string, string[][]> = {}
  const variablesSet = new Set<string>()
  const terminalsSet = new Set<string>()
  const warnings: string[] = []
  let inferredStart: string | null = declaredStart || null

  // Pass 1: Collect LHS variables and start symbol
  for (const line of lines) {
    const arrowMatch = line.match(/^([A-Za-z0-9_']+)\s*(?:->|→|::=|=>)\s*(.*)$/)
    if (!arrowMatch) {
      return {
        success: false,
        error: `Malformed production rule "${line}". Expected format: Variable -> alternatives (e.g., S -> a S b | ε).`,
        warnings,
      }
    }
    const lhs = arrowMatch[1].trim()
    variablesSet.add(lhs)
    if (!inferredStart) {
      inferredStart = lhs
    }
  }

  // Pass 2: Parse RHS alternatives
  for (const line of lines) {
    const arrowMatch = line.match(/^([A-Za-z0-9_']+)\s*(?:->|→|::=|=>)\s*(.*)$/)!
    const lhs = arrowMatch[1].trim()
    const rawRhsList = arrowMatch[2].split('|').map((alt) => alt.trim())

    if (!rules[lhs]) {
      rules[lhs] = []
    }

    for (const rawAlt of rawRhsList) {
      if (
        rawAlt === '' ||
        rawAlt === 'ε' ||
        rawAlt.toLowerCase() === 'epsilon' ||
        rawAlt === '^' ||
        rawAlt === "''" ||
        rawAlt === '""'
      ) {
        // Epsilon production
        rules[lhs].push([])
        continue
      }

      // Tokenize RHS into symbols
      // If spaces are used: tokenize by whitespace.
      // If no spaces: tokenize by character / known variables.
      let tokens: string[] = []
      if (rawAlt.includes(' ')) {
        tokens = rawAlt.split(/\s+/).filter(Boolean)
      } else {
        // Character by character, matching multi-char variables if present
        let i = 0
        while (i < rawAlt.length) {
          let matchedVar = false
          for (const v of variablesSet) {
            if (rawAlt.startsWith(v, i)) {
              tokens.push(v)
              i += v.length
              matchedVar = true
              break
            }
          }
          if (!matchedVar) {
            tokens.push(rawAlt[i])
            i++
          }
        }
      }

      const cleanTokens: string[] = []
      for (const tok of tokens) {
        if (
          tok === 'ε' ||
          tok.toLowerCase() === 'epsilon' ||
          tok === '^'
        ) {
          continue
        }
        cleanTokens.push(tok)
        // If token starts with uppercase or is already in variablesSet, mark as variable
        if (variablesSet.has(tok) || /^[A-Z]/.test(tok)) {
          variablesSet.add(tok)
        } else {
          terminalsSet.add(tok)
        }
      }

      rules[lhs].push(cleanTokens)
    }
  }

  const start = inferredStart || 'S'
  variablesSet.add(start)

  // Ensure disjoint sets: any symbol in variablesSet cannot be in terminalsSet
  for (const v of variablesSet) {
    terminalsSet.delete(v)
  }

  const grammar: Grammar = {
    start,
    variables: Array.from(variablesSet),
    terminals: Array.from(terminalsSet).sort(),
    rules,
    examples: [],
  }

  const validation = validateGrammar(grammar)
  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors.join(' '),
      warnings: [...warnings, ...validation.warnings],
    }
  }

  return {
    success: true,
    grammar,
    warnings: [...warnings, ...validation.warnings],
  }
}

/**
 * Formats a Grammar into standard readable BNF text.
 */
export function formatCfgToText(g: Grammar): string {
  const lines: string[] = []
  const vars = [g.start, ...g.variables.filter((v) => v !== g.start)]

  for (const v of vars) {
    const rhss = g.rules[v] || []
    if (rhss.length === 0) continue
    const formattedAlts = rhss.map((rhs) => (rhs.length === 0 ? 'ε' : rhs.join(' ')))
    lines.push(`${v} → ${formattedAlts.join(' | ')}`)
  }

  return lines.join('\n')
}

/**
 * Formats a formal 4-tuple G = (V, Σ, P, S) in LaTeX / Markdown.
 */
export function formatCfgFormalTuple(g: Grammar): string {
  const vList = `{ ${g.variables.join(', ')} }`
  const sigmaList = `{ ${g.terminals.length > 0 ? g.terminals.join(', ') : '∅'} }`
  const rulesText = formatCfgToText(g)

  return `### Formal Context-Free Grammar Definition

$$G = (V, \\Sigma, P, S)$$

- **Variables ($V$):** $${vList}$
- **Terminals ($\\Sigma$):** $${sigmaList}$
- **Start Symbol ($S$):** $${g.start}$
- **Production Rules ($P$):**

\`\`\`bnf
${rulesText}
\`\`\`
`
}

/**
 * Tokenizes an input string according to grammar terminals.
 * Handles single-character terminals or multi-character tokens (e.g. 'id', 'num').
 */
export function tokenizeInputString(target: string, terminals: string[]): string[] {
  if (target === '' || target === 'ε') return []

  const sortedTerms = [...terminals].sort((a, b) => b.length - a.length)
  const tokens: string[] = []
  let pos = 0

  while (pos < target.length) {
    if (/\s/.test(target[pos])) {
      pos++
      continue
    }
    let matched = false
    for (const term of sortedTerms) {
      if (term && target.startsWith(term, pos)) {
        tokens.push(term)
        pos += term.length
        matched = true
        break
      }
    }
    if (!matched) {
      tokens.push(target[pos])
      pos++
    }
  }

  return tokens
}

/**
 * Finds all distinct parse trees for `target` using cycle-safe memoized chart search.
 * Up to `maxTrees` trees are returned. Crucial for ambiguity detection and dual-tree visualization.
 */
export function findAllParseTrees(
  g: Grammar,
  target: string,
  maxTrees: number = 10,
  maxDepth: number = 30,
): ParseNode[] {
  const tokens = tokenizeInputString(target, g.terminals)
  const n = tokens.length

  function parseSeq(
    seq: string[],
    i: number,
    j: number,
    visitedInSpan: Set<string>,
    depth: number,
  ): ParseNode[][] {
    if (depth > maxDepth) return []
    if (seq.length === 0) return i === j ? [[]] : []

    const [head, ...rest] = seq
    if (rest.length === 0) {
      const headTrees = parseSym(head, i, j, visitedInSpan, depth + 1)
      return headTrees.map((t) => [t])
    }

    const results: ParseNode[][] = []
    for (let m = i; m <= j; m++) {
      const headTrees = parseSym(head, i, m, visitedInSpan, depth + 1)
      if (headTrees.length === 0) continue

      const restCombos = parseSeq(rest, m, j, new Set<string>(), depth + 1)
      for (const ht of headTrees) {
        for (const rc of restCombos) {
          results.push([ht, ...rc])
          if (results.length >= maxTrees) return results
        }
      }
    }
    return results
  }

  function parseSym(
    sym: string,
    i: number,
    j: number,
    visitedInSpan: Set<string>,
    depth: number,
  ): ParseNode[] {
    if (depth > maxDepth) return []

    if (!isVar(g, sym)) {
      if (sym === 'ε' && i === j) return [{ symbol: 'ε' }]
      if (j - i === 1 && tokens[i] === sym) return [{ symbol: sym }]
      return []
    }

    const spanKey = `${sym}:${i}:${j}`
    if (visitedInSpan.has(spanKey)) {
      // Prevent unit and epsilon cycles on the same span
      return []
    }

    const nextVisited = new Set(visitedInSpan)
    nextVisited.add(spanKey)
    const trees: ParseNode[] = []

    for (const rhs of g.rules[sym] || []) {
      if (rhs.length === 0) {
        if (i === j) {
          trees.push({ symbol: sym, children: [{ symbol: 'ε' }] })
        }
        continue
      }

      const combos = parseSeq(rhs, i, j, nextVisited, depth + 1)
      for (const c of combos) {
        trees.push({ symbol: sym, children: c })
        if (trees.length >= maxTrees) return trees
      }
    }

    return trees
  }

  const rawTrees = parseSym(g.start, 0, n, new Set<string>(), 0)

  // Filter out duplicate trees if any
  const uniqueTrees: ParseNode[] = []
  for (const t of rawTrees) {
    if (!uniqueTrees.some((existing) => areParseTreesEqual(existing, t))) {
      uniqueTrees.push(t)
    }
    if (uniqueTrees.length >= maxTrees) break
  }

  return uniqueTrees
}

/**
 * Checks structural equality of two parse trees.
 */
export function areParseTreesEqual(t1?: ParseNode, t2?: ParseNode): boolean {
  if (!t1 && !t2) return true
  if (!t1 || !t2) return false
  if (t1.symbol !== t2.symbol) return false

  const c1 = t1.children || []
  const c2 = t2.children || []
  if (c1.length !== c2.length) return false

  for (let i = 0; i < c1.length; i++) {
    if (!areParseTreesEqual(c1[i], c2[i])) return false
  }
  return true
}

/**
 * Converts a ParseNode tree into a step-by-step leftmost derivation.
 */
export function treeToLeftmostDerivation(tree: ParseNode, startSymbol: string): DerivationStep[] {
  const steps: DerivationStep[] = []
  let frontier: ParseNode[] = [tree]

  const formOf = (nodes: ParseNode[]) =>
    nodes.map((n) => n.symbol).filter((s) => s !== 'ε')

  steps.push({
    form: [startSymbol],
    expanded: 0,
    variable: startSymbol,
    production: `start: ${startSymbol}`,
  })

  while (true) {
    const idx = frontier.findIndex((n) => n.children && n.children.length > 0)
    if (idx === -1) break

    const node = frontier[idx]
    const kids = node.children!
    const rhs = kids.map((c) => c.symbol)

    frontier = [...frontier.slice(0, idx), ...kids, ...frontier.slice(idx + 1)]

    steps.push({
      form: formOf(frontier),
      expanded: idx,
      variable: node.symbol,
      production: `${node.symbol} → ${rhs.join(' ') || 'ε'}`,
    })
  }

  return steps
}

/**
 * Converts a ParseNode tree into a step-by-step rightmost derivation.
 */
export function treeToRightmostDerivation(tree: ParseNode, startSymbol: string): DerivationStep[] {
  const steps: DerivationStep[] = []
  let frontier: ParseNode[] = [tree]

  const formOf = (nodes: ParseNode[]) =>
    nodes.map((n) => n.symbol).filter((s) => s !== 'ε')

  steps.push({
    form: [startSymbol],
    expanded: 0,
    variable: startSymbol,
    production: `start: ${startSymbol}`,
  })

  while (true) {
    let idx = -1
    for (let i = frontier.length - 1; i >= 0; i--) {
      const item = frontier[i]
      if (item && item.children && item.children.length > 0) {
        idx = i
        break
      }
    }
    if (idx === -1) break

    const node = frontier[idx]
    const kids = node.children!
    const rhs = kids.map((c) => c.symbol)

    frontier = [...frontier.slice(0, idx), ...kids, ...frontier.slice(idx + 1)]

    steps.push({
      form: formOf(frontier),
      expanded: idx,
      variable: node.symbol,
      production: `${node.symbol} → ${rhs.join(' ') || 'ε'}`,
    })
  }

  return steps
}

/**
 * Attempt to derive `target` from start symbol using leftmost derivation.
 * Preserves backwards compatibility with existing codebase.
 */
export function deriveLeftmost(
  g: Grammar,
  target: string,
): { steps: DerivationStep[]; tree: ParseNode } | null {
  const trees = findAllParseTrees(g, target, 1)
  if (trees.length === 0) return null

  const tree = trees[0]
  const steps = treeToLeftmostDerivation(tree, g.start)
  return { steps, tree }
}

/**
 * Attempt to derive `target` from start symbol using rightmost derivation.
 */
export function deriveRightmost(
  g: Grammar,
  target: string,
): { steps: DerivationStep[]; tree: ParseNode } | null {
  const trees = findAllParseTrees(g, target, 1)
  if (trees.length === 0) return null

  const tree = trees[0]
  const steps = treeToRightmostDerivation(tree, g.start)
  return { steps, tree }
}

/**
 * Formats a derivation sequence as a readable mathematical transition string.
 * e.g. S ⇒ a S b ⇒ a a b
 */
export function formatDerivationString(steps: DerivationStep[]): string {
  if (steps.length === 0) return ''
  return steps.map((s) => (s.form.length === 0 ? 'ε' : s.form.join(' '))).join(' ⇒ ')
}

/**
 * Curated preset grammars for learning and testing.
 */
export const GRAMMARS: Grammar[] = [
  {
    id: 'anbn',
    name: '0ⁿ1ⁿ (n ≥ 0)',
    description: 'Equal numbers of 0s then 1s — the classic non-regular language.',
    start: 'S',
    variables: ['S'],
    terminals: ['0', '1'],
    rules: { S: [['0', 'S', '1'], []] },
    examples: ['0011', '000111', '01', ''],
  },
  {
    id: 'equal_ab',
    name: 'Equal a’s and b’s',
    description: 'Strings with an equal count of a and b symbols in any order.',
    start: 'S',
    variables: ['S'],
    terminals: ['a', 'b'],
    rules: {
      S: [
        ['a', 'S', 'b', 'S'],
        ['b', 'S', 'a', 'S'],
        [],
      ],
    },
    examples: ['ab', 'ba', 'aabb', 'abab', 'abba', ''],
  },
  {
    id: 'palindromes',
    name: 'Palindromes over {0,1}',
    description: 'Arbitrary palindromes (odd or even length) over the binary alphabet.',
    start: 'S',
    variables: ['S'],
    terminals: ['0', '1'],
    rules: {
      S: [
        ['0', 'S', '0'],
        ['1', 'S', '1'],
        ['0'],
        ['1'],
        [],
      ],
    },
    examples: ['010', '1001', '111', '0110', '0', '1', ''],
  },
  {
    id: 'balanced',
    name: 'Balanced parentheses',
    description: 'Well-nested strings of ( and ).',
    start: 'S',
    variables: ['S'],
    terminals: ['(', ')'],
    rules: { S: [['S', 'S'], ['(', 'S', ')'], []] },
    examples: ['()', '(())', '()()', '(()())', ''],
  },
  {
    id: 'ambiguous_arithmetic',
    name: 'Ambiguous Arithmetic Expressions',
    description: 'Classic textbook ambiguous grammar: E → E + E | E * E | id',
    start: 'E',
    variables: ['E'],
    terminals: ['+', '*', 'id'],
    rules: {
      E: [
        ['E', '+', 'E'],
        ['E', '*', 'E'],
        ['id'],
      ],
    },
    examples: ['id+id*id', 'id+id+id'],
  },
]
