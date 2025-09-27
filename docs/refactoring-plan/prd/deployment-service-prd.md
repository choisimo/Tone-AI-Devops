# Deployment Service Product Requirements Document (PRD)

## 1. Overview
Orchestrates build, artifact publication, environment provisioning, and progressive delivery workflows (preview, staging, production) using declarative service manifests and automated policy enforcement.

## 2. Problem Statement
Current deployments are manually coordinated (scripts + ad‑hoc environment setup) causing inconsistency, limited auditability, slow recovery, and developer friction. Need a unified, policy‑driven deployment control plane to: (a) standardize build/release flows across microservices, (b) enable ephemeral preview environments, (c) support progressive delivery (canary / blue‑green), (d) integrate security & compliance checks early, and (e) expose transparent status + logs for fast feedback.

## 3. Goals & Non-Goals
### Goals
- MUST provide declarative `service.yaml` driven pipeline orchestration (build, test, scan, release).
- MUST support preview environment creation & teardown per PR within SLA (<6 min ready p95).
- MUST enable canary + blue/green + rolling strategies selectable per service.
- MUST integrate policy + quality gates (lint, unit, contract, SCA, IaC scan) before promotion.
- MUST emit deployment lifecycle events for audit & analytics.
- SHOULD support parallel environment readiness for dependent services (graph aware).
- SHOULD provide cost estimation + diff summary pre-apply for infra changes.
- SHOULD expose real-time streaming logs & step status to UI.
- MAY auto-generate baseline `service.yaml` via AI prompt.
- MAY support scheduled deployments (time windows / freeze exceptions).

### Non-Goals
- Full-fledged feature flag evaluation (delegated to Feature Flags Service).
- Complex ML-based deployment risk scoring initial phase.
- Cross‑region active/active traffic orchestration (future phase).

## 4. Core Use Cases
1. Developer opens PR → preview environment spins up with service + dependencies.
2. Pipeline runs build/test/scan → blocks on failing policy gate.
3. Maintainer triggers canary to 10% traffic → automatic metrics watch → promotes to 100%.
4. Rollback triggered automatically on SLO breach or manual command.
5. Infra drift detected → plan generated & surfaced before apply.
6. Deployment logs & trace context streamed to UI for troubleshooting.
7. Blue/green switch executed with zero-downtime health verification.

## 5. Users & Personas
- Developers – trigger & observe deployments, iterate via previews.
- Release Engineers / Maintainers – configure strategies, approve promotions.
- Platform / SRE – define policies, monitor reliability & capacity.
- Security / Compliance – review scan & SBOM outputs.
- Other Services – receive deployment events (Artifact, Notification, Audit).

## 6. Functional Requirements
- MUST: Parse & validate `service.yaml` (schema versioned) including build args, environments, strategy.
- MUST: Execute build stages (install, compile, test, bundle) with cache optimization.
- MUST: Integrate artifact upload (handoff to Artifact Service) & version tagging.
- MUST: Run quality gates: unit, contract tests, SAST, dependency scan, IaC scan (Terraform plan), license scan.
- MUST: Support deployment strategies: rolling, blue_green, canary(percent steps), immediate.
- MUST: Preview env lifecycle (create, reuse if unchanged, destroy on PR close/TTL).
- MUST: Rollback API & automatic rollback on defined failure signals.
- MUST: Emission of events: deployment.started, .succeeded, .failed, .rolled_back, .progress, .health_check.
- MUST: Store deployment metadata (commit, author, timestamps, target env, strategy, artifact refs, status).
- MUST: Provide status & logs streaming API.
- SHOULD: Provide diff summary (image tag changes, infra plan resource count & cost delta).
- SHOULD: Canary automated metric watch (error rate, latency p95, saturation) with thresholds.
- SHOULD: Policy engine (OPA/Rego or custom) for gating (e.g., required tests, coverage >= X%).
- SHOULD: SBOM generation + vulnerability summary attachment.
- MAY: ChatOps integration (slash command to trigger/promote/rollback).
- MAY: AI suggestion for failing step remediation hints.

## 7. Non-Functional Requirements
- Performance: Preview env p95 ready < 6 min; canary promotion decision loop < 2 min.
- Availability: Control plane API 99.9%; critical deployment operations retryable.
- Scalability: 200 concurrent pipelines initial; design to 1000 with horizontal runners.
- Reliability: Idempotent step execution; safe re-run from last successful stage.
- Security: Signed artifact references; principle of least privilege IAM; encrypted secrets.
- Observability: Full trace across stages; metrics per step; structured logs.
- Cost: Cache build layers & reuse preview infra to reduce compute >25% vs naive.

