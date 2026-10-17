import { expect, test } from "bun:test"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  DifferentialPairSolver,
  type SimpleRouteJson,
  type SimplifiedPcbTrace,
  computeTraceCenterlineLength,
} from "../../../../lib"

function renderDifferentialPairSnapshotSvg(
  inputSrj: SimpleRouteJson,
  outputSrj: SimpleRouteJson,
): string {
  const renderTraces = (
    srj: SimpleRouteJson,
    xOffset: number,
    label: string,
  ) => {
    const traces: SimplifiedPcbTrace[] = srj.traces ?? []
    const polylines = traces
      .map((trace, idx) => {
        const pts = (
          trace.route as Array<{ x: number; y: number; route_type?: string }>
        )
          .filter((pt) => pt.route_type === "wire")
          .map(
            (pt) =>
              `${(35 + pt.x * 13).toFixed(2)},${(95 - pt.y * 15).toFixed(2)}`,
          )
          .join(" ")
        const color = idx === 0 ? "#dc2626" : "#2563eb"
        const len = computeTraceCenterlineLength(trace).toFixed(2)
        return `<polyline data-connection="${trace.connection_name}" data-length-mm="${len}" points="${pts}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`
      })
      .join("")
    return `<g transform="translate(${xOffset} 0)"><text x="100" y="20" text-anchor="middle" font-size="14">${label}</text><rect x="20" y="30" width="160" height="110" rx="6" fill="#f8fafc" stroke="#94a3b8"/>${polylines}</g>`
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 210">`,
    renderTraces(inputSrj, 0, "Routed input"),
    renderTraces(outputSrj, 220, "Matched output"),
    `<g data-type="pcb_note_text">`,
    `<text x="20" y="160" font-size="11">Pair: positive_trace + negative_trace | Max skew: 0.05 mm</text>`,
    `<text x="20" y="176" font-size="11">Phase: differential-pair post-processing</text>`,
    `<text x="20" y="192" font-size="11">Expected: successful matching within 0.05 mm tolerance</text>`,
    `</g>`,
    `</svg>`,
  ].join("\n")
}

test("generates human-readable visual SVG snapshot with differential-pair note text", () => {
  const inputSimpleRouteJson: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.15,
    obstacles: [],
    bounds: { minX: -1, maxX: 15, minY: -5, maxY: 6 },
    connections: [
      {
        name: "positive_trace",
        nominalTraceWidth: 0.2,
        pointsToConnect: [
          { x: 0, y: 1, layer: "top" },
          { x: 10, y: 1, layer: "top" },
        ],
      },
      {
        name: "negative_trace",
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
        pcb_trace_id: "pcb_trace_positive",
        connection_name: "positive_trace",
        route: [
          { route_type: "wire", x: 0, y: 1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 10, y: 1, width: 0.2, layer: "top" },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "pcb_trace_negative",
        connection_name: "negative_trace",
        route: [
          { route_type: "wire", x: 0, y: -1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 3, y: -1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 3, y: -2.5, width: 0.2, layer: "top" },
          { route_type: "wire", x: 7, y: -2.5, width: 0.2, layer: "top" },
          { route_type: "wire", x: 7, y: -1, width: 0.2, layer: "top" },
          { route_type: "wire", x: 10, y: -1, width: 0.2, layer: "top" },
        ],
      },
    ],
  }

  const solver = new DifferentialPairSolver(inputSimpleRouteJson, [
    {
      connectionNames: ["positive_trace", "negative_trace"],
      lengthTolerance: 0.05,
    },
  ])
  solver.solve()
  const outputSimpleRouteJson = solver.getOutput()
  const svg = renderDifferentialPairSnapshotSvg(
    inputSimpleRouteJson,
    outputSimpleRouteJson,
  )

  const currentDir = dirname(fileURLToPath(import.meta.url))
  const snapshotDir = join(currentDir, "__snapshots__")
  const snapshotPath = join(snapshotDir, "visual-snapshot.snap.svg")
  if (!existsSync(snapshotPath)) {
    mkdirSync(snapshotDir, { recursive: true })
    writeFileSync(snapshotPath, `${svg}\n`, "utf8")
  }
  const expectedSvg = readFileSync(snapshotPath, "utf8").trim()
  expect(svg.trim()).toBe(expectedSvg)
})
