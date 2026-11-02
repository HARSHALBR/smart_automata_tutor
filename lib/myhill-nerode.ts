/**
 * Myhill–Nerode Theorem Engine:
 * - Formal definition of the Myhill–Nerode equivalence relation (x ~_L y)
 * - Distinguishable string detection & minimal distinguishing suffix generator
 * - Equivalence class enumeration for regular languages (finite index = min DFA states)
 * - Infinite pairwise distinguishable families for non-regular languages
 * - Direct mathematical bridge to DFA state minimization (Moore's algorithm)
 */

import { type Automaton, runAutomaton } from './automata'
import { minimizeDfa, type MinimizeResult } from './minimize'

export interface DistinguishingSuffixResult {
  stringX: string
  stringY: string
  distinguishingSuffix: string | null
  xConcatenated: string
  yConcatenated: string
  xInLanguage: boolean
  yInLanguage: boolean
  isDistinguishable: boolean
  searchDepthExplored: number
  explanation: string
}

export interface MyhillEquivalenceClass {
  id: string
  representative: string
  description: string
  isAccepting: boolean
  sampleStrings: string[]
  transitionsOnSymbol: Record<string, string> // symbol -> nextClassId
}

export interface InfiniteFamilyDescription {
  familyFormula: string
  sampleStrings: string[]
  distinguishingSuffixRule: string
  distinguishPair: (i: number, j: number) => { suffix: string; explanation: string }
}

export interface MyhillNerodeAnalysis {
  languageName: string
  languageFormula: string
  languageSetNotation?: string
  isRegular: boolean
  indexType: 'finite' | 'infinite'
  numberOfClasses: number | 'infinite'
  equivalenceClasses?: MyhillEquivalenceClass[]
  infiniteFamily?: InfiniteFamilyDescription
  minimumDfaStateCount: number | 'infinite'
  connectionToDfaMinimization: string
  formalProofMarkdown: string
}

/**
 * Searches for the shortest distinguishing suffix z for two strings x and y
 * such that (xz in L) != (yz in L).
 */
export function findDistinguishingSuffix(
  x: string,
  y: string,
  alphabet: string[],
  isMember: (str: string) => boolean,
  maxSearchDepth: number = 6,
): DistinguishingSuffixResult {
  // BFS queue over Sigma^*
  const queue: string[] = ['']
  const visited = new Set<string>([''])
  let depthExplored = 0

  while (queue.length > 0) {
    const z = queue.shift()!
    const xz = `${x}${z}`
    const yz = `${y}${z}`
    const xIn = isMember(xz)
    const yIn = isMember(yz)

    if (xIn !== yIn) {
      return {
        stringX: x,
        stringY: y,
        distinguishingSuffix: z === '' ? 'ε' : z,
        xConcatenated: xz === '' ? 'ε' : xz,
        yConcatenated: yz === '' ? 'ε' : yz,
        xInLanguage: xIn,
        yInLanguage: yIn,
        isDistinguishable: true,
        searchDepthExplored: z.length,
        explanation:
          `Suffix z = "${z === '' ? 'ε' : z}" distinguishes x = "${x}" from y = "${y}": ` +
          `xz = "${xz === '' ? 'ε' : xz}" ${xIn ? '∈ L' : '∉ L'}, whereas yz = "${yz === '' ? 'ε' : yz}" ${yIn ? '∈ L' : '∉ L'}.`,
      }
    }

    if (z.length < maxSearchDepth) {
      for (const sym of alphabet) {
        const nextZ = `${z}${sym}`
        if (!visited.has(nextZ)) {
          visited.add(nextZ)
          queue.push(nextZ)
        }
      }
    }
    depthExplored = Math.max(depthExplored, z.length)
  }

  return {
    stringX: x,
    stringY: y,
    distinguishingSuffix: null,
    xConcatenated: x,
    yConcatenated: y,
    xInLanguage: isMember(x),
    yInLanguage: isMember(y),
    isDistinguishable: false,
    searchDepthExplored: depthExplored,
    explanation:
      `No distinguishing suffix of length <= ${maxSearchDepth} was found. ` +
      `The strings x = "${x}" and y = "${y}" are either equivalent under ~_L or distinguishable only by a longer suffix.`,
  }
}

/**
 * Finds the exact shortest distinguishing suffix for two states in a DFA.
 */
