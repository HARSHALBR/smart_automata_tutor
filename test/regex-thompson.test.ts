import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseRegex,
  tokenizeRegex,
  formatRegexAst,
  printRegexAstTree,
  RegexParseError,
} from '../lib/regex-parser'
import {
  buildThompsonNfa,
  buildRegexPipeline,
} from '../lib/thompson-construction'
import {
  runAutomaton,
  isAccepting,
  validateAutomaton,
  generateTransitionTable,
  type Automaton,
} from '../lib/automata'
import { compareAutomata } from '../lib/equivalence'
import { parseQuestion } from '../lib/nlp-parser'
import { solveProblem } from '../lib/automata-solver'

const testAccept = (auto: Automaton, str: string): boolean => {
  const trace = runAutomaton(auto, str)
  return isAccepting(auto, trace.at(-1)!.active)
}

// =========================================================================
// 1. Single symbol: '0'
// =========================================================================
test('regex 1: "0" accepts only single symbol 0', () => {
  const pipeline = buildRegexPipeline('0', ['0', '1'])
  const { nfa, dfa, minimizedDfa } = pipeline

  assert.equal(validateAutomaton(nfa).valid, true)
  assert.equal(validateAutomaton(dfa, { completeDfaRequired: true }).valid, true)
  assert.equal(validateAutomaton(minimizedDfa, { completeDfaRequired: true }).valid, true)

  for (const machine of [nfa, dfa, minimizedDfa]) {
    assert.equal(testAccept(machine, '0'), true)
    assert.equal(testAccept(machine, ''), false)
    assert.equal(testAccept(machine, '1'), false)
    assert.equal(testAccept(machine, '00'), false)
    assert.equal(testAccept(machine, '01'), false)
  }

  const eq = compareAutomata(dfa, minimizedDfa)
  assert.equal(eq.equivalent, true)
})

// =========================================================================
// 2. Union: '0|1'
// =========================================================================
test('regex 2: "0|1" accepts either symbol', () => {
  const pipeline = buildRegexPipeline('0|1', ['0', '1'])
  const { nfa, dfa, minimizedDfa } = pipeline

  assert.equal(validateAutomaton(nfa).valid, true)
  assert.equal(validateAutomaton(dfa, { completeDfaRequired: true }).valid, true)

  for (const machine of [nfa, dfa, minimizedDfa]) {
    assert.equal(testAccept(machine, '0'), true)
    assert.equal(testAccept(machine, '1'), true)
    assert.equal(testAccept(machine, ''), false)
    assert.equal(testAccept(machine, '00'), false)
    assert.equal(testAccept(machine, '01'), false)
    assert.equal(testAccept(machine, '11'), false)
  }

  assert.equal(compareAutomata(dfa, minimizedDfa).equivalent, true)
})

// =========================================================================
// 3. Concatenation: '01'
// =========================================================================
test('regex 3: "01" accepts exactly 01', () => {
  const pipeline = buildRegexPipeline('01', ['0', '1'])
  const { nfa, dfa, minimizedDfa } = pipeline

  for (const machine of [nfa, dfa, minimizedDfa]) {
    assert.equal(testAccept(machine, '01'), true)
    assert.equal(testAccept(machine, ''), false)
    assert.equal(testAccept(machine, '0'), false)
    assert.equal(testAccept(machine, '1'), false)
    assert.equal(testAccept(machine, '10'), false)
    assert.equal(testAccept(machine, '010'), false)
  }

  assert.equal(compareAutomata(dfa, minimizedDfa).equivalent, true)
})

// =========================================================================
// 4. Kleene Star: '0*'
// =========================================================================
test('regex 4: "0*" accepts epsilon and any number of zeros', () => {
  const pipeline = buildRegexPipeline('0*', ['0', '1'])
  const { nfa, dfa, minimizedDfa } = pipeline

  for (const machine of [nfa, dfa, minimizedDfa]) {
    assert.equal(testAccept(machine, ''), true)
    assert.equal(testAccept(machine, '0'), true)
    assert.equal(testAccept(machine, '00'), true)
    assert.equal(testAccept(machine, '00000'), true)
    assert.equal(testAccept(machine, '1'), false)
    assert.equal(testAccept(machine, '01'), false)
    assert.equal(testAccept(machine, '0010'), false)
  }

  assert.equal(compareAutomata(dfa, minimizedDfa).equivalent, true)
})