## 8. Domain Model
Entities: Deployment, Environment (preview/staging/prod), StrategyConfig, Step, ArtifactRef, PolicyGate, RollbackRecord. Relationships: Environment 1..* Deployment; Deployment 1..* Step; Deployment 0..* ArtifactRef; Deployment 0..* PolicyGateResult.

## 9. APIs & Interactions
### External API Surface
Methods: createDeployment, getDeployment, listDeployments, streamLogs, getStatus, promoteCanary, rollbackDeployment, getPreviewEnvironment, destroyPreviewEnvironment, validateServiceManifest, getDeploymentMetrics.
(Reference: docs/services/deployment-service.md – to be authored.)

### Events / Messaging
- deployment.started
- deployment.step_progress
- deployment.succeeded
- deployment.failed
- deployment.rolled_back
- deployment.canary_promoted
- deployment.health_check

### Dependencies
- Artifact Service (build outputs).
- Auth Service (permission checks: deployment:trigger, deployment:rollback).
- Feature Flags Service (conditional rollout gating).
- Notification Service (status change alerts).
- Audit/Analytics Service (consumes lifecycle events).
- Infrastructure (ECS/Lambda, Terraform execution backend, container registry).

## 10. Data Storage & Lifecycle
- Metadata DB: deployments, steps, environments, strategy_configs, policy_results.
- Retention: Core deployment records kept 12 months; compress/archive older.
- Log storage: Hot for 30 days then archived to cheaper tier (S3 Glacier) with index.
- Preview env TTL default 3 days (extendable) auto-destroy job.

## 11. Security & Compliance
- AuthZ: Role + permission mapping (deployment:trigger/manage/rollback).
- Secrets handling via AWS Secrets Manager / Parameter Store injection.
- Policy evidence (scan reports, SBOM) stored with restricted access.
- Least privilege runners (scoped IAM roles per environment).

## 12. Error Model & Resilience
Errors: validation_error, step_failed, artifact_upload_failed, policy_gate_failed, infra_plan_failed, timeout, permission_denied.
- Retries: Transient step failures (network, registry) exponential backoff (max 3).
- Idempotency: createDeployment with same commit+env returns existing pending if in progress.
- Rollback triggers on: health check fail, metric breach, manual command.

## 13. Performance & Capacity Planning
- Baseline: avg 8 steps/deployment; target median total < 10 min (non canary).
- Scale triggers: Runner queue wait > 2 min for 5m → scale out.
- Canary watch windows default 5m at each traffic increment.
- Resource reservations sized by historical CPU/mem metrics.

## 14. Observability Plan
Metrics: deploymentsStarted, deploymentsSucceeded, deploymentsFailed{reason}, stepDuration{step}, canaryAbortCount, rollbackCount, previewEnvProvisionTime, queueWaitTime.
Logs: Structured per step with correlationId; policy gate outcomes.
Tracing: Spans per step; nested spans for sub-activities (build.compile, tests.run, scan.sca).
Dashboards: Success rate, median + p95 duration, failure reasons, preview env latency.

## 15. Operational Runbook Summary
Health Checks: /health (DB + runner heartbeat + queue depth).
Common Failures: Registry auth issues, infra plan drift conflict, policy gate flakiness.
Mitigations: Re-run last successful stage, drift reconciliation job, quarantining flaky tests.
Escalation: Consecutive failures > threshold or queue backlog sustained.

## 16. Risks & Mitigations
- Preview env sprawl → TTL + reuse + cost dashboard.
- Canary false positives from noisy metrics → smoothing + multi-metric gating.
- Long tail build times → incremental caching + parallelization.
- Policy gate slowdown → asynchronous pre-fetch of scan results.
- Secret leakage in logs → pattern scrubber + redaction tests.

## 17. Rollout & Migration Strategy
Phase 1: Core pipeline + manual promotion.
Phase 2: Preview env + artifact integration.
Phase 3: Canary + blue/green strategies + metrics gating.
Phase 4: Policy engine + SBOM automation.
Phase 5: Optimization & AI manifest assist.
Migration: Wrap legacy deploy scripts; gradually shift services by manifest adoption.

## 18. Open Questions
- Use OPA vs custom lightweight policy DSL initially?
- Standardize health check contract for canary metrics ingestion?
- Should we auto-archive logs after 14d instead of 30d for cost?
- Multi-service coordinated deployment grouping needed early?

## 19. Change Control
PR-based edits; approval by platform lead + SRE; version increment on major scope changes.

---
Version: 1.0 (Initial Draft)
