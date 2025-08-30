# Notification Service

## 🎯 Purpose
Provides unified notification delivery across multiple channels including in-app notifications, emails, push notifications, and webhooks.

## 📋 Service Overview

The Notification Service handles all user communication and alerting, providing a centralized system for managing notifications across different channels with user preferences, delivery tracking, and template management.

### Key Responsibilities
- Multi-channel notification delivery
- User notification preferences management
- Template-based message creation
- Delivery status tracking and retries
- Rate limiting and throttling
- Notification history and analytics

## 🔧 Technical Architecture

### Domain Model
```typescript
interface Notification {
  id: string
  userId: string
  type: NotificationType
  channel: NotificationChannel[]
  title: string
  body: string
  data?: Record<string, unknown>
  templateId?: string
  templateData?: Record<string, unknown>
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: NotificationStatus
  scheduledFor?: string
  deliveredAt?: string
  readAt?: string
  createdAt: string
  updatedAt: string
}

interface NotificationTemplate {
  id: string
  name: string
  type: NotificationType
  channel: NotificationChannel
  subject?: string // for email
  body: string
  variables: TemplateVariable[]
  locale: string
  active: boolean
  createdAt: string
  updatedAt: string
}

interface UserNotificationPreferences {
  userId: string
  preferences: ChannelPreferences
  timezone: string
  quietHours?: QuietHours
  frequency: NotificationFrequency
  updatedAt: string
}

interface ChannelPreferences {
  email: ChannelSetting
  push: ChannelSetting
  inApp: ChannelSetting
  sms?: ChannelSetting
}

interface ChannelSetting {
  enabled: boolean
  types: NotificationType[]
  priority: 'low' | 'normal' | 'high' | 'urgent'
}

type NotificationType = 
  | 'deployment.completed'
  | 'deployment.failed' 
  | 'project.invited'
  | 'canvas.shared'
  | 'security.alert'
  | 'system.maintenance'
  | 'billing.reminder'
  | 'feature.announcement'

type NotificationChannel = 'email' | 'push' | 'in-app' | 'sms' | 'webhook'
type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'expired'

interface NotificationFrequency {
  immediate: NotificationType[]
  batched: NotificationType[]
  daily: NotificationType[]
  weekly: NotificationType[]
}
```

## 📡 API Contract

### Core Interface
```typescript
interface NotificationClient {
  // Sending Notifications
  send(request: SendNotificationRequest): Promise<Result<Notification>>
  sendBatch(requests: SendNotificationRequest[]): Promise<Result<Notification[]>>
  schedule(request: ScheduleNotificationRequest): Promise<Result<Notification>>
  
  // Template Management
  createTemplate(template: CreateTemplateRequest): Promise<Result<NotificationTemplate>>
  updateTemplate(id: string, updates: UpdateTemplateRequest): Promise<Result<NotificationTemplate>>
  getTemplate(id: string): Promise<Result<NotificationTemplate | null>>
  renderTemplate(templateId: string, data: Record<string, unknown>): Promise<Result<RenderedTemplate>>
  
  // User Management
  getNotifications(userId: string, options?: GetNotificationsOptions): Promise<Result<PaginatedResult<Notification>>>
  markAsRead(userId: string, notificationIds: string[]): Promise<Result<void>>
  markAllAsRead(userId: string): Promise<Result<void>>
  deleteNotifications(userId: string, notificationIds: string[]): Promise<Result<void>>
  
  // Preferences Management
  getPreferences(userId: string): Promise<Result<UserNotificationPreferences>>
  updatePreferences(userId: string, preferences: Partial<UserNotificationPreferences>): Promise<Result<UserNotificationPreferences>>
  
  // Subscription Management
  subscribe(userId: string, subscription: PushSubscription): Promise<Result<void>>
  unsubscribe(userId: string, endpoint: string): Promise<Result<void>>
  
  // Analytics and Monitoring
  getDeliveryStats(options?: StatsOptions): Promise<Result<DeliveryStats>>
  getUnreadCount(userId: string): Promise<Result<number>>
  
  // Real-time
  subscribeToNotifications(userId: string): AsyncIterable<Notification>
}

interface SendNotificationRequest {
  userId: string | string[]
  type: NotificationType
  channels?: NotificationChannel[]
  title: string
  body: string
  data?: Record<string, unknown>
  templateId?: string
  templateData?: Record<string, unknown>
  priority?: 'low' | 'normal' | 'high' | 'urgent'
}

interface ScheduleNotificationRequest extends SendNotificationRequest {
  scheduledFor: string
  timezone?: string
}

interface RenderedTemplate {
  subject?: string
  body: string
  html?: string
}

interface DeliveryStats {
  sent: number
  delivered: number
  failed: number
  read: number
  byChannel: Record<NotificationChannel, ChannelStats>
  byType: Record<NotificationType, TypeStats>
}
```

