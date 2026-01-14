import { createClient } from '@supabase/supabase-js';

// Using provided project credentials (replace with env vars if preferred)
const supabaseUrl = 'https://fnvyevxvktbgjaxzdwoh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudnlldnh2a3RiZ2pheHpkd29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMTQxNjMsImV4cCI6MjA4Mzc5MDE2M30.ZJBG4OHmnlK8bn9dIKzXIJm3VYj7DoI6CazRyKJ7uZ8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Disable auto-refresh when offline to prevent retry loops
    autoRefreshToken: navigator.onLine,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export interface Product {
  id: string;
  name: string;
  category: string;
  buying_price: number;
  selling_price: number;
  quantity: number;
  low_stock_level: number;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity_sold: number;
  unit_price: number;
  total_price: number;
  sale_date: string;
  created_at: string;
}

export interface Notification {
  id: string;
  type: 'low_stock' | 'weekly_report' | 'monthly_report';
  message: string;
  product_id: string | null;
  cleared: boolean;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
