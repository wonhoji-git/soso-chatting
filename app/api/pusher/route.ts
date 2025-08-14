// app/api/pusher/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';
import { validatePusherConfigServer } from '@/lib/pusher-config';

// 환경 변수 디버깅 정보
console.log('🔍 Environment check:', {
  PUSHER_APP_ID: process.env.PUSHER_APP_ID ? 'SET' : 'NOT_SET',
  NEXT_PUBLIC_PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY ? 'SET' : 'NOT_SET',
  PUSHER_SECRET: process.env.PUSHER_SECRET ? 'SET' : 'NOT_SET',
  NEXT_PUBLIC_PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'NOT_SET',
  NODE_ENV: process.env.NODE_ENV
});

// 환경 변수 검증
const configValid = validatePusherConfigServer();
if (!configValid) {
  console.error('❌ Pusher configuration validation failed');
}

// Pusher 인스턴스 생성 (환경 변수가 있을 때만)
let pusher: Pusher | null = null;

try {
  // 환경 변수 존재 확인
  const requiredEnvVars = {
    appId: process.env.PUSHER_APP_ID,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER
  };

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error('❌ Missing environment variables:', missingVars);
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  pusher = new Pusher({
    appId: requiredEnvVars.appId!,
    key: requiredEnvVars.key!,
    secret: requiredEnvVars.secret!,
    cluster: requiredEnvVars.cluster!,
    useTLS: true,
    timeout: 10000, // 10초 타임아웃
  });
  
  console.log('✅ Pusher initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Pusher:', error);
}

export async function POST(req: NextRequest) {
  try {
    // Pusher 인스턴스 확인
    if (!pusher) {
      console.error('❌ Pusher instance is null - configuration failed');
      return NextResponse.json({ 
        error: 'Pusher is not properly configured',
        details: 'Environment variables may be missing in production',
        missingVars: Object.entries({
          PUSHER_APP_ID: process.env.PUSHER_APP_ID,
          NEXT_PUBLIC_PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY,
          PUSHER_SECRET: process.env.PUSHER_SECRET,
          NEXT_PUBLIC_PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER
        }).filter(([key, value]) => !value).map(([key]) => key)
      }, { status: 500 });
    }

    const { message, user, messageId } = await req.json();
    
    // 입력 데이터 검증
    if (!message || !user || !user.id || !user.name) {
      return NextResponse.json({ 
        error: 'Invalid message or user data' 
      }, { status: 400 });
    }

    // 클라이언트에서 제공한 messageId 사용, 없으면 새로 생성
    const finalMessageId = messageId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Pusher를 통해 메시지 브로드캐스트
    console.log('📤 Attempting to send message via Pusher...');
    const result = await pusher.trigger('chat', 'new-message', {
      id: finalMessageId,
      text: message,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      timestamp: new Date().toISOString(),
    });

    console.log('✅ Message sent successfully:', result);

    return NextResponse.json({ 
      success: true, 
      messageId: finalMessageId
    });
  } catch (error) {
    console.error('Pusher error:', error);
    
    // Pusher 관련 에러인지 확인
    if (error instanceof Error) {
      if (error.message.includes('Pusher')) {
        return NextResponse.json({ 
          error: 'Pusher service error',
          details: error.message
        }, { status: 503 });
      }
    }
    
    return NextResponse.json({ 
      error: 'Failed to send message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
