// hooks/usePusher.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import Pusher from 'pusher-js';
import { Message, User, ConnectionStatus, TypingUser, NotificationSettings } from '@/types/chat';
import { getPusherInstance, releasePusherInstance, getPusherStatus } from '@/lib/pusher-singleton';

export const usePusher = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    // 로컬 스토리지에서 설정 불러오기
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('chatNotificationSettings');
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (error) {
        console.warn('Failed to load notification settings:', error);
      }
    }
    
    // 기본값
    return {
      sound: true,
      desktop: true,
      typing: true,
    };
  });

  const pusherRef = useRef<InstanceType<typeof Pusher> | null>(null);
  const channelRef = useRef<ReturnType<Pusher['subscribe']> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDisconnectingRef = useRef<boolean>(false);
  const connectionAttemptsRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);
  const componentMountedRef = useRef<boolean>(false);
  const currentUserRef = useRef<User | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingCleanupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTypingRef = useRef<boolean>(false);
  const maxRetries = process.env.NODE_ENV === 'production' ? 8 : 5;
  const retryDelay = process.env.NODE_ENV === 'production' ? 3000 : 2000;
  const heartbeatInterval = 45000; // 45초
  const syncInterval = 90000; // 1.5분
  const connectionCheckInterval = process.env.NODE_ENV === 'production' ? 10000 : 5000; // 프로덕션에서는 10초

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

  // 연결 상태 실시간 확인
  const checkConnectionStatus = useCallback(() => {
    if (!pusherRef.current) return;
    
    const actualState = pusherRef.current.connection.state;
    console.log('🔍 Real-time connection check:', {
      actualPusherState: actualState,
      localIsConnected: isConnected,
      localConnectionStatus: connectionStatus
    });
    
    // 실제 Pusher 상태와 로컬 상태가 다른 경우 동기화
    if (actualState === 'connected' && (!isConnected || connectionStatus !== 'connected')) {
      console.log('⚡ Fixing connection status: actualState=connected but local state incorrect');
      setConnectionStatus('connected');
      setIsConnected(true);
      setRetryCount(0);
      setLastError(null);
      connectionAttemptsRef.current = 0;
      isDisconnectingRef.current = false;
      
      // 연결된 상태에서 주기적 작업이 중지되어 있다면 시작
      if (!heartbeatIntervalRef.current || !syncIntervalRef.current) {
        startPeriodicTasks();
        setTimeout(syncWithServer, 1000);
      }
    } else if (actualState === 'connecting' && connectionStatus !== 'connecting') {
      console.log('⚡ Fixing connection status: actualState=connecting');
      setConnectionStatus('connecting');
      setLastError(null);
    } else if (actualState === 'disconnected' && isConnected) {
      console.log('⚡ Fixing connection status: actualState=disconnected but local isConnected=true');
      setConnectionStatus('disconnected');
      setIsConnected(false);
      stopPeriodicTasks();
    } else if (actualState === 'failed' && connectionStatus !== 'failed') {
      console.log('⚡ Fixing connection status: actualState=failed');
      setConnectionStatus('failed');
      setIsConnected(false);
      stopPeriodicTasks();
    }
  }, [isConnected, connectionStatus, syncWithServer]);

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

    // 연결 상태 확인 타이머
    if (connectionCheckIntervalRef.current) {
      clearInterval(connectionCheckIntervalRef.current);
    }
    connectionCheckIntervalRef.current = setInterval(() => {
      checkConnectionStatus();
    }, connectionCheckInterval);
    
    console.log('🚀 Started all periodic tasks (heartbeat, sync, connection check)');
  }, [isConnected, sendHeartbeat, syncWithServer, checkConnectionStatus]);

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
    if (connectionCheckIntervalRef.current) {
      clearInterval(connectionCheckIntervalRef.current);
      connectionCheckIntervalRef.current = null;
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

      // 기존 연결 상태 확인 및 설정 (강화된 버전)
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
        
        // 연결된 상태면 즉시 주기적 작업 시작
        setTimeout(() => {
          startPeriodicTasks();
          syncWithServer();
        }, 500);
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
        
        // 에러 메시지인지 확인하여 필터링
        const isErrorMessage = message.text && (
          message.text.includes('Application error:') ||
          message.text.includes('client-side exception') ||
          message.text.includes('오류가 발생했습니다') ||
          message.text.includes('에러') ||
          message.text.includes('Error:') ||
          message.text.includes('Failed to')
        );
        
        if (isErrorMessage) {
          console.warn('⚠️ Filtering out error message from display:', {
            messageId: message.id,
            text: message.text.substring(0, 100),
            userId: message.userId,
            userName: message.userName
          });
          
          // 에러 메시지는 채팅 목록에 추가하지 않음
          return;
        }
        
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
            
            // 다른 사용자의 메시지일 때만 알림 표시
            if (message.userId !== currentUserRef.current?.id && !message.isSystemMessage) {
              // 사운드 알림
              playNotificationSound();
              
              // 데스크톱 알림
              showDesktopNotification(`💬 ${message.userName}`, {
                body: message.text,
                tag: 'chat-message',
              });
            }
            
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

      // 타이핑 시작 이벤트
      channel.bind('user-typing', (typingUser: TypingUser) => {
        console.log('⌨️ RECEIVED user-typing event:', {
          typingUser,
          currentUserId: currentUserRef.current?.id,
          isOwnTyping: typingUser.id === currentUserRef.current?.id,
          typingSettingEnabled: notificationSettings.typing
        });
        
        // 현재 사용자의 타이핑은 무시
        if (typingUser.id === currentUserRef.current?.id) {
          console.log('⚠️ Ignoring own typing event');
          return;
        }
        
        setTypingUsers(prev => {
          console.log('📝 Updating typing users state:', {
            previousUsers: prev.map(u => ({ id: u.id, name: u.name })),
            newTypingUser: { id: typingUser.id, name: typingUser.name }
          });

          // 이미 타이핑 중인 사용자는 업데이트만
          const existingIndex = prev.findIndex(user => user.id === typingUser.id);
          if (existingIndex >= 0) {
            console.log('🔄 Updating existing typing user');
            const updated = [...prev];
            updated[existingIndex] = typingUser;
            return updated;
          }
          
          // 새로운 타이핑 사용자 추가
          console.log('➕ Adding new typing user');
          const newUsers = [...prev, typingUser];
          console.log('✅ New typing users state:', newUsers.map(u => ({ id: u.id, name: u.name })));
          return newUsers;
        });

        // 타이핑 알림 표시 (설정이 켜져 있을 때)
        if (notificationSettings.typing) {
          console.log(`💬 ${typingUser.name}님이 입력 중입니다...`);
        }
      });

      // 타이핑 중지 이벤트
      channel.bind('user-stopped-typing', (data: { userId: string }) => {
        console.log('⌨️ RECEIVED user-stopped-typing event:', {
          stoppedUserId: data.userId,
          currentUserId: currentUserRef.current?.id,
          isOwnStopTyping: data.userId === currentUserRef.current?.id
        });
        
        setTypingUsers(prev => {
          console.log('📝 Removing user from typing state:', {
            previousUsers: prev.map(u => ({ id: u.id, name: u.name })),
            userToRemove: data.userId
          });

          const filteredUsers = prev.filter(user => user.id !== data.userId);
          console.log('✅ Updated typing users after removal:', filteredUsers.map(u => ({ id: u.id, name: u.name })));
          return filteredUsers;
        });
      });

        logConnectionState('initialize_complete', 'all event bindings and channel setup completed for new instance');
      } else {
        console.log('🔄 Skipping event binding for reused instance');
        logConnectionState('initialize_complete', 'reused instance setup completed');
        
        // 재사용된 인스턴스의 경우 연결 상태를 강제로 다시 확인
        setTimeout(() => {
          checkConnectionStatus();
        }, 1000);
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
  }, [isUserAlreadyOnline, logConnectionState, startPeriodicTasks, syncWithServer, stopPeriodicTasks, checkConnectionStatus]);

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

    const maxDelay = process.env.NODE_ENV === 'production' ? 30000 : 15000;
    const delay = Math.min(retryDelay * Math.pow(1.8, retryCount), maxDelay);
    
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

  // Pusher 정리 함수 (싱글톤 사용) - React Strict Mode 안전
  const cleanupPusher = useCallback(() => {
    // 이미 정리 중이거나 초기화되지 않았다면 중복 정리 방지
    if (isDisconnectingRef.current || !isInitializedRef.current) {
      logConnectionState('cleanup_skipped', 'already disconnecting or not initialized');
      return;
    }
    
    logConnectionState('cleanup_started', 'manual cleanup initiated');
    isDisconnectingRef.current = true;
    isInitializedRef.current = false;
    
    // 초기화 ID 무효화 (진행 중인 초기화 방지)
    initializationIdRef.current = null;
    
    // 주기적 작업 중지
    stopPeriodicTasks();
    
    // 기존 정리 타이머 취소
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }
    
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
    const resetDelay = process.env.NODE_ENV === 'development' ? 3000 : 2000;
    setTimeout(() => {
      isDisconnectingRef.current = false;
      logConnectionState('cleanup', 'cleanup completed, flag reset');
    }, resetDelay);
  }, [logConnectionState, stopPeriodicTasks]);

  // React Strict Mode 안정화를 위한 ref
  const initializationIdRef = useRef<string | null>(null);
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 고유한 초기화 ID 생성
    const initId = `init-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    initializationIdRef.current = initId;
    
    // 컴포넌트 마운트 시 초기화
    componentMountedRef.current = true;
    logConnectionState('component_mount', `component mounted, setting up pusher (${initId})`);
    
    // 기존 정리 타이머 취소
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }
    
    const initDelay = process.env.NODE_ENV === 'production' ? 2000 : 1000;
    const initTimer = setTimeout(() => {
      // 현재 초기화 ID가 여전히 유효한지 확인 (React Strict Mode 방지)
      if (initializationIdRef.current === initId && 
          componentMountedRef.current && 
          !isInitializedRef.current) {
        
        // 연결 해제 상태를 더 관대하게 처리 (환경 무관)
        if (isDisconnectingRef.current) {
          logConnectionState('component_mount', 'forcing reset of disconnecting state for stability');
          isDisconnectingRef.current = false;
        }
        
        if (!isDisconnectingRef.current) {
          logConnectionState('component_mount', `initializing pusher after delay (${initId})`);
          initializePusher();
        } else {
          logConnectionState('component_mount', `skipped - initialized: ${isInitializedRef.current}, disconnecting: ${isDisconnectingRef.current}`);
        }
      } else {
        logConnectionState('component_mount', `skipped - initialization cancelled (${initId} vs ${initializationIdRef.current})`);
      }
    }, initDelay);

    return () => {
      // 초기화 ID 무효화
      if (initializationIdRef.current === initId) {
        initializationIdRef.current = null;
      }
      
      logConnectionState('component_unmount', `cleaning up (${initId})`);
      componentMountedRef.current = false;
      clearTimeout(initTimer);
      
      // 환경에 관계없이 지연된 정리로 안정성 확보
      const cleanupDelay = process.env.NODE_ENV === 'production' ? 3000 : 2000;
      cleanupTimeoutRef.current = setTimeout(() => {
        // 다른 컴포넌트 인스턴스가 초기화되지 않았다면 정리 진행
        if (!componentMountedRef.current && !isInitializedRef.current) {
          logConnectionState('cleanup_delayed', `proceeding with cleanup (${initId})`);
          cleanupPusher();
        } else {
          logConnectionState('cleanup_cancelled', `cleanup cancelled - component remounted (${initId})`);
        }
      }, cleanupDelay);
    };
  }, [initializePusher, cleanupPusher, logConnectionState]);

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
      
      // 모바일 환경 감지
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      console.log('📱 Device info:', {
        isMobile,
        isIOS,
        userAgent: navigator.userAgent,
        platform: navigator.platform
      });
      
      // 입력 데이터 검증 강화
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        throw new Error('Invalid message: empty or non-string');
      }
      
      if (!user || !user.id || !user.name || !user.avatar) {
        throw new Error('Invalid user data: missing required fields');
      }

      if (message.length > 1000) {
        throw new Error('Message too long: maximum 1000 characters');
      }
      
      if (!isPusherConnected()) {
        const currentState = getConnectionState();
        console.log('❌ Not connected to Pusher:', currentState);
        logConnectionState('send_message', `failed - not connected, current state: ${currentState}`);
        throw new Error('Not connected to Pusher');
      }

      console.log('✅ Pusher is connected, sending message to server');
      
      // 안전한 메시지 ID 생성 (모바일 환경 고려)
      let messageId;
      try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          messageId = `${Date.now()}-${crypto.randomUUID()}`;
        } else if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          const array = new Uint32Array(2);
          crypto.getRandomValues(array);
          messageId = `${Date.now()}-${array[0]}-${array[1]}`;
        } else {
          messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 12)}-${Math.random().toString(36).substr(2, 12)}`;
        }
      } catch (cryptoError) {
        console.warn('⚠️ Crypto API failed, using fallback:', cryptoError);
        messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 12)}-${Math.random().toString(36).substr(2, 12)}`;
      }
      
      console.log('🆔 Generated message ID:', messageId);
      
      // 안전한 페이로드 생성
      const payload = {
        message: message.trim(),
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          joinedAt: user.joinedAt
        },
        messageId,
        // 모바일 환경 정보 추가
        clientInfo: {
          isMobile,
          isIOS,
          userAgent: navigator.userAgent.substring(0, 100) // 길이 제한
        }
      };
      
      console.log('📤 Sending to API...');
      
      // 모바일 환경에서 더 긴 타임아웃 적용
      const timeoutDuration = isMobile ? 15000 : 10000; // 모바일: 15초, 데스크톱: 10초
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutDuration);
      
      try {
        const response = await fetch('/api/pusher', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            try {
              errorData = await response.text();
            } catch {
              errorData = `HTTP ${response.status} ${response.statusText}`;
            }
          }
          console.error('❌ API response error:', errorData);
          throw new Error(`Server error (${response.status}): ${typeof errorData === 'string' ? errorData : JSON.stringify(errorData)}`);
        }
        
        const responseData = await response.json();
        console.log('✅ API response success:', responseData);
        logConnectionState('send_message', 'success');
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.error('❌ Request timeout after', timeoutDuration, 'ms');
          throw new Error(`Request timeout (${timeoutDuration/1000}s) - 네트워크가 느리거나 서버 응답이 지연되고 있습니다.`);
        }
        
        throw fetchError;
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error sending message:', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      });
      
      logConnectionState('send_message', `failed - ${errorMessage}`);
      
      // 모바일 특화 에러 메시지로 변환
      if (errorMessage.includes('timeout') || errorMessage.includes('네트워크')) {
        throw new Error('모바일 네트워크 오류: 연결이 불안정합니다. 다시 시도해주세요.');
      } else if (errorMessage.includes('Server error')) {
        throw new Error('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      } else if (errorMessage.includes('Invalid')) {
        throw new Error('잘못된 데이터입니다. 페이지를 새로고침해주세요.');
      } else if (errorMessage.includes('Not connected')) {
        throw new Error('연결이 끊어졌습니다. 인터넷 연결을 확인해주세요.');
      }
      
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
      console.log('✅ Current user set in joinChat:', {
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar
      });

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

  // 알림 권한 요청
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('이 브라우저는 알림을 지원하지 않습니다.');
      return false;
    }

    console.log('📱 Current notification permission:', Notification.permission);

    if (Notification.permission === 'granted') {
      console.log('✅ 알림 권한이 이미 허용되어 있습니다.');
      return true;
    }

    if (Notification.permission !== 'denied') {
      try {
        console.log('🔔 알림 권한 요청 중...');
        const permission = await Notification.requestPermission();
        console.log('📝 알림 권한 결과:', permission);
        
        if (permission === 'granted') {
          console.log('✅ 알림 권한이 허용되었습니다!');
          // 테스트 알림 표시
          showDesktopNotification('🎉 알림 설정 완료!', {
            body: '이제 새 메시지가 도착하면 알림을 받으실 수 있습니다.',
            tag: 'permission-granted',
          });
        }
        
        return permission === 'granted';
      } catch (error) {
        console.error('알림 권한 요청 실패:', error);
        return false;
      }
    }

    console.log('❌ 알림 권한이 차단되어 있습니다.');
    return false;
  }, []);

  // 데스크톱 알림 표시
  const showDesktopNotification = useCallback((title: string, options?: NotificationOptions) => {
    console.log('🔔 Attempting to show notification:', {
      title,
      desktopEnabled: notificationSettings.desktop,
      permission: Notification.permission,
      options
    });

    if (!notificationSettings.desktop) {
      console.log('❌ 브라우저 알림이 비활성화되어 있습니다.');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.log('❌ 알림 권한이 없습니다. 현재 상태:', Notification.permission);
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: '/images/cat.jpg',
        badge: '/images/cat.jpg',
        requireInteraction: false,
        ...options,
      });

      console.log('✅ 알림이 성공적으로 표시되었습니다.');

      // 클릭 시 창으로 포커스
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // 5초 후 자동으로 닫기
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    } catch (error) {
      console.error('❌ 알림 표시 실패:', error);
      return;
    }
  }, [notificationSettings.desktop]);

  // 사운드 알림 재생
  const playNotificationSound = useCallback(() => {
    console.log('🔊 Attempting to play notification sound:', {
      soundEnabled: notificationSettings.sound
    });

    if (!notificationSettings.sound) {
      console.log('❌ 사운드 알림이 비활성화되어 있습니다.');
      return;
    }

    try {
      // 간단한 알림음 생성 (Web Audio API 사용)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playCuteSound = (context: AudioContext) => {
        const playNote = (frequency: number, startTime: number, duration: number, volume: number = 0.3) => {
          const oscillator = context.createOscillator();
          const gainNode = context.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(context.destination);
          
          oscillator.frequency.setValueAtTime(frequency, startTime);
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
          
          oscillator.start(startTime);
          oscillator.stop(startTime + duration);
        };

        // 랜덤하게 다양한 귀여운 멜로디 재생
        const melodies = [
          // 멜로디 1: 도-미-솔-도 (C-E-G-C) 상승 아르페지오
          () => {
            const baseTime = context.currentTime;
            playNote(523.25, baseTime, 0.15, 0.25);        // 도 (C5)
            playNote(659.25, baseTime + 0.1, 0.15, 0.3);   // 미 (E5)  
            playNote(783.99, baseTime + 0.2, 0.15, 0.35);  // 솔 (G5)
            playNote(1046.50, baseTime + 0.3, 0.25, 0.4);  // 도 (C6)
          },
          // 멜로디 2: 뻐꾸기 소리 (G-E-G-E)
          () => {
            const baseTime = context.currentTime;
            playNote(783.99, baseTime, 0.2, 0.3);          // 솔 (G5)
            playNote(659.25, baseTime + 0.15, 0.2, 0.3);   // 미 (E5)
            playNote(783.99, baseTime + 0.3, 0.2, 0.3);    // 솔 (G5)
            playNote(659.25, baseTime + 0.45, 0.2, 0.3);   // 미 (E5)
          },
          // 멜로디 3: 반짝반짝 작은별 시작 (C-C-G-G-A-A-G)
          () => {
            const baseTime = context.currentTime;
            playNote(523.25, baseTime, 0.12, 0.25);        // 도 (C5)
            playNote(523.25, baseTime + 0.12, 0.12, 0.25); // 도 (C5)
            playNote(783.99, baseTime + 0.24, 0.12, 0.3);  // 솔 (G5)
            playNote(783.99, baseTime + 0.36, 0.12, 0.3);  // 솔 (G5)
            playNote(880, baseTime + 0.48, 0.15, 0.35);    // 라 (A5)
          },
          // 멜로디 4: 도레미파솔 상승
          () => {
            const baseTime = context.currentTime;
            playNote(523.25, baseTime, 0.1, 0.25);         // 도 (C5)
            playNote(587.33, baseTime + 0.1, 0.1, 0.25);   // 레 (D5)
            playNote(659.25, baseTime + 0.2, 0.1, 0.3);    // 미 (E5)
            playNote(698.46, baseTime + 0.3, 0.1, 0.3);    // 파 (F5)
            playNote(783.99, baseTime + 0.4, 0.2, 0.35);   // 솔 (G5)
          }
        ];
        
        // 랜덤하게 멜로디 선택
        const randomMelody = melodies[Math.floor(Math.random() * melodies.length)];
        randomMelody();
        
        console.log('✅ 귀여운 알림음이 성공적으로 재생되었습니다. 🎵');
      };

      // 모바일에서 오디오 컨텍스트가 suspended 상태일 수 있음
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('🎵 Audio context resumed');
          playCuteSound(audioContext);
        });
      } else {
        playCuteSound(audioContext);
      }
    } catch (error) {
      console.warn('❌ 알림음 재생 실패:', error);
    }
  }, [notificationSettings.sound]);

  // 타이핑 시작 - 현재 사용자를 매개변수로 받도록 수정
  const startTyping = useCallback(async (user?: User) => {
    const currentUser = user || currentUserRef.current;
    
    console.log('⌨️ startTyping called:', {
      hasCurrentUser: !!currentUser,
      hasCurrentUserRef: !!currentUserRef.current,
      isConnected: isPusherConnected(),
      isAlreadyTyping: isTypingRef.current,
      currentUser: currentUser?.name,
      currentUserFull: currentUser,
      typingSettingEnabled: notificationSettings.typing,
      userFromParam: !!user,
      userFromRef: !!currentUserRef.current
    });

    if (!currentUser) {
      console.log('❌ No current user (neither param nor ref), cannot start typing');
      return;
    }

    if (!isPusherConnected()) {
      console.log('❌ Not connected to Pusher, cannot start typing');
      return;
    }

    if (isTypingRef.current) {
      console.log('⚠️ Already typing, skipping');
      return;
    }

    try {
      isTypingRef.current = true;
      console.log('🚀 Sending typing start event to server...');
      
      const response = await fetch('/api/pusher/typing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'start', 
          user: currentUser 
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Typing start event sent successfully:', result);

      // 타이핑 타임아웃 설정 (3초 후 자동으로 중지)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        console.log('⏰ Typing timeout reached, auto-stopping');
        stopTyping();
      }, 3000);

    } catch (error) {
      console.error('❌ Error starting typing:', error);
      isTypingRef.current = false;
    }
  }, []);

  // 타이핑 중지 - 현재 사용자를 매개변수로 받도록 수정
  const stopTyping = useCallback(async (user?: User) => {
    const currentUser = user || currentUserRef.current;
    
    console.log('⌨️ stopTyping called:', {
      hasCurrentUser: !!currentUser,
      hasCurrentUserRef: !!currentUserRef.current,
      isConnected: isPusherConnected(),
      isCurrentlyTyping: isTypingRef.current,
      currentUser: currentUser?.name,
      userFromParam: !!user,
      userFromRef: !!currentUserRef.current
    });

    if (!currentUser) {
      console.log('❌ No current user (neither param nor ref), cannot stop typing');
      return;
    }

    if (!isPusherConnected()) {
      console.log('❌ Not connected to Pusher, cannot stop typing');
      return;
    }

    if (!isTypingRef.current) {
      console.log('⚠️ Not currently typing, skipping');
      return;
    }

    try {
      isTypingRef.current = false;
      console.log('🛑 Sending typing stop event to server...');
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      const response = await fetch('/api/pusher/typing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'stop', 
          user: currentUser 
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Typing stop event sent successfully:', result);

    } catch (error) {
      console.error('❌ Error stopping typing:', error);
    }
  }, []);

  // 타이핑 사용자 정리 (5초 이상 지난 사용자 제거)
  const cleanupTypingUsers = useCallback(() => {
    const now = new Date().getTime();
    setTypingUsers(prev => prev.filter(user => {
      const startTime = new Date(user.startedAt).getTime();
      return now - startTime < 5000; // 5초 이내
    }));
  }, []);

  // 타이핑 정리 타이머 시작
  useEffect(() => {
    typingCleanupIntervalRef.current = setInterval(cleanupTypingUsers, 1000);
    
    return () => {
      if (typingCleanupIntervalRef.current) {
        clearInterval(typingCleanupIntervalRef.current);
      }
    };
  }, [cleanupTypingUsers]);

  // 알림 설정 변경
  const updateNotificationSettings = useCallback((settings: Partial<NotificationSettings>) => {
    setNotificationSettings(prev => {
      const newSettings = { ...prev, ...settings };
      
      // 로컬 스토리지에 저장
      try {
        localStorage.setItem('chatNotificationSettings', JSON.stringify(newSettings));
        console.log('🔧 Notification settings saved:', newSettings);
      } catch (error) {
        console.warn('Failed to save notification settings:', error);
      }
      
      return newSettings;
    });
  }, []);

  return {
    isConnected,
    connectionStatus,
    onlineUsers,
    messages,
    typingUsers,
    notificationSettings,
    sendMessage,
    joinChat,
    leaveChat,
    reconnect,
    retryCount,
    cleanupPusher,
    getConnectionState,
    getCurrentTransport,
    lastError,
    startTyping,
    stopTyping,
    requestNotificationPermission,
    showDesktopNotification,
    playNotificationSound,
    updateNotificationSettings,
  };
};
