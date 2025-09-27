# Project Service Product Requirements Document (PRD)

## 1. Overview
Acts as the authoritative system of record for projects (and future organizations/workspaces), governing lifecycle, metadata, membership linkage, resource quotas, and cross-service correlation identifiers.

## 2. Problem Statement
Currently project-related context (naming, ownership, environment config) is scattered across ad-hoc tables or embedded in other services (auth roles, deployment configs). This fragmentation causes drift, ambiguous ownership, inconsistent quota enforcement, and difficulty aggregating analytics or applying policy. A dedicated Project Service centralizes lifecycle state, metadata, hierarchical scoping, and quota/policy surfaces enabling consistent governance and simplified integrations.

## 3. Goals & Non-Goals
### Goals
- MUST provide CRUD + lifecycle state transitions (active, archived, pending_delete) for projects.
- MUST manage memberships & roles linkage (integrating with Auth Service for permission evaluation).
- MUST expose project-scoped quotas (artifacts, deployments/day, feature flags, storage) & usage stats.
- MUST emit events on creation, update, archive, deletion request, deletion completion.
- SHOULD support soft-delete grace window before irreversible purge.
- SHOULD support tagging + arbitrary key/value metadata (validated size limit) for classification.
- SHOULD provide project search & filter (name, tags, owner, state) with pagination.
- MAY expose organization/workspace parent grouping (forward compatible schema).
- MAY provide cost attribution hooks per project (integration with billing later).

### Non-Goals
- Full billing/invoicing (future billing service domain).
- Deep analytics queries (delegated to Audit/Analytics service consuming events).
- Complex hierarchical multi-level org structures beyond one parent layer initial.

## 4. Core Use Cases
1. Developer creates new project with template reference & default environment settings.
2. Maintainer updates project metadata (description, tags) & adds collaborator.
3. System checks quota before allowing artifact upload or deployment initiation.
4. Project archived (read-only) after inactivity threshold; later restored.
5. Deletion requested → soft delete grace period → purge triggers cross-service cleanup.
6. UI lists user-accessible projects with filters (active only, tag filter).
7. Service resolves project details + quotas for deployment gating.

## 5. Users & Personas
- Developers / Creators – create & manage projects.
- Maintainers / Owners – manage membership, quotas, archival.
- Internal Services (Deployment, Artifact, Feature Flags, Magic Canvas) – read project context & quotas.
- Platform Ops – enforce policy, monitor usage saturation.
- Audit / Compliance – consume lifecycle events.

## 6. Functional Requirements
- MUST: createProject(name, visibility, templateId?, metadata?) enforcing naming rules.
- MUST: updateProject (description, tags, metadata with size & key constraints).
- MUST: archiveProject, restoreProject, requestDeletion, cancelDeletion, purgeProject (internal).
- MUST: listProjects(filter by owner membership, state, tag).
- MUST: getProjectById, getProjectsByIds(batch).
- MUST: manage membership: addMember(role), removeMember, listMembers.
- MUST: expose quota endpoints & usage snapshots (artifactsUsed, artifactQuota, deploymentsUsed/day, flagsUsed, storageBytesUsed).
- MUST: emit events: project.created, project.updated, project.archived, project.restored, project.deletion_requested, project.purged.
- MUST: integrate with Auth for permission checks (project:read, project:update, project:manage_members, project:delete).
- SHOULD: searchProjects(query substring over name, case insensitive).
- SHOULD: soft-delete grace window (configurable default 7 days) with countdown.
- SHOULD: lock project (read-only) during purge safety window.
- MAY: template application referencing stored templates (env defaults, starter flags).
- MAY: costAttributionTag generation.

## 7. Non-Functional Requirements
- Performance: getProject < 30ms p95, list (<=50) < 80ms p95.
- Availability: 99.9%.
- Scalability: 200k projects initial design to scale to 2M with proper indexing.
- Security: Enforce row-level ownership via permission integration.
- Reliability: Strong consistency for membership & quota counters (transactional updates).
- Observability: Metrics + structured events; trace spans for membership and quota ops.
- Cost: Efficient indexes; avoid heavy LIKE queries (use trigram/GIN for search optional).

