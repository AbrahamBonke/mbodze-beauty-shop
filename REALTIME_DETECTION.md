# Real-Time Online/Offline Detection

## Speed Improvements

The system now detects online/offline status much faster:

### Detection Timeline

**Before:**
- Online event fires → Wait 500ms → Verify network (2 sec timeout) → Sync starts
- Total latency: ~2.5+ seconds

**After:**
- Online event fires → Verify immediately (1 sec timeout) → Sync starts
- Total latency: ~1 second or less

### Changes Made

1. **Connectivity Check Interval**: Every 2 seconds (was every 5 seconds)
2. **Sync Debounce**: 1 second (was 5 seconds)
3. **Network Verification Timeout**: 1 second (was 2 seconds)
4. **Retry Wait Time**: 1 second (was 3 seconds)
5. **Initial Detection**: Immediate on online event (was 500ms delay)

### How It Works

1. **Browser Online Event** → Fires when OS detects network
2. **Immediate Check** (100ms) → OfflineIndicator verifies connectivity
3. **Sync Verification** (1 sec timeout) → Confirms Supabase is reachable
4. **Auto-Sync Starts** → Every 60 seconds while online

### Console Logs

Watch these logs to see real-time detection:

```
🌐 Online event detected - checking immediately
🌐 Connected to network
🌐 ONLINE event detected - verifying network stability
✅ Network connectivity confirmed - starting sync
⏲️ Starting auto-sync interval (every 60 seconds)
⏰ Auto-sync triggered
```

### What's Happening Behind the Scenes

- **OfflineIndicator.tsx**: Checks connectivity every 2 seconds (visual indicator)
- **sync.ts**: Auto-syncs every 60 seconds when online + manual sync option
- Both use aggressive retry logic if network unstable

### Testing

To test real-time detection:

1. Turn WiFi/network OFF
2. Watch the indicator change to "Offline" within 2 seconds
3. Turn network ON
4. Watch the indicator change to "Online" within 1-2 seconds
5. Watch console for sync logs within 1 second
6. Check the Sync Status menu for latest sync time

### Performance Notes

- Faster detection uses more frequent network checks
- Each check is lightweight (HEAD request to /index.html)
- Auto-sync respects debouncing to avoid duplicate syncs
- Will not sync while another sync is in progress

## If Still Too Slow

If you need even faster detection, you can reduce the intervals further:

**In OfflineIndicator.tsx:**
```typescript
const connectivityInterval = setInterval(checkConnectivity, 1000); // 1 sec instead of 2
```

**In sync.ts:**
```typescript
const SYNC_DEBOUNCE_MS = 500; // 500ms instead of 1000
```

Note: More frequent checks use more battery/data on mobile devices.
