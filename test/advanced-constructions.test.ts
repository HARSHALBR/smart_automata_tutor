import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDfaAvoidSubstring,
  buildDfaSymbolCountAtMost,
  buildDfaSymbolCountModulo,
  complementDfa,
  differenceDfas,
  combineDfas,
  buildDfaContainsSubstring,
  buildDfaEndsWith,
  buildDfaStartsWith,
  buildDfaEmptyLanguage,
  buildDfaUniversalLanguage,
  solveProblem,
} from '../lib/automata-solver'
import {
  runAutomaton,
  isAccepting,
  validateAutomaton,
  generateTransitionTable,
  type Automaton,
} from '../lib/automata'
import { compareAutomata } from '../lib/equivalence'
import { parseQuestion } from '../lib/nlp-parser'

const testAccept = (dfa: Automaton, s: string): boolean => {
  const trace = runAutomaton(dfa, s)
  return isAccepting(dfa, trace.at(-1)!.active)
}

// =========================================================================
// 1. Substring Avoidance (buildDfaAvoidSubstring)
// =========================================================================
test('buildDfaAvoidSubstring: accepts strings not containing substring 011', () => {
  const { automaton } = buildDfaAvoidSubstring(['0', '1'], '011')
  const val = validateAutomaton(automaton, { completeDfaRequired: true })
  assert.equal(val.valid, true, `Validation failed: ${val.errors.join(', ')}`)

  // Empty string does not contain 011 -> must accept
  assert.equal(testAccept(automaton, ''), true)
  assert.equal(testAccept(automaton, '0'), true)
  assert.equal(testAccept(automaton, '1'), true)
  assert.equal(testAccept(automaton, '01'), true)
  assert.equal(testAccept(automaton, '10'), true)
  assert.equal(testAccept(automaton, '11'), true)
  assert.equal(testAccept(automaton, '010'), true)
  assert.equal(testAccept(automaton, '101'), true)
  assert.equal(testAccept(automaton, '0101'), true)

  // Contains 011 -> must reject
  assert.equal(testAccept(automaton, '011'), false)
  assert.equal(testAccept(automaton, '0110'), false)
  assert.equal(testAccept(automaton, '0011'), false)
  assert.equal(testAccept(automaton, '101101'), false)
  assert.equal(testAccept(automaton, '11011'), false)
})

test('buildDfaAvoidSubstring: handles overlapping pattern 10101', () => {
  const { automaton } = buildDfaAvoidSubstring(['0', '1'], '10101')
  const val = validateAutomaton(automaton, { completeDfaRequired: true })
  assert.equal(val.valid, true)

  assert.equal(testAccept(automaton, ''), true)
  assert.equal(testAccept(automaton, '1010'), true)
  assert.equal(testAccept(automaton, '101001'), true)
  assert.equal(testAccept(automaton, '10101'), false)
  assert.equal(testAccept(automaton, '001010100'), false)
  assert.equal(testAccept(automaton, '1010101'), false)
})

test('buildDfaAvoidSubstring: empty forbidden substring rejects all strings', () => {
  // Every string contains the empty string as a substring, so avoiding '' yields empty language
  const { automaton } = buildDfaAvoidSubstring(['0', '1'], '')
  assert.equal(testAccept(automaton, ''), false)
  assert.equal(testAccept(automaton, '0'), false)
  assert.equal(testAccept(automaton, '1'), false)
  assert.equal(testAccept(automaton, '01'), false)
})

test('buildDfaAvoidSubstring: throws on invalid alphabet symbol', () => {
  assert.throws(() => {
    buildDfaAvoidSubstring(['0', '1'], '021')
  }, /not in alphabet/)
})

// =========================================================================
// 2. At-Most Symbol Count (buildDfaSymbolCountAtMost)
// =========================================================================
test('buildDfaSymbolCountAtMost: at most two ones over {0,1}', () => {
  const { automaton } = buildDfaSymbolCountAtMost(['0', '1'], '1', 2)
  const val = validateAutomaton(automaton, { completeDfaRequired: true })
  assert.equal(val.valid, true, `Validation: ${val.errors.join(', ')}`)

  // 0 ones -> accept
  assert.equal(testAccept(automaton, ''), true)
  assert.equal(testAccept(automaton, '0'), true)
  assert.equal(testAccept(automaton, '00000'), true)

  // 1 one -> accept
  assert.equal(testAccept(automaton, '1'), true)
  assert.equal(testAccept(automaton, '0100'), true)

  // 2 ones -> accept
  assert.equal(testAccept(automaton, '11'), true)
  assert.equal(testAccept(automaton, '01010'), true)
  assert.equal(testAccept(automaton, '1001'), true)

  // 3 ones -> reject (trap state reached)
  assert.equal(testAccept(automaton, '111'), false)
  assert.equal(testAccept(automaton, '0101010'), false)
  assert.equal(testAccept(automaton, '1111'), false)
})

