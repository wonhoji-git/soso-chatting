// 강화된 PWA 환경 감지 및 최적화 유틸리티

export interface PWAEnvironment {
  isStandalone: boolean;
  isIOSPWA: boolean;
  isAndroidPWA: boolean;
  isMobileWebApp: boolean;
  platform: 'ios' | 'android' | 'desktop' | 'mobile';
  browser: 'safari' | 'chrome' | 'firefox' | 'samsung' | 'edge' | 'unknown';
  hasServiceWorkerSupport: boolean;
  hasPushSupport: boolean;
  hasNotificationSupport: boolean;
  displayMode: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  installPromptAvailable: boolean;
  backgroundSyncSupport: boolean;
  wakeLockSupport: boolean;
  vibrationSupport: boolean;
}

// 설치 프롬프트 상태 추적
let installPromptEvent: any = null;
let isInstallPromptAvailable = false;

// 설치 프롬프트 이벤트 리스너 설정
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPromptEvent = e;
    isInstallPromptAvailable = true;
    console.log('📲 PWA install prompt is now available');
  });

  window.addEventListener('appinstalled', () => {
    installPromptEvent = null;
    isInstallPromptAvailable = false;
    console.log('✅ PWA has been installed');
  });
}

/**
 * 강화된 PWA 환경 종합 감지
 */
export const detectPWAEnvironment = (): PWAEnvironment => {
  if (typeof window === 'undefined') {
    return {
      isStandalone: false,
      isIOSPWA: false,
      isAndroidPWA: false,
      isMobileWebApp: false,
      platform: 'desktop',
      browser: 'unknown',
      hasServiceWorkerSupport: false,
      hasPushSupport: false,
      hasNotificationSupport: false,
      displayMode: 'browser',
      installPromptAvailable: false,
      backgroundSyncSupport: false,
      wakeLockSupport: false,
      vibrationSupport: false
    };
  }

  const userAgent = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  // PWA standalone 모드 감지
  const isStandalone = (window.navigator as any).standalone === true || 
                      window.matchMedia('(display-mode: standalone)').matches ||
                      window.matchMedia('(display-mode: fullscreen)').matches;

  // iOS PWA 감지 (더 정확한 방식)
  const isIOSPWA = isIOS && isStandalone;
  
  // 안드로이드 PWA 감지
  const isAndroidPWA = isAndroid && isStandalone;
  
  // 모바일 웹앱 여부 (PWA는 아니지만 모바일에서 실행)
  const isMobileWebApp = isMobile && !isStandalone;

  // 플랫폼 결정
  let platform: 'ios' | 'android' | 'desktop' | 'mobile';
  if (isIOS) {
    platform = 'ios';
  } else if (isAndroid) {
    platform = 'android';
  } else if (isMobile) {
    platform = 'mobile';
  } else {
    platform = 'desktop';
  }

  // 브라우저 감지
  let browser: 'safari' | 'chrome' | 'firefox' | 'samsung' | 'edge' | 'unknown';
  if (userAgent.includes('SamsungBrowser')) {
    browser = 'samsung';
  } else if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browser = 'chrome';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'safari';
  } else if (userAgent.includes('Firefox')) {
    browser = 'firefox';
  } else if (userAgent.includes('Edg')) {
    browser = 'edge';
  } else {
    browser = 'unknown';
  }

  // 디스플레이 모드 감지
  let displayMode: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  if (window.matchMedia('(display-mode: standalone)').matches) {
    displayMode = 'standalone';
  } else if (window.matchMedia('(display-mode: fullscreen)').matches) {
    displayMode = 'fullscreen';
  } else if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    displayMode = 'minimal-ui';
  } else {
    displayMode = 'browser';
  }

  // 기능 지원 여부 (강화된 감지)
  const hasServiceWorkerSupport = 'serviceWorker' in navigator;
  const hasPushSupport = 'PushManager' in window;
  const hasNotificationSupport = 'Notification' in window;
  const backgroundSyncSupport = hasServiceWorkerSupport && 'sync' in window.ServiceWorkerRegistration.prototype;
  const wakeLockSupport = 'wakeLock' in navigator;
  const vibrationSupport = 'vibrate' in navigator;

  return {
    isStandalone,
    isIOSPWA,
    isAndroidPWA,
    isMobileWebApp,
    platform,
    browser,
    hasServiceWorkerSupport,
    hasPushSupport,
    hasNotificationSupport,
    displayMode,
    installPromptAvailable: isInstallPromptAvailable,
    backgroundSyncSupport,
    wakeLockSupport,
    vibrationSupport
  };
};

/**
 * PWA 최적화 권장사항 제공
 */
