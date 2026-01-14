import { db, LocalImageMetadata } from './db';

/**
 * IMAGE MANAGER
 * 
 * Handles local image storage, optimization, and metadata.
 * 
 * Strategy:
 * 1. User uploads image → convert to WebP, resize, save to IndexedDB as Blob
 * 2. Store metadata (hash, filename) in Dexie
 * 3. On sync → upload Blob to Supabase Storage, save remote URL
 * 4. In offline POS → use local Blob, no URL needed
 */

interface ImageUploadOptions {
  maxWidth?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: ImageUploadOptions = {
  maxWidth: 600,
  quality: 0.8,
};

/**
 * Convert image to WebP and resize
 */
export async function optimizeImage(
  file: File,
  options: ImageUploadOptions = DEFAULT_OPTIONS
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Resize if needed
        if (width > (options.maxWidth || 600)) {
          const ratio = (options.maxWidth || 600) / width;
          width = options.maxWidth || 600;
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Could not convert image to blob'));
            }
          },
          'image/webp',
          options.quality || 0.8
        );
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Calculate SHA256 hash of blob for change detection
 */
export async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Store optimized image in local DB with metadata
 */
export async function storeLocalImage(
  productId: string,
  file: File,
  options?: ImageUploadOptions
): Promise<LocalImageMetadata> {
  try {
    // Optimize image
    const optimized = await optimizeImage(file, options);
    const hash = await hashBlob(optimized);

    // Create metadata
    const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const metadata: LocalImageMetadata = {
      id: imageId,
      product_id: productId,
      filename: file.name,
      local_path: `/images/products/${imageId}.webp`,
      hash,
      size: optimized.size,
      mimetype: 'image/webp',
      created_at: new Date().toISOString(),
      synced: false,
    };

    // Store metadata and blob in Dexie (blob field used as fallback to filesystem)
    await db.images.add({ ...metadata, blob: optimized });

    console.log('✅ Image stored locally:', imageId);
    return { ...metadata };
  } catch (error) {
    console.error('❌ Error storing image:', error);
    throw error;
  }
}

/**
 * Get image metadata by product ID
 */
export async function getProductImage(productId: string): Promise<LocalImageMetadata | undefined> {
  return db.images.where('product_id').equals(productId).first();
}

/**
 * Get all unsynced images (for background sync)
 */
export async function getUnsyncedImages(): Promise<LocalImageMetadata[]> {
  return db.images.filter(img => img.synced === false).toArray();
}

/**
 * Mark image as synced after upload to Supabase Storage
 */
export async function markImageSynced(imageId: string, remoteUrl: string) {
  await db.images.update(imageId, {
    synced: true,
    remote_url: remoteUrl,
    lastSyncedAt: new Date().toISOString(),
  });
  console.log('✅ Image marked synced:', imageId);
}

/**
 * Create a blob URL for local image display in offline mode
 * (Only use in POS, not for remote viewing)
 */
export async function getLocalImageUrl(imageId: string): Promise<string | null> {
  try {
    const image = await db.images.get(imageId);
    if (!image) return null;
    // If a blob is stored locally (fallback), create an object URL
    if ((image as any).blob) {
      const blob = (image as any).blob as Blob;
      return URL.createObjectURL(blob);
    }

    // Otherwise return the local path (File System Access API expected)
    return image.local_path;
  } catch (error) {
    console.error('Error getting image URL:', error);
    return null;
  }
}

export async function getProductImages(productId: string): Promise<LocalImageMetadata[]> {
  return db.images.where('product_id').equals(productId).sortBy('created_at');
}

/**
 * Delete image metadata and blob
 */
export async function deleteLocalImage(imageId: string) {
  await db.images.delete(imageId);
  console.log('✅ Image deleted locally:', imageId);
}
