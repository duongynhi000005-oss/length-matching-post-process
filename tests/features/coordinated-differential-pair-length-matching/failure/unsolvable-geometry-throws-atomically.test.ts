import { expect, test } from "bun:test"
import { DifferentialPairSolver, type SimpleRouteJson } from "../../../../lib"

test("fails atomically with connection names, measured skew, and tolerance when geometry is unsolvable", () => {
  const simpleRouteJson: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.2,
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 5, y: 1 },
        width: 4,
        height: 1.5,
        connectedTo: [],
      },
    ],
    bounds: { minX: 0, maxX: 10, minY: -0.25, maxY: 2.2 },
    connections: [
      {
        name: "tight_pos",
        nominalTraceWidth: 0.2,
        pointsToConnect: [
          { x: 0, y: 0, layer: "top" },
          { x: 10, y: 0, layer: "top" },
        ],
      },
      {
        name: "tight_neg",
        nominalTraceWidth: 0.2,
        pointsToConnect: [
          { x: 0, y: 2, layer: "top" },
          { x: 10, y: 2, layer: "top" },
        ],
      },
    ],
    traces: [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_tight_pos",
        connection_name: "tight_pos",
        route: [
          { route_type: "wire", x: 0, y: 0, width: 0.2, layer: "top" },
          { route_type: "wire", x: 10, y: 0, width: 0.2, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_tight_neg",
        connection_name: "tight_neg",
        route: [
          { route_type: "wire", x: 0, y: 2, width: 0.2, layer: "top" },
          { route_type: "wire", x: 2, y: 2, width: 0.2, layer: "top" },
          { route_type: "wire", x: 2, y: 0.1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 8, y: 0.1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 8, y: 2, width: 0.2, layer: "top" },
          { route_type: "wire", x: 10, y: 2, width: 0.2, layer: "top" },
        ],
      },
    ],
  }

  const inputSnapshot = structuredClone(simpleRouteJson)
  const solver = new DifferentialPairSolver(simpleRouteJson, [
    {
      connectionNames: ["tight_pos", "tight_neg"],
      lengthTolerance: 0.05,
    },
  ])

  expect(() => solver.solve()).toThrow(
    /Failed to satisfy differential pair \(tight_pos, tight_neg\): measured skew .* exceeds required tolerance 0.05 mm/,
  )
  expect(simpleRouteJson).toEqual(inputSnapshot)
  expect(() => solver.getOutput()).toThrow(
    "DifferentialPairSolver.getOutput() cannot be called before solve().",
  )
})
