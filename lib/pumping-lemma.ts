/**
 * Pumping Lemma for Regular Languages Engine:
 * - Formal mathematical definition and adversarial game structure
 * - Universal quantification over all valid decompositions s = xyz with |xy| <= p and |y| >= 1
 * - Interactive string decomposition and pump tester (x y^i z for any i >= 0)
 * - Rigorous contradiction-based non-regularity proofs for canonical university-level languages
 */

export interface StringDecomposition {
  x: string
  y: string
  z: string
  p: number
  satisfiesLengthConstraint: boolean // |xy| <= p
  satisfiesNonEmptyY: boolean // |y| >= 1
}

export interface PumpTestResult {
  i: number
  pumpedString: string
  inLanguage: boolean
  explanation: string
}

export type NonRegularPattern =
  | 'an_bn'
  | 'an_bn_cn'
  | 'palindromes'
  | 'ww'
  | 'square_length'
  | 'prime_length'
  | 'an_bm_n_gt_m'
  | 'an_b2n'
  | 'equal_zeros_ones'

export interface NonRegularityProof {
  pattern: NonRegularPattern
  languageName: string
  languageSetNotation: string
  formalTheoremStatement: string
  adversarialGameSteps: {
    stepNumber: number
    party: 'Opponent' | 'We (Prover)'
    action: string
    mathematicalDetails: string
  }[]
  chosenPumpingLengthSymbol: string
  selectedTestString: string
  selectedTestStringExplanation: string
  universalDecompositionArgument: string
  contradictionExponentChoice: number
  pumpedStringFormula: string
  contradictionExplanation: string
  fullFormalProofMarkdown: string
  isMember: (str: string) => boolean
}

/**
 * Returns all valid splits of string s = xyz satisfying |xy| <= p and |y| >= 1.
 */
export function getAllDecompositions(s: string, p: number): StringDecomposition[] {
  const decompositions: StringDecomposition[] = []
  const maxXY = Math.min(s.length, p)

  for (let xyLen = 1; xyLen <= maxXY; xyLen++) {
    for (let xLen = 0; xLen < xyLen; xLen++) {
      const yLen = xyLen - xLen
      if (yLen >= 1) {
        const x = s.slice(0, xLen)
        const y = s.slice(xLen, xLen + yLen)
        const z = s.slice(xyLen)

        decompositions.push({
          x,
          y,
          z,
          p,
          satisfiesLengthConstraint: x.length + y.length <= p,
          satisfiesNonEmptyY: y.length >= 1,
        })
      }
    }
  }

  return decompositions
}

/**
 * Generates the pumped string x y^i z for a given decomposition and integer i >= 0.
 */
export function pumpString(decomp: { x: string; y: string; z: string }, i: number): string {
  const yRepeated = i === 0 ? '' : decomp.y.repeat(i)
  return `${decomp.x}${yRepeated}${decomp.z}`
}

/**
 * Evaluates a decomposition against language membership for multiple values of i.
 */
export function testDecompositionPumping(
  decomp: { x: string; y: string; z: string },
  isMember: (str: string) => boolean,
  testValues: number[] = [0, 1, 2, 3],
): PumpTestResult[] {
  return testValues.map((i) => {
    const pumped = pumpString(decomp, i)
    const inLang = isMember(pumped)
    return {
      i,
      pumpedString: pumped === '' ? 'ε' : pumped,
      inLanguage: inLang,
      explanation: inLang
        ? `For i = ${i}, xy^${i}z = "${pumped === '' ? 'ε' : pumped}" ∈ L.`
        : `For i = ${i}, xy^${i}z = "${pumped === '' ? 'ε' : pumped}" ∉ L (VIOLATION).`,
    }
  })
}

function isPrime(num: number): boolean {
  if (num <= 1) return false
  if (num <= 3) return true
  if (num % 2 === 0 || num % 3 === 0) return false
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false
  }
  return true
}

/**
 * Built-in language membership predicates for canonical non-regular languages.
 */
