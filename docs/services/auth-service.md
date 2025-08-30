# Auth Service

## 🎯 Purpose
Manages user authentication, session handling, and authorization context for the entire platform.

## 📋 Service Overview

The Auth Service provides centralized authentication and authorization capabilities, integrating with Supabase Auth for secure user management and role-based access control (RBAC).

### Key Responsibilities
- User authentication (email/password, OAuth)
- Session management and token refresh
- Role-based authorization
- Organization and project-level permissions
- Security event logging

## 🔧 Technical Architecture

### Domain Model
```typescript
interface User {
  id: string
  email: string
  displayName?: string
  avatarUrl?: string
  createdAt: string
  lastSeenAt?: string
  emailVerified: boolean
}

interface Session {
  accessToken: string
  refreshToken: string
  expiresAt: string
  user: User
}

interface Role {
  id: string
  name: 'owner' | 'maintainer' | 'developer' | 'viewer'
  scope: 'organization' | 'project'
  permissions: Permission[]
}

interface Permission {
  resource: string
  action: string
}
```

### State Machine
```
┌─────────────┐    signIn     ┌──────────────┐
│ UNAUTHENTICATED ──────────→ │ AUTHENTICATING │
└─────────────┘              └──────────────┘
       ▲                            │
       │ signOut                    │ success
       │                           ▼
┌─────────────┐              ┌──────────────┐
│ AUTHENTICATED ◄──────────── │ AUTHENTICATED │
└─────────────┘    failure   └──────────────┘
       │                            │
       │ sessionExpired            │
       ▼                           ▼
┌─────────────┐              ┌──────────────┐
│ EXPIRED      │              │ ERROR        │
└─────────────┘              └──────────────┘
```

## 📡 API Contract

### Core Interface
```typescript
interface AuthClient {
  // Authentication
  signInWithEmail(email: string, options?: SignInOptions): Promise<Result<Session>>
  signInWithProvider(provider: OAuthProvider): Promise<Result<Session>>
  signOut(): Promise<Result<void>>
  
  // Session Management
  getSession(): Promise<Result<Session | null>>
  refreshSession(): Promise<Result<Session>>
  onAuthStateChanged(callback: (session: Session | null) => void): () => void
  
  // Authorization
  getUserRoles(userId: string, scope?: RoleScope): Promise<Result<Role[]>>
  hasPermission(resource: string, action: string, context?: AuthContext): Promise<Result<boolean>>
  
  // User Management
  getCurrentUser(): Promise<Result<User | null>>
  updateUserProfile(updates: Partial<User>): Promise<Result<User>>
}

interface SignInOptions {
  redirectTo?: string
  captchaToken?: string
}

type OAuthProvider = 'google' | 'github' | 'gitlab'

interface AuthContext {
  organizationId?: string
  projectId?: string
}
```

### Error Handling
```typescript
enum AuthErrorCode {
  INVALID_CREDENTIALS = 'auth/invalid-credentials',
  USER_NOT_FOUND = 'auth/user-not-found',
  EMAIL_NOT_VERIFIED = 'auth/email-not-verified',
  SESSION_EXPIRED = 'auth/session-expired',
  INSUFFICIENT_PERMISSIONS = 'auth/insufficient-permissions',
  RATE_LIMITED = 'auth/rate-limited'
}
```

## 🔌 Implementation Strategy

### Supabase Adapter
```typescript
class SupabaseAuthAdapter implements AuthClient {
  constructor(
    private supabase: SupabaseClient,
    private config: AuthConfig
  ) {}

  async signInWithEmail(email: string, options?: SignInOptions): Promise<Result<Session>> {
    try {
      const { data, error } = await this.supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: options?.redirectTo
        }
      })
      
      if (error) {
        return { ok: false, error: this.mapSupabaseError(error) }
      }
      
      return { ok: true, data: this.mapSession(data.session) }
    } catch (err) {
      return { ok: false, error: { code: 'auth/unknown', message: err.message } }
    }
  }

  // Additional implementation methods...
}
```

