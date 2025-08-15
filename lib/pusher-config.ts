// lib/pusher-config.ts

// 서버 사이드에서만 실행되는 환경 변수 검증
export const validatePusherConfigServer = () => {
  const requiredVars = {
    PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY,
    PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    PUSHER_APP_ID: process.env.PUSHER_APP_ID,
    PUSHER_SECRET: process.env.PUSHER_SECRET,
  };

  const missing = Object.entries(requiredVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error('❌ Missing Pusher environment variables:', missing);
    return false;
  }

  console.log('✅ Pusher configuration is complete');
  return true;
};

// 클라이언트 사이드에서 실행되는 환경 변수 검증 (공개 변수만)
export const validatePusherConfigClient = () => {
  const requiredVars = {
    PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY,
    PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  };

  // 더 자세한 로깅 추가
  console.log('🔍 Validating Pusher client configuration...');
  console.log('Environment variables check:');
  
  Object.entries(requiredVars).forEach(([key, value]) => {
    if (value) {
      console.log(`✅ ${key}: ${value.substring(0, 8)}... (${value.length} chars)`);
    } else {
      console.log(`❌ ${key}: NOT_SET`);
    }
  });

  const missing = Object.entries(requiredVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.error('❌ Missing Pusher public environment variables:', missing);
    console.error('💡 Make sure these are set in your .env.local file:');
    missing.forEach(key => {
      console.error(`   - ${key}`);
    });
    return false;
  }

  console.log('✅ Pusher public configuration is complete');
  console.log('📋 Configuration summary:');
  console.log(`   Key: ${requiredVars.PUSHER_KEY?.substring(0, 8)}...`);
  console.log(`   Cluster: ${requiredVars.PUSHER_CLUSTER}`);
  return true;
};

// 서버 사이드용 설정 가져오기
export const getPusherConfig = () => {
  return {
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    appId: process.env.PUSHER_APP_ID!,
    secret: process.env.PUSHER_SECRET!,
  };
};

// 클라이언트 사이드용 설정 가져오기 (공개 변수만)
export const getPusherClientConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const config = {
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    forceTLS: true,
    enabledTransports: isProduction 
      ? ['wss', 'xhr_streaming', 'xhr_polling'] 
      : ['ws', 'wss', 'xhr_streaming', 'xhr_polling'],
    disabledTransports: [],
    activityTimeout: isProduction ? 60000 : 30000,
    pongTimeout: isProduction ? 30000 : 25000,
    unavailableTimeout: 16000,
  };
  
  console.log('📤 Pusher client config retrieved:', {
    key: config.key ? `${config.key.substring(0, 8)}...` : 'NOT_SET',
    cluster: config.cluster || 'NOT_SET',
    environment: isProduction ? 'production' : 'development'
  });
  
  return config;
};
