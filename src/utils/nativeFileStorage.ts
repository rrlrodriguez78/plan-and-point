import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { getStorageDirectory, getBasePath, isNativeApp } from './storagePermissions';

export interface StoredTour {
  id: string;
  name: string;
  data: any;
  floorPlans: any[];
  hotspots: any[];
  photos: StoredPhoto[];
  metadata: {
    cachedAt: string;
    size: number;
    photosCount: number;
    lastSyncedAt?: string;
    hasLocalChanges?: boolean;
  };
}

export interface StoredPhoto {
  id: string;
  url: string;
  blob?: Blob;
  localPath?: string;
}

export interface StorageStats {
  totalTours: number;
  totalSize: number;
  availableSpace: number;
  tours: Array<{
    id: string;
    name: string;
    size: number;
    cachedAt: string;
    metadata?: {
      lastSyncedAt?: string;
      hasLocalChanges?: boolean;
    };
  }>;
}

/**
 * Crea la estructura de carpetas para un tour
 */
async function createTourFolder(tourId: string): Promise<string> {
  const basePath = `${getBasePath()}/tours/${tourId}`;
  const storageDir = getStorageDirectory();
  
  console.log(`📁 [NativeStorage] Creating tour folder for: ${tourId}`);
  console.log(`📍 [NativeStorage] Base path: ${basePath}`);
  console.log(`💾 [NativeStorage] Storage directory: ${storageDir}`);
  
  try {
    // Crear carpeta principal del tour
    await Filesystem.mkdir({
      path: basePath,
      directory: storageDir,
      recursive: true
    });
    console.log(`✅ [NativeStorage] Created main folder: ${basePath}`);

    // Crear subcarpetas
    await Filesystem.mkdir({
      path: `${basePath}/floor_plans`,
      directory: storageDir,
      recursive: true
    });
    console.log(`✅ [NativeStorage] Created floor_plans subfolder`);

    await Filesystem.mkdir({
      path: `${basePath}/photos`,
      directory: storageDir,
      recursive: true
    });
    console.log(`✅ [NativeStorage] Created photos subfolder`);

    return basePath;
  } catch (error) {
    console.error('❌ [NativeStorage] Error creating tour folder:', error);
    throw error;
  }
}

/**
 * Convierte un Blob a base64
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remover el prefijo "data:image/jpeg;base64,"
      resolve(base64.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Guarda una imagen en el filesystem
 */
async function saveImage(blob: Blob, path: string): Promise<void> {
  try {
    const base64Data = await blobToBase64(blob);
    await Filesystem.writeFile({
      path,
      data: base64Data,
      directory: getStorageDirectory(),
      recursive: true
    });
  } catch (error) {
    console.error('Error saving image:', error);
    throw error;
  }
}

/**
 * Carga una imagen del filesystem
 */
async function loadImage(path: string): Promise<Blob> {
  try {
    const result = await Filesystem.readFile({
      path,
      directory: getStorageDirectory()
    });

    // Convertir base64 a Blob
    const base64 = typeof result.data === 'string' ? result.data : '';
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'image/jpeg' });
  } catch (error) {
    console.error('Error loading image:', error);
    throw error;
  }
}

/**
 * Guarda un tour completo en el filesystem nativo
 */
export async function saveTourToFilesystem(
  tourId: string,
  tourName: string,
  tourData: any,
  floorPlans: any[],
  hotspots: any[],
  photos: StoredPhoto[]
): Promise<void> {
  if (!isNativeApp()) {
    throw new Error('Native storage only available on mobile devices');
  }

  console.log(`💾 [NativeStorage] Starting save for tour: ${tourName} (${tourId})`);
  console.log(`📊 [NativeStorage] Data to save:`, {
    floorPlansCount: floorPlans.length,
    hotspotsCount: hotspots.length,
    photosCount: photos.length
  });

  try {
    const basePath = await createTourFolder(tourId);
    console.log(`✅ [NativeStorage] Tour folder created at: ${basePath}`);
    
    // Guardar metadatos del tour
    const metadata = {
      id: tourId,
      name: tourName,
      data: tourData,
      floorPlans: floorPlans.map(fp => ({
        ...fp,
        image_url: fp.image_url ? `floor_plans/${fp.id}.jpg` : null
      })),
      hotspots,
      cachedAt: new Date().toISOString(),
      photosCount: photos.length
    };

    await Filesystem.writeFile({
      path: `${basePath}/metadata.json`,
      data: JSON.stringify(metadata),
      directory: getStorageDirectory(),
      encoding: Encoding.UTF8
    });
    console.log(`✅ [NativeStorage] Metadata saved`);


    // Guardar imágenes de floor plans
    for (const floorPlan of floorPlans) {
      if (floorPlan.imageBlob) {
        await saveImage(
          floorPlan.imageBlob,
          `${basePath}/floor_plans/${floorPlan.id}.jpg`
        );
      }
    }

    // Guardar fotos
    for (const photo of photos) {
      if (photo.blob) {
        await saveImage(
          photo.blob,
          `${basePath}/photos/${photo.id}.jpg`
        );
      }
    }

    console.log(`✅ Tour ${tourName} guardado exitosamente en filesystem nativo`);
  } catch (error) {
    console.error('Error saving tour to filesystem:', error);
    throw error;
  }
}

