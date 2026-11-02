import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  validateImageFile,
  MAX_IMAGE_FILE_SIZE,
  type ExtractedAutomatonData,
  type ImageRecognitionResult,
} from '../lib/image-recognition/types'
import {
  reconstructAutomatonFromExtraction,
  layoutReconstructedStates,
} from '../lib/image-recognition/reconstruction'
import { recognizeImage } from '../lib/image-recognition/provider'
import { SAMPLE_IMAGE_PRESETS } from '../lib/image-recognition/sample-presets'
import { verifyAgainstReference } from '../lib/automata-editor'
import { runAutomatonDetailed } from '../lib/automata'
import { solveProblem } from '../lib/automata-solver'
import { parseQuestion } from '../lib/nlp-parser'

describe('Phase 11: Image-Based Computation Theory Question Solver', () => {
  /* -------------------------------------------------------------------------- */
  /*                       1. File Validation & Security                        */
  /* -------------------------------------------------------------------------- */

  describe('File Validation', () => {
    it('accepts valid image formats: PNG, JPEG, WebP within 5MB limit', () => {
      assert.strictEqual(validateImageFile(1024 * 1024, 'image/png').valid, true)
      assert.strictEqual(validateImageFile(2 * 1024 * 1024, 'image/jpeg').valid, true)
      assert.strictEqual(validateImageFile(500 * 1024, 'image/webp').valid, true)
    })

    it('rejects unsupported file formats: PDF, GIF, SVG, text', () => {
      const pdfRes = validateImageFile(1024, 'application/pdf')
      assert.strictEqual(pdfRes.valid, false)
      assert.ok(pdfRes.error?.includes('Unsupported image format'))

      const gifRes = validateImageFile(1024, 'image/gif')
      assert.strictEqual(gifRes.valid, false)

      const svgRes = validateImageFile(1024, 'image/svg+xml')
      assert.strictEqual(svgRes.valid, false)
    })

    it('rejects files exceeding the 5 MB limit', () => {
      const oversized = MAX_IMAGE_FILE_SIZE + 1024
      const res = validateImageFile(oversized, 'image/png')
      assert.strictEqual(res.valid, false)
      assert.ok(res.error?.includes('exceeds the 5 MB limit'))
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                  2. Reconstructed Automaton Model & Layout                 */
  /* -------------------------------------------------------------------------- */

  describe('Reconstruction from Extracted Image Data', () => {
    it('reconstructs complete DFA from extracted tabular / diagram data', () => {
      const extracted: ExtractedAutomatonData = {
        isNfa: false,
        alphabet: ['0', '1'],
        states: [
          { id: 'q0', isStart: true, isAccept: true },
          { id: 'q1', isStart: false, isAccept: false },
        ],
        transitions: [
          { from: 'q0', symbol: '0', to: 'q1' },
          { from: 'q0', symbol: '1', to: 'q0' },
          { from: 'q1', symbol: '0', to: 'q0' },
          { from: 'q1', symbol: '1', to: 'q1' },
        ],
        uncertainElements: [],
      }

      const result = reconstructAutomatonFromExtraction(extracted, {
        name: 'Even Zeros DFA',
        language: 'Even number of zeros',
      })

      assert.strictEqual(result.isValid, true)
      assert.strictEqual(result.isCompleteDfa, true)
      assert.strictEqual(result.automaton.states.length, 2)
      assert.strictEqual(result.automaton.start, 'q0')
      assert.strictEqual(result.automaton.states.find((s) => s.id === 'q0')?.accept, true)

      // Test simulation on reconstructed automaton
      assert.strictEqual(runAutomatonDetailed(result.automaton, '').accepted, true)
      assert.strictEqual(runAutomatonDetailed(result.automaton, '00').accepted, true)
      assert.strictEqual(runAutomatonDetailed(result.automaton, '0').accepted, false)
      assert.strictEqual(runAutomatonDetailed(result.automaton, '010').accepted, true)
    })

    it('flags incomplete DFA and completes missing transitions with sink state', () => {
      // Incomplete DFA missing transition on '1' from q1
      const extracted: ExtractedAutomatonData = {
        isNfa: false,
        alphabet: ['0', '1'],
        states: [
          { id: 'q0', isStart: true, isAccept: false },
          { id: 'q1', isStart: false, isAccept: true },
        ],
        transitions: [
          { from: 'q0', symbol: '0', to: 'q1' },
          { from: 'q0', symbol: '1', to: 'q0' },
          { from: 'q1', symbol: '0', to: 'q1' },
          // missing: q1 on '1'
        ],
        uncertainElements: [],
      }

      // Without auto-complete
      const incomplete = reconstructAutomatonFromExtraction(extracted, { autoCompleteDfa: false })
      assert.strictEqual(incomplete.isCompleteDfa, false)

      // With auto-complete
      const completed = reconstructAutomatonFromExtraction(extracted, { autoCompleteDfa: true })
      assert.strictEqual(completed.isCompleteDfa, true)
      assert.ok(completed.automaton.states.some((s) => s.id === 'q_sink'))
      assert.deepStrictEqual(completed.automaton.delta['q1']['1'], ['q_sink'])
    })

    it('flags uncertain elements without discarding valid transitions', () => {
      const extracted: ExtractedAutomatonData = {
        isNfa: false,
        alphabet: ['0', '1'],
        states: [
          { id: 'q0', isStart: true, isAccept: false },
          { id: 'q1', isStart: false, isAccept: true },
        ],
        transitions: [
          { from: 'q0', symbol: '0', to: 'q1', uncertain: true, uncertaintyReason: 'faint handwriting' },
          { from: 'q0', symbol: '1', to: 'q0' },
          { from: 'q1', symbol: '0', to: 'q0' },
          { from: 'q1', symbol: '1', to: 'q1' },
        ],
        uncertainElements: ['Faint arrow from q0 to q1 on symbol 0'],
      }

      const res = reconstructAutomatonFromExtraction(extracted)
      assert.strictEqual(res.isValid, true)
      assert.ok(res.warnings.some((w) => w.includes('faint handwriting') || w.includes('Uncertain transition')))
      // The transition is preserved for user confirmation
      assert.deepStrictEqual(res.automaton.delta['q0']['0'], ['q1'])
    })

    it('generates non-overlapping coordinate layouts for arbitrary state counts', () => {
      const states = [
        { id: 'q0', isStart: true, isAccept: false },
        { id: 'q1', isStart: false, isAccept: false },
        { id: 'q2', isStart: false, isAccept: true },
        { id: 'q3', isStart: false, isAccept: false },
      ]
      const layout = layoutReconstructedStates(states)
      assert.strictEqual(layout.length, 4)

      // Ensure no two states have identical coordinates
      const coords = new Set(layout.map((s) => `${s.x},${s.y}`))
      assert.strictEqual(coords.size, 4)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                  3. Question Extraction & Solver Integration               */
  /* -------------------------------------------------------------------------- */

  describe('Extracted Question to Deterministic Engine Pipeline', () => {
    it('executes sample text question preset through existing solver', () => {
      const preset = SAMPLE_IMAGE_PRESETS.find((p) => p.id === 'sample-text-question')
      assert.ok(preset)

      const prompt = preset.extraction.questionData?.prompt || ''
      assert.ok(prompt.includes('ending with 01'))

      const parsed = parseQuestion(prompt)
      assert.strictEqual(parsed.success, true)
      assert.strictEqual(parsed.problemSpec?.languagePattern?.kind, 'ends_with')

      const solution = solveProblem(parsed.problemSpec!)
      assert.ok(solution.formalLanguageDefinition.includes('L ='))
      assert.strictEqual(solution.complexityNotes.isMinimal, true)

      // Verify simulator accuracy on test strings
      assert.strictEqual(runAutomatonDetailed(solution.automaton, '01').accepted, true)
      assert.strictEqual(runAutomatonDetailed(solution.automaton, '1001').accepted, true)
      assert.strictEqual(runAutomatonDetailed(solution.automaton, '10').accepted, false)
      assert.strictEqual(runAutomatonDetailed(solution.automaton, '0').accepted, false)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*               4. Student Attempt Verification & Counterexamples            */
  /* -------------------------------------------------------------------------- */

  describe('Student Solution Attempt Verification via Image Extraction', () => {
    it('detects student error and provides shortest distinguishing counterexample', () => {
      // Load preset 4: student attempted "Ends with 01" but marked q1 accepting instead of q2
      const preset = SAMPLE_IMAGE_PRESETS.find((p) => p.id === 'sample-student-solution')
      assert.ok(preset)
      const solData = preset.extraction.studentSolutionData!
      assert.strictEqual(solData.isLanguagePromptMissing, false)

      const studentAuto = reconstructAutomatonFromExtraction(solData.automaton).automaton
      const intendedLang = solData.intendedLanguagePrompt!

      // Formal equivalence check against reference
      const verification = verifyAgainstReference(studentAuto, {
        type: 'nl_query',
        query: intendedLang,
      })

      // Must be non-equivalent
      assert.strictEqual(verification.equivalent, false)
      assert.ok(verification.counterexample !== undefined)

      // Shortest counterexample must produce opposite verdicts
      const ce = verification.counterexample!
      const studentVerdict = runAutomatonDetailed(studentAuto, ce).accepted
      const refVerdict = runAutomatonDetailed(verification.referenceAutomaton!, ce).accepted
      assert.notStrictEqual(studentVerdict, refVerdict)
    })

    it('recognizes equivalent student machine even with different state nomenclature', () => {
      // Student DFA for "even number of zeros" with state names {sA, sB}
      const extracted: ExtractedAutomatonData = {
        isNfa: false,
        alphabet: ['0', '1'],
        states: [
          { id: 'sA', isStart: true, isAccept: true },
          { id: 'sB', isStart: false, isAccept: false },
        ],
        transitions: [
          { from: 'sA', symbol: '0', to: 'sB' },
          { from: 'sA', symbol: '1', to: 'sA' },
          { from: 'sB', symbol: '0', to: 'sA' },
          { from: 'sB', symbol: '1', to: 'sB' },
        ],
        uncertainElements: [],
      }

      const studentAuto = reconstructAutomatonFromExtraction(extracted).automaton
      const verification = verifyAgainstReference(studentAuto, {
        type: 'nl_query',
        query: 'Construct a DFA that accepts strings containing an even number of zeros.',
      })

      assert.strictEqual(verification.equivalent, true)
      assert.ok(verification.explanation.includes('mathematically equivalent'))
    })
  })

  /* -------------------------------------------------------------------------- */
  /*            5. Recognition Provider Fallbacks & Missing Config              */
  /* -------------------------------------------------------------------------- */

  describe('Recognition Provider Routing and Graceful Degradation', () => {
    it('gracefully returns offline heuristic with honest disclaimer when no API key is set', async () => {
      // In normal test runs without GEMINI_API_KEY or OPENAI_API_KEY
      const fakeDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
      const res = await recognizeImage(fakeDataUrl, 'image/png')

      assert.strictEqual(res.success, true)
      assert.strictEqual(res.providerUsed, 'offline-heuristic')
      assert.ok(res.disclaimer.includes('No external vision service'))
      assert.ok(res.warnings.some((w) => w.includes('No vision API key')))
    })

    it('supports mock vision responses for reproducible CI/CD testing', async () => {
      const mockPayload: ImageRecognitionResult = {
        success: true,
        category: 'text_question',
        confidence: 0.99,
        detectedText: 'Mock prompt for testing',
        questionData: {
          prompt: 'Construct a DFA accepting strings with odd number of ones',
          suggestedType: 'dfa',
          alphabet: ['0', '1'],
        },
        uncertainties: [],
        warnings: [],
        providerUsed: 'mock',
        disclaimer: 'Mock unit test provider',
      }

      process.env.MOCK_VISION_RESPONSE = JSON.stringify(mockPayload)
      try {
        const res = await recognizeImage('test-image')
        assert.strictEqual(res.confidence, 0.99)
        assert.strictEqual(res.questionData?.prompt, 'Construct a DFA accepting strings with odd number of ones')
      } finally {
        delete process.env.MOCK_VISION_RESPONSE
      }
    })
  })
})
