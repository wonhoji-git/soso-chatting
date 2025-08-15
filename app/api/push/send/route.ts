import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { getSubscriptions, getSubscriptionCount, clearExpiredSubscriptions } from '@/utils/subscriptionManager';

// VAPID 설정
const vapidDetails = {
  subject: process.env.VAPID_SUBJECT || 'mailto:admin@soso-chatting.com',
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  privateKey: process.env.VAPID_PRIVATE_KEY!,
};

webpush.setVapidDetails(
  vapidDetails.subject,
  vapidDetails.publicKey,
  vapidDetails.privateKey
);

export async function POST(request: NextRequest) {
  try {
    const { title, body, icon, data } = await request.json();
    
    const subscriptions = getSubscriptions();
    console.log('📤 Sending push notification:', { title, body, subscriptions: subscriptions.length });
    
    if (subscriptions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No subscriptions found' },
        { status: 404 }
      );
    }

    const payload = JSON.stringify({
      title: title || '소소 채팅방 🌈',
      body: body || '새로운 메시지가 도착했습니다! 💬',
      icon: icon || '/images/cat.jpg',
      badge: '/images/cat.jpg',
      data: data || { url: '/' },
      timestamp: Date.now()
    });

    const sendPromises = subscriptions.map(async (subscription, index) => {
      try {
        console.log(`📤 Sending to subscription ${index + 1}/${subscriptions.length}`);
        await webpush.sendNotification(subscription, payload);
        console.log(`✅ Notification sent successfully to subscription ${index + 1}`);
        return { success: true, index };
      } catch (error: any) {
        console.error(`❌ Failed to send to subscription ${index + 1}:`, error);
        
        // 만료된 구독 제거
        if (error.statusCode === 410) {
          console.log(`🗑️ Removing expired subscription ${index + 1}`);
          return { success: false, index, expired: true };
        }
        
        return { success: false, index, error: error.message };
      }
    });

    const results = await Promise.all(sendPromises);
    
    // 만료된 구독 제거
    const expiredEndpoints = results
      .filter(result => result.expired)
      .map(result => subscriptions[result.index].endpoint);

    const expiredCount = clearExpiredSubscriptions(expiredEndpoints);

    const successful = results.filter(result => result.success).length;
    const failed = results.filter(result => !result.success).length;

    console.log(`📊 Push notification results: ${successful} sent, ${failed} failed, ${expiredCount} expired`);

    return NextResponse.json({
      success: true,
      message: 'Push notifications sent',
      results: {
        total: results.length,
        successful,
        failed,
        expired: expiredCount
      },
      remainingSubscriptions: getSubscriptionCount()
    });

  } catch (error) {
    console.error('❌ Failed to send push notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send push notifications' },
      { status: 500 }
    );
  }
}

// 구독 관리를 위한 GET 엔드포인트
export async function GET() {
  return NextResponse.json({
    subscriptions: getSubscriptionCount(),
    vapidPublicKey: vapidDetails.publicKey,
    message: 'Push send endpoint is working'
  });
}