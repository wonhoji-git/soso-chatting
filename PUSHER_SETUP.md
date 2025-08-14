# Pusher Setup Guide

## Environment Variables Required

Create a `.env.local` file in your project root with the following variables:

```bash
# Public variables (exposed to client)
NEXT_PUBLIC_PUSHER_KEY=your_pusher_key_here
NEXT_PUBLIC_PUSHER_CLUSTER=your_cluster_here

# Private variables (server-side only)
PUSHER_APP_ID=your_app_id_here
PUSHER_SECRET=your_secret_here
```

## How to Get Pusher Credentials

1. Go to [Pusher Dashboard](https://dashboard.pusher.com/)
2. Create a new app or select existing app
3. Go to "App Keys" section
4. Copy the following values:
   - **App ID**: `PUSHER_APP_ID`
   - **Key**: `NEXT_PUBLIC_PUSHER_KEY`
   - **Secret**: `PUSHER_SECRET`
   - **Cluster**: `NEXT_PUBLIC_PUSHER_CLUSTER`

## Common Issues & Solutions

### WebSocket Connection Failed
- **Cause**: Network restrictions, firewall, or incorrect cluster
- **Solution**: 
  - Verify cluster is correct (e.g., `ap3`, `us2`, `eu`)
  - Check if your network allows WebSocket connections
  - Try different transport methods

### Environment Variables Missing
- **Cause**: `.env.local` file not created or variables misspelled
- **Solution**:
  - Ensure `.env.local` exists in project root
  - Restart development server after adding variables
  - Check variable names match exactly

### Connection Timing Out
- **Cause**: Network latency or server issues
- **Solution**:
  - Increased timeout values in usePusher hook
  - Check Pusher service status
  - Verify app is not in sandbox mode

## Testing Connection

1. Add the `PusherDebug` component to your page
2. Check browser console for connection logs
3. Verify environment variables are loaded
4. Monitor connection status in real-time

## Transport Fallback

The hook automatically tries these transport methods in order:
1. WebSocket (ws/wss)
2. HTTP Streaming (xhr_streaming)
3. HTTP Polling (xhr_polling)

If WebSocket fails, it will automatically fall back to HTTP-based methods.
