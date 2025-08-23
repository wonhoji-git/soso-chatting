// utils/messageBuffer.ts
// 백그라운드에서 수신된 메시지들을 버퍼링하여 관리

import { memoryOptimizer } from './memoryOptimizer';

export interface BufferedMessage {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar: string;
  timestamp: string;
  receivedAt: number; // 클라이언트가 수신한 시각
  isRead: boolean;
}

class MessageBuffer {
  private buffer: BufferedMessage[] = [];
  private isPageVisible: boolean = true;
  private visibilityChangeListeners: (() => void)[] = [];
  private maxBufferSize = 10; // 최대 버퍼 크기 (iOS Safari 극한 최적화)

  constructor() {
    if (typeof document !== 'undefined') {
      this.isPageVisible = !document.hidden;
      this.setupVisibilityListener();
      this.setupMemoryCleanup();
    }
  }

  private setupVisibilityListener() {
    const handleVisibilityChange = () => {
      const wasVisible = this.isPageVisible;
      const currentlyVisible = this.getCurrentVisibilityState();
      
      console.log('📺 Page visibility changed:', {
        wasVisible,
        isVisible: currentlyVisible,
        visibilityState: document.visibilityState,
        documentHidden: document.hidden,
        hasFocus: document.hasFocus(),
        bufferedMessages: this.buffer.length,
        unreadCount: this.getUnreadCount()
      });

      // 페이지가 다시 보이게 되면 버퍼링된 메시지들을 읽음 처리 (지연 처리)
      if (!wasVisible && currentlyVisible) {
        // 실제로 사용자가 돌아온 것을 확인하기 위해 짧은 지연 후 처리
        setTimeout(() => {
          if (this.getCurrentVisibilityState()) { // 다시 한 번 확인
            console.log('✅ 사용자가 돌아왔음을 확인, 메시지 읽음 처리');
            this.markAllAsRead();
            this.updateLastUserActivity();
            this.notifyVisibilityChangeListeners();
          }
        }, 500); // 0.5초 지연
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 사용자 활동 감지 이벤트들 추가
    const userActivityEvents = ['focus', 'click', 'keydown', 'touchstart', 'mousemove', 'scroll'];
    
    userActivityEvents.forEach(eventType => {
      const handler = () => {
        this.updateLastUserActivity();
        const currentlyVisible = this.getCurrentVisibilityState();
        
        if (eventType === 'focus' && !this.isPageVisible && currentlyVisible) {
          this.markAllAsRead();
          this.notifyVisibilityChangeListeners();
        }
      };
      
      if (eventType === 'focus') {
        window.addEventListener(eventType, handler);
      } else {
        document.addEventListener(eventType, handler, { passive: true });
      }
    });

    // blur 이벤트는 별도로 처리
    window.addEventListener('blur', () => {
      const currentlyVisible = this.getCurrentVisibilityState();
      console.log('👁️ Window blur event:', {
        wasVisible: this.isPageVisible,
        currentlyVisible
      });
    });
  }

  // 마지막 사용자 활동 시간 업데이트
  private updateLastUserActivity(): void {
    const now = Date.now();
    if (typeof window !== 'undefined') {
      localStorage.setItem('lastUserActivity', now.toString());
    }
  }

  // 새 메시지를 버퍼에 추가 (개선된 버전)
  addMessage(message: Omit<BufferedMessage, 'receivedAt' | 'isRead'>): boolean {
    // 안전한 중복 체크 - ID만 체크하여 정상 메시지 보호
    const isDuplicate = this.buffer.some(buffered => {
      // 정확한 ID 일치만 중복으로 처리
      return buffered.id === message.id;
    });

    if (isDuplicate) {
      // 추가 안전 체크: 정말 중복인지 시간 기반 확인
      const existingMsg = this.buffer.find(buffered => buffered.id === message.id);
      if (existingMsg && Date.now() - existingMsg.receivedAt < 1000) {
        // 1초 내의 정확한 중복만 버림
        console.log('⚠️ 진짜 중복 메시지 버퍼링 스킵:', {
          messageId: message.id,
          userName: message.userName,
          timeDiff: Date.now() - existingMsg.receivedAt
        });
        return false;
      } else {
        // 시간 간격이 크면 새 메시지로 처리 (재시도 가능)
        console.log('🔄 동일 ID이지만 시간 차이로 인한 새 메시지로 처리:', {
          messageId: message.id,
          userName: message.userName,
          timeDiff: existingMsg ? Date.now() - existingMsg.receivedAt : 'N/A'
        });
      }
    }

    // 더 정확한 읽음 상태 결정
    const isCurrentlyVisible = this.getCurrentVisibilityState();
    const bufferedMessage: BufferedMessage = {
      ...message,
      receivedAt: Date.now(),
      isRead: isCurrentlyVisible && this.isUserInteracting() // 사용자가 실제로 활성화되어 있을 때만 읽음 처리
    };

    this.buffer.push(bufferedMessage);
    
    // 버퍼 크기 제한 (메모리 최적화)
    if (this.buffer.length > this.maxBufferSize) {
      const removedCount = this.buffer.length - this.maxBufferSize;
      this.buffer = this.buffer.slice(-this.maxBufferSize);
      if (process.env.NODE_ENV === 'development') {
        console.log(`🗑️ 버퍼 크기 제한으로 ${removedCount}개 메시지 제거`);
      }
    }

    console.log('📬 메시지 버퍼에 추가:', {
      messageId: message.id,
      userName: message.userName,
      isCurrentlyVisible,
      isUserInteracting: this.isUserInteracting(),
      bufferSize: this.buffer.length,
      isRead: bufferedMessage.isRead,
      timestamp: new Date(message.timestamp).toLocaleTimeString()
    });

    // Service Worker에 버퍼 상태 업데이트 알림
    this.notifyServiceWorker();

    return true;
  }

  // 현재 페이지 가시성 상태를 더 정확하게 확인
  private getCurrentVisibilityState(): boolean {
    if (typeof document === 'undefined') return true;
    
    // 여러 방법으로 가시성 확인
    const documentVisible = !document.hidden;
    const windowFocused = document.hasFocus();
    const visibilityStateValue = document.visibilityState;
    const visibilityIsVisible = visibilityStateValue === 'visible';
    
    // 플랫폼별 다른 조건 적용
    let isVisible: boolean;
    if (typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)) {
      // 모바일: documentVisible만으로도 충분 (포커스 체크가 부정확할 수 있음)
      isVisible = documentVisible && visibilityIsVisible;
    } else {
      // 데스크톱: 모든 조건 만족해야 함
      isVisible = documentVisible && windowFocused && visibilityIsVisible;
    }
    
    // 상태가 변경되었다면 업데이트
    if (this.isPageVisible !== isVisible) {
      console.log('👁️ 페이지 가시성 상태 업데이트:', {
        from: this.isPageVisible,
        to: isVisible,
        documentVisible,
        windowFocused,
        visibilityState: visibilityStateValue,
        visibilityIsVisible,
        platform: typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        finalDecision: isVisible
      });
      this.isPageVisible = isVisible;
    }
    
    return isVisible;
  }

  // 사용자가 실제로 상호작용하고 있는지 확인
  private isUserInteracting(): boolean {
    // 마지막 사용자 활동으로부터 30초 이내인지 확인
    const lastActivity = this.getLastUserActivity();
    const timeSinceActivity = Date.now() - lastActivity;
    return timeSinceActivity < 30000; // 30초
  }

  // 마지막 사용자 활동 시간 (단순 구현)
  private getLastUserActivity(): number {
    // localStorage를 통해 마지막 활동 시간 추적
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('lastUserActivity');
      return stored ? parseInt(stored) : Date.now();
    }
    return Date.now();
  }

