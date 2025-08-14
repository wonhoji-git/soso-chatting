// types/chat.ts

// 연결 상태 타입
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'failed';

// 사용자 타입
export interface User {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
  joinedAt: string; // ISO 문자열로 변경
  leftAt?: string; // 퇴장 시간 추가
}

// 메시지 타입
export interface Message {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar: string;
  timestamp: string; // ISO 문자열로 변경
  isSystemMessage?: boolean; // 시스템 메시지 여부
}

// 채팅방 타입
export interface ChatRoom {
  users: User[];
  messages: Message[];
}

// Pusher 이벤트 타입
export interface PusherEvents {
  'new-message': Message;
  'user-joined': User;
  'user-left': User;
}

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: string;
}

// 사용자 액션 타입
export type UserAction = 'join' | 'leave';

// 연결 정보 타입
export interface ConnectionInfo {
  status: ConnectionStatus;
  isConnected: boolean;
  retryCount: number;
  lastConnected?: string;
  lastDisconnected?: string;
}
