// lib/pusher-singleton.ts
'use client';

import Pusher from 'pusher-js';
import { validatePusherConfigClient } from './pusher-config';

// 전역 Pusher 인스턴스 관리
let globalPusherInstance: Pusher | null = null;
let globalChannel: ReturnType<Pusher['subscribe']> | null = null;
let instanceUsers = 0; // 인스턴스 사용 카운터

export const getPusherInstance = (): { pusher: Pusher; channel: ReturnType<Pusher['subscribe']>; isReused: boolean } | null => {
  try {
    // 환경 변수 검증
    if (!validatePusherConfigClient()) {
      console.error('Pusher configuration validation failed');
      return null;
    }

    // 기존 인스턴스가 있고 연결 상태가 좋으면 재사용
    if (globalPusherInstance && globalChannel) {
      const state = globalPusherInstance.connection.state;
      if (state === 'connected' || state === 'connecting') {
        instanceUsers++;
        console.log(`🔄 Reusing existing Pusher instance (users: ${instanceUsers}, state: ${state})`);
        return { pusher: globalPusherInstance, channel: globalChannel, isReused: true };
      } else {
        // 상태가 좋지 않으면 정리하고 새로 생성
        console.log('🧹 Cleaning up stale Pusher instance');
        cleanupPusherInstance();
      }
    }

    console.log('🆕 Creating new Pusher instance');
    
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
      enabledTransports: ['ws', 'wss', 'xhr_streaming', 'xhr_polling'],
      disabledTransports: [],
      activityTimeout: 30000,
      pongTimeout: 25000,
    });

    // 채널 구독
    const channel = pusher.subscribe('chat');
    
    globalPusherInstance = pusher;
    globalChannel = channel;
    instanceUsers = 1;

    console.log(`✅ Pusher instance created successfully (users: ${instanceUsers})`);
    return { pusher, channel, isReused: false };

  } catch (error) {
    console.error('Error creating Pusher instance:', error);
    return null;
  }
};

export const releasePusherInstance = () => {
  instanceUsers = Math.max(0, instanceUsers - 1);
  console.log(`📉 Released Pusher instance (remaining users: ${instanceUsers})`);
  
  // 개발 환경에서는 사용자가 0이 되어도 즉시 해제하지 않음
  if (process.env.NODE_ENV === 'development') {
    if (instanceUsers === 0) {
      console.log('🔧 Development mode: keeping instance alive for 3 seconds');
      setTimeout(() => {
        if (instanceUsers === 0) {
          console.log('🧹 Development cleanup: no users detected, cleaning up');
          cleanupPusherInstance();
        }
      }, 3000);
    }
    return;
  }
  
  // 프로덕션에서는 사용자가 0이 되면 즉시 해제
  if (instanceUsers === 0) {
    cleanupPusherInstance();
  }
};

export const cleanupPusherInstance = () => {
  if (globalChannel && globalPusherInstance) {
    try {
      globalPusherInstance.unsubscribe('chat');
      console.log('📤 Channel unsubscribed');
    } catch (error) {
      console.log('📤 Channel already unsubscribed');
    }
    globalChannel = null;
  }
  
  if (globalPusherInstance) {
    try {
      globalPusherInstance.disconnect();
      console.log('🔌 Pusher disconnected');
    } catch (error) {
      console.log('🔌 Pusher already disconnected');
    }
    globalPusherInstance = null;
  }
  
  instanceUsers = 0;
  console.log('🧹 Global Pusher instance cleanup completed');
};

// 전역 인스턴스 상태 확인
export const getPusherStatus = () => {
  return {
    hasInstance: !!globalPusherInstance,
    hasChannel: !!globalChannel,
    connectionState: globalPusherInstance?.connection?.state || 'unknown',
    users: instanceUsers
  };
};