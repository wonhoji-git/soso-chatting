// PWA 푸시 알림 유틸리티

/**
 * Service Worker 등록
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('❌ Service Worker not supported');
    return null;
  }

  try {
    console.log('🔧 Registering Service Worker...');
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    
    console.log('✅ Service Worker registered successfully:', registration);
    return registration;
  } catch (error) {
    console.error('❌ Service Worker registration failed:', error);
    return null;
  }
};

/**
 * 푸시 알림 권한 요청 (PWA) - 개선된 버전
 */
export const requestPWANotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false;
  }

  // 플랫폼별 PWA 환경 감지
  const isIOSPWA = (window.navigator as any).standalone === true;
  const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches || 
                       window.matchMedia('(display-mode: fullscreen)').matches;
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isChrome = /Chrome/i.test(navigator.userAgent);
  const isSamsung = /SamsungBrowser/i.test(navigator.userAgent);
  const isPWA = isIOSPWA || isAndroidPWA;

  console.log('📱 Enhanced PWA Environment Check:', {
    isIOSPWA,
    isIOSSafari,
    isAndroidPWA,
    isAndroid,
    isChrome,
    isSamsung,
    isPWA,
    userAgent: navigator.userAgent.substring(0, 100) + '...',
    standalone: (window.navigator as any).standalone,
    displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 
                 window.matchMedia('(display-mode: fullscreen)').matches ? 'fullscreen' : 'browser'
  });

  // Service Worker 지원 확인
  if (!('serviceWorker' in navigator)) {
    console.log('❌ Service Worker not supported');
    return false;
  }

  // 알림 API 지원 확인
  if (!('Notification' in window)) {
    console.log('❌ Notification API not supported');
    return false;
  }

  try {
    // Service Worker 등록 (플랫폼별 최적화)
    const registration = await registerServiceWorkerWithRetry(3);
    if (!registration) {
      console.log('❌ Service Worker registration failed after retries');
      return false;
    }

    // 현재 권한 상태 확인
    let currentPermission = Notification.permission;
    console.log('🔔 Current notification permission:', currentPermission);

    // 이미 권한이 있으면 푸시 구독만 생성
    if (currentPermission === 'granted') {
      console.log('✅ Notification permission already granted');
      const subscription = await subscribeToPush(registration);
      return subscription !== null;
    }

    // 권한이 거부된 경우
    if (currentPermission === 'denied') {
      console.log('❌ Notification permission denied. User must enable manually in settings.');
      return false;
    }

    // 권한 요청 (플랫폼별 처리)
    let permission: NotificationPermission;
    
    if (isIOSPWA && isIOSSafari) {
      // iOS PWA 특별 처리
      console.log('🍎 Requesting iOS PWA notification permission...');
      permission = await requestIOSPWAPermission();
    } else if (isAndroid && (isChrome || isSamsung)) {
      // 안드로이드 Chrome/Samsung 특별 처리
      console.log('🤖 Requesting Android PWA notification permission...');
      permission = await requestAndroidPWAPermission();
    } else {
      // 일반적인 권한 요청
      console.log('🔔 Requesting standard notification permission...');
      permission = await Notification.requestPermission();
    }

    console.log('🔔 Final notification permission result:', permission);

    if (permission === 'granted') {
      // 푸시 구독 생성
      const subscription = await subscribeToPush(registration);
      
      if (subscription) {
        // 테스트 알림 표시
        await showTestNotification(isPWA, isAndroid);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('❌ Failed to request PWA notification permission:', error);
    return false;
  }
};

// Service Worker 등록 (재시도 포함)
const registerServiceWorkerWithRetry = async (maxRetries: number): Promise<ServiceWorkerRegistration | null> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔧 Service Worker registration attempt ${attempt}/${maxRetries}`);
      
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'all'
      });
      
      // Service Worker가 활성화될 때까지 대기
      await navigator.serviceWorker.ready;
      
      console.log('✅ Service Worker registered and ready');
      return registration;
      
    } catch (error) {
      console.error(`❌ Service Worker registration attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        // 다음 시도 전 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  return null;
};

// iOS PWA 권한 요청
const requestIOSPWAPermission = async (): Promise<NotificationPermission> => {
  return new Promise((resolve) => {
    // iOS에서는 동기적 방식과 비동기적 방식을 모두 시도
    if (typeof Notification.requestPermission === 'function') {
      const result = Notification.requestPermission();
      
      if (result && typeof result.then === 'function') {
        // Promise 기반 API
        (result as Promise<NotificationPermission>).then(resolve);
      } else {
        // 동기적 결과
        resolve(result as unknown as NotificationPermission);
      }
    } else if (typeof (Notification as any).requestPermission === 'function') {
      // 구식 콜백 방식
      (Notification as any).requestPermission(resolve);
    } else {
      resolve('denied');
    }
  });
};

// 안드로이드 PWA 권한 요청
const requestAndroidPWAPermission = async (): Promise<NotificationPermission> => {
  try {
    // 안드로이드는 일반적인 Promise 방식 사용
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Android PWA permission request failed:', error);
    return 'denied';
  }
};

