/**
 * Automaton Reconstruction Engine
 * Converts extracted image data (states, alphabet, transitions) into formal Automaton structures
 * with automatic graph coordinate layouts, delta mapping, and structural validation.
 */

import {
  type Automaton,
  type AutoState,
  EPSILON,
  syncEdgesFromDelta,
  validateAutomaton,
  completeDfaWithSink,
} from '@/lib/automata'
import type {
  ExtractedAutomatonData,
  ExtractedState,
  ExtractedTransition,
} from './types'

export interface ReconstructedAutomatonResult {
  automaton: Automaton
  isValid: boolean
  isCompleteDfa: boolean
  warnings: string[]
  errors: string[]
}

/**
 * Calculates responsive, non-overlapping coordinates for states in a reconstructed diagram.
 * Uses a circular or grid layout depending on state count.
 */
export function layoutReconstructedStates(states: ExtractedState[]): AutoState[] {
  const n = states.length
  if (n === 0) return []
  if (n === 1) {
    return [{ id: states[0].id, x: 200, y: 150, accept: states[0].isAccept }]
  }
  if (n === 2) {
    return [
      { id: states[0].id, x: 120, y: 150, accept: states[0].isAccept },
      { id: states[1].id, x: 300, y: 150, accept: states[1].isAccept },
    ]
  }

  // Circular layout for 3 or more states
  const centerX = 260
  const centerY = 180
  const radius = Math.min(180, 70 + n * 20)

  return states.map((s, idx) => {
    // Start state usually placed at the left-most or top-left
    const angle = (2 * Math.PI * idx) / n - Math.PI / 2
    const x = Math.round(centerX + radius * Math.cos(angle))
    const y = Math.round(centerY + radius * Math.sin(angle))
    return {
      id: s.id,
      x,
      y,
      accept: s.isAccept,
    }
  })
}

/**
 * Reconstructs a full formal Automaton from extracted states, alphabet, and transitions.
 */
export function reconstructAutomatonFromExtraction(
  data: ExtractedAutomatonData,
  options?: {
    name?: string
    description?: string
    language?: string
    autoCompleteDfa?: boolean
  },
): ReconstructedAutomatonResult {
  const warnings: string[] = [...(data.uncertainElements || [])]
  const errors: string[] = []

  // Clean alphabet
  const rawAlphabet = (data.alphabet || []).map((s) => s.trim()).filter(Boolean)
  const alphabet = Array.from(new Set(rawAlphabet.filter((s) => s !== EPSILON)))
  if (alphabet.length === 0) {
    warnings.push('Extracted alphabet was empty; defaulting to binary alphabet {0, 1}.')
    alphabet.push('0', '1')
  }

  // Find start state
  const startState = data.states.find((s) => s.isStart)?.id || data.states[0]?.id || 'q0'
  if (!data.states.some((s) => s.isStart)) {
    warnings.push(`No initial start arrow was identified; designated "${startState}" as the start state.`)
  }

  // Layout states
  const states = layoutReconstructedStates(data.states)
  const stateIdSet = new Set(states.map((s) => s.id))

  // Build transition dictionary
  const delta: Record<string, Record<string, string[]>> = {}
  for (const s of states) {
    delta[s.id] = {}
  }

  // Populate transitions
  let hasNondeterminism = data.isNfa
  for (const tr of data.transitions) {
    const from = tr.from.trim()
    const sym = tr.symbol.trim()
    const to = tr.to.trim()

    if (!stateIdSet.has(from)) {
      warnings.push(`Ignored transition from unknown state "${from}".`)
      continue
    }
    if (!stateIdSet.has(to)) {
      warnings.push(`Ignored transition pointing to unknown state "${to}".`)
      continue
    }

    if (sym === EPSILON || sym === 'ε' || sym === 'e') {
      hasNondeterminism = true
    }

    if (!delta[from][sym]) {
      delta[from][sym] = []
    }
    if (!delta[from][sym].includes(to)) {
      delta[from][sym].push(to)
    }

    if (delta[from][sym].length > 1) {
      hasNondeterminism = true
    }

    if (tr.uncertain) {
      warnings.push(`Uncertain transition: ${from} --(${sym})--> ${to} (${tr.uncertaintyReason || 'low visual confidence'})`)
    }
  }

  // Check determinism vs completeness
  let isCompleteDfa = !hasNondeterminism
  if (!hasNondeterminism) {
    for (const s of states) {
      for (const sym of alphabet) {
        if (!delta[s.id][sym] || delta[s.id][sym].length === 0) {
          isCompleteDfa = false
          break
        }
      }
      if (!isCompleteDfa) break
    }
  }

  const edges = syncEdgesFromDelta(states, delta)

  let automaton: Automaton = {
    id: `recon-${Date.now().toString(36)}`,
    name: options?.name || 'Reconstructed Automaton',
    description: options?.description || 'Automaton reconstructed from uploaded image.',
    language: options?.language || 'Unspecified language',
    alphabet,
    start: startState,
    states,
    edges,
    delta,
    nondeterministic: hasNondeterminism,
  }

  // Structural validation
  const validation = validateAutomaton(automaton)
  if (!validation.valid) {
    errors.push(...validation.errors)
  }

  // Complete with sink state if requested
  if (options?.autoCompleteDfa && !hasNondeterminism && !isCompleteDfa) {
    automaton = completeDfaWithSink(automaton, 'q_sink')
    warnings.push('Incomplete DFA transitions were routed to explicit dead sink state "q_sink".')
    isCompleteDfa = true
  }

  return {
    automaton,
    isValid: errors.length === 0,
    isCompleteDfa,
    warnings,
    errors,
  }
}
