import Dexie, { Table } from 'dexie';

/**
 * LOCAL OFFLINE DATABASE (Dexie)
 * 
 * This is a completely separate database from Supabase.
 * It mirrors the Supabase tables locally for offline access.
 * 
 * NO INTERFERENCE with Supabase — this is read-only sync from Supabase,
 * and push-only sync to Supabase.
 */

export interface LocalProduct {
  id: string;
  name: string;
  category: string;
  buying_price: number;
  selling_price: number;
  quantity: number;
  low_stock_level: number;
  image_url?: string;
  image_id?: string; // Reference to local image metadata
  created_at: string;
  updated_at: string;
  synced: boolean; // Has this been synced to Supabase?
  lastSyncedAt?: string;
}

export interface LocalSale {
  id: string;
  product_id: string;
  product_name: string;
  quantity_sold: number;
  unit_price: number;
  total_price: number;
  sale_date: string;
  created_at: string;
  synced: boolean;
  lastSyncedAt?: string;
}

export interface LocalNotification {
  id: string;
  type: 'low_stock' | 'weekly_report' | 'monthly_report' | 'info';
  message: string;
  product_id?: string;
  created_at: string;
  cleared: boolean;
  synced: boolean;
}

export interface LocalSetting {
  id: string;
  key: string;
  value: any;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface LocalImageMetadata {
  id: string;
  product_id: string;
  filename: string;
  local_path: string; // File system path
  hash: string; // SHA256 hash for change detection
  remote_url?: string; // After sync to Supabase Storage
  blob?: Blob; // Local image blob (fallback when File System API unavailable)
  size: number;
  mimetype: string;
  created_at: string;
  synced: boolean;
  lastSyncedAt?: string;
}

export interface MutationRecord {
  id: string; // UUID
  clientId: string; // Device/shop ID
  table: 'products' | 'sales' | 'notifications' | 'settings' | 'images';
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  recordId: string;
  payload: Record<string, any>;
  timestamp: number;
  status: 'pending' | 'synced' | 'failed';
  retries: number;
  lastError?: string;
}

export interface SyncMetadata {
  key: string; // Always 'sync_meta'
  lastSyncedAt: string;
  lastSyncedProductAt?: string;
  lastSyncedSaleAt?: string;
  clientId: string; // Unique identifier for this shop/device
  offlineMode: boolean;
}

export class BeautyShopDB extends Dexie {
  products!: Table<LocalProduct>;
  sales!: Table<LocalSale>;
  notifications!: Table<LocalNotification>;
  settings!: Table<LocalSetting>;
  images!: Table<LocalImageMetadata>;
  mutations!: Table<MutationRecord>;
  syncMeta!: Table<SyncMetadata>;

  constructor() {
    super('mbodze_beauty_shop_local');
    this.version(1).stores({
      products: '&id, synced, updated_at',
      sales: '&id, product_id, sale_date, synced',
      notifications: '&id, product_id, created_at, cleared',
      settings: '&id, key, synced',
      images: '&id, product_id, synced',
      mutations: '&id, status, table, timestamp',
      syncMeta: '&key',
    });
  }

  /**
   * Initialize sync metadata on first run
   */
  async initializeSyncMeta(clientId: string) {
    const existing = await this.syncMeta.get('sync_meta');
    if (!existing) {
      await this.syncMeta.put({
        key: 'sync_meta',
        lastSyncedAt: new Date(0).toISOString(), // Epoch — sync all
        clientId,
        offlineMode: false,
      });
    }
    return existing || { key: 'sync_meta', clientId, offlineMode: false };
  }

  /**
   * Get or create client ID (unique per shop)
   */
  static getOrCreateClientId(): string {
    const storageKey = 'mbodze_client_id';
    let clientId = localStorage.getItem(storageKey);
    if (!clientId) {
      clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(storageKey, clientId);
    }
    return clientId;
  }
}

export const db = new BeautyShopDB();

/**
 * Initialize the local database on app start
 */
export async function initializeLocalDB() {
  try {
    const clientId = BeautyShopDB.getOrCreateClientId();
    await db.initializeSyncMeta(clientId);
    console.log('✅ Local database initialized. Client ID:', clientId);
  } catch (error) {
    console.error('❌ Error initializing local database:', error);
  }
}
