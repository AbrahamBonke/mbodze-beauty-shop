import { useEffect, useState } from 'react';
import { WifiOff, Wifi, Cloud } from 'lucide-react';
import { getSyncStatus, performFullSync } from '../lib/sync';
import { supabase } from '../lib/supabase';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Function to check actual network connectivity
  const checkConnectivity = async () => {
    try {
      // Try a simple HEAD request to Supabase to check real connectivity
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(`${supabase.supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        headers: { 'apikey': supabase.supabaseKey },
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      setIsOnline(true);
      console.log('🌐 Connected to network');
    } catch (error) {
      setIsOnline(false);
      console.log('📴 No network connectivity');
    }
  };

  useEffect(() => {
    // Initial connectivity check
    checkConnectivity();

    // Update sync status
    const updateStatus = async () => {
      const status = await getSyncStatus();
      setSyncStatus(status);
    };

    updateStatus();
    const statusInterval = setInterval(updateStatus, 2000);

    // Check connectivity frequently (every 2 seconds) for faster detection
    const connectivityInterval = setInterval(checkConnectivity, 2000);

    // Watch online/offline events - check immediately
    const handleOnline = () => {
      console.log('🌐 Online event detected - checking immediately');
      setIsOnline(true);
      // Check immediately, then again in 200ms to ensure stable
      checkConnectivity();
      setTimeout(checkConnectivity, 200);
    };

    const handleOffline = () => {
      console.log('📴 Offline event detected');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(statusInterval);
      clearInterval(connectivityInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await performFullSync();
      const status = await getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const hasPending = syncStatus?.hasPendingSync || false;
  const lastSyncTime = syncStatus?.lastSyncedAt
    ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString()
    : 'Never';

  return (
    <div className="relative">
      {/* Status Indicator Badge */}
      <button
        onClick={() => setShowSyncMenu(!showSyncMenu)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
          isOnline
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-red-100 text-red-700 hover:bg-red-200'
        }`}
      >
        {isOnline ? (
          <Wifi className="w-4 h-4" />
        ) : (
          <WifiOff className="w-4 h-4" />
        )}
        <span>{isOnline ? 'Online' : 'Offline'}</span>
        {hasPending && (
          <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-yellow-500 text-white">
            {syncStatus?.pendingMutationsCount}
          </span>
        )}
      </button>

      {/* Sync Menu Popover */}
      {showSyncMenu && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
          <h3 className="font-semibold text-gray-900 mb-3">Sync Status</h3>

          {/* Status Items */}
          <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
            {/* Online/Offline */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Connection:</span>
              <span
                className={`font-medium ${
                  isOnline ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {isOnline ? '🌐 Online' : '📴 Offline'}
              </span>
            </div>

            {/* Last Sync */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Last Sync:</span>
              <span className="text-gray-700 font-medium">{lastSyncTime}</span>
            </div>

            {/* Pending Mutations */}
            {hasPending && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Pending:</span>
                <span className="font-medium text-yellow-600">
                  {syncStatus?.pendingMutationsCount} changes
                </span>
              </div>
            )}

            {/* Sync In Progress */}
            {syncStatus?.syncInProgress && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <div className="animate-spin">
                  <Cloud className="w-4 h-4" />
                </div>
                <span>Syncing...</span>
              </div>
            )}
          </div>

          {/* Auto-Sync Info */}
          {isOnline && (
            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800">
                ⏲️ Auto-sync enabled. Syncing every 60 seconds.
              </p>
            </div>
          )}

          {/* Manual Sync Button */}
          {isOnline && hasPending && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-all text-sm ${
                isSyncing
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isSyncing ? (
                <>
                  <div className="animate-spin">
                    <Cloud className="w-4 h-4" />
                  </div>
                  Syncing...
                </>
              ) : (
                <>
                  <Cloud className="w-4 h-4" />
                  Sync Now (Optional)
                </>
              )}
            </button>
          )}

          {/* Info Message */}
          {!isOnline && hasPending && (
            <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-xs text-yellow-800">
                📝 You have {syncStatus?.pendingMutationsCount} pending changes.
                They will sync automatically when you come online.
              </p>
            </div>
          )}

          {!isOnline && !hasPending && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800">
                💾 All data is synced. You can work offline safely.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
