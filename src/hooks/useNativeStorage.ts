import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  saveTourToFilesystem,
  loadTourFromFilesystem,
  getToursList,
  deleteTour,
  getStorageStats,
  StoredTour,
  StorageStats
} from '@/utils/nativeFileStorage';
import {
  checkStoragePermission,
  requestStoragePermission,
  openAppSettings,
  isNativeApp
} from '@/utils/storagePermissions';

export function useNativeStorage() {
  const [hasPermission, setHasPermission] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [stats, setStats] = useState<StorageStats>({
    totalTours: 0,
    totalSize: 0,
    availableSpace: 0,
    tours: []
  });

  // Verificar permisos al montar
  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = useCallback(async () => {
    if (!isNativeApp()) {
      setHasPermission(false);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    try {
      const status = await checkStoragePermission();
      setHasPermission(status.granted);
    } catch (error) {
      console.error('Error checking permissions:', error);
      setHasPermission(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!isNativeApp()) {
      toast.error('Almacenamiento nativo solo disponible en dispositivos móviles');
      return false;
    }

    try {
      const granted = await requestStoragePermission();
      setHasPermission(granted);

      if (granted) {
        toast.success('Permisos de almacenamiento concedidos');
        await refreshStats();
      } else {
        toast.error('Permisos de almacenamiento denegados', {
          action: {
            label: 'Abrir Ajustes',
            onClick: openAppSettings
          }
        });
      }

      return granted;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      toast.error('Error al solicitar permisos');
      return false;
    }
  }, []);

  const refreshStats = useCallback(async () => {
    if (!hasPermission || !isNativeApp()) {
      return;
    }

    try {
      const newStats = await getStorageStats();
      setStats(newStats);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    }
  }, [hasPermission]);

  const saveTour = useCallback(async (
    tourId: string,
    tourName: string,
    tourData: any,
    floorPlans: any[],
    hotspots: any[],
    photos: any[]
  ): Promise<boolean> => {
    if (!hasPermission) {
      const granted = await requestPermissions();
      if (!granted) {
        toast.error(
          'No se puede guardar sin permisos de almacenamiento',
          {
            action: {
              label: 'Abrir Ajustes',
              onClick: openAppSettings
            }
          }
        );
        return false;
      }
    }

    try {
      await saveTourToFilesystem(tourId, tourName, tourData, floorPlans, hotspots, photos);
      await refreshStats();
      toast.success(`✅ Tour "${tourName}" guardado en almacenamiento nativo`);
      return true;
    } catch (error: any) {
      console.error('Error saving tour:', error);
      
      // Errores específicos
      if (error.message?.includes('permission') || error.message?.includes('denied')) {
        toast.error('❌ Error de permisos - verifica los ajustes de la app', {
          action: {
            label: 'Abrir Ajustes',
            onClick: openAppSettings
          }
        });
      } else if (error.message?.includes('space') || error.message?.includes('storage')) {
        toast.error('❌ No hay suficiente espacio en el dispositivo');
      } else {
        toast.error('❌ Error al guardar el tour');
      }
      
      return false;
    }
  }, [hasPermission, requestPermissions, refreshStats]);

  const loadTour = useCallback(async (tourId: string): Promise<StoredTour | null> => {
    if (!hasPermission) {
      toast.error('Se requieren permisos de almacenamiento');
      return null;
    }

    try {
      const tour = await loadTourFromFilesystem(tourId);
      if (!tour) {
        toast.error('Tour no encontrado');
      }
      return tour;
    } catch (error) {
      console.error('Error loading tour:', error);
      toast.error('Error al cargar el tour');
      return null;
    }
  }, [hasPermission]);

  const removeTour = useCallback(async (tourId: string): Promise<boolean> => {
    if (!hasPermission) {
      toast.error('Se requieren permisos de almacenamiento');
      return false;
    }

    try {
      await deleteTour(tourId);
      await refreshStats();
      toast.success('Tour eliminado correctamente');
      return true;
    } catch (error) {
      console.error('Error deleting tour:', error);
      toast.error('Error al eliminar el tour');
      return false;
    }
  }, [hasPermission, refreshStats]);

  const listTours = useCallback(async () => {
    if (!hasPermission) {
      return [];
    }

    try {
      return await getToursList();
    } catch (error) {
      console.error('Error listing tours:', error);
      return [];
    }
  }, [hasPermission]);

  return {
    // Estado
    isNativeApp: isNativeApp(),
    hasPermission,
    isChecking,
    stats,

    // Acciones
    requestPermissions,
    checkPermissions,
    refreshStats,
    saveTour,
    loadTour,
    removeTour,
    listTours,
    openSettings: openAppSettings
  };
}
