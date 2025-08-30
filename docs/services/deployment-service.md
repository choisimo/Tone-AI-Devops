# Deployment Service

## 🎯 Purpose
Manages build/deployment pipeline triggers, state tracking, log streaming, and result collection for project deployments.

## 📋 Service Overview

The Deployment Service orchestrates the complete deployment lifecycle from trigger to completion, providing real-time feedback and comprehensive logging. It integrates with external CI/CD providers while maintaining a consistent interface.

### Key Responsibilities
- Deployment pipeline triggering and orchestration
- Real-time status tracking and state management
- Live log streaming and aggregation
- Build artifact collection and linking
- Deployment result analysis and reporting
- Rollback and redeployment capabilities
- Environment-specific deployment management

## 🔧 Technical Architecture

### Domain Model
```typescript
interface Deployment {
  id: string
  projectId: string
  environmentId?: string
  commitSha?: string
  sourceRef: string // branch, tag, or commit
  triggeredBy: string // user ID
  status: DeploymentStatus
  provider: DeploymentProvider
  buildId?: string // external build system ID
  startedAt?: string
  finishedAt?: string
  duration?: number // in seconds
  artifactId?: string
  metadata: DeploymentMetadata
  configuration: DeploymentConfiguration
  createdAt: string
  updatedAt: string
}

interface DeploymentLog {
  id: string
  deploymentId: string
  timestamp: string
  level: LogLevel
  message: string
  step?: string
  source: 'build' | 'deploy' | 'system'
  metadata?: Record<string, unknown>
}

interface DeploymentResult {
  deploymentId: string
  success: boolean
  artifactUrls: string[]
  deploymentUrl?: string
  previewUrls: string[]
  metrics: DeploymentMetrics
  errors: DeploymentError[]
  warnings: DeploymentWarning[]
  summary: DeploymentSummary
}

interface DeploymentMetrics {
  buildTime: number // seconds
  buildSize: number // bytes
  testsPassed: number
  testsFailed: number
  coverage?: number // percentage
  performance?: PerformanceMetrics
}

interface PerformanceMetrics {
  loadTime: number
  firstContentfulPaint: number
  largestContentfulPaint: number
  cumulativeLayoutShift: number
}

interface DeploymentConfiguration {
  environment: string
  buildCommand?: string
  outputDirectory?: string
  environmentVariables: Record<string, string>
  nodeVersion?: string
  installCommand?: string
  framework?: string
  skipDeploy: boolean
}

interface DeploymentMetadata {
  repository?: {
    url: string
    branch: string
    commit: string
    message: string
    author: string
  }
  trigger: 'manual' | 'webhook' | 'schedule' | 'api'
  retryCount: number
  parentDeploymentId?: string // for retries
}

type DeploymentStatus = 
  | 'created' 
  | 'queued' 
  | 'initializing'
  | 'building' 
  | 'deploying' 
  | 'succeeded' 
  | 'failed' 
  | 'canceled' 
  | 'timeout'

type DeploymentProvider = 'vercel' | 'netlify' | 'github-pages' | 'internal' | 'custom'
type LogLevel = 'debug' | 'info' | 'warn' | 'error'
```

### State Machine
```
┌─────────────┐  trigger   ┌─────────────┐  queue   ┌─────────────┐
│   CREATED   ├──────────→ │   QUEUED    ├────────→ │ INITIALIZING │
└─────────────┘            └─────────────┘          └─────────────┘
                                   │                       │
                              cancel │                initialize
                                   ▼                       ▼
                           ┌─────────────┐          ┌─────────────┐
                           │  CANCELED   │          │  BUILDING   │
                           └─────────────┘          └─────────────┘
                                                          │
                                                   build complete
                                                          ▼
                                                  ┌─────────────┐
                                                  │ DEPLOYING   │
                                                  └─────────────┘
                                                          │
                                               ┌──────────┼──────────┐
                                          success        failure    timeout
                                               ▼          ▼          ▼
                                      ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
                                      │ SUCCEEDED   │ │   FAILED    │ │  TIMEOUT    │
                                      └─────────────┘ └─────────────┘ └─────────────┘
```

## 📡 API Contract

