import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { X, Info } from 'lucide-react';

interface Tour {
  title: string;
  description: string;
}

interface FloorPlan {
  id: string;
  image_url: string;
}

interface Hotspot {
  id: string;
  title: string;
  description: string;
  x_position: number;
  y_position: number;
  media_url?: string;
}

const Viewer = () => {
  const { id } = useParams();
  const [tour, setTour] = useState<Tour | null>(null);
  const [floorPlan, setFloorPlan] = useState<FloorPlan | null>(null);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTourData();
  }, [id]);

  const loadTourData = async () => {
    try {
      const { data: tourData } = await supabase
        .from('virtual_tours')
        .select('title, description')
        .eq('id', id)
        .eq('is_published', true)
        .single();

      if (tourData) {
        setTour(tourData);

        const { data: planData } = await supabase
          .from('floor_plans')
          .select('id, image_url')
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando tour...</p>
      </div>
    );
  }

  if (!tour || !floorPlan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-12 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">Tour no encontrado</h1>
          <p className="text-muted-foreground">
            Este tour no existe o no está publicado
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{tour.title}</h1>
              {tour.description && (
                <p className="text-sm text-muted-foreground">{tour.description}</p>
              )}
            </div>
            <Button variant="ghost" size="sm">
              <Info className="w-4 h-4 mr-2" />
              Ayuda
            </Button>
          </div>
        </div>
      </div>

      {/* Viewer */}
      <div className="relative w-full h-[calc(100vh-5rem)]">
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="relative max-w-full max-h-full">
            <img
              src={floorPlan.image_url}
              alt="Floor plan"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
            {hotspots.map((hotspot, index) => (
              <button
                key={hotspot.id}
                className="absolute w-10 h-10 -ml-5 -mt-5 bg-primary rounded-full border-4 border-background cursor-pointer hover:scale-125 transition-all duration-300 flex items-center justify-center group"
                style={{
                  left: `${hotspot.x_position}%`,
                  top: `${hotspot.y_position}%`,
                }}
                onClick={() => setSelectedHotspot(hotspot)}
              >
                <span className="text-sm font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <div className="absolute bottom-full mb-2 hidden group-hover:block">
                  <div className="bg-card border border-border px-3 py-1 rounded-lg shadow-lg whitespace-nowrap">
                    <p className="text-sm font-medium">{hotspot.title}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Hotspot Detail Modal */}
        {selectedHotspot && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="max-w-2xl w-full max-h-[80vh] overflow-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold">{selectedHotspot.title}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedHotspot(null)}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                
                {selectedHotspot.description && (
                  <p className="text-muted-foreground mb-4">
                    {selectedHotspot.description}
                  </p>
                )}

                {selectedHotspot.media_url && (
                  <div className="rounded-lg overflow-hidden">
                    <img
                      src={selectedHotspot.media_url}
                      alt={selectedHotspot.title}
                      className="w-full h-auto"
                    />
                  </div>
                )}

                {!selectedHotspot.media_url && (
                  <div className="bg-muted rounded-lg p-12 text-center">
                    <p className="text-muted-foreground">
                      No hay contenido multimedia para este hotspot
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Viewer;