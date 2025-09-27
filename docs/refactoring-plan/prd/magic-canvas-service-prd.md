# Magic Canvas Service Product Requirements Document (PRD)

## 1. Overview
AI-powered creative generation & editing service enabling users to produce, upscale, transform, and iterate on visual assets (images first; potential future video) with prompt-driven workflows and real-time preview feedback.

## 2. Problem Statement
Users currently lack integrated AI-assisted creation tools in the platform, forcing external tool usage, manual asset import, and inconsistent artifact management. Need a secure, scalable, cost-aware GPU / foundation model orchestration layer tightly integrated with artifact storage, permissions, and audit to accelerate creative workflows while controlling GPU spend and providing observability into model performance.

## 3. Goals & Non-Goals
### Goals
- MUST support text-to-image generation with model selection (Bedrock / open model) & base parameters (size, steps, guidance scale).
- MUST provide image-to-image transform (style transfer / variation) referencing existing artifact.
- MUST integrate with Artifact Service for storing outputs, variants, metadata.
- MUST track generation jobs state (queued, running, succeeded, failed, canceled).
- MUST enforce rate limits & quota per project/user to control spend.
- SHOULD support iterative session concept linking chained generations.
- SHOULD provide prompt & parameter history for reproducibility.
- SHOULD capture model usage metrics (latency, token/step count, failure rate) & cost estimates.
- SHOULD support safety filtering (NSFW / disallowed content classification) with reject reason codes.
- MAY enable upscaling & inpainting operations.
- MAY provide style presets / prompt templates.
- MAY support streaming partial progress updates (preview snapshots).

### Non-Goals
- Advanced video generation initial phase (future consideration).
- Fine-tuning custom models (out of scope early; may allow external model references later).
- Complex real-time collaborative editing (single-user sessions initial).

## 4. Core Use Cases
1. User submits prompt → image generated → artifact stored + thumbnail returned.
2. User selects existing image → variation generation with modified prompt.
3. Project enforces monthly GPU budget; generation blocked when exceeded.
4. Session shows chronological history & allows revert/regenerate with tweaks.
5. Safety filter rejects disallowed content; user sees sanitized error code.
6. Admin reviews generation metrics & cost per model to optimize defaults.

## 5. Users & Personas
- Creators / Designers – generate and iterate on assets.
- Developers – integrate outputs into deployment artifacts / UI assets.
- Project Owners – manage quotas, monitor usage.
- Platform Ops – observe GPU fleet utilization & cost.
- Compliance / Trust & Safety – review flagged content attempts.

## 6. Functional Requirements
- MUST: createGeneration(prompt, modelId, params{size,steps,guidance,seed?}, optional sourceImageId) returns jobId.
- MUST: getGeneration(jobId) & streamGeneration(jobId) (for status + partial preview if supported).
- MUST: listGenerations(projectId, filters: modelId, status, sessionId, date range).
- MUST: createSession(projectId) & appendGeneration(sessionId, jobId); getSession(sessionId) with history.
- MUST: cancelGeneration(jobId) if running & user authorized.
- MUST: integrate Artifact Service for storing final + variant images.
- MUST: enforce quota & rate limit (jobs per minute, monthly GPU units) prior to queue.
- MUST: events: magic.job_submitted, magic.job_started, magic.job_succeeded, magic.job_failed, magic.job_canceled, magic.quota_exceeded.
- SHOULD: safetyCheck(prompt, interimImage?) pre-generation; reject early with code.
- SHOULD: compute costEstimate (inferred from model + steps) & accumulate usage ledger.
- SHOULD: expose metrics endpoint for usage per model / latency.
- SHOULD: allow deterministic reproduction via seed parameter.
- MAY: upscaleImage(artifactId, factor) & inpaintImage(artifactId, mask, prompt).
- MAY: stylePreset library referencing curated prompt fragments.
- MAY: partialProgress events with low-res preview every N steps.

## 7. Non-Functional Requirements
- Performance: p95 generation latency (image) < target model baseline + 10% overhead; queue wait < 30s p95 under normal load.
- Availability: 99% control API; generation jobs may degrade gracefully on GPU scarcity (backoff + notice).
- Scalability: Initial 20 concurrent GPU jobs; design to scale to 200 via autoscaled ECS GPU / managed inference endpoints.
- Cost: Idle GPU reduction via scale-to-zero or burst capacity; target 60%+ average utilization.
- Observability: Per-job traces (submission → model inference → artifact store) + metrics (latency, failures, cost units).
- Security: AuthZ (magic:generate, magic:admin) & prompt content filtering; artifact access respects project scope.
- Privacy: Avoid logging full prompts if marked sensitive; hashed variant stored.

