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
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white mb-6 drop-shadow-lg">
        🐱 귀여운 캐릭터를 선택해주세요! 🐱
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
        {avatars.map((avatar) => (
          <div
            key={avatar.name}
            className={`avatar-selection ${selectedAvatar === avatar.src ? 'selected' : ''}`}
            onClick={() => handleAvatarClick(avatar.src)}
          >
            <div className="bg-white rounded-2xl p-3 shadow-lg hover:shadow-xl transition-shadow">
              <Image
                src={avatar.src}
                alt={avatar.name}
                width={80}
                height={80}
                className="rounded-xl w-20 h-20 object-cover"
              />
              <p className="text-sm font-bold text-gray-700 mt-2">{avatar.name}</p>
            </div>
          </div>
        ))}
      </div>
      {selectedAvatar && (
        <div className="mt-6">
          <p className="text-white text-lg font-bold drop-shadow-lg">
            선택된 캐릭터: {avatars.find(a => a.src === selectedAvatar)?.name}
          </p>
        </div>
      )}
    </div>
  );
}
