import type { ProblemSpec, LanguagePattern, ProblemType } from './automata-solver'
import { parseRegex, formatRegexAst } from './regex-parser'
import type { CfgProblemSpec } from './cfg-solver'
import { parseCfgFromText } from './cfg'
import type { PdaProblemSpec } from './pda-solver'
import type { TMProblemSpec } from './turing-solver'
import type { PumpingMyhillSpec } from './pumping-myhill-solver'

export interface ParsedQuestion {
  success: boolean
  problemSpec?: ProblemSpec
  cfgProblemSpec?: CfgProblemSpec
  pdaProblemSpec?: PdaProblemSpec
  tmProblemSpec?: TMProblemSpec
  pumpingMyhillSpec?: PumpingMyhillSpec
  targetDomain?: 'automata' | 'cfg' | 'pda' | 'tm' | 'pumping_myhill'
  needsClarification: boolean
  clarificationPrompt?: string
  clarificationOptions?: string[]
  interpretedIntent?: string
  confidence: number
}

/**
 * Extracts declared alphabet from user prompt.
 * e.g. "over {0,1}", "Σ = {a,b}", "alphabet: 0, 1"
 */
function extractAlphabet(text: string): string[] | null {
  // Pattern 1: {0,1} or {a,b,c}
  const setMatch = text.match(/(?:over|alphabet|Σ|Sigma)\s*[:=]?\s*\{([^}]+)\}/i)
  if (setMatch) {
    const raw = setMatch[1]
    const symbols = raw.split(/[\s,]+/).map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean)
    if (symbols.length > 0) return Array.from(new Set(symbols))
  }

  // Pattern 2: over {0, 1} without explicit keyword
  const braceMatch = text.match(/\{([01abcesxy,\s]+)\}/i)
  if (braceMatch) {
    const symbols = braceMatch[1].split(/[\s,]+/).map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean)
    if (symbols.length > 0 && symbols.length <= 6) return Array.from(new Set(symbols))
  }

  return null
}

/**
 * Normalizes input text for keyword matching.
 */
function cleanText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

function wordToNumber(w: string): number {
  const map: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  }
  const clean = w.toLowerCase().trim()
  if (map[clean] !== undefined) return map[clean]
  const parsed = parseInt(clean, 10)
  return isNaN(parsed) ? 1 : parsed
}

