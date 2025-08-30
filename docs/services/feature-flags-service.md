# Feature Flags & Configuration Service

## 🎯 Purpose
Provides dynamic feature toggling, configuration management, and A/B testing capabilities to enable safe rollouts and experimentation.

## 📋 Service Overview

The Feature Flags & Configuration Service enables controlled feature releases, runtime configuration updates, and experimentation without code deployments. It supports progressive rollouts, user targeting, and performance monitoring.

### Key Responsibilities
- Dynamic feature flag management
- Runtime configuration updates
- A/B testing and experimentation
- Progressive rollout controls
- User targeting and segmentation
- Flag performance monitoring

## 🔧 Technical Architecture

### Domain Model
```typescript
interface FeatureFlag {
  id: string
  key: string
  name: string
  description: string
  type: FlagType
  status: FlagStatus
  defaultValue: FlagValue
  targeting: TargetingConfig
  variants?: FlagVariant[]
  environment: string
  projectId?: string
  metadata: FlagMetadata
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface FlagVariant {
  id: string
  key: string
  name: string
  value: FlagValue
  weight: number // percentage allocation
  description?: string
}

interface TargetingConfig {
  enabled: boolean
  rules: TargetingRule[]
  fallback: FlagValue
  userTargeting?: UserTargeting
  percentageRollout?: PercentageRollout
}

interface TargetingRule {
  id: string
  conditions: RuleCondition[]
  value: FlagValue
  description?: string
  enabled: boolean
}

interface RuleCondition {
  attribute: string
  operator: ConditionOperator
  values: string[]
}

interface UserTargeting {
  includedUsers: string[]
  excludedUsers: string[]
  includedGroups: string[]
  excludedGroups: string[]
}

interface PercentageRollout {
  enabled: boolean
  percentage: number
  attribute: string // user attribute for consistent bucketing
}

interface Configuration {
  id: string
  key: string
  name: string
  value: ConfigValue
  type: ConfigType
  environment: string
  projectId?: string
  schema?: JSONSchema
  encrypted: boolean
  metadata: ConfigMetadata
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface Experiment {
  id: string
  name: string
  description: string
  hypothesis: string
  flagId: string
  variants: ExperimentVariant[]
  targeting: TargetingConfig
  metrics: ExperimentMetric[]
  status: ExperimentStatus
  startDate?: string
  endDate?: string
  environment: string
  projectId: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface ExperimentVariant {
  id: string
  name: string
  allocation: number
  flagValue: FlagValue
}

interface ExperimentMetric {
  name: string
  type: 'conversion' | 'numeric' | 'counter'
  eventName?: string
  aggregation?: 'sum' | 'avg' | 'count' | 'unique'
}

type FlagType = 'boolean' | 'string' | 'number' | 'json'
type FlagStatus = 'active' | 'inactive' | 'archived'
type FlagValue = boolean | string | number | object | null
type ConfigType = 'string' | 'number' | 'boolean' | 'json' | 'secret'
type ConfigValue = string | number | boolean | object
type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived'
type ConditionOperator = 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'greater_than' | 'less_than' | 'matches_regex'
```

### Evaluation Engine
```typescript
interface FlagEvaluationContext {
  userId?: string
  userAttributes?: Record<string, unknown>
  groups?: string[]
  environment: string
  timestamp: string
  requestId?: string
}

interface FlagEvaluation {
  flagKey: string
  value: FlagValue
  variant?: string
  reason: EvaluationReason
  ruleId?: string
  metadata?: EvaluationMetadata
}

interface EvaluationReason {
  kind: 'DEFAULT' | 'TARGETING' | 'RULE_MATCH' | 'PERCENTAGE_ROLLOUT' | 'USER_TARGETING' | 'FALLBACK'
  ruleIndex?: number
  description?: string
}
```

## 📡 API Contract

