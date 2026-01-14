# Testing Offline-to-Online Sync with UUID Remapping

## Step 1: Clear Local Data
1. Open DevTools (F12)
2. Go to Application → Storage → IndexedDB → mbodze_beauty_shop
3. Delete all object stores (products, sales, mutations, notifications, syncMeta)
4. Or click "Clear all" if available
5. Refresh the page

## Step 2: Go Offline
1. In DevTools, go to Network tab
2. At the top, find the dropdown that says "No throttling" or "Online"
3. Change it to "Offline"
4. OR use the menu: DevTools → Network → Offline checkbox

## Step 3: Create Test Data
1. Go to Products tab
2. Click "Add New Product"
3. Fill in:
   - Name: "Test Product Offline"
   - Category: "Hair Care"
   - Buying Price: 100
   - Selling Price: 200
   - Quantity: 50
   - Low Stock: 5
4. Click Add
5. **Verify in Console**: Should see something like:
   ```
   ✅ Product added locally: local_[timestamp]_[random]
   📤 Queued INSERT mutation for product
   ```

## Step 4: Create a Sale with That Product
1. Go to Sales tab
2. Select the "Test Product Offline" from the dropdown
3. Enter Quantity: 5
4. Click "Process Sale"
5. **Verify in Console**: Should see:
   ```
   ✅ Sale completed locally: sale_[timestamp]_[random]
   📤 Queued mutations: product update + sale insert
   ```

## Step 5: Go Back Online
1. In DevTools Network tab, change from "Offline" back to "Online" (or uncheck Offline)
2. **Watch the console** for the sync process:
   ```
   🌐 ONLINE - triggering auto-sync
   🔄 === STARTING FULL SYNC ===
   📥 Pulling products from Supabase
   📥 Pulling sales from Supabase
   📤 Pushing 2 pending mutations to Supabase
   🔄 Mapping offline product local_... → [UUID]
   ✅ Updated local product ID: local_... → [UUID]
   🔄 Mapping offline sale sale_... → [UUID]
   ✅ Updated local sale ID: sale_... → [UUID]
   🔄 Updating remapped product references in sales...
   🔄 Updating sale [UUID]: product [OLD_UUID] → [NEW_UUID]
   ✅ Remapped references updated
   ✅ Push complete: 3 succeeded, 0 failed
   ✅ === SYNC SUCCESSFUL ===
   ```

## Step 6: Verify in Supabase
1. Go to Supabase dashboard
2. Products table: Should see "Test Product Offline" with a proper UUID (not local_*)
3. Sales table: Should see the sale with:
   - Proper sale UUID
   - product_id matching the product's UUID
   - quantity: 5

## Success Criteria
✅ Product syncs with UUID (not local_* format)
✅ Sale syncs with UUID (not sale_* format)
✅ Sale's product_id matches the remapped product UUID
✅ No HTTP 400 errors in console
✅ All mutations show as synced (status: success)

## If It Fails
Check console for:
1. **HTTP 400 errors** → ID mapping not working
2. **"Mutation failed"** → Payload format issue
3. **Sales not referencing correct product** → Reference update failed
4. **Duplicates in Supabase** → Old local ID wasn't deleted

## Debugging Tips
- Check DevTools → Application → IndexedDB to see local DB state before/after sync
- Check db.mutations table to see mutation records and their status
- Open Supabase dashboard in another tab and refresh during sync to see changes appear
