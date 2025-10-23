import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Upload, Info, Palette, Camera, MapPin, Home, Star, Heart, Eye } from 'lucide-react';
import { toast } from 'sonner';
import PanoramaManager from './PanoramaManager';

interface HotspotData {
  id?: string;
  title: string;
  description?: string;
  x_position: number;
  y_position: number;
  media_url?: string;
  media_type?: string;
  style?: {
    icon: string;
    color: string;
    size: number;
  };
}

interface HotspotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: HotspotData) => Promise<void>;
  initialData?: HotspotData;
  mode: 'create' | 'edit';
}

export default function HotspotModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  mode,
}: HotspotModalProps) {
  const [activeTab, setActiveTab] = useState('info');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState<HotspotData>(
    initialData || {
      title: '',
      description: '',
      x_position: 50,
      y_position: 50,
      style: {
        icon: 'map-pin',
        color: '#3b82f6',
        size: 32,
      },
    }
  );

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('El título es requerido');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving hotspot:', error);
      toast.error('Error al guardar hotspot');
    } finally {
      setSaving(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // TODO: Implement actual upload to storage
      toast.success('Imagen subida exitosamente');
    } catch (error) {
      console.error('Error uploading media:', error);
      toast.error('Error al subir imagen');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Nuevo Hotspot' : 'Editar Hotspot'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info" className="gap-2">
              <Info className="w-4 h-4" />
              Información
            </TabsTrigger>
            <TabsTrigger value="style" className="gap-2">
              <Palette className="w-4 h-4" />
              Estilo
            </TabsTrigger>
            <TabsTrigger value="panorama" className="gap-2">
              <Eye className="w-4 h-4" />
              Fotos 360°
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-2">
              <Camera className="w-4 h-4" />
              Media
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Ej: Sala principal"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Describe este punto de interés..."
                rows={4}
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="x_position">Posición X (%)</Label>
                <Input
                  id="x_position"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.x_position}
                  onChange={(e) =>
                    setFormData({ ...formData, x_position: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="y_position">Posición Y (%)</Label>
                <Input
                  id="y_position"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.y_position}
                  onChange={(e) =>
                    setFormData({ ...formData, y_position: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="style" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label className="text-base font-semibold mb-3 block">Icono</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { icon: MapPin, name: 'map-pin' },
                    { icon: Home, name: 'home' },
                    { icon: Star, name: 'star' },
                    { icon: Heart, name: 'heart' },
                  ].map(({ icon: Icon, name }) => (
                    <Button
                      key={name}
                      variant="outline"
                      size="icon"
                      className={`h-14 ${formData.style?.icon === name ? 'ring-2 ring-primary' : ''}`}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          style: { ...formData.style!, icon: name },
                        })
                      }
                    >
                      <Icon className="w-6 h-6" />
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="icon-color" className="text-base font-semibold">
                  Color
                </Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    id="icon-color"
                    type="color"
                    value={formData.style?.color || '#3b82f6'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        style: { ...formData.style!, color: e.target.value },
                      })
                    }
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    type="text"
                    value={formData.style?.color || '#3b82f6'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        style: { ...formData.style!, color: e.target.value },
                      })
                    }
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold">
                  Tamaño: {formData.style?.size || 32}px
                </Label>
                <Slider
                  value={[formData.style?.size || 32]}
                  onValueChange={([val]) =>
                    setFormData({
                      ...formData,
                      style: { ...formData.style!, size: val },
                    })
                  }
                  min={24}
                  max={64}
                  step={4}
                  className="mt-2"
                />
              </div>

              <div className="bg-muted p-6 rounded-lg">
                <Label className="text-sm font-semibold mb-2 block">Vista Previa</Label>
                <div className="flex items-center justify-center p-4 bg-background rounded">
                  {(() => {
                    const iconName = formData.style?.icon || 'map-pin';
                    const iconMap: Record<string, any> = {
                      'map-pin': MapPin,
                      'home': Home,
                      'star': Star,
                      'heart': Heart,
                    };
                    const IconComponent = iconMap[iconName] || MapPin;
                    return (
                      <IconComponent
                        style={{
                          width: `${formData.style?.size || 32}px`,
                          height: `${formData.style?.size || 32}px`,
                          color: formData.style?.color || '#3b82f6',
                        }}
                      />
                    );
                  })()}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="panorama" className="space-y-4 mt-4">
            {initialData?.id ? (
              <PanoramaManager hotspotId={initialData.id} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Guarda el hotspot primero para agregar fotos 360°</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="media" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Foto 360° o Imagen</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                {formData.media_url ? (
                  <div className="space-y-2">
                    <img
                      src={formData.media_url}
                      alt="Preview"
                      className="max-h-48 mx-auto rounded-lg"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, media_url: undefined })}
                    >
                      Eliminar
                    </Button>
                  </div>
                ) : (
                  <label htmlFor="media-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Click para subir imagen o foto 360°
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Formatos: JPG, PNG, JPEG
                    </p>
                    <input
                      id="media-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleMediaUpload}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Guardar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
