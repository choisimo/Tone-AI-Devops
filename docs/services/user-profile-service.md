# User Profile Service

## 🎯 Purpose
Manages user metadata, preferences, and profile information beyond basic authentication data.

## 📋 Service Overview

The User Profile Service handles user-specific data that enhances the user experience, including display preferences, avatar management, personal settings, and customization options.

### Key Responsibilities
- User profile metadata management
- Avatar upload and management
- User preferences and settings
- Personal dashboard configuration
- Social profile links
- Timezone and localization settings

## 🔧 Technical Architecture

### Domain Model
```typescript
interface UserProfile {
  userId: string
  displayName?: string
  bio?: string
  jobTitle?: string
  company?: string
  location?: string
  website?: string
  socialLinks: SocialLink[]
  avatarUrl?: string
  preferences: UserPreferences
  settings: UserSettings
  createdAt: string
  updatedAt: string
}

interface SocialLink {
  platform: 'github' | 'twitter' | 'linkedin' | 'discord' | 'website'
  url: string
  verified?: boolean
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: string
  timezone: string
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
  timeFormat: '12h' | '24h'
  emailNotifications: EmailNotificationSettings
  pushNotifications: PushNotificationSettings
}

interface UserSettings {
  dashboardLayout: 'grid' | 'list'
  defaultProjectView: 'overview' | 'deployments' | 'canvas'
  sidebarCollapsed: boolean
  showOnboardingTips: boolean
  autoSaveInterval: number // in seconds
  maxRecentProjects: number
}

interface EmailNotificationSettings {
  deploymentUpdates: boolean
  projectInvitations: boolean
  weeklyDigest: boolean
  securityAlerts: boolean
  productUpdates: boolean
}

interface PushNotificationSettings {
  deploymentCompleted: boolean
  deploymentFailed: boolean
  collaborationUpdates: boolean
  mentions: boolean
}
```

## 📡 API Contract

### Core Interface
```typescript
interface UserProfileClient {
  // Profile Management
  getProfile(userId: string): Promise<Result<UserProfile | null>>
  getCurrentUserProfile(): Promise<Result<UserProfile | null>>
  createProfile(profile: CreateProfileRequest): Promise<Result<UserProfile>>
  updateProfile(updates: UpdateProfileRequest): Promise<Result<UserProfile>>
  deleteProfile(userId: string): Promise<Result<void>>
  
  // Avatar Management
  uploadAvatar(file: File): Promise<Result<AvatarUploadResult>>
  removeAvatar(): Promise<Result<void>>
  generateAvatarUrl(userId: string, size?: number): Promise<Result<string>>
  
  // Preferences & Settings
  updatePreferences(preferences: Partial<UserPreferences>): Promise<Result<UserPreferences>>
  updateSettings(settings: Partial<UserSettings>): Promise<Result<UserSettings>>
  resetSettings(): Promise<Result<UserSettings>>
  
  // Social Links
  addSocialLink(link: Omit<SocialLink, 'verified'>): Promise<Result<SocialLink>>
  updateSocialLink(platform: SocialLink['platform'], url: string): Promise<Result<SocialLink>>
  removeSocialLink(platform: SocialLink['platform']): Promise<Result<void>>
  verifySocialLink(platform: SocialLink['platform']): Promise<Result<SocialLink>>
  
  // Profile Discovery
  searchProfiles(query: string, options?: SearchOptions): Promise<Result<UserProfile[]>>
  getPublicProfile(userId: string): Promise<Result<PublicUserProfile>>
}

interface CreateProfileRequest {
  displayName: string
  bio?: string
  jobTitle?: string
  company?: string
  preferences?: Partial<UserPreferences>
}

interface UpdateProfileRequest {
  displayName?: string
  bio?: string
  jobTitle?: string
  company?: string
  location?: string
  website?: string
}

interface AvatarUploadResult {
  url: string
  thumbnailUrl: string
  size: number
  contentType: string
}

interface PublicUserProfile {
  userId: string
  displayName: string
  bio?: string
  avatarUrl?: string
  socialLinks: SocialLink[]
  joinedAt: string
}

interface SearchOptions {
  limit?: number
  offset?: number
  sortBy?: 'name' | 'joinedAt' | 'lastActive'
  sortOrder?: 'asc' | 'desc'
}
```

