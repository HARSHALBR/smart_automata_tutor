import test from 'node:test'
import assert from 'node:assert/strict'
import { parseQuestion } from '../lib/nlp-parser'

test('Parses DFA ending with 01 with explicit alphabet', () => {
  const res = parseQuestion('Construct a DFA over {0,1} that accepts strings ending with 01.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.type, 'dfa_from_language')
  assert.equal(res.problemSpec?.targetType, 'DFA')
  assert.deepEqual(res.problemSpec?.alphabet, ['0', '1'])
  assert.equal(res.problemSpec?.languagePattern?.kind, 'ends_with')
  assert.equal(res.problemSpec?.languagePattern?.paramString, '01')
})

test('Parses DFA with even number of zeros', () => {
  const res = parseQuestion('Construct a DFA that accepts strings containing an even number of zeros.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.languagePattern?.kind, 'symbol_parity')
  assert.equal(res.problemSpec?.languagePattern?.parity, 'even')
  assert.equal(res.problemSpec?.languagePattern?.symbol, '0')
})

test('Parses DFA with odd number of ones', () => {
  const res = parseQuestion('Construct a DFA that accepts strings with an odd number of ones.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.languagePattern?.kind, 'symbol_parity')
  assert.equal(res.problemSpec?.languagePattern?.parity, 'odd')
  assert.equal(res.problemSpec?.languagePattern?.symbol, '1')
})

test('Parses DFA containing substring 101', () => {
  const res = parseQuestion('Construct a DFA that accepts strings containing the substring 101.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.languagePattern?.kind, 'contains_substring')
  assert.equal(res.problemSpec?.languagePattern?.paramString, '101')
})

test('Parses DFA binary divisible by 3', () => {
  const res = parseQuestion('Construct a DFA that accepts strings whose binary value is divisible by 3.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.languagePattern?.kind, 'binary_divisible')
  assert.equal(res.problemSpec?.languagePattern?.divisor, 3)
})

test('Parses DFA beginning with 1 and ending with 0', () => {
  const res = parseQuestion('Construct a DFA that accepts strings beginning with 1 and ending with 0.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.languagePattern?.kind, 'starts_and_ends')
  assert.equal(res.problemSpec?.languagePattern?.startSymbol, '1')
  assert.equal(res.problemSpec?.languagePattern?.endSymbol, '0')
})

test('Parses DFA containing no consecutive ones', () => {
  const res = parseQuestion('Construct a DFA that accepts strings containing no consecutive ones.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.languagePattern?.kind, 'no_consecutive')
  assert.equal(res.problemSpec?.languagePattern?.symbol, '1')
})

test('Parses DFA length divisible by 3', () => {
  const res = parseQuestion('Construct a DFA that accepts strings whose length is divisible by 3.')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.languagePattern?.kind, 'length_divisible')
  assert.equal(res.problemSpec?.languagePattern?.divisor, 3)
})

test('Parses transformations: NFA to DFA and Minimize DFA', () => {
  const conv = parseQuestion('Convert this NFA into an equivalent DFA.')
  assert.equal(conv.success, true)
  assert.equal(conv.problemSpec?.type, 'nfa_to_dfa')

  const min = parseQuestion('Minimize the following DFA.')
  assert.equal(min.success, true)
  assert.equal(min.problemSpec?.type, 'minimize_dfa')
})

test('Requests targeted clarification when pattern is incomplete', () => {
  const inc = parseQuestion('Construct a DFA that ends with')
  assert.equal(inc.success, false)
  assert.equal(inc.needsClarification, true)
  assert.ok(inc.clarificationPrompt?.includes('Which suffix'))
  assert.ok(inc.clarificationOptions && inc.clarificationOptions.length > 0)
})

test('Requests clarification for vague input', () => {
  const vague = parseQuestion('What is an automaton?')
  assert.equal(vague.success, false)
  assert.equal(vague.needsClarification, true)
  assert.ok(vague.clarificationOptions && vague.clarificationOptions.length > 0)
})
