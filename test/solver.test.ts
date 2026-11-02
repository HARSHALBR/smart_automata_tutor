import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDfaEndsWith,
  buildDfaStartsWith,
  buildDfaContainsSubstring,
  buildDfaSymbolParity,
  buildDfaBinaryDivisibleBy,
  buildDfaLengthModulo,
  buildDfaStartsAndEnds,
  buildDfaNoConsecutive,
  buildNfaKthFromEnd,
  solveProblem,
} from '../lib/automata-solver'
import { runAutomaton, isAccepting, validateAutomaton } from '../lib/automata'

test('buildDfaEndsWith accepts strings ending in target suffix', () => {
  const { automaton } = buildDfaEndsWith(['0', '1'], '01')
  const val = validateAutomaton(automaton, { completeDfaRequired: true })
  assert.equal(val.valid, true, `Invalid DFA: ${val.errors.join(', ')}`)

  const testAccept = (s: string) => isAccepting(automaton, runAutomaton(automaton, s).at(-1)!.active)

  assert.equal(testAccept(''), false)
  assert.equal(testAccept('0'), false)
  assert.equal(testAccept('1'), false)
  assert.equal(testAccept('01'), true)
  assert.equal(testAccept('0001'), true)
  assert.equal(testAccept('1101'), true)
  assert.equal(testAccept('010'), false)
  assert.equal(testAccept('0101'), true)
})

test('buildDfaStartsWith accepts strings beginning with prefix', () => {
  const { automaton } = buildDfaStartsWith(['0', '1'], '1')
  const val = validateAutomaton(automaton, { completeDfaRequired: true })
  assert.equal(val.valid, true)

  const testAccept = (s: string) => isAccepting(automaton, runAutomaton(automaton, s).at(-1)!.active)

  assert.equal(testAccept(''), false)
  assert.equal(testAccept('0'), false)
  assert.equal(testAccept('1'), true)
  assert.equal(testAccept('1000'), true)
  assert.equal(testAccept('1111'), true)
  assert.equal(testAccept('0111'), false)
})

test('buildDfaContainsSubstring accepts strings with substring 101', () => {
  const { automaton } = buildDfaContainsSubstring(['0', '1'], '101')
  const val = validateAutomaton(automaton, { completeDfaRequired: true })
  assert.equal(val.valid, true)

  const testAccept = (s: string) => isAccepting(automaton, runAutomaton(automaton, s).at(-1)!.active)

  assert.equal(testAccept(''), false)
  assert.equal(testAccept('101'), true)
  assert.equal(testAccept('0010100'), true)
  assert.equal(testAccept('111101'), true)
  assert.equal(testAccept('1001'), false)
  assert.equal(testAccept('010010'), false)
})

test('buildDfaSymbolParity handles even count of 0s', () => {
  const { automaton } = buildDfaSymbolParity(['0', '1'], '0', 'even')
  const val = validateAutomaton(automaton, { completeDfaRequired: true })
  assert.equal(val.valid, true)

  const testAccept = (s: string) => isAccepting(automaton, runAutomaton(automaton, s).at(-1)!.active)

  assert.equal(testAccept(''), true) // 0 zeros = even
  assert.equal(testAccept('0'), false)
  assert.equal(testAccept('00'), true)
  assert.equal(testAccept('111'), true)
  assert.equal(testAccept('010'), true)
  assert.equal(testAccept('01010'), false)
})

test('buildDfaBinaryDivisibleBy handles modulo 3', () => {
  const { automaton } = buildDfaBinaryDivisibleBy(3)
  const val = validateAutomaton(automaton, { completeDfaRequired: true })
  assert.equal(val.valid, true)

  const testAccept = (s: string) => isAccepting(automaton, runAutomaton(automaton, s).at(-1)!.active)

  assert.equal(testAccept('0'), true) // 0 % 3 == 0
  assert.equal(testAccept('11'), true) // 3 % 3 == 0
  assert.equal(testAccept('110'), true) // 6 % 3 == 0
  assert.equal(testAccept('1001'), true) // 9 % 3 == 0
  assert.equal(testAccept('1'), false) // 1 % 3 == 1
  assert.equal(testAccept('10'), false) // 2 % 3 == 2
  assert.equal(testAccept('100'), false) // 4 % 3 == 1
})

test('buildDfaLengthModulo handles length divisible by 3', () => {
  const { automaton } = buildDfaLengthModulo(['0', '1'], 3, 0)
  const val = validateAutomaton(automaton, { completeDfaRequired: true })
  assert.equal(val.valid, true)

  const testAccept = (s: string) => isAccepting(automaton, runAutomaton(automaton, s).at(-1)!.active)

  assert.equal(testAccept(''), true) // len 0
  assert.equal(testAccept('000'), true) // len 3
  assert.equal(testAccept('111111'), true) // len 6
  assert.equal(testAccept('0'), false) // len 1
  assert.equal(testAccept('01'), false) // len 2
})

test('buildDfaStartsAndEnds begins with 1 and ends with 0', () => {
  const { automaton } = buildDfaStartsAndEnds(['0', '1'], '1', '0')
  const val = validateAutomaton(automaton, { completeDfaRequired: true })
  assert.equal(val.valid, true)

  const testAccept = (s: string) => isAccepting(automaton, runAutomaton(automaton, s).at(-1)!.active)

  assert.equal(testAccept(''), false)
  assert.equal(testAccept('10'), true)
  assert.equal(testAccept('110'), true)
  assert.equal(testAccept('1010'), true)
  assert.equal(testAccept('1'), false)
  assert.equal(testAccept('00'), false)
  assert.equal(testAccept('010'), false)
})

test('buildDfaNoConsecutive rejects consecutive 11', () => {
  const { automaton } = buildDfaNoConsecutive(['0', '1'], '1')
  const val = validateAutomaton(automaton, { completeDfaRequired: true })
  assert.equal(val.valid, true)

  const testAccept = (s: string) => isAccepting(automaton, runAutomaton(automaton, s).at(-1)!.active)

  assert.equal(testAccept(''), true)
  assert.equal(testAccept('0'), true)
  assert.equal(testAccept('1'), true)
  assert.equal(testAccept('010101'), true)
  assert.equal(testAccept('11'), false)
  assert.equal(testAccept('0110'), false)
})

test('buildNfaKthFromEnd recognizes 3rd from end is 1', () => {
  const { automaton } = buildNfaKthFromEnd(['0', '1'], '1', 3)
  const val = validateAutomaton(automaton)
  assert.equal(val.valid, true)
  assert.equal(automaton.nondeterministic, true)

  const testAccept = (s: string) => isAccepting(automaton, runAutomaton(automaton, s).at(-1)!.active)

  assert.equal(testAccept('100'), true)
  assert.equal(testAccept('101'), true)
  assert.equal(testAccept('0100'), true)
  assert.equal(testAccept('000'), false)
  assert.equal(testAccept('010'), false)
})

test('solveProblem generates complete 10-point solution object', () => {
  const solution = solveProblem({
    type: 'dfa_from_language',
    alphabet: ['0', '1'],
    languagePattern: { kind: 'ends_with', paramString: '01' },
  })

  assert.ok(solution.title.includes('Ends with "01"'))
  assert.equal(solution.formalTuple.alphabet.length, 2)
  assert.ok(solution.transitionTable.rows.length >= 3)
  assert.ok(solution.transitionTableMarkdown.includes('| State | 0 | 1 |'))
  assert.ok(solution.stepByStepDetails.length >= 5)
  assert.ok(solution.testStrings.length > 0)
  assert.ok(solution.jsonExport.includes('dfa-ends-01'))
})