### Core Interface
```typescript
interface FeatureFlagsClient {
  // Flag Evaluation
  evaluate(flagKey: string, context: FlagEvaluationContext, defaultValue?: FlagValue): Promise<Result<FlagEvaluation>>
  evaluateAll(context: FlagEvaluationContext): Promise<Result<Record<string, FlagEvaluation>>>
  
  // Configuration
  getConfig(key: string, environment: string): Promise<Result<Configuration | null>>
  getAllConfigs(environment: string, projectId?: string): Promise<Result<Record<string, ConfigValue>>>
  
  // Flag Management
  createFlag(flag: CreateFlagRequest): Promise<Result<FeatureFlag>>
  updateFlag(id: string, updates: UpdateFlagRequest): Promise<Result<FeatureFlag>>
  deleteFlag(id: string): Promise<Result<void>>
  getFlag(id: string): Promise<Result<FeatureFlag | null>>
  listFlags(options?: ListFlagsOptions): Promise<Result<PaginatedResult<FeatureFlag>>>
  
  // Configuration Management
  createConfig(config: CreateConfigRequest): Promise<Result<Configuration>>
  updateConfig(id: string, updates: UpdateConfigRequest): Promise<Result<Configuration>>
  deleteConfig(id: string): Promise<Result<void>>
  
  // Experimentation
  createExperiment(experiment: CreateExperimentRequest): Promise<Result<Experiment>>
  startExperiment(id: string): Promise<Result<Experiment>>
  stopExperiment(id: string): Promise<Result<Experiment>>
  getExperimentResults(id: string): Promise<Result<ExperimentResults>>
  
  // Real-time Updates
  subscribe(context: SubscriptionContext): AsyncIterable<FlagUpdate>
  
  // Analytics
  getFlagUsage(flagKey: string, timeRange: TimeRange): Promise<Result<FlagUsageStats>>
  getExperimentAnalytics(experimentId: string): Promise<Result<ExperimentAnalytics>>
}

interface CreateFlagRequest {
  key: string
  name: string
  description?: string
  type: FlagType
  defaultValue: FlagValue
  environment: string
  projectId?: string
  targeting?: Partial<TargetingConfig>
}

interface UpdateFlagRequest {
  name?: string
  description?: string
  status?: FlagStatus
  defaultValue?: FlagValue
  targeting?: Partial<TargetingConfig>
  variants?: FlagVariant[]
}

interface CreateConfigRequest {
  key: string
  name: string
  value: ConfigValue
  type: ConfigType
  environment: string
  projectId?: string
  encrypted?: boolean
  schema?: JSONSchema
}

interface FlagUsageStats {
  flagKey: string
  evaluations: number
  uniqueUsers: number
  valueDistribution: Record<string, number>
  environmentBreakdown: Record<string, number>
}
```

## 🔌 Implementation Strategy

