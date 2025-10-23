import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Eye, Edit, Trash2, Globe, Lock } from 'lucide-react';
import TourSetupModal from '@/components/editor/TourSetupModal';

interface Organization {
  id: string;
  name: string;
}

interface Tour {
  id: string;
  title: string;
  description: string;
  is_published: boolean;
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [tours, setTours] = useState<Tour[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [savingTour, setSavingTour] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      // Load or create organization
      const { data: orgs } = await supabase
        .from('organizations')
        .select('*')
        .eq('owner_id', user!.id)
        .single();

      if (!orgs) {
        const { data: newOrg } = await supabase
          .from('organizations')
          .insert({ name: 'Mi Organización', owner_id: user!.id })
          .select()
          .single();
        setOrganization(newOrg);
      } else {
        setOrganization(orgs);
      }

      // Load tours
      const { data: toursData } = await supabase
        .from('virtual_tours')
        .select('*')
        .order('created_at', { ascending: false });

      if (toursData) {
        setTours(toursData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTour = async (tourData: { title: string; description: string; coverImageUrl?: string }) => {
    if (!organization) {
      toast.error('No se encontró organización');
      return;
    }

    setSavingTour(true);
    try {
      const { data, error } = await supabase
        .from('virtual_tours')
        .insert({
          title: tourData.title,
          description: tourData.description,
          organization_id: organization.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Tour creado exitosamente');
      setTours([data, ...tours]);
      setModalOpen(false);
      navigate(`/app/editor/${data.id}`);
    } catch (error) {
      console.error('Error creating tour:', error);
      toast.error('Error al crear tour');
    } finally {
      setSavingTour(false);
    }
  };

  const deleteTour = async (id: string) => {
    try {
      const { error } = await supabase
        .from('virtual_tours')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Tour eliminado');
      setTours(tours.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting tour:', error);
      toast.error('Error al eliminar tour');
    }
  };

  if (authLoading || loading) {
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Mis Tours Virtuales</h1>
            <p className="text-muted-foreground">
              Gestiona y edita tus tours interactivos
            </p>
          </div>

          <Button size="lg" onClick={() => setModalOpen(true)}>
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Tour
          </Button>
          
          <TourSetupModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            onConfirm={handleCreateTour}
            isSaving={savingTour}
          />
        </div>

        {tours.length === 0 ? (
          <Card className="p-12 text-center">
            <CardHeader>
              <CardTitle className="text-2xl">No tienes tours todavía</CardTitle>
              <CardDescription>
                Crea tu primer tour virtual para comenzar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setModalOpen(true)} size="lg">
                <Plus className="w-5 h-5 mr-2" />
                Crear Primer Tour
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tours.map((tour) => (
              <Card key={tour.id} className="hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <CardTitle className="text-xl">{tour.title}</CardTitle>
                    {tour.is_published ? (
                      <Globe className="w-5 h-5 text-secondary" />
                    ) : (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <CardDescription>
                    {tour.description || 'Sin descripción'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/app/editor/${tour.id}`)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                    {tour.is_published && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/viewer/${tour.id}`)}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteTour(tour.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;