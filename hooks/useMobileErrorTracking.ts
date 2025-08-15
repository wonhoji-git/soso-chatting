'use client';

import { useEffect, useRef } from 'react';

interface ErrorTrackingConfig {
  trackNetworkErrors?: boolean;
  trackViewportChanges?: boolean;
  trackTouchErrors?: boolean;
  trackPerformanceIssues?: boolean;
}

export const useMobileErrorTracking = (config: ErrorTrackingConfig = {}) => {
  const {
    trackNetworkErrors = true,
    trackViewportChanges = true,
    trackTouchErrors = true,
    trackPerformanceIssues = true
  } = config;

  const isTrackingRef = useRef(false);

  const sendErrorLog = async (errorData: any) => {
    try {
      await fetch('/api/debug/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `mobile-error-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'error',
          ...errorData,
          userAgent: navigator.userAgent,
          url: window.location.href,
          deviceInfo: {
            platform: navigator.platform,
            language: navigator.language,
            screenWidth: screen.width,
            screenHeight: screen.height,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
            connection: (navigator as any).connection ? {
              effectiveType: (navigator as any).connection.effectiveType,
              downlink: (navigator as any).connection.downlink,
              rtt: (navigator as any).connection.rtt,
              saveData: (navigator as any).connection.saveData
            } : null
          }
        })
      });
    } catch (error) {
      console.error('Failed to send mobile error log:', error);
    }
  };

  useEffect(() => {
    if (isTrackingRef.current) return;
    isTrackingRef.current = true;

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) return;

    console.log('🔍 Mobile error tracking enabled');

    // 네트워크 에러 추적
    if (trackNetworkErrors) {
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        try {
          const response = await originalFetch(...args);
          if (!response.ok) {
            sendErrorLog({
              message: `Network Error: ${response.status} ${response.statusText}`,
              data: {
                url: args[0],
                status: response.status,
                statusText: response.statusText,
                type: 'network_error'
              }
            });
          }
          return response;
        } catch (error) {
          sendErrorLog({
            message: `Fetch Error: ${error}`,
            data: {
              url: args[0],
              error: error instanceof Error ? error.message : String(error),
              type: 'fetch_error'
            }
          });
          throw error;
        }
      };
    }

    // 뷰포트 변경 추적 (모바일 회전, 키보드 등)
    if (trackViewportChanges) {
      let lastViewport = { width: window.innerWidth, height: window.innerHeight };
      
      const handleViewportChange = () => {
        const newViewport = { width: window.innerWidth, height: window.innerHeight };
        const heightDiff = Math.abs(newViewport.height - lastViewport.height);
        
        // 큰 높이 변화는 키보드 표시/숨김일 가능성
        if (heightDiff > 150) {
          console.log('📱 Viewport change detected:', { 
            from: lastViewport, 
            to: newViewport,
            heightDiff,
            possibleKeyboard: heightDiff > 200
          });
          
          sendErrorLog({
            message: `Viewport Change: ${lastViewport.width}x${lastViewport.height} → ${newViewport.width}x${newViewport.height}`,
            data: {
              previousViewport: lastViewport,
              newViewport,
              heightDiff,
              possibleKeyboard: heightDiff > 200,
              type: 'viewport_change'
            }
          });
        }
        
        lastViewport = newViewport;
      };

      window.addEventListener('resize', handleViewportChange);
      window.addEventListener('orientationchange', handleViewportChange);
    }

    // 터치 이벤트 에러 추적
    if (trackTouchErrors) {
      const handleTouchError = (event: TouchEvent) => {
        if (event.touches.length === 0) return;
        
        const touch = event.touches[0];
        if (!touch) {
          sendErrorLog({
            message: 'Touch Error: Invalid touch object',
            data: {
              touchesLength: event.touches.length,
              type: 'touch_error'
            }
          });
        }
      };

      document.addEventListener('touchstart', handleTouchError);
      document.addEventListener('touchmove', handleTouchError);
    }

    // 성능 문제 추적
    if (trackPerformanceIssues) {
      // 메모리 사용량 체크 (Chrome/Edge)
      const checkMemory = () => {
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          const memoryUsage = memory.usedJSHeapSize / memory.totalJSHeapSize;
          
          if (memoryUsage > 0.9) { // 90% 이상 사용시
            sendErrorLog({
              message: `High Memory Usage: ${(memoryUsage * 100).toFixed(1)}%`,
              data: {
                usedJSHeapSize: memory.usedJSHeapSize,
                totalJSHeapSize: memory.totalJSHeapSize,
                jsHeapSizeLimit: memory.jsHeapSizeLimit,
                memoryUsage,
                type: 'performance_memory'
              }
            });
          }
        }
      };

      // 주기적으로 메모리 체크
      const memoryInterval = setInterval(checkMemory, 30000); // 30초마다

      // Long Task 감지 (브라우저 지원시)
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry) => {
              if (entry.duration > 50) { // 50ms 이상 blocking
                sendErrorLog({
                  message: `Long Task Detected: ${entry.duration.toFixed(2)}ms`,
                  data: {
                    duration: entry.duration,
                    startTime: entry.startTime,
                    name: entry.name,
                    type: 'performance_long_task'
                  }
                });
              }
            });
          });
          observer.observe({ entryTypes: ['longtask'] });
        } catch (error) {
          console.warn('PerformanceObserver not supported for longtask');
        }
      }

      return () => {
        clearInterval(memoryInterval);
      };
    }

    // 연결 상태 변화 추적
    const handleConnectionChange = () => {
      sendErrorLog({
        message: `Connection Status: ${navigator.onLine ? 'Online' : 'Offline'}`,
        data: {
          online: navigator.onLine,
          connection: (navigator as any).connection ? {
            effectiveType: (navigator as any).connection.effectiveType,
            downlink: (navigator as any).connection.downlink,
            rtt: (navigator as any).connection.rtt
          } : null,
          type: 'connection_change'
        }
      });
    };

    window.addEventListener('online', handleConnectionChange);
    window.addEventListener('offline', handleConnectionChange);

    // 페이지 가시성 변화 추적 (백그라운드/포그라운드)
    const handleVisibilityChange = () => {
      sendErrorLog({
        message: `Page Visibility: ${document.hidden ? 'Hidden' : 'Visible'}`,
        data: {
          hidden: document.hidden,
          visibilityState: document.visibilityState,
          type: 'visibility_change'
        }
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isTrackingRef.current = false;
      window.removeEventListener('online', handleConnectionChange);
      window.removeEventListener('offline', handleConnectionChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [trackNetworkErrors, trackViewportChanges, trackTouchErrors, trackPerformanceIssues]);

  return {
    sendErrorLog
  };
};