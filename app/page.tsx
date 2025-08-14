// app/page.tsx
'use client';

import { useState, useCallback } from 'react';
import AvatarSelector from '@/components/AvatarSelector';
import NameInput from '@/components/NameInput';
import ChatRoom from '@/components/ChatRoom';
import { PusherProvider } from '@/contexts/PusherContext';
import { User } from '@/types/chat';

export default function Home() {
  const [step, setStep] = useState<'avatar' | 'name' | 'chat'>('avatar');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const handleAvatarSelect = (avatar: string) => {
    setSelectedAvatar(avatar);
    setStep('name');
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
  };

  const handleLogout = useCallback(() => {
    // 사용자 상태 완전 초기화
    setCurrentUser(null);
    setSelectedAvatar('');
    setStep('avatar');
  }, []);

  if (step === 'avatar') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-6xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-white mb-4 drop-shadow-lg animate-bounce-gentle">
              🎉 소소 채팅방에 오신 것을 환영합니다! 🎉
            </h1>
            <p className="text-xl text-white/90 drop-shadow-lg">
              귀여운 캐릭터들과 함께 즐거운 대화를 나누어보세요!
            </p>
          </div>
          <AvatarSelector onAvatarSelect={handleAvatarSelect} />
        </div>
      </div>
    );
  }

  if (step === 'name') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">
              🎯 마지막 단계입니다! 🎯
            </h1>
            <p className="text-lg text-white/90 drop-shadow-lg">
              선택한 캐릭터: {selectedAvatar.split('/').pop()?.replace('.jpg', '')}
            </p>
          </div>
          <NameInput onNameSubmit={handleNameSubmit} />
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
