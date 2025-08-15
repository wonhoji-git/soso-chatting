'use client';

import { useState } from 'react';
import { NotificationSettings as NotificationSettingsType } from '@/types/chat';
import { getNotificationPermission, isNotificationSupported, getEnhancedNotificationPermission, isPWANotificationSupported } from '@/utils/notificationSafety';

interface NotificationSettingsProps {
  settings: NotificationSettingsType;
  onUpdateSettings: (settings: Partial<NotificationSettingsType>) => void;
  onRequestPermission: () => Promise<boolean>;
}

export const NotificationSettings = ({ 
  settings, 
  onUpdateSettings, 
  onRequestPermission 
}: NotificationSettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>(() => {
    return getEnhancedNotificationPermission();
  });

  const handlePermissionRequest = async () => {
    console.log('🔔 사용자가 권한 요청 버튼을 클릭했습니다.');
    const granted = await onRequestPermission();
    const newStatus = granted ? 'granted' : 'denied';
    setPermissionStatus(newStatus);
    console.log('📝 권한 상태 업데이트:', newStatus);
  };

  const getPermissionStatusText = () => {
    // 플랫폼별 환경 감지
    const isIOSPWA = typeof window !== 'undefined' && (window.navigator as any).standalone === true;
    const isIOSSafari = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isAndroid = typeof window !== 'undefined' && /Android/i.test(navigator.userAgent);
    const isAndroidPWA = typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches || 
      window.matchMedia('(display-mode: fullscreen)').matches
    );
    
    switch (permissionStatus) {
      case 'granted':
        if (isIOSPWA && isIOSSafari) {
          return '🍎 iOS PWA 허용됨';
        } else if (isAndroid && isAndroidPWA) {
          return '🤖 Android PWA 허용됨';
        }
        return '✅ 허용됨';
      case 'denied':
        if (isIOSPWA && isIOSSafari) {
          return '🍎 iOS PWA 차단됨';
        } else if (isAndroid && isAndroidPWA) {
          return '🤖 Android PWA 차단됨';
        }
        return '❌ 차단됨';
      case 'default':
        if (isIOSPWA && isIOSSafari) {
          return '🍎 iOS PWA 미설정';
        } else if (isAndroid && isAndroidPWA) {
          return '🤖 Android PWA 미설정';
        }
        return '❓ 미설정';
      case 'pwa-supported':
        return '📱 PWA 지원 가능';
      case 'partial':
        if (isIOSPWA && isIOSSafari) {
          return '🍎 iOS PWA 부분 지원';
        } else if (isAndroid && isAndroidPWA) {
          return '🤖 Android PWA 부분 지원';
        }
        return '🔄 부분 지원';
      case 'unsupported':
        return '❌ 지원되지 않음';
      default:
        return '❓ 알 수 없음';
    }
  };

  return (
    <div className="relative" style={{zIndex: 1000000}}>
      {/* 설정 버튼 */}
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🔔 알림 설정 버튼 클릭됨:', !isOpen);
          setIsOpen(!isOpen);
        }}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer select-none"
        title="알림 설정"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔔 키보드로 알림 설정 토글됨:', !isOpen);
            setIsOpen(!isOpen);
          }
        }}
      >
        🔔
      </div>

      {/* 설정 패널 */}
      {isOpen && (
        <div className="absolute right-0 top-12 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-80" style={{zIndex: 999999}}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800">알림 설정</h3>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('❌ 알림 설정 닫기 버튼 클릭됨');
                setIsOpen(false);
              }}
              className="text-gray-500 hover:text-gray-700 text-xl cursor-pointer"
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {/* 브라우저 알림 설정 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  브라우저 알림
                </span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const canUseNotifications = permissionStatus === 'granted' || permissionStatus === 'partial' || permissionStatus === 'pwa-supported';
                      if (canUseNotifications) {
                        const newValue = !settings.desktop;
                        console.log('🔧 브라우저 알림 토글 클릭:', {
                          previousValue: settings.desktop,
                          newValue: newValue,
                          permissionStatus
                        });
                        onUpdateSettings({ desktop: newValue });
                      } else {
                        console.log('❌ 브라우저 알림 권한이 없어서 토글 불가');
                      }
                    }}
                    disabled={permissionStatus !== 'granted' && permissionStatus !== 'partial' && permissionStatus !== 'pwa-supported'}
                    className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200 ${
                      settings.desktop 
                        ? 'bg-blue-600' 
                        : 'bg-gray-200'
                    } ${(permissionStatus !== 'granted' && permissionStatus !== 'partial' && permissionStatus !== 'pwa-supported') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span 
                      className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${
                        settings.desktop ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
              
              <div className="text-xs text-gray-500">
                브라우저 권한: {getPermissionStatusText()}
                {(permissionStatus === 'default' || permissionStatus === 'partial' || permissionStatus === 'pwa-supported') && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🔐 권한 요청 버튼 클릭');
                      handlePermissionRequest();
                    }}
                    className="ml-2 text-blue-600 hover:text-blue-800 underline cursor-pointer"
                  >
                    권한 요청
                  </button>
                )}
              </div>
            </div>

            {/* 사운드 알림 설정 */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                사운드 알림
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newValue = !settings.sound;
                    console.log('🔧 사운드 알림 토글 클릭:', {
                      previousValue: settings.sound,
                      newValue: newValue
                    });
                    onUpdateSettings({ sound: newValue });
                  }}
                  className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer ${
                    settings.sound 
                      ? 'bg-blue-600' 
                      : 'bg-gray-200'
                  }`}
                >
                  <span 
                    className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${
                      settings.sound ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 타이핑 알림 설정 */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                타이핑 표시
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newValue = !settings.typing;
                    console.log('🔧 타이핑 표시 토글 클릭:', {
                      previousValue: settings.typing,
                      newValue: newValue
                    });
                    onUpdateSettings({ typing: newValue });
                  }}
                  className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer ${
                    settings.typing 
                      ? 'bg-blue-600' 
                      : 'bg-gray-200'
                  }`}
                >
                  <span 
                    className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${
                      settings.typing ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 테스트 버튼들 */}
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-gray-600 mb-2">🧪 알림 테스트</p>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔔 브라우저 알림 테스트 버튼 클릭');
                    const canUseNotifications = (permissionStatus === 'granted' || permissionStatus === 'partial') && settings.desktop;
                    
                    if (canUseNotifications) {
                      try {
                        if (permissionStatus === 'granted' && 'Notification' in window) {
                          // 데스크톱 브라우저 표준 알림
                          new Notification('🧪 테스트 알림', {
                            body: '브라우저 알림이 정상 작동합니다!',
                            icon: '/images/cat.jpg',
                          });
                        } else if (permissionStatus === 'partial') {
                          // 모바일에서 대체 알림 (시각적 알림)
                          const alertDiv = document.createElement('div');
                          alertDiv.innerHTML = `
                            <div style="
                              position: fixed; 
                              top: 20px; 
                              right: 20px; 
                              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                              color: white; 
                              padding: 16px 20px; 
                              border-radius: 12px; 
                              box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                              z-index: 999999;
                              max-width: 300px;
                              animation: slideInRight 0.3s ease-out;
                            ">
                              <div style="font-weight: bold; margin-bottom: 4px;">🧪 테스트 알림</div>
                              <div style="font-size: 14px; opacity: 0.9;">모바일 알림이 정상 작동합니다!</div>
                            </div>
                          `;
                          document.body.appendChild(alertDiv);
                          setTimeout(() => {
                            if (alertDiv.parentNode) {
                              alertDiv.parentNode.removeChild(alertDiv);
                            }
                          }, 3000);
                        }
                        console.log('✅ 브라우저 알림 테스트 성공');
                      } catch (error) {
                        console.error('❌ 브라우저 알림 테스트 실패:', error);
                        alert('브라우저 알림 생성에 실패했습니다.');
                      }
                    } else {
                      console.log('❌ 브라우저 알림 조건 불만족:', { permissionStatus, desktop: settings.desktop });
                      alert('브라우저 알림이 비활성화되어 있거나 권한이 없습니다.');
                    }
                  }}
                  className={`flex-1 px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                    permissionStatus === 'granted' && settings.desktop
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                  disabled={permissionStatus !== 'granted' || !settings.desktop}
                >
                  🔔 알림
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔊 사운드 테스트 버튼 클릭');
                    if (settings.sound) {
                      try {
                        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                        
                        const playCuteTestSound = (context: AudioContext) => {
                          const playNote = (frequency: number, startTime: number, duration: number, volume: number = 0.3) => {
                            const oscillator = context.createOscillator();
                            const gainNode = context.createGain();
                            
                            oscillator.connect(gainNode);
                            gainNode.connect(context.destination);
                            
                            oscillator.frequency.setValueAtTime(frequency, startTime);
                            oscillator.type = 'sine';
                            
                            gainNode.gain.setValueAtTime(0, startTime);
                            gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02);
                            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
                            
                            oscillator.start(startTime);
                            oscillator.stop(startTime + duration);
                          };

                          // 귀여운 테스트 멜로디: 도-미-솔-도
                          const baseTime = context.currentTime;
                          playNote(523.25, baseTime, 0.15, 0.25);        // 도 (C5)
                          playNote(659.25, baseTime + 0.1, 0.15, 0.3);   // 미 (E5)  
                          playNote(783.99, baseTime + 0.2, 0.15, 0.35);  // 솔 (G5)
                          playNote(1046.50, baseTime + 0.3, 0.25, 0.4);  // 도 (C6)
                        };
                        
                        if (audioContext.state === 'suspended') {
                          audioContext.resume().then(() => {
                            playCuteTestSound(audioContext);
                          });
                        } else {
                          playCuteTestSound(audioContext);
                        }
                        
                        console.log('✅ 귀여운 사운드 테스트 성공 🎵');
                      } catch (error) {
                        console.error('❌ 사운드 테스트 실패:', error);
                        alert('사운드 재생에 실패했습니다.');
                      }
                    } else {
                      console.log('❌ 사운드 설정이 비활성화됨');
                      alert('사운드 알림이 비활성화되어 있습니다.');
                    }
                  }}
                  className={`flex-1 px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                    settings.sound
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                  disabled={!settings.sound}
                >
                  🔊 사운드
                </button>
              </div>
            </div>

            {/* 설명 */}
            <div className="text-xs text-gray-500 border-t pt-3">
              <p>• 브라우저 알림: 새 메시지가 도착했을 때 브라우저/모바일 알림을 표시합니다.</p>
              <p>• 사운드 알림: 새 메시지가 도착했을 때 알림음을 재생합니다.</p>
              <p>• 타이핑 표시: 다른 사용자가 메시지를 입력 중일 때 표시합니다.</p>
              
              {/* iOS PWA 특별 안내 */}
              {typeof window !== 'undefined' && 
               (window.navigator as any).standalone === true && 
               /iPad|iPhone|iPod/.test(navigator.userAgent) && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-blue-700">
                  <div className="font-medium">🍎 iOS PWA 알림 안내</div>
                  <div className="mt-1">
                    • iPhone에서 홈 화면에 추가한 PWA 앱에서는 알림 권한이 제한적일 수 있습니다.
                  </div>
                  <div>
                    • 알림이 작동하지 않으면 iOS 설정 &gt; 알림에서 &apos;소소채팅&apos; 앱의 알림을 허용해주세요.
                  </div>
                  <div>
                    • 또는 Safari 브라우저에서 직접 사용하시면 더 안정적입니다.
                  </div>
                </div>
              )}

              {/* Android PWA 특별 안내 */}
              {typeof window !== 'undefined' && 
               /Android/i.test(navigator.userAgent) &&
               (window.matchMedia('(display-mode: standalone)').matches || 
                window.matchMedia('(display-mode: fullscreen)').matches) && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-green-700">
                  <div className="font-medium">🤖 Android PWA 알림 안내</div>
                  <div className="mt-1">
                    • Android에서 홈 화면에 추가한 PWA 앱은 알림이 잘 지원됩니다.
                  </div>
                  <div>
                    • 알림이 작동하지 않으면 Android 설정 &gt; 앱 &gt; 소소채팅 &gt; 알림을 확인해주세요.
                  </div>
                  <div>
                    • Chrome 또는 Samsung Browser에서 가장 안정적으로 작동합니다.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 배경 클릭 시 닫기 */}
      {isOpen && (
        <div
          className="fixed inset-0"
          style={{zIndex: 999998}}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🌍 배경 클릭으로 알림 설정 닫기');
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
};