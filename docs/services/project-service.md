# Project/Workspace Service

## 🎯 Purpose
Manages projects, workspaces, team collaboration, and access control for development environments.

## 📋 Service Overview

The Project Service handles the creation, management, and organization of development projects and workspaces. It provides team collaboration features, role-based permissions, and project lifecycle management.

### Key Responsibilities
- Project/workspace creation and management
- Team member management and invitations
- Role-based access control within projects
- Project settings and configuration
- Project templates and scaffolding
- Organization and team structure
- Project discovery and search

## 🔧 Technical Architecture

### Domain Model
```typescript
interface Project {
  id: string
  slug: string
  name: string
  description?: string
  organizationId?: string
  ownerId: string
  visibility: 'private' | 'internal' | 'public'
  status: 'active' | 'archived' | 'suspended'
  settings: ProjectSettings
  metadata: ProjectMetadata
  createdAt: string
  updatedAt: string
  archivedAt?: string
}

interface Organization {
  id: string
  slug: string
  name: string
  description?: string
  website?: string
  avatarUrl?: string
  settings: OrganizationSettings
  plan: 'free' | 'team' | 'enterprise'
  createdAt: string
  updatedAt: string
}

interface ProjectMember {
  id: string
  userId: string
  projectId: string
  role: ProjectRole
  permissions: Permission[]
  invitedBy: string
  joinedAt: string
  invitedAt: string
  status: 'pending' | 'active' | 'inactive'
}

interface ProjectInvitation {
  id: string
  projectId: string
  email: string
  role: ProjectRole
  invitedBy: string
  expiresAt: string
  token: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  createdAt: string
}

interface ProjectSettings {
  autoDeployment: boolean
  deploymentBranch: string
  environmentVariables: EnvironmentVariable[]
  buildCommand?: string
  outputDirectory?: string
  nodeVersion?: string
  timezone: string
  notifications: ProjectNotificationSettings
  integrations: ProjectIntegrations
}

interface ProjectMetadata {
  repository?: {
    url: string
    provider: 'github' | 'gitlab' | 'bitbucket'
    branch: string
  }
  framework?: string
  language?: string
  tags: string[]
  lastDeployment?: string
  deploymentCount: number
  collaboratorCount: number
}

interface EnvironmentVariable {
  key: string
  value: string
  isSecret: boolean
  description?: string
  environments: string[] // ['development', 'staging', 'production']
}

interface ProjectNotificationSettings {
  deploymentStatus: boolean
  memberChanges: boolean
  securityAlerts: boolean
  weeklyReports: boolean
}

interface ProjectIntegrations {
  github?: GitHubIntegration
  slack?: SlackIntegration
  discord?: DiscordIntegration
}

type ProjectRole = 'owner' | 'maintainer' | 'developer' | 'viewer'
```

### State Machine
```
┌─────────────┐    create     ┌──────────────┐
│   DRAFT      ──────────────→ │   ACTIVE     │
└─────────────┘                └──────────────┘
                                      │
                                archive │
                                      ▼
                               ┌──────────────┐
                               │   ARCHIVED   │
                               └──────────────┘
                                      │
                                restore │
                                      ▼
                               ┌──────────────┐
                               │   ACTIVE     │
                               └──────────────┘
```

## 📡 API Contract