### Core Interface
```typescript
interface DeploymentClient {
  // Deployment Management
  triggerDeployment(request: TriggerDeploymentRequest): Promise<Result<Deployment>>
  getDeployment(id: string): Promise<Result<Deployment | null>>
  listDeployments(projectId: string, options?: ListDeploymentsOptions): Promise<Result<PaginatedResult<Deployment>>>
  cancelDeployment(id: string): Promise<Result<Deployment>>
  retryDeployment(id: string, options?: RetryOptions): Promise<Result<Deployment>>
  
  // Log Streaming
  streamLogs(deploymentId: string, options?: LogStreamOptions): AsyncIterable<DeploymentLog>
  getLogs(deploymentId: string, options?: GetLogsOptions): Promise<Result<DeploymentLog[]>>
  
  // Results and Analytics
  getResults(deploymentId: string): Promise<Result<DeploymentResult | null>>
  getMetrics(deploymentId: string): Promise<Result<DeploymentMetrics | null>>
  
  // Environment Management
  createEnvironment(projectId: string, environment: CreateEnvironmentRequest): Promise<Result<Environment>>
  listEnvironments(projectId: string): Promise<Result<Environment[]>>
  updateEnvironment(environmentId: string, updates: UpdateEnvironmentRequest): Promise<Result<Environment>>
  
  // Webhooks
  handleWebhook(provider: DeploymentProvider, payload: unknown): Promise<Result<void>>
  
  // Rollback
  rollback(deploymentId: string, targetDeploymentId?: string): Promise<Result<Deployment>>
  
  // Status Subscriptions
  subscribeToDeploymentStatus(deploymentId: string, callback: (deployment: Deployment) => void): () => void
  subscribeToProjectDeployments(projectId: string, callback: (deployment: Deployment) => void): () => void
}

interface TriggerDeploymentRequest {
  projectId: string
  sourceRef: string
  environmentId?: string
  configuration?: Partial<DeploymentConfiguration>
  idempotencyKey?: string
  message?: string
  force?: boolean // skip checks and redeploy
}

interface ListDeploymentsOptions {
  environmentId?: string
  status?: DeploymentStatus[]
  triggeredBy?: string
  sourceRef?: string
  limit?: number
  offset?: number
  sortBy?: 'createdAt' | 'startedAt' | 'finishedAt'
  sortOrder?: 'asc' | 'desc'
  includeLogs?: boolean
}

interface LogStreamOptions {
  level?: LogLevel
  step?: string
  source?: 'build' | 'deploy' | 'system'
  since?: string
  follow?: boolean
}

interface GetLogsOptions extends LogStreamOptions {
  limit?: number
  offset?: number
}

interface Environment {
  id: string
  projectId: string
  name: string
  type: 'production' | 'staging' | 'preview' | 'development'
  configuration: DeploymentConfiguration
  isDefault: boolean
  createdAt: string
  updatedAt: string
}
```

### Error Handling
```typescript
enum DeploymentErrorCode {
  DEPLOYMENT_NOT_FOUND = 'deployment/not-found',
  DEPLOYMENT_ALREADY_RUNNING = 'deployment/already-running',
  INVALID_SOURCE_REF = 'deployment/invalid-source-ref',
  PROVIDER_ERROR = 'deployment/provider-error',
  BUILD_FAILED = 'deployment/build-failed',
  DEPLOY_FAILED = 'deployment/deploy-failed',
  TIMEOUT = 'deployment/timeout',
  CANCELED = 'deployment/canceled',
  INSUFFICIENT_PERMISSIONS = 'deployment/insufficient-permissions',
  RATE_LIMITED = 'deployment/rate-limited',
  ENVIRONMENT_NOT_FOUND = 'deployment/environment-not-found'
}
```

## 🔌 Implementation Strategy

