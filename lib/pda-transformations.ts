/**
 * Pushdown Automata Transformations:
 * 1. CFG to PDA Conversion (Standard Top-Down Parsing Construction)
 * 2. PDA to CFG Conversion (Standard State-Pair Triple Construction [q, X, p])
 */

import { type Grammar, type ParseGrammarTextResult, formatCfgToText } from './cfg'
import { eliminateUselessSymbols } from './cfg-transformations'
import { type FormalPda, type PdaRule, validatePda, formatPdaToText } from './pda'

export interface CfgToPdaResult {
  pda: FormalPda
  stepExplanations: string[]
  productionMappings: { production: string; rule: string }[]
  terminalMappings: { terminal: string; rule: string }[]
}

export interface PdaToCfgResult {
  grammar: Grammar
  unprunedProductionCount: number
  simplifiedProductionCount: number
  triples: string[]
  stepExplanations: string[]
  formulaExplanation: string
}

/**
 * Converts a Context-Free Grammar G = (V, Σ, P, S) into an equivalent Pushdown Automaton M.
 * Uses the canonical 3-state Top-Down simulation construction:
 * - q_start: pushes start symbol S onto stack over Z0
 * - q_loop: replaces non-terminals with their RHS (ε, A -> α), and matches terminals (a, a -> ε)
 * - q_accept: halts when bottom marker Z0 is reached and popped
 */
export function convertCfgToPda(g: Grammar): CfgToPdaResult {
  const qStart = 'q_start'
  const qLoop = 'q_loop'
  const qAccept = 'q_accept'

  const states = [qStart, qLoop, qAccept]
  const alphabet = [...g.terminals]
  const stackAlphabet = Array.from(new Set(['Z0', ...g.variables, ...g.terminals]))
  const rules: PdaRule[] = []

  const stepExplanations: string[] = [
    `1. Initialized states Q = { ${states.join(', ')} }, input alphabet Σ = { ${alphabet.join(', ')} }, and stack alphabet Γ = { ${stackAlphabet.join(', ')} }.`,
    `2. Added initial transition from "${qStart}" to "${qLoop}" pushing start symbol "${g.start}" over bottom marker "Z0".`,
  ]

  // Transition 1: Initialize stack with start symbol S
  rules.push({
    from: qStart,
    input: 'ε',
    pop: 'Z0',
    to: qLoop,
    push: [g.start, 'Z0'],
    description: `Initialize stack: push start symbol "${g.start}" over "Z0"`,
  })

  // Transitions 2: Grammar production rules A -> α become stack expansions (ε, A -> α)
  const productionMappings: { production: string; rule: string }[] = []
  for (const v of g.variables) {
    for (const rhs of g.rules[v] || []) {
      const pushSymbols = rhs.length === 0 ? [] : [...rhs]
      const prodStr = `${v} → ${rhs.length === 0 ? 'ε' : rhs.join(' ')}`
      const ruleDesc = `ε, ${v} → ${pushSymbols.length === 0 ? 'ε' : pushSymbols.join('')}`

      rules.push({
        from: qLoop,
        input: 'ε',
        pop: v,
        to: qLoop,
        push: pushSymbols,
        description: `Grammar rule expansion: ${prodStr}`,
      })

      productionMappings.push({ production: prodStr, rule: ruleDesc })
    }
  }
  stepExplanations.push(
    `3. Created ${productionMappings.length} non-deterministic variable expansion transitions (q_loop, ε, A → q_loop, α) for each grammar production A → α.`,
  )

  // Transitions 3: Terminal matching rules (a, a -> ε)
  const terminalMappings: { terminal: string; rule: string }[] = []
  for (const a of g.terminals) {
    const termRuleDesc = `${a}, ${a} → ε`
    rules.push({
      from: qLoop,
      input: a,
      pop: a,
      to: qLoop,
      push: [],
      description: `Terminal consumption: match "${a}" on input and stack`,
    })
    terminalMappings.push({ terminal: a, rule: termRuleDesc })
  }
  stepExplanations.push(
    `4. Created ${terminalMappings.length} terminal matching transitions (q_loop, a, a → q_loop, ε) to pop matched input characters from the stack.`,
  )

  // Transition 4: Final acceptance
  rules.push({
    from: qLoop,
    input: 'ε',
    pop: 'Z0',
    to: qAccept,
    push: [],
    description: 'Acceptance: pop bottom marker Z0 when input is fully parsed',
  })
  stepExplanations.push(
    `5. Created acceptance transition (q_loop, ε, Z0 → q_accept, ε) to pop bottom marker and enter accepting state "${qAccept}".`,
  )

  const pda: FormalPda = {
    id: `pda_from_${g.id || 'cfg'}`,
    name: `PDA for ${g.name || 'CFG'}`,
    description: `Constructed from Context-Free Grammar via standard top-down parsing algorithm.`,
    states,
    alphabet,
    stackAlphabet,
    startState: qStart,
    startStackSymbol: 'Z0',
    acceptStates: [qAccept],
    acceptanceMode: 'final_state',
    rules,
    examples: g.examples || [],
  }

  return {
    pda,
    stepExplanations,
    productionMappings,
    terminalMappings,
  }
}

/**
 * Converts a Pushdown Automaton M into an equivalent Context-Free Grammar G
 * using the standard State-Pair Triple construction [q, X, p].
 */
