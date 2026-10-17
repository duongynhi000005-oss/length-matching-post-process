import type { SimplifiedPcbTrace } from "./simple-route-json"

/** Vertical centerline distance attributed to each PCB layer transition in millimeters. */
export const LAYER_TRANSITION_LENGTH_MM = 1.6

type RoutePointCoordinates = {
  x: number
  y: number
  layer: string
  internalLength: number
}

const extractRoutePointCoordinates = (
  point: SimplifiedPcbTrace["route"][number],
): RoutePointCoordinates => {
  if (point.route_type === "wire") {
    return {
      x: point.x,
      y: point.y,
      layer: point.layer,
      internalLength: 0,
    }
  }

  if (point.route_type === "via") {
    return {
      x: point.x,
      y: point.y,
      layer: point.to_layer,
      internalLength:
        point.from_layer !== point.to_layer ? LAYER_TRANSITION_LENGTH_MM : 0,
    }
  }

  const spanLength = Math.hypot(
    point.end.x - point.start.x,
    point.end.y - point.start.y,
  )
  if (point.route_type === "jumper") {
    return {
      x: point.end.x,
      y: point.end.y,
      layer: point.layer,
      internalLength: spanLength,
    }
  }

  return {
    x: point.end.x,
    y: point.end.y,
    layer: point.to_layer,
    internalLength:
      spanLength +
      (point.from_layer !== point.to_layer ? LAYER_TRANSITION_LENGTH_MM : 0),
  }
}

/** Computes total routed centerline length in millimeters including layer transitions. */
export const computeTraceCenterlineLength = (
  trace: SimplifiedPcbTrace,
): number => {
  const routePoints = trace.route
  if (routePoints.length === 0) {
    return 0
  }

  let totalLength = 0
  let previousPoint: RoutePointCoordinates | null = null

  for (const routePoint of routePoints) {
    const currentPoint = extractRoutePointCoordinates(routePoint)
    totalLength += currentPoint.internalLength

    if (previousPoint !== null) {
      const startX =
        routePoint.route_type === "jumper" ||
        routePoint.route_type === "through_obstacle"
          ? routePoint.start.x
          : currentPoint.x
      const startY =
        routePoint.route_type === "jumper" ||
        routePoint.route_type === "through_obstacle"
          ? routePoint.start.y
          : currentPoint.y
      totalLength += Math.hypot(
        startX - previousPoint.x,
        startY - previousPoint.y,
      )

      const entryLayer =
        routePoint.route_type === "via" ||
        routePoint.route_type === "through_obstacle"
          ? routePoint.from_layer
          : currentPoint.layer
      if (entryLayer !== previousPoint.layer) {
        totalLength += LAYER_TRANSITION_LENGTH_MM
      }
    }

    previousPoint = currentPoint
  }

  return totalLength
}
