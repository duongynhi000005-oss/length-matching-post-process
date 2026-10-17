import { type WireRoutePoint, isCandidateTraceValid } from "./route-clearance"
import { computeTraceCenterlineLength } from "./route-length"
import type { SimpleRouteJson, SimplifiedPcbTrace } from "./simple-route-json"

const buildSerpentinePointsOnSegment = (
  start: WireRoutePoint,
  end: WireRoutePoint,
  additionalLength: number,
  lobeCount: number,
  directionSign: 1 | -1,
  marginFraction: number,
): WireRoutePoint[] | null => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const segmentLength = Math.hypot(dx, dy)
  if (segmentLength <= 1e-6 || lobeCount < 1) {
    return null
  }

  const usableFraction = 1 - 2 * marginFraction
  const usableLength = segmentLength * usableFraction
  const minPitch = Math.max(start.width * 2.5, 0.25)
  if (usableLength < lobeCount * minPitch) {
    return null
  }

  const amplitude = additionalLength / (2 * lobeCount)
  if (amplitude <= 1e-6) {
    return null
  }

  const ux = dx / segmentLength
  const uy = dy / segmentLength
  const nx = -uy * directionSign
  const ny = ux * directionSign

  const points: WireRoutePoint[] = [start]
  const lobeSpan = usableLength / lobeCount
  const gapSpan =
    lobeCount > 1
      ? Math.min(lobeSpan * 0.2, Math.max(start.width * 1.5, 0.15))
      : 0
  const activeSpan = lobeSpan - gapSpan

  if (activeSpan <= start.width * 1.2) {
    return null
  }

  for (let lobeIndex = 0; lobeIndex < lobeCount; lobeIndex += 1) {
    const baseStartDist = segmentLength * marginFraction + lobeIndex * lobeSpan
    const baseEndDist = baseStartDist + activeSpan

    const b1x = start.x + ux * baseStartDist
    const b1y = start.y + uy * baseStartDist
    const b2x = start.x + ux * baseEndDist
    const b2y = start.y + uy * baseEndDist

    const t1x = b1x + nx * amplitude
    const t1y = b1y + ny * amplitude
    const t2x = b2x + nx * amplitude
    const t2y = b2y + ny * amplitude

    points.push(
      {
        route_type: "wire",
        x: b1x,
        y: b1y,
        width: start.width,
        layer: start.layer,
      },
      {
        route_type: "wire",
        x: t1x,
        y: t1y,
        width: start.width,
        layer: start.layer,
      },
      {
        route_type: "wire",
        x: t2x,
        y: t2y,
        width: start.width,
        layer: start.layer,
      },
      {
        route_type: "wire",
        x: b2x,
        y: b2y,
        width: start.width,
        layer: start.layer,
      },
    )
  }

  points.push(end)
  return points
}

/**
 * Attempts to lengthen `trace` by `targetAdditionalLength` (within `lengthTolerance`)
 * using collision-free serpentine meanders across one or more wire segments.
 */
