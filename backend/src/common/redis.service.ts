import { Injectable } from '@nestjs/common';

@Injectable()
export class RedisService {
  private cache = new Map<string, { value: any; expires: number }>();
  private queues = new Map<string, any[]>();

  private cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (item.expires > 0 && item.expires < now) {
        this.cache.delete(key);
      }
    }
  }

  async get(key: string): Promise<any | null> {
    this.cleanup();
    const item = this.cache.get(key);
    if (!item) return null;
    if (item.expires > 0 && item.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const expires = ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0;
    this.cache.set(key, { value, expires });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async pushQueue(queueName: string, data: any): Promise<void> {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }
    this.queues.get(queueName)!.push(data);
  }

  async popQueue(queueName: string): Promise<any | null> {
    const queue = this.queues.get(queueName);
    if (!queue || queue.length === 0) {
      return null;
    }
    return queue.shift();
  }
}
