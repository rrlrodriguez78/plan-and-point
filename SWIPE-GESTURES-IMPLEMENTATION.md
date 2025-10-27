# 👆 Implementación de Swipe Gestures

## ✅ Sistema Completo Implementado

### 📁 Archivos Creados

1. **`src/hooks/useSwipeGesture.ts`** - Hook principal para gestos
2. **`src/components/shared/SwipeIndicator.tsx`** - Indicadores visuales
3. **`src/components/shared/SwipeGallery.tsx`** - Componente de galería con swipe
4. **`src/pages/SwipeDemo.tsx`** - Página demo interactiva

---

## 🎯 Características Implementadas

### ✅ Swipe Horizontal para Galerías
```typescript
const { handlers } = useSwipeGesture({
  threshold: 50,
  onSwipeLeft: goToNext,
  onSwipeRight: goToPrevious,
});
```
- ← Swipe izquierda: Siguiente imagen
- → Swipe derecha: Imagen anterior
- Threshold: 50px mínimo para activar

### ✅ Swipe Vertical (Preparado para Tours 360°)
```typescript
useSwipeGesture({
  onSwipeUp: () => {},
  onSwipeDown: () => {},
});
```
- ↑ Swipe arriba: Panorama superior
- ↓ Swipe abajo: Panorama inferior

### ✅ Touch Events con Threshold
```typescript
// Configuración personalizable
{
  threshold: 50,        // Mínimo 50px de movimiento
  velocity: 0.3,        // Velocidad mínima
  trackMouse: true,     // Soporte mouse para desktop
}
```

### ✅ Smooth Animations con Transform
```typescript
// Framer Motion con Spring Physics
variants={{
  enter: { x: 1000, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -1000, opacity: 0 },
}}
transition={{
  x: { type: 'spring', stiffness: 300, damping: 30 },
  opacity: { duration: 0.2 },
}}
```

### ✅ Indicadores Visuales
1. **SwipeIndicator**: Muestra dirección durante el swipe
2. **SwipeProgressBar**: Barra de progreso del movimiento
3. **SwipeDotsIndicator**: Puntos indicadores de posición

### ✅ Soporte Touch & Mouse
- Touch events para móviles/tablets
- Mouse events para desktop testing
- Unified pointer API

---

## 🎨 Componentes Disponibles

### 1. Hook: `useSwipeGesture`

```typescript
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

const { handlers, swipeState } = useSwipeGesture({
  threshold: 50,
  velocity: 0.3,
  onSwipeLeft: () => console.log('Swipe left'),
  onSwipeRight: () => console.log('Swipe right'),
  onSwipeUp: () => console.log('Swipe up'),
  onSwipeDown: () => console.log('Swipe down'),
  onSwiping: (deltaX, deltaY) => console.log('Swiping...'),
  onSwipeEnd: () => console.log('Swipe ended'),
  trackMouse: true,
});

return (
  <div {...handlers}>
    {/* Tu contenido */}
  </div>
);
```

**Configuración:**
- `threshold`: Distancia mínima en px (default: 50)
- `velocity`: Velocidad mínima (default: 0.3)
- `preventDefaultTouchmoveEvent`: Prevenir scroll (default: false)
- `trackMouse`: Habilitar mouse events (default: true)

**Estado retornado:**
```typescript
swipeState: {
  isSwiping: boolean,
  direction: 'left' | 'right' | 'up' | 'down' | null,
  deltaX: number,
  deltaY: number,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
}
```

### 2. Componente: `SwipeGallery`

```typescript
import { SwipeGallery } from '@/components/shared/SwipeGallery';

<SwipeGallery
  images={[
    { url: 'image1.jpg', alt: 'Image 1', title: 'Title 1' },
    { url: 'image2.jpg', alt: 'Image 2', title: 'Title 2' },
  ]}
  onImageChange={(index) => console.log('Current:', index)}
  showControls={true}
  showDots={true}
  autoPlay={false}
  autoPlayInterval={3000}
  className="h-[400px]"
/>
```

**Props:**
- `images`: Array de objetos {url, alt?, title?}
- `onImageChange`: Callback cuando cambia la imagen
- `showControls`: Mostrar botones prev/next (default: true)
- `showDots`: Mostrar indicadores de posición (default: true)
- `autoPlay`: Auto-avanzar imágenes (default: false)
- `autoPlayInterval`: Intervalo en ms (default: 3000)
- `className`: Clases adicionales

### 3. Indicadores Visuales

```typescript
import { 
  SwipeIndicator, 
  SwipeProgressBar, 
  SwipeDotsIndicator 
} from '@/components/shared/SwipeIndicator';

// Indicador de dirección
<SwipeIndicator
  direction="left"
  isActive={true}
  deltaX={100}
  deltaY={0}
/>

// Barra de progreso
<SwipeProgressBar
  direction="horizontal"
  progress={0.5}
  isActive={true}
/>

// Puntos indicadores
<SwipeDotsIndicator
  total={5}
  current={2}
  direction="horizontal"
/>
```

---

## 🚀 Casos de Uso

### Galería de Fotos Horizontal

```typescript
import { SwipeGallery } from '@/components/shared/SwipeGallery';

function PhotoGallery({ photos }) {
  return (
    <SwipeGallery
      images={photos.map(p => ({ url: p.url, title: p.name }))}
      onImageChange={(idx) => console.log('Foto:', idx)}
      showControls={true}
      showDots={true}
    />
  );
}
```

### Tour 360° con Swipe Vertical

