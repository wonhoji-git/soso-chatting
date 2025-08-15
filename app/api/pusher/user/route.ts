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
const activeUsers = new Map<string, { user: any; joinedAt: Date; lastSeen: Date }>();

// 사용자 정리 함수 (비활성 사용자 제거)
const cleanupInactiveUsers = () => {
  const now = new Date();
  const inactiveThreshold = 5 * 60 * 1000; // 5분
  
  Array.from(activeUsers.entries()).forEach(([userId, userData]) => {
    if (now.getTime() - userData.lastSeen.getTime() > inactiveThreshold) {
      console.log(`🧹 Cleaning up inactive user: ${userData.user.name} (${userId})`);
      activeUsers.delete(userId);
    }
  });
};

export async function POST(req: NextRequest) {
  console.log('📡 User API called');
  
  // 비활성 사용자 정리
  cleanupInactiveUsers();
  
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
      const now = new Date();
      
      // 이미 활성 상태인 사용자인지 확인
      if (activeUsers.has(user.id)) {
        console.log(`User ${user.name} (${user.id}) already in chat, updating lastSeen`);
        // 이미 있는 사용자의 lastSeen 업데이트
        const existingUser = activeUsers.get(user.id)!;
        activeUsers.set(user.id, {
          ...existingUser,
          lastSeen: now
        });
        return NextResponse.json({ 
          success: true, 
          message: 'User already in chat, updated presence',
          activeUsersCount: activeUsers.size
        });
      }

      // 사용자를 활성 목록에 추가
      activeUsers.set(user.id, {
        user,
        joinedAt: now,
        lastSeen: now
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
    // 비활성 사용자 정리
    cleanupInactiveUsers();
    
    return NextResponse.json({ 
      success: true, 
      activeUsersCount: activeUsers.size,
      activeUsers: Array.from(activeUsers.values()).map(({ user, joinedAt, lastSeen }) => ({
        ...user,
        joinedAt: joinedAt.toISOString(),
        lastSeen: lastSeen.toISOString()
      }))
    });
  } catch (error) {
    console.error('Error getting active users:', error);
    return NextResponse.json({ 
      error: 'Failed to get active users' 
    }, { status: 500 });
  }
}

// PUT 요청으로 사용자 heartbeat (presence 업데이트)
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'User ID is required' 
      }, { status: 400 });
    }

    if (activeUsers.has(userId)) {
      const userData = activeUsers.get(userId)!;
      activeUsers.set(userId, {
        ...userData,
        lastSeen: new Date()
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Heartbeat updated' 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: 'User not found in active users' 
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Error updating heartbeat:', error);
    return NextResponse.json({ 
      error: 'Failed to update heartbeat' 
    }, { status: 500 });
  }
}
