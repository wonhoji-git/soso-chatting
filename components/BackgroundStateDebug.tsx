// components/BackgroundStateDebug.tsx
'use client';

import { useState, useEffect } from 'react';
import { 
  getBackgroundState, 
  getBackgroundDebugInfo, 
  onBackgroundStateChange,
  type BackgroundState 
} from '@/utils/backgroundDetection';

interface BackgroundStateDebugProps {
  show?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const BackgroundStateDebug = ({ 
  show = process.env.NODE_ENV === 'development', 
  position = 'bottom-right' 
}: BackgroundStateDebugProps) => {
  const [state, setState] = useState<BackgroundState | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!show) return;

    // 초기 상태 가져오기
    setState(getBackgroundState());
    setDebugInfo(getBackgroundDebugInfo());

    // 상태 변경 리스너 등록
    const unsubscribe = onBackgroundStateChange((newState) => {
      setState(newState);
      setDebugInfo(getBackgroundDebugInfo());
    });

    // 주기적으로 디버그 정보 업데이트
    const interval = setInterval(() => {
      setDebugInfo(getBackgroundDebugInfo());
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [show]);

  if (!show || !state) return null;

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  const getStateColor = () => {
    if (state.appState === 'active') return 'bg-green-500';
    if (state.appState === 'background') return 'bg-orange-500';
    if (state.appState === 'suspended') return 'bg-red-500';
    return 'bg-gray-500';
  };

  const getStateEmoji = () => {
    if (state.appState === 'active') return '🟢';
    if (state.appState === 'background') return '🟠';
    if (state.appState === 'suspended') return '🔴';
    return '⚪';
  };

  const getPlatformEmoji = () => {
    if (state.platform === 'mobile') return '📱';
    if (state.platform === 'tablet') return '📱';
    return '💻';
  };

  return (
    <div 
      className={`fixed ${positionClasses[position]} z-[99999] font-mono text-xs`}
      style={{ zIndex: 999999 }}
    >
      {/* 최소화된 상태 표시 */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`${getStateColor()} text-white px-3 py-2 rounded-lg shadow-lg cursor-pointer transition-all hover:scale-105 flex items-center space-x-2 min-w-[120px]`}
      >
        <span>{getStateEmoji()}</span>
        <span>{getPlatformEmoji()}</span>
        <span className="font-bold">{state.appState.toUpperCase()}</span>
        {state.isPWA && <span>📲</span>}
        <span className="text-xs opacity-75">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {/* 확장된 디버그 정보 */}
      {isExpanded && (
        <div className="mt-2 bg-black/90 text-green-400 p-4 rounded-lg shadow-xl max-w-sm overflow-auto max-h-96 backdrop-blur">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* 기본 상태 */}
            <div className="col-span-2 border-b border-green-600 pb-2 mb-2">
              <h3 className="text-yellow-400 font-bold">📱 App State</h3>
            </div>
            
            <div>App State:</div>
            <div className={`font-bold ${state.appState === 'active' ? 'text-green-400' : 'text-orange-400'}`}>
              {state.appState}
            </div>
            
            <div>Background:</div>
            <div className={state.isBackground ? 'text-red-400' : 'text-green-400'}>
              {state.isBackground ? 'YES' : 'NO'}
            </div>
            
            <div>Visible:</div>
            <div className={state.isVisible ? 'text-green-400' : 'text-red-400'}>
              {state.isVisible ? 'YES' : 'NO'}
            </div>
            
            <div>Has Focus:</div>
            <div className={state.hasFocus ? 'text-green-400' : 'text-red-400'}>
              {state.hasFocus ? 'YES' : 'NO'}
            </div>

            {/* 플랫폼 정보 */}
            <div className="col-span-2 border-b border-green-600 pb-2 mb-2 mt-3">
              <h3 className="text-yellow-400 font-bold">🔧 Platform</h3>
            </div>
            
            <div>Platform:</div>
            <div className="text-blue-400">{state.platform}</div>
            
            <div>PWA Mode:</div>
            <div className={state.isPWA ? 'text-green-400' : 'text-gray-400'}>
              {state.isPWA ? 'YES' : 'NO'}
            </div>
            
            <div>Visibility:</div>
            <div className="text-blue-400">{state.visibilityState}</div>

            {/* 활동 정보 */}
            {debugInfo && (
              <>
                <div className="col-span-2 border-b border-green-600 pb-2 mb-2 mt-3">
                  <h3 className="text-yellow-400 font-bold">⏰ Activity</h3>
                </div>
                
                <div>Last Activity:</div>
                <div className="text-purple-400 text-xs">
                  {new Date(debugInfo.lastUserActivity).toLocaleTimeString()}
                </div>
                
                <div>Time Since:</div>
                <div className="text-purple-400">
                  {Math.round(debugInfo.timeSinceActivity / 1000)}s
                </div>
                
                <div>Listeners:</div>
                <div className="text-cyan-400">{debugInfo.listenerCount}</div>
                
                <div>Health Check:</div>
                <div className={debugInfo.healthCheckActive ? 'text-green-400' : 'text-red-400'}>
                  {debugInfo.healthCheckActive ? 'ACTIVE' : 'INACTIVE'}
                </div>
              </>
            )}
          </div>

          {/* 실시간 업데이트 표시 */}
          <div className="mt-3 pt-2 border-t border-green-600 text-center">
            <div className="text-yellow-400 text-xs">
              🔄 Last Update: {new Date().toLocaleTimeString()}
            </div>
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={() => setIsExpanded(false)}
            className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white py-1 px-2 rounded text-xs font-bold transition-colors"
          >
            ❌ Close Debug
          </button>
        </div>
      )}
    </div>
  );
};

export default BackgroundStateDebug;