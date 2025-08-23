// utils/memoryOptimizer.ts
// 모바일 메모리 최적화 유틸리티

interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  memoryUsage: number;
}

class MemoryOptimizer {
  private warningThreshold = 0.75; // 75% 메모리 사용률 경고 (더 안전한 값)
  private criticalThreshold = 0.85; // 85% 메모리 사용률 위험 (안정성 향상)
  private emergencyThreshold = 0.9; // 90% 응급 상황
  private checkInterval: number | null = null;
  private onMemoryWarning: ((stats: MemoryStats) => void) | null = null;
  private lastCleanupTime = 0;
  private consecutiveWarnings = 0;
  private isInEmergencyMode = false;

  constructor() {
    this.startMemoryMonitoring();
  }

  // 메모리 사용률 확인
  getMemoryStats(): MemoryStats | null {
    if (!('memory' in performance)) {
      return null;
    }

    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      memoryUsage: memory.usedJSHeapSize / memory.totalJSHeapSize
    };
  }

  // 안정화된 메모리 모니터링
  startMemoryMonitoring() {
    if (this.checkInterval || !('memory' in performance)) {
      return;
    }

    this.checkInterval = window.setInterval(() => {
      const stats = this.getMemoryStats();
      if (!stats) return;

      const now = Date.now();
      const timeSinceLastCleanup = now - this.lastCleanupTime;

      if (stats.memoryUsage > this.emergencyThreshold) {
        // 90%+ 응급 상황
        console.error('🆘 EMERGENCY memory usage:', Math.round(stats.memoryUsage * 100) + '%');
        this.handleEmergencyMemoryState(stats);
      } else if (stats.memoryUsage > this.criticalThreshold) {
        // 85%+ 위험 상황  
        console.warn('🚨 Critical memory usage:', Math.round(stats.memoryUsage * 100) + '%');
        this.handleCriticalMemoryState(stats, timeSinceLastCleanup);
      } else if (stats.memoryUsage > this.warningThreshold) {
        // 75%+ 경고 상황
        console.warn('⚠️ High memory usage:', Math.round(stats.memoryUsage * 100) + '%');
        this.handleWarningMemoryState(stats, timeSinceLastCleanup);
      } else {
        // 정상 상태 복구
        this.handleNormalMemoryState();
      }
    }, this.getMonitoringInterval()); 
  }

  // 각 단계별 메모리 상태 처리
  private handleNormalMemoryState() {
    if (this.consecutiveWarnings > 0) {
      console.log('✅ Memory usage returned to normal');
      this.consecutiveWarnings = 0;
      this.isInEmergencyMode = false;
    }
  }
  
  private handleWarningMemoryState(stats: MemoryStats, timeSinceLastCleanup: number) {
    this.consecutiveWarnings++;
    
    // 경고 단계에서는 10초 간격으로 정리
    if (timeSinceLastCleanup > 10000) {
      this.triggerMemoryCleanup('warning', stats);
    }
  }
  
  private handleCriticalMemoryState(stats: MemoryStats, timeSinceLastCleanup: number) {
    this.consecutiveWarnings++;
    
    // 위험 단계에서는 5초 간격으로 정리
    if (timeSinceLastCleanup > 5000 || this.consecutiveWarnings >= 3) {
      this.triggerMemoryCleanup('critical', stats);
    }
    
    if (this.onMemoryWarning) {
      this.onMemoryWarning(stats);
    }
  }
  
  private handleEmergencyMemoryState(stats: MemoryStats) {
    this.isInEmergencyMode = true;
    this.consecutiveWarnings++;
    
    // 응급 상황에서는 즉시 정리
    this.triggerEmergencyCleanup(stats);
    
    if (this.onMemoryWarning) {
      this.onMemoryWarning(stats);
    }
  }
  
  // 안전한 메모리 정리 실행
  private triggerMemoryCleanup(level: 'warning' | 'critical', stats: MemoryStats) {
    console.log(`🧹 Triggering ${level} memory cleanup:`, {
      usage: Math.round(stats.memoryUsage * 100) + '%',
      consecutiveWarnings: this.consecutiveWarnings
    });
    
    this.lastCleanupTime = Date.now();
    
    // 이벤트 발송으로 다른 컴포넌트들이 정리 작업 수행하도록 알림
    window.dispatchEvent(new CustomEvent('memoryCleanup', {
      detail: { 
        timestamp: Date.now(), 
        level,
        usage: stats.memoryUsage,
        consecutiveWarnings: this.consecutiveWarnings
      }
    }));

    this.requestGarbageCollection();
  }

  // 안전한 응급 메모리 정리
  private triggerEmergencyCleanup(stats: MemoryStats) {
    console.error('🆘 Triggering EMERGENCY memory cleanup:', {
      usage: Math.round(stats.memoryUsage * 100) + '%',
      consecutiveWarnings: this.consecutiveWarnings,
      isAlreadyInEmergency: this.isInEmergencyMode
    });
    
    this.lastCleanupTime = Date.now();
    
    // 응급 정리 이벤트 발송
    window.dispatchEvent(new CustomEvent('emergencyMemoryCleanup', {
      detail: { 
        timestamp: Date.now(), 
        level: 'emergency',
        usage: stats.memoryUsage,
        consecutiveWarnings: this.consecutiveWarnings,
        isRecurring: this.isInEmergencyMode
      }
    }));
    
    // 일반 정리도 실행 (안전성을 위해)
    window.dispatchEvent(new CustomEvent('memoryCleanup', {
      detail: { timestamp: Date.now(), level: 'emergency' }
    }));

    this.requestGarbageCollection();

    // 심각한 상황에서만 iOS Safari 특별 처리 시도
    if (stats.memoryUsage > 0.95 || this.consecutiveWarnings > 5) {
      console.warn('🆘 Attempting iOS Safari memory release due to severe pressure');
      this.forceIOSMemoryRelease();
    }
  }

  // 가비지 컬렉션 요청
  private requestGarbageCollection() {
    if (typeof window.gc === 'function') {
      try {
        window.gc();
        console.log('✅ Manual garbage collection triggered');
      } catch (error) {
        console.warn('Failed to trigger manual GC:', error);
      }
    }
  }

  // 더 안전한 iOS Safari 메모리 해제
  private forceIOSMemoryRelease() {
    try {
      // 더 점진적인 메모리 해제 시도
      let tempArray: any[] = [];
      
      // 작은 배열로 시작하여 점진적 증가
      for (let i = 0; i < 100; i++) {
        tempArray.push(null);
      }
      tempArray = [];
      
      // 페이지 히스토리 정리 (안전성 향상)
      if (typeof window !== 'undefined' && window.history && this.consecutiveWarnings > 10) {
        // 심각한 상황에서만 실행
        window.history.replaceState(null, '', window.location.href);
      }
      
      console.log('🍎 Safe iOS Safari memory release attempted:', {
        consecutiveWarnings: this.consecutiveWarnings,
        historyCleared: this.consecutiveWarnings > 10
      });
    } catch (error) {
      console.warn('Failed iOS memory release:', error);
    }
  }
  
  // 모니터링 간격 동적 조정
  private getMonitoringInterval(): number {
    if (this.isInEmergencyMode) {
      return 2000; // 응급 상황: 2초
    } else if (this.consecutiveWarnings > 3) {
      return 3000; // 연속 경고: 3초
    } else {
      return 5000; // 일반 상황: 5초
    }
  }

  // 메모리 경고 콜백 설정
  setMemoryWarningCallback(callback: (stats: MemoryStats) => void) {
    this.onMemoryWarning = callback;
  }

  // 메모리 모니터링 중지
  stopMemoryMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // 배열 크기 제한 유틸리티
  limitArraySize<T>(array: T[], maxSize: number): T[] {
    if (array.length <= maxSize) {
      return array;
    }
    return array.slice(-maxSize);
  }

  // 오래된 데이터 정리 유틸리티
  cleanupOldData<T extends { timestamp?: string | number; receivedAt?: number }>(
    array: T[], 
    maxAge: number
  ): T[] {
    const cutoff = Date.now() - maxAge;
    return array.filter(item => {
      const itemTime = item.receivedAt || (item.timestamp ? new Date(item.timestamp).getTime() : Date.now());
      return itemTime > cutoff;
    });
  }
}

export const memoryOptimizer = new MemoryOptimizer();

// 전역 메모리 정리 이벤트 리스너
if (typeof window !== 'undefined') {
  window.addEventListener('memoryCleanup', () => {
    console.log('📢 Memory cleanup event received globally');
    
    // 로컬 스토리지 불필요한 데이터 정리
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('temp_') || key.includes('debug_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to cleanup localStorage:', error);
    }
  });
}

export default memoryOptimizer;