### Core Interface
```typescript
interface ProjectClient {
  // Project Management
  createProject(request: CreateProjectRequest): Promise<Result<Project>>
  getProject(identifier: string): Promise<Result<Project | null>> // by id or slug
  listProjects(options?: ListProjectsOptions): Promise<Result<PaginatedResult<Project>>>
  updateProject(id: string, updates: UpdateProjectRequest): Promise<Result<Project>>
  archiveProject(id: string): Promise<Result<Project>>
  restoreProject(id: string): Promise<Result<Project>>
  deleteProject(id: string): Promise<Result<void>>
  
  // Organization Management
  createOrganization(request: CreateOrganizationRequest): Promise<Result<Organization>>
  getOrganization(identifier: string): Promise<Result<Organization | null>>
  updateOrganization(id: string, updates: UpdateOrganizationRequest): Promise<Result<Organization>>
  listOrganizationProjects(orgId: string, options?: ListProjectsOptions): Promise<Result<PaginatedResult<Project>>>
  
  // Member Management
  inviteMember(projectId: string, invitation: InviteMemberRequest): Promise<Result<ProjectInvitation>>
  acceptInvitation(token: string): Promise<Result<ProjectMember>>
  declineInvitation(token: string): Promise<Result<void>>
  removeMember(projectId: string, userId: string): Promise<Result<void>>
  updateMemberRole(projectId: string, userId: string, role: ProjectRole): Promise<Result<ProjectMember>>
  listMembers(projectId: string): Promise<Result<ProjectMember[]>>
  listInvitations(projectId: string): Promise<Result<ProjectInvitation[]>>
  
  // Settings Management
  updateSettings(projectId: string, settings: Partial<ProjectSettings>): Promise<Result<ProjectSettings>>
  getSettings(projectId: string): Promise<Result<ProjectSettings>>
  updateEnvironmentVariables(projectId: string, variables: EnvironmentVariable[]): Promise<Result<EnvironmentVariable[]>>
  
  // Project Discovery
  searchProjects(query: string, options?: SearchOptions): Promise<Result<PaginatedResult<Project>>>
  getProjectsByUser(userId: string): Promise<Result<Project[]>>
  getRecentProjects(limit?: number): Promise<Result<Project[]>>
  
  // Templates
  createFromTemplate(templateId: string, request: CreateFromTemplateRequest): Promise<Result<Project>>
  listTemplates(): Promise<Result<ProjectTemplate[]>>
}

interface CreateProjectRequest {
  name: string
  slug?: string
  description?: string
  organizationId?: string
  visibility?: 'private' | 'internal' | 'public'
  templateId?: string
  repository?: {
    url: string
    branch?: string
  }
  settings?: Partial<ProjectSettings>
}

interface UpdateProjectRequest {
  name?: string
  description?: string
  visibility?: 'private' | 'internal' | 'public'
  settings?: Partial<ProjectSettings>
}

interface InviteMemberRequest {
  email: string
  role: ProjectRole
  message?: string
}

interface ListProjectsOptions {
  organizationId?: string
  status?: 'active' | 'archived'
  visibility?: 'private' | 'internal' | 'public'
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastDeployment'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}
```

### Error Handling
```typescript
enum ProjectErrorCode {
  PROJECT_NOT_FOUND = 'project/not-found',
  PROJECT_ALREADY_EXISTS = 'project/already-exists',
  SLUG_UNAVAILABLE = 'project/slug-unavailable',
  INSUFFICIENT_PERMISSIONS = 'project/insufficient-permissions',
  MEMBER_ALREADY_EXISTS = 'project/member-already-exists',
  INVITATION_EXPIRED = 'project/invitation-expired',
  INVITATION_NOT_FOUND = 'project/invitation-not-found',
  ORGANIZATION_NOT_FOUND = 'project/organization-not-found',
  INVALID_ROLE = 'project/invalid-role',
  CANNOT_REMOVE_OWNER = 'project/cannot-remove-owner',
  RATE_LIMITED = 'project/rate-limited'
}
```

## 🔌 Implementation Strategy

