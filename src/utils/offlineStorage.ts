/**
 * Sistema de almacenamiento offline usando IndexedDB
 * para fotos capturadas con Theta Z1 cuando no hay conexión a internet
 */

export interface PendingPhoto {
  id: string;
  hotspotId: string;
  tourId: string;
  tenantId: string;
  blob: Blob;
  captureDate: Date;
  filename: string;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  errorMessage?: string;
  createdAt: Date;
  attempts: number;
}

const DB_NAME = 'ThetaOfflineStorage';
const DB_VERSION = 1;
const STORE_NAME = 'pending_photos';

class OfflineStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('hotspotId', 'hotspotId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  async savePendingPhoto(photo: Omit<PendingPhoto, 'id' | 'createdAt' | 'attempts' | 'status'>): Promise<string> {
    const db = await this.ensureDb();
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const pendingPhoto: PendingPhoto = {
      ...photo,
      id,
      createdAt: new Date(),
      attempts: 0,
      status: 'pending',
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(pendingPhoto);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingPhotos(): Promise<PendingPhoto[]> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.getAll('pending');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingPhotosByHotspot(hotspotId: string): Promise<PendingPhoto[]> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('hotspotId');
      const request = index.getAll(hotspotId);

      request.onsuccess = () => {
        const photos = request.result.filter(p => p.status === 'pending' || p.status === 'error');
        resolve(photos);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updatePhotoStatus(
    id: string, 
    status: PendingPhoto['status'], 
    errorMessage?: string
  ): Promise<void> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const photo = request.result;
        if (photo) {
          photo.status = status;
          photo.attempts += 1;
          if (errorMessage) {
            photo.errorMessage = errorMessage;
          }
          
          const updateRequest = store.put(photo);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Photo not found'));
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deletePhoto(id: string): Promise<void> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPendingCount(): Promise<number> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.count('pending');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearSyncedPhotos(): Promise<void> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('status');
      const request = index.openCursor(IDBKeyRange.only('synced'));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineStorage = new OfflineStorage();
