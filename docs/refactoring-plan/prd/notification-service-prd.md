# Notification Service Product Requirements Document (PRD)

## 1. Overview
Unified channel delivery layer for system & user-facing notifications (email, in-app, webhook; future: SMS/push) with templating, routing, preference management, and policy controls.

## 2. Problem Statement
Event-driven notifications are currently embedded ad-hoc in services (deployment, artifact) leading to duplicated integration logic, inconsistent formatting, lack of user channel preferences, and difficulty auditing or throttling. Need a centralized service to abstract channel providers, enforce rate & policy limits, manage templates, and record delivery outcomes for compliance & analytics.

## 3. Goals & Non-Goals
### Goals
- MUST support email + in-app feed + webhook delivery initial.
- MUST manage notification templates (versioned) with variable substitution & preview.
- MUST store user/channel preferences & mute states (per type / project scope).
- MUST provide idempotent dispatch API referencing logical notification type.
- MUST record delivery status (queued, sent, failed) & expose query.
- SHOULD support batching & digest (time window aggregation) for noisy types.
- SHOULD provide rate limiting (per user + per project + global) with policy config.
- SHOULD emit events for notification.sent, notification.failed, preference.updated.
- MAY support channel fallback (webhook failure → email) based on rules.
- MAY integrate basic A/B template variant selection.

### Non-Goals
- Full marketing campaign features (segmentation, bulk campaigns) initial.
- Complex ML send-time optimization.
- Real-time push (mobile) initial (placeholder design only).

## 4. Core Use Cases
1. Deployment succeeded event triggers templated email + in-app entry.
2. User mutes deployment.success emails but keeps failure alerts.
3. Webhook subscriber receives project quota threshold event payload.
4. Digest groups multiple build success events into a single daily summary.
5. Admin previews and publishes updated template version.
6. System queries delivery log for audit investigation.

## 5. Users & Personas
- Developers / End Users – receive notifications; set preferences.
- Maintainers / Owners – configure project-level webhooks & defaults.
- Internal Services – request dispatch by logical type.
- Security / Compliance – audit delivery history.
- Observability / Ops – monitor send failure rates.

## 6. Functional Requirements
- MUST: registerTemplate(type, channel(s), body, variables[], samplePayload) → versioned.
- MUST: listTemplates, getTemplate(type, version?), diffTemplateVersions.
- MUST: sendNotification(type, contextPayload, targets?) resolving recipients.
- MUST: manage preferences: getPreferences(user), updatePreference(user, type, channel, state).
- MUST: deliver via email (SES) & webhook (signed HMAC) & create in-app feed record.
- MUST: store delivery record (id, type, user/project scope, channels attempted, status, timestamps, provider ids, error cause?).
- MUST: idempotency key prevents duplicate sends within window.
- SHOULD: rate limiting (token bucket) keyed by userId+type & projectId+type.
- SHOULD: batching/digest config (aggregation window per type) with digest send logic.
- SHOULD: webhook secret rotation & per-project delivery endpoint config.
- SHOULD: metrics emission (send count, failures, latency per channel).
- MAY: channel fallback rules defined per type.
- MAY: AB variant (A/B %) for optimizing templates with result tracking.

## 7. Non-Functional Requirements
- Performance: Dispatch enqueue < 60ms p95; webhook attempt < 300ms p95.
- Availability: 99.9% API; queue-based asynchronous resilience.
- Scalability: 2k notifications/min initial; design for 20k/min burst with horizontal workers.
- Security: Webhook payload signed; templates sanitized; least privilege provider creds.
- Observability: Metrics + structured logs + trace spans around provider calls.
- Cost: Batching/digest reduces noisy high-frequency sends by ≥25% for eligible types.

## 8. Domain Model
Entities: Template(type, version, channels[], body, variables[], published, createdAt). Preference(userId, type, channel, state). NotificationRecord(id, type, scope(projectId?), recipients[], channels[], status, timestamps, error?). DigestGroup(type, windowStart, windowEnd, aggregatedPayloadRef).

