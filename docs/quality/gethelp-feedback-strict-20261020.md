# GetHelp feedback boundaries

Base: `8286bbd349f5d352f36ba97896f8826bfd6437fd`.

GetHelp previously accepted implicit-any options, stored its fetched owner as
`{}`, and held an any textarea ref. Its generated getOwner and feedback wrappers
also exposed untyped request and response boundaries. This slice connects the
actual component, wrapper-injected close callback, textarea ref, owner response
and two feedback request shapes with finite types.

Modes are the two implemented values, 1 and 2. Owner fields remain optional;
falsy JSON owner responses leave the initial empty owner unchanged. Feedback
results are opaque unknown because the component only tests truthiness. The
typed API promises retain their existing abort and metadata contract. No
runtime defaults, guards, parameter copies or request expressions were added.
Other chatbot endpoints retain their existing debt and are outside this slice.

## Evidence

- Full strict diagnostics: **50,220 -> 50,204**. Per-(file, error code) counters
  have **zero increases**. GetHelp **12 -> 0**; chatbot wrapper **26 -> 22**.
- `typecheck:strict`: passed after removing only GetHelp from strict-debt.
  Debt **3,049 -> 3,048**; strict-clean **1,732/4,780**.
- Fast baseline shrank **8,378/2,260 keys -> 8,364/2,253 keys**. Every new
  key count is no greater than its prior count; no new key or debt file was added.
  This also removes already-resolved ArchivedList diagnostics from the old baseline.
- **8** actual component/API checks pass: loading and owner identity, falsy
  owner values, delayed focus and nullable manualRef, user/platform payloads,
  trimming and submitting, truthy success/alert/close order, falsy responses and
  rejection, mobile owner panel/mask, and native synchronous failure prefix.
  UI leaves, hooks and transport are controlled hosts; no real feedback or DOM
  operation is performed. This does not certify DOM rendering or server schema.
- Actual public type probes have zero probe diagnostics and **7** verified
  negative expectations (invalid mode/IDs, missing or invalid opinion, invalid
  owner field and arbitrary access to opaque feedback). Result types are
  independently checked against any. Reachable product debt still makes the
  standalone probe program exit 1; that is not represented as a full strict pass.
- Both complete product modules emit identical code to the base with Babel
  comments disabled. The first comparison retained new source comments and
  failed; its output is preserved. The executable-code comparison then passed.
- Tools gate: passed. Targeted ESLint: zero errors, one existing exhaustive-deps
  warning; dependencies were preserved to retain mount behaviour. Initial
  formatting failures and final output are retained. Generated API wrapper is
  excluded by the repository's existing lint configuration.

Normal pre-push must run the complete suite and original type gates without
skip flags before main synchronization. Its terminal result and exact source
SHA are recorded in the shared lead state and evidence manifest after the push.
Whole-repository strict and production deployment are not complete.

Evidence directory:
`/Users/kogeki/Documents/Codex/2026-10-20/users-kogeki-downloads-hap-block-md/work/hap-lead-450157-gethelp-20261020/`
