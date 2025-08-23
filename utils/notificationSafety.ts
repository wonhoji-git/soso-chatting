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
 * 안전하게 Notification 생성 (안드로이드 PWA 최적화)
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
    // 플랫폼별 환경 감지
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches || 
                         window.matchMedia('(display-mode: fullscreen)').matches;
    const isChrome = /Chrome/i.test(navigator.userAgent);
    const isSamsung = /SamsungBrowser/i.test(navigator.userAgent);
    
    let notificationOptions: NotificationOptions = {
      icon: '/images/cat.jpg',
      badge: '/images/cat.jpg',
      silent: false, // 소리 활성화
      ...options,
    };

    // 플랫폼별 최적화된 알림 설정
    if (isAndroid && isAndroidPWA) {
      // 안드로이드 PWA는 백그라운드에서 requireInteraction true 필요
      notificationOptions = {
        ...notificationOptions,
        requireInteraction: true,
        tag: options?.tag || 'android-pwa-notification'
      };

      // 안드로이드 특화 설정
      const extendedOptions = notificationOptions as any;
      extendedOptions.vibrate = [500, 300, 500, 300, 500];
      extendedOptions.renotify = true;
      extendedOptions.persistent = true;
      extendedOptions.timestamp = Date.now();
      notificationOptions = extendedOptions;

      // Chrome/Samsung Browser 고급 기능
      if (isChrome || isSamsung) {
        const advancedOptions = notificationOptions as any;
        advancedOptions.image = '/images/cat.jpg';
        advancedOptions.actions = [
          {
            action: 'open',
            title: '채팅방 열기 💬'
          },
          {
            action: 'close',
            title: '닫기'
          }
        ];
        notificationOptions = advancedOptions;
      }
    } else if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      // iOS 최적화: PWA와 Safari 구분
      const isIOSPWA = (window.navigator as any).standalone === true;
      
      notificationOptions = {
        ...notificationOptions,
        // iOS PWA에서는 requireInteraction false가 더 안정적
        requireInteraction: isIOSPWA ? false : true,
        tag: options?.tag || 'ios-notification'
      };

      const iosOptions = notificationOptions as any;
      iosOptions.vibrate = isIOSPWA ? [300, 150, 300] : [300, 150, 300, 150, 300];
      iosOptions.persistent = true;
      // iOS PWA에서는 간단한 설정이 더 안정적
      if (isIOSPWA) {
        iosOptions.renotify = false; // iOS PWA에서는 renotify 문제가 있을 수 있음
      }
      notificationOptions = iosOptions;
    } else {
      // 기타 플랫폼 (데스크톱, 기타 모바일)
      const requiresInteraction = isMobile; // 모바일은 true, 데스크톱은 false
      notificationOptions.requireInteraction = requiresInteraction;
      
      if (isMobile && 'vibrate' in navigator) {
        (notificationOptions as any).vibrate = [200, 100, 200];
      }
    }
    
    console.log('🔔 Creating notification with options:', {
      title,
      options: notificationOptions,
      isAndroid,
      isAndroidPWA,
      isChrome,
      isSamsung
    });
    
    const notification = new Notification(title, notificationOptions);
    
    // 모바일에서는 백그라운드 안정성을 위해 자동 닫기 하지 않음
    if (!isMobile) {
      // 데스크톱에서만 자동 닫기
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
 * PWA 알림 지원 여부 확인 (iOS 특화)
 */
export const isPWANotificationSupported = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const hasNotification = 'Notification' in window;
  
  // 플랫폼별 PWA 환경 감지
  const isIOSPWA = (window.navigator as any).standalone === true;
  const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches || 
                       window.matchMedia('(display-mode: fullscreen)').matches;
  const isChrome = /Chrome/i.test(navigator.userAgent);
  const isSamsung = /SamsungBrowser/i.test(navigator.userAgent);
  const isPWA = isIOSPWA || isAndroidPWA;

  console.log('📱 PWA Environment Check:', {
    hasServiceWorker,
    hasPushManager,
    hasNotification,
    isIOSPWA,
    isIOSSafari,
    isAndroid,
    isAndroidPWA,
    isChrome,
    isSamsung,
    isPWA,
    userAgent: navigator.userAgent,
    standalone: (window.navigator as any).standalone,
    displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 
                 window.matchMedia('(display-mode: fullscreen)').matches ? 'fullscreen' : 
                 'browser'
  });

  // iOS Safari PWA에서는 특별한 처리 필요
  if (isIOSPWA && isIOSSafari) {
    return hasServiceWorker && hasNotification; // PushManager 없이도 알림 가능
  }

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
 * 안전하게 Notification 권한 요청 (iOS PWA 특화)
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
    console.log('❌ Notification permission was denied. Please enable in device settings.');
    return false;
  }

  // 플랫폼별 환경 감지
  const isIOSPWA = (window.navigator as any).standalone === true;
  const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isAndroidPWA = window.matchMedia('(display-mode: standalone)').matches || 
                       window.matchMedia('(display-mode: fullscreen)').matches;
  
  // iOS PWA 특별 처리
  if (isIOSPWA && isIOSSafari) {
    try {
      console.log('🍎 iOS PWA detected - requesting notification permission...');
      return await requestIOSPWANotificationPermission();
    } catch (error) {
      console.error('❌ iOS PWA notification permission request failed:', error);
    }
  }

  // 안드로이드 PWA 특별 처리
  if (isAndroid && isAndroidPWA) {
    try {
      console.log('🤖 Android PWA detected - requesting notification permission...');
      return await requestAndroidPWANotificationPermission();
    } catch (error) {
      console.error('❌ Android PWA notification permission request failed:', error);
    }
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
 * 안드로이드 PWA 전용 알림 권한 요청
 */
const requestAndroidPWANotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    console.log('🤖 Starting Android PWA notification setup...');
    
    // Service Worker 등록 (안드로이드 PWA용)
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'all' // 안드로이드에서 캐시 활용
    });
    
    // Service Worker가 활성화될 때까지 대기
    await navigator.serviceWorker.ready;
    console.log('✅ Service Worker ready for Android PWA');

    // 안드로이드는 사용자 제스처 후 권한 요청
    const permission = await Notification.requestPermission();
    console.log('🔔 Android PWA notification permission result:', permission);

    if (permission === 'granted') {
      // 안드로이드 PWA에서는 Service Worker를 통한 알림 테스트
      try {
        // 직접 Notification API 사용 (Service Worker 방식)
        if (registration.active) {
          // Service Worker를 통한 알림 표시 테스트
          const testOptions: any = {
            body: '이제 새 메시지 알림을 받으실 수 있습니다.',
            icon: '/images/cat.jpg',
            badge: '/images/cat.jpg',
            tag: 'android-pwa-test',
            requireInteraction: true, // 안드로이드에서는 true로 설정
            silent: false,
            vibrate: [200, 100, 200, 100, 200] // 안드로이드 진동 패턴
          };
          
          const testNotification = new Notification('🤖 안드로이드 PWA 알림 설정 완료!', testOptions);

          testNotification.onclick = () => {
            testNotification.close();
            window.focus();
          };

          // 안드로이드에서는 사용자가 직접 닫도록 (requireInteraction: true)
          console.log('✅ Android PWA test notification shown');
        }
        
        return true;
      } catch (notificationError) {
        console.warn('⚠️ Test notification failed, but permission granted:', notificationError);
        return true; // 권한은 있으므로 true 반환
      }
    }

    return false;
  } catch (error) {
    console.error('❌ Failed to request Android PWA notification permission:', error);
    return false;
  }
};

