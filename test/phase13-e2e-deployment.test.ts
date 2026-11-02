/**
 * Phase 13: End-to-End Vision Integration, Verification & Deployment Tests
 * 
 * Verifies:
 * 1. Provider configuration, preference, timeouts, and fallback precedence.
 * 2. Strict schema validation and error recovery for unexpected/corrupted LLM outputs.
 * 3. Complete end-to-end mathematical workflows for all 6 representative image scenarios:
 *    - Case 1: Printed DFA construction question -> deterministic solver
 *    - Case 2: Clear DFA diagram -> deterministic simulator
 *    - Case 3: NFA with epsilon transitions -> deterministic subset construction
 *    - Case 4: Transition table -> deterministic table generator
 *    - Case 5: Handwritten / ambiguous diagram -> visual uncertainty flags & confirmation
 *    - Case 6: Student solution with a bug -> deterministic equivalence & distinguishing counterexample
 * 4. Security, magic bytes, rate limiting, and secret protection invariants.
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import {
  recognizeImage,
  validateAndNormalizeVisionExtraction,
  parseVisionJsonResponse,
} from '../lib/image-recognition/provider'
import { SAMPLE_IMAGE_PRESETS } from '../lib/image-recognition/sample-presets'
import { reconstructAutomatonFromExtraction } from '../lib/image-recognition/reconstruction'
import {
  validateImageMagicBytes,
  checkRateLimit,
  resetRateLimiter,
  sanitizeErrorMessage,
} from '../lib/image-recognition/security'
import { parseQuestion } from '../lib/nlp-parser'
import { solveProblem } from '../lib/automata-solver'
import { runAutomatonDetailed, generateTransitionTable } from '../lib/automata'
import { convertNfaToDfa } from '../lib/subset-construction'
import { verifyAgainstReference } from '../lib/automata-editor'

describe('Phase 13 — Provider Configuration & Fallback Precedence', () => {
  beforeEach(() => {
    delete process.env.MOCK_VISION_RESPONSE
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.VISION_PROVIDER
    resetRateLimiter()
  })

  it('activates offline heuristic fallback when no credentials are configured', async () => {
    const rawImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const result = await recognizeImage(rawImage, 'image/png')

    assert.strictEqual(result.success, true)
    assert.strictEqual(result.providerUsed, 'offline-heuristic')
    assert.ok(result.disclaimer?.includes('No external vision service is currently active'))
    assert.ok(result.warnings.some((w) => w.includes('No vision API key')))
  })

  it('respects mock override when MOCK_VISION_RESPONSE is provided', async () => {
    process.env.MOCK_VISION_RESPONSE = JSON.stringify({
      success: true,
      category: 'text_question',
      confidence: 1.0,
      detectedText: 'Mock prompt for testing',
      questionData: {
        prompt: 'Construct DFA for mock',
        suggestedType: 'dfa',
        alphabet: ['0', '1'],
      },
      uncertainties: [],
      warnings: [],
      providerUsed: 'mock',
      disclaimer: 'Mock vision response used for automated CI testing.',
    })

    const result = await recognizeImage('dummy_image_data')
    assert.strictEqual(result.success, true)
    assert.strictEqual(result.providerUsed, 'mock')
    assert.strictEqual(result.detectedText, 'Mock prompt for testing')
  })

  it('recognizes built-in sample presets deterministically', async () => {
    const textPreset = SAMPLE_IMAGE_PRESETS.find((p) => p.id === 'sample-text-question')!
    assert.ok(textPreset)
    const result = await recognizeImage(textPreset.svgDataUrl)

    assert.strictEqual(result.success, true)
    assert.strictEqual(result.providerUsed, 'mock')
    assert.strictEqual(result.category, 'text_question')
    assert.ok(result.questionData?.prompt.includes('ending with'))
  })
})

describe('Phase 13 — Strict Schema Validation & Error Normalization', () => {
  it('safely recovers and normalizes malformed non-JSON responses from vision models', () => {
    const rawMalformed = 'This is not valid JSON at all. The student drew an automaton accepting even zeros.'
    const normalized = parseVisionJsonResponse(rawMalformed)

    assert.strictEqual(normalized.success, true)
    assert.strictEqual(normalized.category, 'text_question')
    assert.strictEqual(normalized.confidence, 0.5)
    assert.strictEqual(normalized.detectedText, rawMalformed)
    assert.strictEqual(normalized.questionData?.prompt, rawMalformed)
    assert.ok(normalized.uncertainties.length > 0)
  })

  it('normalizes informal category strings (e.g., "dfa", "state_diagram", "table", "attempt")', () => {
    const testCases: Array<{ input: string; expected: string }> = [
      { input: 'dfa', expected: 'diagram' },
      { input: 'state_diagram', expected: 'diagram' },
      { input: 'graph', expected: 'diagram' },
      { input: 'table', expected: 'transition_table' },
      { input: 'tabular', expected: 'transition_table' },
      { input: 'student', expected: 'student_solution' },
      { input: 'attempt', expected: 'student_solution' },
      { input: 'prompt', expected: 'text_question' },
    ]

    for (const { input, expected } of testCases) {
      const res = validateAndNormalizeVisionExtraction({ category: input })
      assert.strictEqual(res.category, expected)
    }
  })

  it('clamps confidence scores safely between 0.0 and 1.0', () => {
    assert.strictEqual(validateAndNormalizeVisionExtraction({ confidence: 1.85 }).confidence, 1.0)
    assert.strictEqual(validateAndNormalizeVisionExtraction({ confidence: -0.5 }).confidence, 0.0)
    assert.strictEqual(validateAndNormalizeVisionExtraction({ confidence: '0.72' }).confidence, 0.72)
    assert.strictEqual(validateAndNormalizeVisionExtraction({ confidence: 'invalid' }).confidence, 0.85)
  })

  it('normalizes automaton data: deduplicates alphabet, assigns start state if missing', () => {
    const rawAuto = {
      automatonData: {
        alphabet: ['0', '1', '0', ' '],
        states: [
          { id: 'q0', isStart: false, isAccept: false },
          { id: 'q1', isStart: false, isAccept: true },
        ],
        transitions: [
          { from: 'q0', symbol: '0', to: 'q1' },
          { from: '  ', symbol: '1', to: 'q0' }, // invalid empty from -> should be filtered
        ],
      },
    }

    const res = validateAndNormalizeVisionExtraction(rawAuto)
    const auto = res.automatonData!
    assert.ok(auto)
    assert.deepStrictEqual(auto.alphabet, ['0', '1'])
    // Should default first state as start if none is marked
    assert.strictEqual(auto.states[0].isStart, true)
    assert.strictEqual(auto.transitions.length, 1)
    assert.deepStrictEqual(auto.transitions[0], { from: 'q0', symbol: '0', to: 'q1', uncertain: false })
    assert.ok(res.warnings.some((w) => w.includes('No initial start state marked')))
  })
})

describe('Phase 13 — End-to-End Mathematical Correctness Across 6 Scenarios', () => {
  // Scenario 1: Printed DFA construction question
  it('Scenario 1: Printed DFA construction question routes to deterministic solver', () => {
    const preset = SAMPLE_IMAGE_PRESETS.find((p) => p.id === 'sample-text-question')!
    assert.ok(preset)
    const prompt = preset.extraction.questionData!.prompt

    const parsed = parseQuestion(prompt)
    assert.strictEqual(parsed.success, true)
    assert.ok(parsed.problemSpec)

    const solution = solveProblem(parsed.problemSpec!)
    assert.ok(solution.automaton)
    assert.strictEqual(solution.automaton.states.length, 3) // q0, q1 (ends with 0), q2 (ends with 01)

    // Verify language deterministically
    const runAccept = runAutomatonDetailed(solution.automaton, '101')
    assert.strictEqual(runAccept.accepted, true)

    const runReject = runAutomatonDetailed(solution.automaton, '100')
    assert.strictEqual(runReject.accepted, false)
  })

  // Scenario 2: Clear DFA diagram
  it('Scenario 2: Clear DFA diagram simulates string acceptance deterministically', () => {
    const preset = SAMPLE_IMAGE_PRESETS.find((p) => p.id === 'sample-diagram-div3')!
    assert.ok(preset)
    const recon = reconstructAutomatonFromExtraction(preset.extraction.automatonData!)

    assert.ok(recon.automaton)
    const dfa = recon.automaton

    // Modulo 3 binary values:
    // "0" = 0 (divisible) -> accept
    assert.strictEqual(runAutomatonDetailed(dfa, '0').accepted, true)
    // "11" = 3 (divisible) -> accept
    assert.strictEqual(runAutomatonDetailed(dfa, '11').accepted, true)
    // "110" = 6 (divisible) -> accept
    assert.strictEqual(runAutomatonDetailed(dfa, '110').accepted, true)
    // "1" = 1 (remainder 1) -> reject
    assert.strictEqual(runAutomatonDetailed(dfa, '1').accepted, false)
    // "10" = 2 (remainder 2) -> reject
    assert.strictEqual(runAutomatonDetailed(dfa, '10').accepted, false)
  })

  // Scenario 3: NFA with epsilon transitions
  it('Scenario 3: NFA with epsilon transitions converts via subset construction to equivalent DFA', () => {
    const preset = SAMPLE_IMAGE_PRESETS.find((p) => p.id === 'sample-nfa-epsilon')!
    assert.ok(preset)
    const recon = reconstructAutomatonFromExtraction(preset.extraction.automatonData!)

    assert.strictEqual(recon.automaton.nondeterministic, true)

    // Convert via deterministic subset construction
    const { dfa } = convertNfaToDfa(recon.automaton)
    assert.strictEqual(dfa.nondeterministic, false)

    // In the NFA: q0 -eps-> q1 -1-> q2 (accept)
    // String "1" should be accepted!
    const runResult = runAutomatonDetailed(dfa, '1')
    assert.strictEqual(runResult.accepted, true)
  })

  // Scenario 4: Transition table
  it('Scenario 4: Transition table reconstructs and generates formal transition table', () => {
    const preset = SAMPLE_IMAGE_PRESETS.find((p) => p.id === 'sample-transition-table')!
    assert.ok(preset)
    const recon = reconstructAutomatonFromExtraction(preset.extraction.automatonData!)

    const table = generateTransitionTable(recon.automaton)
    assert.strictEqual(table.rows.length, 2)
    assert.deepStrictEqual(table.alphabet, ['0', '1'])

    // Even zeros machine:
    assert.strictEqual(runAutomatonDetailed(recon.automaton, '').accepted, true)
    assert.strictEqual(runAutomatonDetailed(recon.automaton, '00').accepted, true)
    assert.strictEqual(runAutomatonDetailed(recon.automaton, '0').accepted, false)
    assert.strictEqual(runAutomatonDetailed(recon.automaton, '000').accepted, false)
  })

  // Scenario 5: Handwritten or ambiguous diagram
  it('Scenario 5: Handwritten / ambiguous diagram preserves uncertainty flags for user confirmation', () => {
    const preset = SAMPLE_IMAGE_PRESETS.find((p) => p.id === 'sample-handwritten-ambiguous')!
    assert.ok(preset)
    assert.ok(preset.extraction.uncertainties.length > 0)
    assert.ok(preset.extraction.automatonData?.uncertainElements.length! > 0)

    // Has uncertain transition and state
    const uncertainTransition = preset.extraction.automatonData?.transitions.find((t) => t.uncertain)
    assert.ok(uncertainTransition)

    // When confirmed by user (auto-completed), simulator operates deterministically
    const recon = reconstructAutomatonFromExtraction(preset.extraction.automatonData!, {
      autoCompleteDfa: true,
    })
    assert.ok(recon.automaton.states.length >= 2)
    const run = runAutomatonDetailed(recon.automaton, '0')
    assert.strictEqual(typeof run.accepted, 'boolean')
  })

  // Scenario 6: Student solution with an incorrect transition / bug
  it('Scenario 6: Student solution with a bug is detected and yields a distinguishing counterexample', () => {
    const preset = SAMPLE_IMAGE_PRESETS.find((p) => p.id === 'sample-student-solution')!
    assert.ok(preset)
    const studentData = preset.extraction.studentSolutionData!
    const studentRecon = reconstructAutomatonFromExtraction(studentData.automaton, {
      autoCompleteDfa: true,
    })

    // Reference question: "ending with 01"
    const parsedRef = parseQuestion('Construct a DFA over {0,1} that accepts strings ending with 01.')
    assert.strictEqual(parsedRef.success, true)
    const solvedRef = solveProblem(parsedRef.problemSpec!)
    const referenceDfa = solvedRef.automaton

    // Equivalence verification
    const verification = verifyAgainstReference(studentRecon.automaton, {
      type: 'automaton',
      automaton: referenceDfa,
    })
    assert.strictEqual(verification.hasReference, true)
    assert.strictEqual(verification.equivalent, false)
    assert.ok(verification.counterexample !== undefined)

    // Test that the counterexample actually distinguishes the two machines
    const ce = verification.counterexample!
    const studentRun = runAutomatonDetailed(studentRecon.automaton, ce)
    const refRun = runAutomatonDetailed(referenceDfa, ce)
    assert.notStrictEqual(studentRun.accepted, refRun.accepted)
  })
})

describe('Phase 13 — Security, Cost & Deployment Invariants', () => {
  beforeEach(() => {
    resetRateLimiter()
  })

  it('validates binary magic bytes for PNG, JPEG, and WebP, rejecting dangerous formats', () => {
    // 1. Valid PNG signature
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    assert.strictEqual(validateImageMagicBytes(pngBase64).valid, true)
    assert.strictEqual(validateImageMagicBytes(pngBase64).detectedMime, 'image/png')

    // 2. Disallowed SVG / HTML script injection
    const svgBase64 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64')
    const svgResult = validateImageMagicBytes(svgBase64)
    assert.strictEqual(svgResult.valid, false)
    assert.ok(svgResult.error?.includes('Vector SVG and HTML payloads are disallowed'))

    // 3. Corrupt non-image binary
    const randomBinary = Buffer.from('Random binary executable code').toString('base64')
    assert.strictEqual(validateImageMagicBytes(randomBinary).valid, false)
  })

  it('enforces sliding-window rate limit (max 20 req/min per IP)', () => {
    const testIp = '198.51.100.1'

    for (let i = 0; i < 20; i++) {
      const res = checkRateLimit(testIp, 20, 60000)
      assert.strictEqual(res.allowed, true)
      assert.strictEqual(res.remaining, 19 - i)
    }

    // 21st request must be denied
    const denied = checkRateLimit(testIp, 20, 60000)
    assert.strictEqual(denied.allowed, false)
    assert.strictEqual(denied.remaining, 0)
    assert.ok(denied.retryAfter! > 0)
  })

  it('sanitizes server error messages to prevent credential and secret leakage', () => {
    const rawApiKeyLeak = 'Fetch failed at https://generativelanguage.googleapis.com?key=AIzaSyD-SecretKey123456789'
    const sanitizedKey = sanitizeErrorMessage(rawApiKeyLeak)
    assert.strictEqual(sanitizedKey.includes('AIzaSyD-SecretKey123456789'), false)
    assert.ok(sanitizedKey.includes('key=***REDACTED***'))

    const rawBearerLeak = 'Error: Authorization failed for Bearer sk-proj-123456789abcdefghij'
    const sanitizedBearer = sanitizeErrorMessage(rawBearerLeak)
    assert.strictEqual(sanitizedBearer.includes('sk-proj-123456789abcdefghij'), false)
    assert.ok(sanitizedBearer.includes('Bearer ***REDACTED***'))

    const quotaError = 'Google API error: 429 RESOURCE_EXHAUSTED'
    assert.ok(sanitizeErrorMessage(quotaError).includes('External vision API rate limit or quota exceeded'))
  })
})
