$headers = @{
    "Authorization" = "Bearer sb_secret_i1x1ZmDX6jt1GZ5UqHAXIA_nUxUgQ80"
    "Content-Type" = "application/json"
    "apikey" = "sb_secret_i1x1ZmDX6jt1GZ5UqHAXIA_nUxUgQ80"
}

$sql = @"
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
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  message text NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  cleared boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
"@

$body = @{ query = $sql } | ConvertTo-Json -Depth 10

Write-Host "🔧 Applying schema to new Supabase project..."
Write-Host "📡 Sending request to Supabase SQL API..."

try {
    $response = Invoke-WebRequest -Uri "https://fnvyevxvktbgjaxzdwoh.supabase.co/rest/v1/rpc/sql" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "✅ Migration successful!"
    Write-Host $response.Content
} catch {
    Write-Host "⚠️ RPC endpoint returned error (this is expected for Supabase Free tier)"
    Write-Host "Error: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "✨ Manual migration required:"
    Write-Host "1. Open Supabase dashboard: https://app.supabase.com/project/fnvyevxvktbgjaxzdwoh"
    Write-Host "2. Go to SQL Editor"
    Write-Host "3. Click 'New Query'"
    Write-Host "4. Copy-paste content from: supabase/migrations/20260110073604_create_beauty_shop_schema.sql"
    Write-Host "5. Click 'RUN' button"
    Write-Host ""
    Write-Host "Or use Supabase CLI:"
    Write-Host "  supabase db push --db-url postgresql://... < supabase/migrations/20260110073604_create_beauty_shop_schema.sql"
}
