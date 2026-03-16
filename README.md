# OpenPort

OpenPort Protocol (OPP; short: OpenPort) is an open standard and reference toolkit for exposing web application data and actions to LLM agents without browser scraping.

OpenPort is repository-isolated and does not require any direct connection to private product codebases.

## Why this project

Modern AI tools (LLM apps, automation agents, OpenClaw-style runtimes) need a stable machine interface:

- discoverable tools (`manifest`)
- strict access control (`scope + policy`)
- safe write path (`draft -> human approval -> execute`)
- optional state preconditions (`stateWitnessHash`) for TOCTOU-resistant execution
- complete auditability

OpenPort Protocol provides these primitives so product teams can add AI access safely.

## Project Stewardship

OpenPort is stewarded by **Accentrust** and the OpenPort authors (**Genliang Zhu**, **Chu Wang**, **Ziyuan Wang**, **Zhida Li**).

Stewardship principles:

- security-first defaults over convenience-first defaults
- auditable operations over implicit side effects
- reusable standards over product-specific shortcuts

## What is included

- API contract draft for `agent/v1`
- security and threat-model baseline
- extraction strategy from product codebases to open-source modules
- policy and manifest templates
- release gates to prevent secret leakage

## What is NOT included

- your internal user/account schema
- your private business rules
- production credentials or private infra details

## Recommended name

Project name: **OpenPort Protocol** (short: **OpenPort**)

Repository slug: **openport**

Rationale: clear intent (open interface + data/action port), short, and broad enough for multi-product adoption.

## Documents

- docs/01-vision-and-scope.md
- docs/02-extraction-boundary.md
- docs/03-architecture.md
- docs/04-security-threat-model.md
- docs/05-migration-plan.md
- docs/06-release-gate.md
- docs/07-implementation-blueprint.md
- docs/08-v0.1.0-release-checklist.md
- docs/09-tag-and-release-strategy.md
- docs/10-public-adapter-template.md
- docs/11-security-hardening.md
- docs/12-llm-openclaw-integration.md
- docs/13-openport-mcp-profile.md
- docs/14-openport-productization-plan.md
- docs/15-openport-productization-progress.md
- docs/16-openport-core-extraction-map.md
- docs/17-openport-runtime-validation.md
- docs/18-openport-validation-failure-guide.md
- docs/19-openport-app-acceptance-checklist.md
- docs/20-openport-oss-vs-cloud-edition-plan.md
- docs/releases/v0.1.0.md
- conformance/README.md
- ROADMAP.md
- SUPPORT.md
- spec/openport-v1.openapi.yaml
- CHANGELOG.md
- AUTHORS.md

## Product Apps

- `packages/openport-product-contracts`: shared auth/workspace/admin/chat response contracts
- `packages/openport-core`: protocol core and runtime primitives
- `apps/api`: product API shell for auth, workspaces, admin, and AI
- `apps/web`: Next.js frontend shell for auth, dashboard, integrations, and chat
- `apps/reference-server`: standalone reference runtime target

## Quick start (governance-first)

1. Read `docs/02-extraction-boundary.md` and classify every candidate module as `OPEN`, `ADAPTER`, or `PRIVATE`.
2. Apply `docs/06-release-gate.md` before every public push.
3. Publish only schema/contracts and replace all tenant/auth/audit implementations with adapter interfaces.

## Reference runtime

This repository now includes a runnable reference runtime under `src/`:

- tool manifest discovery
- policy and scope checks
- draft-first action pipeline
- high-risk preflight + idempotency controls
- optional State Witness / Preconditions profile for execute-time revalidation
- in-memory audit sink
- in-memory domain adapter (ledgers/transactions)

### Run locally

```bash
npm install
npm run dev
```

The server starts on `http://127.0.0.1:8080`.

Startup logs print a bootstrap agent token created for the demo integration.

### Adapter mode

Default mode is in-memory.  
To run the domain adapter against Postgres:

```bash
OPENPORT_DOMAIN_ADAPTER=postgres OPENPORT_DATABASE_URL='postgres://user:pass@host:5432/db' npm run dev
```

The Postgres adapter expects `ledgers` and `transactions` tables with fields used by `src/adapters/postgres-domain-adapter.ts`.