### Evaluation Engine
```typescript
class FlagEvaluationEngine {
  constructor(
    private flagStore: FlagStore,
    private userStore: UserStore
  ) {}

  async evaluate(
    flagKey: string, 
    context: FlagEvaluationContext, 
    defaultValue?: FlagValue
  ): Promise<Result<FlagEvaluation>> {
    try {
      // Get flag configuration
      const flag = await this.flagStore.get(flagKey, context.environment)
      if (!flag.ok || !flag.data) {
        return {
          ok: true,
          data: {
            flagKey,
            value: defaultValue ?? false,
            reason: { kind: 'DEFAULT', description: 'Flag not found' }
          }
        }
      }

      // Check if flag is active
      if (flag.data.status !== 'active') {
        return {
          ok: true,
          data: {
            flagKey,
            value: flag.data.defaultValue,
            reason: { kind: 'DEFAULT', description: 'Flag inactive' }
          }
        }
      }

      // Evaluate targeting rules
      const evaluation = await this.evaluateTargeting(flag.data, context)
      
      // Record evaluation for analytics
      await this.recordEvaluation(flagKey, evaluation, context)

      return { ok: true, data: evaluation }
    } catch (err) {
      return {
        ok: false,
        error: { code: 'flags/evaluation-failed', message: err.message }
      }
    }
  }

  private async evaluateTargeting(
    flag: FeatureFlag, 
    context: FlagEvaluationContext
  ): Promise<FlagEvaluation> {
    const { targeting } = flag

    // If targeting is disabled, return default value
    if (!targeting.enabled) {
      return {
        flagKey: flag.key,
        value: flag.defaultValue,
        reason: { kind: 'DEFAULT', description: 'Targeting disabled' }
      }
    }

    // Check user targeting first
    if (targeting.userTargeting && context.userId) {
      const userResult = this.evaluateUserTargeting(targeting.userTargeting, context)
      if (userResult) return userResult
    }

    // Evaluate targeting rules
    for (let i = 0; i < targeting.rules.length; i++) {
      const rule = targeting.rules[i]
      if (!rule.enabled) continue

      const matches = await this.evaluateRule(rule, context)
      if (matches) {
        return {
          flagKey: flag.key,
          value: rule.value,
          reason: { 
            kind: 'RULE_MATCH', 
            ruleIndex: i, 
            description: rule.description 
          },
          ruleId: rule.id
        }
      }
    }

    // Check percentage rollout
    if (targeting.percentageRollout?.enabled && context.userId) {
      const rolloutResult = this.evaluatePercentageRollout(
        targeting.percentageRollout, 
        flag, 
        context
      )
      if (rolloutResult) return rolloutResult
    }

    // Return fallback value
    return {
      flagKey: flag.key,
      value: targeting.fallback,
      reason: { kind: 'FALLBACK', description: 'No rules matched' }
    }
  }

  private async evaluateRule(
    rule: TargetingRule, 
    context: FlagEvaluationContext
  ): Promise<boolean> {
    // All conditions must match (AND logic)
    for (const condition of rule.conditions) {
      const matches = await this.evaluateCondition(condition, context)
      if (!matches) return false
    }
    return true
  }

  private async evaluateCondition(
    condition: RuleCondition, 
    context: FlagEvaluationContext
  ): Promise<boolean> {
    const attributeValue = await this.getAttributeValue(condition.attribute, context)
    
    switch (condition.operator) {
      case 'equals':
        return condition.values.includes(String(attributeValue))
      
      case 'not_equals':
        return !condition.values.includes(String(attributeValue))
      
      case 'in':
        return condition.values.some(val => String(attributeValue).includes(val))
      
      case 'not_in':
        return !condition.values.some(val => String(attributeValue).includes(val))
      
      case 'greater_than':
        return Number(attributeValue) > Number(condition.values[0])
      
      case 'less_than':
        return Number(attributeValue) < Number(condition.values[0])
      
      case 'matches_regex':
        const regex = new RegExp(condition.values[0])
        return regex.test(String(attributeValue))
      
      default:
        return false
    }
  }

  private evaluatePercentageRollout(
    rollout: PercentageRollout,
    flag: FeatureFlag,
    context: FlagEvaluationContext
  ): FlagEvaluation | null {
    const bucketingValue = this.getBucketingValue(rollout.attribute, context)
    const bucket = this.hash(flag.key + bucketingValue) % 100

    if (bucket < rollout.percentage) {
      return {
        flagKey: flag.key,
        value: flag.defaultValue,
        reason: { 
          kind: 'PERCENTAGE_ROLLOUT', 
          description: `User in ${rollout.percentage}% rollout` 
        }
      }
    }

    return null
  }

  private hash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }
}
```

### Supabase Adapter Implementation
```typescript
class SupabaseFeatureFlagsAdapter implements FeatureFlagsClient {
  constructor(
    private supabase: SupabaseClient,
    private evaluationEngine: FlagEvaluationEngine,
    private cache: FlagCache
  ) {}

  async evaluate(
    flagKey: string, 
    context: FlagEvaluationContext, 
    defaultValue?: FlagValue
  ): Promise<Result<FlagEvaluation>> {
    try {
      // Check cache first
      const cached = await this.cache.get(flagKey, context.environment)
      if (cached) {
        return this.evaluationEngine.evaluateWithFlag(cached, context, defaultValue)
      }

      // Get flag from database
      const { data, error } = await this.supabase
        .from('feature_flags')
        .select('*')
        .eq('key', flagKey)
        .eq('environment', context.environment)
        .single()

      if (error && error.code !== 'PGRST116') {
        return { ok: false, error: this.mapSupabaseError(error) }
      }

      if (!data) {
        return {
          ok: true,
          data: {
            flagKey,
            value: defaultValue ?? false,
            reason: { kind: 'DEFAULT', description: 'Flag not found' }
          }
        }
      }

      const flag = this.mapToFeatureFlag(data)
      
      // Cache the flag
      await this.cache.set(flagKey, context.environment, flag, 300) // 5 minutes

      return this.evaluationEngine.evaluateWithFlag(flag, context, defaultValue)
    } catch (err) {
      return {
        ok: false,
        error: { code: 'flags/evaluation-failed', message: err.message }
      }
    }
  }

  async createFlag(flag: CreateFlagRequest): Promise<Result<FeatureFlag>> {
    try {
      const { data, error } = await this.supabase
        .from('feature_flags')
        .insert({
          key: flag.key,
          name: flag.name,
          description: flag.description,
          type: flag.type,
          status: 'active',
          default_value: flag.defaultValue,
          targeting: flag.targeting || {
            enabled: false,
            rules: [],
            fallback: flag.defaultValue
          },
          environment: flag.environment,
          project_id: flag.projectId,
          created_by: await this.getCurrentUserId()
        })
        .select('*')
        .single()

      if (error) {
        return { ok: false, error: this.mapSupabaseError(error) }
      }

      const featureFlag = this.mapToFeatureFlag(data)
      
      // Invalidate cache
      await this.cache.invalidate(flag.key, flag.environment)

      return { ok: true, data: featureFlag }
    } catch (err) {
      return {
        ok: false,
        error: { code: 'flags/create-failed', message: err.message }
      }
    }
  }

  async subscribe(context: SubscriptionContext): AsyncIterable<FlagUpdate> {
    const channel = this.supabase.channel(`flags:${context.environment}:${context.projectId}`)

    const updateQueue: FlagUpdate[] = []
    let resolveNext: ((value: IteratorResult<FlagUpdate>) => void) | null = null

    // Subscribe to real-time flag updates
    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'feature_flags',
        filter: `environment=eq.${context.environment}`
      }, (payload) => {
        const update: FlagUpdate = {
          type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          flagKey: payload.new?.key || payload.old?.key,
          flag: payload.new ? this.mapToFeatureFlag(payload.new) : undefined,
          timestamp: new Date().toISOString()
        }

        if (resolveNext) {
          resolveNext({ value: update, done: false })
          resolveNext = null
        } else {
          updateQueue.push(update)
        }
      })
      .subscribe()

    return {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<FlagUpdate>> {
            if (updateQueue.length > 0) {
              const update = updateQueue.shift()!
              return { value: update, done: false }
            }

            return new Promise<IteratorResult<FlagUpdate>>((resolve) => {
              resolveNext = resolve
            })
          },

          async return() {
            channel.unsubscribe()
            return { value: undefined, done: true }
          }
        }
      }
    }
  }
}
```

