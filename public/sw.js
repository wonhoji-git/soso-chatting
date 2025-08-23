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

// 백그라운드 메시지 버퍼 (모바일 메모리 최적화)
let backgroundMessageBuffer = [];
const MAX_BUFFER_SIZE = 5; // iOS Safari 극한 최적화: 5개로 감소
const EMERGENCY_BUFFER_SIZE = 2; // 응급 상황 시 2개만 유지

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

// 강화된 연결 상태 추적
let lastHeartbeatTime = Date.now();
let connectionHealthCheck = null;
let longTermConnectionCheck = null; // 장기간 백그라운드 연결 체크
let backgroundStartTime = null; // 백그라운드 시작 시간 추적
let isLongTermBackground = false; // 10분+ 백그라운드 상태

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
    const previousBackgroundState = backgroundState.isBackground;
    const previousAppState = backgroundState.appState;
    
    backgroundState = {
      ...event.data.state,
      lastUpdated: Date.now(),
      previousState: {
        isBackground: previousBackgroundState,
        appState: previousAppState
      }
    };
    isPageVisible = !backgroundState.isBackground;
    
    console.log('[SW] Background state updated:', {
      appState: backgroundState.appState,
      isBackground: backgroundState.isBackground,
      platform: backgroundState.platform,
      isPWA: backgroundState.isPWA,
      isPageVisible,
      trigger: backgroundState.trigger || 'unknown',
      previousState: backgroundState.previousState,
      stateChanged: previousBackgroundState !== backgroundState.isBackground
    });
    
    // 상태가 실제로 변경된 경우에만 처리
    const becameActive = previousBackgroundState && !backgroundState.isBackground;
    const becameBackground = !previousBackgroundState && backgroundState.isBackground;
    
    if (becameActive && backgroundMessageBuffer.length > 0) {
      console.log('[SW] App became active from background, sending buffered messages:', {
        messageCount: backgroundMessageBuffer.length,
        trigger: backgroundState.trigger
      });
      // 약간의 지연을 두고 메시지 전송 (앱이 완전히 활성화될 시간)
      setTimeout(() => {
        sendBufferedMessagesToClient();
      }, 100);
    } else if (becameBackground) {
      // 백그라운드 시작 시간 기록
      if (!backgroundStartTime) {
        backgroundStartTime = Date.now();
        isLongTermBackground = false;
        console.log('[SW] App went to background - tracking started:', {
          trigger: backgroundState.trigger,
          currentBufferSize: backgroundMessageBuffer.length,
          startTime: new Date(backgroundStartTime).toLocaleTimeString()
        });
        
        // 장기간 백그라운드 감지용 타이머 시작
        startLongTermBackgroundMonitoring();
      }
    } else if (!backgroundState.isBackground && backgroundStartTime) {
      // 백그라운드에서 복귀
      const backgroundDuration = Date.now() - backgroundStartTime;
      console.log('[SW] App returned from background:', {
        duration: Math.round(backgroundDuration / 1000) + 's',
        wasLongTerm: isLongTermBackground,
        bufferedMessages: backgroundMessageBuffer.length
      });
      
      backgroundStartTime = null;
      isLongTermBackground = false;
      
      // 장기간 백그라운드 모니터링 정리
      if (longTermConnectionCheck) {
        clearInterval(longTermConnectionCheck);
        longTermConnectionCheck = null;
      }
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
    
    // 처리되지 않은 메시지만 전송 (시간 순으로 정렬)
    const unprocessedMessages = backgroundMessageBuffer
      .filter(msg => !msg.processed)
      .sort((a, b) => a.receivedAt - b.receivedAt);
    
    if (unprocessedMessages.length === 0) {
      console.log('[SW] No unprocessed messages to send');
      return;
    }
    
    console.log('[SW] Sending buffered messages to clients:', {
      totalMessages: backgroundMessageBuffer.length,
      unprocessedMessages: unprocessedMessages.length,
      clientCount: clients.length,
      oldestMessage: unprocessedMessages.length > 0 ? new Date(unprocessedMessages[0].receivedAt).toLocaleTimeString() : null,
      newestMessage: unprocessedMessages.length > 0 ? new Date(unprocessedMessages[unprocessedMessages.length - 1].receivedAt).toLocaleTimeString() : null
    });
    
    let successCount = 0;
    
    // 모든 클라이언트에게 순차적으로 메시지 전송
    for (const client of clients) {
      try {
        // 클라이언트의 상태 확인 (가능한 경우)
        const clientUrl = client.url || 'unknown';
        
        await client.postMessage({
          type: 'BUFFERED_MESSAGES',
          messages: unprocessedMessages,
          timestamp: Date.now(),
          bufferInfo: {
            total: backgroundMessageBuffer.length,
            sent: unprocessedMessages.length,
            clientUrl: clientUrl.substring(clientUrl.lastIndexOf('/') + 1) || 'main'
          },
          recoveryInfo: {
            timeSpentInBackground: Date.now() - (unprocessedMessages[0]?.receivedAt || Date.now()),
            messageCount: unprocessedMessages.length
          }
        });
        successCount++;
        
        console.log(`[SW] Messages sent to client: ${clientUrl}`);
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
          bufferMsg.processedAt = Date.now();
        }
      });
      
      console.log(`[SW] Successfully sent ${unprocessedMessages.length} messages to ${successCount} clients`);
      
      // 2초 후 처리된 메시지들 정리 (메모리 최적화)
      setTimeout(() => {
        const beforeLength = backgroundMessageBuffer.length;
        backgroundMessageBuffer = backgroundMessageBuffer.filter(msg => !msg.processed);
        const afterLength = backgroundMessageBuffer.length;
        
        if (beforeLength !== afterLength && process.env.NODE_ENV === 'development') {
          console.log(`[SW] Cleaned up ${beforeLength - afterLength} processed messages`);
        }
      }, 2000);
    }
    
  } catch (error) {
    console.error('[SW] Error sending buffered messages:', error);
  }
}

