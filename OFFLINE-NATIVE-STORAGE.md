# 📱 Almacenamiento Nativo Offline

## Descripción General

Esta aplicación utiliza un sistema híbrido de almacenamiento que se adapta automáticamente según la plataforma:

- **Web Desktop**: IndexedDB (100MB límite, 5 tours máximo)
- **Mobile (Android/iOS)**: Filesystem nativo (sin límites artificiales*)

*Solo limitado por el espacio disponible en el dispositivo

## Características

### Sistema Híbrido Inteligente

El sistema detecta automáticamente la plataforma y selecciona el método de almacenamiento óptimo:

```typescript
// En Web
hybridStorage → IndexedDB Adapter

// En Mobile con permisos
hybridStorage → Filesystem Adapter

// En Mobile sin permisos
hybridStorage → IndexedDB Adapter (fallback)
```

### Compresión Automática

En almacenamiento nativo, los datos se comprimen automáticamente usando `pako` (deflate/inflate):
- Reducción de ~40% en espacio usado
- Compresión/descompresión transparente
- Mejor rendimiento en dispositivos con almacenamiento limitado

### Migración Automática

Al abrir la app en mobile por primera vez:
1. Detecta tours en IndexedDB (sistema antiguo)
2. Solicita permisos de almacenamiento si es necesario
3. Muestra diálogo de migración con progreso
4. Migra automáticamente todos los tours
5. Elimina datos del sistema antiguo

## Ubicación de Archivos

### Android
```
/storage/emulated/0/VirtualTour360/
├── tours/
│   ├── tour-abc-123/
│   │   ├── metadata.json
│   │   ├── tour.json
│   │   ├── hotspots.json
│   │   ├── floor_plans/
│   │   │   ├── fp1.jpg
│   │   │   └── fp2.jpg
│   │   └── photos/
│   │       ├── photo1.jpg
│   │       └── photo2.jpg
└── pending_photos/
    ├── pending1.jpg
    └── pending2.jpg
```

### iOS
```
Documents/VirtualTour360/
├── (misma estructura que Android)
```

### Web
```
IndexedDB → VirtualTour360DB
├── tours (object store)
├── floorPlanImages (object store)
└── hotspots (object store)
```

## Estructura de Datos

### metadata.json
```json
{
  "id": "tour-abc-123",
  "name": "Tour Example",
  "savedAt": "2025-01-04T12:00:00.000Z",
  "floorPlanCount": 3,
  "hotspotCount": 15,
  "photoCount": 45,
  "size": 52428800
}
```

### tour.json
```json
{
  "id": "tour-abc-123",
  "title": "Tour Example",
  "description": "...",
  "tenant_id": "...",
  "_compressed": true
}
```

## Uso en la Aplicación

### Editor (`src/pages/Editor.tsx`)

```typescript
import { hybridStorage } from '@/utils/hybridStorage';

// Cargar tour offline
const cachedTour = await hybridStorage.loadTour(tourId);
if (cachedTour) {
  setTour(cachedTour.tour);
  setFloorPlans(cachedTour.floorPlans);
  setHotspots(cachedTour.hotspots);
}

// Preparar tour para offline
await hybridStorage.saveTour(
  tour.id,
  tour.title,
  tour,
  floorPlans,
  hotspots,
  photos
);
```

### Hook (`src/hooks/useHybridStorage.ts`)

```typescript
const { 
  isNativeApp,
  hasPermission,
  stats,
  usingNativeStorage,
  requestPermissions,
  saveTour,
  loadTour,
  listTours,
  deleteTour,
  refreshStats
} = useHybridStorage();

// Solicitar permisos (solo mobile)
if (isNativeApp && !hasPermission) {
  await requestPermissions();
}

// Estadísticas
console.log(stats);
// {
//   count: 12,           // Número de tours
//   size: 524288000,     // Espacio usado (bytes)
//   limit: 1073741824,   // Límite (solo web) o espacio disponible (mobile)
//   availableSpace: 1073741824  // Solo mobile
// }
```

## Sincronización Inteligente

