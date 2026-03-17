import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { Pool } from 'pg'
import type {
  OpenPortWorkspaceCapabilityPolicy,
  OpenPortWorkspaceInvite,
  OpenPortWorkspaceMember,
  OpenPortWorkspace
} from '@openport/product-contracts'

export type OpenPortAuthUserRecord = {
  id: string
  email: string
  name: string
  password: string
  defaultWorkspaceId: string
  createdAt: string
}

export type OpenPortAuthSessionRecord = {
  id: string
  userId: string
  accessToken: string
  refreshToken: string
  createdAt: string
  rememberMe: boolean
}

type IdentityState = {
  version: 1
  users: OpenPortAuthUserRecord[]
  sessions: OpenPortAuthSessionRecord[]
  workspaces: Array<OpenPortWorkspace & { ownerUserId: string; slug: string; createdAt: string }>
  members: OpenPortWorkspaceMember[]
  invites: OpenPortWorkspaceInvite[]
  capabilityPolicies: OpenPortWorkspaceCapabilityPolicy[]
}

type PersistenceBackend = 'file' | 'postgres'

function resolvePersistenceBackend(): PersistenceBackend {
  const configured = process.env.OPENPORT_API_STATE_BACKEND?.trim().toLowerCase()
  if (configured === 'postgres' || configured === 'file') {
    return configured
  }
  return process.env.OPENPORT_DATABASE_URL?.trim() ? 'postgres' : 'file'
}

function resolveIdentityFilePath(): string {
  const configured = process.env.OPENPORT_IDENTITY_STATE_FILE?.trim()
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)
  }
  return path.resolve(process.cwd(), '.openport-product/data/identity-state.json')
}

function createEmptyState(): IdentityState {
  return {
    version: 1,
    users: [],
    sessions: [],
    workspaces: [],
    members: [],
    invites: [],
    capabilityPolicies: []
  }
}

