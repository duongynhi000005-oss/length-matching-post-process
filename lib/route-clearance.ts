import type { SimpleRouteJson, SimplifiedPcbTrace } from "./simple-route-json"

export type Point2D = {
  x: number
  y: number
}

export type WireRoutePoint = {
  route_type: "wire"
  x: number
  y: number
  width: number
  layer: string
}

export type WireSegment = {
  start: Point2D
  end: Point2D
  layer: string
  width: number
}

const distancePointToSegment = (
  point: Point2D,
  segStart: Point2D,
  segEnd: Point2D,
): number => {
  const dx = segEnd.x - segStart.x
  const dy = segEnd.y - segStart.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq <= 1e-12) {
    return Math.hypot(point.x - segStart.x, point.y - segStart.y)
  }

  const projection =
    ((point.x - segStart.x) * dx + (point.y - segStart.y) * dy) / lengthSq
  const clamped = Math.max(0, Math.min(1, projection))
  const closestX = segStart.x + clamped * dx
  const closestY = segStart.y + clamped * dy
  return Math.hypot(point.x - closestX, point.y - closestY)
}

const orientation = (p: Point2D, q: Point2D, r: Point2D): number => {
  const value = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)
  if (Math.abs(value) <= 1e-10) {
    return 0
  }
  return value > 0 ? 1 : 2
}

const onSegment = (p: Point2D, q: Point2D, r: Point2D): boolean =>
  q.x <= Math.max(p.x, r.x) + 1e-9 &&
  q.x >= Math.min(p.x, r.x) - 1e-9 &&
  q.y <= Math.max(p.y, r.y) + 1e-9 &&
  q.y >= Math.min(p.y, r.y) - 1e-9

const segmentsIntersectProperly = (
  aStart: Point2D,
  aEnd: Point2D,
  bStart: Point2D,
  bEnd: Point2D,
): boolean => {
  const o1 = orientation(aStart, aEnd, bStart)
  const o2 = orientation(aStart, aEnd, bEnd)
  const o3 = orientation(bStart, bEnd, aStart)
  const o4 = orientation(bStart, bEnd, aEnd)

  if (o1 !== o2 && o3 !== o4) {
    return true
  }
  if (o1 === 0 && onSegment(aStart, bStart, aEnd)) return true
  if (o2 === 0 && onSegment(aStart, bEnd, aEnd)) return true
  if (o3 === 0 && onSegment(bStart, aStart, bEnd)) return true
  if (o4 === 0 && onSegment(bStart, aEnd, bEnd)) return true
  return false
}

const distanceSegmentToSegment = (
  aStart: Point2D,
  aEnd: Point2D,
  bStart: Point2D,
  bEnd: Point2D,
): number => {
  if (segmentsIntersectProperly(aStart, aEnd, bStart, bEnd)) {
    return 0
  }

  return Math.min(
    distancePointToSegment(aStart, bStart, bEnd),
    distancePointToSegment(aEnd, bStart, bEnd),
    distancePointToSegment(bStart, aStart, aEnd),
    distancePointToSegment(bEnd, aStart, aEnd),
  )
}

const distanceSegmentToRect = (
  segStart: Point2D,
  segEnd: Point2D,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
): number => {
  const minX = centerX - width / 2
  const maxX = centerX + width / 2
  const minY = centerY - height / 2
  const maxY = centerY + height / 2

  const startInside =
    segStart.x >= minX &&
    segStart.x <= maxX &&
    segStart.y >= minY &&
    segStart.y <= maxY
  const endInside =
    segEnd.x >= minX && segEnd.x <= maxX && segEnd.y >= minY && segEnd.y <= maxY
  if (startInside || endInside) {
    return 0
  }

  const c1: Point2D = { x: minX, y: minY }
  const c2: Point2D = { x: maxX, y: minY }
  const c3: Point2D = { x: maxX, y: maxY }
  const c4: Point2D = { x: minX, y: maxY }

  return Math.min(
    distanceSegmentToSegment(segStart, segEnd, c1, c2),
    distanceSegmentToSegment(segStart, segEnd, c2, c3),
    distanceSegmentToSegment(segStart, segEnd, c3, c4),
    distanceSegmentToSegment(segStart, segEnd, c4, c1),
  )
}

