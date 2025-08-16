// Service Worker for PWA Push Notifications with Enhanced Background Message Handling
const CACHE_NAME = 'soso-chat-v2';
const urlsToCache = [
  '/',
  '/images/cat.jpg',
  '/images/hamster.jpg',
  '/images/duck.jpg',
  '/images/pig.jpg',
  '/images/coco.jpg'
];

// 백그라운드 메시지 버퍼
let backgroundMessageBuffer = [];
const MAX_BUFFER_SIZE = 20;

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

// 페이지 가시성 상태 추적
let isPageVisible = true;
let backgroundState = {
  isBackground: false,
  platform: 'desktop',
  isPWA: false,
  appState: 'active'
};

// 연결 상태 추적
let lastHeartbeatTime = Date.now();
let connectionHealthCheck = null;

// 클라이언트와의 메시지 통신 설정
self.addEventListener('message', (event) => {
  console.log('[SW] Message received from client:', event.data);
  
  if (event.data.type === 'PAGE_VISIBILITY') {
    isPageVisible = event.data.isVisible;
    console.log('[SW] Page visibility updated:', isPageVisible);
    
    // 페이지가 다시 보이게 되면 버퍼된 메시지 전송
    if (isPageVisible && backgroundMessageBuffer.length > 0) {
      sendBufferedMessagesToClient();
    }
  } else if (event.data.type === 'BACKGROUND_STATE_CHANGE') {
    // 강화된 백그라운드 상태 업데이트
    backgroundState = event.data.state;
    isPageVisible = !backgroundState.isBackground;
    
    console.log('[SW] Background state updated:', {
      appState: backgroundState.appState,
      isBackground: backgroundState.isBackground,
      platform: backgroundState.platform,
      isPWA: backgroundState.isPWA,
      isPageVisible
    });
    
    // 앱이 다시 활성화되면 버퍼된 메시지 전송
    if (backgroundState.appState === 'active' && backgroundMessageBuffer.length > 0) {
      console.log('[SW] App became active, sending buffered messages');
      sendBufferedMessagesToClient();
    }
  } else if (event.data.type === 'GET_BUFFERED_MESSAGES') {
    // 클라이언트가 버퍼된 메시지를 요청할 때
    sendBufferedMessagesToClient();
  } else if (event.data.type === 'HEARTBEAT_SUCCESS') {
    // 클라이언트에서 하트비트 성공 알림
    lastHeartbeatTime = Date.now();
    console.log('[SW] Heartbeat success recorded:', new Date(lastHeartbeatTime).toLocaleTimeString());
  } else if (event.data.type === 'CONNECTION_CHECK') {
    // 클라이언트에서 연결 상태 확인 요청
    checkConnectionHealth();
  }
});

// 버퍼된 메시지를 클라이언트에 전송
async function sendBufferedMessagesToClient() {
  if (backgroundMessageBuffer.length === 0) return;
  
  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    for (const client of clients) {
      client.postMessage({
        type: 'BUFFERED_MESSAGES',
        messages: backgroundMessageBuffer
      });
    }
    
    console.log('[SW] Sent buffered messages to clients:', backgroundMessageBuffer.length);
    backgroundMessageBuffer = []; // 버퍼 클리어
  } catch (error) {
    console.error('[SW] Error sending buffered messages:', error);
  }
}

// 연결 상태 확인
function checkConnectionHealth() {
  const now = Date.now();
  const timeSinceLastHeartbeat = now - lastHeartbeatTime;
  const heartbeatTimeout = 90000; // 90초 (하트비트 간격의 3배)
  
  console.log('[SW] Connection health check:', {
    timeSinceLastHeartbeat: Math.round(timeSinceLastHeartbeat / 1000) + 's',
    threshold: Math.round(heartbeatTimeout / 1000) + 's',
    isHealthy: timeSinceLastHeartbeat < heartbeatTimeout
  });
  
  if (timeSinceLastHeartbeat > heartbeatTimeout) {
    console.log('[SW] ⚠️ Connection appears unhealthy, requesting reconnect...');
    notifyClientToReconnect();
  }
}

// 클라이언트에게 재연결 요청
async function notifyClientToReconnect() {
  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    for (const client of clients) {
      client.postMessage({
        type: 'CONNECTION_UNHEALTHY',
        message: 'Service Worker detected connection issues, please reconnect'
      });
    }
    
    console.log('[SW] Notified clients to reconnect');
  } catch (error) {
    console.error('[SW] Error notifying clients to reconnect:', error);
  }
}

// 주기적 연결 상태 확인 시작
function startConnectionMonitoring() {
  if (connectionHealthCheck) {
    clearInterval(connectionHealthCheck);
  }
  
  // 2분마다 연결 상태 확인
  connectionHealthCheck = setInterval(checkConnectionHealth, 120000);
  console.log('[SW] Started connection monitoring');
}

// Service Worker 시작 시 모니터링 시작
startConnectionMonitoring();