/**
 * Carga un tour del filesystem nativo
 */
export async function loadTourFromFilesystem(tourId: string): Promise<StoredTour | null> {
  if (!isNativeApp()) {
    return null;
  }

  try {
    const basePath = `${getBasePath()}/tours/${tourId}`;
    
    // Leer metadatos
    const metadataFile = await Filesystem.readFile({
      path: `${basePath}/metadata.json`,
      directory: getStorageDirectory(),
      encoding: Encoding.UTF8
    });

    const metadata = JSON.parse(metadataFile.data as string);

    // Cargar imágenes de floor plans
    const floorPlansWithImages = await Promise.all(
      metadata.floorPlans.map(async (fp: any) => {
        if (fp.image_url) {
          try {
            const blob = await loadImage(`${basePath}/${fp.image_url}`);
            return { ...fp, imageBlob: blob };
          } catch (error) {
            console.warn(`Could not load floor plan image: ${fp.id}`);
            return fp;
          }
        }
        return fp;
      })
    );

    // Cargar fotos
    const photos: StoredPhoto[] = [];
    for (let i = 0; i < metadata.photosCount; i++) {
      try {
        const photoFiles = await Filesystem.readdir({
          path: `${basePath}/photos`,
          directory: getStorageDirectory()
        });

        for (const file of photoFiles.files) {
          const photoId = file.name.replace('.jpg', '');
          const blob = await loadImage(`${basePath}/photos/${file.name}`);
          photos.push({
            id: photoId,
            url: '',
            blob,
            localPath: `${basePath}/photos/${file.name}`
          });
        }
      } catch (error) {
        console.warn('Error loading photos:', error);
      }
    }

    return {
      id: metadata.id,
      name: metadata.name,
      data: metadata.data,
      floorPlans: floorPlansWithImages,
      hotspots: metadata.hotspots,
      photos,
      metadata: {
        cachedAt: metadata.cachedAt,
        size: await getTourSize(tourId),
        photosCount: photos.length,
        lastSyncedAt: metadata.lastSyncedAt,
        hasLocalChanges: metadata.hasLocalChanges
      }
    };
  } catch (error) {
    console.error('Error loading tour from filesystem:', error);
    return null;
  }
}

/**
 * Lista todos los tours guardados
 */
export async function getToursList(): Promise<Array<{ 
  id: string; 
  name: string; 
  size: number; 
  cachedAt: string;
  metadata: {
    lastSyncedAt?: string;
    hasLocalChanges?: boolean;
  };
}>> {
  if (!isNativeApp()) {
    return [];
  }

  try {
    const toursPath = `${getBasePath()}/tours`;
    
    const tourDirs = await Filesystem.readdir({
      path: toursPath,
      directory: getStorageDirectory()
    });

    const tours = await Promise.all(
      tourDirs.files
        .filter(file => file.type === 'directory')
        .map(async (dir) => {
          try {
            const metadata = await Filesystem.readFile({
              path: `${toursPath}/${dir.name}/metadata.json`,
              directory: getStorageDirectory(),
              encoding: Encoding.UTF8
            });

            const meta = JSON.parse(metadata.data as string);
            const size = await getTourSize(dir.name);

            return {
              id: dir.name,
              name: meta.name,
              size,
              cachedAt: meta.cachedAt,
              metadata: {
                lastSyncedAt: meta.lastSyncedAt,
                hasLocalChanges: meta.hasLocalChanges
              }
            };
          } catch (error) {
            console.warn(`Could not read tour metadata: ${dir.name}`);
            return null;
          }
        })
    );

    return tours.filter(t => t !== null) as Array<{ 
      id: string; 
      name: string; 
      size: number; 
      cachedAt: string;
      metadata: {
        lastSyncedAt?: string;
        hasLocalChanges?: boolean;
      };
    }>;
  } catch (error) {
    console.error('Error listing tours:', error);
    return [];
  }
}

/**
 * Elimina un tour del filesystem
 */
export async function deleteTour(tourId: string): Promise<void> {
  if (!isNativeApp()) {
    return;
  }

  try {
    const basePath = `${getBasePath()}/tours/${tourId}`;
    
    await Filesystem.rmdir({
      path: basePath,
      directory: getStorageDirectory(),
      recursive: true
    });

    console.log(`🗑️ Tour ${tourId} eliminado del filesystem`);
  } catch (error) {
    console.error('Error deleting tour:', error);
    throw error;
  }
}

/**
 * Calcula el tamaño de un tour en bytes
 */
