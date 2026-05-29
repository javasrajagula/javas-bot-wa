interface LimitConfig {
  maxRequests: number;
  windowMs: number;
}

const LIMITS: Record<string, LimitConfig> = {
  sticker: { maxRequests: 10, windowMs: 60 * 1000 },
  hd: { maxRequests: 3, windowMs: 10 * 60 * 1000 },
  downloader: { maxRequests: 5, windowMs: 10 * 60 * 1000 },
  werewolf: { maxRequests: 30, windowMs: 60 * 1000 },
  brat: { maxRequests: 10, windowMs: 60 * 1000 },
};

class RateLimiter {
  // Key format: "user:userId:feature" or "group:groupId:werewolf"
  private store: Map<string, number[]> = new Map();

  public isRateLimited(key: string, feature: string): { limited: boolean; retryAfterSeconds: number } {
    const config = LIMITS[feature];
    if (!config) {
      return { limited: false, retryAfterSeconds: 0 };
    }

    const now = Date.now();
    const timestamps = this.store.get(key) || [];
    
    // Filter out timestamps outside the current window
    const validTimestamps = timestamps.filter(t => now - t < config.windowMs);

    if (validTimestamps.length >= config.maxRequests) {
      // Calculate when the oldest request falls off the window
      const oldest = validTimestamps[0];
      const remainingMs = config.windowMs - (now - oldest);
      return {
        limited: true,
        retryAfterSeconds: Math.ceil(remainingMs / 1000)
      };
    }

    // Add current timestamp and save
    validTimestamps.push(now);
    this.store.set(key, validTimestamps);
    return { limited: false, retryAfterSeconds: 0 };
  }

  public getLimitConfig(feature: string): LimitConfig | undefined {
    return LIMITS[feature];
  }
}

export const rateLimiter = new RateLimiter();
