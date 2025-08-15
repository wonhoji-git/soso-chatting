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
 * 안전하게 Notification 생성
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
    const notification = new Notification(title, {
      icon: '/images/cat.jpg',
      badge: '/images/cat.jpg',
      requireInteraction: false,
      ...options,
    });
    
    // 자동 닫기
    setTimeout(() => {
      try {
        notification.close();
      } catch (closeError) {
        console.warn('Failed to close notification:', closeError);
      }
    }, 5000);
    
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};

/**
 * 안전하게 Notification 권한 요청
 */
export const requestNotificationPermissionSafe = async (): Promise<boolean> => {
  if (!isNotificationSupported()) {
    console.log('Notification not supported on this browser');
    return false;
  }
  
  const currentPermission = getNotificationPermission();
  
  if (currentPermission === 'granted') {
    return true;
  }
  
  if (currentPermission === 'denied' || currentPermission === 'unsupported') {
    return false;
  }
  
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
};