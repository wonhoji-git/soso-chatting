// utils/backgroundDetection.ts
// 모바일 환경에서 백그라운드 상태를 정확하게 감지하는 유틸리티

export interface BackgroundState {
  isBackground: boolean;
  isVisible: boolean;
  visibilityState: string;
  hasFocus: boolean;
  lastActivityTime: number;
  appState: 'active' | 'background' | 'suspended' | 'hidden';
  platform: 'mobile' | 'desktop' | 'tablet';
  isPWA: boolean;
}

class BackgroundDetection {
  private state: BackgroundState;
  private listeners: ((state: BackgroundState) => void)[] = [];
  private activityTimer: ReturnType<typeof setTimeout> | null = null;
  private lastUserActivity: number = Date.now();
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.state = this.getInitialState();
    this.setupEventListeners();
    this.startPeriodicCheck();
  }

  private getInitialState(): BackgroundState {
    const platform = this.detectPlatform();
    const isPWA = this.isPWAMode();
    
    return {
      isBackground: typeof document !== 'undefined' ? document.hidden : false,
      isVisible: typeof document !== 'undefined' ? !document.hidden : true,
      visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'visible',
      hasFocus: typeof document !== 'undefined' ? document.hasFocus() : true,
      lastActivityTime: Date.now(),
      appState: 'active',
      platform,
      isPWA
    };
  }

  private detectPlatform(): 'mobile' | 'desktop' | 'tablet' {
    if (typeof window === 'undefined') return 'desktop';
    
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /iPad/i.test(userAgent) || (userAgent.includes('Macintosh') && 'ontouchend' in document);
    
    if (isTablet) return 'tablet';
    if (isMobile) return 'mobile';
    return 'desktop';
  }

  private isPWAMode(): boolean {
    if (typeof window === 'undefined') return false;
    
    // PWA 환경 감지
    const isIOSPWA = (window.navigator as any).standalone === true;
    const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches ||
                        window.matchMedia('(display-mode: fullscreen)').matches;
    
    return isIOSPWA || isAndroidPWA;
  }

  private setupEventListeners() {
    if (typeof document === 'undefined') return;

    // Page Visibility API
    document.addEventListener('visibilitychange', () => {
      this.updateVisibilityState();
    });

    // Focus/Blur events (더 정확한 감지를 위해)
    window.addEventListener('focus', () => {
      this.updateFocusState(true);
    });

    window.addEventListener('blur', () => {
      this.updateFocusState(false);
    });

    // 모바일 환경에서 중요한 이벤트들
    if (this.state.platform === 'mobile') {
      // 터치 이벤트로 사용자 활동 감지
      document.addEventListener('touchstart', () => {
        this.updateUserActivity();
      }, { passive: true });

      document.addEventListener('touchmove', () => {
        this.updateUserActivity();
      }, { passive: true });

      // 페이지 숨김/표시 이벤트 (모바일 특화)
      document.addEventListener('pagehide', () => {
        this.setState({ appState: 'hidden', isBackground: true });
        console.log('📱 [Mobile] Page hidden event triggered');
      });

      document.addEventListener('pageshow', () => {
        this.setState({ appState: 'active', isBackground: false });
        console.log('📱 [Mobile] Page show event triggered');
      });

      // 앱 상태 변경 감지 (PWA 환경)
      if (this.state.isPWA) {
        // PWA에서 백그라운드 이벤트
        document.addEventListener('freeze', () => {
          this.setState({ appState: 'suspended', isBackground: true });
          console.log('🧊 [PWA] App frozen (background)');
        });

        document.addEventListener('resume', () => {
          this.setState({ appState: 'active', isBackground: false });
          console.log('▶️ [PWA] App resumed (foreground)');
        });
      }
    }

    // 키보드 및 마우스 활동 감지
    ['keydown', 'mousedown', 'mousemove', 'scroll'].forEach(event => {
      document.addEventListener(event, () => {
        this.updateUserActivity();
      }, { passive: true });
    });
  }

  private updateVisibilityState() {
    if (typeof document === 'undefined') return;

    const wasBackground = this.state.isBackground;
    const isVisible = !document.hidden;
    const visibilityState = document.visibilityState;
    const isBackground = document.hidden;

    console.log('👁️ Visibility state changed:', {
      from: wasBackground ? 'background' : 'foreground',
      to: isBackground ? 'background' : 'foreground',
      visibilityState,
      platform: this.state.platform,
      isPWA: this.state.isPWA,
      timestamp: new Date().toISOString()
    });

    this.setState({
      isVisible,
      visibilityState,
      isBackground,
      appState: isBackground ? 'background' : 'active',
      lastActivityTime: isBackground ? this.state.lastActivityTime : Date.now()
    });
  }

  private updateFocusState(hasFocus: boolean) {
    console.log('🎯 Focus state changed:', {
      hasFocus,
      wasBackground: this.state.isBackground,
      platform: this.state.platform,
      timestamp: new Date().toISOString()
    });

    // 포커스 상태와 가시성을 결합하여 백그라운드 상태 결정
    const isBackground = !hasFocus || this.state.isVisible === false;

    this.setState({
      hasFocus,
      isBackground,
      appState: isBackground ? 'background' : 'active',
      lastActivityTime: hasFocus ? Date.now() : this.state.lastActivityTime
    });
  }

  private updateUserActivity() {
    this.lastUserActivity = Date.now();
    
    // 활동이 있으면 앱이 활성 상태로 간주
    if (this.state.isBackground && this.state.isVisible) {
      console.log('🏃 User activity detected, marking as active');
      this.setState({
        appState: 'active',
        isBackground: false,
        lastActivityTime: this.lastUserActivity
      });
    }
  }

  private startPeriodicCheck() {
    // 주기적으로 상태 확인 (모바일에서는 더 자주)
    const interval = this.state.platform === 'mobile' ? 5000 : 10000;
    
    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, interval);
  }

  private performHealthCheck() {
    if (typeof document === 'undefined') return;

    const now = Date.now();
    const timeSinceActivity = now - this.lastUserActivity;
    const actualVisibility = !document.hidden;
    const actualFocus = document.hasFocus();

    // 상태 불일치 감지 및 수정
    if (this.state.isVisible !== actualVisibility || this.state.hasFocus !== actualFocus) {
      console.log('🔧 State inconsistency detected, correcting:', {
        stored: { visible: this.state.isVisible, focus: this.state.hasFocus },
        actual: { visible: actualVisibility, focus: actualFocus },
        timeSinceActivity,
        platform: this.state.platform
      });

      this.setState({
        isVisible: actualVisibility,
        hasFocus: actualFocus,
        isBackground: !actualVisibility || !actualFocus,
        visibilityState: document.visibilityState,
        appState: (!actualVisibility || !actualFocus) ? 'background' : 'active'
      });
    }

    // 장시간 비활성 감지 (모바일에서는 더 짧게)
    const inactiveThreshold = this.state.platform === 'mobile' ? 30000 : 60000; // 30초/60초
    if (timeSinceActivity > inactiveThreshold && this.state.appState === 'active') {
      console.log('😴 Long inactivity detected, marking as background');
      this.setState({
        appState: 'background',
        isBackground: true
      });
    }
  }

  private setState(updates: Partial<BackgroundState>) {
    const previousState = { ...this.state };
    this.state = { ...this.state, ...updates };

    // 상태 변경 로깅
    const stateChanged = Object.keys(updates).some(key => 
      previousState[key as keyof BackgroundState] !== this.state[key as keyof BackgroundState]
    );

    if (stateChanged) {
      console.log('🔄 Background state updated:', {
        previous: previousState,
        current: this.state,
        changes: updates,
        timestamp: new Date().toISOString()
      });

      // 리스너들에게 알림
      this.listeners.forEach(listener => {
        try {
          listener(this.state);
        } catch (error) {
          console.error('Error in background state listener:', error);
        }
      });
    }
  }

  // Public API
  public getState(): BackgroundState {
    return { ...this.state };
  }

  public isInBackground(): boolean {
    return this.state.isBackground;
  }

  public isActive(): boolean {
    return this.state.appState === 'active' && this.state.isVisible && this.state.hasFocus;
  }

  public addListener(listener: (state: BackgroundState) => void): () => void {
    this.listeners.push(listener);
    
    // 제거 함수 반환
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public getDebugInfo() {
    return {
      state: this.state,
      listenerCount: this.listeners.length,
      lastUserActivity: new Date(this.lastUserActivity).toISOString(),
      timeSinceActivity: Date.now() - this.lastUserActivity,
      healthCheckActive: !!this.checkInterval
    };
  }

  public destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    if (this.activityTimer) {
      clearTimeout(this.activityTimer);
      this.activityTimer = null;
    }
    
    this.listeners = [];
    console.log('🗑️ Background detection destroyed');
  }
}

// 싱글톤 인스턴스
export const backgroundDetection = new BackgroundDetection();

// 편의 함수들
export const isAppInBackground = (): boolean => {
  return backgroundDetection.isInBackground();
};

export const isAppActive = (): boolean => {
  return backgroundDetection.isActive();
};

export const getBackgroundState = (): BackgroundState => {
  return backgroundDetection.getState();
};

export const onBackgroundStateChange = (listener: (state: BackgroundState) => void): (() => void) => {
  return backgroundDetection.addListener(listener);
};

export const getBackgroundDebugInfo = () => {
  return backgroundDetection.getDebugInfo();
};