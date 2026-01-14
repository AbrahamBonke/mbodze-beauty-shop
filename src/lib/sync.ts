import { db } from './db';
import { getPendingMutations, markMutationSynced, markMutationFailed, clearSyncedMutations } from './offlineQueue';
import { supabase } from './supabase';
import { syncImagesToSupabase } from './imageSyncManager';
import { v4 as uuidv4 } from 'uuid';

/**
 * SYNC ENGINE
 *
 * Handles bi-directional sync between local Dexie DB and Supabase.
 *
 * ARCHITECTURE:
 * - LOCAL DB (Dexie) = Source of truth for UI and offline operations
 * - REMOTE DB (Supabase) = Server source of truth for multi-device access
 *
 * SYNC STRATEGY:
 * 1. On ONLINE: Pull all remote products/sales into local DB (merge, don't replace)
 * 2. Push any pending mutations (local changes) to Supabase
 * 3. Shop computer always reads from local Dexie (works offline or online)
 * 4. Other devices read from Supabase web UI
 *
 * KEY RULE: Never clear local DB. Only merge new/updated records from server.
 */

const SYNC_DEBOUNCE_MS = 1000; // Reduced from 5000 for faster response
const AUTO_SYNC_INTERVAL_MS = 60000; // Auto-sync every 60 seconds when online

let syncInProgress = false;
let lastSyncAttempt = 0;
let autoSyncInterval: NodeJS.Timeout | null = null;

/**
 * Pull: Fetch all remote products and merge into local DB
 * Does NOT clear local products (preserves offline-created ones)
 */
export async function syncProductsFromSupabase() {
  try {
    console.log('📥 Pulling products from Supabase');

    const { data: products, error } = await supabase
      .from('products')
      .select('*');

    if (error) {
      // If remote table doesn't exist yet (new empty DB), treat as no remote products
      if ((error as any)?.code === 'PGRST205' || (error as any)?.message?.includes("Could not find the table")) {
        console.warn('⚠️ Remote products table not found — skipping pull');
        return true;
      }
      console.error('❌ Error pulling products:', error);
      return false;
    }

    if (products && products.length > 0) {
      // Merge remote products into local DB (don't clear)
      for (const product of products) {
        await db.products.put({
          id: product.id,
          name: product.name,
          category: product.category,
          buying_price: product.buying_price,
          selling_price: product.selling_price,
          quantity: product.quantity,
          low_stock_level: product.low_stock_level,
          image_url: product.image_url,
          created_at: product.created_at,
          updated_at: product.updated_at,
          synced: true,
          lastSyncedAt: new Date().toISOString(),
        });
      }
      console.log(`✅ Merged ${products.length} products from Supabase`);
    } else {
      console.log('✅ No products on remote server');
    }

    return true;
  } catch (error) {
    console.error('❌ Error syncing products:', error);
    return false;
  }
}

/**
 * Pull: Fetch all remote sales and merge into local DB
 * Does NOT clear local sales (preserves offline-created ones)
 */
export async function syncSalesFromSupabase() {
  try {
    console.log('📥 Pulling sales from Supabase');

    const { data: sales, error } = await supabase
      .from('sales')
      .select('*');

    if (error) {
      // If remote table doesn't exist yet (new empty DB), treat as no remote sales
      if ((error as any)?.code === 'PGRST205' || (error as any)?.message?.includes("Could not find the table")) {
        console.warn('⚠️ Remote sales table not found — skipping pull');
        return true;
      }
      console.error('❌ Error pulling sales:', error);
      return false;
    }

    if (sales && sales.length > 0) {
      // Merge remote sales into local DB (don't clear)
      for (const sale of sales) {
        await db.sales.put({
          id: sale.id,
          product_id: sale.product_id,
          product_name: sale.product_name,
          quantity_sold: sale.quantity_sold,
          unit_price: sale.unit_price,
          total_price: sale.total_price,
          sale_date: sale.sale_date,
          created_at: sale.created_at,
          synced: true,
          lastSyncedAt: new Date().toISOString(),
        });
      }
      console.log(`✅ Merged ${sales.length} sales from Supabase`);
    } else {
      console.log('✅ No sales on remote server');
    }

    return true;
  } catch (error) {
    console.error('❌ Error syncing sales:', error);
    return false;
  }
}