test('buildDfaSymbolCountAtMost: k = 0 (no zeros allowed)', () => {
  const { automaton } = buildDfaSymbolCountAtMost(['0', '1'], '0', 0)
  assert.equal(testAccept(automaton, ''), true)
  assert.equal(testAccept(automaton, '1'), true)
  assert.equal(testAccept(automaton, '1111'), true)
  assert.equal(testAccept(automaton, '0'), false)
  assert.equal(testAccept(automaton, '1101'), false)
})

test('buildDfaSymbolCountAtMost: parameter validations', () => {
  assert.throws(() => {
    buildDfaSymbolCountAtMost(['0', '1'], '1', -1)
  }, /non-negative integer/)

  assert.throws(() => {
    buildDfaSymbolCountAtMost(['0', '1'], '2', 2)
  }, /not in alphabet/)
})

// =========================================================================
// 3. Symbol Count Modulo (buildDfaSymbolCountModulo)
// =========================================================================
test('buildDfaSymbolCountModulo: count of zeros divisible by 3', () => {
  const { automaton } = buildDfaSymbolCountModulo(['0', '1'], '0', 3, 0)
  const val = validateAutomaton(automaton, { completeDfaRequired: true })
  assert.equal(val.valid, true)

  // 0 zeros (0 mod 3 == 0)
  assert.equal(testAccept(automaton, ''), true)
  assert.equal(testAccept(automaton, '1'), true)
  assert.equal(testAccept(automaton, '1111'), true)

  // 1 zero (1 mod 3 != 0)
  assert.equal(testAccept(automaton, '0'), false)
  assert.equal(testAccept(automaton, '101'), false)

  // 2 zeros (2 mod 3 != 0)
  assert.equal(testAccept(automaton, '00'), false)
  assert.equal(testAccept(automaton, '0110'), false)

  // 3 zeros (3 mod 3 == 0)
  assert.equal(testAccept(automaton, '000'), true)
  assert.equal(testAccept(automaton, '1010101'), true)

  // 4 zeros (4 mod 3 == 1)
  assert.equal(testAccept(automaton, '0000'), false)
})

test('buildDfaSymbolCountModulo: count of ones mod 3 equals 2', () => {
  const { automaton } = buildDfaSymbolCountModulo(['0', '1'], '1', 3, 2)
  assert.equal(testAccept(automaton, ''), false)
  assert.equal(testAccept(automaton, '1'), false)
  assert.equal(testAccept(automaton, '11'), true)
  assert.equal(testAccept(automaton, '01010'), true)
  assert.equal(testAccept(automaton, '111'), false)
  assert.equal(testAccept(automaton, '11111'), true)
})

test('buildDfaSymbolCountModulo: validations', () => {
  assert.throws(() => {
    buildDfaSymbolCountModulo(['0', '1'], '0', 0, 0)
  }, /positive integer/)

  assert.throws(() => {
    buildDfaSymbolCountModulo(['0', '1'], '0', 3, 4)
  }, /remainder must satisfy/i)

  assert.throws(() => {
    buildDfaSymbolCountModulo(['0', '1'], 'z', 3, 0)
  }, /not in alphabet/)
})

// =========================================================================
// 4. DFA Complement (complementDfa)
// =========================================================================
test('complementDfa: complements DFA correctly and handles sink completion', () => {
  const dfaEnds01 = buildDfaEndsWith(['0', '1'], '01').automaton
  const comp = complementDfa(dfaEnds01).automaton

  const val = validateAutomaton(comp, { completeDfaRequired: true })
  assert.equal(val.valid, true)

  // Strings ending in 01 were accepted by original, must be rejected by complement
  assert.equal(testAccept(dfaEnds01, '01'), true)
  assert.equal(testAccept(comp, '01'), false)

  assert.equal(testAccept(dfaEnds01, '1001'), true)
  assert.equal(testAccept(comp, '1001'), false)

  // Strings not ending in 01 were rejected by original, must be accepted by complement
  assert.equal(testAccept(dfaEnds01, ''), false)
  assert.equal(testAccept(comp, ''), true)

  assert.equal(testAccept(dfaEnds01, '0'), false)
  assert.equal(testAccept(comp, '0'), true)

  assert.equal(testAccept(dfaEnds01, '010'), false)
  assert.equal(testAccept(comp, '010'), true)

  // Double complement theorem: comp(comp(D)) == D
  const doubleComp = complementDfa(comp).automaton
  const eq = compareAutomata(dfaEnds01, doubleComp)
  assert.equal(eq.equivalent, true, 'Double complement must be equivalent to original DFA')
})

