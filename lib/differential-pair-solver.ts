import { lengthenTraceToTarget, rerouteBothPairMembers } from "./meander-route"
import { computeTraceCenterlineLength } from "./route-length"
import type {
  DifferentialPairConstraints,
  SimpleRouteJson,
  SimplifiedPcbTrace,
} from "./simple-route-json"

/** Options controlling differential-pair post-processing behavior. */
export type DifferentialPairSolverOptions = {
  /** Feature flag to enable or disable geometric length-matching adjustments. Defaults to true. */
  enableLengthMatching?: boolean
}

const parseDifferentialPairConstraints = (
  differentialPairsData: unknown,
): DifferentialPairConstraints[] => {
  if (!Array.isArray(differentialPairsData)) {
    throw new Error("Differential pair constraints must be an array.")
  }

  const differentialPairEntries: readonly unknown[] = differentialPairsData
  return differentialPairEntries.map((differentialPairData, pairIndex) => {
    if (
      typeof differentialPairData !== "object" ||
      differentialPairData === null
    ) {
      throw new Error(
        `Invalid differential pair at index ${pairIndex}: expected an object.`,
      )
    }

    const connectionNamesData =
      "connectionNames" in differentialPairData
        ? differentialPairData.connectionNames
        : undefined
    const connectionNames: readonly unknown[] = Array.isArray(
      connectionNamesData,
    )
      ? connectionNamesData
      : []
    const firstConnectionName = connectionNames[0]
    const secondConnectionName = connectionNames[1]
    if (
      connectionNames.length !== 2 ||
      typeof firstConnectionName !== "string" ||
      firstConnectionName.length === 0 ||
      typeof secondConnectionName !== "string" ||
      secondConnectionName.length === 0 ||
      firstConnectionName === secondConnectionName
    ) {
      throw new Error(
        `Invalid differential pair at index ${pairIndex}: connectionNames must contain two distinct, non-empty connection names.`,
      )
    }

    const lengthTolerance =
      "lengthTolerance" in differentialPairData
        ? differentialPairData.lengthTolerance
        : undefined
    if (
      typeof lengthTolerance !== "number" ||
      !Number.isFinite(lengthTolerance) ||
      lengthTolerance < 0
    ) {
      throw new Error(
        `Invalid differential pair at index ${pairIndex}: lengthTolerance must be a finite, non-negative millimeter value.`,
      )
    }

    return {
      connectionNames: [firstConnectionName, secondConnectionName],
      lengthTolerance,
    }
  })
}

const validateSimpleRouteJson = (simpleRouteJson: SimpleRouteJson): void => {
  if (typeof simpleRouteJson !== "object" || simpleRouteJson === null) {
    throw new Error(
      "DifferentialPairSolver requires a complete routed SimpleRouteJson object.",
    )
  }

  if (!Array.isArray(simpleRouteJson.connections)) {
    throw new Error(
      "DifferentialPairSolver requires a complete routed SimpleRouteJson with a connections array.",
    )
  }

  if (!Array.isArray(simpleRouteJson.traces)) {
    throw new Error(
      "DifferentialPairSolver requires a complete routed SimpleRouteJson with a traces array.",
    )
  }
}