/**
 * Pull: Fetch all remote notifications and merge into local DB
 */
export async function syncNotificationsFromSupabase() {
  try {
    console.log('📥 Pulling notifications from Supabase');

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*');

    if (error) {
      if ((error as any)?.code === 'PGRST205' || (error as any)?.message?.includes("Could not find the table")) {
        console.warn('⚠️ Remote notifications table not found — skipping pull');
        return true;
      }
      console.error('❌ Error pulling notifications:', error);
      return false;
    }

    if (notifications && notifications.length > 0) {
      for (const notification of notifications) {
        console.log(`🔔 Storing notification ${notification.id}: ${notification.message} (cleared=${notification.cleared})`);
        await db.notifications.put({
          id: notification.id,
          type: notification.type,
          message: notification.message,
          product_id: notification.product_id,
          created_at: notification.created_at,
          cleared: notification.cleared,
          synced: true,
        });
      }
      console.log(`✅ Merged ${notifications.length} notifications from Supabase`);
      
      // Verify they were stored
      const stored = await db.notifications.toArray();
      console.log(`📊 Total notifications in local DB: ${stored.length}`);
    } else {
      console.log('✅ No notifications on remote server');
    }

    return true;
  } catch (error) {
    console.error('❌ Error syncing notifications:', error);
    return false;
  }
}

/**
 * Pull: Fetch all remote settings and merge into local DB
 */
export async function syncSettingsFromSupabase() {
  try {
    console.log('📥 Pulling settings from Supabase');

    const { data: settings, error } = await supabase
      .from('settings')
      .select('*');

    if (error) {
      if ((error as any)?.code === 'PGRST205' || (error as any)?.message?.includes("Could not find the table")) {
        console.warn('⚠️ Remote settings table not found — skipping pull');
        return true;
      }
      console.error('❌ Error pulling settings:', error);
      return false;
    }

    if (settings && settings.length > 0) {
      for (const setting of settings) {
        await db.settings.put({
          id: setting.id,
          key: setting.key,
          value: setting.value,
          created_at: setting.created_at,
          updated_at: setting.updated_at,
          synced: true,
        });
      }
      console.log(`✅ Merged ${settings.length} settings from Supabase`);
    } else {
      console.log('✅ No settings on remote server');
    }

    return true;
  } catch (error) {
    console.error('❌ Error syncing settings:', error);
    return false;
  }
}

/**
 * Push: Send pending mutations (inserts/updates/deletes) to Supabase
 * Returns idMappings for any offline-created records that got new UUIDs
 * 
 * CRITICAL HANDLING:
 * 1. First pass: Detect all local product IDs and generate UUIDs
 * 2. Update all sales that reference those local product IDs
 * 3. Second pass: Push all mutations with remapped IDs
 */
