# Vercel Environment Variables Setup & Production Optimization

프로덕션에서 채팅 기능이 정상 작동하려면 Vercel에 환경 변수를 설정해야 합니다.

## 설정 방법

1. **Vercel Dashboard 접속**
   - https://vercel.com 로 이동
   - 프로젝트 선택

2. **Environment Variables 설정**
   - 프로젝트 대시보드에서 `Settings` 탭 클릭
   - 왼쪽 사이드바에서 `Environment Variables` 클릭

3. **다음 환경 변수들을 추가**:

   ```
   Name: NEXT_PUBLIC_PUSHER_KEY
   Value: 44e2b7195654d18229a3
   Environment: Production, Preview, Development
   
   Name: NEXT_PUBLIC_PUSHER_CLUSTER  
   Value: ap3
   Environment: Production, Preview, Development
   
   Name: PUSHER_APP_ID
   Value: 2036438
   Environment: Production, Preview, Development
   
   Name: PUSHER_SECRET
   Value: da6cce7780d46db8a0e4
   Environment: Production, Preview, Development
   
   Name: NODE_ENV
   Value: production
   Environment: Production
   ```

4. **재배포**
   - 환경 변수 설정 후 자동으로 재배포되거나
   - 수동으로 `Deployments` 탭에서 재배포 실행

## Production WebSocket 최적화

이 프로젝트는 프로덕션 환경에서 WebSocket 연결 안정성을 위해 다음과 같이 최적화되었습니다:

### 연결 설정
- **Transport 우선순위**: WSS → XHR Streaming → XHR Polling
- **강화된 재연결**: 최대 8회 시도, 지수 백오프 (최대 30초)
- **연결 타임아웃**: 60초 (개발환경: 30초)
- **핑퐁 타임아웃**: 30초 (개발환경: 25초)

### 성능 최적화
- **지연된 정리**: 연결 안정성을 위해 5초 지연 후 리소스 정리
- **연결 상태 확인**: 10초마다 실시간 상태 확인 (개발환경: 5초)
- **하트비트**: 45초마다 서버 상태 확인 (개발환경: 30초)

## 확인 방법

재배포 후:
1. 사이트 접속하여 채팅 기능 테스트
2. 브라우저 개발자 도구에서 콘솔 확인
3. 네트워크 탭에서 WebSocket 연결 상태 모니터링
4. 에러가 발생하면 Vercel Function Logs 확인

## 트러블슈팅

### WebSocket 연결 실패 시
1. 브라우저 콘솔에서 "📤 Pusher client config retrieved" 메시지 확인
2. 환경 변수가 올바르게 설정되었는지 확인
3. Vercel Function Logs에서 서버 사이드 에러 확인
4. 방화벽/프록시가 WSS 연결을 차단하는지 확인

### 연결이 자주 끊어질 때
- 프로덕션 최적화가 적용되어 개발환경보다 연결이 안정적임
- 연결 재시도 로그를 확인하여 패턴 분석
- 네트워크 상태 및 서버 상태 확인

## 주의사항

- `NEXT_PUBLIC_` 접두사가 있는 변수는 클라이언트에서 접근 가능
- `PUSHER_SECRET`과 `PUSHER_APP_ID`는 서버에서만 사용됨
- 모든 환경(Production, Preview, Development)에 동일하게 설정 권장
- NODE_ENV=production 설정으로 최적화된 WebSocket 설정 활성화