## 🔌 Implementation Strategy

### Multi-Channel Delivery
```typescript
class SupabaseNotificationAdapter implements NotificationClient {
  constructor(
    private supabase: SupabaseClient,
    private channels: Map<NotificationChannel, NotificationChannelProvider>,
    private templateEngine: TemplateEngine
  ) {}

  async send(request: SendNotificationRequest): Promise<Result<Notification>> {
    try {
      const userIds = Array.isArray(request.userId) ? request.userId : [request.userId]
      const notifications: Notification[] = []

      for (const userId of userIds) {
        // Get user preferences
        const preferences = await this.getPreferences(userId)
        if (!preferences.ok) continue

        // Determine delivery channels
        const channels = this.determineChannels(request, preferences.data)
        if (channels.length === 0) continue

        // Create notification record
        const notification = await this.createNotification({
          ...request,
          userId,
          channels
        })

        if (!notification.ok) continue

        // Deliver through each channel
        const deliveryPromises = channels.map(channel => 
          this.deliverToChannel(notification.data, channel)
        )

        await Promise.allSettled(deliveryPromises)
        notifications.push(notification.data)
      }

      return { ok: true, data: notifications[0] }
    } catch (err) {
      return {
        ok: false,
        error: { code: 'notification/send-failed', message: err.message }
      }
    }
  }

  private async deliverToChannel(
    notification: Notification,
    channel: NotificationChannel
  ): Promise<Result<void>> {
    try {
      const provider = this.channels.get(channel)
      if (!provider) {
        return { ok: false, error: { code: 'notification/provider-not-found', message: 'Channel provider not configured' } }
      }

      const result = await provider.deliver(notification)
      
      if (result.ok) {
        await this.updateDeliveryStatus(notification.id, channel, 'delivered')
      } else {
        await this.updateDeliveryStatus(notification.id, channel, 'failed')
        // Schedule retry if appropriate
        this.scheduleRetry(notification, channel, result.error)
      }

      return result
    } catch (err) {
      await this.updateDeliveryStatus(notification.id, channel, 'failed')
      return { ok: false, error: { code: 'notification/delivery-failed', message: err.message } }
    }
  }

  private determineChannels(
    request: SendNotificationRequest,
    preferences: UserNotificationPreferences
  ): NotificationChannel[] {
    // Start with requested channels or all enabled channels
    const requestedChannels = request.channels || Object.keys(preferences.preferences) as NotificationChannel[]
    const availableChannels: NotificationChannel[] = []

    for (const channel of requestedChannels) {
      const channelPref = preferences.preferences[channel]
      
      if (!channelPref?.enabled) continue
      
      // Check if notification type is allowed for this channel
      if (!channelPref.types.includes(request.type)) continue
      
      // Check priority threshold
      const priorityLevel = this.getPriorityLevel(request.priority || 'normal')
      const channelPriorityLevel = this.getPriorityLevel(channelPref.priority)
      
      if (priorityLevel >= channelPriorityLevel) {
        availableChannels.push(channel)
      }
    }

    return availableChannels
  }

  private getPriorityLevel(priority: string): number {
    const levels = { low: 0, normal: 1, high: 2, urgent: 3 }
    return levels[priority] || 1
  }
}
```

