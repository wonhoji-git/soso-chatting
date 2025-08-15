'use client';

import { TypingUser } from '@/types/chat';

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
  showTyping: boolean;
}

export const TypingIndicator = ({ typingUsers, showTyping }: TypingIndicatorProps) => {
  console.log('👀 TypingIndicator render:', {
    typingUsersCount: typingUsers.length,
    typingUsers: typingUsers.map(u => ({ id: u.id, name: u.name })),
    showTypingSetting: showTyping
  });

  if (!showTyping) {
    console.log('❌ Typing display is disabled in settings');
    return null;
  }

  if (typingUsers.length === 0) {
    console.log('❌ No typing users, not rendering indicator');
    return null;
  }

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].name}님이 입력 중입니다`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].name}님과 ${typingUsers[1].name}님이 입력 중입니다`;
    } else {
      return `${typingUsers[0].name}님 외 ${typingUsers.length - 1}명이 입력 중입니다`;
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