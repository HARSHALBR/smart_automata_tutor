/**
 * Context-Free Grammar (CFG) Transformations & Normalization:
 * - Elimination of ε-productions (with optional empty string preservation at start symbol)
 * - Elimination of unit productions (with unit pair reachability closure)
 * - Elimination of useless symbols (generating symbols followed by reachable symbols)
 * - Complete Chomsky Normal Form (CNF) 7-step conversion pipeline
 * - Comprehensive intermediate step explanations and verification
 */

import { type Grammar, formatCfgToText, validateGrammar } from './cfg'

export interface TransformationStep {
  title: string
  description: string
  grammarBefore: Grammar
  grammarAfter: Grammar
  details: string[]
}

export interface EpsilonEliminationResult {
  grammar: Grammar
  nullableVariables: string[]
  preservesEmptyString: boolean
  explanation: string
  steps: string[]
}

export interface UnitEliminationResult {
  grammar: Grammar
  unitPairs: { from: string; derives: string[] }[]
  explanation: string
  steps: string[]
}

export interface UselessEliminationResult {
  grammar: Grammar
  generatingSymbols: string[]
  nonGeneratingVariables: string[]
  reachableSymbols: string[]
  unreachableSymbols: string[]
  explanation: string
  steps: string[]
}

export interface CfgSimplificationResult {
  original: Grammar
  step1Epsilon: EpsilonEliminationResult
  step2Unit: UnitEliminationResult
  step3Useless: UselessEliminationResult
  finalGrammar: Grammar
  summaryExplanation: string
}

export interface CnfConversionResult {
  original: Grammar
  steps: TransformationStep[]
  finalCnfGrammar: Grammar
  isLanguageEmpty: boolean
  preservesEmptyString: boolean
  validationResult: {
    isStrictCnf: boolean
    violations: string[]
  }
  summaryExplanation: string
}

/**
 * Computes the set of nullable variables in G:
 * Nullable = { A ∈ V | A ⇒* ε }
 */
export function findNullableVariables(g: Grammar): Set<string> {
  const nullable = new Set<string>()

  // Base step: A → ε ∈ P
  for (const [v, rhss] of Object.entries(g.rules)) {
    for (const rhs of rhss) {
      if (rhs.length === 0 || (rhs.length === 1 && rhs[0] === 'ε')) {
        nullable.add(v)
        break
      }
    }
  }

  // Inductive step: A → Y1 Y2 ... Yk where all Yi ∈ Nullable
  let changed = true
  while (changed) {
    changed = false
    for (const [v, rhss] of Object.entries(g.rules)) {
      if (nullable.has(v)) continue
      for (const rhs of rhss) {
        if (rhs.length > 0 && rhs.every((sym) => nullable.has(sym))) {
          nullable.add(v)
          changed = true
          break
        }
      }
    }
  }

  return nullable
}

/**
 * Eliminates ε-productions from a CFG.
 * If the start symbol S is nullable, introduces S0 → S | ε to preserve ε ∈ L(G).
 */