## 9. APIs & Interactions
### External API Surface
Methods: registerTemplate, listTemplates, getTemplate, sendNotification, sendBatch (internal), getDelivery(id), listDeliveries(filters), getPreferences, updatePreference, registerWebhook(projectId, endpoint, secret), rotateWebhookSecret, testWebhook.
(Reference: docs/services/notification-service.md – to be authored.)

### Events / Messaging
- notification.sent
- notification.failed
- notification.preference_updated
- notification.digest_emitted

### Dependencies
- SES (email provider) or alternative.
- Auth Service (resolve user identities & permissions: notification:manage, notification:read).
- Project Service (project scoping & webhooks config retrieval).
- Audit/Analytics Service (ingests delivery events).
- Feature Flags Service (experimentation with templates maybe).

## 10. Data Storage & Lifecycle
- Postgres tables: templates, template_versions, preferences, notification_records, webhook_endpoints, digests.
- Retention: Delivery records 12 months (archive older to cold storage).
- Digest windows: sliding or fixed intervals; aggregated payload stored compressed.
- Cleanup: Purge soft-deleted templates & expired digests after retention.

## 11. Security & Compliance
- Webhooks: HMAC SHA-256 signature header; timestamp + replay window validation.
- Templates sanitized (no raw script). Restrict variable interpolation to whitelist.
- Preferences honored strictly—service must not send muted types.
- PII: Limit stored email addresses; avoid sensitive content in logs.

## 12. Error Model & Resilience
Errors: validation_error, template_not_found, preference_conflict, rate_limited, provider_failure, webhook_timeout.
- Retries: Exponential for transient provider/webhook failures (max 5 attempts, jitter).
- Idempotency: idempotency-key header / body attribute recorded per (type, user, key).
- Fallback: If email provider outage & fallback rule enabled → queue alt channel.

## 13. Performance & Capacity Planning
- Queue depth monitor; scale workers when processing lag > 1 min.
- Email/Webhook timeout thresholds; circuit breaker for persistent failures.
- Capacity planning monthly; forecast growth from deployment volume correlation.

## 14. Observability Plan
Metrics: notificationsEnqueued, notificationsSent{channel}, notificationsFailed{channel,reason}, webhookLatency, digestCount, rateLimitThrottleCount.
Logs: Delivery attempts & failures with correlationId.
Tracing: Spans: send.resolveRecipients, send.renderTemplate, send.deliver(channel).
Dashboards: Send rate, failure %, latency distribution, top noisy types.

## 15. Operational Runbook Summary
Health: /health (DB + queue + provider token check optional).
Common Failures: Provider SES throttle, webhook 5xx, template variable mismatch.
Mitigations: Backoff & retry, disable problematic endpoint, template validation tests.
Escalation: Spike in failures >5% sustained or digest backlog > 2 windows.

## 16. Risks & Mitigations
- Preference bypass bugs → contract tests + integration gating.
- Webhook abuse (DDoS reflection) → outbound concurrency + timeout caps.
- Template injection → strict variable engine + escaping.
- Digest complexity delaying critical alerts → classification requiring immediate bypass.

## 17. Rollout & Migration Strategy
Phase 1: Email + in-app with basic templates.
Phase 2: Webhook + preferences.
Phase 3: Rate limiting + digest.
Phase 4: Fallback + A/B experimentation.
Migration: Wrap existing ad-hoc sends; gradually point services to Notification API.

## 18. Open Questions
- Use handlebars vs lightweight custom templating? Simplicity vs flexibility.
- Do we need multi-locale templating in early phase?
- Should digest configuration be user-configurable or admin-only initially?

## 19. Change Control
PR review by comms domain owner + platform lead; version increment on major template engine or API changes.

---
Version: 1.0 (Initial Draft)
