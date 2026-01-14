# Notification System - Debug Guide

## Issue: Notifications Page Shows Empty

The Notifications component has been updated to use **Dexie's liveQuery** for real-time updates from the local database.

### What Changed

1. **Real-time DB Watching**: Changed from single fetch on mount to continuous observation of the local Dexie database
2. **Auto-refresh**: When sync pulls notifications from Supabase, the UI automatically updates
3. **Debug Utilities**: Added console utilities to troubleshoot notification issues

## Debugging Steps

### Step 1: Check if notifications exist in local DB

Open browser DevTools Console and run:

```javascript
window.debugSync.checkNotifications()
```

This will show:
- Total notifications in local DB
- Number of uncleared notifications
- Full notification objects

### Step 2: Check sync status

```javascript
window.debugSync.checkStatus()
```

Shows:
- Online/offline status
- Last sync time
- Pending mutations
- Notification count

### Step 3: Check pending mutations

```javascript
window.debugSync.checkPendingMutations()
```

Shows any mutations waiting to be synced (including notifications).

### Step 4: Test with a test notification

```javascript
window.debugSync.addTestNotification()
```

Creates a test notification in the local DB. If this appears in the UI, the display logic works.

### Step 5: Check sync logs

When syncing, look for these messages in the console:

- `📥 Pulling notifications from Supabase` - Sync started
- `🔔 Storing notification {id}: {message}` - Notification being stored
- `📊 Total notifications in local DB: {count}` - Verification count
- `✅ Merged {count} notifications from Supabase` - Sync completed

## Common Issues & Solutions

### Issue: "No notifications on remote server" log but notifications exist

**Problem**: Supabase notifications table is empty or doesn't exist yet.

**Solution**: 
- Check if Supabase notifications table exists and has data
- Manually add test notifications to Supabase
- Or use `window.debugSync.addTestNotification()` to test locally

### Issue: Notifications in DB but not showing in UI

**Problem**: Component not updating when DB changes.

**Solution**:
- Check browser console for errors
- Verify liveQuery subscription is active (look for console logs)
- Try clearing browser cache and reloading
- Test with `window.debugSync.addTestNotification()` - if it shows, the UI works

### Issue: Sync shows notifications were stored but count still 0

**Problem**: liveQuery might not be detecting changes immediately.

**Solution**:
- Check the `📊 Total notifications in local DB` log
- Manually navigate away and back to Notifications page
- Or refresh the page

## Verification Checklist

- [ ] Run `window.debugSync.checkNotifications()` - shows notifications with `cleared: false`
- [ ] Run `window.debugSync.checkStatus()` - shows online status correctly
- [ ] Create test notification - it appears in UI immediately
- [ ] Go offline, sync, come online - notifications from Supabase appear
- [ ] Clear a notification - it disappears from UI and syncs when online

## Console Logs to Look For

**Good signs (system working)**:
```
📥 Pulling notifications from Supabase
🔔 Storing notification notif_abc123: Low stock alert
📊 Total notifications in local DB: 3
✅ Merged 3 notifications from Supabase
```

**Bad signs (system has issues)**:
```
❌ Error pulling notifications: ...
⚠️ Remote notifications table not found
📴 OFFLINE - mutations will queue locally
```

## If Still Empty After Testing

1. Hard reset local DB: `window.debugSync.hardReset()` (⚠️ deletes all local data)
2. Check Supabase directly - are there notifications in the remote DB?
3. Check network tab in DevTools - is the notifications query executing?
4. Verify the Notification interface matches between supabase.ts and db.ts

## Database Migration

If notifications table wasn't defined before, you may need to increment the Dexie version in `src/lib/db.ts`:

Current (v1):
```typescript
this.version(1).stores({
  notifications: '&id, product_id, created_at, cleared',
  ...
});
```

If needed, bump to v2 and add migration logic.