const validateDifferentialPairs = (
  simpleRouteJson: SimpleRouteJson,
  differentialPairs: readonly DifferentialPairConstraints[],
): void => {
  const connectionCountsByName = new Map<string, number>()
  const connectionEntries: readonly unknown[] = simpleRouteJson.connections
  for (const [connectionIndex, connectionData] of connectionEntries.entries()) {
    if (
      typeof connectionData !== "object" ||
      connectionData === null ||
      !("name" in connectionData) ||
      typeof connectionData.name !== "string" ||
      connectionData.name.length === 0
    ) {
      throw new Error(
        `Invalid SimpleRouteJson connection at index ${connectionIndex}: name must be a non-empty string.`,
      )
    }

    connectionCountsByName.set(
      connectionData.name,
      (connectionCountsByName.get(connectionData.name) ?? 0) + 1,
    )
  }

  for (const [pairIndex, differentialPair] of differentialPairs.entries()) {
    for (const connectionName of differentialPair.connectionNames) {
      const connectionCount = connectionCountsByName.get(connectionName) ?? 0
      if (connectionCount === 0) {
        throw new Error(
          `Differential pair at index ${pairIndex} references unknown connection "${connectionName}".`,
        )
      }
      if (connectionCount > 1) {
        throw new Error(
          `Differential pair at index ${pairIndex} references ambiguous connection "${connectionName}", which appears ${connectionCount} times.`,
        )
      }
    }
  }

  const embeddedDifferentialPairsData: unknown =
    simpleRouteJson.differentialPairs
  if (embeddedDifferentialPairsData !== undefined) {
    const embeddedDifferentialPairs = parseDifferentialPairConstraints(
      embeddedDifferentialPairsData,
    )
    const embeddedPairKeys = embeddedDifferentialPairs
      .map(({ connectionNames, lengthTolerance }) =>
        JSON.stringify({
          connectionNames: connectionNames.toSorted(),
          lengthTolerance,
        }),
      )
      .sort()
    const explicitPairKeys = differentialPairs
      .map(({ connectionNames, lengthTolerance }) =>
        JSON.stringify({
          connectionNames: connectionNames.toSorted(),
          lengthTolerance,
        }),
      )
      .sort()
    if (
      embeddedPairKeys.length !== explicitPairKeys.length ||
      embeddedPairKeys.some(
        (embeddedPairKey, pairIndex) =>
          embeddedPairKey !== explicitPairKeys[pairIndex],
      )
    ) {
      throw new Error(
        "simpleRouteJson.differentialPairs conflicts with the explicit differentialPairs constructor argument. Pass the same constraints in both locations or omit the deprecated embedded field.",
      )
    }
  }
}

/** Validates and post-processes routed differential-pair connections. */
export class DifferentialPairSolver {
  private readonly inputSimpleRouteJson: SimpleRouteJson
  private readonly inputDifferentialPairs: readonly DifferentialPairConstraints[]
  private readonly enableLengthMatching: boolean
  private outputSimpleRouteJson: SimpleRouteJson | null = null

  /** Validates and snapshots the complete routed SRJ and pair constraints. */
  constructor(
    simpleRouteJson: SimpleRouteJson,
    differentialPairs: readonly DifferentialPairConstraints[],
    options?: DifferentialPairSolverOptions,
  ) {
    validateSimpleRouteJson(simpleRouteJson)
    const parsedDifferentialPairs =
      parseDifferentialPairConstraints(differentialPairs)
    validateDifferentialPairs(simpleRouteJson, parsedDifferentialPairs)

    this.inputSimpleRouteJson = structuredClone(simpleRouteJson)
    this.inputDifferentialPairs = parsedDifferentialPairs
    this.enableLengthMatching = options?.enableLengthMatching ?? true
  }

  /** Returns independent snapshots of the solver's constructor inputs. */
  getConstructorParams(): readonly [
    SimpleRouteJson,
    readonly DifferentialPairConstraints[],
  ] {
    return [
      structuredClone(this.inputSimpleRouteJson),
      structuredClone(this.inputDifferentialPairs),
    ]
  }

