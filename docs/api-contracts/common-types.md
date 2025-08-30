# Common Types & Error Handling

## 🎯 Purpose
Defines shared types, error codes, and response patterns used across all services to ensure consistency and type safety.

## 📋 Common Types

### Result Pattern
All service operations return a `Result<T, E>` type for consistent error handling:

```typescript
interface Result<T> {
  ok: true
  data: T
} | {
  ok: false
  error: ApiError
}

interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
  timestamp?: string
  correlationId?: string
}
```

### Pagination
```typescript
interface PaginatedResult<T> {
  items: T[]
  totalCount: number
  limit: number
  offset: number
  hasMore: boolean
  nextCursor?: string
}

interface PaginationOptions {
  limit?: number
  offset?: number
  cursor?: string
}
```

### Time and Date
```typescript
interface TimeRange {
  start: string // ISO 8601 timestamp
  end: string   // ISO 8601 timestamp
}

interface DateRange {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}
```

### Common Identifiers
```typescript
type UserId = string      // UUID format
type ProjectId = string   // UUID format
type OrganizationId = string // UUID format
type SessionId = string   // UUID format
type CorrelationId = string // UUID format
```

### Metadata and Context
```typescript
interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
}

interface SoftDeletable {
  deletedAt?: string
  deletedBy?: string
}

interface Auditable {
  version: number
  lastModifiedAt: string
  lastModifiedBy: string
}
```

## 🚨 Standard Error Codes

### Authentication & Authorization
```typescript
enum AuthErrorCode {
  UNAUTHORIZED = 'auth/unauthorized',
  FORBIDDEN = 'auth/forbidden',
  TOKEN_EXPIRED = 'auth/token-expired',
  INVALID_CREDENTIALS = 'auth/invalid-credentials',
  ACCOUNT_LOCKED = 'auth/account-locked',
  ACCOUNT_NOT_VERIFIED = 'auth/account-not-verified',
  INSUFFICIENT_PERMISSIONS = 'auth/insufficient-permissions'
}
```

### Validation Errors
```typescript
enum ValidationErrorCode {
  REQUIRED_FIELD = 'validation/required-field',
  INVALID_FORMAT = 'validation/invalid-format',
  OUT_OF_RANGE = 'validation/out-of-range',
  INVALID_LENGTH = 'validation/invalid-length',
  INVALID_TYPE = 'validation/invalid-type',
  CONSTRAINT_VIOLATION = 'validation/constraint-violation'
}
```

### Resource Errors
```typescript
enum ResourceErrorCode {
  NOT_FOUND = 'resource/not-found',
  ALREADY_EXISTS = 'resource/already-exists',
  CONFLICT = 'resource/conflict',
  GONE = 'resource/gone',
  LOCKED = 'resource/locked',
  VERSION_MISMATCH = 'resource/version-mismatch'
}
```

### System Errors
```typescript
enum SystemErrorCode {
  INTERNAL_ERROR = 'system/internal-error',
  SERVICE_UNAVAILABLE = 'system/service-unavailable',
  TIMEOUT = 'system/timeout',
  RATE_LIMITED = 'system/rate-limited',
  QUOTA_EXCEEDED = 'system/quota-exceeded',
  MAINTENANCE_MODE = 'system/maintenance-mode'
}
```

### Business Logic Errors
```typescript
enum BusinessErrorCode {
  OPERATION_NOT_ALLOWED = 'business/operation-not-allowed',
  INVALID_STATE = 'business/invalid-state',
  PRECONDITION_FAILED = 'business/precondition-failed',
  LIMIT_EXCEEDED = 'business/limit-exceeded',
  DEPENDENCY_REQUIRED = 'business/dependency-required'
}
```

## 🔄 Common Response Patterns

### Success Response
```typescript
interface SuccessResponse<T> {
  success: true
  data: T
  metadata?: ResponseMetadata
}

interface ResponseMetadata {
  requestId: string
  timestamp: string
  version: string
  executionTime?: number
}
```

### Error Response
```typescript
interface ErrorResponse {
  success: false
  error: ApiError
  metadata?: ResponseMetadata
}

interface DetailedError extends ApiError {
  field?: string
  path?: string[]
  validationErrors?: ValidationError[]
  stackTrace?: string // only in development
}

interface ValidationError {
  field: string
  message: string
  code: string
  value?: unknown
}
```

### Async Operation Response
```typescript
interface AsyncOperationResponse {
  operationId: string
  status: 'accepted' | 'processing' | 'completed' | 'failed'
  statusUrl: string
  estimatedCompletion?: string
  progress?: number // 0-100
}
```

## 🔍 Common Query Patterns

### Filtering
```typescript
interface FilterOptions {
  where?: WhereCondition[]
  search?: SearchOptions
}

interface WhereCondition {
  field: string
  operator: FilterOperator
  value: unknown
  values?: unknown[]
}

type FilterOperator = 
  | 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'nin' | 'like' | 'ilike'
  | 'is_null' | 'is_not_null'
  | 'contains' | 'contained_by'

interface SearchOptions {
  query: string
  fields?: string[]
  fuzzy?: boolean
  highlight?: boolean
}
```