@Injectable()
export class IdentityStateService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IdentityStateService.name)
  private readonly backend = resolvePersistenceBackend()
  private readonly filePath = resolveIdentityFilePath()
  private state: IdentityState = createEmptyState()
  private pool: Pool | null = null
  private persistQueue: Promise<void> = Promise.resolve()
  private readonly readyPromise: Promise<void>

  constructor() {
    // Start initialization immediately to avoid lifecycle ordering deadlocks.
    this.readyPromise = this.initialize()
  }

  ready(): Promise<void> {
    return this.readyPromise
  }

  async onModuleInit(): Promise<void> {
    await this.readyPromise
  }

  private async initialize(): Promise<void> {
    if (this.backend !== 'postgres') {
      this.state = this.loadFileState()
      this.logger.log(`Identity state backend: file (${this.filePath})`)
      return
    }

    const connectionString = process.env.OPENPORT_DATABASE_URL?.trim()
    if (!connectionString) {
      throw new Error('OPENPORT_DATABASE_URL is required when OPENPORT_API_STATE_BACKEND=postgres')
    }

    this.pool = new Pool({ connectionString })
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_identity_users (
        user_id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        default_workspace_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_identity_sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        access_token TEXT NOT NULL UNIQUE,
        refresh_token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL,
        remember_me BOOLEAN NOT NULL DEFAULT FALSE
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_identity_workspaces (
        workspace_id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_identity_workspace_members (
        member_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_identity_workspace_invites (
        invite_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS openport_identity_workspace_capability_policies (
        workspace_id TEXT PRIMARY KEY,
        policy JSONB NOT NULL
      )
    `)

    const [users, sessions, workspaces, members, invites, policies] = await Promise.all([
      this.pool.query<{
        user_id: string
        email: string
        name: string
        password: string
        default_workspace_id: string
        created_at: Date | string
      }>(`SELECT user_id, email, name, password, default_workspace_id, created_at FROM openport_identity_users`),
      this.pool.query<{
        session_id: string
        user_id: string
        access_token: string
        refresh_token: string
        created_at: Date | string
        remember_me: boolean
      }>(`SELECT session_id, user_id, access_token, refresh_token, created_at, remember_me FROM openport_identity_sessions`),
      this.pool.query<{
        workspace_id: string
        owner_user_id: string
        name: string
        slug: string
        created_at: Date | string
      }>(`SELECT workspace_id, owner_user_id, name, slug, created_at FROM openport_identity_workspaces`),
      this.pool.query<{
        member_id: string
        workspace_id: string
        user_id: string
        role: string
        created_at: Date | string
      }>(`SELECT member_id, workspace_id, user_id, role, created_at FROM openport_identity_workspace_members`),
      this.pool.query<{
        invite_id: string
        workspace_id: string
        email: string
        role: string
        status: string
        created_at: Date | string
      }>(`SELECT invite_id, workspace_id, email, role, status, created_at FROM openport_identity_workspace_invites`),
      this.pool.query<{ workspace_id: string; policy: OpenPortWorkspaceCapabilityPolicy }>(
        `SELECT workspace_id, policy FROM openport_identity_workspace_capability_policies`
      )
    ])

    this.state = {
      version: 1,
      users: users.rows.map((row) => ({
        id: row.user_id,
        email: row.email,
        name: row.name,
        password: row.password,
        defaultWorkspaceId: row.default_workspace_id,
        createdAt: new Date(row.created_at).toISOString()
      })),
      sessions: sessions.rows.map((row) => ({
        id: row.session_id,
        userId: row.user_id,
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        createdAt: new Date(row.created_at).toISOString(),
        rememberMe: row.remember_me
      })),
      workspaces: workspaces.rows.map((row) => ({
        id: row.workspace_id,
        ownerUserId: row.owner_user_id,
        name: row.name,
        slug: row.slug,
        createdAt: new Date(row.created_at).toISOString()
      })),
      members: members.rows.map((row) => ({
        id: row.member_id,
        workspaceId: row.workspace_id,
        userId: row.user_id,
        role: row.role as OpenPortWorkspaceMember['role'],
        createdAt: new Date(row.created_at).toISOString()
      })),
      invites: invites.rows.map((row) => ({
        id: row.invite_id,
        workspaceId: row.workspace_id,
        email: row.email,
        role: row.role,
        status: row.status as OpenPortWorkspaceInvite['status'],
        createdAt: new Date(row.created_at).toISOString()
      })),
      capabilityPolicies: policies.rows
        .map((row) => row.policy)
        .filter((policy): policy is OpenPortWorkspaceCapabilityPolicy => Boolean(policy?.workspaceId))
    }

    this.logger.log('Identity state backend: postgres')
  }

  async onModuleDestroy(): Promise<void> {
    await this.persistQueue
    await this.pool?.end()
  }

  readUsers(): OpenPortAuthUserRecord[] {
    return structuredClone(this.state.users)
  }

  writeUsers(items: OpenPortAuthUserRecord[]): void {
    this.state.users = structuredClone(items)
    this.flush()
  }

  readSessions(): OpenPortAuthSessionRecord[] {
    return structuredClone(this.state.sessions)
  }

  writeSessions(items: OpenPortAuthSessionRecord[]): void {
    this.state.sessions = structuredClone(items)
    this.flush()
  }

  readWorkspaces(): Array<OpenPortWorkspace & { ownerUserId: string; slug: string; createdAt: string }> {
    return structuredClone(this.state.workspaces)
  }

  writeWorkspaces(items: Array<OpenPortWorkspace & { ownerUserId: string; slug: string; createdAt: string }>): void {
    this.state.workspaces = structuredClone(items)
    this.flush()
  }

  readMembers(): OpenPortWorkspaceMember[] {
    return structuredClone(this.state.members)
  }

  writeMembers(items: OpenPortWorkspaceMember[]): void {
    this.state.members = structuredClone(items)
    this.flush()
  }

  readInvites(): OpenPortWorkspaceInvite[] {
    return structuredClone(this.state.invites)
  }

  writeInvites(items: OpenPortWorkspaceInvite[]): void {
    this.state.invites = structuredClone(items)
    this.flush()
  }

  readCapabilityPolicies(): OpenPortWorkspaceCapabilityPolicy[] {
    return structuredClone(this.state.capabilityPolicies)
  }

  writeCapabilityPolicies(items: OpenPortWorkspaceCapabilityPolicy[]): void {
    this.state.capabilityPolicies = structuredClone(items)
    this.flush()
  }

  private loadFileState(): IdentityState {
    try {
      if (!existsSync(this.filePath)) {
        this.ensureParentDirectory()
        return createEmptyState()
      }

      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Partial<IdentityState>
      return {
        version: 1,
        users: Array.isArray(parsed.users) ? parsed.users : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
        members: Array.isArray(parsed.members) ? parsed.members : [],
        invites: Array.isArray(parsed.invites) ? parsed.invites : [],
        capabilityPolicies: Array.isArray(parsed.capabilityPolicies) ? parsed.capabilityPolicies : []
      }
    } catch (error) {
      this.logger.warn(
        `Falling back to empty identity state because persisted state could not be read: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
      return createEmptyState()
    }
  }

  private flush(): void {
    if (this.backend !== 'postgres') {
      this.ensureParentDirectory()
      const tempPath = `${this.filePath}.tmp`
      writeFileSync(tempPath, JSON.stringify(this.state, null, 2))
      renameSync(tempPath, this.filePath)
      return
    }

    const snapshot = structuredClone(this.state)
    this.persistQueue = this.persistQueue
      .then(async () => {
        const pool = this.requirePool()
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          await client.query('DELETE FROM openport_identity_sessions')
          await client.query('DELETE FROM openport_identity_workspace_members')
          await client.query('DELETE FROM openport_identity_workspace_invites')
          await client.query('DELETE FROM openport_identity_workspace_capability_policies')
          await client.query('DELETE FROM openport_identity_workspaces')
          await client.query('DELETE FROM openport_identity_users')

          for (const user of snapshot.users) {
            await client.query(
              `
                INSERT INTO openport_identity_users (
                  user_id, email, name, password, default_workspace_id, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6)
              `,
              [user.id, user.email, user.name, user.password, user.defaultWorkspaceId, user.createdAt]
            )
          }

          for (const session of snapshot.sessions) {
            await client.query(
              `
                INSERT INTO openport_identity_sessions (
                  session_id, user_id, access_token, refresh_token, created_at, remember_me
                ) VALUES ($1, $2, $3, $4, $5, $6)
              `,
              [session.id, session.userId, session.accessToken, session.refreshToken, session.createdAt, session.rememberMe]
            )
          }

          for (const workspace of snapshot.workspaces) {
            await client.query(
              `
                INSERT INTO openport_identity_workspaces (
                  workspace_id, owner_user_id, name, slug, created_at
                ) VALUES ($1, $2, $3, $4, $5)
              `,
              [workspace.id, workspace.ownerUserId, workspace.name, workspace.slug, workspace.createdAt]
            )
          }

          for (const member of snapshot.members) {
            await client.query(
              `
                INSERT INTO openport_identity_workspace_members (
                  member_id, workspace_id, user_id, role, created_at
                ) VALUES ($1, $2, $3, $4, $5)
              `,
              [member.id, member.workspaceId, member.userId, member.role, member.createdAt]
            )
          }

          for (const invite of snapshot.invites) {
            await client.query(
              `
                INSERT INTO openport_identity_workspace_invites (
                  invite_id, workspace_id, email, role, status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6)
              `,
              [invite.id, invite.workspaceId, invite.email, invite.role, invite.status, invite.createdAt]
            )
          }

          for (const policy of snapshot.capabilityPolicies) {
            await client.query(
              `
                INSERT INTO openport_identity_workspace_capability_policies (
                  workspace_id, policy
                ) VALUES ($1, $2::jsonb)
              `,
              [policy.workspaceId, JSON.stringify(policy)]
            )
          }
          await client.query('COMMIT')
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        } finally {
          client.release()
        }
      })
      .catch((error) => {
        this.logger.error(
          `Failed to persist identity state to postgres: ${error instanceof Error ? error.message : String(error)}`
        )
      })
  }

  private ensureParentDirectory(): void {
    mkdirSync(path.dirname(this.filePath), { recursive: true })
  }

  private requirePool(): Pool {
    if (!this.pool) {
      throw new Error('Postgres identity pool is not initialized')
    }
    return this.pool
  }
}