  // Service Worker에 버퍼 상태 알림
  private notifyServiceWorker() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'BUFFER_UPDATE',
          bufferSize: this.buffer.length,
          unreadCount: this.getUnreadCount(),
          isPageVisible: this.isPageVisible
        });
      } catch (error) {
        console.warn('Failed to notify Service Worker of buffer update:', error);
      }
    }
  }

  // 읽지 않은 메시지 수 반환
  getUnreadCount(): number {
    return this.buffer.filter(msg => !msg.isRead).length;
  }

  // 읽지 않은 메시지들 반환
  getUnreadMessages(): BufferedMessage[] {
    return this.buffer.filter(msg => !msg.isRead);
  }

  // 모든 메시지를 읽음 처리
  markAllAsRead(): void {
    const unreadCount = this.getUnreadCount();
    this.buffer.forEach(msg => {
      msg.isRead = true;
    });

    if (unreadCount > 0) {
      console.log('✅ 모든 버퍼링된 메시지를 읽음 처리:', unreadCount);
    }
  }

  // 특정 메시지를 읽음 처리
  markAsRead(messageId: string): void {
    const message = this.buffer.find(msg => msg.id === messageId);
    if (message && !message.isRead) {
      message.isRead = true;
      console.log('✅ 메시지 읽음 처리:', messageId);
    }
  }

  // 버퍼 클리어
  clear(): void {
    this.buffer = [];
    console.log('🗑️ 메시지 버퍼 클리어됨');
  }

  // 페이지 가시성 상태 반환
  isPageCurrentlyVisible(): boolean {
    return this.isPageVisible;
  }

  // 페이지 가시성 변경 리스너 추가
  onVisibilityChange(listener: () => void): () => void {
    this.visibilityChangeListeners.push(listener);
    
    // 리스너 제거 함수 반환
    return () => {
      const index = this.visibilityChangeListeners.indexOf(listener);
      if (index > -1) {
        this.visibilityChangeListeners.splice(index, 1);
      }
    };
  }

  private notifyVisibilityChangeListeners(): void {
    this.visibilityChangeListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in visibility change listener:', error);
      }
    });
  }

  // 메모리 정리 설정
  private setupMemoryCleanup(): void {
    // 일반 메모리 정리
    window.addEventListener('memoryCleanup', () => {
      console.log('🧹 MessageBuffer: Performing memory cleanup');
      this.performCleanup(false);
    });

    // 응급 메모리 정리 (iOS Safari)
    window.addEventListener('emergencyMemoryCleanup', () => {
      console.warn('🆘 MessageBuffer: Performing EMERGENCY cleanup');
      this.performCleanup(true);
    });
  }

  // 통합 정리 메서드
  private performCleanup(isEmergency: boolean): void {
    const beforeCount = this.buffer.length;
    
    if (isEmergency) {
      // 응급 상황: 최근 3개 메시지만 유지
      this.buffer = this.buffer.slice(-3);
      console.warn(`🆘 EMERGENCY: MessageBuffer reduced to ${this.buffer.length} messages`);
      
      // 응급 상황에서는 Service Worker에도 알림
      this.notifyServiceWorker();
    } else {
      // 일반 정리: 오래된 메시지 제거 (3분 이상)
      const threeMinutesAgo = Date.now() - (3 * 60 * 1000);
      this.buffer = this.buffer.filter(msg => msg.receivedAt > threeMinutesAgo);
      
      // 읽은 메시지 우선 제거
      if (this.buffer.length > this.maxBufferSize / 2) {
        const unreadMessages = this.buffer.filter(msg => !msg.isRead);
        const readMessages = this.buffer.filter(msg => msg.isRead);
        this.buffer = [...unreadMessages.slice(-3), ...readMessages.slice(-2)];
      }
    }
    
    const removedCount = beforeCount - this.buffer.length;
    if (removedCount > 0) {
      console.log(`🧹 MessageBuffer: Cleaned up ${removedCount} messages (${isEmergency ? 'EMERGENCY' : 'normal'})`);
    }
  }

  // 오래된 메시지 정리 (모바일 메모리 최적화: 10분으로 단축)
  cleanupOldMessages(): number {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000); // 10분으로 단축 (모바일 메모리 절약)
    const beforeCount = this.buffer.length;
    
    this.buffer = this.buffer.filter(msg => msg.receivedAt > tenMinutesAgo);
    
    const removedCount = beforeCount - this.buffer.length;
    if (removedCount > 0 && process.env.NODE_ENV === 'development') {
      console.log('🧹 오래된 메시지 정리됨:', removedCount);
    }
    
    return removedCount;
  }

  // 디버그 정보 반환 (강화됨)
  getDebugInfo() {
    const lastActivity = this.getLastUserActivity();
    return {
      bufferSize: this.buffer.length,
      unreadCount: this.getUnreadCount(),
      isPageVisible: this.isPageVisible,
      currentVisibilityState: this.getCurrentVisibilityState(),
      isUserInteracting: this.isUserInteracting(),
      lastUserActivity: new Date(lastActivity).toLocaleTimeString(),
      timeSinceLastActivity: Math.round((Date.now() - lastActivity) / 1000),
      messages: this.buffer.map(msg => ({
        id: msg.id,
        userName: msg.userName,
        text: msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : ''),
        isRead: msg.isRead,
        receivedAt: new Date(msg.receivedAt).toLocaleTimeString(),
        ageInSeconds: Math.round((Date.now() - msg.receivedAt) / 1000)
      })),
      browserInfo: {
        hidden: typeof document !== 'undefined' ? document.hidden : null,
        visibilityState: typeof document !== 'undefined' ? document.visibilityState : null,
        hasFocus: typeof document !== 'undefined' ? document.hasFocus() : null
      }
    };
  }
}