export const NON_REGULAR_MEMBERSHIP_PREDICATES: Record<NonRegularPattern, (str: string) => boolean> = {
  an_bn: (str: string) => {
    if (str === '') return true
    const match = str.match(/^(0+)(1+)$/)
    return !!match && match[1].length === match[2].length
  },
  an_bn_cn: (str: string) => {
    if (str === '') return true
    const match = str.match(/^(a+)(b+)(c+)$/)
    return !!match && match[1].length === match[2].length && match[2].length === match[3].length
  },
  palindromes: (str: string) => {
    return str === str.split('').reverse().join('')
  },
  ww: (str: string) => {
    if (str === '') return true
    if (str.length % 2 !== 0) return false
    const mid = str.length / 2
    return str.slice(0, mid) === str.slice(mid)
  },
  square_length: (str: string) => {
    if (!/^0*$/.test(str)) return false
    const len = str.length
    const root = Math.round(Math.sqrt(len))
    return root * root === len
  },
  prime_length: (str: string) => {
    if (!/^0*$/.test(str)) return false
    return isPrime(str.length)
  },
  an_bm_n_gt_m: (str: string) => {
    const match = str.match(/^(0*)(1*)$/)
    if (!match) return false
    return match[1].length > match[2].length
  },
  an_b2n: (str: string) => {
    if (str === '') return true
    const match = str.match(/^(a+)(b+)$/)
    return !!match && match[2].length === 2 * match[1].length
  },
  equal_zeros_ones: (str: string) => {
    const zeros = (str.match(/0/g) || []).length
    const ones = (str.match(/1/g) || []).length
    return zeros === ones
  },
}

/**
 * Generates an adversarial, mathematically rigorous non-regularity proof via Pumping Lemma.
 */
