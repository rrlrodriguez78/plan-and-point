import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Upload, Trash2, GripVertical, Eye, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface PanoramaPhoto {
  id: string;
  hotspot_id: string;
  photo_url: string;
  description?: string;
  display_order: number;
  capture_date?: string;
}

interface PanoramaManagerProps {
  hotspotId: string;
}

export default function PanoramaManager({ hotspotId }: PanoramaManagerProps) {
  const [photos, setPhotos] = useState<PanoramaPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadDate, setUploadDate] = useState<Date>(new Date());

  useEffect(() => {
    loadPhotos();
  }, [hotspotId]);

  const loadPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('panorama_photos')
        .select('*')
        .eq('hotspot_id', hotspotId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error('Error loading panorama photos:', error);
      toast.error('Error al cargar fotos 360°');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor sube solo imágenes');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 10MB');
      return;
    }

    setUploading(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${hotspotId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('tour-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(fileName);

      // Save to database
      const { error: dbError } = await supabase
        .from('panorama_photos')
        .insert({
          hotspot_id: hotspotId,
          photo_url: publicUrl,
          display_order: photos.length,
          capture_date: format(uploadDate, 'yyyy-MM-dd'),
        });

      if (dbError) throw dbError;

      toast.success('Foto 360° subida exitosamente');
      setUploadDate(new Date()); // Reset to today
      loadPhotos();
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Error al subir foto 360°');
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDelete = async (photo: PanoramaPhoto) => {
    if (!confirm('¿Eliminar esta foto 360°?')) return;

    try {
      // Delete from storage
      const fileName = photo.photo_url.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('tour-images')
          .remove([`${hotspotId}/${fileName}`]);
      }

      // Delete from database
      const { error } = await supabase
        .from('panorama_photos')
        .delete()
        .eq('id', photo.id);

      if (error) throw error;

      toast.success('Foto 360° eliminada');
      loadPhotos();
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('Error al eliminar foto 360°');
    }
  };

  const updateCaptureDate = async (photoId: string, newDate: Date) => {
    try {
      const { error } = await supabase
        .from('panorama_photos')
        .update({ capture_date: format(newDate, 'yyyy-MM-dd') })
        .eq('id', photoId);

      if (error) throw error;
      
      toast.success('Fecha actualizada');
      loadPhotos();
    } catch (error) {
      console.error('Error updating capture date:', error);
      toast.error('Error al actualizar fecha');
    }
  };

  const updateOrder = async (photoId: string, newOrder: number) => {
    try {
      const { error } = await supabase
        .from('panorama_photos')
        .update({ display_order: newOrder })
        .eq('id', photoId);

      if (error) throw error;
      loadPhotos();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Error al actualizar orden');
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newPhotos = [...photos];
    [newPhotos[index - 1], newPhotos[index]] = [newPhotos[index], newPhotos[index - 1]];
    newPhotos.forEach((photo, i) => updateOrder(photo.id, i));
  };

  const moveDown = (index: number) => {
    if (index === photos.length - 1) return;
    const newPhotos = [...photos];
    [newPhotos[index], newPhotos[index + 1]] = [newPhotos[index + 1], newPhotos[index]];
    newPhotos.forEach((photo, i) => updateOrder(photo.id, i));
  };

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Subir Foto 360°</Label>
        
        {/* Selector de fecha antes de subir */}
        <div className="flex items-center gap-2 mb-2">
          <Label className="text-sm">Fecha de captura:</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                {format(uploadDate, 'PPP', { locale: es })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={uploadDate}
                onSelect={(date) => date && setUploadDate(date)}
                locale={es}
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
          <label htmlFor="panorama-upload" className="cursor-pointer">
            <Upload className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-1">
              Click para subir foto 360°
            </p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG (Máx. 10MB)
            </p>
            <input
              id="panorama-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {photos.length > 0 && (
        <div className="space-y-2">
          <Label>Fotos 360° ({photos.length})</Label>
          <div className="space-y-2">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="flex items-center gap-2 p-2 bg-muted rounded-lg"
              >
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                  >
                    <GripVertical className="w-4 h-4" />
                  </Button>
                </div>
                
                <img
                  src={photo.photo_url}
                  alt={`Panorama ${index + 1}`}
                  className="w-16 h-16 object-cover rounded"
                />
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Foto {index + 1}</p>
                    {photo.capture_date && (
                      <Badge variant="secondary" className="text-xs">
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        {format(new Date(photo.capture_date), 'dd/MM/yyyy')}
                      </Badge>
                    )}
                  </div>
                  {photo.description && (
                    <p className="text-xs text-muted-foreground">{photo.description}</p>
                  )}
                  
                  {/* Editar fecha */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 p-1">
                        <CalendarIcon className="w-3 h-3" />
                        Cambiar fecha
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={photo.capture_date ? new Date(photo.capture_date) : new Date()}
                        onSelect={(date) => date && updateCaptureDate(photo.id, date)}
                        locale={es}
                        disabled={(date) => date > new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(photo.photo_url, '_blank')}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(photo)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {photos.length === 0 && !uploading && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No hay fotos 360° en este hotspot</p>
          <p className="text-xs">Sube la primera foto arriba</p>
        </div>
      )}
    </div>
  );
}