### Mock Adapter (Testing)
```typescript
class MockAuthAdapter implements AuthClient {
  private sessions = new Map<string, Session>()
  private users = new Map<string, User>()
  
  async signInWithEmail(email: string): Promise<Result<Session>> {
    // Mock implementation for testing
    const mockUser = this.users.get(email) || this.createMockUser(email)
    const session = this.createMockSession(mockUser)
    
    return { ok: true, data: session }
  }
  
  // Additional mock methods...
}
```

## 🔐 Security Implementation

### Role-Based Access Control (RBAC)
```sql
-- Database schema for roles and permissions
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('organization', 'project')),
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  project_id UUID REFERENCES projects(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id)
);

-- Row Level Security policies
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

### Permission System
```typescript
const PERMISSIONS = {
  // Organization permissions
  'organization:manage': 'Manage organization settings',
  'organization:invite': 'Invite users to organization',
  'organization:billing': 'Manage billing and subscriptions',
  
  // Project permissions
  'project:create': 'Create new projects',
  'project:read': 'View project details',
  'project:update': 'Update project settings',
  'project:delete': 'Delete projects',
  
  // Deployment permissions
  'deployment:trigger': 'Trigger deployments',
  'deployment:view': 'View deployment logs and status',
  'deployment:cancel': 'Cancel running deployments',
  
  // Canvas permissions
  'canvas:edit': 'Edit canvas content',
  'canvas:collaborate': 'Collaborate in real-time',
  'canvas:export': 'Export canvas content'
} as const
```

### Session Security
```typescript
interface SessionConfig {
  accessTokenTTL: number // 1 hour
  refreshTokenTTL: number // 30 days
  autoRefreshThreshold: number // 5 minutes before expiry
  maxConcurrentSessions: number // 3 devices
}

class SessionManager {
  private refreshTimer?: NodeJS.Timeout
  
  constructor(private config: SessionConfig) {}
  
  startAutoRefresh(session: Session): void {
    const timeUntilRefresh = this.calculateRefreshTime(session.expiresAt)
    
    this.refreshTimer = setTimeout(async () => {
      await this.refreshSession()
    }, timeUntilRefresh)
  }
  
  private calculateRefreshTime(expiresAt: string): number {
    const expirationTime = new Date(expiresAt).getTime()
    const now = Date.now()
    const timeUntilExpiry = expirationTime - now
    
    return Math.max(0, timeUntilExpiry - this.config.autoRefreshThreshold)
  }
}
```

## 🚀 Performance Considerations

### Caching Strategy
```typescript
interface AuthCache {
  session: Session | null
  userRoles: Map<string, Role[]> // keyed by context
  permissions: Map<string, boolean> // keyed by permission check
}

class CachedAuthClient implements AuthClient {
  private cache: AuthCache = {
    session: null,
    userRoles: new Map(),
    permissions: new Map()
  }
  
  constructor(private adapter: AuthClient) {}
  
  async getSession(): Promise<Result<Session | null>> {
    if (this.cache.session && !this.isSessionExpired(this.cache.session)) {
      return { ok: true, data: this.cache.session }
    }
    
    const result = await this.adapter.getSession()
    if (result.ok) {
      this.cache.session = result.data
    }
    
    return result
  }
}
```

### Optimistic Authorization
```typescript
class OptimisticAuthClient {
  async hasPermission(resource: string, action: string, context?: AuthContext): Promise<Result<boolean>> {
    const cacheKey = this.getCacheKey(resource, action, context)
    
    // Return cached result immediately if available
    if (this.cache.has(cacheKey)) {
      return { ok: true, data: this.cache.get(cacheKey)! }
    }
    
    // Fetch and cache in background
    this.fetchPermissionInBackground(resource, action, context)
    
    // Return optimistic result based on user role
    const optimisticResult = this.getOptimisticPermission(resource, action, context)
    return { ok: true, data: optimisticResult }
  }
}
```

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('AuthClient', () => {
  let authClient: AuthClient
  let mockAdapter: MockAuthAdapter
  
  beforeEach(() => {
    mockAdapter = new MockAuthAdapter()
    authClient = mockAdapter
  })
  
  describe('signInWithEmail', () => {
    it('should return session for valid credentials', async () => {
      const result = await authClient.signInWithEmail('user@example.com')
      
      expect(result.ok).toBe(true)
      expect(result.data).toHaveProperty('accessToken')
      expect(result.data).toHaveProperty('user')
    })
    
    it('should return error for invalid credentials', async () => {
      const result = await authClient.signInWithEmail('invalid@example.com')
      
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe(AuthErrorCode.INVALID_CREDENTIALS)
    })
  })
})
```

