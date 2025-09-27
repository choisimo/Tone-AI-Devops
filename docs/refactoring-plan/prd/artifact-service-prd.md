# Artifact Service Product Requirements Document (PRD)

## 1. Overview
Provides secure, scalable storage, processing, and delivery of user and system-generated binary assets (build outputs, media, documents) with lifecycle and performance optimization.

## 2. Problem Statement
The platform needs a unified artifact and media layer to store deployment outputs, user uploads, and generated media. Ad-hoc storage leads to inconsistent access control, inefficient delivery, missing observability, and inability to optimize cost/performance (caching, deduplication, processing). A cohesive service must standardize upload flows, metadata management, and variant generation while supporting future advanced search, compliance, and quota enforcement.

## 3. Goals & Non-Goals
### Goals
- MUST support upload + retrieval for core artifact kinds (build-output, image, document, source-map, other binary).
- MUST generate signed & (optional) public URLs with expirations.
- MUST maintain metadata (size, checksum, mime, contextual relations: project, deployment).
- MUST support image variant generation & thumbnail pipeline (async) via post-processing.
- SHOULD support idempotent deduplication (checksum) to reduce storage use.
- SHOULD expose storage usage metrics per project.
- SHOULD emit events for artifact.created, artifact.processed, artifact.deleted.
- MAY support search & tag-based filtering initial subset.
- SHOULD provide cleanup of expired/temporary artifacts.

### Non-Goals
- Full video transcoding pipeline (placeholder only initial phase).
- Full-text document content indexing.
- Real-time collaborative file editing.

## 4. Core Use Cases
1. Deployment pipeline uploads build output bundle & source maps.
2. User uploads image for Magic Canvas session; service returns thumbnail + variants.
3. UI requests signed URL for private document.
4. Cleanup job purges expired temporary artifacts.
5. Project admin views storage usage & artifact counts.
6. Background task processes images into multiple responsive formats.

## 5. Users & Personas
- Internal Deployment Service (publishes build outputs).
- Magic Canvas & other creation tools (media ingestion + variant needs).
- Project Owners / Maintainers (inspect usage, manage deletions).
- End Users (indirect consumption via CDN URLs in UI).
- Observability / Ops (monitor storage cost & processing latency).

## 6. Functional Requirements
- MUST: `upload` single + multi; `uploadFromUrl` ingestion.
- MUST: Retrieve by id, deployment, and project with pagination & filters.
- MUST: Signed URL generation with TTL & optional access scope.
- MUST: Metadata storage (checksum, kind, size, mime, contextual IDs, status, variants info).
- MUST: Post-processing pipeline for thumbnails + configured image transformations.
- MUST: Status transitions: uploading → processing → ready | failed.
- SHOULD: Deduplication by checksum (return existing artifact if identical).
- SHOULD: Bulk delete & cleanup expired.
- SHOULD: Storage usage computation with breakdown per artifact kind.
- SHOULD: Event emissions (created, variant_generated, deleted, processing_failed).
- SHOULD: Tag-based filtering & list by tag.
- MAY: Basic search (filename, tag).

## 7. Non-Functional Requirements
- Performance: Upload initiation < 300ms overhead before streaming; signed URL generation < 50ms p95.
- Scalability: Support 10M stored objects initial phase; design to shard / bucket by project.
- Availability: 99.9% for control APIs; retrieval uses CDN > 99.95% effective.
- Durability: Rely on underlying object store (≥11 9s) + metadata in transactional DB.
- Security: Signed URLs default; public access explicit; access control integrated with Auth permission checks (e.g., artifact:read, artifact:delete).
- Cost Efficiency: Deduplication reduces duplicate binary storage by target ≥30% for large bundles/media.
- Observability: Metrics for upload success/failure, processing latency, storage growth.

## 8. Domain Model
Core entity: Artifact (id, ownership context, file attributes, processing state, urls, metadata). Relationships: Project 1..* Artifact; Deployment 1..* Artifact (optional); Artifact 1..* Variant (logical via variant records or metadata variants map). Refer to service spec for full TypeScript interfaces.