// =========================================================================
// 5. Universal Star: '(0|1)*'
// =========================================================================
test('regex 5: "(0|1)*" accepts every binary string including epsilon', () => {
  const pipeline = buildRegexPipeline('(0|1)*', ['0', '1'])
  const { nfa, dfa, minimizedDfa } = pipeline

  for (const machine of [nfa, dfa, minimizedDfa]) {
    assert.equal(testAccept(machine, ''), true)
    assert.equal(testAccept(machine, '0'), true)
    assert.equal(testAccept(machine, '1'), true)
    assert.equal(testAccept(machine, '00'), true)
    assert.equal(testAccept(machine, '01'), true)
    assert.equal(testAccept(machine, '10'), true)
    assert.equal(testAccept(machine, '11'), true)
    assert.equal(testAccept(machine, '10101011001'), true)
  }

  // Minimized DFA for (0|1)* must have exactly 1 state (universal language)
  assert.equal(minimizedDfa.states.length, 1)
  assert.equal(compareAutomata(dfa, minimizedDfa).equivalent, true)
})

// =========================================================================
// 6. Suffix Pattern: '(0|1)*01'
// =========================================================================
test('regex 6: "(0|1)*01" accepts strings ending in 01', () => {
  const pipeline = buildRegexPipeline('(0|1)*01', ['0', '1'])
  const { nfa, dfa, minimizedDfa } = pipeline

  for (const machine of [nfa, dfa, minimizedDfa]) {
    assert.equal(testAccept(machine, '01'), true)
    assert.equal(testAccept(machine, '001'), true)
    assert.equal(testAccept(machine, '1001'), true)
    assert.equal(testAccept(machine, '1101'), true)
    assert.equal(testAccept(machine, '0101'), true)
    assert.equal(testAccept(machine, ''), false)
    assert.equal(testAccept(machine, '0'), false)
    assert.equal(testAccept(machine, '1'), false)
    assert.equal(testAccept(machine, '010'), false)
    assert.equal(testAccept(machine, '100'), false)
  }

  // Minimized DFA for strings ending in 01 has 3 states
  assert.equal(minimizedDfa.states.length, 3)
  assert.equal(compareAutomata(dfa, minimizedDfa).equivalent, true)
})

// =========================================================================
// 7. Repeated Substring: '(01)*'
// =========================================================================
test('regex 7: "(01)*" accepts epsilon, 01, 0101, etc.', () => {
  const pipeline = buildRegexPipeline('(01)*', ['0', '1'])
  const { nfa, dfa, minimizedDfa } = pipeline

  for (const machine of [nfa, dfa, minimizedDfa]) {
    assert.equal(testAccept(machine, ''), true)
    assert.equal(testAccept(machine, '01'), true)
    assert.equal(testAccept(machine, '0101'), true)
    assert.equal(testAccept(machine, '010101'), true)
    assert.equal(testAccept(machine, '0'), false)
    assert.equal(testAccept(machine, '1'), false)
    assert.equal(testAccept(machine, '010'), false)
    assert.equal(testAccept(machine, '011'), false)
  }

  assert.equal(compareAutomata(dfa, minimizedDfa).equivalent, true)
})

// =========================================================================
// 8. Order Pattern: '0*1*'
// =========================================================================
test('regex 8: "0*1*" accepts zeros followed by ones', () => {
  const pipeline = buildRegexPipeline('0*1*', ['0', '1'])
  const { nfa, dfa, minimizedDfa } = pipeline

  for (const machine of [nfa, dfa, minimizedDfa]) {
    assert.equal(testAccept(machine, ''), true)
    assert.equal(testAccept(machine, '0'), true)
    assert.equal(testAccept(machine, '1'), true)
    assert.equal(testAccept(machine, '000'), true)
    assert.equal(testAccept(machine, '111'), true)
    assert.equal(testAccept(machine, '0011'), true)
    assert.equal(testAccept(machine, '0111'), true)
    assert.equal(testAccept(machine, '10'), false)
    assert.equal(testAccept(machine, '010'), false)
    assert.equal(testAccept(machine, '110'), false)
  }

  assert.equal(compareAutomata(dfa, minimizedDfa).equivalent, true)
})

