// utils/messageBuffer.ts
// 백그라운드에서 수신된 메시지들을 버퍼링하여 관리

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
  private maxBufferSize = 50; // 최대 버퍼 크기

  constructor() {
    if (typeof document !== 'undefined') {
      this.isPageVisible = !document.hidden;
      this.setupVisibilityListener();
    }
  }

  private setupVisibilityListener() {
    const handleVisibilityChange = () => {
      const wasVisible = this.isPageVisible;
      this.isPageVisible = !document.hidden;
      
      console.log('📺 Page visibility changed:', {
        wasVisible,
        isVisible: this.isPageVisible,
        visibilityState: document.visibilityState,
        bufferedMessages: this.buffer.length
      });

      // 페이지가 다시 보이게 되면 버퍼링된 메시지들을 읽음 처리
      if (!wasVisible && this.isPageVisible) {
        this.markAllAsRead();
        this.notifyVisibilityChangeListeners();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // 포커스 이벤트로도 처리 (일부 브라우저에서 visibilitychange가 제대로 작동하지 않을 때)
    window.addEventListener('focus', () => {
      if (!this.isPageVisible) {
        this.isPageVisible = true;
        this.markAllAsRead();
        this.notifyVisibilityChangeListeners();
      }
    });

    window.addEventListener('blur', () => {
      this.isPageVisible = false;
    });
  }

  // 새 메시지를 버퍼에 추가
  addMessage(message: Omit<BufferedMessage, 'receivedAt' | 'isRead'>): boolean {
    // 중복 체크
    const isDuplicate = this.buffer.some(buffered => 
      buffered.id === message.id || 
      (buffered.text === message.text && 
       buffered.userId === message.userId &&
       Math.abs(new Date(buffered.timestamp).getTime() - new Date(message.timestamp).getTime()) < 5000)
    );

    if (isDuplicate) {
      console.log('⚠️ 중복 메시지 버퍼링 스킵:', message.id);
      return false;
    }

    const bufferedMessage: BufferedMessage = {
      ...message,
      receivedAt: Date.now(),
      isRead: this.isPageVisible // 페이지가 보이면 즉시 읽음 처리
    };

    this.buffer.push(bufferedMessage);
    
    // 버퍼 크기 제한
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.maxBufferSize);
    }

    console.log('📬 메시지 버퍼에 추가:', {
      messageId: message.id,
      userName: message.userName,
      isPageVisible: this.isPageVisible,
      bufferSize: this.buffer.length,
      isRead: bufferedMessage.isRead
    });

    return true;
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

  // 오래된 메시지 정리 (1시간 이상된 메시지)
  cleanupOldMessages(): number {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const beforeCount = this.buffer.length;
    
    this.buffer = this.buffer.filter(msg => msg.receivedAt > oneHourAgo);
    
    const removedCount = beforeCount - this.buffer.length;
    if (removedCount > 0) {
      console.log('🧹 오래된 메시지 정리됨:', removedCount);
    }
    
    return removedCount;
  }

  // 디버그 정보 반환
  getDebugInfo() {
    return {
      bufferSize: this.buffer.length,
      unreadCount: this.getUnreadCount(),
      isPageVisible: this.isPageVisible,
      messages: this.buffer.map(msg => ({
        id: msg.id,
        userName: msg.userName,
        text: msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : ''),
        isRead: msg.isRead,
        receivedAt: new Date(msg.receivedAt).toLocaleTimeString()
      }))
    };
  }
}

// 싱글톤 인스턴스
export const messageBuffer = new MessageBuffer();

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