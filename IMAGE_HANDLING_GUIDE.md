# Image Handling - Complete Guide

## Overview

Your system now has a **complete offline-first image handling solution**:
- Images are stored **locally in Dexie** (browser database)
- Synced to **Supabase Storage** when online
- Works **completely offline** with local blobs
- Supports **multiple images per product**

## How It Works

### Architecture

```
User uploads image
    ↓
Optimize & convert to WebP (smaller size)
    ↓
Store as Blob in Dexie (local database)
    ↓
Image immediately available offline
    ↓
When online → Auto-sync uploads to Supabase Storage
    ↓
Remote URL stored, local blob deleted (save space)
    ↓
Image now accessible everywhere
```

### Storage Locations

1. **Local Storage (Dexie)**
   - Blobs stored while unsynced
   - Used for offline display
   - Automatically deleted after upload to save space
   - Survives browser restart

2. **Supabase Storage** (cloud)
   - Final destination when synced
   - Public URLs for sharing
   - Accessible from any device
   - Backup of original images

## Image Syncing

### Automatic Sync
Images sync automatically every 60 seconds when online:

```
Automatic every 60 seconds:
✅ Check for unsynced images
✅ Upload to Supabase Storage
✅ Save remote URL
✅ Delete local blob to free space
✅ Mark as synced
```

### Manual Sync
Click "Sync Now" in the offline indicator at top-right.

### Console Logs

Watch for these during sync:

```
📸 Syncing images to Supabase Storage
📊 Found 3 unsynced images
✅ Image synced: img_123456 → https://...
📸 Image sync complete: 3 synced, 0 failed
```

## Features

### Multiple Images Per Product
- Add up to any number of images per product
- Each image is independently tracked
- Each image syncs separately

### Offline-First
- Product images show even with no internet
- Local blobs used for display while offline
- No need to wait for Supabase when offline

### Automatic Optimization
- Images converted to WebP format (smaller)
- Resized to 600px max width (faster loading)
- Compressed at 80% quality (good balance)

### Space Efficient
- WebP format saves ~60% vs JPEG
- Local blobs deleted after upload
- Metadata kept for reference

## Viewing Images

### From Products Page
- Shows both synced (remote) and unsynced (local) images
- Seamless switching when images sync
- Delete button for removing images

### From Dashboard
- Product images display with local or remote URLs
- Works offline and online

## Adding Images to Products

### Creating New Product
1. Fill in product details
2. Click "Product Images"
3. Select one or more image files
4. Preview shows immediately
5. Save product
6. Images sync automatically when online

### Editing Existing Product
1. Click "Edit" on product
2. See existing images
3. Add more images (optional)
4. Remove images (optional)
5. Save
6. New images sync automatically

## Image Management

### Delete Images
- Click the X button on image preview
- Immediately removes from local database
- Syncs deletion when online

### Sync Status
Check sync status in console:

```javascript
window.debugSync.checkStatus()
```

Look for:
- `synced: true` - Images uploaded to Supabase
- `synced: false` - Pending upload

## Storage Details

### Supabase Storage Structure
```
product-images/
├── product_id_1/
│   ├── img_123456.webp
│   ├── img_123457.webp
│   └── img_123458.webp
├── product_id_2/
│   ├── img_234567.webp
│   └── img_234568.webp
```

### Image Metadata (Dexie)
Each image record stores:
- `id`: Unique image ID
- `product_id`: Which product it belongs to
- `filename`: Original filename
- `local_path`: Local storage path
- `hash`: SHA256 for change detection
- `blob`: WebP blob (temporary, deleted after sync)
- `remote_url`: Supabase URL (set after sync)
- `synced`: true/false status
- `created_at`: When image was added
- `lastSyncedAt`: When uploaded to Supabase

## Network Behavior

### When Offline
- Images stored in local Dexie
- Blobs available for display
- No upload attempts
- Marked as `synced: false`

### When Online
- Auto-sync runs every 60 seconds
- Unsynced images detected
- Uploads begin automatically
- Once uploaded: remote URL saved, blob deleted

### Poor Connection
- Auto-sync has 1-second timeout
- If upload fails, retried in 60 seconds
- Never loses image data

## Troubleshooting

### Images not showing
**Problem**: Added images but they don't display

**Solution**:
1. Check if product saved successfully
2. Check if you're online for initial sync
3. Wait 60 seconds for auto-sync
4. Manual sync: click "Sync Now"
5. Refresh the page

### Images not syncing
**Problem**: Images stuck with `synced: false`

**Solution**:
1. Check online status (top-right indicator)
2. Check console for sync errors
3. Manual sync: "Sync Now" button
4. Hard reset as last resort

```javascript
window.debugSync.hardReset()
```

### Images take too long to load
**Problem**: Images slow to display

**Solution**:
- All images auto-optimized to WebP
- Resized to 600px width
- Shouldn't be slow unless:
  - Very poor connection (timeout in 60s)
  - Very large original files
  
Try compressing images before upload.

## Performance Tips

1. **Compress before uploading**
   - Use tool like ImageOptim, TinyPNG
   - Reduces upload time

2. **Use Supabase after sync**
   - Remote URLs faster than local blobs
   - Once synced, local blob deleted

3. **Check sync status regularly**
   - Ensure images are synced
   - Don't rely only on local storage

4. **On weak connections**
   - Add images offline
   - Sync when you have good connection

## Example Workflow

### Day 1 (No Internet)
```
1. Add 5 products with multiple images each
2. All images stored in local Dexie
3. Images show perfectly offline
4. Products work normally
```

### Day 2 (Internet Available)
```
1. Auto-sync runs every 60 seconds
2. All images upload to Supabase Storage
3. Remote URLs saved in metadata
4. Local blobs deleted (free up space)
5. Images now accessible everywhere
6. Other devices can see them
```

### Day 3 (Multiple Devices)
```
1. On phone offline - see synced images
2. On laptop online - edit product, add images
3. On tablet offline - see all images (after sync)
4. Fully synced across all devices
```

## Technical Details

### Blob vs Blob Storage
- **Blob in Dexie**: Temporary, for offline display
- **Blob in Supabase Storage**: Permanent, with URL

### Why Delete Local Blob?
- Save browser storage space
- Remote URL handles display
- Can always re-download if needed

### Hash Function
- SHA256 hash of blob
- Used to detect file changes
- Prevents duplicate uploads

## FAQ

**Q: Can I upload without internet?**
A: Yes! Images stay in local Dexie. Upload happens automatically when online.

**Q: How many images per product?**
A: Unlimited. Each syncs independently.

**Q: Will images be lost?**
A: No. Always in one of two places: Local Dexie or Supabase Storage.

**Q: Can I view product images on web?**
A: Yes, after they sync to Supabase Storage, you get public URLs.

**Q: What if sync fails?**
A: Automatically retried every 60 seconds. Check console for errors.

**Q: How long does sync take?**
A: Depends on image size and internet. Usually < 5 seconds per image.

**Q: Can I delete images?**
A: Yes, click X button. Deletes locally immediately, syncs when online.
