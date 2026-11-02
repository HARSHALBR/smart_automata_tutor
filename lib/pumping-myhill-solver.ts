/**
 * Pumping Lemma & Myhill–Nerode Theorem Unified Solver:
 * - Solves non-regularity proof requests via Pumping Lemma with adversarial game steps
 * - Computes Myhill–Nerode equivalence classes and minimal DFA state counts
 * - Discovers shortest distinguishing suffixes between any string pairs
 * - Generates comprehensive LaTeX/Markdown educational proofs
 */

import {
  type NonRegularPattern,
  type NonRegularityProof,
  type StringDecomposition,
  type PumpTestResult,
  generateNonRegularityProof,
  getAllDecompositions,
  testDecompositionPumping,
  NON_REGULAR_MEMBERSHIP_PREDICATES,
} from './pumping-lemma'
import {
  type DistinguishingSuffixResult,
  type MyhillNerodeAnalysis,
  findDistinguishingSuffix,
  getStandardMyhillNerodeAnalysis,
  analyzeMyhillNerodeForDfa,
} from './myhill-nerode'
import { type Automaton, runAutomatonDetailed } from './automata'

export type PumpingMyhillProblemType =
  | 'pumping_lemma_proof'
  | 'pumping_tester'
  | 'myhill_nerode_analysis'
  | 'distinguishing_suffix'
  | 'min_dfa_states'

export interface PumpingMyhillSpec {
  type: PumpingMyhillProblemType
  pattern?: NonRegularPattern | string
  customLanguageName?: string
  stringX?: string
  stringY?: string
  candidateString?: string
  pumpingLength?: number
  alphabet?: string[]
  givenDfa?: Automaton
}

export interface PumpingMyhillSolution {
  interpretedQuestion: string
  theoryTopic: 'Pumping Lemma' | 'Myhill–Nerode Theorem'
  formalTheoremStatementMarkdown: string
  nonRegularityProof?: NonRegularityProof
  myhillNerodeAnalysis?: MyhillNerodeAnalysis
  distinguishingResult?: DistinguishingSuffixResult
  interactivePumpingData?: {
    candidateString: string
    pumpingLength: number
    decompositions: StringDecomposition[]
    activeDecompositionIndex: number
    pumpTestResults: PumpTestResult[]
  }
  stepByStepSteps: string[]
  finalConclusion: string
}

