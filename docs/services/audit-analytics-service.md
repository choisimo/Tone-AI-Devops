# Audit & Analytics Service

## 🎯 Purpose
Provides comprehensive event logging, user analytics, system monitoring, and business intelligence for the entire platform.

## 📋 Service Overview

The Audit & Analytics Service captures, processes, and analyzes all user interactions, system events, and business metrics to provide insights, ensure compliance, and enable data-driven decision making.

### Key Responsibilities
- Event tracking and audit logging
- User behavior analytics
- System performance monitoring
- Business metrics collection
- Compliance and security auditing
- Real-time dashboards and reporting

## 🔧 Technical Architecture

### Domain Model
```typescript
interface AuditEvent {
  id: string
  eventType: string
  actorId: string // user ID or system ID
  actorType: 'user' | 'system' | 'api'
  targetId?: string // resource being acted upon
  targetType?: string // type of resource
  action: string
  outcome: 'success' | 'failure' | 'partial'
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  location?: GeoLocation
  metadata: EventMetadata
  context: EventContext
  timestamp: string
  correlationId?: string
  parentEventId?: string
}

interface EventMetadata {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  changes?: FieldChange[]
  errorCode?: string
  errorMessage?: string
  duration?: number
  resourceId?: string
  version?: string
}

interface EventContext {
  projectId?: string
  organizationId?: string
  deploymentId?: string
  canvasSessionId?: string
  requestId?: string
  source: 'web' | 'api' | 'mobile' | 'system'
  version: string
}

interface AnalyticsEvent {
  id: string
  userId?: string
  sessionId: string
  eventName: string
  properties: Record<string, unknown>
  timestamp: string
  deviceInfo?: DeviceInfo
  location?: GeoLocation
  page?: PageInfo
}

interface Metric {
  id: string
  name: string
  type: 'counter' | 'gauge' | 'histogram' | 'timer'
  value: number
  tags: Record<string, string>
  timestamp: string
  source: string
}

interface BusinessMetric {
  id: string
  name: string
  category: MetricCategory
  value: number
  unit: string
  dimensions: Record<string, string>
  aggregationPeriod: 'hour' | 'day' | 'week' | 'month'
  timestamp: string
}

type MetricCategory = 'growth' | 'engagement' | 'revenue' | 'performance' | 'quality'
```

## 📡 API Contract

### Core Interface
```typescript
interface AuditAnalyticsClient {
  // Event Tracking
  track(event: TrackEventRequest): Promise<Result<void>>
  trackBatch(events: TrackEventRequest[]): Promise<Result<void>>
  
  // Audit Logging
  audit(event: AuditEventRequest): Promise<Result<AuditEvent>>
  auditBatch(events: AuditEventRequest[]): Promise<Result<AuditEvent[]>>
  
  // Query and Analysis
  query(request: QueryRequest): Promise<Result<QueryResult>>
  getEvents(request: GetEventsRequest): Promise<Result<PaginatedResult<AuditEvent>>>
  getAnalytics(request: AnalyticsRequest): Promise<Result<AnalyticsResult>>
  
  // Metrics
  recordMetric(metric: RecordMetricRequest): Promise<Result<void>>
  getMetrics(request: MetricsRequest): Promise<Result<MetricResult[]>>
  
  // Dashboards
  createDashboard(dashboard: CreateDashboardRequest): Promise<Result<Dashboard>>
  getDashboard(id: string): Promise<Result<Dashboard | null>>
  updateDashboard(id: string, updates: UpdateDashboardRequest): Promise<Result<Dashboard>>
  
  // Real-time Streaming
  streamEvents(filters: EventStreamFilters): AsyncIterable<AuditEvent>
  streamMetrics(filters: MetricStreamFilters): AsyncIterable<Metric>
  
  // Compliance
  export(request: ExportRequest): Promise<Result<ExportResult>>
  retention(policy: RetentionPolicy): Promise<Result<void>>
}

interface TrackEventRequest {
  eventName: string
  userId?: string
  sessionId?: string
  properties?: Record<string, unknown>
  timestamp?: string
  context?: Partial<EventContext>
}

interface AuditEventRequest {
  eventType: string
  action: string
  actorId: string
  actorType: 'user' | 'system' | 'api'
  targetId?: string
  targetType?: string
  outcome?: 'success' | 'failure' | 'partial'
  metadata?: EventMetadata
  context?: EventContext
}

interface QueryRequest {
  type: 'events' | 'analytics' | 'metrics'
  filters: QueryFilters
  groupBy?: string[]
  aggregations?: Aggregation[]
  timeRange: TimeRange
  limit?: number
  offset?: number
}

interface AnalyticsRequest {
  metrics: string[]
  dimensions?: string[]
  filters?: Record<string, unknown>
  timeRange: TimeRange
  granularity: 'hour' | 'day' | 'week' | 'month'
}
```

