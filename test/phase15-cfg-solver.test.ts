import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  type Grammar,
  parseCfgFromText,
  validateGrammar,
  formatCfgToText,
  formatCfgFormalTuple,
  deriveLeftmost,
  deriveRightmost,
  findAllParseTrees,
  treeToLeftmostDerivation,
  treeToRightmostDerivation,
  areParseTreesEqual,
  formatDerivationString,
  GRAMMARS,
} from '../lib/cfg'
import {
  findNullableVariables,
  eliminateEpsilonProductions,
  findUnitPairs,
  eliminateUnitProductions,
  findGeneratingSymbols,
  findReachableSymbols,
  eliminateUselessSymbols,
  simplifyCfg,
  convertToCnf,
  validateCnf,
} from '../lib/cfg-transformations'
import {
  runCyk,
  runCykDetailed,
  grammarToCnfGrammar,
  CNF_GRAMMARS,
} from '../lib/cyk'
import {
  analyzeAmbiguity,
} from '../lib/cfg-ambiguity'
import {
  solveCfgProblem,
  getStandardCfg,
} from '../lib/cfg-solver'
import { parseQuestion } from '../lib/nlp-parser'

describe('Phase 15: Complete Context-Free Grammar (CFG) Solver', () => {
  /* -------------------------------------------------------------------------- */
  /*               1. Formal Grammar Representation & Validation                */
  /* -------------------------------------------------------------------------- */
  describe('1. CFG Representation, Text Parsing & Validation', () => {
    it('parses multi-line BNF notation with multiple alternatives and epsilon', () => {
      const text = `
        S -> a S b | ε
        A -> a A | a
      `
      const res = parseCfgFromText(text)
      assert.strictEqual(res.success, true)
      assert.ok(res.grammar)
      assert.strictEqual(res.grammar.start, 'S')
      assert.ok(res.grammar.variables.includes('S'))
      assert.ok(res.grammar.variables.includes('A'))
      assert.ok(res.grammar.terminals.includes('a'))
      assert.ok(res.grammar.terminals.includes('b'))
      assert.strictEqual(res.grammar.rules['S'].length, 2)
      // Check epsilon is stored as empty array []
      assert.deepStrictEqual(res.grammar.rules['S'][1], [])
    })

    it('validates disjointness of V and Σ', () => {
      const invalidGrammar: Grammar = {
        start: 'S',
        variables: ['S', 'a'],
        terminals: ['a', 'b'],
        rules: { S: [['a']], a: [] },
        examples: [],
      }
      const val = validateGrammar(invalidGrammar)
      assert.strictEqual(val.valid, false)
      assert.ok(val.errors.some((e) => e.includes('simultaneously a variable and a terminal')))
    })

    it('catches missing start symbol or undefined start symbol', () => {
      const invalid: Grammar = {
        start: 'X',
        variables: ['S'],
        terminals: ['a'],
        rules: { S: [['a']] },
        examples: [],
      }
      const val = validateGrammar(invalid)
      assert.strictEqual(val.valid, false)
      assert.ok(val.errors.some((e) => e.includes('Start symbol "X" must belong to the set of variables V')))
    })

    it('formats grammar back to clean BNF text and formal LaTeX 4-tuple', () => {
      const g = GRAMMARS[0]
      const text = formatCfgToText(g)
      assert.ok(text.includes('S → 0 S 1 | ε'))

      const formalTuple = formatCfgFormalTuple(g)
      assert.ok(formalTuple.includes('G = (V, \\Sigma, P, S)'))
      assert.ok(formalTuple.includes('Variables ($V$):'))
      assert.ok(formalTuple.includes('Terminals'))
      assert.ok(formalTuple.includes('Start Symbol ($S$):'))
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                      2. Derivations & Parse Trees                          */
  /* -------------------------------------------------------------------------- */
  describe('2. Leftmost & Rightmost Derivations and Parse Trees', () => {
    const anbnGrammar: Grammar = {
      start: 'S',
      variables: ['S'],
      terminals: ['0', '1'],
      rules: { S: [['0', 'S', '1'], []] },
      examples: ['0011', '01', ''],
    }

    it('computes step-by-step leftmost derivation for 0011', () => {
      const res = deriveLeftmost(anbnGrammar, '0011')
      assert.ok(res)
      assert.strictEqual(res.tree.symbol, 'S')

      // S => 0 S 1 => 0 0 S 1 1 => 0 0 1 1
      const steps = res.steps
      assert.strictEqual(steps[0].form.join(''), 'S')
      assert.strictEqual(steps[steps.length - 1].form.join(''), '0011')
      assert.strictEqual(steps[1].production, 'S → 0 S 1')
      assert.strictEqual(steps[2].production, 'S → 0 S 1')
      assert.strictEqual(steps[3].production, 'S → ε')

      const derivationStr = formatDerivationString(steps)
      assert.ok(derivationStr.includes('S ⇒ 0 S 1 ⇒ 0 0 S 1 1 ⇒ 0 0 1 1'))
    })

    it('computes step-by-step rightmost derivation for 0011', () => {
      const res = deriveRightmost(anbnGrammar, '0011')
      assert.ok(res)
      const steps = res.steps
      assert.strictEqual(steps[0].form.join(''), 'S')
      assert.strictEqual(steps[steps.length - 1].form.join(''), '0011')
    })

    it('correctly derives empty string ε when grammar accepts it', () => {
      const res = deriveLeftmost(anbnGrammar, '')
      assert.ok(res)
      assert.strictEqual(res.steps[1].production, 'S → ε')
    })

    it('rejects strings not in the language', () => {
      const res = deriveLeftmost(anbnGrammar, '001')
      assert.strictEqual(res, null)
    })

    it('verifies structural equality of parse trees', () => {
      const trees1 = findAllParseTrees(anbnGrammar, '01')
      const trees2 = findAllParseTrees(anbnGrammar, '01')
      assert.strictEqual(trees1.length, 1)
      assert.strictEqual(trees2.length, 1)
      assert.strictEqual(areParseTreesEqual(trees1[0], trees2[0]), true)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                         3. CFG Simplification                              */
  /* -------------------------------------------------------------------------- */
  describe('3. CFG Simplification (Epsilon, Unit, Useless Symbols)', () => {
    it('identifies nullable variables correctly including indirect chains', () => {
      // S -> A B, A -> a | C, B -> b | ε, C -> ε
      const g: Grammar = {
        start: 'S',
        variables: ['S', 'A', 'B', 'C'],
        terminals: ['a', 'b'],
        rules: {
          S: [['A', 'B']],
          A: [['a'], ['C']],
          B: [['b'], []],
          C: [[]],
        },
        examples: [],
      }
      const nullable = findNullableVariables(g)
      assert.ok(nullable.has('C'))
      assert.ok(nullable.has('B'))
      assert.ok(nullable.has('A')) // A -> C and C is nullable
      assert.ok(nullable.has('S')) // S -> A B and both A, B nullable
    })

    it('eliminates epsilon productions and preserves empty string with S0', () => {
      const g: Grammar = {
        start: 'S',
        variables: ['S', 'A'],
        terminals: ['a', 'b'],
        rules: {
          S: [['a', 'S', 'b'], ['A']],
          A: [[]],
        },
        examples: [],
      }
      const res = eliminateEpsilonProductions(g, true)
      assert.strictEqual(res.preservesEmptyString, true)
      assert.ok(res.grammar.variables.includes('S0'))
      assert.strictEqual(res.grammar.start, 'S0')
      // S0 should have [S] and []
      assert.ok(res.grammar.rules['S0'].some((r) => r.length === 0))
      // S itself should no longer have empty production
      assert.ok(res.grammar.rules['S'].every((r) => r.length > 0))
    })

    it('eliminates unit productions including cycles A -> B, B -> A', () => {
      const g: Grammar = {
        start: 'S',
        variables: ['S', 'A', 'B'],
        terminals: ['a', 'b'],
        rules: {
          S: [['A']],
          A: [['B'], ['a']],
          B: [['A'], ['b']],
        },
        examples: [],
      }
      const unitPairs = findUnitPairs(g)
      assert.ok(unitPairs.get('S')?.has('A'))
      assert.ok(unitPairs.get('S')?.has('B'))
      assert.ok(unitPairs.get('A')?.has('B'))
      assert.ok(unitPairs.get('B')?.has('A'))

      const res = eliminateUnitProductions(g)
      // All unit productions removed; S derives both 'a' and 'b' directly
      const sRules = res.grammar.rules['S'].map((r) => r.join(''))
      assert.ok(sRules.includes('a'))
      assert.ok(sRules.includes('b'))
      assert.ok(sRules.every((r) => r !== 'A' && r !== 'B'))
    })

    it('eliminates useless non-generating and unreachable symbols', () => {
      // S -> A | B, A -> a, B -> B b (non-generating), C -> c (unreachable)
      const g: Grammar = {
        start: 'S',
        variables: ['S', 'A', 'B', 'C'],
        terminals: ['a', 'b', 'c'],
        rules: {
          S: [['A'], ['B']],
          A: [['a']],
          B: [['B', 'b']],
          C: [['c']],
        },
        examples: [],
      }
      const gen = findGeneratingSymbols(g)
      assert.ok(gen.has('A'))
      assert.ok(gen.has('S'))
      assert.ok(!gen.has('B')) // B is non-generating

      const res = eliminateUselessSymbols(g)
      assert.ok(!res.grammar.variables.includes('B')) // non-generating pruned
      assert.ok(!res.grammar.variables.includes('C')) // unreachable pruned
      assert.ok(res.grammar.variables.includes('S'))
      assert.ok(res.grammar.variables.includes('A'))
    })

    it('runs the complete 3-stage CFG simplification pipeline', () => {
      const g: Grammar = {
        start: 'S',
        variables: ['S', 'A', 'B'],
        terminals: ['0', '1'],
        rules: {
          S: [['0', 'S', '1'], ['A']],
          A: [['B']],
          B: [[]],
        },
        examples: [],
      }
      const sim = simplifyCfg(g)
      assert.ok(sim.finalGrammar)
      assert.strictEqual(sim.step1Epsilon.nullableVariables.length > 0, true)
      assert.ok(sim.summaryExplanation.includes('Simplified grammar'))
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                  4. Chomsky Normal Form (CNF) Conversion                   */
  /* -------------------------------------------------------------------------- */
  describe('4. Chomsky Normal Form (CNF) Conversion Pipeline', () => {
    it('converts anbn grammar S -> 0 S 1 | 0 1 into strict CNF', () => {
      const g: Grammar = {
        start: 'S',
        variables: ['S'],
        terminals: ['0', '1'],
        rules: {
          S: [
            ['0', 'S', '1'],
            ['0', '1'],
          ],
        },
        examples: ['01', '0011'],
      }
      const cnfRes = convertToCnf(g)
      assert.strictEqual(cnfRes.validationResult.isStrictCnf, true)

      // Verify strict CNF: each rule is A -> B C or A -> a
      for (const [lhs, rhss] of Object.entries(cnfRes.finalCnfGrammar.rules)) {
        for (const rhs of rhss) {
          if (rhs.length === 1) {
            assert.ok(cnfRes.finalCnfGrammar.terminals.includes(rhs[0]))
          } else if (rhs.length === 2) {
            assert.ok(cnfRes.finalCnfGrammar.variables.includes(rhs[0]))
            assert.ok(cnfRes.finalCnfGrammar.variables.includes(rhs[1]))
          } else {
            assert.fail(`Invalid rule length in CNF: ${lhs} -> ${rhs.join(' ')}`)
          }
        }
      }
    })

    it('handles long production bodies of length >= 3 via binarization cascade', () => {
      const g: Grammar = {
        start: 'S',
        variables: ['S'],
        terminals: ['a', 'b', 'c', 'd'],
        rules: {
          S: [['a', 'b', 'c', 'd']],
        },
        examples: ['abcd'],
      }
      const cnfRes = convertToCnf(g)
      assert.strictEqual(cnfRes.validationResult.isStrictCnf, true)
      // Must have introduced helper variables like C_1, C_2 and terminal variables
      assert.ok(cnfRes.finalCnfGrammar.variables.length >= 4)
    })

    it('records 7 distinct transformation steps with explanations', () => {
      const g = GRAMMARS[1] // Balanced parentheses
      const cnfRes = convertToCnf(g)
      assert.strictEqual(cnfRes.steps.length, 7)
      assert.strictEqual(cnfRes.steps[0].title.includes('Start Symbol Isolation'), true)
      assert.strictEqual(cnfRes.steps[1].title.includes('Eliminate ε-productions'), true)
      assert.strictEqual(cnfRes.steps[2].title.includes('Eliminate Unit Productions'), true)
      assert.strictEqual(cnfRes.steps[3].title.includes('Eliminate Useless Symbols'), true)
      assert.strictEqual(cnfRes.steps[4].title.includes('Replace Terminals'), true)
      assert.strictEqual(cnfRes.steps[5].title.includes('Binarize Long Production'), true)
      assert.strictEqual(cnfRes.steps[6].title.includes('CNF Property Validation'), true)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                        5. CYK Parsing Algorithm                            */
  /* -------------------------------------------------------------------------- */
  describe('5. Cocke–Younger–Kasami (CYK) Algorithm', () => {
    it('populates triangular dynamic programming matrix and accepts valid string', () => {
      const cnfG = CNF_GRAMMARS[0] // 0^n 1^n in CNF
      const cyk = runCykDetailed(cnfG, '0011')

      assert.strictEqual(cyk.accepted, true)
      assert.strictEqual(cyk.tokens.length, 4)
      assert.strictEqual(cyk.matrix.length, 4)

      // Base row span = 1
      assert.strictEqual(cyk.matrix[0].length, 4)
      // Top row span = 4 has 1 cell containing start symbol S
      assert.strictEqual(cyk.matrix[3].length, 1)
      assert.ok(cyk.matrix[3][0].variables.includes('S'))

      // Witnesses are tracked
      assert.ok(cyk.matrix[3][0].witnesses.length > 0)
      assert.ok(cyk.reconstructedTree)
      assert.strictEqual(cyk.reconstructedTree?.symbol, 'S')
    })

    it('rejects invalid strings in CYK table', () => {
      const cnfG = CNF_GRAMMARS[0]
      const cyk = runCykDetailed(cnfG, '0010')
      assert.strictEqual(cyk.accepted, false)
      assert.ok(!cyk.matrix[3][0].variables.includes('S'))
    })

    it('handles empty string membership check in CYK', () => {
      const gWithEps: Grammar = {
        start: 'S',
        variables: ['S'],
        terminals: ['0', '1'],
        rules: {
          S: [['0', 'S', '1'], []],
        },
        examples: [''],
      }
      const cykEps = runCykDetailed(gWithEps, '')
      assert.strictEqual(cykEps.accepted, true)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                         6. Ambiguity Analysis                              */
  /* -------------------------------------------------------------------------- */
  describe('6. Grammar Ambiguity Detection & Dual Parse Trees', () => {
    it('detects ambiguity and extracts 2 distinct parse trees for arithmetic grammar', () => {
      const ambiguousGrammar: Grammar = {
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
      }

      // Check on known ambiguous string "id+id+id"
      const res = analyzeAmbiguity(ambiguousGrammar, 'id+id+id')
      assert.strictEqual(res.isAmbiguous, true)
      assert.strictEqual(res.inconclusive, false)
      assert.ok(res.witness)
      assert.strictEqual(res.witness?.string, 'id+id+id')

      // Check that two trees are structurally different
      assert.strictEqual(
        areParseTreesEqual(res.witness?.tree1, res.witness?.tree2),
        false,
      )

      // Check that leftmost derivations diverge
      assert.ok(res.witness?.derivation1.length > 0)
      assert.ok(res.witness?.derivation2.length > 0)
      assert.ok(res.witness?.divergenceStepIndex >= 0)

      // Disclaimer on undecidability must be present
      assert.ok(res.undecidabilityDisclaimer.includes('undecidable in the general case'))
    })

    it('reports inconclusive for unambiguous grammar without falsely claiming decidability', () => {
      const unambiguousAnBn: Grammar = {
        start: 'S',
        variables: ['S'],
        terminals: ['a', 'b'],
        rules: {
          S: [['a', 'S', 'b'], ['a', 'b']],
        },
        examples: ['ab', 'aabb'],
      }
      const res = analyzeAmbiguity(unambiguousAnBn, undefined, 4)
      assert.strictEqual(res.isAmbiguous, false)
      assert.strictEqual(res.inconclusive, true)
      assert.ok(res.explanation.includes('No ambiguity found'))
      assert.ok(res.undecidabilityDisclaimer.includes('PCP'))
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                  7. Natural-Language Question Routing                      */
  /* -------------------------------------------------------------------------- */
  describe('7. NLP Question Parser CFG Integration', () => {
    it('parses "Construct a CFG for strings with equal numbers of a\'s and b\'s."', () => {
      const q = parseQuestion("Construct a CFG for strings with equal numbers of a's and b's.")
      assert.strictEqual(q.success, true)
      assert.strictEqual(q.targetDomain, 'cfg')
      assert.strictEqual(q.cfgProblemSpec?.type, 'cfg_from_language')
      assert.strictEqual(q.cfgProblemSpec?.languagePattern, 'equal_symbols')
    })

    it('parses "Construct a CFG for palindromes over {0,1}."', () => {
      const q = parseQuestion('Construct a CFG for palindromes over {0,1}.')
      assert.strictEqual(q.success, true)
      assert.strictEqual(q.targetDomain, 'cfg')
      assert.strictEqual(q.cfgProblemSpec?.type, 'cfg_from_language')
      assert.strictEqual(q.cfgProblemSpec?.languagePattern, 'palindromes')
      assert.deepStrictEqual(q.cfgProblemSpec?.alphabet, ['0', '1'])
    })

    it('parses "Find the leftmost derivation of aabb."', () => {
      const q = parseQuestion('Find the leftmost derivation of aabb.')
      assert.strictEqual(q.success, true)
      assert.strictEqual(q.targetDomain, 'cfg')
      assert.strictEqual(q.cfgProblemSpec?.type, 'cfg_leftmost_derivation')
      assert.strictEqual(q.cfgProblemSpec?.targetString, 'aabb')
    })

    it('parses "Convert grammar into CNF."', () => {
      const q = parseQuestion('Convert grammar into CNF.')
      assert.strictEqual(q.success, true)
      assert.strictEqual(q.targetDomain, 'cfg')
      assert.strictEqual(q.cfgProblemSpec?.type, 'cfg_cnf_conversion')
    })

    it('parses "Demonstrate ambiguity with two parse trees."', () => {
      const q = parseQuestion('Demonstrate ambiguity with two parse trees.')
      assert.strictEqual(q.success, true)
      assert.strictEqual(q.targetDomain, 'cfg')
      assert.strictEqual(q.cfgProblemSpec?.type, 'cfg_ambiguity_analysis')
    })

    it('requests clarification for vague "Construct a CFG"', () => {
      const q = parseQuestion('Construct a CFG')
      assert.strictEqual(q.needsClarification, true)
      assert.strictEqual(q.targetDomain, 'cfg')
      assert.ok(q.clarificationOptions && q.clarificationOptions.length > 0)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                  8. End-to-End Problem Solver & Explanations               */
  /* -------------------------------------------------------------------------- */
  describe('8. CFG Problem Solver & Educational Explanations', () => {
    it('solves CFG construction and generates 4-tuple, derivations, and complexity analysis', () => {
      const sol = solveCfgProblem("Construct a CFG for strings with equal numbers of a's and b's", {
        type: 'cfg_from_language',
        languagePattern: 'equal_symbols',
        alphabet: ['a', 'b'],
        targetString: 'ab',
      })

      assert.strictEqual(sol.formalGrammar.start, 'S')
      assert.ok(sol.formalDefinitionMarkdown.includes('G = (V, \\Sigma, P, S)'))
      assert.ok(sol.stepByStepSolution.length >= 3)
      assert.ok(sol.derivationResult)
      assert.strictEqual(sol.derivationResult?.string, 'ab')
      assert.ok(sol.testResults.length >= 3)
      assert.ok(sol.complexityAnalysis.timeComplexity.includes('O(n³ · |P|)'))
      assert.ok(sol.finalAnswer.length > 0)
    })
  })
})