export async function pushPendingMutations(): Promise<{ success: boolean; idMappings: Record<string, string> }> {
  try {
    const mutations = await getPendingMutations();
    const idMappings: Record<string, string> = {}; // Map old local IDs to new UUIDs

    if (mutations.length === 0) {
      console.log('✅ No pending mutations to sync');
      return { success: true, idMappings };
    }

    console.log(`📤 Pushing ${mutations.length} pending mutations to Supabase`);

    // Quick remote schema check: if core tables don't exist yet, skip pushing and keep mutations local
    try {
      const { error: prodHeadErr } = await supabase.from('products').select('id', { head: true });
      if (prodHeadErr && ((prodHeadErr as any)?.code === 'PGRST205' || (prodHeadErr as any)?.message?.includes('Could not find the table'))) {
        console.warn('⚠️ Remote products table missing — aborting push. Mutations remain queued locally.');
        return { success: false, idMappings };
      }
    } catch (e) {
      // If the head check threw, assume table missing and abort push
      console.warn('⚠️ Remote schema check failed — aborting push.', e);
      return { success: false, idMappings };
    }

    // STEP 1: First pass - identify all local product IDs and generate UUIDs
    for (const mutation of mutations) {
      if (mutation.table === 'products' && mutation.operation === 'INSERT') {
        if (mutation.recordId.startsWith('local_')) {
          const remoteUUID = uuidv4();
          idMappings[mutation.recordId] = remoteUUID;
          console.log(
            `🔄 Pre-mapped offline product ${mutation.recordId} → ${remoteUUID}`
          );
        }
      }
    }

    // STEP 2: Update all sales mutations that reference local product IDs
    // This ensures payloads are updated with new UUIDs before sending
    for (const mutation of mutations) {
      if (mutation.table === 'sales') {
        // Check if this sale references a product with a local ID that got remapped
        const productId = mutation.payload?.product_id || mutation.payload?.['product_id'];
        if (productId && idMappings[productId]) {
          const newProductId = idMappings[productId];
          console.log(
            `🔄 Updating sale mutation payload: product ${productId} → ${newProductId}`
          );
          // Update the mutation payload with the new product ID
          mutation.payload.product_id = newProductId;
          // Also update in local DB to match
          if (mutation.recordId.startsWith('sale_')) {
            const sale = await db.sales.get(mutation.recordId);
            if (sale) {
              await db.sales.update(mutation.recordId, {
                product_id: newProductId,
              });
            }
          }
        }
      }
    }

    let syncedCount = 0;
    let failedCount = 0;

    // STEP 3: Second pass - push all mutations with proper IDs
    for (const mutation of mutations) {
      try {
        // Handle each mutation type
        if (mutation.table === 'products') {
          if (mutation.operation === 'INSERT') {
            // Check if this is an offline-created record (has "local_" prefix)
            const isLocalRecord = mutation.recordId.startsWith('local_');
            let finalPayload = { ...mutation.payload };

            if (isLocalRecord) {
              // Use pre-mapped UUID
              const remoteUUID = idMappings[mutation.recordId];
              finalPayload.id = remoteUUID;

              console.log(
                `📤 Inserting product with UUID: ${remoteUUID}`
              );

              // Remove the local ID field if it exists
              delete (finalPayload as any).synced;
            }

            const { error } = await supabase
              .from('products')
              .insert([finalPayload]);
            if (error) throw error;

            // If this was a local record, update the local DB with the new UUID
            if (isLocalRecord) {
              const newId = finalPayload.id;
              // Get the complete product record from local DB
              const localProduct = await db.products.get(mutation.recordId);
              if (localProduct) {
                // Delete old record with local ID
                await db.products.delete(mutation.recordId);
                // Add new record with proper UUID, keeping all fields from original
                await db.products.add({
                  ...localProduct,
                  id: newId,
                  synced: true,
                  lastSyncedAt: new Date().toISOString(),
                } as any);
                console.log(`✅ Updated local product ID: ${mutation.recordId} → ${newId}`);
              }
            } else {
              // For non-local records, just mark as synced
              await db.products.update(mutation.recordId, {
                synced: true,
                lastSyncedAt: new Date().toISOString(),
              });
            }
          } else if (mutation.operation === 'UPDATE') {
            // Skip UPDATE for records that still have local IDs (they haven't been inserted yet)
            if (mutation.recordId.startsWith('local_')) {
              console.log(`⏭️ Skipping UPDATE for local product ${mutation.recordId} (not yet inserted)`);
              await markMutationSynced(mutation.id);
              syncedCount++;
              continue;
            }
            // Use mapped UUID if available, otherwise use original recordId
            const recordId = idMappings[mutation.recordId] || mutation.recordId;
            const { error } = await supabase
              .from('products')
              .update(mutation.payload)
              .eq('id', recordId);
            if (error) throw error;
            
            // Mark as synced in local DB
            await db.products.update(recordId, {
              synced: true,
              lastSyncedAt: new Date().toISOString(),
            });
          } else if (mutation.operation === 'DELETE') {
            // Skip DELETE for records that still have local IDs
            if (mutation.recordId.startsWith('local_')) {
              console.log(`⏭️ Skipping DELETE for local product ${mutation.recordId}`);
              await markMutationSynced(mutation.id);
              syncedCount++;
              continue;
            }
            const recordId = idMappings[mutation.recordId] || mutation.recordId;
            const { error } = await supabase
              .from('products')
              .delete()
              .eq('id', recordId);
            if (error) throw error;
          }
        } else if (mutation.table === 'sales') {
           if (mutation.operation === 'INSERT') {
             const isLocalRecord = mutation.recordId.startsWith('sale_');
             let finalPayload = { ...mutation.payload };

             if (isLocalRecord) {
               const remoteUUID = uuidv4();
               finalPayload.id = remoteUUID;
               idMappings[mutation.recordId] = remoteUUID;

               console.log(
                 `📤 Inserting sale with UUID: ${remoteUUID}`
               );

               delete (finalPayload as any).synced;
             }

             const { error } = await supabase
               .from('sales')
               .insert([finalPayload]);
             if (error) throw error;

             if (isLocalRecord) {
               const newId = finalPayload.id;
               // Get the complete sale record from local DB
               const localSale = await db.sales.get(mutation.recordId);
               if (localSale) {
                 await db.sales.delete(mutation.recordId);
                 await db.sales.add({
                   ...localSale,
                   id: newId,
                   synced: true,
                   lastSyncedAt: new Date().toISOString(),
                 } as any);
                 console.log(`✅ Updated local sale ID: ${mutation.recordId} → ${newId}`);
               }
             } else {
               // For non-local records, just mark as synced
               await db.sales.update(mutation.recordId, {
                 synced: true,
                 lastSyncedAt: new Date().toISOString(),
               });
             }
           } else if (mutation.operation === 'UPDATE') {
             // Skip UPDATE for records that still have local IDs
             if (mutation.recordId.startsWith('sale_')) {
               console.log(`⏭️ Skipping UPDATE for local sale ${mutation.recordId} (not yet inserted)`);
               await markMutationSynced(mutation.id);
               syncedCount++;
               continue;
             }
             const recordId = idMappings[mutation.recordId] || mutation.recordId;
             const { error } = await supabase
               .from('sales')
               .update(mutation.payload)
               .eq('id', recordId);
             if (error) throw error;
             
             // Mark as synced in local DB
             await db.sales.update(recordId, {
               synced: true,
               lastSyncedAt: new Date().toISOString(),
             });
           } else if (mutation.operation === 'DELETE') {
             // Skip DELETE for records that still have local IDs
             if (mutation.recordId.startsWith('sale_')) {
               console.log(`⏭️ Skipping DELETE for local sale ${mutation.recordId}`);
               await markMutationSynced(mutation.id);
               syncedCount++;
               continue;
             }
             const recordId = idMappings[mutation.recordId] || mutation.recordId;
             const { error } = await supabase
               .from('sales')
               .delete()
               .eq('id', recordId);
             if (error) throw error;
           }
         } else if (mutation.table === 'notifications') {
           if (mutation.operation === 'INSERT') {
             const isLocalRecord = mutation.recordId.startsWith('notif_');
             let finalPayload = { ...mutation.payload };

             if (isLocalRecord) {
               const remoteUUID = uuidv4();
               finalPayload.id = remoteUUID;
               idMappings[mutation.recordId] = remoteUUID;
               console.log(`📤 Inserting notification with UUID: ${remoteUUID}`);
               delete (finalPayload as any).synced;
             }

             const { error } = await supabase
               .from('notifications')
               .insert([finalPayload]);
             if (error) throw error;

             if (isLocalRecord) {
               const newId = finalPayload.id;
               const localNotif = await db.notifications.get(mutation.recordId);
               if (localNotif) {
                 await db.notifications.delete(mutation.recordId);
                 await db.notifications.add({
                   ...localNotif,
                   id: newId,
                   synced: true,
                 } as any);
                 console.log(`✅ Updated local notification ID: ${mutation.recordId} → ${newId}`);
               }
             }
           } else if (mutation.operation === 'UPDATE') {
             if (mutation.recordId.startsWith('notif_')) {
               console.log(`⏭️ Skipping UPDATE for local notification ${mutation.recordId}`);
               await markMutationSynced(mutation.id);
               syncedCount++;
               continue;
             }
             const recordId = idMappings[mutation.recordId] || mutation.recordId;
             const { error } = await supabase
               .from('notifications')
               .update(mutation.payload)
               .eq('id', recordId);
             if (error) throw error;
           } else if (mutation.operation === 'DELETE') {
             if (mutation.recordId.startsWith('notif_')) {
               console.log(`⏭️ Skipping DELETE for local notification ${mutation.recordId}`);
               await markMutationSynced(mutation.id);
               syncedCount++;
               continue;
             }
             const recordId = idMappings[mutation.recordId] || mutation.recordId;
             const { error } = await supabase
               .from('notifications')
               .delete()
               .eq('id', recordId);
             if (error) throw error;
           }
         } else if (mutation.table === 'settings') {
           if (mutation.operation === 'INSERT') {
             const isLocalRecord = mutation.recordId.startsWith('setting_');
             let finalPayload = { ...mutation.payload };

             if (isLocalRecord) {
               const remoteUUID = uuidv4();
               finalPayload.id = remoteUUID;
               idMappings[mutation.recordId] = remoteUUID;
               console.log(`📤 Inserting setting with UUID: ${remoteUUID}`);
               delete (finalPayload as any).synced;
             }

             const { error } = await supabase
               .from('settings')
               .insert([finalPayload]);
             if (error) throw error;

             if (isLocalRecord) {
               const newId = finalPayload.id;
               const localSetting = await db.settings.get(mutation.recordId);
               if (localSetting) {
                 await db.settings.delete(mutation.recordId);
                 await db.settings.add({
                   ...localSetting,
                   id: newId,
                   synced: true,
                 } as any);
                 console.log(`✅ Updated local setting ID: ${mutation.recordId} → ${newId}`);
               }
             }
           } else if (mutation.operation === 'UPDATE') {
             if (mutation.recordId.startsWith('setting_')) {
               console.log(`⏭️ Skipping UPDATE for local setting ${mutation.recordId}`);
               await markMutationSynced(mutation.id);
               syncedCount++;
               continue;
             }
             const recordId = idMappings[mutation.recordId] || mutation.recordId;
             const { error } = await supabase
               .from('settings')
               .update(mutation.payload)
               .eq('id', recordId);
             if (error) throw error;
           } else if (mutation.operation === 'DELETE') {
             if (mutation.recordId.startsWith('setting_')) {
               console.log(`⏭️ Skipping DELETE for local setting ${mutation.recordId}`);
               await markMutationSynced(mutation.id);
               syncedCount++;
               continue;
             }
             const recordId = idMappings[mutation.recordId] || mutation.recordId;
             const { error } = await supabase
               .from('settings')
               .delete()
               .eq('id', recordId);
             if (error) throw error;
           }
         }

        // Only mark and increment if we didn't skip above (via continue)
        await markMutationSynced(mutation.id);
        syncedCount++;
      } catch (error) {
        console.error(`⚠️ Failed to sync mutation ${mutation.id}:`, error);
        await markMutationFailed(mutation.id, String(error));
        failedCount++;
      }
    }

    await clearSyncedMutations();

    console.log(
      `✅ Push complete: ${syncedCount} succeeded, ${failedCount} failed`
    );

    return { success: failedCount === 0, idMappings };
  } catch (error) {
    console.error('❌ Error pushing mutations:', error);
    return { success: false, idMappings: {} };
  }
}

