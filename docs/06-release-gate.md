# Release Gate Checklist

No release is allowed unless every item is true.

## A. Secret and privacy gates

- [ ] No `.env` files or private keys in git history
- [ ] Secret scan completed (high severity = 0)
- [ ] No production IDs/emails/hostnames in examples
- [ ] No private SQL/schema dumps

## B. Boundary gates

- [ ] Every exported module labeled OPEN or ADAPTER
- [ ] ADAPTER modules expose interfaces only
- [ ] PRIVATE modules remain outside this repository

## C. Security behavior gates

- [ ] Scope denial tests pass
- [ ] Tenant isolation tests pass
- [ ] High-risk action requires preflight + idempotency + step-up
- [ ] Revoked keys fail immediately

## D. Auditability gates

- [ ] All endpoints emit structured audit events
- [ ] Failure paths audited with reason codes
- [ ] CSV export redaction checks pass

## E. Governance gates

- [ ] SECURITY.md is present and accurate
- [ ] CODEOWNERS configured
- [ ] License confirmed

## Automation requirement

- [ ] `npm run gate` passes locally (Node 22)
- [ ] `npm run conformance:local` passes locally
- [ ] `.github/workflows/ci.yml` passes on pull request
