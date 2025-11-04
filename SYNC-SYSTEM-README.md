# Sistema de Sincronización Offline/Online Híbrido

## 🎯 Arquitectura Implementada

### Componentes Principales

1. **`SyncEvents`** (`src/services/sync-events.ts`)
   - Sistema de eventos CustomEvent para comunicación cross-tab/cross-component
   - Notificaciones en tiempo real cuando cambian datos

2. **`DatabaseService`** (`src/services/database-service.ts`)
   - Wrapper unificado para Supabase + HybridStorage
   - Maneja sync automático online/offline
   - Limpia metadatos internos antes de sincronizar

3. **`useDatabaseSync`** (`src/hooks/useDatabaseSync.ts`)
   - Hook React para usar en componentes
   - Auto-actualización cuando cambian datos

4. **`HybridStorage`** (`src/utils/hybridStorage.ts`)
   - Adaptadores: IndexedDB (web) + Filesystem (móvil)
   - Compresión automática de datos (móvil)
   - Emite eventos al guardar/eliminar

5. **`useCloudSync`** (`src/hooks/useCloudSync.ts`)
   - Sincronización bidireccional con Supabase
   - Detección de conflictos
   - Auto-sync cada 30s
   - Realtime subscriptions

---

## 📦 Uso en Componentes

### Ejemplo 1: Dashboard con auto-actualización

```typescript
import { useDatabaseSync } from '@/hooks/useDatabaseSync';
import { Badge, Alert } from '@/components/ui';

export default function Dashboard() {
  const { 
    data: tours, 
    save, 
    refresh, 
    syncStatus,
    syncNow 
  } = useDatabaseSync<Tour>('virtual_tours');

  const handleCreate = async (newTour: Tour) => {
    // Sync inmediato si hay internet, sino local
    await save(newTour, navigator.onLine);
  };

  return (
    <div>
      {/* Indicador de conexión */}
      <Badge variant={syncStatus.isOnline ? 'success' : 'destructive'}>
        {syncStatus.isOnline ? '🟢 Online' : '🔴 Offline'}
      </Badge>

      {/* Cambios pendientes */}
      {syncStatus.pendingChanges > 0 && (
        <Alert>
          Hay {syncStatus.pendingChanges} tour(s) sin sincronizar
          <Button onClick={syncNow}>Sincronizar ahora</Button>
        </Alert>
      )}

      {/* Lista de tours (se actualiza automáticamente) */}
      {tours.map(tour => (
        <TourCard key={tour.id} tour={tour} />
      ))}
    </div>
  );
}
```

### Ejemplo 2: Editor con eventos cross-tab

```typescript
import { useDatabaseSync } from '@/hooks/useDatabaseSync';
import { SyncEvents } from '@/services/sync-events';

export default function Editor() {
  const { save, syncStatus } = useDatabaseSync<Tour>('virtual_tours');

  const handleSave = async (tourData: Tour) => {
    await save(tourData, navigator.onLine);
    
    toast.success(
      navigator.onLine 
        ? '✅ Tour guardado y sincronizado' 
        : '💾 Tour guardado localmente'
    );
  };

  // Escuchar cambios de otras tabs
  useEffect(() => {
    return SyncEvents.onTableChanged('virtual_tours', (event) => {
      if (event.operation === 'update' && event.recordId === currentTourId) {
        toast.info('Tour actualizado desde otra pestaña');
        refetchTour();
      }
    });
  }, [currentTourId]);

  return (
    <div>
      <SyncStatusBadge />
      <TourForm onSave={handleSave} />
    </div>
  );
}
```

---

## 🔄 Flujo de Sincronización

### Online
```
Usuario edita → save(tour, true)
  ↓
DatabaseService.syncTourToCloud()
  ↓
cleanMetadata() (elimina _syncStatus, _lastModified, etc.)
  ↓
Supabase.upsert()
  ↓
hybridStorage.saveTour() (cache local)
  ↓
SyncEvents.notifyDataChanged() ✨
  ↓
Otras tabs/componentes se actualizan automáticamente
```

