import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Image, ArrowLeftRight, ArrowUpDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SwipeGallery } from '@/components/shared/SwipeGallery';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const SwipeDemo = () => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Demo images
  const demoImages = [
    {
      url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
      alt: 'Modern House 1',
      title: 'Sala de Estar Principal',
    },
    {
      url: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800',
      alt: 'Modern House 2',
      title: 'Cocina Moderna',
    },
    {
      url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
      alt: 'Modern House 3',
      title: 'Dormitorio Principal',
    },
    {
      url: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800',
      alt: 'Modern House 4',
      title: 'Baño de Diseño',
    },
    {
      url: 'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800',
      alt: 'Modern House 5',
      title: 'Jardín Exterior',
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>

        {/* Title Card */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-3xl flex items-center gap-3">
                  👆 Demo de Swipe Gestures
                </CardTitle>
                <CardDescription className="mt-2">
                  Sistema completo de navegación por gestos para móvil y desktop
                </CardDescription>
              </div>
              <Badge variant="default" className="text-lg px-4 py-1">
                ✅ ACTIVO
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Gallery Demo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5" />
                Galería Horizontal
              </CardTitle>
              <CardDescription>
                Desliza ← → o usa los botones para navegar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] rounded-lg overflow-hidden">
                <SwipeGallery
                  images={demoImages}
                  onImageChange={setCurrentImageIndex}
                  showControls={true}
                  showDots={true}
                />
              </div>
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">Estado Actual:</p>
                <p className="text-xs text-muted-foreground">
                  Imagen: {currentImageIndex + 1}/{demoImages.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  {demoImages[currentImageIndex].title}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>📱 Cómo Usar Swipe Gestures</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                  <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Touch/Mouse Down</p>
                    <p className="text-sm text-muted-foreground">
                      Toca o haz clic en la galería para iniciar el gesto
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                  <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Swipe Direction</p>
                    <p className="text-sm text-muted-foreground">
                      Desliza hacia la izquierda (←) o derecha (→)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                  <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 font-bold">
                    3
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Release</p>
                    <p className="text-sm text-muted-foreground">
                      Suelta para completar la navegación (threshold: 50px)
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">✨ Características Implementadas</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Swipe horizontal (← →) para galerías de fotos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Threshold de 50px para activar navegación</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Animaciones suaves con transform y spring physics</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Indicadores visuales durante el swipe</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Soporte para touch devices y mouse</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Dots indicator para posición actual</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Controles de navegación opcionales</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Auto-play opcional con intervalo configurable</span>
                  </li>
                </ul>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">🎯 Casos de Uso</h4>
                <div className="space-y-2 text-sm">
                  <div className="p-2 bg-muted rounded">
                    <p className="font-medium">Galerías de Fotos</p>
                    <p className="text-xs text-muted-foreground">Navegación horizontal entre imágenes</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="font-medium">Tours 360°</p>
                    <p className="text-xs text-muted-foreground">Swipe vertical para cambiar panoramas</p>
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <p className="font-medium">Hotspot Photos</p>
                    <p className="text-xs text-muted-foreground">Navegación entre fotos del punto</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Technical Details */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle>⚙️ Detalles Técnicos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Hook: useSwipeGesture</h4>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
{`const { handlers, swipeState } = useSwipeGesture({
  threshold: 50,        // Mínimo px
  velocity: 0.3,        // Velocidad mín
  onSwipeLeft: () => {},
  onSwipeRight: () => {},
  trackMouse: true      // Mouse support
});`}
                </pre>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Componente: SwipeGallery</h4>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
{`<SwipeGallery
  images={imageArray}
  onImageChange={(idx) => {}}
  showControls={true}
  showDots={true}
  autoPlay={false}
/>`}
                </pre>
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <h4 className="font-semibold mb-2">🎨 Animaciones</h4>
              <ul className="text-sm space-y-1">
                <li>• <strong>Transform</strong>: translateX/Y para movimiento suave</li>
                <li>• <strong>Spring Physics</strong>: stiffness: 300, damping: 30</li>
                <li>• <strong>Opacity</strong>: Fade in/out durante transiciones</li>
                <li>• <strong>Indicators</strong>: Feedback visual en tiempo real</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Integration Guide */}
        <Card className="bg-gradient-to-r from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle>📦 Integración en Tu Proyecto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="font-semibold mb-2">1. Importar el hook:</p>
                <code className="text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded">
                  import {`{ useSwipeGesture }`} from '@/hooks/useSwipeGesture';
                </code>
              </div>
              <div>
                <p className="font-semibold mb-2">2. Usar en tu componente:</p>
                <code className="text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded block">
                  {`const { handlers, swipeState } = useSwipeGesture({ ... });`}
                </code>
              </div>
              <div>
                <p className="font-semibold mb-2">3. Aplicar handlers:</p>
                <code className="text-xs bg-black/10 dark:bg-white/10 px-2 py-1 rounded block">
                  {`<div {...handlers}>Tu contenido</div>`}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SwipeDemo;
