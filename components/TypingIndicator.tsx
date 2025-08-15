'use client';

import { TypingUser } from '@/types/chat';

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
  showTyping: boolean;
  currentUserId?: string;
}

export const TypingIndicator = ({ typingUsers, showTyping, currentUserId }: TypingIndicatorProps) => {
  // 자신을 제외한 타이핑 중인 사용자들만 필터링
  const otherTypingUsers = typingUsers.filter(user => user.id !== currentUserId);

  console.log('👀 TypingIndicator render:', {
    totalTypingUsersCount: typingUsers.length,
    otherTypingUsersCount: otherTypingUsers.length,
    allTypingUsers: typingUsers.map(u => ({ id: u.id, name: u.name })),
    otherTypingUsers: otherTypingUsers.map(u => ({ id: u.id, name: u.name })),
    currentUserId,
    showTypingSetting: showTyping
  });

  if (!showTyping) {
    console.log('❌ Typing display is disabled in settings');
    return null;
  }

  if (otherTypingUsers.length === 0) {
    console.log('❌ No other users typing, not rendering indicator');
    return null;
  }

  const getTypingText = () => {
    if (otherTypingUsers.length === 1) {
      return `${otherTypingUsers[0].name}님이 입력 중입니다`;
    } else if (otherTypingUsers.length === 2) {
      return `${otherTypingUsers[0].name}님과 ${otherTypingUsers[1].name}님이 입력 중입니다`;
    } else {
      return `${otherTypingUsers[0].name}님 외 ${otherTypingUsers.length - 1}명이 입력 중입니다`;
    }
  };

  return (
    <div className="flex items-center space-x-2 px-4 py-2 text-sm text-gray-500">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
      <span>{getTypingText()}...</span>
    </div>
  );
};