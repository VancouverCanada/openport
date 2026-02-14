import { OpenMCPError } from './errors.js'
import { ErrorCodes } from './error-codes.js'

type Bucket = {
  count: number
  resetAt: number
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>()

  check(key: string, limit: number, windowMs: number): void {
    const now = Date.now()
    const bucket = this.buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs })
      return
    }

    if (bucket.count >= limit) {
      throw new OpenMCPError(429, ErrorCodes.AGENT_RATE_LIMITED, 'Rate limit exceeded')
    }

    bucket.count += 1
    this.buckets.set(key, bucket)
  }
}