export function convertPdaToCfg(m: FormalPda): PdaToCfgResult {
  const stepExplanations: string[] = []
  const Q = m.states
  const startSymbol = 'S'
  const rules: Record<string, string[][]> = {
    [startSymbol]: [],
  }

  // Triple representation: [q, X, p] -> string identifier "q_X_p"
  function tripleName(q: string, X: string, p: string): string {
    return `[${q},${X},${p}]`
  }

  stepExplanations.push(
    `1. Variables in the grammar are the start symbol "S" and composite state-pair triples [q, X, p] ` +
      `representing the computation that drives the PDA from state q to state p while completely removing stack symbol X.`,
  )

  // Step 1: Start symbol productions S -> [q0, Z0, p] for all p in Q
  const startTriples: string[] = []
  for (const p of Q) {
    const t = tripleName(m.startState, m.startStackSymbol, p)
    rules[startSymbol].push([t])
    startTriples.push(t)
  }
  stepExplanations.push(
    `2. Added ${startTriples.length} start productions S → [${m.startState}, ${m.startStackSymbol}, p] for all states p ∈ Q.`,
  )

  // Step 2: Convert each PDA transition into grammar productions
  const rawTriplesSet = new Set<string>()

  for (const r of m.rules) {
    const a = r.input === '' || r.input === 'ε' ? [] : [r.input]
    const X = r.pop === '' || r.pop === 'ε' ? m.startStackSymbol : r.pop

    if (r.push.length === 0 || (r.push.length === 1 && (r.push[0] === '' || r.push[0] === 'ε'))) {
      // Pop rule: [from, X, to] -> a
      const lhs = tripleName(r.from, X, r.to)
      if (!rules[lhs]) rules[lhs] = []
      rules[lhs].push(a) // a or [] (ε)
      rawTriplesSet.add(lhs)
    } else if (r.push.length === 1) {
      // Replaces X with Y1
      const Y1 = r.push[0]
      for (const p of Q) {
        const lhs = tripleName(r.from, X, p)
        const rhsTriple = tripleName(r.to, Y1, p)
        if (!rules[lhs]) rules[lhs] = []
        rules[lhs].push([...a, rhsTriple])
        rawTriplesSet.add(lhs)
        rawTriplesSet.add(rhsTriple)
      }
    } else if (r.push.length === 2) {
      // Pushes 2 symbols: Y1 Y2 (e.g. 0 Z0)
      const Y1 = r.push[0]
      const Y2 = r.push[1]
      for (const p of Q) {
        for (const p1 of Q) {
          const lhs = tripleName(r.from, X, p)
          const rhs1 = tripleName(r.to, Y1, p1)
          const rhs2 = tripleName(p1, Y2, p)
          if (!rules[lhs]) rules[lhs] = []
          rules[lhs].push([...a, rhs1, rhs2])
          rawTriplesSet.add(lhs)
          rawTriplesSet.add(rhs1)
          rawTriplesSet.add(rhs2)
        }
      }
    } else {
      // General k >= 3: cascade
      const k = r.push.length
      // Permute intermediate states Q^(k-1)
      function permute(depth: number, currentList: string[]) {
        if (depth === k - 1) {
          for (const lastP of Q) {
            const allStates = [r.to, ...currentList, lastP]
            const lhs = tripleName(r.from, X, lastP)
            const rhsTriples: string[] = []
            for (let idx = 0; idx < k; idx++) {
              rhsTriples.push(tripleName(allStates[idx], r.push[idx], allStates[idx + 1]))
            }
            if (!rules[lhs]) rules[lhs] = []
            rules[lhs].push([...a, ...rhsTriples])
            rawTriplesSet.add(lhs)
            for (const rt of rhsTriples) rawTriplesSet.add(rt)
          }
          return
        }
        for (const st of Q) {
          permute(depth + 1, [...currentList, st])
        }
      }
      permute(0, [])
    }
  }

  const unprunedCount = Object.values(rules).reduce((acc, rhss) => acc + rhss.length, 0)
  stepExplanations.push(
    `3. Generated ${unprunedCount} raw productions from PDA transition triples.`,
  )

  const unprunedGrammar: Grammar = {
    start: startSymbol,
    variables: [startSymbol, ...Array.from(rawTriplesSet)],
    terminals: [...m.alphabet],
    rules,
    examples: m.examples || [],
  }

  // Step 3: Eliminate useless (non-generating and unreachable) symbols
  const simplified = eliminateUselessSymbols(unprunedGrammar)
  const simplifiedCount = Object.values(simplified.grammar.rules).reduce((acc, rhss) => acc + rhss.length, 0)

  stepExplanations.push(
    `4. Pruned useless non-generating and unreachable symbols: reduced grammar to ${simplified.grammar.variables.length} active variables and ${simplifiedCount} reachable productions.`,
  )

  const formulaExplanation =
    `Standard Triples Construction Theorem:\n` +
    `For any transition (p, Y1 ... Yk) ∈ δ(q, a, X), the PDA erases X while traveling from q to p_k by ` +
    `erasing Y1 (ending at p1), erasing Y2 (ending at p2), ..., erasing Yk (ending at p_k).\n` +
    `Hence, [q, X, p_k] → a [p, Y1, p1] [p1, Y2, p2] ... [p_{k-1}, Yk, p_k].`

  return {
    grammar: simplified.grammar,
    unprunedProductionCount: unprunedCount,
    simplifiedProductionCount: simplifiedCount,
    triples: Array.from(rawTriplesSet),
    stepExplanations,
    formulaExplanation,
  }
}

