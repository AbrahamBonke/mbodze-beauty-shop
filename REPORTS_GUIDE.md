# Reports - Complete Guide

## Overview

The Reports section now provides comprehensive analytics for managing your beauty shop business. All data is calculated from your local database (works offline) with automatic profit calculations.

## Key Features

### 1. Summary Cards (Top Section)
- **Total Revenue**: All money from sales
- **Total Profit**: Actual profit (Revenue - Cost of Goods Sold)
- **Profit Margin**: Percentage profit relative to revenue
- **Items Sold**: Total quantity of items sold
- **Transactions**: Number of sales transactions

### 2. Top Selling Products
Shows the 5 best-performing products by quantity sold, with profit earned from each.

### 3. Slow Selling Products
Shows products with lowest sales volume - helps identify inventory that's not moving.

### 4. Profit by Product (NEW)
Detailed table showing:
- **Product Name**: Name of the product
- **Profit**: Total profit earned from this product
- **Profit Margin**: Profit percentage (higher is better for your business)

Sorted by highest profit first - lets you see which products make you the most money.

### 5. Sales by Time (NEW)
Detailed daily breakdown showing:
- **Date**: When the sale occurred
- **Items Sold**: Quantity sold that day
- **Revenue**: Money collected that day
- **Profit**: Actual profit that day

Perfect for tracking daily business performance.

## How Profit is Calculated

```
Profit = Revenue - (Buying Price × Quantity Sold)
Margin % = (Profit / Revenue) × 100
```

Example:
- Product: Hair Cream
- Bought at: KSh 200 each
- Sold at: KSh 500 each
- Sold: 10 units

Calculation:
- Revenue: 500 × 10 = KSh 5,000
- Cost: 200 × 10 = KSh 2,000
- Profit: 5,000 - 2,000 = KSh 3,000
- Margin: (3,000 / 5,000) × 100 = 60%

## Report Types

### Daily Reports
Shows today's sales, revenue, and profit

### Weekly Reports
Shows the entire week's combined data

### Monthly Reports
Shows the entire month's combined data

## Using Reports for Management

### Identify Best Sellers
- Look at "Top Selling Products" 
- Check "Profit by Product" to see which make most money
- A high-volume product with low margin might not be as profitable as a low-volume product with high margin

### Manage Inventory
- Low-selling products in "Slow Selling Products" might need:
  - Marketing push
  - Price reduction
  - Removal from inventory

### Daily Management
- Check "Sales by Time" to see:
  - Best performing days
  - Seasonal trends
  - Time patterns for restocking

### Pricing Strategy
- Products with low profit margins might need price adjustment
- Products with high margins might have pricing power

## Offline-First Features

All reports work completely offline:
- ✅ No internet required
- ✅ All data from local database
- ✅ Works on low connectivity areas
- ✅ Fast calculations
- ✅ No server latency

When online:
- Data syncs with Supabase
- Reports stay consistent across devices (after sync)
- Manual "Sync Now" available in offline indicator

## Data Freshness

Reports calculate from all sales in your local database:
- Synced data (from Supabase)
- Unsaved/offline data (not yet synced)
- All calculations happen instantly

To ensure latest data:
1. Check "Online" status in top-right
2. If offline, your local sales will be included in reports
3. When online, sync happens automatically every 60 seconds

## Example Insights

### Profitable Product Mix
```
Product A:  KSh 1,000 profit  (50% margin) - Premium item
Product B:  KSh 500 profit    (40% margin) - Good seller
Product C:  KSh 200 profit    (20% margin) - Budget option
```

Focus on Product A for expansion, but keep Products B & C for volume.

### Daily Trend Analysis
```
Monday:   KSh 5,000 profit
Tuesday:  KSh 3,000 profit
Saturday: KSh 8,000 profit (Weekend spike!)
```

Insight: Stock up for weekends, maintain lighter inventory mid-week.

## Tips for Better Reports

1. **Always record buying prices** when adding products
2. **Record sale prices accurately** when making sales
3. **Sync regularly** so data is consistent across devices
4. **Check reports weekly** to track business trends
5. **Compare monthly reports** to see growth over time

## Troubleshooting

**Profit shows negative?**
- Check that buying price is less than selling price
- Verify sale price was recorded correctly

**No data in reports?**
- Ensure you have sales recorded
- Check date range matches your sales dates
- Verify products have buying prices entered

**Different results on different devices?**
- Sync might be pending
- Click "Sync Now" to ensure all data is synced
- Wait for automatic sync (60-second interval)

## Report Accuracy

Reports are 100% accurate because they:
1. Calculate directly from database sales records
2. Use actual buying prices from product data
3. Include all unsaved/offline sales
4. Update instantly when new sales are added
5. Work offline - no server latency or sync delays
