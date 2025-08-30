# MagicCanvas Service

## 🎯 Purpose
Manages collaborative canvas sessions, layer-based editing, real-time synchronization, and AI-assisted content creation.

## 📋 Service Overview

The MagicCanvas Service enables collaborative design and visual editing with real-time synchronization, version control, and AI-powered assistance. It supports multiple users working simultaneously on canvas projects.

### Key Responsibilities
- Canvas session management and lifecycle
- Layer-based content organization
- Real-time collaborative editing
- Operation history and undo/redo
- AI-powered content generation
- Export and sharing capabilities
- Permission-based access control

## 🔧 Technical Architecture

### Domain Model
```typescript
interface CanvasSession {
  id: string
  projectId: string
  title: string
  description?: string
  createdBy: string
  collaborators: CanvasCollaborator[]
  settings: CanvasSettings
  metadata: CanvasMetadata
  status: 'active' | 'archived' | 'locked'
  createdAt: string
  updatedAt: string
  lastModifiedBy: string
}

interface CanvasLayer {
  id: string
  sessionId: string
  type: LayerType
  name: string
  data: LayerData
  style: LayerStyle
  transform: Transform
  visible: boolean
  locked: boolean
  opacity: number
  zIndex: number
  parentId?: string // for grouped layers
  createdAt: string
  updatedAt: string
  createdBy: string
}

interface CanvasOperation {
  id: string
  sessionId: string
  layerId?: string
  operationType: OperationType
  userId: string
  timestamp: string
  payload: OperationPayload
  metadata?: OperationMetadata
}

interface CanvasCollaborator {
  userId: string
  role: 'owner' | 'editor' | 'viewer'
  cursor?: CursorPosition
  selection?: SelectionState
  lastActiveAt: string
  color: string // for cursor and selection highlighting
}

interface CanvasSettings {
  dimensions: { width: number; height: number }
  backgroundColor: string
  gridEnabled: boolean
  snapToGrid: boolean
  gridSize: number
  zoom: number
  autoSave: boolean
  collaborationEnabled: boolean
  aiAssistanceEnabled: boolean
}

interface LayerData {
  // Text layer
  text?: {
    content: string
    fontFamily: string
    fontSize: number
    fontWeight: string
    textAlign: 'left' | 'center' | 'right'
  }
  
  // Shape layer
  shape?: {
    type: 'rectangle' | 'circle' | 'polygon' | 'line'
    points?: Point[]
    radius?: number
  }
  
  // Image layer
  image?: {
    artifactId: string
    url: string
    naturalWidth: number
    naturalHeight: number
  }
  
  // Drawing layer
  drawing?: {
    paths: DrawingPath[]
    brush: BrushSettings
  }
  
  // Group layer
  group?: {
    childIds: string[]
  }
}

interface LayerStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  borderRadius?: number
  shadow?: ShadowStyle
  blur?: number
  filters?: FilterEffect[]
}

interface Transform {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  scaleX: number
  scaleY: number
}

type OperationType = 
  | 'layer.create'
  | 'layer.update'
  | 'layer.delete'
  | 'layer.move'
  | 'layer.style'
  | 'session.update'
  | 'cursor.move'
  | 'selection.change'

interface OperationPayload {
  before?: any
  after?: any
  properties?: Record<string, any>
  position?: Point
  selection?: string[]
}

type LayerType = 'text' | 'shape' | 'image' | 'drawing' | 'group' | 'ai-generated'
```

### Real-time Architecture
```typescript
interface RealtimeChannel {
  sessionId: string
  subscribe(callback: (operation: CanvasOperation) => void): () => void
  broadcast(operation: CanvasOperation): Promise<void>
  presence: {
    track(state: PresenceState): Promise<void>
    untrack(): Promise<void>
    getState(): PresenceState[]
  }
}

interface PresenceState {
  userId: string
  cursor?: CursorPosition
  selection?: string[]
  activeLayer?: string
  color: string
}

interface CursorPosition {
  x: number
  y: number
  timestamp: string
}
```

## 📡 API Contract

