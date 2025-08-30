# Artifact Service

## 🎯 Purpose
Manages build artifacts, file storage, and asset delivery for deployment outputs and user-generated content.

## 📋 Service Overview

The Artifact Service handles all file-based assets including build outputs, user uploads, images, documents, and other binary content. It provides secure storage, retrieval, and delivery through CDN integration.

### Key Responsibilities
- Build artifact storage and versioning
- User file uploads and management
- Secure file access with signed URLs
- CDN integration for fast delivery
- File metadata and indexing
- Storage optimization and cleanup
- Multi-format image processing

## 🔧 Technical Architecture

### Domain Model
```typescript
interface Artifact {
  id: string
  projectId?: string
  deploymentId?: string
  userId: string
  kind: ArtifactKind
  filename: string
  originalFilename: string
  mimeType: string
  size: number
  checksum: string
  metadata: ArtifactMetadata
  storageKey: string
  urls: ArtifactUrls
  status: 'uploading' | 'processing' | 'ready' | 'failed'
  createdAt: string
  updatedAt: string
  expiresAt?: string
}

interface ArtifactMetadata {
  width?: number
  height?: number
  duration?: number // for videos/audio
  pages?: number // for PDFs
  encoding?: string
  compression?: string
  processing?: ProcessingInfo
  tags: string[]
  description?: string
}

interface ArtifactUrls {
  public?: string
  signed?: string
  thumbnail?: string
  variants?: Record<string, string> // different sizes/formats
}

interface ProcessingInfo {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  variants: ProcessingVariant[]
  error?: string
}

interface ProcessingVariant {
  format: string
  size?: string
  quality?: number
  url?: string
}

type ArtifactKind = 
  | 'build-output'
  | 'source-map'
  | 'image'
  | 'document'
  | 'video'
  | 'audio'
  | 'archive'
  | 'font'
  | 'other'
```

### Storage Strategy
```typescript
interface StorageProvider {
  upload(key: string, data: Buffer | Stream, metadata: UploadMetadata): Promise<Result<UploadResult>>
  download(key: string): Promise<Result<Buffer | Stream>>
  delete(key: string): Promise<Result<void>>
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<Result<string>>
  copy(sourceKey: string, destKey: string): Promise<Result<void>>
  exists(key: string): Promise<Result<boolean>>
}

interface UploadMetadata {
  contentType: string
  contentLength: number
  contentEncoding?: string
  cacheControl?: string
  metadata?: Record<string, string>
}
```

## 📡 API Contract

### Core Interface
```typescript
interface ArtifactClient {
  // Upload Operations
  upload(request: UploadRequest): Promise<Result<Artifact>>
  uploadMultiple(requests: UploadRequest[]): Promise<Result<Artifact[]>>
  uploadFromUrl(url: string, options?: UploadFromUrlOptions): Promise<Result<Artifact>>
  
  // Retrieval Operations
  get(id: string): Promise<Result<Artifact | null>>
  getByDeployment(deploymentId: string): Promise<Result<Artifact[]>>
  getByProject(projectId: string, options?: ListArtifactsOptions): Promise<Result<PaginatedResult<Artifact>>>
  
  // URL Generation
  getPublicUrl(id: string): Promise<Result<string>>
  getSignedUrl(id: string, options?: SignedUrlOptions): Promise<Result<string>>
  getThumbnailUrl(id: string, size?: ThumbnailSize): Promise<Result<string>>
  
  // Processing Operations
  processImage(id: string, transformations: ImageTransformation[]): Promise<Result<Artifact[]>>
  generateThumbnail(id: string, options?: ThumbnailOptions): Promise<Result<Artifact>>
  
  // Management Operations
  update(id: string, updates: UpdateArtifactRequest): Promise<Result<Artifact>>
  delete(id: string): Promise<Result<void>>
  bulkDelete(ids: string[]): Promise<Result<void>>
  
  // Search and Discovery
  search(query: string, options?: SearchOptions): Promise<Result<PaginatedResult<Artifact>>>
  listByTag(tag: string): Promise<Result<Artifact[]>>
  
  // Storage Management
  getStorageUsage(projectId?: string): Promise<Result<StorageUsage>>
  cleanupExpired(): Promise<Result<CleanupResult>>
}

interface UploadRequest {
  file: File | Buffer | Stream
  projectId?: string
  deploymentId?: string
  filename?: string
  kind?: ArtifactKind
  metadata?: Partial<ArtifactMetadata>
  options?: UploadOptions
}

interface UploadOptions {
  public?: boolean
  expiresIn?: number // seconds
  generateThumbnail?: boolean
  processImages?: boolean
  compress?: boolean
}

interface ListArtifactsOptions {
  kind?: ArtifactKind[]
  status?: string[]
  tags?: string[]
  limit?: number
  offset?: number
  sortBy?: 'createdAt' | 'size' | 'filename'
  sortOrder?: 'asc' | 'desc'
}

interface ImageTransformation {
  type: 'resize' | 'crop' | 'rotate' | 'format' | 'quality'
  width?: number
  height?: number
  format?: 'jpeg' | 'png' | 'webp' | 'avif'
  quality?: number
  fit?: 'cover' | 'contain' | 'fill'
}

interface StorageUsage {
  totalSize: number
  totalFiles: number
  breakdown: Record<ArtifactKind, { size: number; count: number }>
  quota?: number
  quotaUsed?: number
}
```

