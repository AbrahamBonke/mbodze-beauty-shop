/*
  # MBODZE'S BEAUTY SHOP - Sales & Stock Management System
  
  ## Overview
  Complete database schema for beauty shop management including products, sales tracking,
  and notification system with automatic stock alerts.
  
  ## 1. New Tables
  
  ### `products`
  Stores all product information including pricing, stock levels, and images
  - `id` (uuid, primary key) - Unique product identifier
  - `name` (text) - Product name
  - `category` (text) - Product category (e.g., cosmetics, hair care)
  - `buying_price` (decimal) - Purchase price from supplier
  - `selling_price` (decimal) - Retail price for customers
  - `quantity` (integer) - Current stock quantity
  - `low_stock_level` (integer) - Alert threshold (default 7)
  - `image_url` (text) - URL or path to product image
  - `created_at` (timestamp) - Record creation time
  - `updated_at` (timestamp) - Last modification time
  
  ### `sales`
  Records all sales transactions with product details
  - `id` (uuid, primary key) - Unique sale identifier
  - `product_id` (uuid, foreign key) - Reference to products table
  - `product_name` (text) - Product name snapshot at time of sale
  - `quantity_sold` (integer) - Number of units sold
  - `unit_price` (decimal) - Price per unit at time of sale
  - `total_price` (decimal) - Total transaction amount
  - `sale_date` (timestamp) - Date and time of sale
  - `created_at` (timestamp) - Record creation time
  
  ### `notifications`
  Manages system notifications for low stock and reports
  - `id` (uuid, primary key) - Unique notification identifier
  - `type` (text) - Notification type (low_stock, weekly_report, monthly_report)
  - `message` (text) - Notification content
  - `product_id` (uuid, nullable) - Related product for stock alerts
  - `cleared` (boolean) - Whether user has cleared the notification
  - `created_at` (timestamp) - When notification was generated
  
  ## 2. Security
  - Enable RLS on all tables
  - Policies allow authenticated users to manage all shop data
  - Public access denied by default
  
  ## 3. Important Notes
  - Low stock alerts trigger automatically when quantity ≤ 7
  - Weekly reports generate every Saturday
  - Monthly reports generate on last day of month
  - Product images stored as URLs (uploaded to Supabase Storage)
  - All prices stored as decimal for accuracy
*/

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  buying_price decimal(10,2) NOT NULL DEFAULT 0,
  selling_price decimal(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0,
  low_stock_level integer NOT NULL DEFAULT 7,
  image_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity_sold integer NOT NULL,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  sale_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  message text NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  cleared boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_quantity ON products(quantity);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_cleared ON notifications(cleared);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for products table
CREATE POLICY "Allow all operations on products for authenticated users"
  ON products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for sales table
CREATE POLICY "Allow all operations on sales for authenticated users"
  ON sales FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for notifications table
CREATE POLICY "Allow all operations on notifications for authenticated users"
  ON notifications FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on products
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to check and create low stock notifications
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if stock is at or below low_stock_level
  IF NEW.quantity <= NEW.low_stock_level AND NEW.quantity >= 0 THEN
    -- Check if notification already exists and not cleared
    IF NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE product_id = NEW.id
      AND type = 'low_stock'
      AND cleared = false
    ) THEN
      -- Create low stock notification
      INSERT INTO notifications (type, message, product_id, cleared)
      VALUES (
        'low_stock',
        'Low stock alert: ' || NEW.name || ' has only ' || NEW.quantity || ' items remaining',
        NEW.id,
        false
      );
    ELSE
      -- Update existing notification with current quantity
      UPDATE notifications
      SET message = 'Low stock alert: ' || NEW.name || ' has only ' || NEW.quantity || ' items remaining',
          created_at = now()
      WHERE product_id = NEW.id
      AND type = 'low_stock'
      AND cleared = false;
    END IF;
  ELSE
    -- If stock is above threshold, clear any existing low stock notifications
    UPDATE notifications
    SET cleared = true
    WHERE product_id = NEW.id
    AND type = 'low_stock'
    AND cleared = false;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check stock levels after insert or update
DROP TRIGGER IF EXISTS check_product_stock ON products;
CREATE TRIGGER check_product_stock
  AFTER INSERT OR UPDATE OF quantity ON products
  FOR EACH ROW
  EXECUTE FUNCTION check_low_stock();