### Error Handling
```typescript
enum UserProfileErrorCode {
  PROFILE_NOT_FOUND = 'profile/not-found',
  PROFILE_ALREADY_EXISTS = 'profile/already-exists',
  INVALID_AVATAR_FORMAT = 'profile/invalid-avatar-format',
  AVATAR_TOO_LARGE = 'profile/avatar-too-large',
  SOCIAL_LINK_INVALID = 'profile/social-link-invalid',
  SOCIAL_LINK_ALREADY_EXISTS = 'profile/social-link-already-exists',
  VERIFICATION_FAILED = 'profile/verification-failed',
  RATE_LIMITED = 'profile/rate-limited'
}
```

## 🔌 Implementation Strategy

### Supabase Adapter
```typescript
class SupabaseUserProfileAdapter implements UserProfileClient {
  constructor(
    private supabase: SupabaseClient,
    private storageClient: SupabaseStorageAdapter
  ) {}

  async getProfile(userId: string): Promise<Result<UserProfile | null>> {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select(`
          *,
          social_links(*),
          preferences(*),
          settings(*)
        `)
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') { // Not found
        return { ok: false, error: this.mapSupabaseError(error) }
      }

      if (!data) {
        return { ok: true, data: null }
      }

      return { ok: true, data: this.mapToUserProfile(data) }
    } catch (err) {
      return { ok: false, error: { code: 'profile/unknown', message: err.message } }
    }
  }

  async uploadAvatar(file: File): Promise<Result<AvatarUploadResult>> {
    try {
      // Validate file
      if (!this.isValidImageFile(file)) {
        return { 
          ok: false, 
          error: { code: UserProfileErrorCode.INVALID_AVATAR_FORMAT, message: 'Invalid image format' }
        }
      }

      if (file.size > MAX_AVATAR_SIZE) {
        return { 
          ok: false, 
          error: { code: UserProfileErrorCode.AVATAR_TOO_LARGE, message: 'Avatar too large' }
        }
      }

      const userId = (await this.supabase.auth.getUser()).data.user?.id
      if (!userId) throw new Error('User not authenticated')

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}/${Date.now()}.${fileExt}`

      // Upload original
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('avatars')
        .upload(fileName, file, { 
          cacheControl: '3600',
          upsert: true 
        })

      if (uploadError) {
        return { ok: false, error: this.mapSupabaseError(uploadError) }
      }

      // Generate thumbnail
      const thumbnailFileName = `${userId}/thumbnail_${Date.now()}.${fileExt}`
      const thumbnail = await this.generateThumbnail(file, 150, 150)
      
      await this.supabase.storage
        .from('avatars')
        .upload(thumbnailFileName, thumbnail)

      // Get public URLs
      const { data: { publicUrl } } = this.supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const { data: { publicUrl: thumbnailUrl } } = this.supabase.storage
        .from('avatars')
        .getPublicUrl(thumbnailFileName)

      // Update profile
      await this.supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', userId)

      return {
        ok: true,
        data: {
          url: publicUrl,
          thumbnailUrl,
          size: file.size,
          contentType: file.type
        }
      }
    } catch (err) {
      return { ok: false, error: { code: 'profile/upload-failed', message: err.message } }
    }
  }

  private async generateThumbnail(file: File, width: number, height: number): Promise<Blob> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const img = new Image()

      img.onload = () => {
        canvas.width = width
        canvas.height = height
        
        // Calculate aspect ratio
        const aspectRatio = img.width / img.height
        let drawWidth = width
        let drawHeight = height

        if (aspectRatio > 1) {
          drawHeight = width / aspectRatio
        } else {
          drawWidth = height * aspectRatio
        }

        const offsetX = (width - drawWidth) / 2
        const offsetY = (height - drawHeight) / 2

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
        
        canvas.toBlob(resolve!, file.type, 0.8)
      }

      img.src = URL.createObjectURL(file)
    })
  }
}
```

### Mock Adapter (Testing)
```typescript
class MockUserProfileAdapter implements UserProfileClient {
  private profiles = new Map<string, UserProfile>()
  private socialLinks = new Map<string, SocialLink[]>()

