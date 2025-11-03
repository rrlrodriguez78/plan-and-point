import { useEffect } from 'react';
import { tourOfflineCache } from '@/utils/tourOfflineCache';
import { offlineStorage } from '@/utils/offlineStorage';

interface AutoCleanupOptions {
  enabled?: boolean;
  interval?: number; // minutos
  onCleanup?: (stats: { toursRemoved: number; photosRemoved: number }) => void;
}

/**
 * Hook para limpieza automática de caché expirado y datos antiguos
 * Se ejecuta en background de forma no intrusiva
 */
export function useAutoCleanup(options: AutoCleanupOptions = {}) {
  const {
    enabled = true,
    interval = 30, // Cada 30 minutos por defecto
    onCleanup,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const performCleanup = async () => {
      console.log('🧹 Ejecutando limpieza automática...');
      
      try {
        // Limpiar tours expirados
        const toursBefore = (await tourOfflineCache.getAllCachedTours()).length;
        await tourOfflineCache.cleanExpiredTours();
        const toursAfter = (await tourOfflineCache.getAllCachedTours()).length;
        const toursRemoved = toursBefore - toursAfter;

        // Limpiar fotos sincronizadas
        const photosBefore = await offlineStorage.getAllPendingCount();
        await offlineStorage.clearSyncedPhotos();
        const photosAfter = await offlineStorage.getAllPendingCount();
        const photosRemoved = photosBefore - photosAfter;

        if (toursRemoved > 0 || photosRemoved > 0) {
          console.log(`✅ Limpieza completada: ${toursRemoved} tours, ${photosRemoved} fotos`);
          onCleanup?.({ toursRemoved, photosRemoved });
        }
      } catch (error) {
        console.error('Error en limpieza automática:', error);
      }
    };

    // Ejecutar al iniciar
    performCleanup();

    // Programar limpiezas periódicas
    const intervalId = setInterval(performCleanup, interval * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [enabled, interval, onCleanup]);
}
