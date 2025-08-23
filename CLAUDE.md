# Claude Code Configuration

## Project Information
- **Project Name**: Soso Chatting
- **Type**: PWA Real-time Chat Application
- **Framework**: Next.js + React + TypeScript
- **Real-time**: Pusher WebSockets
- **Platform**: Mobile-first (iOS/Android PWA)

## Development Commands

### Build & Type Check
```bash
npm run build
npm run typecheck
npm run lint
```

### Testing
```bash
npm run test
npm run test:e2e
```

### Development
```bash
npm run dev
npm start
```

## Project Structure

### Core Components
- `app/page.tsx` - Main application with session management
- `components/ChatRoom.tsx` - Chat interface
- `components/AvatarSelector.tsx` - Character selection
- `components/NameInput.tsx` - User name input

### Hooks & Context
- `hooks/usePusher.ts` - Pusher connection management
- `contexts/PusherContext.tsx` - Pusher context provider

### Utilities
- `utils/messageBuffer.ts` - Message buffering for background
- `utils/backgroundDetection.ts` - Background/foreground detection
- `utils/memoryOptimizer.ts` - Memory management
- `utils/stateRecovery.ts` - App state recovery system
- `utils/notificationSafety.ts` - Safe notification handling
- `utils/pwaEnvironmentDetection.ts` - PWA environment detection

### Service Worker
- `public/sw.js` - PWA service worker with background messaging

## Key Features

### PWA Background Processing
- Dynamic connection timeouts based on background duration
- Platform-specific optimization (iOS Safari, Android Chrome)
- Long-term background monitoring (10+ minutes)
- Adaptive heartbeat intervals

### Session Management
- 24-hour user session persistence
- Automatic state recovery on app restart
- Loading UI during session restoration
- Secure session cleanup on logout

### Message Reliability
- Smart message buffering with priority handling
- Background message delivery
- First message delivery to background users
- Message sync on app return

### Mobile Optimization
- iOS Safari background limitations handling
- Android PWA performance optimization
- Memory pressure monitoring
- Notification permission management

## Recent Fixes

### PWA Background Issues (2024)
1. **10+ minute background message failures** - Enhanced Service Worker with dynamic timeouts
2. **Long-term background white screen/redirect** - Implemented session persistence system
3. **First message delivery failures** - Improved message buffering and sync

### Build Issues
- Fixed TypeScript dependency error in `usePusher.ts`
- Removed circular dependencies in typing functions

## Environment Variables
```bash
NEXT_PUBLIC_PUSHER_APP_ID=
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_SECRET=
NEXT_PUBLIC_PUSHER_CLUSTER=
```

## Debugging

### PWA Background State
- Check browser dev tools > Application > Service Workers
- Monitor console logs for background detection events
- Use `getRecoveryStats()` for state recovery debugging

### Pusher Connection
- Monitor Network tab for WebSocket connections
- Check Pusher dashboard for connection events
- Use `usePusher` hook debug logs

### Session Management
- Check localStorage for `soso-chat-user-session`
- Monitor session expiry and restoration logs
- Verify loading states during recovery

## Performance Notes

### Memory Management
- Automatic buffer cleanup at 75% memory usage
- Smart message prioritization
- Graduated memory pressure thresholds

### Connection Management
- Mobile PWA: 15s heartbeat intervals
- Desktop: 30s heartbeat intervals
- Adaptive timeouts based on background duration

## Security Considerations
- Session data stored locally (no sensitive info)
- Automatic session expiry (24 hours)
- Safe notification permission handling
- No credentials in localStorage