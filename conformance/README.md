# Conformance Kit

OpenPort provides a baseline conformance profile and executable runner so implementations can prove they satisfy core protocol behavior.

Stewardship: **Accentrust Inc.**

## Included assets

- `profile/openport-v1-profile.json`
- `profile/openport-security-v0.2-profile.json`
- `profile/openport-abuse-resistance-v0.1-profile.json`
- `profile/openport-safe-routing-v0.1-profile.json`
- `profile/openport-adaptive-least-privilege-v0.1-profile.json`
- `profile/openport-adaptive-least-privilege-v0.2-profile.json`
- `profile/openport-adaptive-least-privilege-v0.3-profile.json`
- `profile/openport-adaptive-least-privilege-v0.4-profile.json`
- `profile/openport-adaptive-least-privilege-v0.5-profile.json`
- `profile/openport-adaptive-least-privilege-v0.6-profile.json`
- `profile/openport-adaptive-least-privilege-v0.7-profile.json`
- `scripts/run-conformance.mjs`

## Run locally against the reference runtime

```bash
npm run build
npm run conformance:local
```

## Run against a remote OpenPort implementation

Set environment variables:

- `OPENPORT_BASE_URL`
- `OPENPORT_AGENT_TOKEN`

Then run:

```bash
npm run conformance:remote
```

## Scope notes

- This profile checks core endpoint behavior and envelope consistency.
- State Witness / Preconditions is listed as an optional stronger governance profile.
- It is intentionally minimal and safe for public CI usage.
- Product-specific authorization logic should add extra profile checks in downstream repos.

## Security Conformance Profile v0.2

`profile/openport-security-v0.2-profile.json` upgrades the security checks that were previously treated as partial or future validation targets:

| Invariant | v0.2 check | Passing criterion |
| --- | --- | --- |
| State Witness execution revalidation | Preflight/draft a state-bound action, mutate the resource, then approve or execute. | Runtime returns `agent.precondition_failed`, applies no tool side effect, and emits a denied audit event. |
| Idempotency replay | Retry the same `(appId, idempotencyKey)` execute request 100 times. | Exactly one execution effect is persisted; duplicate requests return replay responses. |
| Rate-limit no-side-effects | Exhaust the authenticated endpoint quota and send one more action request. | The 429 request creates no draft, execution, preflight, audit event, or adapter call. |
| Audit completeness | Exercise authenticated allow, deny, and fail paths. | Each path emits a structured audit event with app/key/actor and draft/execution correlation where applicable. |

Run the reference-runtime profile:

```bash
npm run conformance:security
```

## Abuse-Resistance Profile v0.1

`profile/openport-abuse-resistance-v0.1-profile.json` complements conformance testing with misuse-path regression checks. It does not claim model-layer immunity. Instead, it checks whether unsafe requests can become unauthorized server-side effects.

| Misuse path | Expected OpenPort behavior |
| --- | --- |
| Stolen token calls `/manifest` after key revocation | Deny immediately with `agent.token_invalid`. |
| Cross-tenant `ledgerId` injection | Deny with `agent.policy_denied` without revealing whether the target tenant resource exists. |
| High-risk delete without preflight | Create a draft or deny; do not execute the side effect. |
| Payload swapped after preflight | Return `agent.preflight_mismatch` for preflight-hash mismatch and do not execute. |
| Auto-execute window expired | Create a draft, do not execute, and report `agent.auto_execute_expired`. |
| Agent retry storm | Return HTTP 429 without creating draft/execution/preflight/audit side effects on the limited request. |
| Malformed schema fuzz | Return stable 4xx envelopes, not 5xx. |
| Adapter throws generic exception | Return a safe generic error and sanitize execution/audit metadata. |
| Untrusted instruction-like export/delete request | Enforce scope, policy, preflight, draft-first, and auto-execute gates. |

Run the reference-runtime abuse-resistance profile:

```bash
npm run conformance:abuse-resistance
```

## Verifiable Safe Tool Routing Profile v0.1

