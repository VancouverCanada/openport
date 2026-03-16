# OpenPort Product Contracts

This package defines the shared request and response contracts used by `apps/api` and `apps/web`.

Scope:

- auth and session payloads
- workspace and RBAC payloads
- OpenPort admin bootstrap and integrations payloads
- AI chat session payloads
- product health payloads

It intentionally excludes protocol runtime internals, which remain in `@openport/core`.
