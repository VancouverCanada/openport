# LLM And OpenClaw Integration Guide

Stewardship: **Accentrust Inc.** and **Sebastian Zhu**.

This guide shows how to connect LLM tools and OpenClaw-style agents to OpenPort without browser automation.

## Integration pattern

1. Obtain an OpenPort agent token from admin flow.
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
  -H "Authorization: Bearer $OPENPORT_AGENT_TOKEN" \
  "$OPENPORT_BASE_URL/api/agent/v1/manifest"
```

### 2. Read data

```bash
curl -sS \
  -H "Authorization: Bearer $OPENPORT_AGENT_TOKEN" \
  "$OPENPORT_BASE_URL/api/agent/v1/transactions?ledgerId=ledger_main"
```

### 3. Preflight high-risk action

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $OPENPORT_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"transaction.delete","payload":{"transactionId":"txn_1"}}' \
  "$OPENPORT_BASE_URL/api/agent/v1/preflight"
```

### 4. Create action request

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $OPENPORT_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"transaction.create","payload":{"ledgerId":"ledger_main","kind":"expense","title":"AI run","amount_home":15,"currency_home":"USD","date":"2026-02-13T00:00:00.000Z"}}' \
  "$OPENPORT_BASE_URL/api/agent/v1/actions"
```

## Agent-side recommendations

- cache manifest for short intervals and refresh on auth/policy errors
- keep idempotency keys stable per write intent
- treat draft creation as non-final until explicit execution success
- surface policy denial codes directly to operator

## OpenClaw-style runtime mapping

- tool registration source: OpenPort `manifest`
- tool invocation channel: OpenPort HTTP endpoints
- confirmation workflow: OpenPort draft + admin approval path
- audit trail source: OpenPort audit events

## Safety requirements

- never embed long-lived agent tokens in prompts
- never allow model to bypass draft controls
- enforce per-integration scope minimization
