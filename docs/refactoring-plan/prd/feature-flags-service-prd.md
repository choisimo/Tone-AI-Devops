# Feature Flags Service Product Requirements Document (PRD)

## 1. Overview
Delivers dynamic, low-latency evaluation of configuration and feature flags (boolean, multivariate, percentage rollout, segment targeted) enabling progressive delivery, experimentation, and operational killswitches.

## 2. Problem Statement
Feature gating & configuration toggles are currently hardcoded or environment-variable based, requiring redeploys for changes and offering no gradual rollout or segmentation. This delays experimentation, complicates safe migrations (e.g., shadow reads, dual writes), and increases risk of broad failures. A centralized flag service provides real-time control, targeted rollout, auditability, and integration with deployment & observability pipelines.

## 3. Goals & Non-Goals
### Goals
- MUST support flag types: boolean, percentage rollout, multivariate (string/number), JSON config blobs (size capped).
- MUST provide segments (user attributes, project attributes) + rule evaluation.
- MUST deliver evaluation latency < 20ms p95 server-side (cache warm).
- MUST expose SDK / HTTP evaluation API with consistent semantics & reason codes.
- MUST support targeting strategies: percentage (stable hashing), allowlist, denylist, attribute rules.
- MUST provide audit log of changes & publish flag change events.
- SHOULD support scheduled rollout + automatic progressive increase.
- SHOULD support prerequisite flags (dependency graph) with cycle detection.
- SHOULD enable client-side bootstrap via signed snapshot to reduce round trips.
- MAY integrate experimentation metrics hooks (exposure event emission) for future analytics.
- MAY support killswitch categories (immediate global disable action).

### Non-Goals
- Full statistical experiment analysis (delegated to analytics later).
- Real-time streaming of evaluation results per request (only events on changes).
- Client-managed dynamic rule scripting (only declarative config DSL allowed).

## 4. Core Use Cases
1. Gradual rollout of new deployment algorithm to 5% → 25% → 100% automatically.
2. Shadow read flag controlling dual DB reads during migration.
3. Emergency killswitch disabling heavy background job.
4. Targeted enablement of Magic Canvas GPU feature for beta cohort.
5. Multivariate variant selection for UI layout test (A/B/C proportions).
6. Project-level config JSON consumed by service at runtime without redeploy.

## 5. Users & Personas
- Developers / Maintainers – create & manage flags, schedule rollouts.
- Release Engineers – coordinate progressive delivery in conjunction with Deployment Service.
- Internal Services – evaluate flags for logic branches.
- Product / Experimentation Team – consume variant exposure events.
- SRE / Ops – trigger killswitch for incident mitigation.

## 6. Functional Requirements
- MUST: createFlag(key, type, defaultValue, rules[], description, tags[], prerequisites?).
- MUST: updateFlag (atomic patch with version increment & audit entry).
- MUST: archiveFlag (no evaluation allowed), restoreFlag.
- MUST: evaluate (context attributes map) returning value + reason (default, rule, percentage, prerequisite_failed, off).
- MUST: percentage rollout stable hashing by userId/projectId fallback.
- MUST: segment definitions (attribute conditions: equals, in, regex, numeric range) reused in rules.
- MUST: listFlags(filter by tag, state, key prefix), getFlag, searchFlags.
- MUST: events: flag.created, flag.updated, flag.archived, flag.rollout_scheduled, flag.rollout_progress.
- MUST: audit log with who, before/after diff, timestamp.
- SHOULD: scheduleRollout(flag, plan steps time-based or metric gated placeholder) + automatic progression.
- SHOULD: bulk export snapshot & versioned ETag for caching.
- SHOULD: evaluation SDKs (server TS firstly) with local LRU + periodic sync.
- SHOULD: prerequisite evaluation short-circuit reason if unmet.
- MAY: killswitch categories & global disable endpoints (secured).
- MAY: variant exposure event emission for analytics (flag.exposure).

## 7. Non-Functional Requirements
- Performance: evaluation < 20ms p95; < 5ms warm local cache.
- Availability: 99.95% read API (cacheable snapshot fallback).
- Scalability: 10k flags, 500 evals/sec initial; design to 10x with horizontal stateless.
- Security: AuthZ (feature_flag:manage/evaluate); write operations audited.
- Consistency: Strong consistency for write → subsequent read (within same region); snapshot eventually consistent (seconds) acceptable.
- Observability: Metrics for evaluations count, latency, rule distribution, cache hit.
- Cost: Snapshot reduces direct evaluation calls by ≥40% for client integrated services.

