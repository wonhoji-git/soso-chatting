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
      <h2 className="text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-white mb-6 lg:mb-8 drop-shadow-lg">
        🐱 귀여운 캐릭터를 선택해주세요! 🐱
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4 lg:gap-6 xl:gap-8 max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto">
        {avatars.map((avatar) => (
          <div
            key={avatar.name}
            className={`avatar-selection ${selectedAvatar === avatar.src ? 'selected' : ''}`}
            onClick={() => handleAvatarClick(avatar.src)}
          >
            <div className="bg-white rounded-2xl p-3 lg:p-4 xl:p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              <Image
                src={avatar.src}
                alt={avatar.name}
                width={80}
                height={80}
                className="rounded-xl w-20 h-20 lg:w-24 lg:h-24 xl:w-32 xl:h-32 object-cover mx-auto"
              />
              <p className="text-sm lg:text-base xl:text-lg font-bold text-gray-700 mt-2">{avatar.name}</p>
            </div>
          </div>
        ))}
      </div>
      {selectedAvatar && (
        <div className="mt-6 lg:mt-8">
          <p className="text-white text-lg lg:text-xl xl:text-2xl font-bold drop-shadow-lg animate-bounce">
            ✨ 선택된 캐릭터: {avatars.find(a => a.src === selectedAvatar)?.name} ✨
          </p>
          <p className="text-white/80 text-sm lg:text-base mt-2 drop-shadow">
            이제 다음 단계로 이동합니다! 🚀
          </p>
        </div>
      )}
    </div>
  );
}
