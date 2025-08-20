// Service Worker for PWA Push Notifications with Enhanced Background Message Handling
const CACHE_NAME = 'soso-chat-v3';
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

// 버퍼된 메시지를 클라이언트에 전송 (개선된 버전)
async function sendBufferedMessagesToClient() {
  if (backgroundMessageBuffer.length === 0) return;
  
  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    if (clients.length === 0) {
      console.log('[SW] No active clients found, keeping messages in buffer');
      return;
    }
    
    // 처리되지 않은 메시지만 전송
    const unprocessedMessages = backgroundMessageBuffer.filter(msg => !msg.processed);
    
    if (unprocessedMessages.length === 0) {
      console.log('[SW] No unprocessed messages to send');
      return;
    }
    
    console.log('[SW] Sending buffered messages to clients:', {
      totalMessages: backgroundMessageBuffer.length,
      unprocessedMessages: unprocessedMessages.length,
      clientCount: clients.length
    });
    
    let successCount = 0;
    
    for (const client of clients) {
      try {
        client.postMessage({
          type: 'BUFFERED_MESSAGES',
          messages: unprocessedMessages,
          timestamp: Date.now(),
          bufferInfo: {
            total: backgroundMessageBuffer.length,
            sent: unprocessedMessages.length
          }
        });
        successCount++;
      } catch (clientError) {
        console.warn('[SW] Failed to send message to client:', clientError);
      }
    }
    
    if (successCount > 0) {
      // 전송 성공한 메시지들을 처리됨으로 표시
      unprocessedMessages.forEach(msg => {
        const bufferMsg = backgroundMessageBuffer.find(bMsg => bMsg.id === msg.id);
        if (bufferMsg) {
          bufferMsg.processed = true;
        }
      });
      
      console.log(`[SW] Successfully sent messages to ${successCount} clients`);
      
      // 3초 후 처리된 메시지들 정리
      setTimeout(() => {
        const beforeLength = backgroundMessageBuffer.length;
        backgroundMessageBuffer = backgroundMessageBuffer.filter(msg => !msg.processed);
        const afterLength = backgroundMessageBuffer.length;
        
        if (beforeLength !== afterLength) {
          console.log(`[SW] Cleaned up ${beforeLength - afterLength} processed messages`);
        }
      }, 3000);
    }
    
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

// 주기적 연결 상태 확인 시작 (모바일 백그라운드 최적화)
function startConnectionMonitoring() {
  if (connectionHealthCheck) {
    clearInterval(connectionHealthCheck);
  }
  
  // 모바일에서는 더 자주 확인 (1분마다)
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(self.navigator.userAgent || '');
  const checkInterval = isMobile ? 60000 : 120000; // 모바일: 1분, 데스크톱: 2분
  
  connectionHealthCheck = setInterval(checkConnectionHealth, checkInterval);
  console.log(`[SW] Started connection monitoring (${isMobile ? '1min' : '2min'} interval)`);
}

// Service Worker 시작 시 모니터링 시작
startConnectionMonitoring();

// 백그라운드에서 메시지 처리 (개선된 버전)
function handleBackgroundMessage(messageData) {
  // 메시지 수신 = 연결이 살아있음을 의미
  lastHeartbeatTime = Date.now();
  
  // 중복 메시지 방지
  const isDuplicate = backgroundMessageBuffer.some(msg => 
    msg.id === messageData.id && Math.abs(msg.receivedAt - Date.now()) < 1000
  );
  
  if (isDuplicate) {
    console.log('[SW] Duplicate message ignored:', messageData.id);
    return;
  }
  
  // 메시지를 버퍼에 추가
  const bufferedMessage = {
    ...messageData,
    receivedAt: Date.now(),
    processed: false
  };
  
  backgroundMessageBuffer.push(bufferedMessage);
  
  // 버퍼 크기 제한
  if (backgroundMessageBuffer.length > MAX_BUFFER_SIZE) {
    backgroundMessageBuffer = backgroundMessageBuffer.slice(-MAX_BUFFER_SIZE);
  }
  
  console.log('[SW] Message added to background buffer:', {
    messageId: messageData.id,
    userName: messageData.userName,
    bufferSize: backgroundMessageBuffer.length,
    backgroundState: backgroundState.appState,
    isBackground: backgroundState.isBackground
  });
  
  // 백그라운드 상태에서만 알림 표시를 위한 추가 처리
  if (backgroundState.isBackground || !isPageVisible) {
    console.log('[SW] Processing background message for notification');
    scheduleBackgroundNotification(messageData);
  }
}

// 백그라운드 알림 스케줄링 (중복 방지 포함)
function scheduleBackgroundNotification(messageData) {
  // 최근 알림 중복 방지 (같은 사용자의 메시지 5초 내 중복 차단)
  const recentNotificationKey = `${messageData.userId}_${Math.floor(Date.now() / 5000)}`;
  
  if (recentNotifications.has(recentNotificationKey)) {
    console.log('[SW] Recent notification exists, skipping:', recentNotificationKey);
    return;
  }
  
  recentNotifications.add(recentNotificationKey);
  
  // 5분 후 정리
  setTimeout(() => {
    recentNotifications.delete(recentNotificationKey);
  }, 5 * 60 * 1000);
  
  // 알림 데이터 준비
  const notificationData = {
    title: `💬 ${messageData.userName}`,
    body: messageData.text.length > 50 ? messageData.text.substring(0, 50) + '...' : messageData.text,
    icon: messageData.userAvatar || '/images/cat.jpg',
    badge: '/images/cat.jpg',
    tag: `message_${messageData.userId}`,
    data: {
      messageId: messageData.id,
      userId: messageData.userId,
      userName: messageData.userName,
      timestamp: Date.now(),
      url: '/'
    }
  };
  
  // 플랫폼별 최적화
  const isAndroid = /Android/i.test(self.navigator.userAgent || '');
  const isIOS = /iPad|iPhone|iPod/.test(self.navigator.userAgent || '');
  
  // 모든 모바일 플랫폼에서 백그라운드 알림 안정성 향상
  if (isAndroid) {
    notificationData.requireInteraction = true;
    notificationData.persistent = true;
    notificationData.vibrate = [500, 300, 500, 300, 500];
    notificationData.actions = [
      { action: 'open', title: '채팅방 열기' },
      { action: 'close', title: '닫기' }
    ];
    // 안드로이드에서 이미지 추가 (백그라운드에서 더 눈에 잘 띔)
    notificationData.image = messageData.userAvatar || '/images/cat.jpg';
  } else if (isIOS) {
    // iOS는 백그라운드에서도 requireInteraction을 true로 설정
    notificationData.requireInteraction = true;
    notificationData.persistent = true;
    notificationData.vibrate = [300, 150, 300, 150, 300];
    // iOS는 이미지와 액션 제한
    delete notificationData.image;
    notificationData.actions = notificationData.actions.slice(0, 2);
  }
  
  // 즉시 알림 표시 (딜레이 없음)
  self.registration.showNotification(notificationData.title, notificationData)
    .then(() => {
      console.log('[SW] Background notification displayed successfully');
    })
    .catch(error => {
      console.error('[SW] Failed to display background notification:', error);
    });
}

// 최근 알림 추적 (중복 방지용)
const recentNotifications = new Set();

// 푸시 메시지 수신 (개선된 백그라운드 처리)
self.addEventListener('push', (event) => {
  console.log('[SW] Push message received:', event);
  
  // 사용자 에이전트 감지
  const isAndroid = /Android/i.test(self.navigator.userAgent || '');
  const isIOS = /iPad|iPhone|iPod/.test(self.navigator.userAgent || '');
  const isChrome = /Chrome/i.test(self.navigator.userAgent || '');
  const isSamsung = /SamsungBrowser/i.test(self.navigator.userAgent || '');
  const isMobile = isAndroid || isIOS;
  
  // 기본 알림 옵션 (모바일 백그라운드 최적화)
  let options = {
    body: '새로운 메시지가 도착했습니다! 💬',
    icon: '/images/cat.jpg',
    badge: '/images/cat.jpg',
    tag: 'soso-chat-message',
    renotify: true,
    requireInteraction: true, // 모바일 백그라운드에서 안정적인 알림을 위해 true로 고정
    silent: false,
    vibrate: isAndroid ? [400, 200, 400, 200, 400] : [300, 150, 300],
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
    
    // 플랫폼별 알림 최적화 (모바일 백그라운드 안정성 우선)
    if (backgroundState.platform === 'mobile' || isMobile) {
      // 모바일에서는 백그라운드 안정성을 위해 requireInteraction을 true로 유지
      options.requireInteraction = true;
      options.persistent = true;
      
      if (backgroundState.isPWA || isAndroidPWA) {
        options.tag = 'mobile-pwa-notification';
        options.vibrate = [500, 300, 500, 300, 500]; // PWA에서 더 강한 진동
        options.renotify = true; // PWA에서 같은 태그도 다시 알림 표시
      } else {
        options.vibrate = [400, 200, 400, 200, 400]; // 모바일 브라우저 진동
      }
      
      // iOS 특별 처리
      if (isIOS) {
        options.vibrate = [300, 150, 300, 150, 300];
        // iOS에서는 이미지와 액션 제한
        delete options.image;
        options.actions = options.actions.slice(0, 2); // 최대 2개까지만
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