## 8. Domain Model
Entities: GenerationJob(id, projectId, sessionId?, modelId, status, prompt, params, sourceArtifactId?, resultArtifactId?, startedAt?, completedAt?, failureReason?, costUnits, seed?). Session(id, projectId, createdAt, lastActivityAt). Quota(projectId, monthlyUnitsLimit, usedUnits, resetAt). StylePreset(id, name, promptTemplate, tags[]).

## 9. APIs & Interactions
### External API Surface
Methods: createGeneration, getGeneration, streamGeneration, listGenerations, cancelGeneration, createSession, getSession, listSessions, applyStylePreset, listStylePresets, getQuota.
(Reference: docs/services/magic-canvas-service.md – to be authored.)

### Events / Messaging
- magic.job_submitted
- magic.job_started
- magic.job_succeeded
- magic.job_failed
- magic.job_canceled
- magic.quota_exceeded
- magic.partial_progress (optional future)

### Dependencies
- Artifact Service (store outputs & thumbnails).
- Auth Service (permissions & user identity).
- Project Service (project quotas & tagging context).
- Feature Flags (enable new models gradually).
- Notification Service (quota exceed alerts, job finished notifications optional).
- Audit/Analytics (ingest generation events).
- GPU Compute (ECS GPU tasks / Bedrock / external inference endpoint).
- Safety Filtering (moderation API / custom model).

## 10. Data Storage & Lifecycle
- Postgres tables: generation_jobs, sessions, quotas, style_presets, usage_ledger.
- Artifact references stored as foreign keys.
- Retention: Generation metadata 180 days (configurable); prune old failed jobs after 30 days.
- Quota reset monthly cron; ledger aggregated for reporting.

## 11. Security & Compliance
- Prompt content scanned; flagged categories blocked or logged with reduced retention.
- Access limited to project members; style presets modifiable by maintainers.
- PII: discourage inclusion in prompts; optional detection + masking.

## 12. Error Model & Resilience
Errors: validation_error, quota_exceeded, rate_limited, model_unavailable, safety_blocked, timeout, permission_denied.
- Retries: Transient model_unavailable retried (max 2) then failed.
- Cancellation cooperative; job marks canceled & GPU task aborted if supported.
- Fallback: If preferred model down, optional fallback model if feature flag enabled.

## 13. Performance & Capacity Planning
- Monitor queueDepth, gpuUtilization, avgJobLatency, costUnitsPerHour.
- Scale triggers: queue wait > 60s or utilization < 40% sustained (scale down) / >85% (scale up).
- Model variant benchmarking stored for baseline comparisons.

## 14. Observability Plan
Metrics: jobsSubmitted, jobsSucceeded, jobsFailed{reason}, jobsCanceled, generationLatency, queueWaitTime, quotaUsagePercent, safetyBlocksCount.
Logs: Structured job lifecycle entries; truncated prompt (hash) if sensitive flag.
Tracing: Spans: generation.queue, generation.inference, generation.storeArtifact.
Dashboards: Success rate, latency distribution, GPU utilization, cost units trend.

## 15. Operational Runbook Summary
Health: /health (DB + inference endpoint ping optional).
Common Failures: GPU capacity exhaustion, model version drift, safety false positives.
Mitigations: Autoscale policy tuning, version pinning, adjustable safety thresholds.
Escalation: Repeated model_unavailable or quota miscount anomalies.

## 16. Risks & Mitigations
- GPU cost runaway → strict quotas + predictive alerting at 70/85/100% usage.
- Safety filter over-blocking → review pipeline & feedback loop; allow override roles.
- Model drift changing output quality → pinned versions & periodic regression tests.
- Prompt injection leaking internal instructions (if using LLM for style assist) → sanitize & restrict system prompts.

## 17. Rollout & Migration Strategy
Phase 1: Core text-to-image + artifact storage + quotas.
Phase 2: Image-to-image + sessions + safety filter.
Phase 3: Upscale/inpaint + partial progress streaming.
Phase 4: Style presets + cost optimization.
Phase 5: Advanced optimization & multi-model AB testing.
Migration: None (net-new) aside from optional import of existing user images into sessions.

## 18. Open Questions
- Choose Bedrock model vs open-source baseline first? Cost vs flexibility.
- Need deterministic seed support across different model backends?
- Accept user-provided negative prompts initially?

## 19. Change Control
PR review by AI domain lead + platform architect; major changes increment version.

---
Version: 1.0 (Initial Draft)