### Core Interface
```typescript
interface MagicCanvasClient {
  // Session Management
  createSession(request: CreateCanvasSessionRequest): Promise<Result<CanvasSession>>
  getSession(id: string): Promise<Result<CanvasSession | null>>
  updateSession(id: string, updates: UpdateCanvasSessionRequest): Promise<Result<CanvasSession>>
  deleteSession(id: string): Promise<Result<void>>
  listSessions(projectId: string, options?: ListSessionsOptions): Promise<Result<PaginatedResult<CanvasSession>>>
  
  // Layer Management
  addLayer(sessionId: string, layer: CreateLayerRequest): Promise<Result<CanvasLayer>>
  updateLayer(sessionId: string, layerId: string, updates: UpdateLayerRequest): Promise<Result<CanvasLayer>>
  deleteLayer(sessionId: string, layerId: string): Promise<Result<void>>
  reorderLayers(sessionId: string, layerIds: string[]): Promise<Result<CanvasLayer[]>>
  duplicateLayer(sessionId: string, layerId: string): Promise<Result<CanvasLayer>>
  groupLayers(sessionId: string, layerIds: string[], groupName?: string): Promise<Result<CanvasLayer>>
  
  // Collaborative Operations
  applyOperation(sessionId: string, operation: Omit<CanvasOperation, 'id' | 'timestamp'>): Promise<Result<CanvasOperation>>
  subscribeToOperations(sessionId: string): AsyncIterable<CanvasOperation>
  
  // History and Versioning
  getHistory(sessionId: string, options?: HistoryOptions): Promise<Result<CanvasOperation[]>>
  createSnapshot(sessionId: string, name?: string): Promise<Result<CanvasSnapshot>>
  restoreSnapshot(sessionId: string, snapshotId: string): Promise<Result<CanvasSession>>
  
  // AI Integration
  generateContent(sessionId: string, request: AIGenerationRequest): Promise<Result<CanvasLayer>>
  enhanceLayer(sessionId: string, layerId: string, enhancement: AIEnhancementRequest): Promise<Result<CanvasLayer>>
  
  // Export and Sharing
  exportCanvas(sessionId: string, format: ExportFormat, options?: ExportOptions): Promise<Result<Artifact>>
  shareSession(sessionId: string, shareOptions: ShareOptions): Promise<Result<ShareLink>>
  
  // Collaboration
  inviteCollaborator(sessionId: string, invitation: CollaboratorInvitation): Promise<Result<CanvasCollaborator>>
  updateCollaboratorRole(sessionId: string, userId: string, role: CollaboratorRole): Promise<Result<CanvasCollaborator>>
  removeCollaborator(sessionId: string, userId: string): Promise<Result<void>>
  
  // Presence
  updatePresence(sessionId: string, presence: Partial<PresenceState>): Promise<Result<void>>
  getPresence(sessionId: string): Promise<Result<PresenceState[]>>
}

interface CreateCanvasSessionRequest {
  projectId: string
  title: string
  description?: string
  template?: string
  settings?: Partial<CanvasSettings>
}

interface CreateLayerRequest {
  type: LayerType
  name?: string
  data: LayerData
  style?: Partial<LayerStyle>
  transform?: Partial<Transform>
  parentId?: string
}

interface AIGenerationRequest {
  type: 'text' | 'image' | 'shape'
  prompt: string
  style?: string
  position?: Point
  constraints?: {
    maxWidth?: number
    maxHeight?: number
    colorPalette?: string[]
  }
}

interface ExportFormat {
  type: 'png' | 'jpg' | 'svg' | 'pdf' | 'json'
  quality?: number
  resolution?: number
}

type CollaboratorRole = 'owner' | 'editor' | 'viewer'
```

## 🔌 Implementation Strategy

