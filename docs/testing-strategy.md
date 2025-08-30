# Testing Strategy

## 🎯 Overview

The testing strategy for the Tone AI DevOps platform follows a comprehensive pyramid approach, ensuring high-quality, reliable, and maintainable code across all services while minimizing testing costs and maximizing coverage effectiveness.

## 🏗️ Testing Pyramid

```
                    E2E Tests (Few)
                   ┌─────────────────┐
                  │   User Journeys   │
                 └─────────────────────┘
               Integration Tests (Some)
              ┌─────────────────────────┐
             │  Service Interactions    │
            └───────────────────────────┘
          Component/Unit Tests (Many)
         ┌─────────────────────────────────┐
        │  Business Logic & Components     │
       └───────────────────────────────────┘
```

## 🧪 Testing Levels

### Unit Tests (70% of tests)
**Purpose**: Test individual functions, components, and business logic in isolation

**Coverage Targets**:
- Service business logic: 95%
- Utility functions: 100%
- React components: 85%
- Data transformations: 95%

**Tools & Framework**:
- **Jest** for test runner and assertions
- **React Testing Library** for component testing
- **MSW (Mock Service Worker)** for API mocking
- **@testing-library/user-event** for user interaction simulation

**Examples**:
```typescript
// Service unit test
describe('AuthService', () => {
  it('should validate email format', () => {
    const authService = new AuthService()
    expect(authService.isValidEmail('test@example.com')).toBe(true)
    expect(authService.isValidEmail('invalid-email')).toBe(false)
  })
})

// Component unit test
describe('DeploymentLogs', () => {
  it('should display logs in chronological order', () => {
    const mockLogs = [
      { timestamp: '2024-01-01T12:00:00Z', message: 'Build started' },
      { timestamp: '2024-01-01T12:01:00Z', message: 'Build completed' }
    ]
    
    render(<DeploymentLogs logs={mockLogs} />)
    
    const logMessages = screen.getAllByTestId('log-message')
    expect(logMessages[0]).toHaveTextContent('Build started')
    expect(logMessages[1]).toHaveTextContent('Build completed')
  })
})
```

### Integration Tests (20% of tests)
**Purpose**: Test interactions between services, adapters, and external systems

**Coverage Targets**:
- Service adapters: 80%
- Database interactions: 90%
- External API integrations: 85%

**Tools & Framework**:
- **Jest** with real database connections
- **Testcontainers** for isolated database testing
- **Supabase Test Client** for database integration
- **Nock** for HTTP API mocking

**Examples**:
```typescript
// Database integration test
describe('ProjectService Integration', () => {
  let supabaseClient: SupabaseClient
  let projectService: ProjectService

  beforeEach(async () => {
    // Use test database
    supabaseClient = createTestSupabaseClient()
    projectService = new SupabaseProjectAdapter(supabaseClient)
  })

  it('should create project with proper database constraints', async () => {
    const result = await projectService.createProject({
      name: 'Test Project',
      slug: 'test-project'
    })

    expect(result.ok).toBe(true)
    
    // Verify database state
    const { data } = await supabaseClient
      .from('projects')
      .select('*')
      .eq('slug', 'test-project')
      .single()

    expect(data.name).toBe('Test Project')
  })
})
```

### Contract Tests (5% of tests)
**Purpose**: Ensure service contracts are maintained across service boundaries

**Tools & Framework**:
- **Pact** for consumer-driven contract testing
- **JSON Schema** validation
- **OpenAPI** specification testing

**Examples**:
```typescript
// Contract test
describe('Deployment Service Contract', () => {
  it('should match expected API contract', async () => {
    const deploymentResponse = await deploymentClient.triggerDeployment({
      projectId: 'test-project',
      sourceRef: 'main'
    })

    expect(deploymentResponse).toMatchSchema(deploymentSchema)
    expect(deploymentResponse.data).toHaveProperty('id')
    expect(deploymentResponse.data).toHaveProperty('status')
  })
})
```

### End-to-End Tests (5% of tests)
**Purpose**: Test complete user journeys and critical business workflows

**Coverage Targets**:
- Critical user journeys: 100%
- Happy path scenarios: 95%
- Error scenarios: 80%

**Tools & Framework**:
- **Playwright** for browser automation
- **Docker Compose** for full environment setup
- **Test data factories** for consistent test data

