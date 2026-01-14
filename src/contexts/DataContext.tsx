import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { db } from '../lib/db';
import { initializeSyncQueue, checkAndSyncUnsyncedData } from '../lib/initializeSync';
import { watchOnlineStatus } from '../lib/sync';
import type { LocalProduct, LocalSale } from '../lib/db';

interface DataContextType {
  products: LocalProduct[];
  sales: LocalSale[];
  productsLoaded: boolean;
  salesLoaded: boolean;
  reloadProducts: () => Promise<void>;
  reloadSales: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [sales, setSales] = useState<LocalSale[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [salesLoaded, setSalesLoaded] = useState(false);

  // Load all critical data on app startup (only once)
  useEffect(() => {
    const initializeData = async () => {
      try {
        console.log('📦 Initializing data from local DB on app startup');
        
        // Load products
        const localProducts = await db.products.toArray();
        const sortedProducts = localProducts.sort((a, b) => a.name.localeCompare(b.name));
        setProducts(sortedProducts);
        setProductsLoaded(true);
        console.log(`✅ Loaded ${localProducts.length} products`);

        // Load sales
        const localSales = await db.sales.toArray();
        setSales(localSales);
        setSalesLoaded(true);
        console.log(`✅ Loaded ${localSales.length} sales`);

        // Initialize sync queue: enqueue any unsynced data for sync to Supabase
        // This ensures that if user was offline and created data, it gets synced when online
        const unsyncedCount = await initializeSyncQueue();
        
        // Also watch for online status and trigger sync when coming online
        const unsubscribe = watchOnlineStatus((isOnline) => {
          if (isOnline) {
            console.log('🌐 Online status detected - checking for unsynced data');
            checkAndSyncUnsyncedData().catch(err => 
              console.error('Error syncing unsynced data:', err)
            );
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error('❌ Error initializing data:', error);
        setProductsLoaded(true);
        setSalesLoaded(true);
      }
    };

    initializeData();
  }, []);

  // Function to reload products (for when data changes)
  const reloadProducts = async () => {
    try {
      const localProducts = await db.products.toArray();
      const sortedProducts = localProducts.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(sortedProducts);
      console.log(`🔄 Reloaded ${localProducts.length} products`);
    } catch (error) {
      console.error('❌ Error reloading products:', error);
    }
  };

  // Function to reload sales (for when data changes)
  const reloadSales = async () => {
    try {
      const localSales = await db.sales.toArray();
      setSales(localSales);
      console.log(`🔄 Reloaded ${localSales.length} sales`);
    } catch (error) {
      console.error('❌ Error reloading sales:', error);
    }
  };

  return (
    <DataContext.Provider
      value={{
        products,
        sales,
        productsLoaded,
        salesLoaded,
        reloadProducts,
        reloadSales,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
