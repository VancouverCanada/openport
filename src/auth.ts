import { ErrorCodes } from './error-codes.js'
import { OpenPortError } from './errors.js'
import { isIpAllowed } from './ip-policy.js'
import { RateLimiter } from './rate-limit.js'
import { InMemoryStore } from './store.js'
import type { AgentRequestContext } from './types.js'
import { getClientIp, readBearerToken, sha256Hex } from './utils.js'

export class AgentAuthService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly rateLimit: RateLimiter
  ) {}

  authenticate(headers: Record<string, string | string[] | undefined>, fallbackIp: string): AgentRequestContext {
    const authHeader = headers.authorization
    const token = readBearerToken(Array.isArray(authHeader) ? authHeader[0] : authHeader)
    if (!token) {
      throw new OpenPortError(401, ErrorCodes.AGENT_TOKEN_INVALID, 'Missing agent token')
    }

    const tokenHash = sha256Hex(token)
    const key = this.store.findKeyByHash(tokenHash)
    if (!key || key.revoked_at) {
      throw new OpenPortError(401, ErrorCodes.AGENT_TOKEN_INVALID, 'Invalid agent token')
    }

    if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
      throw new OpenPortError(401, ErrorCodes.AGENT_TOKEN_EXPIRED, 'Agent token expired')
    }

    const app = this.store.getApp(key.app_id)
    if (!app || app.status !== 'active') {
      throw new OpenPortError(401, ErrorCodes.AGENT_TOKEN_INVALID, 'Invalid agent token')
    }

    const actorUserId = app.scope === 'workspace'
      ? (app.service_user_id || null)
      : (app.user_id || app.created_by || null)

    if (!actorUserId) {
      throw new OpenPortError(403, ErrorCodes.AGENT_FORBIDDEN, 'Agent app is misconfigured')
    }

    const forwarded = headers['x-forwarded-for']
    const ip = getClientIp(Array.isArray(forwarded) ? forwarded[0] || '' : forwarded || fallbackIp || '') || fallbackIp
    const userAgent = Array.isArray(headers['user-agent']) ? headers['user-agent'][0] || '' : headers['user-agent'] || ''

    const allowedIps = app.policy?.network?.allowed_ips || []
    if (Array.isArray(allowedIps) && allowedIps.length > 0) {
      if (!isIpAllowed(ip, allowedIps.map((entry) => String(entry)))) {
        throw new OpenPortError(403, ErrorCodes.AGENT_POLICY_DENIED, 'IP not allowed for this integration')
      }
    }

    this.rateLimit.check(`agent:${key.id}:${ip}`, 240, 60 * 1000)
    this.store.touchKey(key.id)

    return {
      app,
      key,
      actorUserId,
      ip: ip || null,
      userAgent: userAgent || null
    }
  }
}
