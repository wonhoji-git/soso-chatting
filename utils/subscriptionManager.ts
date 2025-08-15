// 푸시 구독 관리 유틸리티 (서버리스 환경 최적화)

import { PushSubscriptionStorage } from './serverlessStorage';

export function addSubscription(subscription: any): number {
  return PushSubscriptionStorage.add(subscription);
}

export function getSubscriptions(): any[] {
  return PushSubscriptionStorage.getAll();
}

export function removeSubscription(endpoint: string): boolean {
  return PushSubscriptionStorage.remove(endpoint);
}

export function getSubscriptionCount(): number {
  return PushSubscriptionStorage.count();
}

export function clearExpiredSubscriptions(expiredEndpoints: string[]): number {
  return PushSubscriptionStorage.removeMultiple(expiredEndpoints);
}

// 추가 유틸리티 함수들
export function clearAllSubscriptions(): void {
  PushSubscriptionStorage.clear();
}

export function getSubscriptionStats() {
  const count = getSubscriptionCount();
  const subscriptions = getSubscriptions();
  
  return {
    total: count,
    subscriptions: subscriptions.map(sub => ({
      endpoint: sub.endpoint?.substring(0, 50) + '...',
      keys: !!sub.keys,
      timestamp: new Date().toISOString()
    }))
  };
}