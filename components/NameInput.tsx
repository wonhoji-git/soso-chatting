// components/NameInput.tsx
'use client';

import { useState } from 'react';

interface NameInputProps {
  onNameSubmit: (name: string) => void;
}

export default function NameInput({ onNameSubmit }: NameInputProps) {
  const [name, setName] = useState('');
  const [showValidation, setShowValidation] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    
    if (trimmedName.length < 2) {
      setShowValidation(true);
      return;
    }
    
    if (trimmedName) {
      onNameSubmit(trimmedName);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (showValidation && value.trim().length >= 2) {
      setShowValidation(false);
    }
  };

  return (
    <div className="text-center px-4 lg:px-8">
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4 lg:mb-6 drop-shadow-lg">
        🌟 이름을 알려주세요! 🌟
      </h2>
      <p className="text-lg md:text-xl text-white/90 mb-6 drop-shadow">
        친구들이 부를 수 있는 멋진 이름이에요! 😊
      </p>
      
      <form onSubmit={handleSubmit} className="max-w-md lg:max-w-lg mx-auto">
        <div className="flex flex-col space-y-4">
          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="나는 누구일까요?"
              className={`w-full px-6 py-4 text-xl rounded-3xl border-4 focus:outline-none text-center font-bold placeholder-purple-400 shadow-xl transition-all duration-300 transform focus:scale-105 ${
                showValidation 
                  ? 'border-red-400 bg-red-50 text-red-700 animate-pulse' 
                  : name.trim().length >= 2 
                  ? 'border-green-400 bg-green-50 text-green-700' 
                  : 'border-purple-300 bg-white text-purple-700 focus:border-yellow-400'
              }`}
              maxLength={15}
              required
              style={{ fontSize: '18px' }} // Prevents zoom on iOS
            />
            {name.trim().length >= 2 && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-2xl animate-bounce">
                ✅
              </div>
            )}
          </div>
          
          {/* Validation message */}
          {showValidation && (
            <div className="bg-red-100 border-2 border-red-300 rounded-2xl p-3">
              <p className="text-red-600 font-bold text-sm">
                😅 이름이 너무 짧아요! 2글자 이상 써주세요! 
              </p>
            </div>
          )}
          
          {/* Character counter */}
          {name.length > 0 && (
            <div className="flex items-center justify-center space-x-2 text-sm">
              <span className="text-white/80">{name.length}/15글자</span>
              <div className="flex space-x-1">
                {name.length < 5 ? '🌱' : name.length < 10 ? '🌿' : '🌳'}
              </div>
            </div>
          )}
          
          <button
            type="submit"
            disabled={name.trim().length < 2}
            className="px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-bold text-xl rounded-3xl hover:from-yellow-500 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105 active:scale-95 min-h-[60px]"
          >
            {name.trim().length >= 2 ? '🚀 채팅하러 가기! 🎉' : '📝 이름을 써주세요!'}
          </button>
        </div>
      </form>
      
      <div className="mt-6 lg:mt-8 bg-white/20 backdrop-blur-sm rounded-2xl p-4 max-w-sm mx-auto">
        <p className="text-white/90 text-sm lg:text-base drop-shadow">
          💡 팁: 친구들이 기억하기 쉬운 이름이 좋아요! 
        </p>
        <p className="text-white/80 text-xs mt-1">
          (2-15글자, 한글/영어/숫자 사용 가능)
        </p>
      </div>
    </div>
  );
}