/**
 * iOS PWA 전용 알림 권한 요청
 */
const requestIOSPWANotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    console.log('🍎 Starting iOS PWA notification setup...');
    
    // Service Worker 등록 (iOS PWA용)
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none' // iOS에서 캐시 문제 방지
    });
    
    // Service Worker가 활성화될 때까지 대기
    await navigator.serviceWorker.ready;
    console.log('✅ Service Worker ready for iOS PWA');

    // iOS는 사용자 제스처가 필요하므로 즉시 권한 요청
    const permission = await new Promise<NotificationPermission>((resolve) => {
      // iOS에서는 동기적으로 권한을 요청해야 함
      if (Notification.requestPermission.length === 0) {
        // 새로운 Promise 기반 API
        Notification.requestPermission().then(resolve);
      } else {
        // 구식 콜백 기반 API (iOS 호환성)
        (Notification.requestPermission as any)((result: NotificationPermission) => {
          resolve(result);
        });
      }
    });

    console.log('🔔 iOS PWA notification permission result:', permission);

    if (permission === 'granted') {
      // iOS PWA에서는 간단한 테스트 알림으로 작동 확인
      try {
        const testNotification = new Notification('🍎 iOS PWA 알림 설정 완료!', {
          body: '이제 새 메시지 알림을 받으실 수 있습니다.',
          icon: '/images/cat.jpg',
          badge: '/images/cat.jpg',
          tag: 'ios-pwa-test',
          requireInteraction: false, // iOS에서는 false로 설정
          silent: false
        });

        testNotification.onclick = () => {
          testNotification.close();
          window.focus();
        };

        // 자동으로 닫기
        setTimeout(() => {
          testNotification.close();
        }, 5000);

        console.log('✅ iOS PWA test notification shown');
        return true;
      } catch (notificationError) {
        console.warn('⚠️ Test notification failed, but permission granted:', notificationError);
        return true; // 권한은 있으므로 true 반환
      }
    }

    return false;
  } catch (error) {
    console.error('❌ Failed to request iOS PWA notification permission:', error);
    return false;
  }
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
      // 푸시 구독 생성 (VAPID 키가 있는 경우에만)
      if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        const subscription = await createPushSubscription(registration);
        return subscription !== null;
      } else {
        console.log('⚠️ VAPID key not found, but basic notifications will work');
        return true;
      }
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