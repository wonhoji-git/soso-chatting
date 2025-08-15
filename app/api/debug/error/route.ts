import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const errorData = await request.json();
    
    // 현재 시간 추가
    const timestamp = new Date().toISOString();
    
    // 에러 로그 구조
    const logEntry = {
      timestamp,
      ...errorData,
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      host: request.headers.get('host') || 'unknown'
    };
    
    // 콘솔에 출력 (Vercel 로그에서 확인 가능)
    console.error('=== MOBILE ERROR LOG ===');
    console.error('Timestamp:', timestamp);
    console.error('Level:', errorData.level);
    console.error('Message:', errorData.message);
    console.error('URL:', errorData.url);
    console.error('User Agent:', errorData.userAgent);
    console.error('Device Info:', JSON.stringify(errorData.deviceInfo, null, 2));
    if (errorData.data) {
      console.error('Error Data:', JSON.stringify(errorData.data, null, 2));
    }
    console.error('========================');
    
    // 환경에 따라 다른 처리
    if (process.env.NODE_ENV === 'production') {
      // 프로덕션에서는 외부 로깅 서비스로 전송 가능
      // 예: Sentry, LogRocket, DataDog 등
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Error logged successfully',
      timestamp 
    });
    
  } catch (error) {
    console.error('Failed to log client error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to log error' 
      }, 
      { status: 500 }
    );
  }
}