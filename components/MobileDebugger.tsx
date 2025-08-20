'use client';

import { useState, useEffect, useCallback } from 'react';

interface DebugLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

export default function MobileDebugger() {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [tapCount, setTapCount] = useState(0);

  // 로그 추가 함수
  const addLog = useCallback((level: 'info' | 'warn' | 'error', message: string, data?: any) => {
    const log: DebugLog = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    
    setLogs(prev => [...prev.slice(-49), log]); // 최근 50개만 유지
    
    // 서버로 에러 로그 전송 (에러인 경우만)
    if (level === 'error') {
      sendErrorToServer(log);
    }
  }, []);

  // 서버로 에러 전송
  const sendErrorToServer = async (log: DebugLog) => {
    try {
      await fetch('/api/debug/error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...log,
          userAgent: navigator.userAgent,
          url: window.location.href,
          deviceInfo: {
            platform: navigator.platform,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            screenWidth: screen.width,
            screenHeight: screen.height,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight
          }
        }),
      });
    } catch (error) {
      console.error('Failed to send error log to server:', error);
    }
  };

  // 전역 에러 핸들러 설정
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setTimeout(() => addLog('error', `JS Error: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack
      }), 0);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setTimeout(() => addLog('error', `Unhandled Promise Rejection: ${event.reason}`, {
        reason: event.reason
      }), 0);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Console 메서드 오버라이드
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    };

    console.log = (...args) => {
      originalConsole.log(...args);
      setTimeout(() => addLog('info', args.join(' '), args), 0);
    };

    console.warn = (...args) => {
      originalConsole.warn(...args);
      setTimeout(() => addLog('warn', args.join(' '), args), 0);
    };

    console.error = (...args) => {
      originalConsole.error(...args);
      setTimeout(() => addLog('error', args.join(' '), args), 0);
    };

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      
      // Console 복원
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
    };
  }, [addLog]);

  // 7번 탭으로 디버거 활성화
  const handleScreenTap = () => {
    setTapCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 7) {
        setIsVisible(true);
        return 0;
      }
      setTimeout(() => setTapCount(0), 2000); // 2초 후 리셋
      return newCount;
    });
  };

  // 로그 레벨별 색상
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-500';
      case 'warn': return 'text-yellow-500';
      default: return 'text-blue-500';
    }
  };

  // 로그 내보내기
  const exportLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}${log.data ? '\nData: ' + JSON.stringify(log.data, null, 2) : ''}`
    ).join('\n\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mobile-debug-${new Date().toISOString().slice(0, 19)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isVisible) {
    return (
      <div 
        className="fixed top-0 left-0 w-full h-16 z-50 opacity-0"
        onClick={handleScreenTap}
        style={{ pointerEvents: 'all' }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col">
      {/* 헤더 */}
      <div className="bg-gray-800 text-white p-3 flex justify-between items-center">
        <h2 className="text-lg font-bold">🛠️ 모바일 디버거</h2>
        <div className="flex space-x-2">
          <button
            onClick={exportLogs}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded"
          >
            📤 내보내기
          </button>
          <button
            onClick={() => setLogs([])}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded"
          >
            🗑️ 지우기
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="px-3 py-1 bg-gray-600 text-white text-sm rounded"
          >
            ❌ 닫기
          </button>
        </div>
      </div>

      {/* 디바이스 정보 */}
      <div className="bg-gray-700 text-white p-2 text-xs">
        <div><strong>User Agent:</strong> {navigator.userAgent}</div>
        <div><strong>Screen:</strong> {screen.width}x{screen.height}</div>
        <div><strong>Window:</strong> {window.innerWidth}x{window.innerHeight}</div>
        <div><strong>Platform:</strong> {navigator.platform}</div>
        <div><strong>Language:</strong> {navigator.language}</div>
      </div>

      {/* 로그 목록 */}
      <div className="flex-1 overflow-y-auto bg-gray-900 text-white p-2">
        {logs.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            아직 로그가 없습니다. 7번 탭하면 디버거가 활성화됩니다.
          </div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="mb-3 p-2 bg-gray-800 rounded border-l-4 border-gray-600">
              <div className="flex justify-between items-center mb-1">
                <span className={`font-bold ${getLevelColor(log.level)}`}>
                  {log.level.toUpperCase()}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-sm mb-1">{log.message}</div>
              {log.data && (
                <details className="text-xs text-gray-300">
                  <summary className="cursor-pointer">📊 데이터 보기</summary>
                  <pre className="mt-1 p-2 bg-gray-700 rounded overflow-x-auto">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>

      {/* 하단 정보 */}
      <div className="bg-gray-800 text-white p-2 text-center text-xs">
        총 {logs.length}개 로그 | 에러: {logs.filter(l => l.level === 'error').length}개 | 
        경고: {logs.filter(l => l.level === 'warn').length}개
      </div>
    </div>
  );
}