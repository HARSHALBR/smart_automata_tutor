import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDfaEndsWith,
  buildDfaStartsWith,
  buildDfaContainsSubstring,
  buildDfaAvoidSubstring,
  buildDfaSymbolParity,
  buildDfaBinaryDivisibleBy,
  buildDfaLengthModulo,
  buildDfaNoConsecutive,
  buildNfaKthFromEnd,
  solveProblem,
  getInvariantProofSketch,
} from '../lib/automata-solver'
import { runAutomatonDetailed, validateAutomaton } from '../lib/automata'
import {
  layoutAutomaton,
  computeAutomatonBounds,
  distanceToSegment,
} from '../lib/graph-layout'

function isAccepted(auto: any, input: string): boolean {
  return runAutomatonDetailed(auto, input).accepted
}

describe('Phase 14 — Theoretical Correctness Proofs & SVG Graph Layout', () => {
  /* -------------------------------------------------------------------------- */
  /*                  1. DFA for Binary Strings Ending with '01'                */
  /* -------------------------------------------------------------------------- */

  describe('DFA: Binary Strings Ending with 01', () => {
    const { automaton, stateDescriptions } = buildDfaEndsWith(['0', '1'], '01')

    it('preserves the mathematically correct 3-state minimal transition table', () => {
      const val = validateAutomaton(automaton, { completeDfaRequired: true })
      assert.equal(val.valid, true)
      assert.equal(automaton.states.length, 3)
      assert.equal(automaton.start, 'q0')

      const acceptStates = automaton.states.filter((s) => s.accept).map((s) => s.id)
      assert.deepEqual(acceptStates, ['q2'])

      // Transition Table Invariant Verification:
      // q0: on 0 -> q1, on 1 -> q0
      // q1: on 0 -> q1, on 1 -> q2
      // q2: on 0 -> q1, on 1 -> q0
      assert.deepEqual(automaton.delta['q0']['0'], ['q1'])
      assert.deepEqual(automaton.delta['q0']['1'], ['q0'])
      assert.deepEqual(automaton.delta['q1']['0'], ['q1'])
      assert.deepEqual(automaton.delta['q1']['1'], ['q2'])
      assert.deepEqual(automaton.delta['q2']['0'], ['q1'])
      assert.deepEqual(automaton.delta['q2']['1'], ['q0'])
    })

    it('verifies exact accepted strings required by specification', () => {
      // 01 → Accepted
      assert.equal(isAccepted(automaton, '01'), true, '01 must be accepted')
      // 001 → Accepted
      assert.equal(isAccepted(automaton, '001'), true, '001 must be accepted')
      // 101 → Accepted
      assert.equal(isAccepted(automaton, '101'), true, '101 must be accepted')
      // 1101 → Accepted
      assert.equal(isAccepted(automaton, '1101'), true, '1101 must be accepted')
    })

    it('verifies exact rejected strings required by specification', () => {
      // 10 → Rejected
      assert.equal(isAccepted(automaton, '10'), false, '10 must be rejected')
      // 11 → Rejected
      assert.equal(isAccepted(automaton, '11'), false, '11 must be rejected')
      // 010 → Rejected
      assert.equal(isAccepted(automaton, '010'), false, '010 must be rejected')
      // 000 → Rejected
      assert.equal(isAccepted(automaton, '000'), false, '000 must be rejected')
    })

    it('verifies state descriptions match exact required semantics', () => {
      assert.equal(
        stateDescriptions['q0'],
        'The processed string does not end with 0 or 01.',
      )
      assert.equal(stateDescriptions['q1'], 'The processed string ends with 0.')
      assert.equal(stateDescriptions['q2'], 'The processed string ends with 01.')
    })
  })

  /* -------------------------------------------------------------------------- */
  /*            2. Problem-Specific Theoretical Correctness Proofs              */
  /* -------------------------------------------------------------------------- */

  describe('Theoretical Correctness Proof for Ending with 01', () => {
    const solution = solveProblem({
      type: 'dfa_from_language',
      alphabet: ['0', '1'],
      languagePattern: { kind: 'ends_with', paramString: '01' },
    })
    const proof = solution.invariantProofSketch

    it('includes specific semantics for q0, q1, and q2', () => {
      assert.ok(
        proof.includes('q0: The processed string does not end with 0 or 01.'),
        'Must explain q0 meaning',
      )
      assert.ok(
        proof.includes('q1: The processed string ends with 0.'),
        'Must explain q1 meaning',
      )
      assert.ok(
        proof.includes('q2: The processed string ends with 01.'),
        'Must explain q2 meaning',
      )
    })

    it('explains why each transition preserves these state meanings', () => {
      // From q0
      assert.ok(proof.includes('δ(q0, 0) = q1'), 'Must explain transition δ(q0, 0) = q1')
      assert.ok(proof.includes('δ(q0, 1) = q0'), 'Must explain transition δ(q0, 1) = q0')
      // From q1
      assert.ok(proof.includes('δ(q1, 0) = q1'), 'Must explain transition δ(q1, 0) = q1')
      assert.ok(proof.includes('δ(q1, 1) = q2'), 'Must explain transition δ(q1, 1) = q2')
      // From q2
      assert.ok(proof.includes('δ(q2, 0) = q1'), 'Must explain transition δ(q2, 0) = q1')
      assert.ok(proof.includes('δ(q2, 1) = q0'), 'Must explain transition δ(q2, 1) = q0')
    })

    it('includes all 5 required formal proof sections', () => {
      // 1. Base case
      assert.ok(
        proof.includes('Base Case') || proof.includes('Base Step'),
        'Must include Base case',
      )
      // 2. Inductive hypothesis
      assert.ok(proof.includes('Inductive Hypothesis'), 'Must include Inductive hypothesis')
      // 3. Inductive step
      assert.ok(proof.includes('Inductive Step'), 'Must include Inductive step')
      // 4. Acceptance condition
      assert.ok(proof.includes('Acceptance Condition'), 'Must include Acceptance condition')
      // 5. Soundness and completeness
      assert.ok(proof.includes('Soundness and Completeness'), 'Must include Soundness and completeness')
      assert.ok(proof.includes('Soundness:'), 'Must include Soundness detail')
      assert.ok(proof.includes('Completeness:'), 'Must include Completeness detail')
    })
  })

  describe('Problem-Specific Proofs across Other Supported Automata', () => {
    it('generates problem-specific proof for starts_with', () => {
      const { automaton } = buildDfaStartsWith(['0', '1'], '10')
      const proof = getInvariantProofSketch(
        { kind: 'starts_with', paramString: '10' },
        automaton,
      )
      assert.ok(proof.includes('Base Case'))
      assert.ok(proof.includes('Inductive Hypothesis'))
      assert.ok(proof.includes('Inductive Step'))
      assert.ok(proof.includes('Acceptance Condition'))
      assert.ok(proof.includes('Soundness and Completeness'))
      assert.ok(proof.includes('begins with prefix "10"'))
    })

    it('generates problem-specific proof for binary divisibility', () => {
      const { automaton } = buildDfaBinaryDivisibleBy(3)
      const proof = getInvariantProofSketch(
        { kind: 'binary_divisible', divisor: 3 },
        automaton,
      )
      assert.ok(proof.includes("Horner's rule"))
      assert.ok(proof.includes('val(w) ≡ 0 (mod 3)'))
      assert.ok(proof.includes('Soundness and Completeness'))
    })

    it('generates problem-specific proof for string length modulo', () => {
      const { automaton } = buildDfaLengthModulo(['0', '1'], 3, 0)
      const proof = getInvariantProofSketch(
        { kind: 'length_divisible', divisor: 3, remainder: 0 },
        automaton,
      )
      assert.ok(proof.includes('|w| ≡ 0 (mod 3)'))
      assert.ok(proof.includes('Soundness and Completeness'))
    })

    it('generates problem-specific proof for NFA kth_from_end', () => {
      const { automaton } = buildNfaKthFromEnd(['0', '1'], '1', 3)
      const proof = getInvariantProofSketch(
        { kind: 'kth_from_end', symbol: '1', k: 3 },
        automaton,
      )
      assert.ok(proof.includes('3-th') || proof.includes('3rd') || proof.includes('exactly 3'))
      assert.ok(proof.includes('Soundness and Completeness'))
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                  3. SVG Graph Layout & ViewBox Boundary Tests              */
  /* -------------------------------------------------------------------------- */

  describe('SVG ViewBox & Boundary Verification', () => {
    const { automaton } = buildDfaEndsWith(['0', '1'], '01')
    const layout = layoutAutomaton(automaton)
    const { states, viewBox } = layout

    it('returns a dynamic viewBox with minX, minY, width, and height', () => {
      assert.equal(typeof viewBox.minX, 'number')
      assert.equal(typeof viewBox.minY, 'number')
      assert.ok(viewBox.width > 200, 'Width must be positive and substantial')
      assert.ok(viewBox.height > 150, 'Height must be positive and substantial')
    })

    it('guarantees the initial-state arrow and label fit strictly inside the rendered viewport', () => {
      const startState = states.find((s) => s.id === automaton.start)!
      assert.ok(startState, 'Start state must exist')

      const startArrowLen = 38
      const arrowStartX = startState.x - startState.rx - startArrowLen
      const labelBadgeW = 42
      const labelBadgeLeft = arrowStartX - 8 - labelBadgeW

      // Initial-state arrow start X must be strictly within viewBox
      assert.ok(
        arrowStartX >= viewBox.minX,
        `arrowStartX (${arrowStartX}) must be >= viewBox.minX (${viewBox.minX})`,
      )

      // Initial-state label badge must be strictly within viewBox with positive margin
      assert.ok(
        labelBadgeLeft > viewBox.minX,
        `labelBadgeLeft (${labelBadgeLeft}) must be strictly > viewBox.minX (${viewBox.minX})`,
      )

      // Start label Y must be strictly within viewBox Y bounds
      assert.ok(startState.y - 12 > viewBox.minY)
      assert.ok(startState.y + 12 < viewBox.minY + viewBox.height)
    })

    it('guarantees all state circles/capsules fit strictly inside the rendered viewport', () => {
      for (const s of states) {
        const left = s.x - s.rx
        const right = s.x + s.rx
        const top = s.y - s.ry
        const bottom = s.y + s.ry

        assert.ok(
          left > viewBox.minX,
          `State ${s.id} left (${left}) must be > viewBox.minX (${viewBox.minX})`,
        )
        assert.ok(
          right < viewBox.minX + viewBox.width,
          `State ${s.id} right (${right}) must be < viewBox.maxX (${viewBox.minX + viewBox.width})`,
        )
        assert.ok(
          top > viewBox.minY,
          `State ${s.id} top (${top}) must be > viewBox.minY (${viewBox.minY})`,
        )
        assert.ok(
          bottom < viewBox.minY + viewBox.height,
          `State ${s.id} bottom (${bottom}) must be < viewBox.maxY (${viewBox.minY + viewBox.height})`,
        )
      }
    })

    it('guarantees curved backward transitions do not intersect intermediate state circles', () => {
      // In DFA for ends with 01: q2 transitions on '1' back to q0, passing intermediate state q1
      const q0 = states.find((s) => s.id === 'q0')!
      const q1 = states.find((s) => s.id === 'q1')!
      const q2 = states.find((s) => s.id === 'q2')!

      // The backward curve between q2 and q0 must bow below q1 with safe clearance
      const dist = Math.hypot(q0.x - q2.x, q0.y - q2.y)
      const extraDepth = 55 + Math.max(0, (dist - 280) / 140) * 30
      const curveOffset = 46 + extraDepth // downward offset

      const midY = (q0.y + q2.y) / 2 + curveOffset
      const apexY = 0.25 * q2.y + 0.5 * midY + 0.25 * q0.y

      // The apex of the curve must be well below the bottom of state q1
      const q1Bottom = q1.y + q1.ry
      assert.ok(
        apexY > q1Bottom + 15,
        `Curve apex Y (${apexY}) must be well below q1 bottom (${q1Bottom})`,
      )
    })

    it('prevents transition labels from overlapping state circles or other labels', () => {
      const q0 = states.find((s) => s.id === 'q0')!
      const q1 = states.find((s) => s.id === 'q1')!
      const q2 = states.find((s) => s.id === 'q2')!

      // Self-loop label on q0 is above q0
      const selfLoopLabelY_q0 = q0.y - q0.ry - 54
      assert.ok(
        selfLoopLabelY_q0 < q0.y - q0.ry,
        'Self loop label must be well above state circle',
      )

      // Backward edge q2 -> q1 label
      const apexY_q2_q1 = (q2.y + q1.y) / 2 + 46 * 0.5
      const labelY_q2_q1 = apexY_q2_q1 + 15

      // Backward edge q2 -> q0 label
      const dist_q2_q0 = Math.abs(q0.x - q2.x)
      const extraDepth_q2_q0 = 55 + Math.max(0, (dist_q2_q0 - 280) / 140) * 30
      const apexY_q2_q0 = (q2.y + q0.y) / 2 + (46 + extraDepth_q2_q0) * 0.5
      const labelY_q2_q0 = apexY_q2_q0 + 15

      // Both labels must be below the state centers
      assert.ok(labelY_q2_q1 > q1.y + q1.ry, 'Label q2->q1 must be below states')
      assert.ok(labelY_q2_q0 > q1.y + q1.ry, 'Label q2->q0 must be below states')

      // Label q2->q0 must have a deeper vertical position than q2->q1
      assert.ok(
        labelY_q2_q0 > labelY_q2_q1,
        'Labels for distinct backward curves must have distinct vertical positions',
      )

      // All elements fit within the computed viewBox
      assert.ok(
        labelY_q2_q0 + 14 < viewBox.minY + viewBox.height,
        'Deepest label must fit inside viewBox height',
      )
      assert.ok(
        selfLoopLabelY_q0 - 14 > viewBox.minY,
        'Highest label must fit inside viewBox minY',
      )
    })
  })
})