// 강화된 연결 상태 확인 (모바일 백그라운드 특화)
function checkConnectionHealth() {
  const now = Date.now();
  const timeSinceLastHeartbeat = now - lastHeartbeatTime;
  
  // 백그라운드 상태에 따른 동적 타임아웃 설정
  const isInBackground = backgroundState.isBackground;
  const timeInBackground = backgroundStartTime ? now - backgroundStartTime : 0;
  
  let heartbeatTimeout;
  if (isInBackground && timeInBackground > 600000) { // 10분+ 백그라운드
    heartbeatTimeout = 300000; // 5분 (장기 백그라운드)
    isLongTermBackground = true;
  } else if (isInBackground) {
    heartbeatTimeout = 180000; // 3분 (단기 백그라운드)
  } else {
    heartbeatTimeout = 90000; // 90초 (포그라운드)
    isLongTermBackground = false;
  }
  
  console.log('[SW] Enhanced connection health check:', {
    timeSinceLastHeartbeat: Math.round(timeSinceLastHeartbeat / 1000) + 's',
    threshold: Math.round(heartbeatTimeout / 1000) + 's',
    isHealthy: timeSinceLastHeartbeat < heartbeatTimeout,
    isInBackground,
    timeInBackground: Math.round(timeInBackground / 1000) + 's',
    isLongTermBackground,
    backgroundState: backgroundState.appState
  });
  
  if (timeSinceLastHeartbeat > heartbeatTimeout) {
    console.log('[SW] ⚠️ Connection appears unhealthy, requesting enhanced reconnect...');
    notifyClientToReconnect({
      reason: 'heartbeat_timeout',
      timeSinceLastHeartbeat,
      backgroundDuration: timeInBackground,
      isLongTermBackground
    });
  }
}

// 강화된 클라이언트 재연결 요청 (상세 정보 포함)
async function notifyClientToReconnect(details = {}) {
  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    const reconnectMessage = {
      type: 'CONNECTION_UNHEALTHY',
      message: 'Service Worker detected connection issues, requesting enhanced reconnect',
      details: {
        timestamp: Date.now(),
        isLongTermBackground,
        backgroundDuration: backgroundStartTime ? Date.now() - backgroundStartTime : 0,
        lastHeartbeat: lastHeartbeatTime,
        platform: backgroundState.platform || 'unknown',
        ...details
      }
    };
    
    for (const client of clients) {
      client.postMessage(reconnectMessage);
    }
    
    console.log('[SW] Notified clients to reconnect with details:', reconnectMessage.details);
  } catch (error) {
    console.error('[SW] Error notifying clients to reconnect:', error);
  }
}