## 🔌 Implementation Strategy

### Supabase Storage Adapter
```typescript
class SupabaseArtifactAdapter implements ArtifactClient {
  constructor(
    private supabase: SupabaseClient,
    private storageProvider: StorageProvider,
    private imageProcessor: ImageProcessor,
    private config: ArtifactConfig
  ) {}

  async upload(request: UploadRequest): Promise<Result<Artifact>> {
    try {
      // Validate file
      const validation = await this.validateUpload(request)
      if (!validation.ok) return validation as Result<Artifact>

      // Generate storage key
      const storageKey = this.generateStorageKey(request)
      const checksum = await this.calculateChecksum(request.file)

      // Check for duplicate
      if (this.config.deduplication) {
        const existing = await this.findByChecksum(checksum)
        if (existing.ok && existing.data) {
          return { ok: true, data: existing.data }
        }
      }

      // Create artifact record
      const artifact = await this.createArtifactRecord({
        ...request,
        storageKey,
        checksum,
        status: 'uploading'
      })

      if (!artifact.ok) return artifact

      try {
        // Upload to storage
        const uploadResult = await this.storageProvider.upload(
          storageKey,
          request.file,
          {
            contentType: artifact.data.mimeType,
            contentLength: artifact.data.size,
            metadata: {
              artifactId: artifact.data.id,
              projectId: request.projectId || '',
              uploadedBy: artifact.data.userId
            }
          }
        )

        if (!uploadResult.ok) {
          await this.updateArtifactStatus(artifact.data.id, 'failed')
          return uploadResult as Result<Artifact>
        }

        // Generate URLs
        const urls = await this.generateUrls(artifact.data, request.options?.public)

        // Update artifact with URLs and ready status
        const finalArtifact = await this.updateArtifact(artifact.data.id, {
          urls,
          status: 'ready'
        })

        // Post-processing (thumbnails, variants)
        this.schedulePostProcessing(finalArtifact.data, request.options)

        return finalArtifact
      } catch (uploadError) {
        await this.updateArtifactStatus(artifact.data.id, 'failed')
        throw uploadError
      }
    } catch (err) {
      return { 
        ok: false, 
        error: { code: 'artifact/upload-failed', message: err.message }
      }
    }
  }

  async processImage(
    id: string, 
    transformations: ImageTransformation[]
  ): Promise<Result<Artifact[]>> {
    try {
      const original = await this.get(id)
      if (!original.ok || !original.data) return original as Result<Artifact[]>

      if (!this.isImageArtifact(original.data)) {
        return {
          ok: false,
          error: { code: 'artifact/not-image', message: 'Artifact is not an image' }
        }
      }

      // Download original
      const downloadResult = await this.storageProvider.download(original.data.storageKey)
      if (!downloadResult.ok) return downloadResult as Result<Artifact[]>

      const variants: Artifact[] = []

      // Process each transformation
      for (const transformation of transformations) {
        const processed = await this.imageProcessor.transform(downloadResult.data, transformation)
        if (!processed.ok) continue

        // Upload variant
        const variantKey = `${original.data.storageKey}_${this.getTransformationSuffix(transformation)}`
        
        const uploadResult = await this.storageProvider.upload(
          variantKey,
          processed.data,
          {
            contentType: this.getOutputMimeType(transformation),
            contentLength: processed.data.length
          }
        )

        if (uploadResult.ok) {
          // Create variant artifact record
          const variant = await this.createVariantArtifact(original.data, transformation, variantKey)
          if (variant.ok) {
            variants.push(variant.data)
          }
        }
      }

      return { ok: true, data: variants }
    } catch (err) {
      return {
        ok: false,
        error: { code: 'artifact/processing-failed', message: err.message }
      }
    }
  }

  private async schedulePostProcessing(
    artifact: Artifact, 
    options?: UploadOptions
  ): Promise<void> {
    const tasks: Promise<any>[] = []

    // Generate thumbnail for images
    if (options?.generateThumbnail && this.isImageArtifact(artifact)) {
      tasks.push(this.generateThumbnail(artifact.id))
    }

    // Process images for different formats/sizes
    if (options?.processImages && this.isImageArtifact(artifact)) {
      const transformations: ImageTransformation[] = [
        { type: 'resize', width: 800, format: 'webp', quality: 80 },
        { type: 'resize', width: 400, format: 'webp', quality: 75 },
        { type: 'resize', width: 200, format: 'jpeg', quality: 70 }
      ]
      tasks.push(this.processImage(artifact.id, transformations))
    }

    // Execute all post-processing tasks
    await Promise.allSettled(tasks)
  }

  private generateStorageKey(request: UploadRequest): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2)
    const sanitizedFilename = this.sanitizeFilename(request.filename || 'unnamed')
    
    if (request.projectId) {
      return `projects/${request.projectId}/${timestamp}-${random}-${sanitizedFilename}`
    } else {
      return `uploads/${timestamp}-${random}-${sanitizedFilename}`
    }
  }

  private async calculateChecksum(file: File | Buffer | Stream): Promise<string> {
    const crypto = await import('crypto')
    const hash = crypto.createHash('sha256')

    if (file instanceof Buffer) {
      hash.update(file)
    } else if (file instanceof File) {
      const buffer = await file.arrayBuffer()
      hash.update(Buffer.from(buffer))
    } else {
      // Stream handling
      return new Promise((resolve, reject) => {
        file.on('data', (chunk) => hash.update(chunk))
        file.on('end', () => resolve(hash.digest('hex')))
        file.on('error', reject)
      })
    }

    return hash.digest('hex')
  }
}
```