### Channel Providers
```typescript
interface NotificationChannelProvider {
  deliver(notification: Notification): Promise<Result<DeliveryResult>>
  validateConfig(): Promise<Result<void>>
  getDeliveryStatus(notificationId: string): Promise<Result<DeliveryStatus>>
}

class EmailProvider implements NotificationChannelProvider {
  constructor(
    private apiKey: string,
    private fromEmail: string,
    private templateEngine: TemplateEngine
  ) {}

  async deliver(notification: Notification): Promise<Result<DeliveryResult>> {
    try {
      // Get user email
      const user = await this.getUserById(notification.userId)
      if (!user.ok || !user.data.email) {
        return { ok: false, error: { code: 'email/no-address', message: 'User has no email address' } }
      }

      // Render template if specified
      let subject = notification.title
      let htmlBody = notification.body
      let textBody = notification.body

      if (notification.templateId) {
        const rendered = await this.templateEngine.render(
          notification.templateId,
          'email',
          notification.templateData || {}
        )
        
        if (rendered.ok) {
          subject = rendered.data.subject || subject
          htmlBody = rendered.data.html || htmlBody
          textBody = rendered.data.text || textBody
        }
      }

      // Send email
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: user.data.email,
          subject,
          html: htmlBody,
          text: textBody,
          tags: [
            { name: 'type', value: notification.type },
            { name: 'priority', value: notification.priority }
          ]
        })
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          ok: false,
          error: { code: 'email/send-failed', message: data.message }
        }
      }

      return {
        ok: true,
        data: {
          externalId: data.id,
          deliveredAt: new Date().toISOString()
        }
      }
    } catch (err) {
      return {
        ok: false,
        error: { code: 'email/unknown-error', message: err.message }
      }
    }
  }
}

class PushProvider implements NotificationChannelProvider {
  constructor(
    private vapidKeys: { publicKey: string; privateKey: string },
    private gcmApiKey?: string
  ) {}

  async deliver(notification: Notification): Promise<Result<DeliveryResult>> {
    try {
      // Get user push subscriptions
      const subscriptions = await this.getUserPushSubscriptions(notification.userId)
      if (!subscriptions.length) {
        return { ok: false, error: { code: 'push/no-subscriptions', message: 'User has no push subscriptions' } }
      }

      const deliveryPromises = subscriptions.map(subscription =>
        this.sendToSubscription(subscription, notification)
      )

      const results = await Promise.allSettled(deliveryPromises)
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok).length

      if (successful === 0) {
        return { ok: false, error: { code: 'push/all-failed', message: 'All push deliveries failed' } }
      }

      return {
        ok: true,
        data: {
          deliveredAt: new Date().toISOString(),
          deliveredTo: successful
        }
      }
    } catch (err) {
      return {
        ok: false,
        error: { code: 'push/unknown-error', message: err.message }
      }
    }
  }

  private async sendToSubscription(
    subscription: PushSubscription,
    notification: Notification
  ): Promise<Result<void>> {
    const webpush = await import('web-push')
    
    webpush.setVapidDetails(
      'mailto:support@example.com',
      this.vapidKeys.publicKey,
      this.vapidKeys.privateKey
    )

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: notification.data,
      actions: this.getPushActions(notification.type)
    })

    try {
      await webpush.sendNotification(subscription, payload)
      return { ok: true, data: undefined }
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription is no longer valid, remove it
        await this.removeInvalidSubscription(subscription.endpoint)
      }
      return { ok: false, error: { code: 'push/send-failed', message: err.message } }
    }
  }
}
```

### Template Engine
```typescript
interface TemplateEngine {
  render(templateId: string, channel: NotificationChannel, data: Record<string, unknown>): Promise<Result<RenderedTemplate>>
  compile(template: string, data: Record<string, unknown>): Promise<Result<string>>
  validateTemplate(template: string): Promise<Result<TemplateValidation>>
}

class HandlebarsTemplateEngine implements TemplateEngine {
  private compiledTemplates = new Map<string, HandlebarsTemplate>()

  async render(
    templateId: string, 
    channel: NotificationChannel, 
    data: Record<string, unknown>
  ): Promise<Result<RenderedTemplate>> {
    try {
      const template = await this.getTemplate(templateId, channel)
      if (!template.ok) return template as Result<RenderedTemplate>

      const compiled = this.getCompiledTemplate(templateId, template.data)
      
      const rendered: RenderedTemplate = {
        body: compiled.body(data)
      }

      if (compiled.subject) {
        rendered.subject = compiled.subject(data)
      }

      if (compiled.html) {
        rendered.html = compiled.html(data)
      }

      return { ok: true, data: rendered }
    } catch (err) {
      return {
        ok: false,
        error: { code: 'template/render-failed', message: err.message }
      }
    }
  }

  private getCompiledTemplate(templateId: string, template: NotificationTemplate): CompiledTemplate {
    const cacheKey = `${templateId}:${template.updatedAt}`
    
    if (!this.compiledTemplates.has(cacheKey)) {
      const handlebars = require('handlebars')
      
      const compiled: CompiledTemplate = {
        body: handlebars.compile(template.body)
      }

      if (template.subject) {
        compiled.subject = handlebars.compile(template.subject)
      }

      // For email templates, check if body contains HTML
      if (this.isHtmlTemplate(template.body)) {
        compiled.html = compiled.body
        compiled.body = handlebars.compile(this.stripHtml(template.body))
      }

      this.compiledTemplates.set(cacheKey, compiled)
    }

    return this.compiledTemplates.get(cacheKey)!
  }
}
```

