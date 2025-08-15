// Notification API 안전성 유틸리티

/**
 * Notification API가 지원되는지 안전하게 확인
 */
export const isNotificationSupported = (): boolean => {
  try {
    return (
      typeof window !== 'undefined' && 
      'Notification' in window && 
      typeof Notification !== 'undefined' &&
      typeof Notification.permission !== 'undefined'
    );
  } catch (error) {
    console.warn('Failed to check Notification support:', error);
    return false;
  }
};

/**
 * Notification 권한 상태를 안전하게 가져오기
 */
export const getNotificationPermission = (): string => {
  if (!isNotificationSupported()) {
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
 * 안전하게 Notification 생성 (모바일 화면 잠김 시에도 표시)
 */
export const createSafeNotification = (title: string, options?: NotificationOptions): Notification | null => {
  if (!isNotificationSupported()) {
    console.log('Notification not supported');
    return null;
  }
  
  if (getNotificationPermission() !== 'granted') {
    console.log('Notification permission not granted');
    return null;
  }
  
  try {
    // 모바일 환경 감지
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const notificationOptions: NotificationOptions = {
      icon: '/images/cat.jpg',
      badge: '/images/cat.jpg',
      // 모바일에서 화면 잠김 시에도 알림이 표시되도록 설정
      requireInteraction: isMobile, // 모바일에서는 사용자 상호작용 필요
      silent: false, // 소리 활성화
      ...options,
    };
    
    // 모바일에서 진동 지원
    if (isMobile && 'vibrate' in navigator) {
      (notificationOptions as any).vibrate = [200, 100, 200];
    }
    
    const notification = new Notification(title, notificationOptions);
    
    // 모바일이 아닌 경우만 자동 닫기 (모바일에서는 사용자가 직접 닫도록)
    if (!isMobile) {
      setTimeout(() => {
        try {
          notification.close();
        } catch (closeError) {
          console.warn('Failed to close notification:', closeError);
        }
      }, 5000);
    }
    
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};

/**
 * PWA 알림 지원 여부 확인
 */
export const isPWANotificationSupported = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const hasNotification = 'Notification' in window;
  
  // iOS PWA 환경 감지
  const isIOSPWA = (window.navigator as any).standalone === true;
  const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches;
  const isPWA = isIOSPWA || isAndroidPWA;

  return hasServiceWorker && hasPushManager && hasNotification;
};

/**
 * 향상된 알림 권한 상태 확인 (PWA 포함)
 */
export const getEnhancedNotificationPermission = (): string => {
  // 기본 Notification API 확인
  if (isNotificationSupported()) {
    const permission = getNotificationPermission();
    if (permission === 'granted') {
      return 'granted';
    }
    if (permission === 'denied') {
      return 'denied';
    }
    if (permission === 'default') {
      return 'default';
    }
  }
  
  // PWA 지원 확인
  if (isPWANotificationSupported()) {
    return 'pwa-supported';
  }
  
  // Service Worker와 Push API가 있다면 부분적 지원
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
    return 'partial';
  }
  
  return 'unsupported';
};

/**
 * 안전하게 Notification 권한 요청 (PWA 지원 포함)
 */
export const requestNotificationPermissionSafe = async (): Promise<boolean> => {
  const permission = getEnhancedNotificationPermission();
  
  console.log('🔔 Current notification permission status:', permission);
  
  // 이미 허용된 경우
  if (permission === 'granted') {
    return true;
  }
  
  // 차단된 경우
  if (permission === 'denied') {
    return false;
  }
  
  // PWA 지원 가능한 경우
  if (permission === 'pwa-supported' || permission === 'partial') {
    try {
      console.log('📱 Requesting PWA notification permission...');
      return await requestPWANotificationPermission();
    } catch (error) {
      console.error('❌ PWA notification permission request failed:', error);
    }
  }
  
  // 기본 Notification API 시도
  if (isNotificationSupported()) {
    try {
      console.log('🔔 Requesting standard notification permission...');
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch (error) {
      console.error('❌ Standard notification permission request failed:', error);
    }
  }
  
  console.log('❌ Notification not supported on this device/browser');
  return false;
};

/**
 * PWA 알림 권한 요청
 */
const requestPWANotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    // Service Worker 등록
    console.log('🔧 Registering Service Worker for PWA notifications...');
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    
    console.log('✅ Service Worker registered:', registration);

    // 알림 권한 요청
    const permission = await Notification.requestPermission();
    console.log('🔔 Notification permission result:', permission);

    if (permission === 'granted') {
      // 푸시 구독 생성
      const subscription = await createPushSubscription(registration);
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
const createPushSubscription = async (registration: ServiceWorkerRegistration): Promise<PushSubscription | null> => {
  try {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error('❌ VAPID public key not found');
      return null;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
    });

    // 서버에 구독 정보 전송
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription)
    });

    if (response.ok) {
      console.log('✅ Push subscription created and saved');
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
 * VAPID 키를 Uint8Array로 변환
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}