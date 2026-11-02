import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  type FormalPda,
  type PdaRule,
  validatePda,
  parsePdaFromText,
  formatPdaToText,
  formatPdaFormalTuple,
  simulatePda,
} from '../lib/pda'
import {
  convertCfgToPda,
  convertPdaToCfg,
} from '../lib/pda-transformations'
import {
  getStandardPda,
  solvePdaProblem,
  formatPdaTableMarkdown,
} from '../lib/pda-solver'
import { parseCfgFromText } from '../lib/cfg'
import { parseQuestion } from '../lib/nlp-parser'

describe('Phase 16 - Pushdown Automata (PDA) Solver', () => {
  describe('1. PDA Representation & Validation', () => {
    it('validates a mathematically well-formed 7-tuple PDA', () => {
      const pda = getStandardPda('an_bn')
      const validation = validatePda(pda)
      assert.strictEqual(validation.valid, true)
      assert.strictEqual(validation.errors.length, 0)
    })

    it('detects invalid states, alphabet mismatches, and undefined stack symbols', () => {
      const invalidPda: FormalPda = {
        id: 'bad_pda',
        name: 'Invalid PDA',
        states: ['q0', 'q1'],
        alphabet: ['0', '1'],
        stackAlphabet: ['Z0', 'X'],
        startState: 'q99', // Unknown state
        startStackSymbol: 'Y', // Unknown stack symbol
        acceptStates: ['q2'], // Unknown accept state
        acceptanceMode: 'final_state',
        rules: [
          { from: 'q0', input: '2', pop: 'Z0', to: 'q1', push: ['X'] }, // '2' not in alphabet
          { from: 'q1', input: '0', pop: 'UNKNOWN', to: 'q1', push: ['X'] }, // 'UNKNOWN' not in stack alphabet
          { from: 'q0', input: '0', pop: 'Z0', to: 'qGhost', push: ['X'] }, // 'qGhost' not in states
        ],
      }
      const validation = validatePda(invalidPda)
      assert.strictEqual(validation.valid, false)
      assert(validation.errors.some((e) => e.includes('Start state "q99"')))
      assert(validation.errors.some((e) => e.includes('Initial stack symbol "Y"')))
      assert(validation.errors.some((e) => e.includes('Accept state "q2"')))
      assert(validation.errors.some((e) => e.includes('"2"')))
      assert(validation.errors.some((e) => e.includes('"UNKNOWN"')))
      assert(validation.errors.some((e) => e.includes('"qGhost"')))
    })

    it('serializes and parses PDA text accurately', () => {
      const original = getStandardPda('balanced_parentheses')
      const text = formatPdaToText(original)
      const parsed = parsePdaFromText(text)
      assert.strictEqual(parsed.error, undefined)
      assert(parsed.pda !== undefined)
      assert.strictEqual(parsed.pda.startState, original.startState)
      assert.strictEqual(parsed.pda.startStackSymbol, original.startStackSymbol)
      assert.strictEqual(parsed.pda.rules.length, original.rules.length)
    })

    it('formats formal 7-tuple definition with KaTeX notation', () => {
      const pda = getStandardPda('an_bn')
      const formal = formatPdaFormalTuple(pda)
      assert(formal.includes('M = (Q, \\Sigma, \\Gamma, \\delta, q_0, Z_0, F)'))
      assert(formal.includes(pda.startState))
      assert(formal.includes(pda.startStackSymbol))
    })
  })

  describe('2. Canonical Language PDA Constructions & Simulation', () => {
    describe('a^n b^n (n >= 0)', () => {
      const pda = getStandardPda('an_bn')

      it('accepts valid strings with equal number of 0s and 1s', () => {
        const acceptedStrings = ['', '01', '0011', '000111', '00001111']
        for (const str of acceptedStrings) {
          const res = simulatePda(pda, str)
          assert.strictEqual(res.accepted, true, `Expected "${str}" to be accepted`)
          assert(res.path.length > 0)
        }
      })

      it('rejects strings with mismatched 0s and 1s or incorrect order', () => {
        const rejectedStrings = ['0', '1', '001', '011', '10', '0101', '00110']
        for (const str of rejectedStrings) {
          const res = simulatePda(pda, str)
          assert.strictEqual(res.accepted, false, `Expected "${str}" to be rejected`)
        }
      })
    })

    describe('Balanced Parentheses', () => {
      const pda = getStandardPda('balanced_parentheses')

      it('accepts well-formed parentheses strings', () => {
        const valid = ['', '()', '(())', '()()', '((()))', '(()())', '((())())']
        for (const str of valid) {
          const res = simulatePda(pda, str)
          assert.strictEqual(res.accepted, true, `Expected "${str}" to be accepted`)
        }
      })

      it('rejects unbalanced or malformed parentheses', () => {
        const invalid = ['(', ')', ')(', '(()', '())', '(()))', '())(()']
        for (const str of invalid) {
          const res = simulatePda(pda, str)
          assert.strictEqual(res.accepted, false, `Expected "${str}" to be rejected`)
        }
      })
    })

    describe('Palindromes (w = w^R)', () => {
      const pda = getStandardPda('palindromes')

      it('accepts both even- and odd-length palindromes over {0,1}', () => {
        const palindromes = ['', '0', '1', '00', '11', '010', '101', '0110', '1001', '01010', '110011']
        for (const str of palindromes) {
          const res = simulatePda(pda, str)
          assert.strictEqual(res.accepted, true, `Expected palindrome "${str}" to be accepted`)
        }
      })

      it('rejects non-palindromic binary strings', () => {
        const nonPalindromes = ['01', '10', '001', '011', '100', '0111', '1010']
        for (const str of nonPalindromes) {
          const res = simulatePda(pda, str)
          assert.strictEqual(res.accepted, false, `Expected non-palindrome "${str}" to be rejected`)
        }
      })
    })

    describe('Equal Numbers of 0s and 1s', () => {
      const pda = getStandardPda('equal_zeros_ones')

      it('accepts strings with equal count of 0s and 1s regardless of order', () => {
        const equalStrings = ['', '01', '10', '0011', '1100', '0101', '1010', '0110', '1001', '001101']
        for (const str of equalStrings) {
          const res = simulatePda(pda, str)
          assert.strictEqual(res.accepted, true, `Expected "${str}" with equal 0s and 1s to be accepted`)
        }
      })

      it('rejects strings with unequal count of 0s and 1s', () => {
        const unequalStrings = ['0', '1', '001', '011', '0001', '1101', '01111']
        for (const str of unequalStrings) {
          const res = simulatePda(pda, str)
          assert.strictEqual(res.accepted, false, `Expected "${str}" to be rejected`)
        }
      })
    })
  })

  describe('3. Acceptance Modes (Final State vs. Empty Stack)', () => {
    it('supports acceptance by empty stack', () => {
      // PDA that accepts by emptying the stack:
      // Reads 'a', pushes A; reads 'b', pops A; on end of input, pops Z0 and terminates with empty stack
      const emptyStackPda: FormalPda = {
        id: 'pda_empty_stack_demo',
        name: 'Empty Stack Acceptance Demo',
        states: ['q0', 'q1'],
        alphabet: ['a', 'b'],
        stackAlphabet: ['Z0', 'A'],
        startState: 'q0',
        startStackSymbol: 'Z0',
        acceptStates: [], // No final states needed!
        acceptanceMode: 'empty_stack',
        rules: [
          { from: 'q0', input: 'a', pop: 'Z0', to: 'q0', push: ['A', 'Z0'] },
          { from: 'q0', input: 'a', pop: 'A', to: 'q0', push: ['A', 'A'] },
          { from: 'q0', input: 'b', pop: 'A', to: 'q1', push: [] },
          { from: 'q1', input: 'b', pop: 'A', to: 'q1', push: [] },
          { from: 'q1', input: 'ε', pop: 'Z0', to: 'q1', push: [] }, // Clears Z0 at end
        ],
      }

      const resAccepted = simulatePda(emptyStackPda, 'ab')
      assert.strictEqual(resAccepted.accepted, true)
      assert(resAccepted.acceptanceReason.includes('stack emptied'))

      const resRejected = simulatePda(emptyStackPda, 'a')
      assert.strictEqual(resRejected.accepted, false)
    })
  })

  describe('4. Infinite Loop & Epsilon-Cycle Protection', () => {
    it('terminates safely without hanging when an infinite epsilon loop exists', () => {
      // PDA with an unconditional epsilon loop: q0 -ε, Z0->Z0-> q0
      const loopPda: FormalPda = {
        id: 'infinite_loop_pda',
        name: 'Infinite Epsilon Loop PDA',
        states: ['q0', 'qacc'],
        alphabet: ['0', '1'],
        stackAlphabet: ['Z0'],
        startState: 'q0',
        startStackSymbol: 'Z0',
        acceptStates: ['qacc'],
        acceptanceMode: 'final_state',
        rules: [
          { from: 'q0', input: 'ε', pop: 'Z0', to: 'q0', push: ['Z0'], description: 'Epsilon self-loop' },
        ],
      }

      // Should terminate boundedly and return rejection
      const res = simulatePda(loopPda, '0')
      assert.strictEqual(res.accepted, false)
      assert(res.totalConfigurationsExplored < 850)
    })
  })

  describe('5. CFG to PDA Conversion', () => {
    it('converts a CFG into an equivalent PDA using top-down expansion', () => {
      const cfg = parseCfgFromText(`
        S -> 0 S 1 | ε
      `).grammar

      assert(cfg !== undefined)
      const conversion = convertCfgToPda(cfg)
      assert.strictEqual(conversion.pda.startState, 'q_start')
      assert(conversion.pda.states.includes('q_loop'))
      assert(conversion.pda.states.includes('q_accept'))

      // Validate converted PDA
      const validation = validatePda(conversion.pda)
      assert.strictEqual(validation.valid, true)

      // Test simulation of converted PDA on 0^n 1^n
      const res0011 = simulatePda(conversion.pda, '0011')
      assert.strictEqual(res0011.accepted, true, 'Converted PDA should accept 0011')

      const resEmpty = simulatePda(conversion.pda, '')
      assert.strictEqual(resEmpty.accepted, true, 'Converted PDA should accept ε')

      const res001 = simulatePda(conversion.pda, '001')
      assert.strictEqual(res001.accepted, false, 'Converted PDA should reject 001')
    })

    it('explains the conversion steps clearly', () => {
      const cfg = parseCfgFromText(`S -> a S b | a b`).grammar!
      const conversion = convertCfgToPda(cfg)
      assert(conversion.stepExplanations.length >= 3)
      assert(conversion.productionMappings.length > 0)
      assert(conversion.terminalMappings.length > 0)
    })
  })

  describe('6. PDA to CFG Conversion', () => {
    it('converts a supported PDA to a CFG via state-pair triple construction', () => {
      const pda: FormalPda = {
        id: 'small_pda',
        name: 'Simple Stack PDA',
        states: ['q0', 'q1'],
        alphabet: ['a', 'b'],
        stackAlphabet: ['Z0', 'X'],
        startState: 'q0',
        startStackSymbol: 'Z0',
        acceptStates: ['q1'],
        acceptanceMode: 'final_state',
        rules: [
          { from: 'q0', input: 'a', pop: 'Z0', to: 'q0', push: ['X', 'Z0'] },
          { from: 'q0', input: 'b', pop: 'X', to: 'q1', push: [] },
          { from: 'q1', input: 'ε', pop: 'Z0', to: 'q1', push: [] },
        ],
      }

      const conversion = convertPdaToCfg(pda)
      assert(conversion.grammar.variables.length > 0)
      assert(Object.keys(conversion.grammar.rules).length > 0)
      assert.strictEqual(conversion.grammar.start, 'S')
      assert(conversion.triples.length > 0)
    })
  })

  describe('7. PDA Solver Solution Generation', () => {
    it('produces educational solution object with formal definitions, state invariants, and proofs', () => {
      const solution = solvePdaProblem('Construct a PDA for a^n b^n', {
        type: 'pda_from_language',
        languagePattern: 'an_bn',
        alphabet: ['0', '1'],
      })

      assert(solution.formalPda !== undefined)
      assert(solution.formalDefinitionMarkdown.includes('M = (Q, \\Sigma'))
      assert(solution.stateInvariants.length > 0)
      assert(solution.stepByStepConstruction.length > 0)
      assert(solution.mathematicalProof.includes('Correctness Invariant'))
      assert(solution.complexityAnalysis.timeComplexity.length > 0)
      assert(solution.testResults.length > 0)
    })

    it('generates formatted Markdown transition table', () => {
      const pda = getStandardPda('an_bn')
      const table = formatPdaTableMarkdown(pda)
      assert(table.includes('From State'))
      assert(table.includes('Stack Top Pop'))
      assert(table.includes('q0'))
      assert(table.includes('qacc'))
    })
  })

  describe('8. Natural Language Parser Routing', () => {
    it('routes a^n b^n PDA requests to pda domain', () => {
      const res = parseQuestion('Construct a PDA for a^n b^n')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'pda')
      assert.strictEqual(res.pdaProblemSpec?.type, 'pda_from_language')
      assert.strictEqual(res.pdaProblemSpec?.languagePattern, 'an_bn')
    })

    it('routes balanced parentheses PDA requests to pda domain', () => {
      const res = parseQuestion('Construct a PDA for balanced parentheses')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'pda')
      assert.strictEqual(res.pdaProblemSpec?.type, 'pda_from_language')
      assert.strictEqual(res.pdaProblemSpec?.languagePattern, 'balanced_parentheses')
    })

    it('routes palindrome PDA requests to pda domain', () => {
      const res = parseQuestion('Construct a PDA for palindromes over {0,1}')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'pda')
      assert.strictEqual(res.pdaProblemSpec?.type, 'pda_from_language')
      assert.strictEqual(res.pdaProblemSpec?.languagePattern, 'palindromes')
    })

    it('routes equal 0s and 1s PDA requests to pda domain', () => {
      const res = parseQuestion('Construct a PDA for strings containing equal numbers of 0s and 1s')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'pda')
      assert.strictEqual(res.pdaProblemSpec?.type, 'pda_from_language')
      assert.strictEqual(res.pdaProblemSpec?.languagePattern, 'equal_zeros_ones')
    })

    it('routes conversion requests between CFG and PDA', () => {
      const resCfgToPda = parseQuestion('Convert CFG to PDA')
      assert.strictEqual(resCfgToPda.success, true)
      assert.strictEqual(resCfgToPda.targetDomain, 'pda')
      assert.strictEqual(resCfgToPda.pdaProblemSpec?.type, 'cfg_to_pda')

      const resPdaToCfg = parseQuestion('Convert PDA to CFG')
      assert.strictEqual(resPdaToCfg.success, true)
      assert.strictEqual(resPdaToCfg.targetDomain, 'pda')
      assert.strictEqual(resPdaToCfg.pdaProblemSpec?.type, 'pda_to_cfg')
    })

    it('routes PDA simulation requests', () => {
      const res = parseQuestion('Simulate PDA on string "0011"')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'pda')
      assert.strictEqual(res.pdaProblemSpec?.type, 'pda_simulation')
      assert.strictEqual(res.pdaProblemSpec?.targetString, '0011')
    })

    it('requests clarification for vague PDA requests', () => {
      const res = parseQuestion('Construct a PDA')
      assert.strictEqual(res.success, false)
      assert.strictEqual(res.targetDomain, 'pda')
      assert.strictEqual(res.needsClarification, true)
      assert(res.clarificationOptions && res.clarificationOptions.length >= 4)
    })

    it('does not interfere with existing DFA / NFA / CFG requests', () => {
      const dfaRes = parseQuestion('Construct a DFA that accepts strings ending with 01.')
      assert.strictEqual(dfaRes.success, true)
      assert.notStrictEqual(dfaRes.targetDomain, 'pda')

      const cfgRes = parseQuestion('Construct a CFG for palindromes over {0,1}.')
      assert.strictEqual(cfgRes.success, true)
      assert.strictEqual(cfgRes.targetDomain, 'cfg')
    })
  })
})
