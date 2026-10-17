# Features

## Coordinated differential-pair length matching

Evaluates all supplied differential pairs in a single solver invocation,
measures centerline trace lengths (including `1.6 mm` per layer transition),
inserts collision-free serpentine meanders on shorter pair members, and
reroutes both members when needed while treating non-pair traces and fixed PCB
obstacles as immutable.

Feature flag: `enableLengthMatching` on `DifferentialPairSolverOptions`
(defaults to `true`).

- [lengthens a shorter pair member deterministically](tests/features/coordinated-differential-pair-length-matching/success/lengthens-shorter-member.test.ts)
- [coordinates multiple pairs and reroutes both members](tests/features/coordinated-differential-pair-length-matching/success/coordinates-multiple-pairs-and-reroutes-both.test.ts)
- [supports disabling length matching via feature flag](tests/features/coordinated-differential-pair-length-matching/success/feature-flag-disables-length-matching.test.ts)
- [fails atomically when geometry cannot satisfy tolerance](tests/features/coordinated-differential-pair-length-matching/failure/unsolvable-geometry-throws-atomically.test.ts)

## Explicit differential-pair constraints

Validates explicit `DifferentialPairConstraints` entries and checks
compatibility with optional deprecated `simpleRouteJson.differentialPairs`.

- [retains every supplied pair as solver context](tests/features/explicit-differential-pair-constraints/success/constructor-params.test.ts)
- [rejects unknown connection references](tests/features/explicit-differential-pair-constraints/failure/unknown-connection.test.ts)

## Routed SRJ pass-through and immutability

Preserves complete Simple Route JSON structure and guarantees input/output
independence.

- [returns an independent SRJ output](tests/features/routed-srj-pass-through/success/output-cloning.test.ts)
- [requires solve before getOutput](tests/features/routed-srj-pass-through/failure/output-before-solve.test.ts)
