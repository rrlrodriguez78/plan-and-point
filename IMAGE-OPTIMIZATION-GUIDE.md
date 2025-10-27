# 🖼️ GUÍA DE OPTIMIZACIÓN DE IMÁGENES

## 📋 RESUMEN

Sistema completo de optimización de imágenes implementado con:
- ✅ Conversión automática a WebP con fallback JPEG
- ✅ Lazy loading con IntersectionObserver
- ✅ Responsive images (srcset múltiples resoluciones)
- ✅ Compresión 85% calidad
- ✅ Preload para imágenes críticas
- ✅ Detección de soporte WebP en navegador

---

## 🎯 COMPONENTE PRINCIPAL: OptimizedImage

### Uso Básico

```tsx
import { OptimizedImage } from '@/components/shared/OptimizedImage';

// Imagen estándar con lazy loading
<OptimizedImage
  src="/images/photo.jpg"
  alt="Descripción de la imagen"
  width={1920}
  height={1080}
/>
```

### Imagen Crítica (Hero/Above-the-fold)

```tsx
// Imagen que debe cargarse inmediatamente
<OptimizedImage
  src="/hero-image.jpg"
  alt="Hero section"
  width={1920}
  height={1080}
  priority={true}  // Desactiva lazy loading
/>
```

### Imágenes Responsive con Tamaños Específicos

```tsx
<OptimizedImage
  src="/gallery/image.jpg"
  alt="Gallery image"
  width={1200}
  height={800}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  className="rounded-lg shadow-lg"
  objectFit="cover"
/>
```

### Props del Componente

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `src` | `string` | - | URL de la imagen (requerido) |
| `alt` | `string` | - | Texto alternativo (requerido) |
| `width` | `number` | - | Ancho en píxeles |
| `height` | `number` | - | Alto en píxeles |
| `priority` | `boolean` | `false` | Si es true, carga inmediatamente sin lazy loading |
| `quality` | `number` | `85` | Calidad de compresión (0-100) |
| `sizes` | `string` | `'100vw'` | Atributo sizes para responsive images |
| `className` | `string` | - | Clases CSS adicionales |
| `objectFit` | `string` | `'cover'` | CSS object-fit property |
| `onLoad` | `() => void` | - | Callback cuando la imagen carga |
| `onError` | `() => void` | - | Callback en caso de error |

---

## 🚀 PRELOAD DE IMÁGENES CRÍTICAS

Para imágenes que deben cargarse antes que todo (logos, hero images):

```tsx
import { PreloadCriticalImages } from '@/components/shared/PreloadCriticalImages';

function App() {
  return (
    <>
      <PreloadCriticalImages 
        images={[
          { src: '/logo.webp', format: 'webp' },
          { src: '/hero-bg.webp', format: 'webp' },
          { src: '/fallback.jpg', format: 'jpeg' },
        ]}
      />
      {/* resto del componente */}
    </>
  );
}
```

---

## 🔧 UTILIDADES DE OPTIMIZACIÓN

### 1. Optimizar Imagen Individual

```typescript
import { optimizeImage } from '@/utils/imageOptimization';

const file = event.target.files[0]; // File from input

const result = await optimizeImage(file, {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.85,
  format: 'webp', // 'webp' o 'jpeg'
  maxSizeMB: 2,
});

console.log('Original:', result.originalSize);
console.log('Optimizado:', result.optimizedSize);
console.log('Formato:', result.format);
console.log('Dimensiones:', result.width, 'x', result.height);
```

### 2. Convertir a WebP con Fallback JPEG

```typescript
import { convertToWebP } from '@/utils/imageOptimization';

const file = event.target.files[0];

const { webp, jpeg } = await convertToWebP(file);

// Subir ambas versiones al storage
await uploadToStorage(webp);  // Versión moderna
await uploadToStorage(jpeg);  // Fallback
```

### 3. Generar Variantes Responsive

```typescript
import { generateResponsiveVariants } from '@/utils/imageOptimization';

const file = event.target.files[0];

// Genera versiones en múltiples tamaños
const variants = await generateResponsiveVariants(file, [320, 640, 1024, 1920]);

// variants es un Map<number, { webp: Blob, jpeg: Blob }>
for (const [width, { webp, jpeg }] of variants) {
  console.log(`Tamaño ${width}px generado`);
  // Subir cada variante
}
```

### 4. Detectar Soporte de WebP

```typescript
import { checkWebPSupport } from '@/utils/imageOptimization';

const supportsWebP = await checkWebPSupport();

if (supportsWebP) {
  console.log('El navegador soporta WebP');
} else {
  console.log('Usar JPEG como fallback');
}
```

### 5. Precargar Imágenes Programáticamente

```typescript
import { preloadImage } from '@/utils/imageOptimization';

// Precargar imagen crítica
preloadImage('/hero-image.webp', 'webp');
preloadImage('/hero-image.jpg', 'jpeg');
```

---

## 🎨 HOOK DE LAZY LOADING

Para implementar lazy loading manualmente:

```tsx
import { useLazyImage } from '@/hooks/useLazyImage';

function CustomImage({ src, alt }) {
  const { imgRef, isVisible } = useLazyImage({
    threshold: 0.1,      // 10% del elemento visible
    rootMargin: '50px',  // Cargar 50px antes de ser visible
  });

  return (
    <img
      ref={imgRef}
      src={isVisible ? src : undefined}
      alt={alt}
      className={isVisible ? 'opacity-100' : 'opacity-0'}
    />
  );
}
```

