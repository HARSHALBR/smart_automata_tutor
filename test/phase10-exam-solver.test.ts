import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  buildDfaSymbolCountExact,
  buildDfaLengthAtMost,
  buildDfaEveryXFollowedByY,
  buildDfaDecimalDivisibleBy,
  buildDfaSubstringCountAtLeast,
  solveProblem,
  getFormalLanguageDefinition,
  getComplexityNotes,
} from '../lib/automata-solver'
import { parseQuestion } from '../lib/nlp-parser'
import { runAutomatonDetailed, completeDfaWithSink } from '../lib/automata'
import { verifyAgainstReference } from '../lib/automata-editor'

function isAccepted(auto: any, input: string): boolean {
  return runAutomatonDetailed(auto, input).accepted
}

describe('Phase 10: Exam-Ready Computation Theory Solver', () => {
  /* -------------------------------------------------------------------------- */
  /*                       1. New Deterministic Constructors                    */
  /* -------------------------------------------------------------------------- */

  describe('buildDfaSymbolCountExact', () => {
    it('accepts strings with exactly 2 ones over {0,1}', () => {
      const { automaton } = buildDfaSymbolCountExact(['0', '1'], '1', 2)

      // Accepted strings
      assert.strictEqual(isAccepted(automaton, '11'), true)
      assert.strictEqual(isAccepted(automaton, '011'), true)
      assert.strictEqual(isAccepted(automaton, '101'), true)
      assert.strictEqual(isAccepted(automaton, '110'), true)
      assert.strictEqual(isAccepted(automaton, '01010'), true)
      assert.strictEqual(isAccepted(automaton, '00010001000'), true)

      // Rejected strings
      assert.strictEqual(isAccepted(automaton, ''), false)
      assert.strictEqual(isAccepted(automaton, '1'), false)
      assert.strictEqual(isAccepted(automaton, '0'), false)
      assert.strictEqual(isAccepted(automaton, '000'), false)
      assert.strictEqual(isAccepted(automaton, '111'), false)
      assert.strictEqual(isAccepted(automaton, '1111'), false)
      assert.strictEqual(isAccepted(automaton, '0101010'), false)
    })

    it('handles edge case k = 0 (zero occurrences)', () => {
      const { automaton } = buildDfaSymbolCountExact(['0', '1'], '1', 0)
      assert.strictEqual(isAccepted(automaton, ''), true)
      assert.strictEqual(isAccepted(automaton, '0'), true)
      assert.strictEqual(isAccepted(automaton, '000'), true)
      assert.strictEqual(isAccepted(automaton, '1'), false)
      assert.strictEqual(isAccepted(automaton, '010'), false)
    })
  })

  describe('buildDfaLengthAtMost', () => {
    it('accepts strings of length at most 2 over {0,1}', () => {
      const { automaton } = buildDfaLengthAtMost(['0', '1'], 2)

      // Accepted: lengths 0, 1, 2
      assert.strictEqual(isAccepted(automaton, ''), true)
      assert.strictEqual(isAccepted(automaton, '0'), true)
      assert.strictEqual(isAccepted(automaton, '1'), true)
      assert.strictEqual(isAccepted(automaton, '00'), true)
      assert.strictEqual(isAccepted(automaton, '01'), true)
      assert.strictEqual(isAccepted(automaton, '10'), true)
      assert.strictEqual(isAccepted(automaton, '11'), true)

      // Rejected: length > 2
      assert.strictEqual(isAccepted(automaton, '000'), false)
      assert.strictEqual(isAccepted(automaton, '101'), false)
      assert.strictEqual(isAccepted(automaton, '1111'), false)
    })

    it('handles edge case k = 0 (length at most 0: {ε})', () => {
      const { automaton } = buildDfaLengthAtMost(['0', '1'], 0)
      assert.strictEqual(isAccepted(automaton, ''), true)
      assert.strictEqual(isAccepted(automaton, '0'), false)
      assert.strictEqual(isAccepted(automaton, '1'), false)
    })
  })

  describe('buildDfaEveryXFollowedByY', () => {
    it('accepts strings where every 0 is immediately followed by 1', () => {
      const { automaton } = buildDfaEveryXFollowedByY(['0', '1'], '0', '1')

      // Accepted strings
      assert.strictEqual(isAccepted(automaton, ''), true) // vacuously true
      assert.strictEqual(isAccepted(automaton, '1'), true)
      assert.strictEqual(isAccepted(automaton, '111'), true)
      assert.strictEqual(isAccepted(automaton, '01'), true)
      assert.strictEqual(isAccepted(automaton, '101'), true)
      assert.strictEqual(isAccepted(automaton, '0101'), true)
      assert.strictEqual(isAccepted(automaton, '101101'), true)
      assert.strictEqual(isAccepted(automaton, '1110111'), true)

      // Rejected strings
      assert.strictEqual(isAccepted(automaton, '0'), false) // ends with 0
      assert.strictEqual(isAccepted(automaton, '00'), false) // consecutive 0s
      assert.strictEqual(isAccepted(automaton, '010'), false)
      assert.strictEqual(isAccepted(automaton, '10'), false)
      assert.strictEqual(isAccepted(automaton, '1001'), false)
      assert.strictEqual(isAccepted(automaton, '01001'), false)
    })

    it('handles degenerate case x = y correctly', () => {
      // If every 0 must be followed by 0, no finite string can contain 0!
      const { automaton } = buildDfaEveryXFollowedByY(['0', '1'], '0', '0')
      assert.strictEqual(isAccepted(automaton, ''), true)
      assert.strictEqual(isAccepted(automaton, '1'), true)
      assert.strictEqual(isAccepted(automaton, '111'), true)
      assert.strictEqual(isAccepted(automaton, '0'), false)
      assert.strictEqual(isAccepted(automaton, '00'), false)
    })
  })

  describe('buildDfaDecimalDivisibleBy', () => {
    it('accepts decimal numbers divisible by 3 (Horner rule base 10)', () => {
      const { automaton } = buildDfaDecimalDivisibleBy(3)

      // Divisible by 3
      assert.strictEqual(isAccepted(automaton, ''), true) // 0
      assert.strictEqual(isAccepted(automaton, '0'), true)
      assert.strictEqual(isAccepted(automaton, '3'), true)
      assert.strictEqual(isAccepted(automaton, '6'), true)
      assert.strictEqual(isAccepted(automaton, '9'), true)
      assert.strictEqual(isAccepted(automaton, '12'), true)
      assert.strictEqual(isAccepted(automaton, '15'), true)
      assert.strictEqual(isAccepted(automaton, '99'), true)
      assert.strictEqual(isAccepted(automaton, '300'), true)
      assert.strictEqual(isAccepted(automaton, '12345'), true) // sum=15 -> div 3

      // Not divisible by 3
      assert.strictEqual(isAccepted(automaton, '1'), false)
      assert.strictEqual(isAccepted(automaton, '2'), false)
      assert.strictEqual(isAccepted(automaton, '4'), false)
      assert.strictEqual(isAccepted(automaton, '5'), false)
      assert.strictEqual(isAccepted(automaton, '7'), false)
      assert.strictEqual(isAccepted(automaton, '8'), false)
      assert.strictEqual(isAccepted(automaton, '10'), false)
      assert.strictEqual(isAccepted(automaton, '100'), false)
    })

    it('accepts decimal numbers divisible by 5', () => {
      const { automaton } = buildDfaDecimalDivisibleBy(5)
      assert.strictEqual(isAccepted(automaton, '0'), true)
      assert.strictEqual(isAccepted(automaton, '5'), true)
      assert.strictEqual(isAccepted(automaton, '10'), true)
      assert.strictEqual(isAccepted(automaton, '125'), true)
      assert.strictEqual(isAccepted(automaton, '1005'), true)

      assert.strictEqual(isAccepted(automaton, '1'), false)
      assert.strictEqual(isAccepted(automaton, '12'), false)
      assert.strictEqual(isAccepted(automaton, '99'), false)
    })
  })

  describe('buildDfaSubstringCountAtLeast', () => {
    it('accepts strings containing "01" at least 2 times', () => {
      const { automaton } = buildDfaSubstringCountAtLeast(['0', '1'], '01', 2)

      assert.strictEqual(isAccepted(automaton, '0101'), true)
      assert.strictEqual(isAccepted(automaton, '01101'), true)
      assert.strictEqual(isAccepted(automaton, '001001'), true)
      assert.strictEqual(isAccepted(automaton, '010101'), true)
      assert.strictEqual(isAccepted(automaton, '11101000100'), true)

      assert.strictEqual(isAccepted(automaton, ''), false)
      assert.strictEqual(isAccepted(automaton, '01'), false) // only 1 occurrence
      assert.strictEqual(isAccepted(automaton, '001'), false)
      assert.strictEqual(isAccepted(automaton, '1010'), false)
      assert.strictEqual(isAccepted(automaton, '0000'), false)
    })

    it('correctly counts overlapping occurrences: "101" at least 2 times', () => {
      const { automaton } = buildDfaSubstringCountAtLeast(['0', '1'], '101', 2)

      // In "10101", "101" occurs at index 0 and index 2
      assert.strictEqual(isAccepted(automaton, '10101'), true)
      assert.strictEqual(isAccepted(automaton, '1010101'), true)

      // Only 1 occurrence
      assert.strictEqual(isAccepted(automaton, '101'), false)
      assert.strictEqual(isAccepted(automaton, '1010'), false)
      assert.strictEqual(isAccepted(automaton, '0101'), false)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                       2. Natural-Language Question Parser                  */
  /* -------------------------------------------------------------------------- */

  describe('NLP Parser for Phase 10 Exam Questions', () => {
    it('parses exact count: "Construct a DFA accepting strings with exactly two ones"', () => {
      const res = parseQuestion('Construct a DFA accepting strings with exactly two ones')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.problemSpec?.languagePattern?.kind, 'exact_count')
      assert.strictEqual(res.problemSpec?.languagePattern?.k, 2)
      assert.strictEqual(res.problemSpec?.languagePattern?.symbol, '1')
    })

    it('parses length at most: "Construct a DFA that accepts strings of length at most 3"', () => {
      const res = parseQuestion('Construct a DFA that accepts strings of length at most 3')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.problemSpec?.languagePattern?.kind, 'at_most_length')
      assert.strictEqual(res.problemSpec?.languagePattern?.k, 3)
    })

    it('parses every X followed by Y: "Construct a DFA where every 0 is immediately followed by 1"', () => {
      const res = parseQuestion('Construct a DFA where every 0 is immediately followed by 1')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.problemSpec?.languagePattern?.kind, 'every_x_followed_by_y')
      assert.strictEqual(res.problemSpec?.languagePattern?.symbol, '0')
      assert.strictEqual(res.problemSpec?.languagePattern?.followedBySymbol, '1')
    })

    it('parses decimal divisibility: "Construct a DFA for decimal numbers divisible by 3"', () => {
      const res = parseQuestion('Construct a DFA for decimal numbers divisible by 3')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.problemSpec?.languagePattern?.kind, 'decimal_divisible')
      assert.strictEqual(res.problemSpec?.languagePattern?.divisor, 3)
      assert.deepStrictEqual(res.problemSpec?.alphabet, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
    })

    it('parses repeated substring: "Construct a DFA containing substring 01 at least twice"', () => {
      const res = parseQuestion('Construct a DFA containing substring 01 at least 2 times')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.problemSpec?.languagePattern?.kind, 'substring_count_at_least')
      assert.strictEqual(res.problemSpec?.languagePattern?.paramString, '01')
      assert.strictEqual(res.problemSpec?.languagePattern?.times, 2)
    })

    it('requests clarification for ambiguous compound query without parentheses', () => {
      const res = parseQuestion('strings containing 00 and ending with 1 or length divisible by 3')
      assert.strictEqual(res.success, false)
      assert.strictEqual(res.needsClarification, true)
      assert.ok(res.clarificationPrompt?.includes('parentheses'))
      assert.ok((res.clarificationOptions?.length ?? 0) >= 2)
    })

    it('parses parenthesized compound query cleanly: "(ends with 01 or starts with 10) and length divisible by 3"', () => {
      const res = parseQuestion('(ends with 01 or starts with 10) and length divisible by 3')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.problemSpec?.languagePattern?.kind, 'combined_operation')
      assert.strictEqual(res.problemSpec?.languagePattern?.operation, 'intersect')
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                  3. 9-Point Educational Explanation Suite                  */
  /* -------------------------------------------------------------------------- */

  describe('Educational Explanation Suite', () => {
    it('solveProblem outputs all 9 required educational elements', () => {
      const solution = solveProblem({
        type: 'dfa_from_language',
        alphabet: ['0', '1'],
        languagePattern: {
          kind: 'every_x_followed_by_y',
          symbol: '0',
          followedBySymbol: '1',
        },
      })

      // 1. Formal definition
      assert.ok(solution.formalLanguageDefinition.includes('L ='))
      assert.ok(solution.formalLanguageDefinition.includes('w[i]'))

      // 2. Formal 5-tuple
      assert.strictEqual(solution.formalTuple.start, 'q0')
      assert.ok(solution.formalTuple.states.includes('q0'))
      assert.ok(solution.formalTuple.states.includes('q1'))

      // 3. State Invariants
      assert.ok(solution.stateInvariants.length >= 3)
      const q0Inv = solution.stateInvariants.find((s) => s.state === 'q0')
      assert.strictEqual(q0Inv?.isStart, true)
      assert.strictEqual(q0Inv?.isAccept, true)
      assert.ok(q0Inv?.invariant.length > 5)

      // 4. Algorithmic steps & reasoning
      assert.ok(solution.constructionReasoning.length > 20)
      assert.ok(solution.stepByStepDetails.length >= 4)

      // 5. State diagram automaton
      assert.strictEqual(solution.automaton.states.length >= 3, true)

      // 6. Transition table
      assert.ok(solution.transitionTable.rows.length >= 3)
      assert.ok(solution.transitionTableMarkdown.includes('| State |'))

      // 7. Invariant proof sketch
      assert.ok(solution.invariantProofSketch.includes('Structural Induction'))
      assert.ok(solution.invariantProofSketch.includes('Base Step'))
      assert.ok(solution.invariantProofSketch.includes('Inductive Step'))

      // 8. Test string battery
      assert.ok(solution.testStrings.length >= 5)
      assert.strictEqual(typeof solution.testStrings[0].actualAccept, 'boolean')
      assert.ok(solution.testStrings[0].trace.steps.length > 0)

      // 9. Complexity notes
      assert.ok(solution.complexityNotes.stateCount >= 3)
      assert.ok(solution.complexityNotes.transitionCount >= 6)
      assert.strictEqual(typeof solution.complexityNotes.isMinimal, 'boolean')
      assert.ok(solution.complexityNotes.notes.includes('Myhill-Nerode'))
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                  4. Student Answer Verification with Partial DFAs           */
  /* -------------------------------------------------------------------------- */

  describe('Student Answer Verification and Incomplete DFAs', () => {
    it('verifies partial DFA under implicit rejecting semantics', () => {
      // Incomplete DFA for "ends with 1":
      // q0: on 1 -> q1 (accept), on 0 -> undefined (missing, implicitly dead)
      // q1: on 1 -> q1, on 0 -> q0
      const partialDfa = {
        id: 'student-partial',
        name: 'Student Partial DFA',
        description: 'Student partial DFA without sink state',
        language: 'Ends with 1',
        alphabet: ['0', '1'],
        start: 'q0',
        states: [
          { id: 'q0', x: 100, y: 100, accept: false },
          { id: 'q1', x: 250, y: 100, accept: true },
        ],
        edges: [],
        delta: {
          q0: { '1': ['q1'] }, // missing '0'
          q1: { '1': ['q1'], '0': ['q0'] },
        },
        nondeterministic: false,
      }

      // Completed version
      const completed = completeDfaWithSink(partialDfa, 'q_sink')

      // Language recognized by both should be identical under implicit sink semantics
      const res = verifyAgainstReference(partialDfa, {
        type: 'automaton',
        automaton: completed,
      })
      assert.strictEqual(res.equivalent, true)
    })
  })
})