// 백그라운드에서 메시지 처리
function handleBackgroundMessage(messageData) {
  // 메시지 수신 = 연결이 살아있음을 의미
  lastHeartbeatTime = Date.now();
  
  // 메시지를 버퍼에 추가
  backgroundMessageBuffer.push({
    ...messageData,
    receivedAt: Date.now()
  });
  
  // 버퍼 크기 제한
  if (backgroundMessageBuffer.length > MAX_BUFFER_SIZE) {
    backgroundMessageBuffer = backgroundMessageBuffer.slice(-MAX_BUFFER_SIZE);
  }
  
  console.log('[SW] Message added to background buffer:', {
    messageId: messageData.id,
    userName: messageData.userName,
    bufferSize: backgroundMessageBuffer.length
  });
}

// 푸시 메시지 수신 (개선된 백그라운드 처리)
self.addEventListener('push', (event) => {
  console.log('[SW] Push message received:', event);
  
  // 사용자 에이전트 감지
  const isAndroid = /Android/i.test(self.navigator.userAgent || '');
  const isIOS = /iPad|iPhone|iPod/.test(self.navigator.userAgent || '');
  const isChrome = /Chrome/i.test(self.navigator.userAgent || '');
  const isSamsung = /SamsungBrowser/i.test(self.navigator.userAgent || '');
  const isMobile = isAndroid || isIOS;
  
  // 기본 알림 옵션
  let options = {
    body: '새로운 메시지가 도착했습니다! 💬',
    icon: '/images/cat.jpg',
    badge: '/images/cat.jpg',
    tag: 'soso-chat-message',
    renotify: true,
    requireInteraction: isMobile, // 모바일에서는 사용자 상호작용 필요
    silent: false,
    vibrate: isAndroid ? [300, 100, 300, 100, 300] : [200, 100, 200],
    data: {
      url: '/',
      timestamp: Date.now(),
      platform: isAndroid ? 'android' : isIOS ? 'ios' : 'desktop'
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

  // 플랫폼별 최적화
  if (isAndroid && (isChrome || isSamsung)) {
    options.image = '/images/cat.jpg';
    options.timestamp = Date.now();
    options.vibrate = [400, 100, 400, 100, 400]; // 더 강한 진동
  } else if (isIOS) {
    // iOS에서는 배지와 이미지 제한
    options.badge = '/images/cat.jpg';
    options.vibrate = [200, 100, 200];
  }

  // 푸시 데이터 처리
  let messageData = null;
  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[SW] Push payload:', payload);
      
      if (payload.title) options.title = payload.title;
      if (payload.body) options.body = payload.body;
      if (payload.icon) options.icon = payload.icon;
      if (payload.data) options.data = { ...options.data, ...payload.data };
      
      // 메시지 데이터 추출
      if (payload.messageData) {
        messageData = payload.messageData;
      }
    } catch (error) {
      console.log('[SW] Failed to parse push data, using default message');
      options.title = '소소 채팅방 🌈';
      options.body = event.data.text() || '새로운 메시지가 도착했습니다! 💬';
    }
  } else {
    options.title = '소소 채팅방 🌈';
  }

  // 백그라운드 메시지 처리 (호환성 우선)
  const shouldProcessAsBackground = !isPageVisible || backgroundState.isBackground;
  
  if (shouldProcessAsBackground && messageData) {
    console.log('[SW] Processing background message:', {
      platform: backgroundState.platform,
      isPWA: backgroundState.isPWA,
      appState: backgroundState.appState,
      messageFrom: messageData.userName
    });
    
    handleBackgroundMessage(messageData);
    
    // 읽지 않은 메시지 수 표시
    const unreadCount = backgroundMessageBuffer.length;
    if (unreadCount > 1) {
      options.body = `${unreadCount}개의 새 메시지가 있습니다`;
      options.badge = '/images/cat.jpg';
    }
    
    // 플랫폼별 알림 최적화 (iOS PWA 호환성 고려)
    if (backgroundState.platform === 'mobile') {
      options.requireInteraction = false; // iOS PWA 호환성을 위해 false로 설정
      if (backgroundState.isPWA) {
        options.tag = 'mobile-pwa-notification';
        options.vibrate = [500, 300, 500, 300, 500]; // PWA에서 더 강한 진동
      } else {
        options.vibrate = [400, 200, 400, 200, 400]; // 모바일 브라우저 진동
      }
    }
  }

  event.waitUntil(
    Promise.all([
      // 알림 표시
      self.registration.showNotification(options.title, options),
      // 활성 클라이언트에게 메시지 전달
      notifyActiveClients(messageData)
    ]).then(() => {
      console.log('[SW] Push notification and client notification completed');
    }).catch((error) => {
      console.error('[SW] Error in push event handling:', error);
    })
  );
});

// 활성 클라이언트에게 실시간 메시지 전달
async function notifyActiveClients(messageData) {
  if (!messageData) return;
  
  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    console.log('[SW] Notifying active clients:', clients.length);
    
    for (const client of clients) {
      client.postMessage({
        type: 'NEW_MESSAGE',
        data: messageData
      });
    }
  } catch (error) {
    console.error('[SW] Error notifying active clients:', error);
  }
}

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