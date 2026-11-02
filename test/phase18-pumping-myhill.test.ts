import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  type NonRegularPattern,
  getAllDecompositions,
  pumpString,
  testDecompositionPumping,
  generateNonRegularityProof,
  NON_REGULAR_MEMBERSHIP_PREDICATES,
} from '../lib/pumping-lemma'
import {
  findDistinguishingSuffix,
  findDistinguishingSuffixForDfaStates,
  analyzeMyhillNerodeForDfa,
  getStandardMyhillNerodeAnalysis,
} from '../lib/myhill-nerode'
import { solvePumpingMyhillProblem } from '../lib/pumping-myhill-solver'
import { parseQuestion } from '../lib/nlp-parser'
import type { Automaton } from '../lib/automata'

describe('Phase 18 - Pumping Lemma and Myhill–Nerode Theorem Solver', () => {
  describe('1. Pumping Lemma Conditions & Decomposition Engine', () => {
    it('generates all valid splits s = xyz satisfying |xy| <= p and |y| >= 1', () => {
      const p = 3
      const s = '000111'
      const decomps = getAllDecompositions(s, p)

      assert(decomps.length > 0)
      for (const d of decomps) {
        assert(d.y.length >= 1, '|y| must be at least 1')
        assert(d.x.length + d.y.length <= p, '|xy| must be <= p')
        assert.strictEqual(`${d.x}${d.y}${d.z}`, s, 'x + y + z must reconstruct s')
      }
    })

    it('correctly pumps strings x y^i z across exponents i = 0, 1, 2, 3', () => {
      const decomp = { x: '0', y: '00', z: '111' }

      // i = 0 (pump down)
      assert.strictEqual(pumpString(decomp, 0), '0111')
      // i = 1 (original)
      assert.strictEqual(pumpString(decomp, 1), '000111')
      // i = 2 (pump up)
      assert.strictEqual(pumpString(decomp, 2), '00000111')
      // i = 3
      assert.strictEqual(pumpString(decomp, 3), '0000000111')
    })

    it('identifies pumping violations using the language predicate', () => {
      const isMember = NON_REGULAR_MEMBERSHIP_PREDICATES.an_bn
      const decomp = { x: '0', y: '0', z: '0111' } // s = 000111 in L, p=3
      const tests = testDecompositionPumping(decomp, isMember, [0, 1, 2])

      assert.strictEqual(tests.find((t) => t.i === 0)?.inLanguage, false) // 00111 ∉ L
      assert.strictEqual(tests.find((t) => t.i === 2)?.inLanguage, false) // 0000111 ∉ L
    })
  })

  describe('2. Canonical Non-Regularity Proofs (Contradiction Framework)', () => {
    it('constructs a mathematically sound proof for {0ⁿ1ⁿ | n ≥ 0}', () => {
      const proof = generateNonRegularityProof('an_bn')
      assert.strictEqual(proof.pattern, 'an_bn')
      assert(proof.fullFormalProofMarkdown.includes('0^p 1^p'))
      assert(proof.fullFormalProofMarkdown.includes('Proof (by Contradiction)'))
      assert(proof.fullFormalProofMarkdown.includes('xz = 0^{p-k} 1^p'))
      assert.strictEqual(proof.adversarialGameSteps.length, 4)
      assert.strictEqual(proof.contradictionExponentChoice, 0)
    })

    it('constructs a mathematically sound proof for {aⁿbⁿcⁿ | n ≥ 0}', () => {
      const proof = generateNonRegularityProof('an_bn_cn')
      assert(proof.fullFormalProofMarkdown.includes('a^p b^p c^p'))
      assert(proof.fullFormalProofMarkdown.includes('a^{p+k} b^p c^p'))
      assert.strictEqual(proof.contradictionExponentChoice, 2)
    })

    it('constructs a mathematically sound proof for Palindromes', () => {
      const proof = generateNonRegularityProof('palindromes')
      assert(proof.fullFormalProofMarkdown.includes('0^p 1 0^p'))
      assert(proof.fullFormalProofMarkdown.includes('0^{p+k} 1 0^p'))
      assert.strictEqual(proof.contradictionExponentChoice, 2)
    })

    it('constructs a mathematically sound proof for Duplicate Strings {ww}', () => {
      const proof = generateNonRegularityProof('ww')
      assert(proof.fullFormalProofMarkdown.includes('0^p 1 0^p 1'))
      assert.strictEqual(proof.contradictionExponentChoice, 2)
    })

    it('constructs a mathematically sound proof for Square Lengths {0ⁿ²}', () => {
      const proof = generateNonRegularityProof('square_length')
      assert(proof.fullFormalProofMarkdown.includes('0^{p^2}'))
      assert(proof.fullFormalProofMarkdown.includes('(p+1)^2'))
    })

    it('constructs a mathematically sound proof for Prime Lengths {0ᵖ}', () => {
      const proof = generateNonRegularityProof('prime_length')
      assert(proof.fullFormalProofMarkdown.includes('composite'))
      assert(proof.fullFormalProofMarkdown.includes('q(k + 1)'))
    })

    it('constructs a mathematically sound proof for More 0s than 1s {0ⁿ1ᵐ | n > m}', () => {
      const proof = generateNonRegularityProof('an_bm_n_gt_m')
      assert(proof.fullFormalProofMarkdown.includes('0^{p+1} 1^p'))
      assert.strictEqual(proof.contradictionExponentChoice, 0)
    })

    it('constructs a mathematically sound proof for Equal 0s and 1s', () => {
      const proof = generateNonRegularityProof('equal_zeros_ones')
      assert(proof.fullFormalProofMarkdown.includes('N_0'))
      assert(proof.fullFormalProofMarkdown.includes('N_1'))
    })
  })

  describe('3. Distinguishing Suffix Generator', () => {
    const endsWith01Predicate = (str: string) => str.endsWith('01')

    it('finds minimal distinguishing suffix for strings under ends-with-01', () => {
      // "0" vs "1": suffix "1" yields "01" (∈ L) vs "11" (∉ L)
      const res = findDistinguishingSuffix('0', '1', ['0', '1'], endsWith01Predicate, 6)
      assert.strictEqual(res.isDistinguishable, true)
      assert.strictEqual(res.distinguishingSuffix, '1')
      assert.strictEqual(res.xInLanguage, true)
      assert.strictEqual(res.yInLanguage, false)
    })

    it('identifies epsilon as distinguishing suffix when one string already belongs to L', () => {
      // "" vs "01": suffix ε yields "" (∉ L) vs "01" (∈ L)
      const res = findDistinguishingSuffix('', '01', ['0', '1'], endsWith01Predicate, 6)
      assert.strictEqual(res.isDistinguishable, true)
      assert.strictEqual(res.distinguishingSuffix, 'ε')
      assert.strictEqual(res.xInLanguage, false)
      assert.strictEqual(res.yInLanguage, true)
    })

    it('finds distinguishing suffix on DFA state pairs', () => {
      const dfa: Automaton = {
        id: 'dfa_01',
        name: 'Ends with 01',
        description: 'DFA accepting strings ending in 01',
        language: 'Ends with 01',
        alphabet: ['0', '1'],
        start: 'q0',
        states: [
          { id: 'q0', x: 0, y: 0, accept: false },
          { id: 'q1', x: 100, y: 0, accept: false },
          { id: 'q2', x: 200, y: 0, accept: true },
        ],
        edges: [],
        delta: {
          q0: { '0': ['q1'], '1': ['q0'] },
          q1: { '0': ['q1'], '1': ['q2'] },
          q2: { '0': ['q1'], '1': ['q0'] },
        },
      }

      // States q1 (ends in 0) and q0 (none): on input '1', q1 -> q2 (accept), q0 -> q0 (reject)
      const res = findDistinguishingSuffixForDfaStates(dfa, 'q1', 'q0')
      assert.strictEqual(res.suffix, '1')
      assert(res.explanation.includes('distinguishes'))
    })
  })

  describe('4. Myhill–Nerode Theorem & Equivalence Classes', () => {
    it('determines finite index and exact minimal state count for regular DFA', () => {
      const dfa: Automaton = {
        id: 'dfa_ends_01',
        name: 'Ends with 01',
        description: '3-state minimal DFA',
        language: 'Ends with 01',
        alphabet: ['0', '1'],
        start: 'q0',
        states: [
          { id: 'q0', x: 0, y: 0, accept: false },
          { id: 'q1', x: 100, y: 0, accept: false },
          { id: 'q2', x: 200, y: 0, accept: true },
        ],
        edges: [],
        delta: {
          q0: { '0': ['q1'], '1': ['q0'] },
          q1: { '0': ['q1'], '1': ['q2'] },
          q2: { '0': ['q1'], '1': ['q0'] },
        },
      }

      const analysis = analyzeMyhillNerodeForDfa(dfa)
      assert.strictEqual(analysis.isRegular, true)
      assert.strictEqual(analysis.indexType, 'finite')
      assert.strictEqual(analysis.numberOfClasses, 3)
      assert.strictEqual(analysis.minimumDfaStateCount, 3)
      assert.strictEqual(analysis.equivalenceClasses?.length, 3)
      assert(analysis.connectionToDfaMinimization.includes('3'))
    })

    it('demonstrates infinite index for non-regular {0ⁿ1ⁿ}', () => {
      const analysis = getStandardMyhillNerodeAnalysis('an_bn')
      assert.strictEqual(analysis.isRegular, false)
      assert.strictEqual(analysis.indexType, 'infinite')
      assert.strictEqual(analysis.numberOfClasses, 'infinite')
      assert.strictEqual(analysis.minimumDfaStateCount, 'infinite')
      assert(analysis.infiniteFamily !== undefined)
      assert(analysis.infiniteFamily.familyFormula.includes('0^k'))

      // Distinguish pair 0^2 and 0^5
      const pair = analysis.infiniteFamily.distinguishPair(2, 5)
      assert.strictEqual(pair.suffix, '1^2')
      assert(pair.explanation.includes('∈ L'))
      assert(pair.explanation.includes('∉ L'))
    })

    it('demonstrates infinite index for Palindromes', () => {
      const analysis = getStandardMyhillNerodeAnalysis('palindromes')
      assert.strictEqual(analysis.isRegular, false)
      assert.strictEqual(analysis.indexType, 'infinite')
      assert(analysis.infiniteFamily !== undefined)
    })
  })

  describe('5. Unified Problem Solver Output', () => {
    it('generates complete pedagogical non-regularity proof solution', () => {
      const solution = solvePumpingMyhillProblem('Prove that {0^n1^n | n ≥ 0} is not regular', {
        type: 'pumping_lemma_proof',
        pattern: 'an_bn',
      })

      assert.strictEqual(solution.theoryTopic, 'Pumping Lemma')
      assert(solution.nonRegularityProof !== undefined)
      assert(solution.interactivePumpingData !== undefined)
      assert(solution.interactivePumpingData.decompositions.length > 0)
      assert(solution.stepByStepSteps.length >= 5)
      assert(solution.finalConclusion.includes('NON-REGULAR'))
    })

    it('generates complete Myhill-Nerode analysis solution', () => {
      const solution = solvePumpingMyhillProblem('Myhill-Nerode theorem for {0^n 1^n}', {
        type: 'myhill_nerode_analysis',
        pattern: 'an_bn',
      })

      assert.strictEqual(solution.theoryTopic, 'Myhill–Nerode Theorem')
      assert(solution.myhillNerodeAnalysis !== undefined)
      assert.strictEqual(solution.myhillNerodeAnalysis.numberOfClasses, 'infinite')
      assert(solution.finalConclusion.includes('NON-REGULAR'))
    })

    it('generates distinguishing suffix discovery solution for given string pair', () => {
      const solution = solvePumpingMyhillProblem('Find distinguishing suffix for strings 0 and 1', {
        type: 'distinguishing_suffix',
        pattern: 'ends_with_01',
        stringX: '0',
        stringY: '1',
        alphabet: ['0', '1'],
      })

      assert(solution.distinguishingResult !== undefined)
      assert.strictEqual(solution.distinguishingResult.isDistinguishable, true)
      assert.strictEqual(solution.distinguishingResult.distinguishingSuffix, '1')
    })
  })

  describe('6. Natural Language Parser Routing', () => {
    it('routes {0^n 1^n} non-regularity requests to pumping_myhill domain', () => {
      const res = parseQuestion('Prove that {0^n1^n | n ≥ 0} is not regular.')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'pumping_myhill')
      assert.strictEqual(res.pumpingMyhillSpec?.type, 'pumping_lemma_proof')
      assert.strictEqual(res.pumpingMyhillSpec?.pattern, 'an_bn')
    })

    it('routes a^n b^n c^n non-regularity requests to pumping_myhill domain', () => {
      const res = parseQuestion('Prove that {a^n b^n c^n | n ≥ 0} is not regular.')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'pumping_myhill')
      assert.strictEqual(res.pumpingMyhillSpec?.type, 'pumping_lemma_proof')
      assert.strictEqual(res.pumpingMyhillSpec?.pattern, 'an_bn_cn')
    })

    it('routes palindrome non-regularity requests to pumping_myhill domain', () => {
      const res = parseQuestion('Prove that palindromes over {0,1} are not regular.')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'pumping_myhill')
      assert.strictEqual(res.pumpingMyhillSpec?.pattern, 'palindromes')
    })

    it('routes {ww} non-regularity requests to pumping_myhill domain', () => {
      const res = parseQuestion('Prove that {ww | w ∈ {0,1}*} is not regular.')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'pumping_myhill')
      assert.strictEqual(res.pumpingMyhillSpec?.pattern, 'ww')
    })

    it('routes Myhill-Nerode requests to pumping_myhill domain', () => {
      const res = parseQuestion('Apply Myhill–Nerode Theorem to {0^n 1^n}.')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'pumping_myhill')
      assert.strictEqual(res.pumpingMyhillSpec?.type, 'myhill_nerode_analysis')
    })

    it('routes distinguishing suffix requests to pumping_myhill domain', () => {
      const res = parseQuestion('Find distinguishing suffix for strings "0" and "01".')
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.targetDomain, 'pumping_myhill')
      assert.strictEqual(res.pumpingMyhillSpec?.type, 'distinguishing_suffix')
      assert.strictEqual(res.pumpingMyhillSpec?.stringX, '0')
      assert.strictEqual(res.pumpingMyhillSpec?.stringY, '01')
    })

    it('requests clarification for vague "pumping lemma" queries', () => {
      const res = parseQuestion('pumping lemma')
      assert.strictEqual(res.success, false)
      assert.strictEqual(res.targetDomain, 'pumping_myhill')
      assert.strictEqual(res.needsClarification, true)
      assert(res.clarificationOptions && res.clarificationOptions.length >= 4)
    })

    it('preserves existing DFA, NFA, CFG, PDA, and TM query routing without conflict', () => {
      const dfaRes = parseQuestion('Construct a DFA over {0,1} that accepts strings ending with 01.')
      assert.strictEqual(dfaRes.success, true)
      assert.notStrictEqual(dfaRes.targetDomain, 'pumping_myhill')

      const cfgRes = parseQuestion('Construct a CFG for palindromes over {0,1}.')
      assert.strictEqual(cfgRes.success, true)
      assert.strictEqual(cfgRes.targetDomain, 'cfg')

      const pdaRes = parseQuestion('Construct a PDA for a^n b^n.')
      assert.strictEqual(pdaRes.success, true)
      assert.strictEqual(pdaRes.targetDomain, 'pda')

      const tmRes = parseQuestion('Construct a TM that accepts a^n b^n c^n.')
      assert.strictEqual(tmRes.success, true)
      assert.strictEqual(tmRes.targetDomain, 'tm')
    })
  })
})