export function findDistinguishingSuffixForDfaStates(
  dfa: Automaton,
  stateA: string,
  stateB: string,
): { suffix: string | null; explanation: string } {
  const isAccept = (st: string) => dfa.states.find((s) => s.id === st)?.accept ?? false

  // If one is accept and one is not, empty string epsilon distinguishes them immediately
  if (isAccept(stateA) !== isAccept(stateB)) {
    return {
      suffix: 'ε',
      explanation: `State "${stateA}" is ${isAccept(stateA) ? 'accepting' : 'non-accepting'}, while state "${stateB}" is ${isAccept(stateB) ? 'accepting' : 'non-accepting'}. Distinguishing suffix is ε.`,
    }
  }

  // BFS on pairs of states
  const queue: { sA: string; sB: string; path: string }[] = [{ sA: stateA, sB: stateB, path: '' }]
  const visited = new Set<string>([`${stateA}:::${stateB}`])

  while (queue.length > 0) {
    const { sA, sB, path } = queue.shift()!

    for (const sym of dfa.alphabet) {
      const nextA = dfa.delta[sA]?.[sym]?.[0]
      const nextB = dfa.delta[sB]?.[sym]?.[0]
      if (!nextA || !nextB) continue

      const nextPath = `${path}${sym}`
      if (isAccept(nextA) !== isAccept(nextB)) {
        return {
          suffix: nextPath,
          explanation: `Suffix "${nextPath}" distinguishes "${stateA}" and "${stateB}": delta("${stateA}", "${nextPath}") = "${nextA}" (${isAccept(nextA) ? 'accept' : 'reject'}), whereas delta("${stateB}", "${nextPath}") = "${nextB}" (${isAccept(nextB) ? 'accept' : 'reject'}).`,
        }
      }

      const key = `${nextA}:::${nextB}`
      if (!visited.has(key)) {
        visited.add(key)
        queue.push({ sA: nextA, sB: nextB, path: nextPath })
      }
    }
  }

  return {
    suffix: null,
    explanation: `States "${stateA}" and "${stateB}" are equivalent (indistinguishable by any suffix in Σ*). They belong to the same Myhill–Nerode equivalence class.`,
  }
}

/**
 * Computes the Myhill-Nerode analysis for a regular DFA.
 */
export function analyzeMyhillNerodeForDfa(dfa: Automaton): MyhillNerodeAnalysis {
  const minResult = minimizeDfa(dfa)
  const minDfa = minResult.minimized

  // Each state in minDfa corresponds to exactly one equivalence class
  const equivalenceClasses: MyhillEquivalenceClass[] = minDfa.states.map((st) => {
    // Find sample strings by BFS reaching this state
    const samples: string[] = []
    const q: { s: string; str: string }[] = [{ s: minDfa.start, str: '' }]
    const vis = new Set<string>([minDfa.start])

    while (q.length > 0) {
      const curr = q.shift()!
      if (curr.s === st.id) {
        samples.push(curr.str === '' ? 'ε' : curr.str)
        if (samples.length >= 3) break
      }
      for (const sym of minDfa.alphabet) {
        const nxt = minDfa.delta[curr.s]?.[sym]?.[0]
        if (nxt && (!vis.has(nxt) || curr.str.length < 3)) {
          vis.add(nxt)
          q.push({ s: nxt, str: `${curr.str}${sym}` })
        }
      }
    }

    const transitionsOnSymbol: Record<string, string> = {}
    for (const sym of minDfa.alphabet) {
      const tgt = minDfa.delta[st.id]?.[sym]?.[0]
      if (tgt) transitionsOnSymbol[sym] = tgt
    }

    const rep = samples[0] || (st.id === minDfa.start ? 'ε' : st.id)
    return {
      id: st.id,
      representative: rep,
      description: `Equivalence class [${rep}] corresponding to minimal DFA state ${st.id}`,
      isAccepting: !!st.accept,
      sampleStrings: samples,
      transitionsOnSymbol,
    }
  })

  const stateCount = minDfa.states.length
  return {
    languageName: dfa.name,
    languageFormula: dfa.language || 'Regular language L',
    isRegular: true,
    indexType: 'finite',
    numberOfClasses: stateCount,
    equivalenceClasses,
    minimumDfaStateCount: stateCount,
    connectionToDfaMinimization:
      `The Myhill–Nerode Theorem states that the index of ~_L equals the number of states in the unique minimal DFA. ` +
      `Here, the relation has ${stateCount} equivalence classes, matching the ${stateCount} states produced by Moore's partition refinement minimization algorithm.`,
    formalProofMarkdown:
      `### Myhill–Nerode Theorem Analysis\n\n` +
      `**Theorem:** A language $L$ is regular if and only if the equivalence relation $\\sim_L$ has a finite number of equivalence classes (finite index). Furthermore, the number of equivalence classes is precisely the number of states in the minimal DFA for $L$.\n\n` +
      `**Equivalence Classes (Index = ${stateCount}):**\n` +
      equivalenceClasses.map((c) => `- **Class $[${c.representative}]$** (State \`${c.id}\`): ${c.description} ${c.isAccepting ? '(Accepting)' : '(Rejecting)'}`).join('\n') +
      `\n\n**Conclusion:** Because the index of $\\sim_L$ is finite (${stateCount}), $L$ is regular, and any DFA deciding $L$ requires at least **${stateCount}** states. $\\blacksquare$`,
  }
}