/**
 * After syncing, update any sales that reference remapped product IDs
 * This happens when products are created offline, get new UUIDs when synced,
 * and sales created offline need to be updated with the new product UUIDs
 */
export async function updateRemappedReferences(idMappings: Record<string, string>) {
  if (Object.keys(idMappings).length === 0) {
    return;
  }

  console.log('🔄 Updating remapped product references in sales...');

  try {
    const allSales = await db.sales.toArray();

    for (const sale of allSales) {
      // If this sale references an old product ID that got remapped
      if (idMappings[sale.product_id]) {
        const newProductId = idMappings[sale.product_id];
        console.log(
          `🔄 Updating sale ${sale.id}: product ${sale.product_id} → ${newProductId}`
        );

        // Update the sale to use the new product ID
        await db.sales.update(sale.id, {
          product_id: newProductId,
        });

        // Queue an UPDATE mutation to sync this change
        await db.mutations.add({
          id: `remap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          clientId: localStorage.getItem('mbodze_client_id') || 'unknown',
          table: 'sales',
          operation: 'UPDATE',
          recordId: sale.id,
          payload: { product_id: newProductId },
          timestamp: Date.now(),
          status: 'pending',
          retries: 0,
        });
      }
    }

    console.log('✅ Remapped references updated');
  } catch (error) {
    console.error('❌ Error updating remapped references:', error);
  }
}

/**
 * MAIN SYNC: Pull from server + Push pending changes
 * Debounced to prevent rapid consecutive syncs
 */
export async function performFullSync(): Promise<boolean> {
  // Debounce check
  const now = Date.now();
  if (now - lastSyncAttempt < SYNC_DEBOUNCE_MS) {
    console.log('⏱️ Sync debounced, waiting', SYNC_DEBOUNCE_MS, 'ms');
    return false;
  }

  if (syncInProgress) {
    console.log('⏳ Sync already in progress');
    return false;
  }

  syncInProgress = true;
  lastSyncAttempt = now;

  try {
    console.log('\n🔄 === STARTING FULL SYNC ===');

    // Pull phase: Merge remote data into local DB
    const pullProducts = await syncProductsFromSupabase();
    const pullSales = await syncSalesFromSupabase();
    const pullNotifications = await syncNotificationsFromSupabase();
    const pullSettings = await syncSettingsFromSupabase();

    // Push phase: Send pending mutations to Supabase
    const pushResult = await pushPendingMutations();

    // Image sync phase: Upload unsynced images to Supabase Storage
    const imageSyncedCount = await syncImagesToSupabase();

    // Update references if any product IDs were remapped
    if (Object.keys(pushResult.idMappings).length > 0) {
      await updateRemappedReferences(pushResult.idMappings);
    }

    // Update sync timestamp
    await db.syncMeta.update('sync_meta', {
      lastSyncedAt: new Date().toISOString(),
    });

    const success = pullProducts && pullSales && pullNotifications && pullSettings && pushResult.success;
    console.log(
      `\n✅ === SYNC ${success ? 'SUCCESSFUL' : 'COMPLETED WITH ERRORS'} ===\n`
    );

    return success;
  } catch (error) {
    console.error('❌ Sync failed:', error);
    return false;
  } finally {
    syncInProgress = false;
  }
}

/**
 * Start automatic periodic syncing when online
 */
function startAutoSync() {
  if (autoSyncInterval) {
    return; // Already running
  }

  console.log('⏲️ Starting auto-sync interval (every 60 seconds)');
  autoSyncInterval = setInterval(async () => {
    if (navigator.onLine && !syncInProgress) {
      console.log('⏰ Auto-sync triggered');
      performFullSync();
    }
  }, AUTO_SYNC_INTERVAL_MS);
}

/**
 * Stop automatic periodic syncing
 */
function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
    console.log('⏹️ Stopped auto-sync interval');
  }
}

/**
 * Watch online/offline status and auto-sync when coming online
 */
export function watchOnlineStatus(onStatusChange?: (isOnline: boolean) => void) {
  let syncScheduled = false;

  const attemptSync = async () => {
    // Verify network is actually accessible before syncing
    try {
      // Quick connectivity check - if this fails, we're not truly online yet
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000); // Reduced from 2000ms
      
      await fetch('/index.html', {
        method: 'HEAD',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      // Network confirmed online, now sync
      console.log('✅ Network connectivity confirmed - starting sync');
      performFullSync();
    } catch (error) {
      console.warn('⚠️ Network check failed, waiting before retry:', error);
      // Network still unstable, retry in 1 second
      if (!syncScheduled) {
        syncScheduled = true;
        setTimeout(() => {
          syncScheduled = false;
          if (navigator.onLine) {
            attemptSync();
          }
        }, 1000); // Reduced from 3000ms
      }
    }
  };

  const handleOnline = async () => {
    console.log('🌐 ONLINE event detected - verifying network stability');
    onStatusChange?.(true);
    
    // Start periodic auto-sync when online
    startAutoSync();
    
    // Attempt sync immediately, then again in 100ms if first attempt fails
    attemptSync();
    setTimeout(() => {
      if (navigator.onLine && !syncScheduled) {
        attemptSync();
      }
    }, 100);
  };

  const handleOffline = () => {
    console.log('📴 OFFLINE - mutations will queue locally');
    syncScheduled = false;
    stopAutoSync();
    onStatusChange?.(false);
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Also check initial state on mount - might already be online
  if (navigator.onLine) {
    startAutoSync();
    // Check immediately
    attemptSync();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    stopAutoSync();
  };
}

/**
 * Get current sync status for UI display
 */
export async function getSyncStatus() {
  const meta = await db.syncMeta.get('sync_meta');
  const pendingMutations = await db.mutations
    .where('status')
    .equals('pending')
    .count();

  return {
    lastSyncedAt: meta?.lastSyncedAt,
    isOnline: navigator.onLine,
    hasPendingSync: pendingMutations > 0,
    pendingMutationsCount: pendingMutations,
    syncInProgress,
  };
}
