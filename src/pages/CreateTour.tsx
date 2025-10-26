import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Eye, Edit, Trash2, Globe, Lock, Upload, Image as ImageIcon, Shield } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { TourPasswordDialog } from '@/components/editor/TourPasswordDialog';

interface Tour {
  id: string;
  title: string;
  description: string;
  is_published: boolean;
  created_at: string;
  cover_image_url?: string;
  password_protected?: boolean;
}

export default function CreateTour() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [tourToDelete, setTourToDelete] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user) {
      loadTour();
    }
  }, [user]);

  const loadTour = async () => {
    try {
      const { data, error } = await supabase
        .from('virtual_tours')
        .select('*')
        .eq('id', 'a5f2a965-d194-4f27-a01f-a0981f0ae307')
        .single();

      if (error) throw error;
      setTour(data);
    } catch (error) {
      console.error('Error loading tour:', error);
      toast.error('Error al cargar el tour');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadCover = async () => {
    if (!tour) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploadingCover(true);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${tour.id}/cover-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('tour-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('tour-images')
          .getPublicUrl(fileName);

        const { error: updateError } = await supabase
          .from('virtual_tours')
          .update({ cover_image_url: publicUrl })
          .eq('id', tour.id);

        if (updateError) throw updateError;

        setTour({ ...tour, cover_image_url: publicUrl });
        toast.success('Portada actualizada');
      } catch (error) {
        console.error('Error uploading cover:', error);
        toast.error('Error al subir la portada');
      } finally {
        setUploadingCover(false);
      }
    };

    input.click();
  };

  const deleteTour = async () => {
    if (!tour) return;

    try {
      const { error } = await supabase
        .from('virtual_tours')
        .delete()
        .eq('id', tour.id);

      if (error) throw error;

      toast.success('Tour eliminado');
      setTourToDelete(null);
      navigate('/app/tours');
    } catch (error) {
      console.error('Error deleting tour:', error);
      toast.error('Error al eliminar el tour');
    }
  };

  const togglePublishStatus = async () => {
    if (!tour) return;

    try {
      const newStatus = !tour.is_published;
      const { error } = await supabase
        .from('virtual_tours')
        .update({ is_published: newStatus })
        .eq('id', tour.id);

      if (error) throw error;

      setTour({ ...tour, is_published: newStatus });
      toast.success(newStatus ? 'Tour publicado' : 'Tour despublicado');
    } catch (error) {
      console.error('Error toggling publish status:', error);
      toast.error('Error al cambiar el estado');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 pt-24 pb-12">
          <p className="text-muted-foreground">Tour no encontrado</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <h1 className="text-4xl font-bold mb-8">Mi Tour</h1>
        
        <div className="max-w-md">
          <Card className="p-0 hover:shadow-lg transition-all overflow-hidden">
            <div className="relative h-48 bg-muted overflow-hidden">
              {tour.cover_image_url ? (
                <>
                  <div 
                    onClick={() => navigate(`/viewer/${tour.id}`)}
                    className="cursor-pointer group w-full h-full"
                  >
                    <img 
                      src={tour.cover_image_url} 
                      alt={tour.title}
                      className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Eye className="w-12 h-12 text-white drop-shadow-lg" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                  <div className="text-center">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">Sin imagen</p>
                  </div>
                </div>
              )}
              
              {/* Title and Status Overlay - Top */}
              <div className="absolute top-1.5 left-1.5 right-1.5 z-10 flex justify-between items-start gap-2">
                <div className="backdrop-blur-sm bg-black/40 px-2 py-1 rounded border border-white/20 flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-xs truncate">{tour.title}</h3>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={togglePublishStatus}
                        className="backdrop-blur-sm bg-black/40 px-1.5 py-1 rounded border border-white/20 flex items-center justify-center shrink-0 hover:bg-black/60 transition-all cursor-pointer"
                      >
                        {tour.is_published ? (
                          <Globe className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-gray-300" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{tour.is_published ? 'Publicado' : 'No publicado'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              {/* Action Buttons - Bottom Left */}
              <div className="absolute bottom-1.5 left-1.5 flex gap-1.5 z-10">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/app/editor/${tour.id}`)}
                        className="h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-black/60 transition-all border border-white/20"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Editar</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setTourToDelete(tour.id)}
                        className="h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-red-600/60 transition-all border border-white/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Eliminar</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/viewer/${tour.id}`)}
                        className="h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-blue-600/60 transition-all border border-white/20"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{tour.is_published ? 'Ver' : 'Previsualizar'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {tour.is_published && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setPasswordDialogOpen(true)}
                          className="h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-purple-600/60 transition-all border border-white/20"
                        >
                          {tour.password_protected ? (
                            <Shield className="w-3.5 h-3.5 text-yellow-300" />
                          ) : (
                            <Lock className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{tour.password_protected ? 'Protegido' : 'Proteger con contraseña'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              
              {/* Upload Button - Bottom Right */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleUploadCover}
                      disabled={uploadingCover}
                      className="absolute bottom-1.5 right-1.5 z-10 h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-black/60 transition-all border border-white/20"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Subir portada</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </Card>
        </div>
      </main>

      <AlertDialog open={tourToDelete !== null} onOpenChange={(open) => !open && setTourToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tour?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El tour será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteTour}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {tour && (
        <TourPasswordDialog
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
          tourId={tour.id}
          isProtected={tour.password_protected || false}
          onSuccess={() => {
            loadTour();
            setPasswordDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
