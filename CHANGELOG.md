# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

### Added
- Conformance kit with profile and runnable local/remote checker.
- Release preparation script (`scripts/prepare-release.sh`) and release helper command.
- Governance assets (`ROADMAP.md`, `SUPPORT.md`, issue templates, PR template).
- Security hardening and LLM/OpenClaw integration guides.
- Additional abuse and fuzz regression tests.

## [0.1.0] - 2026-02-13

### Added
- Initial OpenPort reference runtime with `agent/v1` read/action/draft endpoints.
- Admin control surface for app/key lifecycle, policy update, auto-execute settings, draft review, and audit listing.
- OpenAPI contract file at `spec/openport-v1.openapi.yaml`.
- Runtime adapter modes: in-memory, Postgres, and Prisma embedding support.
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
