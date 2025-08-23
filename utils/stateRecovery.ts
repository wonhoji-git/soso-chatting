// utils/stateRecovery.ts
// 백그라운드 복귀 시 앱 상태 복구를 위한 유틸리티

export interface AppState {
  pusherConnected: boolean;
  currentUser: any | null;
  messageCount: number;
  onlineUsers: any[];
  lastActivity: number;
  channelSubscribed: boolean;
  backgroundDuration: number;
}

export interface RecoveryAction {
  type: 'reconnect' | 'sync' | 'refresh' | 'notify';
  priority: 'high' | 'medium' | 'low';
  description: string;
  execute: () => Promise<boolean>;
}

class StateRecovery {
  private lastKnownState: AppState | null = null;
  private recoveryInProgress = false;
  private recoveryAttempts = 0;
  private maxRecoveryAttempts = 3;

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupRecoveryListeners();
      this.loadPersistedState();
    }
  }

  // 복구 리스너 설정
  private setupRecoveryListeners() {
    // 페이지 가시성 변경 감지
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.lastKnownState) {
        this.handleVisibilityReturn();
      }
    });

    // 네트워크 상태 변경 감지
    window.addEventListener('online', () => {
      if (this.lastKnownState) {
        this.handleNetworkReturn();
      }
    });

    // 포커스 복귀 감지
    window.addEventListener('focus', () => {
      if (this.lastKnownState) {
        this.handleFocusReturn();
      }
    });

    // PWA 앱 상태 변경 감지
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'APP_STATE_RECOVERY_NEEDED') {
          this.handleServiceWorkerRecoveryRequest(event.data);
        }
      });
    }
  }

  // 상태 저장
  saveState(state: AppState): void {
    this.lastKnownState = {
      ...state,
      lastActivity: Date.now()
    };

    // 중요한 상태는 localStorage에도 저장
    try {
      localStorage.setItem('appStateSnapshot', JSON.stringify({
        timestamp: Date.now(),
        state: this.lastKnownState
      }));
    } catch (error) {
      console.warn('Failed to persist state:', error);
    }
  }

  // 지속된 상태 로드
  private loadPersistedState(): void {
    try {
      const stored = localStorage.getItem('appStateSnapshot');
      if (stored) {
        const { timestamp, state } = JSON.parse(stored);
        
        // 5분 이내의 상태만 유효하다고 간주
        if (Date.now() - timestamp < 300000) {
          this.lastKnownState = state;
          console.log('🔄 Loaded persisted app state:', {
            age: Math.round((Date.now() - timestamp) / 1000) + 's',
            state: {
              pusherConnected: state.pusherConnected,
              hasUser: !!state.currentUser,
              messageCount: state.messageCount
            }
          });
        } else {
          localStorage.removeItem('appStateSnapshot');
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted state:', error);
      localStorage.removeItem('appStateSnapshot');
    }
  }

  // 가시성 복귀 처리
  private async handleVisibilityReturn(): Promise<void> {
    if (this.recoveryInProgress) return;
    
    const backgroundDuration = Date.now() - (this.lastKnownState?.lastActivity || 0);
    console.log('👁️ App became visible after', Math.round(backgroundDuration / 1000) + 's');

    if (backgroundDuration > 30000) { // 30초 이상 백그라운드
      await this.performRecovery('visibility_return', backgroundDuration);
    }
  }

  // 네트워크 복귀 처리  
  private async handleNetworkReturn(): Promise<void> {
    console.log('🌐 Network connection restored');
    await this.performRecovery('network_return', 0);
  }

  // 포커스 복귀 처리
  private async handleFocusReturn(): Promise<void> {
    const backgroundDuration = Date.now() - (this.lastKnownState?.lastActivity || 0);
    
    if (backgroundDuration > 10000) { // 10초 이상
      console.log('🎯 App focused after', Math.round(backgroundDuration / 1000) + 's');
      await this.performRecovery('focus_return', backgroundDuration);
    }
  }

  // Service Worker 복구 요청 처리
  private async handleServiceWorkerRecoveryRequest(data: any): Promise<void> {
    console.log('📱 Service Worker requested state recovery:', data);
    await this.performRecovery('service_worker_request', data.backgroundDuration || 0);
  }

  // 메인 복구 로직
  private async performRecovery(trigger: string, backgroundDuration: number): Promise<void> {
    if (this.recoveryInProgress || !this.lastKnownState) {
      return;
    }

    this.recoveryInProgress = true;
    this.recoveryAttempts++;

    console.log('🔄 Starting state recovery:', {
      trigger,
      backgroundDuration: Math.round(backgroundDuration / 1000) + 's',
      attempt: this.recoveryAttempts,
      lastKnownState: {
        pusherConnected: this.lastKnownState.pusherConnected,
        hasUser: !!this.lastKnownState.currentUser,
        messageCount: this.lastKnownState.messageCount
      }
    });

    try {
      const recoveryActions = this.planRecovery(trigger, backgroundDuration);
      await this.executeRecoveryActions(recoveryActions);
      
      console.log('✅ State recovery completed successfully');
      this.recoveryAttempts = 0;
      
    } catch (error) {
      console.error('❌ State recovery failed:', error);
      
      if (this.recoveryAttempts < this.maxRecoveryAttempts) {
        // 재시도
        setTimeout(() => {
          this.recoveryInProgress = false;
          this.performRecovery(`${trigger}_retry`, backgroundDuration);
        }, 2000 * this.recoveryAttempts);
      } else {
        console.error('🚨 Max recovery attempts reached, giving up');
        this.recoveryAttempts = 0;
      }
    } finally {
      setTimeout(() => {
        this.recoveryInProgress = false;
      }, 1000);
    }
  }

  // 복구 계획 수립
  private planRecovery(trigger: string, backgroundDuration: number): RecoveryAction[] {
    const actions: RecoveryAction[] = [];
    
    if (!this.lastKnownState) return actions;

    // 장시간 백그라운드였다면 전체 재연결
    if (backgroundDuration > 300000) { // 5분+
      actions.push({
        type: 'reconnect',
        priority: 'high',
        description: 'Full reconnection after long background',
        execute: async () => {
          return this.executeFullReconnection();
        }
      });
    }

    // Pusher 연결 상태 확인 및 복구
    if (this.lastKnownState.pusherConnected) {
      actions.push({
        type: 'sync',
        priority: 'high',
        description: 'Verify and restore Pusher connection',
        execute: async () => {
          return this.executePusherReconnection();
        }
      });
    }

    // 서버와 상태 동기화
    if (this.lastKnownState.currentUser) {
      actions.push({
        type: 'sync',
        priority: 'medium',
        description: 'Synchronize with server state',
        execute: async () => {
          return this.executeServerSync();
        }
      });
    }

    // 메시지 누락 확인
    actions.push({
      type: 'sync',
      priority: 'medium',
      description: 'Check for missed messages',
      execute: async () => {
        return this.executeMessageSync();
      }
    });

    // 알림 권한 재확인 (모바일에서 중요)
    if (backgroundDuration > 60000) { // 1분+
      actions.push({
        type: 'notify',
        priority: 'low',
        description: 'Verify notification permissions',
        execute: async () => {
          return this.executeNotificationCheck();
        }
      });
    }

    return actions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // 복구 액션 실행
  private async executeRecoveryActions(actions: RecoveryAction[]): Promise<void> {
    for (const action of actions) {
      try {
        console.log(`🔧 Executing: ${action.description}`);
        const success = await action.execute();
        
        if (!success) {
          console.warn(`⚠️ Recovery action failed: ${action.description}`);
          if (action.priority === 'high') {
            throw new Error(`Critical recovery action failed: ${action.description}`);
          }
        } else {
          console.log(`✅ Completed: ${action.description}`);
        }
      } catch (error) {
        console.error(`❌ Error in recovery action: ${action.description}`, error);
        if (action.priority === 'high') {
          throw error;
        }
      }
      
      // 액션 간 짧은 지연
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // 각 복구 액션 구현
  private async executeFullReconnection(): Promise<boolean> {
    try {
      // 전역 이벤트로 전체 재연결 요청
      window.dispatchEvent(new CustomEvent('requestFullReconnection', {
        detail: {
          reason: 'state_recovery',
          backgroundDuration: Date.now() - (this.lastKnownState?.lastActivity || 0)
        }
      }));
      return true;
    } catch (error) {
      console.error('Full reconnection failed:', error);
      return false;
    }
  }

  private async executePusherReconnection(): Promise<boolean> {
    try {
      window.dispatchEvent(new CustomEvent('requestPusherReconnection', {
        detail: { reason: 'state_recovery' }
      }));
      return true;
    } catch (error) {
      console.error('Pusher reconnection failed:', error);
      return false;
    }
  }

  private async executeServerSync(): Promise<boolean> {
    try {
      window.dispatchEvent(new CustomEvent('requestServerSync', {
        detail: { reason: 'state_recovery' }
      }));
      return true;
    } catch (error) {
      console.error('Server sync failed:', error);
      return false;
    }
  }

  private async executeMessageSync(): Promise<boolean> {
    try {
      // Service Worker에 버퍼된 메시지 요청
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'GET_BUFFERED_MESSAGES',
          source: 'state_recovery'
        });
      }
      
      window.dispatchEvent(new CustomEvent('requestMessageSync', {
        detail: { reason: 'state_recovery' }
      }));
      return true;
    } catch (error) {
      console.error('Message sync failed:', error);
      return false;
    }
  }

  private async executeNotificationCheck(): Promise<boolean> {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        // 알림 상태는 정상
        return true;
      }
      
      // 알림 권한이 변경되었을 수 있음을 알림
      window.dispatchEvent(new CustomEvent('notificationPermissionChanged', {
        detail: { 
          permission: 'Notification' in window ? Notification.permission : 'unsupported',
          reason: 'state_recovery'
        }
      }));
      
      return true;
    } catch (error) {
      console.error('Notification check failed:', error);
      return false;
    }
  }

  // 외부에서 복구 상태 확인
  isRecoveryInProgress(): boolean {
    return this.recoveryInProgress;
  }

  // 복구 통계
  getRecoveryStats() {
    return {
      recoveryInProgress: this.recoveryInProgress,
      recoveryAttempts: this.recoveryAttempts,
      hasLastKnownState: !!this.lastKnownState,
      lastStateAge: this.lastKnownState ? 
        Date.now() - this.lastKnownState.lastActivity : null
    };
  }

  // 수동 복구 트리거
  async triggerManualRecovery(): Promise<void> {
    if (this.recoveryInProgress) {
      console.log('Recovery already in progress');
      return;
    }
    
    console.log('🔧 Manual state recovery triggered');
    await this.performRecovery('manual_trigger', 0);
  }

  // 정리
  destroy(): void {
    this.lastKnownState = null;
    this.recoveryInProgress = false;
    this.recoveryAttempts = 0;
  }
}

// 싱글톤 인스턴스
export const stateRecovery = new StateRecovery();

// 편의 함수들
export const saveAppState = (state: AppState) => {
  stateRecovery.saveState(state);
};

export const triggerStateRecovery = () => {
  return stateRecovery.triggerManualRecovery();
};

export const getRecoveryStats = () => {
  return stateRecovery.getRecoveryStats();
};

export default stateRecovery;