export const getPWAOptimizationRecommendations = (env: PWAEnvironment) => {
  const recommendations = {
    heartbeatInterval: 30000, // 기본값
    notificationStrategy: 'standard' as 'aggressive' | 'standard' | 'conservative',
    connectionRetryStrategy: 'standard' as 'aggressive' | 'standard' | 'conservative',
    backgroundSyncInterval: 60000, // 기본값
    requireInteractionForNotifications: false,
    useVibration: false,
    allowPersistentNotifications: false
  };

  // iOS PWA 최적화
  if (env.isIOSPWA) {
    recommendations.heartbeatInterval = 25000; // iOS PWA에서는 더 짧게
    recommendations.notificationStrategy = 'conservative'; // iOS는 보수적으로
    recommendations.requireInteractionForNotifications = false; // iOS PWA에서는 false가 더 안정적
    recommendations.useVibration = true;
    recommendations.allowPersistentNotifications = false; // iOS PWA는 persistent 제한
  }

  // 안드로이드 PWA 최적화
  else if (env.isAndroidPWA) {
    recommendations.heartbeatInterval = 20000; // 안드로이드는 더 자주
    recommendations.notificationStrategy = 'aggressive'; // 안드로이드는 적극적으로
    recommendations.requireInteractionForNotifications = true; // 안드로이드 PWA는 true 필요
    recommendations.useVibration = true;
    recommendations.allowPersistentNotifications = true; // 안드로이드는 persistent 지원
  }

  // 모바일 웹앱 최적화
  else if (env.isMobileWebApp) {
    recommendations.heartbeatInterval = 20000;
    recommendations.notificationStrategy = 'standard';
    recommendations.connectionRetryStrategy = 'aggressive'; // 모바일 네트워크 불안정성 대응
    recommendations.requireInteractionForNotifications = true;
    recommendations.useVibration = true;
  }

  // 데스크톱 최적화
  else if (env.platform === 'desktop') {
    recommendations.heartbeatInterval = 30000; // 데스크톱은 여유롭게
    recommendations.notificationStrategy = 'standard';
    recommendations.requireInteractionForNotifications = false; // 데스크톱은 false
    recommendations.useVibration = false; // 데스크톱은 진동 없음
    recommendations.backgroundSyncInterval = 90000; // 더 길게
  }

  return recommendations;
};

/**
 * PWA 설치 프롬프트 표시
 */
export const showPWAInstallPrompt = async (): Promise<boolean> => {
  if (!installPromptEvent) {
    console.warn('PWA install prompt is not available');
    return false;
  }

  try {
    installPromptEvent.prompt();
    const result = await installPromptEvent.userChoice;
    
    console.log('PWA install prompt result:', result.outcome);
    
    if (result.outcome === 'accepted') {
      installPromptEvent = null;
      isInstallPromptAvailable = false;
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error showing PWA install prompt:', error);
    return false;
  }
};

/**
 * PWA 설치 가능 여부 확인 (강화된 버전)
 */
export const isPWAInstallable = (): boolean => {
  const env = detectPWAEnvironment();
  return !env.isStandalone && env.installPromptAvailable;
};

/**
 * 상태 복구를 위한 이벤트 통합 관리
 */
export const setupStateRecoveryListeners = () => {
  if (typeof window === 'undefined') return;

  // PWA 상태 변경 감지
  const handleAppStateChange = () => {
    const env = detectPWAEnvironment();
    window.dispatchEvent(new CustomEvent('pwaStateChanged', {
      detail: { environment: env, timestamp: Date.now() }
    }));
  };

  // 디스플레이 모드 변경 리스너
  const displayModeQueries = [
    '(display-mode: standalone)',
    '(display-mode: fullscreen)',
    '(display-mode: minimal-ui)'
  ];

  displayModeQueries.forEach(query => {
    const mediaQuery = window.matchMedia(query);
    mediaQuery.addListener(handleAppStateChange);
  });

  // 설치/제거 이벤트
  window.addEventListener('appinstalled', handleAppStateChange);
  
  console.log('🔧 PWA state recovery listeners set up');
};

/**
 * PWA 디버그 정보 출력
 */
export const logPWADebugInfo = () => {
  const env = detectPWAEnvironment();
  const recommendations = getPWAOptimizationRecommendations(env);
  
  console.group('🚀 PWA Environment Debug Info');
  console.log('Environment:', env);
  console.log('Optimization Recommendations:', recommendations);
  console.log('User Agent:', navigator.userAgent);
  console.log('Display Mode:', window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser');
  console.log('Viewport:', {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio
  });
  console.groupEnd();
};

// 개발 환경에서 자동으로 디버그 정보 출력
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // 페이지 로드 후 디버그 정보 출력
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', logPWADebugInfo);
  } else {
    setTimeout(logPWADebugInfo, 1000);
  }
}