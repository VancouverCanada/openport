# Security Hardening Guide

Stewardship: **Accentrust** and the OpenMCP authors (**Genliang Zhu**, **Chu Wang**, **Ziyuan Wang**, **Zhida Li**).

This guide defines the minimum hardening baseline before tagging stable releases.

## Test baseline

Required automated checks:

- `npm test`
- `npm run conformance:local`
- `npm run safety`

Required security-focused test coverage:

- token validation and revocation
- tenant/workspace boundary denial
- policy denial (`max_days`, IP allowlist, scope checks)
- high-risk action safeguards (`preflight`, `idempotency`, `auto_execute`)
- malformed request fuzz tests with zero `5xx` regressions
- abuse controls (rate limiter behavior)

## Runtime hardening baseline

- enforce HTTPS in production deployments
- configure strict token lifetime and revocation process
- apply allowlist network controls for machine clients
- keep default action mode as draft-first
- require explicit justification for high-risk execution

## Audit baseline

- log every allow/deny/fail decision with reason code
- keep audit stream immutable
- redact sensitive payload fields
- store request metadata needed for incident response

## Release decision rule

If any hardening check fails, do not publish release tags.
