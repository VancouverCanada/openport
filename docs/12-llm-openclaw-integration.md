# LLM And OpenClaw Integration Guide

Stewardship: **Accentrust** and **Genliang Zhu**.

This guide shows how to connect LLM tools and OpenClaw-style agents to OpenMCP without browser automation.

## Integration pattern

1. Obtain an OpenMCP agent token from admin flow.
2. Read `GET /api/agent/v1/manifest` to discover allowed tools.
3. Use read endpoints for retrieval workloads.
4. For write operations:
- run `POST /api/agent/v1/preflight` for high-risk actions
- call `POST /api/agent/v1/actions` to create draft or execute
- poll `GET /api/agent/v1/drafts/{id}` for status

## Minimal request sequence

### 1. Discover tools

```bash
curl -sS \
  -H "Authorization: Bearer $OPENMCP_AGENT_TOKEN" \
  "$OPENMCP_BASE_URL/api/agent/v1/manifest"
```

### 2. Read data

```bash
curl -sS \
  -H "Authorization: Bearer $OPENMCP_AGENT_TOKEN" \
  "$OPENMCP_BASE_URL/api/agent/v1/transactions?ledgerId=ledger_main"
```

### 3. Preflight high-risk action

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $OPENMCP_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"transaction.delete","payload":{"transactionId":"txn_1"}}' \
  "$OPENMCP_BASE_URL/api/agent/v1/preflight"
```

The response includes:

- `impactHash`: binds auto-execution to the evaluated impact.
- `preflightId`: a short-lived handle the client can reuse to avoid resending the payload.
- `stateWitnessHash` (if supported by the action): binds execution to the observed resource version/state.

### 4. Create action request

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $OPENMCP_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"transaction.create","payload":{"ledgerId":"ledger_main","kind":"expense","title":"AI run","amount_home":15,"currency_home":"USD","date":"2026-02-13T00:00:00.000Z"}}' \
  "$OPENMCP_BASE_URL/api/agent/v1/actions"
```

### 5. Execute using preflight handle (recommended for agent runtimes)

For high-risk auto-execute, do not regenerate payload after preflight. Either reuse the exact same payload bytes, or pass
the `preflightId` handle returned by `/preflight` so the server can reuse the cached payload and preflight hash.

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $OPENMCP_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"transaction.delete","preflightId":"pfl_...","execute":true,"justification":"cleanup old item","idempotencyKey":"idem-delete-1","preflightHash":"...","stateWitnessHash":"..."}' \
  "$OPENMCP_BASE_URL/api/agent/v1/actions"
```

## Agent-side recommendations

- cache manifest for short intervals and refresh on auth/policy errors
- keep idempotency keys stable per write intent
- treat `preflight` + `actions` as a single intent: do not generate a second payload after preflight
- when available, carry `stateWitnessHash` from preflight to execution and retry from a fresh preflight on `agent.precondition_failed`
- treat draft creation as non-final until explicit execution success
- surface policy denial codes directly to operator

## OpenClaw-style runtime mapping

- tool registration source: OpenMCP `manifest`
- tool invocation channel: OpenMCP HTTP endpoints
- confirmation workflow: OpenMCP draft + admin approval path
- audit trail source: OpenMCP audit events

## Safety requirements

- never embed long-lived agent tokens in prompts
- never allow model to bypass draft controls
- enforce per-integration scope minimization
