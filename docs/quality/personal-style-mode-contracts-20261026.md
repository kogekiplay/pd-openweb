# Personal style mode contracts and finite UI props — 2026-10-26

Base source: dce559c58e6b8355acfe6ea7b4f6b1683f9b2d54. This is one reviewed slice of the active repository-wide strict goal.

## Production contracts

All six PersonalStyle methods reuse the existing InboxEndpoint ordinary-JSON/opaque overloads. GetAccountsPersonalStatus uses the existing generated list model. GetPersonalStatus uses the existing generated model plus null/undefined: the 7.5.2 controller explicitly returns null when its service has no model. Set, cancel and delete return Boolean in ordinary JSON mode. AddOrUpdate returns a success/statusId object, including a failure branch with StatusId=null. Stream, synchronous, agent, custom-parsed and non-JSON modes stay opaque, not Boolean promises.

Request identities and nullable strings reuse UserStatus scalar types. Dates preserve explicit null and undefined; duration reuses HapApi.MD.BasicService.Duration_Option. Account IDs may be omitted because the C# request constructor initializes an empty HashSet; an explicit null collection still fails at Count. Wrappers do not clone, normalize or coerce arguments/options.

Global default/null serialization settings live in an unavailable MD.Framework assembly. The new response therefore keeps success optional and statusId nullable/optional; no assertion of JSON field presence is inferred solely from CLR metadata. Existing generated response DTOs are reused, not copied into another competing model. No production endpoint or remote configuration was queried.

Desktop and mobile consumers retain their old native null/undefined failure and original catch. The existing present helper returns valid response objects by reference and throws a native TypeError only at the original first statusOptions access boundary. No empty DTO or optional-chain fallback was added. Reflect's native error wording differs from direct property-access wording; this residual is explicit. Fourteen complete-module/real-Promise scenarios preserve state effects, getter order, references, synchronous marker failures and asynchronous rejection. React hooks/state/UI/config and transport are explicit fixtures; this is not ReactDOM/application E2E.

The mobile in-flight variable now uses the actual shared InboxRequest<boolean> contract. Its old ApiResult required a broad index signature and caused two new tuples in the first measurement; those failures are preserved rather than offset by another file's reduction.

## Exact member extractions

Flash A source 412dcff50327f0ddc6190a4e4208a6233b442b4f contributes KeyboardShortcuts props/entry parameters, its three-case entry spec, and the real loadHostKeys language parameter. The response still comes from dynamic HotKeys configuration unavailable locally; eight component diagnostics remain. Lead removes the proposed explicit ApiResult return annotation and corrects the old Boolean-response comment. This does not claim a complete shortcut response schema or entry return-handle contract.

Flash B source 53477c3c7f3cf88a71653e43d31ca12b9dd5e8ce contributes CommonSwitch and SectionTitle finite props. The former callback gets a Boolean from the actual Switch implementation; the latter receives the actual React div mouse event. Names/tips/titles use ReactNode. Existing defaults, callback references, getter order and render logic are unchanged. Actual exported positive/negative/non-any/finite-key probes are checked; normalized runtime emissions match.

Nine strict-debt entries are removed: seven already clean in the fixed base and the two newly clean components. This only tightens the gate; it is not a declaration that all nine complete production contracts were independently accepted. The legacy source inventory and lead's independent implementations remain distinct.

## Verification and preserved limits

Final raw strict is 48,491 -> 48,487; Chat 244 -> 242; every (file,error-code) tuple is non-increasing; actual raw exit remains 1. Only the two FormExtend TS7006 entries and two KeyboardShortcuts TS7006 entries disappear. Formal tools gate passes. Combined public probes have zero own diagnostics, 1197 transitive diagnostics and actual exit 1; all 36 alternate endpoint modes are checked independently.

The first API composite had two new Mobile tuples and was rejected. Initial private JSX probe exports produced five TS2883 diagnostics; only their named ReactElement annotations were corrected, with unchanged compiler settings. Both failures are kept. A member's old behavior script compared candidate HEAD to itself after commit; only the corrected fixed-base log is used, with both source hashes. The overwritten earlier log and an incorrectly classified large targeted type run are recorded explicitly in provenance; neither is represented as an authorized formal gate. Lead's final public/raw/tools measurements are independent and serialized.

Source-bound formal pre-push/release/build/assets/freeze receipts and the complete acceptance ledger are stored in /Users/kogeki/dev/HAP-工作记录/20261026-personal-style-contracts. This document records precommit verification; it does not claim unexecuted checks or deployment. Original 30-second limits, spec concurrency four, assertions, existing known-failure and the existing approved exceptions are unchanged.

Production remains HAP 7.5.2 / frontend 908c1d92bbbe32ad5c14fe965ac839c50543b5e3. Existing artifact-dce559c58e and older candidates/recovery material remain protected. This source is not deployed by committing or freezing it.