## 🔌 Implementation Strategy

### Event Collection and Processing
```typescript
class SupabaseAuditAnalyticsAdapter implements AuditAnalyticsClient {
  constructor(
    private supabase: SupabaseClient,
    private eventProcessor: EventProcessor,
    private metricsCollector: MetricsCollector,
    private config: AnalyticsConfig
  ) {}

  async track(event: TrackEventRequest): Promise<Result<void>> {
    try {
      // Enrich event with context
      const enrichedEvent = await this.enrichEvent(event)
      
      // Validate event structure
      const validation = this.validateEvent(enrichedEvent)
      if (!validation.ok) return validation

      // Store event
      const { error } = await this.supabase
        .from('analytics_events')
        .insert({
          event_name: enrichedEvent.eventName,
          user_id: enrichedEvent.userId,
          session_id: enrichedEvent.sessionId,
          properties: enrichedEvent.properties || {},
          context: enrichedEvent.context || {},
          timestamp: enrichedEvent.timestamp || new Date().toISOString(),
          device_info: enrichedEvent.deviceInfo,
          location: enrichedEvent.location,
          page_info: enrichedEvent.page
        })

      if (error) {
        return { ok: false, error: this.mapSupabaseError(error) }
      }

      // Process event for real-time metrics
      await this.eventProcessor.process(enrichedEvent)

      return { ok: true, data: undefined }
    } catch (err) {
      return {
        ok: false,
        error: { code: 'analytics/track-failed', message: err.message }
      }
    }
  }

  async audit(event: AuditEventRequest): Promise<Result<AuditEvent>> {
    try {
      const auditEvent: AuditEvent = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: event.eventType,
        action: event.action,
        actorId: event.actorId,
        actorType: event.actorType,
        targetId: event.targetId,
        targetType: event.targetType,
        outcome: event.outcome || 'success',
        metadata: event.metadata || {},
        context: event.context || {},
        timestamp: new Date().toISOString(),
        correlationId: this.generateCorrelationId(),
        ...this.extractRequestContext()
      }

      // Store audit event
      const { error } = await this.supabase
        .from('audit_events')
        .insert(auditEvent)

      if (error) {
        return { ok: false, error: this.mapSupabaseError(error) }
      }

      // Trigger compliance checks if needed
      if (this.isComplianceEvent(auditEvent)) {
        await this.triggerComplianceCheck(auditEvent)
      }

      return { ok: true, data: auditEvent }
    } catch (err) {
      return {
        ok: false,
        error: { code: 'analytics/audit-failed', message: err.message }
      }
    }
  }

  async query(request: QueryRequest): Promise<Result<QueryResult>> {
    try {
      let queryBuilder = this.supabase.from(this.getTableName(request.type))

      // Apply filters
      queryBuilder = this.applyFilters(queryBuilder, request.filters)

      // Apply time range
      if (request.timeRange) {
        queryBuilder = queryBuilder
          .gte('timestamp', request.timeRange.start)
          .lte('timestamp', request.timeRange.end)
      }

      // Apply grouping and aggregation
      if (request.groupBy || request.aggregations) {
        return this.executeAggregationQuery(queryBuilder, request)
      }

      // Apply pagination
      if (request.limit) {
        queryBuilder = queryBuilder.limit(request.limit)
      }
      if (request.offset) {
        queryBuilder = queryBuilder.range(request.offset, request.offset + (request.limit || 100) - 1)
      }

      const { data, error } = await queryBuilder

      if (error) {
        return { ok: false, error: this.mapSupabaseError(error) }
      }

      return {
        ok: true,
        data: {
          results: data,
          totalCount: data.length,
          query: request
        }
      }
    } catch (err) {
      return {
        ok: false,
        error: { code: 'analytics/query-failed', message: err.message }
      }
    }
  }

  private async enrichEvent(event: TrackEventRequest): Promise<AnalyticsEvent> {
    const context = await this.getCurrentContext()
    
    return {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventName: event.eventName,
      userId: event.userId,
      sessionId: event.sessionId || this.generateSessionId(),
      properties: event.properties || {},
      timestamp: event.timestamp || new Date().toISOString(),
      deviceInfo: context.deviceInfo,
      location: context.location,
      page: context.page
    }
  }

  private async executeAggregationQuery(
    queryBuilder: any,
    request: QueryRequest
  ): Promise<Result<QueryResult>> {
    // For complex aggregations, use PostgreSQL functions or views
    const { data, error } = await this.supabase.rpc('analytics_aggregation', {
      table_name: this.getTableName(request.type),
      filters: request.filters,
      group_by: request.groupBy,
      aggregations: request.aggregations,
      time_range: request.timeRange
    })

    if (error) {
      return { ok: false, error: this.mapSupabaseError(error) }
    }

    return {
      ok: true,
      data: {
        results: data,
        aggregations: request.aggregations,
        groupBy: request.groupBy
      }
    }
  }
}
```

