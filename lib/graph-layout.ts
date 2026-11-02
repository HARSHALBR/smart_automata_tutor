import type { Automaton, AutoState } from './automata'

export interface LayoutOptions {
  width?: number
  height?: number
  padding?: number
  nodeRadius?: number
}

export interface PositionedState extends AutoState {
  rx: number
  ry: number
}

export interface DynamicViewBox {
  minX: number
  minY: number
  width: number
  height: number
}

/**
 * Calculates Euclidean distance from a point (px, py) to a line segment (x1, y1) -> (x2, y2).
 */
export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/**
 * Computes the exact bounding box across all graph elements:
 * - State capsules (with halos)
 * - Initial state arrow and "start" label
 * - Self loops and transition arcs
 * - Transition labels (with badges)
 * Includes generous padding/margin to prevent any clipping.
 */
export function computeAutomatonBounds(
  automaton: Automaton,
  positionedStates: PositionedState[],
  options: LayoutOptions = {},
): DynamicViewBox {
  const margin = options.padding ? Math.max(32, options.padding * 0.6) : 38
  const posMap = new Map<string, PositionedState>()
  for (const s of positionedStates) {
    posMap.set(s.id, s)
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  function include(x: number, y: number) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  // 1. All state circles/capsules (plus halos & double circles)
  for (const s of positionedStates) {
    include(s.x - s.rx - 12, s.y - s.ry - 12)
    include(s.x + s.rx + 12, s.y + s.ry + 12)
  }

  // 2. Initial state pointer arrow and "start" label badge
  const startState = posMap.get(automaton.start)
  if (startState) {
    const arrowLen = 38
    const arrowStart = startState.x - startState.rx - arrowLen
    include(arrowStart, startState.y)
    // Label "start" is rendered with badge extending to arrowStart - 48
    const badgeLeft = arrowStart - 50
    include(badgeLeft, startState.y - 14)
    include(badgeLeft, startState.y + 14)
  }

  // 3. Edges, self-loops, curved arrows, and labels
  for (const edge of automaton.edges) {
    const a = posMap.get(edge.from)
    const b = posMap.get(edge.to)
    if (!a || !b) continue

    if (edge.from === edge.to) {
      // Self-loop above state
      const cx = a.x
      const cy = a.y - a.ry
      include(cx - 42, cy - 54)
      include(cx + 42, cy - 54)
      // Label text and badge above loop
      include(cx - 30, cy - 72)
      include(cx + 30, cy - 72)
    } else {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy) || 1
      const ux = dx / dist
      const uy = dy / dist
      const nx = -uy
      const ny = ux

      const isBackward = dx < -10
      const skipsIntermediate = positionedStates.some(
        (s) =>
          s.id !== edge.from &&
          s.id !== edge.to &&
          distanceToSegment(s.x, s.y, a.x, a.y, b.x, b.y) < s.rx + 24,
      )
      const hasReverse = automaton.edges.some(
        (e) => e.from === edge.to && e.to === edge.from,
      )

      let curveOffset = 0
      if (isBackward) {
        // Curve downward below the states
        const curveDir = ny < 0 ? -1 : 1
        const extraDepth = skipsIntermediate ? 55 + Math.max(0, (dist - 280) / 140) * 30 : 0
        curveOffset = (46 + extraDepth) * curveDir
      } else if (dx > 10 && skipsIntermediate) {
        // Curve upward above intermediate states
        const curveDir = ny > 0 ? -1 : 1
        const extraDepth = 55 + Math.max(0, (dist - 280) / 140) * 30
        curveOffset = (46 + extraDepth) * curveDir
      } else if (hasReverse) {
        curveOffset = dx >= 0 ? -28 : 32
      }

      const startX = a.x + ux * a.rx
      const startY = a.y + uy * a.ry
      const endX = b.x - ux * (b.rx + 4)
      const endY = b.y - uy * (b.ry + 4)

      include(startX, startY)
      include(endX, endY)

      if (curveOffset !== 0) {
        const midX = (startX + endX) / 2 + nx * curveOffset
        const midY = (startY + endY) / 2 + ny * curveOffset
        include(midX, midY)

        const apexX = 0.25 * startX + 0.5 * midX + 0.25 * endX
        const apexY = 0.25 * startY + 0.5 * midY + 0.25 * endY
        const dirX = nx * (curveOffset >= 0 ? 1 : -1)
        const dirY = ny * (curveOffset >= 0 ? 1 : -1)
        const labelX = apexX + dirX * 16
        const labelY = apexY + dirY * 16

        include(labelX - 32, labelY - 16)
        include(labelX + 32, labelY + 16)
      } else {
        const labelX = (startX + endX) / 2 + nx * -12
        const labelY = (startY + endY) / 2 + ny * -12
        include(labelX - 32, labelY - 16)
        include(labelX + 32, labelY + 16)
      }
    }
  }

  if (!isFinite(minX)) {
    return {
      minX: 0,
      minY: 0,
      width: options.width ?? 660,
      height: options.height ?? 380,
    }
  }

  const vbMinX = Math.floor(minX - margin)
  const vbMinY = Math.floor(minY - margin)
  const vbMaxX = Math.ceil(maxX + margin)
  const vbMaxY = Math.ceil(maxY + margin)

  const calcW = vbMaxX - vbMinX
  const calcH = vbMaxY - vbMinY

  return {
    minX: vbMinX,
    minY: vbMinY,
    width: Math.max(options.width ?? 640, calcW),
    height: Math.max(options.height ?? 360, calcH),
  }
}