/**
 * Computes canonical Myhill-Nerode analysis for standard languages (regular and non-regular).
 */
export function getStandardMyhillNerodeAnalysis(pattern: string): MyhillNerodeAnalysis {
  switch (pattern) {
    case 'an_bn':
      return {
        languageName: '{0ⁿ1ⁿ | n ≥ 0}',
        languageFormula: 'L = \\{ 0^n 1^n \\mid n \\ge 0 \\}',
        isRegular: false,
        indexType: 'infinite',
        numberOfClasses: 'infinite',
        minimumDfaStateCount: 'infinite',
        infiniteFamily: {
          familyFormula: 'S = \\{ 0^k \\mid k \\ge 0 \\}',
          sampleStrings: ['ε', '0', '00', '000', '0000', '00000'],
          distinguishingSuffixRule: 'For any i ≠ j, the suffix z = 1ⁱ distinguishes 0ⁱ from 0ʲ: 0ⁱ · 1ⁱ = 0ⁱ1ⁱ ∈ L, but 0ʲ · 1ⁱ = 0ʲ1ⁱ ∉ L.',
          distinguishPair: (i: number, j: number) => ({
            suffix: `1^${i}`,
            explanation: `String 0^${i} followed by 1^${i} equals 0^${i}1^${i} ∈ L, whereas 0^${j} followed by 1^${i} equals 0^${j}1^${i} ∉ L (since ${i} ≠ ${j}).`,
          }),
        },
        connectionToDfaMinimization:
          'Because ~_L has infinitely many pairwise distinguishable equivalence classes, no finite automaton can decide this language.',
        formalProofMarkdown:
          `### Non-Regularity Proof via Myhill–Nerode Theorem for $L = \\{ 0^n 1^n \\mid n \\ge 0 \\}$\n\n` +
          `**Claim:** $L = \\{ 0^n 1^n \\mid n \\ge 0 \\}$ is not regular.\n\n` +
          `**Proof:**\n` +
          `1. Consider the infinite set of strings $S = \\{ 0^k \\mid k \\ge 0 \\} = \\{ \\epsilon, 0, 00, 000, \\dots \\}$.\n` +
          `2. Let $i, j \\ge 0$ with $i \\neq j$. Consider the strings $x = 0^i$ and $y = 0^j$.\n` +
          `3. Choose the distinguishing suffix $z = 1^i$.\n` +
          `4. Concatenating $z$:\n` +
          `   - $x z = 0^i 1^i \\in L$.\n` +
          `   - $y z = 0^j 1^i \\notin L$ (since $i \\neq j$, the number of zeros does not equal the number of ones).\n` +
          `5. Thus, $x \\not\\sim_L y$ for every distinct pair $i, j$.\n` +
          `6. Every string in $S$ belongs to a distinct equivalence class of $\\sim_L$.\n` +
          `7. Since $S$ is infinite, the index of $\\sim_L$ is infinite.\n` +
          `8. By the Myhill–Nerode Theorem, $L$ cannot be regular. $\\blacksquare$`,
      }

    case 'palindromes':
      return {
        languageName: 'Binary Palindromes',
        languageSetNotation: 'L = \\{ w \\in \\{0,1\\}^* \\mid w = w^R \\}',
        languageFormula: 'L = \\{ w \\in \\{0,1\\}^* \\mid w = w^R \\}',
        isRegular: false,
        indexType: 'infinite',
        numberOfClasses: 'infinite',
        minimumDfaStateCount: 'infinite',
        infiniteFamily: {
          familyFormula: 'S = \\{ 0^k 1 \\mid k \\ge 0 \\}',
          sampleStrings: ['1', '01', '001', '0001', '00001'],
          distinguishingSuffixRule: 'For i ≠ j, the suffix z = 0ⁱ distinguishes 0ⁱ1 from 0ʲ1: 0ⁱ1 · 0ⁱ = 0ⁱ10ⁱ ∈ L, but 0ʲ1 · 0ⁱ = 0ʲ10ⁱ ∉ L.',
          distinguishPair: (i: number, j: number) => ({
            suffix: `0^${i}`,
            explanation: `0^${i}1 followed by 0^${i} is a palindrome ∈ L, whereas 0^${j}1 followed by 0^${i} is not a palindrome ∉ L.`,
          }),
        },
        connectionToDfaMinimization: 'Infinitely many pairwise distinguishable strings imply no finite state automaton can recognize palindromes.',
        formalProofMarkdown:
          `### Non-Regularity Proof via Myhill–Nerode Theorem for Palindromes\n\n` +
          `**Claim:** $L = \\{ w \\in \\{0,1\\}^* \\mid w = w^R \\}$ is not regular.\n\n` +
          `**Proof:**\n` +
          `1. Define the infinite family of strings $S = \\{ 0^k 1 \\mid k \\ge 0 \\}$.\n` +
          `2. For any $i \\neq j$, let $x = 0^i 1$ and $y = 0^j 1$.\n` +
          `3. Choose distinguishing suffix $z = 0^i$.\n` +
          `4. Then $x z = 0^i 1 0^i \\in L$ (palindrome), but $y z = 0^j 1 0^i \\notin L$ (not a palindrome since $i \\neq j$).\n` +
          `5. Therefore, $x \\not\\sim_L y$ for all distinct $i, j$, proving that $\\sim_L$ has infinitely many equivalence classes.\n` +
          `6. By the Myhill–Nerode Theorem, $L$ is not regular. $\\blacksquare$`,
      }

    case 'ends_with_01':
    default:
      return {
        languageName: 'Strings ending with 01',
        languageFormula: 'L = \\{ w \\in \\{0,1\\}^* \\mid w \\text{ ends with } 01 \\}',
        isRegular: true,
        indexType: 'finite',
        numberOfClasses: 3,
        minimumDfaStateCount: 3,
        equivalenceClasses: [
          {
            id: 'C_none',
            representative: 'ε',
            description: 'Strings not ending in 0 (ends in 1 or empty string)',
            isAccepting: false,
            sampleStrings: ['ε', '1', '11', '011'],
            transitionsOnSymbol: { '0': 'C_ends_0', '1': 'C_none' },
          },
          {
            id: 'C_ends_0',
            representative: '0',
            description: 'Strings ending in 0',
            isAccepting: false,
            sampleStrings: ['0', '00', '10', '100'],
            transitionsOnSymbol: { '0': 'C_ends_0', '1': 'C_ends_01' },
          },
          {
            id: 'C_ends_01',
            representative: '01',
            description: 'Strings ending in 01 (Accepting Class)',
            isAccepting: true,
            sampleStrings: ['01', '001', '101', '1101'],
            transitionsOnSymbol: { '0': 'C_ends_0', '1': 'C_none' },
          },
        ],
        connectionToDfaMinimization:
          'Each of the 3 equivalence classes corresponds to one state in the 3-state minimal DFA for "ends with 01": q0 (none), q1 (ends in 0), and q2 (ends in 01). Suffixes 01, 1, and ε pairwise distinguish these 3 classes.',
        formalProofMarkdown:
          `### Myhill–Nerode Theorem Analysis for $L = \\{ w \\in \\{0,1\\}^* \\mid w \\text{ ends with } 01 \\}$\n\n` +
          `**Claim:** $L$ is regular with minimum DFA size of 3 states.\n\n` +
          `**Proof:**\n` +
          `1. The relation $\\sim_L$ partitions $\\{0,1\\}^*$ into exactly 3 equivalence classes:\n` +
          `   - $[\\epsilon]$: strings not ending in 0.\n` +
          `   - $[0]$: strings ending in 0.\n` +
          `   - $[01]$: strings ending in 01 (accepting).\n` +
          `2. Pairwise distinguishability:\n` +
          `   - $\\epsilon$ and $0$ are distinguished by $z = 1$: $\\epsilon \\cdot 1 = 1 \\notin L$, whereas $0 \\cdot 1 = 01 \\in L$.\n` +
          `   - $\\epsilon$ and $01$ are distinguished by $z = \\epsilon$: $\\epsilon \\notin L$, whereas $01 \\in L$.\n` +
          `   - $0$ and $01$ are distinguished by $z = 1$: $0 \\cdot 1 = 01 \\in L$, whereas $01 \\cdot 1 = 011 \\notin L$.\n` +
          `3. Since the index of $\\sim_L$ is exactly 3, any DFA recognizing $L$ must have at least 3 states, and the minimal DFA has exactly 3 states. $\\blacksquare$`,
      }
  }
}
