import { expect, test } from "bun:test"
import {
  DifferentialPairSolver,
  type SimpleRouteJson,
  type SimplifiedPcbTrace,
  computeTraceCenterlineLength,
} from "../../../../lib"

test("lengthens a shorter pair member to satisfy tolerance deterministically without mutating input or unrelated copper", () => {
  const simpleRouteJson: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    obstacles: [],
    bounds: { minX: -1, maxX: 15, minY: -5, maxY: 6 },
    connections: [
      {
        name: "pair_pos",
        nominalTraceWidth: 0.2,
        pointsToConnect: [
          { x: 0, y: 1, layer: "top" },
          { x: 10, y: 1, layer: "top" },
        ],
      },
      {
        name: "pair_neg",
        nominalTraceWidth: 0.2,
        pointsToConnect: [
          { x: 0, y: -1, layer: "top" },
          { x: 10, y: -1, layer: "top" },
        ],
      },
      {
        name: "unrelated_net",
        nominalTraceWidth: 0.15,
        pointsToConnect: [
          { x: 0, y: 4.5, layer: "top" },
          { x: 10, y: 4.5, layer: "top" },
        ],
      },
    ],
    traces: [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_pos",
        connection_name: "pair_pos",
        route: [
          { route_type: "wire", x: 0, y: 1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 10, y: 1, width: 0.2, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_neg",
        connection_name: "pair_neg",
        route: [
          { route_type: "wire", x: 0, y: -1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 3, y: -1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 3, y: -2.5, width: 0.2, layer: "top" },
          { route_type: "wire", x: 7, y: -2.5, width: 0.2, layer: "top" },
          { route_type: "wire", x: 7, y: -1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 10, y: -1, width: 0.2, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_unrelated",
        connection_name: "unrelated_net",
        route: [
          { route_type: "wire", x: 0, y: 4.5, width: 0.15, layer: "top" },
          { route_type: "wire", x: 10, y: 4.5, width: 0.15, layer: "top" },
        ],
      },
    ],
  }

  const inputSnapshot = structuredClone(simpleRouteJson)
  const pairs = [
    {
      connectionNames: ["pair_pos", "pair_neg"] satisfies [string, string],
      lengthTolerance: 0.05,
    },
  ]

  const solver1 = new DifferentialPairSolver(simpleRouteJson, pairs)
  solver1.solve()
  const output1 = solver1.getOutput()

  const solver2 = new DifferentialPairSolver(simpleRouteJson, pairs)
  solver2.solve()
  const output2 = solver2.getOutput()

  expect(simpleRouteJson).toEqual(inputSnapshot)
  expect(output1).toEqual(output2)

  const outputTraces: SimplifiedPcbTrace[] = output1.traces ?? []
  const outPos = outputTraces.find((t) => t.connection_name === "pair_pos")
  const outNeg = outputTraces.find((t) => t.connection_name === "pair_neg")
  const outUnrelated = outputTraces.find(
    (t) => t.connection_name === "unrelated_net",
  )

  if (!outPos || !outNeg || !outUnrelated) {
    throw new Error("Expected all traces to be present in solver output.")
  }

  const posLength = computeTraceCenterlineLength(outPos)
  const negLength = computeTraceCenterlineLength(outNeg)
  expect(Math.abs(posLength - negLength)).toBeLessThanOrEqual(0.05)
  expect(outPos.route[0]).toEqual({
    route_type: "wire",
    x: 0,
    y: 1,
    width: 0.2,
    layer: "top",
  })
  expect(outPos.route[outPos.route.length - 1]).toEqual({
    route_type: "wire",
    x: 10,
    y: 1,
    width: 0.2,
    layer: "top",
  })
  expect(outUnrelated).toEqual(simpleRouteJson.traces?.[2])
})
