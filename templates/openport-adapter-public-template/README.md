# OpenPort Adapter Public Template

This template is a public-safe starter repository for building a custom OpenPort `DomainAdapter`.

Template stewardship: **Accentrust Inc.** and **Sebastian Zhu**.

## Design goals

- strict isolation from any product-internal codebase
- only implement OpenPort adapter interfaces
- no private schema, hostnames, credentials, or organization-specific logic

## What this template provides

- TypeScript package scaffold
- `HttpDomainAdapter` implementation skeleton
- `createHttpDomainAdapter` factory
- minimal test example with mocked `fetch`

## Quick start

```bash
npm install
npm run build
npm test
```

## Publish as a public repository

1. Copy this folder into a new repository.
2. Rename package and repository.
3. Replace endpoint mappings in `src/http-domain-adapter.ts`.
4. Keep all credentials outside git (environment variables or secret manager only).

## Adapter contract mapping

This template assumes your upstream service provides:

- `GET /ledgers`
- `GET /transactions`
- `POST /transactions`
- `PATCH /transactions/:id`
- `DELETE /transactions/:id?hard=...`
- `GET /transactions/:id`

Adjust these mappings to your own public-safe adapter backend.

## Security baseline

- do not log raw credentials
- do not commit `.env` files
- enforce least-privilege tokens on upstream APIs
- validate and sanitize outbound payloads before sending

## License

MIT
