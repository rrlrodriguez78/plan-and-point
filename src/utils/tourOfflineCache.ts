import { Tour, FloorPlan, Hotspot } from '@/types/tour';
import { supabase } from '@/integrations/supabase/client';

interface CachedTour {
  tour: Tour;
  floorPlans: FloorPlan[];
  hotspots: Hotspot[];
  floorPlanImages: Map<string, Blob>; // floorPlanId -> Blob
  cachedAt: Date;
  expiresAt: Date;
}

interface CachedTourStorage {
  tour: Tour;
  floorPlans: FloorPlan[];
  hotspots: Hotspot[];
  floorPlanImages: { [key: string]: Blob };
  cachedAt: string;
  expiresAt: string;
}

const DB_NAME = 'TourOfflineCache';
const DB_VERSION = 1;
const TOUR_STORE = 'tours';
const CACHE_EXPIRATION_DAYS = 7;
const MAX_CACHED_TOURS = 3;

class TourOfflineCache {
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
        if (!db.objectStoreNames.contains(TOUR_STORE)) {
          db.createObjectStore(TOUR_STORE, { keyPath: 'tourId' });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  async downloadTourForOffline(tourId: string): Promise<void> {
    try {
      // Check if we've reached the max cache limit
      const cachedTours = await this.getAllCachedTours();
      if (cachedTours.length >= MAX_CACHED_TOURS) {
        throw new Error(`Máximo de ${MAX_CACHED_TOURS} tours en caché alcanzado. Elimina uno antes de descargar otro.`);
      }

      // 1. Fetch tour data
      const { data: tour, error: tourError } = await supabase
        .from('virtual_tours')
        .select('*')
        .eq('id', tourId)
        .single();

      if (tourError || !tour) {
        throw new Error('No se pudo cargar el tour');
      }

      // 2. Fetch floor plans
      const { data: floorPlans, error: floorPlansError } = await supabase
        .from('floor_plans')
        .select('*')
        .eq('tour_id', tourId);

      if (floorPlansError) {
        throw new Error('No se pudieron cargar los planos');
      }

      // 3. Fetch all hotspots
      const floorPlanIds = floorPlans?.map(fp => fp.id) || [];
      const { data: hotspots, error: hotspotsError } = await supabase
        .from('hotspots')
        .select('*')
        .in('floor_plan_id', floorPlanIds);

      if (hotspotsError) {
        throw new Error('No se pudieron cargar los hotspots');
      }

      // 4. Download floor plan images as Blobs
      const floorPlanImages: { [key: string]: Blob } = {};
      
      for (const floorPlan of floorPlans || []) {
        try {
          const response = await fetch(floorPlan.image_url);
          if (response.ok) {
            const blob = await response.blob();
            floorPlanImages[floorPlan.id] = blob;
          }
        } catch (error) {
          console.warn(`No se pudo descargar imagen del plano ${floorPlan.id}:`, error);
        }
      }

      // 5. Store in IndexedDB
      const cachedAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + CACHE_EXPIRATION_DAYS);

      const cachedTourData: CachedTourStorage = {
        tour: tour as Tour,
        floorPlans: floorPlans || [],
        hotspots: hotspots || [],
        floorPlanImages,
        cachedAt: cachedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      const db = await this.ensureDB();
      const transaction = db.transaction([TOUR_STORE], 'readwrite');
      const store = transaction.objectStore(TOUR_STORE);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put({ tourId, ...cachedTourData });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

    } catch (error) {
      console.error('Error downloading tour for offline:', error);
      throw error;
    }
  }

  async getCachedTour(tourId: string): Promise<CachedTour | null> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([TOUR_STORE], 'readonly');
      const store = transaction.objectStore(TOUR_STORE);

      const data = await new Promise<any>((resolve, reject) => {
        const request = store.get(tourId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!data) return null;

      // Convert back to CachedTour format
      const cachedTour: CachedTour = {
        tour: data.tour,
        floorPlans: data.floorPlans,
        hotspots: data.hotspots,
        floorPlanImages: new Map(Object.entries(data.floorPlanImages)),
        cachedAt: new Date(data.cachedAt),
        expiresAt: new Date(data.expiresAt),
      };

      // Check if expired
      if (new Date() > cachedTour.expiresAt) {
        await this.deleteCachedTour(tourId);
        return null;
      }

      return cachedTour;
    } catch (error) {
      console.error('Error getting cached tour:', error);
      return null;
    }
  }

  async isTourCachedAndValid(tourId: string): Promise<boolean> {
    const cachedTour = await this.getCachedTour(tourId);
    return cachedTour !== null;
  }

  async deleteCachedTour(tourId: string): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([TOUR_STORE], 'readwrite');
      const store = transaction.objectStore(TOUR_STORE);

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(tourId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error deleting cached tour:', error);
      throw error;
    }
  }

  async getAllCachedTours(): Promise<CachedTour[]> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([TOUR_STORE], 'readonly');
      const store = transaction.objectStore(TOUR_STORE);

      const allData = await new Promise<any[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const cachedTours: CachedTour[] = allData
        .map(data => ({
          tour: data.tour,
          floorPlans: data.floorPlans,
          hotspots: data.hotspots,
          floorPlanImages: new Map(Object.entries(data.floorPlanImages)) as Map<string, Blob>,
          cachedAt: new Date(data.cachedAt),
          expiresAt: new Date(data.expiresAt),
        }))
        .filter(tour => new Date() <= tour.expiresAt); // Filter expired

      return cachedTours;
    } catch (error) {
      console.error('Error getting all cached tours:', error);
      return [];
    }
  }

  async cleanExpiredTours(): Promise<void> {
    try {
      const allTours = await this.getAllCachedTours();
      const db = await this.ensureDB();
      const transaction = db.transaction([TOUR_STORE], 'readwrite');
      const store = transaction.objectStore(TOUR_STORE);

      const allKeys = await new Promise<string[]>((resolve, reject) => {
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
      });

      const validTourIds = new Set(allTours.map(t => t.tour.id));

      for (const key of allKeys) {
        if (!validTourIds.has(key)) {
          await this.deleteCachedTour(key);
        }
      }
    } catch (error) {
      console.error('Error cleaning expired tours:', error);
    }
  }

  async getFloorPlanImage(tourId: string, floorPlanId: string): Promise<Blob | null> {
    const cachedTour = await this.getCachedTour(tourId);
    if (!cachedTour) return null;
    
    return cachedTour.floorPlanImages.get(floorPlanId) || null;
  }

  async getCacheSize(): Promise<number> {
    try {
      const allTours = await this.getAllCachedTours();
      let totalSize = 0;

      for (const tour of allTours) {
        // Estimate size of tour data
        totalSize += JSON.stringify(tour.tour).length;
        totalSize += JSON.stringify(tour.floorPlans).length;
        totalSize += JSON.stringify(tour.hotspots).length;

        // Add size of images
        for (const [_, blob] of tour.floorPlanImages) {
          totalSize += blob.size;
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Error calculating cache size:', error);
      return 0;
    }
  }
}

export const tourOfflineCache = new TourOfflineCache();