test('complementDfa: universal and empty language duality', () => {
  const emptyDfa = buildDfaEmptyLanguage(['0', '1']).automaton
  const univDfa = buildDfaUniversalLanguage(['0', '1']).automaton

  const compEmpty = complementDfa(emptyDfa).automaton
  const compUniv = complementDfa(univDfa).automaton

  const eq1 = compareAutomata(compEmpty, univDfa)
  assert.equal(eq1.equivalent, true, 'Complement of empty language must be universal language')

  const eq2 = compareAutomata(compUniv, emptyDfa)
  assert.equal(eq2.equivalent, true, 'Complement of universal language must be empty language')
})

// =========================================================================
// 5. DFA Difference (differenceDfas)
// =========================================================================
test('differenceDfas: L(A) \\ L(B) for contains 00 but not 11', () => {
  const dfaContains00 = buildDfaContainsSubstring(['0', '1'], '00').automaton
  const dfaContains11 = buildDfaContainsSubstring(['0', '1'], '11').automaton

  const diff = differenceDfas(dfaContains00, dfaContains11).automaton
  const val = validateAutomaton(diff, { completeDfaRequired: true })
  assert.equal(val.valid, true)

  // Strings containing 00 and NOT containing 11 -> ACCEPT
  assert.equal(testAccept(diff, '00'), true)
  assert.equal(testAccept(diff, '000'), true)
  assert.equal(testAccept(diff, '100'), true)
  assert.equal(testAccept(diff, '001'), true)
  assert.equal(testAccept(diff, '100010'), true)

  // Strings containing 00 AND containing 11 -> REJECT
  assert.equal(testAccept(diff, '0011'), false)
  assert.equal(testAccept(diff, '1100'), false)
  assert.equal(testAccept(diff, '001011'), false)

  // Strings NOT containing 00 -> REJECT
  assert.equal(testAccept(diff, ''), false)
  assert.equal(testAccept(diff, '0101'), false)
  assert.equal(testAccept(diff, '11'), false)
})

test('differenceDfas: algebraic identity L \\ L == ∅', () => {
  const dfa = buildDfaContainsSubstring(['0', '1'], '101').automaton
  const diffSelf = differenceDfas(dfa, dfa).automaton
  const emptyDfa = buildDfaEmptyLanguage(['0', '1']).automaton

  const eq = compareAutomata(diffSelf, emptyDfa)
  assert.equal(eq.equivalent, true, 'DFA minus itself must equal empty language')
})

test('differenceDfas: handles differing alphabets gracefully', () => {
  // dfa1 over {a, b}: ends with "a"
  const dfa1 = buildDfaEndsWith(['a', 'b'], 'a').automaton
  // dfa2 over {b, c}: ends with "b"
  const dfa2 = buildDfaEndsWith(['b', 'c'], 'b').automaton

  const diff = differenceDfas(dfa1, dfa2).automaton
  const val = validateAutomaton(diff, { completeDfaRequired: true })
  assert.equal(val.valid, true)
  assert.deepEqual(diff.alphabet.sort(), ['a', 'b', 'c'])

  // Accepts strings in L(dfa1) that are not in L(dfa2)
  assert.equal(testAccept(diff, 'a'), true)
  assert.equal(testAccept(diff, 'ba'), true)
  assert.equal(testAccept(diff, 'b'), false)
  assert.equal(testAccept(diff, ''), false)
})

