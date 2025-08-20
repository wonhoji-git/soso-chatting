// app/api/pusher/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 Message API called');

    // 환경 변수 직접 확인
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!appId || !key || !secret || !cluster) {
      console.error('❌ Missing Pusher environment variables');
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
    let requestData;
    try {
      requestData = await req.json();
    } catch (parseError) {
      console.error('❌ Failed to parse request JSON:', parseError);
      return NextResponse.json({ 
        error: 'Invalid JSON in request body' 
      }, { status: 400 });
    }

    const { message, user, messageId, clientInfo } = requestData;
    
    // 입력 데이터 검증 강화
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      console.error('❌ Invalid message:', message);
      return NextResponse.json({ 
        error: 'Invalid message: must be a non-empty string' 
      }, { status: 400 });
    }

    if (!user || !user.id || !user.name || !user.avatar) {
      console.error('❌ Invalid user data:', user);
      return NextResponse.json({ 
        error: 'Invalid user data: missing required fields (id, name, avatar)' 
      }, { status: 400 });
    }

    if (message.length > 1000) {
      console.error('❌ Message too long:', message.length);
      return NextResponse.json({ 
        error: 'Message too long: maximum 1000 characters' 
      }, { status: 400 });
    }

    console.log('✅ Validation passed, creating Pusher instance');

    // Pusher 싱글톤 인스턴스 사용 (연결 안정성 향상)
    let pusher = (globalThis as any).pusherInstance;
    if (!pusher) {
      try {
        pusher = new Pusher({
          appId,
          key,
          secret,
          cluster,
          useTLS: true,
        });
        (globalThis as any).pusherInstance = pusher;
        console.log('✅ Created new Pusher singleton instance');
      } catch (pusherError) {
        console.error('❌ Failed to create Pusher instance:', pusherError);
        return NextResponse.json({ 
          error: 'Failed to initialize Pusher',
          details: pusherError instanceof Error ? pusherError.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    // 메시지 ID 생성 (더 안전하게)
    const finalMessageId = messageId || `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).substr(2, 9)}`;
    console.log('🆔 Using message ID:', finalMessageId);

    // 안전한 메시지 데이터 구성
    const messageData = {
      id: finalMessageId,
      text: message.trim(),
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      timestamp: new Date().toISOString(),
    };

    console.log('📤 Broadcasting message through Pusher:', { 
      messageId: finalMessageId, 
      userId: user.id, 
      userName: user.name,
      clientInfo: clientInfo || 'unknown'
    });

    // Pusher를 통해 메시지 브로드캐스트 (재시도 로직 강화)
    let broadcastSuccess = false;
    let retryCount = 0;
    const maxRetries = 5;
    let lastError: any = null;
    
    while (!broadcastSuccess && retryCount < maxRetries) {
      try {
        // 메시지 데이터에 알림 정보 포함하여 단일 이벤트로 처리
        const enhancedMessageData = {
          ...messageData,
          // 알림용 추가 정보
          notificationTitle: `💬 ${messageData.userName}`,
          notificationBody: messageData.text.length > 50 ? 
            messageData.text.substring(0, 50) + '...' : 
            messageData.text,
          notificationIcon: messageData.userAvatar || '/images/cat.jpg',
          // 재시도 정보 추가
          retryAttempt: retryCount + 1,
          broadcastTime: Date.now(),
          // 디버깅 정보
          serverTimestamp: new Date().toISOString(),
          messageSequence: `${finalMessageId}-${retryCount + 1}`
        };
        
        // Pusher 연결 상태 확인
        if (pusher.connection && pusher.connection.state !== 'connected') {
          console.log(`⚠️ Pusher connection not ready, state: ${pusher.connection.state}`);
          throw new Error(`Pusher connection state: ${pusher.connection.state}`);
        }
        
        const triggerStart = Date.now();
        await pusher.trigger('chat', 'new-message', enhancedMessageData);
        const triggerDuration = Date.now() - triggerStart;
        
        broadcastSuccess = true;
        
        console.log(`✅ Message broadcasted successfully (attempt ${retryCount + 1}, duration: ${triggerDuration}ms)`, {
          messageId: finalMessageId,
          userName: messageData.userName,
          textPreview: messageData.text.substring(0, 30),
          triggerDuration,
          totalRetries: retryCount
        });
        
        // 성공 시 통계 업데이트
        if (retryCount > 0) {
          console.log(`🔄 Message delivery required ${retryCount} retries - investigating network stability`);
        }
        
      } catch (pusherError) {
        lastError = pusherError;
        retryCount++;
        
        const errorMessage = pusherError instanceof Error ? pusherError.message : 'Unknown error';
        console.error(`❌ Failed to broadcast message (attempt ${retryCount}/${maxRetries}):`, {
          error: errorMessage,
          messageId: finalMessageId,
          userName: messageData.userName,
          pusherState: pusher.connection?.state || 'unknown',
          retryCount,
          maxRetries
        });
        
        if (retryCount >= maxRetries) {
          console.error('🚨 Maximum retries reached, message broadcast failed completely', {
            finalError: errorMessage,
            messageId: finalMessageId,
            totalAttempts: retryCount,
            userName: messageData.userName
          });
          
          return NextResponse.json({ 
            error: 'Failed to broadcast message after maximum retries',
            details: errorMessage,
            retryCount,
            messageId: finalMessageId,
            timestamp: new Date().toISOString()
          }, { status: 500 });
        }
        
        // 지수 백오프로 재시도 대기 시간 계산
        const backoffDelay = Math.min(200 * Math.pow(1.5, retryCount - 1), 2000);
        console.log(`⏰ Waiting ${backoffDelay}ms before retry ${retryCount + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }

    return NextResponse.json({ 
      success: true, 
      messageId: finalMessageId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API Error:', error);
    
    return NextResponse.json({ 
      error: 'Failed to send message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