## 9. APIs & Interactions
### External API Surface
Key methods: upload, uploadMultiple, uploadFromUrl, get, getByDeployment, getByProject, getPublicUrl, getSignedUrl, getThumbnailUrl, processImage, generateThumbnail, update, delete, bulkDelete, search, listByTag, getStorageUsage, cleanupExpired.
(Reference: docs/services/artifact-service.md)

### Events / Messaging
- artifact.created
- artifact.variant_generated
- artifact.processing_failed
- artifact.deleted
- artifact.expired (cleanup)

### Dependencies
- Object Storage (Supabase / S3-compatible) for binary data.
- Postgres (artifact metadata, processing state, variant relations).
- CDN Provider (e.g., Cloudflare) for distribution & cache invalidation.
- Image Processing engine (Sharp / WASM) for transformations.
- Auth Service for permission checks.

## 10. Data Storage & Lifecycle
- Metadata persisted in DB; binary stored in object storage using structured keys: projects/{projectId}/timestamp-random-filename.
- Variants either separate artifact rows (linked) or variant map in metadata (decision: start with variant map, promote to rows if query complexity grows).
- Retention: Permanent unless marked temporary or expiresAt set.
- Cleanup job: Run hourly to remove expired; emit artifact.expired events.
- Checksum index to enable deduplication lookups.

## 11. Security & Compliance
- Access mediated by signed URLs; generation requires artifact:read permission.
- Write/delete operations require artifact:write or artifact:delete (scoped to project).
- Public artifacts explicitly flagged; default private.
- PII minimal—avoid embedding user PII in metadata keys.
- Integrity: SHA-256 checksum recorded; optional client-provided checksum verification future.

## 12. Error Model & Resilience
Key error categories: validation (unsupported type, size limit), storage-failure, processing-failed, not-found, unauthorized, rate-limited.
- Retry: Processing tasks retried with exponential backoff (max 3 attempts) on transient errors.
- Idempotency: Upload dedupe via checksum; optional idempotency key future.
- Partial Failures: Variant generation failures do not fail primary artifact (emit warning event).

## 13. Performance & Capacity Planning
- Expect skew: images + build outputs majority of volume.
- Monitoring thresholds: processing latency p95 > 5s triggers scale of processing workers.
- Storage growth alerting at 80% configured quota per project.
- CDN cache hit target ≥ 85% for public artifact variants.

## 14. Observability Plan
Metrics: uploadsStarted, uploadsCompleted, uploadsFailed{reason}, processingTime, storageUsed (gauge), variantCount.
Logs: Structured events for each state transition & processing outcome.
Tracing: Spans: upload.validate, upload.store, upload.postprocess, variant.generate.
Dashboards: Upload success rate, processing latency distribution, storage growth per project, top artifact kinds by size.

## 15. Operational Runbook Summary
Health Checks: /health (DB + storage write/read probe optional in extended check).
Common Failures: Storage provider latency, processing backlog, CDN invalidation failures.
Mitigations: Queue depth autoscaling, fallback to direct storage URL on CDN outage, dead-letter for failed processing tasks.

## 16. Risks & Mitigations
- Processing backlog growth → Worker autoscaling + queue depth alarms.
- Large file abuse / quota exhaustion → Enforce per-project size & rate limits; early rejection.
- Dedup complexity causing race → Use transaction + unique checksum constraint.
- CDN cache churn → Optimize cache-control headers & variant sizing policy.

## 17. Rollout & Migration Strategy
Phase 1: Core upload + retrieval + metadata.
Phase 2: Image variant & thumbnail pipeline.
Phase 3: Deduplication + usage metrics + search.
Phase 4: Advanced processing (video/document previews) + quotas.
Migration: Backfill existing uploaded assets into metadata schema with script.

## 18. Open Questions
- Store variants as separate rows vs. inline metadata map long term?
- Enforce per-user vs. per-project quotas first?
- Need asynchronous notification to client when variants ready?
- Should we pre-generate responsive image sets for all image uploads or on-demand?

## 19. Change Control
PR-based updates reviewed by storage domain owner + platform architect; version increment on material scope changes.

---
Version: 1.0 (Initial Draft)