### Sorting
```typescript
interface SortOptions {
  sortBy?: string[]
  sortOrder?: 'asc' | 'desc'
}

interface SortField {
  field: string
  order: 'asc' | 'desc'
  nulls?: 'first' | 'last'
}
```

### Field Selection
```typescript
interface SelectOptions {
  fields?: string[]
  include?: string[]
  exclude?: string[]
}
```

## 📊 Common Event Types

### System Events
```typescript
interface SystemEvent {
  type: 'system.startup' | 'system.shutdown' | 'system.error' | 'system.maintenance'
  timestamp: string
  metadata: Record<string, unknown>
}
```

### User Events
```typescript
interface UserEvent {
  type: 'user.login' | 'user.logout' | 'user.signup' | 'user.profile_updated'
  userId: string
  timestamp: string
  metadata: Record<string, unknown>
}
```

### Resource Events
```typescript
interface ResourceEvent {
  type: 'resource.created' | 'resource.updated' | 'resource.deleted'
  resourceType: string
  resourceId: string
  userId?: string
  timestamp: string
  changes?: FieldChange[]
  metadata: Record<string, unknown>
}

interface FieldChange {
  field: string
  oldValue?: unknown
  newValue?: unknown
}
```

## 🛡️ Security Types

### Permissions
```typescript
interface Permission {
  resource: string
  action: string
  scope?: string
  conditions?: PermissionCondition[]
}

interface PermissionCondition {
  field: string
  operator: string
  value: unknown
}
```

### Audit Context
```typescript
interface AuditContext {
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  correlationId?: string
  source: 'web' | 'api' | 'mobile' | 'system'
}
```

## 🎨 UI State Types

### Loading States
```typescript
interface LoadingState {
  isLoading: boolean
  error?: ApiError
  lastUpdated?: string
}

interface AsyncState<T> {
  data?: T
  isLoading: boolean
  error?: ApiError
  hasLoaded: boolean
}
```

### Form States
```typescript
interface FormState<T> {
  values: T
  errors: Record<keyof T, string>
  touched: Record<keyof T, boolean>
  isSubmitting: boolean
  isValid: boolean
  isDirty: boolean
}
```

## 🔧 Utility Types

### Optional Fields
```typescript
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> 
  & {
      [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>
    }[Keys]
```

### Deep Partial
```typescript
type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T
```

### Branded Types
```typescript
type Brand<K, T> = K & { __brand: T }

type EmailAddress = Brand<string, 'EmailAddress'>
type URL = Brand<string, 'URL'>
type UUID = Brand<string, 'UUID'>
```

## 🔄 Async Patterns

### Streaming
```typescript
interface StreamEvent<T> {
  type: 'data' | 'error' | 'complete'
  data?: T
  error?: ApiError
  timestamp: string
}

interface StreamOptions {
  bufferSize?: number
  timeout?: number
  reconnect?: boolean
  maxReconnectAttempts?: number
}
```

### Subscriptions
```typescript
interface Subscription<T> {
  subscribe(callback: (data: T) => void): () => void
  unsubscribe(): void
  isActive(): boolean
}

interface SubscriptionOptions {
  immediate?: boolean
  debounce?: number
  throttle?: number
}
```

## ⚡ Performance Types

### Caching
```typescript
interface CacheOptions {
  ttl?: number // seconds
  staleWhileRevalidate?: number // seconds
  tags?: string[]
  version?: string
}

interface CacheEntry<T> {
  data: T
  expires: number
  version?: string
  tags?: string[]
}
```

### Batching
```typescript
interface BatchRequest<T> {
  items: T[]
  options?: BatchOptions
}

interface BatchOptions {
  maxBatchSize?: number
  timeout?: number
  concurrent?: boolean
}

interface BatchResponse<T, E> {
  results: Array<Result<T>>
  errors: E[]
  processingTime: number
}
```

## 📱 Platform-Specific Types

### Device Information
```typescript
interface DeviceInfo {
  platform: 'web' | 'ios' | 'android' | 'desktop'
  browser?: string
  browserVersion?: string
  os?: string
  osVersion?: string
  device?: string
  screenResolution?: string
  language?: string
  timezone?: string
}
```

### Location
```typescript
interface GeoLocation {
  country?: string
  region?: string
  city?: string
  latitude?: number
  longitude?: number
  accuracy?: number
}
```

## 🧪 Testing Types

### Mock Data
```typescript
interface MockOptions<T> {
  count?: number
  overrides?: Partial<T>
  randomize?: boolean
  seed?: string
}

interface TestContext {
  userId: string
  organizationId?: string
  projectId?: string
  permissions: Permission[]
}
```

---

These common types provide the foundation for type-safe development across all services, ensuring consistency in error handling, data structures, and API responses throughout the platform.