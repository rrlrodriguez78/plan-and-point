import { useState, useEffect, useCallback } from 'react';
import { tourOfflineCache } from '@/utils/tourOfflineCache';
import { offlineStorage } from '@/utils/offlineStorage';

interface ResourceStats {
  cacheSize: number;
  cacheUsagePercentage: number;
  cachedToursCount: number;
  pendingPhotosCount: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
  availableSpace: number;
}

interface ResourceLimits {
  maxCacheSize: number;
  maxTours: number;
  warningThreshold: number; // Percentage
  criticalThreshold: number; // Percentage
}

const DEFAULT_LIMITS: ResourceLimits = {
  maxCacheSize: 100 * 1024 * 1024, // 100MB
  maxTours: 5,
  warningThreshold: 75,
  criticalThreshold: 90,
};

/**
 * Hook para monitorear el uso de recursos (caché, storage, etc.)
 */
export function useResourceMonitor(refreshInterval = 5000) {
  const [stats, setStats] = useState<ResourceStats>({
    cacheSize: 0,
    cacheUsagePercentage: 0,
    cachedToursCount: 0,
    pendingPhotosCount: 0,
    isNearLimit: false,
    isAtLimit: false,
    availableSpace: DEFAULT_LIMITS.maxCacheSize,
  });

  const [isLoading, setIsLoading] = useState(true);

  const checkResources = useCallback(async () => {
    try {
      const [cacheStats, pendingCount] = await Promise.all([
        tourOfflineCache.getCacheStats(),
        offlineStorage.getAllPendingCount(),
      ]);

      const usagePercentage = cacheStats.usagePercentage;
      const isNearLimit = usagePercentage >= DEFAULT_LIMITS.warningThreshold;
      const isAtLimit = usagePercentage >= DEFAULT_LIMITS.criticalThreshold;

      setStats({
        cacheSize: cacheStats.totalSize,
        cacheUsagePercentage: usagePercentage,
        cachedToursCount: cacheStats.toursCount,
        pendingPhotosCount: pendingCount,
        isNearLimit,
        isAtLimit,
        availableSpace: cacheStats.availableSpace,
      });
    } catch (error) {
      console.error('Error checking resources:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkResources();

    // Refresh periodically if interval is set
    if (refreshInterval > 0) {
      const intervalId = setInterval(checkResources, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [checkResources, refreshInterval]);

  return {
    ...stats,
    isLoading,
    refresh: checkResources,
    limits: DEFAULT_LIMITS,
  };
}
