/**
 * Image-Based Computation Theory Question Solver: Type Definitions
 * Defines structured extraction interfaces, uncertainty flags, and recognition contracts.
 */

export type ImageExtractionCategory =
  | 'text_question'
  | 'transition_table'
  | 'diagram'
  | 'student_solution'

export interface ExtractedQuestionData {
  prompt: string
  suggestedType: 'dfa' | 'nfa' | 'regex' | 'transformation'
  alphabet?: string[]
  multipleQuestionsDetected?: string[]
}

export interface ExtractedState {
  id: string
  isStart: boolean
  isAccept: boolean
  label?: string
  uncertain?: boolean
  uncertaintyReason?: string
}

export interface ExtractedTransition {
  from: string
  symbol: string
  to: string
  uncertain?: boolean
  uncertaintyReason?: string
}

export interface ExtractedAutomatonData {
  isNfa: boolean
  alphabet: string[]
  states: ExtractedState[]
  transitions: ExtractedTransition[]
  uncertainElements: string[]
  rawTableText?: string
}

export interface ExtractedStudentSolutionData {
  automaton: ExtractedAutomatonData
  intendedLanguagePrompt?: string
  isLanguagePromptMissing: boolean
}

export interface ImageRecognitionResult {
  success: boolean
  category: ImageExtractionCategory
  confidence: number // 0.0 to 1.0
  detectedText: string
  questionData?: ExtractedQuestionData
  automatonData?: ExtractedAutomatonData
  studentSolutionData?: ExtractedStudentSolutionData
  uncertainties: string[]
  warnings: string[]
  providerUsed: 'gemini' | 'openai' | 'offline-heuristic' | 'mock'
  error?: string
  disclaimer: string
}

export interface ImageValidationResult {
  valid: boolean
  error?: string
  fileSize?: number
  mimeType?: string
}

export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
] as const

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number]

export function validateImageFile(
  fileSize: number,
  mimeType: string,
): ImageValidationResult {
  if (fileSize > MAX_IMAGE_FILE_SIZE) {
    const sizeMb = (fileSize / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File size exceeds the 5 MB limit (current: ${sizeMb} MB). Please choose a smaller image.`,
      fileSize,
      mimeType,
    }
  }

  const normalizedMime = mimeType.toLowerCase()
  const isSupported = SUPPORTED_IMAGE_MIME_TYPES.some((t) => t === normalizedMime)
  if (!isSupported) {
    return {
      valid: false,
      error: `Unsupported image format (${mimeType}). Supported formats are PNG, JPEG, and WebP.`,
      fileSize,
      mimeType,
    }
  }

  return {
    valid: true,
    fileSize,
    mimeType,
  }
}
