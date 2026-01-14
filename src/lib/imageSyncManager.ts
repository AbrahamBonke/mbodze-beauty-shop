import { db } from './db';
import { supabase } from './supabase';
import { getUnsyncedImages, markImageSynced } from './imageManager';

/**
 * IMAGE SYNC MANAGER
 * 
 * Handles uploading images to Supabase Storage when online
 * Images are stored locally in Dexie and synced to Supabase in background
 * 
 * Strategy:
 * 1. User adds image to product → stored in Dexie as blob (works offline)
 * 2. On sync → upload blob to Supabase Storage
 * 3. Save remote URL in metadata
 * 4. Mark as synced, delete local blob to save space
 */

/**
 * Sync all unsynced images to Supabase Storage
 * Returns count of synced images
 */
export async function syncImagesToSupabase(): Promise<number> {
  try {
    console.log('📸 Syncing images to Supabase Storage');

    const unsyncedImages = await getUnsyncedImages();
    
    if (!unsyncedImages || unsyncedImages.length === 0) {
      console.log('✅ No unsynced images to upload');
      return 0;
    }

    console.log(`📊 Found ${unsyncedImages.length} unsynced images`);

    let syncedCount = 0;
    let failedCount = 0;

    for (const image of unsyncedImages) {
      try {
        // Get the blob from local storage
        const localImage = await db.images.get(image.id);
        if (!localImage) {
          console.warn(`⚠️ Image metadata found but blob missing: ${image.id}`);
          continue;
        }

        const blob = (localImage as any).blob as Blob;
        if (!blob) {
          console.warn(`⚠️ Image blob is missing: ${image.id}`);
          continue;
        }

        // Upload to Supabase Storage
        const fileName = `${image.product_id}/${image.id}.webp`;
        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(fileName, blob, {
            contentType: 'image/webp',
            upsert: true,
          });

        if (error) {
          console.error(`❌ Failed to upload image ${image.id}:`, error);
          failedCount++;
          continue;
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);

        const remoteUrl = publicUrlData?.publicUrl;
        if (!remoteUrl) {
          console.error(`❌ Could not get public URL for ${image.id}`);
          failedCount++;
          continue;
        }

        // Mark as synced and store remote URL
        await markImageSynced(image.id, remoteUrl);

        // Delete local blob to save space (keep metadata for reference)
        await db.images.update(image.id, {
          blob: undefined, // Remove local blob
        });

        console.log(`✅ Image synced: ${image.id} → ${remoteUrl}`);
        syncedCount++;
      } catch (error) {
        console.error(`❌ Error syncing image ${image.id}:`, error);
        failedCount++;
      }
    }

    console.log(
      `📸 Image sync complete: ${syncedCount} synced, ${failedCount} failed`
    );

    return syncedCount;
  } catch (error) {
    console.error('❌ Error in image sync:', error);
    return 0;
  }
}

/**
 * Get image blob by ID (for displaying locally if not synced)
 */
export async function getImageBlob(imageId: string): Promise<Blob | null> {
  try {
    const image = await db.images.get(imageId);
    if (!image) return null;

    const blob = (image as any).blob as Blob;
    return blob || null;
  } catch (error) {
    console.error('Error getting image blob:', error);
    return null;
  }
}

/**
 * Get image display URL (remote if synced, local if not)
 */
export async function getImageUrl(imageId: string): Promise<string | null> {
  try {
    const image = await db.images.get(imageId);
    if (!image) return null;

    // If synced, return remote URL
    if (image.synced && image.remote_url) {
      return image.remote_url;
    }

    // If not synced but has blob, create object URL for offline display
    const blob = (image as any).blob as Blob;
    if (blob) {
      return URL.createObjectURL(blob);
    }

    return null;
  } catch (error) {
    console.error('Error getting image URL:', error);
    return null;
  }
}

/**
 * Get all images for a product (synced and unsynced)
 */
export async function getProductImagesWithUrls(productId: string) {
  try {
    const images = await db.images
      .where('product_id')
      .equals(productId)
      .sortBy('created_at');

    const imagesWithUrls = await Promise.all(
      images.map(async (img) => ({
        ...img,
        displayUrl: await getImageUrl(img.id),
      }))
    );

    return imagesWithUrls;
  } catch (error) {
    console.error('Error getting product images with URLs:', error);
    return [];
  }
}
