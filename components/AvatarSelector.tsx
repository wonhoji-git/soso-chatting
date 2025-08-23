// components/AvatarSelector.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';

interface AvatarSelectorProps {
  onAvatarSelect: (avatar: string) => void;
}

const avatars = [
  { name: '고냠이', src: '/images/cat.jpg' },
  { name: '코코', src: '/images/coco.jpg' },
  { name: '뚱파', src: '/images/pig.jpg' },
  { name: '파덕이', src: '/images/duck.jpg' },
  { name: '햄톨이', src: '/images/hamster.jpg' },
];

export default function AvatarSelector({ onAvatarSelect }: AvatarSelectorProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');

  const handleAvatarClick = (avatar: string) => {
    setSelectedAvatar(avatar);
    onAvatarSelect(avatar);
  };

  return (
    <div className="text-center px-4 lg:px-8">
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-6 lg:mb-8 drop-shadow-lg">
        🎯 나만의 캐릭터를 골라보세요! ✨
      </h2>
      <p className="text-lg md:text-xl text-white/90 mb-6 drop-shadow">
        마음에 드는 친구를 눌러주세요! 🤗
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 lg:gap-8 max-w-4xl lg:max-w-6xl mx-auto">
        {avatars.map((avatar) => (
          <div
            key={avatar.name}
            className={`avatar-selection ${selectedAvatar === avatar.src ? 'selected' : ''}`}
            onClick={() => handleAvatarClick(avatar.src)}
          >
            <div className="bg-white rounded-3xl p-4 lg:p-6 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 min-h-[120px] lg:min-h-[140px] flex flex-col items-center justify-center cursor-pointer">
              <Image
                src={avatar.src}
                alt={avatar.name}
                width={80}
                height={80}
                className="rounded-2xl w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 object-cover mx-auto mb-2 border-4 border-purple-200"
              />
              <p className="text-base lg:text-lg font-bold text-purple-700 text-center leading-tight">{avatar.name}</p>
              {selectedAvatar === avatar.src && (
                <div className="text-2xl mt-1 animate-bounce">✅</div>
              )}
            </div>
          </div>
        ))}
      </div>
      {selectedAvatar && (
        <div className="mt-8 bg-white/20 backdrop-blur-sm rounded-3xl p-6 max-w-md mx-auto">
          <div className="text-4xl mb-3 animate-bounce">🎉</div>
          <p className="text-white text-xl lg:text-2xl font-bold drop-shadow-lg">
            잘했어요! {avatars.find(a => a.src === selectedAvatar)?.name}를 선택했네요!
          </p>
          <p className="text-white/90 text-base lg:text-lg mt-3 drop-shadow">
            이제 이름을 정해볼까요? 🌟
          </p>
          <div className="flex justify-center space-x-3 mt-4">
            <span className="animate-bounce delay-100 text-2xl">🎈</span>
            <span className="animate-bounce delay-200 text-2xl">✨</span>
            <span className="animate-bounce delay-300 text-2xl">🎊</span>
          </div>
        </div>
      )}
    </div>
  );
}
