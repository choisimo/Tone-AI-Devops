# User Profile Service Product Requirements Document (PRD)

## 1. Overview
Manages canonical user profile data (display identity, preferences, settings, linkage to external identities) separate from authentication credentials, enabling consistent personalization & privacy controls across services.

## 2. Problem Statement
User-related attributes (display name, avatar, locale, notification settings fragments, external handles) are currently scattered between auth payloads and service-specific tables, leading to duplication, drift, and inconsistent privacy handling. A dedicated profile service centralizes non-credential user metadata, offering versioned updates, preference surfaces, and controlled PII classification while simplifying downstream projection.

## 3. Goals & Non-Goals
### Goals
- MUST store core profile fields: displayName, avatarRef, locale, timezone, bio(optional), createdAt, updatedAt.
- MUST manage extended preferences (key/value namespaced) with validation & size limits.
- MUST provide partial update (patch) with optimistic concurrency (version / etag).
- MUST emit events on profile.updated & preference.updated for subscribers (Notification, Feature Flags contexts).
- SHOULD support external identity links (github, gitlab, google) with verification state.
- SHOULD provide search (by displayName substring) limited & permissioned.
- SHOULD store privacy settings (e.g., profile visibility) & enforce.
- SHOULD integrate with Artifact Service for avatar storage.
- MAY support profile history (version snapshots) for audit.
- MAY support gravatar fallback generation.

### Non-Goals
- Authentication / credential management (delegated to Auth Service).
- Complex social graph features (followers, etc.).
- Analytics of user engagement (handled by Audit/Analytics).

## 4. Core Use Cases
1. User updates display name & avatar; events propagate to UI caches.
2. Service fetches locale/timezone for localized notifications.
3. Preference update toggles dark mode UI flag.
4. External identity (GitHub) linked for future code integration features.
5. Admin queries limited profile info for moderation action.

## 5. Users & Personas
- End Users – manage their profiles & preferences.
- Internal Services – read profile attributes (displayName, locale) for rendering or notification personalization.
- Notification Service – consume preference changes.
- Auth Service – reference profile for token enrichment (subset fields) via internal call.
- Moderation / Support – restricted access to necessary fields.

## 6. Functional Requirements
- MUST: getProfile(userId) returning allowed fields by viewer permission.
- MUST: updateProfile(userId, patch) with validation (lengths, allowed formats).
- MUST: getPreferences(userId, namespace?), updatePreference(userId, namespace, key, value), deletePreference.
- MUST: listProfiles(filter? limited to admin/authorized) with pagination.
- MUST: linkExternalIdentity(userId, provider, externalId, metadata) & unlink.
- MUST: events: profile.updated, profile.avatar_changed, preference.updated, identity.linked, identity.unlinked.
- SHOULD: searchProfiles(query substring) rate-limited.
- SHOULD: privacy controls (visibility: public, internal, private) respected in queries.
- SHOULD: avatar upload integration (store artifactRef) & validation (size, type).
- SHOULD: optimistic concurrency version check to prevent lost updates.
- MAY: profileHistory entries persisted on change for 30 days.
- MAY: batchGetProfiles(userIds) for performance.

## 7. Non-Functional Requirements
- Performance: getProfile < 25ms p95; batch (<=50) < 60ms.
- Availability: 99.9%.
- Scalability: 500k users initial design to 5M with indexing & pagination strategy.
- Security: Enforce user self-only write; admin scopes for broader read.
- Privacy: PII classification (email never stored here; only reference id to Auth service); minimal logging of personal fields.
- Observability: Metrics events for update counts & preference churn.
- Cost: Lean schema; avoid large preference blobs (limit value size, count).

## 8. Domain Model
UserProfile(userId PK, displayName, avatarArtifactId?, locale, timezone, bio, visibility, version, createdAt, updatedAt).
Preference(userId, namespace, key, value, updatedAt, PRIMARY KEY(userId, namespace, key)).
ExternalIdentity(userId, provider, externalId, verified, linkedAt, metadata JSON, PRIMARY KEY(userId, provider)).
ProfileHistory(id, userId, version, diff, createdAt) (optional).

## 9. APIs & Interactions
### External API Surface
Methods: getProfile, updateProfile, getPreferences, updatePreference, deletePreference, listProfiles, searchProfiles, linkExternalIdentity, unlinkExternalIdentity, batchGetProfiles (internal), getProfileHistory (optional).
(Reference: docs/services/user-profile-service.md – to be authored.)

### Events / Messaging
- profile.updated
- profile.avatar_changed
- preference.updated
- identity.linked
- identity.unlinked

### Dependencies
- Auth Service (identity & permission check: profile:read/write, preference:manage).
- Artifact Service (avatar image storage).
- Notification Service (preference changes → notification adjustments).
- Audit/Analytics (consumes profile & identity link events).

## 10. Data Storage & Lifecycle
- Postgres tables: user_profiles, preferences, external_identities, profile_history(optional).
- Retention: Profile persistent; history trimmed beyond 30d unless compliance hold.
- Cleanup: On user deletion (initiated by Auth), cascade or anonymize per policy.

## 11. Security & Compliance
- Access: user may update own profile; admin roles query broader.
- Data Minimization: Avoid storing emails; rely on Auth linking.
- Visibility rules enforced at query (public vs internal vs private fields hidden).
- Audit trail via events + optional history diffs.

## 12. Error Model & Resilience
Errors: validation_error, permission_denied, not_found, conflict(version mismatch), rate_limited.
- Retries: Client may retry on conflict with refreshed version.
- Idempotency: updatePreference overwrites same value; semantics documented.

## 13. Performance & Capacity Planning
- Indexes: user_profiles(userId), external_identities(userId, provider), preferences(userId, namespace).
- Growth monitoring: average preferences per user; alert if > threshold.
- Scale strategy: pagination & query optimization for search (GIN/trigram on displayName optional).

## 14. Observability Plan
Metrics: profileUpdates, preferenceUpdates, identityLinks, searchQueries, conflictErrors.
Logs: Structured change entries (diff hashed if sensitive) & access anomalies.
Tracing: Spans: profile.get, profile.update, preference.update.
Dashboards: Update rates, preference churn, conflict ratio, search latency.

## 15. Operational Runbook Summary
Health: /health (DB + replication lag optional).
Common Failures: Avatar upload mismatch, version conflicts spikes, preference misuse as large blob store.
Mitigations: Enforce size constraints, educate developers, add guardrails.
Escalation: Conflict error rate > threshold; abnormal surge in identity linking failures.

## 16. Risks & Mitigations
- Scope creep adding social features → explicit boundary doc.
- Preference misuse storing large JSON → size limit & reject.
- Privacy breach exposing private fields → strict field selection + tests.
- Race conditions on concurrent updates → optimistic concurrency + patch semantics.

## 17. Rollout & Migration Strategy
Phase 1: Core profile CRUD + events.
Phase 2: Preferences + external identities.
Phase 3: Search + visibility controls.
Phase 4: History + advanced observability metrics.
Migration: Import existing profile-like data from auth payload claims; map to profile table.

## 18. Open Questions
- Do we need locale fallback hierarchy now?
- Should external identity verification be synchronous or async (webhook)?
- Is profile history required Day 1 or can wait until Phase 4?

## 19. Change Control
PR review by platform lead + privacy stakeholder; version bump on schema or visibility rule change.

---
Version: 1.0 (Initial Draft)
