import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';
import { validatePusherConfigServer, getPusherConfig } from '@/lib/pusher-config';

const getPusherServer = () => {
  if (!validatePusherConfigServer()) {
    throw new Error('Pusher configuration validation failed');
  }

  const config = getPusherConfig();
  return new Pusher({
    appId: config.appId,
    key: config.key,
    secret: config.secret,
    cluster: config.cluster,
    useTLS: true,
  });
};

export async function POST(request: NextRequest) {
  try {
    console.log('🔥 Typing API endpoint called');
    const requestBody = await request.json();
    const { action, user } = requestBody;

    console.log('📦 Received typing request:', {
      action,
      user: user ? { id: user.id, name: user.name } : 'undefined',
      fullBody: requestBody
    });

    if (!action || !user) {
      console.log('❌ Missing required fields:', { hasAction: !!action, hasUser: !!user });
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const pusher = getPusherServer();

    if (action === 'start') {
      const typingData = {
        id: user.id,
        name: user.name,
        startedAt: new Date().toISOString(),
      };

      console.log('🚀 Broadcasting user-typing event:', typingData);
      
      // 사용자가 타이핑을 시작했음을 브로드캐스트
      await pusher.trigger('chat', 'user-typing', typingData);

      console.log(`✅ User ${user.name} started typing event sent successfully`);
    } else if (action === 'stop') {
      const stopData = {
        userId: user.id,
      };

      console.log('🛑 Broadcasting user-stopped-typing event:', stopData);
      
      // 사용자가 타이핑을 중단했음을 브로드캐스트
      await pusher.trigger('chat', 'user-stopped-typing', stopData);

      console.log(`✅ User ${user.name} stopped typing event sent successfully`);
    } else {
      console.log('❌ Invalid action received:', action);
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    const response = { 
      success: true, 
      message: `Typing ${action} event sent successfully`,
      data: { action, userId: user.id, userName: user.name }
    };

    console.log('📤 Sending successful response:', response);
    return NextResponse.json(response);

  } catch (error) {
    console.error('💥 Error handling typing event:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to handle typing event',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}