const extractWireSegments = (trace: SimplifiedPcbTrace): WireSegment[] => {
  const segments: WireSegment[] = []
  const route = trace.route
  for (let index = 0; index + 1 < route.length; index += 1) {
    const current = route[index]
    const next = route[index + 1]
    if (
      current &&
      next &&
      current.route_type === "wire" &&
      next.route_type === "wire" &&
      current.layer === next.layer
    ) {
      segments.push({
        start: { x: current.x, y: current.y },
        end: { x: next.x, y: next.y },
        layer: current.layer,
        width: Math.max(current.width, next.width),
      })
    }
  }
  return segments
}

const isPointWithinBounds = (
  point: Point2D,
  halfWidth: number,
  bounds: SimpleRouteJson["bounds"],
): boolean =>
  point.x - halfWidth >= bounds.minX - 1e-6 &&
  point.x + halfWidth <= bounds.maxX + 1e-6 &&
  point.y - halfWidth >= bounds.minY - 1e-6 &&
  point.y + halfWidth <= bounds.maxY + 1e-6

const isSegmentClearOfEnvironment = (
  segment: WireSegment,
  trace: SimplifiedPcbTrace,
  simpleRouteJson: SimpleRouteJson,
  allTraces: readonly SimplifiedPcbTrace[],
): boolean => {
  const halfWidth = segment.width / 2
  if (
    !isPointWithinBounds(segment.start, halfWidth, simpleRouteJson.bounds) ||
    !isPointWithinBounds(segment.end, halfWidth, simpleRouteJson.bounds)
  ) {
    return false
  }

  const obstacleMargin =
    simpleRouteJson.defaultObstacleMargin ??
    simpleRouteJson.minTraceToPadEdgeClearance ??
    0.1

  for (const obstacle of simpleRouteJson.obstacles) {
    if (!obstacle.layers.includes(segment.layer)) {
      continue
    }
    const isConnectedToTrace =
      obstacle.connectedTo.includes(trace.connection_name) ||
      obstacle.connectedTo.includes(trace.pcb_trace_id)
    if (isConnectedToTrace) {
      continue
    }

    const distance = distanceSegmentToRect(
      segment.start,
      segment.end,
      obstacle.center.x,
      obstacle.center.y,
      obstacle.width,
      obstacle.height,
    )
    if (distance < halfWidth + obstacleMargin - 1e-6) {
      return false
    }
  }

  const traceClearance = Math.max(simpleRouteJson.minTraceWidth * 0.5, 0.05)

  for (const otherTrace of allTraces) {
    if (
      otherTrace.pcb_trace_id === trace.pcb_trace_id ||
      otherTrace.connection_name === trace.connection_name
    ) {
      continue
    }

    const otherSegments = extractWireSegments(otherTrace)
    for (const otherSegment of otherSegments) {
      if (otherSegment.layer !== segment.layer) {
        continue
      }
      const minCenterlineDistance =
        halfWidth + otherSegment.width / 2 + traceClearance
      const distance = distanceSegmentToSegment(
        segment.start,
        segment.end,
        otherSegment.start,
        otherSegment.end,
      )
      if (distance < minCenterlineDistance - 1e-6) {
        return false
      }
    }
  }

  return true
}

const hasNonAdjacentSelfIntersection = (
  segments: readonly WireSegment[],
): boolean => {
  for (let i = 0; i < segments.length; i += 1) {
    const first = segments[i]
    if (!first) continue
    for (let j = i + 2; j < segments.length; j += 1) {
      const second = segments[j]
      if (!second || first.layer !== second.layer) continue
      const distance = distanceSegmentToSegment(
        first.start,
        first.end,
        second.start,
        second.end,
      )
      const minSpacing = (first.width + second.width) / 2
      if (distance < minSpacing - 1e-6) {
        return true
      }
    }
  }
  return false
}

/** Checks that a candidate trace respects board bounds, obstacles, other traces, and self-clearance. */
export const isCandidateTraceValid = (
  candidateTrace: SimplifiedPcbTrace,
  simpleRouteJson: SimpleRouteJson,
  allTraces: readonly SimplifiedPcbTrace[],
): boolean => {
  const candidateSegments = extractWireSegments(candidateTrace)
  if (hasNonAdjacentSelfIntersection(candidateSegments)) {
    return false
  }

  for (const segment of candidateSegments) {
    if (
      !isSegmentClearOfEnvironment(
        segment,
        candidateTrace,
        simpleRouteJson,
        allTraces,
      )
    ) {
      return false
    }
  }

  return true
}