export const lengthenTraceToTarget = (
  trace: SimplifiedPcbTrace,
  targetAdditionalLength: number,
  lengthTolerance: number,
  simpleRouteJson: SimpleRouteJson,
  allTraces: readonly SimplifiedPcbTrace[],
): SimplifiedPcbTrace | null => {
  if (targetAdditionalLength <= lengthTolerance) {
    return structuredClone(trace)
  }

  const lobeCounts = [1, 2, 3, 4, 5, 6, 8]
  const marginFractions = [0.15, 0.1, 0.25, 0.05]
  const directionSigns: readonly (1 | -1)[] = [1, -1]

  for (let segIndex = 0; segIndex + 1 < trace.route.length; segIndex += 1) {
    const startPt = trace.route[segIndex]
    const endPt = trace.route[segIndex + 1]
    if (
      !startPt ||
      !endPt ||
      startPt.route_type !== "wire" ||
      endPt.route_type !== "wire" ||
      startPt.layer !== endPt.layer
    ) {
      continue
    }

    for (const lobeCount of lobeCounts) {
      for (const directionSign of directionSigns) {
        for (const marginFraction of marginFractions) {
          const replacement = buildSerpentinePointsOnSegment(
            startPt,
            endPt,
            targetAdditionalLength,
            lobeCount,
            directionSign,
            marginFraction,
          )
          if (!replacement) {
            continue
          }

          const candidateRoute = [
            ...trace.route.slice(0, segIndex),
            ...replacement,
            ...trace.route.slice(segIndex + 2),
          ]
          const candidateTrace: SimplifiedPcbTrace = {
            ...structuredClone(trace),
            route: candidateRoute,
          }

          if (
            isCandidateTraceValid(candidateTrace, simpleRouteJson, allTraces)
          ) {
            return candidateTrace
          }
        }
      }
    }
  }

  let workingTrace = structuredClone(trace)
  const initialLength = computeTraceCenterlineLength(workingTrace)
  const targetLength = initialLength + targetAdditionalLength

  for (let step = 0; step < 6; step += 1) {
    const currentLength = computeTraceCenterlineLength(workingTrace)
    const remaining = targetLength - currentLength
    if (remaining <= lengthTolerance) {
      return workingTrace
    }

    let progressed = false
    const fractionsToTry = [1, 0.75, 0.5, 0.35, 0.25]
    for (const fraction of fractionsToTry) {
      const stepDelta = remaining * fraction
      for (
        let segIndex = 0;
        segIndex + 1 < workingTrace.route.length;
        segIndex += 1
      ) {
        const startPt = workingTrace.route[segIndex]
        const endPt = workingTrace.route[segIndex + 1]
        if (
          !startPt ||
          !endPt ||
          startPt.route_type !== "wire" ||
          endPt.route_type !== "wire" ||
          startPt.layer !== endPt.layer
        ) {
          continue
        }

        for (const lobeCount of lobeCounts) {
          for (const directionSign of directionSigns) {
            for (const marginFraction of marginFractions) {
              const replacement = buildSerpentinePointsOnSegment(
                startPt,
                endPt,
                stepDelta,
                lobeCount,
                directionSign,
                marginFraction,
              )
              if (!replacement) continue

              const candidateRoute = [
                ...workingTrace.route.slice(0, segIndex),
                ...replacement,
                ...workingTrace.route.slice(segIndex + 2),
              ]
              const candidateTrace: SimplifiedPcbTrace = {
                ...structuredClone(workingTrace),
                route: candidateRoute,
              }

              if (
                isCandidateTraceValid(
                  candidateTrace,
                  simpleRouteJson,
                  allTraces,
                )
              ) {
                workingTrace = candidateTrace
                progressed = true
                break
              }
            }
            if (progressed) break
          }
          if (progressed) break
        }
        if (progressed) break
      }
      if (progressed) break
    }

    if (!progressed) {
      break
    }
  }

  const finalLength = computeTraceCenterlineLength(workingTrace)
  if (Math.abs(targetLength - finalLength) <= lengthTolerance + 1e-6) {
    return workingTrace
  }

  return null
}

/**
 * Attempts to reroute both members of a pair when single-member meandering
 * cannot achieve the required length match alone.
 */
export const rerouteBothPairMembers = (
  shorterTrace: SimplifiedPcbTrace,
  longerTrace: SimplifiedPcbTrace,
  lengthTolerance: number,
  simpleRouteJson: SimpleRouteJson,
  allTraces: readonly SimplifiedPcbTrace[],
): {
  updatedShorter: SimplifiedPcbTrace
  updatedLonger: SimplifiedPcbTrace
} | null => {
  const longerFirst = longerTrace.route[0]
  const longerLast = longerTrace.route[longerTrace.route.length - 1]
  if (
    !longerFirst ||
    !longerLast ||
    longerFirst.route_type !== "wire" ||
    longerLast.route_type !== "wire" ||
    longerFirst.layer !== longerLast.layer
  ) {
    return null
  }

  const directLongerTrace: SimplifiedPcbTrace = {
    ...structuredClone(longerTrace),
    route: [structuredClone(longerFirst), structuredClone(longerLast)],
  }

  const tracesWithDirectLonger = allTraces.map((trace) =>
    trace.pcb_trace_id === longerTrace.pcb_trace_id ? directLongerTrace : trace,
  )

  if (
    !isCandidateTraceValid(
      directLongerTrace,
      simpleRouteJson,
      tracesWithDirectLonger,
    )
  ) {
    return null
  }

  const directLongerLength = computeTraceCenterlineLength(directLongerTrace)
  const shorterLength = computeTraceCenterlineLength(shorterTrace)
  const newDiff = Math.abs(directLongerLength - shorterLength)
  if (newDiff <= lengthTolerance) {
    return {
      updatedShorter: structuredClone(shorterTrace),
      updatedLonger: directLongerTrace,
    }
  }

  if (directLongerLength > shorterLength) {
    const lengthenedShorter = lengthenTraceToTarget(
      shorterTrace,
      directLongerLength - shorterLength,
      lengthTolerance,
      simpleRouteJson,
      tracesWithDirectLonger,
    )
    if (lengthenedShorter) {
      return {
        updatedShorter: lengthenedShorter,
        updatedLonger: directLongerTrace,
      }
    }
  } else {
    const lengthenedLonger = lengthenTraceToTarget(
      directLongerTrace,
      shorterLength - directLongerLength,
      lengthTolerance,
      simpleRouteJson,
      tracesWithDirectLonger,
    )
    if (lengthenedLonger) {
      return {
        updatedShorter: structuredClone(shorterTrace),
        updatedLonger: lengthenedLonger,
      }
    }
  }

  return null
}