### Supabase Adapter with External Providers
```typescript
class SupabaseDeploymentAdapter implements DeploymentClient {
  constructor(
    private supabase: SupabaseClient,
    private providers: Map<DeploymentProvider, DeploymentProvider>,
    private logStreamer: LogStreamer,
    private webhookHandler: WebhookHandler
  ) {}

  async triggerDeployment(request: TriggerDeploymentRequest): Promise<Result<Deployment>> {
    try {
      // Check for existing running deployment (unless force=true)
      if (!request.force) {
        const { data: runningDeployments } = await this.supabase
          .from('deployments')
          .select('id, status')
          .eq('project_id', request.projectId)
          .in('status', ['queued', 'initializing', 'building', 'deploying'])

        if (runningDeployments?.length > 0) {
          return {
            ok: false,
            error: { 
              code: DeploymentErrorCode.DEPLOYMENT_ALREADY_RUNNING,
              message: 'A deployment is already running for this project'
            }
          }
        }
      }

      // Get project configuration
      const project = await this.getProject(request.projectId)
      if (!project.ok) return project as Result<Deployment>

      // Create deployment record
      const deployment = await this.createDeploymentRecord(request, project.data)
      if (!deployment.ok) return deployment

      // Initialize deployment with provider
      const provider = this.getProvider(project.data.deploymentProvider)
      const initResult = await provider.initializeDeployment(deployment.data, request)

      if (!initResult.ok) {
        await this.updateDeploymentStatus(deployment.data.id, 'failed', {
          error: initResult.error
        })
        return initResult as Result<Deployment>
      }

      // Update with provider info
      const updatedDeployment = await this.updateDeployment(deployment.data.id, {
        status: 'queued',
        buildId: initResult.data.buildId,
        metadata: {
          ...deployment.data.metadata,
          ...initResult.data.metadata
        }
      })

      // Start log streaming
      this.startLogStreaming(deployment.data.id, initResult.data.buildId, provider)

      return updatedDeployment
    } catch (err) {
      return { 
        ok: false, 
        error: { code: 'deployment/trigger-failed', message: err.message } 
      }
    }
  }

  async streamLogs(deploymentId: string, options?: LogStreamOptions): AsyncIterable<DeploymentLog> {
    const deployment = await this.getDeployment(deploymentId)
    if (!deployment.ok || !deployment.data) {
      throw new Error('Deployment not found')
    }

    // Create real-time subscription for logs
    const channel = this.supabase
      .channel(`deployment-logs:${deploymentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'deployment_logs',
          filter: `deployment_id=eq.${deploymentId}`
        },
        (payload) => {
          const log = this.mapToDeploymentLog(payload.new)
          if (this.matchesLogFilter(log, options)) {
            this.emitLog(log)
          }
        }
      )
      .subscribe()

    // Also stream historical logs
    yield* this.getHistoricalLogs(deploymentId, options)

    // Cleanup on completion
    return {
      [Symbol.asyncIterator]: this.createLogIterator(channel, options),
      cleanup: () => channel.unsubscribe()
    }
  }

  private async startLogStreaming(
    deploymentId: string, 
    buildId: string, 
    provider: DeploymentProvider
  ): Promise<void> {
    try {
      const logStream = provider.streamBuildLogs(buildId)
      
      for await (const log of logStream) {
        await this.supabase
          .from('deployment_logs')
          .insert({
            deployment_id: deploymentId,
            timestamp: log.timestamp,
            level: log.level,
            message: log.message,
            step: log.step,
            source: log.source,
            metadata: log.metadata
          })
      }
    } catch (err) {
      console.error(`Log streaming failed for deployment ${deploymentId}:`, err)
      
      // Insert error log
      await this.supabase
        .from('deployment_logs')
        .insert({
          deployment_id: deploymentId,
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `Log streaming failed: ${err.message}`,
          source: 'system'
        })
    }
  }

  async handleWebhook(provider: DeploymentProvider, payload: unknown): Promise<Result<void>> {
    try {
      const handler = this.webhookHandler.getHandler(provider)
      const event = handler.parseWebhook(payload)

      if (event.type === 'deployment.status_changed') {
        await this.updateDeploymentFromWebhook(event.deploymentId, event.status, event.metadata)
      } else if (event.type === 'deployment.completed') {
        await this.finalizeDeployment(event.deploymentId, event.result)
      }

      return { ok: true, data: undefined }
    } catch (err) {
      return { 
        ok: false, 
        error: { code: 'deployment/webhook-failed', message: err.message }
      }
    }
  }
}
```

### Provider Abstraction
```typescript
interface DeploymentProvider {
  name: string
  initializeDeployment(deployment: Deployment, request: TriggerDeploymentRequest): Promise<Result<InitializeResult>>
  streamBuildLogs(buildId: string): AsyncIterable<ProviderLog>
  getDeploymentStatus(buildId: string): Promise<Result<ProviderStatus>>
  cancelDeployment(buildId: string): Promise<Result<void>>
  getDeploymentResult(buildId: string): Promise<Result<ProviderResult>>
}