`profile/openport-safe-routing-v0.1-profile.json` defines the public-safe contract for server-computed route eligibility. It deliberately avoids product-specific catalog, deployment, provider, and policy details.

| Routing invariant | Passing criterion |
| --- | --- |
| Server-authoritative safe set | Accepted proposals are registered candidates permitted by current authorization, intent, and context state. |
| Ranker non-expansion | An excluded proposal returns HTTP 403 with `agent.route_selection_outside_safe_set` and creates no accepted route. |
| Current-state revalidation | Context/policy narrowing after route creation causes HTTP 409 with `agent.route_snapshot_stale`. |
| Principal isolation | Cross-key route reuse returns HTTP 404 with `agent.route_not_found` and discloses no route details. |
| Privacy-minimized evidence | Every candidate has hashed include/exclude evidence and reason codes; raw request text and raw unknown identifiers are not stored in route audit. |

Run the reference-runtime profile:

```bash
npm run conformance:routing
```

The profile validates the reference route contract only. It does not certify model robustness, trusted tool implementations, production hardening, or prompt-injection immunity.

## Adaptive Least-Privilege Capability Lease Profile v0.1

`profile/openport-adaptive-least-privilege-v0.1-profile.json` defines the public-safe contract for short-lived, principal-bound capability leases. It exposes protocol invariants and executable evidence without publishing private production policies, customer configuration, or infrastructure topology.

| Lease invariant | Passing criterion |
| --- | --- |
| Server-side intersection | The issued lease cannot exceed static authorization or applicable intent, context, route, and parent bounds. |
| Monotone attenuation | A child is no broader than its parent across tools, resources, fields, rows, effect amount/mode, calls, cost, and expiry. |
| Current-state revalidation | Revocation, expiry, principal mismatch, static-policy change, and upstream-state change fail closed before an effect. |
| Atomic budget use | Sixteen concurrent requests against a one-call lease produce exactly one success; preflight and replay do not double-spend. |
| Privacy-minimized evidence | Audit records retain hashes, counts, bindings, and reason codes without raw task text or private policy material. |

Run the reference-runtime profile:

```bash
npm run conformance:leases
```

The profile validates the reference capability-lease contract only. It does not certify model behavior, production deployment hardening, trusted tool implementations, or prompt-injection immunity.

## Adaptive Least-Privilege Durable Capability Lease Profile v0.2

`profile/openport-adaptive-least-privilege-v0.2-profile.json` extends the process-local contract with an optional public SQLite/WAL research adapter. The default in-memory runtime remains unchanged. The durable profile requires Node.js 22.5 or later because it uses the optional built-in `node:sqlite` interface.

| Durable invariant | Passing criterion |
| --- | --- |
| Atomic state and evidence obligation | Budget decrement, minimized outbox row, and lease-scoped idempotency record commit or roll back together. |
| Uncertain-commit replay | A post-commit response failure followed by an equivalent same-key retry does not decrement budget twice; changed-payload key reuse fails with `agent.idempotency_mismatch`. |
| Idempotent audit recovery | Delivery failures before or during outbox marking converge to one durable audit event. |
| Restart persistence | Active state and committed revocation remain effective after adapter and runtime reconstruction. |
| Durable concurrency | 32 distinct proposals yield one success; 16 equivalent same-key proposals reuse one consumption and audit event; a mismatched fingerprint is denied; the same key remains independent across leases. |
| Persistence minimization | Durable rows contain hashes, counts, lease bindings, and omission flags, not raw task or request content. |

Run the durable reference profile:

```bash
npm run conformance:leases:durable
```

Run all lease-related reference profiles:

```bash
npm run conformance:leases:all
```

## Process-Local Action Execution Coordination Profile v0.3

`profile/openport-adaptive-least-privilege-v0.3-profile.json` defines the public-safe process-local contract for coordinating retry-equivalent action executions after lease authorization. It addresses the check-before-effect concurrency window; it does not add durable or distributed effect semantics.