### Real-time Event Processing
```typescript
class EventProcessor {
  constructor(
    private metricsCollector: MetricsCollector,
    private alertManager: AlertManager
  ) {}

  async process(event: AnalyticsEvent | AuditEvent): Promise<void> {
    // Update real-time metrics
    await this.updateMetrics(event)
    
    // Check for alerts
    await this.checkAlerts(event)
    
    // Process business logic
    await this.processBusinessRules(event)
  }

  private async updateMetrics(event: AnalyticsEvent | AuditEvent): Promise<void> {
    // Extract metrics from event
    const metrics = this.extractMetrics(event)
    
    for (const metric of metrics) {
      await this.metricsCollector.record(metric)
    }
  }

  private extractMetrics(event: AnalyticsEvent | AuditEvent): Metric[] {
    const metrics: Metric[] = []
    const timestamp = event.timestamp

    if ('eventName' in event) {
      // Analytics event
      metrics.push({
        id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `analytics.${event.eventName}`,
        type: 'counter',
        value: 1,
        tags: {
          event: event.eventName,
          userId: event.userId || 'anonymous'
        },
        timestamp,
        source: 'analytics'
      })

      // User activity metric
      if (event.userId) {
        metrics.push({
          id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: 'user.activity',
          type: 'counter',
          value: 1,
          tags: {
            userId: event.userId,
            event: event.eventName
          },
          timestamp,
          source: 'analytics'
        })
      }
    } else {
      // Audit event
      metrics.push({
        id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `audit.${event.eventType}.${event.action}`,
        type: 'counter',
        value: 1,
        tags: {
          eventType: event.eventType,
          action: event.action,
          outcome: event.outcome,
          actorType: event.actorType
        },
        timestamp,
        source: 'audit'
      })
    }

    return metrics
  }
}
```

### Compliance and Security
```typescript
class ComplianceManager {
  constructor(
    private retentionPolicies: Map<string, RetentionPolicy>,
    private encryptionService: EncryptionService
  ) {}

  async checkCompliance(event: AuditEvent): Promise<void> {
    // Check if event contains sensitive data
    if (this.containsSensitiveData(event)) {
      await this.encryptSensitiveFields(event)
    }

    // Apply data retention policies
    const policy = this.retentionPolicies.get(event.eventType)
    if (policy) {
      await this.scheduleRetention(event, policy)
    }

    // Check for compliance violations
    await this.checkViolations(event)
  }

  private containsSensitiveData(event: AuditEvent): boolean {
    const sensitiveFields = ['email', 'ip', 'personalInfo', 'paymentInfo']
    
    return sensitiveFields.some(field =>
      this.hasField(event.metadata, field) ||
      this.hasField(event.context, field)
    )
  }

  private async encryptSensitiveFields(event: AuditEvent): Promise<void> {
    // Encrypt sensitive fields in metadata
    if (event.metadata.before) {
      event.metadata.before = await this.encryptionService.encryptObject(
        event.metadata.before,
        this.getSensitiveFields()
      )
    }

    if (event.metadata.after) {
      event.metadata.after = await this.encryptionService.encryptObject(
        event.metadata.after,
        this.getSensitiveFields()
      )
    }
  }
}
```

## 🚀 Performance Optimization

