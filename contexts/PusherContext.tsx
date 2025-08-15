// contexts/PusherContext.tsx
'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { usePusher } from '@/hooks/usePusher';
import { ConnectionStatus, User, Message, TypingUser, NotificationSettings } from '@/types/chat';

interface PusherContextType {
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  onlineUsers: User[];
  messages: Message[];
  typingUsers: TypingUser[];
  notificationSettings: NotificationSettings;
  sendMessage: (message: string, user: User) => Promise<void>;
  joinChat: (user: User) => Promise<void>;
  leaveChat: (user: User) => Promise<void>;
  reconnect: () => void;
  retryCount: number;
  cleanupPusher: () => void;
  getConnectionState: () => string;
  getCurrentTransport: () => string | null;
  lastError: string | null;
  startTyping: (user?: User) => Promise<void>;
  stopTyping: (user?: User) => Promise<void>;
  requestNotificationPermission: () => Promise<boolean>;
  showDesktopNotification: (title: string, options?: NotificationOptions) => Notification | null;
  playNotificationSound: () => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
}

const PusherContext = createContext<PusherContextType | undefined>(undefined);

interface PusherProviderProps {
  children: ReactNode;
}

export function PusherProvider({ children }: PusherProviderProps) {
  const pusherState = usePusher();

  return (
    <PusherContext.Provider value={pusherState}>
      {children}
    </PusherContext.Provider>
  );
}

export function usePusherContext() {
  const context = useContext(PusherContext);
  if (context === undefined) {
    throw new Error('usePusherContext must be used within a PusherProvider');
  }
  return context;
}