// 강화된 연결 상태 모니터링 (적응형 간격)
function startConnectionMonitoring() {
  if (connectionHealthCheck) {
    clearInterval(connectionHealthCheck);
  }
  
  // 플랫폼 및 백그라운드 상태에 따른 동적 간격 설정
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(self.navigator.userAgent || '');
  const isPWA = backgroundState.isPWA;
  
  let checkInterval;
  if (isMobile && isPWA) {
    checkInterval = 30000; // PWA 모바일: 30초 (가장 빈번)
  } else if (isMobile) {
    checkInterval = 60000; // 모바일 브라우저: 1분
  } else {
    checkInterval = 120000; // 데스크톱: 2분
  }
  
  connectionHealthCheck = setInterval(() => {
    checkConnectionHealth();
    
    // 메모리 압박 체크도 함께 수행
    const memoryPressure = checkMemoryPressure();
    if (memoryPressure > 0.9) {
      console.warn('[SW] 🆘 Critical memory pressure during connection check');
      performEmergencyCleanup();
    }
  }, checkInterval);
  
  console.log(`[SW] Started enhanced connection monitoring (${checkInterval/1000}s interval, mobile: ${isMobile}, PWA: ${isPWA})`);
}

// 장기간 백그라운드 모니터링
function startLongTermBackgroundMonitoring() {
  // 기존 타이머가 있으면 정리
  if (longTermConnectionCheck) {
    clearInterval(longTermConnectionCheck);
  }
  
  // 10분마다 장기 백그라운드 상태 체크
  longTermConnectionCheck = setInterval(() => {
    const backgroundDuration = backgroundStartTime ? Date.now() - backgroundStartTime : 0;
    
    if (backgroundDuration > 600000) { // 10분 이상
      if (!isLongTermBackground) {
        isLongTermBackground = true;
        console.log('[SW] 🕐 Long-term background state detected:', {
          duration: Math.round(backgroundDuration / 60000) + 'min',
          bufferedMessages: backgroundMessageBuffer.length,
          lastHeartbeat: Math.round((Date.now() - lastHeartbeatTime) / 1000) + 's ago'
        });
        
        // 장기 백그라운드 상태에서 특별 처리
        handleLongTermBackgroundState();
      }
    }
  }, 600000); // 10분마다 체크
}

// 장기 백그라운드 상태 특별 처리
function handleLongTermBackgroundState() {
  console.log('[SW] 🔄 Handling long-term background state...');
  
  // 1. 연결 상태 강제 재확인
  const timeSinceHeartbeat = Date.now() - lastHeartbeatTime;
  if (timeSinceHeartbeat > 300000) { // 5분 이상 하트비트 없음
    console.log('[SW] 🚨 No heartbeat for 5+ minutes, forcing reconnection...');
    notifyClientToReconnect({
      reason: 'long_term_background_no_heartbeat',
      timeSinceHeartbeat
    });
  }
  
  // 2. 메시지 버퍼 상태 체크 및 최적화
  if (backgroundMessageBuffer.length > MAX_BUFFER_SIZE / 2) {
    console.log('[SW] 🧹 Optimizing message buffer for long-term background...');
    const importantMessages = backgroundMessageBuffer.filter(msg => !msg.processed).slice(-5);
    backgroundMessageBuffer = importantMessages;
  }
  
  // 3. 클라이언트에게 상태 알림
  notifyClientsOfLongTermBackground();
}

// 장기 백그라운드 상태 클라이언트 알림
async function notifyClientsOfLongTermBackground() {
  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });
    
    for (const client of clients) {
      client.postMessage({
        type: 'LONG_TERM_BACKGROUND_DETECTED',
        data: {
          duration: backgroundStartTime ? Date.now() - backgroundStartTime : 0,
          bufferedMessages: backgroundMessageBuffer.length,
          lastHeartbeat: lastHeartbeatTime,
          timestamp: Date.now()
        }
      });
    }
  } catch (error) {
    console.error('[SW] Error notifying clients of long-term background:', error);
  }
}

