// app/page.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import AvatarSelector from '@/components/AvatarSelector';
import NameInput from '@/components/NameInput';
import ChatRoom from '@/components/ChatRoom';
import { PusherProvider } from '@/contexts/PusherContext';
import { User } from '@/types/chat';

// 사용자 세션 저장 키
const USER_SESSION_KEY = 'soso-chat-user-session';
const SESSION_EXPIRY_HOURS = 24; // 24시간 후 만료

interface UserSession {
  user: User;
  step: 'avatar' | 'name' | 'chat';
  selectedAvatar: string;
  timestamp: number;
  expiresAt: number;
}

export default function Home() {
  const [step, setStep] = useState<'avatar' | 'name' | 'chat'>('avatar');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 세션 저장 함수
  const saveUserSession = useCallback((user: User | null, currentStep: 'avatar' | 'name' | 'chat', avatar: string = '') => {
    if (!user && currentStep === 'avatar') {
      // 로그아웃이나 초기 상태면 세션 삭제
      localStorage.removeItem(USER_SESSION_KEY);
      return;
    }

    if (user) {
      const session: UserSession = {
        user,
        step: currentStep,
        selectedAvatar: avatar,
        timestamp: Date.now(),
        expiresAt: Date.now() + (SESSION_EXPIRY_HOURS * 60 * 60 * 1000)
      };

      try {
        localStorage.setItem(USER_SESSION_KEY, JSON.stringify(session));
        console.log('💾 User session saved:', {
          user: user.name,
          step: currentStep,
          expiresIn: Math.round((session.expiresAt - Date.now()) / (60 * 60 * 1000)) + 'h'
        });
      } catch (error) {
        console.warn('Failed to save user session:', error);
      }
    }
  }, []);

  // 세션 복구 함수
  const restoreUserSession = useCallback(() => {
    try {
      const stored = localStorage.getItem(USER_SESSION_KEY);
      if (!stored) {
        setIsLoading(false);
        return;
      }

      const session: UserSession = JSON.parse(stored);
      const now = Date.now();

      // 만료 확인
      if (now > session.expiresAt) {
        console.log('🕐 User session expired, removing...');
        localStorage.removeItem(USER_SESSION_KEY);
        setIsLoading(false);
        return;
      }

      // 세션이 유효하면 상태 복구
      console.log('🔄 Restoring user session:', {
        user: session.user.name,
        step: session.step,
        timeRemaining: Math.round((session.expiresAt - now) / (60 * 60 * 1000)) + 'h',
        backgroundDuration: Math.round((now - session.timestamp) / 1000) + 's'
      });

      setCurrentUser(session.user);
      setSelectedAvatar(session.selectedAvatar);
      setStep(session.step);

    } catch (error) {
      console.warn('Failed to restore user session:', error);
      localStorage.removeItem(USER_SESSION_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 컴포넌트 마운트 시 세션 복구
  useEffect(() => {
    restoreUserSession();
  }, [restoreUserSession]);

  const handleAvatarSelect = (avatar: string) => {
    setSelectedAvatar(avatar);
    setStep('name');
    // 아바타 선택 단계에서는 세션 저장하지 않음 (완료되지 않은 상태)
  };

  const handleNameSubmit = (name: string) => {
    // 더 안정적인 사용자 ID 생성 (이름 + 타임스탬프 + 랜덤값)
    const userId = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const user: User = {
      id: userId,
      name,
      avatar: selectedAvatar,
      isOnline: true,
      joinedAt: new Date().toISOString(),
    };
    setCurrentUser(user);
    setStep('chat');
    
    // 채팅 진입 시 세션 저장
    saveUserSession(user, 'chat', selectedAvatar);
  };

  const handleLogout = useCallback(() => {
    // 사용자 상태 완전 초기화
    setCurrentUser(null);
    setSelectedAvatar('');
    setStep('avatar');
    
    // 세션 삭제
    saveUserSession(null, 'avatar');
  }, [saveUserSession]);

  if (step === 'avatar') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 lg:p-8">
        <div className="max-w-6xl w-full lg:max-w-7xl xl:max-w-none">
          <div className="text-center mb-8 lg:mb-12">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 drop-shadow-lg animate-bounce-gentle">
              🎮 소소 채팅방에 온 걸 환영해요! 🌟
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl text-white/90 drop-shadow-lg">
              친구들과 재미있게 이야기하는 곳이에요! 😊
            </p>
            <div className="mt-4 bg-white/20 backdrop-blur-sm rounded-2xl p-4 max-w-md mx-auto">
              <p className="text-white/90 text-sm md:text-base">
                💡 첫 번째 단계: 마음에 드는 캐릭터를 골라주세요!
              </p>
            </div>
          </div>
          <AvatarSelector onAvatarSelect={handleAvatarSelect} />
        </div>
      </div>
    );
  }

  if (step === 'name') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 lg:p-8">
        <div className="max-w-2xl w-full lg:max-w-4xl">
          <div className="text-center mb-8 lg:mb-12">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 drop-shadow-lg">
              🎯 거의 다 왔어요! 🎯
            </h1>
            <p className="text-base md:text-lg lg:text-xl text-white/90 drop-shadow-lg">
              선택한 친구: {selectedAvatar.split('/').pop()?.replace('.jpg', '')} ✨
            </p>
            <div className="mt-4 bg-white/20 backdrop-blur-sm rounded-2xl p-4 max-w-md mx-auto">
              <p className="text-white/90 text-sm md:text-base">
                💡 두 번째 단계: 멋진 이름을 정해주세요!
              </p>
            </div>
          </div>
          <NameInput onNameSubmit={handleNameSubmit} />
        </div>
      </div>
    );
  }

  // 로딩 상태 표시
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">세션을 복구하는 중...</p>
          <p className="text-white/70 text-sm mt-2">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  if (step === 'chat' && currentUser) {
    return (
      <PusherProvider>
        <ChatRoom currentUser={currentUser} onLogout={handleLogout} />
      </PusherProvider>
    );
  }

  return null;
}