### Supabase Adapter
```typescript
class SupabaseProjectAdapter implements ProjectClient {
  constructor(
    private supabase: SupabaseClient,
    private authClient: AuthClient
  ) {}

  async createProject(request: CreateProjectRequest): Promise<Result<Project>> {
    try {
      const user = await this.authClient.getCurrentUser()
      if (!user.ok || !user.data) {
        return { ok: false, error: { code: 'auth/unauthorized', message: 'User not authenticated' } }
      }

      // Generate slug if not provided
      const slug = request.slug || this.generateSlug(request.name)

      // Check slug availability
      const slugExists = await this.isSlugTaken(slug, request.organizationId)
      if (slugExists) {
        return { 
          ok: false, 
          error: { code: ProjectErrorCode.SLUG_UNAVAILABLE, message: 'Slug already taken' }
        }
      }

      const projectData = {
        name: request.name,
        slug,
        description: request.description,
        organization_id: request.organizationId,
        owner_id: user.data.id,
        visibility: request.visibility || 'private',
        status: 'active',
        settings: this.getDefaultSettings(request.settings),
        metadata: this.getDefaultMetadata(request.repository)
      }

      const { data, error } = await this.supabase
        .from('projects')
        .insert(projectData)
        .select('*')
        .single()

      if (error) {
        return { ok: false, error: this.mapSupabaseError(error) }
      }

      // Add owner as member
      await this.supabase
        .from('project_members')
        .insert({
          user_id: user.data.id,
          project_id: data.id,
          role: 'owner',
          status: 'active',
          joined_at: new Date().toISOString()
        })

      return { ok: true, data: this.mapToProject(data) }
    } catch (err) {
      return { ok: false, error: { code: 'project/create-failed', message: err.message } }
    }
  }

  async inviteMember(projectId: string, invitation: InviteMemberRequest): Promise<Result<ProjectInvitation>> {
    try {
      // Verify permissions
      const hasPermission = await this.checkProjectPermission(projectId, 'member:invite')
      if (!hasPermission) {
        return { 
          ok: false, 
          error: { code: ProjectErrorCode.INSUFFICIENT_PERMISSIONS, message: 'Cannot invite members' }
        }
      }

      // Check if user is already a member
      const { data: existingMember } = await this.supabase
        .from('project_members')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', this.getUserIdByEmail(invitation.email))
        .single()

      if (existingMember) {
        return { 
          ok: false, 
          error: { code: ProjectErrorCode.MEMBER_ALREADY_EXISTS, message: 'User already a member' }
        }
      }

      const invitationToken = this.generateInvitationToken()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      const { data, error } = await this.supabase
        .from('project_invitations')
        .insert({
          project_id: projectId,
          email: invitation.email,
          role: invitation.role,
          invited_by: (await this.authClient.getCurrentUser()).data?.id,
          expires_at: expiresAt.toISOString(),
          token: invitationToken,
          status: 'pending'
        })
        .select('*')
        .single()

      if (error) {
        return { ok: false, error: this.mapSupabaseError(error) }
      }

      // Send invitation email (via notification service)
      await this.sendInvitationEmail(data, invitation.message)

      return { ok: true, data: this.mapToInvitation(data) }
    } catch (err) {
      return { ok: false, error: { code: 'project/invitation-failed', message: err.message } }
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  private async isSlugTaken(slug: string, organizationId?: string): Promise<boolean> {
    const query = this.supabase
      .from('projects')
      .select('id')
      .eq('slug', slug)

    if (organizationId) {
      query.eq('organization_id', organizationId)
    } else {
      query.is('organization_id', null)
    }

    const { data } = await query.single()
    return !!data
  }

  private getDefaultSettings(overrides?: Partial<ProjectSettings>): ProjectSettings {
    return {
      autoDeployment: false,
      deploymentBranch: 'main',
      environmentVariables: [],
      timezone: 'UTC',
      notifications: {
        deploymentStatus: true,
        memberChanges: true,
        securityAlerts: true,
        weeklyReports: false
      },
      integrations: {},
      ...overrides
    }
  }
}
```

