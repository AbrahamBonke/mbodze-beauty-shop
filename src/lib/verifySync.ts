import { db } from './db';
import { performFullSync } from './sync';

/**
 * VERIFICATION & DEBUGGING
 * 
 * Run these in the browser console to verify sync status
 */

export async function verifyAllData() {
  console.log('\n==================== FULL DATA VERIFICATION ====================\n');

  // Count all records
  const productCount = await db.products.count();
  const saleCount = await db.sales.count();
  const notificationCount = await db.notifications.count();
  const settingCount = await db.settings.count();

  console.log('📊 TOTAL RECORDS:');
  console.log(`   Products: ${productCount}`);
  console.log(`   Sales: ${saleCount}`);
  console.log(`   Notifications: ${notificationCount}`);
  console.log(`   Settings: ${settingCount}`);

  // Check unsynced records
  const unsyncedProducts = await db.products.filter(p => p.synced === false).toArray();
  const unsyncedSales = await db.sales.filter(s => s.synced === false).toArray();
  const unsyncedNotifications = await db.notifications.filter(n => n.synced === false).toArray();
  const unsyncedSettings = await db.settings.filter(s => s.synced === false).toArray();

  console.log('\n❌ UNSYNCED RECORDS:');
  console.log(`   Unsynced Products: ${unsyncedProducts.length}`);
  if (unsyncedProducts.length > 0) {
    unsyncedProducts.forEach(p => {
      console.log(`     - ${p.name} (${p.id})`);
    });
  }

  console.log(`   Unsynced Sales: ${unsyncedSales.length}`);
  if (unsyncedSales.length > 0) {
    unsyncedSales.forEach(s => {
      console.log(`     - Sale ${s.id} (${s.product_name} x${s.quantity_sold})`);
    });
  }

  console.log(`   Unsynced Notifications: ${unsyncedNotifications.length}`);
  console.log(`   Unsynced Settings: ${unsyncedSettings.length}`);

  // Check pending mutations
  const pendingMutations = await db.mutations.filter(m => m.status === 'pending').toArray();
  const syncedMutations = await db.mutations.filter(m => m.status === 'synced').toArray();
  const failedMutations = await db.mutations.filter(m => m.status === 'failed').toArray();

  console.log('\n📋 MUTATIONS:');
  console.log(`   Pending: ${pendingMutations.length}`);
  if (pendingMutations.length > 0) {
    pendingMutations.forEach(m => {
      console.log(`     - ${m.operation} ${m.table}/${m.recordId}`);
    });
  }

  console.log(`   Synced: ${syncedMutations.length}`);
  console.log(`   Failed: ${failedMutations.length}`);
  if (failedMutations.length > 0) {
    failedMutations.forEach(m => {
      console.log(`     - ${m.operation} ${m.table}/${m.recordId}: ${m.lastError}`);
    });
  }

  // Network status
  console.log('\n🌐 NETWORK STATUS:');
  console.log(`   Online: ${navigator.onLine}`);

  // Sync meta
  const syncMeta = await db.syncMeta.get('sync_meta');
  console.log('\n⏰ SYNC METADATA:');
  console.log(`   Last Synced: ${syncMeta?.lastSyncedAt || 'Never'}`);
  console.log(`   Client ID: ${syncMeta?.clientId}`);

  console.log('\n==============================================================\n');
}

export async function forceSyncAll() {
  console.log('\n🔄 FORCING FULL SYNC TO SUPABASE...\n');
  const result = await performFullSync();
  console.log(result ? '✅ Sync successful' : '❌ Sync failed');
  await verifyAllData();
}

export async function markAllAsUnsynced() {
  console.log('\n⚠️  MARKING ALL DATA AS UNSYNCED AND ENQUEUEING MUTATIONS...\n');
  
  const products = await db.products.toArray();
  for (const p of products) {
    await db.products.update(p.id, { synced: false });
    
    // Also enqueue mutation
    const existingMutation = await db.mutations
      .filter(m => m.table === 'products' && m.recordId === p.id && m.status === 'pending')
      .first();
    
    if (!existingMutation) {
      await db.mutations.add({
        id: `init_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        clientId: localStorage.getItem('mbodze_client_id') || 'unknown',
        table: 'products',
        operation: 'UPDATE',
        recordId: p.id,
        payload: {
          name: p.name,
          category: p.category,
          buying_price: p.buying_price,
          selling_price: p.selling_price,
          quantity: p.quantity,
          low_stock_level: p.low_stock_level,
          updated_at: p.updated_at,
        },
        timestamp: Date.now(),
        status: 'pending',
        retries: 0,
      });
    }
  }
  console.log(`✅ Marked ${products.length} products as unsynced and enqueued mutations`);

  const sales = await db.sales.toArray();
  for (const s of sales) {
    await db.sales.update(s.id, { synced: false });
    
    // Also enqueue mutation
    const existingMutation = await db.mutations
      .filter(m => m.table === 'sales' && m.recordId === s.id && m.status === 'pending')
      .first();
    
    if (!existingMutation) {
      await db.mutations.add({
        id: `init_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        clientId: localStorage.getItem('mbodze_client_id') || 'unknown',
        table: 'sales',
        operation: 'INSERT',
        recordId: s.id,
        payload: {
          product_id: s.product_id,
          product_name: s.product_name,
          quantity_sold: s.quantity_sold,
          unit_price: s.unit_price,
          total_price: s.total_price,
          sale_date: s.sale_date,
          created_at: s.created_at,
        },
        timestamp: Date.now(),
        status: 'pending',
        retries: 0,
      });
    }
  }
  console.log(`✅ Marked ${sales.length} sales as unsynced and enqueued mutations`);

  const notifications = await db.notifications.toArray();
  for (const n of notifications) {
    await db.notifications.update(n.id, { synced: false });
  }
  console.log(`✅ Marked ${notifications.length} notifications as unsynced`);

  const settings = await db.settings.toArray();
  for (const s of settings) {
    await db.settings.update(s.id, { synced: false });
  }
  console.log(`✅ Marked ${settings.length} settings as unsynced`);

  console.log('\n✅ All data marked as unsynced with mutations queued. Will sync when online.');
}

export async function debugSalesData() {
  console.log('\n📋 SALES DATA DEBUG\n');
  
  const allSales = await db.sales.toArray();
  console.log(`Total sales: ${allSales.length}`);
  
  allSales.forEach((sale, index) => {
    console.log(`\nSale ${index + 1}:`);
    console.log(`  ID: ${sale.id}`);
    console.log(`  Product: ${sale.product_name}`);
    console.log(`  Quantity: ${sale.quantity_sold}`);
    console.log(`  Total: ${sale.total_price}`);
    console.log(`  Synced: ${sale.synced}`);
    console.log(`  Created: ${sale.created_at}`);
  });

  console.log('\n');
}

// Make available globally for console access
(window as any).verifyAllData = verifyAllData;
(window as any).forceSyncAll = forceSyncAll;
(window as any).markAllAsUnsynced = markAllAsUnsynced;
(window as any).debugSalesData = debugSalesData;

console.log('📊 Debug utilities loaded. Use:');
console.log('   verifyAllData() - Show all data status');
console.log('   forceSyncAll() - Force immediate sync');
console.log('   markAllAsUnsynced() - Mark all data for sync');
console.log('   debugSalesData() - Show sales details');
