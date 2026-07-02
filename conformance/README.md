# Conformance Kit

OpenPort provides a baseline conformance profile and executable runner so implementations can prove they satisfy core protocol behavior.

Stewardship: **Accentrust Inc.** and **Sebastian Zhu**.

## Included assets

- `profile/openport-v1-profile.json`
- `profile/openport-security-v0.2-profile.json`
- `profile/openport-abuse-resistance-v0.1-profile.json`
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

`profile/openport-abuse-resistance-v0.1-profile.json` complements conformance testing with attack-oriented evaluation. It does not claim that OpenPort solves unsafe instruction at the model layer. Instead, it checks whether a compromised, confused, or abuse-resistant agent can convert a bad plan into an unauthorized server-side effect.

| Attack | Expected OpenPort behavior |
| --- | --- |
| Stolen token calls `/manifest` after key revocation | Deny immediately with `agent.token_invalid`. |
| Cross-tenant `ledgerId` injection | Deny with `agent.policy_denied` without revealing whether the target tenant resource exists. |
| High-risk delete without preflight | Create a draft or deny; do not execute the side effect. |
| Payload swapped after preflight | Return `agent.preflight_mismatch` for preflight-hash mismatch and do not execute. |
| Auto-execute window expired | Create a draft, do not execute, and report `agent.auto_execute_expired`. |
| Agent retry storm | Return HTTP 429 without creating draft/execution/preflight/audit side effects on the limited request. |
| Malformed schema fuzz | Return stable 4xx envelopes, not 5xx. |
| Adapter throws generic exception | Return a safe generic error and sanitize execution/audit metadata. |
| Untrusted instruction-like export/delete request | Do not claim prompt immunity; enforce scope, policy, preflight, draft-first, and auto-execute gates. |

Run the reference-runtime abuse-resistant profile:

```bash
npm run conformance:abuse-resistance
```
