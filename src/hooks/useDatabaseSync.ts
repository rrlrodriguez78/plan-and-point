import { useState, useEffect, useCallback } from 'react';
import { dbService } from '@/services/database-service';
import { SyncEvents } from '@/services/sync-events';
import { useCloudSync } from './useCloudSync';
import type { Tour } from '@/types/tour';

/**
 * Hook para manejar sincronización de datos con eventos en tiempo real
 * Simplifica el uso de dbService en componentes React
 */
export function useDatabaseSync<T = Tour>(table: string) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { status, syncNow, resolveConflict } = useCloudSync();

  // Cargar datos
  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      if (table === 'virtual_tours') {
        const tours = await dbService.listTours();
        setData(tours as T[]);
      }
    } catch (error) {
      console.error(`Error cargando ${table}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [table]);

  // Cargar datos inicialmente
  useEffect(() => {
    load();
  }, [load]);

  // Escuchar cambios de otras tabs/componentes
  useEffect(() => {
    const unsubscribe = SyncEvents.onTableChanged(table, (event) => {
      console.log(`🔄 [useDatabaseSync] Recibido evento: ${event.operation} en ${table}`);
      load(); // Recargar automáticamente
    });

    return unsubscribe;
  }, [table, load]);

  // Guardar tour
  const save = useCallback(async (
    item: T,
    syncImmediately = false
  ) => {
    try {
      if (table === 'virtual_tours') {
        const tour = item as unknown as Tour;
        await dbService.saveTour(
          tour.id!,
          tour,
          [],
          [],
          syncImmediately
        );
        await load();
      }
    } catch (error) {
      console.error(`Error guardando en ${table}:`, error);
      throw error;
    }
  }, [table, load]);

  // Eliminar tour
  const remove = useCallback(async (
    id: string,
    syncImmediately = false
  ) => {
    try {
      if (table === 'virtual_tours') {
        await dbService.deleteTour(id, syncImmediately);
        await load();
      }
    } catch (error) {
      console.error(`Error eliminando de ${table}:`, error);
      throw error;
    }
  }, [table, load]);

  return {
    data,
    isLoading,
    save,
    remove,
    refresh: load,
    syncNow,
    resolveConflict,
    syncStatus: status
  };
}
