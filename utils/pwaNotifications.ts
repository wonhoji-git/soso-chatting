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
 * 푸시 알림 권한 요청 (PWA)
 */
export const requestPWANotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false;
  }

  // iOS PWA 환경 감지
  const isIOSPWA = (window.navigator as any).standalone === true;
  const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches;
  const isPWA = isIOSPWA || isAndroidPWA;

  console.log('📱 PWA Environment Check:', {
    isIOSPWA,
    isAndroidPWA,
    isPWA,
    userAgent: navigator.userAgent,
    standalone: (window.navigator as any).standalone
  });

  // Service Worker 지원 확인
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('❌ Push messaging not supported');
    return false;
  }

  try {
    // Service Worker 등록
    const registration = await registerServiceWorker();
    if (!registration) {
      console.log('❌ Service Worker registration failed');
      return false;
    }

    // 알림 권한 요청
    const permission = await Notification.requestPermission();
    console.log('🔔 Notification permission result:', permission);

    if (permission === 'granted') {
      // 푸시 구독 생성
      const subscription = await subscribeToPush(registration);
      return subscription !== null;
    }

    return false;
  } catch (error) {
    console.error('❌ Failed to request PWA notification permission:', error);
    return false;
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