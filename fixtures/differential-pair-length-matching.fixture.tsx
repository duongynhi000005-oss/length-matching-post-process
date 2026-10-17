import {
  DifferentialPairSolver,
  type SimpleRouteJson,
  type SimplifiedPcbTrace,
  computeTraceCenterlineLength,
} from "../lib"

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

const RoutedPairPanel = ({
  simpleRouteJson,
  xOffset,
  title,
}: {
  simpleRouteJson: SimpleRouteJson
  xOffset: number
  title: string
}) => {
  const traces: SimplifiedPcbTrace[] = simpleRouteJson.traces ?? []
  return (
    <g transform={`translate(${xOffset} 0)`}>
      <text x="100" y="24" textAnchor="middle" fontSize="16" fontWeight="bold">
        {title}
      </text>
      <rect
        x="20"
        y="40"
        width="160"
        height="110"
        rx="8"
        fill="#f8fafc"
        stroke="#94a3b8"
      />
      {traces.map((trace, traceIndex) => {
        const wirePoints = (
          trace.route as Array<{ x: number; y: number; route_type?: string }>
        ).filter((pt) => pt.route_type === "wire")
        const lengthMm = computeTraceCenterlineLength(trace).toFixed(2)
        return (
          <g key={trace.pcb_trace_id}>
            <polyline
              points={wirePoints
                .map(({ x, y }) => `${35 + x * 13},${95 - y * 15}`)
                .join(" ")}
              fill="none"
              stroke={traceIndex === 0 ? "#dc2626" : "#2563eb"}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <text
              x="100"
              y={traceIndex === 0 ? 55 : 142}
              textAnchor="middle"
              fontSize="11"
              fill={traceIndex === 0 ? "#991b1b" : "#1e40af"}
            >
              {trace.connection_name} ({lengthMm} mm)
            </text>
          </g>
        )
      })}
    </g>
  )
}

const DifferentialPairLengthMatchingFixture = () => (
  <main
    style={{
      width: 480,
      padding: 24,
      color: "#0f172a",
      fontFamily: "system-ui, sans-serif",
    }}
  >
    <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>
      Differential-pair post-processing (matched)
    </h1>
    <p style={{ margin: "0 0 12px" }}>
      Pair: positive_trace + negative_trace · max skew: 0.05 mm
    </p>
    <svg
      viewBox="0 0 440 175"
      role="img"
      aria-label="Routed input and length-matched solver output"
    >
      <RoutedPairPanel
        simpleRouteJson={inputSimpleRouteJson}
        xOffset={0}
        title="Routed input"
      />
      <RoutedPairPanel
        simpleRouteJson={outputSimpleRouteJson}
        xOffset={220}
        title="Matched output"
      />
    </svg>
    <p style={{ margin: "8px 0 0", fontWeight: 600 }}>
      Expected: successful matching within 0.05 mm skew via meander insertion.
    </p>
  </main>
)

export default <DifferentialPairLengthMatchingFixture />