---

## 📊 FORMATO DE OUTPUT

El sistema genera automáticamente:

### Estructura HTML Generada

```html
<picture>
  <!-- Versión WebP moderna -->
  <source 
    type="image/webp"
    srcset="
      /images/photo-320w.webp 320w,
      /images/photo-640w.webp 640w,
      /images/photo-1024w.webp 1024w,
      /images/photo-1920w.webp 1920w
    "
    sizes="(max-width: 768px) 100vw, 50vw"
  />
  
  <!-- Fallback JPEG -->
  <source 
    type="image/jpeg"
    srcset="
      /images/photo-320w.jpg 320w,
      /images/photo-640w.jpg 640w,
      /images/photo-1024w.jpg 1024w,
      /images/photo-1920w.jpg 1920w
    "
    sizes="(max-width: 768px) 100vw, 50vw"
  />
  
  <!-- Fallback final para navegadores antiguos -->
  <img 
    src="/images/photo.jpg" 
    alt="Descripción" 
    loading="lazy"
    width="1920"
    height="1080"
  />
</picture>
```

---

## 🎯 CASOS DE USO

### Hero Images

```tsx
<OptimizedImage
  src="/hero-bg.jpg"
  alt="Hero background"
  width={1920}
  height={1080}
  priority={true}
  className="w-full h-screen"
  objectFit="cover"
/>
```

### Gallery con Thumbnails

```tsx
// Thumbnail
<OptimizedImage
  src="/gallery/thumb.jpg"
  alt="Thumbnail"
  width={320}
  height={240}
  sizes="(max-width: 768px) 50vw, 25vw"
/>

// Fullsize
<OptimizedImage
  src="/gallery/full.jpg"
  alt="Full image"
  width={1920}
  height={1440}
  sizes="100vw"
  priority={false}
/>
```

### Profile Avatars

```tsx
<OptimizedImage
  src={user.avatar}
  alt={user.name}
  width={128}
  height={128}
  className="rounded-full"
  objectFit="cover"
  sizes="128px"
/>
```

### Blog Post Images

```tsx
<OptimizedImage
  src={post.featuredImage}
  alt={post.title}
  width={1200}
  height={675}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
  className="rounded-lg mb-4"
/>
```

---

## ⚡ PERFORMANCE TIPS

### 1. Usar Priority Solo para Above-the-Fold

```tsx
// ✅ CORRECTO: Hero image
<OptimizedImage src="/hero.jpg" priority={true} />

// ❌ INCORRECTO: Imagen en footer
<OptimizedImage src="/footer.jpg" priority={true} />
```

### 2. Especificar Dimensiones

```tsx
// ✅ CORRECTO: Previene layout shift
<OptimizedImage width={1920} height={1080} />

// ⚠️ ADVERTENCIA: Puede causar CLS
<OptimizedImage className="w-full" />
```

### 3. Usar Sizes Apropiados

```tsx
// ✅ CORRECTO: Tamaños específicos
<OptimizedImage 
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
/>

// ❌ INCORRECTO: Siempre 100vw
<OptimizedImage sizes="100vw" /> // en una imagen pequeña
```

---

## 🔍 VALIDACIÓN Y TESTING

### Verificar WebP Support

```typescript
const supported = await checkWebPSupport();
console.log('WebP:', supported ? '✅' : '❌');
```

### Medir Savings

```typescript
import { getCompressionStats } from '@/utils/imageOptimization';

const stats = getCompressionStats(originalSize, optimizedSize);
console.log(`Ahorro: ${stats.savingsPercent}%`);
console.log(`Ratio: ${stats.ratio}`);
```

### Chrome DevTools

1. **Network Tab**: Verificar formato WebP
2. **Performance Tab**: Medir LCP
3. **Lighthouse**: Score de imágenes optimizadas

---

## 📈 RESULTADOS ESPERADOS

### Antes vs Después

| Métrica | Antes | Después | Mejora |
|---------|-------|---------|--------|
| Tamaño archivo | 2.5 MB | 180 KB | 93% |
| Formato | JPEG | WebP | Moderno |
| LCP | 4.2s | 1.1s | 74% |
| Requests | 50 | 50 | - |
| Lazy Loading | ❌ | ✅ | +100% |

### Core Web Vitals

- **LCP**: < 2.5s ✅
- **FID**: < 100ms ✅
- **CLS**: < 0.1 ✅

---

## 🚨 TROUBLESHOOTING

### Imagen no carga

1. Verificar que el `src` sea válido
2. Check consola para errores
3. Verificar CORS si es imagen externa

### Lazy loading no funciona

1. Verificar `IntersectionObserver` support
2. Reducir `threshold` y aumentar `rootMargin`
3. Usar `priority={true}` como workaround

### WebP no soportado

El sistema automáticamente usa el fallback JPEG cuando WebP no está disponible.

---

## 📚 REFERENCIAS

- [Archivos del Sistema](#archivos)
- [Web.dev - Image Optimization](https://web.dev/fast/#optimize-your-images)
- [MDN - Responsive Images](https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images)

### Archivos

- **Componente**: `src/components/shared/OptimizedImage.tsx`
- **Hook**: `src/hooks/useLazyImage.ts`
- **Utils**: `src/utils/imageOptimization.ts`
- **Preload**: `src/components/shared/PreloadCriticalImages.tsx`

---

**Última actualización**: 2025-10-27
**Versión**: 1.0.0
