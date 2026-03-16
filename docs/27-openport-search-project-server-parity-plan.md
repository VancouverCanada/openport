# OpenPort Search Project Server Parity Plan

## Scope

This document closes the remaining search parity gap after:

- [docs/26-openport-search-operators-history-parity-plan.md](/Users/Sebastian/Fidelock-Multiple-%20Platform/openport/docs/26-openport-search-operators-history-parity-plan.md)

The remaining gap was:

- `project:` existed in the search input and frontend parser
- but it was not yet a server-native search filter

This phase upgrades `project:` into a true backend search operator backed by persisted project data.

## Goal

Make `project:` behave like a real search filter across the full search stack:

- parse on the server
- resolve against persisted projects
- include descendant projects
- filter chat results before pagination
- remove redundant frontend-only project filtering

## Product Behavior

- `project:` applies to chats, not notes
- a matched project includes its whole subtree
- an unknown project token returns no project-scoped chat results
- the frontend still keeps local parsing only for:
  - autocomplete
  - result link context

The backend becomes the source of truth for result filtering.

## Implementation

### API

`GET /api/search` now resolves `project:` by:

1. parsing the token from `q`
2. loading persisted workspace projects
3. matching by normalized project name or exact project id
4. expanding to descendant project ids
5. filtering chats by `session.settings.projectId`

### Frontend

The search modal no longer re-filters `project:` results locally after the API returns.

The frontend still uses local project parsing for:

- operator suggestions
- attaching the selected project context to chat hrefs

## Acceptance Criteria

- `project:` returns only chats in the matched project subtree
- notes are excluded when `project:` is present
- unknown `project:` tokens return no matching chats
- frontend search results are not filtered a second time by stale local state
- Docker runtime and search endpoint both remain healthy

## Verification

- `npm run build:api`
- `npm run build:web`
- `npm run compose:up`
- create a project
- create a chat inside that project
- verify:
  - `GET /api/search?q=project:<name>`
  - `GET /api/search?q=project:<name>%20type:chat`
  - `GET /api/search?q=project:<name>%20type:note`
