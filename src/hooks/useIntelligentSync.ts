import { useState, useEffect, useCallback, useRef } from 'react';
import { tourOfflineCache } from '@/utils/tourOfflineCache';
import { offlineStorage } from '@/utils/offlineStorage';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  pendingPhotosCount: number;
  cachedToursCount: number;
  syncProgress: number;
  currentOperation: string | null;
}

interface SyncOptions {
  autoSync?: boolean;
  syncInterval?: number; // minutos
  maxRetries?: number;
}

/**
 * Hook avanzado para sincronización inteligente offline/online
 * - Detecta cambios de red de forma robusta
 * - Sincroniza automáticamente cuando vuelve la conexión
 * - Reintentos automáticos con backoff exponencial
 * - Progreso detallado de sincronización
 */
export function useIntelligentSync(options: SyncOptions = {}) {
  const {
    autoSync = true,
    syncInterval = 5,
    maxRetries = 3,
  } = options;

  const [state, setState] = useState<SyncState>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncAt: null,
    pendingPhotosCount: 0,
    cachedToursCount: 0,
    syncProgress: 0,
    currentOperation: null,
  });

  const syncInProgressRef = useRef(false);
  const retryCountRef = useRef(0);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Actualizar contadores
  const updateCounts = useCallback(async () => {
    try {
      const [pendingCount, cachedTours] = await Promise.all([
        offlineStorage.getAllPendingCount(),
        tourOfflineCache.getAllCachedTours(),
      ]);

      setState(prev => ({
        ...prev,
        pendingPhotosCount: pendingCount,
        cachedToursCount: cachedTours.length,
      }));
    } catch (error) {
      console.error('Error updating counts:', error);
    }
  }, []);

  // Detectar cambios de red con verificación real
  const checkOnlineStatus = useCallback(async () => {
    if (!navigator.onLine) {
      return false;
    }

    try {
      // Verificar conectividad real con Supabase
      const { error } = await supabase.from('profiles').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }, []);

  // Sincronizar fotos pendientes con reintentos
  const syncPendingPhotos = useCallback(async () => {
    if (syncInProgressRef.current) {
      console.log('Sync already in progress, skipping');
      return { success: false, message: 'Sync in progress' };
    }

    const online = await checkOnlineStatus();
    if (!online) {
      console.log('No internet connection, skipping sync');
      return { success: false, message: 'No internet connection' };
    }

    syncInProgressRef.current = true;
    setState(prev => ({ ...prev, isSyncing: true, syncProgress: 0, currentOperation: 'Preparando...' }));

    try {
      const pendingPhotos = await offlineStorage.getPendingPhotos();
      
      if (pendingPhotos.length === 0) {
        setState(prev => ({ 
          ...prev, 
          isSyncing: false, 
          syncProgress: 100,
          currentOperation: null,
          lastSyncAt: new Date() 
        }));
        syncInProgressRef.current = false;
        return { success: true, message: 'No pending photos' };
      }

      console.log(`🔄 Sincronizando ${pendingPhotos.length} fotos pendientes...`);
      
      let successCount = 0;
      let errorCount = 0;
      const totalPhotos = pendingPhotos.length;

      // Procesar de 3 en 3 para no saturar
      for (let i = 0; i < pendingPhotos.length; i += 3) {
        const batch = pendingPhotos.slice(i, i + 3);
        
        await Promise.all(
          batch.map(async (photo, batchIndex) => {
            const photoIndex = i + batchIndex + 1;
            
            try {
              setState(prev => ({ 
                ...prev, 
                currentOperation: `Sincronizando ${photoIndex}/${totalPhotos}`,
                syncProgress: Math.round((photoIndex / totalPhotos) * 100)
              }));

              await offlineStorage.updatePhotoStatus(photo.id, 'syncing');

              // Subir foto a storage y crear registro en DB
              const file = new File([photo.blob], photo.filename, { type: photo.blob.type });
              const filePath = `${photo.tenantId}/${photo.tourId}/${photo.hotspotId}/${Date.now()}.jpg`;
              
              const { error: uploadError } = await supabase.storage
                .from('tour-images')
                .upload(filePath, file, {
                  contentType: 'image/jpeg',
                  upsert: false,
                });

              if (uploadError) throw uploadError;

              const { data: { publicUrl } } = supabase.storage
                .from('tour-images')
                .getPublicUrl(filePath);

              // Crear registro en panorama_photos
              const { error: dbError } = await supabase
                .from('panorama_photos')
                .insert({
                  hotspot_id: photo.hotspotId,
                  photo_url: publicUrl,
                  original_filename: photo.filename,
                  capture_date: photo.captureDate.toISOString().split('T')[0],
                });

              if (dbError) throw dbError;

              // Limpiar foto sincronizada
              await offlineStorage.deletePhoto(photo.id);
              successCount++;
              
            } catch (error: any) {
              console.error(`Error sincronizando foto ${photo.id}:`, error);
              await offlineStorage.updatePhotoStatus(photo.id, 'error', error.message);
              errorCount++;
            }
          })
        );
      }

      const message = successCount > 0
        ? `✅ ${successCount} fotos sincronizadas${errorCount > 0 ? `, ${errorCount} fallaron` : ''}`
        : `❌ ${errorCount} fotos fallaron`;

      if (successCount > 0) {
        toast.success(message);
        retryCountRef.current = 0; // Reset retry count on success
      } else {
        toast.error(message);
      }

      setState(prev => ({ 
        ...prev, 
        isSyncing: false,
        syncProgress: 100,
        currentOperation: null,
        lastSyncAt: new Date(),
      }));

      await updateCounts();
      
      syncInProgressRef.current = false;
      return { 
        success: successCount > 0, 
        message,
        successCount,
        errorCount 
      };

    } catch (error: any) {
      console.error('Error en sincronización:', error);
      setState(prev => ({ 
        ...prev, 
        isSyncing: false, 
        syncProgress: 0,
        currentOperation: null 
      }));
      
      syncInProgressRef.current = false;
      
      // Reintentar con backoff exponencial
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.pow(2, retryCountRef.current) * 1000; // 2s, 4s, 8s
        
        toast.warning(`Error al sincronizar. Reintentando en ${delay/1000}s... (${retryCountRef.current}/${maxRetries})`);
        
        setTimeout(() => {
          syncPendingPhotos();
        }, delay);
      } else {
        toast.error('Error al sincronizar fotos después de varios intentos');
        retryCountRef.current = 0;
      }
      
      return { success: false, message: error.message };
    }
  }, [checkOnlineStatus, maxRetries, updateCounts]);

  // Actualizar cache de tours (descargar actualizaciones)
  const updateCachedTours = useCallback(async () => {
    const online = await checkOnlineStatus();
    if (!online) return;

    try {
      setState(prev => ({ ...prev, currentOperation: 'Actualizando tours en caché...' }));
      
      const cachedTours = await tourOfflineCache.getAllCachedTours();
      
      for (const cached of cachedTours) {
        // Re-descargar para actualizar
        await tourOfflineCache.downloadTourForOffline(cached.tour.id);
      }
      
      setState(prev => ({ ...prev, currentOperation: null }));
      toast.success(`✅ ${cachedTours.length} tours actualizados`);
      
    } catch (error) {
      console.error('Error updating cached tours:', error);
      setState(prev => ({ ...prev, currentOperation: null }));
    }
  }, [checkOnlineStatus]);

  // Sincronización completa
  const performFullSync = useCallback(async () => {
    console.log('🔄 Iniciando sincronización completa...');
    
    // 1. Sincronizar fotos pendientes
    await syncPendingPhotos();
    
    // 2. Actualizar tours en caché
    await updateCachedTours();
    
    // 3. Limpiar tours expirados
    await tourOfflineCache.cleanExpiredTours();
    
    console.log('✅ Sincronización completa finalizada');
  }, [syncPendingPhotos, updateCachedTours]);

  // Monitorear estado de red
  useEffect(() => {
    const handleOnline = async () => {
      console.log('🌐 Conexión detectada, verificando...');
      const reallyOnline = await checkOnlineStatus();
      
      setState(prev => ({ ...prev, isOnline: reallyOnline }));
      
      if (reallyOnline) {
        toast.success('🌐 Conexión restaurada');
        if (autoSync) {
          setTimeout(() => performFullSync(), 1000); // Dar 1s para estabilizar
        }
      }
    };

    const handleOffline = () => {
      console.log('📴 Sin conexión');
      setState(prev => ({ ...prev, isOnline: false }));
      toast.warning('📴 Sin conexión - Modo offline activo');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificación periódica
    const intervalId = setInterval(async () => {
      const online = await checkOnlineStatus();
      setState(prev => {
        if (prev.isOnline !== online) {
          if (online) {
            toast.success('🌐 Conexión restaurada');
            if (autoSync) performFullSync();
          } else {
            toast.warning('📴 Conexión perdida');
          }
        }
        return { ...prev, isOnline: online };
      });
    }, 30000); // Cada 30s

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [checkOnlineStatus, autoSync, performFullSync]);

  // Sincronización periódica automática
  useEffect(() => {
    if (autoSync && syncInterval > 0) {
      syncIntervalRef.current = setInterval(() => {
        if (state.isOnline && !syncInProgressRef.current) {
          performFullSync();
        }
      }, syncInterval * 60 * 1000);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [autoSync, syncInterval, state.isOnline, performFullSync]);

  // Cargar contadores iniciales
  useEffect(() => {
    updateCounts();
  }, [updateCounts]);

  return {
    ...state,
    syncNow: performFullSync,
    syncPhotos: syncPendingPhotos,
    updateTours: updateCachedTours,
    refreshCounts: updateCounts,
  };
}
