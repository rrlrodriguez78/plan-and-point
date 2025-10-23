import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Plus, 
  Globe, 
  Lock, 
  Copy, 
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import FloorPlanManager from '@/components/editor/FloorPlanManager';
import HotspotEditor from '@/components/editor/HotspotEditor';
import HotspotModal from '@/components/editor/HotspotModal';

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
  tour_id: string;
  created_at: string;
}

interface Hotspot {
  id: string;
  title: string;
  description?: string;
  x_position: number;
  y_position: number;
  media_url?: string;
  media_type?: string;
  floor_plan_id: string;
  style?: {
    icon: string;
    color: string;
    size: number;
  };
}

const Editor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  // Tour and floor plans
  const [tour, setTour] = useState<Tour | null>(null);
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<FloorPlan | null>(null);
  
  // Hotspots
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedHotspotIds, setSelectedHotspotIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<Hotspot[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [hotspotModalOpen, setHotspotModalOpen] = useState(false);
  const [editingHotspot, setEditingHotspot] = useState<Hotspot | null>(null);
  const [floorPlansOpen, setFloorPlansOpen] = useState(true);
  const [hotspotsOpen, setHotspotsOpen] = useState(true);
  
  // Auto-save
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  useEffect(() => {
    if (selectedFloorPlan) {
      loadHotspots(selectedFloorPlan.id);
    }
  }, [selectedFloorPlan]);

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
          .order('created_at', { ascending: true });

        if (planData && planData.length > 0) {
          setFloorPlans(planData);
          setSelectedFloorPlan(planData[0]);
        }
      }
    } catch (error) {
      console.error('Error loading tour:', error);
      toast.error('Error al cargar tour');
    } finally {
      setLoading(false);
    }
  };

  const loadHotspots = async (floorPlanId: string) => {
    try {
      const { data } = await supabase
        .from('hotspots')
        .select('*')
        .eq('floor_plan_id', floorPlanId)
        .order('created_at', { ascending: true });

      if (data) {
        setHotspots(data);
      }
    } catch (error) {
      console.error('Error loading hotspots:', error);
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

  const handleHotspotClick = (hotspotId: string, event: React.MouseEvent) => {
    if (event.shiftKey) {
      // Multi-select
      setSelectedHotspotIds((prev) =>
        prev.includes(hotspotId)
          ? prev.filter((id) => id !== hotspotId)
          : [...prev, hotspotId]
      );
    } else {
      // Single select and open modal
      const hotspot = hotspots.find((h) => h.id === hotspotId);
      if (hotspot) {
        setEditingHotspot(hotspot);
        setHotspotModalOpen(true);
      }
    }
  };

  const handleCanvasClick = (x: number, y: number) => {
    setEditingHotspot({
      id: '',
      title: '',
      x_position: x,
      y_position: y,
      floor_plan_id: selectedFloorPlan?.id || '',
    });
    setHotspotModalOpen(true);
  };

  const handleHotspotDrag = async (hotspotId: string, x: number, y: number) => {
    // Update locally
    setHotspots((prev) =>
      prev.map((h) => (h.id === hotspotId ? { ...h, x_position: x, y_position: y } : h))
    );
    
    // Update in database
    try {
      await supabase
        .from('hotspots')
        .update({ x_position: x, y_position: y })
        .eq('id', hotspotId);
    } catch (error) {
      console.error('Error updating hotspot position:', error);
    }
  };

  const handleSaveHotspot = async (data: Omit<Hotspot, 'floor_plan_id'>) => {
    if (!selectedFloorPlan) return;

    try {
      if (data.id) {
        // Update existing
        const { error } = await supabase
          .from('hotspots')
          .update({
            title: data.title,
            description: data.description,
            x_position: data.x_position,
            y_position: data.y_position,
            media_url: data.media_url,
            media_type: data.media_type,
          })
          .eq('id', data.id);

        if (error) throw error;

        setHotspots((prev) =>
          prev.map((h) => (h.id === data.id ? { ...h, ...data } : h))
        );
        toast.success('Hotspot actualizado');
      } else {
        // Create new
        const { data: newHotspot, error } = await supabase
          .from('hotspots')
          .insert({
            floor_plan_id: selectedFloorPlan.id,
            title: data.title,
            description: data.description,
            x_position: data.x_position,
            y_position: data.y_position,
            media_url: data.media_url,
            media_type: data.media_type,
          })
          .select()
          .single();

        if (error) throw error;

        setHotspots((prev) => [...prev, newHotspot]);
        toast.success('Hotspot creado');
      }
    } catch (error) {
      console.error('Error saving hotspot:', error);
      throw error;
    }
  };

  const handleCopyHotspots = () => {
    const selected = hotspots.filter((h) => selectedHotspotIds.includes(h.id));
    setClipboard(selected);
    toast.success(`${selected.length} hotspot(s) copiado(s)`);
  };

  const handlePasteHotspots = async () => {
    if (!selectedFloorPlan || clipboard.length === 0) return;

    try {
      const newHotspots = clipboard.map((h) => ({
        floor_plan_id: selectedFloorPlan.id,
        title: `${h.title} (copia)`,
        description: h.description,
        x_position: h.x_position,
        y_position: h.y_position,
        media_url: h.media_url,
        media_type: h.media_type,
      }));

      const { data, error } = await supabase
        .from('hotspots')
        .insert(newHotspots)
        .select();

      if (error) throw error;

      setHotspots((prev) => [...prev, ...data]);
      toast.success(`${data.length} hotspot(s) pegado(s)`);
    } catch (error) {
      console.error('Error pasting hotspots:', error);
      toast.error('Error al pegar hotspots');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedHotspotIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('hotspots')
        .delete()
        .in('id', selectedHotspotIds);

      if (error) throw error;

      setHotspots((prev) => prev.filter((h) => !selectedHotspotIds.includes(h.id)));
      setSelectedHotspotIds([]);
      toast.success(`${selectedHotspotIds.length} hotspot(s) eliminado(s)`);
    } catch (error) {
      console.error('Error deleting hotspots:', error);
      toast.error('Error al eliminar hotspots');
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
        {/* Header */}
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

        {/* Main Editor */}
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Canvas */}
          <div className="lg:col-span-3 space-y-4">
            {floorPlans.length > 0 ? (
              <>
                <Tabs
                  value={selectedFloorPlan?.id}
                  onValueChange={(value) => {
                    const plan = floorPlans.find((p) => p.id === value);
                    if (plan) setSelectedFloorPlan(plan);
                  }}
                >
                  <TabsList className="w-full justify-start overflow-x-auto">
                    {floorPlans.map((plan) => (
                      <TabsTrigger key={plan.id} value={plan.id}>
                        {plan.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {floorPlans.map((plan) => (
                    <TabsContent key={plan.id} value={plan.id}>
                      <HotspotEditor
                        imageUrl={plan.image_url}
                        hotspots={hotspots}
                        selectedIds={selectedHotspotIds}
                        onHotspotClick={handleHotspotClick}
                        onHotspotDrag={handleHotspotDrag}
                        onCanvasClick={handleCanvasClick}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </>
            ) : (
              <Card className="p-12 text-center">
                <h2 className="text-2xl font-bold mb-2">No hay planos de planta</h2>
                <p className="text-muted-foreground mb-4">
                  Agrega un plano para comenzar a crear hotspots
                </p>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Floor Plans Section */}
            {tour && (
              <Collapsible open={floorPlansOpen} onOpenChange={setFloorPlansOpen}>
                <Card className="p-4">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto mb-2">
                      <h3 className="font-bold">Planos ({floorPlans.length})</h3>
                      {floorPlansOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <FloorPlanManager
                      tour={tour}
                      floorPlans={floorPlans}
                      onFloorPlanSelect={(plan) => setSelectedFloorPlan(plan)}
                      onFloorPlansUpdate={setFloorPlans}
                      isMobile={false}
                    />
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Hotspots Section */}
            <Collapsible open={hotspotsOpen} onOpenChange={setHotspotsOpen}>
              <Card className="p-4">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto mb-2">
                    <h3 className="font-bold">Hotspots ({hotspots.length})</h3>
                    {hotspotsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2">
                  <div className="flex gap-2 mb-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyHotspots}
                      disabled={selectedHotspotIds.length === 0}
                      className="flex-1"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copiar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handlePasteHotspots}
                      disabled={clipboard.length === 0}
                      className="flex-1"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Pegar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDeleteSelected}
                      disabled={selectedHotspotIds.length === 0}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {hotspots.map((hotspot, index) => (
                      <div
                        key={hotspot.id}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedHotspotIds.includes(hotspot.id)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                        onClick={() => setSelectedHotspotIds([hotspot.id])}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-primary text-primary-foreground">
                            {index + 1}
                          </div>
                          <span className="text-sm font-medium truncate">{hotspot.title}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        </div>
      </div>

      {/* Hotspot Modal */}
      <HotspotModal
        isOpen={hotspotModalOpen}
        onClose={() => {
          setHotspotModalOpen(false);
          setEditingHotspot(null);
        }}
        onSave={handleSaveHotspot}
        initialData={editingHotspot || undefined}
        mode={editingHotspot?.id ? 'edit' : 'create'}
      />
    </div>
  );
};

export default Editor;
