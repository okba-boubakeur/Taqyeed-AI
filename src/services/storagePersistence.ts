/**
 * Storage Persistence Service
 * Ensures the Android / browser WebView grants persistent, eviction-free storage quota
 * for IndexedDB notes, attachments, and audio recordings.
 */

export interface StorageInfo {
  isPersisted: boolean;
  usageBytes: number;
  quotaBytes: number;
  usageMB: number;
  quotaMB: number;
  quotaGB: number;
  percentUsed: number;
}

/**
 * Requests persistent storage from the browser/WebView so data is never evicted under storage pressure.
 */
export async function ensureStoragePersistence(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      const isAlreadyPersisted = await navigator.storage.persisted();
      if (isAlreadyPersisted) {
        console.log('[StoragePersistence] Storage is already persistent (eviction-free).');
        return true;
      }
      const granted = await navigator.storage.persist();
      console.log(`[StoragePersistence] Storage persistence request result: ${granted ? 'GRANTED' : 'DENIED/AUTOMATIC'}`);
      return granted;
    }
  } catch (err) {
    console.warn('[StoragePersistence] Error requesting persistent storage:', err);
  }
  return false;
}

/**
 * Retrieves the current storage quota and usage information.
 */
export async function getStorageQuota(): Promise<StorageInfo> {
  const result: StorageInfo = {
    isPersisted: false,
    usageBytes: 0,
    quotaBytes: 0,
    usageMB: 0,
    quotaMB: 0,
    quotaGB: 0,
    percentUsed: 0,
  };

  try {
    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (navigator.storage.persisted) {
        result.isPersisted = await navigator.storage.persisted();
      }

      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        result.usageBytes = estimate.usage || 0;
        result.quotaBytes = estimate.quota || 0;
        result.usageMB = Math.round((result.usageBytes / (1024 * 1024)) * 10) / 10;
        result.quotaMB = Math.round((result.quotaBytes / (1024 * 1024)) * 10) / 10;
        result.quotaGB = Math.round((result.quotaBytes / (1024 * 1024 * 1024)) * 10) / 10;
        if (result.quotaBytes > 0) {
          result.percentUsed = Math.round((result.usageBytes / result.quotaBytes) * 1000) / 10;
        }
      }
    }
  } catch (err) {
    console.warn('[StoragePersistence] Error estimating storage quota:', err);
  }

  return result;
}
