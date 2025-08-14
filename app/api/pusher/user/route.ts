// app/api/pusher/user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';
import { validatePusherConfigServer } from '@/lib/pusher-config';

// 환경 변수 검증
if (!validatePusherConfigServer()) {
  console.error('Pusher configuration validation failed');
}

// Pusher 인스턴스 생성 (환경 변수가 있을 때만)
let pusher: Pusher | null = null;

try {
  pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
    timeout: 10000, // 10초 타임아웃
  });
} catch (error) {
  console.error('Failed to initialize Pusher:', error);
}

// 활성 사용자 추적 (메모리 기반, 프로덕션에서는 Redis 등 사용 권장)
const activeUsers = new Map<string, { user: any; joinedAt: Date }>();

export async function POST(req: NextRequest) {
  console.log('📡 User API called');
  console.log('👥 Current active users count:', activeUsers.size);
  console.log('👥 Active users list:', Array.from(activeUsers.entries()).map(([id, data]) => ({ id, name: data.user.name })));
  try {
    // Pusher 인스턴스 확인
    if (!pusher) {
      return NextResponse.json({ 
        error: 'Pusher is not properly configured',
        details: 'Check your environment variables'
      }, { status: 500 });
    }

    const { action, user } = await req.json();
    
    // 입력 데이터 검증
    if (!action || !user || !user.id || !user.name) {
      return NextResponse.json({ 
        error: 'Invalid action or user data' 
      }, { status: 400 });
    }

    if (action === 'join') {
      // 이미 활성 상태인 사용자인지 확인
      if (activeUsers.has(user.id)) {
        console.log(`User ${user.name} (${user.id}) already in chat`);
        return NextResponse.json({ 
          success: false, 
          message: 'User already in chat' 
        });
      }

      // 사용자를 활성 목록에 추가
      activeUsers.set(user.id, {
        user,
        joinedAt: new Date()
      });

      console.log(`✅ User ${user.name} (${user.id}) joined chat`);
      console.log('👥 Active users after join:', activeUsers.size);

      // 사용자 입장 알림
      const joinedUser = {
        ...user,
        isOnline: true,
        joinedAt: new Date().toISOString(),
      };
      console.log('📡 Broadcasting user-joined event:', joinedUser);
      await pusher.trigger('chat', 'user-joined', joinedUser);
    } else if (action === 'leave') {
      // 사용자가 실제로 활성 상태인지 확인
      if (!activeUsers.has(user.id)) {
        console.log(`User ${user.name} (${user.id}) not found in active users`);
        return NextResponse.json({ 
          success: false, 
          message: 'User not found in chat' 
        });
      }

      // 사용자를 활성 목록에서 제거
      activeUsers.delete(user.id);

      console.log(`✅ User ${user.name} (${user.id}) left chat`);
      console.log('👥 Active users after leave:', activeUsers.size);

      // 사용자 퇴장 알림
      const leftUser = {
        ...user,
        isOnline: false,
        leftAt: new Date().toISOString(),
      };
      console.log('📡 Broadcasting user-left event:', leftUser);
      await pusher.trigger('chat', 'user-left', leftUser);
    } else {
      return NextResponse.json({ 
        error: 'Invalid action. Use "join" or "leave"' 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      activeUsersCount: activeUsers.size,
      action: action
    });
  } catch (error) {
    console.error('Pusher user action error:', error);
    
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
      error: 'Failed to process user action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET 요청으로 현재 활성 사용자 수 확인
export async function GET() {
  try {
    return NextResponse.json({ 
      success: true, 
      activeUsersCount: activeUsers.size,
      activeUsers: Array.from(activeUsers.values()).map(({ user, joinedAt }) => ({
        ...user,
        joinedAt: joinedAt.toISOString()
      }))
    });
  } catch (error) {
    console.error('Error getting active users:', error);
    return NextResponse.json({ 
      error: 'Failed to get active users' 
    }, { status: 500 });
  }
}