// 테스트 알림 표시
const showTestNotification = async (isPWA: boolean, isAndroid: boolean): Promise<void> => {
  try {
    const title = isPWA ? '📱 PWA 알림 설정 완료!' : '🔔 알림 설정 완료!';
    const options: NotificationOptions & { vibrate?: number[] } = {
      body: '이제 새로운 메시지 알림을 받으실 수 있습니다.',
      icon: '/images/cat.jpg',
      badge: '/images/cat.jpg',
      tag: 'setup-complete',
      requireInteraction: true, // 모든 모바일에서 백그라운드 안정성을 위해 true
      vibrate: isAndroid ? [400, 200, 400, 200, 400] : [300, 150, 300],
      silent: false
    };

    const notification = new Notification(title, options);

    notification.onclick = () => {
      notification.close();
      window.focus();
    };

    // 모바일에서는 백그라운드 안정성을 위해 자동 닫기 하지 않음
    if (!isAndroid && typeof window !== 'undefined' && !/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      // 데스크톱에서만 자동 닫기
      setTimeout(() => {
        try {
          notification.close();
        } catch (error) {
          // 이미 닫혔거나 오류 발생 시 무시
        }
      }, 5000);
    }

    console.log('✅ Test notification displayed successfully');
  } catch (error) {
    console.warn('⚠️ Test notification failed, but permission was granted:', error);
  }
};

/**
 * 푸시 구독 생성
 */
export const subscribeToPush = async (
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> => {
  try {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error('❌ VAPID public key not found');
      return null;
    }

    console.log('🔐 Creating push subscription with VAPID key...');

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
    });

    console.log('✅ Push subscription created:', subscription);

    // 서버에 구독 정보 전송
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Subscription saved to server:', result);
      return subscription;
    } else {
      console.error('❌ Failed to save subscription to server');
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to create push subscription:', error);
    return null;
  }
};

/**
 * 브라우저 및 OS 감지
 */
export const getBrowserInfo = () => {
  if (typeof window === 'undefined') {
    return { isAndroid: false, isIOS: false, isChrome: false, isSamsung: false, isFirefox: false };
  }

  const userAgent = navigator.userAgent;
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isChrome = /Chrome/i.test(userAgent) && !/Edg/i.test(userAgent);
  const isSamsung = /SamsungBrowser/i.test(userAgent);
  const isFirefox = /Firefox/i.test(userAgent);

  return { isAndroid, isIOS, isChrome, isSamsung, isFirefox, userAgent };
};

/**
 * PWA 알림 지원 여부 확인 (향상된 안드로이드 지원)
 */
export const isPWANotificationSupported = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const hasNotification = 'Notification' in window;
  
  // PWA 환경 감지
  const isIOSPWA = (window.navigator as any).standalone === true;
  const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches;
  const isPWA = isIOSPWA || isAndroidPWA;

  // 브라우저 정보
  const browserInfo = getBrowserInfo();

  console.log('🔍 PWA Notification Support Check:', {
    hasServiceWorker,
    hasPushManager,
    hasNotification,
    isIOSPWA,
    isAndroidPWA,
    isPWA,
    ...browserInfo
  });

  // 안드로이드 Chrome, Samsung Browser 특별 지원
  if (browserInfo.isAndroid && (browserInfo.isChrome || browserInfo.isSamsung)) {
    return hasServiceWorker && hasPushManager && hasNotification;
  }

  // iOS PWA 지원
  if (browserInfo.isIOS && isIOSPWA) {
    return hasServiceWorker && hasPushManager && hasNotification;
  }

  // 기본 지원 확인
  return hasServiceWorker && hasPushManager && hasNotification;
};

/**
 * PWA 알림 권한 상태 확인
 */
export const getPWANotificationPermission = (): string => {
  if (typeof window === 'undefined') {
    return 'unsupported';
  }

  if (!isPWANotificationSupported()) {
    return 'unsupported';
  }

  try {
    return Notification.permission;
  } catch (error) {
    console.warn('Failed to access Notification.permission:', error);
    return 'unsupported';
  }
};

/**
 * 테스트 푸시 알림 전송
 */
export const sendTestPushNotification = async (message: string = '테스트 알림입니다! 🧪'): Promise<boolean> => {
  try {
    const response = await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: '🧪 테스트 알림',
        body: message,
        icon: '/images/cat.jpg',
        data: { url: '/', test: true }
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Test push notification sent:', result);
      return true;
    } else {
      console.error('❌ Failed to send test push notification');
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending test push notification:', error);
    return false;
  }
};

/**
 * VAPID 키를 Uint8Array로 변환
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * 기존 구독 해제
 */
export const unsubscribeFromPush = async (): Promise<boolean> => {
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
      console.log('❌ No service worker registration found');
      return false;
    }

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      console.log('❌ No existing subscription found');
      return false;
    }

    const result = await subscription.unsubscribe();
    console.log('✅ Push subscription cancelled:', result);
    return result;
  } catch (error) {
    console.error('❌ Failed to unsubscribe from push:', error);
    return false;
  }
};

/**
 * PWA 설치 프롬프트 처리
 */
export const handlePWAInstall = () => {
  let deferredPrompt: any;

  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('📱 PWA install prompt available');
    e.preventDefault();
    deferredPrompt = e;
    
    // PWA 설치 버튼 표시 (선택사항)
    // showPWAInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    console.log('✅ PWA installed successfully');
    deferredPrompt = null;
  });

  return {
    promptInstall: async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`PWA install result: ${outcome}`);
        deferredPrompt = null;
        return outcome === 'accepted';
      }
      return false;
    }
  };
};