  async getProfile(userId: string): Promise<Result<UserProfile | null>> {
    const profile = this.profiles.get(userId)
    return { ok: true, data: profile || null }
  }

  async createProfile(request: CreateProfileRequest): Promise<Result<UserProfile>> {
    const userId = 'mock-user-id'
    const profile: UserProfile = {
      userId,
      ...request,
      socialLinks: [],
      preferences: {
        theme: 'system',
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
        emailNotifications: this.getDefaultEmailNotifications(),
        pushNotifications: this.getDefaultPushNotifications(),
        ...request.preferences
      },
      settings: this.getDefaultSettings(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.profiles.set(userId, profile)
    return { ok: true, data: profile }
  }

  private getDefaultEmailNotifications(): EmailNotificationSettings {
    return {
      deploymentUpdates: true,
      projectInvitations: true,
      weeklyDigest: false,
      securityAlerts: true,
      productUpdates: false
    }
  }

  private getDefaultPushNotifications(): PushNotificationSettings {
    return {
      deploymentCompleted: true,
      deploymentFailed: true,
      collaborationUpdates: false,
      mentions: true
    }
  }

  private getDefaultSettings(): UserSettings {
    return {
      dashboardLayout: 'grid',
      defaultProjectView: 'overview',
      sidebarCollapsed: false,
      showOnboardingTips: true,
      autoSaveInterval: 30,
      maxRecentProjects: 10
    }
  }
}
```

## 🔐 Security & Privacy

### Data Privacy
```typescript
interface PrivacySettings {
  profileVisibility: 'public' | 'organization' | 'private'
  showEmail: boolean
  showLocation: boolean
  showSocialLinks: boolean
  allowProfileSearch: boolean
  allowDirectMessages: boolean
}

class PrivacyAwareProfileClient implements UserProfileClient {
  constructor(private adapter: UserProfileClient) {}

  async getPublicProfile(userId: string): Promise<Result<PublicUserProfile>> {
    const profileResult = await this.adapter.getProfile(userId)
    
    if (!profileResult.ok || !profileResult.data) {
      return profileResult as Result<PublicUserProfile>
    }

    const profile = profileResult.data
    const privacySettings = profile.settings.privacy || this.getDefaultPrivacySettings()

    // Filter data based on privacy settings
    const publicProfile: PublicUserProfile = {
      userId: profile.userId,
      displayName: profile.displayName,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      socialLinks: privacySettings.showSocialLinks ? profile.socialLinks : [],
      joinedAt: profile.createdAt
    }

    return { ok: true, data: publicProfile }
  }

  private getDefaultPrivacySettings(): PrivacySettings {
    return {
      profileVisibility: 'organization',
      showEmail: false,
      showLocation: false,
      showSocialLinks: true,
      allowProfileSearch: true,
      allowDirectMessages: false
    }
  }
}
```

### Row Level Security (RLS) Policies
```sql
-- User profiles table
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  bio TEXT,
  job_title TEXT,
  company TEXT,
  location TEXT,
  website TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own profiles
CREATE POLICY "Users can manage own profile"
  ON user_profiles
  USING (user_id = auth.uid());

-- Public profiles can be viewed by authenticated users
CREATE POLICY "Authenticated users can view public profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT user_id FROM user_privacy_settings 
      WHERE profile_visibility = 'public'
    )
  );

-- Social links table
CREATE TABLE user_social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);

ALTER TABLE user_social_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own social links"
  ON user_social_links
  USING (user_id = auth.uid());
```

## 🚀 Performance Optimization

### Caching Strategy
```typescript
interface ProfileCache {
  profiles: Map<string, { data: UserProfile; expires: number }>
  avatars: Map<string, { url: string; expires: number }>
  preferences: Map<string, { data: UserPreferences; expires: number }>
}

class CachedUserProfileClient implements UserProfileClient {
  private cache: ProfileCache = {
    profiles: new Map(),
    avatars: new Map(),
    preferences: new Map()
  }

  constructor(
    private adapter: UserProfileClient,
    private cacheTTL: number = 5 * 60 * 1000 // 5 minutes
  ) {}