### Supabase Real-time Adapter
```typescript
class SupabaseMagicCanvasAdapter implements MagicCanvasClient {
  constructor(
    private supabase: SupabaseClient,
    private aiService: AIService,
    private artifactClient: ArtifactClient
  ) {}

  async createSession(request: CreateCanvasSessionRequest): Promise<Result<CanvasSession>> {
    try {
      const currentUser = await this.getCurrentUser()
      if (!currentUser.ok) return currentUser as Result<CanvasSession>

      const session: Omit<CanvasSession, 'id' | 'createdAt' | 'updatedAt'> = {
        projectId: request.projectId,
        title: request.title,
        description: request.description,
        createdBy: currentUser.data.id,
        collaborators: [{
          userId: currentUser.data.id,
          role: 'owner',
          lastActiveAt: new Date().toISOString(),
          color: this.generateUserColor()
        }],
        settings: {
          dimensions: { width: 1920, height: 1080 },
          backgroundColor: '#ffffff',
          gridEnabled: true,
          snapToGrid: false,
          gridSize: 20,
          zoom: 1,
          autoSave: true,
          collaborationEnabled: true,
          aiAssistanceEnabled: true,
          ...request.settings
        },
        metadata: {
          layerCount: 0,
          collaboratorCount: 1,
          operationCount: 0
        },
        status: 'active',
        lastModifiedBy: currentUser.data.id
      }

      const { data, error } = await this.supabase
        .from('canvas_sessions')
        .insert(session)
        .select('*')
        .single()

      if (error) {
        return { ok: false, error: this.mapSupabaseError(error) }
      }

      return { ok: true, data: this.mapToCanvasSession(data) }
    } catch (err) {
      return {
        ok: false,
        error: { code: 'canvas/create-failed', message: err.message }
      }
    }
  }

  async addLayer(sessionId: string, layer: CreateLayerRequest): Promise<Result<CanvasLayer>> {
    try {
      const currentUser = await this.getCurrentUser()
      if (!currentUser.ok) return currentUser as Result<CanvasLayer>

      // Validate session access
      const hasAccess = await this.hasSessionAccess(sessionId, 'editor')
      if (!hasAccess) {
        return {
          ok: false,
          error: { code: 'canvas/insufficient-permissions', message: 'Cannot edit session' }
        }
      }

      const newLayer: Omit<CanvasLayer, 'id' | 'createdAt' | 'updatedAt'> = {
        sessionId,
        type: layer.type,
        name: layer.name || `${layer.type} layer`,
        data: layer.data,
        style: {
          fill: '#000000',
          stroke: 'transparent',
          strokeWidth: 0,
          ...layer.style
        },
        transform: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          ...layer.transform
        },
        visible: true,
        locked: false,
        opacity: 1,
        zIndex: await this.getNextZIndex(sessionId),
        parentId: layer.parentId,
        createdBy: currentUser.data.id
      }

      const { data, error } = await this.supabase
        .from('canvas_layers')
        .insert(newLayer)
        .select('*')
        .single()

      if (error) {
        return { ok: false, error: this.mapSupabaseError(error) }
      }

      const canvasLayer = this.mapToCanvasLayer(data)

      // Broadcast operation to collaborators
      await this.broadcastOperation(sessionId, {
        operationType: 'layer.create',
        userId: currentUser.data.id,
        layerId: canvasLayer.id,
        payload: { after: canvasLayer }
      })

      return { ok: true, data: canvasLayer }
    } catch (err) {
      return {
        ok: false,
        error: { code: 'canvas/add-layer-failed', message: err.message }
      }
    }
  }

  async subscribeToOperations(sessionId: string): AsyncIterable<CanvasOperation> {
    const channel = this.supabase.channel(`canvas-session:${sessionId}`)
    
    const operationQueue: CanvasOperation[] = []
    let resolveNext: ((value: IteratorResult<CanvasOperation>) => void) | null = null

    // Subscribe to real-time operations
    channel
      .on('broadcast', { event: 'operation' }, (payload) => {
        const operation = payload.payload as CanvasOperation
        
        if (resolveNext) {
          resolveNext({ value: operation, done: false })
          resolveNext = null
        } else {
          operationQueue.push(operation)
        }
      })
      .subscribe()

    return {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<CanvasOperation>> {
            if (operationQueue.length > 0) {
              const operation = operationQueue.shift()!
              return { value: operation, done: false }
            }

            return new Promise<IteratorResult<CanvasOperation>>((resolve) => {
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

  async generateContent(
    sessionId: string, 
    request: AIGenerationRequest
  ): Promise<Result<CanvasLayer>> {
    try {
      // Validate session access
      const hasAccess = await this.hasSessionAccess(sessionId, 'editor')
      if (!hasAccess) {
        return {
          ok: false,
          error: { code: 'canvas/insufficient-permissions', message: 'Cannot edit session' }
        }
      }

      // Generate content using AI service
      const aiResult = await this.aiService.generateContent(request)
      if (!aiResult.ok) return aiResult as Result<CanvasLayer>

      let layerData: LayerData

      if (request.type === 'text') {
        layerData = {
          text: {
            content: aiResult.data.text,
            fontFamily: 'Arial',
            fontSize: 16,
            fontWeight: 'normal',
            textAlign: 'left'
          }
        }
      } else if (request.type === 'image') {
        // Upload AI-generated image as artifact
        const uploadResult = await this.artifactClient.upload({
          file: aiResult.data.image,
          kind: 'image',
          filename: `ai-generated-${Date.now()}.png`
        })

        if (!uploadResult.ok) return uploadResult as Result<CanvasLayer>

        layerData = {
          image: {
            artifactId: uploadResult.data.id,
            url: uploadResult.data.urls.public!,
            naturalWidth: aiResult.data.width,
            naturalHeight: aiResult.data.height
          }
        }
      } else {
        return {
          ok: false,
          error: { code: 'canvas/unsupported-generation', message: 'Unsupported generation type' }
        }
      }

      // Create layer with AI-generated content
      const layerResult = await this.addLayer(sessionId, {
        type: request.type === 'image' ? 'image' : 'text',
        name: `AI Generated ${request.type}`,
        data: layerData,
        transform: request.position ? {
          x: request.position.x,
          y: request.position.y
        } : undefined
      })

      if (layerResult.ok) {
        // Mark as AI-generated
        await this.updateLayer(sessionId, layerResult.data.id, {
          metadata: { aiGenerated: true, prompt: request.prompt }
        })
      }

      return layerResult
    } catch (err) {
      return {
        ok: false,
        error: { code: 'canvas/ai-generation-failed', message: err.message }
      }
    }
  }

  private async broadcastOperation(
    sessionId: string, 
    operation: Omit<CanvasOperation, 'id' | 'timestamp' | 'sessionId'>
  ): Promise<void> {
    const fullOperation: CanvasOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      sessionId,
      timestamp: new Date().toISOString(),
      ...operation
    }

    // Store operation in database for history
    await this.supabase
      .from('canvas_operations')
      .insert(fullOperation)

    // Broadcast to real-time subscribers
    const channel = this.supabase.channel(`canvas-session:${sessionId}`)
    await channel.send({
      type: 'broadcast',
      event: 'operation',
      payload: fullOperation
    })
  }
}
```

