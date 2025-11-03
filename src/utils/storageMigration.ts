import { tourOfflineCache } from './tourOfflineCache';
import { saveTourToFilesystem, StoredPhoto } from './nativeFileStorage';
import { isNativeApp, checkStoragePermission } from './storagePermissions';

export interface MigrationProgress {
  total: number;
  current: number;
  currentTourName: string;
  isComplete: boolean;
}

export type MigrationCallback = (progress: MigrationProgress) => void;

/**
 * Verifica si hay tours en IndexedDB que necesitan ser migrados
 */
export async function checkMigrationNeeded(): Promise<boolean> {
  if (!isNativeApp()) {
    return false; // No migrar en web
  }

  const permissionStatus = await checkStoragePermission();
  if (!permissionStatus.granted) {
    return false; // No podemos migrar sin permisos
  }

  try {
    const cachedTours = await tourOfflineCache.getAllCachedTours();
    return cachedTours.length > 0;
  } catch (error) {
    console.error('Error checking migration:', error);
    return false;
  }
}

/**
 * Migra todos los tours de IndexedDB al filesystem nativo
 */
export async function migrateTours(onProgress?: MigrationCallback): Promise<{
  success: boolean;
  migrated: number;
  failed: number;
  errors: Array<{ tourId: string; error: string }>;
}> {
  if (!isNativeApp()) {
    return { success: false, migrated: 0, failed: 0, errors: [{ tourId: 'system', error: 'Not a native app' }] };
  }

  const permissionStatus = await checkStoragePermission();
  if (!permissionStatus.granted) {
    return { success: false, migrated: 0, failed: 0, errors: [{ tourId: 'system', error: 'No storage permissions' }] };
  }

  try {
    const cachedTours = await tourOfflineCache.getAllCachedTours();
    const total = cachedTours.length;
    let migrated = 0;
    let failed = 0;
    const errors: Array<{ tourId: string; error: string }> = [];

    for (let i = 0; i < cachedTours.length; i++) {
      const cachedTour = cachedTours[i];

      try {
        // Notificar progreso
        if (onProgress) {
          onProgress({
            total,
            current: i + 1,
            currentTourName: cachedTour.tour.title || 'Sin nombre',
            isComplete: false
          });
        }

        // Preparar floor plans con sus blobs desde floorPlanImages
        const floorPlansWithBlobs = cachedTour.floorPlans.map((fp: any) => {
          const cachedBlob = cachedTour.floorPlanImages.get(fp.id);
          if (cachedBlob) {
            return {
              ...fp,
              imageBlob: cachedBlob
            };
          }
          return fp;
        });

        // Preparar fotos con sus blobs - por ahora vacío ya que no guardamos fotos en IndexedDB
        const photosWithBlobs: StoredPhoto[] = [];

        // Guardar en filesystem nativo usando los datos del cache
        await saveTourToFilesystem(
          cachedTour.tour.id!,
          cachedTour.tour.title || 'Sin nombre',
          cachedTour.tour,
          floorPlansWithBlobs,
          cachedTour.hotspots,
          photosWithBlobs
        );

        // Eliminar de IndexedDB después de migrar exitosamente
        await tourOfflineCache.deleteCachedTour(cachedTour.tour.id!);

        migrated++;
      } catch (error) {
        console.error(`Error migrating tour ${cachedTour.tour.id}:`, error);
        failed++;
        errors.push({
          tourId: cachedTour.tour.id || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Notificar completado
    if (onProgress) {
      onProgress({
        total,
        current: total,
        currentTourName: '',
        isComplete: true
      });
    }

    return {
      success: failed === 0,
      migrated,
      failed,
      errors
    };
  } catch (error) {
    console.error('Error during migration:', error);
    return {
      success: false,
      migrated: 0,
      failed: 0,
      errors: [{ tourId: 'system', error: error instanceof Error ? error.message : 'Unknown error' }]
    };
  }
}

/**
 * Migra un tour específico de IndexedDB al filesystem
 */
export async function migrateSingleTour(tourId: string): Promise<boolean> {
  if (!isNativeApp()) {
    return false;
  }

  const permissionStatus = await checkStoragePermission();
  if (!permissionStatus.granted) {
    return false;
  }

  try {
    const cachedTour = await tourOfflineCache.getCachedTour(tourId);
    if (!cachedTour) {
      return false;
    }

    // Preparar datos con blobs desde floorPlanImages
    const floorPlansWithBlobs = cachedTour.floorPlans.map((fp: any) => {
      const cachedBlob = cachedTour.floorPlanImages.get(fp.id);
      if (cachedBlob) {
        return { ...fp, imageBlob: cachedBlob };
      }
      return fp;
    });

    // Preparar fotos - por ahora vacío
    const photosWithBlobs: StoredPhoto[] = [];

    await saveTourToFilesystem(
      tourId,
      cachedTour.tour.title || 'Sin nombre',
      cachedTour.tour,
      floorPlansWithBlobs,
      cachedTour.hotspots,
      photosWithBlobs
    );

    await tourOfflineCache.deleteCachedTour(tourId);

    return true;
  } catch (error) {
    console.error(`Error migrating single tour ${tourId}:`, error);
    return false;
  }
}
