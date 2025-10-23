import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Upload, Save, Eye, Plus, Globe, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Tour {
  id: string;
  title: string;
  is_published: boolean;
}

interface FloorPlan {
  id: string;
  name: string;
  image_url: string;
  width: number;
  height: number;
}

interface Hotspot {
  id: string;
  title: string;
  x_position: number;
  y_position: number;
  media_url?: string;
}

const Editor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tour, setTour] = useState<Tour | null>(null);
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const [newHotspot, setNewHotspot] = useState({ title: '', x: 50, y: 50 });
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      loadTourData();
    }
  }, [user, id]);

  const loadTourData = async () => {
    try {
      const { data: tourData } = await supabase
        .from('virtual_tours')
        .select('*')
        .eq('id', id)
        .single();

      if (tourData) {
        setTour(tourData);

        const { data: planData } = await supabase
          .from('floor_plans')
          .select('*')
          .eq('tour_id', id)
          .single();

        if (planData) {
          setFloorPlan(planData);

          const { data: hotspotsData } = await supabase
            .from('hotspots')
            .select('*')
            .eq('floor_plan_id', planData.id);

          if (hotspotsData) {
            setHotspots(hotspotsData);
          }
        }
      }
    } catch (error) {
      console.error('Error loading tour:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadFloorPlan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !tour) return;

    setUploadingPlan(true);
    const file = e.target.files[0];

    try {
      const fileName = `${tour.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tour-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(fileName);

      // Get image dimensions
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve) => { img.onload = resolve; });

      const { data: planData, error: planError } = await supabase
        .from('floor_plans')
        .insert({
          tour_id: tour.id,
          name: 'Plano Principal',
          image_url: publicUrl,
          width: img.width,
          height: img.height,
        })
        .select()
        .single();

      if (planError) throw planError;

      setFloorPlan(planData);
      toast.success('Plano subido exitosamente');
    } catch (error) {
      console.error('Error uploading floor plan:', error);
      toast.error('Error al subir plano');
    } finally {
      setUploadingPlan(false);
    }
  };

  const addHotspot = async () => {
    if (!floorPlan || !newHotspot.title.trim()) {
      toast.error('El título es requerido');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('hotspots')
        .insert({
          floor_plan_id: floorPlan.id,
          title: newHotspot.title,
          x_position: newHotspot.x,
          y_position: newHotspot.y,
        })
        .select()
        .single();

      if (error) throw error;

      setHotspots([...hotspots, data]);
      setDialogOpen(false);
      setNewHotspot({ title: '', x: 50, y: 50 });
      toast.success('Hotspot agregado');
    } catch (error) {
      console.error('Error adding hotspot:', error);
      toast.error('Error al agregar hotspot');
    }
  };

  const togglePublish = async () => {
    if (!tour) return;

    try {
      const { error } = await supabase
        .from('virtual_tours')
        .update({ is_published: !tour.is_published })
        .eq('id', tour.id);

      if (error) throw error;

      setTour({ ...tour, is_published: !tour.is_published });
      toast.success(tour.is_published ? 'Tour despublicado' : 'Tour publicado');
    } catch (error) {
      console.error('Error toggling publish:', error);
      toast.error('Error al cambiar estado');
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/app/tours')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-3xl font-bold">{tour?.title}</h1>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={togglePublish}>
              {tour?.is_published ? (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Despublicar
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 mr-2" />
                  Publicar
                </>
              )}
            </Button>
            {tour?.is_published && (
              <Button onClick={() => navigate(`/viewer/${id}`)}>
                <Eye className="w-4 h-4 mr-2" />
                Ver Tour
              </Button>
            )}
          </div>
        </div>

        {!floorPlan ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <h2 className="text-2xl font-bold">Sube un plano de planta</h2>
              <p className="text-muted-foreground">
                Comienza subiendo la imagen del plano donde colocarás los hotspots
              </p>
              <Label htmlFor="floor-plan-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-lg p-8 hover:border-primary transition-colors">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click para seleccionar imagen
                  </p>
                </div>
                <Input
                  id="floor-plan-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={uploadFloorPlan}
                  disabled={uploadingPlan}
                />
              </Label>
            </div>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="p-4">
                <div className="relative bg-muted rounded-lg overflow-hidden">
                  <img
                    src={floorPlan.image_url}
                    alt="Floor plan"
                    className="w-full h-auto"
                  />
                  {hotspots.map((hotspot) => (
                    <div
                      key={hotspot.id}
                      className="absolute w-8 h-8 -ml-4 -mt-4 bg-primary rounded-full border-4 border-primary-foreground cursor-pointer hover:scale-110 transition-transform flex items-center justify-center"
                      style={{
                        left: `${hotspot.x_position}%`,
                        top: `${hotspot.y_position}%`,
                      }}
                      title={hotspot.title}
                    >
                      <span className="text-xs font-bold text-primary-foreground">
                        {hotspots.indexOf(hotspot) + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="font-bold mb-4">Hotspots ({hotspots.length})</h3>
                
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full mb-4">
                      <Plus className="w-4 h-4 mr-2" />
                      Agregar Hotspot
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nuevo Hotspot</DialogTitle>
                      <DialogDescription>
                        Agrega un punto interactivo al plano
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Título</Label>
                        <Input
                          placeholder="Ej: Sala principal"
                          value={newHotspot.title}
                          onChange={(e) => setNewHotspot({ ...newHotspot, title: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Posición X (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={newHotspot.x}
                            onChange={(e) => setNewHotspot({ ...newHotspot, x: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Posición Y (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={newHotspot.y}
                            onChange={(e) => setNewHotspot({ ...newHotspot, y: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <Button onClick={addHotspot} className="w-full">
                        Crear Hotspot
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <div className="space-y-2">
                  {hotspots.map((hotspot, index) => (
                    <div key={hotspot.id} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground">
                          {index + 1}
                        </div>
                        <span className="text-sm font-medium">{hotspot.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Editor;