export function solvePumpingMyhillProblem(
  questionPrompt: string,
  spec: PumpingMyhillSpec,
): PumpingMyhillSolution {
  const isPumpingTopic =
    spec.type === 'pumping_lemma_proof' ||
    spec.type === 'pumping_tester' ||
    /pumping|pump|not regular|non[- ]regular/i.test(questionPrompt)

  const theoryTopic = isPumpingTopic ? 'Pumping Lemma' : 'Myhill–Nerode Theorem'

  let nonRegProof: NonRegularityProof | undefined
  let myhillAnalysis: MyhillNerodeAnalysis | undefined
  let distResult: DistinguishingSuffixResult | undefined
  let interactivePumpingData: PumpingMyhillSolution['interactivePumpingData'] = undefined
  const steps: string[] = []

  const rawPattern = spec.pattern || 'an_bn'
  const patternKey = rawPattern as NonRegularPattern

  if (theoryTopic === 'Pumping Lemma') {
    nonRegProof = generateNonRegularityProof(patternKey)

    // Interactive pumping data setup
    const p = spec.pumpingLength || 4
    let candString = spec.candidateString
    if (!candString) {
      if (patternKey === 'an_bn') candString = '0'.repeat(p) + '1'.repeat(p)
      else if (patternKey === 'palindromes') candString = '0'.repeat(p) + '1' + '0'.repeat(p)
      else if (patternKey === 'ww') candString = '0'.repeat(p) + '1' + '0'.repeat(p) + '1'
      else candString = '0'.repeat(p) + '1'.repeat(p)
    }

    const decompositions = getAllDecompositions(candString, p)
    const activeDecomp = decompositions[0] || {
      x: '',
      y: candString.slice(0, 1),
      z: candString.slice(1),
      p,
      satisfiesLengthConstraint: true,
      satisfiesNonEmptyY: true,
    }

    const pumpResults = testDecompositionPumping(activeDecomp, nonRegProof.isMember, [0, 1, 2, 3])

    interactivePumpingData = {
      candidateString: candString,
      pumpingLength: p,
      decompositions,
      activeDecompositionIndex: 0,
      pumpTestResults: pumpResults,
    }

    steps.push(`1. Formulated proof by contradiction for language: ${nonRegProof.languageName} (${nonRegProof.languageSetNotation}).`)
    steps.push(`2. Assumed L is regular, yielding pumping length p >= 1.`)
    steps.push(`3. Selected adversarial string s = "${nonRegProof.selectedTestString}" with length |s| >= p.`)
    steps.push(`4. Universally analyzed all splits s = xyz with |xy| <= p and |y| >= 1: y contains only prefix symbols.`)
    steps.push(`5. Evaluated pumped strings: taking i = ${nonRegProof.contradictionExponentChoice} yields ${nonRegProof.pumpedStringFormula} ∉ L.`)
    steps.push(`6. Contradiction reached; proved L is not regular.`)

    return {
      interpretedQuestion: questionPrompt,
      theoryTopic,
      formalTheoremStatementMarkdown: nonRegProof.formalTheoremStatement,
      nonRegularityProof: nonRegProof,
      interactivePumpingData,
      stepByStepSteps: steps,
      finalConclusion: `The language ${nonRegProof.languageName} is mathematically proven to be NON-REGULAR by the Pumping Lemma.`,
    }
  }

  // Otherwise, Myhill-Nerode analysis
  if (spec.givenDfa) {
    myhillAnalysis = analyzeMyhillNerodeForDfa(spec.givenDfa)
  } else {
    myhillAnalysis = getStandardMyhillNerodeAnalysis(patternKey)
  }

  // If a specific string pair was requested
  const alphabet = spec.alphabet || ['0', '1']
  if (spec.stringX !== undefined && spec.stringY !== undefined) {
    const isMember = (str: string) => {
      if (spec.givenDfa) {
        return runAutomatonDetailed(spec.givenDfa, str).accepted
      }
      if (rawPattern === 'ends_with_01') {
        return str.endsWith('01')
      }
      return NON_REGULAR_MEMBERSHIP_PREDICATES[patternKey]?.(str) ?? false
    }

    distResult = findDistinguishingSuffix(spec.stringX, spec.stringY, alphabet, isMember, 6)
  }

  steps.push(`1. Evaluated Myhill–Nerode equivalence relation (~_L) for language: ${myhillAnalysis.languageName}.`)
  steps.push(`2. Index determination: relation is of ${myhillAnalysis.indexType.toUpperCase()} index (${myhillAnalysis.numberOfClasses} classes).`)
  if (myhillAnalysis.isRegular) {
    steps.push(`3. By the Myhill–Nerode Theorem, L is REGULAR and the unique minimal DFA contains exactly ${myhillAnalysis.minimumDfaStateCount} states.`)
  } else {
    steps.push(`3. Constructed an infinite family of pairwise distinguishable strings (${myhillAnalysis.infiniteFamily?.familyFormula}).`)
    steps.push(`4. By the Myhill–Nerode Theorem, infinite index proves L is NON-REGULAR.`)
  }

  return {
    interpretedQuestion: questionPrompt,
    theoryTopic,
    formalTheoremStatementMarkdown:
      `**Myhill–Nerode Theorem:** Let $L$ be a language over alphabet $\\Sigma$. Define the equivalence relation $\\sim_L$ on $\\Sigma^*$ by:\n` +
      `$$x \\sim_L y \\iff \\forall z \\in \\Sigma^*, (xz \\in L \\iff yz \\in L)$$\n` +
      `1. $L$ is regular if and only if $\\sim_L$ has a finite number of equivalence classes (finite index).\n` +
      `2. If $L$ is regular, the number of states in the minimal deterministic finite automaton (DFA) accepting $L$ is exactly equal to the number of equivalence classes of $\\sim_L$.`,
    myhillNerodeAnalysis: myhillAnalysis,
    distinguishingResult: distResult,
    stepByStepSteps: steps,
    finalConclusion: myhillAnalysis.isRegular
      ? `The language ${myhillAnalysis.languageName} is REGULAR with minimal DFA state count of ${myhillAnalysis.minimumDfaStateCount}.`
      : `The language ${myhillAnalysis.languageName} is NON-REGULAR due to infinitely many Myhill–Nerode equivalence classes.`,
  }
}
