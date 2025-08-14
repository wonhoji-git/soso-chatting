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
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white mb-6 drop-shadow-lg">
        🎯 당신의 이름을 알려주세요! 🎯
      </h2>
      <form onSubmit={handleSubmit} className="max-w-md mx-auto">
        <div className="flex flex-col space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            className="px-6 py-4 text-lg rounded-2xl border-2 border-white focus:border-cute-yellow focus:outline-none text-center font-bold text-gray-700 placeholder-gray-400 shadow-lg"
            maxLength={20}
            required
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-8 py-4 bg-cute-yellow text-gray-800 font-bold text-lg rounded-2xl hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            🚀 채팅방 입장하기 🚀
          </button>
        </div>
      </form>
    </div>
  );
}