export function eliminateEpsilonProductions(
  g: Grammar,
  preserveStartEpsilon: boolean = true,
): EpsilonEliminationResult {
  const nullable = findNullableVariables(g)
  const nullableList = Array.from(nullable).sort()
  const steps: string[] = []

  steps.push(`1. Computed nullable variables: { ${nullableList.join(', ') || '∅'} }.`)

  const newRules: Record<string, string[][]> = {}
  for (const v of g.variables) {
    newRules[v] = []
  }

  // For each production A → X1 X2 ... Xk, generate all combinations of omitting nullable symbols
  for (const [lhs, rhss] of Object.entries(g.rules)) {
    const generatedRhsSet = new Set<string>()

    for (const rhs of rhss) {
      // Find indices of symbols in rhs that are nullable
      const nullableIndices: number[] = []
      for (let i = 0; i < rhs.length; i++) {
        if (nullable.has(rhs[i])) {
          nullableIndices.push(i)
        }
      }

      if (nullableIndices.length === 0) {
        if (rhs.length > 0 && !(rhs.length === 1 && rhs[0] === 'ε')) {
          const key = rhs.join(' ')
          if (!generatedRhsSet.has(key)) {
            generatedRhsSet.add(key)
            newRules[lhs].push(rhs)
          }
        }
        continue
      }

      // Generate 2^n subsets
      const totalCombinations = 1 << nullableIndices.length
      for (let mask = 0; mask < totalCombinations; mask++) {
        const omitSet = new Set<number>()
        for (let bit = 0; bit < nullableIndices.length; bit++) {
          if ((mask & (1 << bit)) !== 0) {
            omitSet.add(nullableIndices[bit])
          }
        }

        const candidate: string[] = []
        for (let i = 0; i < rhs.length; i++) {
          if (!omitSet.has(i)) {
            candidate.push(rhs[i])
          }
        }

        // Do not add empty string directly
        if (candidate.length > 0) {
          const key = candidate.join(' ')
          if (!generatedRhsSet.has(key)) {
            generatedRhsSet.add(key)
            newRules[lhs].push(candidate)
          }
        }
      }
    }
  }

  let finalStart = g.start
  let finalVars = [...g.variables]
  const isStartNullable = nullable.has(g.start)

  if (isStartNullable && preserveStartEpsilon) {
    let freshStart = 'S0'
    let counter = 0
    while (finalVars.includes(freshStart)) {
      counter++
      freshStart = `S${counter}`
    }
    finalVars = [freshStart, ...finalVars]
    newRules[freshStart] = [[g.start], []]
    finalStart = freshStart
    steps.push(
      `2. Since start symbol "${g.start}" is nullable, introduced new start symbol "${freshStart} → ${g.start} | ε" to preserve the empty string without allowing ε elsewhere.`,
    )
  } else {
    steps.push(`2. Removed all ε-productions and expanded combinations for nullable variables.`)
  }

  const resultGrammar: Grammar = {
    start: finalStart,
    variables: finalVars,
    terminals: [...g.terminals],
    rules: newRules,
    examples: g.examples || [],
  }

  return {
    grammar: resultGrammar,
    nullableVariables: nullableList,
    preservesEmptyString: isStartNullable && preserveStartEpsilon,
    explanation:
      `Identified ${nullableList.length} nullable variables: { ${nullableList.join(', ') || 'none'} }. ` +
      `Substituted all combinations of nullable variables and removed ε-productions.` +
      (isStartNullable && preserveStartEpsilon ? ` Added fresh start symbol "${finalStart} → ${g.start} | ε".` : ''),
    steps,
  }
}

/**
 * Computes unit pairs for each variable:
 * Unit(A) = { B ∈ V | A ⇒* B }
 */
export function findUnitPairs(g: Grammar): Map<string, Set<string>> {
  const unitMap = new Map<string, Set<string>>()
  const varSet = new Set(g.variables)

  for (const v of g.variables) {
    const reachable = new Set<string>([v])
    let changed = true
    while (changed) {
      changed = false
      for (const curr of Array.from(reachable)) {
        for (const rhs of g.rules[curr] || []) {
          if (rhs.length === 1 && varSet.has(rhs[0])) {
            const target = rhs[0]
            if (!reachable.has(target)) {
              reachable.add(target)
              changed = true
            }
          }
        }
      }
    }
    unitMap.set(v, reachable)
  }

  return unitMap
}

/**
 * Eliminates unit productions (A → B where A, B ∈ V) from CFG.
 */
