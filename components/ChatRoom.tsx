// components/ChatRoom.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { User, Message, ConnectionStatus } from '@/types/chat';
import { usePusherContext } from '@/contexts/PusherContext';
import { TypingIndicator } from './TypingIndicator';
import { NotificationSettings } from './NotificationSettings';
import { useMobileErrorTracking } from '@/hooks/useMobileErrorTracking';

interface ChatRoomProps {
  currentUser: User;
  onLogout: () => void;
}

export default function ChatRoom({ currentUser, onLogout }: ChatRoomProps) {
  const [newMessage, setNewMessage] = useState('');
  const [showReconnectAlert, setShowReconnectAlert] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [calmMode, setCalmMode] = useState(false); // Animation control for focused learning
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasJoinedRef = useRef(false);
  const isUnmountingRef = useRef(false);
  
  const [sidebarAnimation, setSidebarAnimation] = useState<'idle' | 'opening' | 'closing'>('idle');
  
  // 스크롤 상태 관리
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(0);

  // 자주 사용하는 이모지 목록
  const popularEmojis = [
    '😀', '😂', '🥰', '😊', '😎', '🤔', '😮', '😴',
    '🎉', '🎊', '❤️', '💖', '👍', '👎', '✨', '🌟',
    '🐱', '🐶', '🐼', '🦄', '🌈', '⭐', '🍕', '🎂',
    '🎈', '🎁', '🚀', '⚡', '💯', '🔥', '💝', '🌸'
  ];
  
  const { 
    isConnected, 
    connectionStatus, 
    onlineUsers, 
    messages, 
    typingUsers,
    notificationSettings,
    sendMessage, 
    joinChat, 
    leaveChat, 
    reconnect,
    retryCount,
    cleanupPusher,
    getConnectionState,
    getCurrentTransport,
    startTyping,
    stopTyping,
    requestNotificationPermission,
    showDesktopNotification,
    updateNotificationSettings
  } = usePusherContext();

  // 모바일 에러 트래킹 활성화
  const { sendErrorLog } = useMobileErrorTracking({
    trackNetworkErrors: true,
    trackViewportChanges: true,
    trackTouchErrors: true,
    trackPerformanceIssues: true
  });

  // 현재 사용자를 제외한 다른 사용자들만 필터링 (사이드바용)
  const otherUsers = onlineUsers.filter(user => user.id !== currentUser.id);
  // 전체 사용자 수는 onlineUsers 길이 그대로 사용 (자신도 포함되어 있음)
  const totalUserCount = onlineUsers.length;


  const scrollToBottom = useCallback((force = false) => {
    const container = messagesContainerRef.current;
    const endElement = messagesEndRef.current;
    
    if (!container || !endElement) return;
    
    if (force || isAtBottom) {
      try {
        endElement.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end',
          inline: 'nearest'
        });
        
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 50);
        
      } catch (error) {
        container.scrollTop = container.scrollHeight;
      }
      
      setShowScrollToBottom(false);
      setUnreadCount(0);
    }
  }, [isAtBottom]);

  // 스크롤 위치 감지
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const threshold = 100;
    const atBottom = scrollTop + clientHeight >= scrollHeight - threshold;
    
    setIsAtBottom(atBottom);
    setShowScrollToBottom(!atBottom);
    
    if (atBottom) {
      setUnreadCount(0);
    }
  }, [isAtBottom]);

  // 메시지 변경 시 스크롤 처리
  useEffect(() => {
    const currentMessageCount = messages.length;
    const previousMessageCount = prevMessagesLengthRef.current;
    
    if (currentMessageCount > previousMessageCount) {
      const newMessagesCount = currentMessageCount - previousMessageCount;
      
      if (isAtBottom) {
        requestAnimationFrame(() => {
          setTimeout(() => scrollToBottom(false), 50);
        });
      } else {
        setUnreadCount(prev => prev + newMessagesCount);
      }
    }
    
    if (previousMessageCount === 0 && currentMessageCount > 0) {
      setTimeout(() => scrollToBottom(true), 200);
    }
    
    prevMessagesLengthRef.current = currentMessageCount;
  }, [messages, isAtBottom, scrollToBottom]);

  // 스크롤 이벤트 등록
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    setTimeout(() => {
      handleScroll();
    }, 100);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);


  useEffect(() => {
    if (isConnected && !hasJoinedRef.current && !isUnmountingRef.current) {
      const attemptJoin = async () => {
        try {
          hasJoinedRef.current = true;
          await joinChat(currentUser);
        } catch (error) {
          console.error('Failed to join chat:', error);
          hasJoinedRef.current = false;
          
          setTimeout(() => {
            if (isConnected && !hasJoinedRef.current && !isUnmountingRef.current) {
              attemptJoin();
            }
          }, 3000);
        }
      };
      
      attemptJoin();
    }
  }, [isConnected, currentUser, joinChat]);

  // 연결 상태에 따른 알림 표시
  useEffect(() => {
    if (connectionStatus === 'failed') {
      setShowReconnectAlert(true);
    } else if (connectionStatus === 'connected') {
      setShowReconnectAlert(false);
    }
  }, [connectionStatus]);

  // 새로운 사용자를 위한 알림 권한 자동 요청
  useEffect(() => {
    const checkAndRequestNotificationPermission = async () => {
      // 이미 설정된 사용자는 스킵
      const hasRequestedBefore = localStorage.getItem('notificationPermissionRequested');
      if (hasRequestedBefore) {
        return;
      }

      if (isConnected && hasJoinedRef.current) {
        setTimeout(async () => {
          try {
            const granted = await requestNotificationPermission();
            localStorage.setItem('notificationPermissionRequested', 'true');
          } catch (error) {
            console.error('Failed to request notification permission:', error);
            localStorage.setItem('notificationPermissionRequested', 'true');
          }
        }, 3000);
      }
    };

    checkAndRequestNotificationPermission();
  }, [isConnected, requestNotificationPermission, notificationSettings.desktop]);

  // 컴포넌트 언마운트 시 정리 작업
  useEffect(() => {
    // 컴포넌트 마운트 시 unmounting 플래그 초기화
    isUnmountingRef.current = false;
    
    return () => {
      isUnmountingRef.current = true;
      
      // 안전하게 채팅방 나가기 시도
      if (hasJoinedRef.current && isConnected) {
        try {
          leaveChat(currentUser);
        } catch (error) {
          console.log('Error during cleanup leaveChat:', error);
        }
      }
    };
  }, [currentUser, leaveChat, isConnected]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 이미 전송 중이면 중복 실행 방지
    if (isSending || !newMessage.trim() || !isConnected || isUnmountingRef.current) {
      return;
    }
    
    setIsSending(true);
    
    try {
      stopTyping(currentUser);
      await sendMessage(newMessage.trim(), currentUser);
      setNewMessage('');
    } catch (error) {
        console.error('Failed to send message:', error);
        
        // 간단한 에러 토스트
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `
          <div style="
            position: fixed; 
            top: 80px; 
            left: 50%; 
            transform: translateX(-50%);
            background: #ef4444;
            color: white; 
            padding: 12px 20px; 
            border-radius: 12px; 
            box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
            z-index: 999999;
            max-width: 90%;
            text-align: center;
            font-weight: 500;
            font-size: 14px;
          ">
            😅 메시지 전송에 실패했어요! 다시 시도해주세요
          </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
          if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
          }
        }, 3000);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim() && isConnected && !isUnmountingRef.current && !isSending) {
        handleSendMessage(e as any);
      }
    }
  };

  const formatTime = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleLogout = async () => {
    try {
      if (hasJoinedRef.current && isConnected) {
        await leaveChat(currentUser);
      }
      
      // 로그아웃 직전에만 unmounting 플래그 설정
      isUnmountingRef.current = true;
      onLogout();
    } catch (error) {
      console.error('Failed to leave chat:', error);
      // 에러가 발생해도 로그아웃 진행
      isUnmountingRef.current = true;
      onLogout();
    }
  };

  const handleReconnect = () => {
    if (isUnmountingRef.current) return;
    
    reconnect();
    setShowReconnectAlert(false);
  };

  // 이모지 선택 함수
  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // 랜덤 애니메이션 클래스
  const getRandomAnimation = () => {
    const animations = ['animate-bounce', 'animate-pulse', 'animate-spin'];
    return animations[Math.floor(Math.random() * animations.length)];
  };



  // 사이드바 토글 함수
  const toggleSidebar = () => {
    if (showSidebar) {
      setSidebarAnimation('closing');
      setShowSidebar(false);
    } else {
      setSidebarAnimation('opening');
      setShowSidebar(true);
    }
    setTimeout(() => setSidebarAnimation('idle'), 300);
  };

  // 연결 상태에 따른 표시 텍스트와 색상 (개선된 버전)
  const getConnectionDisplay = () => {
    // isConnected와 connectionStatus를 모두 고려
    const isActuallyConnected = isConnected && connectionStatus === 'connected';
    
    if (isActuallyConnected) {
      return { 
        text: '연결됨', 
        color: 'bg-green-500', 
        bgColor: 'bg-green-100', 
        textColor: 'text-green-800',
        icon: '🟢',
        statusIcon: '📶'
      };
    }
    
    switch (connectionStatus) {
      case 'connecting':
        return { 
          text: '연결 중...', 
          color: 'bg-yellow-500', 
          bgColor: 'bg-yellow-100', 
          textColor: 'text-yellow-800',
          icon: '🟡',
          statusIcon: '⏳'
        };
      case 'connected':
        // isConnected가 false인 경우 - 상태 불일치
        return { 
          text: '상태 확인 중...', 
          color: 'bg-blue-500', 
          bgColor: 'bg-blue-100', 
          textColor: 'text-blue-800',
          icon: '🔵',
          statusIcon: '🔍'
        };
      case 'disconnected':
        return { 
          text: '연결 끊김', 
          color: 'bg-orange-500', 
          bgColor: 'bg-orange-100', 
          textColor: 'text-orange-800',
          icon: '🟠',
          statusIcon: '❌'
        };
      case 'failed':
        return { 
          text: '연결 실패', 
          color: 'bg-red-500', 
          bgColor: 'bg-red-100', 
          textColor: 'text-red-800',
          icon: '🔴',
          statusIcon: '💥'
        };
      default:
        return { 
          text: '초기화 중...', 
          color: 'bg-gray-500', 
          bgColor: 'bg-gray-100', 
          textColor: 'text-gray-800',
          icon: '⚪',
          statusIcon: '⚙️'
        };
    }
  };

  const connectionDisplay = getConnectionDisplay();


  return (
    <>
      
      <div 
        className={`flex mobile-chat-container lg:max-w-7xl lg:mx-auto lg:my-4 lg:rounded-3xl lg:shadow-2xl bg-gradient-to-br from-pink-200 via-purple-200 to-indigo-300 relative overflow-hidden lg:h-[calc(100vh-2rem)] ${calmMode ? 'calm-mode' : ''}`}
        style={{
          // Fix for iPhone viewport issues
          minHeight: '-webkit-fill-available',
          height: '-webkit-fill-available'
        }}
      >
      {/* 떠다니는 배경 요소들 - 반응형 크기 (집중모드에서는 축소) */}
      <div className={`absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-500 ${calmMode ? 'opacity-20' : 'opacity-100'}`}>
        <div className={`absolute top-10 left-10 text-2xl md:text-4xl lg:text-5xl ${calmMode ? '' : 'animate-bounce'}`}>🌟</div>
        <div className={`absolute top-20 right-20 text-xl md:text-3xl lg:text-4xl ${calmMode ? '' : 'animate-pulse'}`}>🎈</div>
        <div className={`absolute bottom-32 left-16 text-lg md:text-2xl lg:text-3xl ${calmMode ? '' : 'animate-bounce delay-300'}`}>🦄</div>
        <div className={`absolute bottom-20 right-32 text-xl md:text-3xl lg:text-4xl ${calmMode ? '' : 'animate-pulse delay-500'}`}>🌈</div>
        <div className={`absolute top-1/2 left-1/4 text-lg md:text-2xl lg:text-3xl ${calmMode ? '' : 'animate-spin'}`} style={{animationDuration: calmMode ? '0s' : '3s'}}>⭐</div>
        <div className={`absolute top-1/3 right-1/3 text-lg md:text-2xl lg:text-3xl ${calmMode ? '' : 'animate-bounce delay-700'}`}>✨</div>
      </div>

      {/* 재연결 알림 */}
      {showReconnectAlert && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4">
          <div className={`${connectionDisplay.bgColor} ${connectionDisplay.textColor} px-4 py-3 rounded-2xl shadow-2xl border-3 border-white max-w-sm animate-bounce`}>
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="font-bold text-sm">🚨 연결이 끊어졌어요!</span>
              <button
                onClick={handleReconnect}
                className="px-3 py-1 bg-gradient-to-r from-blue-400 to-purple-500 text-white rounded-full hover:from-blue-500 hover:to-purple-600 transition-all text-sm font-bold shadow-lg transform hover:scale-105"
              >
                🔄 재연결
              </button>
              <button
                onClick={() => setShowReconnectAlert(false)}
                className="px-2 py-1 text-current hover:opacity-70 rounded-full hover:bg-white/20"
              >
                ❌
              </button>
            </div>
            {retryCount > 0 && (
              <p className="text-xs mt-1">재시도 횟수: {retryCount}/5 ⏱️</p>
            )}
          </div>
        </div>
      )}

      {/* 모바일 사이드바 오버레이 - 향상된 애니메이션 */}
      {showSidebar && (
        <div 
          className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 ${
            sidebarAnimation === 'opening' ? 'animate-in fade-in' : 
            sidebarAnimation === 'closing' ? 'animate-out fade-out' : ''
          }`}
          onClick={() => {
            setSidebarAnimation('closing');
            setShowSidebar(false);
            setTimeout(() => setSidebarAnimation('idle'), 300);
          }}
        />
      )}


      {/* 사이드바 - 접속자 정보 (반응형 개선) */}
      <div 
        className={`
          ${showSidebar ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0 
          fixed md:static 
          top-0 left-0 
          w-80 md:w-64 lg:w-80 xl:w-96
          h-full 
          bg-gradient-to-b from-pink-100 via-purple-50 to-blue-100 backdrop-blur-sm 
          p-4 lg:p-6
          shadow-2xl 
          transition-all duration-300 ease-in-out 
          z-50 md:z-auto
          overflow-y-auto
          border-r-4 border-pink-300
          ${
            sidebarAnimation === 'opening' ? 'animate-in slide-in-from-left' :
            sidebarAnimation === 'closing' ? 'animate-out slide-out-to-left' : ''
          }
        `}
        style={{
          // Safe area padding for mobile
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          height: '-webkit-fill-available'
        }}
      >
        {/* 사이드바 헤더 */}
        <div className="flex items-center justify-between mb-6 md:block lg:mb-8">
          <div className="text-center">
            <h2 className="text-lg md:text-xl lg:text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent animate-pulse">
              🌟 친구들 🌟
            </h2>
            <div className="flex items-center justify-center mt-2 bg-white/50 rounded-full px-3 py-1">
              <span className="text-sm mr-1">{connectionDisplay.statusIcon}</span>
              <div className={`w-3 h-3 rounded-full ${connectionDisplay.color} animate-pulse`}></div>
              <span className={`text-xs ml-2 ${connectionDisplay.textColor} font-bold`}>
                {connectionDisplay.text}
              </span>
            </div>
            <div className="mt-3 bg-gradient-to-r from-pink-200 to-purple-200 rounded-2xl p-2 lg:p-3">
              <p className="font-bold text-purple-700 text-sm lg:text-base">
                🎉 총 {totalUserCount}명이 함께해요! 
                {totalUserCount === 1 ? '(나 혼자)' : `(친구 ${otherUsers.length}명 + 나)`} 🎉
              </p>
            </div>
          </div>
          {/* 모바일 닫기 버튼 - 향상된 접근성 */}
          <button
            onClick={() => {
              setSidebarAnimation('closing');
              setShowSidebar(false);
              setTimeout(() => setSidebarAnimation('idle'), 300);
            }}
            className="md:hidden mobile-touch-target p-4 bg-gradient-to-r from-red-400 to-pink-500 text-white rounded-full shadow-lg hover:from-red-500 hover:to-pink-600 transition-all transform hover:scale-110 active:scale-95 focus:ring-4 focus:ring-red-300 animate-pulse"
            aria-label="친구 목록 닫기"
          >
            <span className="text-lg">❌</span>
          </button>
        </div>
        
        <div className="space-y-3 mb-6 lg:space-y-4 lg:mb-8">
          {/* 현재 사용자 표시 */}
          <div className="flex items-center space-x-3 p-4 lg:p-5 bg-gradient-to-r from-yellow-200 to-orange-200 rounded-2xl border-3 border-yellow-400 shadow-lg transform hover:scale-105 transition-all duration-200">
            <div className="relative">
              <Image
                src={currentUser.avatar}
                alt={currentUser.name}
                width={40}
                height={40}
                className="rounded-full w-12 h-12 lg:w-14 lg:h-14 object-cover border-3 border-white shadow-md"
              />
              <div className="absolute -top-1 -right-1 text-lg animate-bounce">👑</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-purple-800 truncate text-sm lg:text-base">🌟 {currentUser.name} (나에요!) 🌟</p>
              <div className="flex items-center space-x-1 mt-1">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg"></div>
                <span className="text-xs text-green-700 font-bold">✨ 온라인 ✨</span>
              </div>
              <p className="text-xs text-purple-600 mt-1 font-medium">
                🕐 입장: {new Date(currentUser.joinedAt).toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>

          {/* 다른 접속자들 */}
          {otherUsers.map((user, index) => (
            <div 
              key={`${user.id}-${user.joinedAt}`} 
              className="flex items-center space-x-3 p-3 lg:p-4 bg-gradient-to-r from-pink-100 to-purple-100 rounded-2xl border-2 border-pink-200 shadow-md transform hover:scale-105 transition-all duration-200 hover:shadow-lg animate-in slide-in-from-left"
              style={{animationDelay: `${index * 0.1}s`}}
            >
              <div className="relative">
                <Image
                  src={user.avatar}
                  alt={user.name}
                  width={40}
                  height={40}
                  className="rounded-full w-10 h-10 lg:w-12 lg:h-12 object-cover border-2 border-white shadow-sm"
                />
                <div className="absolute -bottom-1 -right-1 text-sm">🎈</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-purple-700 truncate text-sm lg:text-base">🦄 {user.name}</p>
                <div className="flex items-center space-x-1 mt-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-600 font-medium">🌈 온라인</span>
                </div>
                {user.joinedAt && (
                  <p className="text-xs text-purple-500 mt-1">
                    ⏰ {new Date(user.joinedAt).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            </div>
          ))}

          {otherUsers.length === 0 && (
            <div className="text-center py-6 bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl border-2 border-dashed border-purple-300">
              <div className="text-4xl mb-2 animate-bounce">🌟</div>
              <p className="text-sm font-bold text-purple-700">나 혼자만 있어요!</p>
              <p className="text-xs mt-1 text-purple-600">친구들을 초대해서 함께 놀아요! 🎉✨</p>
              <div className="flex justify-center space-x-2 mt-2">
                <span className="animate-bounce delay-100">🎈</span>
                <span className="animate-bounce delay-200">🦄</span>
                <span className="animate-bounce delay-300">🌈</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 space-y-3 lg:mt-8 lg:space-y-4">
          {connectionStatus === 'failed' && (
            <button
              onClick={handleReconnect}
              className="w-full px-4 py-3 bg-gradient-to-r from-blue-400 to-purple-500 text-white font-bold rounded-2xl hover:from-blue-500 hover:to-purple-600 transition-all duration-200 shadow-xl transform hover:scale-105"
            >
              🔄 다시 연결하기! ✨
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 bg-gradient-to-r from-pink-400 to-red-400 text-white font-bold rounded-2xl hover:from-pink-500 hover:to-red-500 transition-all duration-200 shadow-xl transform hover:scale-105"
          >
            🚪 안녕히가세요! 👋
          </button>
        </div>
      </div>

      {/* 메인 채팅 영역 - 반응형 개선 */}
      <div className="flex-1 flex flex-col min-w-0 lg:max-w-none lg:h-full overflow-hidden">
        {/* 헤더 */}
        <div 
          className="flex-shrink-0 bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 backdrop-blur-sm p-3 md:p-4 lg:p-6 shadow-xl border-b-4 border-pink-300 relative"
          style={{
            paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
            paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
            zIndex: 999999
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="relative">
                <Image
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  width={40}
                  height={40}
                  className="rounded-full w-10 h-10 md:w-12 md:h-12 object-cover flex-shrink-0 border-3 border-white shadow-lg"
                />
                <div className="absolute -top-1 -right-1 text-sm animate-spin" style={{animationDuration: '2s'}}>⭐</div>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg md:text-2xl lg:text-3xl xl:text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent truncate">
                  🌈 소소 채팅방 🦄
                </h1>
                <p className="text-sm md:text-base lg:text-lg text-purple-600 truncate font-medium">
                  안녕하세요, {currentUser.name}님! 🎉✨
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2" style={{zIndex: 1000000}}>
              {/* Calm Mode Toggle for focused learning */}
              <button
                onClick={() => setCalmMode(!calmMode)}
                className={`mobile-touch-target p-2 md:p-3 rounded-xl font-bold text-xs md:text-sm transition-all transform hover:scale-105 active:scale-95 ${
                  calmMode 
                    ? 'bg-blue-500 text-white shadow-lg' 
                    : 'bg-white/70 text-purple-600 hover:bg-white/90'
                }`}
                title={calmMode ? '집중모드 끄기' : '집중모드 켜기'}
              >
                {calmMode ? '😌 집중중' : '🎪 애니메이션'}
              </button>
              
              {/* 알림 설정 */}
              <NotificationSettings
                settings={notificationSettings}
                onUpdateSettings={updateNotificationSettings}
                onRequestPermission={requestNotificationPermission}
              />
            </div>
          </div>
        </div>

        {/* 메시지 영역 - 반응형 개선 */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 p-3 md:p-4 lg:p-6 xl:p-8 mobile-chat-messages space-y-3 md:space-y-4 lg:space-y-6 relative overflow-y-auto"
          style={{
            scrollBehavior: 'smooth',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch', // iOS 모바일 스크롤 최적화
            scrollbarWidth: 'thin', // Firefox에서 스크롤바 얇게
            scrollbarColor: '#ec4899 transparent' // Firefox 스크롤바 색상
          }}
        >
          {/* 배경 패턴 - 반응형 크기 */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div className="absolute top-10 left-10 text-4xl md:text-6xl lg:text-8xl">🌟</div>
            <div className="absolute top-32 right-16 text-2xl md:text-4xl lg:text-6xl">🎈</div>
            <div className="absolute bottom-20 left-20 text-3xl md:text-5xl lg:text-7xl">🦄</div>
            <div className="absolute bottom-40 right-12 text-xl md:text-3xl lg:text-5xl">🌈</div>
          </div>

          {messages.length === 0 && (
            <div className="text-center text-purple-500 mt-8 lg:mt-12 bg-gradient-to-r from-pink-100 to-purple-100 rounded-2xl p-6 lg:p-8 xl:p-10 border-2 border-dashed border-purple-300 relative z-1">
              <div className="text-4xl md:text-6xl lg:text-8xl mb-4 animate-bounce">🎉</div>
              <p className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold text-purple-700">첫 번째 메시지를 보내보세요!</p>
              <p className="text-sm md:text-base lg:text-lg mt-2 text-purple-600">친구들과 재미있게 대화해요! 🌈✨</p>
              <div className="flex justify-center space-x-3 lg:space-x-4 mt-4">
                <span className="text-2xl lg:text-3xl xl:text-4xl animate-bounce delay-100">🎈</span>
                <span className="text-2xl lg:text-3xl xl:text-4xl animate-bounce delay-200">🦄</span>
                <span className="text-2xl lg:text-3xl xl:text-4xl animate-bounce delay-300">🌟</span>
                <span className="text-2xl lg:text-3xl xl:text-4xl animate-bounce delay-400">🎊</span>
              </div>
            </div>
          )}
          {messages.map((message) => {
            // 시스템 메시지인 경우 중앙 정렬로 표시
            if (message.isSystemMessage || message.userId === 'system') {
              return (
                <div key={message.id} className="flex justify-center">
                  <div className="bg-gradient-to-r from-purple-200 to-pink-200 text-purple-700 px-4 py-2 lg:px-6 lg:py-3 rounded-full text-sm lg:text-base font-medium border border-purple-300 shadow-sm max-w-xs lg:max-w-md text-center">
                    {message.text}
                  </div>
                </div>
              );
            }

            // 일반 메시지 표시
            return (
              <div
                key={message.id}
                className={`flex ${message.userId === currentUser.id ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-end space-x-2 max-w-[85%] md:max-w-[70%] lg:max-w-[60%] xl:max-w-[50%] ${message.userId === currentUser.id ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <Image
                    src={message.userAvatar}
                    alt={message.userName}
                    width={35}
                    height={35}
                    className="rounded-full w-8 h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 object-cover flex-shrink-0"
                  />
                  <div className={`chat-bubble text-sm md:text-base lg:text-lg ${message.userId === currentUser.id ? 'sent' : 'received'}`}>
                    <p className="text-xs md:text-sm lg:text-base font-bold mb-1">{message.userName}</p>
                    <p className="break-words">{message.text}</p>
                    <p className="text-xs lg:text-sm opacity-70 mt-1">{formatTime(message.timestamp)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* 타이핑 표시기 */}
          <TypingIndicator 
            typingUsers={typingUsers} 
            showTyping={notificationSettings.typing}
            currentUserId={currentUser.id}
          />
          
          <div ref={messagesEndRef} />
          
          {/* 스크롤 하단 버튼 */}
          {showScrollToBottom && (
            <button
              onClick={() => scrollToBottom(true)}
              className="fixed bottom-24 right-6 z-50 bg-gradient-to-r from-pink-400 to-purple-500 text-white p-3 rounded-full shadow-2xl hover:from-pink-500 hover:to-purple-600 transition-all duration-200 transform hover:scale-110 active:scale-95 animate-bounce"
              style={{
                bottom: 'max(6rem, calc(env(safe-area-inset-bottom) + 6rem))'
              }}
              aria-label="최신 메시지로 이동"
            >
              <div className="relative">
                <span className="text-xl">⬇️</span>
                {unreadCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center font-bold animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </div>
                )}
              </div>
            </button>
          )}
        </div>

        {/* 이모지 선택기 */}
        {showEmojiPicker && (
          <div 
            className="flex-shrink-0 bg-gradient-to-r from-pink-100 to-purple-100 p-3 border-t-2 border-pink-300"
            style={{
              paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
              paddingRight: 'max(0.75rem, env(safe-area-inset-right))'
            }}
          >
            <div className="grid grid-cols-8 gap-2 max-h-32 overflow-y-auto -webkit-overflow-scrolling-touch">
              {popularEmojis.map((emoji, index) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="mobile-touch-target text-2xl p-2 rounded-xl hover:bg-white/70 transition-all transform hover:scale-110 active:scale-95"
                  style={{animationDelay: `${index * 0.05}s`}}
                  aria-label={`이모지 ${emoji} 선택`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        
        {/* 메시지 입력 - 반응형 개선 */}
        <div 
          className="flex-shrink-0 bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 p-3 md:p-4 lg:p-6 shadow-xl border-t-4 border-pink-300 mobile-input-area"
          style={{
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
            paddingRight: 'max(0.75rem, env(safe-area-inset-right))'
          }}
        >
          {/* 간단한 글자수 표시 */}
          {newMessage.length > 70 && (
            <div className="mb-2 text-xs text-purple-600 text-center">
              {100 - newMessage.length}글자 남음 ✨
            </div>
          )}
          <form onSubmit={handleSendMessage} className="flex space-x-2 md:space-x-3 lg:space-x-4">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="mobile-touch-target p-3 lg:p-4 text-2xl lg:text-3xl hover:bg-pink-200 rounded-2xl transition-all transform hover:scale-110 active:scale-95 flex-shrink-0"
              disabled={!isConnected}
              aria-label={showEmojiPicker ? '이모지 선택기 닫기' : '이모지 선택기 열기'}
            >
              {showEmojiPicker ? '🎭' : '😊'}
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                const newValue = e.target.value;
                const hasContent = newValue.trim().length > 0;
                
                setNewMessage(newValue);
                
                if (hasContent && !isAtBottom && messages.length > 0) {
                  requestAnimationFrame(() => {
                    scrollToBottom(true);
                  });
                }
                
                if (hasContent && isConnected) {
                  startTyping(currentUser);
                } else if (!hasContent) {
                  stopTyping(currentUser);
                }
              }}
              onKeyPress={handleKeyPress}
              onBlur={() => stopTyping(currentUser)}
              placeholder={isConnected ? "재미있는 메시지를 써보세요! 🎉" : "연결을 기다리는 중... 🔄"}
              className="flex-1 px-3 md:px-4 lg:px-6 py-3 md:py-4 lg:py-5 rounded-2xl border-3 border-pink-300 focus:border-purple-400 focus:outline-none font-medium disabled:opacity-50 text-base lg:text-lg bg-white/80 placeholder-purple-400 mobile-input-area"
              style={{ fontSize: '16px' }} // Prevents zoom on iOS
              maxLength={100}
              disabled={!isConnected || isSending}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || !isConnected || isSending}
              className="mobile-touch-target px-4 md:px-6 lg:px-8 py-3 md:py-4 lg:py-5 bg-gradient-to-r from-pink-400 to-purple-500 text-white font-bold rounded-2xl hover:from-pink-500 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm md:text-base lg:text-lg flex-shrink-0 shadow-lg transform hover:scale-105 active:scale-95"
              aria-label="메시지 보내기"
            >
              {isSending ? (
                <>
                  <span className="hidden sm:inline">전송중... ⏳</span>
                  <span className="sm:hidden">⏳</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">보내기! 🚀</span>
                  <span className="sm:hidden">🚀</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
    </>
  );
}
