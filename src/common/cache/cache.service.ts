import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Redis } from 'ioredis';

const CACHE_PREFIX = 'vehicle-api:v1';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis = new Redis(
    process.env.REDIS_URL ?? 'redis://localhost:6379',
    {
      lazyConnect: true,
      connectTimeout: 1_000,
      commandTimeout: 1_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => Math.min(attempt * 250, 3_000),
    },
  );
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private hasLoggedRedisFailure = false;

  constructor() {
    this.redis.on('error', (error: Error) => {
      if (this.hasLoggedRedisFailure) return;
      this.hasLoggedRedisFailure = true;
      this.logger.warn(
        `Redis unavailable; cache is bypassed (${error.message})`,
      );
    });
    this.redis.on('ready', () => {
      this.hasLoggedRedisFailure = false;
    });
  }

  async getOrSet<T>(
    namespace: string,
    key: string,
    ttlSeconds: number,
    load: () => Promise<T>,
  ): Promise<T> {
    const versionKey = `${CACHE_PREFIX}:version:${namespace}`;
    let cacheKey: string | undefined;
    try {
      const version = (await this.redis.get(versionKey)) ?? '0';
      const keyHash = createHash('sha256').update(key).digest('hex');
      cacheKey = `${CACHE_PREFIX}:${namespace}:v${version}:${keyHash}`;
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch {
      // Cache is an optimization: continue to the authoritative database on Redis errors.
    }

    const flightKey = `${namespace}:${createHash('sha256').update(key).digest('hex')}`;
    const existingLoad = this.inFlight.get(flightKey);
    if (existingLoad) return existingLoad as Promise<T>;

    const loadPromise = load()
      .then(async (value) => {
        try {
          const jitteredTtl = Math.max(
            1,
            Math.round(ttlSeconds * (0.9 + Math.random() * 0.2)),
          );
          if (cacheKey)
            await this.redis.set(
              cacheKey,
              JSON.stringify(value),
              'EX',
              jitteredTtl,
            );
        } catch {
          // Do not turn a successful database read into a failed API request.
        }
        return value;
      })
      .finally(() => this.inFlight.delete(flightKey));
    this.inFlight.set(flightKey, loadPromise);
    return loadPromise;
  }

  async invalidate(...namespaces: string[]): Promise<void> {
    for (const namespace of namespaces) {
      try {
        await this.redis.incr(`${CACHE_PREFIX}:version:${namespace}`);
      } catch {
        // Expiring keys bound staleness if Redis is unavailable during invalidation.
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
