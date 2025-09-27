# Audit & Analytics Service Product Requirements Document (PRD)

## 1. Overview
Central event ingestion, normalization, storage, querying, and analytical aggregation layer for compliance-grade audit trails and product/operational analytics across all platform services.

## 2. Problem Statement
Each service currently emits logs/events in isolated formats, making it difficult to reconstruct user actions, prove compliance, monitor behavioral patterns, or derive platform KPIs. Lack of a unified, schema-governed event pipeline creates security blind spots and slows investigations. A consolidated Audit & Analytics service provides consistent event contracts, durable storage with query flexibility, privacy controls, and downstream transformation for metrics & insights.

## 3. Goals & Non-Goals
### Goals
- MUST define canonical event schemas (versioned) & validation.
- MUST ingest events (HTTP + queue) with at-least-once durability.
- MUST store raw immutable events + derived query-optimized tables.
- MUST support time & attribute filtered query API (paginated) for audit.
- MUST provide export (Parquet/CSV) for external analysis.
- SHOULD expose aggregation endpoints (counts, unique users, latency percentiles) on selected event types.
- SHOULD support PII field classification & selective redaction.
- SHOULD provide retention policies per category (hot vs archive tiers).
- SHOULD emit anomaly signals (e.g., auth failure spike) to Notification / Ops.
- MAY integrate with OpenTelemetry trace ID correlation for cross-layer reconstruction.
- MAY support derived metrics push to monitoring backend (CloudWatch / Prometheus).

### Non-Goals
- Full BI dashboarding (delegated to external tools consuming exports).
- Real-time complex stream processing (only basic anomaly detection initial).
- Machine learning behavioral analytics phase 1.

## 4. Core Use Cases
1. Security reviewer queries all permission_denied events for user over last 30 days.
2. Incident response reconstructs deployment events timeline with associated auth sessions.
3. Product team exports feature flag exposure events for A/B analysis.
4. Automated job archives events older than retention hot window.
5. Anomaly detector raises alert on sudden spike in failed logins.
6. Compliance audit produces immutable hash chain proof for event set.

## 5. Users & Personas
- Security / Compliance – audit queries & export evidence.
- SRE / Ops – investigate incidents & performance anomalies.
- Product / Data Analysts – derive usage metrics & funnels.
- Internal Services – emit events & occasionally query aggregated summaries.

## 6. Functional Requirements
- MUST: registerEventSchema(name, version, jsonSchema, category, piiFields?).
- MUST: ingestEvent(batch?) validating schema; store raw with ingestionId, timestamp.
- MUST: queryEvents(filter: time range, schema name(s), attributes partial match, actor) with pagination + sort.
- MUST: exportEvents(format, filter) async job with status endpoint.
- MUST: retention policy engine moves older events to archive tier (S3 / Glacier) & updates index.
- MUST: immutability guarantee (append-only) + optional hash chain per day partition.
- SHOULD: aggregatedMetrics endpoint (counts, group by fields, percentile on numeric fields w/ config).
- SHOULD: anomalyDetection (simple thresholds, rolling z-score) per configured metric.
- SHOULD: redaction pipeline for flagged PII fields (store hashed or masked variant) while preserving query utility.
- SHOULD: correlation linking: attach traceId/sessionId if present for cross-service lookup.
- MAY: event replay export to downstream systems.
- MAY: streaming sink to warehouse (e.g., Athena/Glue table auto-refresh) for federated query.

## 7. Non-Functional Requirements
- Performance: Ingest latency < 150ms p95 for single event; batch ingest amortizes overhead.
- Query: Return first page (<100 records) < 2s p95 for indexed filters within hot window.
- Availability: 99.9% ingest API; queries degrade gracefully if archive fetch required (longer latency acceptable).
- Scalability: 500 events/sec initial; design to 10k/sec (sharded partition + batch writes).
- Durability: >=11 9s for archived objects (S3 replication optional).
- Security: Signed service credentials; fine-grained query permission (event categories by role).
- Observability: Metrics for ingest rate, validation failures, backlog, query latency.
- Cost: Tiered storage keeps ≤30 days hot; older compressed; reduce hot storage by ≥70%.