| Action coordination invariant | Passing criterion |
| --- | --- |
| Equivalent single-flight | Sixteen concurrent equivalent calls invoke one callback and return 15 replay results. |
| Fingerprint binding | A concurrent reuse of the scoped key with a different action fingerprint returns `agent.idempotency_mismatch` without invoking the mismatched callback. |
| Failure cleanup | A failed callback releases its claim so a later explicit retry can become leader. |

Run the action-coordination profile:

```bash
npm run conformance:leases:action
```

The profile is limited to one live runtime process. Process termination, multiple workers, durable completion records, receiver idempotency, and compensation require a stronger profile and separate evidence.

## Single-Host Durable Action Obligation Profile v0.4

`profile/openport-adaptive-least-privilege-v0.4-profile.json` defines a separate public-safe SQLite/WAL state machine for crash-recoverable action obligations. It persists an opaque effect envelope, stable action and compensation identifiers, leased worker claims, fencing tokens, explicit compensation/manual-review states, and digest-chained transition diagnostics. Callers remain responsible for minimizing or encrypting opaque envelopes.

| Durable action invariant | Passing criterion |
| --- | --- |
| Scoped request binding | One scope-key digest binds one request fingerprint, action type, effect-envelope digest, and compensation-envelope digest; changed reuse fails closed. |
| Atomic obligation submission | The obligation and its initial transition commit or roll back together. |
| Lease recovery and fencing | Completion at or after claim expiry fails closed; expired work can then be reclaimed, while the stale token cannot complete the action or compensation. |
| Stable receiver identifiers | Action and compensation identifiers remain stable across ambiguous retries. |
| Explicit compensation state | Compensation is separately requested, claimed, retried, and completed; it is never inferred from intent alone. |
| Visible unknown outcomes | Unsafe-to-retry outcomes remain in `manual_review`. |
| Local transition integrity | Per-obligation transition digests form a verifiable local chain without claiming external anchoring. |

Run the durable action-obligation profile:

```bash
npm run conformance:leases:durable-action
```

The v0.4 store does not execute domain handlers. Recovery after an effect has been accepted but before completion is recorded requires the receiver to deduplicate the stable identifier. Compensation correctness likewise depends on a reviewed compensating handler and business invariants. This is bounded single-host research evidence, not a distributed transaction, general exactly-once guarantee, multi-host protocol, production deployment claim, or description of any private Accentrust architecture.

## Single-Host Durable HTTP Action Lifecycle Profile v0.5

`profile/openport-adaptive-least-privilege-v0.5-profile.json` connects the public Fastify action route to optional SQLite/WAL draft and execution persistence plus the v0.4 obligation state machine. It passes a stable effect identifier to write-capable domain adapters and reconciles an already-persisted successful execution before retrying a receiver.

| HTTP lifecycle invariant | Passing criterion |
| --- | --- |
| Durable draft binding | Equivalent same-key HTTP submissions reuse one persisted draft; changed action payloads fail with `agent.idempotency_mismatch`. |
| Runtime reconstruction | A successful action remains replayable after rebuilding the runtime, action store, obligation store, and synthetic domain adapter. |
| Conditional ambiguous-delivery recovery | With an explicitly asserted stable-identifier receiver, a lost response after effect commit is retried under the same effect identifier and produces one receiver effect. |
| Postcommit reconciliation | A lost response after execution-record commit is reconciled from the persisted success before invoking the receiver again. |
| Same-key convergence | 32 concurrent equivalent HTTP requests produce one durable draft, one successful execution, one obligation, and one receiver effect. |
| Fail-closed default | Without an explicit receiver-idempotency assertion, an ambiguous handler failure enters `manual_review` and a retry is denied. |
| Negative receiver control | Enabling automatic retry against a deliberately non-idempotent receiver reproduces duplicate effects. |

Run the durable HTTP action profile:

```bash
npm run conformance:leases:http-durable
```

