/**
 * Formal Regular Expression Lexer, AST, and Recursive-Descent Parser.
 *
 * Formal Language Grammar:
 *   UnionExpr   := ConcatExpr ( '|' ConcatExpr )*
 *   ConcatExpr  := StarExpr ( StarExpr )*
 *   StarExpr    := PrimaryExpr ( '*' )*
 *   PrimaryExpr := Symbol | Epsilon | EmptySet | '(' UnionExpr ')'
 *
 * Precedence:
 *   1. Parentheses & Atomic expressions (Highest)
 *   2. Kleene star '*' (Postfix unary)
 *   3. Concatenation (Binary, implicit, left-associative)
 *   4. Union '|' (Binary, lowest, left-associative)
 */

export type RegexNode =
  | { type: 'empty_set' }
  | { type: 'epsilon' }
  | { type: 'symbol'; symbol: string }
  | { type: 'star'; child: RegexNode }
  | { type: 'concat'; left: RegexNode; right: RegexNode }
  | { type: 'union'; left: RegexNode; right: RegexNode }

export type TokenType =
  | 'SYMBOL'
  | 'UNION'
  | 'STAR'
  | 'LPAREN'
  | 'RPAREN'
  | 'EPSILON'
  | 'EMPTY_SET'
  | 'EOF'

export interface Token {
  type: TokenType
  value: string
  pos: number
}

export class RegexParseError extends Error {
  pos: number
  rawExpression: string

  constructor(message: string, pos: number, rawExpression: string) {
    const pointer = ' '.repeat(Math.max(0, pos)) + '^'
    super(`${message}\n\n  ${rawExpression}\n  ${pointer}`)
    this.name = 'RegexParseError'
    this.pos = pos
    this.rawExpression = rawExpression
  }
}

/**
 * Tokenizes a formal regular expression string.
 */