### Mock Adapter (Testing)
```typescript
class MockProjectAdapter implements ProjectClient {
  private projects = new Map<string, Project>()
  private members = new Map<string, ProjectMember[]>()
  private invitations = new Map<string, ProjectInvitation[]>()

  async createProject(request: CreateProjectRequest): Promise<Result<Project>> {
    const project: Project = {
      id: `proj_${Date.now()}`,
      slug: request.slug || this.generateSlug(request.name),
      name: request.name,
      description: request.description,
      organizationId: request.organizationId,
      ownerId: 'current-user-id',
      visibility: request.visibility || 'private',
      status: 'active',
      settings: this.getDefaultSettings(request.settings),
      metadata: this.getDefaultMetadata(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.projects.set(project.id, project)
    
    // Add owner as member
    const ownerMember: ProjectMember = {
      id: `member_${Date.now()}`,
      userId: project.ownerId,
      projectId: project.id,
      role: 'owner',
      permissions: [],
      invitedBy: project.ownerId,
      joinedAt: new Date().toISOString(),
      invitedAt: new Date().toISOString(),
      status: 'active'
    }

    this.members.set(project.id, [ownerMember])

    return { ok: true, data: project }
  }

  async inviteMember(projectId: string, invitation: InviteMemberRequest): Promise<Result<ProjectInvitation>> {
    const projectInvitation: ProjectInvitation = {
      id: `inv_${Date.now()}`,
      projectId,
      email: invitation.email,
      role: invitation.role,
      invitedBy: 'current-user-id',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      token: `token_${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString()
    }

    const invitations = this.invitations.get(projectId) || []
    invitations.push(projectInvitation)
    this.invitations.set(projectId, invitations)

    return { ok: true, data: projectInvitation }
  }
}
```

## 🔐 Security & Permissions

### Role-Based Access Control
```typescript
const PROJECT_PERMISSIONS = {
  // Project management
  'project:read': ['owner', 'maintainer', 'developer', 'viewer'],
  'project:update': ['owner', 'maintainer'],
  'project:delete': ['owner'],
  'project:archive': ['owner'],
  
  // Member management
  'member:invite': ['owner', 'maintainer'],
  'member:remove': ['owner', 'maintainer'],
  'member:update-role': ['owner'],
  
  // Settings management
  'settings:update': ['owner', 'maintainer'],
  'env-vars:read': ['owner', 'maintainer', 'developer'],
  'env-vars:update': ['owner', 'maintainer'],
  
  // Deployment permissions
  'deployment:trigger': ['owner', 'maintainer', 'developer'],
  'deployment:view': ['owner', 'maintainer', 'developer', 'viewer'],
  'deployment:cancel': ['owner', 'maintainer'],
  
  // Canvas permissions
  'canvas:create': ['owner', 'maintainer', 'developer'],
  'canvas:edit': ['owner', 'maintainer', 'developer'],
  'canvas:view': ['owner', 'maintainer', 'developer', 'viewer']
} as const

class PermissionChecker {
  hasPermission(
    userRole: ProjectRole, 
    permission: keyof typeof PROJECT_PERMISSIONS
  ): boolean {
    const allowedRoles = PROJECT_PERMISSIONS[permission]
    return allowedRoles.includes(userRole)
  }