class VercelProvider implements DeploymentProvider {
  name = 'vercel'

  constructor(private apiKey: string) {}

  async initializeDeployment(
    deployment: Deployment, 
    request: TriggerDeploymentRequest
  ): Promise<Result<InitializeResult>> {
    try {
      const response = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `deployment-${deployment.id}`,
          gitSource: {
            type: 'github',
            ref: request.sourceRef,
            repoId: deployment.metadata.repository?.url
          },
          env: deployment.configuration.environmentVariables,
          buildCommand: deployment.configuration.buildCommand,
          outputDirectory: deployment.configuration.outputDirectory
        })
      })

      const data = await response.json()

      if (!response.ok) {
        return { 
          ok: false, 
          error: { code: 'provider/initialization-failed', message: data.error?.message }
        }
      }

      return {
        ok: true,
        data: {
          buildId: data.id,
          metadata: {
            provider: 'vercel',
            deploymentUrl: `https://${data.url}`,
            inspectorUrl: `https://vercel.com/dashboard/deployments/${data.id}`
          }
        }
      }
    } catch (err) {
      return { 
        ok: false, 
        error: { code: 'provider/network-error', message: err.message }
      }
    }
  }

  async *streamBuildLogs(buildId: string): AsyncIterable<ProviderLog> {
    const response = await fetch(`https://api.vercel.com/v2/deployments/${buildId}/events`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('Response body not readable')

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            const event = JSON.parse(line)
            yield this.parseLogEvent(event)
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private parseLogEvent(event: any): ProviderLog {
    return {
      timestamp: new Date(event.created).toISOString(),
      level: this.mapLogLevel(event.type),
      message: event.text || event.payload?.text || 'Build step completed',
      step: event.payload?.info?.type,
      source: 'build',
      metadata: {
        eventType: event.type,
        payload: event.payload
      }
    }
  }
}
```

### Real-time UI Integration
```typescript
// This is how the existing DeploymentLogs.tsx component would integrate
class DeploymentLogsComponent {
  private subscription?: () => void

  async componentDidMount() {
    const { deploymentId } = this.props
    
    // Subscribe to real-time log updates
    this.subscription = this.deploymentClient.subscribeToDeploymentStatus(
      deploymentId,
      (deployment) => {
        this.setState({ deployment })
      }
    )

    // Start log streaming
    this.startLogStreaming()
  }

  private async startLogStreaming() {
    const { deploymentId } = this.props
    
    try {
      const logStream = this.deploymentClient.streamLogs(deploymentId, {
        follow: true,
        level: this.state.selectedLogLevel
      })

      for await (const log of logStream) {
        this.setState(prev => ({
          logs: [...prev.logs, log]
        }))
      }
    } catch (err) {
      console.error('Log streaming failed:', err)
    }
  }

  componentWillUnmount() {
    this.subscription?.()
  }
}
```

## 🚀 Performance Optimization

### Log Storage and Retrieval
```sql
-- Optimized table structure for logs
CREATE TABLE deployment_logs (
  id BIGSERIAL PRIMARY KEY,
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  step TEXT,
  source TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Partitioning by time for better performance
CREATE TABLE deployment_logs_y2024m01 PARTITION OF deployment_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Indexes for common queries
CREATE INDEX idx_deployment_logs_deployment_timestamp 
  ON deployment_logs(deployment_id, timestamp DESC);

CREATE INDEX idx_deployment_logs_level 
  ON deployment_logs(deployment_id, level, timestamp DESC);

-- TTL for log cleanup
CREATE OR REPLACE FUNCTION cleanup_old_logs() 
RETURNS void AS $$
BEGIN
  DELETE FROM deployment_logs 
  WHERE created_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup job
SELECT cron.schedule('cleanup-logs', '0 2 * * *', 'SELECT cleanup_old_logs();');
```

### Caching and Rate Limiting
```typescript
interface DeploymentCache {
  deployments: Map<string, { data: Deployment; expires: number }>
  results: Map<string, { data: DeploymentResult; expires: number }>
  logs: Map<string, { data: DeploymentLog[]; expires: number }>
}

class CachedDeploymentClient implements DeploymentClient {
  private cache: DeploymentCache = {
    deployments: new Map(),
    results: new Map(),
    logs: new Map()
  }

  private rateLimiter = new Map<string, { count: number; resetTime: number }>()

  constructor(
    private adapter: DeploymentClient,
    private cacheTTL: number = 30000, // 30 seconds
    private rateLimitWindow: number = 60000, // 1 minute
    private rateLimitMax: number = 10 // max 10 triggers per minute per project
  ) {}

  async triggerDeployment(request: TriggerDeploymentRequest): Promise<Result<Deployment>> {
    // Rate limiting check
    const rateLimitKey = `${request.projectId}:trigger`
    if (this.isRateLimited(rateLimitKey)) {
      return {
        ok: false,
        error: { 
          code: DeploymentErrorCode.RATE_LIMITED, 
          message: 'Too many deployment triggers' 
        }
      }
    }

    const result = await this.adapter.triggerDeployment(request)
    
    if (result.ok) {
      // Update rate limit counter
      this.updateRateLimit(rateLimitKey)
      
      // Cache the deployment
      this.cache.deployments.set(result.data.id, {
        data: result.data,
        expires: Date.now() + this.cacheTTL
      })
    }

    return result
  }

  private isRateLimited(key: string): boolean {
    const limit = this.rateLimiter.get(key)
    if (!limit) return false

    if (Date.now() > limit.resetTime) {
      this.rateLimiter.delete(key)
      return false
    }

    return limit.count >= this.rateLimitMax
  }
}
```

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('DeploymentClient', () => {
  let deploymentClient: DeploymentClient
  let mockAdapter: MockDeploymentAdapter

  beforeEach(() => {
    mockAdapter = new MockDeploymentAdapter()
    deploymentClient = mockAdapter
  })

  describe('triggerDeployment', () => {
    it('should create deployment with correct status', async () => {
      const request: TriggerDeploymentRequest = {
        projectId: 'proj-123',
        sourceRef: 'main',
        message: 'Test deployment'
      }

      const result = await deploymentClient.triggerDeployment(request)

      expect(result.ok).toBe(true)
      expect(result.data.status).toBe('created')
      expect(result.data.sourceRef).toBe('main')
      expect(result.data.projectId).toBe('proj-123')
    })

    it('should prevent concurrent deployments', async () => {
      const request: TriggerDeploymentRequest = {
        projectId: 'proj-123',
        sourceRef: 'main'
      }

      // First deployment should succeed
      const first = await deploymentClient.triggerDeployment(request)
      expect(first.ok).toBe(true)

      // Update status to running
      await mockAdapter.updateStatus(first.data.id, 'building')

      // Second deployment should fail
      const second = await deploymentClient.triggerDeployment(request)
      expect(second.ok).toBe(false)
      expect(second.error?.code).toBe(DeploymentErrorCode.DEPLOYMENT_ALREADY_RUNNING)
    })

    it('should allow concurrent deployments with force flag', async () => {
      const request: TriggerDeploymentRequest = {
        projectId: 'proj-123',
        sourceRef: 'main',
        force: true
      }

      const first = await deploymentClient.triggerDeployment(request)
      await mockAdapter.updateStatus(first.data.id, 'building')

      const second = await deploymentClient.triggerDeployment(request)
      expect(second.ok).toBe(true)
    })
  })

  describe('log streaming', () => {
    it('should stream logs in real-time', async () => {
      const deployment = await mockAdapter.createTestDeployment()
      const logs: DeploymentLog[] = []

      const logStream = deploymentClient.streamLogs(deployment.id)
      
      // Collect logs
      const collectLogs = (async () => {
        for await (const log of logStream) {
          logs.push(log)
          if (logs.length >= 3) break
        }
      })()

      // Emit some test logs
      await mockAdapter.addLog(deployment.id, { level: 'info', message: 'Building...' })
      await mockAdapter.addLog(deployment.id, { level: 'info', message: 'Tests running...' })
      await mockAdapter.addLog(deployment.id, { level: 'info', message: 'Deploy complete' })

      await collectLogs

      expect(logs).toHaveLength(3)
      expect(logs[0].message).toBe('Building...')
      expect(logs[2].message).toBe('Deploy complete')
    })
  })
})
```

### Integration Tests
```typescript
describe('Deployment Provider Integration', () => {
  let vercelProvider: VercelProvider

  beforeAll(() => {
    vercelProvider = new VercelProvider(TEST_VERCEL_API_KEY)
  })

  it('should handle complete deployment workflow with Vercel', async () => {
    const mockDeployment: Deployment = {
      // ... mock deployment data
    }

    const request: TriggerDeploymentRequest = {
      projectId: 'test-project',
      sourceRef: 'main'
    }

    // Initialize deployment
    const initResult = await vercelProvider.initializeDeployment(mockDeployment, request)
    expect(initResult.ok).toBe(true)

    const buildId = initResult.data.buildId

    // Stream logs (test a few logs)
    const logs: ProviderLog[] = []
    const logStream = vercelProvider.streamBuildLogs(buildId)
    
    let logCount = 0
    for await (const log of logStream) {
      logs.push(log)
      logCount++
      if (logCount >= 5) break // Test first 5 logs
    }

    expect(logs.length).toBeGreaterThan(0)

    // Get final status
    const statusResult = await vercelProvider.getDeploymentStatus(buildId)
    expect(statusResult.ok).toBe(true)
  })
})
```

## 📊 Monitoring & Analytics

### Deployment Metrics
```typescript
interface DeploymentAnalytics {
  deploymentsTriggered: Counter
  deploymentsSucceeded: Counter
  deploymentsFailed: Counter
  deploymentDuration: Histogram
  buildSize: Histogram
  logVolume: Counter
}

class AnalyticsDeploymentClient implements DeploymentClient {
  constructor(
    private adapter: DeploymentClient,
    private analytics: DeploymentAnalytics
  ) {}

  async triggerDeployment(request: TriggerDeploymentRequest): Promise<Result<Deployment>> {
    this.analytics.deploymentsTriggered.inc({
      project_id: request.projectId,
      source_ref: request.sourceRef,
      trigger_type: 'manual'
    })

    const startTime = Date.now()
    const result = await this.adapter.triggerDeployment(request)

    if (result.ok) {
      // Track deployment lifecycle
      this.trackDeploymentLifecycle(result.data)
    }

    return result
  }

  private trackDeploymentLifecycle(deployment: Deployment) {
    // Subscribe to status changes
    this.adapter.subscribeToDeploymentStatus(deployment.id, (updated) => {
      if (updated.status === 'succeeded') {
        this.analytics.deploymentsSucceeded.inc({
          project_id: deployment.projectId,
          provider: deployment.provider
        })
        
        if (updated.duration) {
          this.analytics.deploymentDuration.observe(updated.duration, {
            project_id: deployment.projectId,
            status: 'succeeded'
          })
        }
      } else if (updated.status === 'failed') {
        this.analytics.deploymentsFailed.inc({
          project_id: deployment.projectId,
          provider: deployment.provider,
          error_code: updated.metadata?.error?.code || 'unknown'
        })
      }
    })
  }
}
```

## 🗺️ Development Roadmap

### Phase 1: Core Deployment Pipeline ✅
- [x] Deployment triggering and status tracking
- [x] Basic log streaming
- [x] Provider abstraction (Vercel/Netlify)
- [x] Webhook handling

### Phase 2: Enhanced Features 🔄
- [ ] Multi-environment deployments
- [ ] Advanced log filtering and search
- [ ] Deployment rollback capabilities
- [ ] Performance metrics collection

### Phase 3: Advanced Pipeline Management 📋
- [ ] Deployment approval workflows
- [ ] Canary and blue-green deployments
- [ ] Advanced monitoring and alerting
- [ ] Custom deployment providers

### Phase 4: Enterprise Features 📋
- [ ] Deployment policies and governance
- [ ] Advanced analytics and reporting
- [ ] Multi-region deployments
- [ ] Compliance and audit trails

## 🐛 Known Issues & Limitations

### Current Limitations
1. **Provider Lock-in**: Limited abstraction for provider-specific features
2. **Log Storage**: No automatic log compression or archival
3. **Concurrent Deployments**: Basic prevention without queue management

### Technical Debt
1. **Error Handling**: Need standardized error classification
2. **Log Performance**: Large log volumes may impact real-time streaming
3. **Provider Resilience**: Need better handling of provider outages

### Future Enhancements
1. **Smart Deployments**: AI-powered deployment optimization
2. **Advanced Rollbacks**: Automated rollback based on metrics
3. **Global CDN**: Multi-region deployment coordination

---

The Deployment Service provides comprehensive deployment lifecycle management with real-time feedback, supporting the core DevOps workflow while maintaining flexibility through provider abstraction.