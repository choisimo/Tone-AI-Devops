# Architecture Overview

## 🎯 System Architecture

The Tone AI DevOps platform follows a service-oriented architecture with loose coupling between components. Each service is responsible for a specific domain and communicates through well-defined contracts.

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)                │
├─────────────────────────────────────────────────────────────────┤
│  Features Layer                                                │
│  ├─ Dashboard        ├─ Deployments    ├─ Magic Canvas        │
│  ├─ Projects         ├─ Artifacts      ├─ User Profile       │
├─────────────────────────────────────────────────────────────────┤
│  Domain Services Layer (Client SDKs)                          │
│  ├─ Auth Client      ├─ Deployment     ├─ MagicCanvas Client  │
│  ├─ Project Client   ├─ Artifact       ├─ Notification       │
│  ├─ Profile Client   ├─ Audit Client   ├─ Feature Flags      │
├─────────────────────────────────────────────────────────────────┤
│  Adapters Layer                                               │
│  ├─ Supabase Adapter                                          │
│  ├─ External API Adapters (CI/CD, Storage, etc.)             │
│  ├─ Mock Adapters (Testing)                                   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend Services                            │
├─────────────────────────────────────────────────────────────────┤
│  Supabase                                                     │
│  ├─ PostgreSQL Database                                       │
│  ├─ Realtime Subscriptions                                    │
│  ├─ Storage Buckets                                           │
│  ├─ Edge Functions                                            │
│  └─ Row Level Security (RLS)                                  │
├─────────────────────────────────────────────────────────────────┤
│  External Integrations                                         │
│  ├─ CI/CD Providers (GitHub Actions, etc.)                    │
│  ├─ File Storage (S3-compatible)                              │
│  ├─ Email Service (Resend, SendGrid)                          │
│  └─ Analytics (PostHog, Amplitude)                            │
└─────────────────────────────────────────────────────────────────┘
```

## 🧩 Service Architecture Principles

### 1. Ports and Adapters Pattern
Each service follows the hexagonal architecture:
- **Ports**: Interfaces that define what the service can do
- **Adapters**: Concrete implementations that connect to external systems

```typescript
// Port (Interface)
interface DeploymentClient {
  triggerDeployment(request: TriggerDeploymentRequest): Promise<Result<Deployment>>
  streamLogs(deploymentId: string): AsyncIterable<DeploymentLog>
}

// Adapter (Implementation)
class SupabaseDeploymentAdapter implements DeploymentClient {
  // Implementation using Supabase
}

class MockDeploymentAdapter implements DeploymentClient {
  // Mock implementation for testing
}
```

### 2. Contract-First Development
- All interfaces are defined upfront using TypeScript types
- Services depend only on contracts, not implementations
- Enables parallel development of frontend and backend

### 3. Event-Driven Communication
- Services publish domain events for cross-service communication
- Uses Supabase Realtime channels for event broadcasting
- Ensures loose coupling between services

### 4. Domain-Driven Design
- Each service owns its domain model
- Clear boundaries between contexts
- Business logic encapsulated within services

## 🔐 Security Architecture

### Authentication Flow
```
User → Frontend → Supabase Auth → JWT Token → Service Calls
```

### Authorization Model
- **Role-Based Access Control (RBAC)**
  - Organization roles: `owner`, `admin`, `member`
  - Project roles: `maintainer`, `developer`, `viewer`
- **Row-Level Security (RLS)**
  - Database policies enforce access control
  - Users can only access authorized resources

### Data Security
- Sensitive data encrypted at rest
- API keys and secrets stored securely
- Signed URLs for temporary file access

## 📊 Data Architecture

### Database Design
- **PostgreSQL** with Supabase extensions
- **Normalized schema** with foreign key constraints
- **Audit trails** for all critical operations
- **Soft deletes** for data retention

### Data Flow Patterns
1. **Command Query Responsibility Segregation (CQRS)**
   - Separate read and write models where needed
   - Optimized queries for different use cases

2. **Event Sourcing** (for complex domains)
   - Magic Canvas operations as event streams
   - Deployment state changes as events

3. **Caching Strategy**
   - Client-side caching for frequently accessed data
   - Real-time invalidation via Supabase subscriptions

## 🔄 Deployment Architecture

### Frontend Deployment
```
Code → Build (Vite) → Static Files → CDN/Hosting → Users
```

### Backend Services
- **Supabase Edge Functions** for custom business logic
- **Database Functions** for complex queries
- **Webhooks** for external system integration

### CI/CD Pipeline
```
Git Push → Tests → Build → Deploy → Health Checks → Live
```

## 🔧 Development Architecture

### Project Structure
```
src/
├── domain/              # Service contracts and clients
│   ├── auth/
│   ├── projects/
│   ├── deployments/
│   └── ...
├── features/            # UI features and pages
│   ├── dashboard/
│   ├── deployments/
│   └── magic-canvas/
├── components/          # Reusable UI components
│   └── ui/
├── lib/                # Shared utilities
└── hooks/              # Custom React hooks
```

### Dependency Flow
```
Features → Domain Services → Adapters → External Systems
```

- **Features** depend on domain service interfaces
- **Domain Services** are injected with adapter implementations
- **Adapters** handle external system integration

## 🚀 Scalability Considerations

### Frontend Scalability
- **Code splitting** by feature and route
- **Lazy loading** of heavy components
- **Virtual scrolling** for large lists
- **Memoization** for expensive computations

### Backend Scalability
- **Connection pooling** for database connections
- **Read replicas** for read-heavy workloads
- **Horizontal scaling** of Edge Functions
- **CDN caching** for static assets

### Real-time Scalability
- **Channel partitioning** for large-scale real-time features
- **Message batching** to reduce network overhead
- **Client reconnection** strategies for reliability

## 🔍 Observability Architecture

### Monitoring Stack
- **Application logs** with structured logging
- **Performance metrics** (Core Web Vitals, API latency)
- **Error tracking** with Sentry or similar
- **Business metrics** (deployments, user activity)

### Debugging Tools
- **Correlation IDs** for request tracing
- **Developer tools** integration
- **Comprehensive error boundaries**
- **Debug modes** for development

## 🧪 Testing Architecture

### Testing Pyramid
```
E2E Tests (Few)
├── Integration Tests (Some)
├── Component Tests (More)
└── Unit Tests (Many)
```

### Testing Strategy
- **Unit Tests**: Service logic and utilities
- **Component Tests**: UI components in isolation
- **Integration Tests**: Service adapters and API contracts
- **E2E Tests**: Critical user journeys

---

This architecture ensures maintainability, scalability, and developer productivity while maintaining loose coupling between services.