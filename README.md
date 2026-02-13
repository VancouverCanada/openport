# OpenPort Core

OpenPort Core is an open standard + reference toolkit for exposing web-app data and actions to LLM agents without scraping web pages.

## Why this project

Modern AI tools (LLM apps, automation agents, OpenClaw-style runtimes) need a stable machine interface:

- discoverable tools (`manifest`)
- strict access control (`scope + policy`)
- safe write path (`draft -> human approval -> execute`)
- complete auditability

OpenPort Core provides these primitives so product teams can add AI access safely.

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

Project name: **OpenPort**

Repository slug: **openport-core**

Rationale: clear intent (open interface + data/action port), short, and broad enough for multi-product adoption.

## Documents

- docs/01-vision-and-scope.md
- docs/02-figena-extraction-boundary.md
- docs/03-architecture.md
- docs/04-security-threat-model.md
- docs/05-migration-plan.md
- docs/06-release-gate.md
- spec/openport-v1.openapi.yaml

## Quick start (governance-first)

1. Read `docs/02-figena-extraction-boundary.md` and classify every candidate module as `OPEN`, `ADAPTER`, or `PRIVATE`.
2. Apply `docs/06-release-gate.md` before every public push.
3. Publish only schema/contracts and replace all tenant/auth/audit implementations with adapter interfaces.

## License

MIT (see `LICENSE`).