// =========================================================================
// 9. Precedence: '0|01' (Concatenation over Union)
// =========================================================================
test('regex 9: "0|01" respects concatenation precedence over union', () => {
  const pipeline = buildRegexPipeline('0|01', ['0', '1'])
  const { nfa, dfa, minimizedDfa } = pipeline

  // Should parse as (0) | (01), NOT (0|0)1
  assert.equal(pipeline.normalizedRegex, '0|01')

  for (const machine of [nfa, dfa, minimizedDfa]) {
    assert.equal(testAccept(machine, '0'), true)
    assert.equal(testAccept(machine, '01'), true)
    assert.equal(testAccept(machine, ''), false)
    assert.equal(testAccept(machine, '1'), false)
    assert.equal(testAccept(machine, '00'), false)
    assert.equal(testAccept(machine, '001'), false)
  }

  assert.equal(compareAutomata(dfa, minimizedDfa).equivalent, true)
})

// =========================================================================
// 10. Nested: '(0|(1*0))*'
// =========================================================================
test('regex 10: "(0|(1*0))*" handles deeply nested union, star, and concat', () => {
  const pipeline = buildRegexPipeline('(0|(1*0))*', ['0', '1'])
  const { nfa, dfa, minimizedDfa } = pipeline

  // Language: strings where every '1' is eventually followed by a '0' (or empty string)
  for (const machine of [nfa, dfa, minimizedDfa]) {
    assert.equal(testAccept(machine, ''), true)
    assert.equal(testAccept(machine, '0'), true)
    assert.equal(testAccept(machine, '10'), true)
    assert.equal(testAccept(machine, '110'), true)
    assert.equal(testAccept(machine, '0100110'), true)
    assert.equal(testAccept(machine, '1'), false)
    assert.equal(testAccept(machine, '01'), false)
    assert.equal(testAccept(machine, '101'), false)
  }

  assert.equal(compareAutomata(dfa, minimizedDfa).equivalent, true)
})

// =========================================================================
// 11. Explicit Epsilon: 'ε' and '\e'
// =========================================================================
test('regex 11: explicit epsilon accepts only empty string', () => {
  const pipelineEps = buildRegexPipeline('ε', ['0', '1'])
  const pipelineSlashE = buildRegexPipeline('\\e', ['0', '1'])

  for (const pipeline of [pipelineEps, pipelineSlashE]) {
    const { nfa, dfa, minimizedDfa } = pipeline
    for (const machine of [nfa, dfa, minimizedDfa]) {
      assert.equal(testAccept(machine, ''), true)
      assert.equal(testAccept(machine, '0'), false)
      assert.equal(testAccept(machine, '1'), false)
    }
  }

  // Expression with epsilon: '0|ε' accepts { '', '0' }
  const pipe0OrEps = buildRegexPipeline('0|ε', ['0', '1'])
  assert.equal(testAccept(pipe0OrEps.minimizedDfa, ''), true)
  assert.equal(testAccept(pipe0OrEps.minimizedDfa, '0'), true)
  assert.equal(testAccept(pipe0OrEps.minimizedDfa, '1'), false)
  assert.equal(testAccept(pipe0OrEps.minimizedDfa, '00'), false)
})

// =========================================================================
// 12. Explicit Empty Language: '∅' and '\0'
// =========================================================================
test('regex 12: explicit empty language rejects all strings', () => {
  const pipelineEmpty = buildRegexPipeline('∅', ['0', '1'])
  const pipelineSlash0 = buildRegexPipeline('\\0', ['0', '1'])

  for (const pipeline of [pipelineEmpty, pipelineSlash0]) {
    const { nfa, dfa, minimizedDfa } = pipeline
    for (const machine of [nfa, dfa, minimizedDfa]) {
      assert.equal(testAccept(machine, ''), false)
      assert.equal(testAccept(machine, '0'), false)
      assert.equal(testAccept(machine, '1'), false)
    }
  }

  // Concatenation with empty language is empty language: '0∅1' -> ∅
  const concatEmpty = buildRegexPipeline('0∅1', ['0', '1'])
  assert.equal(testAccept(concatEmpty.minimizedDfa, ''), false)
  assert.equal(testAccept(concatEmpty.minimizedDfa, '01'), false)
})

