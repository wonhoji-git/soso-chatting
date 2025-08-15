// Service Worker for iOS PWA Push Notifications
const CACHE_NAME = 'soso-chat-v1';
const urlsToCache = [
  '/',
  '/images/cat.jpg',
  '/images/hamster.jpg',
  '/images/duck.jpg',
  '/images/pig.jpg',
  '/images/coco.jpg'
];

// Service Worker 설치
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Service Worker installed successfully');
        return self.skipWaiting();
      })
  );
});

// Service Worker 활성화
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service Worker activated successfully');
      return self.clients.claim();
    })
  );
});

// 푸시 메시지 수신 (안드로이드 최적화)
self.addEventListener('push', (event) => {
  console.log('[SW] Push message received:', event);
  
  // 사용자 에이전트 감지 (안드로이드 특화)
  const isAndroid = /Android/i.test(self.navigator.userAgent || '');
  const isChrome = /Chrome/i.test(self.navigator.userAgent || '');
  const isSamsung = /SamsungBrowser/i.test(self.navigator.userAgent || '');
  
  let options = {
    body: '새로운 메시지가 도착했습니다! 💬',
    icon: '/images/cat.jpg',
    badge: '/images/cat.jpg',
    tag: 'soso-chat-message',
    renotify: true,
    requireInteraction: isAndroid ? true : false, // 안드로이드에서 상호작용 필요
    silent: false,
    vibrate: isAndroid ? [200, 100, 200, 100, 200] : [200, 100, 200], // 안드로이드 진동 패턴 개선
    data: {
      url: '/',
      timestamp: Date.now(),
      platform: isAndroid ? 'android' : 'other'
    },
    actions: [
      {
        action: 'open',
        title: '채팅방 열기 💬',
        icon: '/images/cat.jpg'
      },
      {
        action: 'close',
        title: '닫기',
        icon: '/images/cat.jpg'
      }
    ]
  };

  // 안드로이드 Chrome/Samsung Browser 특별 처리
  if (isAndroid && (isChrome || isSamsung)) {
    options.badge = '/images/cat.jpg';
    options.image = '/images/cat.jpg'; // 안드로이드에서 이미지 지원
    options.timestamp = Date.now();
    
    // 안드로이드에서 더 긴 진동 패턴
    options.vibrate = [300, 100, 300, 100, 300];
  }

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[SW] Push payload:', payload);
      
      if (payload.title) options.title = payload.title;
      if (payload.body) options.body = payload.body;
      if (payload.icon) options.icon = payload.icon;
      if (payload.data) options.data = { ...options.data, ...payload.data };
    } catch (error) {
      console.log('[SW] Failed to parse push data, using default message');
      options.title = '소소 채팅방 🌈';
      options.body = event.data.text() || '새로운 메시지가 도착했습니다! 💬';
    }
  } else {
    options.title = '소소 채팅방 🌈';
  }

  event.waitUntil(
    self.registration.showNotification(options.title, options)
      .then(() => {
        console.log('[SW] Notification shown successfully');
      })
      .catch((error) => {
        console.error('[SW] Failed to show notification:', error);
      })
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data || {};
  
  if (action === 'close') {
    console.log('[SW] User clicked close button');
    return;
  }

  // 채팅방 열기 (기본 동작 또는 'open' 액션)
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      console.log('[SW] Current clients:', clientList.length);
      
      // 이미 열린 채팅방 탭이 있는지 확인
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          console.log('[SW] Focusing existing client');
          return client.focus();
        }
      }
      
      // 새 창 열기
      if (clients.openWindow) {
        const targetUrl = notificationData.url || '/';
        console.log('[SW] Opening new window:', targetUrl);
        return clients.openWindow(targetUrl);
      }
    }).catch((error) => {
      console.error('[SW] Failed to handle notification click:', error);
    })
  );
});

// 백그라운드 동기화 (선택사항)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // 백그라운드에서 수행할 작업
      Promise.resolve()
        .then(() => {
          console.log('[SW] Background sync completed');
        })
        .catch((error) => {
          console.error('[SW] Background sync failed:', error);
        })
    );
  }
});

// 네트워크 요청 처리 (캐시 우선)
self.addEventListener('fetch', (event) => {
  // POST 요청은 캐싱하지 않음
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 캐시에서 발견되면 반환
        if (response) {
          return response;
        }

        // 네트워크에서 가져오기
        return fetch(event.request)
          .then((response) => {
            // 유효한 응답인지 확인
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 응답 복사 (스트림은 한 번만 사용 가능)
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          });
      })
      .catch(() => {
        // 네트워크 실패 시 기본 페이지 반환 (선택사항)
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
      })
  );
});

console.log('[SW] Service Worker script loaded');