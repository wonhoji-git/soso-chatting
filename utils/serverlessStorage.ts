// 서버리스 환경을 위한 간단한 메모리 저장소
// 실제 프로덕션에서는 Redis, Upstash, 또는 Vercel KV 사용 권장

interface StorageItem {
  data: any;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
}

class ServerlessStorage {
  private storage = new Map<string, StorageItem>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 5분마다 만료된 항목 정리
    if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 5 * 60 * 1000);
    }
  }

  set(key: string, data: any, ttl?: number): void {
    const item: StorageItem = {
      data,
      timestamp: Date.now(),
      ttl
    };
    this.storage.set(key, item);
    console.log(`📦 Stored item with key: ${key}, size: ${this.storage.size}`);
  }

  get(key: string): any | null {
    const item = this.storage.get(key);
    if (!item) {
      return null;
    }

    // TTL 확인
    if (item.ttl && Date.now() - item.timestamp > item.ttl) {
      this.storage.delete(key);
      console.log(`⏰ Expired item removed: ${key}`);
      return null;
    }

    return item.data;
  }

  delete(key: string): boolean {
    const deleted = this.storage.delete(key);
    if (deleted) {
      console.log(`🗑️ Deleted item: ${key}`);
    }
    return deleted;
  }

  has(key: string): boolean {
    const item = this.storage.get(key);
    if (!item) {
      return false;
    }

    // TTL 확인
    if (item.ttl && Date.now() - item.timestamp > item.ttl) {
      this.storage.delete(key);
      return false;
    }

    return true;
  }

  size(): number {
    return this.storage.size;
  }

  keys(): string[] {
    return Array.from(this.storage.keys());
  }

  clear(): void {
    this.storage.clear();
    console.log('🧹 Cleared all storage');
  }

  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;
    const keysToDelete: string[] = [];

    // Map의 entries를 Array로 변환하여 이터레이션
    Array.from(this.storage.entries()).forEach(([key, item]) => {
      if (item.ttl && now - item.timestamp > item.ttl) {
        keysToDelete.push(key);
      }
    });

    // 별도 루프에서 삭제 (이터레이션 중 변경 방지)
    keysToDelete.forEach(key => {
      this.storage.delete(key);
      removedCount++;
    });

    if (removedCount > 0) {
      console.log(`🧽 Cleanup removed ${removedCount} expired items. Remaining: ${this.storage.size}`);
    }
  }

  // 통계 정보
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    let validCount = 0;

    // Map의 values를 Array로 변환하여 이터레이션
    Array.from(this.storage.values()).forEach(item => {
      if (item.ttl && now - item.timestamp > item.ttl) {
        expiredCount++;
      } else {
        validCount++;
      }
    });

    return {
      total: this.storage.size,
      valid: validCount,
      expired: expiredCount,
      uptime: process.uptime ? process.uptime() : 0
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// 싱글톤 인스턴스
const storage = new ServerlessStorage();

export default storage;

// 특수 목적 저장소들
export class PushSubscriptionStorage {
  private static readonly KEY = 'push_subscriptions';
  private static readonly TTL = 24 * 60 * 60 * 1000; // 24시간

  static getAll(): any[] {
    return storage.get(this.KEY) || [];
  }

  static add(subscription: any): number {
    const subscriptions = this.getAll();
    const existingIndex = subscriptions.findIndex(
      (sub: any) => sub.endpoint === subscription.endpoint
    );

    if (existingIndex !== -1) {
      subscriptions[existingIndex] = subscription;
      console.log('📝 Updated existing push subscription');
    } else {
      subscriptions.push(subscription);
      console.log('➕ Added new push subscription');
    }

    storage.set(this.KEY, subscriptions, this.TTL);
    console.log(`📊 Total push subscriptions: ${subscriptions.length}`);
    return subscriptions.length;
  }

  static remove(endpoint: string): boolean {
    const subscriptions = this.getAll();
    const index = subscriptions.findIndex((sub: any) => sub.endpoint === endpoint);
    
    if (index !== -1) {
      subscriptions.splice(index, 1);
      storage.set(this.KEY, subscriptions, this.TTL);
      console.log(`🗑️ Removed push subscription: ${endpoint}`);
      return true;
    }
    
    return false;
  }

  static removeMultiple(endpoints: string[]): number {
    const subscriptions = this.getAll();
    let removedCount = 0;

    endpoints.forEach(endpoint => {
      const index = subscriptions.findIndex((sub: any) => sub.endpoint === endpoint);
      if (index !== -1) {
        subscriptions.splice(index, 1);
        removedCount++;
      }
    });

    if (removedCount > 0) {
      storage.set(this.KEY, subscriptions, this.TTL);
      console.log(`🧹 Removed ${removedCount} expired push subscriptions`);
    }

    return removedCount;
  }

  static count(): number {
    return this.getAll().length;
  }

  static clear(): void {
    storage.delete(this.KEY);
    console.log('🧹 Cleared all push subscriptions');
  }
}