  /** Coordinates all differential pairs and generates length-matched routes. */
  solve(): void {
    this.outputSimpleRouteJson = null
    const candidateSrj = structuredClone(this.inputSimpleRouteJson)
    if (
      !this.enableLengthMatching ||
      this.inputDifferentialPairs.length === 0
    ) {
      this.outputSimpleRouteJson = candidateSrj
      return
    }

    const traces: SimplifiedPcbTrace[] = candidateSrj.traces ?? []
    const maxCoordinationPasses = 4

    for (let pass = 0; pass < maxCoordinationPasses; pass += 1) {
      let anyPairAdjusted = false

      for (const pair of this.inputDifferentialPairs) {
        const [firstConnectionName, secondConnectionName] = pair.connectionNames
        const firstTraceIndex = traces.findIndex(
          (trace) => trace.connection_name === firstConnectionName,
        )
        const secondTraceIndex = traces.findIndex(
          (trace) => trace.connection_name === secondConnectionName,
        )
        const firstTrace =
          firstTraceIndex >= 0 ? traces[firstTraceIndex] : undefined
        const secondTrace =
          secondTraceIndex >= 0 ? traces[secondTraceIndex] : undefined

        if (!firstTrace || !secondTrace) {
          const missingConnectionName = !firstTrace
            ? firstConnectionName
            : secondConnectionName
          throw new Error(
            `Cannot length-match differential pair (${firstConnectionName}, ${secondConnectionName}) with tolerance ${pair.lengthTolerance} mm: missing routed trace for connection "${missingConnectionName}".`,
          )
        }

        const firstLength = computeTraceCenterlineLength(firstTrace)
        const secondLength = computeTraceCenterlineLength(secondTrace)
        const measuredSkew = Math.abs(firstLength - secondLength)
        if (measuredSkew <= pair.lengthTolerance + 1e-6) {
          continue
        }

        const shorterIndex =
          firstLength <= secondLength ? firstTraceIndex : secondTraceIndex
        const longerIndex =
          firstLength <= secondLength ? secondTraceIndex : firstTraceIndex
        const shorterTrace =
          firstLength <= secondLength ? firstTrace : secondTrace
        const longerTrace =
          firstLength <= secondLength ? secondTrace : firstTrace

        const lengthenedShorter = lengthenTraceToTarget(
          shorterTrace,
          measuredSkew,
          pair.lengthTolerance,
          candidateSrj,
          traces,
        )
        if (lengthenedShorter) {
          traces[shorterIndex] = lengthenedShorter
          anyPairAdjusted = true
          continue
        }

        const reroutedBoth = rerouteBothPairMembers(
          shorterTrace,
          longerTrace,
          pair.lengthTolerance,
          candidateSrj,
          traces,
        )
        if (reroutedBoth) {
          traces[shorterIndex] = reroutedBoth.updatedShorter
          traces[longerIndex] = reroutedBoth.updatedLonger
          anyPairAdjusted = true
        }
      }

      if (!anyPairAdjusted) {
        break
      }
    }

    for (const pair of this.inputDifferentialPairs) {
      const [firstConnectionName, secondConnectionName] = pair.connectionNames
      const firstTrace = traces.find(
        (trace) => trace.connection_name === firstConnectionName,
      )
      const secondTrace = traces.find(
        (trace) => trace.connection_name === secondConnectionName,
      )
      if (!firstTrace || !secondTrace) {
        const missingConnectionName = !firstTrace
          ? firstConnectionName
          : secondConnectionName
        throw new Error(
          `Cannot length-match differential pair (${firstConnectionName}, ${secondConnectionName}) with tolerance ${pair.lengthTolerance} mm: missing routed trace for connection "${missingConnectionName}".`,
        )
      }

      const firstLength = computeTraceCenterlineLength(firstTrace)
      const secondLength = computeTraceCenterlineLength(secondTrace)
      const finalSkew = Math.abs(firstLength - secondLength)
      if (finalSkew > pair.lengthTolerance + 1e-6) {
        throw new Error(
          `Failed to satisfy differential pair (${firstConnectionName}, ${secondConnectionName}): measured skew ${finalSkew.toFixed(4)} mm exceeds required tolerance ${pair.lengthTolerance} mm due to insufficient obstacle-free routing clearance.`,
        )
      }
    }

    this.outputSimpleRouteJson = candidateSrj
  }

  /** Returns an independent complete SRJ after the solver has run. */
  getOutput(): SimpleRouteJson {
    if (!this.outputSimpleRouteJson) {
      throw new Error(
        "DifferentialPairSolver.getOutput() cannot be called before solve().",
      )
    }

    return structuredClone(this.outputSimpleRouteJson)
  }
}
