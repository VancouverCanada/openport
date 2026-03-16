import { BadRequestException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common'
import type {
  OpenPortAuthResponse,
  OpenPortCurrentUserResponse,
  OpenPortUser,
  OpenPortWorkspace
} from '@openport/product-contracts'
import { randomUUID } from 'node:crypto'
import { getHeaderValue, resolveBearerToken } from '../common/request-context.js'
import { IdentityStateService } from '../storage/identity-state.service.js'
import { WorkspacesService } from '../workspaces/workspaces.service.js'
import type { LoginDto } from './dto/login.dto.js'
import type { RefreshDto } from './dto/refresh.dto.js'
import type { RegisterDto } from './dto/register.dto.js'

type AuthUser = {
  id: string
  email: string
  name: string
  password: string
  defaultWorkspaceId: string
  createdAt: string
}

type AuthSession = {
  id: string
  userId: string
  accessToken: string
  refreshToken: string
  createdAt: string
  rememberMe: boolean
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly workspaces: WorkspacesService,
    private readonly identityStore: IdentityStateService
  ) {}

  private readonly usersByEmail = new Map<string, AuthUser>()
  private readonly sessionsByAccessToken = new Map<string, AuthSession>()
  private readonly sessionsByRefreshToken = new Map<string, AuthSession>()

  onModuleInit(): void {
    const users = this.identityStore.readUsers()
    users.forEach((user) => {
      this.usersByEmail.set(user.email, user)
    })

    const sessions = this.identityStore.readSessions()
    sessions.forEach((session) => {
      this.sessionsByAccessToken.set(session.accessToken, session)
      this.sessionsByRefreshToken.set(session.refreshToken, session)
    })
  }

  register(dto: RegisterDto): OpenPortAuthResponse {
    const email = dto.email.trim().toLowerCase()
    if (this.usersByEmail.has(email)) {
      throw new BadRequestException('Email already registered')
    }

    const user: AuthUser = {
      id: `user_${randomUUID()}`,
      email,
      name: dto.name.trim(),
      password: dto.password,
      defaultWorkspaceId: '',
      createdAt: new Date().toISOString()
    }
    user.defaultWorkspaceId = `ws_${user.id}`
    this.usersByEmail.set(email, user)
    this.persistUsers()

    const session = this.createSession(user.id, false)
    return this.buildAuthPayload(user, session, dto.workspaceName?.trim() || 'Personal Workspace')
  }

  login(dto: LoginDto): OpenPortAuthResponse {
    const email = dto.email.trim().toLowerCase()
    const user = this.usersByEmail.get(email)
    if (!user || user.password !== dto.password) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const session = this.createSession(user.id, dto.rememberMe === true)
    return this.buildAuthPayload(user, session, 'Personal Workspace')
  }

  refresh(dto: RefreshDto): OpenPortAuthResponse {
    const existing = this.sessionsByRefreshToken.get(dto.refreshToken)
    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    this.sessionsByRefreshToken.delete(existing.refreshToken)
    this.sessionsByAccessToken.delete(existing.accessToken)
    this.persistSessions()

    const rotated = this.createSession(existing.userId, existing.rememberMe)
    const user = this.requireUser(existing.userId)

    return this.buildAuthPayload(user, rotated, 'Personal Workspace')
  }

  logout(refreshToken: string | null): { ok: true } {
    if (refreshToken) {
      const session = this.sessionsByRefreshToken.get(refreshToken)
      if (session) {
        this.sessionsByRefreshToken.delete(refreshToken)
        this.sessionsByAccessToken.delete(session.accessToken)
        this.persistSessions()
      }
    }

    return { ok: true }
  }

  getCurrentUser(headers: Record<string, unknown>): OpenPortCurrentUserResponse {
    const token = resolveBearerToken(headers)
    if (!token) {
      throw new UnauthorizedException('Missing bearer token')
    }

    const session = this.sessionsByAccessToken.get(token)
    if (!session) {
      throw new UnauthorizedException('Invalid access token')
    }

    const user = this.requireUser(session.userId)
    const requestedWorkspaceId = getHeaderValue(headers, 'x-openport-workspace') || user.defaultWorkspaceId
    const activeWorkspace = this.workspaces.resolveWorkspaceForUser(user.id, requestedWorkspaceId)
    const workspaceRole = this.workspaces.getWorkspaceMemberRole(user.id, activeWorkspace.id)
    const permissions = this.workspaces.getWorkspaceModulePermissions(user.id, activeWorkspace.id)
    const workspaceCapabilities = this.workspaces.getWorkspaceResourceCapabilities(user.id, activeWorkspace.id)

    return {
      user: this.toContractUser(user),
      session: {
        id: session.id,
        createdAt: session.createdAt,
        rememberMe: session.rememberMe
      },
      role: workspaceRole === 'owner' || workspaceRole === 'admin' ? 'admin' : 'member',
      workspaceRole,
      permissions: {
        workspace: permissions,
        workspaceCapabilities
      }
    }
  }

  ensureDemoUser(userId: string): Record<string, unknown> {
    const demoEmail = `${userId}@demo.openport.local`
    const existing = this.usersByEmail.get(demoEmail)
    if (existing) {
      return existing
    }

    const user: AuthUser = {
      id: userId,
      email: demoEmail,
      name: 'Demo User',
      password: 'dev-password-123',
      defaultWorkspaceId: `ws_${userId}`,
      createdAt: new Date().toISOString()
    }
    this.usersByEmail.set(demoEmail, user)
    this.persistUsers()
    return user
  }

  getOrCreateUser(userId: string): OpenPortUser {
    const existing = [...this.usersByEmail.values()].find((item) => item.id === userId)
    if (existing) {
      return this.toContractUser(existing)
    }

    this.ensureDemoUser(userId)
    return this.toContractUser(this.requireUser(userId))
  }

  resolveUserByAccessToken(accessToken: string | null | undefined): OpenPortUser | null {
    const token = accessToken?.trim()
    if (!token) return null
    const session = this.sessionsByAccessToken.get(token)
    if (!session) return null
    return this.toContractUser(this.requireUser(session.userId))
  }

  private createSession(userId: string, rememberMe: boolean): AuthSession {
    const session: AuthSession = {
      id: `sess_${randomUUID()}`,
      userId,
      accessToken: `op_at_${randomUUID()}`,
      refreshToken: `op_rt_${randomUUID()}`,
      createdAt: new Date().toISOString(),
      rememberMe
    }
    this.sessionsByAccessToken.set(session.accessToken, session)
    this.sessionsByRefreshToken.set(session.refreshToken, session)
    this.persistSessions()
    return session
  }

  private buildAuthPayload(user: AuthUser, session: AuthSession, workspaceName: string): OpenPortAuthResponse {
    const workspace: OpenPortWorkspace = {
      id: user.defaultWorkspaceId,
      name: workspaceName
    }

    return {
      user: this.toContractUser(user),
      workspace,
      tokens: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        tokenType: 'Bearer'
      }
    }
  }

  private toContractUser(user: AuthUser): OpenPortUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      defaultWorkspaceId: user.defaultWorkspaceId,
      createdAt: user.createdAt
    }
  }

  private requireUser(userId: string): AuthUser {
    const user = [...this.usersByEmail.values()].find((item) => item.id === userId)
    if (!user) {
      throw new BadRequestException('User not found')
    }
    return user
  }

  private persistUsers(): void {
    this.identityStore.writeUsers([...this.usersByEmail.values()])
  }

  private persistSessions(): void {
    this.identityStore.writeSessions([...this.sessionsByAccessToken.values()])
  }
}
