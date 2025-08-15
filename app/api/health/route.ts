import { NextResponse } from 'next/server';
import { validateEnvironment, getMaskedEnvConfig, getEnvDebugInfo } from '@/utils/envValidation';
import { getSubscriptionStats } from '@/utils/subscriptionManager';
import storage from '@/utils/serverlessStorage';

export async function GET() {
  try {
    const isEnvValid = validateEnvironment();
    const envConfig = getMaskedEnvConfig();
    const debugInfo = getEnvDebugInfo();
    const subscriptionStats = getSubscriptionStats();
    const storageStats = storage.getStats();

    const healthData = {
      status: isEnvValid ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: {
        isValid: isEnvValid,
        config: envConfig,
        debug: debugInfo,
      },
      services: {
        pusher: {
          configured: !!(envConfig.NEXT_PUBLIC_PUSHER_KEY && envConfig.NEXT_PUBLIC_PUSHER_CLUSTER),
        },
        webPush: {
          configured: !!(envConfig.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        },
        storage: storageStats,
        subscriptions: subscriptionStats,
      },
      vercel: {
        isDeployment: !!process.env.VERCEL_URL,
        url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
        region: process.env.VERCEL_REGION,
      },
    };

    const statusCode = isEnvValid ? 200 : 500;
    
    return NextResponse.json(healthData, { status: statusCode });
  } catch (error) {
    console.error('❌ Health check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}