### Data Partitioning and Indexing
```sql
-- Partition analytics events by time
CREATE TABLE analytics_events (
    id UUID DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL,
    user_id UUID,
    session_id TEXT,
    properties JSONB DEFAULT '{}'::jsonb,
    context JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL,
    device_info JSONB,
    location JSONB,
    page_info JSONB
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions
CREATE TABLE analytics_events_y2024m01 PARTITION OF analytics_events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Indexes for common queries
CREATE INDEX idx_analytics_events_user_timestamp 
    ON analytics_events(user_id, timestamp DESC);

CREATE INDEX idx_analytics_events_event_name 
    ON analytics_events(event_name, timestamp DESC);

CREATE INDEX idx_analytics_events_session 
    ON analytics_events(session_id, timestamp);

-- GIN index for properties queries
CREATE INDEX idx_analytics_events_properties 
    ON analytics_events USING gin(properties);

-- Similar partitioning for audit events
CREATE TABLE audit_events (
    id UUID DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    target_id TEXT,
    target_type TEXT,
    outcome TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    context JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ NOT NULL,
    correlation_id TEXT,
    ip_address INET,
    user_agent TEXT
) PARTITION BY RANGE (timestamp);
```

### Aggregated Views for Performance
```sql
-- Pre-aggregated hourly metrics
CREATE MATERIALIZED VIEW hourly_analytics AS
SELECT 
    date_trunc('hour', timestamp) as hour,
    event_name,
    user_id,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT session_id) as unique_sessions
FROM analytics_events
GROUP BY date_trunc('hour', timestamp), event_name, user_id;

-- Refresh materialized view hourly
SELECT cron.schedule('refresh-hourly-analytics', '0 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_analytics;');

-- Business metrics rollup
CREATE MATERIALIZED VIEW daily_business_metrics AS
SELECT 
    date_trunc('day', timestamp) as day,
    COUNT(DISTINCT user_id) as daily_active_users,
    COUNT(*) FILTER (WHERE event_name = 'deployment.completed') as deployments,
    COUNT(*) FILTER (WHERE event_name = 'canvas.created') as canvases_created,
    COUNT(*) FILTER (WHERE event_name = 'user.signup') as signups
FROM analytics_events
GROUP BY date_trunc('day', timestamp);
```

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('AuditAnalyticsClient', () => {
  let analyticsClient: AuditAnalyticsClient
  let mockSupabase: jest.Mocked<SupabaseClient>

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    analyticsClient = new SupabaseAuditAnalyticsAdapter(
      mockSupabase,
      mockEventProcessor,
      mockMetricsCollector,
      mockConfig
    )
  })

  describe('event tracking', () => {
    it('should track analytics event successfully', async () => {
      mockSupabase.from('analytics_events').insert.mockResolvedValue({ 
        error: null, 
        data: null 
      })

      const result = await analyticsClient.track({
        eventName: 'button.clicked',
        userId: 'user-123',
        properties: { button: 'submit' }
      })

      expect(result.ok).toBe(true)
      expect(mockSupabase.from('analytics_events').insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_name: 'button.clicked',
          user_id: 'user-123',
          properties: { button: 'submit' }
        })
      )
    })

    it('should enrich events with context', async () => {
      const mockContext = {
        deviceInfo: { browser: 'Chrome', os: 'macOS' },
        location: { country: 'US', city: 'San Francisco' }
      }

      jest.spyOn(analyticsClient as any, 'getCurrentContext')
        .mockResolvedValue(mockContext)

      await analyticsClient.track({
        eventName: 'page.viewed',
        userId: 'user-123'
      })

      expect(mockSupabase.from('analytics_events').insert).toHaveBeenCalledWith(
        expect.objectContaining({
          device_info: mockContext.deviceInfo,
          location: mockContext.location
        })
      )
    })
  })

  describe('audit logging', () => {
    it('should create audit event with proper structure', async () => {
      const result = await analyticsClient.audit({
        eventType: 'user.login',
        action: 'authenticate',
        actorId: 'user-123',
        actorType: 'user',
        outcome: 'success'
      })

      expect(result.ok).toBe(true)
      expect(result.data.eventType).toBe('user.login')
      expect(result.data.correlationId).toBeDefined()
      expect(result.data.timestamp).toBeDefined()
    })

    it('should handle compliance events', async () => {
      const mockComplianceCheck = jest.fn()
      jest.spyOn(analyticsClient as any, 'triggerComplianceCheck')
        .mockImplementation(mockComplianceCheck)

      await analyticsClient.audit({
        eventType: 'data.export',
        action: 'export_user_data',
        actorId: 'user-123',
        actorType: 'user',
        targetId: 'user-456',
        targetType: 'user'
      })

      expect(mockComplianceCheck).toHaveBeenCalled()
    })
  })
})
```

### Performance Testing
```typescript
describe('Analytics Performance', () => {
  it('should handle high-volume event ingestion', async () => {
    const events = Array.from({ length: 10000 }, (_, i) => ({
      eventName: 'performance.test',
      userId: `user-${i % 100}`,
      properties: { iteration: i }
    }))

    const startTime = Date.now()
    
    // Batch process events
    const batchSize = 100
    const batches = []
    
    for (let i = 0; i < events.length; i += batchSize) {
      batches.push(events.slice(i, i + batchSize))
    }

    await Promise.all(
      batches.map(batch => analyticsClient.trackBatch(batch))
    )

    const duration = Date.now() - startTime
    
    expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
  })

  it('should efficiently query large datasets', async () => {
    const startTime = Date.now()

    const result = await analyticsClient.query({
      type: 'analytics',
      filters: {
        eventName: 'page.viewed',
        timestamp: { gte: '2024-01-01', lte: '2024-12-31' }
      },
      groupBy: ['eventName', 'userId'],
      aggregations: [
        { field: '*', operation: 'count' },
        { field: 'userId', operation: 'distinct_count' }
      ],
      timeRange: {
        start: '2024-01-01T00:00:00Z',
        end: '2024-12-31T23:59:59Z'
      }
    })

    const duration = Date.now() - startTime

    expect(result.ok).toBe(true)
    expect(duration).toBeLessThan(2000) // Should complete within 2 seconds
  })
})
```

## 📊 Monitoring & Dashboards

### Key Metrics Dashboard
```typescript
interface DashboardConfig {
  id: string
  name: string
  widgets: DashboardWidget[]
  refreshInterval: number
  filters: DashboardFilter[]
}

