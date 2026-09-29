// LocalStorage Fallback Helper for Firestore Quota Exceeded & Offline Mode

const PREFIX = 'asr_app_cache_';

export function getLocalCache<T>(collectionName: string): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + collectionName);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch (e) {
    console.warn(`Failed to read ${collectionName} from localStorage:`, e);
    return [];
  }
}

export function setLocalCache<T>(collectionName: string, items: T[]): void {
  try {
    localStorage.setItem(PREFIX + collectionName, JSON.stringify(items));
  } catch (e) {
    console.warn(`Failed to save ${collectionName} to localStorage:`, e);
  }
}

export function saveLocalCacheItem<T extends { id?: string; uid?: string }>(
  collectionName: string,
  item: T,
  idKey: 'id' | 'uid' = 'id'
): T[] {
  const current = getLocalCache<T>(collectionName);
  const itemId = item[idKey] || (item as any).id;
  
  if (!itemId) return current;

  const index = current.findIndex(existing => (existing[idKey] || (existing as any).id) === itemId);
  let updated: T[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...updated[index], ...item };
  } else {
    updated = [item, ...current];
  }

  setLocalCache(collectionName, updated);
  return updated;
}

export function deleteLocalCacheItem<T extends { id?: string; uid?: string }>(
  collectionName: string,
  itemId: string,
  idKey: 'id' | 'uid' = 'id'
): T[] {
  const current = getLocalCache<T>(collectionName);
  const updated = current.filter(existing => (existing[idKey] || (existing as any).id) !== itemId);
  setLocalCache(collectionName, updated);
  return updated;
}
