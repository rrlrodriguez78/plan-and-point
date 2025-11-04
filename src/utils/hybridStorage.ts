import { isNativeApp, checkStoragePermission } from './storagePermissions';
import { 
  saveTourToFilesystem, 
  loadTourFromFilesystem, 
  getToursList, 
  deleteTour as deleteNativeTour,
  getStorageStats,
  StoredTour 
} from './nativeFileStorage';
import { tourOfflineCache } from './tourOfflineCache';
import type { Tour, FloorPlan, Hotspot } from '@/types/tour';
import pako from 'pako';

// Storage adapter interface
export interface StorageAdapter {
  saveTour(
    tourId: string,
    tourName: string,
    tour: Tour,
    floorPlans: any[],
    hotspots: Hotspot[],
    photos?: any[]
  ): Promise<void>;
  loadTour(tourId: string): Promise<StoredTour | null>;
  listTours(): Promise<Array<{ 
    id: string; 
    name: string; 
    size: number; 
    lastModified: Date;
    lastSyncedAt?: string;
    hasLocalChanges?: boolean;
  }>>;
  deleteTour(tourId: string): Promise<void>;
  getStats(): Promise<{ 
    count: number; 
    size: number; 
    limit: number;
    availableSpace?: number;
  }>;
}

// Filesystem Adapter (for native mobile)
class FilesystemAdapter implements StorageAdapter {
  async saveTour(
    tourId: string,
    tourName: string,
    tour: Tour,
    floorPlans: any[],
    hotspots: Hotspot[],
    photos: any[] = []
  ): Promise<void> {
    // Compress tour data before saving
    const compressedTour = this.compressData(tour);
    const compressedHotspots = this.compressData(hotspots);
    
    await saveTourToFilesystem(
      tourId,
      tourName,
      { ...tour, _compressed: true },
      floorPlans,
      compressedHotspots,
      photos
    );
  }

  async loadTour(tourId: string): Promise<StoredTour | null> {
    const tour = await loadTourFromFilesystem(tourId);
    if (!tour) return null;
    
    // Decompress if compressed
    if ((tour.data as any)._compressed) {
      tour.data = this.decompressData(tour.data);
      tour.hotspots = this.decompressData(tour.hotspots);
    }
    
    return tour;
  }

  async listTours() {
    const tours = await getToursList();
    return tours.map(t => ({
      id: t.id,
      name: t.name,
      size: t.size,
      lastModified: new Date(t.cachedAt),
      lastSyncedAt: t.metadata.lastSyncedAt,
      hasLocalChanges: t.metadata.hasLocalChanges
    }));
  }

  async deleteTour(tourId: string): Promise<void> {
    await deleteNativeTour(tourId);
  }

  async getStats() {
    const stats = await getStorageStats();
    return {
      count: stats.totalTours,
      size: stats.totalSize,
      limit: stats.availableSpace, // No artificial limit on native
      availableSpace: stats.availableSpace
    };
  }

  // Compression helpers
  private compressData(data: any): any {
    try {
      const jsonString = JSON.stringify(data);
      const compressed = pako.deflate(jsonString);
      return {
        _compressed: true,
        data: Array.from(compressed)
      };
    } catch (error) {
      console.error('Compression error:', error);
      return data;
    }
  }

  private decompressData(data: any): any {
    try {
      if (data._compressed && data.data) {
        const uint8Array = new Uint8Array(data.data);
        const decompressed = pako.inflate(uint8Array, { to: 'string' });
        return JSON.parse(decompressed);
      }
      return data;
    } catch (error) {
      console.error('Decompression error:', error);
      return data;
    }
  }
}

// IndexedDB Adapter (for web)
class IndexedDBAdapter implements StorageAdapter {
  async saveTour(
    tourId: string,
    tourName: string,
    tour: Tour,
    floorPlans: any[],
    hotspots: Hotspot[]
  ): Promise<void> {
    await tourOfflineCache.downloadTourForOffline(tourId);
  }

  async loadTour(tourId: string): Promise<StoredTour | null> {
    const cached = await tourOfflineCache.getCachedTour(tourId);
    if (!cached) return null;
    
    // Convert to StoredTour format
    return {
      id: cached.tour.id!,
      name: cached.tour.title || 'Sin nombre',
      data: cached.tour,
      floorPlans: cached.floorPlans,
      hotspots: cached.hotspots,
      photos: [],
      metadata: {
        cachedAt: typeof cached.cachedAt === 'string' ? cached.cachedAt : new Date(cached.cachedAt).toISOString(),
        size: 0,
        photosCount: 0
      }
    };
  }

  async listTours() {
    const tours = await tourOfflineCache.getAllCachedTours();
    return tours.map(t => ({
      id: t.tour.id!,
      name: t.tour.title || 'Sin nombre',
      size: 0, // IndexedDB doesn't track individual sizes
      lastModified: new Date(t.cachedAt),
      lastSyncedAt: undefined,
      hasLocalChanges: false
    }));
  }

  async deleteTour(tourId: string): Promise<void> {
    await tourOfflineCache.deleteCachedTour(tourId);
  }

  async getStats() {
    const stats = await tourOfflineCache.getCacheStats();
    return {
      count: stats.toursCount,
      size: stats.totalSize,
      limit: stats.maxSize,
      availableSpace: stats.maxSize - stats.totalSize
    };
  }
}