/**
 * Computes an intelligent layered or circular layout for an automaton,
 * ensuring non-overlapping states and dynamic sizing for long labels (e.g. subset states).
 */
export function layoutAutomaton(
  automaton: Automaton,
  options: LayoutOptions = {},
): {
  states: PositionedState[]
  viewBox: DynamicViewBox
} {
  const n = automaton.states.length
  const baseRadius = options.nodeRadius ?? 28
  const padding = options.padding ?? 60

  // 1. Calculate dynamic radius/capsule width for each state based on label length
  const stateDims = new Map<string, { rx: number; ry: number }>()
  for (const s of automaton.states) {
    const labelLen = s.id.length
    // Approximate font character width: ~8.5px
    const textWidth = labelLen * 9.5
    const rx = Math.max(baseRadius, textWidth / 2 + 12)
    const ry = baseRadius
    stateDims.set(s.id, { rx, ry })
  }

  // If states already have sensible non-zero coordinates, preserve relative positioning while applying dimensions
  const hasValidPositions =
    n > 0 &&
    automaton.states.every(
      (s) => typeof s.x === 'number' && typeof s.y === 'number' && (s.x !== 0 || s.y !== 0),
    )

  if (hasValidPositions) {
    const minX = Math.min(...automaton.states.map((s) => s.x))
    const minY = Math.min(...automaton.states.map((s) => s.y))

    // Ensure start node has sufficient clearance on the left for its incoming pointer arrow & label
    const startStateObj = automaton.states.find((s) => s.id === automaton.start)
    const isStartLeftmost = startStateObj && startStateObj.x === minX
    const leftClearance = isStartLeftmost ? Math.max(120, padding * 2) : padding * 1.5

    const offsetX = leftClearance - minX
    const offsetY = padding * 1.2 - minY

    const positionedStates: PositionedState[] = automaton.states.map((s) => {
      const dim = stateDims.get(s.id)!
      return {
        ...s,
        x: s.x + offsetX,
        y: s.y + offsetY,
        rx: dim.rx,
        ry: dim.ry,
      }
    })

    const viewBox = computeAutomatonBounds(automaton, positionedStates, options)

    return {
      states: positionedStates,
      viewBox,
    }
  }

  // 2. Perform Rank-Based Layered BFS Layout
  // Start from start state, assign levels based on shortest distance from start
  const levels = new Map<string, number>()
  const queue: string[] = []
  if (automaton.start && automaton.states.some((s) => s.id === automaton.start)) {
    queue.push(automaton.start)
    levels.set(automaton.start, 0)
  }

  let head = 0
  while (head < queue.length) {
    const curr = queue[head++]
    const currLevel = levels.get(curr)!
    const targets = new Set<string>()

    for (const dests of Object.values(automaton.delta[curr] ?? {})) {
      for (const d of dests) targets.add(d)
    }

    for (const t of targets) {
      if (!levels.has(t)) {
        levels.set(t, currLevel + 1)
        queue.push(t)
      }
    }
  }

  // Any unreached states go to last level
  const maxReachedLevel = Math.max(0, ...Array.from(levels.values()))
  for (const s of automaton.states) {
    if (!levels.has(s.id)) {
      levels.set(s.id, maxReachedLevel + 1)
    }
  }

  // Group states by level
  const levelGroups = new Map<number, string[]>()
  for (const s of automaton.states) {
    const lvl = levels.get(s.id)!
    const group = levelGroups.get(lvl) ?? []
    group.push(s.id)
    levelGroups.set(lvl, group)
  }

  const numLevels = Math.max(1, Math.max(...Array.from(levelGroups.keys())) + 1)
  const maxStatesInLevel = Math.max(1, ...Array.from(levelGroups.values()).map((g) => g.length))

  // Determine canvas width and height
  const colSpacing = Math.max(170, Math.min(230, 720 / numLevels))
  const rowSpacing = Math.max(130, Math.min(170, 480 / maxStatesInLevel))

  const totalHeight = Math.max(380, maxStatesInLevel * rowSpacing + padding * 2)

  const positionedStates: PositionedState[] = []

  // Ensure start node has enough clearance on the left
  const startXOffset = Math.max(120, padding + 70)

  for (const [lvl, stateIds] of levelGroups.entries()) {
    const x = startXOffset + lvl * colSpacing
    const groupHeight = stateIds.length * rowSpacing
    const startY = (totalHeight - groupHeight) / 2 + rowSpacing / 2

    stateIds.forEach((id, idx) => {
      const y = startY + idx * rowSpacing
      const dim = stateDims.get(id)!
      const orig = automaton.states.find((s) => s.id === id)!
      positionedStates.push({
        ...orig,
        x,
        y,
        rx: dim.rx,
        ry: dim.ry,
      })
    })
  }

  const viewBox = computeAutomatonBounds(automaton, positionedStates, options)

  return {
    states: positionedStates,
    viewBox,
  }
}

