import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'
import {
  validateImageMagicBytes,
  checkRateLimit,
  resetRateLimiter,
  sanitizeErrorMessage,
} from '../lib/image-recognition/security'
import { SAMPLE_IMAGE_PRESETS } from '../lib/image-recognition/sample-presets'
import { reconstructAutomatonFromExtraction } from '../lib/image-recognition/reconstruction'
import { convertNfaToDfa } from '../lib/subset-construction'
import { compareAutomata } from '../lib/equivalence'
import { runAutomatonDetailed } from '../lib/automata'
import { parseQuestion } from '../lib/nlp-parser'

describe('Phase 12: Security, Reliability & Real-Image Robustness', () => {
  beforeEach(() => {
    resetRateLimiter()
  })

  /* -------------------------------------------------------------------------- */
  /*                       1. Binary Magic Bytes Validation                     */
  /* -------------------------------------------------------------------------- */

  describe('Magic Bytes & File Integrity Validation', () => {
    it('validates authentic PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
      // 8-byte PNG signature in base64: iVBORw0KGgo=
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
      const result = validateImageMagicBytes(pngBase64)
      assert.strictEqual(result.valid, true)
      assert.strictEqual(result.detectedMime, 'image/png')
    })

    it('validates authentic JPEG magic bytes (FF D8 FF)', () => {
      // JPEG signature in base64 starts with /9j/
      const jpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
      const result = validateImageMagicBytes(jpegBase64)
      assert.strictEqual(result.valid, true)
      assert.strictEqual(result.detectedMime, 'image/jpeg')
    })

    it('validates authentic WebP magic bytes (RIFF ... WEBP)', () => {
      // WebP signature in base64 starts with UklGR
      const webpBase64 = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='
      const result = validateImageMagicBytes(webpBase64)
      assert.strictEqual(result.valid, true)
      assert.strictEqual(result.detectedMime, 'image/webp')
    })

    it('rejects SVG and HTML vector payloads disguised as image files (XSS mitigation)', () => {
      const svgBase64 = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>').toString('base64')
      const result = validateImageMagicBytes(svgBase64)
      assert.strictEqual(result.valid, false)
      assert.ok(result.error?.includes('Vector SVG and HTML payloads are disallowed'))

      const htmlBase64 = Buffer.from('<!DOCTYPE html><html><body><script>malicious()</script></body></html>').toString('base64')
      const htmlResult = validateImageMagicBytes(htmlBase64)
      assert.strictEqual(htmlResult.valid, false)
      assert.ok(htmlResult.error?.includes('disallowed for security'))
    })

    it('rejects corrupted base64 and random binary payloads', () => {
      const corruptBase64 = 'not-valid-base-64-!!!@@@###$$$'
      const result = validateImageMagicBytes(corruptBase64)
      assert.strictEqual(result.valid, false)

      const randomBytes = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]).toString('base64')
      const randomResult = validateImageMagicBytes(randomBytes)
      assert.strictEqual(randomResult.valid, false)
      assert.ok(randomResult.error?.includes('binary signature does not match'))
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                       2. Server-Side Rate Limiter                          */
  /* -------------------------------------------------------------------------- */

  describe('Server-Side Rate Limiting', () => {
    it('allows up to 20 requests per client IP per minute', () => {
      const ip = '192.168.1.100'
      for (let i = 0; i < 20; i++) {
        const res = checkRateLimit(ip, 20, 60000)
        assert.strictEqual(res.allowed, true)
        assert.strictEqual(res.remaining, 20 - (i + 1))
      }
    })

    it('blocks the 21st request and returns retryAfter seconds', () => {
      const ip = '192.168.1.101'
      for (let i = 0; i < 20; i++) {
        checkRateLimit(ip, 20, 60000)
      }

      const blocked = checkRateLimit(ip, 20, 60000)
      assert.strictEqual(blocked.allowed, false)
      assert.strictEqual(blocked.remaining, 0)
      assert.ok(typeof blocked.retryAfter === 'number')
      assert.ok((blocked.retryAfter || 0) > 0)
    })

    it('tracks rate limits independently for different IP addresses', () => {
      const ipA = '10.0.0.1'
      const ipB = '10.0.0.2'

      for (let i = 0; i < 20; i++) {
        checkRateLimit(ipA, 20, 60000)
      }
      assert.strictEqual(checkRateLimit(ipA, 20, 60000).allowed, false)

      // IP B is still fresh
      const resB = checkRateLimit(ipB, 20, 60000)
      assert.strictEqual(resB.allowed, true)
      assert.strictEqual(resB.remaining, 19)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*                       3. Error Sanitization & Secret Redaction             */
  /* -------------------------------------------------------------------------- */

  describe('Error Sanitization', () => {
    it('redacts sensitive API keys and tokens from error messages', () => {
      const rawError = 'Request failed: key=AIzaSyA1234567890abcdefGHIJKLMN with Bearer sk-ant-api03-abcdef123456'
      const sanitized = sanitizeErrorMessage(rawError)
      assert.ok(!sanitized.includes('AIzaSyA1234567890abcdefGHIJKLMN'))
      assert.ok(!sanitized.includes('sk-ant-api03-abcdef123456'))
      assert.ok(sanitized.includes('***REDACTED***'))
    })

    it('replaces raw 401 and 429 provider errors with user-friendly explanations', () => {
      const authErr = sanitizeErrorMessage(new Error('Google API call failed: 401 API_KEY_INVALID'))
      assert.strictEqual(authErr, 'External vision API authentication failed. Please verify your server API key.')

      const quotaErr = sanitizeErrorMessage(new Error('OpenAI returned 429 RESOURCE_EXHAUSTED'))
      assert.strictEqual(quotaErr, 'External vision API rate limit or quota exceeded. Please try again later.')

      const timeoutErr = sanitizeErrorMessage(new Error('The user aborted a request.'))
      assert.strictEqual(timeoutErr, 'Image recognition request timed out after 15 seconds. Please try again or use offline mode.')
    })
  })

  /* -------------------------------------------------------------------------- */
  /*            4. Real-Image Extraction: Multiple Questions & Epsilon NFAs    */
  /* -------------------------------------------------------------------------- */

  describe('Complex Real-Image Test Cases', () => {
    it('handles multiple questions detected on an exam sheet with user selection', () => {
      const preset = SAMPLE_IMAGE_PRESETS.find((p) => p.id === 'sample-multi-question')
      assert.ok(preset)
      assert.ok(preset.extraction.questionData?.multipleQuestionsDetected)

      const questions = preset.extraction.questionData!.multipleQuestionsDetected!
      assert.strictEqual(questions.length, 2)

      // Both questions can be parsed cleanly by the deterministic parser
      const q1Result = parseQuestion(questions[0])
      assert.strictEqual(q1Result.success, true)
      assert.strictEqual(q1Result.problemSpec?.languagePattern?.kind, 'ends_with')

      const q2Result = parseQuestion(questions[1])
      assert.strictEqual(q2Result.success, true)
      assert.strictEqual(q2Result.problemSpec?.languagePattern?.kind, 'symbol_parity')
    })

    it('reconstructs NFA with epsilon transitions and executes subset construction', () => {
      const preset = SAMPLE_IMAGE_PRESETS.find((p) => p.id === 'sample-nfa-epsilon')
      assert.ok(preset)

      const autoData = preset.extraction.automatonData!
      assert.strictEqual(autoData.isNfa, true)
      assert.ok(autoData.transitions.some((t) => t.symbol === 'ε'))

      const recon = reconstructAutomatonFromExtraction(autoData)
      assert.strictEqual(recon.isValid, true)
      assert.strictEqual(recon.automaton.nondeterministic, true)

      // Convert extracted NFA into equivalent DFA via subset construction
      const { dfa } = convertNfaToDfa(recon.automaton)
      assert.strictEqual(dfa.nondeterministic, false)

      // Test simulation on extracted NFA
      const nfaTrace = runAutomatonDetailed(recon.automaton, '1')
      const dfaTrace = runAutomatonDetailed(dfa, '1')
      // Both should accept '1' because q0 -(ε)-> q1 -(1)-> q2 (accept)
      assert.strictEqual(nfaTrace.accepted, true)
      assert.strictEqual(dfaTrace.accepted, true)
    })
  })

  /* -------------------------------------------------------------------------- */
  /*            5. Deterministic Verification Authority Enforcement            */
  /* -------------------------------------------------------------------------- */

  describe('Deterministic Verification Invariant', () => {
    it('relies strictly on product-machine equivalence rather than recognition metadata', () => {
      // Create two automata that look superficially different but recognize the same language
      const autoA = reconstructAutomatonFromExtraction({
        isNfa: false,
        alphabet: ['0', '1'],
        states: [
          { id: 'qA0', isStart: true, isAccept: true },
          { id: 'qA1', isStart: false, isAccept: false },
        ],
        transitions: [
          { from: 'qA0', symbol: '0', to: 'qA1' },
          { from: 'qA0', symbol: '1', to: 'qA0' },
          { from: 'qA1', symbol: '0', to: 'qA0' },
          { from: 'qA1', symbol: '1', to: 'qA1' },
        ],
        uncertainElements: [],
      }).automaton

      const autoB = reconstructAutomatonFromExtraction({
        isNfa: false,
        alphabet: ['0', '1'],
        states: [
          { id: 'stateX', isStart: true, isAccept: true },
          { id: 'stateY', isStart: false, isAccept: false },
        ],
        transitions: [
          { from: 'stateX', symbol: '0', to: 'stateY' },
          { from: 'stateX', symbol: '1', to: 'stateX' },
          { from: 'stateY', symbol: '0', to: 'stateX' },
          { from: 'stateY', symbol: '1', to: 'stateY' },
        ],
        uncertainElements: [],
      }).automaton

      // Deterministic product construction
      const comp = compareAutomata(autoA, autoB)
      assert.strictEqual(comp.equivalent, true)
      assert.strictEqual(comp.counterexample, undefined)
    })
  })
})
