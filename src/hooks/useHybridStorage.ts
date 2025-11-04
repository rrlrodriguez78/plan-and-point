import { useState, useEffect, useCallback } from 'react';
import { hybridStorage } from '@/utils/hybridStorage';
import { 
  isNativeApp, 
  checkStoragePermission, 
  requestStoragePermission,
  openAppSettings 
} from '@/utils/storagePermissions';
import type { Tour, FloorPlan, Hotspot } from '@/types/tour';

export function useHybridStorage() {
  const [isNative, setIsNative] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [stats, setStats] = useState<{
    count: number;
    size: number;
    limit: number;
    availableSpace?: number;
  }>({
    count: 0,
    size: 0,
    limit: 0,
    availableSpace: 0
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Check if native and permissions
  useEffect(() => {
    const checkPlatform = async () => {
      const native = isNativeApp();
      setIsNative(native);
      
      if (native) {
        const permission = await checkStoragePermission();
        setHasPermission(permission.granted);
      } else {
        setHasPermission(true); // Web always has "permission"
      }
      
      setIsCheckingPermission(false);
    };
    
    checkPlatform();
  }, []);

  // Load stats
  const refreshStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const storageStats = await hybridStorage.getStats();
      setStats(storageStats);
    } catch (error) {
      console.error('Error loading storage stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    if (!isCheckingPermission && (hasPermission || !isNative)) {
      refreshStats();
    }
  }, [isCheckingPermission, hasPermission, isNative, refreshStats]);

  // Request permissions
  const requestPermissions = useCallback(async () => {
    if (!isNative) return true;
    
    const granted = await requestStoragePermission();
    setHasPermission(granted);
    
    if (granted) {
      await refreshStats();
    }
    
    return granted;
  }, [isNative, refreshStats]);

  // Save tour
  const saveTour = useCallback(async (
    tourId: string,
    tourName: string,
    tour: Tour,
    floorPlans: any[],
    hotspots: Hotspot[],
    photos?: any[]
  ) => {
    await hybridStorage.saveTour(tourId, tourName, tour, floorPlans, hotspots, photos);
    await refreshStats();
  }, [refreshStats]);

  // Load tour
  const loadTour = useCallback(async (tourId: string) => {
    return await hybridStorage.loadTour(tourId);
  }, []);

  // List tours
  const listTours = useCallback(async () => {
    return await hybridStorage.listTours();
  }, []);

  // Delete tour
  const deleteTour = useCallback(async (tourId: string) => {
    await hybridStorage.deleteTour(tourId);
    await refreshStats();
  }, [refreshStats]);

  // Check if using native storage
  const [usingNativeStorage, setUsingNativeStorage] = useState(false);
  useEffect(() => {
    const checkStorage = async () => {
      const native = await hybridStorage.isUsingNativeStorage();
      setUsingNativeStorage(native);
    };
    checkStorage();
  }, [hasPermission]);

  return {
    isNativeApp: isNative,
    hasPermission,
    isCheckingPermission,
    stats,
    isLoadingStats,
    usingNativeStorage,
    requestPermissions,
    refreshStats,
    saveTour,
    loadTour,
    listTours,
    deleteTour,
    openSettings: openAppSettings
  };
}