// 메모리 압박 감지 함수
function checkMemoryPressure() {
  // Service Worker에서는 performance.memory에 직접 접근할 수 없으므로
  // 간접적인 지표들을 사용
  const bufferSize = backgroundMessageBuffer.length;
  const cacheSize = recentNotifications.size;
  
  // 버퍼와 캐시 크기를 기반으로 메모리 압박 추정
  if (bufferSize >= MAX_BUFFER_SIZE && cacheSize > 10) {
    return 0.9; // 높은 압박
  } else if (bufferSize >= MAX_BUFFER_SIZE / 2 || cacheSize > 5) {
    return 0.7; // 중간 압박
  }
  return 0.3; // 낮은 압박
}

// 응급 메모리 정리 함수
function performEmergencyCleanup() {
  console.warn('[SW] 🆘 Performing emergency memory cleanup');
  
  // 버퍼를 최소한으로 줄임
  backgroundMessageBuffer = backgroundMessageBuffer.slice(-EMERGENCY_BUFFER_SIZE);
  
  // 알림 캐시 완전 정리
  recentNotifications.clear();
  
  // 처리된 메시지 즉시 정리
  backgroundMessageBuffer = backgroundMessageBuffer.filter(msg => !msg.processed);
  
  console.warn(`[SW] Emergency cleanup completed: ${backgroundMessageBuffer.length} messages remaining`);
}

// Service Worker 시작 시 모니터링 시작
startConnectionMonitoring();

// 주기적 메모리 압박 체크 (30초마다)
setInterval(() => {
  const memoryPressure = checkMemoryPressure();
  if (memoryPressure > 0.8) {
    performEmergencyCleanup();
  }
}, 30000);

// 백그라운드에서 메시지 처리 (개선된 버전)
function handleBackgroundMessage(messageData) {
  // 메시지 수신 = 연결이 살아있음을 의미
  lastHeartbeatTime = Date.now();
  
  // 개선된 중복 메시지 방지 - 더 관대한 시간 창과 컨텐츠 기반 체크
  const isDuplicate = backgroundMessageBuffer.some(msg => {
    // ID가 정확히 일치하는 경우
    if (msg.id === messageData.id) {
      return true;
    }
    
    // 컨텐츠와 시간 기반 중복 체크 (네트워크 지연 고려)
    const timeDiff = Math.abs(Date.now() - msg.receivedAt);
    if (timeDiff < 2000 && // 2초 이내
        msg.text === messageData.text && 
        msg.userId === messageData.userId) {
      console.log('[SW] Content-based duplicate detected:', {
        id: messageData.id,
        existingId: msg.id,
        timeDiff
      });
      return true;
    }
    
    return false;
  });
  
  // 더 관대한 중복 처리 (모바일 네트워크 지연 고려)
  if (isDuplicate) {
    const existingMsg = backgroundMessageBuffer.find(msg => 
      msg.id === messageData.id || 
      (Math.abs(Date.now() - msg.receivedAt) < 2000 && 
       msg.text === messageData.text && 
       msg.userId === messageData.userId)
    );
    
    if (existingMsg && Date.now() - existingMsg.receivedAt < 1500) {
      // 1.5초 내의 중복만 버림 (모바일 네트워크 지연 고려)
      console.log('[SW] Recent duplicate message ignored (within 1.5s):', {
        id: messageData.id,
        existingId: existingMsg.id,
        timeDiff: Date.now() - existingMsg.receivedAt
      });
      return;
    } else {
      // 시간 차이가 큰 경우 새 메시지로 처리
      console.log('[SW] Similar message but with time gap, allowing:', {
        id: messageData.id,
        timeDiff: existingMsg ? Date.now() - existingMsg.receivedAt : 'N/A'
      });
    }
  }
  
  
  // 메시지를 버퍼에 추가
  const bufferedMessage = {
    ...messageData,
    receivedAt: Date.now(),
    processed: false,
    notificationShown: false // 알림 표시 여부 추가
  };
  
  backgroundMessageBuffer.push(bufferedMessage);
  
  // 버퍼 크기 제한 (동적 조정)
  const memoryThreshold = checkMemoryPressure();
  const currentLimit = memoryThreshold > 0.8 ? EMERGENCY_BUFFER_SIZE : MAX_BUFFER_SIZE;
  
  if (backgroundMessageBuffer.length > currentLimit) {
    backgroundMessageBuffer = backgroundMessageBuffer.slice(-currentLimit);
    if (memoryThreshold > 0.8) {
      console.warn(`[SW] 🆘 Emergency buffer limit applied: ${EMERGENCY_BUFFER_SIZE} messages`);
    }
  }
  
  console.log('[SW] Message added to background buffer:', {
    messageId: messageData.id,
    userName: messageData.userName,
    bufferSize: backgroundMessageBuffer.length,
    backgroundState: backgroundState.appState,
    isBackground: backgroundState.isBackground,
    isPageVisible
  });
  
  // 더 정확한 백그라운드 상태 감지
  const isActuallyInBackground = checkIfActuallyInBackground();
  if (isActuallyInBackground && !bufferedMessage.notificationShown) {
    console.log('[SW] Processing background message for notification');
    scheduleBackgroundNotification(messageData);
    bufferedMessage.notificationShown = true;
  }
}

