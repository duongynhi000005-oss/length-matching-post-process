import { expect, test } from "bun:test"
import {
  DifferentialPairSolver,
  type SimpleRouteJson,
  type SimplifiedPcbTrace,
  computeTraceCenterlineLength,
} from "../../../../lib"

test("coordinates multiple nearby differential pairs and reroutes both members when needed", () => {
  const simpleRouteJson: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 5, y: 1.55 },
        width: 8,
        height: 0.5,
        connectedTo: [],
      },
      {
        type: "rect",
        layers: ["top"],
        center: { x: 5, y: 0.45 },
        width: 8,
        height: 0.5,
        connectedTo: [],
      },
    ],
    bounds: { minX: -1, maxX: 12, minY: -6, maxY: 6 },
    connections: [
      {
        name: "pair1_a",
        nominalTraceWidth: 0.2,
        pointsToConnect: [
          { x: 0, y: 1, layer: "top" },
          { x: 10, y: 1, layer: "top" },
        ],
      },
      {
        name: "pair1_b",
        nominalTraceWidth: 0.2,
        pointsToConnect: [
          { x: 0, y: 2.5, layer: "top" },
          { x: 10, y: 2.5, layer: "top" },
        ],
      },
      {
        name: "pair2_a",
        nominalTraceWidth: 0.2,
        pointsToConnect: [
          { x: 0, y: -1.5, layer: "top" },
          { x: 10, y: -1.5, layer: "top" },
        ],
      },
      {
        name: "pair2_b",
        nominalTraceWidth: 0.2,
        pointsToConnect: [
          { x: 0, y: -3, layer: "top" },
          { x: 10, y: -3, layer: "top" },
        ],
      },
    ],
    traces: [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_pair1_a",
        connection_name: "pair1_a",
        route: [
          { route_type: "wire", x: 0, y: 1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 10, y: 1, width: 0.2, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_pair1_b",
        connection_name: "pair1_b",
        route: [
          { route_type: "wire", x: 0, y: 2.5, width: 0.2, layer: "top" },
          { route_type: "wire", x: 2, y: 2.5, width: 0.2, layer: "top" },
          { route_type: "wire", x: 2, y: 4.5, width: 0.2, layer: "top" },
          { route_type: "wire", x: 8, y: 4.5, width: 0.2, layer: "top" },
          { route_type: "wire", x: 8, y: 2.5, width: 0.2, layer: "top" },
          { route_type: "wire", x: 10, y: 2.5, width: 0.2, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_pair2_a",
        connection_name: "pair2_a",
        route: [
          { route_type: "wire", x: 0, y: -1.5, width: 0.2, layer: "top" },
          { route_type: "wire", x: 10, y: -1.5, width: 0.2, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_pair2_b",
        connection_name: "pair2_b",
        route: [
          { route_type: "wire", x: 0, y: -3, width: 0.2, layer: "top" },
          { route_type: "wire", x: 3, y: -3, width: 0.2, layer: "top" },
          { route_type: "wire", x: 3, y: -4.2, width: 0.2, layer: "top" },
          { route_type: "wire", x: 7, y: -4.2, width: 0.2, layer: "top" },
          { route_type: "wire", x: 7, y: -3, width: 0.2, layer: "top" },
          { route_type: "wire", x: 10, y: -3, width: 0.2, layer: "top" },
        ],
      },
    ],
  }

  const solver = new DifferentialPairSolver(simpleRouteJson, [
    {
      connectionNames: ["pair1_a", "pair1_b"],
      lengthTolerance: 0.05,
    },
    {
      connectionNames: ["pair2_a", "pair2_b"],
      lengthTolerance: 0.05,
    },
  ])

  solver.solve()
  const output = solver.getOutput()

  const outputTraces: SimplifiedPcbTrace[] = output.traces ?? []
  const trace1A = outputTraces.find((t) => t.connection_name === "pair1_a")
  const trace1B = outputTraces.find((t) => t.connection_name === "pair1_b")
  const trace2A = outputTraces.find((t) => t.connection_name === "pair2_a")
  const trace2B = outputTraces.find((t) => t.connection_name === "pair2_b")

  if (!trace1A || !trace1B || !trace2A || !trace2B) {
    throw new Error("Expected all four pair traces to exist in output.")
  }

  expect(
    Math.abs(
      computeTraceCenterlineLength(trace1A) -
        computeTraceCenterlineLength(trace1B),
    ),
  ).toBeLessThanOrEqual(0.05)
  expect(
    Math.abs(
      computeTraceCenterlineLength(trace2A) -
        computeTraceCenterlineLength(trace2B),
    ),
  ).toBeLessThanOrEqual(0.05)
})
