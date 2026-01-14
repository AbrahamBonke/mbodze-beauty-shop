import { db } from './db';
import { verifyAllData, forceSyncAll, markAllAsUnsynced, debugSalesData } from './verifySync';

/**
 * Debug utilities for troubleshooting offline-first sync
 * Call these from the browser console: window.debugSync.checkNotifications()
 */

export const debugSync = {
  /**
   * Check notification status in local DB
   */
  async checkNotifications() {
    const all = await db.notifications.toArray();
    const uncleared = all.filter(n => !n.cleared);
    
    console.log('📋 NOTIFICATIONS DEBUG');
    console.log(`Total notifications: ${all.length}`);
    console.log(`Uncleared notifications: ${uncleared.length}`);
    console.log('All notifications:', all);
    console.log('Uncleared notifications:', uncleared);
    
    return { all, uncleared };
  },

  /**
   * Check pending mutations
   */
  async checkPendingMutations() {
    const pending = await db.mutations
      .where('status')
      .equals('pending')
      .toArray();
    
    console.log('📋 PENDING MUTATIONS DEBUG');
    console.log(`Total pending mutations: ${pending.length}`);
    console.log('Pending mutations:', pending);
    
    return pending;
  },

  /**
   * Check sync metadata
   */
  async checkSyncMeta() {
    const meta = await db.syncMeta.get('sync_meta');
    
    console.log('📋 SYNC METADATA DEBUG');
    console.log('Sync metadata:', meta);
    
    return meta;
  },

  /**
   * Full system status
   */
  async checkStatus() {
    console.log('🔍 === FULL SYSTEM STATUS ===');
    console.log(`Online: ${navigator.onLine}`);
    
    const meta = await this.checkSyncMeta();
    const pending = await this.checkPendingMutations();
    const notifs = await this.checkNotifications();
    
    console.log('=== END STATUS ===\n');
    
    return { meta, pending, notifs, online: navigator.onLine };
  },

  /**
   * Clear all uncleared notifications (for testing)
   */
  async clearAllNotifications() {
    const all = await db.notifications.toArray();
    const uncleared = all.filter(n => !n.cleared);
    
    for (const notif of uncleared) {
      await db.notifications.update(notif.id, { cleared: true });
    }
    
    console.log(`✅ Cleared ${uncleared.length} notifications`);
  },

  /**
   * Add a test notification (for testing)
   */
  async addTestNotification() {
    const id = `test_${Date.now()}`;
    await db.notifications.add({
      id,
      type: 'info',
      message: `Test notification created at ${new Date().toLocaleTimeString()}`,
      created_at: new Date().toISOString(),
      cleared: false,
      synced: false,
    });
    
    console.log(`✅ Added test notification: ${id}`);
  },

  /**
   * Delete all local data (hard reset - be careful!)
   */
  async hardReset() {
    if (confirm('⚠️ This will DELETE all local data. Are you sure?')) {
      await db.delete();
      await db.open();
      console.log('🗑️ Hard reset complete. Reload the page.');
    }
  },

  /**
   * Verify all data status (comprehensive check)
   */
  async verifyAll() {
    return verifyAllData();
  },

  /**
   * Force sync all unsynced data to Supabase
   */
  async forceSync() {
    return forceSyncAll();
  },

  /**
   * Mark all local data as unsynced (for testing)
   */
  async markUnsynced() {
    return markAllAsUnsynced();
  },

  /**
   * Show all sales data with sync status
   */
  async showSales() {
    return debugSalesData();
  }
  };

// Expose to window for console access
declare global {
  interface Window {
    debugSync: typeof debugSync;
  }
}

if (typeof window !== 'undefined') {
  (window as any).debugSync = debugSync;
}