// 싱글톤 인스턴스
export const messageBuffer = new MessageBuffer();

// 사용자 활동 추적을 위한 초기화 (브라우저 환경에서만)
if (typeof window !== 'undefined') {
  // 페이지 로드 시 마지막 활동 시간 초기화
  localStorage.setItem('lastUserActivity', Date.now().toString());
  
  // 정기적으로 오래된 버퍼 메시지 정리 (1분마다, 모바일 메모리 최적화)
  setInterval(() => {
    messageBuffer.cleanupOldMessages();
  }, 60 * 1000);
}

// 전역 접근을 위한 함수들
export const addMessageToBuffer = (message: Omit<BufferedMessage, 'receivedAt' | 'isRead'>): boolean => {
  return messageBuffer.addMessage(message);
};

export const getUnreadMessageCount = (): number => {
  return messageBuffer.getUnreadCount();
};

export const getUnreadMessages = (): BufferedMessage[] => {
  return messageBuffer.getUnreadMessages();
};

export const markAllMessagesAsRead = (): void => {
  messageBuffer.markAllAsRead();
};

export const isPageVisible = (): boolean => {
  return messageBuffer.isPageCurrentlyVisible();
};

export const onPageVisibilityChange = (listener: () => void): () => void => {
  return messageBuffer.onVisibilityChange(listener);
};

// 정리 작업을 위한 함수 (주기적 호출 권장)
export const cleanupMessageBuffer = (): number => {
  return messageBuffer.cleanupOldMessages();
};

export const getMessageBufferDebugInfo = () => {
  return messageBuffer.getDebugInfo();
};