export function tokenizeRegex(
  input: string,
  allowedAlphabet?: string[],
): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = input.length

  while (i < n) {
    const ch = input[i]

    // Skip unescaped whitespace
    if (/\s/.test(ch)) {
      i++
      continue
    }

    if (ch === '|') {
      tokens.push({ type: 'UNION', value: '|', pos: i })
      i++
      continue
    }

    if (ch === '*') {
      tokens.push({ type: 'STAR', value: '*', pos: i })
      i++
      continue
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(', pos: i })
      i++
      continue
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')', pos: i })
      i++
      continue
    }

    // Epsilon literal: 'ε' (U+03B5)
    if (ch === 'ε') {
      tokens.push({ type: 'EPSILON', value: 'ε', pos: i })
      i++
      continue
    }

    // Empty language literal: '∅' (U+2205)
    if (ch === '∅') {
      tokens.push({ type: 'EMPTY_SET', value: '∅', pos: i })
      i++
      continue
    }

    // Escaped sequences: \e, \0, \*, \|, \(, \), \\, \s
    if (ch === '\\') {
      if (i + 1 >= n) {
        throw new RegexParseError('Dangling backslash escape at end of expression.', i, input)
      }
      const nextCh = input[i + 1]
      const escapePos = i

      if (nextCh === 'e' || nextCh === 'E') {
        tokens.push({ type: 'EPSILON', value: 'ε', pos: escapePos })
        i += 2
        continue
      }
      if (nextCh === '0') {
        // \0 is explicit empty set notation
        tokens.push({ type: 'EMPTY_SET', value: '∅', pos: escapePos })
        i += 2
        continue
      }
      if (['*', '|', '(', ')', '\\'].includes(nextCh)) {
        if (allowedAlphabet && !allowedAlphabet.includes(nextCh)) {
          throw new RegexParseError(
            `Escaped symbol '${nextCh}' is not in declared alphabet {${allowedAlphabet.join(', ')}}.`,
            escapePos,
            input,
          )
        }
        tokens.push({ type: 'SYMBOL', value: nextCh, pos: escapePos })
        i += 2
        continue
      }
      if (nextCh === 's') {
        // \s matches literal space symbol
        if (allowedAlphabet && !allowedAlphabet.includes(' ')) {
          throw new RegexParseError(
            `Symbol ' ' (escaped space) is not in declared alphabet {${allowedAlphabet.join(', ')}}.`,
            escapePos,
            input,
          )
        }
        tokens.push({ type: 'SYMBOL', value: ' ', pos: escapePos })
        i += 2
        continue
      }

      // Check for multi-letter keyword escape: \epsilon or \empty
      const rem = input.slice(i)
      if (/^\\epsilon\b/i.test(rem)) {
        tokens.push({ type: 'EPSILON', value: 'ε', pos: escapePos })
        i += 8
        continue
      }
      if (/^\\empty\b/i.test(rem)) {
        tokens.push({ type: 'EMPTY_SET', value: '∅', pos: escapePos })
        i += 6
        continue
      }

      // If escaping any other normal symbol, treat as literal symbol
      if (allowedAlphabet && !allowedAlphabet.includes(nextCh)) {
        throw new RegexParseError(
          `Escaped symbol '${nextCh}' is not in declared alphabet {${allowedAlphabet.join(', ')}}.`,
          escapePos,
          input,
        )
      }
      tokens.push({ type: 'SYMBOL', value: nextCh, pos: escapePos })
      i += 2
      continue
    }

    // Check for word keywords: "eps" / "epsilon" or "empty" when 'e' is not a single declared alphabet symbol
    const remaining = input.slice(i)
    if (!allowedAlphabet || (!allowedAlphabet.includes('e') && !allowedAlphabet.includes('p'))) {
      if (/^epsilon\b/i.test(remaining)) {
        tokens.push({ type: 'EPSILON', value: 'ε', pos: i })
        i += 7
        continue
      }
      if (/^eps\b/i.test(remaining)) {
        tokens.push({ type: 'EPSILON', value: 'ε', pos: i })
        i += 3
        continue
      }
      if (/^empty\b/i.test(remaining)) {
        tokens.push({ type: 'EMPTY_SET', value: '∅', pos: i })
        i += 5
        continue
      }
    }

    // Ordinary alphabet symbol
    if (allowedAlphabet && !allowedAlphabet.includes(ch)) {
      throw new RegexParseError(
        `Symbol '${ch}' is not in declared alphabet {${allowedAlphabet.join(', ')}}.`,
        i,
        input,
      )
    }

    tokens.push({ type: 'SYMBOL', value: ch, pos: i })
    i++
  }

  tokens.push({ type: 'EOF', value: '', pos: n })
  return tokens
}

/**
 * Parser state tracker.
 */
class Parser {
  private tokens: Token[]
  private cursor = 0
  private raw: string

  constructor(tokens: Token[], raw: string) {
    this.tokens = tokens
    this.raw = raw
  }

  private peek(): Token {
    return this.tokens[this.cursor] ?? { type: 'EOF', value: '', pos: this.raw.length }
  }

  private consume(expected?: TokenType): Token {
    const cur = this.peek()
    if (expected && cur.type !== expected) {
      throw new RegexParseError(
        `Expected token of type '${expected}', but found '${cur.value || cur.type}'.`,
        cur.pos,
        this.raw,
      )
    }
    this.cursor++
    return cur
  }

  parse(): RegexNode {
    if (this.peek().type === 'EOF') {
      throw new RegexParseError(
        "Regular expression is empty. Provide an expression or 'ε' for the empty string.",
        0,
        this.raw,
      )
    }

    const ast = this.parseUnion()

    if (this.peek().type !== 'EOF') {
      const extra = this.peek()
      if (extra.type === 'RPAREN') {
        throw new RegexParseError("Unmatched closing parenthesis ')'.", extra.pos, this.raw)
      }
      throw new RegexParseError(
        `Unexpected token '${extra.value}' after complete expression.`,
        extra.pos,
        this.raw,
      )
    }

    return ast
  }

