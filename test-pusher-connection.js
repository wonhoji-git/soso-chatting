// test-pusher-connection.js
// Pusher 연결 테스트를 위한 스크립트

const Pusher = require('pusher');

// .env.local 파일에서 환경변수 로드
require('dotenv').config({ path: '.env.local' });

const PUSHER_APP_ID = process.env.PUSHER_APP_ID;
const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const PUSHER_SECRET = process.env.PUSHER_SECRET;
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

console.log('🔍 Pusher 연결 테스트 시작...');
console.log('📋 설정 정보:');
console.log(`   App ID: ${PUSHER_APP_ID}`);
console.log(`   Key: ${PUSHER_KEY}`);
console.log(`   Secret: ${PUSHER_SECRET}`);
console.log(`   Cluster: ${PUSHER_CLUSTER}`);
console.log('');

// 서버 사이드 Pusher 인스턴스 생성
const pusher = new Pusher({
  appId: PUSHER_APP_ID,
  key: PUSHER_KEY,
  secret: PUSHER_SECRET,
  cluster: PUSHER_CLUSTER,
  useTLS: true
});

console.log('✅ Pusher 인스턴스 생성 완료');

// 연결 테스트
async function testPusherConnection() {
  try {
    console.log('🔄 Pusher 연결 테스트 중...');
    
    // 간단한 이벤트 발송 테스트
    const result = await pusher.trigger('test-channel', 'test-event', {
      message: 'Hello from test script!',
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ 이벤트 발송 성공!');
    console.log('📤 발송 결과:', result);
    
    // 채널 정보 조회 테스트
    const channels = await pusher.get({ path: '/channels' });
    console.log('✅ 채널 정보 조회 성공!');
    console.log('📋 채널 정보:', channels);
    
    console.log('\n🎉 모든 테스트가 성공적으로 완료되었습니다!');
    console.log('Pusher 연결이 정상적으로 작동하고 있습니다.');
    
  } catch (error) {
    console.error('❌ Pusher 연결 테스트 실패:');
    console.error('에러 메시지:', error.message);
    console.error('에러 코드:', error.code);
    console.error('에러 상세:', error);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n💡 해결 방법:');
      console.log('   - 인터넷 연결을 확인해주세요');
      console.log('   - DNS 설정을 확인해주세요');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 해결 방법:');
      console.log('   - Pusher 서비스가 정상적으로 작동하는지 확인해주세요');
      console.log('   - 방화벽 설정을 확인해주세요');
    } else if (error.status === 401) {
      console.log('\n💡 해결 방법:');
      console.log('   - App ID, Key, Secret이 올바른지 확인해주세요');
      console.log('   - Pusher 대시보드에서 설정을 다시 확인해주세요');
    }
  }
}

// 테스트 실행
testPusherConnection();