The v0.5 profile persists action payloads and policy snapshots because the HTTP action must be reconstructable; deployments must protect the database with appropriate access control, encryption, retention, and deletion policies. The profile does not persist the complete authentication, app-configuration, intent, or context subsystem. Its lease state, action state, obligation state, audit state, and receiver may use separate transactions, so it does not claim atomicity across those stores. It covers one host and a synthetic receiver only; it is not a consensus protocol, multi-host implementation, arbitrary-handler proof, general exactly-once guarantee, production architecture, or disclosure of private Accentrust systems.

## Conditional Effect-Receipt Reconciliation Profile v0.6

`profile/openport-adaptive-least-privilege-v0.6-profile.json` adds an optional recovery path for one narrower failure: a durable obligation is already `succeeded`, but the separately stored successful HTTP execution record is missing. The server may query a trusted receiver receipt and reconstruct the record only after exact effect-identifier, request-fingerprint, action-type, and canonical-result-digest verification. The effect handler is never called during reconciliation.

| Receipt-reconciliation invariant | Passing criterion |
| --- | --- |
| Default remains fail closed | Without a configured receipt lookup, retry retains `durable_execution_record_missing` and adds no receiver effect. |
| Complete evidence binding | Scope-key digest, receipt effect identifier, request fingerprint, action type, recomputed digest, receipt digest, and terminal obligation digest all match. |
| Explicit unavailable/invalid states | Lookup failure returns `durable_effect_receipt_unavailable`; forged, stale, malformed, or mismatched evidence returns `durable_effect_receipt_invalid`. |
| Idempotent reconstruction | Verified evidence creates one success record through the original action-state transaction and emits a distinct audit event. |
| Concurrent convergence | Equivalent concurrent retries converge to one success record and do not invoke the receiver again. |

The focused v0.6 checks are included in `npm run conformance:leases:http-durable`. This remains a trusted-integration, single-host reference profile over separate stores. Authentication of the receipt service is deployment-specific and is not demonstrated by the synthetic fixture. The profile is not a distributed transaction, cryptographic receipt protocol, filesystem-loss recovery design, multi-host safety proof, arbitrary-handler proof, general exactly-once guarantee, production architecture, or disclosure of private Accentrust systems.

## Authenticated Effect-Receipt Reconciliation Profile v0.7

`profile/openport-adaptive-least-privilege-v0.7-profile.json` optionally replaces the v0.6 lookup trust assumption with receiver-originated Ed25519 verification. When the server configures a nonempty pinned trust set, every recovered receipt must authenticate an RFC 8785-canonical binding over its version, purpose, public key identifier, obligation identifier, effect identifier, request fingerprint, action type, and result digest. The runtime accepts only Ed25519 SPKI public-key PEM values and never discovers keys from receipt metadata.

| Authenticated-receipt invariant | Passing criterion |
| --- | --- |
| Explicit activation | A nonempty server-side public-key registry enables authentication; request data and model output cannot add keys. |
| Strict authentication | Unsigned receipts, unsupported algorithms, unknown keys, malformed 64-byte base64url signatures, and invalid signatures fail with `durable_effect_receipt_authentication_failed`. |
| Signature plus relevance | A valid signature for another obligation or effect still fails with `durable_effect_receipt_invalid`; all v0.6 result and terminal-obligation bindings remain mandatory. |
| Bounded rotation | An overlapping old/new trust set accepts both keys, while removing the old key rejects old-key receipts without network discovery. |
| Observable provenance | Successful reconstruction reports `receipt_authenticated` and the accepted public key identifier in response and audit metadata. |
| Explicit compatibility | With no configured trust set, the v0.6 trusted lookup remains available and marks reconstruction as unauthenticated. |

The focused v0.7 checks are included in `npm run conformance:leases:http-durable`. This profile authenticates a synthetic public receipt binding; it does not prove Ed25519 or JCS, specify key distribution or private-key protection, define certificate validation or online revocation, establish freshness or compromise recovery, make separate stores atomic, guarantee arbitrary-handler or general exactly-once behavior, provide filesystem-loss or multi-host safety, establish production readiness, or disclose private Accentrust systems.
