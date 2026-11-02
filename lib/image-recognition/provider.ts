/**
 * Provider-Independent Image Recognition Engine
 * Server-side orchestrator supporting optional vision APIs (Gemini, OpenAI)
 * with graceful offline heuristic fallbacks, privacy disclosures, and strict JSON extraction.
 */

import type {
  ImageRecognitionResult,
  ImageExtractionCategory,
  ExtractedQuestionData,
  ExtractedAutomatonData,
  ExtractedStudentSolutionData,
} from './types'
import { SAMPLE_IMAGE_PRESETS } from './sample-presets'
import { parseTransitionTableText } from '@/lib/automata-editor'

const VISION_SYSTEM_PROMPT = `
You are an expert Computation Theory and Formal Languages TA.
Your task is to analyze an uploaded image of an automata theory exam problem, transition table, state diagram, or student solution.
You must extract the information into strict JSON conforming to this specification:

{
  "category": "text_question" | "transition_table" | "diagram" | "student_solution",
  "confidence": number between 0.0 and 1.0,
  "detectedText": "Verbatim transcript of visible text in image",
  "questionData": {
    "prompt": "Extracted question prompt (e.g. Construct a DFA accepting strings ending in 01)",
    "suggestedType": "dfa" | "nfa" | "regex" | "transformation",
    "alphabet": ["0", "1"]
  },
  "automatonData": {
    "isNfa": boolean,
    "alphabet": ["0", "1"],
    "states": [
      { "id": "q0", "isStart": true, "isAccept": false, "uncertain": false }
    ],
    "transitions": [
      { "from": "q0", "symbol": "0", "to": "q1", "uncertain": false }
    ],
    "uncertainElements": []
  },
  "studentSolutionData": {
    "automaton": { ...same as automatonData... },
    "intendedLanguagePrompt": "Language the student was trying to build, if written or known",
    "isLanguagePromptMissing": boolean
  },
  "uncertainties": ["List any ambiguous arrows, unreadable state names, or unclear symbols"],
  "warnings": ["List any potential issues"]
}

Guidelines:
1. Do not invent missing transitions. If an arrow is ambiguous or handwriting unclear, mark "uncertain": true and note it in "uncertainties".
2. If the image is a student solution diagram or table, classify it as "student_solution" and extract the candidate machine and any written language prompt.
3. Respond ONLY with valid, raw JSON. Do not wrap in markdown quotes if possible.
`

/**
 * Recognizes and extracts information from an image.
 */
