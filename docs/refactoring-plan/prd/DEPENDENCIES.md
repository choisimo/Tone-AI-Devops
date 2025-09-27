# Service Dependency Matrix (High-Level)

| Service | Depends On | Key Reasons |
|---------|------------|-------------|
| Auth | (External identity provider / DB) | Identity, tokens, permissions |
| Project | Auth | Membership & permission scope resolution |
| Artifact | Auth, Project, (Deployment optional) | Access control, project scoping, build artifact linkage |
| Deployment | Auth, Project, Artifact, Feature Flags (conditional), Notification, Audit | Permission checks, project context, artifact publish, gated rollout, status alerts, event ingestion |
| Feature Flags | Auth, Project, Notification (alert), Audit | Scoped evaluation, project attributes, change alerts, audit trail |
| Notification | Auth, User Profile, Project, Audit | Identity, personalization, scoping, delivery audit |
| Audit & Analytics | All services | Unified event ingestion |
| Magic Canvas | Auth, Project, Artifact, Feature Flags, Notification, Audit | Identity & quota, project scoping, output storage, controlled rollout, job status alerts, event logging |
| User Profile | Auth, Artifact (avatar) | Identity linkage, media storage |

## Event Flow Highlights
- Auth emits role/permission events → Audit; downstream cache invalidation consumers.
- Deployment emits lifecycle events → Notification (status), Audit, Feature Flags (exposure gating future).
- Artifact emits artifact.created / processed → Project usage counters, Audit.
- Feature Flags emits flag.updated / rollout events → Audit + Notification (optional) → Deployment gating.
- Magic Canvas emits job lifecycle → Audit, Notification (completion/quota), Project usage (future).
- User Profile emits preference.updated → Notification recalculates channel eligibility.

## Data Ownership Boundaries
- Identity & Roles: Auth (source of truth)
- Project Metadata & Quotas: Project
- Binary Assets & Variants: Artifact
- Deploy Lifecycle & Strategy: Deployment
- Dynamic Runtime Config: Feature Flags
- Communication Delivery & Templates: Notification
- Audit Trail & Aggregations: Audit & Analytics
- AI Generation Sessions & Outputs: Magic Canvas
- User Metadata & Preferences: User Profile

## Cross-Cutting Concerns Mapping
| Concern | Primary Owner | Supporting |
|---------|---------------|-----------|
| Permission Model | Auth | All consumers |
| Quotas | Project | Artifact, Deployment, Magic Canvas |
| Observability (metrics/logs/traces) | Each Service + Shared OTel Layer | Audit aggregates |
| Cost Allocation | Project (tagging) | Deployment, Artifact, Magic Canvas |
| Compliance / Audit | Audit & Analytics | Auth, Deployment |
| Secrets Management | Platform (infra layer) | All |

---
Version: 1.0 (Initial Draft)
