import { expect, test } from "bun:test"
import { DifferentialPairSolver, type SimpleRouteJson } from "../../../../lib"

test("throws an actionable error and leaves output unavailable when a declared pair member has no routed trace", () => {
  const simpleRouteJson: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    obstacles: [],
    bounds: { minX: -1, maxX: 12, minY: -3, maxY: 3 },
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
    ],
  }

  const inputSnapshot = structuredClone(simpleRouteJson)
  const solver = new DifferentialPairSolver(simpleRouteJson, [
    {
      connectionNames: ["pair_pos", "pair_neg"],
      lengthTolerance: 0.05,
    },
  ])

  expect(() => solver.solve()).toThrow(/pair_neg/)
  expect(simpleRouteJson).toEqual(inputSnapshot)
  expect(() => solver.getOutput()).toThrow(/solve\(\)/)
})
