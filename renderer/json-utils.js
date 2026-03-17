/**
 * json-utils.js — Robust JSON parsing for AI-generated responses.
 *
 * Ported from OpenMAIC lib/generation/json-repair.ts, adapted to vanilla JS
 * (browser-compatible, no external dependencies).
 *
 * Strategy order:
 *  1. Extract from markdown code blocks (```json ... ```)
 *  2. Find JSON boundaries by scanning for { or [
 *  3. Fix common AI issues: LaTeX backslashes, truncated arrays/objects
 *  4. Remove stray control characters
 */

/**
 * Parse an AI response string that is expected to contain JSON.
 * Tries multiple extraction and repair strategies before giving up.
 *
 * @template T
 * @param {string} response - Raw AI response string
 * @returns {T | null}
 */
export function parseJsonResponse(response) {
  // Strategy 1: Extract JSON from markdown code blocks (may have multiple)
  const codeBlockRe = /```(?:json)?\s*([\s\S]*?)```/g
  let match
  while ((match = codeBlockRe.exec(response)) !== null) {
    const extracted = match[1].trim()
    if (extracted.startsWith('{') || extracted.startsWith('[')) {
      const result = tryParseJson(extracted)
      if (result !== null) return result
    }
  }

  // Strategy 2: Find JSON structure directly in response
  const jsonStartArray  = response.indexOf('[')
  const jsonStartObject = response.indexOf('{')

  if (jsonStartArray !== -1 || jsonStartObject !== -1) {
    let startIndex
    if (jsonStartArray === -1)      startIndex = jsonStartObject
    else if (jsonStartObject === -1) startIndex = jsonStartArray
    else                             startIndex = Math.min(jsonStartArray, jsonStartObject)

    // Find matching close bracket
    let depth = 0
    let endIndex = -1
    let inString = false
    let escapeNext = false

    for (let i = startIndex; i < response.length; i++) {
      const char = response[i]

      if (escapeNext)          { escapeNext = false; continue }
      if (char === '\\' && inString) { escapeNext = true;  continue }
      if (char === '"')        { inString = !inString; continue }

      if (!inString) {
        if (char === '[' || char === '{') depth++
        else if (char === ']' || char === '}') {
          depth--
          if (depth === 0) { endIndex = i; break }
        }
      }
    }

    if (endIndex !== -1) {
      const result = tryParseJson(response.substring(startIndex, endIndex + 1))
      if (result !== null) return result
    }
  }

  // Strategy 3: Try the whole response as-is
  return tryParseJson(response.trim())
}

/**
 * Try to parse a JSON string with multiple repair attempts.
 *
 * @template T
 * @param {string} jsonStr
 * @returns {T | null}
 */
export function tryParseJson(jsonStr) {
  // Attempt 1: Parse as-is
  try { return JSON.parse(jsonStr) } catch (_) { /* continue */ }

  // Attempt 2: Fix common AI issues
  try {
    let fixed = jsonStr

    // Fix LaTeX-style backslash commands inside strings (e.g. \frac, \alpha).
    // Only operate inside quoted strings to avoid double-escaping already-valid sequences.
    fixed = fixed.replace(/"([^"]*?)"/g, (_match, content) => {
      const fixedContent = content.replace(/\\([a-zA-Z])/g, '\\\\$1')
      return `"${fixedContent}"`
    })

    // Fix truncated arrays
    const trimmed = fixed.trim()
    if (trimmed.startsWith('[') && !trimmed.endsWith(']')) {
      const lastObj = fixed.lastIndexOf('}')
      if (lastObj > 0) fixed = fixed.substring(0, lastObj + 1) + ']'
    } else if (trimmed.startsWith('{') && !trimmed.endsWith('}')) {
      const open  = (fixed.match(/{/g) || []).length
      const close = (fixed.match(/}/g) || []).length
      if (open > close) fixed += '}'.repeat(open - close)
    }

    return JSON.parse(fixed)
  } catch (_) { /* continue */ }

  // Attempt 3: Strip control characters
  try {
    const fixed = jsonStr.replace(/[\x00-\x1F\x7F]/g, char => {
      switch (char) {
        case '\n': return '\\n'
        case '\r': return '\\r'
        case '\t': return '\\t'
        default:   return ''
      }
    })
    return JSON.parse(fixed)
  } catch (_) {
    return null
  }
}
