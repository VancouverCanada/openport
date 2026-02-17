# OpenPort Roadmap

Stewardship: **Accentrust Inc.** and **Sebastian Zhu**.

## 2026 H1 priorities

1. `v0.1.0` stabilization
- keep release gate and conformance profile green
- publish patch releases for critical security or contract defects

2. Protocol hardening
- expand conformance profiles (`core`, `security`, `admin`)
- document compatibility guarantees for `agent/v1`

3. Security hardening
- add abuse and fuzz regression suites
- formalize incident response runbook and key-rotation drills

4. Ecosystem adoption
- publish integration playbooks for LLM tools and automation runtimes
- add SDK examples for common stacks (without product-private code)

## 2026 H2 direction

1. `v1.0.0` readiness
- freeze core API semantics
- publish migration and deprecation policy

2. Optional extensions
- signed request mode for higher-trust environments
- pluggable audit sinks for SIEM pipelines

## Governance rules

- security and compatibility fixes take priority over feature additions
- any breaking change requires a major version plan and migration guide