## 8. Domain Model
Entities: Event(id, schemaName, schemaVersion, category, occurredAt, receivedAt, actorId?, projectId?, traceId?, sessionId?, attributes(jsonb), hash, previousHash?). EventSchema(name, version, jsonSchema, category, piiFields[], status). ExportJob(id, filterSpec, format, status, location?). AggregatedMetricConfig(id, schemaName, field, type, window, percentiles[]).

## 9. APIs & Interactions
### External API Surface
Methods: registerEventSchema, listEventSchemas, ingestEvent(s), queryEvents, exportEvents, getExportJob, getAggregatedMetrics, configureAggregatedMetric, listAggregatedMetrics.
(Reference: docs/services/audit-analytics-service.md – to be authored.)

### Events / Messaging
- audit.event_ingested (internal or for mirroring pipeline)
- audit.anomaly_detected
- audit.export_completed

### Dependencies
- Auth Service (permission enforcement: audit:query, audit:export, audit:schema_manage).
- Project Service (project context resolution & retention overrides).
- Notification Service (anomaly alerts, export completion notifications).
- Object Storage (raw & archived partitions + export staging).
- Compute (Athena/Presto or columnar DB) for analytical queries.

## 10. Data Storage & Lifecycle
- Hot Store: Postgres or columnar store for <30d partitioned by day.
- Archive: S3 partitioned by year/month/day/schemaName (Parquet) + Glue catalog.
- Hash Chain: daily sequential linking for tamper evidence; root hash stored separately.
- Retention: Category-specific (e.g., security 365d, operational 90d, analytics 180d) configurable.
- Export: Async job writes filtered dataset to S3 pre-signed URL with expiry.

## 11. Security & Compliance
- Access control: RBAC by category; export requires elevated permission.
- PII handling: fields in piiFields masked (e.g., email → hash+last2).
- Integrity: Hash chain & optional digital signing of daily manifest.
- Compliance: Provide audit evidence pack (schema registry + manifest) on request.

## 12. Error Model & Resilience
Errors: schema_not_found, validation_error, permission_denied, export_limit, archive_unavailable.
- Retry: Ingest retried on transient DB/object store errors with idempotent eventId.
- Backpressure: If hot store saturated, queue events to buffer (SQS/Kinesis) before persistence.
- Query fallback: If timeframe spans archive, stream from S3 + merge (longer latency flagged to client).

## 13. Performance & Capacity Planning
- Partition strategy: daily partitions; auto-vacuum & index maintenance schedule.
- Scale triggers: ingest backlog > 1 min or hot partition size > threshold early rotation.
- Export concurrency limits to prevent cost spikes.

## 14. Observability Plan
Metrics: ingestRate, ingestFailures{reason}, validationFailures, queryLatency, backlogDepth, anomalyCount, exportJobsRunning.
Logs: Schema registration, anomaly detection details, export completions.
Tracing: Spans: ingest.validate, ingest.persist, query.execute, export.run.
Dashboards: Ingest rate vs capacity, failure reasons, storage growth hot vs archive.

## 15. Operational Runbook Summary
Health: /health (DB + storage write test + queue depth).
Common Failures: Schema drift, archive lag, export job size explosion.
Mitigations: Strict schema versioning, archive re-ingest job, size guardrails with chunked export.
Escalation: Sustained ingestFailures > threshold or archive lag > 2 hours.

## 16. Risks & Mitigations
- Schema proliferation → governance & review guidelines + tagging.
- PII leakage → enforced field classification & automated scan.
- Cost overruns from large exports → export size estimation & quota.
- Hot store saturation → adaptive sampling for low-priority analytics events.

## 17. Rollout & Migration Strategy
Phase 1: Schema registry + basic ingest + query recent events.
Phase 2: Retention + archive + export.
Phase 3: Aggregations + anomaly detection.
Phase 4: Hash chain integrity + advanced redaction.
Phase 5: Metric push + trace correlation enhancements.
Migration: Wrap current ad-hoc logs with ingest client; dual log until confidence.

## 18. Open Questions
- Columnar DB choice (ClickHouse vs Athena-only) initial?
- Required minimum retention defaults per category?
- Do we hash chain across categories or per category?

## 19. Change Control
PR review by security + data governance; version increment on schema or retention semantic changes.

---
Version: 1.0 (Initial Draft)