```typescript
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

function PanoramaViewer({ panoramas, currentIndex, setCurrentIndex }) {
  const goUp = () => setCurrentIndex(Math.max(0, currentIndex - 1));
  const goDown = () => setCurrentIndex(Math.min(panoramas.length - 1, currentIndex + 1));

  const { handlers } = useSwipeGesture({
    threshold: 50,
    onSwipeUp: goUp,
    onSwipeDown: goDown,
    trackMouse: true,
  });

  return (
    <div {...handlers} className="panorama-viewer">
      {/* Tu viewer 360° */}
    </div>
  );
}
```

### Hotspot Photos Navigation

```typescript
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

function HotspotPhotoCarousel({ photos, activeIndex, setActiveIndex }) {
  const { handlers, swipeState } = useSwipeGesture({
    threshold: 50,
    onSwipeLeft: () => setActiveIndex((i) => (i + 1) % photos.length),
    onSwipeRight: () => setActiveIndex((i) => (i - 1 + photos.length) % photos.length),
  });

  return (
    <div {...handlers} className="relative">
      <img src={photos[activeIndex].url} />
      <SwipeIndicator
        direction={swipeState.direction}
        isActive={swipeState.isSwiping}
        deltaX={swipeState.deltaX}
      />
    </div>
  );
}
```

---

## 🧪 Testing & Demo

### Demo Interactivo
Visita: `/app/swipe-demo`

**Incluye:**
- ✅ Galería funcional con 5 imágenes
- ✅ Controles de navegación
- ✅ Indicadores visuales en tiempo real
- ✅ Instrucciones de uso
- ✅ Detalles técnicos
- ✅ Guía de integración

### Testing en Dispositivos

**Mobile:**
1. Samsung Galaxy S21/S23
2. iPhone 13/14/15
3. iPad
4. Tablets Android

**Desktop:**
1. Chrome + DevTools (touch simulation)
2. Firefox
3. Safari
4. Edge

---

## 📊 Performance

### Optimizaciones Aplicadas

1. **Hardware Acceleration**
```css
transform: translateZ(0);
will-change: transform;
```

2. **Efficient Re-renders**
```typescript
// useCallback para handlers
const goNext = useCallback(() => { ... }, [deps]);
```

3. **Clean Event Listeners**
```typescript
useEffect(() => {
  // Add listeners
  return () => {
    // Clean up
  };
}, []);
```

4. **Spring Physics**
```typescript
// Smooth animations
stiffness: 300,
damping: 30
```

---

## 🔧 Configuración Avanzada

### Personalizar Threshold

```typescript
// Más sensible (30px)
useSwipeGesture({ threshold: 30 });

// Menos sensible (80px)
useSwipeGesture({ threshold: 80 });
```

### Ajustar Velocidad

```typescript
// Requiere swipe más rápido
useSwipeGesture({ velocity: 0.5 });

// Permite swipe más lento
useSwipeGesture({ velocity: 0.1 });
```

### Prevenir Scroll

```typescript
// Para componentes fullscreen
useSwipeGesture({ 
  preventDefaultTouchmoveEvent: true 
});
```

### Deshabilitar Mouse (Solo Touch)

```typescript
// Solo dispositivos touch
useSwipeGesture({ trackMouse: false });
```

---

## 📱 Integración con Componentes Existentes

### PhotoGroupDialog

```typescript
// En src/components/editor/PhotoGroupDialog.tsx
import { SwipeGallery } from '@/components/shared/SwipeGallery';

// Reemplazar grid de fotos con:
<SwipeGallery
  images={match.photos.map(p => ({ url: p.preview }))}
  showControls={true}
  showDots={true}
/>
```

### PanoramaViewer

```typescript
// En src/components/viewer/PanoramaViewer.tsx
import { useSwipeGesture } from '@/hooks/useSwipeGesture';

const { handlers } = useSwipeGesture({
  onSwipeLeft: handleNextPhoto,
  onSwipeRight: handlePreviousPhoto,
});

// Aplicar a container:
<div {...handlers} ref={mountRef}>
```

---

## 🎯 Próximos Pasos

### Implementaciones Pendientes

1. **Aplicar a PanoramaViewer**
   - Swipe horizontal: Cambiar foto 360°
   - Swipe vertical: Cambiar hotspot

2. **Aplicar a PhotoGroupDialog**
   - Navegar entre fotos matched
   - Preview de fotos en galería

3. **Aplicar a HotspotModal**
   - Swipe entre fotos del hotspot
   - Indicadores de posición

4. **Tour Cards en Dashboard**
   - Swipe horizontal en lista de tours
   - Quick actions con swipe

---

## ✅ Checklist de Implementación

- [x] Hook `useSwipeGesture` creado
- [x] Componente `SwipeIndicator` creado
- [x] Componente `SwipeGallery` creado
- [x] Página demo `/app/swipe-demo` creada
- [x] Threshold de 50px implementado
- [x] Smooth animations con transform
- [x] Indicadores visuales
- [x] Soporte touch & mouse
- [ ] Integrar en PanoramaViewer
- [ ] Integrar en PhotoGroupDialog
- [ ] Integrar en HotspotModal
- [ ] Testing en dispositivos reales

---

## 🐛 Troubleshooting

### El swipe no funciona

1. Verificar que `handlers` estén aplicados:
```typescript
<div {...handlers}>
```

2. Revisar threshold:
```typescript
useSwipeGesture({ threshold: 30 }); // Más sensible
```

3. Verificar que el elemento sea lo suficientemente grande

### Conflicto con scroll

```typescript
// Deshabilitar scroll durante swipe
useSwipeGesture({ 
  preventDefaultTouchmoveEvent: true 
});
```

### Mouse no funciona

```typescript
// Asegurar que trackMouse esté habilitado
useSwipeGesture({ trackMouse: true });
```

---

**Fecha**: 2025-10-27  
**Versión**: 1.0.0  
**Estado**: ✅ Implementado y Listo para Uso