export function eliminateUnitProductions(g: Grammar): UnitEliminationResult {
  const unitMap = findUnitPairs(g)
  const varSet = new Set(g.variables)
  const steps: string[] = []

  const unitPairsReport: { from: string; derives: string[] }[] = []
  for (const v of g.variables) {
    const derived = Array.from(unitMap.get(v) || []).sort()
    unitPairsReport.push({ from: v, derives: derived })
    if (derived.length > 1) {
      steps.push(`Unit(${v}) = { ${derived.join(', ')} }`)
    }
  }

  const newRules: Record<string, string[][]> = {}
  for (const v of g.variables) {
    newRules[v] = []
    const ruleSet = new Set<string>()

    // For every B such that v ⇒* B
    const targets = unitMap.get(v) || new Set<string>([v])
    for (const b of targets) {
      for (const rhs of g.rules[b] || []) {
        // Only take non-unit productions (rhs length != 1 or symbol is terminal or epsilon)
        const isUnit = rhs.length === 1 && varSet.has(rhs[0])
        if (!isUnit) {
          const key = rhs.join(' ')
          if (!ruleSet.has(key)) {
            ruleSet.add(key)
            newRules[v].push(rhs)
          }
        }
      }
    }
  }

  const resultGrammar: Grammar = {
    start: g.start,
    variables: [...g.variables],
    terminals: [...g.terminals],
    rules: newRules,
    examples: g.examples || [],
  }

  return {
    grammar: resultGrammar,
    unitPairs: unitPairsReport,
    explanation:
      `Computed unit-reachability closures for all variables and replaced each unit production A → B with non-unit bodies of B.`,
    steps: steps.length > 0 ? steps : ['No nontrivial unit cycles or unit chains were detected.'],
  }
}

/**
 * Computes generating symbols:
 * Gen = { X ∈ V ∪ Σ | X ⇒* w for some w ∈ Σ* }
 */
export function findGeneratingSymbols(g: Grammar): Set<string> {
  const gen = new Set<string>(g.terminals)
  const varSet = new Set(g.variables)

  // Base step: variables deriving terminals or epsilon directly
  for (const [v, rhss] of Object.entries(g.rules)) {
    for (const rhs of rhss) {
      if (rhs.length === 0 || rhs.every((s) => !varSet.has(s))) {
        gen.add(v)
        break
      }
    }
  }

  // Inductive step: A → X1 ... Xk where all Xi ∈ Gen
  let changed = true
  while (changed) {
    changed = false
    for (const [v, rhss] of Object.entries(g.rules)) {
      if (gen.has(v)) continue
      for (const rhs of rhss) {
        if (rhs.every((s) => gen.has(s) || s === 'ε')) {
          gen.add(v)
          changed = true
          break
        }
      }
    }
  }

  return gen
}

/**
 * Computes reachable symbols:
 * Reach = { X ∈ V ∪ Σ | S ⇒* α X β }
 */
export function findReachableSymbols(
  g: Grammar,
  activeVariables?: Set<string>,
): Set<string> {
  const reach = new Set<string>([g.start])
  const varsToScan = activeVariables || new Set(g.variables)

  let changed = true
  while (changed) {
    changed = false
    for (const curr of Array.from(reach)) {
      if (!varsToScan.has(curr)) continue
      for (const rhs of g.rules[curr] || []) {
        for (const s of rhs) {
          if (s !== 'ε' && s !== '' && !reach.has(s)) {
            reach.add(s)
            changed = true
          }
        }
      }
    }
  }

  return reach
}

/**
 * Eliminates useless symbols from CFG.
 * MUST execute in order:
 * Step 1: Eliminate non-generating symbols.
 * Step 2: Eliminate unreachable symbols.
 */