## 8. Domain Model
Entities: Project(id, name, state, visibility, createdAt, updatedAt, archivedAt?, deletionRequestedAt?, metadata(jsonb), tags[]).
Membership: ProjectMember(userId, roles[] or role mapping). Quota: ProjectQuota(projectId, artifactLimit, storageBytesLimit, deploymentDailyLimit, featureFlagLimit, ...). Usage: ProjectUsage(projectId, artifactCount, storageBytes, deploymentsToday, featureFlagsCount, updatedAt).

## 9. APIs & Interactions
### External API Surface
Methods: createProject, updateProject, archiveProject, restoreProject, requestDeletion, cancelDeletion, purgeProject(internal), getProject, listProjects, searchProjects, addMember, removeMember, listMembers, getQuota, getUsage, refreshUsage (internal), batchGetProjects.
(Reference: docs/services/project-service.md – to be authored.)

### Events / Messaging
- project.created
- project.updated
- project.archived
- project.restored
- project.deletion_requested
- project.purged
- project.quota_threshold (emitted when usage crosses 80%, 90%, 100%)

### Dependencies
- Auth Service for permission & membership role resolution.
- Artifact / Deployment / Feature Flags services for usage feed (ingest to update counters).
- Notification Service for quota alerts.
- Audit/Analytics for lifecycle event ingestion.

## 10. Data Storage & Lifecycle
- Primary store: Postgres (projects, project_members, project_quota, project_usage, project_tags join or tags array).
- Retention: Project core records retained until purge completion; archived maintained indefinitely unless deleted.
- Soft delete window: metadata flag with scheduled purge job scanning daily.
- Usage update: incremental counters fed by event consumers (artifact.created, deployment.succeeded, featureflag.created...).

## 11. Security & Compliance
- AuthZ mediated by Auth Service; project visibility (private vs public-internal) enforced at query.
- PII minimal (only project names/metadata; avoid user PII in metadata keys/values).
- Audit events include actor, projectId, change summary.

## 12. Error Model & Resilience
Errors: validation_error (name conflict, invalid tag), not_found, permission_denied, quota_violation, state_conflict (e.g., archive while pending deletion).
- Retries: Idempotent create prevented by unique name constraint; external event consumption idempotent via delivery id tracking.
- Quota enforcement atomic in transaction with usage update.

## 13. Performance & Capacity Planning
- Index strategy: unique(name), index(state), GIN(tags), composite(ownerId,state) via membership view.
- Growth triggers: table bloat monitoring; partition events table monthly if needed.
- Capacity alarms when project count growth > forecast by 20% month-over-month.

## 14. Observability Plan
Metrics: projectsCreated, projectsArchived, projectsDeleted, quotaThresholdEvents{level}, usageUpdateLag, membershipChangeCount.
Logs: Structured change logs (diff fields) & quota violations.
Tracing: Spans: project.create, project.update, quota.update.
Dashboards: Active vs archived counts, quota saturation distribution, usage update lag.

## 15. Operational Runbook Summary
Health: /health (DB + replication lag check optional).
Common Failures: Usage update backlog, name collision spikes, quota misconfig.
Mitigations: Rebuild materialized usage view, adjust quotas via admin API, backfill job.
Escalation: Sustained usage update lag > 5m or quota threshold burst anomalies.

## 16. Risks & Mitigations
- Quota under/over enforcement → rigorous integration test + shadow counters.
- Event loss (usage undercount) → at-least-once processing + idempotent increments.
- Tag explosion → enforce max tags per project & length validation.
- Metadata abuse (large blobs) → size enforcement & validation.

## 17. Rollout & Migration Strategy
Phase 1: Core CRUD + membership + events.
Phase 2: Quotas + usage integration events.
Phase 3: Search + tags + threshold notifications.
Phase 4: Soft-delete + purge automation.
Phase 5: Org/workspace parent + cost attribution hook.
Migration: Backfill existing project records from legacy tables with mapping script.

## 18. Open Questions
- Hard vs soft name immutability after creation?
- Should usage counters be eventually consistent (queue) vs sync path? (initial hybrid?)
- Need project-level service template bundling (env var sets)?

## 19. Change Control
PR review by platform lead + data governance stakeholder; version bump on schema impacting changes.

---
Version: 1.0 (Initial Draft)
