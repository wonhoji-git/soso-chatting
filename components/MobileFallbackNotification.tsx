'use client';

import { useState, useEffect, useCallback } from 'react';

interface NotificationData {
  id: string;
  title: string;
  body?: string;
  timestamp: number;
  duration?: number;
}

interface MobileFallbackNotificationProps {
  onRequestShow?: (data: NotificationData) => void;
}

export default function MobileFallbackNotification({ onRequestShow }: MobileFallbackNotificationProps) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  // 알림 표시 함수
  const showNotification = useCallback((title: string, options?: { body?: string; duration?: number }) => {
    const notification: NotificationData = {
      id: `fallback-${Date.now()}-${Math.random()}`,
      title,
      body: options?.body,
      timestamp: Date.now(),
      duration: options?.duration || 4000
    };

    setNotifications(prev => [...prev, notification]);

    // 자동 제거
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, notification.duration);

    // 콜백 실행
    onRequestShow?.(notification);
  }, [onRequestShow]);

  // 알림 제거
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // 전역 함수로 등록
  useEffect(() => {
    (window as any).showMobileFallbackNotification = showNotification;
    
    return () => {
      delete (window as any).showMobileFallbackNotification;
    };
  }, [showNotification]);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-50 space-y-2 pointer-events-none">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-2xl shadow-2xl border-2 border-white/20 pointer-events-auto animate-in slide-in-from-top duration-300"
          onClick={() => removeNotification(notification.id)}
          style={{
            // Safe area 고려
            marginTop: 'max(1rem, env(safe-area-inset-top))',
            marginLeft: 'max(1rem, env(safe-area-inset-left))',
            marginRight: 'max(1rem, env(safe-area-inset-right))'
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm mb-1">{notification.title}</div>
              {notification.body && (
                <div className="text-sm opacity-90 break-words">{notification.body}</div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeNotification(notification.id);
              }}
              className="ml-3 text-white/70 hover:text-white text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}