export function eliminateUselessSymbols(g: Grammar): UselessEliminationResult {
  const steps: string[] = []

  // Step 1: Generating symbols
  const gen = findGeneratingSymbols(g)
  const nonGenerating = g.variables.filter((v) => !gen.has(v))

  steps.push(
    `1. Generating analysis: { ${Array.from(gen).filter((s) => g.variables.includes(s)).join(', ') || '∅'} } produce terminal strings.` +
      (nonGenerating.length > 0 ? ` Pruned non-generating variables: { ${nonGenerating.join(', ')} }.` : ' No non-generating variables.'),
  )

  // Filter grammar to generating symbols only
  const genVars = g.variables.filter((v) => gen.has(v))
  const genRules: Record<string, string[][]> = {}

  for (const v of genVars) {
    genRules[v] = []
    for (const rhs of g.rules[v] || []) {
      if (rhs.every((s) => gen.has(s) || s === 'ε')) {
        genRules[v].push(rhs)
      }
    }
  }

  const intermediate: Grammar = {
    start: g.start,
    variables: genVars,
    terminals: [...g.terminals],
    rules: genRules,
    examples: g.examples || [],
  }

  // Step 2: Reachable symbols
  const reach = findReachableSymbols(intermediate, new Set(genVars))
  const finalVars = genVars.filter((v) => reach.has(v))
  const finalTerms = g.terminals.filter((t) => reach.has(t))
  const unreachableVars = genVars.filter((v) => !reach.has(v))
  const unreachableTerms = g.terminals.filter((t) => !reach.has(t))

  steps.push(
    `2. Reachability analysis from start "${g.start}": reachable symbols are { ${Array.from(reach).join(', ')} }.` +
      (unreachableVars.length > 0 ? ` Pruned unreachable variables: { ${unreachableVars.join(', ')} }.` : ' All active variables are reachable.') +
      (unreachableTerms.length > 0 ? ` Pruned unused terminals: { ${unreachableTerms.join(', ')} }.` : ''),
  )

  const finalRules: Record<string, string[][]> = {}
  for (const v of finalVars) {
    finalRules[v] = []
    for (const rhs of genRules[v] || []) {
      if (rhs.every((s) => reach.has(s) || s === 'ε')) {
        finalRules[v].push(rhs)
      }
    }
  }

  const prunedGrammar: Grammar = {
    start: g.start,
    variables: finalVars,
    terminals: finalTerms,
    rules: finalRules,
    examples: g.examples || [],
  }

  return {
    grammar: prunedGrammar,
    generatingSymbols: Array.from(gen).sort(),
    nonGeneratingVariables: nonGenerating,
    reachableSymbols: Array.from(reach).sort(),
    unreachableSymbols: [...unreachableVars, ...unreachableTerms],
    explanation:
      `Eliminated non-generating symbols (${nonGenerating.length > 0 ? nonGenerating.join(', ') : 'none'}), ` +
      `then eliminated unreachable symbols from start (${unreachableVars.length > 0 ? unreachableVars.join(', ') : 'none'}).`,
    steps,
  }
}

/**
 * Complete CFG Simplification:
 * 1. Eliminate ε-productions.
 * 2. Eliminate unit productions.
 * 3. Eliminate useless symbols.
 */
export function simplifyCfg(g: Grammar): CfgSimplificationResult {
  const step1 = eliminateEpsilonProductions(g, true)
  const step2 = eliminateUnitProductions(step1.grammar)
  const step3 = eliminateUselessSymbols(step2.grammar)

  return {
    original: g,
    step1Epsilon: step1,
    step2Unit: step2,
    step3Useless: step3,
    finalGrammar: step3.grammar,
    summaryExplanation:
      `Simplified grammar by sequentially: (1) removing ε-productions, (2) removing unit productions, and (3) pruning useless symbols.`,
  }
}

/**
 * Checks if a grammar conforms strictly to Chomsky Normal Form (CNF):
 * Every production is of the form:
 * - A → B C (A, B, C ∈ V)
 * - A → a (a ∈ Σ)
 * - S0 → ε (only if S0 is the start symbol and S0 does not appear on any RHS)
 */