  async checkProjectAccess(
    userId: string, 
    projectId: string, 
    permission: string
  ): Promise<boolean> {
    // Get user's role in project
    const member = await this.getMemberRole(userId, projectId)
    if (!member) return false

    return this.hasPermission(member.role, permission as any)
  }
}
```

### Row Level Security Policies
```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES organizations(id),
  owner_id UUID REFERENCES auth.users(id) NOT NULL,
  visibility TEXT CHECK (visibility IN ('private', 'internal', 'public')),
  status TEXT CHECK (status IN ('active', 'archived', 'suspended')),
  settings JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ,
  UNIQUE(slug, organization_id)
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Users can view projects they're members of
CREATE POLICY "Users can view accessible projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    -- Public projects
    visibility = 'public'
    OR
    -- User is a member
    id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    -- Internal projects within same organization
    (
      visibility = 'internal' 
      AND organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Only owners can update projects
CREATE POLICY "Project owners can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- Members table
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'maintainer', 'developer', 'viewer')),
  permissions JSONB DEFAULT '[]'::jsonb,
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  invited_at TIMESTAMPTZ DEFAULT now(),
  status TEXT CHECK (status IN ('pending', 'active', 'inactive')),
  UNIQUE(user_id, project_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project members they have access to"
  ON project_members FOR SELECT
  TO authenticated
  USING (
    project_id IN (
      SELECT project_id FROM project_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
```

## 🚀 Performance Optimization

### Caching Strategy
```typescript
interface ProjectCache {
  projects: Map<string, { data: Project; expires: number }>
  members: Map<string, { data: ProjectMember[]; expires: number }>
  permissions: Map<string, { data: boolean; expires: number }>
  userProjects: Map<string, { data: Project[]; expires: number }>
}

class CachedProjectClient implements ProjectClient {
  private cache: ProjectCache = {
    projects: new Map(),
    members: new Map(),
    permissions: new Map(),
    userProjects: new Map()
  }

  constructor(
    private adapter: ProjectClient,
    private cacheTTL: number = 5 * 60 * 1000 // 5 minutes
  ) {}

  async getProject(identifier: string): Promise<Result<Project | null>> {
    const cached = this.cache.projects.get(identifier)
    
    if (cached && cached.expires > Date.now()) {
      return { ok: true, data: cached.data }
    }

    const result = await this.adapter.getProject(identifier)
    
    if (result.ok && result.data) {
      this.cache.projects.set(identifier, {
        data: result.data,
        expires: Date.now() + this.cacheTTL
      })
      
      // Also cache by ID if identifier was slug
      if (identifier !== result.data.id) {
        this.cache.projects.set(result.data.id, {
          data: result.data,
          expires: Date.now() + this.cacheTTL
        })
      }
    }

    return result
  }

  async updateProject(id: string, updates: UpdateProjectRequest): Promise<Result<Project>> {
    const result = await this.adapter.updateProject(id, updates)
    
    if (result.ok) {
      // Invalidate caches
      this.cache.projects.delete(id)
      this.cache.projects.delete(result.data.slug)
      this.cache.userProjects.clear() // Clear all user project caches
    }

    return result
  }
}
```

### Database Optimization
```sql
-- Indexes for common queries
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_visibility_status ON projects(visibility, status);
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);

CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_role ON project_members(role);
CREATE INDEX idx_project_members_status ON project_members(status);

CREATE INDEX idx_project_invitations_token ON project_invitations(token);
CREATE INDEX idx_project_invitations_email ON project_invitations(email);
CREATE INDEX idx_project_invitations_expires_at ON project_invitations(expires_at);

-- Composite index for user project lookups
CREATE INDEX idx_project_members_user_project_status 
  ON project_members(user_id, project_id, status);

-- Full-text search index for project search
CREATE INDEX idx_projects_search ON projects 
  USING gin(to_tsvector('english', name || ' ' || coalesce(description, '')));
```

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('ProjectClient', () => {
  let projectClient: ProjectClient
  let mockAdapter: MockProjectAdapter

  beforeEach(() => {
    mockAdapter = new MockProjectAdapter()
    projectClient = mockAdapter
  })

  describe('createProject', () => {
    it('should create project with generated slug', async () => {
      const request: CreateProjectRequest = {
        name: 'My Awesome Project',
        description: 'A test project'
      }

      const result = await projectClient.createProject(request)

      expect(result.ok).toBe(true)
      expect(result.data.name).toBe('My Awesome Project')
      expect(result.data.slug).toBe('my-awesome-project')
      expect(result.data.status).toBe('active')
    })

    it('should use provided slug when available', async () => {
      const request: CreateProjectRequest = {
        name: 'My Project',
        slug: 'custom-slug'
      }

      const result = await projectClient.createProject(request)

      expect(result.ok).toBe(true)
      expect(result.data.slug).toBe('custom-slug')
    })
  })

  describe('inviteMember', () => {
    it('should create invitation with expiration', async () => {
      // First create a project
      const project = await projectClient.createProject({
        name: 'Test Project'
      })

      const invitation = await projectClient.inviteMember(project.data.id, {
        email: 'user@example.com',
        role: 'developer'
      })

      expect(invitation.ok).toBe(true)
      expect(invitation.data.email).toBe('user@example.com')
      expect(invitation.data.role).toBe('developer')
      expect(invitation.data.status).toBe('pending')
      expect(new Date(invitation.data.expiresAt).getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('permission checking', () => {
    it('should allow project owners to invite members', async () => {
      const checker = new PermissionChecker()
      
      const canInvite = checker.hasPermission('owner', 'member:invite')
      expect(canInvite).toBe(true)
    })

    it('should not allow viewers to update settings', async () => {
      const checker = new PermissionChecker()
      
      const canUpdate = checker.hasPermission('viewer', 'settings:update')
      expect(canUpdate).toBe(false)
    })
  })
})
```

### Integration Tests
```typescript
describe('Supabase Project Integration', () => {
  let supabaseClient: SupabaseClient
  let projectClient: SupabaseProjectAdapter

  beforeAll(async () => {
    supabaseClient = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_KEY)
    projectClient = new SupabaseProjectAdapter(supabaseClient, authClient)
  })

  it('should handle complete project workflow', async () => {
    // Create project
    const createResult = await projectClient.createProject({
      name: 'Integration Test Project',
      description: 'Testing project creation'
    })
    expect(createResult.ok).toBe(true)

    const projectId = createResult.data.id

    // Invite member
    const inviteResult = await projectClient.inviteMember(projectId, {
      email: 'test@example.com',
      role: 'developer'
    })
    expect(inviteResult.ok).toBe(true)

    // Update settings
    const settingsResult = await projectClient.updateSettings(projectId, {
      autoDeployment: true,
      deploymentBranch: 'develop'
    })
    expect(settingsResult.ok).toBe(true)

    // Verify final state
    const project = await projectClient.getProject(projectId)
    expect(project.ok).toBe(true)
    expect(project.data?.settings.autoDeployment).toBe(true)
  })
})
```

## 📊 Monitoring & Analytics

### Project Metrics
```typescript
interface ProjectMetrics {
  projectsCreated: Counter
  membersInvited: Counter
  invitationsAccepted: Counter
  projectsArchived: Counter
  settingsUpdated: Counter
  searchQueries: Counter
}

class InstrumentedProjectClient implements ProjectClient {
  constructor(
    private adapter: ProjectClient,
    private metrics: ProjectMetrics
  ) {}

  async createProject(request: CreateProjectRequest): Promise<Result<Project>> {
    const result = await this.adapter.createProject(request)
    
    if (result.ok) {
      this.metrics.projectsCreated.inc({
        visibility: result.data.visibility,
        has_organization: !!result.data.organizationId,
        from_template: !!request.templateId
      })
    }

    return result
  }

  async inviteMember(projectId: string, invitation: InviteMemberRequest): Promise<Result<ProjectInvitation>> {
    const result = await this.adapter.inviteMember(projectId, invitation)
    
    if (result.ok) {
      this.metrics.membersInvited.inc({
        role: invitation.role
      })
    }

    return result
  }
}
```

## 🗺️ Development Roadmap

### Phase 1: Core Project Management ✅
- [x] Project CRUD operations
- [x] Member management and invitations
- [x] Basic role-based permissions
- [x] Project settings management

### Phase 2: Enhanced Collaboration 🔄
- [ ] Organization management
- [ ] Advanced permission system
- [ ] Project templates and scaffolding
- [ ] Enhanced search and discovery

### Phase 3: Advanced Features 📋
- [ ] Project analytics dashboard
- [ ] Advanced integration management
- [ ] Automated project workflows
- [ ] Custom project roles

### Phase 4: Enterprise Features 📋
- [ ] SSO integration for organizations
- [ ] Advanced compliance and audit trails
- [ ] Multi-region project deployment
- [ ] Advanced project governance

## 🐛 Known Issues & Limitations

### Current Limitations
1. **Single Organization**: Users can only belong to one organization initially
2. **Limited Templates**: Basic project template system
3. **Simple Permissions**: Basic role-based permissions without fine-grained controls

### Technical Debt
1. **Slug Generation**: Need better conflict resolution for slug generation
2. **Member Synchronization**: Optimize member list updates for large projects
3. **Search Performance**: Implement better search indexing and ranking

### Future Enhancements
1. **Real-time Collaboration**: Live updates for project changes
2. **Project Analytics**: Detailed usage and performance metrics
3. **Advanced Workflows**: Custom project lifecycle management

---

The Project/Workspace Service provides comprehensive project management capabilities with team collaboration, access control, and project lifecycle management, forming the foundation for organizing development work within the platform.