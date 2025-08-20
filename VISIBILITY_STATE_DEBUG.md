# 페이지 가시성 상태 디버깅 가이드

## 이전 문제점
로그에서 발견된 상태 불일치:
```
👁️ 페이지 가시성 상태 업데이트: {
  from: true, 
  to: false, 
  documentVisible: true, 
  windowFocused: false, 
  visibilityState: true  // ❌ 잘못된 타입! 문자열이어야 함
}
```

## 수정된 사항

### 1. MessageBuffer (`messageBuffer.ts`)
**개선점:**
- `visibilityState` 변수명을 `visibilityStateValue`로 변경하여 혼동 방지
- `visibilityIsVisible` 변수로 boolean 변환 명확화
- 플랫폼별 다른 가시성 판단 로직 적용:
  - **모바일**: `documentVisible && visibilityIsVisible` (포커스 체크 제외)
  - **데스크톱**: `documentVisible && windowFocused && visibilityIsVisible` (모든 조건)

**새로운 로그 형태:**
```javascript
👁️ 페이지 가시성 상태 업데이트: {
  from: true,
  to: false,
  documentVisible: true,
  windowFocused: false,
  visibilityState: "visible",      // ✅ 올바른 문자열 값
  visibilityIsVisible: true,       // ✅ boolean 변환 결과
  platform: "desktop",             // ✅ 플랫폼 정보
  finalDecision: false            // ✅ 최종 판단 결과
}
```

### 2. BackgroundDetection (`backgroundDetection.ts`)
**개선점:**
- 더 정교한 백그라운드 상태 판단 로직 추가
- 플랫폼별 로직 분리:
  - **모바일**: visibility만으로 판단
  - **데스크톱**: visibility OR (focus 잃음 + 오랜 비활성)

## 디버깅 방법

### 브라우저 개발자 도구에서 확인:
1. **Console 탭**에서 다음 로그들 모니터링:
   - `👁️ 페이지 가시성 상태 업데이트`
   - `🎯 Focus state changed`
   - `🔄 Background state updated`

### 수동 테스트:
```javascript
// 브라우저 콘솔에서 실행
console.log({
  hidden: document.hidden,
  visibilityState: document.visibilityState,
  hasFocus: document.hasFocus(),
  userAgent: navigator.userAgent.includes('Mobi') ? 'mobile' : 'desktop'
});
```

### 상태 전환 시나리오:
1. **탭 전환**: 다른 탭으로 이동 → `visibilityState: "hidden"`
2. **윈도우 포커스 잃음**: 다른 애플리케이션으로 이동
3. **모바일 앱 전환**: 홈 화면이나 다른 앱으로 이동

## 예상되는 정상 로그:

### 데스크톱에서 탭 전환:
```
👁️ 페이지 가시성 상태 업데이트: {
  from: true, to: false,
  documentVisible: false,
  windowFocused: false,
  visibilityState: "hidden",
  platform: "desktop",
  finalDecision: false
}
```

### 모바일에서 앱 백그라운드:
```
👁️ 페이지 가시성 상태 업데이트: {
  from: true, to: false,  
  documentVisible: false,
  windowFocused: false,
  visibilityState: "hidden",
  platform: "mobile", 
  finalDecision: false
}
```

## 문제 발생 시 체크리스트:
- [ ] `visibilityState`가 문자열 값인가? ("visible" 또는 "hidden")
- [ ] `platform` 감지가 올바른가?
- [ ] `finalDecision`이 예상한 결과와 일치하는가?
- [ ] 플랫폼별 로직이 적절히 적용되는가?