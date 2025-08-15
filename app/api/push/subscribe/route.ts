import { NextRequest, NextResponse } from 'next/server';
import { addSubscription, getSubscriptionCount } from '@/utils/subscriptionManager';

export async function POST(request: NextRequest) {
  try {
    const subscription = await request.json();
    
    console.log('🔔 New push subscription received:', subscription);
    
    // 구독 정보 저장
    const subscriptionCount = addSubscription(subscription);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Subscription saved successfully',
      subscriptionCount
    });
    
  } catch (error) {
    console.error('❌ Failed to save subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save subscription' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    subscriptions: getSubscriptionCount(),
    message: 'Push subscription endpoint is working'
  });
}