### Integration Tests
```typescript
describe('Supabase Auth Integration', () => {
  let supabaseClient: SupabaseClient
  let authClient: SupabaseAuthAdapter
  
  beforeAll(async () => {
    supabaseClient = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_KEY)
    authClient = new SupabaseAuthAdapter(supabaseClient, testConfig)
  })
  
  it('should handle real Supabase authentication flow', async () => {
    // Integration test implementation
  })
})
```

## 📊 Monitoring & Observability

### Metrics
```typescript
interface AuthMetrics {
  signInAttempts: Counter
  signInSuccesses: Counter
  signInFailures: Counter
  sessionRefreshes: Counter
  permissionChecks: Counter
}

class InstrumentedAuthClient implements AuthClient {
  constructor(
    private adapter: AuthClient,
    private metrics: AuthMetrics
  ) {}
  
  async signInWithEmail(email: string, options?: SignInOptions): Promise<Result<Session>> {
    this.metrics.signInAttempts.inc()
    
    const result = await this.adapter.signInWithEmail(email, options)
    
    if (result.ok) {
      this.metrics.signInSuccesses.inc()
    } else {
      this.metrics.signInFailures.inc({ error_code: result.error?.code })
    }
    
    return result
  }
}
```

### Audit Logging
```typescript
interface AuthEvent {
  eventType: 'sign_in' | 'sign_out' | 'permission_check' | 'role_change'
  userId?: string
  timestamp: string
  metadata: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

class AuditLoggingAuthClient implements AuthClient {
  constructor(
    private adapter: AuthClient,
    private auditLogger: AuditLogger
  ) {}
  
  async signInWithEmail(email: string, options?: SignInOptions): Promise<Result<Session>> {
    const result = await this.adapter.signInWithEmail(email, options)
    
    await this.auditLogger.log({
      eventType: 'sign_in',
      userId: result.ok ? result.data.user.id : undefined,
      timestamp: new Date().toISOString(),
      metadata: {
        email,
        success: result.ok,
        errorCode: result.ok ? undefined : result.error?.code
      }
    })
    
    return result
  }
}
```

## 🗺️ Development Roadmap

### Phase 1: Basic Authentication ✅
- [x] Email/password authentication
- [x] Session management
- [x] Basic role checking
- [x] Supabase integration

### Phase 2: Enhanced Security 🔄
- [ ] Multi-factor authentication (MFA)
- [ ] OAuth provider integration
- [ ] Advanced permission system
- [ ] Session security enhancements

### Phase 3: Advanced Features 📋
- [ ] SSO integration (SAML, OIDC)
- [ ] Audit logging dashboard
- [ ] Advanced threat detection
- [ ] Compliance features (GDPR, SOC2)

### Phase 4: Enterprise Features 📋
- [ ] Identity provider federation
- [ ] Advanced analytics
- [ ] Automated compliance reporting
- [ ] Custom authentication flows

## 🐛 Known Issues & Limitations

### Current Limitations
1. **Single Organization Support**: Currently designed for single organization per user
2. **Limited OAuth Providers**: Only Google and GitHub initially supported
3. **Basic Permission Model**: Simple role-based permissions without complex policies

### Technical Debt
1. **Permission Caching**: Need to implement intelligent cache invalidation
2. **Error Handling**: Standardize error codes across all adapters
3. **Session Storage**: Consider secure storage for sensitive session data

### Performance Considerations
1. **Permission Checks**: Optimize frequent permission checks with caching
2. **Role Queries**: Implement efficient role lookup with proper indexing
3. **Session Validation**: Minimize database calls for session validation

---

The Auth Service provides the foundation for secure access control across the entire platform. Its modular design allows for easy testing, monitoring, and future enhancements while maintaining security best practices.