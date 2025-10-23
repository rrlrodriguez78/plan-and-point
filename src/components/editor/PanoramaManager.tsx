import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Upload, Trash2, GripVertical, Eye, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

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

const heavyImageConfig = {
  maxWidth: 4000,     // Resolución manteniendo calidad 360
  quality: 0.7,       // Compresión más agresiva
  format: 'jpeg',     // Estable para grandes archivos
  chunkSize: 1024 * 1024, // 1MB chunks
  previewSize: 1000   // Preview rápido
};

export default function PanoramaManager({ hotspotId }: PanoramaManagerProps) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<PanoramaPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Recuperar la última fecha usada de localStorage, o usar hoy por defecto
  const [uploadDate, setUploadDate] = useState<Date>(() => {
    const lastUsedDate = localStorage.getItem('lastUploadDate');
    return lastUsedDate ? parseISO(lastUsedDate) : new Date();
  });
  const [compressionStats, setCompressionStats] = useState<{
    originalSize: number;
    finalSize: number;
    reduction: number;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    progress: number;
    status: string;
  } | null>(null);

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
      toast.error(t('panorama.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const createThumbnail = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        if (width > heavyImageConfig.previewSize || height > heavyImageConfig.previewSize) {
          const ratio = Math.min(heavyImageConfig.previewSize / width, heavyImageConfig.previewSize / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            resolve('');
          }
        }, `image/${heavyImageConfig.format}`, 0.8);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const optimizeHeavy360 = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        // Calcular nuevo tamaño manteniendo ratio
        if (width > heavyImageConfig.maxWidth || height > heavyImageConfig.maxWidth) {
          const ratio = Math.min(heavyImageConfig.maxWidth / width, heavyImageConfig.maxWidth / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Alta calidad pero comprimido
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const optimizedFile = new File([blob], file.name, {
              type: `image/${heavyImageConfig.format}`,
              lastModified: Date.now(),
            });
            resolve(optimizedFile);
          } else {
            resolve(file);
          }
        }, `image/${heavyImageConfig.format}`, heavyImageConfig.quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('panorama.onlyImages'));
      return;
    }

    const originalSize = file.size;
    setUploading(true);
    setUploadProgress({ progress: 10, status: t('panorama.creatingPreview') });
    
    // Quick preview for immediate feedback
    const previewUrl = await createThumbnail(file);
    const tempId = `temp-${Date.now()}`;
    
    // Add temporary preview to show immediately
    setPhotos((prev) => [...prev, {
      id: tempId,
      hotspot_id: hotspotId,
      photo_url: previewUrl,
      display_order: prev.length,
      capture_date: format(uploadDate, 'yyyy-MM-dd'),
    }]);
    
    setUploadProgress({ progress: 30, status: t('panorama.previewReady') });
    
    try {
      // Optimize ALL photos for consistency (3-4MB target)
      setUploadProgress({ progress: 40, status: t('panorama.optimizing') });
      file = await optimizeHeavy360(file);
      
      // Calculate and display compression stats
      const reduction = Math.round(((originalSize - file.size) / originalSize) * 100);
      const stats = {
        originalSize,
        finalSize: file.size,
        reduction
      };
      setCompressionStats(stats);
      setUploadProgress({ progress: 65, status: t('panorama.optimized') });
      
      toast.success(
        `${t('panorama.optimized')}: ${(originalSize / (1024 * 1024)).toFixed(1)}MB → ${(file.size / (1024 * 1024)).toFixed(1)}MB (-${reduction}%)`,
        { duration: 5000 }
      );

      // Validate file size after optimization (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('panorama.imageTooLarge'));
        // Remove temp preview
        setPhotos((prev) => prev.filter(p => p.id !== tempId));
        return;
      }

      // Upload to Supabase Storage
      setUploadProgress({ progress: 70, status: t('panorama.uploading') });
      const fileExt = heavyImageConfig.format === 'jpeg' ? 'jpg' : heavyImageConfig.format;
      const fileName = `${hotspotId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('tour-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;
      
      setUploadProgress({ progress: 90, status: t('panorama.finalizing') });

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

      setUploadProgress({ progress: 100, status: t('panorama.complete') });
      toast.success(t('panorama.uploadSuccess'));
      
      // Guardar la fecha usada en localStorage para recordarla en el siguiente punto
      localStorage.setItem('lastUploadDate', format(uploadDate, 'yyyy-MM-dd'));
      
      // Revoke temporary preview URL
      URL.revokeObjectURL(previewUrl);
      
      // Reload to get the real photo
      loadPhotos();
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error(t('panorama.errorUploading'));
      // Remove temp preview on error
      setPhotos((prev) => prev.filter(p => p.id !== tempId));
    } finally {
      setUploading(false);
      setUploadProgress(null);
      // Reset input
      e.target.value = '';
    }
  };

  const handleDelete = async (photo: PanoramaPhoto) => {
    if (!confirm(t('panorama.deleteConfirm'))) return;

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

      toast.success(t('panorama.deleted'));
      loadPhotos();
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error(t('panorama.errorDeleting'));
    }
  };

  const updateCaptureDate = async (photoId: string, newDate: Date) => {
    try {
      const { error } = await supabase
        .from('panorama_photos')
        .update({ capture_date: format(newDate, 'yyyy-MM-dd') })
        .eq('id', photoId);

      if (error) throw error;
      
      toast.success(t('panorama.dateUpdated'));
      loadPhotos();
    } catch (error) {
      console.error('Error updating capture date:', error);
      toast.error(t('panorama.errorUpdatingDate'));
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
    return <div className="p-4 text-center text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('panorama.upload')}</Label>
        
        {/* Selector de fecha antes de subir */}
        <div className="flex items-center gap-2 mb-2">
          <Label className="text-sm">{t('panorama.captureDate')}</Label>
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
                onSelect={(date) => {
                  if (date) {
                    setUploadDate(date);
                    // Guardar inmediatamente al cambiar la fecha
                    localStorage.setItem('lastUploadDate', format(date, 'yyyy-MM-dd'));
                  }
                }}
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
              {t('panorama.clickToUpload')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('panorama.maxSize')}
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

        {/* Upload Progress */}
        {uploadProgress && (
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{uploadProgress.status}</span>
              <span className="text-muted-foreground">{Math.round(uploadProgress.progress)}%</span>
            </div>
            <Progress value={uploadProgress.progress} className="h-2" />
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div className="space-y-2">
          <Label>{t('panorama.photos')} ({photos.length})</Label>
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
                    <p className="text-sm font-medium">{t('panorama.photo')} {index + 1}</p>
                    {photo.capture_date && (
                      <Badge variant="secondary" className="text-xs">
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        {format(parseISO(photo.capture_date), 'dd/MM/yyyy')}
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
                        {t('panorama.changeDate')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={photo.capture_date ? parseISO(photo.capture_date) : new Date()}
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
          <p className="text-sm">{t('panorama.noPhotos')}</p>
          <p className="text-xs">{t('panorama.uploadFirst')}</p>
        </div>
      )}
    </div>
  );
}