For product embedding with an existing Prisma client, use Prisma adapter mode:

```ts
import { createOpenPortRuntime } from 'openport'
import { prisma } from './prisma-client'

const runtime = createOpenPortRuntime({
  domainAdapter: 'prisma',
  prismaClient: prisma as any
})
```

Prisma mode is intended for library embedding, not the standalone demo server.

### Main endpoints

- `GET /api/agent/v1/manifest`
- `GET /api/agent/v1/ledgers`
- `GET /api/agent/v1/transactions`
- `POST /api/agent/v1/preflight`
- `POST /api/agent/v1/actions`
- `GET /api/agent/v1/drafts/:id`
- `GET /api/agent-admin/v1/apps` (requires `x-admin-user`)

### Test and build

```bash
npm run build
npm test
npm run gate
npm run conformance:local
```

Contract checks include OpenAPI validation and route coverage against `spec/openport-v1.openapi.yaml`.

## Multi-app Dev

Root scripts now expose the product shells:

```bash
npm run dev:reference
npm run dev:api
npm run dev:web
npm run start:product
npm run status:product
npm run stop:product
```

Install helpers also exist:

```bash
npm run env:product
npm run install:contracts
npm run install:product
```

Build scripts are also available:

```bash
npm run build:contracts
npm run build:reference
npm run build:api
npm run build:web
```

These product apps target Node 20+ and are not validated in the current local environment if the machine is still on Node 14.

A product preflight entry now exists:

```bash
npm run preflight:product
```

Acceptance runners now exist:

```bash
npm run acceptance:local
npm run acceptance:apps
npm run acceptance:images
npm run acceptance:services
npm run acceptance:full
npm run acceptance:compose
```

Health probe helpers now exist:

```bash
npm run health:reference
npm run health:api
npm run health:web
npm run health:product
```

Compose helpers now exist:

```bash
npm run docker:preflight
npm run compose:config
npm run compose:build
npm run compose:up
npm run compose:down
```

Current validated Docker Compose endpoints:

```text
reference-server: http://127.0.0.1:8080
api:              http://127.0.0.1:4100/api
web:              http://127.0.0.1:3100
```

Validated Docker acceptance commands:

```bash
npm run acceptance:images
npm run acceptance:compose
```

Managed product stack:

```bash
npm run start:product
npm run status:product
npm run health:product
npm run stop:product
```

`start:product` will:

- auto-select a free `reference` port near `8080`
- auto-select a free `api` port near `4000/4100`
- auto-select a free `web` port near `3000/3100`
- avoid conflicts with already-running services such as `Figena-Web`
- write runtime metadata to `.openport-product/runtime.json`

## Docker Skeleton

An initial Docker/Compose skeleton now exists:

- `.env.example`
- `compose/docker-compose.yml`
- `docker/reference-server.Dockerfile`
- `docker/api.Dockerfile`
- `docker/web.Dockerfile`

Planned startup path:

```bash
npm run env:product
npm run compose:up
```

This is a productization scaffold and has not yet been validated end-to-end in the current environment.

`compose/docker-compose.yml` expects the real root `.env` file. It does not read `.env.example` directly.

Compose startup is now health-gated:

- `postgres` waits on `pg_isready`
- `api` and `reference-server` wait on healthy Postgres
- `web` waits on healthy API

Health endpoints currently planned for container/runtime checks:

- `GET /healthz` for the reference runtime
- `GET /api/health` for the product API
- `GET /api/health` for the web app

Full runtime validation guidance lives in `docs/17-openport-runtime-validation.md`.
Failure handling guidance lives in `docs/18-openport-validation-failure-guide.md`.
Acceptance command matrix lives in `docs/19-openport-app-acceptance-checklist.md`.

GitHub Actions now also includes a Node 20 product validation workflow:

- `.github/workflows/product-validation.yml`
- `.github/workflows/compose-build-validation.yml`

## Public adapter template

Public repository template for custom adapters:

- `templates/openport-adapter-public-template`

## Release helper

Prepare a release candidate with gate checks and exact release commands:

```bash
npm run release:prepare -- v0.1.0
```

## License

OpenPort OSS is licensed under `AGPL-3.0-or-later` (see `LICENSE`).

For name and logo usage, see `TRADEMARK_POLICY.md`.
