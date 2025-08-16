// utils/messageReliability.ts
// 메시지 전송 안정성을 위한 유틸리티

export interface MessageRetryConfig {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
}

export interface MessageDeliveryStatus {
  messageId: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  lastAttempt: number;
  error?: string;
}

class MessageReliabilityManager {
  private pendingMessages = new Map<string, MessageDeliveryStatus>();
  private retryTimeouts = new Map<string, NodeJS.Timeout>();
  private config: MessageRetryConfig;

  constructor(config: Partial<MessageRetryConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true,
      ...config
    };
  }

  // 메시지 전송 시작
  startMessageDelivery(messageId: string): void {
    this.pendingMessages.set(messageId, {
      messageId,
      status: 'pending',
      attempts: 0,
      lastAttempt: Date.now()
    });

    console.log('📨 Started message delivery tracking:', messageId);
  }

  // 메시지 전송 성공 처리
  markMessageDelivered(messageId: string): void {
    const status = this.pendingMessages.get(messageId);
    if (status) {
      status.status = 'delivered';
      console.log('✅ Message delivered successfully:', messageId);
      
      // 타임아웃 정리
      this.clearRetryTimeout(messageId);
      
      // 5초 후 기록 정리
      setTimeout(() => {
        this.pendingMessages.delete(messageId);
      }, 5000);
    }
  }

  // 메시지 전송 실패 처리
  markMessageFailed(messageId: string, error: string, shouldRetry: boolean = true): void {
    const status = this.pendingMessages.get(messageId);
    if (!status) return;

    status.attempts++;
    status.lastAttempt = Date.now();
    status.error = error;

    if (shouldRetry && status.attempts < this.config.maxRetries) {
      status.status = 'retrying';
      console.log(`🔄 Message delivery failed, retrying (${status.attempts}/${this.config.maxRetries}):`, messageId);
      
      this.scheduleRetry(messageId);
    } else {
      status.status = 'failed';
      console.error('❌ Message delivery failed permanently:', messageId, error);
      
      this.clearRetryTimeout(messageId);
    }
  }

  // 재시도 스케줄링
  private scheduleRetry(messageId: string): void {
    const status = this.pendingMessages.get(messageId);
    if (!status) return;

    // 기존 타임아웃 정리
    this.clearRetryTimeout(messageId);

    // 지수 백오프 계산
    let delay = this.config.retryDelay;
    if (this.config.exponentialBackoff) {
      delay = this.config.retryDelay * Math.pow(2, status.attempts - 1);
    }

    console.log(`⏰ Scheduling retry for message ${messageId} in ${delay}ms`);

    const timeout = setTimeout(() => {
      this.triggerRetry(messageId);
    }, delay);

    this.retryTimeouts.set(messageId, timeout);
  }

  // 재시도 실행
  private triggerRetry(messageId: string): void {
    const status = this.pendingMessages.get(messageId);
    if (!status || status.status !== 'retrying') return;

    console.log('🔄 Triggering retry for message:', messageId);
    
    // 메시지 재전송 이벤트 발생
    window.dispatchEvent(new CustomEvent('messageRetry', {
      detail: { messageId }
    }));
  }

  // 타임아웃 정리
  private clearRetryTimeout(messageId: string): void {
    const timeout = this.retryTimeouts.get(messageId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(messageId);
    }
  }

  // 메시지 상태 조회
  getMessageStatus(messageId: string): MessageDeliveryStatus | null {
    return this.pendingMessages.get(messageId) || null;
  }

  // 대기 중인 메시지 목록
  getPendingMessages(): MessageDeliveryStatus[] {
    return Array.from(this.pendingMessages.values())
      .filter(status => status.status === 'pending' || status.status === 'retrying');
  }

  // 실패한 메시지 목록
  getFailedMessages(): MessageDeliveryStatus[] {
    return Array.from(this.pendingMessages.values())
      .filter(status => status.status === 'failed');
  }

  // 메시지 추적 중지
  stopTracking(messageId: string): void {
    this.clearRetryTimeout(messageId);
    this.pendingMessages.delete(messageId);
  }

  // 오래된 추적 데이터 정리
  cleanup(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    const entriesToDelete: string[] = [];
    this.pendingMessages.forEach((status, messageId) => {
      if (status.lastAttempt < oneHourAgo) {
        entriesToDelete.push(messageId);
      }
    });
    
    entriesToDelete.forEach(messageId => {
      console.log('🧹 Cleaning up old message tracking:', messageId);
      this.stopTracking(messageId);
    });
  }

  // 통계 정보
  getStats() {
    const messages = Array.from(this.pendingMessages.values());
    return {
      total: messages.length,
      pending: messages.filter(m => m.status === 'pending').length,
      delivered: messages.filter(m => m.status === 'delivered').length,
      failed: messages.filter(m => m.status === 'failed').length,
      retrying: messages.filter(m => m.status === 'retrying').length
    };
  }
}

// 싱글톤 인스턴스
export const messageReliability = new MessageReliabilityManager();

// 주기적 정리 작업 (5분마다)
if (typeof window !== 'undefined') {
  setInterval(() => {
    messageReliability.cleanup();
  }, 5 * 60 * 1000);
}

// 전역 접근 함수들
export const startMessageTracking = (messageId: string) => {
  messageReliability.startMessageDelivery(messageId);
};

export const markMessageDelivered = (messageId: string) => {
  messageReliability.markMessageDelivered(messageId);
};

export const markMessageFailed = (messageId: string, error: string, shouldRetry: boolean = true) => {
  messageReliability.markMessageFailed(messageId, error, shouldRetry);
};

export const getMessageStatus = (messageId: string) => {
  return messageReliability.getMessageStatus(messageId);
};

export const getReliabilityStats = () => {
  return messageReliability.getStats();
};