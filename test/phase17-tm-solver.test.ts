import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  type FormalTuringMachine,
  type FormalTMTransition,
  validateTuringMachine,
  parseTMFromText,
  formatTMToText,
  formatTMFormalTuple,
  formatInstantaneousDescription,
  simulateTuringMachine,
  BLANK,
} from '../lib/turing'
import {
  type MultiTapeTuringMachine,
  validateMultiTapeTM,
  simulateMultiTapeTM,
  get2TapePalindromeTM,
} from '../lib/turing-multitape'
import {
  getStandardTuringMachine,
  solveTuringProblem,
  formatTMTableMarkdown,
} from '../lib/turing-solver'
import { parseQuestion } from '../lib/nlp-parser'

describe('Phase 17 - Turing Machine (TM) Solver', () => {
  describe('1. TM Formal 7-Tuple Representation & Validation', () => {
    it('validates a mathematically well-formed 7-tuple Turing machine', () => {
      const tm = getStandardTuringMachine('an_bn_cn')
      const validation = validateTuringMachine(tm)
      assert.strictEqual(validation.valid, true)
      assert.strictEqual(validation.errors.length, 0)
    })

    it('detects missing start state, alphabet defects, and invalid transition targets', () => {
      const invalidTm: FormalTuringMachine = {
        id: 'bad_tm',
        name: 'Invalid TM',
        description: 'Test invalid TM',
        states: ['q0', 'q1'],
        inputAlphabet: ['0', '_'], // Blank in input alphabet!
        tapeAlphabet: ['0'], // Blank missing from tape alphabet!
        transitions: [
          { fromState: 'q0', readSymbol: '0', toState: 'q99', writeSymbol: '0', move: 'R' }, // Unknown toState
          { fromState: 'q0', readSymbol: 'UNKNOWN', toState: 'q1', writeSymbol: '0', move: 'R' }, // Unknown readSymbol
          { fromState: 'q1', readSymbol: '0', toState: 'q0', writeSymbol: '0', move: 'X' as any }, // Invalid direction
        ],
        startState: 'qGhost', // Start state not in Q
        blankSymbol: '_',
        acceptStates: ['qGhostAcc'], // Accept state not in Q
        rejectStates: ['q0'],
      }

      const validation = validateTuringMachine(invalidTm)
      assert.strictEqual(validation.valid, false)
      assert(validation.errors.some((e) => e.includes('qGhost')))
      assert(validation.errors.some((e) => e.includes('Blank symbol "_" cannot belong to input alphabet')))
      assert(validation.errors.some((e) => e.includes('Blank symbol "_" must belong to tape alphabet')))
      assert(validation.errors.some((e) => e.includes('qGhostAcc')))
      assert(validation.errors.some((e) => e.includes('q99')))
      assert(validation.errors.some((e) => e.includes('UNKNOWN')))
      assert(validation.errors.some((e) => e.includes('direction "X"')))
    })

    it('serializes and parses TM transition text accurately', () => {
      const original = getStandardTuringMachine('an_bn')
      const text = formatTMToText(original)
      const parsed = parseTMFromText(text)
      assert.strictEqual(parsed.error, undefined)
      assert(parsed.tm !== undefined)
      assert.strictEqual(parsed.tm.startState, original.startState)
      assert.strictEqual(parsed.tm.transitions.length, original.transitions.length)
    })

    it('formats formal 7-tuple definition with KaTeX notation', () => {
      const tm = getStandardTuringMachine('an_bn_cn')
      const formal = formatTMFormalTuple(tm)
      assert(formal.includes('M = (Q, \\Sigma, \\Gamma, \\delta, q_0, B, F)'))
      assert(formal.includes(tm.startState))
      assert(formal.includes(tm.blankSymbol))
      assert(formal.includes('qacc'))
    })

    it('formats instantaneous descriptions (u [q] v) correctly', () => {
      const tape = ['X', 'a', 'Y', 'b', 'c']
      const id = formatInstantaneousDescription(tape, 2, 'q1')
      assert.strictEqual(id, 'Xa[q1]Ybc')
    })
  })

  describe('2. Tape Operations, Movements, & Infinite Expansion', () => {
    it('handles rightward tape expansion when moving past initial input length', () => {
      // Machine that writes 1s while moving right 4 times
      const expandRightTM: FormalTuringMachine = {
        id: 'expand_r',
        name: 'Right Expansion TM',
        description: 'Moves right into blanks',
        states: ['q0', 'q1', 'q2', 'q3', 'qacc', 'qreject'],
        inputAlphabet: ['0'],
        tapeAlphabet: ['0', '1', BLANK],
        startState: 'q0',
        blankSymbol: BLANK,
        acceptStates: ['qacc'],
        rejectStates: ['qreject'],
        transitions: [
          { fromState: 'q0', readSymbol: '0', toState: 'q1', writeSymbol: '1', move: 'R' },
          { fromState: 'q1', readSymbol: BLANK, toState: 'q2', writeSymbol: '1', move: 'R' },
          { fromState: 'q2', readSymbol: BLANK, toState: 'q3', writeSymbol: '1', move: 'R' },
          { fromState: 'q3', readSymbol: BLANK, toState: 'qacc', writeSymbol: '1', move: 'S' },
        ],
      }

      const res = simulateTuringMachine(expandRightTM, '0')
      assert.strictEqual(res.accepted, true)
      assert.strictEqual(res.finalTape.join(''), '1111')
      assert.strictEqual(res.finalHead, 3)
    })

    it('handles leftward tape expansion without negative index crashes', () => {
      // Machine that moves left from cell 0, prepending blanks
      const expandLeftTM: FormalTuringMachine = {
        id: 'expand_l',
        name: 'Left Expansion TM',
        description: 'Moves left into blanks',
        states: ['q0', 'q1', 'qacc', 'qreject'],
        inputAlphabet: ['0'],
        tapeAlphabet: ['0', 'X', BLANK],
        startState: 'q0',
        blankSymbol: BLANK,
        acceptStates: ['qacc'],
        rejectStates: ['qreject'],
        transitions: [
          { fromState: 'q0', readSymbol: '0', toState: 'q1', writeSymbol: '0', move: 'L' },
          { fromState: 'q1', readSymbol: BLANK, toState: 'qacc', writeSymbol: 'X', move: 'S' },
        ],
      }

      const res = simulateTuringMachine(expandLeftTM, '0')
      assert.strictEqual(res.accepted, true)
      assert.strictEqual(res.finalHead, 0)
      assert.strictEqual(res.finalTape[0], 'X')
      assert.strictEqual(res.finalTape[1], '0')
    })
  })

  describe('3. Termination & Infinite Loop Protection (Inconclusive Result)', () => {
    it('produces INCONCLUSIVE (not false rejection) when step limit is reached', () => {
      // Infinite loop machine: q0, 0 -> q0, 0, R; q0, _ -> q0, _, R
      const infiniteTM: FormalTuringMachine = {
        id: 'inf_tm',
        name: 'Infinite Loop TM',
        description: 'Runs forever',
        states: ['q0', 'qacc', 'qreject'],
        inputAlphabet: ['0'],
        tapeAlphabet: ['0', BLANK],
        startState: 'q0',
        blankSymbol: BLANK,
        acceptStates: ['qacc'],
        rejectStates: ['qreject'],
        transitions: [
          { fromState: 'q0', readSymbol: '0', toState: 'q0', writeSymbol: '0', move: 'R' },
          { fromState: 'q0', readSymbol: BLANK, toState: 'q0', writeSymbol: BLANK, move: 'R' },
        ],
      }

      const res = simulateTuringMachine(infiniteTM, '0', 25)
      assert.strictEqual(res.inconclusive, true)
      assert.strictEqual(res.accepted, false)
      assert.strictEqual(res.rejected, false, 'Must NOT be falsely marked as rejected!')
      assert(res.statusReason.includes('inconclusive'))
      assert.strictEqual(res.totalSteps, 25)
    })
  })

  describe('4. Canonical Language Turing Machines', () => {
    describe('a^n b^n c^n (n >= 0)', () => {
      const tm = getStandardTuringMachine('an_bn_cn')

      it('accepts valid strings with equal number of a, b, and c in order', () => {
        const accepted = ['', 'abc', 'aabbcc', 'aaabbbccc']
        for (const str of accepted) {
          const res = simulateTuringMachine(tm, str)
          assert.strictEqual(res.accepted, true, `Expected "${str}" to be accepted`)
          assert.strictEqual(res.rejected, false)
        }
      })

      it('rejects strings with unequal counts or out-of-order symbols', () => {
        const rejected = ['ab', 'bc', 'ac', 'aabbc', 'aabcc', 'ba', 'cba', 'aabbccdd']
        for (const str of rejected) {
          const res = simulateTuringMachine(tm, str)
          assert.strictEqual(res.rejected, true, `Expected "${str}" to be rejected`)
          assert.strictEqual(res.accepted, false)
        }
      })
    })

    describe('Palindromes over {0,1}', () => {
      const tm = getStandardTuringMachine('palindromes')

      it('accepts even and odd palindromes over {0,1}', () => {
        const palindromes = ['', '0', '1', '00', '11', '010', '101', '0110', '1001', '01010', '110011']
        for (const str of palindromes) {
          const res = simulateTuringMachine(tm, str)
          assert.strictEqual(res.accepted, true, `Expected palindrome "${str}" to be accepted`)
        }
      })

      it('rejects non-palindromic binary strings', () => {
        const nonPalindromes = ['01', '10', '001', '011', '100', '0111', '1010']
        for (const str of nonPalindromes) {
          const res = simulateTuringMachine(tm, str)
          assert.strictEqual(res.rejected, true, `Expected non-palindrome "${str}" to be rejected`)
        }
      })
    })

    describe('Equal Numbers of 0s and 1s', () => {
      const tm = getStandardTuringMachine('equal_zeros_ones')

      it('accepts strings containing equal counts of 0s and 1s in any order', () => {
        const valid = ['', '01', '10', '0011', '1100', '0101', '1010', '0110', '1001']
        for (const str of valid) {
          const res = simulateTuringMachine(tm, str)
          assert.strictEqual(res.accepted, true, `Expected "${str}" with equal 0s and 1s to be accepted`)
        }
      })

      it('rejects strings with unequal counts of 0s and 1s', () => {
        const invalid = ['0', '1', '001', '011', '0001', '1101', '01111']
        for (const str of invalid) {
          const res = simulateTuringMachine(tm, str)
          assert.strictEqual(res.rejected, true, `Expected "${str}" to be rejected`)
        }
      })
    })

    describe('0^n 1^n (n >= 0)', () => {
      const tm = getStandardTuringMachine('an_bn')

      it('accepts valid 0^n 1^n strings', () => {
        const valid = ['', '01', '0011', '000111']
        for (const str of valid) {
          const res = simulateTuringMachine(tm, str)
          assert.strictEqual(res.accepted, true, `Expected "${str}" to be accepted`)
        }
      })

      it('rejects strings not of the form 0^n 1^n', () => {
        const invalid = ['0', '1', '001', '011', '10', '0101']
        for (const str of invalid) {
          const res = simulateTuringMachine(tm, str)
          assert.strictEqual(res.rejected, true, `Expected "${str}" to be rejected`)
        }
      })
    })

    describe('Unary Addition (1^m 0 1^n -> 1^(m+n))', () => {
      const tm = getStandardTuringMachine('unary_addition')

      it('correctly computes unary sum for 2 + 3 = 5', () => {
        const res = simulateTuringMachine(tm, '110111')
        assert.strictEqual(res.accepted, true)
        const nonBlank = res.finalTape.filter((s) => s === '1').join('')
        assert.strictEqual(nonBlank, '11111')
      })

      it('correctly computes unary sum for 1 + 1 = 2', () => {
        const res = simulateTuringMachine(tm, '101')
        assert.strictEqual(res.accepted, true)
        const nonBlank = res.finalTape.filter((s) => s === '1').join('')
        assert.strictEqual(nonBlank, '11')
      })

      it('correctly computes unary sum for 3 + 1 = 4', () => {
        const res = simulateTuringMachine(tm, '11101')
        assert.strictEqual(res.accepted, true)
        const nonBlank = res.finalTape.filter((s) => s === '1').join('')
        assert.strictEqual(nonBlank, '1111')
      })
    })

    describe('Binary Divisibility by 3', () => {
      const tm = getStandardTuringMachine('binary_divisibility', ['0', '1'], 3)

      it('accepts binary numbers divisible by 3', () => {
        const divisible = ['0', '11', '110', '1001', '1100']
        for (const str of divisible) {
          const res = simulateTuringMachine(tm, str)
          assert.strictEqual(res.accepted, true, `Expected "${str}" to be accepted`)
        }
      })

      it('rejects binary numbers not divisible by 3', () => {
        const notDivisible = ['1', '10', '100', '101', '111']
        for (const str of notDivisible) {
          const res = simulateTuringMachine(tm, str)
          assert.strictEqual(res.rejected, true, `Expected "${str}" to be rejected`)
        }
      })
    })
  })

  describe('5. Multi-Tape Turing Machines', () => {
    it('validates 2-tape Turing machine structure', () => {
      const multiTm = get2TapePalindromeTM()
      const validation = validateMultiTapeTM(multiTm)
      assert.strictEqual(validation.valid, true)
      assert.strictEqual(validation.errors.length, 0)
    })

    it('decides palindromes in linear time with 2 tapes', () => {
      const multiTm = get2TapePalindromeTM()

      // Accepts valid palindromes
      const accepted = ['0110', '1001', '010', '1', '']
      for (const str of accepted) {
        const res = simulateMultiTapeTM(multiTm, str)
        assert.strictEqual(res.accepted, true, `Multi-tape expected to accept "${str}"`)
        assert.strictEqual(res.rejected, false)
      }

      // Rejects non-palindromes
      const rejected = ['01', '10', '0111', '1000']
      for (const str of rejected) {
        const res = simulateMultiTapeTM(multiTm, str)
        assert.strictEqual(res.rejected, true, `Multi-tape expected to reject "${str}"`)
        assert.strictEqual(res.accepted, false)
      }
    })
  })

  describe('6. Pedagogical Solution Object & Table Generation', () => {
    it('generates complete solution with state meanings and complexity comparison', () => {
      const sol = solveTuringProblem('Construct a TM for a^n b^n c^n', {
        type: 'tm_from_language',
        languagePattern: 'an_bn_cn',
        alphabet: ['a', 'b', 'c'],
        targetString: 'aabbcc',
      })

      assert(sol.formalTm !== undefined)
      assert(sol.formalDefinitionMarkdown.includes('M = (Q, \\Sigma'))
      assert(sol.stateInvariants.length > 0)
      assert(sol.stepByStepConstruction.length > 0)
      assert(sol.mathematicalProof.includes('Correctness Invariant'))
      assert(sol.complexityAnalysis.timeComplexity.includes('O(n²)'))
      assert(sol.complexityAnalysis.multiTapeComparison.length > 0)
      assert(sol.testResults.length > 0)
    })

    it('generates formatted Markdown transition table', () => {
      const tm = getStandardTuringMachine('an_bn_cn')
      const table = formatTMTableMarkdown(tm)
      assert(table.includes('Current State'))
      assert(table.includes('Read Symbol'))
      assert(table.includes('q0'))
      assert(table.includes('qacc'))
    })
  })

  describe('7. Natural Language Parser Routing', () => {
    it('routes a^n b^n c^n requests to tm domain', () => {
      const res = parseQuestion('Construct a TM that accepts a^n b^n c^n')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'tm')
      assert.strictEqual(res.tmProblemSpec?.languagePattern, 'an_bn_cn')
    })

    it('routes palindrome TM requests to tm domain', () => {
      const res = parseQuestion('Construct a TM for palindromes over {0,1}')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'tm')
      assert.strictEqual(res.tmProblemSpec?.languagePattern, 'palindromes')
    })

    it('routes equal 0s and 1s TM requests to tm domain', () => {
      const res = parseQuestion('Construct a TM that accepts strings containing equal numbers of 0s and 1s')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'tm')
      assert.strictEqual(res.tmProblemSpec?.languagePattern, 'equal_zeros_ones')
    })

    it('routes unary addition requests to tm domain', () => {
      const res = parseQuestion('Construct a TM that performs unary addition')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'tm')
      assert.strictEqual(res.tmProblemSpec?.languagePattern, 'unary_addition')
    })

    it('routes binary divisibility requests to tm domain', () => {
      const res = parseQuestion('Construct a TM for binary divisibility by 3')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'tm')
      assert.strictEqual(res.tmProblemSpec?.languagePattern, 'binary_divisibility')
      assert.strictEqual(res.tmProblemSpec?.divisor, 3)
    })

    it('routes multi-tape TM requests to tm domain with isMultiTape flag', () => {
      const res = parseQuestion('Construct a multi-tape Turing machine for palindromes')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'tm')
      assert.strictEqual(res.tmProblemSpec?.isMultiTape, true)
    })

    it('requests clarification for vague TM requests', () => {
      const res = parseQuestion('Construct a TM')
      assert.strictEqual(res.success, false)
      assert.strictEqual(res.targetDomain, 'tm')
      assert.strictEqual(res.needsClarification, true)
      assert(res.clarificationOptions && res.clarificationOptions.length >= 4)
    })

    it('preserves existing DFA, NFA, CFG, and PDA routing without conflict', () => {
      const dfaRes = parseQuestion('Construct a DFA that accepts strings ending with 01.')
      assert.strictEqual(dfaRes.success, true)
      assert.notStrictEqual(dfaRes.targetDomain, 'tm')

      const cfgRes = parseQuestion('Construct a CFG for palindromes over {0,1}.')
      assert.strictEqual(cfgRes.success, true)
      assert.strictEqual(cfgRes.targetDomain, 'cfg')

      const pdaRes = parseQuestion('Construct a PDA for a^n b^n.')
      assert.strictEqual(pdaRes.success, true)
      assert.strictEqual(pdaRes.targetDomain, 'pda')
    })
  })
})