  /**
   * UnionExpr := ConcatExpr ( '|' ConcatExpr )*
   */
  private parseUnion(): RegexNode {
    // Check leading pipe: "|..."
    if (this.peek().type === 'UNION') {
      throw new RegexParseError(
        "Missing left-hand operand for union operator '|'.",
        this.peek().pos,
        this.raw,
      )
    }

    let left = this.parseConcat()

    while (this.peek().type === 'UNION') {
      const op = this.consume('UNION')
      if (this.peek().type === 'EOF' || this.peek().type === 'RPAREN') {
        throw new RegexParseError(
          "Missing right-hand operand for union operator '|'.",
          op.pos,
          this.raw,
        )
      }
      if (this.peek().type === 'UNION') {
        throw new RegexParseError(
          "Consecutive union operators '||' are not permitted. Missing middle operand.",
          this.peek().pos,
          this.raw,
        )
      }
      const right = this.parseConcat()
      left = { type: 'union', left, right }
    }

    return left
  }

  /**
   * ConcatExpr := StarExpr ( StarExpr )*
   */
  private parseConcat(): RegexNode {
    let left = this.parseStar()

    while (this.canStartPrimary(this.peek().type)) {
      const right = this.parseStar()
      left = { type: 'concat', left, right }
    }

    return left
  }

  /**
   * StarExpr := PrimaryExpr ( '*' )*
   */
  private parseStar(): RegexNode {
    // Check leading star: "*..."
    if (this.peek().type === 'STAR') {
      throw new RegexParseError(
        "Preceding token to '*' is missing or invalid. Kleene star must follow an atomic expression.",
        this.peek().pos,
        this.raw,
      )
    }

    let expr = this.parsePrimary()

    while (this.peek().type === 'STAR') {
      this.consume('STAR')
      expr = { type: 'star', child: expr }
    }

    return expr
  }

  /**
   * PrimaryExpr := Symbol | Epsilon | EmptySet | '(' UnionExpr ')'
   */
  private parsePrimary(): RegexNode {
    const cur = this.peek()

    if (cur.type === 'SYMBOL') {
      this.consume('SYMBOL')
      return { type: 'symbol', symbol: cur.value }
    }

    if (cur.type === 'EPSILON') {
      this.consume('EPSILON')
      return { type: 'epsilon' }
    }

    if (cur.type === 'EMPTY_SET') {
      this.consume('EMPTY_SET')
      return { type: 'empty_set' }
    }

    if (cur.type === 'LPAREN') {
      const openParenPos = cur.pos
      this.consume('LPAREN')

      if (this.peek().type === 'RPAREN') {
        throw new RegexParseError(
          "Empty parentheses '()' are not permitted. Did you mean 'ε' for the empty string?",
          openParenPos,
          this.raw,
        )
      }

      const inner = this.parseUnion()

      if (this.peek().type !== 'RPAREN') {
        throw new RegexParseError(
          "Unclosed parenthesis '(': matching ')' was not found.",
          openParenPos,
          this.raw,
        )
      }

      this.consume('RPAREN')
      return inner
    }

    if (cur.type === 'RPAREN') {
      throw new RegexParseError("Unexpected closing parenthesis ')'.", cur.pos, this.raw)
    }

    if (cur.type === 'EOF') {
      throw new RegexParseError('Unexpected end of regular expression.', cur.pos, this.raw)
    }

    throw new RegexParseError(`Unexpected token '${cur.value}'.`, cur.pos, this.raw)
  }

  private canStartPrimary(type: TokenType): boolean {
    return (
      type === 'SYMBOL' ||
      type === 'EPSILON' ||
      type === 'EMPTY_SET' ||
      type === 'LPAREN'
    )
  }
}

