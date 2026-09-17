import Redis from 'ioredis';

class CacheService {
      private redis: Redis | null = null;
      private memoryCache: Map<string, { value: string; expiresAt: number }> = new Map();
      private isRedisConnected = false;

      constructor() {
            const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
            const redisHost = process.env.REDIS_HOST;
            const redisPort = Number(process.env.REDIS_PORT || 6379);
            const redisPassword = process.env.REDIS_PASSWORD;

            if (redisUrl || redisHost) {
                  try {
                        this.redis = redisUrl
                              ? new Redis(redisUrl, {
                                      lazyConnect: true,
                                      maxRetriesPerRequest: 1,
                                      connectTimeout: 3000,
                                })
                              : new Redis({
                                      host: redisHost,
                                      port: redisPort,
                                      password: redisPassword || undefined,
                                      lazyConnect: true,
                                      maxRetriesPerRequest: 1,
                                      connectTimeout: 3000,
                                });

                        this.redis.on('connect', () => {
                              this.isRedisConnected = true;
                              console.log('Redis connected successfully');
                        });

                        this.redis.on('error', (err) => {
                              this.isRedisConnected = false;
                              // Fall back gracefully to memory cache without crashing
                              console.warn('Redis connection issue, fallback to in-memory cache:', err.message);
                        });

                        this.redis.connect().catch((err) => {
                              console.warn('Redis initial connection failed, using in-memory cache fallback:', err.message);
                        });
                  } catch (err: any) {
                        console.warn('Failed to initialize Redis client, using in-memory cache:', err.message);
                  }
            } else {
                  console.log('No REDIS_URL or REDIS_HOST provided. Using high-performance in-memory cache.');
            }
      }

      async get<T>(key: string): Promise<T | null> {
            try {
                  if (this.isRedisConnected && this.redis) {
                        const data = await this.redis.get(key);
                        if (data) {
                              return JSON.parse(data) as T;
                        }
                        return null;
                  }
            } catch (err) {
                  console.warn(`Redis get error for key "${key}", checking memory cache fallback`);
            }

            // In-memory fallback lookup
            const cached = this.memoryCache.get(key);
            if (!cached) {
                  return null;
            }

            if (cached.expiresAt > 0 && Date.now() > cached.expiresAt) {
                  this.memoryCache.delete(key);
                  return null;
            }

            try {
                  return JSON.parse(cached.value) as T;
            } catch {
                  return null;
            }
      }

      async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
            const stringified = JSON.stringify(value);

            try {
                  if (this.isRedisConnected && this.redis) {
                        if (ttlSeconds > 0) {
                              await this.redis.set(key, stringified, 'EX', ttlSeconds);
                        } else {
                              await this.redis.set(key, stringified);
                        }
                        return;
                  }
            } catch (err) {
                  console.warn(`Redis set error for key "${key}", writing to memory cache fallback`);
            }

            // In-memory fallback write
            const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0;
            this.memoryCache.set(key, {
                  value: stringified,
                  expiresAt,
            });

            // Evict expired memory items if map gets large
            if (this.memoryCache.size > 2000) {
                  const now = Date.now();
                  for (const [k, item] of this.memoryCache.entries()) {
                        if (item.expiresAt > 0 && now > item.expiresAt) {
                              this.memoryCache.delete(k);
                        }
                  }
            }
      }

      async del(key: string): Promise<void> {
            try {
                  if (this.isRedisConnected && this.redis) {
                        await this.redis.del(key);
                  }
            } catch (err) {
                  console.warn(`Redis del error for key "${key}"`);
            }

            this.memoryCache.delete(key);
      }

      async delPattern(pattern: string): Promise<void> {
            try {
                  if (this.isRedisConnected && this.redis) {
                        const keys = await this.redis.keys(pattern);
                        if (keys.length > 0) {
                              await this.redis.del(...keys);
                        }
                  }
            } catch (err) {
                  console.warn(`Redis delPattern error for pattern "${pattern}"`);
            }

            const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
            for (const key of this.memoryCache.keys()) {
                  if (regex.test(key)) {
                        this.memoryCache.delete(key);
                  }
            }
      }

      async wrap<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
            const cached = await this.get<T>(key);
            if (cached !== null && cached !== undefined) {
                  return cached;
            }

            const fresh = await fetcher();
            if (fresh !== null && fresh !== undefined) {
                  await this.set(key, fresh, ttlSeconds);
            }
            return fresh;
      }
}

export const cacheService = new CacheService();
export default cacheService;
