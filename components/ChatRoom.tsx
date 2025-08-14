// components/ChatRoom.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { User, Message, ConnectionStatus } from '@/types/chat';
import { usePusherContext } from '@/contexts/PusherContext';

interface ChatRoomProps {
  currentUser: User;
  onLogout: () => void;
}

export default function ChatRoom({ currentUser, onLogout }: ChatRoomProps) {
  const [newMessage, setNewMessage] = useState('');
  const [showReconnectAlert, setShowReconnectAlert] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasJoinedRef = useRef(false);
  const isUnmountingRef = useRef(false);
  
  // 터치 이벤트용 상태
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [sidebarAnimation, setSidebarAnimation] = useState<'idle' | 'opening' | 'closing'>('idle');
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [lastInteraction, setLastInteraction] = useState(Date.now());

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
    sendMessage, 
    joinChat, 
    leaveChat, 
    reconnect,
    retryCount,
    cleanupPusher,
    getConnectionState,
    getCurrentTransport
  } = usePusherContext();

  // 현재 사용자를 제외한 다른 사용자들만 필터링
  const otherUsers = onlineUsers.filter(user => user.id !== currentUser.id);
  // 전체 사용자 수 (자신 + 다른 사용자들)
  const totalUserCount = otherUsers.length + 1;

  // 메시지 상태 디버깅
  useEffect(() => {
    console.log('📝 Messages updated:', messages);
    console.log('📊 Messages count:', messages.length);
  }, [messages]);

  // 사용자 상태 디버깅
  useEffect(() => {
    console.log('👥 User state updated:');
    console.log('  - Current user:', currentUser.id, currentUser.name);
    console.log('  - Online users (raw):', onlineUsers.map(u => ({ id: u.id, name: u.name })));
    console.log('  - Other users (filtered):', otherUsers.map(u => ({ id: u.id, name: u.name })));
    console.log('  - Total count:', totalUserCount);
    console.log('  - Other count:', otherUsers.length);
  }, [onlineUsers, currentUser, otherUsers, totalUserCount]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isConnected && !hasJoinedRef.current && !isUnmountingRef.current) {
      const attemptJoin = async () => {
        try {
          hasJoinedRef.current = true;
          await joinChat(currentUser);
          console.log('Successfully joined chat');
        } catch (error) {
          console.error('Failed to join chat:', error);
          hasJoinedRef.current = false;
          
          // 3초 후 재시도
          setTimeout(() => {
            if (isConnected && !hasJoinedRef.current && !isUnmountingRef.current) {
              console.log('Retrying to join chat...');
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
    if (newMessage.trim() && isConnected && !isUnmountingRef.current) {
      try {
        console.log('🚀 Sending message:', newMessage.trim());
        console.log('👤 Current user:', currentUser);
        console.log('🔗 Is connected:', isConnected);
        await sendMessage(newMessage.trim(), currentUser);
        setNewMessage('');
        console.log('✅ Message sent successfully');
      } catch (error) {
        console.error('❌ Failed to send message:', error);
        // 사용자에게 에러 알림을 표시할 수 있습니다
      }
    } else {
      console.log('⚠️ Message send blocked:', {
        hasMessage: !!newMessage.trim(),
        isConnected,
        isUnmounting: isUnmountingRef.current
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (newMessage.trim() && isConnected && !isUnmountingRef.current) {
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

  // 향상된 터치 스와이프 처리
  const minSwipeDistance = 50;
  const maxSwipeTime = 300; // 최대 스와이프 시간 (ms)
  const swipeStartTime = useRef<number>(0);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    swipeStartTime.current = Date.now();
    setLastInteraction(Date.now());
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const swipeTime = Date.now() - swipeStartTime.current;
    const swipeVelocity = Math.abs(distance) / swipeTime;
    
    // 빠른 스와이프이거나 충분한 거리를 스와이프한 경우
    const isValidSwipe = swipeTime < maxSwipeTime && (Math.abs(distance) > minSwipeDistance || swipeVelocity > 0.3);
    
    if (isValidSwipe) {
      const isLeftSwipe = distance > minSwipeDistance;
      const isRightSwipe = distance < -minSwipeDistance;

      if (isRightSwipe && !showSidebar) {
        setSidebarAnimation('opening');
        setShowSidebar(true);
        setShowSwipeHint(false);
        setTimeout(() => setSidebarAnimation('idle'), 300);
      }
      if (isLeftSwipe && showSidebar) {
        setSidebarAnimation('closing');
        setShowSidebar(false);
        setTimeout(() => setSidebarAnimation('idle'), 300);
      }
    }
  };

  // 스와이프 힌트 자동 숨기기
  useEffect(() => {
    const timer = setTimeout(() => {
      if (Date.now() - lastInteraction > 10000) { // 10초 후
        setShowSwipeHint(false);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [lastInteraction]);

  // 사이드바 토글 함수
  const toggleSidebar = () => {
    setLastInteraction(Date.now());
    if (showSidebar) {
      setSidebarAnimation('closing');
      setShowSidebar(false);
    } else {
      setSidebarAnimation('opening');
      setShowSidebar(true);
      setShowSwipeHint(false);
    }
    setTimeout(() => setSidebarAnimation('idle'), 300);
  };

  // 연결 상태에 따른 표시 텍스트와 색상
  const getConnectionDisplay = () => {
    switch (connectionStatus) {
      case 'connecting':
        return { text: '연결 중...', color: 'bg-yellow-500', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' };
      case 'connected':
        return { text: '연결됨', color: 'bg-green-500', bgColor: 'bg-green-100', textColor: 'text-green-800' };
      case 'disconnected':
        return { text: '연결 끊김', color: 'bg-orange-500', bgColor: 'bg-orange-100', textColor: 'text-orange-800' };
      case 'failed':
        return { text: '연결 실패', color: 'bg-red-500', bgColor: 'bg-red-100', textColor: 'text-red-800' };
      default:
        return { text: '연결 중...', color: 'bg-gray-500', bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
    }
  };

  const connectionDisplay = getConnectionDisplay();

  return (
    <div 
      className="flex h-screen bg-gradient-to-br from-pink-200 via-purple-200 to-indigo-300 relative overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* 떠다니는 배경 요소들 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 text-4xl animate-bounce">🌟</div>
        <div className="absolute top-20 right-20 text-3xl animate-pulse">🎈</div>
        <div className="absolute bottom-32 left-16 text-2xl animate-bounce delay-300">🦄</div>
        <div className="absolute bottom-20 right-32 text-3xl animate-pulse delay-500">🌈</div>
        <div className="absolute top-1/2 left-1/4 text-2xl animate-spin" style={{animationDuration: '3s'}}>⭐</div>
        <div className="absolute top-1/3 right-1/3 text-2xl animate-bounce delay-700">✨</div>
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

      {/* 모바일 전용 플로팅 사이드바 토글 버튼들 - 향상된 UX */}
      <div className="md:hidden">
        {!showSidebar && (
          <>
            {/* 상단 플로팅 버튼 - 향상된 접근성 */}
            <button
              onClick={toggleSidebar}
              className="fixed top-20 left-4 z-30 p-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white rounded-full shadow-2xl hover:from-pink-500 hover:to-purple-600 transition-all duration-300 transform hover:scale-110 animate-pulse active:scale-95 focus:ring-4 focus:ring-pink-300"
              aria-label={`친구 목록 열기 (총 ${totalUserCount}명 온라인)`}
            >
              <div className="flex items-center space-x-1">
                <span className="text-lg">👥</span>
                <span className="text-xs font-bold bg-white/20 rounded-full px-1.5 py-0.5">
                  {totalUserCount}
                </span>
              </div>
            </button>

            {/* 사이드 엣지 스와이프 인디케이터 */}
            <div className="fixed left-0 top-1/2 -translate-y-1/2 z-30">
              <div className="w-1 h-16 bg-gradient-to-b from-pink-400 to-purple-500 rounded-r-full animate-pulse opacity-70" />
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 text-xs rotate-90 text-pink-500 font-bold">
                ←
              </div>
            </div>

            {/* 하단 슬라이드 힌트 - 조건부 표시 */}
            {showSwipeHint && (
              <div className="fixed bottom-20 left-0 right-0 z-30 px-4 animate-in slide-in-from-bottom duration-500">
                <button
                  onClick={toggleSidebar}
                  className="w-full bg-gradient-to-r from-pink-300/90 to-purple-300/90 backdrop-blur-md text-purple-700 py-4 px-4 rounded-2xl shadow-lg border-2 border-white/30 transition-all duration-300 transform hover:scale-105 active:scale-95 relative overflow-hidden"
                  aria-label="친구 목록 열기"
                >
                  {/* 배경 반짝임 효과 */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                  
                  <div className="flex items-center justify-center space-x-2 relative z-10">
                    <span className="text-sm animate-bounce delay-100">👈</span>
                    <div className="text-center">
                      <div className="text-xs font-bold mb-1">오른쪽으로 밀어서 친구 목록 보기</div>
                      <div className="text-xs text-purple-600 flex items-center justify-center space-x-1">
                        <span>또는 여기를 터치하세요!</span>
                        <span className="animate-bounce">🎈</span>
                      </div>
                    </div>
                    <span className="text-sm animate-bounce delay-200">🌟</span>
                  </div>
                  
                  {/* 닫기 버튼 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSwipeHint(false);
                    }}
                    className="absolute top-2 right-2 w-6 h-6 bg-white/80 rounded-full flex items-center justify-center text-purple-600 hover:bg-white transition-colors text-xs"
                    aria-label="힌트 닫기"
                  >
                    ×
                  </button>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 사이드바 - 접속자 정보 (향상된 애니메이션) */}
      <div className={`
        ${showSidebar ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 
        fixed md:static 
        top-0 left-0 
        w-80 md:w-64 
        h-full 
        bg-gradient-to-b from-pink-100 via-purple-50 to-blue-100 backdrop-blur-sm 
        p-4 
        shadow-2xl 
        transition-all duration-300 ease-in-out 
        z-50 md:z-auto
        overflow-y-auto
        border-r-4 border-pink-300
        ${
          sidebarAnimation === 'opening' ? 'animate-in slide-in-from-left' :
          sidebarAnimation === 'closing' ? 'animate-out slide-out-to-left' : ''
        }
      `}>
        {/* 사이드바 헤더 */}
        <div className="flex items-center justify-between mb-6 md:block">
          <div className="text-center">
            <h2 className="text-lg md:text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent animate-pulse">
              🌟 친구들 🌟
            </h2>
            <div className="flex items-center justify-center mt-2 bg-white/50 rounded-full px-3 py-1">
              <div className={`w-3 h-3 rounded-full ${connectionDisplay.color} animate-pulse`}></div>
              <span className={`text-xs ml-2 ${connectionDisplay.textColor} font-bold`}>
                {connectionDisplay.text}
              </span>
            </div>
            <div className="mt-3 bg-gradient-to-r from-pink-200 to-purple-200 rounded-2xl p-2">
              <p className="font-bold text-purple-700 text-sm">
                🎉 총 {totalUserCount}명이 함께해요! 
                {otherUsers.length > 0 ? `(친구 ${otherUsers.length}명 + 나)` : '(나 혼자)'} 🎉
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
            className="md:hidden p-3 bg-gradient-to-r from-red-400 to-pink-500 text-white rounded-full shadow-lg hover:from-red-500 hover:to-pink-600 transition-all transform hover:scale-110 active:scale-95 focus:ring-4 focus:ring-red-300 animate-pulse"
            aria-label="친구 목록 닫기"
          >
            <span className="text-lg">❌</span>
          </button>
        </div>
        
        <div className="space-y-3 mb-6">
          {/* 현재 사용자 표시 */}
          <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-yellow-200 to-orange-200 rounded-2xl border-3 border-yellow-400 shadow-lg transform hover:scale-105 transition-all duration-200">
            <div className="relative">
              <Image
                src={currentUser.avatar}
                alt={currentUser.name}
                width={40}
                height={40}
                className="rounded-full w-12 h-12 object-cover border-3 border-white shadow-md"
              />
              <div className="absolute -top-1 -right-1 text-lg animate-bounce">👑</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-purple-800 truncate text-sm">🌟 {currentUser.name} (나에요!) 🌟</p>
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
              className="flex items-center space-x-3 p-3 bg-gradient-to-r from-pink-100 to-purple-100 rounded-2xl border-2 border-pink-200 shadow-md transform hover:scale-105 transition-all duration-200 hover:shadow-lg animate-in slide-in-from-left"
              style={{animationDelay: `${index * 0.1}s`}}
            >
              <div className="relative">
                <Image
                  src={user.avatar}
                  alt={user.name}
                  width={40}
                  height={40}
                  className="rounded-full w-10 h-10 object-cover border-2 border-white shadow-sm"
                />
                <div className="absolute -bottom-1 -right-1 text-sm">🎈</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-purple-700 truncate text-sm">🦄 {user.name}</p>
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

        <div className="mt-6 space-y-3">
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

      {/* 메인 채팅 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 backdrop-blur-sm p-3 md:p-4 shadow-xl border-b-4 border-pink-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              {/* 모바일 메뉴 버튼 - 향상된 UX */}
              <button
                onClick={toggleSidebar}
                className="md:hidden p-2 text-pink-600 hover:text-pink-800 rounded-2xl hover:bg-pink-200 transition-all transform hover:scale-110 active:scale-95 focus:ring-4 focus:ring-pink-300 relative"
                aria-label={showSidebar ? '친구 목록 닫기' : '친구 목록 열기'}
              >
                <div className="text-2xl relative">
                  🎈
                  {otherUsers.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-xs text-white font-bold">{otherUsers.length}</span>
                    </div>
                  )}
                </div>
              </button>
              
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
                <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent truncate">
                  🌈 소소 채팅방 🦄
                </h1>
                <p className="text-sm md:text-base text-purple-600 truncate font-medium">
                  안녕하세요, {currentUser.name}님! 🎉✨
                </p>
              </div>
            </div>

            {/* 접속자 수 표시 (모바일용) */}
            <div className="md:hidden flex items-center space-x-1 bg-gradient-to-r from-yellow-200 to-pink-200 px-3 py-2 rounded-full border-2 border-pink-300 shadow-lg">
              <div className={`w-3 h-3 rounded-full ${connectionDisplay.color} animate-pulse`}></div>
              <span className="text-xs font-bold text-purple-700">
                👥 {totalUserCount}명 {otherUsers.length > 0 ? `(+${otherUsers.length})` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div className="flex-1 p-3 md:p-4 overflow-y-auto space-y-3 md:space-y-4 relative">
          {/* 배경 패턴 */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <div className="absolute top-10 left-10 text-6xl">🌟</div>
            <div className="absolute top-32 right-16 text-4xl">🎈</div>
            <div className="absolute bottom-20 left-20 text-5xl">🦄</div>
            <div className="absolute bottom-40 right-12 text-3xl">🌈</div>
          </div>

          {messages.length === 0 && (
            <div className="text-center text-purple-500 mt-8 bg-gradient-to-r from-pink-100 to-purple-100 rounded-2xl p-6 border-2 border-dashed border-purple-300">
              <div className="text-6xl mb-4 animate-bounce">🎉</div>
              <p className="text-lg font-bold text-purple-700">첫 번째 메시지를 보내보세요!</p>
              <p className="text-sm mt-2 text-purple-600">친구들과 재미있게 대화해요! 🌈✨</p>
              <div className="flex justify-center space-x-3 mt-4">
                <span className="text-2xl animate-bounce delay-100">🎈</span>
                <span className="text-2xl animate-bounce delay-200">🦄</span>
                <span className="text-2xl animate-bounce delay-300">🌟</span>
                <span className="text-2xl animate-bounce delay-400">🎊</span>
              </div>
            </div>
          )}
          {messages.map((message) => {
            // 시스템 메시지인 경우 중앙 정렬로 표시
            if (message.isSystemMessage || message.userId === 'system') {
              return (
                <div key={message.id} className="flex justify-center">
                  <div className="bg-gradient-to-r from-purple-200 to-pink-200 text-purple-700 px-4 py-2 rounded-full text-sm font-medium border border-purple-300 shadow-sm max-w-xs text-center">
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
                <div className={`flex items-end space-x-2 max-w-[85%] md:max-w-[70%] ${message.userId === currentUser.id ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <Image
                    src={message.userAvatar}
                    alt={message.userName}
                    width={35}
                    height={35}
                    className="rounded-full w-8 h-8 md:w-9 md:h-9 object-cover flex-shrink-0"
                  />
                  <div className={`chat-bubble text-sm md:text-base ${message.userId === currentUser.id ? 'sent' : 'received'}`}>
                    <p className="text-xs md:text-sm font-bold mb-1">{message.userName}</p>
                    <p className="break-words">{message.text}</p>
                    <p className="text-xs opacity-70 mt-1">{formatTime(message.timestamp)}</p>
                  </div>
                </div>
              </div>
            );
          })}
          
          <div ref={messagesEndRef} />
        </div>

        {/* 이모지 선택기 */}
        {showEmojiPicker && (
          <div className="bg-gradient-to-r from-pink-100 to-purple-100 p-3 border-t-2 border-pink-300">
            <div className="grid grid-cols-8 gap-2 max-h-32 overflow-y-auto">
              {popularEmojis.map((emoji, index) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="text-2xl p-2 rounded-xl hover:bg-white/70 transition-all transform hover:scale-110 active:scale-95"
                  style={{animationDelay: `${index * 0.05}s`}}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 메시지 입력 */}
        <div className="bg-gradient-to-r from-pink-100 via-purple-100 to-blue-100 p-3 md:p-4 shadow-xl border-t-4 border-pink-300">
          <form onSubmit={handleSendMessage} className="flex space-x-2 md:space-x-3">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 md:p-3 text-2xl hover:bg-pink-200 rounded-2xl transition-all transform hover:scale-110 active:scale-95 flex-shrink-0"
              disabled={!isConnected}
            >
              {showEmojiPicker ? '🎭' : '😊'}
            </button>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isConnected ? "재미있는 메시지를 써보세요! 🎉" : "연결을 기다리는 중... 🔄"}
              className="flex-1 px-3 md:px-4 py-2 md:py-3 rounded-2xl border-3 border-pink-300 focus:border-purple-400 focus:outline-none font-medium disabled:opacity-50 text-sm md:text-base bg-white/80 placeholder-purple-400"
              maxLength={200}
              disabled={!isConnected}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || !isConnected}
              className="px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-pink-400 to-purple-500 text-white font-bold rounded-2xl hover:from-pink-500 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm md:text-base flex-shrink-0 shadow-lg transform hover:scale-105 active:scale-95"
            >
              <span className="hidden sm:inline">보내기! 🚀</span>
              <span className="sm:hidden">🚀</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
