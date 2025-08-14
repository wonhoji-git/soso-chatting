// components/PusherDebug.tsx
'use client';

import { useEffect, useState } from 'react';
import { validatePusherConfigClient, getPusherClientConfig } from '@/lib/pusher-config';
import { usePusherContext } from '@/contexts/PusherContext';

export default function PusherDebug() {
  const [configStatus, setConfigStatus] = useState<boolean | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastReconnectTime, setLastReconnectTime] = useState<Date | null>(null);
  const [networkInfo, setNetworkInfo] = useState({
    online: navigator.onLine,
    connectionType: 'Unknown',
    effectiveType: 'Unknown'
  });
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [environmentInfo, setEnvironmentInfo] = useState({
    pusherKey: '',
    pusherCluster: '',
    hasEnvVars: false
  });
  
  // usePusherContext에서 연결 상태 가져오기
  const { 
    connectionStatus, 
    isConnected, 
    getConnectionState, 
    reconnect, 
    retryCount, 
    lastError,
    getCurrentTransport 
  } = usePusherContext();

  useEffect(() => {
    const status = validatePusherConfigClient();
    setConfigStatus(status);
    
    if (status) {
      const config = getPusherClientConfig();
      setConnectionInfo(`Key: ${config.key?.substring(0, 8)}... | Cluster: ${config.cluster}`);
      
      // 환경 변수 정보 저장
      setEnvironmentInfo({
        pusherKey: config.key || '',
        pusherCluster: config.cluster || '',
        hasEnvVars: true
      });
    } else {
      // 환경 변수 정보 저장 (실패한 경우)
      setEnvironmentInfo({
        pusherKey: process.env.NEXT_PUBLIC_PUSHER_KEY || 'NOT_SET',
        pusherCluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'NOT_SET',
        hasEnvVars: false
      });
    }

    // 네트워크 상태 모니터링
    const updateNetworkInfo = () => {
      setNetworkInfo({
        online: navigator.onLine,
        connectionType: (navigator as any).connection?.type || 'Unknown',
        effectiveType: (navigator as any).connection?.effectiveType || 'Unknown'
      });
    };

    updateNetworkInfo();
    window.addEventListener('online', updateNetworkInfo);
    window.addEventListener('offline', updateNetworkInfo);

    return () => {
      window.removeEventListener('online', updateNetworkInfo);
      window.removeEventListener('offline', updateNetworkInfo);
    };
  }, []);

  // 연결 상태 변경 감지하여 재연결 상태 업데이트
  useEffect(() => {
    if (connectionStatus === 'connected' && isReconnecting) {
      setIsReconnecting(false);
      setReconnectAttempts(0);
    } else if (connectionStatus === 'failed' && isReconnecting) {
      setIsReconnecting(false);
    }
  }, [connectionStatus, isReconnecting]);

  // 디버그 로그 수집 (더 포괄적으로)
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    const logInterceptor = (...args: any[]) => {
      const logMessage = args.join(' ');
      
      // Pusher 관련 로그만 필터링
      if (logMessage.includes('Pusher Connection:') || 
          logMessage.includes('Pusher') || 
          logMessage.includes('pusher')) {
        setDebugLogs(prev => [...prev.slice(-19), logMessage]); // 최근 20개만 유지
      }
      
      originalLog.apply(console, args);
    };
    
    const errorInterceptor = (...args: any[]) => {
      const logMessage = `ERROR: ${args.join(' ')}`;
      
      // Pusher 관련 에러만 필터링
      if (logMessage.includes('Pusher') || logMessage.includes('pusher')) {
        setDebugLogs(prev => [...prev.slice(-19), logMessage]);
      }
      
      originalError.apply(console, args);
    };

    const warnInterceptor = (...args: any[]) => {
      const logMessage = `WARN: ${args.join(' ')}`;
      
      // Pusher 관련 경고만 필터링
      if (logMessage.includes('Pusher') || logMessage.includes('pusher')) {
        setDebugLogs(prev => [...prev.slice(-19), logMessage]);
      }
      
      originalWarn.apply(console, args);
    };
    
    console.log = logInterceptor;
    console.error = errorInterceptor;
    console.warn = warnInterceptor;
    
    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  // 재연결 시도 함수
  const handleReconnect = async () => {
    if (isReconnecting) return;
    
    setIsReconnecting(true);
    setReconnectAttempts(prev => prev + 1);
    setLastReconnectTime(new Date());
    
    try {
      await reconnect();
    } catch (error) {
      console.error('Manual reconnect failed:', error);
      setIsReconnecting(false);
    }
  };

  // 환경 변수 검증 함수
  const validateEnvironmentVariables = () => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    
    return {
      key: key || 'NOT_SET',
      cluster: cluster || 'NOT_SET',
      isValid: !!(key && cluster),
      keyLength: key ? key.length : 0,
      clusterLength: cluster ? cluster.length : 0
    };
  };

  if (configStatus === null) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      case 'failed':
        return 'bg-red-600';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'failed':
        return 'Connection Failed';
      default:
        return 'Unknown';
    }
  };

  const getNetworkStatusColor = () => {
    return networkInfo.online ? 'bg-green-500' : 'bg-red-500';
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString();
  };

  const getCurrentConnectionState = getConnectionState();
  const currentTransport = getCurrentTransport();
  const envValidation = validateEnvironmentVariables();

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg p-4 shadow-lg max-w-sm z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Pusher Debug Info</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-500 hover:text-gray-700 text-xs"
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>
      
      <div className="space-y-3 text-xs">
        {/* Configuration Status */}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${configStatus ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span>Configuration: {configStatus ? 'Valid' : 'Invalid'}</span>
        </div>
        
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${getStatusColor(connectionStatus)} ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`}></span>
          <span>Connection: {getStatusText(connectionStatus)}</span>
        </div>

        {/* Connection State */}
        <div className="text-gray-600">
          <div>State: {getCurrentConnectionState}</div>
        </div>

        {/* Network Status */}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${getNetworkStatusColor()}`}></span>
          <span>Network: {networkInfo.online ? 'Online' : 'Offline'}</span>
        </div>

        {/* Connection Quality Indicator */}
        {connectionStatus === 'connected' && (
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-xs">●</span>
            <span className="text-xs text-gray-600">Live Connection</span>
          </div>
        )}

        {/* Reconnecting Status */}
        {isReconnecting && (
          <div className="flex items-center gap-2 bg-yellow-50 p-2 rounded">
            <span className="text-yellow-600 text-xs animate-spin">⟳</span>
            <span className="text-yellow-700 text-xs">Reconnecting...</span>
          </div>
        )}

        {/* Expanded Info */}
        {isExpanded && (
          <>
            {/* Environment Variables */}
            <div className="text-gray-600 bg-gray-50 p-2 rounded">
              <div className="font-semibold mb-1">Environment Variables:</div>
              <div className="space-y-1">
                <div>Key: {envValidation.key.substring(0, 8)}... ({envValidation.keyLength} chars)</div>
                <div>Cluster: {envValidation.cluster} ({envValidation.clusterLength} chars)</div>
                <div className={`font-semibold ${envValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                  Status: {envValidation.isValid ? 'Valid' : 'Invalid'}
                </div>
              </div>
            </div>

            {/* Retry Count */}
            {retryCount > 0 && (
              <div className="text-orange-600">
                <div>Retry Attempts: {retryCount}</div>
              </div>
            )}

            {/* Manual Reconnect Info */}
            {reconnectAttempts > 0 && (
              <div className="text-blue-600 bg-blue-50 p-2 rounded">
                <div className="font-semibold mb-1">Manual Reconnect:</div>
                <div>Attempts: {reconnectAttempts}</div>
                {lastReconnectTime && (
                  <div>Last attempt: {formatTime(lastReconnectTime)}</div>
                )}
              </div>
            )}

            {/* Last Error */}
            {lastError && (
              <div className="text-red-600 bg-red-50 p-2 rounded text-xs">
                <div className="font-semibold">Last Error:</div>
                <div>{lastError}</div>
              </div>
            )}
            
            {/* Connection Info */}
            {configStatus && (
              <div className="text-gray-600">
                <div>{connectionInfo}</div>
              </div>
            )}

            {/* Network Info */}
            <div className="text-gray-600 bg-gray-50 p-2 rounded">
              <div className="font-semibold mb-1">Network Details:</div>
              <div>Status: {networkInfo.online ? 'Online' : 'Offline'}</div>
              <div>Type: {networkInfo.connectionType}</div>
              <div>Speed: {networkInfo.effectiveType}</div>
            </div>

            {/* Debug Logs */}
            {debugLogs.length > 0 && (
              <div className="text-gray-600 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto">
                <div className="font-semibold mb-1">Recent Logs ({debugLogs.length}):</div>
                {debugLogs.map((log, index) => (
                  <div key={index} className="text-xs font-mono break-all mb-1 p-1 bg-white rounded">
                    {log}
                  </div>
                ))}
              </div>
            )}

            {/* Connection Tips */}
            {connectionStatus === 'disconnected' || connectionStatus === 'failed' ? (
              <div className="text-blue-600 bg-blue-50 p-2 rounded text-xs">
                <div className="font-semibold mb-1">Troubleshooting:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>Check internet connection</li>
                  <li>Verify Pusher credentials</li>
                  <li>Check browser console for errors</li>
                  <li>Check network tab for failed requests</li>
                  <li>Try refreshing the page</li>
                  <li>Check if Pusher service is accessible</li>
                </ul>
              </div>
            ) : null}
          </>
        )}
        
        {/* Reconnect Button */}
        {connectionStatus === 'disconnected' || connectionStatus === 'failed' ? (
          <button
            onClick={handleReconnect}
            disabled={isReconnecting}
            className={`w-full text-xs py-2 px-3 rounded transition-colors ${
              isReconnecting 
                ? 'bg-gray-400 cursor-not-allowed text-gray-600' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
          </button>
        ) : null}
        
        {/* Error Info */}
        {!configStatus && (
          <div className="text-red-600 bg-red-50 p-2 rounded">
            <p className="font-semibold">Missing public environment variables</p>
            <p className="mt-1">Check your .env.local file for:</p>
            <ul className="list-disc list-inside mt-1">
              <li>NEXT_PUBLIC_PUSHER_KEY</li>
              <li>NEXT_PUBLIC_PUSHER_CLUSTER</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
