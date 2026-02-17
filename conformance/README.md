# Conformance Kit

OpenMCP provides a baseline conformance profile and executable runner so implementations can prove they satisfy core protocol behavior.

Stewardship: **Accentrust Inc.** and **Sebastian Zhu**.

## Included assets

- `profile/openmcp-v1-profile.json`
- `scripts/run-conformance.mjs`

## Run locally against the reference runtime

```bash
npm run build
npm run conformance:local
```

## Run against a remote OpenMCP implementation

Set environment variables:

- `OPENMCP_BASE_URL`
- `OPENMCP_AGENT_TOKEN`

Then run:

```bash
npm run conformance:remote
```

## Scope notes

- This profile checks core endpoint behavior and envelope consistency.
- State Witness / Preconditions is listed as an optional stronger governance profile.
- It is intentionally minimal and safe for public CI usage.
- Product-specific authorization logic should add extra profile checks in downstream repos.