interface DashboardWidget {
  id: string
  type: 'chart' | 'metric' | 'table' | 'heatmap'
  title: string
  query: QueryRequest
  visualization: VisualizationConfig
  position: { x: number; y: number; width: number; height: number }
}

const platformDashboard: DashboardConfig = {
  id: 'platform-overview',
  name: 'Platform Overview',
  refreshInterval: 60000, // 1 minute
  filters: [],
  widgets: [
    {
      id: 'active-users',
      type: 'metric',
      title: 'Daily Active Users',
      query: {
        type: 'analytics',
        filters: { eventName: 'session.start' },
        aggregations: [{ field: 'userId', operation: 'distinct_count' }],
        timeRange: { start: 'today', end: 'now' }
      },
      visualization: { format: 'number', suffix: ' users' },
      position: { x: 0, y: 0, width: 3, height: 2 }
    },
    {
      id: 'deployment-success-rate',
      type: 'chart',
      title: 'Deployment Success Rate',
      query: {
        type: 'events',
        filters: { eventType: 'deployment' },
        groupBy: ['outcome'],
        aggregations: [{ field: '*', operation: 'count' }],
        timeRange: { start: '7d', end: 'now' }
      },
      visualization: { 
        type: 'donut',
        colors: { success: '#10b981', failure: '#ef4444' }
      },
      position: { x: 3, y: 0, width: 4, height: 4 }
    }
  ]
}
```

## 🗺️ Development Roadmap

### Phase 1: Core Analytics ✅
- [x] Event tracking and audit logging
- [x] Basic querying and reporting
- [x] Data retention policies
- [x] Performance optimization

### Phase 2: Advanced Analytics 🔄
- [ ] Real-time dashboards
- [ ] Advanced visualization
- [ ] Cohort analysis
- [ ] Funnel analysis

### Phase 3: Intelligence 📋
- [ ] ML-powered insights
- [ ] Anomaly detection
- [ ] Predictive analytics
- [ ] Automated reporting

### Phase 4: Enterprise Features 📋
- [ ] Advanced compliance tools
- [ ] Custom data exports
- [ ] Third-party integrations
- [ ] Multi-tenant analytics

---

The Audit & Analytics Service provides comprehensive data collection, analysis, and insight generation capabilities that enable data-driven decisions while ensuring compliance and security across the entire platform.