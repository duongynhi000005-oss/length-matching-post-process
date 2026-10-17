import { expect, test } from "bun:test"
import {
  DifferentialPairSolver,
  type SimpleRouteJson,
  type SimplifiedPcbTrace,
  computeTraceCenterlineLength,
} from "../../../../lib"

test("adjusts manually routed pair-member traces while keeping manual non-pair traces byte-for-byte unchanged", () => {
  const simpleRouteJson: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    obstacles: [],
    bounds: { minX: -1, maxX: 15, minY: -5, maxY: 6 },
    connections: [
      {
        name: "manual_pair_pos",
        nominalTraceWidth: 0.2,
        pointsToConnect: [
          { x: 0, y: 1, layer: "top" },
          { x: 10, y: 1, layer: "top" },
        ],
      },
      {
        name: "manual_pair_neg",
        nominalTraceWidth: 0.2,
        pointsToConnect: [
          { x: 0, y: -1, layer: "top" },
          { x: 10, y: -1, layer: "top" },
        ],
      },
      {
        name: "manual_guard_trace",
        nominalTraceWidth: 0.25,
        pointsToConnect: [
          { x: 0, y: 4.5, layer: "top" },
          { x: 10, y: 4.5, layer: "top" },
        ],
      },
    ],
    traces: [
      {
        type: "pcb_trace",
        pcb_trace_id: "manual_trace_pos",
        connection_name: "manual_pair_pos",
        route: [
          { route_type: "wire", x: 0, y: 1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 10, y: 1, width: 0.2, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "manual_trace_neg",
        connection_name: "manual_pair_neg",
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
        pcb_trace_id: "manual_trace_guard",
        connection_name: "manual_guard_trace",
        route: [
          { route_type: "wire", x: 0, y: 4.5, width: 0.25, layer: "top" },
          { route_type: "wire", x: 5, y: 4.5, width: 0.25, layer: "top" },
          { route_type: "wire", x: 10, y: 4.5, width: 0.25, layer: "top" },
        ],
      },
    ],
  }

  const solver = new DifferentialPairSolver(simpleRouteJson, [
    {
      connectionNames: ["manual_pair_pos", "manual_pair_neg"],
      lengthTolerance: 0.05,
    },
  ])
  solver.solve()
  const output = solver.getOutput()
  const outputTraces: SimplifiedPcbTrace[] = output.traces ?? []
  const posTrace = outputTraces.find(
    (t) => t.connection_name === "manual_pair_pos",
  )
  const negTrace = outputTraces.find(
    (t) => t.connection_name === "manual_pair_neg",
  )
  const guardTrace = outputTraces.find(
    (t) => t.connection_name === "manual_guard_trace",
  )

  if (!posTrace || !negTrace || !guardTrace) {
    throw new Error("Expected all traces in output.")
  }

  expect(
    Math.abs(
      computeTraceCenterlineLength(posTrace) -
        computeTraceCenterlineLength(negTrace),
    ),
  ).toBeLessThanOrEqual(0.05)
  expect(JSON.stringify(guardTrace)).toBe(
    JSON.stringify(simpleRouteJson.traces?.[2]),
  )
})
