# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

### Added
- Conformance kit with profile and runnable local/remote checker.
- OpenPort Security Conformance Profile v0.2 with executable checks for state-witness revalidation, 100x idempotency replay, endpoint 429 no-side-effect behavior, and allow/deny/fail audit completeness.
- OpenPort Abuse-Resistance Profile v0.1 with attack-matrix tests for revoked-token replay, cross-tenant injection, high-risk misuse, preflight payload swapping, expired auto-execute windows, retry storms, malformed input fuzzing, adapter exceptions, and untrusted instruction-like export/delete attempts.
- Release preparation script (`scripts/prepare-release.sh`) and release helper command.
- Governance assets (`ROADMAP.md`, `SUPPORT.md`, issue templates, PR template).
- Security hardening and LLM/OpenClaw integration guides.
- Additional abuse and fuzz regression tests.
- Optional State Witness / Preconditions profile with execute-time precondition revalidation and `agent.precondition_failed` fail-closed behavior.

### Changed
- Hardened malformed request handling so Zod validation failures return `400 common.validation` rather than generic 500 errors across package boundaries.
- Added denied audit emission for create-time state-witness mismatch before returning `agent.precondition_failed`.
- Sanitized generic adapter execution failures in persisted execution and audit metadata with `agent.execution_failed`.

## [0.1.0] - 2026-02-13

### Added
- Initial OpenPort reference runtime with `agent/v1` read/action/draft endpoints.
- Admin control surface for app/key lifecycle, policy update, auto-execute settings, draft review, and audit listing.
- OpenAPI contract file at `spec/openport-v1.openapi.yaml`.
- Runtime adapter modes: in-memory and Postgres.
- Core security controls: token hashing, scope checks, tenant/workspace boundary enforcement, IP policy checks, and request rate limiting.
- High-risk action controls: preflight hash validation, idempotency key handling, and explicit auto-execute windows.
- Structured audit events on success, denial, and failure paths.
- Safety tooling: secret scan, private-marker scan, and release gate automation.
- CI workflow to run release gate on push and pull requests.
- Public adapter repository template scaffold under `templates/openport-adapter-public-template`.

### Tests
- Contract tests for OpenAPI validity and route coverage.
- Behavioral tests for manifest, policy redaction, draft approval, and key revocation.
- Security regression tests for cross-workspace rejection, IP allowlist rejection, and max-days policy enforcement.

### Governance
- Stewardship and authorship metadata for Accentrust Inc. and Sebastian Zhu.
- Contribution, security policy, and release-gate documentation.
