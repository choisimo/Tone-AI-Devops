# Service PRDs

This directory contains product requirements documents (PRDs) for platform backend + foundational services. These PRDs standardize intent, scope, and cross-cutting requirements beyond the lower-level service specs in `docs/services/`.

## Structure
- `PRD-TEMPLATE.md` – Canonical template (v1.0)
- `<service>-prd.md` – Individual service PRDs

## Completed Drafts
- `auth-service-prd.md`
- `artifact-service-prd.md`

## Pending (Scaffold Planned)
- deployment-service-prd.md
- project-service-prd.md
- notification-service-prd.md
- feature-flags-service-prd.md
- audit-analytics-service-prd.md
- magic-canvas-service-prd.md
- user-profile-service-prd.md

## Dependency Index (High-Level)
```
Auth Service: foundational identity & permission layer
Project Service: owns project metadata; depends on Auth
Artifact Service: depends on Auth + Project (context), optional Deployment
Deployment Service: depends on Auth, Project, Artifact (publishes build artifacts)
Feature Flags Service: depends on Auth, Project
Notification Service: depends on Auth, User Profile, Project
Magic Canvas Service: depends on Auth, Project, Artifact (media), Feature Flags (experiments)
User Profile Service: depends on Auth (identity linkage)
Audit & Analytics Service: consumes events from ALL other services (Auth, Deployment, Artifact, Feature Flags, Notification, Magic Canvas, Project, User Profile)
```

## Cross-Cutting Concerns (To Be Unified Later)
- Standard error taxonomy alignment
- Correlation / trace ID propagation guidelines
- Unified audit event schema
- Security hardening & secret rotation policies
- Observability baseline (metrics naming conventions)

## Change Control
Each PRD updated via PR referencing this directory. Template changes require approval from product + architecture leads.

---
Last Updated: Initial population