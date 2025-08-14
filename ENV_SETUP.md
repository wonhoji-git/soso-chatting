# 환경 변수 설정 가이드

## 1. .env.local 파일 생성

프로젝트 루트 디렉토리에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# Public variables (클라이언트에서 접근 가능)
NEXT_PUBLIC_PUSHER_KEY=your_pusher_key_here
NEXT_PUBLIC_PUSHER_CLUSTER=your_cluster_here

# Private variables (서버에서만 접근 가능)
PUSHER_APP_ID=your_app_id_here
PUSHER_SECRET=your_secret_here
```

## 2. Pusher 계정 설정

1. [Pusher Dashboard](https://dashboard.pusher.com/)에 로그인
2. 새 앱 생성 또는 기존 앱 선택
3. "App Keys" 섹션으로 이동
4. 다음 값들을 복사:
   - **App ID**: `PUSHER_APP_ID`에 사용
   - **Key**: `NEXT_PUBLIC_PUSHER_KEY`에 사용
   - **Secret**: `PUSHER_SECRET`에 사용
   - **Cluster**: `NEXT_PUBLIC_PUSHER_CLUSTER`에 사용

## 3. 환경 변수 적용

`.env.local` 파일을 생성한 후:

1. **개발 서버 재시작**: `npm run dev` 또는 `yarn dev` 재실행
2. **브라우저 새로고침**: 페이지 새로고침
3. **PusherDebug 컴포넌트 확인**: Configuration이 "Valid"로 표시되는지 확인

## 4. 문제 해결

### Configuration: Invalid
- `.env.local` 파일이 프로젝트 루트에 있는지 확인
- 환경 변수 이름이 정확한지 확인 (대소문자 구분)
- 개발 서버를 재시작했는지 확인

### Connection: Failed
- Pusher 키와 클러스터가 올바른지 확인
- 인터넷 연결 상태 확인
- 브라우저 콘솔에서 에러 메시지 확인

### 무한 재연결 루프
- 환경 변수가 올바르게 설정되었는지 확인
- Pusher 앱가 활성 상태인지 확인
- 네트워크 방화벽 설정 확인

## 5. 보안 주의사항

- `.env.local` 파일은 절대 Git에 커밋하지 마세요
- `NEXT_PUBLIC_` 접두사가 붙은 변수만 클라이언트에서 접근 가능합니다
- `PUSHER_SECRET`은 서버에서만 사용되어야 합니다

## 6. 테스트

환경 변수 설정 후:

1. PusherDebug 컴포넌트에서 Configuration이 "Valid"로 표시
2. Connection이 "Connected"로 변경
3. 브라우저 콘솔에서 Pusher 연결 로그 확인
4. 채팅 기능이 정상 작동하는지 테스트