### Operational Transform (OT) System
```typescript
class OperationalTransform {
  static transform(
    op1: CanvasOperation, 
    op2: CanvasOperation
  ): [CanvasOperation, CanvasOperation] {
    // Handle concurrent operations on the same layer
    if (op1.layerId === op2.layerId) {
      if (op1.operationType === 'layer.update' && op2.operationType === 'layer.update') {
        return this.transformLayerUpdates(op1, op2)
      } else if (op1.operationType === 'layer.move' && op2.operationType === 'layer.move') {
        return this.transformLayerMoves(op1, op2)
      }
    }

    // Handle z-index conflicts
    if (op1.operationType === 'layer.create' || op2.operationType === 'layer.create') {
      return this.transformZIndexConflicts(op1, op2)
    }

    // No transformation needed
    return [op1, op2]
  }

  private static transformLayerUpdates(
    op1: CanvasOperation, 
    op2: CanvasOperation
  ): [CanvasOperation, CanvasOperation] {
    // Merge non-conflicting property updates
    const mergedAfter = {
      ...op1.payload.after,
      ...op2.payload.after
    }

    const transformedOp1 = {
      ...op1,
      payload: { ...op1.payload, after: mergedAfter }
    }

    const transformedOp2 = {
      ...op2,
      payload: { ...op2.payload, before: mergedAfter }
    }

    return [transformedOp1, transformedOp2]
  }

  private static transformLayerMoves(
    op1: CanvasOperation, 
    op2: CanvasOperation
  ): [CanvasOperation, CanvasOperation] {
    // Last writer wins for position changes
    return [op1, op2] // op2 will override op1's position
  }
}
```

## 🚀 Performance Optimization