export function extractAtomicPattern(phrase: string): LanguagePattern | null {
  const t = phrase.trim().toLowerCase()

  // Every X followed by Y
  const everyXFollowedByY = t.match(
    /(?:every|each)\s+['"`]?([0-9a-zA-Z])['"`]?\s+is\s+(?:immediately\s+)?followed\s+by\s+['"`]?([0-9a-zA-Z])['"`]?/i,
  )
  if (everyXFollowedByY) {
    let x = everyXFollowedByY[1]
    let y = everyXFollowedByY[2]
    if (x === 'zero' || x === 'zeros') x = '0'
    if (x === 'one' || x === 'ones') x = '1'
    if (y === 'zero' || y === 'zeros') y = '0'
    if (y === 'one' || y === 'ones') y = '1'
    return { kind: 'every_x_followed_by_y', symbol: x, followedBySymbol: y }
  }

  // Decimal divisible
  const decDiv =
    t.match(/(?:decimal|base\s*10)\s+(?:values?|numbers?|integers?|strings?)?\s*(?:is\s+)?divisible\s+by\s+(\d+)/i) ||
    t.match(/divisible\s+by\s+(\d+)\s+in\s+decimal/i)
  if (decDiv) {
    return { kind: 'decimal_divisible', divisor: parseInt(decDiv[1], 10) }
  }

  // Substring count at least
  const subCount = t.match(
    /(?:contains?|containing)\s+(?:the\s+)?(?:substring\s+)?["'`]?([0-9a-zA-Z]+)["'`]?\s+at\s+least\s+(\d+|zero|one|two|three|four|five)\s+times/i,
  )
  if (subCount) {
    return {
      kind: 'substring_count_at_least',
      paramString: subCount[1],
      times: wordToNumber(subCount[2]),
    }
  }

  // Exact count of symbol
  const exactCount = t.match(
    /(?:contains?\s+)?(?:exactly|exact\s+count\s+of)\s+(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+([0-9a-zA-Z]+)(?:s|'s)?/i,
  )
  if (exactCount) {
    let sym = exactCount[2]
    if (sym === 'zero' || sym === 'zeros') sym = '0'
    if (sym === 'one' || sym === 'ones') sym = '1'
    return { kind: 'exact_count', k: wordToNumber(exactCount[1]), symbol: sym }
  }

  // Length at most
  const lenAtMost = t.match(
    /length\s+(?:is\s+)?(?:at\s+most|<=|no\s+more\s+than|maximum\s+of|less\s+than\s+or\s+equal\s+to)\s+(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)/i,
  )
  if (lenAtMost) {
    return { kind: 'at_most_length', k: wordToNumber(lenAtMost[1]) }
  }

  // Exact length
  const exactLen =
    t.match(/(?:exact\s+length|length\s+(?:is\s+)?(?:exactly|equal\s+to|=))\s+(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)/i) ||
    t.match(/strings\s+of\s+length\s+(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/i)
  if (exactLen) {
    return { kind: 'exact_length', k: wordToNumber(exactLen[1]) }
  }

  // Length at least
  const lenAtLeast = t.match(
    /length\s+(?:is\s+)?(?:at\s+least|>=|minimum\s+of|greater\s+than\s+or\s+equal\s+to)\s+(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)/i,
  )
  if (lenAtLeast) {
    return { kind: 'at_least_length', k: wordToNumber(lenAtLeast[1]) }
  }

  // Avoids / Does not contain substring
  const avoid = t.match(
    /(?:does\s+not\s+contain|not\s+containing|without(?:\s+the)?\s+substring|avoids?)\s+(?:the\s+)?(?:substring\s+)?["'`]?([0-9a-zA-Z]+)["'`]?/i,
  )
  if (avoid && avoid[1] !== 'an' && avoid[1] !== 'a') {
    return { kind: 'avoid_substring', paramString: avoid[1] }
  }

  // Starts with
  const starts = t.match(
    /(?:starts?|starting|begins?|beginning)\s+with\s+["'`]?([0-9a-zA-Z]+)["'`]?/i,
  )
  if (starts) {
    return { kind: 'starts_with', paramString: starts[1] }
  }

  // Ends with
  const ends = t.match(
    /(?:ends?|ending)\s+(?:in|with)\s+["'`]?([0-9a-zA-Z]+)["'`]?/i,
  )
  if (ends) {
    return { kind: 'ends_with', paramString: ends[1] }
  }

  // Contains substring
  const contains = t.match(
    /(?:contains?|containing)\s+(?:the\s+)?(?:substring\s+)?["'`]?([0-9a-zA-Z]+)["'`]?/i,
  )
  if (contains && contains[1] !== 'an' && contains[1] !== 'a' && contains[1] !== 'no') {
    return { kind: 'contains_substring', paramString: contains[1] }
  }

  // Parity
  const parity = t.match(/(even|odd)\s+(?:number|count)\s+of\s+([0-9a-zA-Z]+)(?:s|'s)?/i)
  if (parity) {
    let sym = parity[2]
    if (sym === 'zero' || sym === 'zeros') sym = '0'
    if (sym === 'one' || sym === 'ones') sym = '1'
    return {
      kind: 'symbol_parity',
      parity: parity[1].toLowerCase() as 'even' | 'odd',
      symbol: sym,
    }
  }

  // At most
  const atMost = t.match(
    /(?:at\s+most|no\s+more\s+than|maximum\s+of|less\s+than\s+or\s+equal\s+to|<=)\s+(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+([0-9a-zA-Z]+)(?:s|'s)?/i,
  )
  if (atMost) {
    let sym = atMost[2]
    if (sym === 'zero' || sym === 'zeros') sym = '0'
    if (sym === 'one' || sym === 'ones') sym = '1'
    return { kind: 'at_most_count', k: wordToNumber(atMost[1]), symbol: sym }
  }

  // At least
  const atLeast = t.match(
    /(?:at\s+least|minimum\s+of|greater\s+than\s+or\s+equal\s+to|>=)\s+(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+([0-9a-zA-Z]+)(?:s|'s)?/i,
  )
  if (atLeast) {
    let sym = atLeast[2]
    if (sym === 'zero' || sym === 'zeros') sym = '0'
    if (sym === 'one' || sym === 'ones') sym = '1'
    return { kind: 'at_least_count', k: wordToNumber(atLeast[1]), symbol: sym }
  }

  // Symbol count divisible
  const symDiv =
    t.match(/(?:number|count)\s+of\s+([0-9a-zA-Z]+)(?:s|'s)?\s+(?:is\s+)?divisible\s+by\s+(\d+)/i) ||
    t.match(/(?:number|count)\s+of\s+([0-9a-zA-Z]+)(?:s|'s)?\s+mod(?:ulo)?\s+(\d+)\s*(?:=|equals?)\s*(\d+)/i)
  if (symDiv) {
    let sym = symDiv[1]
    if (sym === 'zero' || sym === 'zeros') sym = '0'
    if (sym === 'one' || sym === 'ones') sym = '1'
    return {
      kind: 'symbol_count_divisible',
      symbol: sym,
      divisor: parseInt(symDiv[2], 10),
      remainder: symDiv[3] ? parseInt(symDiv[3], 10) : 0,
    }
  }

  // Length divisible
  const lenDiv = t.match(/length\s+(?:is\s+)?divisible\s+by\s+(\d+)/i)
  if (lenDiv) {
    return { kind: 'length_divisible', divisor: parseInt(lenDiv[1], 10), remainder: 0 }
  }

  // Binary divisible
  const binDiv = t.match(/binary\s+(?:value|number)?\s*(?:is\s+)?divisible\s+by\s+(\d+)/i)
  if (binDiv) {
    return { kind: 'binary_divisible', divisor: parseInt(binDiv[1], 10) }
  }

  // No consecutive
  const noConsec = t.match(/(?:no|without)\s+consecutive\s+([0-9a-zA-Z]+)(?:s|'s)?/i)
  if (noConsec) {
    let sym = noConsec[1]
    if (sym === 'zero' || sym === 'zeros') sym = '0'
    if (sym === 'one' || sym === 'ones') sym = '1'
    return { kind: 'no_consecutive', symbol: sym }
  }

  // Bare pattern (like "00" or "011")
  const bare = t.match(/^["'`]?([0-9a-zA-Z]+)["'`]?$/i)
  if (bare && bare[1] !== 'and' && bare[1] !== 'or' && bare[1] !== 'not') {
    return { kind: 'contains_substring', paramString: bare[1] }
  }

  return null
}

function stripCommandPrefix(text: string): string {
  return text
    .replace(/[.,;?!]+$/, '')
    .replace(
      /^(?:construct|design|build|create|give|find|make)?\s*(?:a|an)?\s*(?:deterministic\s+finite\s+automaton|dfa|nfa|automaton|machine)?\s*(?:over\s*\{[^}]+\})?\s*(?:that|which)?\s*(?:accepts?|accepting)?\s*(?:strings?)?\s*(?:such\s+that)?\s*(?:where\s+)?/i,
      '',
    )
    .trim()
}

function extractSymbolsFromPattern(pat: LanguagePattern): string[] {
  const syms: string[] = []
  if (pat.paramString) syms.push(...pat.paramString.split(''))
  if (pat.symbol) syms.push(pat.symbol)
  if (pat.followedBySymbol) syms.push(pat.followedBySymbol)
  if (pat.startSymbol) syms.push(...pat.startSymbol.split(''))
  if (pat.endSymbol) syms.push(...pat.endSymbol.split(''))
  if (pat.secondSymbol) syms.push(pat.secondSymbol)
  if (pat.firstPattern) syms.push(...extractSymbolsFromPattern(pat.firstPattern))
  if (pat.secondPattern) syms.push(...extractSymbolsFromPattern(pat.secondPattern))
  if (pat.targetPattern) syms.push(...extractSymbolsFromPattern(pat.targetPattern))
  return syms
}

function getPatternIntentDescription(pat: LanguagePattern): string {
  switch (pat.kind) {
    case 'starts_with':
      return `starts with "${pat.paramString}"`
    case 'ends_with':
      return `ends with "${pat.paramString}"`
    case 'contains_substring':
      return `contains substring "${pat.paramString}"`
    case 'avoid_substring':
      return `does not contain substring "${pat.paramString}"`
    case 'symbol_parity':
      return `${pat.parity} number of "${pat.symbol}"s`
    case 'at_most_count':
      return `at most ${pat.k} "${pat.symbol}"s`
    case 'at_least_count':
      return `at least ${pat.k} "${pat.symbol}"s`
    case 'exact_count':
      return `exactly ${pat.k} "${pat.symbol}"s`
    case 'at_most_length':
      return `length at most ${pat.k}`
    case 'exact_length':
      return `exact length ${pat.k}`
    case 'at_least_length':
      return `length at least ${pat.k}`
    case 'every_x_followed_by_y':
      return `every "${pat.symbol}" is followed by "${pat.followedBySymbol}"`
    case 'substring_count_at_least':
      return `contains "${pat.paramString}" at least ${pat.times} times`
    case 'decimal_divisible':
      return `decimal value divisible by ${pat.divisor}`
    case 'symbol_count_divisible':
      return `count of "${pat.symbol}"s mod ${pat.divisor} = ${pat.remainder ?? 0}`
    case 'binary_divisible':
      return `binary value divisible by ${pat.divisor}`
    case 'length_divisible':
      return `length divisible by ${pat.divisor}`
    case 'no_consecutive':
      return `no consecutive "${pat.symbol}"s`
    default:
      return pat.kind
  }
}

/**
 * Parses a natural language automata question into a formal ProblemSpec or requests clarification.
 */
export function parseQuestion(rawPrompt: string): ParsedQuestion {
  const text = cleanText(rawPrompt)
  let alphabet = extractAlphabet(rawPrompt)

  // 0000. Check for Pumping Lemma & Myhill–Nerode Theorem Queries
  const isPumpingMyhillQuery =
    /pumping lemma|pumping|myhill[- ]nerode|myhill|distinguish(?:ing|able)|non[- ]regular|not regular|prove (?:that )?.*(?:is not|not) regular/i.test(
      text,
    )

  if (isPumpingMyhillQuery) {
    // 0000A. Vague request -> Clarification
    if (
      text.trim() === 'pumping lemma' ||
      text.trim() === 'myhill-nerode' ||
      text.trim() === 'myhill nerode' ||
      /^prove (?:not regular|non-regular)$/i.test(text.trim()) ||
      text.trim() === 'pumping'
    ) {
      return {
        success: false,
        targetDomain: 'pumping_myhill',
        needsClarification: true,
        clarificationPrompt: 'Please specify the target language or operation for the Pumping Lemma or Myhill–Nerode Theorem. For example:',
        clarificationOptions: [
          'Prove {0^n 1^n | n ≥ 0} is not regular using the Pumping Lemma',
          'Prove {a^n b^n c^n | n ≥ 0} is not regular using the Pumping Lemma',
          'Prove palindromes over {0,1} are not regular',
          'Prove {ww | w ∈ {0,1}*} is not regular',
          'Apply Myhill-Nerode Theorem to {0^n 1^n}',
          'Find distinguishing suffix for strings 0 and 01',
        ],
        confidence: 0.8,
      }
    }

    // 0000B. Distinguishing Suffix Queries
    if (/distinguish/i.test(text) && !/myhill/i.test(text)) {
      const matchPair =
        text.match(/(?:for|strings?)\s+["'`]?([0-9a-zA-Z]+)["'`]?\s+(?:and|with|,)\s+["'`]?([0-9a-zA-Z]+)["'`]?/i) ||
        text.match(/["']([0-9a-zA-Z]+)["']\s+(?:and|,)\s+["']([0-9a-zA-Z]+)["']/)

      const sX = matchPair ? matchPair[1] : '0'
      const sY = matchPair ? matchPair[2] : '01'

      return {
        success: true,
        targetDomain: 'pumping_myhill',
        pumpingMyhillSpec: {
          type: 'distinguishing_suffix',
          pattern: 'ends_with_01',
          stringX: sX,
          stringY: sY,
          alphabet: alphabet || ['0', '1'],
        },
        needsClarification: false,
        interpretedIntent: `Find distinguishing suffix for strings "${sX}" and "${sY}".`,
        confidence: 0.98,
      }
    }

    // 0000C. Myhill-Nerode Theorem Queries
    if (/myhill[- ]nerode|myhill/i.test(text)) {
      let pattern = 'an_bn'
      if (/palindrome/i.test(text)) pattern = 'palindromes'
      else if (/ends with 01/i.test(text)) pattern = 'ends_with_01'

      return {
        success: true,
        targetDomain: 'pumping_myhill',
        pumpingMyhillSpec: {
          type: 'myhill_nerode_analysis',
          pattern,
          alphabet: alphabet || ['0', '1'],
        },
        needsClarification: false,
        interpretedIntent: `Analyze language via Myhill–Nerode Theorem.`,
        confidence: 0.98,
      }
    }

    // 0000D. Pumping Lemma Non-Regularity Proofs
    let nonRegPattern:
      | 'an_bn'
      | 'an_bn_cn'
      | 'palindromes'
      | 'ww'
      | 'square_length'
      | 'prime_length'
      | 'an_bm_n_gt_m'
      | 'an_b2n'
      | 'equal_zeros_ones' = 'an_bn'

    if (
      /a\s*(?:\^?\s*n|ⁿ|\^n)\s*b\s*(?:\^?\s*n|ⁿ|\^n)\s*c\s*(?:\^?\s*n|ⁿ|\^n)|0\s*(?:\^?\s*n|ⁿ|\^n)\s*1\s*(?:\^?\s*n|ⁿ|\^n)\s*2\s*(?:\^?\s*n|ⁿ|\^n)|an\s*bn\s*cn|a\^n\s*b\^n\s*c\^n/i.test(
        text,
      )
    ) {
      nonRegPattern = 'an_bn_cn'
    } else if (/palindrome/i.test(text)) {
      nonRegPattern = 'palindromes'
    } else if (/\bww\b|w\s*w|repeat|duplicate/i.test(text)) {
      nonRegPattern = 'ww'
    } else if (/square|n\s*[\^2²]/i.test(text)) {
      nonRegPattern = 'square_length'
    } else if (/prime/i.test(text)) {
      nonRegPattern = 'prime_length'
    } else if (/equal (?:number|numbers|count) of/i.test(text)) {
      nonRegPattern = 'equal_zeros_ones'
    } else if (
      /a\s*(?:\^?\s*n|ⁿ|\^n)\s*b\s*(?:\^?\s*2n|²n|2\s*n|\^2n)|an\s*b2n|a\^n\s*b\^2n/i.test(text)
    ) {
      nonRegPattern = 'an_b2n'
    } else if (/n\s*>\s*m|more 0s than 1s/i.test(text)) {
      nonRegPattern = 'an_bm_n_gt_m'
    } else {
      nonRegPattern = 'an_bn'
    }

    return {
      success: true,
      targetDomain: 'pumping_myhill',
      pumpingMyhillSpec: {
        type: 'pumping_lemma_proof',
        pattern: nonRegPattern,
        alphabet: alphabet || ['0', '1'],
      },
      needsClarification: false,
      interpretedIntent: `Prove that target language is not regular using the Pumping Lemma.`,
      confidence: 0.98,
    }
  }

  // 000. Check for Turing Machine (TM) Queries
  const isExplicitTmQuery =
    /turing machine|\btm\b|multi[- ]tape|tape head|instantaneous description/i.test(text) ||
    /a\s*[\^nⁿ]\s*b\s*[\^nⁿ]\s*c\s*[\^nⁿ]|0\s*[\^nⁿ]\s*1\s*[\^nⁿ]\s*2\s*[\^nⁿ]|an\s*bn\s*cn/i.test(text) ||
    /unary addition/i.test(text)

  if (isExplicitTmQuery) {
    // 000A. Vague TM request -> Ask for clarification
    if (/^construct (?:a )?(?:tm|turing machine)$/i.test(text.trim()) || text.trim() === 'tm' || text.trim() === 'turing machine') {
      return {
        success: false,
        targetDomain: 'tm',
        needsClarification: true,
        clarificationPrompt: 'Please specify the target language or operation for the Turing Machine. For example:',
        clarificationOptions: [
          'Construct a TM that accepts a^n b^n c^n',
          'Construct a TM for palindromes over {0,1}',
          'Construct a TM that accepts strings containing equal numbers of 0s and 1s',
          'Construct a TM that accepts a^n b^n',
          'Construct a TM that performs unary addition',
          'Construct a TM for binary divisibility by 3',
          'Construct a multi-tape Turing machine for palindromes',
        ],
        confidence: 0.8,
      }
    }

    // 000B. Multi-tape TM request
    const isMultiTape = /multi[- ]tape/i.test(text)

    // 000C. Simulation / Tracing
    if (/simulate|trace|run/i.test(text)) {
      const quotedMatch = text.match(/["']([0-9a-zA-Z()]+)["']/)
      const wordMatch = text.match(/(?:for|string|on|input)\s+(?:string\s+|input\s+)?([0-9a-zA-Z()]+)/i)
      const targetStr = quotedMatch ? quotedMatch[1] : wordMatch ? wordMatch[1] : 'aabbcc'
      return {
        success: true,
        targetDomain: 'tm',
        tmProblemSpec: {
          type: 'tm_simulation',
          targetString: targetStr,
          isMultiTape,
        },
        needsClarification: false,
        interpretedIntent: `Simulate Turing Machine on input "${targetStr}".`,
        confidence: 0.95,
      }
    }

    // 000D. Language Patterns
    // a^n b^n c^n
    if (/a\s*[\^nⁿ]\s*b\s*[\^nⁿ]\s*c\s*[\^nⁿ]|0\s*[\^nⁿ]\s*1\s*[\^nⁿ]\s*2\s*[\^nⁿ]|an\s*bn\s*cn/i.test(text)) {
      const anbncnAlphabet = /a/.test(text) ? ['a', 'b', 'c'] : ['0', '1', '2']
      return {
        success: true,
        targetDomain: 'tm',
        tmProblemSpec: {
          type: 'tm_from_language',
          languagePattern: 'an_bn_cn',
          alphabet: alphabet || anbncnAlphabet,
          isMultiTape,
        },
        needsClarification: false,
        interpretedIntent: `Construct Turing Machine for ${anbncnAlphabet[0]}ⁿ${anbncnAlphabet[1]}ⁿ${anbncnAlphabet[2]}ⁿ.`,
        confidence: 0.98,
      }
    }

    // Unary addition
    if (/unary addition|1\s*[\^mᵐ]\s*0\s*1\s*[\^nⁿ]|addition on (?:a )?turing machine/i.test(text)) {
      return {
        success: true,
        targetDomain: 'tm',
        tmProblemSpec: {
          type: 'tm_from_language',
          languagePattern: 'unary_addition',
          alphabet: ['0', '1'],
          isMultiTape,
        },
        needsClarification: false,
        interpretedIntent: 'Construct Turing Machine that computes unary addition (1ᵐ01ⁿ → 1ᵐ⁺ⁿ).',
        confidence: 0.98,
      }
    }

    // Binary divisibility
    const divMatch = text.match(/divisib(?:le|ility) by (\d+)/i)
    if (divMatch && /binary/i.test(text)) {
      const divisor = parseInt(divMatch[1], 10)
      return {
        success: true,
        targetDomain: 'tm',
        tmProblemSpec: {
          type: 'tm_from_language',
          languagePattern: 'binary_divisibility',
          divisor,
          alphabet: ['0', '1'],
          isMultiTape,
        },
        needsClarification: false,
        interpretedIntent: `Construct Turing Machine to test binary divisibility by ${divisor}.`,
        confidence: 0.96,
      }
    }

    // Palindromes
    if (/palindrome/i.test(text)) {
      const palAlphabet = /a/.test(text) ? ['a', 'b'] : ['0', '1']
      return {
        success: true,
        targetDomain: 'tm',
        tmProblemSpec: {
          type: isMultiTape ? 'multi_tape_tm' : 'tm_from_language',
          languagePattern: 'palindromes',
          alphabet: alphabet || palAlphabet,
          isMultiTape,
        },
        needsClarification: false,
        interpretedIntent: `Construct ${isMultiTape ? 'Multi-Tape ' : ''}Turing Machine for palindromes over {${(alphabet || palAlphabet).join(', ')}}.`,
        confidence: 0.96,
      }
    }

    // Equal 0s and 1s
    if (/equal (?:number|numbers|count) of/i.test(text)) {
      const eqAlphabet = /0/.test(text) ? ['0', '1'] : ['a', 'b']
      return {
        success: true,
        targetDomain: 'tm',
        tmProblemSpec: {
          type: 'tm_from_language',
          languagePattern: 'equal_zeros_ones',
          alphabet: alphabet || eqAlphabet,
          isMultiTape,
        },
        needsClarification: false,
        interpretedIntent: `Construct Turing Machine for strings containing equal numbers of ${eqAlphabet[0]}'s and ${eqAlphabet[1]}'s.`,
        confidence: 0.96,
      }
    }

    // a^n b^n
    if (/a\s*[\^nⁿ]\s*b\s*[\^nⁿ]|0\s*[\^nⁿ]\s*1\s*[\^nⁿ]|an\s*bn/i.test(text)) {
      const anbnAlphabet = /a/.test(text) ? ['a', 'b'] : ['0', '1']
      return {
        success: true,
        targetDomain: 'tm',
        tmProblemSpec: {
          type: 'tm_from_language',
          languagePattern: 'an_bn',
          alphabet: alphabet || anbnAlphabet,
          isMultiTape,
        },
        needsClarification: false,
        interpretedIntent: `Construct Turing Machine for ${anbnAlphabet[0]}ⁿ${anbnAlphabet[1]}ⁿ.`,
        confidence: 0.96,
      }
    }

    // String reversal
    if (/reverse|reversal/i.test(text)) {
      return {
        success: true,
        targetDomain: 'tm',
        tmProblemSpec: {
          type: 'tm_from_language',
          languagePattern: 'string_reversal',
          alphabet: alphabet || ['0', '1'],
          isMultiTape,
        },
        needsClarification: false,
        interpretedIntent: 'Construct Turing Machine that reverses a string.',
        confidence: 0.95,
      }
    }

    // Fallback TM question
    return {
      success: true,
      targetDomain: 'tm',
      tmProblemSpec: {
        type: isMultiTape ? 'multi_tape_tm' : 'tm_from_language',
        languagePattern: 'an_bn_cn',
        alphabet: alphabet || ['a', 'b', 'c'],
        isMultiTape,
      },
      needsClarification: false,
      interpretedIntent: 'Construct canonical Turing Machine for aⁿbⁿcⁿ.',
      confidence: 0.85,
    }
  }

  // 00. Check for Pushdown Automata (PDA) Queries
  const isExplicitPdaQuery =
    /pushdown automaton|pushdown automata|\bpda\b|cfg to pda|pda to cfg|stack machine/i.test(text)

  if (isExplicitPdaQuery) {
    // 00A. Vague PDA request -> Ask for clarification
    if (/^construct (?:a )?(?:pda|pushdown automaton|pushdown automata)$/i.test(text.trim()) || text.trim() === 'pda') {
      return {
        success: false,
        targetDomain: 'pda',
        needsClarification: true,
        clarificationPrompt: 'Please specify the target language or operation for the Pushdown Automaton (PDA). For example:',
        clarificationOptions: [
          'Construct a PDA for a^n b^n',
          'Construct a PDA for balanced parentheses',
          'Construct a PDA for palindromes over {0,1}',
          'Construct a PDA for strings containing equal numbers of 0s and 1s',
          'Convert CFG to PDA',
          'Convert PDA to CFG',
        ],
        confidence: 0.8,
      }
    }

    // 00B. CFG to PDA
    if (/convert (?:a )?cfg (?:in)?to (?:a )?pda|cfg to pda/i.test(text)) {
      return {
        success: true,
        targetDomain: 'pda',
        pdaProblemSpec: {
          type: 'cfg_to_pda',
        },
        needsClarification: false,
        interpretedIntent: 'Convert Context-Free Grammar (CFG) to equivalent Pushdown Automaton (PDA).',
        confidence: 0.98,
      }
    }

    // 00C. PDA to CFG
    if (/convert (?:a )?pda (?:in)?to (?:a )?cfg|pda to cfg/i.test(text)) {
      return {
        success: true,
        targetDomain: 'pda',
        pdaProblemSpec: {
          type: 'pda_to_cfg',
        },
        needsClarification: false,
        interpretedIntent: 'Convert Pushdown Automaton (PDA) to equivalent Context-Free Grammar (CFG).',
        confidence: 0.98,
      }
    }

    // 00D. Simulation / Tracing
    if (/simulate|trace|run/i.test(text)) {
      const quotedMatch = text.match(/["']([0-9a-zA-Z()]+)["']/)
      const wordMatch = text.match(/(?:for|string|on|input)\s+(?:string\s+|input\s+)?([0-9a-zA-Z()]+)/i)
      const targetStr = quotedMatch ? quotedMatch[1] : wordMatch ? wordMatch[1] : '0011'
      return {
        success: true,
        targetDomain: 'pda',
        pdaProblemSpec: {
          type: 'pda_simulation',
          targetString: targetStr,
        },
        needsClarification: false,
        interpretedIntent: `Simulate Pushdown Automaton on input "${targetStr}".`,
        confidence: 0.95,
      }
    }

    // 00E. Language Patterns for PDA
    // a^n b^n
    if (/a\s*[\^nⁿ]\s*b\s*[\^nⁿ]|0\s*[\^nⁿ]\s*1\s*[\^nⁿ]|a\^n\s*b\^n|0\^n\s*1\^n|an\s*bn|0n\s*1n/i.test(text)) {
      const anbnAlphabet = /a/.test(text) ? ['a', 'b'] : ['0', '1']
      return {
        success: true,
        targetDomain: 'pda',
        pdaProblemSpec: {
          type: 'pda_from_language',
          languagePattern: 'an_bn',
          alphabet: alphabet || anbnAlphabet,
        },
        needsClarification: false,
        interpretedIntent: `Construct Pushdown Automaton for ${anbnAlphabet[0]}ⁿ${anbnAlphabet[1]}ⁿ.`,
        confidence: 0.96,
      }
    }

    // Balanced parentheses
    if (/balanced parenthes[ie]s|balanced brackets/i.test(text)) {
      return {
        success: true,
        targetDomain: 'pda',
        pdaProblemSpec: {
          type: 'pda_from_language',
          languagePattern: 'balanced_parentheses',
          alphabet: ['(', ')'],
        },
        needsClarification: false,
        interpretedIntent: 'Construct Pushdown Automaton for balanced parentheses.',
        confidence: 0.96,
      }
    }

    // Palindromes
    if (/palindrome/i.test(text)) {
      const palAlphabet = /a/.test(text) ? ['a', 'b'] : ['0', '1']
      return {
        success: true,
        targetDomain: 'pda',
        pdaProblemSpec: {
          type: 'pda_from_language',
          languagePattern: 'palindromes',
          alphabet: alphabet || palAlphabet,
        },
        needsClarification: false,
        interpretedIntent: `Construct Pushdown Automaton for palindromes over {${(alphabet || palAlphabet).join(', ')}}.`,
        confidence: 0.96,
      }
    }

    // Equal 0s and 1s or equal a's and b's
    if (/equal (?:number|numbers|count) of/i.test(text)) {
      const eqAlphabet = /0/.test(text) ? ['0', '1'] : ['a', 'b']
      return {
        success: true,
        targetDomain: 'pda',
        pdaProblemSpec: {
          type: 'pda_from_language',
          languagePattern: 'equal_zeros_ones',
          alphabet: alphabet || eqAlphabet,
        },
        needsClarification: false,
        interpretedIntent: `Construct Pushdown Automaton for strings with equal numbers of ${eqAlphabet[0]}'s and ${eqAlphabet[1]}'s.`,
        confidence: 0.96,
      }
    }

    // Fallback PDA question if pattern not specified
    return {
      success: true,
      targetDomain: 'pda',
      pdaProblemSpec: {
        type: 'pda_from_language',
        languagePattern: 'an_bn',
        alphabet: alphabet || ['0', '1'],
      },
      needsClarification: false,
      interpretedIntent: 'Construct canonical Pushdown Automaton.',
      confidence: 0.85,
    }
  }

  // 0. Check for Context-Free Grammar (CFG) Queries
  const isExplicitCfgQuery =
    /context[- ]free grammar|cfg|parse tree|leftmost derivation|rightmost derivation|chomsky normal form|\bcnf\b|\bcyk\b|ambigu(?:ous|ity)/i.test(
      text,
    ) ||
    (/grammar/i.test(text) && !/regular expression/i.test(text)) ||
    (/palindrome/i.test(text) && !/dfa|nfa|automaton|finite/i.test(text)) ||
    (/equal (?:number|numbers|count) of (?:a|0)/i.test(text) && !/dfa|nfa|automaton|finite/i.test(text)) ||
    /balanced parenthes[ie]s|balanced brackets/i.test(text)

  if (isExplicitCfgQuery) {
    // 0A. Vague CFG request -> Ask for clarification
    if (/^construct (?:a )?(?:cfg|context[- ]free grammar)$/i.test(text.trim()) || text.trim() === 'cfg') {
      return {
        success: false,
        targetDomain: 'cfg',
        needsClarification: true,
        clarificationPrompt: 'Please specify the target language or operation for the Context-Free Grammar. For example:',
        clarificationOptions: [
          "Construct a CFG for strings with equal numbers of a's and b's",
          'Construct a CFG for palindromes over {0,1}',
          'Construct a CFG for 0ⁿ1ⁿ',
          'Construct a CFG for balanced parentheses',
          'Convert a grammar into CNF',
          'Demonstrate ambiguity with two parse trees',
        ],
        confidence: 0.8,
      }
    }

    // 0B. Ambiguity Analysis
    if (/ambigu(?:ous|ity)|two parse trees|distinct parse trees/i.test(text)) {
      const stringMatch = text.match(/(?:for|string)\s+["'`]?([0-9a-zA-Z+*()]+)["'`]?/i)
      return {
        success: true,
        targetDomain: 'cfg',
        cfgProblemSpec: {
          type: 'cfg_ambiguity_analysis',
          languagePattern: 'ambiguous_arithmetic',
          targetString: stringMatch ? stringMatch[1] : undefined,
        },
        needsClarification: false,
        interpretedIntent: 'Analyze Context-Free Grammar for ambiguity and find dual parse trees.',
        confidence: 0.95,
      }
    }

    // 0C. Leftmost Derivation
    if (/leftmost derivation/i.test(text)) {
      const stringMatch = text.match(/(?:of|for)\s+["'`]?([0-9a-zA-Z+*()ε^]+)["'`]?/i)
      const targetStr = stringMatch ? stringMatch[1] : undefined
      return {
        success: true,
        targetDomain: 'cfg',
        cfgProblemSpec: {
          type: 'cfg_leftmost_derivation',
          targetString: targetStr,
        },
        needsClarification: false,
        interpretedIntent: `Compute leftmost derivation${targetStr ? ` for string "${targetStr}"` : ''}.`,
        confidence: 0.95,
      }
    }

    // 0D. Rightmost Derivation
    if (/rightmost derivation/i.test(text)) {
      const stringMatch = text.match(/(?:of|for)\s+["'`]?([0-9a-zA-Z+*()ε^]+)["'`]?/i)
      const targetStr = stringMatch ? stringMatch[1] : undefined
      return {
        success: true,
        targetDomain: 'cfg',
        cfgProblemSpec: {
          type: 'cfg_rightmost_derivation',
          targetString: targetStr,
        },
        needsClarification: false,
        interpretedIntent: `Compute rightmost derivation${targetStr ? ` for string "${targetStr}"` : ''}.`,
        confidence: 0.95,
      }
    }

    // 0E. Parse Tree
    if (/parse tree/i.test(text)) {
      const stringMatch = text.match(/(?:of|for)\s+["'`]?([0-9a-zA-Z+*()ε^]+)["'`]?/i)
      const targetStr = stringMatch ? stringMatch[1] : undefined
      return {
        success: true,
        targetDomain: 'cfg',
        cfgProblemSpec: {
          type: 'cfg_parse_tree',
          targetString: targetStr,
        },
        needsClarification: false,
        interpretedIntent: `Construct hierarchical parse tree${targetStr ? ` for string "${targetStr}"` : ''}.`,
        confidence: 0.95,
      }
    }

    // 0F. Chomsky Normal Form (CNF) Conversion
    if (/chomsky normal form|\bcnf\b/i.test(text)) {
      const parsedGrammar = rawPrompt.includes('->') || rawPrompt.includes('→') ? parseCfgFromText(rawPrompt).grammar : undefined
      return {
        success: true,
        targetDomain: 'cfg',
        cfgProblemSpec: {
          type: 'cfg_cnf_conversion',
          givenGrammar: parsedGrammar,
        },
        needsClarification: false,
        interpretedIntent: 'Convert Context-Free Grammar into Chomsky Normal Form (CNF).',
        confidence: 0.95,
      }
    }

    // 0G. Simplification / Remove Epsilon / Remove Unit / Remove Useless
    if (/simplify|remove (?:epsilon|ε)|eliminate (?:epsilon|ε)|remove unit|remove useless/i.test(text)) {
      const parsedGrammar = rawPrompt.includes('->') || rawPrompt.includes('→') ? parseCfgFromText(rawPrompt).grammar : undefined
      return {
        success: true,
        targetDomain: 'cfg',
        cfgProblemSpec: {
          type: 'cfg_simplification',
          givenGrammar: parsedGrammar,
        },
        needsClarification: false,
        interpretedIntent: 'Simplify Context-Free Grammar (eliminate ε-productions, unit productions, useless symbols).',
        confidence: 0.95,
      }
    }

    // 0H. CYK Parsing / Membership
    if (/\bcyk\b|cocke[- ]younger[- ]kasami|belongs? to (?:the )?grammar/i.test(text)) {
      const stringMatch = text.match(/(?:string|of)\s+["'`]?([0-9a-zA-Z+*()ε^]+)["'`]?/i)
      const targetStr = stringMatch ? stringMatch[1] : undefined
      return {
        success: true,
        targetDomain: 'cfg',
        cfgProblemSpec: {
          type: 'cfg_cyk_parsing',
          targetString: targetStr,
        },
        needsClarification: false,
        interpretedIntent: `Verify string membership${targetStr ? ` for "${targetStr}"` : ''} via CYK dynamic programming.`,
        confidence: 0.95,
      }
    }

    // 0I. CFG Construction: Equal numbers of a's and b's
    if (/equal (?:number|numbers|count) of (?:a'?s? and b'?s?|0'?s? and 1'?s?)/i.test(text)) {
      const abAlphabet = /0/.test(text) ? ['0', '1'] : ['a', 'b']
      return {
        success: true,
        targetDomain: 'cfg',
        cfgProblemSpec: {
          type: 'cfg_from_language',
          languagePattern: 'equal_symbols',
          alphabet: alphabet || abAlphabet,
        },
        needsClarification: false,
        interpretedIntent: `Construct Context-Free Grammar for strings with equal numbers of ${abAlphabet[0]}'s and ${abAlphabet[1]}'s.`,
        confidence: 0.96,
      }
    }

    // 0J. CFG Construction: Palindromes
    if (/palindrome/i.test(text)) {
      const palAlphabet = /a/.test(text) ? ['a', 'b'] : ['0', '1']
      return {
        success: true,
        targetDomain: 'cfg',
        cfgProblemSpec: {
          type: 'cfg_from_language',
          languagePattern: 'palindromes',
          alphabet: alphabet || palAlphabet,
        },
        needsClarification: false,
        interpretedIntent: `Construct Context-Free Grammar for palindromes over {${(alphabet || palAlphabet).join(', ')}}.`,
        confidence: 0.96,
      }
    }

    // 0K. CFG Construction: 0ⁿ1ⁿ / aⁿbⁿ
    if (/0\s*[\^nⁿ]\s*1\s*[\^nⁿ]|a\s*[\^nⁿ]\s*b\s*[\^nⁿ]/i.test(text)) {
      const anbnAlphabet = /a/.test(text) ? ['a', 'b'] : ['0', '1']
      return {
        success: true,
        targetDomain: 'cfg',
        cfgProblemSpec: {
          type: 'cfg_from_language',
          languagePattern: 'an_bn',
          alphabet: alphabet || anbnAlphabet,
        },
        needsClarification: false,
        interpretedIntent: `Construct Context-Free Grammar for ${anbnAlphabet[0]}ⁿ${anbnAlphabet[1]}ⁿ.`,
        confidence: 0.96,
      }
    }

    // 0L. CFG Construction: aⁿb²ⁿ
    if (/a\s*[\^nⁿ]\s*b\s*[\^2²][nⁿ]|0\s*[\^nⁿ]\s*1\s*[\^2²][nⁿ]/i.test(text)) {
      return {
        success: true,
        targetDomain: 'cfg',
        cfgProblemSpec: {
          type: 'cfg_from_language',
          languagePattern: 'an_b2n',
          alphabet: alphabet || ['a', 'b'],
        },
        needsClarification: false,
        interpretedIntent: 'Construct Context-Free Grammar for aⁿb²ⁿ.',
        confidence: 0.96,
      }
    }

    // 0M. CFG Construction: Balanced parentheses
    if (/balanced parenthes[ie]s|balanced brackets/i.test(text)) {
      return {
        success: true,
        targetDomain: 'cfg',
        cfgProblemSpec: {
          type: 'cfg_from_language',
          languagePattern: 'balanced_parentheses',
          alphabet: ['(', ')'],
        },
        needsClarification: false,
        interpretedIntent: 'Construct Context-Free Grammar for balanced parentheses.',
        confidence: 0.96,
      }
    }
  }

  // 1. Check for Transformation Queries
  if (/convert (?:this\s+|the\s+|the\s+following\s+)?nfa (?:in)?to (?:a\s+|an\s+equivalent\s+)?dfa/i.test(text) || /subset construction/i.test(text)) {
    return {
      success: true,
      problemSpec: {
        type: 'nfa_to_dfa',
        rawQuery: rawPrompt,
        alphabet: alphabet ?? ['0', '1'],
      },
      needsClarification: false,
      interpretedIntent: 'Convert NFA to equivalent DFA via Subset Construction.',
      confidence: 0.98,
    }
  }

  if (/minimize (?:this\s+|the\s+|the\s+following\s+)?dfa/i.test(text) || /dfa minimization/i.test(text)) {
    return {
      success: true,
      problemSpec: {
        type: 'minimize_dfa',
        rawQuery: rawPrompt,
        alphabet: alphabet ?? ['0', '1'],
      },
      needsClarification: false,
      interpretedIntent: 'Minimize DFA via partition refinement.',
      confidence: 0.98,
    }
  }

  if (/compare|equivalent|are (?:these |the )?(?:two )?automata/i.test(text)) {
    return {
      success: true,
      problemSpec: {
        type: 'compare_automata',
        rawQuery: rawPrompt,
        alphabet: alphabet ?? ['0', '1'],
      },
      needsClarification: false,
      interpretedIntent: 'Check equivalence between two automata and find shortest counterexample.',
      confidence: 0.95,
    }
  }

  if (/validate|verify|check (?:whether |if )?(?:my )?(?:transition table|automaton)/i.test(text)) {
    return {
      success: true,
      problemSpec: {
        type: 'validate_automaton',
        rawQuery: rawPrompt,
        alphabet: alphabet ?? ['0', '1'],
      },
      needsClarification: false,
      interpretedIntent: 'Validate formal invariants of automaton.',
      confidence: 0.95,
    }
  }

  if (/complement (?:this\s+|the\s+|the\s+following\s+)?dfa/i.test(text) || /dfa complement/i.test(text)) {
    return {
      success: true,
      problemSpec: {
        type: 'dfa_from_language',
        targetType: 'DFA',
        rawQuery: rawPrompt,
        alphabet: alphabet ?? ['0', '1'],
        languagePattern: { kind: 'complement' },
      },
      needsClarification: false,
      interpretedIntent: 'Compute the complement of the given DFA (L_comp = Σ* \\ L).',
      confidence: 0.95,
    }
  }

  // Regex to Automata query
  const regexMatch =
    text.match(/(?:convert\s+)?(?:the\s+)?(?:regex|regular\s+expression)\s+["'`]?([0-9a-zA-Z*|()ε∅\\s]+)["'`]?(?:\s+(?:in)?to\s+(?:a\s+|an\s+)?(?:nfa|dfa|automaton))?/i) ||
    text.match(/(?:thompson(?:'s)?\s+construction\s+for\s+)(?:regex\s+)?["'`]?([0-9a-zA-Z*|()ε∅\\s]+)["'`]?/i)

  if (regexMatch) {
    const rawExpr = regexMatch[1].trim()
    try {
      const parsed = parseRegex(rawExpr, alphabet ?? undefined)
      return {
        success: true,
        problemSpec: {
          type: 'regex_to_automata',
          rawQuery: rawPrompt,
          alphabet: alphabet ?? parsed.alphabet,
          regexString: rawExpr,
        },
        needsClarification: false,
        interpretedIntent: `Convert regular expression "${formatRegexAst(parsed.ast)}" to ε-NFA (Thompson), DFA, and minimized DFA.`,
        confidence: 0.98,
      }
    } catch (err: any) {
      return {
        success: false,
        needsClarification: true,
        clarificationPrompt: `Regular expression syntax error in "${rawExpr}": ${err.message || err}`,
        clarificationOptions: [
          'Convert regex (0|1)*01 to DFA',
          'Convert regex 0*1* to DFA',
          'Convert regex (01)* to DFA',
          'Convert regex 0|01 to DFA',
          'Convert regex (0|(1*0))* to DFA',
        ],
        interpretedIntent: `Invalid regular expression "${rawExpr}".`,
        confidence: 0.8,
      }
    }
  }

  if (/^(?:convert\s+)?(?:regex|regular\s+expression|thompson\s+construction)$/i.test(text)) {
    return {
      success: false,
      needsClarification: true,
      clarificationPrompt: 'Please specify the regular expression to convert. For example:',
      clarificationOptions: [
        'Convert regex (0|1)*01 to DFA',
        'Convert regex 0*1* to DFA',
        'Convert regex (01)* to DFA',
        'Convert regex 0|01 to DFA',
        'Convert regex (0|(1*0))* to DFA',
      ],
      interpretedIntent: 'Regular expression conversion requested without expression.',
      confidence: 0.8,
    }
  }

  // 2. Determine target automaton type (NFA vs DFA)
  const isNfa = /\bnfa\b/i.test(text) && !/\bdfa\b/i.test(text)
  const problemType: ProblemType = isNfa ? 'nfa_from_language' : 'dfa_from_language'
  const targetType: 'DFA' | 'NFA' = isNfa ? 'NFA' : 'DFA'

  // 3. Pattern Matching for Language Descriptions

  // Specialized dual condition: Starts with and ends with
  const startEndMatch = text.match(/(?:starts?|starting|begins?|beginning)\s+with\s+['"`]?([0-9a-zA-Z]+)['"`]?\s+and\s+(?:ends?|ending)\s+with\s+['"`]?([0-9a-zA-Z]+)['"`]?/i)
  if (startEndMatch) {
    const startSym = startEndMatch[1]
    const endSym = startEndMatch[2]
    if (!alphabet) alphabet = Array.from(new Set([...startSym.split(''), ...endSym.split(''), '0', '1'])).slice(0, 2)
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: {
          kind: 'starts_and_ends',
          startSymbol: startSym,
          endSymbol: endSym,
        },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings beginning with "${startSym}" and ending with "${endSym}".`,
      confidence: 0.95,
    }
  }

  // Specialized dual condition: Dual Parity (even 0s and even 1s)
  const dualParityMatch = text.match(
    /(even|odd)\s+(?:number|count)\s+of\s+([0-9a-zA-Z]+)(?:s|'s)?\s+and\s+(?:an?\s+)?(even|odd)\s+(?:number|count)\s+of\s+([0-9a-zA-Z]+)(?:s|'s)?/i,
  )
  if (dualParityMatch) {
    const p1 = dualParityMatch[1].toLowerCase() as 'even' | 'odd'
    let sym1 = dualParityMatch[2]
    const p2 = dualParityMatch[3].toLowerCase() as 'even' | 'odd'
    let sym2 = dualParityMatch[4]
    if (sym1 === 'zero' || sym1 === 'zeros') sym1 = '0'
    if (sym1 === 'one' || sym1 === 'ones') sym1 = '1'
    if (sym2 === 'zero' || sym2 === 'zeros') sym2 = '0'
    if (sym2 === 'one' || sym2 === 'ones') sym2 = '1'
    if (!alphabet) alphabet = Array.from(new Set([sym1, sym2, '0', '1'])).slice(0, 2)
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: {
          kind: 'dual_parity',
          symbol: sym1,
          parity: p1,
          secondSymbol: sym2,
          secondParity: p2,
        },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings with an ${p1} number of "${sym1}"s and an ${p2} number of "${sym2}"s.`,
      confidence: 0.95,
    }
  }

  // Composite operations: Difference ("... but not ..."), Union ("... or ..."), Intersection ("... and ...")
  const stripped = stripCommandPrefix(text)

  // 3a. Check for ambiguous compound condition with both AND and OR without parentheses
  const hasAnd = /\band\b/i.test(stripped)
  const hasOr = /\bor\b/i.test(stripped)
  if (hasAnd && hasOr && !stripped.includes('(') && !stripped.includes(')')) {
    return {
      success: false,
      needsClarification: true,
      clarificationPrompt:
        'Your compound question contains both "AND" and "OR" without parentheses. ' +
        'In formal computation theory, operator precedence between intersection and union must be unambiguous. ' +
        'Please specify parentheses or select an interpretation below:',
      clarificationOptions: [
        `(${stripped.replace(/\s+or\s+/i, ') OR ')}`,
        `${stripped.replace(/\s+and\s+/i, ' AND (')})`,
      ],
      interpretedIntent: 'Ambiguous compound condition lacking explicit parentheses.',
      confidence: 0.7,
    }
  }

  // 3b. Composite operation with parentheses: e.g. (P1) and P2, P1 and (P2), (P1) or (P2)
  const parenCompound =
    stripped.match(/^\((.+?)\)\s+(and|or|but not)\s+(.+)$/i) ||
    stripped.match(/^(.+?)\s+(and|or|but not)\s+\((.+)\)$/i)
  if (parenCompound) {
    const rawLeft = parenCompound[1].replace(/^\(|\)$/g, '').trim()
    const rawOp = parenCompound[2].toLowerCase()
    const op = rawOp === 'but not' ? 'difference' : rawOp === 'or' ? 'union' : 'intersect'
    const rawRight = parenCompound[3].replace(/^\(|\)$/g, '').trim()
    const p1 = extractAtomicPattern(rawLeft)
    const p2 = extractAtomicPattern(rawRight)
    if (p1 && p2) {
      if (!alphabet) {
        alphabet = Array.from(new Set([...extractSymbolsFromPattern(p1), ...extractSymbolsFromPattern(p2), '0', '1'])).slice(0, 2)
      }
      return {
        success: true,
        problemSpec: {
          type: problemType,
          targetType,
          rawQuery: rawPrompt,
          alphabet,
          languagePattern: {
            kind: 'combined_operation',
            operation: op,
            firstPattern: p1,
            secondPattern: p2,
          },
        },
        needsClarification: false,
        interpretedIntent: `Construct ${targetType} for combined language: (${getPatternIntentDescription(p1)}) ${op.toUpperCase()} (${getPatternIntentDescription(p2)}).`,
        confidence: 0.95,
      }
    }
  }

  // Composite Difference: L1 \ L2
  const butNotMatch = stripped.match(/^(.+?)\s+but\s+not\s+(.+)$/i)
  if (butNotMatch) {
    const p1 = extractAtomicPattern(butNotMatch[1])
    const p2 = extractAtomicPattern(butNotMatch[2])
    if (p1 && p2) {
      if (!alphabet) {
        alphabet = Array.from(new Set([...extractSymbolsFromPattern(p1), ...extractSymbolsFromPattern(p2), '0', '1'])).slice(0, 2)
      }
      return {
        success: true,
        problemSpec: {
          type: problemType,
          targetType,
          rawQuery: rawPrompt,
          alphabet,
          languagePattern: {
            kind: 'combined_operation',
            operation: 'difference',
            firstPattern: p1,
            secondPattern: p2,
          },
        },
        needsClarification: false,
        interpretedIntent: `Construct ${targetType} for difference of languages: (${getPatternIntentDescription(p1)}) but not (${getPatternIntentDescription(p2)}).`,
        confidence: 0.95,
      }
    }
  }

  // Composite Union: L1 U L2
  const orMatch = stripped.match(/^(.+?)\s+\bor\b\s+(.+)$/i)
  if (orMatch) {
    const p1 = extractAtomicPattern(orMatch[1])
    const p2 = extractAtomicPattern(orMatch[2])
    if (p1 && p2) {
      if (!alphabet) {
        alphabet = Array.from(new Set([...extractSymbolsFromPattern(p1), ...extractSymbolsFromPattern(p2), '0', '1'])).slice(0, 2)
      }
      return {
        success: true,
        problemSpec: {
          type: problemType,
          targetType,
          rawQuery: rawPrompt,
          alphabet,
          languagePattern: {
            kind: 'combined_operation',
            operation: 'union',
            firstPattern: p1,
            secondPattern: p2,
          },
        },
        needsClarification: false,
        interpretedIntent: `Construct ${targetType} for union of languages: (${getPatternIntentDescription(p1)}) OR (${getPatternIntentDescription(p2)}).`,
        confidence: 0.95,
      }
    }
  }

  // Composite Intersection: L1 ∩ L2
  const andMatch = stripped.match(/^(.+?)\s+\band\b\s+(.+)$/i)
  if (andMatch) {
    const p1 = extractAtomicPattern(andMatch[1])
    const p2 = extractAtomicPattern(andMatch[2])
    if (p1 && p2) {
      if (!alphabet) {
        alphabet = Array.from(new Set([...extractSymbolsFromPattern(p1), ...extractSymbolsFromPattern(p2), '0', '1'])).slice(0, 2)
      }
      return {
        success: true,
        problemSpec: {
          type: problemType,
          targetType,
          rawQuery: rawPrompt,
          alphabet,
          languagePattern: {
            kind: 'combined_operation',
            operation: 'intersect',
            firstPattern: p1,
            secondPattern: p2,
          },
        },
        needsClarification: false,
        interpretedIntent: `Construct ${targetType} for intersection of languages: (${getPatternIntentDescription(p1)}) AND (${getPatternIntentDescription(p2)}).`,
        confidence: 0.95,
      }
    }
  }

  // Category: Avoid / Does not contain substring
  const avoidMatch =
    text.match(/(?:does\s+not\s+contain|not\s+containing|without(?:\s+the)?\s+substring|avoids?|avoiding)\s+(?:the\s+)?(?:substring\s+)?["'`]?([0-9a-zA-Z]+)["'`]?/i) ||
    text.match(/no\s+substring\s+["'`]?([0-9a-zA-Z]+)["'`]?/i)
  if (avoidMatch) {
    const sub = avoidMatch[1]
    if (sub !== 'an' && sub !== 'a' && sub !== 'the') {
      if (!alphabet) alphabet = Array.from(new Set([...sub.split(''), '0', '1'])).slice(0, 2)
      return {
        success: true,
        problemSpec: {
          type: problemType,
          targetType,
          rawQuery: rawPrompt,
          alphabet,
          languagePattern: { kind: 'avoid_substring', paramString: sub },
        },
        needsClarification: false,
        interpretedIntent: `Construct ${targetType} accepting strings that do not contain substring "${sub}".`,
        confidence: 0.95,
      }
    }
  }

  // Category: Every X followed by Y
  const everyXFollowedByYMatch = text.match(
    /(?:every|each)\s+['"`]?([0-9a-zA-Z])['"`]?\s+is\s+(?:immediately\s+)?followed\s+by\s+['"`]?([0-9a-zA-Z])['"`]?/i,
  )
  if (everyXFollowedByYMatch) {
    let x = everyXFollowedByYMatch[1]
    let y = everyXFollowedByYMatch[2]
    if (x === 'zero' || x === 'zeros') x = '0'
    if (x === 'one' || x === 'ones') x = '1'
    if (y === 'zero' || y === 'zeros') y = '0'
    if (y === 'one' || y === 'ones') y = '1'
    if (!alphabet) alphabet = Array.from(new Set([x, y, '0', '1'])).slice(0, 2)
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'every_x_followed_by_y', symbol: x, followedBySymbol: y },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings where every "${x}" is immediately followed by "${y}".`,
      confidence: 0.95,
    }
  }

  // Category: Decimal divisibility
  const decimalDivMatch =
    text.match(/(?:decimal|base\s*10)\s+(?:values?|numbers?|integers?|strings?)?\s*(?:is\s+)?divisible\s+by\s+(\d+)/i) ||
    text.match(/divisible\s+by\s+(\d+)\s+in\s+decimal/i)
  if (decimalDivMatch) {
    const divisor = parseInt(decimalDivMatch[1], 10)
    const decAlphabet = alphabet && alphabet.length > 2 ? alphabet : ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet: decAlphabet,
        languagePattern: { kind: 'decimal_divisible', divisor },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting decimal strings whose value is divisible by ${divisor}.`,
      confidence: 0.95,
    }
  }

  // Category: Substring count at least k times
  const subCountMatch = text.match(
    /(?:contains?|containing)\s+(?:the\s+)?(?:substring\s+)?["'`]?([0-9a-zA-Z]+)["'`]?\s+at\s+least\s+(\d+|zero|one|two|three|four|five)\s+times/i,
  )
  if (subCountMatch) {
    const sub = subCountMatch[1]
    const times = wordToNumber(subCountMatch[2])
    if (!alphabet) alphabet = Array.from(new Set([...sub.split(''), '0', '1'])).slice(0, 2)
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'substring_count_at_least', paramString: sub, times },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings containing substring "${sub}" at least ${times} times.`,
      confidence: 0.95,
    }
  }

  // Category: Exact count of symbol
  const exactCountMatch =
    text.match(/(?:contains?\s+)?(?:exactly|exact\s+count\s+of)\s+(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+([0-9a-zA-Z]+)(?:s|'s)?/i)
  if (exactCountMatch) {
    const k = wordToNumber(exactCountMatch[1])
    let sym = exactCountMatch[2]
    if (sym === 'zero' || sym === 'zeros') sym = '0'
    if (sym === 'one' || sym === 'ones') sym = '1'
    if (!alphabet) alphabet = ['0', '1']
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'exact_count', k, symbol: sym },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings containing exactly ${k} "${sym}"s.`,
      confidence: 0.95,
    }
  }

  // Category: Length at most k
  const atMostLenMatch =
    text.match(/length\s+(?:is\s+)?(?:at\s+most|<=|no\s+more\s+than|maximum\s+of|less\s+than\s+or\s+equal\s+to)\s+(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/i) ||
    text.match(/strings\s+of\s+length\s+(?:at\s+most|<=|no\s+more\s+than)\s+(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/i) ||
    text.match(/(?:at\s+most|no\s+more\s+than|maximum\s+of)\s+(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:symbols?|characters?|letters?)\s+(?:in\s+length|long)\b/i)
  if (atMostLenMatch) {
    const k = wordToNumber(atMostLenMatch[1])
    if (!alphabet) alphabet = ['0', '1']
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'at_most_length', k },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings with length at most ${k}.`,
      confidence: 0.95,
    }
  }

  // Category: At most k occurrences of a symbol
  const atMostCountMatch =
    text.match(/(?:at\s+most|no\s+more\s+than|maximum\s+of|less\s+than\s+or\s+equal\s+to|<=)\s+(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s+([0-9a-zA-Z]+)(?:s|'s)?/i)
  if (atMostCountMatch) {
    const k = wordToNumber(atMostCountMatch[1])
    let sym = atMostCountMatch[2]
    if (sym === 'zero' || sym === 'zeros') sym = '0'
    if (sym === 'one' || sym === 'ones') sym = '1'
    if (!alphabet) alphabet = ['0', '1']
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'at_most_count', k, symbol: sym },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings containing at most ${k} occurrences of "${sym}".`,
      confidence: 0.95,
    }
  }

  // Category: Symbol count modulo / divisibility
  const symCountDivMatch =
    text.match(/(?:number|count)\s+of\s+([0-9a-zA-Z]+)(?:s|'s)?\s+(?:is\s+)?divisible\s+by\s+(\d+)/i) ||
    text.match(/(?:number|count)\s+of\s+([0-9a-zA-Z]+)(?:s|'s)?\s+mod(?:ulo)?\s+(\d+)\s*(?:=|equals?)\s*(\d+)/i)
  if (symCountDivMatch) {
    let sym = symCountDivMatch[1]
    if (sym === 'zero' || sym === 'zeros') sym = '0'
    if (sym === 'one' || sym === 'ones') sym = '1'
    const divisor = parseInt(symCountDivMatch[2], 10)
    const remainder = symCountDivMatch[3] ? parseInt(symCountDivMatch[3], 10) : 0
    if (!alphabet) alphabet = ['0', '1']
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: {
          kind: 'symbol_count_divisible',
          symbol: sym,
          divisor,
          remainder,
        },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings where the count of "${sym}"s mod ${divisor} is ${remainder}.`,
      confidence: 0.95,
    }
  }

  // Category: Ending with suffix
  const endsMatch = text.match(/(?:ends?|ending)\s+(?:in|with)\s+["'`]?([0-9a-zA-Z]+)["'`]?/i)
  if (endsMatch) {
    const suffix = endsMatch[1]
    if (!alphabet) {
      alphabet = Array.from(new Set([...suffix.split(''), '0', '1'])).slice(0, 2)
    }
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'ends_with', paramString: suffix },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings ending with "${suffix}" over Σ = {${alphabet.join(', ')}}.`,
      confidence: 0.95,
    }
  }

  // Check incomplete "ends with" prompt -> Needs clarification
  if (/(?:ends?|ending)\s+(?:in|with)\s*$/i.test(text) || /(?:ends?|ending)\s+(?:in|with)\s+a string/i.test(text)) {
    return {
      success: false,
      needsClarification: true,
      clarificationPrompt: 'Which suffix should the strings end with?',
      clarificationOptions: ['01', '00', '10', '11', '1'],
      interpretedIntent: `Construct ${targetType} for strings ending in a suffix.`,
      confidence: 0.7,
    }
  }

  // Category: Starts with prefix
  const startsMatch = text.match(/(?:starts?|starting|begins?|beginning)\s+with\s+["'`]?([0-9a-zA-Z]+)["'`]?/i)
  if (startsMatch) {
    const prefix = startsMatch[1]
    if (!alphabet) alphabet = Array.from(new Set([...prefix.split(''), '0', '1'])).slice(0, 2)
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'starts_with', paramString: prefix },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings beginning with "${prefix}".`,
      confidence: 0.95,
    }
  }

  // Category: Contains substring
  const containsMatch = text.match(/(?:contains?|containing)\s+(?:the\s+)?(?:substring\s+)?["'`]?([0-9a-zA-Z]+)["'`]?/i)
  if (containsMatch) {
    const sub = containsMatch[1]
    if (sub !== 'an' && sub !== 'a' && sub !== 'no') {
      if (!alphabet) alphabet = Array.from(new Set([...sub.split(''), '0', '1'])).slice(0, 2)
      return {
        success: true,
        problemSpec: {
          type: problemType,
          targetType,
          rawQuery: rawPrompt,
          alphabet,
          languagePattern: { kind: 'contains_substring', paramString: sub },
        },
        needsClarification: false,
        interpretedIntent: `Construct ${targetType} accepting strings containing substring "${sub}".`,
        confidence: 0.95,
      }
    }
  }

  // Category: Single Symbol parity (even / odd count)
  const parityMatch = text.match(/(even|odd)\s+(?:number|count)\s+of\s+([0-9a-zA-Z]+)(?:s|'s)?/i) ||
    text.match(/([0-9a-zA-Z]+)(?:s|'s)?\s+(?:with\s+)?(?:an\s+)?(even|odd)\s+(?:number|count)/i)
  if (parityMatch) {
    const parity = (parityMatch[1] === 'even' || parityMatch[1] === 'odd' ? parityMatch[1] : parityMatch[2]) as 'even' | 'odd'
    let sym = parityMatch[1] === parity ? parityMatch[2] : parityMatch[1]
    // Clean symbol names like "zero" -> "0", "one" -> "1"
    if (sym === 'zero' || sym === 'zeros') sym = '0'
    if (sym === 'one' || sym === 'ones') sym = '1'

    if (!alphabet) alphabet = ['0', '1']
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: {
          kind: 'symbol_parity',
          symbol: sym,
          parity,
        },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings with an ${parity} count of "${sym}".`,
      confidence: 0.95,
    }
  }

  // Check for ambiguous "divisible by N" prompt without specifying binary or length
  const ambiguousDiv = text.match(/\bdivisible\s+by\s+(\d+)\b/i)
  if (ambiguousDiv && !/binary|number\s+value|numeric/i.test(text) && !/length|size|count/i.test(text)) {
    const divisor = ambiguousDiv[1]
    return {
      success: false,
      needsClarification: true,
      clarificationPrompt: `Did you mean binary numerical value divisible by ${divisor}, or string length divisible by ${divisor}?`,
      clarificationOptions: [
        `Binary value divisible by ${divisor} (e.g., 0, 3, 6, 9...)`,
        `String length divisible by ${divisor} (e.g., length 0, 3, 6, 9...)`,
      ],
      interpretedIntent: `Divisible by ${divisor} (ambiguous interpretation: binary value vs string length).`,
      confidence: 0.75,
    }
  }

  // Category: Binary divisibility
  const binaryDivMatch = text.match(/binary\s+(?:value|number)?\s*(?:is\s+)?divisible\s+by\s+(\d+)/i) ||
    text.match(/divisible\s+by\s+(\d+)\s+in\s+binary/i)
  if (binaryDivMatch) {
    const divisor = parseInt(binaryDivMatch[1], 10)
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet: ['0', '1'],
        languagePattern: { kind: 'binary_divisible', divisor },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting binary strings divisible by ${divisor}.`,
      confidence: 0.95,
    }
  }

  // Category: Length divisibility
  const lenDivMatch = text.match(/length\s+(?:is\s+)?divisible\s+by\s+(\d+)/i) ||
    text.match(/length\s+mod(?:ulo)?\s+(\d+)\s*(?:=|equals?)\s*(\d+)/i)
  if (lenDivMatch) {
    const divisor = parseInt(lenDivMatch[1], 10)
    const remainder = lenDivMatch[2] ? parseInt(lenDivMatch[2], 10) : 0
    if (!alphabet) alphabet = ['0', '1']
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'length_divisible', divisor, remainder },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings whose length mod ${divisor} equals ${remainder}.`,
      confidence: 0.95,
    }
  }

  // Category: Length at least k
  const atLeastLenMatch =
    text.match(/(?:length\s+(?:is\s+)?(?:at\s+least|>=|greater\s+than\s+or\s+equal\s+to)|at\s+least)\s+(\d+)\s+(?:symbols?|characters?|letters?)/i) ||
    text.match(/length\s+(?:is\s+)?at\s+least\s+(\d+)/i)
  if (atLeastLenMatch) {
    const k = parseInt(atLeastLenMatch[1], 10)
    if (!alphabet) alphabet = ['0', '1']
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'at_least_length', k },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings with length at least ${k}.`,
      confidence: 0.95,
    }
  }

  // Category: At least k occurrences of a symbol
  const atLeastCountMatch = text.match(/at\s+least\s+(\d+)\s+([0-9a-zA-Z])(?:s|'s)?/i)
  if (atLeastCountMatch) {
    const k = parseInt(atLeastCountMatch[1], 10)
    let sym = atLeastCountMatch[2]
    if (sym === 'zero' || sym === 'zeros') sym = '0'
    if (sym === 'one' || sym === 'ones') sym = '1'
    if (!alphabet) alphabet = ['0', '1']
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'at_least_count', k, symbol: sym },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings with at least ${k} '${sym}'s.`,
      confidence: 0.95,
    }
  }

  // Category: Exact length k
  const exactLenMatch =
    text.match(/(?:exact\s+length|length\s+(?:is\s+)?(?:exactly|equal\s+to|=))\s+(\d+)/i) ||
    text.match(/strings\s+of\s+length\s+(\d+)\b/i)
  if (exactLenMatch) {
    const k = parseInt(exactLenMatch[1], 10)
    if (!alphabet) alphabet = ['0', '1']
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'exact_length', k },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings of exact length ${k}.`,
      confidence: 0.95,
    }
  }

  // Category: Empty Language
  if (/empty\s+language|\baccepts?\s+no(?:thing|\s+strings?)|\brejects?\s+all\s+strings?|\bempty\s+set\b/i.test(text)) {
    if (!alphabet) alphabet = ['0', '1']
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'empty_language' },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} recognizing the empty language ∅.`,
      confidence: 0.95,
    }
  }

  // Category: Universal Language (all strings)
  if (/universal\s+language|\ball\s+strings?\b|\bevery\s+string\b|sigma\s*\*\s*|Σ\s*\*\s*/i.test(text)) {
    if (!alphabet) alphabet = ['0', '1']
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'universal_language' },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting all strings (Σ*).`,
      confidence: 0.95,
    }
  }

  // Category: Only empty string
  if (/(?:only|exact(?:ly)?)\s+(?:the\s+)?empty\s+string|\baccepts?\s+only\s+(?:ε|epsilon)\b/i.test(text)) {
    if (!alphabet) alphabet = ['0', '1']
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'empty_string_only' },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting only the empty string {ε}.`,
      confidence: 0.95,
    }
  }

  // Category: No consecutive symbols
  const noConsecMatch = text.match(/no\s+consecutive\s+([0-9a-zA-Z]+)(?:s|'s)?/i) ||
    text.match(/without\s+consecutive\s+([0-9a-zA-Z]+)(?:s|'s)?/i)
  if (noConsecMatch) {
    let sym = noConsecMatch[1]
    if (sym === 'one' || sym === 'ones') sym = '1'
    if (sym === 'zero' || sym === 'zeros') sym = '0'
    if (!alphabet) alphabet = ['0', '1']
    return {
      success: true,
      problemSpec: {
        type: problemType,
        targetType,
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'no_consecutive', symbol: sym },
      },
      needsClarification: false,
      interpretedIntent: `Construct ${targetType} accepting strings with no consecutive "${sym}"s.`,
      confidence: 0.95,
    }
  }

  // Category: k-th symbol from end
  const kthMatch = text.match(/(\d+)(?:st|nd|rd|th)?\s+(?:symbol|character)\s+from\s+(?:the\s+)?end\s+is\s+['"`]?([0-9a-zA-Z])['"`]?/i)
  if (kthMatch) {
    const k = parseInt(kthMatch[1], 10)
    const sym = kthMatch[2]
    if (!alphabet) alphabet = ['0', '1']
    return {
      success: true,
      problemSpec: {
        type: 'nfa_from_language',
        targetType: 'NFA',
        rawQuery: rawPrompt,
        alphabet,
        languagePattern: { kind: 'kth_from_end', k, symbol: sym },
      },
      needsClarification: false,
      interpretedIntent: `Construct NFA accepting strings whose ${k}-th symbol from the end is "${sym}".`,
      confidence: 0.95,
    }
  }

  // 4. If query was too vague or missing details, ask for clarification
  if (text.length < 5 || /help|what can you do|how to use/i.test(text)) {
    return {
      success: false,
      needsClarification: true,
      clarificationPrompt: 'Please specify an automata problem or select one of the following standard templates:',
      clarificationOptions: [
        'Construct a DFA over {0,1} that accepts strings ending with 01.',
        'Construct a DFA that accepts strings containing an even number of zeros.',
        'Construct a DFA that accepts strings whose binary value is divisible by 3.',
        'Construct a DFA that accepts strings containing no consecutive ones.',
        'Convert this NFA into an equivalent DFA.',
        'Minimize the following DFA.',
      ],
      confidence: 0.5,
    }
  }

  // Fallback with suggested clarification
  return {
    success: false,
    needsClarification: true,
    clarificationPrompt: `Could you clarify the language condition or operation? For example:`,
    clarificationOptions: [
      `Construct a DFA over {0,1} that accepts strings ending with 01`,
      `Construct a DFA that accepts strings containing substring 101`,
      `Construct a DFA that accepts strings with an odd number of ones`,
      `Construct a DFA that accepts strings whose length is divisible by 3`,
    ],
    interpretedIntent: 'Unrecognized query pattern.',
    confidence: 0.3,
  }
}