**Examples**:
```typescript
// E2E test
test('Complete deployment workflow', async ({ page }) => {
  // Login
  await page.goto('/login')
  await page.fill('[data-testid=email]', 'user@example.com')
  await page.fill('[data-testid=password]', 'password')
  await page.click('[data-testid=login-button]')

  // Navigate to project
  await page.click('[data-testid=project-link]')
  
  // Trigger deployment
  await page.click('[data-testid=deploy-button]')
  
  // Verify deployment started
  await expect(page.locator('[data-testid=deployment-status]'))
    .toContainText('Deployment in progress')
    
  // Wait for completion (with timeout)
  await expect(page.locator('[data-testid=deployment-status]'))
    .toContainText('Deployment successful', { timeout: 30000 })
})
```

## 🎭 Testing Patterns

### Arrange-Act-Assert (AAA) Pattern
```typescript
test('should calculate deployment duration correctly', () => {
  // Arrange
  const startTime = '2024-01-01T12:00:00Z'
  const endTime = '2024-01-01T12:05:30Z'
  const deployment = createMockDeployment({ startTime, endTime })
  
  // Act
  const duration = calculateDeploymentDuration(deployment)
  
  // Assert
  expect(duration).toBe(330) // 5 minutes 30 seconds
})
```

### Given-When-Then (BDD Style)
```typescript
describe('Feature: User authentication', () => {
  test('Scenario: Valid credentials should log user in', async () => {
    // Given
    const user = await createTestUser({
      email: 'test@example.com',
      password: 'validPassword123'
    })
    
    // When
    const result = await authService.login({
      email: user.email,
      password: 'validPassword123'
    })
    
    // Then
    expect(result.ok).toBe(true)
    expect(result.data.user.id).toBe(user.id)
    expect(result.data.accessToken).toBeDefined()
  })
})
```

### Page Object Model (E2E)
```typescript
class ProjectPage {
  constructor(private page: Page) {}

  async navigateToProject(projectId: string) {
    await this.page.goto(`/projects/${projectId}`)
  }

  async triggerDeployment() {
    await this.page.click('[data-testid=deploy-button]')
  }

  async waitForDeploymentComplete() {
    await this.page.waitForSelector('[data-testid=deployment-success]')
  }

  getDeploymentStatus() {
    return this.page.locator('[data-testid=deployment-status]')
  }
}
```

## 🏭 Test Data Management

### Test Data Factories
```typescript
// Factory for creating consistent test data
class TestDataFactory {
  static createUser(overrides?: Partial<User>): User {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      displayName: faker.person.fullName(),
      createdAt: faker.date.recent().toISOString(),
      ...overrides
    }
  }

  static createProject(overrides?: Partial<Project>): Project {
    return {
      id: faker.string.uuid(),
      name: faker.company.name(),
      slug: faker.lorem.slug(),
      ownerId: faker.string.uuid(),
      createdAt: faker.date.recent().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
      ...overrides
    }
  }
}
```

### Database Test Utilities
```typescript
class DatabaseTestUtils {
  static async clearDatabase(): Promise<void> {
    // Clear all test data in proper order
    await testDb.delete().from('deployments')
    await testDb.delete().from('projects')
    await testDb.delete().from('users')
  }

  static async seedTestData(): Promise<TestDataSet> {
    const user = await testDb.insert('users').values(TestDataFactory.createUser())
    const project = await testDb.insert('projects').values(
      TestDataFactory.createProject({ ownerId: user.id })
    )
    
    return { user, project }
  }
}
```

## 🎯 Service-Specific Testing

### Auth Service Testing
```typescript
describe('Auth Service', () => {
  describe('Session Management', () => {
    it('should refresh expired tokens automatically', async () => {
      const expiredSession = createExpiredSession()
      jest.spyOn(authClient, 'getSession').mockResolvedValue({
        ok: true,
        data: expiredSession
      })

      const refreshedSession = await authClient.refreshSession()
      
      expect(refreshedSession.ok).toBe(true)
      expect(refreshedSession.data.expiresAt).toBeAfter(new Date())
    })
  })

  describe('Permission Checks', () => {
    it('should deny access for insufficient permissions', async () => {
      const user = createUserWithRole('viewer')
      
      const hasPermission = await authClient.hasPermission(
        'project:delete',
        { projectId: 'test-project', userId: user.id }
      )
      
      expect(hasPermission.data).toBe(false)
    })
  })
})
```