  async getProfile(userId: string): Promise<Result<UserProfile | null>> {
    const cached = this.cache.profiles.get(userId)
    
    if (cached && cached.expires > Date.now()) {
      return { ok: true, data: cached.data }
    }

    const result = await this.adapter.getProfile(userId)
    
    if (result.ok && result.data) {
      this.cache.profiles.set(userId, {
        data: result.data,
        expires: Date.now() + this.cacheTTL
      })
    }

    return result
  }

  async updateProfile(updates: UpdateProfileRequest): Promise<Result<UserProfile>> {
    const result = await this.adapter.updateProfile(updates)
    
    if (result.ok) {
      // Invalidate cache
      const userId = result.data.userId
      this.cache.profiles.delete(userId)
      this.cache.preferences.delete(userId)
    }

    return result
  }
}
```

### Image Optimization
```typescript
interface AvatarProcessingOptions {
  sizes: number[] // [50, 100, 150, 300]
  formats: string[] // ['webp', 'jpeg']
  quality: number
}

class OptimizedAvatarProcessor {
  constructor(private options: AvatarProcessingOptions) {}

  async processAvatar(file: File, userId: string): Promise<ProcessedAvatar[]> {
    const results: ProcessedAvatar[] = []

    for (const size of this.options.sizes) {
      for (const format of this.options.formats) {
        const processed = await this.resizeAndConvert(file, size, format)
        const fileName = `${userId}/avatar_${size}x${size}.${format}`
        
        results.push({
          size,
          format,
          fileName,
          blob: processed,
          url: '' // Will be set after upload
        })
      }
    }

    return results
  }

  private async resizeAndConvert(
    file: File, 
    size: number, 
    format: string
  ): Promise<Blob> {
    // Implementation using canvas or WebAssembly image processing
    // This would handle resizing and format conversion
  }
}

interface ProcessedAvatar {
  size: number
  format: string
  fileName: string
  blob: Blob
  url: string
}
```

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('UserProfileClient', () => {
  let profileClient: UserProfileClient
  let mockAdapter: MockUserProfileAdapter

  beforeEach(() => {
    mockAdapter = new MockUserProfileAdapter()
    profileClient = mockAdapter
  })

  describe('createProfile', () => {
    it('should create profile with default preferences', async () => {
      const request: CreateProfileRequest = {
        displayName: 'John Doe',
        bio: 'Software Developer'
      }

      const result = await profileClient.createProfile(request)

      expect(result.ok).toBe(true)
      expect(result.data.displayName).toBe('John Doe')
      expect(result.data.preferences.theme).toBe('system')
      expect(result.data.settings.dashboardLayout).toBe('grid')
    })

    it('should merge custom preferences with defaults', async () => {
      const request: CreateProfileRequest = {
        displayName: 'Jane Doe',
        preferences: { theme: 'dark', language: 'ko' }
      }

      const result = await profileClient.createProfile(request)

      expect(result.ok).toBe(true)
      expect(result.data.preferences.theme).toBe('dark')
      expect(result.data.preferences.language).toBe('ko')
      expect(result.data.preferences.timezone).toBe('UTC') // Default
    })
  })

  describe('avatar management', () => {
    it('should validate image file format', async () => {
      const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' })
      
      const result = await profileClient.uploadAvatar(invalidFile)

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe(UserProfileErrorCode.INVALID_AVATAR_FORMAT)
    })

    it('should validate file size', async () => {
      const largeFile = new File([new ArrayBuffer(10 * 1024 * 1024)], 'large.jpg', { 
        type: 'image/jpeg' 
      })
      
      const result = await profileClient.uploadAvatar(largeFile)

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe(UserProfileErrorCode.AVATAR_TOO_LARGE)
    })
  })
})
```