export async function recognizeImage(
  dataUrlOrBase64: string,
  mimeType: string = 'image/png',
  userHint?: string,
  preferredProvider?: 'gemini' | 'openai',
): Promise<ImageRecognitionResult> {
  // 1. Check for mock override (for deterministic integration testing)
  if (process.env.MOCK_VISION_RESPONSE) {
    try {
      const mockResult: ImageRecognitionResult = JSON.parse(process.env.MOCK_VISION_RESPONSE)
      return mockResult
    } catch {
      // Fall through if mock is invalid
    }
  }

  // 2. Check if image matches one of the sample presets
  const matchedPreset = SAMPLE_IMAGE_PRESETS.find(
    (p) => dataUrlOrBase64.includes(p.id) || (p.svgDataUrl && dataUrlOrBase64 === p.svgDataUrl),
  )
  if (matchedPreset) {
    return {
      ...matchedPreset.extraction,
      providerUsed: 'mock',
      disclaimer: `Sample preset recognized: "${matchedPreset.title}". Ready for mathematical verification.`,
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY
  const openAiKey = process.env.OPENAI_API_KEY
  const selected = preferredProvider || (process.env.VISION_PROVIDER as 'gemini' | 'openai' | undefined)
  let apiFailureReason: string | undefined

  if (selected === 'openai') {
    // OpenAI preferred
    if (openAiKey) {
      try {
        return await callOpenAiVision(dataUrlOrBase64, mimeType, openAiKey, userHint)
      } catch (err: any) {
        apiFailureReason = `OpenAI API: ${err.message}`
        console.warn('OpenAI vision API call failed, falling back to secondary provider:', err.message)
      }
    }
    if (geminiKey) {
      try {
        return await callGeminiVision(dataUrlOrBase64, mimeType, geminiKey, userHint)
      } catch (err: any) {
        apiFailureReason = `Gemini API: ${err.message}`
        console.warn('Gemini vision API call failed, falling back to heuristic:', err.message)
      }
    }
  } else {
    // Default precedence: Gemini -> OpenAI
    if (geminiKey) {
      try {
        return await callGeminiVision(dataUrlOrBase64, mimeType, geminiKey, userHint)
      } catch (err: any) {
        apiFailureReason = `Gemini API: ${err.message}`
        console.warn('Gemini vision API call failed, falling back to secondary provider:', err.message)
      }
    }
    if (openAiKey) {
      try {
        return await callOpenAiVision(dataUrlOrBase64, mimeType, openAiKey, userHint)
      } catch (err: any) {
        apiFailureReason = `OpenAI API: ${err.message}`
        console.warn('OpenAI vision API call failed, falling back to heuristic:', err.message)
      }
    }
  }

  // 5. Offline Heuristic Fallback
  return fallbackHeuristicRecognition(dataUrlOrBase64, userHint, apiFailureReason)
}

/**
 * Google Gemini Vision Provider implementation
 */
async function callGeminiVision(
  dataUrl: string,
  mimeType: string,
  apiKey: string,
  userHint?: string,
): Promise<ImageRecognitionResult> {
  const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
  const configuredModel = process.env.GEMINI_MODEL
  const candidateModels = Array.from(
    new Set([configuredModel, 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest'].filter(Boolean) as string[])
  )

  const promptText = userHint
    ? `${VISION_SYSTEM_PROMPT}\n\nStudent Hint/Context: ${userHint}`
    : VISION_SYSTEM_PROMPT

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: 'application/json',
    },
  }

  let lastError: Error | null = null

  for (const model of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        throw new Error(`Model ${model} returned status ${response.status}: ${errorBody.slice(0, 120)}`)
      }

      const data = await response.json()
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!rawText) {
        throw new Error(`Model ${model} returned an empty response.`)
      }

      const parsed = parseVisionJsonResponse(rawText)
      return {
        ...parsed,
        providerUsed: 'gemini',
        disclaimer: `Processed via Google Gemini Vision API (${model}) on server. Please confirm the extracted details before solving.`,
      }
    } catch (err: any) {
      lastError = err
      console.warn(`Gemini vision API call for model ${model} failed:`, err.message)
      // Retry next candidate model on 503 (high demand) or 404 (deprecated/unsupported)
      continue
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw lastError || new Error('All candidate Gemini models failed')
}

/**
 * OpenAI GPT-4o Vision Provider implementation
 */
async function callOpenAiVision(
  dataUrl: string,
  mimeType: string,
  apiKey: string,
  userHint?: string,
): Promise<ImageRecognitionResult> {
  const formattedUrl = dataUrl.startsWith('data:') ? dataUrl : `data:${mimeType};base64,${dataUrl}`
  const url = 'https://api.openai.com/v1/chat/completions'

  const promptText = userHint
    ? `${VISION_SYSTEM_PROMPT}\n\nStudent Hint/Context: ${userHint}`
    : VISION_SYSTEM_PROMPT

  const payload = {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: promptText,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract computation theory problem or automaton from this image.' },
          { type: 'image_url', image_url: { url: formattedUrl } },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`OpenAI API returned status ${response.status}`)
    }

    const data = await response.json()
    const rawText = data?.choices?.[0]?.message?.content
    if (!rawText) {
      throw new Error('OpenAI API returned an empty response.')
    }

    const parsed = parseVisionJsonResponse(rawText)
    return {
      ...parsed,
      providerUsed: 'openai',
      disclaimer: 'Processed via OpenAI GPT-4o Vision API on server. Please confirm the extracted details before solving.',
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Rigorously validates and normalizes raw parsed JSON from vision models.
 * Enforces strict typing, category mapping, value clamping, and topological validity.
 */
export function validateAndNormalizeVisionExtraction(
  json: any,
  rawText: string = '',
): Omit<ImageRecognitionResult, 'providerUsed' | 'disclaimer'> {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return {
      success: true,
      category: 'text_question',
      confidence: 0.5,
      detectedText: typeof rawText === 'string' ? rawText : '',
      questionData: {
        prompt:
          typeof rawText === 'string' && rawText.trim()
            ? rawText.slice(0, 300).trim()
            : 'Construct a DFA accepting the specified language.',
        suggestedType: 'dfa',
        alphabet: ['0', '1'],
      },
      uncertainties: ['Vision response was not a valid JSON object structure; raw text was recovered.'],
      warnings: ['Please review and verify the question statement before solving.'],
    }
  }

  // 1. Normalize Category
  let category: ImageExtractionCategory = 'text_question'
  const rawCat = String(json.category || '').toLowerCase().trim()
  if (['text_question', 'question', 'text', 'prompt'].includes(rawCat)) {
    category = 'text_question'
  } else if (['transition_table', 'table', 'tabular'].includes(rawCat)) {
    category = 'transition_table'
  } else if (['diagram', 'state_diagram', 'graph', 'dfa', 'nfa', 'automaton'].includes(rawCat)) {
    category = 'diagram'
  } else if (['student_solution', 'student', 'solution', 'attempt'].includes(rawCat)) {
    category = 'student_solution'
  } else if (json.studentSolutionData) {
    category = 'student_solution'
  } else if (json.automatonData) {
    category = 'diagram'
  }

  // 2. Normalize Confidence (clamped between 0.0 and 1.0)
  let confidence = 0.85
  if (typeof json.confidence === 'number' && !isNaN(json.confidence)) {
    confidence = Math.max(0.0, Math.min(1.0, json.confidence))
  } else if (typeof json.confidence === 'string') {
    const parsed = parseFloat(json.confidence)
    if (!isNaN(parsed)) confidence = Math.max(0.0, Math.min(1.0, parsed))
  }

  // 3. Normalize detectedText
  const detectedText = typeof json.detectedText === 'string' ? json.detectedText : rawText || ''

  // 4. Normalize uncertainties & warnings
  const uncertainties = Array.isArray(json.uncertainties)
    ? json.uncertainties.map(String).filter(Boolean)
    : []
  const warnings = Array.isArray(json.warnings)
    ? json.warnings.map(String).filter(Boolean)
    : []

  // Helper to validate and normalize AutomatonData
  const normalizeAutomaton = (rawAuto: any): ExtractedAutomatonData | undefined => {
    if (!rawAuto || typeof rawAuto !== 'object') return undefined

    // alphabet: deduplicate and trim
    const alphabet: string[] = Array.isArray(rawAuto.alphabet)
      ? Array.from(new Set<string>(rawAuto.alphabet.map(String).map((s: string) => s.trim()).filter(Boolean)))
      : ['0', '1']
    if (alphabet.length === 0) alphabet.push('0', '1')

    // states
    const states: Array<{ id: string; isStart: boolean; isAccept: boolean; label?: string; uncertain?: boolean }> = []
    if (Array.isArray(rawAuto.states)) {
      for (const s of rawAuto.states) {
        if (!s || typeof s !== 'object') continue
        const id = String(s.id || '').trim()
        if (!id) continue
        states.push({
          id,
          isStart: Boolean(s.isStart),
          isAccept: Boolean(s.isAccept),
          label: typeof s.label === 'string' ? s.label : undefined,
          uncertain: Boolean(s.uncertain),
        })
      }
    }

    // Default first state as start if no start state is explicitly set
    if (states.length > 0 && !states.some((s) => s.isStart)) {
      states[0].isStart = true
      warnings.push(`No initial start state marked; defaulted state "${states[0].id}" as start.`)
    }

    // transitions
    const transitions: Array<{ from: string; symbol: string; to: string; uncertain?: boolean }> = []
    if (Array.isArray(rawAuto.transitions)) {
      for (const t of rawAuto.transitions) {
        if (!t || typeof t !== 'object') continue
        const from = String(t.from || '').trim()
        const to = String(t.to || '').trim()
        const symbol = String(t.symbol !== undefined ? t.symbol : '').trim()
        if (!from || !to) continue
        transitions.push({
          from,
          symbol: symbol || 'ε',
          to,
          uncertain: Boolean(t.uncertain),
        })
      }
    }

    const isNfa =
      typeof rawAuto.isNfa === 'boolean'
        ? rawAuto.isNfa
        : transitions.some((t) => t.symbol === 'ε' || t.symbol === 'eps' || t.symbol === '')

    const uncertainElements = Array.isArray(rawAuto.uncertainElements)
      ? rawAuto.uncertainElements.map(String).filter(Boolean)
      : []

    return {
      isNfa,
      alphabet,
      states,
      transitions,
      uncertainElements,
      rawTableText: typeof rawAuto.rawTableText === 'string' ? rawAuto.rawTableText : undefined,
    }
  }

  // 5. Normalize QuestionData
  let questionData: ExtractedQuestionData | undefined
  if (json.questionData && typeof json.questionData === 'object') {
    const rawQ = json.questionData
    const prompt = typeof rawQ.prompt === 'string' ? rawQ.prompt.trim() : detectedText.slice(0, 300).trim()
    let suggestedType: 'dfa' | 'nfa' | 'regex' | 'transformation' = 'dfa'
    const st = String(rawQ.suggestedType || '').toLowerCase()
    if (st === 'nfa') suggestedType = 'nfa'
    else if (st === 'regex') suggestedType = 'regex'
    else if (st === 'transformation') suggestedType = 'transformation'

    const alphabet: string[] = Array.isArray(rawQ.alphabet)
      ? Array.from(new Set<string>(rawQ.alphabet.map(String).map((s: string) => s.trim()).filter(Boolean)))
      : ['0', '1']

    const multipleQuestionsDetected = Array.isArray(rawQ.multipleQuestionsDetected)
      ? rawQ.multipleQuestionsDetected.map(String).filter(Boolean)
      : undefined

    questionData = {
      prompt: prompt || 'Construct a DFA accepting the specified language.',
      suggestedType,
      alphabet: alphabet.length > 0 ? alphabet : ['0', '1'],
      multipleQuestionsDetected,
    }
  } else if (category === 'text_question') {
    questionData = {
      prompt: detectedText.slice(0, 300).trim() || 'Construct a DFA accepting the specified language.',
      suggestedType: 'dfa',
      alphabet: ['0', '1'],
    }
  }

  // 6. Normalize AutomatonData
  let automatonData: ExtractedAutomatonData | undefined = normalizeAutomaton(json.automatonData)

  // 7. Normalize StudentSolutionData
  let studentSolutionData: ExtractedStudentSolutionData | undefined
  if (json.studentSolutionData && typeof json.studentSolutionData === 'object') {
    const rawSS = json.studentSolutionData
    const auto =
      normalizeAutomaton(rawSS.automaton) ||
      automatonData || {
        isNfa: false,
        alphabet: ['0', '1'],
        states: [],
        transitions: [],
        uncertainElements: [],
      }
    const intendedLanguagePrompt =
      typeof rawSS.intendedLanguagePrompt === 'string'
        ? rawSS.intendedLanguagePrompt.trim()
        : questionData?.prompt || ''
    const isLanguagePromptMissing =
      typeof rawSS.isLanguagePromptMissing === 'boolean'
        ? rawSS.isLanguagePromptMissing
        : !intendedLanguagePrompt

    studentSolutionData = {
      automaton: auto,
      intendedLanguagePrompt,
      isLanguagePromptMissing,
    }
  }

  return {
    success: true,
    category,
    confidence,
    detectedText,
    questionData,
    automatonData,
    studentSolutionData,
    uncertainties,
    warnings,
  }
}

/**
 * Parses raw JSON string from LLM response safely with error recovery
 */
export function parseVisionJsonResponse(rawText: string): Omit<ImageRecognitionResult, 'providerUsed' | 'disclaimer'> {
  let clean = rawText.trim()
  if (clean.startsWith('```json')) clean = clean.replace(/^```json/, '').replace(/```$/, '')
  else if (clean.startsWith('```')) clean = clean.replace(/^```/, '').replace(/```$/, '')
  clean = clean.trim()

  let json: any = {}
  try {
    json = JSON.parse(clean)
  } catch {
    // Graceful fallback if vision model returned non-JSON text or malformed JSON
    return validateAndNormalizeVisionExtraction(null, rawText)
  }

  return validateAndNormalizeVisionExtraction(json, rawText)
}

/**
 * Offline Heuristic Fallback
 * Provides transparent, honest feedback when no external vision key is configured,
 * initializing an interactive editable confirmation workspace.
 */
function fallbackHeuristicRecognition(
  dataUrlOrBase64: string,
  userHint?: string,
  apiFailureReason?: string,
): ImageRecognitionResult {
  // If user provided a hint that looks like a transition table, parse it locally
  if (userHint && (userHint.includes('->') || userHint.includes('|') || userHint.includes(','))) {
    const tableResult = parseTransitionTableText(userHint)
    if (tableResult.success && tableResult.automaton) {
      const auto = tableResult.automaton
      return {
        success: true,
        category: 'transition_table',
        confidence: 0.9,
        detectedText: userHint,
        automatonData: {
          isNfa: Boolean(auto.nondeterministic),
          alphabet: auto.alphabet,
          states: auto.states.map((s) => ({
            id: s.id,
            isStart: s.id === auto.start,
            isAccept: Boolean(s.accept),
          })),
          transitions: Object.entries(auto.delta).flatMap(([from, syms]) =>
            Object.entries(syms).flatMap(([sym, tos]) =>
              tos.map((to) => ({ from, symbol: sym, to })),
            ),
          ),
          uncertainElements: [],
          rawTableText: userHint,
        },
        uncertainties: apiFailureReason ? [`Vision API note: ${apiFailureReason}`] : [],
        warnings: [
          'Parsed locally from text hint using deterministic transition table parser.',
          ...(apiFailureReason ? [`External vision API was unreachable: ${apiFailureReason}`] : []),
        ],
        providerUsed: 'offline-heuristic',
        disclaimer:
          'Local offline parser active. ' +
          (apiFailureReason ? `External vision API encountered an error (${apiFailureReason}). ` : 'No external vision API key configured. ') +
          'Extracted using local table parser. Review and edit before solving.',
      }
    }
  }

  const uncertainties = apiFailureReason
    ? [`Vision API request could not be completed (${apiFailureReason}). Switched to local offline mode.`]
    : ['Image uploaded in offline mode without server vision API key.']

  const warnings = apiFailureReason
    ? [
        `Server vision call failed: ${apiFailureReason}`,
        'An editable template has been initialized so you can confirm or adjust the problem statement directly.',
      ]
    : [
        'No vision API key (GEMINI_API_KEY or OPENAI_API_KEY) is configured on the server.',
        'An editable template has been initialized. You can confirm or adjust the question and automaton details directly.',
      ]

  const disclaimer = apiFailureReason
    ? `Notice: Vision service encountered an error (${apiFailureReason}). An interactive workspace has been prepared for manual confirmation.`
    : 'Notice: No external vision service is currently active. The application has prepared an editable confirmation screen ' +
      'allowing you to transcribe or fine-tune your problem statement before invoking the mathematical engine.'

  // Default fallback: initialize an editable confirmation screen
  return {
    success: true,
    category: 'text_question',
    confidence: 0.8,
    detectedText: userHint || 'Construct a DFA over {0, 1} that accepts strings ending with 01.',
    questionData: {
      prompt: userHint || 'Construct a DFA over {0, 1} that accepts strings ending with 01.',
      suggestedType: 'dfa',
      alphabet: ['0', '1'],
    },
    uncertainties,
    warnings,
    providerUsed: 'offline-heuristic',
    disclaimer,
  }
}