## 🚀 Performance Optimization

### Batching and Rate Limiting
```typescript
class BatchedNotificationProcessor {
  private queue: SendNotificationRequest[] = []
  private processing = false

  constructor(
    private client: NotificationClient,
    private batchSize: number = 100,
    private batchInterval: number = 5000 // 5 seconds
  ) {
    setInterval(() => this.processBatch(), this.batchInterval)
  }

  async enqueue(request: SendNotificationRequest): Promise<void> {
    this.queue.push(request)
    
    if (this.queue.length >= this.batchSize) {
      await this.processBatch()
    }
  }

  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) return

    this.processing = true
    
    try {
      const batch = this.queue.splice(0, this.batchSize)
      const grouped = this.groupByType(batch)

      // Process each notification type separately
      for (const [type, notifications] of Object.entries(grouped)) {
        await this.processTypeGroup(type as NotificationType, notifications)
      }
    } finally {
      this.processing = false
    }
  }

  private async processTypeGroup(
    type: NotificationType, 
    notifications: SendNotificationRequest[]
  ): Promise<void> {
    // Group users who can receive batched notifications
    const batchable = notifications.filter(n => this.canBatch(type, n))
    const immediate = notifications.filter(n => !this.canBatch(type, n))

    // Send immediate notifications
    for (const notification of immediate) {
      await this.client.send(notification)
    }

    // Create digest for batchable notifications
    if (batchable.length > 0) {
      await this.createDigest(type, batchable)
    }
  }

  private canBatch(type: NotificationType, notification: SendNotificationRequest): boolean {
    const batchableTypes: NotificationType[] = [
      'deployment.completed',
      'project.invited',
      'canvas.shared'
    ]
    
    return batchableTypes.includes(type) && 
           notification.priority !== 'urgent'
  }
}
```

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('NotificationClient', () => {
  let notificationClient: NotificationClient
  let mockEmailProvider: jest.Mocked<EmailProvider>

  beforeEach(() => {
    mockEmailProvider = {
      deliver: jest.fn(),
      validateConfig: jest.fn(),
      getDeliveryStatus: jest.fn()
    }
    
    notificationClient = new SupabaseNotificationAdapter(
      mockSupabase,
      new Map([['email', mockEmailProvider]]),
      mockTemplateEngine
    )
  })

  describe('send notification', () => {
    it('should deliver to enabled channels only', async () => {
      const mockPreferences = {
        userId: 'user-123',
        preferences: {
          email: { enabled: true, types: ['deployment.completed'], priority: 'normal' },
          push: { enabled: false, types: [], priority: 'normal' }
        }
      }

      jest.spyOn(notificationClient, 'getPreferences')
        .mockResolvedValue({ ok: true, data: mockPreferences })

      mockEmailProvider.deliver.mockResolvedValue({ 
        ok: true, 
        data: { deliveredAt: new Date().toISOString() } 
      })

      const result = await notificationClient.send({
        userId: 'user-123',
        type: 'deployment.completed',
        title: 'Deployment Complete',
        body: 'Your deployment has finished successfully'
      })

      expect(result.ok).toBe(true)
      expect(mockEmailProvider.deliver).toHaveBeenCalledTimes(1)
    })
  })
})
```

## 📊 Monitoring & Analytics

### Delivery Metrics
```typescript
interface NotificationMetrics {
  notificationsSent: Counter
  notificationsDelivered: Counter
  notificationsFailed: Counter
  deliveryLatency: Histogram
  templateRenders: Counter
  batchSize: Histogram
}
```

## 🗺️ Development Roadmap

### Phase 1: Core Notifications ✅
- [x] Multi-channel delivery
- [x] User preferences
- [x] Template system
- [x] Basic analytics

### Phase 2: Advanced Features 🔄
- [ ] Smart batching and digests
- [ ] A/B testing for templates
- [ ] Advanced scheduling
- [ ] Rich push notifications

### Phase 3: Intelligence 📋
- [ ] ML-based delivery optimization
- [ ] Personalized content
- [ ] Smart frequency capping
- [ ] Cross-channel orchestration

---

The Notification Service provides comprehensive communication capabilities with multi-channel delivery, user preferences, and intelligent optimization to ensure users receive the right information at the right time through their preferred channels.