## 8. Domain Model
Entities: Flag(id, key, type, state(active/archived), defaultValue, rules[], prerequisites[], tags[], version, createdAt, updatedAt).
Rule: conditions[], variant distribution (for multivariate) or boolean override.
Segment: id, name, conditions[]. RolloutPlan: steps[(percentage,targetTime)], currentStep.
AuditEntry(flagId, version, actor, diff, timestamp).

## 9. APIs & Interactions
### External API Surface
Methods: createFlag, updateFlag, archiveFlag, restoreFlag, getFlag, listFlags, searchFlags, evaluate, getSnapshot, scheduleRollout, getAuditLog, createSegment, updateSegment, listSegments.
(Reference: docs/services/feature-flags-service.md – to be authored.)

### Events / Messaging
- flag.created
- flag.updated
- flag.archived
- flag.rollout_scheduled
- flag.rollout_progress
- flag.exposure (optional future)

### Dependencies
- Auth Service (permissions + actor identity).
- Project Service (project context attributes, tags for targeting).
- Deployment Service (progressive delivery coordination).
- Notification Service (rollout step alerts, killswitch alerts).
- Audit/Analytics (consumes change & exposure events).

## 10. Data Storage & Lifecycle
- Postgres tables: flags, flag_rules (if normalized), segments, prerequisites, rollout_plans, audit_entries.
- Snapshot generation job publishes JSON (compressed) to object storage (S3) with ETag & version.
- Retention: Archived flags kept 12 months then purge (configurable).
- Cleanup: Remove stale rollout plans on completion; compress old audit diffs.

## 11. Security & Compliance
- Write actions require management roles; evaluation read limited to authorized services/users per project.
- Audit immutability via append-only log table; optional checksum chain.
- No sensitive PII stored in flag values; metadata sanitized.

## 12. Error Model & Resilience
Errors: validation_error (invalid rule), not_found, permission_denied, prerequisite_cycle, rollout_conflict.
- Retry: Evaluation is pure read (no retry unless transient datastore failure). Snapshot fetch uses standard HTTP caching & fallback to last good.
- Idempotency: updateFlag uses version check (optimistic concurrency) to prevent lost updates.

## 13. Performance & Capacity Planning
- Cache tiers: in-process LRU + optional Redis for snapshot invalidation.
- Scale triggers: evaluation latency p95 > target for 5m or CPU saturation >80% triggers scale.
- Snapshot size monitoring; warn if > 5MB (optimize rules or prune archived).

## 14. Observability Plan
Metrics: flagEvaluations, evaluationLatency, cacheHitRatio, activeFlagsCount, rolloutProgressCount, exposureEvents (future).
Logs: Change diffs, evaluation errors (sampled), rollout step transitions.
Tracing: Spans: flag.evaluate (attributes: key, reason, cacheHit), flag.update.
Dashboards: Evaluation latency distribution, cache hit, active vs archived, rollout status.

## 15. Operational Runbook Summary
Health: /health (DB + snapshot freshness timestamp).
Common Failures: Cache stampede after mass invalidation, rollout schedule drift, rule misconfiguration.
Mitigations: Staggered invalidation, dry-run rule validation, circuit flag to disable auto-progress.
Escalation: Latency spike or repeated prerequisite cycle detection anomalies.

## 16. Risks & Mitigations
- Rule complexity hurting latency → precompile rules & cache evaluation plan.
- Prerequisite cycles → graph detection on write.
- Overuse of JSON configs for heavy payloads → size limits & lint warnings.
- Mis-targeted rollout causing incident → require two-person approval for high-impact flags.

## 17. Rollout & Migration Strategy
Phase 1: Core boolean + percentage flags + evaluation API.
Phase 2: Multivariate + segments + snapshot.
Phase 3: Scheduled rollout + prerequisites.
Phase 4: JSON configs + advanced observability.
Phase 5: Exposure events & killswitch categories.
Migration: Replace env var toggles with flag lookups behind feature_flag use-case; dual path verify.

## 18. Open Questions
- Do we require multi-tenant segmentation early or after Phase 2?
- Use deterministic hashing algorithm (Murmur vs SHA-256 modulo) for percentage buckets?
- Should snapshot include archived flags (probably no)?

## 19. Change Control
PR review by platform lead + experimentation stakeholder; version bump on evaluation semantics change.

---
Version: 1.0 (Initial Draft)
