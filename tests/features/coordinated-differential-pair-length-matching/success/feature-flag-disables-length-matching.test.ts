import { expect, test } from "bun:test"
import { DifferentialPairSolver, type SimpleRouteJson } from "../../../../lib"

test("leaves mismatched pair routes unchanged when enableLengthMatching is false", () => {
  const simpleRouteJson: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    obstacles: [],
    bounds: { minX: -1, maxX: 15, minY: -5, maxY: 5 },
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
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_neg",
        connection_name: "pair_neg",
        route: [
          { route_type: "wire", x: 0, y: -1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 5, y: -3, width: 0.2, layer: "top" },
          { route_type: "wire", x: 10, y: -1, width: 0.2, layer: "top" },
        ],
      },
    ],
  }

  const solver = new DifferentialPairSolver(
    simpleRouteJson,
    [
      {
        connectionNames: ["pair_pos", "pair_neg"],
        lengthTolerance: 0.05,
      },
    ],
    { enableLengthMatching: false },
  )

  solver.solve()
  expect(solver.getOutput()).toEqual(simpleRouteJson)
})