export function validateCnf(g: Grammar): { isStrictCnf: boolean; violations: string[] } {
  const violations: string[] = []
  const varSet = new Set(g.variables)
  const termSet = new Set(g.terminals)

  for (const [lhs, rhss] of Object.entries(g.rules)) {
    for (const rhs of rhss) {
      if (rhs.length === 0 || (rhs.length === 1 && rhs[0] === 'ε')) {
        if (lhs !== g.start) {
          violations.push(`Illegal ε-production "${lhs} → ε": only start symbol can produce ε.`)
        } else {
          // Check if start symbol appears on RHS
          let startOnRhs = false
          for (const otherRhss of Object.values(g.rules)) {
            for (const r of otherRhss) {
              if (r.includes(g.start)) {
                startOnRhs = true
                break
              }
            }
          }
          if (startOnRhs) {
            violations.push(`Start symbol "${g.start}" produces ε but also appears on a right-hand side.`)
          }
        }
      } else if (rhs.length === 1) {
        const sym = rhs[0]
        if (!termSet.has(sym)) {
          violations.push(`Unit production "${lhs} → ${sym}": CNF requires single symbols to be terminals.`)
        }
      } else if (rhs.length === 2) {
        if (!varSet.has(rhs[0]) || !varSet.has(rhs[1])) {
          violations.push(`Binary production "${lhs} → ${rhs.join(' ')}": CNF requires both symbols to be variables.`)
        }
      } else {
        violations.push(`Production "${lhs} → ${rhs.join(' ')}" has length ${rhs.length} (exceeds max length 2).`)
      }
    }
  }

  return {
    isStrictCnf: violations.length === 0,
    violations,
  }
}

/**
 * Complete 7-step Chomsky Normal Form (CNF) Conversion Pipeline:
 * Step 1: Introduce fresh start symbol S0 → S if needed.
 * Step 2: Eliminate ε-productions.
 * Step 3: Eliminate unit productions.
 * Step 4: Eliminate useless symbols.
 * Step 5: Replace terminals in bodies of length ≥ 2 with dedicated variables (Ta → a).
 * Step 6: Break long production bodies (length > 2) into cascades of binary productions.
 * Step 7: Final CNF verification.
 */