### Integration Tests
```typescript
describe('Supabase UserProfile Integration', () => {
  let supabaseClient: SupabaseClient
  let profileClient: SupabaseUserProfileAdapter

  beforeAll(async () => {
    supabaseClient = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_KEY)
    profileClient = new SupabaseUserProfileAdapter(supabaseClient, storageAdapter)
  })

  it('should handle complete profile lifecycle', async () => {
    // Create profile
    const createResult = await profileClient.createProfile({
      displayName: 'Test User',
      bio: 'Integration test user'
    })
    expect(createResult.ok).toBe(true)

    // Upload avatar
    const avatarFile = new File(['fake-image'], 'avatar.jpg', { type: 'image/jpeg' })
    const uploadResult = await profileClient.uploadAvatar(avatarFile)
    expect(uploadResult.ok).toBe(true)

    // Update preferences
    const prefsResult = await profileClient.updatePreferences({
      theme: 'dark',
      language: 'es'
    })
    expect(prefsResult.ok).toBe(true)

    // Verify final state
    const profile = await profileClient.getCurrentUserProfile()
    expect(profile.ok).toBe(true)
    expect(profile.data?.avatarUrl).toBeDefined()
    expect(profile.data?.preferences.theme).toBe('dark')
  })
})
```

## 📊 Monitoring & Analytics

### Profile Metrics
```typescript
interface ProfileMetrics {
  profilesCreated: Counter
  avatarsUploaded: Counter
  preferencesUpdated: Counter
  profileViews: Counter
  searchQueries: Counter
}

class InstrumentedUserProfileClient implements UserProfileClient {
  constructor(
    private adapter: UserProfileClient,
    private metrics: ProfileMetrics
  ) {}

  async createProfile(request: CreateProfileRequest): Promise<Result<UserProfile>> {
    const result = await this.adapter.createProfile(request)
    
    if (result.ok) {
      this.metrics.profilesCreated.inc()
    }

    return result
  }

  async uploadAvatar(file: File): Promise<Result<AvatarUploadResult>> {
    const result = await this.adapter.uploadAvatar(file)
    
    if (result.ok) {
      this.metrics.avatarsUploaded.inc({
        file_size_mb: (file.size / (1024 * 1024)).toFixed(1),
        file_type: file.type
      })
    }

    return result
  }
}
```

### User Behavior Analytics
```typescript
interface ProfileAnalytics {
  trackProfileUpdate(userId: string, fields: string[]): void
  trackAvatarUpload(userId: string, fileSize: number, fileType: string): void
  trackPreferencesChange(userId: string, changes: Record<string, any>): void
  trackProfileView(viewerUserId: string, targetUserId: string): void
}

class AnalyticsUserProfileClient implements UserProfileClient {
  constructor(
    private adapter: UserProfileClient,
    private analytics: ProfileAnalytics
  ) {}

  async updateProfile(updates: UpdateProfileRequest): Promise<Result<UserProfile>> {
    const result = await this.adapter.updateProfile(updates)
    
    if (result.ok) {
      this.analytics.trackProfileUpdate(
        result.data.userId,
        Object.keys(updates)
      )
    }

    return result
  }
}
```

## 🗺️ Development Roadmap

### Phase 1: Core Profile Management ✅
- [x] Basic profile CRUD operations
- [x] Avatar upload and management
- [x] User preferences system
- [x] Privacy settings

### Phase 2: Enhanced Features 🔄
- [ ] Social link verification
- [ ] Profile search and discovery
- [ ] Custom profile themes
- [ ] Profile completion tracking

### Phase 3: Advanced Personalization 📋
- [ ] AI-powered profile suggestions
- [ ] Integration with external services
- [ ] Advanced privacy controls
- [ ] Profile analytics dashboard

### Phase 4: Social Features 📋
- [ ] Profile following/connections
- [ ] Activity feeds
- [ ] Profile badges and achievements
- [ ] Team profile pages

## 🐛 Known Issues & Limitations

### Current Limitations
1. **Avatar Formats**: Limited to common image formats (JPEG, PNG, WebP)
2. **File Size**: Maximum 5MB avatar size
3. **Social Verification**: Manual verification process only

### Technical Debt
1. **Image Processing**: Client-side processing may be slow for large images
2. **Cache Invalidation**: Need distributed cache invalidation for profile updates
3. **Search Performance**: Profile search needs full-text search optimization

### Future Enhancements
1. **Real-time Updates**: Live profile updates for connected users
2. **Bulk Operations**: Batch profile updates for administrative purposes
3. **Export/Import**: Profile data portability features

---

The User Profile Service provides comprehensive user personalization and metadata management, enabling a rich user experience while maintaining privacy and security standards.