# Contributing

OpenPort is stewarded by **Accentrust Inc.** and **Sebastian Zhu**.

## PR requirements

- tests for new behavior
- update docs for contract changes
- no product-private logic in core modules
- pass `scripts/safety-check.sh`
- pass `npm run gate`
- pass `npm run conformance:local`

## Design rule

If a feature depends on product-specific user/org/data schemas, expose an adapter interface instead of embedding product code.