El sistema de sincronización (`useIntelligentSync`) ahora trabaja con el almacenamiento híbrido:

1. **Detección de tours pendientes**: Busca en `hybridStorage.listTours()`
2. **Upload por partes**: Tours grandes se suben en chunks de 5MB
3. **Sincronización en background**: Usa Capacitor Background Task (mobile)
4. **Resolución de conflictos**: Compara timestamps y permite merge manual

### Workflow de Sincronización

```typescript
📱 Offline:
1. Usuario edita tour → Se guarda en hybridStorage
2. Se marca como "pendiente de sync"
3. Usuario toma fotos → Se guardan en pending_photos/

🌐 Online:
1. Hook detecta conexión
2. Comprime y sube tours modificados
3. Sube fotos pendientes
4. Actualiza Supabase
5. Limpia archivos sincronizados (opcional)
```

## Gestión de Permisos

### Android

Permisos requeridos (configurados automáticamente):
- `READ_EXTERNAL_STORAGE` (Android < 13)
- `WRITE_EXTERNAL_STORAGE` (Android < 13)
- `READ_MEDIA_IMAGES` (Android 13+)

### iOS

Permisos requeridos (configurados en `Info.plist`):
- `NSPhotoLibraryUsageDescription`
- `NSPhotoLibraryAddUsageDescription`

## Troubleshooting

### Problema: "No storage permissions"

**Solución**:
1. Ir a Ajustes del dispositivo
2. Aplicaciones → VirtualTour360
3. Permisos → Almacenamiento → Permitir

### Problema: Tours no se muestran en el explorador de archivos

**Verificar**:
```bash
# Android (via adb)
adb shell ls -la /storage/emulated/0/VirtualTour360/

# iOS (via Xcode)
# Window → Devices and Simulators → Download Container
```

### Problema: Error de compresión/descompresión

**Causa**: Datos corruptos o versión incompatible de pako

**Solución**:
1. Eliminar tour corrupto
2. Re-descargar desde servidor
3. Verificar logs: `console.log` muestra errores de compression

## Limitaciones

### Web (IndexedDB)
- Máximo 100MB total
- Máximo 5 tours simultáneos
- Expiración automática a los 7 días
- Datos pueden ser borrados por el navegador

### Mobile (Filesystem)
- Requiere permisos de almacenamiento
- Tours grandes pueden tardar en cargar
- Backup manual recomendado

## Mejores Prácticas

### Para Usuarios

1. **Preparar tours antes de salir**: Usa el botón "Preparar offline" en el Editor
2. **Verificar espacio disponible**: Revisa el widget de caché en Dashboard
3. **Sincronizar regularmente**: No acumules más de 50 fotos pendientes
4. **Limpiar tours antiguos**: Elimina tours que ya no necesites offline

### Para Desarrolladores

1. **Siempre usar hybridStorage**: No usar directamente `nativeFileStorage` o `tourOfflineCache`
2. **Verificar permisos primero**: Comprobar `hasPermission` antes de operaciones de I/O
3. **Manejar errores gracefully**: Filesystem puede fallar por múltiples razones
4. **Testear en ambas plataformas**: Web y mobile tienen comportamientos diferentes

## Testing

### Test Manual en Android

```bash
# 1. Compilar APK
npm run build
npx cap sync android
npx cap run android

# 2. Verificar almacenamiento
adb shell ls -la /storage/emulated/0/VirtualTour360/

# 3. Verificar permisos
adb shell pm list permissions -g | grep STORAGE
```

### Test Manual en iOS

1. Abrir proyecto en Xcode: `npx cap open ios`
2. Build y correr en simulador/dispositivo
3. Verificar en Files app: On My iPhone → VirtualTour360

## Referencias

- [Capacitor Filesystem API](https://capacitorjs.com/docs/apis/filesystem)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [pako Compression](https://github.com/nodeca/pako)

## Soporte

Para reportar bugs o solicitar features relacionados con el almacenamiento offline, crear un issue en GitHub con:
- Plataforma (Web/Android/iOS)
- Logs de consola
- Pasos para reproducir
- Tamaño aproximado de los datos
