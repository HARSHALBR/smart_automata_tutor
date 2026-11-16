import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  deriveLeftmost,
  deriveRightmost,
  findAllParseTrees,
  parseCfgFromText,
  formatCfgToText,
  GRAMMARS,
} from '../lib/cfg'
import { convertToCnf } from '../lib/cfg-transformations'
import { runCykDetailed } from '../lib/cyk'
import { solveCfgProblem } from '../lib/cfg-solver'
import { parseQuestion } from '../lib/nlp-parser'

describe('Phase 19 - CFG & CNF Graph Generation & Parse Tree Verification', () => {
  describe('1. CFG Parse Tree Generation across Different Alphabets', () => {
    it('generates valid parse trees for equal a and b symbols {a, b}', () => {
      const g = GRAMMARS.find((gram) => gram.id === 'equal_ab')!
      assert(g !== undefined)
      const res = deriveLeftmost(g, 'ab')
      assert(res !== null, 'Derivation should succeed for "ab"')
      assert(res.tree !== undefined)
      assert.strictEqual(res.tree.symbol, 'S')
      assert(res.tree.children && res.tree.children.length > 0)

      // Test a longer balanced string
      const res2 = deriveLeftmost(g, 'aabb')
      assert(res2 !== null, 'Derivation should succeed for "aabb"')
      assert.strictEqual(res2.tree.symbol, 'S')
    })

    it('generates valid parse trees for balanced parentheses { ( , ) }', () => {
      const g = GRAMMARS.find((gram) => gram.id === 'balanced')!
      assert(g !== undefined)
      const res = deriveLeftmost(g, '(())')
      assert(res !== null, 'Derivation should succeed for "(())"')
      assert(res.tree !== undefined)
      assert.strictEqual(res.tree.symbol, 'S')
    })

    it('generates valid parse trees for palindromes over {0,1}', () => {
      const g = GRAMMARS.find((gram) => gram.id === 'palindromes')!
      assert(g !== undefined)
      const res = deriveLeftmost(g, '010')
      assert(res !== null, 'Derivation should succeed for "010"')
      assert(res.tree !== undefined)
      assert.strictEqual(res.tree.symbol, 'S')
    })

    it('generates parse trees for empty string ε productions', () => {
      const g = GRAMMARS.find((gram) => gram.id === 'anbn')!
      assert(g !== undefined)
      const trees = findAllParseTrees(g, '', 1)
      assert.strictEqual(trees.length, 1)
      assert.strictEqual(trees[0].symbol, 'S')
      assert.strictEqual(trees[0].children?.[0].symbol, 'ε')
    })
  })

  describe('2. Chomsky Normal Form (CNF) & CYK Parse Tree Reconstruction', () => {
    it('converts CFG to CNF and validates binary derivations', () => {
      const g = GRAMMARS.find((gram) => gram.id === 'anbn')!
      const cnfRes = convertToCnf(g)
      assert(cnfRes.finalCnfGrammar !== undefined)
      assert.strictEqual(cnfRes.validationResult.isStrictCnf, true)

      // Test string on CNF grammar using CYK
      const cykRes = runCykDetailed(cnfRes.finalCnfGrammar, '0011')
      assert.strictEqual(cykRes.accepted, true)
      assert(cykRes.reconstructedTree !== undefined)
      assert.strictEqual(cykRes.reconstructedTree.symbol, cnfRes.finalCnfGrammar.start)
      assert.strictEqual(cykRes.reconstructedTree.children?.length, 2)
    })

    it('reconstructs parse trees from CYK backpointers for {a, b} languages', () => {
      const g = GRAMMARS.find((gram) => gram.id === 'equal_ab')!
      const cykRes = runCykDetailed(g, 'ab')
      assert.strictEqual(cykRes.accepted, true)
      assert(cykRes.reconstructedTree !== undefined)
      assert.strictEqual(cykRes.reconstructedTree.symbol, cykRes.cnfGrammar.start)
    })

    it('handles rejected strings in CYK without throwing and returns undefined tree', () => {
      const g = GRAMMARS.find((gram) => gram.id === 'anbn')!
      const cykRes = runCykDetailed(g, '010')
      assert.strictEqual(cykRes.accepted, false)
      assert.strictEqual(cykRes.reconstructedTree, undefined)
    })
  })

  describe('3. Natural Language Question Routing & Initial CFG Target Strings', () => {
    it('routes equal a and b symbols questions and configures appropriate alphabet and example', () => {
      const res = parseQuestion("Construct a CFG for strings with equal numbers of a's and b's.")
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'cfg')
      assert(res.cfgProblemSpec !== undefined)

      const sol = solveCfgProblem("Construct a CFG for strings with equal numbers of a's and b's.", res.cfgProblemSpec)
      assert(sol.formalGrammar.terminals.includes('a'))
      assert(sol.formalGrammar.terminals.includes('b'))
      assert(sol.formalGrammar.examples.length > 0)

      // Verify that the first example string successfully produces a parse tree
      const firstEg = sol.formalGrammar.examples[0]
      const treeRes = deriveLeftmost(sol.formalGrammar, firstEg)
      assert(treeRes !== null, `First example string "${firstEg}" should generate a valid parse tree`)
      assert(treeRes.tree !== undefined)
    })

    it('routes CNF conversion requests and preserves target intent', () => {
      const res = parseQuestion('Convert grammar into CNF.')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'cfg')
      assert.strictEqual(res.cfgProblemSpec?.type, 'cfg_cnf_conversion')
    })

    it('routes ambiguity requests and produces dual parse trees', () => {
      const res = parseQuestion('Demonstrate ambiguity with two parse trees.')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'cfg')
      assert.strictEqual(res.cfgProblemSpec?.type, 'cfg_ambiguity_analysis')

      const sol = solveCfgProblem('Demonstrate ambiguity with two parse trees.', res.cfgProblemSpec)
      assert(sol.ambiguityResult !== undefined)
      assert.strictEqual(sol.ambiguityResult.isAmbiguous, true)
      assert(sol.ambiguityResult.witness !== undefined)
      assert(sol.ambiguityResult.witness.tree1 !== undefined)
      assert(sol.ambiguityResult.witness.tree2 !== undefined)
    })
  })

  describe('4. Parse Tree Structure and Geometric Invariants', () => {
    it('generates correct hierarchy and leaf yield for "0011"', () => {
      const g = GRAMMARS.find((gram) => gram.id === 'anbn')!
      assert(g !== undefined)
      const res = deriveLeftmost(g, '0011')
      assert(res !== null && res.tree !== undefined)

      const root = res.tree
      assert.strictEqual(root.symbol, 'S')
      assert.strictEqual(root.children?.length, 3)

      const [c0, c1, c2] = root.children!
      assert.strictEqual(c0.symbol, '0')
      assert.strictEqual(c1.symbol, 'S')
      assert.strictEqual(c2.symbol, '1')

      // Middle S
      assert.strictEqual(c1.children?.length, 3)
      const [m0, m1, m2] = c1.children!
      assert.strictEqual(m0.symbol, '0')
      assert.strictEqual(m1.symbol, 'S')
      assert.strictEqual(m2.symbol, '1')

      // Innermost S
      assert.strictEqual(m1.children?.length, 1)
      assert.strictEqual(m1.children![0].symbol, 'ε')

      // Collect leaves and verify yield
      const leaves: string[] = []
      function collectLeaves(node: typeof root) {
        if (!node.children || node.children.length === 0) {
          leaves.push(node.symbol)
        } else {
          for (const ch of node.children) collectLeaves(ch)
        }
      }
      collectLeaves(root)

      assert.deepStrictEqual(leaves, ['0', '0', 'ε', '1', '1'])
      const terminalYield = leaves.filter((s) => s !== 'ε').join('')
      assert.strictEqual(terminalYield, '0011')
    })
  })
})
