# @tscircuit/length-matching-post-process

Validate and snapshot routed
[Simple Route JSON](https://github.com/tscircuit/simple-route-json) at the
package boundary for differential-pair length matching.

See [FEATURES.md](./FEATURES.md) for the current implementation status and
planned user-facing length-matching capabilities.

## Initial no-op release

Version `0.0.1` establishes the package and core integration contract tracked in
[issue #1](https://github.com/tscircuit/length-matching-post-process/issues/1).
It validates the input, preserves it without changing route geometry, and
returns a structurally independent complete Simple Route JSON object.
Coordinated length-matching and meander generation will replace the marked
implementation boundary in a later release.

Downstream consumers (`@tscircuit/core`) should consume a published package
version or pinned Git commit rather than committing machine-specific `file:` or
`link:` worktree paths.

## Install from GitHub

Add the package to your dependencies using a pinned Git commit:

```json
{
  "dependencies": {
    "@tscircuit/length-matching-post-process": "git+https://github.com/tscircuit/length-matching-post-process.git#<commit-sha>"
  }
}
```

Then run `bun install`. The package is available through its scoped package
name.

## Usage

```ts
import {
  type DifferentialPairConstraints,
  DifferentialPairSolver,
  type SimpleRouteJson,
} from "@tscircuit/length-matching-post-process"

const simpleRouteJson: SimpleRouteJson = getCompleteRoutedSimpleRouteJson()
const differentialPairs: readonly DifferentialPairConstraints[] = [
  {
    connectionNames: ["source_trace_positive", "source_trace_negative"],
    lengthTolerance: 0.1,
  },
]

const solver = new DifferentialPairSolver(
  simpleRouteJson,
  differentialPairs,
)
solver.solve()

const outputSimpleRouteJson = solver.getOutput()
```

All lengths, including `lengthTolerance`, are in millimeters.

The constructor receives the complete routed SRJ and the complete constraint
array for one routed subcircuit. All pairs are intentionally passed to one
solver invocation so future implementations can coordinate their geometry and
validate the final result as a whole. The planned matching implementation may
reroute either member of a supplied pair, including a manually routed member;
non-pair traces will remain immutable obstacles.

Constructor inputs are never mutated. The solver snapshots both inputs, and
each `getOutput()` call returns a new complete SRJ without sharing mutable
arrays or route objects with the input or previous output.

`SimpleRouteJson.differentialPairs` remains available only for compatibility
and is deprecated. Pass constraints as the second constructor argument. If the
deprecated field is present and disagrees with the explicit array, construction
fails instead of silently choosing one representation.

## Validation errors

Construction reports actionable errors when:

- a pair does not contain two distinct non-empty connection names;
- `lengthTolerance` is not a finite, non-negative millimeter value;
- a referenced connection is absent or ambiguous in `connections`;
- the deprecated embedded constraints conflict with the explicit array; or
- the input is not a complete routed SRJ containing `connections` and `traces`.

## Development

```sh
bun install
bun run build
bun run typecheck
bun test
bun run start
```

`bun run start` opens the Cosmos fixture at `http://localhost:5000`. The fixture
shows the routed input and no-op output for a labeled differential pair.
