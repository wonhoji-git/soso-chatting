// components/NameInput.tsx
'use client';

import { useState } from 'react';

interface NameInputProps {
  onNameSubmit: (name: string) => void;
}

export default function NameInput({ onNameSubmit }: NameInputProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onNameSubmit(name.trim());
    }
  };

  return (
    <div className="text-center px-4 lg:px-8">
      <h2 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-white mb-6 lg:mb-8 drop-shadow-lg">
        🎯 당신의 이름을 알려주세요! 🎯
      </h2>
      <form onSubmit={handleSubmit} className="max-w-md lg:max-w-2xl mx-auto">
        <div className="flex flex-col space-y-4 lg:space-y-6">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            className="px-6 lg:px-8 py-4 lg:py-6 text-lg lg:text-xl xl:text-2xl rounded-2xl border-2 border-white focus:border-cute-yellow focus:outline-none text-center font-bold text-gray-700 placeholder-gray-400 shadow-lg focus:shadow-xl transition-all duration-300 transform focus:scale-105"
            maxLength={20}
            required
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-8 lg:px-12 py-4 lg:py-6 bg-cute-yellow text-gray-800 font-bold text-lg lg:text-xl xl:text-2xl rounded-2xl hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
          >
            🚀 채팅방 입장하기 🚀
          </button>
        </div>
      </form>
      <div className="mt-6 lg:mt-8">
        <p className="text-white/80 text-sm lg:text-base drop-shadow">
          ✨ 이름은 최대 20자까지 입력 가능해요! ✨
        </p>
      </div>
    </div>
  );
}
