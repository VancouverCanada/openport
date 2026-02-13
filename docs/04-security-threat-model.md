# Security Threat Model

## Key threats

1. Token leakage
2. Tenant boundary bypass
3. Unapproved destructive actions
4. Prompt injection causing tool misuse
5. Insufficient audit traceability
6. Sensitive data overexposure in logs
7. Abuse/DoS via excessive calls

## Required controls

1. Least privilege by default
- deny-all baseline
- explicit scope grants only

2. Default draft mode for writes
- write/delete/export require draft review unless explicitly allowed

3. Tenant hard guard
- every call bound to app + tenant context
- server-side verification, never trust client tenant IDs alone

4. High-risk safeguards
- step-up verification
- preflight hash match
- idempotency key
- short-lived auto-execute windows

5. Audit-first design
- immutable event trail
- include actor, app, action, status, reason code, request metadata

6. Data minimization
- field redaction policy
- separate operational logs from security audit payloads

7. Incident response
- one-click key revocation
- emergency integration disable switch
- anomaly alerts to security owners
