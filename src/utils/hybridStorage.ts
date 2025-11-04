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
  listTours(): Promise<Array<{ id: string; name: string; size: number; lastModified: Date }>>;
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
      lastModified: new Date(t.cachedAt)
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
      lastModified: new Date(t.cachedAt)
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

// Hybrid Storage Manager
class HybridStorageManager {
  private adapter: StorageAdapter | null = null;
  private initPromise: Promise<void> | null = null;

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
}

export const hybridStorage = new HybridStorageManager();
