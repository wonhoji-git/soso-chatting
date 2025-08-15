// hooks/usePusher.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import Pusher from 'pusher-js';
import { Message, User, ConnectionStatus } from '@/types/chat';
import { getPusherInstance, releasePusherInstance, getPusherStatus } from '@/lib/pusher-singleton';

export const usePusher = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const pusherRef = useRef<InstanceType<typeof Pusher> | null>(null);
  const channelRef = useRef<ReturnType<Pusher['subscribe']> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDisconnectingRef = useRef<boolean>(false);
  const connectionAttemptsRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);
  const componentMountedRef = useRef<boolean>(false);
  const currentUserRef = useRef<User | null>(null);
  const maxRetries = 5;
  const retryDelay = 2000;
  const heartbeatInterval = 30000; // 30초
  const syncInterval = 60000; // 1분

  // 중복 사용자 체크 함수
  const isUserAlreadyOnline = useCallback((userId: string) => {
    const isOnline = onlineUsers.some(user => user.id === userId);
    console.log(`🔍 Checking if user ${userId} is already online:`, isOnline);
    console.log('👥 Current online users:', onlineUsers.map(u => ({ id: u.id, name: u.name })));
    return isOnline;
  }, [onlineUsers]);

  // Pusher 연결 상태 확인
  const isPusherConnected = useCallback(() => {
    return pusherRef.current && 
           pusherRef.current.connection.state === 'connected' && 
           !isDisconnectingRef.current;
  }, []);

  // 연결 상태 상세 정보 가져오기
  const getConnectionState = useCallback(() => {
    if (!pusherRef.current) return 'disconnected';
    return pusherRef.current.connection.state;
  }, []);

  // 현재 전송 방식 가져오기
  const getCurrentTransport = useCallback(() => {
    if (!pusherRef.current) return null;
    return pusherRef.current.connection.state;
  }, []);

  // 서버에서 활성 사용자 목록 가져오기
  const syncWithServer = useCallback(async () => {
    try {
      console.log('🔄 Syncing with server...');
      const response = await fetch('/api/pusher/user');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.activeUsers) {
          console.log('🔄 Server sync - active users:', data.activeUsers.length);
          
          // 현재 사용자를 제외한 다른 사용자들만 필터링
          const currentUserId = currentUserRef.current?.id;
          const serverUsers = data.activeUsers.filter((user: User) => user.id !== currentUserId);
          
          // 로컬 상태와 서버 상태 비교 및 업데이트
          setOnlineUsers(prev => {
            const localUserIds = new Set(prev.map(u => u.id));
            const serverUserIds = new Set(serverUsers.map((u: User) => u.id));
            
            // 서버에만 있는 사용자들 추가
            const usersToAdd = serverUsers.filter((u: User) => !localUserIds.has(u.id));
            
            // 로컬에만 있는 사용자들 제거
            const usersToKeep = prev.filter(u => serverUserIds.has(u.id) || u.id === currentUserId);
            
            const newUsers = [...usersToKeep, ...usersToAdd];
            
            if (usersToAdd.length > 0 || prev.length !== usersToKeep.length) {
              console.log('🔄 Updated online users from server sync');
              console.log('  - Added:', usersToAdd.length, 'users');
              console.log('  - Removed:', prev.length - usersToKeep.length, 'users');
              console.log('  - Total online:', newUsers.length);
            }
            
            return newUsers;
          });
        }
      }
    } catch (error) {
      console.error('Error syncing with server:', error);
    }
  }, []);

  // 하트비트 전송
  const sendHeartbeat = useCallback(async () => {
    if (!currentUserRef.current || !isConnected) return;
    
    try {
      await fetch('/api/pusher/user', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: currentUserRef.current.id }),
      });
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  }, [isConnected]);

  // 하트비트 및 동기화 시작
  const startPeriodicTasks = useCallback(() => {
    // 하트비트 타이머
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    heartbeatIntervalRef.current = setInterval(() => {
      if (isConnected && currentUserRef.current) {
        sendHeartbeat();
      }
    }, heartbeatInterval);

    // 동기화 타이머
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
    syncIntervalRef.current = setInterval(() => {
      if (isConnected) {
        syncWithServer();
      }
    }, syncInterval);
  }, [isConnected, sendHeartbeat, syncWithServer]);

  // 주기적 작업 중지
  const stopPeriodicTasks = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, []);

  // 연결 상태 로깅 함수 (더 상세한 정보 포함)
  const logConnectionState = useCallback((state: string, details?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const isDisconnecting = isDisconnectingRef.current;
    const connectionState = pusherRef.current?.connection.state || 'unknown';
    const attemptCount = connectionAttemptsRef.current;
    const isInitialized = isInitializedRef.current;
    const componentMounted = componentMountedRef.current;
    const hasPusherInstance = !!pusherRef.current;
    
    console.log(`[${timestamp}] Pusher Connection: ${state}${details ? ` - ${details}` : ''} | State: ${connectionState} | Disconnecting: ${isDisconnecting} | Attempt: ${attemptCount} | Initialized: ${isInitialized} | Mounted: ${componentMounted} | HasInstance: ${hasPusherInstance}`);
  }, []);

  // Pusher 초기화 함수 (싱글톤 사용)
  const initializePusher = useCallback(() => {
    try {
      logConnectionState('initialize_start', 'function called');
      
      // 컴포넌트가 마운트되지 않았으면 스킵
      if (!componentMountedRef.current) {
        logConnectionState('initialize_skipped', 'component not mounted');
        return;
      }

      // 이미 초기화되었거나 연결 해제 중이면 스킵
      if (isInitializedRef.current || isDisconnectingRef.current) {
        logConnectionState('initialize_skipped', `already initialized: ${isInitializedRef.current}, disconnecting: ${isDisconnectingRef.current}`);
        return;
      }

      setConnectionStatus('connecting');
      setLastError(null);
      connectionAttemptsRef.current++;
      
      logConnectionState('initializing', `attempt ${connectionAttemptsRef.current}`);
      
      // 싱글톤 인스턴스 가져오기
      const instance = getPusherInstance();
      if (!instance) {
        logConnectionState('initialize_failed', 'failed to get pusher instance');
        setConnectionStatus('failed');
        setLastError('Failed to initialize Pusher');
        return;
      }

      const { pusher, channel, isReused } = instance;
      pusherRef.current = pusher;
      channelRef.current = channel;
      isInitializedRef.current = true;

      logConnectionState('pusher_instance_obtained', `singleton instance obtained successfully (reused: ${isReused})`);

      // 기존 연결 상태 확인 및 설정
      const currentState = pusher.connection.state;
      console.log('🔍 Current connection state:', currentState);
      
      if (currentState === 'connected') {
        setConnectionStatus('connected');
        setIsConnected(true);
        setRetryCount(0);
        setLastError(null);
        connectionAttemptsRef.current = 0;
        isDisconnectingRef.current = false;
        logConnectionState('connection_state_sync', 'synced with existing connected state');
      } else if (currentState === 'connecting') {
        setConnectionStatus('connecting');
        setIsConnected(false);
        logConnectionState('connection_state_sync', 'synced with existing connecting state');
      } else {
        setConnectionStatus('disconnected');
        setIsConnected(false);
        logConnectionState('connection_state_sync', 'synced with existing disconnected state');
      }

      // 재사용된 인스턴스의 경우 이벤트 바인딩을 건너뛰고, 새 인스턴스만 바인딩
      if (!isReused) {
        console.log('🎯 Binding events to new instance');
        // 연결 상태 모니터링
      pusher.connection.bind('connecting', () => {
        logConnectionState('connecting_event', 'event triggered');
        setConnectionStatus('connecting');
        setLastError(null);
      });

      pusher.connection.bind('connected', () => {
        logConnectionState('connected_event', 'event triggered - successfully');
        setConnectionStatus('connected');
        setIsConnected(true);
        setRetryCount(0);
        setLastError(null);
        connectionAttemptsRef.current = 0;
        isDisconnectingRef.current = false;
        
        // 연결되면 주기적 작업 시작 및 서버와 동기화
        startPeriodicTasks();
        setTimeout(syncWithServer, 1000); // 1초 후 서버와 동기화
      });

      pusher.connection.bind('disconnected', () => {
        logConnectionState('disconnected_event', 'event triggered');
        setConnectionStatus('disconnected');
        setIsConnected(false);
        
        // 연결이 끊어지면 주기적 작업 중지
        stopPeriodicTasks();
        
        // 수동으로 해제한 것이 아닐 때만 자동 재연결 시도
        if (!isDisconnectingRef.current && connectionAttemptsRef.current < maxRetries) {
          logConnectionState('auto_reconnect', 'attempting automatic reconnection');
          attemptReconnect();
        } else if (connectionAttemptsRef.current >= maxRetries) {
          logConnectionState('max_retries', 'reached, stopping auto-reconnect');
          setConnectionStatus('failed');
          setLastError('Max reconnection attempts reached');
        }
      });

      pusher.connection.bind('failed', () => {
        logConnectionState('failed_event', 'event triggered');
        setConnectionStatus('failed');
        setIsConnected(false);
        setLastError('Connection failed');
        
        // 수동으로 해제한 것이 아닐 때만 재연결 시도
        if (!isDisconnectingRef.current && connectionAttemptsRef.current < maxRetries) {
          logConnectionState('reconnect_after_failure');
          attemptReconnect();
        }
      });

      pusher.connection.bind('error', (error: any) => {
        const errorMsg = error.message || error.type || 'Unknown error';
        logConnectionState('error_event', `event triggered - ${errorMsg}`);
        setLastError(errorMsg);
      });

      // 연결 상태 변경 감지
      pusher.connection.bind('state_change', (states: { previous: string; current: string }) => {
        logConnectionState('state_change', `${states.previous} → ${states.current}`);
        
        if (states.current === 'connected') {
          setConnectionStatus('connected');
          setIsConnected(true);
          isDisconnectingRef.current = false;
          startPeriodicTasks();
          setTimeout(syncWithServer, 1000);
        } else if (states.current === 'disconnected') {
          setConnectionStatus('disconnected');
          setIsConnected(false);
          stopPeriodicTasks();
        } else if (states.current === 'connecting') {
          setConnectionStatus('connecting');
        } else if (states.current === 'failed') {
          setConnectionStatus('failed');
          stopPeriodicTasks();
        }
      });

      logConnectionState('channel_ready', 'chat channel ready from singleton');

      // 채널 구독 성공 이벤트
      channel.bind('pusher:subscription_succeeded', () => {
        logConnectionState('subscription_succeeded', 'channel subscription confirmed');
      });

      // 채널 구독 에러 이벤트
      channel.bind('pusher:subscription_error', (error: any) => {
        logConnectionState('subscription_error', `channel subscription failed: ${error.message || 'unknown error'}`);
        setLastError('Channel subscription failed');
      });

      // 메시지 수신
      channel.bind('new-message', (message: Message) => {
        console.log('📨 Raw message received:', message);
        logConnectionState('message_received', `new message from ${message.userName}`);
        
        setMessages(prev => {
          // 다중 조건으로 중복 확인
          const isDuplicateById = prev.some(existingMsg => existingMsg.id === message.id);
          const isDuplicateByContent = prev.some(existingMsg => 
            existingMsg.text === message.text && 
            existingMsg.userId === message.userId && 
            Math.abs(new Date(existingMsg.timestamp).getTime() - new Date(message.timestamp).getTime()) < 5000 // 5초 이내
          );
          
          const isDuplicate = isDuplicateById || isDuplicateByContent;
          
          console.log('🔍 Message duplicate check:', { 
            messageId: message.id,
            text: message.text,
            userId: message.userId,
            isDuplicateById,
            isDuplicateByContent,
            isDuplicate,
            existingCount: prev.length,
            existingIds: prev.map(m => m.id).slice(-3) // 최근 3개 ID만 표시
          });
          
          if (!isDuplicate) {
            console.log('✅ Adding message to state');
            const newMessages = [...prev, message];
            
            // 메시지 수 제한 (최근 100개만 유지)
            const limitedMessages = newMessages.length > 100 ? newMessages.slice(-100) : newMessages;
            
            console.log('📝 Updated messages array length:', limitedMessages.length);
            return limitedMessages;
          } else {
            console.log('⚠️ Skipping duplicate message:', { id: message.id, text: message.text });
            return prev;
          }
        });
      });

      // 사용자 입장
      channel.bind('user-joined', (user: User) => {
        logConnectionState('user_joined', `user ${user.name} (${user.id}) joined`);
        console.log('👋 User joined event:', user);
        console.log('👥 Current online users before:', onlineUsers.map(u => ({ id: u.id, name: u.name })));
        
        if (!isUserAlreadyOnline(user.id)) {
          console.log('✅ Adding new user to list');
          setOnlineUsers(prev => {
            const newList = [...prev, user];
            console.log('👥 Updated online users:', newList.map(u => ({ id: u.id, name: u.name })));
            return newList;
          });
          
          // 입장 알림 메시지 추가
          const joinMessage: Message = {
            id: `join-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            text: `${user.name}님이 채팅방에 참여했습니다! 🎉`,
            userId: 'system',
            userName: 'System',
            userAvatar: '',
            timestamp: new Date().toISOString(),
            isSystemMessage: true
          };
          setMessages(prev => [...prev, joinMessage]);
        } else {
          console.log('⚠️ User already online, skipping');
        }
      });

      // 사용자 퇴장
      channel.bind('user-left', (user: User) => {
        logConnectionState('user_left', `user ${user.name} (${user.id}) left`);
        console.log('👋 User left event:', user);
        console.log('👥 Current online users before:', onlineUsers.map(u => ({ id: u.id, name: u.name })));
        
        setOnlineUsers(prev => {
          const newList = prev.filter(u => u.id !== user.id);
          console.log('👥 Updated online users after removal:', newList.map(u => ({ id: u.id, name: u.name })));
          return newList;
        });
        
        // 퇴장 알림 메시지 추가
        const leaveMessage: Message = {
          id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          text: `${user.name}님이 채팅방을 나갔습니다. 👋`,
          userId: 'system',
          userName: 'System',
          userAvatar: '',
          timestamp: new Date().toISOString(),
          isSystemMessage: true
        };
        setMessages(prev => [...prev, leaveMessage]);
      });

        logConnectionState('initialize_complete', 'all event bindings and channel setup completed for new instance');
      } else {
        console.log('🔄 Skipping event binding for reused instance');
        logConnectionState('initialize_complete', 'reused instance setup completed');
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logConnectionState('initialize_error', `error occurred: ${errorMsg}`);
      console.error('Error initializing Pusher:', error);
      setConnectionStatus('failed');
      setLastError(errorMsg);
      
      if (!isDisconnectingRef.current && connectionAttemptsRef.current < maxRetries) {
        attemptReconnect();
      }
    }
  }, [isUserAlreadyOnline, logConnectionState, startPeriodicTasks, syncWithServer, stopPeriodicTasks]);

  // 재연결 함수 (개선)
  const attemptReconnect = useCallback(() => {
    if (retryCount >= maxRetries || isDisconnectingRef.current) {
      const reason = retryCount >= maxRetries ? 'max retries reached' : 'manual disconnection';
      logConnectionState('reconnect_skipped', reason);
      setConnectionStatus('failed');
      setLastError('Max reconnection attempts reached');
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(retryDelay * Math.pow(1.5, retryCount), 15000);
    
    logConnectionState('reconnecting', `attempt ${retryCount + 1}/${maxRetries} in ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isDisconnectingRef.current && componentMountedRef.current) {
        logConnectionState('reconnect_execute', `attempt ${retryCount + 1}/${maxRetries}`);
        setRetryCount(prev => prev + 1);
        initializePusher();
      } else {
        logConnectionState('reconnect_skipped', 'component unmounted or disconnecting');
      }
    }, delay);
  }, [retryCount, initializePusher, logConnectionState]);

  // Pusher 정리 함수 (싱글톤 사용)
  const cleanupPusher = useCallback(() => {
    logConnectionState('cleanup_started', 'manual cleanup initiated');
    isDisconnectingRef.current = true;
    isInitializedRef.current = false;
    
    // 주기적 작업 중지
    stopPeriodicTasks();
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // 로컬 레퍼런스 정리
    channelRef.current = null;
    pusherRef.current = null;
    currentUserRef.current = null;
    
    // 싱글톤 인스턴스 해제
    releasePusherInstance();
    logConnectionState('cleanup', 'singleton instance released');
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setLastError(null);
    connectionAttemptsRef.current = 0;
    
    // 정리 완료 후 플래그 리셋 (개발 환경에서는 더 빠르게)
    const resetDelay = process.env.NODE_ENV === 'development' ? 500 : 2000;
    setTimeout(() => {
      isDisconnectingRef.current = false;
      logConnectionState('cleanup', 'cleanup completed, flag reset');
    }, resetDelay);
  }, [logConnectionState, stopPeriodicTasks]);

  useEffect(() => {
    // 컴포넌트 마운트 시 초기화
    componentMountedRef.current = true;
    logConnectionState('component_mount', 'component mounted, setting up pusher');
    
    const initTimer = setTimeout(() => {
      if (componentMountedRef.current && !isInitializedRef.current) {
        // 개발 환경에서는 disconnecting 상태를 더 관대하게 처리
        if (process.env.NODE_ENV === 'development' && isDisconnectingRef.current) {
          logConnectionState('component_mount', 'dev mode - forcing reset of disconnecting state');
          isDisconnectingRef.current = false;
        }
        
        if (!isDisconnectingRef.current) {
          logConnectionState('component_mount', 'initializing pusher after delay');
          initializePusher();
        } else {
          logConnectionState('component_mount', `skipped - initialized: ${isInitializedRef.current}, disconnecting: ${isDisconnectingRef.current}`);
        }
      }
    }, 500);

    return () => {
      logConnectionState('component_unmount', 'cleaning up');
      componentMountedRef.current = false;
      clearTimeout(initTimer);
      cleanupPusher();
    };
  }, [initializePusher, cleanupPusher, logConnectionState, syncWithServer]);

  // 수동 재연결 함수
  const reconnect = useCallback(() => {
    if (isDisconnectingRef.current) {
      logConnectionState('manual_reconnect', 'skipped - already disconnecting');
      return;
    }
    
    logConnectionState('manual_reconnect', 'initiated by user');
    setRetryCount(0);
    setLastError(null);
    connectionAttemptsRef.current = 0;
    isInitializedRef.current = false;
    initializePusher();
  }, [initializePusher, logConnectionState]);

  const sendMessage = async (message: string, user: User) => {
    try {
      console.log('🚀 sendMessage called with:', { message, user });
      
      if (!isPusherConnected()) {
        const currentState = getConnectionState();
        console.log('❌ Not connected to Pusher:', currentState);
        logConnectionState('send_message', `failed - not connected, current state: ${currentState}`);
        throw new Error('Not connected to Pusher');
      }

      console.log('✅ Pusher is connected, sending message to server');
      
      // 고유한 메시지 ID 생성
      const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('🆔 Generated message ID:', messageId);
      
      console.log('📤 Sending to API...');
      const response = await fetch('/api/pusher', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, user, messageId }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ API response error:', errorData);
        throw new Error(`Failed to send message: ${response.status}`);
      }
      
      const responseData = await response.json();
      console.log('✅ API response success:', responseData);
      logConnectionState('send_message', 'success');
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  };

  const joinChat = async (user: User) => {
    try {
      if (!isPusherConnected()) {
        const currentState = getConnectionState();
        logConnectionState('join_chat', `failed - not connected, current state: ${currentState}`);
        throw new Error('Not connected to Pusher');
      }

      // 채널 구독 상태 확인
      if (!channelRef.current) {
        logConnectionState('join_chat', 'failed - channel not subscribed');
        throw new Error('Channel not subscribed');
      }

      // 현재 사용자 설정
      currentUserRef.current = user;

      // 현재 사용자를 로컬에서 제거 (재입장 시 중복 방지)
      console.log('🔄 Joining chat - removing current user from local list first');
      setOnlineUsers(prev => {
        const filtered = prev.filter(u => u.id !== user.id);
        console.log('👥 Local users after self-removal:', filtered.map(u => ({ id: u.id, name: u.name })));
        return filtered;
      });

      const response = await fetch('/api/pusher/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'join', user }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join chat');
      }
      
      // 입장 후 서버와 동기화
      setTimeout(syncWithServer, 2000);
      
      logConnectionState('join_chat', 'success');
    } catch (error) {
      console.error('Error joining chat:', error);
      throw error;
    }
  };

  const leaveChat = async (user: User) => {
    try {
      // 로컬 상태에서 즉시 제거
      setOnlineUsers(prev => prev.filter(u => u.id !== user.id));
      
      // 현재 사용자 참조 정리
      if (currentUserRef.current?.id === user.id) {
        currentUserRef.current = null;
      }
      
      if (isDisconnectingRef.current || !isPusherConnected()) {
        const currentState = getConnectionState();
        logConnectionState('leave_chat', `skipped API call - disconnecting: ${isDisconnectingRef.current}, connected: ${isPusherConnected()}, state: ${currentState}`);
        return;
      }

      const response = await fetch('/api/pusher/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'leave', user }),
      });

      if (!response.ok) {
        console.warn('Failed to leave chat via API, but local state already updated');
      }
      
      logConnectionState('leave_chat', 'success');
    } catch (error) {
      console.error('Error leaving chat:', error);
    }
  };

  return {
    isConnected,
    connectionStatus,
    onlineUsers,
    messages,
    sendMessage,
    joinChat,
    leaveChat,
    reconnect,
    retryCount,
    cleanupPusher,
    getConnectionState,
    getCurrentTransport,
    lastError,
  };
};