export function generateNonRegularityProof(pattern: NonRegularPattern): NonRegularityProof {
  const theoremStatement =
    '**Pumping Lemma for Regular Languages:** If $L$ is a regular language, then there exists an integer $p \\ge 1$ (the pumping length) such that every string $s \\in L$ with $|s| \\ge p$ can be written as $s = xyz$, satisfying three conditions:\n' +
    '1. $|y| \\ge 1$ (the pumped substring $y$ is non-empty),\n' +
    '2. $|xy| \\le p$ ($y$ occurs entirely within the first $p$ symbols),\n' +
    '3. $\\forall i \\ge 0,\\; x y^i z \\in L$ ($y$ can be pumped any number of times without leaving $L$).'

  switch (pattern) {
    case 'an_bn': {
      const isMember = NON_REGULAR_MEMBERSHIP_PREDICATES.an_bn
      return {
        pattern,
        languageName: 'Equal 0s followed by equal 1s',
        languageSetNotation: 'L = \\{ 0^n 1^n \\mid n \\ge 0 \\}',
        formalTheoremStatement: theoremStatement,
        adversarialGameSteps: [
          {
            stepNumber: 1,
            party: 'Opponent',
            action: 'Fixes an arbitrary pumping length $p \\ge 1$.',
            mathematicalDetails: 'We must treat $p$ as a fixed unknown constant.',
          },
          {
            stepNumber: 2,
            party: 'We (Prover)',
            action: 'Choose an adversarial witness string $s = 0^p 1^p \\in L$.',
            mathematicalDetails: '$|s| = 2p \\ge p$, so the lemma must apply if $L$ were regular.',
          },
          {
            stepNumber: 3,
            party: 'Opponent',
            action: 'Splits $s = xyz$ such that $|xy| \\le p$ and $|y| \\ge 1$.',
            mathematicalDetails: 'Because $|xy| \\le p$, $xy$ lies strictly within the initial block of $0$s. Therefore, $y = 0^k$ for some $1 \\le k \\le p$.',
          },
          {
            stepNumber: 4,
            party: 'We (Prover)',
            action: 'Choose contradiction exponent $i = 0$ (or $i = 2$).',
            mathematicalDetails: 'For $i = 0$, $x y^0 z = xz = 0^{p-k} 1^p$. Since $k \\ge 1$, $p-k < p$, so the count of 0s does not equal the count of 1s. Thus $xz \\notin L$.',
          },
        ],
        chosenPumpingLengthSymbol: 'p',
        selectedTestString: '0^p 1^p',
        selectedTestStringExplanation: 'This string belongs to L and has length 2p >= p. Any prefix of length at most p consists entirely of 0s.',
        universalDecompositionArgument:
          'Since $|xy| \\le p$, the prefix $xy$ contains only $0$s. Consequently, $x = 0^a$, $y = 0^b$, and $z = 0^{p - a - b} 1^p$, where $a \\ge 0$, $b \\ge 1$, and $a + b \\le p$. The substring $y$ consists exclusively of $b$ zeros.',
        contradictionExponentChoice: 0,
        pumpedStringFormula: 'x y^0 z = 0^{p-b} 1^p',
        contradictionExplanation:
          'Because $b \\ge 1$, the number of zeros in $x y^0 z$ is $p - b < p$, while the number of ones remains $p$. Since $p - b \\neq p$, $x y^0 z \\notin L$, contradicting condition (3) of the Pumping Lemma.',
        fullFormalProofMarkdown:
          `### Non-Regularity Proof for $L = \\{ 0^n 1^n \\mid n \\ge 0 \\}$\n\n` +
          `**Claim:** The language $L$ is not regular.\n\n` +
          `**Proof (by Contradiction):**\n` +
          `1. Assume for the sake of contradiction that $L$ is regular.\n` +
          `2. By the Pumping Lemma for regular languages, there exists a pumping length $p \\ge 1$.\n` +
          `3. Consider the string $s = 0^p 1^p$. Since $s \\in L$ and $|s| = 2p \\ge p$, the Pumping Lemma guarantees that $s$ can be written as $s = xyz$ such that:\n` +
          `   - $|y| \\ge 1$\n` +
          `   - $|xy| \\le p$\n` +
          `   - $x y^i z \\in L$ for all $i \\ge 0$.\n` +
          `4. Since $|xy| \\le p$, the substring $xy$ lies entirely within the first $p$ characters of $s$, which are all $0$s. Therefore, $y = 0^k$ for some integer $k$ with $1 \\le k \\le p$.\n` +
          `5. Now pump down by taking $i = 0$: $x y^0 z = xz = 0^{p-k} 1^p$.\n` +
          `6. Since $k \\ge 1$, $p - k < p$. The string $xz$ contains strictly fewer $0$s than $1$s, so $xz \\notin L$.\n` +
          `7. This contradicts the Pumping Lemma guarantee that $x y^0 z \\in L$.\n\n` +
          `**Conclusion:** The assumption that $L$ is regular must be false. Therefore, $L$ is not regular. $\\blacksquare$`,
        isMember,
      }
    }

    case 'an_bn_cn': {
      const isMember = NON_REGULAR_MEMBERSHIP_PREDICATES.an_bn_cn
      return {
        pattern,
        languageName: 'Equal a, b, and c symbols in sequence',
        languageSetNotation: 'L = \\{ a^n b^n c^n \\mid n \\ge 0 \\}',
        formalTheoremStatement: theoremStatement,
        adversarialGameSteps: [
          { stepNumber: 1, party: 'Opponent', action: 'Gives pumping length $p$.', mathematicalDetails: 'Arbitrary $p \\ge 1$.' },
          { stepNumber: 2, party: 'We (Prover)', action: 'Choose string $s = a^p b^p c^p$.', mathematicalDetails: '$s \\in L$ and $|s| = 3p \\ge p$.' },
          { stepNumber: 3, party: 'Opponent', action: 'Splits $s = xyz$ with $|xy| \\le p, |y| \\ge 1$.', mathematicalDetails: '$xy$ is in the initial $a$-block, so $y = a^k$ ($k \\ge 1$).' },
          { stepNumber: 4, party: 'We (Prover)', action: 'Pump with $i = 2$: $x y^2 z = a^{p+k} b^p c^p$.', mathematicalDetails: 'Since $k \\ge 1$, $p+k > p$, so $a$-count exceeds $b$- and $c$-counts.' },
        ],
        chosenPumpingLengthSymbol: 'p',
        selectedTestString: 'a^p b^p c^p',
        selectedTestStringExplanation: 'Contains equal blocks of a, b, c of size p. First p symbols are purely a.',
        universalDecompositionArgument: 'Because $|xy| \\le p$, $y$ consists exclusively of $a$s ($y = a^k, k \\ge 1$). It contains no $b$s or $c$s.',
        contradictionExponentChoice: 2,
        pumpedStringFormula: 'x y^2 z = a^{p+k} b^p c^p',
        contradictionExplanation: 'The pumped string has $p+k$ as, $p$ bs, and $p$ cs. Since $k \\ge 1$, $p+k \\neq p$, so $x y^2 z \\notin L$.',
        fullFormalProofMarkdown:
          `### Non-Regularity Proof for $L = \\{ a^n b^n c^n \\mid n \\ge 0 \\}$\n\n` +
          `**Claim:** $L$ is not regular (in fact, $L$ is not even context-free).\n\n` +
          `**Proof:**\n` +
          `1. Assume $L$ is regular with pumping length $p$.\n` +
          `2. Choose $s = a^p b^p c^p \\in L$ with $|s| = 3p \\ge p$.\n` +
          `3. By condition (2) $|xy| \\le p$, $y$ must consist solely of $a$s: $y = a^k$ with $k \\ge 1$.\n` +
          `4. For $i = 2$, $x y^2 z = a^{p+k} b^p c^p$.\n` +
          `5. Because $k \\ge 1$, the number of $a$s exceeds the number of $b$s and $c$s ($p+k \\neq p$). Thus $x y^2 z \\notin L$.\n` +
          `6. Contradiction. Therefore, $L$ is not regular. $\\blacksquare$`,
        isMember,
      }
    }

    case 'palindromes': {
      const isMember = NON_REGULAR_MEMBERSHIP_PREDICATES.palindromes
      return {
        pattern,
        languageName: 'Binary Palindromes',
        languageSetNotation: 'L = \\{ w \\in \\{0,1\\}^* \\mid w = w^R \\}',
        formalTheoremStatement: theoremStatement,
        adversarialGameSteps: [
          { stepNumber: 1, party: 'Opponent', action: 'Fixes pumping length $p$.', mathematicalDetails: '$p \\ge 1$.' },
          { stepNumber: 2, party: 'We (Prover)', action: 'Choose $s = 0^p 1 0^p$.', mathematicalDetails: '$s$ is a palindrome and $|s| = 2p + 1 \\ge p$.' },
          { stepNumber: 3, party: 'Opponent', action: 'Splits $s = xyz$ with $|xy| \\le p, |y| \\ge 1$.', mathematicalDetails: '$xy$ is within first $p$ zeros, so $y = 0^k$ ($1 \\le k \\le p$).' },
          { stepNumber: 4, party: 'We (Prover)', action: 'Pump with $i = 2$: $x y^2 z = 0^{p+k} 1 0^p$.', mathematicalDetails: 'The reversed string is $0^p 1 0^{p+k} \\neq 0^{p+k} 1 0^p$.' },
        ],
        chosenPumpingLengthSymbol: 'p',
        selectedTestString: '0^p 1 0^p',
        selectedTestStringExplanation: 'A palindrome of odd length 2p+1 with a unique 1 at the exact center.',
        universalDecompositionArgument: 'The first p characters are all 0. Since $|xy| \\le p$, $y = 0^k$ where $1 \\le k \\le p$.',
        contradictionExponentChoice: 2,
        pumpedStringFormula: 'x y^2 z = 0^{p+k} 1 0^p',
        contradictionExplanation: 'The prefix has $p+k$ zeros while the suffix has only $p$ zeros. Since $k \\ge 1$, the string is asymmetric and not a palindrome.',
        fullFormalProofMarkdown:
          `### Non-Regularity Proof for Palindromes $L = \\{ w \\in \\{0,1\\}^* \\mid w = w^R \\}$\n\n` +
          `**Claim:** The language of palindromes over $\\{0,1\\}$ is not regular.\n\n` +
          `**Proof:**\n` +
          `1. Assume $L$ is regular with pumping length $p$.\n` +
          `2. Choose $s = 0^p 1 0^p \\in L$ ($|s| = 2p + 1 \\ge p$).\n` +
          `3. Since $|xy| \\le p$, $y$ is entirely within the leading zeros: $y = 0^k$ for $k \\ge 1$.\n` +
          `4. For $i = 2$, $x y^2 z = 0^{p+k} 1 0^p$.\n` +
          `5. Its reversal is $(0^{p+k} 1 0^p)^R = 0^p 1 0^{p+k} \\neq 0^{p+k} 1 0^p$ because $k \\ge 1$.\n` +
          `6. Therefore, $x y^2 z \\notin L$, contradicting the Pumping Lemma.\n` +
          `7. Hence, $L$ is not regular. $\\blacksquare$`,
        isMember,
      }
    }

    case 'ww': {
      const isMember = NON_REGULAR_MEMBERSHIP_PREDICATES.ww
      return {
        pattern,
        languageName: 'Duplicate Strings (ww)',
        languageSetNotation: 'L = \\{ w w \\mid w \\in \\{0,1\\}^* \\}',
        formalTheoremStatement: theoremStatement,
        adversarialGameSteps: [
          { stepNumber: 1, party: 'Opponent', action: 'Gives pumping length $p$.', mathematicalDetails: '$p \\ge 1$.' },
          { stepNumber: 2, party: 'We (Prover)', action: 'Choose $s = 0^p 1 0^p 1$.', mathematicalDetails: 'Here $w = 0^p 1$, so $s = ww \\in L$ and $|s| = 2p+2 \\ge p$.' },
          { stepNumber: 3, party: 'Opponent', action: 'Splits $s = xyz$ with $|xy| \\le p, |y| \\ge 1$.', mathematicalDetails: '$y = 0^k$ ($1 \\le k \\le p$) in the first block of zeros.' },
          { stepNumber: 4, party: 'We (Prover)', action: 'Choose $i = 2$: $x y^2 z = 0^{p+k} 1 0^p 1$.', mathematicalDetails: 'The only 1s are at index $p+k$ and $2p+k+1$, which prevents decomposition into identical halves.' },
        ],
        chosenPumpingLengthSymbol: 'p',
        selectedTestString: '0^p 1 0^p 1',
        selectedTestStringExplanation: 'Concatenation of two identical halves w = 0^p 1. The markers 1 separate the two zero blocks.',
        universalDecompositionArgument: 'Because $|xy| \\le p$, $y$ consists entirely of zeros in the first half ($y = 0^k, 1 \\le k \\le p$).',
        contradictionExponentChoice: 2,
        pumpedStringFormula: 'x y^2 z = 0^{p+k} 1 0^p 1',
        contradictionExplanation: 'The total length is $2p + k + 2$. If it were of the form $uu$, each half would have length $p + k/2 + 1$. The first half contains the first 1, but the second half starts with zeros and contains the second 1 at the end, meaning the two halves cannot be equal.',
        fullFormalProofMarkdown:
          `### Non-Regularity Proof for $L = \\{ w w \\mid w \\in \\{0,1\\}^* \\}$\n\n` +
          `**Claim:** $L = \\{ w w \\mid w \\in \\{0,1\\}^* \\}$ is not regular.\n\n` +
          `**Proof:**\n` +
          `1. Assume $L$ is regular with pumping length $p$.\n` +
          `2. Choose $s = 0^p 1 0^p 1 \\in L$ where $w = 0^p 1$ and $|s| = 2p+2 \\ge p$.\n` +
          `3. By condition $|xy| \\le p$, $y = 0^k$ with $k \\ge 1$ inside the first block of $0$s.\n` +
          `4. For $i = 2$, $x y^2 z = 0^{p+k} 1 0^p 1$.\n` +
          `5. This string contains exactly two $1$s. In any split into two identical halves $u u$, each $u$ must contain exactly one $1$.\n` +
          `6. Therefore, the first half must end with the first $1$, meaning $|u| = p + k + 1$. But the remaining portion has length $p + 1 \\neq p + k + 1$ (since $k \\ge 1$).\n` +
          `7. Thus, $x y^2 z$ cannot be factored as $u u$, so $x y^2 z \\notin L$.\n` +
          `8. Contradiction. Therefore, $L$ is not regular. $\\blacksquare$`,
        isMember,
      }
    }

    case 'square_length': {
      const isMember = NON_REGULAR_MEMBERSHIP_PREDICATES.square_length
      return {
        pattern,
        languageName: 'Square Length Strings',
        languageSetNotation: 'L = \\{ 0^{n^2} \\mid n \\ge 0 \\}',
        formalTheoremStatement: theoremStatement,
        adversarialGameSteps: [
          { stepNumber: 1, party: 'Opponent', action: 'Gives pumping length $p$.', mathematicalDetails: '$p \\ge 1$.' },
          { stepNumber: 2, party: 'We (Prover)', action: 'Choose $s = 0^{p^2} \\in L$.', mathematicalDetails: '$|s| = p^2 \\ge p$.' },
          { stepNumber: 3, party: 'Opponent', action: 'Splits $s = xyz$ with $|xy| \\le p, |y| = k \\ge 1$.', mathematicalDetails: '$1 \\le k \\le p$.' },
          { stepNumber: 4, party: 'We (Prover)', action: 'Choose $i = 2$: $|x y^2 z| = p^2 + k$.', mathematicalDetails: '$p^2 < p^2 + k \\le p^2 + p < (p+1)^2$.' },
        ],
        chosenPumpingLengthSymbol: 'p',
        selectedTestString: '0^{p^2}',
        selectedTestStringExplanation: 'Length is exactly p^2, which is a perfect square.',
        universalDecompositionArgument: 'Since the alphabet is unary, $y = 0^k$ where $1 \\le k \\le p$.',
        contradictionExponentChoice: 2,
        pumpedStringFormula: 'x y^2 z = 0^{p^2 + k}',
        contradictionExplanation: 'The length of $x y^2 z$ is $p^2 + k$. Since $1 \\le k \\le p$, we have $p^2 < p^2 + k < p^2 + 2p + 1 = (p+1)^2$. Since there are no perfect squares strictly between $p^2$ and $(p+1)^2$, $p^2 + k$ cannot be a square.',
        fullFormalProofMarkdown:
          `### Non-Regularity Proof for $L = \\{ 0^{n^2} \\mid n \\ge 0 \\}$\n\n` +
          `**Claim:** $L = \\{ 0^{n^2} \\mid n \\ge 0 \\}$ is not regular.\n\n` +
          `**Proof:**\n` +
          `1. Assume $L$ is regular with pumping length $p$.\n` +
          `2. Choose $s = 0^{p^2} \\in L$ with $|s| = p^2 \\ge p$.\n` +
          `3. By condition $|xy| \\le p$ and $|y| \\ge 1$, we have $y = 0^k$ for some $1 \\le k \\le p$.\n` +
          `4. Consider $i = 2$. Then $|x y^2 z| = p^2 + k$.\n` +
          `5. We bound the length of $x y^2 z$:\n` +
          `   $$p^2 < p^2 + k \\le p^2 + p < p^2 + 2p + 1 = (p+1)^2$$\n` +
          `6. The length $p^2 + k$ falls strictly between two consecutive perfect squares $p^2$ and $(p+1)^2$. Thus, it cannot be a square.\n` +
          `7. Therefore, $x y^2 z \\notin L$, contradicting the Pumping Lemma.\n` +
          `8. Hence, $L$ is not regular. $\\blacksquare$`,
        isMember,
      }
    }

    case 'prime_length': {
      const isMember = NON_REGULAR_MEMBERSHIP_PREDICATES.prime_length
      return {
        pattern,
        languageName: 'Prime Length Strings',
        languageSetNotation: 'L = \\{ 0^q \\mid q \\text{ is prime} \\}',
        formalTheoremStatement: theoremStatement,
        adversarialGameSteps: [
          { stepNumber: 1, party: 'Opponent', action: 'Gives pumping length $p$.', mathematicalDetails: '$p \\ge 1$.' },
          { stepNumber: 2, party: 'We (Prover)', action: 'Choose prime $q \\ge p+2$ and string $s = 0^q$.', mathematicalDetails: '$|s| = q \\ge p$.' },
          { stepNumber: 3, party: 'Opponent', action: 'Splits $s = xyz$ with $|y| = k$ ($1 \\le k \\le p$).', mathematicalDetails: '$|x y^i z| = q + (i - 1)k$.' },
          { stepNumber: 4, party: 'We (Prover)', action: 'Choose $i = q + 1$.', mathematicalDetails: 'Length becomes $q + qk = q(1+k)$, which is composite!' },
        ],
        chosenPumpingLengthSymbol: 'p',
        selectedTestString: '0^q \\text{ for prime } q \\ge p+2',
        selectedTestStringExplanation: 'Length q is prime, so s is in L.',
        universalDecompositionArgument: 'Unary alphabet implies y = 0^k with 1 <= k <= p.',
        contradictionExponentChoice: 0,
        pumpedStringFormula: 'x y^{q+1} z = 0^{q(1+k)}',
        contradictionExplanation: 'The length is q(1+k). Since q >= 2 and 1+k >= 2, this length has non-trivial factors and is composite.',
        fullFormalProofMarkdown:
          `### Non-Regularity Proof for $L = \\{ 0^q \\mid q \\text{ is prime} \\}$\n\n` +
          `**Claim:** $L = \\{ 0^q \\mid q \\text{ is prime} \\}$ is not regular.\n\n` +
          `**Proof:**\n` +
          `1. Assume $L$ is regular with pumping length $p$.\n` +
          `2. Choose a prime $q \\ge p + 2$ and string $s = 0^q \\in L$.\n` +
          `3. By the lemma, $s = xyz$ with $|xy| \\le p$ and $|y| = k$ ($1 \\le k \\le p$).\n` +
          `4. For any $i \\ge 0$, $|x y^i z| = q + (i - 1)k$.\n` +
          `5. Set $i = q + 1$. Then $|x y^{q+1} z| = q + qk = q(k + 1)$.\n` +
          `6. Since $q \\ge 2$ and $k + 1 \\ge 2$, $q(k + 1)$ is composite and cannot be prime.\n` +
          `7. Thus, $x y^{q+1} z \\notin L$, contradicting the Pumping Lemma.\n` +
          `8. Therefore, $L$ is not regular. $\\blacksquare$`,
        isMember,
      }
    }

    case 'an_bm_n_gt_m': {
      const isMember = NON_REGULAR_MEMBERSHIP_PREDICATES.an_bm_n_gt_m
      return {
        pattern,
        languageName: 'More 0s than 1s',
        languageSetNotation: 'L = \\{ 0^n 1^m \\mid n > m \\ge 0 \\}',
        formalTheoremStatement: theoremStatement,
        adversarialGameSteps: [
          { stepNumber: 1, party: 'Opponent', action: 'Gives pumping length $p$.', mathematicalDetails: '$p \\ge 1$.' },
          { stepNumber: 2, party: 'We (Prover)', action: 'Choose $s = 0^{p+1} 1^p$.', mathematicalDetails: '$p+1 > p$, so $s \\in L$ and $|s| = 2p+1 \\ge p$.' },
          { stepNumber: 3, party: 'Opponent', action: 'Splits $s = xyz$ with $|xy| \\le p, |y| \\ge 1$.', mathematicalDetails: '$y = 0^k$ ($1 \\le k \\le p$) in the 0s.' },
          { stepNumber: 4, party: 'We (Prover)', action: 'Choose $i = 0$ (pump down).', mathematicalDetails: '$x y^0 z = 0^{p+1-k} 1^p$. Since $k \\ge 1$, $p+1-k \\le p$, violating $n > m$.' },
        ],
        chosenPumpingLengthSymbol: 'p',
        selectedTestString: '0^{p+1} 1^p',
        selectedTestStringExplanation: 'Has strictly one more zero than ones.',
        universalDecompositionArgument: 'Since $|xy| \\le p$, y contains only 0s ($y = 0^k, 1 \\le k \\le p$).',
        contradictionExponentChoice: 0,
        pumpedStringFormula: 'x y^0 z = 0^{p+1-k} 1^p',
        contradictionExplanation: 'Since $k \\ge 1$, $p + 1 - k \\le p$. The number of zeros is no longer strictly greater than the number of ones.',
        fullFormalProofMarkdown:
          `### Non-Regularity Proof for $L = \\{ 0^n 1^m \\mid n > m \\ge 0 \\}$\n\n` +
          `**Claim:** $L$ is not regular.\n\n` +
          `**Proof:**\n` +
          `1. Assume $L$ is regular with pumping length $p$.\n` +
          `2. Choose $s = 0^{p+1} 1^p \\in L$ ($|s| = 2p+1 \\ge p$).\n` +
          `3. Since $|xy| \\le p$, $y = 0^k$ with $1 \\le k \\le p$.\n` +
          `4. Pump down with $i = 0$: $x y^0 z = 0^{p+1-k} 1^p$.\n` +
          `5. Since $k \\ge 1$, $p + 1 - k \\le p$. The number of zeros is at most the number of ones, so $x y^0 z \\notin L$.\n` +
          `6. Contradiction. Therefore, $L$ is not regular. $\\blacksquare$`,
        isMember,
      }
    }

    case 'an_b2n': {
      const isMember = NON_REGULAR_MEMBERSHIP_PREDICATES.an_b2n
      return {
        pattern,
        languageName: 'aⁿ followed by b²ⁿ',
        languageSetNotation: 'L = \\{ a^n b^{2n} \\mid n \\ge 0 \\}',
        formalTheoremStatement: theoremStatement,
        adversarialGameSteps: [
          { stepNumber: 1, party: 'Opponent', action: 'Gives pumping length $p$.', mathematicalDetails: '$p \\ge 1$.' },
          { stepNumber: 2, party: 'We (Prover)', action: 'Choose $s = a^p b^{2p}$.', mathematicalDetails: '$s \\in L$ and $|s| = 3p \\ge p$.' },
          { stepNumber: 3, party: 'Opponent', action: 'Splits $s = xyz$ with $|xy| \\le p, |y| \\ge 1$.', mathematicalDetails: '$y = a^k$ ($1 \\le k \\le p$).' },
          { stepNumber: 4, party: 'We (Prover)', action: 'Choose $i = 2$: $x y^2 z = a^{p+k} b^{2p}$.', mathematicalDetails: '$2(p+k) = 2p + 2k \\neq 2p$ (since $k \\ge 1$).' },
        ],
        chosenPumpingLengthSymbol: 'p',
        selectedTestString: 'a^p b^{2p}',
        selectedTestStringExplanation: 'Exact 1:2 ratio of as to bs.',
        universalDecompositionArgument: 'First p symbols are all as, so y = a^k (1 <= k <= p).',
        contradictionExponentChoice: 2,
        pumpedStringFormula: 'x y^2 z = a^{p+k} b^{2p}',
        contradictionExplanation: 'The number of bs should be $2(p+k) = 2p + 2k$. But the string has only $2p$ bs. Since $k \\ge 1$, $2p \\neq 2p + 2k$.',
        fullFormalProofMarkdown:
          `### Non-Regularity Proof for $L = \\{ a^n b^{2n} \\mid n \\ge 0 \\}$\n\n` +
          `**Claim:** $L = \\{ a^n b^{2n} \\mid n \\ge 0 \\}$ is not regular.\n\n` +
          `**Proof:**\n` +
          `1. Assume $L$ is regular with pumping length $p$.\n` +
          `2. Choose $s = a^p b^{2p} \\in L$ ($|s| = 3p \\ge p$).\n` +
          `3. Since $|xy| \\le p$, $y = a^k$ with $k \\ge 1$.\n` +
          `4. For $i = 2$, $x y^2 z = a^{p+k} b^{2p}$.\n` +
          `5. For this to belong to $L$, the number of $b$s must be $2(p+k) = 2p + 2k$. But there are only $2p$ $b$s.\n` +
          `6. Since $k \\ge 1$, $2p + 2k > 2p$, so $x y^2 z \\notin L$.\n` +
          `7. Contradiction. Therefore, $L$ is not regular. $\\blacksquare$`,
        isMember,
      }
    }

    case 'equal_zeros_ones': {
      const isMember = NON_REGULAR_MEMBERSHIP_PREDICATES.equal_zeros_ones
      return {
        pattern,
        languageName: 'Equal count of 0s and 1s',
        languageSetNotation: 'L = \\{ w \\in \\{0,1\\}^* \\mid N_0(w) = N_1(w) \\}',
        formalTheoremStatement: theoremStatement,
        adversarialGameSteps: [
          { stepNumber: 1, party: 'Opponent', action: 'Gives pumping length $p$.', mathematicalDetails: '$p \\ge 1$.' },
          { stepNumber: 2, party: 'We (Prover)', action: 'Choose $s = 0^p 1^p$.', mathematicalDetails: '$N_0(s) = N_1(s) = p$, so $s \\in L$ and $|s| = 2p \\ge p$.' },
          { stepNumber: 3, party: 'Opponent', action: 'Splits $s = xyz$ with $|xy| \\le p, |y| \\ge 1$.', mathematicalDetails: '$y = 0^k$ ($1 \\le k \\le p$).' },
          { stepNumber: 4, party: 'We (Prover)', action: 'Choose $i = 2$: $x y^2 z = 0^{p+k} 1^p$.', mathematicalDetails: '$N_0(x y^2 z) = p+k \\neq p = N_1(x y^2 z)$.' },
        ],
        chosenPumpingLengthSymbol: 'p',
        selectedTestString: '0^p 1^p',
        selectedTestStringExplanation: 'Equal numbers of 0s and 1s, partitioned cleanly.',
        universalDecompositionArgument: 'Since $|xy| \\le p$, y lies strictly inside the 0s block ($y = 0^k, k \\ge 1$).',
        contradictionExponentChoice: 2,
        pumpedStringFormula: 'x y^2 z = 0^{p+k} 1^p',
        contradictionExplanation: 'Has $p+k$ zeros and $p$ ones. Because $k \\ge 1$, $p+k \\neq p$, violating equal count.',
        fullFormalProofMarkdown:
          `### Non-Regularity Proof for $L = \\{ w \\in \\{0,1\\}^* \\mid N_0(w) = N_1(w) \\}$\n\n` +
          `**Claim:** The language of strings with equal numbers of $0$s and $1$s is not regular.\n\n` +
          `**Proof:**\n` +
          `1. Assume $L$ is regular with pumping length $p$.\n` +
          `2. Choose $s = 0^p 1^p \\in L$ ($|s| = 2p \\ge p$).\n` +
          `3. By condition $|xy| \\le p$, $y = 0^k$ for some $1 \\le k \\le p$.\n` +
          `4. For $i = 2$, $x y^2 z = 0^{p+k} 1^p$.\n` +
          `5. $N_0(x y^2 z) = p + k$ and $N_1(x y^2 z) = p$. Since $k \\ge 1$, $p + k \\neq p$.\n` +
          `6. Therefore, $x y^2 z \\notin L$, contradicting the Pumping Lemma.\n` +
          `7. Hence, $L$ is not regular. $\\blacksquare$`,
        isMember,
      }
    }
  }
}