/**
 * Parses a regular expression string into an AST.
 */
export function parseRegex(
  input: string,
  allowedAlphabet?: string[],
): {
  ast: RegexNode
  alphabet: string[]
  tokens: Token[]
} {
  const trimmed = input.trim()
  const tokens = tokenizeRegex(trimmed, allowedAlphabet)
  const parser = new Parser(tokens, trimmed)
  const ast = parser.parse()

  // Collect all unique alphabet symbols found in AST
  const foundSymbols = getAlphabetFromAst(ast)
  const alphabet = allowedAlphabet
    ? Array.from(new Set([...allowedAlphabet])).sort()
    : foundSymbols.length > 0
      ? foundSymbols.sort()
      : ['0', '1']

  return { ast, alphabet, tokens }
}

/**
 * Traverses an AST to gather all literal symbols.
 */
export function getAlphabetFromAst(node: RegexNode): string[] {
  const set = new Set<string>()

  function walk(n: RegexNode) {
    switch (n.type) {
      case 'symbol':
        set.add(n.symbol)
        break
      case 'star':
        walk(n.child)
        break
      case 'concat':
        walk(n.left)
        walk(n.right)
        break
      case 'union':
        walk(n.left)
        walk(n.right)
        break
      case 'epsilon':
      case 'empty_set':
        break
    }
  }

  walk(node)
  return Array.from(set).sort()
}

/**
 * Formats an AST back into a minimal-parentheses mathematical regular expression string.
 */
export function formatRegexAst(node: RegexNode, parentPrecedence = 0): string {
  // Precedence values:
  // 1 = Union
  // 2 = Concat
  // 3 = Star
  // 4 = Atomic
  switch (node.type) {
    case 'empty_set':
      return '∅'
    case 'epsilon':
      return 'ε'
    case 'symbol':
      return node.symbol
    case 'star': {
      const childStr = formatRegexAst(node.child, 3)
      return `${childStr}*`
    }
    case 'concat': {
      const leftStr = formatRegexAst(node.left, 2)
      const rightStr = formatRegexAst(node.right, 2)
      const res = `${leftStr}${rightStr}`
      return parentPrecedence > 2 ? `(${res})` : res
    }
    case 'union': {
      const leftStr = formatRegexAst(node.left, 1)
      const rightStr = formatRegexAst(node.right, 1)
      const res = `${leftStr}|${rightStr}`
      return parentPrecedence > 1 ? `(${res})` : res
    }
  }
}

/**
 * Formats the AST as an ASCII hierarchical tree diagram.
 */
export function printRegexAstTree(node: RegexNode, prefix = '', isLast = true): string {
  const branch = isLast ? '└── ' : '├── '
  let line = `${prefix}${branch}`

  switch (node.type) {
    case 'empty_set':
      line += 'EmptySet (∅)'
      return line
    case 'epsilon':
      line += 'Epsilon (ε)'
      return line
    case 'symbol':
      line += `Symbol ('${node.symbol}')`
      return line
    case 'star': {
      line += 'KleeneStar (*)\n'
      const nextPrefix = prefix + (isLast ? '    ' : '│   ')
      return line + printRegexAstTree(node.child, nextPrefix, true)
    }
    case 'concat': {
      line += 'Concatenation (·)\n'
      const nextPrefix = prefix + (isLast ? '    ' : '│   ')
      const leftTree = printRegexAstTree(node.left, nextPrefix, false) + '\n'
      const rightTree = printRegexAstTree(node.right, nextPrefix, true)
      return line + leftTree + rightTree
    }
    case 'union': {
      line += 'Union (|)\n'
      const nextPrefix = prefix + (isLast ? '    ' : '│   ')
      const leftTree = printRegexAstTree(node.left, nextPrefix, false) + '\n'
      const rightTree = printRegexAstTree(node.right, nextPrefix, true)
      return line + leftTree + rightTree
    }
  }
}