// Pending Tour interface for offline creation
export interface PendingTour {
  id: string; // Local UUID
  title: string;
  description: string;
  coverImageUrl?: string;
  tourType: 'tour_360' | 'photo_tour';
  tenantId: string;
  synced: false;
  createdAt: string;
  lastSyncedAt?: string;
  hasLocalChanges?: boolean;
  remoteId?: string;
}

// Hybrid Storage Manager
class HybridStorageManager {
  private adapter: StorageAdapter | null = null;
  private initPromise: Promise<void> | null = null;
  private readonly PENDING_TOURS_KEY = 'pending_tours';

  constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize() {
    const native = isNativeApp();
    
    if (native) {
      const permissionStatus = await checkStoragePermission();
      if (permissionStatus.granted) {
        this.adapter = new FilesystemAdapter();
        console.log('✅ Using Filesystem storage (native)');
      } else {
        // Fallback to IndexedDB even on mobile if no permissions
        this.adapter = new IndexedDBAdapter();
        console.log('⚠️ No storage permissions, using IndexedDB fallback');
      }
    } else {
      this.adapter = new IndexedDBAdapter();
      console.log('✅ Using IndexedDB storage (web)');
    }
  }

  private async ensureInitialized() {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
    if (!this.adapter) {
      throw new Error('Storage adapter not initialized');
    }
  }

  async saveTour(
    tourId: string,
    tourName: string,
    tour: Tour,
    floorPlans: any[],
    hotspots: Hotspot[],
    photos?: any[]
  ): Promise<void> {
    await this.ensureInitialized();
    
    // Check storage limit (only for IndexedDB, native has no artificial limits)
    if (this.adapter instanceof IndexedDBAdapter) {
      const storageLimitMB = parseInt(sessionStorage.getItem('user_storage_limit') || '1000'); // Increased to 1GB
      const stats = await this.adapter.getStats();
      
      if (stats.size / 1024 / 1024 > storageLimitMB) {
        throw new Error(`Límite de almacenamiento alcanzado: ${storageLimitMB}MB. Aumenta el límite en configuración o elimina tours antiguos.`);
      }
    }
    
    return this.adapter!.saveTour(tourId, tourName, tour, floorPlans, hotspots, photos);
  }

  async loadTour(tourId: string): Promise<StoredTour | null> {
    await this.ensureInitialized();
    return this.adapter!.loadTour(tourId);
  }

  async listTours() {
    await this.ensureInitialized();
    return this.adapter!.listTours();
  }

  async deleteTour(tourId: string): Promise<void> {
    await this.ensureInitialized();
    return this.adapter!.deleteTour(tourId);
  }

  async getStats() {
    await this.ensureInitialized();
    return this.adapter!.getStats();
  }

  async isUsingNativeStorage(): Promise<boolean> {
    await this.ensureInitialized();
    return this.adapter instanceof FilesystemAdapter;
  }

  // Create tour offline (stores in localStorage with synced: false)
  async createTourOffline(tourData: {
    title: string;
    description: string;
    coverImageUrl?: string;
    tourType: 'tour_360' | 'photo_tour';
    tenantId: string;
  }): Promise<PendingTour> {
    const localId = crypto.randomUUID();
    const pendingTour: PendingTour = {
      id: localId,
      title: tourData.title,
      description: tourData.description,
      coverImageUrl: tourData.coverImageUrl,
      tourType: tourData.tourType,
      tenantId: tourData.tenantId,
      synced: false,
      createdAt: new Date().toISOString()
    };

    // Save to localStorage
    const pending = this.getPendingTours();
    pending.push(pendingTour);
    localStorage.setItem(this.PENDING_TOURS_KEY, JSON.stringify(pending));

    console.log('✅ Tour creado offline:', pendingTour);
    return pendingTour;
  }

  // Get pending tours (not synced)
  getPendingTours(): PendingTour[] {
    try {
      const stored = localStorage.getItem(this.PENDING_TOURS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading pending tours:', error);
      return [];
    }
  }

  // Mark tour as synced and update its ID
  async markTourSynced(localId: string, remoteId?: string): Promise<void> {
    const pending = this.getPendingTours();
    const updated = pending.filter(t => t.id !== localId);
    localStorage.setItem(this.PENDING_TOURS_KEY, JSON.stringify(updated));
    
    if (remoteId) {
      // Update ID mapping
      const { updateMapping } = await import('./tourIdMapping');
      await updateMapping(localId, remoteId);
    }
  }

  // Load tour offline (supports both local and remote IDs)
  async loadTourOffline(tourId: string): Promise<any> {
    // Check if it's a pending tour
    const pending = this.getPendingTours();
    const pendingTour = pending.find(t => t.id === tourId);
    
    if (pendingTour) {
      // Return minimal tour data for editing
      return {
        data: {
          id: pendingTour.id,
          title: pendingTour.title,
          description: pendingTour.description,
          cover_image_url: pendingTour.coverImageUrl,
          tour_type: pendingTour.tourType,
          tenant_id: pendingTour.tenantId,
          is_published: false,
          created_at: pendingTour.createdAt,
          updated_at: pendingTour.createdAt
        },
        floorPlans: [],
        hotspots: [],
        photos: []
      };
    }

    // Try loading from cache
    return await this.loadTour(tourId);
  }
}

export const hybridStorage = new HybridStorageManager();