### CDN Integration
```typescript
interface CDNProvider {
  invalidate(paths: string[]): Promise<Result<void>>
  preload(paths: string[]): Promise<Result<void>>
  getStats(path: string): Promise<Result<CDNStats>>
}

class CloudflareCDNAdapter implements CDNProvider {
  constructor(
    private apiToken: string,
    private zoneId: string
  ) {}

  async invalidate(paths: string[]): Promise<Result<void>> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ files: paths })
        }
      )

      if (!response.ok) {
        return {
          ok: false,
          error: { code: 'cdn/invalidation-failed', message: 'Failed to invalidate cache' }
        }
      }

      return { ok: true, data: undefined }
    } catch (err) {
      return { ok: false, error: { code: 'cdn/network-error', message: err.message } }
    }
  }
}
```

## 🚀 Performance Optimization

### Smart Caching
```typescript
class OptimizedArtifactClient implements ArtifactClient {
  private cache = new Map<string, { data: Artifact; expires: number }>()

  constructor(
    private adapter: ArtifactClient,
    private cdn: CDNProvider
  ) {}

  async getPublicUrl(id: string): Promise<Result<string>> {
    // Check cache first
    const cached = this.cache.get(`url:${id}`)
    if (cached && cached.expires > Date.now()) {
      return { ok: true, data: cached.data as string }
    }

    const result = await this.adapter.getPublicUrl(id)
    
    if (result.ok) {
      // Cache URL for 1 hour
      this.cache.set(`url:${id}`, {
        data: result.data as any,
        expires: Date.now() + 3600000
      })
    }

    return result
  }

  async delete(id: string): Promise<Result<void>> {
    const result = await this.adapter.delete(id)
    
    if (result.ok) {
      // Invalidate CDN cache
      const artifact = this.cache.get(id)
      if (artifact?.data) {
        await this.cdn.invalidate([artifact.data.urls.public].filter(Boolean))
      }
      
      // Clear local caches
      this.cache.delete(id)
      this.cache.delete(`url:${id}`)
    }

    return result
  }
}
```

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('ArtifactClient', () => {
  let artifactClient: ArtifactClient
  let mockStorage: MockStorageProvider

  beforeEach(() => {
    mockStorage = new MockStorageProvider()
    artifactClient = new MockArtifactAdapter(mockStorage)
  })

  describe('upload', () => {
    it('should upload file and return artifact', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      
      const result = await artifactClient.upload({
        file,
        projectId: 'proj-123',
        kind: 'document'
      })

      expect(result.ok).toBe(true)
      expect(result.data.filename).toBe('test.txt')
      expect(result.data.status).toBe('ready')
      expect(result.data.urls.public).toBeDefined()
    })

    it('should handle image processing', async () => {
      const imageFile = new File(['fake-image'], 'image.jpg', { type: 'image/jpeg' })
      
      const result = await artifactClient.upload({
        file: imageFile,
        kind: 'image',
        options: { processImages: true, generateThumbnail: true }
      })

      expect(result.ok).toBe(true)
      expect(result.data.urls.thumbnail).toBeDefined()
    })
  })
})
```

## 📊 Monitoring & Analytics

### Storage Metrics
```typescript
interface ArtifactMetrics {
  uploadsStarted: Counter
  uploadsCompleted: Counter
  uploadsFailed: Counter
  uploadSize: Histogram
  processingTime: Histogram
  storageUsed: Gauge
}
```

## 🗺️ Development Roadmap

### Phase 1: Core Storage ✅
- [x] File upload and retrieval
- [x] Basic metadata management
- [x] Signed URL generation

### Phase 2: Processing Pipeline 🔄
- [ ] Image transformation service
- [ ] Automatic thumbnail generation
- [ ] Video processing capabilities
- [ ] Document preview generation

### Phase 3: Advanced Features 📋
- [ ] Deduplication and compression
- [ ] Advanced search and tagging
- [ ] Collaborative file management
- [ ] Version control for artifacts

---

The Artifact Service provides comprehensive file and asset management with processing capabilities, forming the backbone for all file-related operations in the platform.