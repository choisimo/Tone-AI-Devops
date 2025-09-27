# Auth Service Product Requirements Document (PRD)

## 1. Overview
Provides authentication, session lifecycle management, and fine-grained authorization (RBAC + scoped permissions) for all platform services.

## 2. Problem Statement
A unified, hardened identity and permission layer is required to ensure consistent access control across emerging services (deployment, artifacts, magic canvas, feature flags, notifications). Without consolidation, duplication and security drift increase breach risk and operational overhead. Need scalable foundation for future enterprise features (SSO, audit, compliance) with minimal developer friction.

## 3. Goals & Non-Goals
### Goals
- MUST provide secure sign-in (email link / passwordless + OAuth providers) with session refresh.
- MUST expose consistent permission evaluation API with context (organization / project scopes).
- MUST support role hierarchy + explicit permission mapping per scope.
- SHOULD enable structured audit logging of key auth events.
- SHOULD provide caching strategy for frequent permission checks.
- MAY support optimistic authorization to reduce latency where safe.
- SHOULD prepare schema + interfaces for future MFA & SSO.

### Non-Goals
- Implementing full enterprise SSO federation (future phase).
- Advanced anomaly / threat detection heuristics (placeholder metrics only).
- Complex ABAC or policy engine beyond role + permission mapping in initial version.

## 4. Core Use Cases
1. User authenticates via email magic link and receives session tokens.
2. Frontend queries current session and auto-refreshes prior to expiry.
3. Service checks if user can trigger a deployment in project scope.
4. Admin grants maintainer role to user for a project.
5. System logs permission check decisions for audit.
6. Background job validates session freshness for long-lived operations.
7. UI conditionally renders actions based on cached permission resolution.

## 5. Users & Personas
- End Users (developers / creators) – sign in & interact with projects.
- Project / Org Owners – manage roles & membership.
- Internal Services (Deployment, Artifact, Feature Flags, Magic Canvas, Notification) – call authorization checks.
- Audit / Compliance Reviewers – consume event logs.
- Platform Operations – monitor auth health metrics.

## 6. Functional Requirements
- MUST: Sign-in flows (email link, OAuth: Google, GitHub, GitLab) returning session.
- MUST: Sign-out invalidating refresh context.
- MUST: Retrieve current session & user profile.
- MUST: Refresh session automatically before expiry threshold.
- MUST: Assign roles at organization or project scope; multiple roles allowed.
- MUST: Permission evaluation `hasPermission(resource, action, context)` returning boolean + error codes.
- MUST: Enforce row-level restriction on role visibility (user sees own roles).
- SHOULD: Batch permission checks for UI efficiency.
- SHOULD: Permission caching with invalidation on role change.
- SHOULD: Audit event emission (sign_in, sign_out, permission_check, role_change).
- MAY: Optimistic permission prediction with background verification.
- SHOULD: Expose metrics (signInAttempts, successes, failures, permissionChecks, sessionRefreshes).
- MUST: Standard error taxonomy.

## 7. Non-Functional Requirements
- Performance: Average permission check < 25ms p95 under normal load with cache warm; < 60ms cold.
- Availability: 99.9% for auth API endpoints (excluding 3rd party outages).
- Security: All tokens stored securely; minimal scopes; enforce RLS.
- Privacy: Store only essential user profile fields; avoid logging PII beyond necessary context.
- Observability: Metrics + structured logs + trace spans for sign-in and permission evaluation.
- Scalability: Support 50k MAU initial; design to scale to 10x with horizontal stateless components and scalable DB indexes.
- Cost: Caching reduces DB role lookups by ≥70%.

## 8. Domain Model
Key entities: User, Session, Role, Permission, UserRole mapping, AuthContext. (See existing type definitions in service spec.) Relationships: User 1..* UserRole -> Role; Role has permission list; permissions evaluated with optional project/org context.

