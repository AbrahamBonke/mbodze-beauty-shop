import { db } from './db';
import { enqueueMutation } from './offlineQueue';
import { performFullSync } from './sync';

/**
 * INITIALIZATION SYNC
 * 
 * On app startup, check for any unsynced data (from offline sessions)
 * and enqueue mutations for sync to Supabase.
 * 
 * This ensures data loaded from Dexie on restart gets pushed to Supabase
 * when the user comes online.
 */

async function hasUnsyncedData(): Promise<boolean> {
  try {
    const unsyncedProducts = await db.products.where('synced').equals(false).count();
    const unsyncedSales = await db.sales.where('synced').equals(false).count();
    const unsyncedNotifications = await db.notifications.where('synced').equals(false).count();
    const unsyncedSettings = await db.settings.where('synced').equals(false).count();
    const pendingMutations = await db.mutations.where('status').equals('pending').count();

    return unsyncedProducts > 0 || unsyncedSales > 0 || unsyncedNotifications > 0 || unsyncedSettings > 0 || pendingMutations > 0;
  } catch (error) {
    console.warn('⚠️ Error checking unsynced data:', error);
    return false;
  }
}

export async function initializeSyncQueue() {
  try {
    console.log('🔄 Initializing sync queue for unsynced data...');

    let enqueuedCount = 0;

    // Check for unsynced products
    let unsyncedProducts: any[] = [];
    try {
      unsyncedProducts = await db.products.filter(p => p.synced === false).toArray();
    } catch (error) {
      console.warn('⚠️ Error querying unsynced products:', error);
      unsyncedProducts = [];
    }

    for (const product of unsyncedProducts) {
      // Check if mutation already exists for this product
      let existingMutation = null;
      try {
        existingMutation = await db.mutations
          .filter(m => m.table === 'products' && m.recordId === product.id && m.status === 'pending')
          .first();
      } catch (error) {
        existingMutation = null;
      }

      if (!existingMutation) {
        // Enqueue as UPDATE (could be insert or update, but UPDATE is safe for both)
        await enqueueMutation('products', 'UPDATE', product.id, {
          name: product.name,
          category: product.category,
          buying_price: product.buying_price,
          selling_price: product.selling_price,
          quantity: product.quantity,
          low_stock_level: product.low_stock_level,
          image_url: product.image_url,
          updated_at: product.updated_at,
        });
        enqueuedCount++;
        console.log(`📝 Enqueued unsynced product: ${product.name}`);
      }
    }

    // Check for unsynced sales
    let unsyncedSales: any[] = [];
    try {
      unsyncedSales = await db.sales.filter(s => s.synced === false).toArray();
    } catch (error) {
      console.warn('⚠️ Error querying unsynced sales:', error);
      unsyncedSales = [];
    }

    for (const sale of unsyncedSales) {
      // Check if mutation already exists for this sale
      let existingMutation = null;
      try {
        existingMutation = await db.mutations
          .filter(m => m.table === 'sales' && m.recordId === sale.id && m.status === 'pending')
          .first();
      } catch (error) {
        existingMutation = null;
      }

      if (!existingMutation) {
        await enqueueMutation('sales', 'INSERT', sale.id, {
          product_id: sale.product_id,
          product_name: sale.product_name,
          quantity_sold: sale.quantity_sold,
          unit_price: sale.unit_price,
          total_price: sale.total_price,
          sale_date: sale.sale_date,
          created_at: sale.created_at,
        });
        enqueuedCount++;
        console.log(`📝 Enqueued unsynced sale: ${sale.id}`);
      }
    }

    // Check for unsynced notifications
    let unsyncedNotifications: any[] = [];
    try {
      unsyncedNotifications = await db.notifications.filter(n => n.synced === false).toArray();
    } catch (error) {
      console.warn('⚠️ Error querying unsynced notifications:', error);
      unsyncedNotifications = [];
    }

    for (const notification of unsyncedNotifications) {
      let existingMutation = null;
      try {
        existingMutation = await db.mutations
          .filter(m => m.table === 'notifications' && m.recordId === notification.id && m.status === 'pending')
          .first();
      } catch (error) {
        existingMutation = null;
      }

      if (!existingMutation) {
        await enqueueMutation('notifications', 'INSERT', notification.id, {
          type: notification.type,
          message: notification.message,
          product_id: notification.product_id,
          created_at: notification.created_at,
          cleared: notification.cleared,
        });
        enqueuedCount++;
        console.log(`📝 Enqueued unsynced notification: ${notification.id}`);
      }
    }

    // Check for unsynced settings
    let unsyncedSettings: any[] = [];
    try {
      unsyncedSettings = await db.settings.filter(s => s.synced === false).toArray();
    } catch (error) {
      console.warn('⚠️ Error querying unsynced settings:', error);
      unsyncedSettings = [];
    }

    for (const setting of unsyncedSettings) {
      let existingMutation = null;
      try {
        existingMutation = await db.mutations
          .filter(m => m.table === 'settings' && m.recordId === setting.id && m.status === 'pending')
          .first();
      } catch (error) {
        existingMutation = null;
      }

      if (!existingMutation) {
        await enqueueMutation('settings', 'UPDATE', setting.id, {
          key: setting.key,
          value: setting.value,
          updated_at: setting.updated_at,
        });
        enqueuedCount++;
        console.log(`📝 Enqueued unsynced setting: ${setting.key}`);
      }
    }

    // Count pending mutations
    let pendingMutations = 0;
    try {
      pendingMutations = await db.mutations.where('status').equals('pending').count();
    } catch (error) {
      pendingMutations = 0;
    }

    console.log(`📝 Enqueued: ${enqueuedCount} | Pending mutations: ${pendingMutations}`);

    if (enqueuedCount > 0 || pendingMutations > 0) {
      console.log(`✅ Found ${enqueuedCount + pendingMutations} total items to sync`);
      console.log('📡 Attempting to sync with Supabase now if online...');
      
      // Try to sync immediately if online
      if (navigator.onLine) {
        try {
          console.log('🌐 Online detected - attempting immediate sync...');
          const syncSuccess = await performFullSync();
          if (syncSuccess) {
            console.log('✅ Sync successful on startup!');
          } else {
            console.log('⚠️ Sync attempted but encountered errors. Will retry when fully online.');
          }
        } catch (syncError) {
          console.warn('⚠️ Could not sync immediately. Will retry when online.', syncError);
        }
      } else {
        console.log('📴 Offline on startup. Data will sync when connection is restored.');
      }
    } else {
      console.log('✅ All data is already synced or queued');
    }

    return enqueuedCount;
  } catch (error) {
    console.error('❌ Error initializing sync queue:', error);
    return 0;
  }
}

export async function checkAndSyncUnsyncedData() {
  const hasUnsynced = await hasUnsyncedData();
  if (hasUnsynced) {
    console.log('🔔 Unsynced data detected - triggering sync...');
    return performFullSync();
  }
  return true;
}