### Offline
```
Usuario edita → save(tour, false)
  ↓
DatabaseService.saveLocal()
  ↓
hybridStorage.saveTour()
  ↓
Marca: hasLocalChanges = true
  ↓
SyncEvents.notifyDataChanged() ✨
  ↓
useCloudSync detecta cambios pendientes
  ↓
Auto-sync al reconectar (cada 30s o manual)
```

---

## 🧪 Testing

```bash
# Ejecutar tests de integración
npm run test src/__tests__/sync-integration.test.ts
```

Tests incluidos:
- ✅ Emitir/escuchar eventos
- ✅ Filtrar eventos por tabla
- ✅ Crear tour offline
- ✅ Limpieza de metadatos
- ✅ Detección de estado online/offline
- ✅ Marcar tours como pendientes

---

## 📱 Soporte Móvil (Capacitor)

### Android/iOS
- Usa **SQLite** en lugar de IndexedDB
- Compresión automática con `pako`
- Permisos de almacenamiento requeridos

### Instalar dependencia SQLite (opcional)
```bash
npm install @capacitor-community/sqlite
npx cap sync
```

---

## ⚙️ Configuración

### 1. Cambiar a tu Supabase

**⚠️ IMPORTANTE**: El archivo `.env` se actualiza automáticamente, pero si quieres forzar el cambio:

```env
VITE_SUPABASE_PROJECT_ID="jlgqaxrgoekggcowsnzj"
VITE_SUPABASE_PUBLISHABLE_KEY="tu_key"
VITE_SUPABASE_URL="https://jlgqaxrgoekggcowsnzj.supabase.co"
```

### 2. Verificar tablas en Supabase

Asegúrate de tener estas tablas con RLS habilitado:
- `virtual_tours`
- `floor_plans`
- `hotspots`
- `tenants`
- `tenant_users`

---

## 🐛 Debugging

### Ver eventos en consola

```typescript
// Activar logs de eventos
SyncEvents.onDataChanged((event) => {
  console.log('📡 Evento recibido:', event);
});
```

### Verificar estado de sync

```typescript
const { syncStatus } = useDatabaseSync('virtual_tours');

console.log('Online:', syncStatus.isOnline);
console.log('Sincronizando:', syncStatus.isSyncing);
console.log('Pendientes:', syncStatus.pendingChanges);
console.log('Conflictos:', syncStatus.hasConflicts);
```

### Forzar sincronización

```typescript
const { syncNow } = useDatabaseSync('virtual_tours');
await syncNow();
```

---

## 📊 Comparación con Código Original

| Característica | Tu Código | Código Existente | Sistema Híbrido |
|---------------|-----------|------------------|-----------------|
| Eventos cross-tab | ✅ CustomEvent | ❌ | ✅ |
| Limpieza metadatos | ✅ delete props | ❌ | ✅ |
| Conflictos | ❌ | ✅ UI resolution | ✅ |
| Auto-sync | ❌ | ✅ Cada 30s | ✅ |
| Móvil nativo | ❌ IndexedDB solo | ✅ Filesystem | ✅ |
| TypeScript | ❌ JS | ✅ TS | ✅ |
| Tests | ✅ Funcionales | ❌ | ✅ Vitest |

---

## 🚀 Próximos Pasos

1. **Verificar Supabase**: Asegúrate de que las credenciales en `.env` apunten a tu proyecto nuevo
2. **Ejecutar tests**: `npm run test` para validar el sistema
3. **Probar en móvil**: Compilar con `npx cap sync && npx cap run android`
4. **Monitorear eventos**: Abrir 2 tabs del dashboard y editar tours simultáneamente

---

## 📝 Notas Técnicas

### Metadatos Limpiados antes de Sync
```typescript
_syncStatus
_lastModified
_deleted
cachedAt
_compressed
hasLocalChanges
lastSyncedAt
```

### Eventos Disponibles
```typescript
'dataChanged' → tabla, operation, recordId
'syncStatusChanged' → status, table, timestamp
```

### Operaciones Soportadas
- `insert` - Nuevo registro
- `update` - Actualización
- `delete` - Eliminación
- `sync` - Sincronización completada