### Efficient Layer Rendering
```typescript
interface LayerRenderer {
  render(layer: CanvasLayer, context: RenderContext): Promise<void>
  getBounds(layer: CanvasLayer): Rectangle
  hitTest(layer: CanvasLayer, point: Point): boolean
}

class VirtualizedCanvas {
  private visibleLayers = new Set<string>()
  private renderCache = new Map<string, ImageBitmap>()

  constructor(
    private viewport: Rectangle,
    private layers: CanvasLayer[]
  ) {}

  updateViewport(newViewport: Rectangle): void {
    this.viewport = newViewport
    this.updateVisibleLayers()
  }

  private updateVisibleLayers(): void {
    this.visibleLayers.clear()
    
    for (const layer of this.layers) {
      if (!layer.visible) continue

      const bounds = this.getLayerBounds(layer)
      if (this.rectanglesIntersect(bounds, this.viewport)) {
        this.visibleLayers.add(layer.id)
      }
    }
  }

  async render(context: CanvasRenderingContext2D): Promise<void> {
    // Only render visible layers
    for (const layer of this.layers) {
      if (!this.visibleLayers.has(layer.id)) continue

      // Check cache first
      const cached = this.renderCache.get(layer.id)
      if (cached && !this.hasLayerChanged(layer)) {
        context.drawImage(cached, layer.transform.x, layer.transform.y)
        continue
      }

      // Render and cache
      const bitmap = await this.renderLayerToBitmap(layer)
      this.renderCache.set(layer.id, bitmap)
      context.drawImage(bitmap, layer.transform.x, layer.transform.y)
    }
  }
}
```

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('MagicCanvasClient', () => {
  let canvasClient: MagicCanvasClient
  let mockAdapter: MockMagicCanvasAdapter

  beforeEach(() => {
    mockAdapter = new MockMagicCanvasAdapter()
    canvasClient = mockAdapter
  })

  describe('collaborative operations', () => {
    it('should handle concurrent layer updates', async () => {
      const session = await canvasClient.createSession({
        projectId: 'proj-123',
        title: 'Test Canvas'
      })

      const layer = await canvasClient.addLayer(session.data.id, {
        type: 'text',
        data: { text: { content: 'Hello', fontFamily: 'Arial', fontSize: 16, fontWeight: 'normal', textAlign: 'left' } }
      })

      // Simulate concurrent updates from two users
      const update1 = canvasClient.updateLayer(session.data.id, layer.data.id, {
        data: { text: { content: 'Hello World' } }
      })

      const update2 = canvasClient.updateLayer(session.data.id, layer.data.id, {
        style: { fill: '#ff0000' }
      })

      const [result1, result2] = await Promise.all([update1, update2])

      expect(result1.ok).toBe(true)
      expect(result2.ok).toBe(true)
      
      // Both updates should be applied
      const finalLayer = await canvasClient.getLayer(session.data.id, layer.data.id)
      expect(finalLayer.data.data.text.content).toBe('Hello World')
      expect(finalLayer.data.style.fill).toBe('#ff0000')
    })
  })

  describe('AI integration', () => {
    it('should generate content and create layer', async () => {
      const session = await canvasClient.createSession({
        projectId: 'proj-123',
        title: 'AI Test Canvas'
      })

      const mockAIService = {
        generateContent: jest.fn().mockResolvedValue({
          ok: true,
          data: { text: 'AI generated content' }
        })
      }

      const result = await canvasClient.generateContent(session.data.id, {
        type: 'text',
        prompt: 'Generate a welcome message'
      })

      expect(result.ok).toBe(true)
      expect(result.data.type).toBe('text')
      expect(result.data.data.text.content).toBe('AI generated content')
    })
  })
})
```

### Real-time Testing
```typescript
describe('Real-time collaboration', () => {
  it('should sync operations between clients', async (done) => {
    const client1 = new MagicCanvasClient()
    const client2 = new MagicCanvasClient()

    const session = await client1.createSession({
      projectId: 'proj-123',
      title: 'Collaboration Test'
    })

    // Client 2 subscribes to operations
    const operations: CanvasOperation[] = []
    const subscription = client2.subscribeToOperations(session.data.id)

    const collectOperations = (async () => {
      for await (const operation of subscription) {
        operations.push(operation)
        if (operations.length >= 2) break
      }
    })()

    // Client 1 performs operations
    await client1.addLayer(session.data.id, {
      type: 'text',
      data: { text: { content: 'Test', fontFamily: 'Arial', fontSize: 16, fontWeight: 'normal', textAlign: 'left' } }
    })

    await client1.updateSession(session.data.id, {
      title: 'Updated Title'
    })

    await collectOperations

    expect(operations).toHaveLength(2)
    expect(operations[0].operationType).toBe('layer.create')
    expect(operations[1].operationType).toBe('session.update')
    done()
  })
})
```

## 📊 Monitoring & Analytics

### Canvas Metrics
```typescript
interface CanvasMetrics {
  sessionsCreated: Counter
  layersCreated: Counter
  operationsApplied: Counter
  collaboratorJoins: Counter
  aiGenerations: Counter
  exportRequests: Counter
  renderTime: Histogram
}
```

## 🗺️ Development Roadmap

### Phase 1: Core Canvas ✅
- [x] Basic canvas session management
- [x] Layer creation and manipulation
- [x] Real-time synchronization
- [x] Simple collaboration

### Phase 2: Advanced Features 🔄
- [ ] AI content generation
- [ ] Advanced drawing tools
- [ ] Vector graphics support
- [ ] Export capabilities

### Phase 3: Collaboration Enhancement 📋
- [ ] Video cursors and voice chat
- [ ] Advanced permission system
- [ ] Canvas templates and libraries
- [ ] Version control and branching

### Phase 4: Enterprise Features 📋
- [ ] Large-scale collaboration
- [ ] Advanced AI assistance
- [ ] Integration with design tools
- [ ] White-label solutions

---

The MagicCanvas Service enables powerful collaborative design capabilities with real-time synchronization, AI assistance, and comprehensive layer management, forming the creative core of the platform.