# Vision And Scope

## Stewardship

OpenMCP is stewarded by **Accentrust** and the OpenMCP authors (**Genliang Zhu**, **Chu Wang**, **Ziyuan Wang**, **Zhida Li**).

The project direction prioritizes operational safety, tenant isolation, and practical adoption across production web systems.

## Goal

Define a standardized AI access layer for web applications so agents can read data and perform controlled actions without web UI crawling.

## Scope

- API standard for agent-facing endpoints
- permission model (`scopes` + ABAC policies)
- draft-and-approval workflow for risky actions
- audit event schema and monitoring baseline
- adapter model for product-specific identity and domain services

## Non-goals

- replacing product identity systems
- exposing private DB schemas as-is
- forcing one runtime/framework

## Naming options

1. OpenMCP (recommended)
- Clear: "open access port" for data and actions
- Neutral: can cover finance, CRM, recruiting, etc.

2. OpenBridge
- Good metaphor, but less specific to API semantics

3. OpenGate
- Strong security connotation, but narrower branding

4. OpenAgentPort
- Very explicit, but longer and less brandable

5. OpenOpsAPI
- Strong ops meaning, but can be confused with internal SRE tooling

## Chosen direction

- Product name: `OpenMCP`
- First repository: `openmcp`
- Follow-up repos (optional):
  - `openmcp-nest`
  - `openmcp-examples`
