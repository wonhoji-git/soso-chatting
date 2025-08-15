// lib/pusher-singleton.ts
'use client';

import Pusher from 'pusher-js';
import { validatePusherConfigClient, getPusherClientConfig } from './pusher-config';

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
    
    const isProduction = process.env.NODE_ENV === 'production';
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
      enabledTransports: isProduction 
        ? ['wss', 'xhr_streaming', 'xhr_polling'] 
        : ['ws', 'wss', 'xhr_streaming', 'xhr_polling'],
      disabledTransports: [],
      activityTimeout: isProduction ? 60000 : 30000,
      pongTimeout: isProduction ? 30000 : 25000,
      unavailableTimeout: 16000,
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
  
  // 환경에 관계없이 연결 안정성을 위해 지연된 정리 사용
  if (instanceUsers === 0) {
    const delay = process.env.NODE_ENV === 'production' ? 5000 : 3000;
    console.log(`🔧 Keeping instance alive for ${delay/1000} seconds`);
    setTimeout(() => {
      if (instanceUsers === 0) {
        console.log('🧹 Delayed cleanup: no users detected, cleaning up');
        cleanupPusherInstance();
      }
    }, delay);
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