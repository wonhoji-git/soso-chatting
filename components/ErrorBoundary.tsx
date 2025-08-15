'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // 에러 정보를 서버로 전송
    this.logErrorToServer(error, errorInfo);
  }

  private logErrorToServer = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      const errorData = {
        id: `error-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        level: 'error' as const,
        message: `React Error Boundary: ${error.message}`,
        data: {
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
          componentStack: errorInfo.componentStack,
          errorBoundary: true
        },
        userAgent: navigator.userAgent,
        url: window.location.href,
        deviceInfo: {
          platform: navigator.platform,
          language: navigator.language,
          cookieEnabled: navigator.cookieEnabled,
          screenWidth: screen.width,
          screenHeight: screen.height,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        }
      };

      await fetch('/api/debug/error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData),
      });

      console.error('=== ERROR BOUNDARY CAUGHT ===');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('============================');
    } catch (logError) {
      console.error('Failed to log error to server:', logError);
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // 커스텀 fallback이 제공된 경우 사용
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 에러 UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-pink-200 via-purple-200 to-indigo-300 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border-4 border-pink-300">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-2xl font-bold text-purple-700 mb-4">
              앗! 문제가 발생했어요
            </h1>
            <p className="text-purple-600 mb-6">
              예상치 못한 오류가 발생했습니다.
              <br />잠시 후 다시 시도해주세요.
            </p>
            
            {/* 개발 환경에서만 상세 에러 정보 표시 */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left bg-gray-100 p-4 rounded-lg mb-4 text-sm">
                <summary className="font-bold cursor-pointer">🐛 개발자 정보</summary>
                <div className="mt-2">
                  <div><strong>Error:</strong> {this.state.error.message}</div>
                  <div><strong>Stack:</strong></div>
                  <pre className="text-xs overflow-auto bg-gray-200 p-2 rounded mt-1">
                    {this.state.error.stack}
                  </pre>
                  {this.state.errorInfo && (
                    <>
                      <div className="mt-2"><strong>Component Stack:</strong></div>
                      <pre className="text-xs overflow-auto bg-gray-200 p-2 rounded mt-1">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            )}

            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-400 to-purple-500 text-white font-bold rounded-2xl hover:from-blue-500 hover:to-purple-600 transition-all duration-200 shadow-lg transform hover:scale-105"
              >
                🔄 다시 시도
              </button>
              <button
                onClick={this.handleReload}
                className="w-full px-6 py-3 bg-gradient-to-r from-pink-400 to-red-400 text-white font-bold rounded-2xl hover:from-pink-500 hover:to-red-500 transition-all duration-200 shadow-lg transform hover:scale-105"
              >
                🔃 페이지 새로고침
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full px-6 py-3 bg-gradient-to-r from-green-400 to-blue-400 text-white font-bold rounded-2xl hover:from-green-500 hover:to-blue-500 transition-all duration-200 shadow-lg transform hover:scale-105"
              >
                🏠 홈으로 이동
              </button>
            </div>

            <div className="mt-6 text-xs text-gray-500">
              문제가 계속 발생하면 페이지를 새로고침하거나<br />
              잠시 후 다시 방문해주세요.
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}