// =========================================================================
// 6. Natural Language Parser Tests
// =========================================================================
test('nlp-parser: parses "Construct a DFA that does not contain substring 011."', () => {
  const res = parseQuestion('Construct a DFA that does not contain substring 011.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.languagePattern?.kind, 'avoid_substring')
  assert.equal(res.problemSpec?.languagePattern?.paramString, '011')
})

test('nlp-parser: parses "Design an automaton that avoids 101."', () => {
  const res = parseQuestion('Design an automaton that avoids 101.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.languagePattern?.kind, 'avoid_substring')
  assert.equal(res.problemSpec?.languagePattern?.paramString, '101')
})

test('nlp-parser: parses "Accept strings containing at most two ones."', () => {
  const res = parseQuestion('Accept strings containing at most two ones.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.languagePattern?.kind, 'at_most_count')
  assert.equal(res.problemSpec?.languagePattern?.k, 2)
  assert.equal(res.problemSpec?.languagePattern?.symbol, '1')
})

test('nlp-parser: parses "Construct a DFA with no more than three zeros."', () => {
  const res = parseQuestion('Construct a DFA with no more than three zeros.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.languagePattern?.kind, 'at_most_count')
  assert.equal(res.problemSpec?.languagePattern?.k, 3)
  assert.equal(res.problemSpec?.languagePattern?.symbol, '0')
})

test('nlp-parser: parses "Strings where the number of zeros is divisible by 3."', () => {
  const res = parseQuestion('Strings where the number of zeros is divisible by 3.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.languagePattern?.kind, 'symbol_count_divisible')
  assert.equal(res.problemSpec?.languagePattern?.symbol, '0')
  assert.equal(res.problemSpec?.languagePattern?.divisor, 3)
  assert.equal(res.problemSpec?.languagePattern?.remainder, 0)
})

test('nlp-parser: parses "Construct a DFA accepting strings containing 00 but not 11."', () => {
  const res = parseQuestion('Construct a DFA accepting strings containing 00 but not 11.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.languagePattern?.kind, 'combined_operation')
  assert.equal(res.problemSpec?.languagePattern?.operation, 'difference')
  assert.equal(res.problemSpec?.languagePattern?.firstPattern?.kind, 'contains_substring')
  assert.equal(res.problemSpec?.languagePattern?.firstPattern?.paramString, '00')
  assert.equal(res.problemSpec?.languagePattern?.secondPattern?.kind, 'contains_substring')
  assert.equal(res.problemSpec?.languagePattern?.secondPattern?.paramString, '11')
})

test('nlp-parser: parses "Design a machine starting with 01 OR ending with 10."', () => {
  const res = parseQuestion('Design a machine starting with 01 OR ending with 10.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.languagePattern?.kind, 'combined_operation')
  assert.equal(res.problemSpec?.languagePattern?.operation, 'union')
  assert.equal(res.problemSpec?.languagePattern?.firstPattern?.kind, 'starts_with')
  assert.equal(res.problemSpec?.languagePattern?.firstPattern?.paramString, '01')
  assert.equal(res.problemSpec?.languagePattern?.secondPattern?.kind, 'ends_with')
  assert.equal(res.problemSpec?.languagePattern?.secondPattern?.paramString, '10')
})

test('nlp-parser: requests clarification on ambiguous "divisible by 3"', () => {
  const res = parseQuestion('Construct a DFA for strings divisible by 3.')
  assert.equal(res.success, false)
  assert.equal(res.needsClarification, true)
  assert.ok(res.clarificationPrompt?.includes('binary numerical value'))
})

test('nlp-parser: regression test for original 8 preset questions', () => {
  const presets = [
    { query: 'Construct a DFA over {0,1} that accepts strings ending with 01.', kind: 'ends_with' },
    { query: 'Construct a DFA that accepts strings containing an even number of zeros.', kind: 'symbol_parity' },
    { query: 'Construct a DFA that accepts strings whose binary value is divisible by 3.', kind: 'binary_divisible' },
    { query: 'Construct a DFA that accepts strings containing no consecutive ones.', kind: 'no_consecutive' },
    { query: 'Convert this NFA into an equivalent DFA.', type: 'nfa_to_dfa' },
    { query: 'Minimize the following DFA.', type: 'minimize_dfa' },
    { query: 'Construct a DFA that accepts strings whose length is divisible by 3.', kind: 'length_divisible' },
    { query: 'Construct a DFA that accepts strings starting with 0 and ending with 1.', kind: 'starts_and_ends' },
  ]

  for (const p of presets) {
    const res = parseQuestion(p.query)
    assert.equal(res.success, true, `Failed on preset: ${p.query}`)
    if (p.kind) {
      assert.equal(res.problemSpec?.languagePattern?.kind, p.kind, `Mismatch kind on: ${p.query}`)
    }
    if (p.type) {
      assert.equal(res.problemSpec?.type, p.type, `Mismatch type on: ${p.query}`)
    }
  }
})

// =========================================================================
// 7. Full Solver Integration Pipeline for New Problems
// =========================================================================
test('solveProblem: end-to-end integration for difference problem', () => {
  const parsed = parseQuestion('Construct a DFA accepting strings containing 00 but not 11.')
  assert.equal(parsed.success, true)
  const solution = solveProblem(parsed.problemSpec!)

  assert.ok(solution.title)
  assert.ok(solution.transitionTable.rows.length > 0)
  assert.ok(solution.automaton.states.length > 0)
  assert.ok(solution.testStrings.length > 0)

  // Verify transition table row consistency with automaton states
  const tableStateIds = solution.transitionTable.rows.map((r) => r.state)
  const autoStateIds = solution.automaton.states.map((s) => s.id)
  assert.deepEqual(tableStateIds.sort(), autoStateIds.sort())
})
