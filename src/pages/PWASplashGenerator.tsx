import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Download, Image as ImageIcon, Smartphone, Tablet, Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  iosSplashScreens,
  androidSplashScreens,
  generateSplashScreen,
  downloadSplashScreen,
  type SplashScreenConfig,
} from '@/utils/generateSplashScreens';

const PWASplashGenerator = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [brandColor, setBrandColor] = useState('#000000');
  const [logoUrl, setLogoUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedScreens, setGeneratedScreens] = useState<{ config: SplashScreenConfig; dataUrl: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateAllScreens = async (screens: SplashScreenConfig[]) => {
    setGenerating(true);
    const generated: { config: SplashScreenConfig; dataUrl: string }[] = [];

    for (const screen of screens) {
      try {
        const dataUrl = await generateSplashScreen(screen.width, screen.height, brandColor, logoUrl);
        generated.push({ config: screen, dataUrl });
      } catch (error) {
        console.error(`Failed to generate splash screen for ${screen.deviceName}:`, error);
      }
    }

    setGeneratedScreens((prev) => [...prev, ...generated]);
    setGenerating(false);

    toast({
      title: '✅ Splash Screens Generadas',
      description: `${generated.length} splash screens creadas exitosamente`,
    });
  };

  const downloadAll = () => {
    generatedScreens.forEach(({ config, dataUrl }) => {
      downloadSplashScreen(dataUrl, `splash-${config.width}x${config.height}.png`);
    });

    toast({
      title: '⬇️ Descarga Iniciada',
      description: `Descargando ${generatedScreens.length} splash screens`,
    });
  };

  const getDeviceIcon = (deviceName: string) => {
    if (deviceName.includes('iPad')) return <Tablet className="h-4 w-4" />;
    if (deviceName.includes('iPhone')) return <Smartphone className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>

        {/* Title */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-3xl">🎨 Generador de PWA Splash Screens</CardTitle>
                <CardDescription className="mt-2">
                  Genera splash screens optimizados para iOS y Android
                </CardDescription>
              </div>
              <Badge variant="default" className="text-lg px-4 py-1">
                iOS + Android
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>⚙️ Configuración</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="brandColor">Color de Marca</Label>
                  <div className="flex gap-2">
                    <Input
                      id="brandColor"
                      type="color"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={brandColor}
                      onChange={(e) => setBrandColor(e.target.value)}
                      placeholder="#000000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo">Logo (opcional)</Label>
                  <Input
                    ref={fileInputRef}
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                  />
                  {logoUrl && (
                    <div className="mt-2 p-2 bg-muted rounded-lg">
                      <img src={logoUrl} alt="Logo preview" className="w-full h-auto max-h-32 object-contain" />
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Button
                    onClick={() => generateAllScreens(iosSplashScreens)}
                    disabled={generating}
                    className="w-full"
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    Generar iOS ({iosSplashScreens.length})
                  </Button>
                  <Button
                    onClick={() => generateAllScreens(androidSplashScreens)}
                    disabled={generating}
                    variant="secondary"
                    className="w-full"
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    Generar Android ({androidSplashScreens.length})
                  </Button>
                  <Button
                    onClick={() => generateAllScreens([...iosSplashScreens, ...androidSplashScreens])}
                    disabled={generating}
                    variant="outline"
                    className="w-full"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Generar Todos ({iosSplashScreens.length + androidSplashScreens.length})
                  </Button>
                </div>

                {generatedScreens.length > 0 && (
                  <Button onClick={downloadAll} className="w-full" variant="default">
                    <Download className="h-4 w-4 mr-2" />
                    Descargar Todas ({generatedScreens.length})
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">📋 Instrucciones</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <p>1. Selecciona tu color de marca</p>
                <p>2. Opcionalmente sube tu logo</p>
                <p>3. Genera las splash screens</p>
                <p>4. Descarga todas las imágenes</p>
                <p>5. Colócalas en <code className="bg-muted px-1 py-0.5 rounded">public/splash/</code></p>
              </CardContent>
            </Card>
          </div>

          {/* Generated Screens Gallery */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>🖼️ Splash Screens Generadas</CardTitle>
                <CardDescription>
                  {generatedScreens.length > 0
                    ? `${generatedScreens.length} splash screens creadas`
                    : 'Aún no has generado splash screens'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {generating && (
                  <div className="flex items-center justify-center p-12">
                    <div className="text-center space-y-2">
                      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                      <p className="text-sm text-muted-foreground">Generando splash screens...</p>
                    </div>
                  </div>
                )}

                {!generating && generatedScreens.length === 0 && (
                  <div className="flex items-center justify-center p-12 text-center">
                    <div className="space-y-2">
                      <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Configura y genera tus splash screens
                      </p>
                    </div>
                  </div>
                )}

                {generatedScreens.length > 0 && (
                  <ScrollArea className="h-[600px]">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-2">
                      {generatedScreens.map(({ config, dataUrl }, index) => (
                        <Card key={index} className="overflow-hidden">
                          <div className="aspect-[9/16] bg-black relative">
                            <img
                              src={dataUrl}
                              alt={config.deviceName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              {getDeviceIcon(config.deviceName)}
                              <span className="font-medium text-sm">{config.deviceName}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {config.width}x{config.height}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() =>
                                downloadSplashScreen(dataUrl, `splash-${config.width}x${config.height}.png`)
                              }
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Descargar
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Device Support Table */}
        <Card>
          <CardHeader>
            <CardTitle>📱 Dispositivos Soportados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  iOS Devices ({iosSplashScreens.length})
                </h4>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {iosSplashScreens.map((screen, idx) => (
                      <div key={idx} className="p-2 bg-muted rounded-lg text-sm">
                        <div className="font-medium">{screen.deviceName}</div>
                        <div className="text-xs text-muted-foreground">
                          {screen.width}x{screen.height}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Android Devices ({androidSplashScreens.length})
                </h4>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {androidSplashScreens.map((screen, idx) => (
                      <div key={idx} className="p-2 bg-muted rounded-lg text-sm">
                        <div className="font-medium">{screen.deviceName}</div>
                        <div className="text-xs text-muted-foreground">
                          {screen.width}x{screen.height}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PWASplashGenerator;