async function getTourSize(tourId: string): Promise<number> {
  if (!isNativeApp()) {
    return 0;
  }

  try {
    const basePath = `${getBasePath()}/tours/${tourId}`;
    let totalSize = 0;

    // Obtener tamaño de metadata
    const metadata = await Filesystem.stat({
      path: `${basePath}/metadata.json`,
      directory: getStorageDirectory()
    });
    totalSize += metadata.size;

    // Obtener tamaño de floor plans
    try {
      const floorPlans = await Filesystem.readdir({
        path: `${basePath}/floor_plans`,
        directory: getStorageDirectory()
      });

      for (const file of floorPlans.files) {
        const stat = await Filesystem.stat({
          path: `${basePath}/floor_plans/${file.name}`,
          directory: getStorageDirectory()
        });
        totalSize += stat.size;
      }
    } catch (error) {
      // Carpeta vacía
    }

    // Obtener tamaño de fotos
    try {
      const photos = await Filesystem.readdir({
        path: `${basePath}/photos`,
        directory: getStorageDirectory()
      });

      for (const file of photos.files) {
        const stat = await Filesystem.stat({
          path: `${basePath}/photos/${file.name}`,
          directory: getStorageDirectory()
        });
        totalSize += stat.size;
      }
    } catch (error) {
      // Carpeta vacía
    }

    return totalSize;
  } catch (error) {
    console.error('Error calculating tour size:', error);
    return 0;
  }
}

/**
 * Obtiene estadísticas de almacenamiento
 */
export async function getStorageStats(): Promise<StorageStats> {
  if (!isNativeApp()) {
    return {
      totalTours: 0,
      totalSize: 0,
      availableSpace: 0,
      tours: []
    };
  }

  try {
    const tours = await getToursList();
    const totalSize = tours.reduce((sum, tour) => sum + tour.size, 0);

    // En Capacitor no hay una forma directa de obtener espacio disponible
    // Podríamos usar un plugin nativo o estimarlo
    const availableSpace = 0; // TODO: Implementar con plugin nativo

    return {
      totalTours: tours.length,
      totalSize,
      availableSpace,
      tours
    };
  } catch (error) {
    console.error('Error getting storage stats:', error);
    return {
      totalTours: 0,
      totalSize: 0,
      availableSpace: 0,
      tours: []
    };
  }
}

/**
 * Exporta un tour como archivo ZIP para compartir
 */
export async function exportTourToShare(tourId: string): Promise<string | null> {
  if (!isNativeApp()) {
    return null;
  }

  try {
    // TODO: Implementar compresión ZIP
    // Requiere plugin adicional o implementación nativa
    console.warn('Export to ZIP not yet implemented');
    return null;
  } catch (error) {
    console.error('Error exporting tour:', error);
    return null;
  }
}

/**
 * 🆕 FASE 5: Función de diagnóstico para verificar configuración de almacenamiento
 */
export async function debugStorageSetup(): Promise<{
  isNative: boolean;
  hasPermissions: boolean;
  storageDirectory: string;
  basePath: string;
  fullPath: string;
  foldersCreated: boolean;
  error?: string;
}> {
  const native = isNativeApp();
  
  if (!native) {
    return {
      isNative: false,
      hasPermissions: false,
      storageDirectory: 'N/A',
      basePath: 'N/A',
      fullPath: 'N/A',
      foldersCreated: false
    };
  }

  const { checkStoragePermission } = await import('./storagePermissions');
  const permissionStatus = await checkStoragePermission();
  const directory = getStorageDirectory();
  const base = getBasePath();
  const fullPath = `/storage/emulated/0/${base}`;
  
  try {
    console.log('🔍 Debugging storage setup...');
    console.log(`📂 Base path: ${base}`);
    console.log(`📍 Directory: ${directory}`);
    console.log(`🗂️ Full path: ${fullPath}`);
    
    // Intentar crear carpeta base
    await Filesystem.mkdir({
      path: base,
      directory: directory,
      recursive: true
    });
    console.log('✅ Base folder created/verified');
    
    // Intentar crear carpeta tours
    await Filesystem.mkdir({
      path: `${base}/tours`,
      directory: directory,
      recursive: true
    });
    console.log('✅ Tours folder created/verified');
    
    // Verificar que existan
    const result = await Filesystem.readdir({
      path: base,
      directory: directory
    });
    
    console.log(`✅ Found ${result.files.length} items in base folder`);
    
    return {
      isNative: true,
      hasPermissions: permissionStatus.granted,
      storageDirectory: directory,
      basePath: base,
      fullPath,
      foldersCreated: result.files.length > 0
    };
  } catch (error) {
    console.error('❌ Debug storage setup failed:', error);
    return {
      isNative: true,
      hasPermissions: permissionStatus.granted,
      storageDirectory: directory,
      basePath: base,
      fullPath,
      foldersCreated: false,
      error: (error as Error).message
    };
  }
}