## 🚀 Performance Optimization

### Caching Strategy
```typescript
interface FlagCache {
  get(key: string, environment: string): Promise<FeatureFlag | null>
  set(key: string, environment: string, flag: FeatureFlag, ttl: number): Promise<void>
  invalidate(key: string, environment: string): Promise<void>
  invalidateAll(environment: string): Promise<void>
}

class MemoryFlagCache implements FlagCache {
  private cache = new Map<string, { flag: FeatureFlag; expires: number }>()

  async get(key: string, environment: string): Promise<FeatureFlag | null> {
    const cacheKey = `${environment}:${key}`
    const cached = this.cache.get(cacheKey)
    
    if (!cached) return null
    
    if (cached.expires < Date.now()) {
      this.cache.delete(cacheKey)
      return null
    }
    
    return cached.flag
  }

  async set(
    key: string, 
    environment: string, 
    flag: FeatureFlag, 
    ttl: number
  ): Promise<void> {
    const cacheKey = `${environment}:${key}`
    this.cache.set(cacheKey, {
      flag,
      expires: Date.now() + (ttl * 1000)
    })
  }

  async invalidate(key: string, environment: string): Promise<void> {
    const cacheKey = `${environment}:${key}`
    this.cache.delete(cacheKey)
  }

  async invalidateAll(environment: string): Promise<void> {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${environment}:`)) {
        this.cache.delete(key)
      }
    }
  }
}
```

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('FeatureFlagsClient', () => {
  let flagsClient: FeatureFlagsClient
  let mockEvaluationEngine: jest.Mocked<FlagEvaluationEngine>

  beforeEach(() => {
    mockEvaluationEngine = {
      evaluate: jest.fn(),
      evaluateWithFlag: jest.fn()
    }
    
    flagsClient = new SupabaseFeatureFlagsAdapter(
      mockSupabase,
      mockEvaluationEngine,
      mockCache
    )
  })

  describe('flag evaluation', () => {
    it('should evaluate boolean flag correctly', async () => {
      const mockFlag: FeatureFlag = {
        id: 'flag-1',
        key: 'new-feature',
        name: 'New Feature',
        type: 'boolean',
        status: 'active',
        defaultValue: false,
        targeting: {
          enabled: true,
          rules: [{
            id: 'rule-1',
            conditions: [{
              attribute: 'userId',
              operator: 'in',
              values: ['user-123']
            }],
            value: true,
            enabled: true
          }],
          fallback: false
        },
        environment: 'production'
      }

      mockEvaluationEngine.evaluateWithFlag.mockResolvedValue({
        ok: true,
        data: {
          flagKey: 'new-feature',
          value: true,
          reason: { kind: 'RULE_MATCH', ruleIndex: 0 }
        }
      })

      const context: FlagEvaluationContext = {
        userId: 'user-123',
        environment: 'production',
        timestamp: new Date().toISOString()
      }

      const result = await flagsClient.evaluate('new-feature', context)

      expect(result.ok).toBe(true)
      expect(result.data.value).toBe(true)
      expect(result.data.reason.kind).toBe('RULE_MATCH')
    })

    it('should handle percentage rollout', async () => {
      const mockFlag: FeatureFlag = {
        // ... flag config with percentage rollout
        targeting: {
          enabled: true,
          rules: [],
          fallback: false,
          percentageRollout: {
            enabled: true,
            percentage: 50,
            attribute: 'userId'
          }
        }
      }

      // Mock hash function to return predictable values
      jest.spyOn(mockEvaluationEngine as any, 'hash')
        .mockReturnValue(25) // 25 < 50, so should be included

      const result = await flagsClient.evaluate('rollout-feature', {
        userId: 'user-123',
        environment: 'production',
        timestamp: new Date().toISOString()
      })

      expect(result.data.reason.kind).toBe('PERCENTAGE_ROLLOUT')
    })
  })

  describe('A/B testing', () => {
    it('should allocate users to experiment variants', async () => {
      const experiment: Experiment = {
        id: 'exp-1',
        name: 'Button Color Test',
        flagId: 'button-color',
        variants: [
          { id: 'v1', name: 'Blue', allocation: 50, flagValue: 'blue' },
          { id: 'v2', name: 'Red', allocation: 50, flagValue: 'red' }
        ],
        status: 'running',
        environment: 'production',
        projectId: 'proj-1'
      }

      // Test should consistently assign same user to same variant
      const context = {
        userId: 'user-123',
        environment: 'production',
        timestamp: new Date().toISOString()
      }

      const result1 = await flagsClient.evaluate('button-color', context)
      const result2 = await flagsClient.evaluate('button-color', context)

      expect(result1.data.value).toBe(result2.data.value)
      expect(['blue', 'red']).toContain(result1.data.value)
    })
  })
})
```