## 9. APIs & Interactions
### External API Surface
Methods: signInWithEmail, signInWithProvider, signOut, getSession, refreshSession, getUserRoles, hasPermission, getCurrentUser, updateUserProfile.
(Reference: docs/services/auth-service.md API Contract.)

### Events / Messaging (logical)
- auth.sign_in
- auth.sign_out
- auth.permission_check (maybe sampled)
- auth.role_change

### Dependencies
- Supabase Auth (identity backend) – credential + token issuance.
- Postgres (role & permission tables + RLS policies).
- Caching layer (in-memory per instance; future: Redis for distributed cache invalidation).
- Audit/Analytics service (future consumer of emitted events).

## 10. Data Storage & Lifecycle
- Postgres tables: roles, user_roles.
- Retention: Role assignment history retained indefinitely (for audit) — may later archive to cold storage after 18 months.
- Session data primarily managed by Supabase; local cache ephemeral in memory.
- Cleanup: Expire stale sessions via Supabase policies; purge orphaned role entries on user deletion cascade.

## 11. Security & Compliance
- Threats: Token theft, privilege escalation, stale role cache, excessive permission exposure.
- Mitigations: Short access token TTL (1h), refresh rotation, scope-aware queries with RLS, permission caching keyed by context + invalidated on role change, structured audit trail.
- Data Classification: User email = PII (restricted); roles = internal.
- Future: MFA, SSO federation, anomaly detection pipeline.

## 12. Error Model & Resilience
Error codes (subset): invalid-credentials, user-not-found, email-not-verified, session-expired, insufficient-permissions, rate-limited.
- Retry: Sign-in not retried automatically. Permission checks retried once on transient backend/network failure.
- Idempotency: Role assignment operations guarded by unique constraints (user, role, scope entity) to avoid duplicates.
- Fallback: On cache corruption, clear entry and re-fetch.

## 13. Performance & Capacity Planning
- Baseline: 5 permission checks/user action; estimate 20 checks/min active user.
- Capacity triggers: If p95 permission check latency > 60ms for 5 min, scale out or enable Redis cache.
- Project roles index strategy: Composite indexes (user_id, project_id) & (project_id) for list views.

## 14. Observability Plan
Metrics: signInAttempts, signInSuccesses, signInFailures{error_code}, sessionRefreshes, permissionChecks{result}.
Logs: Structured JSON for auth events with correlation/session ID.
Tracing: Spans: signIn, permissionCheck (attributes: resource, action, result, cacheHit:boolean).
Dashboards: Auth health, error rate, permission latency, role change frequency.

## 15. Operational Runbook Summary
Health Checks: /health (DB + Supabase token exchange test optional).
Common Failures: Elevated invalid-credentials (phishing / spam), permission cache stampede, Supabase outage.
Escalation Signals: Spike in auth.rate_limited, sustained signInFailures > threshold, latency degradation.

## 16. Risks & Mitigations
- External Auth dependency outage → Mitigation: Graceful degraded mode for session validation using cached tokens until expiry.
- Role cache inconsistency → Emit role_change event to trigger cache bust.
- Overly coarse permissions → Early design review & incremental permission taxonomy expansion.
- Audit log growth → Partition logs by month & lifecycle policy.

## 17. Rollout & Migration Strategy
Phase 1: Implement core sign-in + role tables.
Phase 2: Integrate permission checks into dependent services behind feature flag.
Phase 3: Add audit logging & metrics instrumentation.
Phase 4: Introduce MFA & additional providers.
Migration: Backfill existing user roles using script; map legacy access rules to roles.

## 18. Open Questions
- Do we require global vs. organization-scoped roles distinction now?
- Should permission_check events be fully logged or sampled?
- Need standardized correlation ID propagation across services?

## 19. Change Control
Updates proposed via PR referencing this file; reviewed by platform lead + security stakeholder; version tag updated in header on substantial changes.

---
Version: 1.0 (Initial Draft)