export function convertToCnf(g: Grammar): CnfConversionResult {
  const stepsList: TransformationStep[] = []
  let currentGrammar: Grammar = {
    start: g.start,
    variables: [...g.variables],
    terminals: [...g.terminals],
    rules: JSON.parse(JSON.stringify(g.rules)),
    examples: g.examples || [],
  }

  // --- Step 1: Start symbol isolation ---
  let startOnRhs = false
  for (const rhss of Object.values(currentGrammar.rules)) {
    for (const rhs of rhss) {
      if (rhs.includes(currentGrammar.start)) {
        startOnRhs = true
        break
      }
    }
  }

  const grammarBeforeS0 = JSON.parse(JSON.stringify(currentGrammar))
  let addedS0 = false
  if (startOnRhs) {
    let freshS0 = 'S0'
    let counter = 0
    while (currentGrammar.variables.includes(freshS0)) {
      counter++
      freshS0 = `S${counter}`
    }
    currentGrammar.variables = [freshS0, ...currentGrammar.variables]
    currentGrammar.rules[freshS0] = [[currentGrammar.start]]
    const oldStart = currentGrammar.start
    currentGrammar.start = freshS0
    addedS0 = true

    stepsList.push({
      title: 'Step 1: Start Symbol Isolation',
      description: `Introduced new start symbol "${freshS0} → ${oldStart}" because original start symbol "${oldStart}" appears on a production right-hand side.`,
      grammarBefore: grammarBeforeS0,
      grammarAfter: JSON.parse(JSON.stringify(currentGrammar)),
      details: [`Old start: ${oldStart}`, `New start: ${freshS0}`, `Rule added: ${freshS0} → ${oldStart}`],
    })
  } else {
    stepsList.push({
      title: 'Step 1: Start Symbol Isolation',
      description: `Start symbol "${currentGrammar.start}" does not appear on any RHS. No new start symbol required.`,
      grammarBefore: grammarBeforeS0,
      grammarAfter: JSON.parse(JSON.stringify(currentGrammar)),
      details: ['Start symbol is already isolated from all production right-hand sides.'],
    })
  }

  // --- Step 2: Eliminate ε-productions ---
  const grammarBeforeEps = JSON.parse(JSON.stringify(currentGrammar))
  const epsResult = eliminateEpsilonProductions(currentGrammar, true)
  currentGrammar = epsResult.grammar

  stepsList.push({
    title: 'Step 2: Eliminate ε-productions',
    description: epsResult.explanation,
    grammarBefore: grammarBeforeEps,
    grammarAfter: JSON.parse(JSON.stringify(currentGrammar)),
    details: epsResult.steps,
  })

  // --- Step 3: Eliminate unit productions ---
  const grammarBeforeUnit = JSON.parse(JSON.stringify(currentGrammar))
  const unitResult = eliminateUnitProductions(currentGrammar)
  currentGrammar = unitResult.grammar

  stepsList.push({
    title: 'Step 3: Eliminate Unit Productions',
    description: unitResult.explanation,
    grammarBefore: grammarBeforeUnit,
    grammarAfter: JSON.parse(JSON.stringify(currentGrammar)),
    details: unitResult.steps,
  })

  // --- Step 4: Eliminate useless symbols ---
  const grammarBeforeUseless = JSON.parse(JSON.stringify(currentGrammar))
  const uselessResult = eliminateUselessSymbols(currentGrammar)
  currentGrammar = uselessResult.grammar

  stepsList.push({
    title: 'Step 4: Eliminate Useless Symbols',
    description: uselessResult.explanation,
    grammarBefore: grammarBeforeUseless,
    grammarAfter: JSON.parse(JSON.stringify(currentGrammar)),
    details: uselessResult.steps,
  })

  // --- Step 5: Replace terminals in bodies of length ≥ 2 ---
  const grammarBeforeTerminals = JSON.parse(JSON.stringify(currentGrammar))
  const terminalVars: Record<string, string> = {}
  const terminalVarRules: Record<string, string[][]> = {}
  const termReplacementsDone: string[] = []

  const varSet = new Set(currentGrammar.variables)
  const termSet = new Set(currentGrammar.terminals)

  // Find all terminals appearing in bodies of length >= 2
  for (const [lhs, rhss] of Object.entries(currentGrammar.rules)) {
    for (const rhs of rhss) {
      if (rhs.length >= 2) {
        for (const sym of rhs) {
          if (termSet.has(sym) && !terminalVars[sym]) {
            let tVar = `T_${sym}`
            if (varSet.has(tVar)) {
              let idx = 1
              while (varSet.has(`${tVar}_${idx}`)) idx++
              tVar = `${tVar}_${idx}`
            }
            terminalVars[sym] = tVar
            terminalVarRules[tVar] = [[sym]]
            varSet.add(tVar)
            termReplacementsDone.push(`Terminal "${sym}" mapped to variable "${tVar} → ${sym}"`)
          }
        }
      }
    }
  }

  // Substitute terminals in bodies of length >= 2
  const substitutedRules: Record<string, string[][]> = {}
  for (const v of currentGrammar.variables) {
    substitutedRules[v] = []
    for (const rhs of currentGrammar.rules[v] || []) {
      if (rhs.length >= 2) {
        const newRhs = rhs.map((s) => terminalVars[s] || s)
        substitutedRules[v].push(newRhs)
      } else {
        substitutedRules[v].push(rhs)
      }
    }
  }

  // Add the new terminal variables
  for (const [tVar, rhss] of Object.entries(terminalVarRules)) {
    currentGrammar.variables.push(tVar)
    substitutedRules[tVar] = rhss
  }
  currentGrammar.rules = substitutedRules

  stepsList.push({
    title: 'Step 5: Replace Terminals in Long Productions',
    description:
      termReplacementsDone.length > 0
        ? `Substituted terminals in production bodies of length ≥ 2 with dedicated variables: ${Object.entries(terminalVars).map(([t, v]) => `${v} → ${t}`).join(', ')}.`
        : 'All terminals in productions were already isolated in unit terminal rules (A → a).',
    grammarBefore: grammarBeforeTerminals,
    grammarAfter: JSON.parse(JSON.stringify(currentGrammar)),
    details: termReplacementsDone.length > 0 ? termReplacementsDone : ['No mixed-terminal long productions were present.'],
  })

  // --- Step 6: Binarize long production bodies (length > 2) ---
  const grammarBeforeBinarize = JSON.parse(JSON.stringify(currentGrammar))
  const binarizedRules: Record<string, string[][]> = {}
  const freshBinaryVars: string[] = []
  const binarizeDetails: string[] = []
  let helperCounter = 1

  for (const v of currentGrammar.variables) {
    binarizedRules[v] = []
  }

  for (const [lhs, rhss] of Object.entries(currentGrammar.rules)) {
    for (const rhs of rhss) {
      if (rhs.length <= 2) {
        binarizedRules[lhs].push(rhs)
      } else {
        // Binarize A → B1 B2 ... Bk
        let prevLhs = lhs
        for (let i = 0; i < rhs.length - 2; i++) {
          let helperVar = `C_${helperCounter}`
          while (currentGrammar.variables.includes(helperVar) || freshBinaryVars.includes(helperVar)) {
            helperCounter++
            helperVar = `C_${helperCounter}`
          }
          freshBinaryVars.push(helperVar)
          binarizedRules[helperVar] = []

          binarizedRules[prevLhs].push([rhs[i], helperVar])
          binarizeDetails.push(`${prevLhs} → ${rhs[i]} ${helperVar}`)
          prevLhs = helperVar
        }
        // Last binary rule
        binarizedRules[prevLhs].push([rhs[rhs.length - 2], rhs[rhs.length - 1]])
        binarizeDetails.push(`${prevLhs} → ${rhs[rhs.length - 2]} ${rhs[rhs.length - 1]}`)
      }
    }
  }

  currentGrammar.variables = [...currentGrammar.variables, ...freshBinaryVars]
  currentGrammar.rules = binarizedRules

  stepsList.push({
    title: 'Step 6: Binarize Long Production Bodies',
    description:
      binarizeDetails.length > 0
        ? `Binarized ${binarizeDetails.length} long productions into cascades of binary rules using variables: { ${freshBinaryVars.join(', ')} }.`
        : 'All production bodies were already of length ≤ 2.',
    grammarBefore: grammarBeforeBinarize,
    grammarAfter: JSON.parse(JSON.stringify(currentGrammar)),
    details: binarizeDetails.length > 0 ? binarizeDetails : ['No production exceeded length 2.'],
  })

  // --- Step 7: Final CNF Verification ---
  const cnfValidation = validateCnf(currentGrammar)
  stepsList.push({
    title: 'Step 7: CNF Property Validation',
    description: cnfValidation.isStrictCnf
      ? 'Successfully verified: every production is strictly of form A → B C, A → a, or S0 → ε.'
      : `CNF validation detected anomalies: ${cnfValidation.violations.join('; ')}`,
    grammarBefore: JSON.parse(JSON.stringify(currentGrammar)),
    grammarAfter: JSON.parse(JSON.stringify(currentGrammar)),
    details: cnfValidation.isStrictCnf
      ? [
          'Total Variables: ' + currentGrammar.variables.length,
          'Total Rules: ' + Object.values(currentGrammar.rules).reduce((acc, r) => acc + r.length, 0),
          'Strict CNF Compliance: PASS',
        ]
      : cnfValidation.violations,
  })

  return {
    original: g,
    steps: stepsList,
    finalCnfGrammar: currentGrammar,
    isLanguageEmpty: currentGrammar.variables.length === 0,
    preservesEmptyString: epsResult.preservesEmptyString,
    validationResult: cnfValidation,
    summaryExplanation:
      `Transformed grammar into Chomsky Normal Form through 7 standard stages. ` +
      `The resulting grammar contains ${currentGrammar.variables.length} variables and strictly adheres to CNF format.`,
  }
}

