// app/api/pusher/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';

export async function POST(req: NextRequest) {
  try {
    // 환경 변수 직접 확인
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!appId || !key || !secret || !cluster) {
      return NextResponse.json({ 
        error: 'Missing Pusher environment variables',
        missing: {
          appId: !appId,
          key: !key,
          secret: !secret,
          cluster: !cluster
        }
      }, { status: 500 });
    }

    // 요청 데이터 파싱
    const { message, user, messageId } = await req.json();
    
    // 입력 데이터 검증
    if (!message || !user || !user.id || !user.name) {
      return NextResponse.json({ 
        error: 'Invalid message or user data' 
      }, { status: 400 });
    }

    // Pusher 인스턴스를 요청마다 새로 생성 (더 안정적)
    const pusher = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });

    // 메시지 ID 생성
    const finalMessageId = messageId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Pusher를 통해 메시지 브로드캐스트
    await pusher.trigger('chat', 'new-message', {
      id: finalMessageId,
      text: message,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true, 
      messageId: finalMessageId
    });
  } catch (error) {
    console.error('API Error:', error);
    
    return NextResponse.json({ 
      error: 'Failed to send message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