// 실제 백그라운드 상태를 더 정확하게 확인하는 함수
function checkIfActuallyInBackground() {
  // 여러 조건을 종합적으로 판단
  const stateBasedCheck = backgroundState.isBackground || backgroundState.appState === 'background';
  const visibilityBasedCheck = !isPageVisible;
  const timeBasedCheck = Date.now() - lastHeartbeatTime > 10000; // 10초 이상 하트비트 없음
  
  // 세 가지 중 하나라도 true면 백그라운드로 간주
  const result = stateBasedCheck || visibilityBasedCheck || timeBasedCheck;
  
  console.log('[SW] Background state check:', {
    stateBasedCheck,
    visibilityBasedCheck,
    timeBasedCheck,
    finalResult: result
  });
  
  return result;
}

// 백그라운드 알림 스케줄링 (안전한 중복 방지)
function scheduleBackgroundNotification(messageData) {
  // 더 안전한 중복 방지: 정확한 메시지 ID + 짧은 시간 창
  const recentNotificationKey = `${messageData.id}_${Math.floor(Date.now() / 2000)}`; // 2초 단위
  
  if (recentNotifications.has(recentNotificationKey)) {
    console.log('[SW] Recent notification exists for same message, skipping:', {
      messageId: messageData.id,
      key: recentNotificationKey
    });
    return;
  }
  
  recentNotifications.add(recentNotificationKey);
  
  // 30초 후 정리 (메모리 최적화)
  setTimeout(() => {
    recentNotifications.delete(recentNotificationKey);
  }, 30 * 1000);
  
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

  // 플랫폼별 최적화 (더 정확한 PWA 감지)
  const isAndroidPWA = isAndroid && (
    matchMedia('(display-mode: standalone)').matches || 
    matchMedia('(display-mode: fullscreen)').matches
  );
  
  if (isAndroid && (isChrome || isSamsung)) {
    options.image = '/images/cat.jpg';
    options.timestamp = Date.now();
    options.vibrate = isAndroidPWA ? [400, 200, 400, 200, 400] : [300, 150, 300]; // PWA에서 더 강한 진동
    
    // 안드로이드 PWA에서는 더 강력한 알림 설정
    if (isAndroidPWA) {
      options.requireInteraction = true;
      options.persistent = true;
      options.renotify = true;
    }
  } else if (isIOS) {
    // iOS PWA 감지 (navigator.standalone은 SW에서 사용 불가하므로 다른 방법 사용)
    const isIOSPWA = matchMedia('(display-mode: standalone)').matches;
    
    options.badge = '/images/cat.jpg';
    options.vibrate = isIOSPWA ? [300, 150, 300] : [200, 100, 200];
    
    // iOS PWA에서는 requireInteraction을 false로 설정하는 것이 더 안정적
    if (isIOSPWA) {
      options.requireInteraction = false;
    }
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