/**
 * Sistema de eventos para sincronización cross-tab/cross-component
 * Permite notificaciones en tiempo real entre diferentes pestañas y componentes
 */

export type SyncOperation = 'insert' | 'update' | 'delete' | 'sync';

export interface DataChangedEvent {
  table: string;
  operation: SyncOperation;
  recordId: string;
  timestamp: string;
}

export class SyncEvents {
  /**
   * Emitir evento de cambio de datos
   */
  static notifyDataChanged(
    table: string, 
    operation: SyncOperation, 
    recordId: string
  ): void {
    const event: DataChangedEvent = {
      table,
      operation,
      recordId,
      timestamp: new Date().toISOString()
    };

    window.dispatchEvent(
      new CustomEvent('dataChanged', { detail: event })
    );

    console.log(`📡 [SyncEvents] Emitted: ${table} ${operation} ${recordId}`);
  }

  /**
   * Escuchar cambios de datos
   * @returns Función para cancelar suscripción
   */
  static onDataChanged(
    callback: (event: DataChangedEvent) => void
  ): () => void {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<DataChangedEvent>;
      callback(customEvent.detail);
    };

    window.addEventListener('dataChanged', handler);

    return () => {
      window.removeEventListener('dataChanged', handler);
    };
  }

  /**
   * Escuchar cambios de una tabla específica
   */
  static onTableChanged(
    table: string,
    callback: (event: DataChangedEvent) => void
  ): () => void {
    return this.onDataChanged((event) => {
      if (event.table === table) {
        callback(event);
      }
    });
  }

  /**
   * Notificar inicio de sincronización
   */
  static notifySyncStarted(table?: string): void {
    window.dispatchEvent(
      new CustomEvent('syncStatusChanged', {
        detail: {
          status: 'started',
          table,
          timestamp: new Date().toISOString()
        }
      })
    );
  }

  /**
   * Notificar fin de sincronización
   */
  static notifySyncCompleted(table?: string, success = true): void {
    window.dispatchEvent(
      new CustomEvent('syncStatusChanged', {
        detail: {
          status: success ? 'completed' : 'failed',
          table,
          timestamp: new Date().toISOString()
        }
      })
    );
  }
}