## 📊 Monitoring & Analytics

### Flag Usage Analytics
```typescript
interface FlagAnalytics {
  evaluations: Counter
  uniqueUsers: Counter
  valueDistribution: Counter
  evaluationLatency: Histogram
  cacheHitRate: Counter
}

class AnalyticsFeatureFlagsClient implements FeatureFlagsClient {
  constructor(
    private adapter: FeatureFlagsClient,
    private analytics: FlagAnalytics
  ) {}

  async evaluate(
    flagKey: string,
    context: FlagEvaluationContext,
    defaultValue?: FlagValue
  ): Promise<Result<FlagEvaluation>> {
    const startTime = Date.now()
    
    this.analytics.evaluations.inc({ 
      flag: flagKey, 
      environment: context.environment 
    })

    if (context.userId) {
      this.analytics.uniqueUsers.inc({ 
        flag: flagKey, 
        user: context.userId 
      })
    }

    const result = await this.adapter.evaluate(flagKey, context, defaultValue)

    if (result.ok) {
      this.analytics.valueDistribution.inc({
        flag: flagKey,
        value: String(result.data.value),
        reason: result.data.reason.kind
      })
    }

    this.analytics.evaluationLatency.observe(
      Date.now() - startTime,
      { flag: flagKey }
    )

    return result
  }
}
```

## 🗺️ Development Roadmap

### Phase 1: Core Feature Flags ✅
- [x] Basic flag evaluation
- [x] Simple targeting rules
- [x] Configuration management
- [x] Caching layer

### Phase 2: Advanced Targeting 🔄
- [ ] Complex targeting rules
- [ ] User segmentation
- [ ] Percentage rollouts
- [ ] Multi-variant flags

### Phase 3: Experimentation 📋
- [ ] A/B testing framework
- [ ] Statistical analysis
- [ ] Experiment lifecycle management
- [ ] Results reporting

### Phase 4: Enterprise Features 📋
- [ ] Approval workflows
- [ ] Advanced analytics
- [ ] Compliance controls
- [ ] Multi-environment management

---

The Feature Flags & Configuration Service provides powerful runtime control capabilities, enabling safe feature releases, experimentation, and dynamic configuration management across all environments.