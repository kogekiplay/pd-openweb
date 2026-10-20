# Bound default behaviour-spec concurrency

The pending ArchivedList commit is `78da221e41c9c9b2892f24d242b40ea6470b8766`.
Normal pre-push at that source ran all 283 specs with the host's ten available
logical CPUs. It failed at the unchanged 30,000 ms per-spec limit in
`BtnTd.spec.ts`, after its first fourteen checks. The same complete suite had
passed with concurrency four (283/283, 79.1 seconds). A fresh normal push after
the observed collaborator test process exited still reproduced the failure
(282/283, 80.7 seconds); the original failure is preserved.

`BtnTd` checks native unhandled rejections and callback failures using multiple
serial child processes. Starting one spec for every logical CPU oversubscribes
this workload. The runner now defaults to `min(4, availableParallelism())`.
Explicit `--concurrency` remains supported. Discovery, assertions, failure
handling, quarantine and the 30,000 ms default timeout are unchanged. Both
pre-push and release call this runner and receive the same bounded default.

Validation performed before this commit:

- `node scripts/run-specs.spec.ts`: passed. Real child lifetime records prove
  that all six discovered pool fixtures run exactly once and at most four
  overlap. Existing real-child checks retain discovery, filter, explicit
  concurrency, assertion failure, known-failure output, timeout termination,
  naming enforcement and skip-option behaviour.
- `node scripts/typecheck/tools-gate.ts`: passed.
- `git diff --check`: passed.

The normal push of this commit must execute the full pre-push gate without skip
flags. Its terminal result and remote-main readback belong in the shared lead
state; the focused runner spec alone does not establish a full gate pass.
This scheduling change does not certify whole-repository strict or production
deployment.

Evidence directory:
`/Users/kogeki/Documents/Codex/2026-10-20/users-kogeki-downloads-hap-block-md/work/hap-lead-continue-20261020/`
(`pre-push-78da221e41.log`, `runner-spec.log`, `runner-tools.log`, followed by
the normal push log for the new source commit).
