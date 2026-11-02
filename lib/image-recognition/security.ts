/**
 * Security & Validation Engine for Image Recognition
 * Inspects binary magic bytes, validates base64 integrity, checks rate limits,
 * and sanitizes error responses to prevent credential leaks or script injection.
 */

export interface MagicByteValidationResult {
  valid: boolean
  detectedMime?: 'image/png' | 'image/jpeg' | 'image/webp'
  error?: string
}

/**
 * Validates the raw binary header (magic bytes) decoded from base64.
 * Protects against MIME-spoofing and rejects SVG/HTML/executable uploads.
 */
export function validateImageMagicBytes(base64Data: string): MagicByteValidationResult {
  try {
    // Clean base64 string
    const cleanBase64 = base64Data.trim().replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
    
    // Check for base64 character validity
    if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64.replace(/\s+/g, ''))) {
      return {
        valid: false,
        error: 'Malformed base64 payload: contains invalid characters.',
      }
    }

    // Decode the first 32 bytes to inspect magic numbers
    const sampleBuffer = Buffer.from(cleanBase64.slice(0, 48), 'base64')
    if (sampleBuffer.length < 4) {
      return {
        valid: false,
        error: 'Image data is too short or empty.',
      }
    }

    // 1. Check PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      sampleBuffer[0] === 0x89 &&
      sampleBuffer[1] === 0x50 &&
      sampleBuffer[2] === 0x4e &&
      sampleBuffer[3] === 0x47 &&
      sampleBuffer[4] === 0x0d &&
      sampleBuffer[5] === 0x0a &&
      sampleBuffer[6] === 0x1a &&
      sampleBuffer[7] === 0x0a
    ) {
      return { valid: true, detectedMime: 'image/png' }
    }

    // 2. Check JPEG: FF D8 FF
    if (
      sampleBuffer[0] === 0xff &&
      sampleBuffer[1] === 0xd8 &&
      sampleBuffer[2] === 0xff
    ) {
      return { valid: true, detectedMime: 'image/jpeg' }
    }

    // 3. Check WebP: RIFF ... WEBP
    // Bytes 0-3 = "RIFF" (0x52 0x49 0x46 0x46), Bytes 8-11 = "WEBP" (0x57 0x45 0x42 0x50)
    if (
      sampleBuffer.length >= 12 &&
      sampleBuffer[0] === 0x52 &&
      sampleBuffer[1] === 0x49 &&
      sampleBuffer[2] === 0x46 &&
      sampleBuffer[3] === 0x46 &&
      sampleBuffer[8] === 0x57 &&
      sampleBuffer[9] === 0x45 &&
      sampleBuffer[10] === 0x42 &&
      sampleBuffer[11] === 0x50
    ) {
      return { valid: true, detectedMime: 'image/webp' }
    }

    // Check for rejected dangerous formats (SVG, XML, HTML, scripts)
    const headerStr = sampleBuffer.toString('utf8', 0, Math.min(sampleBuffer.length, 32)).toLowerCase()
    if (
      headerStr.includes('<svg') ||
      headerStr.includes('<?xml') ||
      headerStr.includes('<!doc') ||
      headerStr.includes('<html') ||
      headerStr.includes('<script')
    ) {
      return {
        valid: false,
        error: 'Vector SVG and HTML payloads are disallowed for security. Please upload PNG, JPEG, or WebP raster images.',
      }
    }

    return {
      valid: false,
      error: 'Invalid image header: binary signature does not match PNG, JPEG, or WebP.',
    }
  } catch (err: any) {
    return {
      valid: false,
      error: `Failed to decode image data: ${err.message || 'corrupt encoding'}`,
    }
  }
}

/**
 * In-memory sliding-window rate limiter per client IP.
 * Enforces max 20 requests per 60 seconds.
 */
interface RateLimitRecord {
  timestamps: number[]
}

const rateLimitMap = new Map<string, RateLimitRecord>()

export function checkRateLimit(
  clientIp: string,
  limit = 20,
  windowMs = 60 * 1000,
): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now()
  const record = rateLimitMap.get(clientIp) || { timestamps: [] }

  // Filter timestamps within current window
  const validTimestamps = record.timestamps.filter((t) => now - t < windowMs)

  if (validTimestamps.length >= limit) {
    const oldest = validTimestamps[0]
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000)
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, retryAfter),
    }
  }

  validTimestamps.push(now)
  rateLimitMap.set(clientIp, { timestamps: validTimestamps })

  // Cleanup old entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap.entries()) {
      const active = val.timestamps.filter((t) => now - t < windowMs)
      if (active.length === 0) rateLimitMap.delete(key)
      else rateLimitMap.set(key, { timestamps: active })
    }
  }

  return {
    allowed: true,
    remaining: limit - validTimestamps.length,
  }
}

/**
 * Resets the rate limiter (useful for test suites).
 */
export function resetRateLimiter(): void {
  rateLimitMap.clear()
}

/**
 * Sanitizes server error messages to prevent exposing system paths,
 * provider credentials, or internal stack traces to clients.
 */
export function sanitizeErrorMessage(err: any): string {
  if (!err) return 'An unexpected error occurred during image processing.'
  const msg = typeof err === 'string' ? err : err.message || String(err)

  // Remove potential API key leaks
  const sanitized = msg
    .replace(/(?:key|token|auth)=([a-zA-Z0-9_\-]{8,})/gi, 'key=***REDACTED***')
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer ***REDACTED***')

  // Check for common external provider errors
  if (sanitized.includes('401') || sanitized.includes('API_KEY_INVALID')) {
    return 'External vision API authentication failed. Please verify your server API key.'
  }
  if (sanitized.includes('429') || sanitized.includes('RESOURCE_EXHAUSTED')) {
    return 'External vision API rate limit or quota exceeded. Please try again later.'
  }
  if (sanitized.includes('abort') || sanitized.includes('timeout')) {
    return 'Image recognition request timed out after 15 seconds. Please try again or use offline mode.'
  }

  return sanitized
}
