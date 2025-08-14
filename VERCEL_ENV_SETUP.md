# Vercel Environment Variables Setup

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
   ```

4. **재배포**
   - 환경 변수 설정 후 자동으로 재배포되거나
   - 수동으로 `Deployments` 탭에서 재배포 실행

## 확인 방법

재배포 후:
1. 사이트 접속하여 채팅 기능 테스트
2. 브라우저 개발자 도구에서 콘솔 확인
3. 에러가 발생하면 Vercel Function Logs 확인

## 주의사항

- `NEXT_PUBLIC_` 접두사가 있는 변수는 클라이언트에서 접근 가능
- `PUSHER_SECRET`과 `PUSHER_APP_ID`는 서버에서만 사용됨
- 모든 환경(Production, Preview, Development)에 동일하게 설정 권장