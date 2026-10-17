import { expect, test } from "bun:test"
import {
  DifferentialPairSolver,
  type SimpleRouteJson,
  type SimplifiedPcbTrace,
  computeTraceCenterlineLength,
} from "../../../../lib"

test("routes meander away from non-pair trace obstacles and preserves obstacle traces", () => {
  const simpleRouteJson: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 5, y: 1.75 },
        width: 4,
        height: 0.8,
        connectedTo: ["blocker_pad"],
      },
    ],
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
          { route_type: "wire", x: 3, y: -2.2, width: 0.2, layer: "top" },
          { route_type: "wire", x: 7, y: -2.2, width: 0.2, layer: "top" },
          { route_type: "wire", x: 7, y: -1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 10, y: -1, width: 0.2, layer: "top" },
        ],
      },
    ],
  }

  const solver = new DifferentialPairSolver(simpleRouteJson, [
    {
      connectionNames: ["pair_pos", "pair_neg"],
      lengthTolerance: 0.05,
    },
  ])
  solver.solve()
  const output = solver.getOutput()
  const outputTraces: SimplifiedPcbTrace[] = output.traces ?? []
  const posTrace = outputTraces.find((t) => t.connection_name === "pair_pos")
  const negTrace = outputTraces.find((t) => t.connection_name === "pair_neg")

  if (!posTrace || !negTrace) {
    throw new Error("Expected both pair traces in output.")
  }

  expect(
    Math.abs(
      computeTraceCenterlineLength(posTrace) -
        computeTraceCenterlineLength(negTrace),
    ),
  ).toBeLessThanOrEqual(0.05)
  expect(output.obstacles).toEqual(simpleRouteJson.obstacles)
})