### Deployment Service Testing
```typescript
describe('Deployment Service', () => {
  describe('Log Streaming', () => {
    it('should stream logs in real-time', async () => {
      const deployment = await createTestDeployment()
      const logs: DeploymentLog[] = []
      
      const logStream = deploymentService.streamLogs(deployment.id)
      
      // Collect logs
      const collectPromise = (async () => {
        for await (const log of logStream) {
          logs.push(log)
          if (logs.length >= 3) break
        }
      })()
      
      // Emit test logs
      await emitDeploymentLog(deployment.id, 'Build started')
      await emitDeploymentLog(deployment.id, 'Tests running')
      await emitDeploymentLog(deployment.id, 'Deploy complete')
      
      await collectPromise
      
      expect(logs).toHaveLength(3)
      expect(logs.map(l => l.message)).toEqual([
        'Build started',
        'Tests running', 
        'Deploy complete'
      ])
    })
  })
})
```

### MagicCanvas Service Testing
```typescript
describe('MagicCanvas Service', () => {
  describe('Real-time Collaboration', () => {
    it('should sync operations between clients', async () => {
      const session = await createCanvasSession()
      const client1 = createCanvasClient('user1')
      const client2 = createCanvasClient('user2')
      
      const operationsReceived: CanvasOperation[] = []
      
      // Client 2 subscribes to operations
      const subscription = client2.subscribeToOperations(session.id)
      
      const collectOperations = (async () => {
        for await (const operation of subscription) {
          operationsReceived.push(operation)
          if (operationsReceived.length >= 2) break
        }
      })()
      
      // Client 1 performs operations
      await client1.addLayer(session.id, createTextLayer())
      await client1.updateLayer(session.id, 'layer1', { visible: false })
      
      await collectOperations
      
      expect(operationsReceived).toHaveLength(2)
      expect(operationsReceived[0].operationType).toBe('layer.create')
      expect(operationsReceived[1].operationType).toBe('layer.update')
    })
  })
})
```

## 🔄 Continuous Testing

### CI/CD Pipeline Testing
```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:coverage
      
  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:integration
      
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright install
      - run: npm run test:e2e
```

### Test Coverage Requirements
- **Unit Tests**: 85% overall, 95% for critical business logic
- **Integration Tests**: 80% for service adapters
- **E2E Tests**: 100% for critical user journeys
- **Branch Coverage**: 90% minimum
- **Mutation Testing**: 75% mutation score for core services

### Quality Gates
```typescript
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.stories.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    './src/services/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
}
```

## 🔍 Testing Tools & Infrastructure

### Test Environment Setup
```typescript
// test-setup.ts
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'

// Setup MSW server
export const server = setupServer(...handlers)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Setup test database
beforeEach(async () => {
  await DatabaseTestUtils.clearDatabase()
  await DatabaseTestUtils.seedTestData()
})
```

### Mock Service Handlers
```typescript
// mocks/handlers.ts
import { rest } from 'msw'

export const handlers = [
  rest.post('/api/auth/login', (req, res, ctx) => {
    const { email, password } = req.body
    
    if (email === 'test@example.com' && password === 'password') {
      return res(ctx.json({
        ok: true,
        data: {
          user: { id: '1', email: 'test@example.com' },
          accessToken: 'mock-token'
        }
      }))
    }
    
    return res(ctx.status(401), ctx.json({
      ok: false,
      error: { code: 'auth/invalid-credentials' }
    }))
  }),
]
```

### Performance Testing
```typescript
// performance.test.ts
describe('Performance Tests', () => {
  it('should handle high volume event ingestion', async () => {
    const startTime = Date.now()
    
    const events = Array.from({ length: 1000 }, (_, i) => ({
      eventName: 'test-event',
      userId: `user-${i % 10}`,
      properties: { index: i }
    }))
    
    await analyticsClient.trackBatch(events)
    
    const duration = Date.now() - startTime
    expect(duration).toBeLessThan(5000) // Should complete in under 5 seconds
  })
})
```

## 📊 Testing Metrics & Reporting

### Test Results Dashboard
- Test execution time trends
- Code coverage trends  
- Flaky test identification
- Performance regression detection

### Quality Metrics
- **MTTR (Mean Time To Recovery)**: Time to fix failing tests
- **Test Stability**: Percentage of non-flaky tests
- **Coverage Drift**: Coverage change over time
- **Performance Baseline**: Response time regressions

## 🚨 Testing Best Practices

### Do's
- Write tests first (TDD/BDD)
- Keep tests simple and focused
- Use descriptive test names
- Mock external dependencies
- Test edge cases and error conditions
- Maintain test data factories
- Run tests in CI/CD pipeline

### Don'ts  
- Don't test implementation details
- Don't ignore flaky tests
- Don't skip error scenarios
- Don't hardcode test data
- Don't make tests dependent on each other
- Don't test third-party library code
- Don't sacrifice test maintainability for coverage

---

This comprehensive testing strategy ensures high-quality, reliable software delivery while maintaining development velocity and enabling confident deployments across all services.