// =========================================================================
// 13. Invalid Expressions and Syntax Rejection
// =========================================================================
test('regex 13: rejects malformed expressions with precise error messages', () => {
  // Empty expression
  assert.throws(() => parseRegex(''), RegexParseError)

  // Unmatched opening parenthesis
  assert.throws(() => parseRegex('(0|1'), (err: any) => {
    return err instanceof RegexParseError && err.message.includes("Unclosed parenthesis '('")
  })

  // Unmatched closing parenthesis
  assert.throws(() => parseRegex('0|1)'), (err: any) => {
    return err instanceof RegexParseError && err.message.includes("Unmatched closing parenthesis ')'")
  })

  // Empty parentheses
  assert.throws(() => parseRegex('0()1'), (err: any) => {
    return err instanceof RegexParseError && err.message.includes("Empty parentheses '()'")
  })

  // Misplaced Kleene star at start
  assert.throws(() => parseRegex('*01'), (err: any) => {
    return err instanceof RegexParseError && err.message.includes("Preceding token to '*' is missing")
  })

  // Misplaced Kleene star after open paren
  assert.throws(() => parseRegex('(*0)'), (err: any) => {
    return err instanceof RegexParseError && err.message.includes("Preceding token to '*' is missing")
  })

  // Dangling union operator at end
  assert.throws(() => parseRegex('0|'), (err: any) => {
    return err instanceof RegexParseError && err.message.includes("Missing right-hand operand for union operator '|'")
  })

  // Dangling union operator at start
  assert.throws(() => parseRegex('|0'), (err: any) => {
    return err instanceof RegexParseError && err.message.includes("Missing left-hand operand for union operator '|'")
  })

  // Consecutive union operators
  assert.throws(() => parseRegex('0||1'), (err: any) => {
    return err instanceof RegexParseError && err.message.includes("Consecutive union operators '||'")
  })

  // Symbol not in declared alphabet
  assert.throws(() => parseRegex('0|2', ['0', '1']), (err: any) => {
    return err instanceof RegexParseError && err.message.includes("Symbol '2' is not in declared alphabet")
  })
})

// =========================================================================
// 14. Transition Table and Diagram Consistency
// =========================================================================
test('regex 14: transition table rows match automaton states and destinations exist', () => {
  const pipeline = buildRegexPipeline('(0|1)*01', ['0', '1'])
  const { nfa, dfa, minimizedDfa } = pipeline

  for (const auto of [nfa, dfa, minimizedDfa]) {
    const table = generateTransitionTable(auto)
    const tableStateIds = table.rows.map((r) => r.state)
    const autoStateIds = auto.states.map((s) => s.id)
    assert.deepEqual(tableStateIds.sort(), autoStateIds.sort())

    // Verify all transition destinations exist in the automaton
    const validIds = new Set(autoStateIds)
    for (const [from, map] of Object.entries(auto.delta)) {
      assert.ok(validIds.has(from), `Source state ${from} must exist`)
      for (const [sym, dests] of Object.entries(map)) {
        for (const dest of dests) {
          assert.ok(validIds.has(dest), `Target state ${dest} on symbol ${sym} must exist in ${auto.name}`)
        }
      }
    }
  }
})

// =========================================================================
// 15. NLP Parser and Solve Problem Integration
// =========================================================================
test('regex 15: nlp-parser parses "Convert regex (0|1)*01 to DFA"', () => {
  const res = parseQuestion('Convert regex (0|1)*01 to DFA')
  assert.equal(res.success, true)
  assert.equal(res.problemSpec?.type, 'regex_to_automata')
  assert.equal(res.problemSpec?.regexString, '(0|1)*01')

  const solution = solveProblem(res.problemSpec!)
  assert.ok(solution.regexPipeline)
  assert.equal(solution.regexPipeline.normalizedRegex, '(0|1)*01')
  assert.ok(solution.transitionTable.rows.length > 0)
  assert.ok(solution.testStrings.length > 0)
})

test('regex 16: AST ASCII tree generation', () => {
  const { ast } = parseRegex('(0|1)*01')
  const tree = printRegexAstTree(ast)
  assert.ok(tree.includes('Concatenation'))
  assert.ok(tree.includes('KleeneStar'))
  assert.ok(tree.includes('Union'))
  assert.ok(tree.includes("Symbol ('0')"))
  assert.ok(tree.includes("Symbol ('1')"))
})
