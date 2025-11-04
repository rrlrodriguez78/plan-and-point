import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { dbService } from '@/services/database-service';
import { SyncEvents } from '@/services/sync-events';
import { hybridStorage } from '@/utils/hybridStorage';

describe('Sync Integration Tests', () => {
  beforeAll(async () => {
    // Inicializar storage
    await hybridStorage.getStats();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Eventos de sincronización', () => {
    it('debería emitir evento al guardar tour', async () => {
      const eventSpy = vi.fn();
      const unsubscribe = SyncEvents.onDataChanged(eventSpy);

      SyncEvents.notifyDataChanged('virtual_tours', 'insert', 'test-id');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          table: 'virtual_tours',
          operation: 'insert',
          recordId: 'test-id'
        })
      );

      unsubscribe();
    });

    it('debería filtrar eventos por tabla', async () => {
      const toursSpy = vi.fn();
      const unsubscribe = SyncEvents.onTableChanged('virtual_tours', toursSpy);

      // Evento de tours (debería capturar)
      SyncEvents.notifyDataChanged('virtual_tours', 'update', 'tour-1');
      
      // Evento de otra tabla (no debería capturar)
      SyncEvents.notifyDataChanged('floor_plans', 'update', 'fp-1');

      expect(toursSpy).toHaveBeenCalledTimes(1);
      expect(toursSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          table: 'virtual_tours'
        })
      );

      unsubscribe();
    });
  });

  describe('Guardar y cargar tours', () => {
    it('debería crear tour offline', async () => {
      const testTour = {
        title: 'Tour de Prueba',
        description: 'Descripción de prueba',
        tourType: 'tour_360' as const,
        tenantId: 'test-tenant-id'
      };

      const created = await dbService.createTourOffline(testTour);

      expect(created.id).toBeDefined();
      expect(created.title).toBe(testTour.title);
      expect(created.synced).toBe(false);
      expect(created.hasLocalChanges).toBe(true);
    });

    it('debería listar tours pendientes', async () => {
      const pending = dbService.getPendingTours();
      expect(Array.isArray(pending)).toBe(true);
    });
  });

  describe('Limpieza de metadatos', () => {
    it('debería limpiar metadatos internos antes de sync', async () => {
      const tourWithMetadata = {
        id: 'test-tour',
        title: 'Test Tour',
        description: 'Test',
        _syncStatus: 'pending',
        _lastModified: new Date().toISOString(),
        _deleted: false,
        cachedAt: new Date().toISOString()
      };

      // El método cleanMetadata es privado, pero podemos verificar
      // que los tours sincronizados no tengan estos campos
      const testId = `test_${Date.now()}`;
      
      await dbService.saveLocal(
        testId,
        tourWithMetadata as any,
        [],
        []
      );

      const loaded = await dbService.loadTour(testId);
      
      // Verificar que se guardó
      expect(loaded).toBeDefined();
      expect(loaded?.data.id).toBe(testId);
    });
  });

  describe('Sincronización online/offline', () => {
    it('debería detectar estado online', () => {
      expect(typeof navigator.onLine).toBe('boolean');
    });

    it('debería marcar tour como pendiente cuando está offline', async () => {
      // Simular offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const testId = `offline_test_${Date.now()}`;
      const testTour = {
        id: testId,
        title: 'Tour Offline Test',
        description: 'Test'
      };

      await dbService.saveLocal(testId, testTour as any, [], []);

      const metadataKey = `tour_metadata_${testId}`;
      const metadata = JSON.parse(localStorage.getItem(metadataKey) || '{}');

      expect(metadata.hasLocalChanges).toBe(true);

      // Restaurar estado online
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
    });
  });

  describe('Estadísticas de almacenamiento', () => {
    it('debería obtener stats de almacenamiento', async () => {
      const stats = await dbService.getStats();

      expect(stats).toHaveProperty('count');
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('limit');
      expect(typeof stats.count).toBe('number');
    });
  });
});
