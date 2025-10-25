import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Eye, Edit, Trash2, Globe, Lock, Upload, Image as ImageIcon } from 'lucide-react';
import TourSetupModal from '@/components/editor/TourSetupModal';
import { useTranslation } from 'react-i18next';

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
  cover_image_url?: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [tours, setTours] = useState<Tour[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [savingTour, setSavingTour] = useState(false);
  const [uploadingCover, setUploadingCover] = useState<string | null>(null);

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
      toast.error(t('dashboard.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTour = async (tourData: { title: string; description: string; coverImageUrl?: string }) => {
    if (!organization) {
      toast.error(t('dashboard.organizationNotFound'));
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
          cover_image_url: tourData.coverImageUrl,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(t('dashboard.tourCreated'));
      setTours([data, ...tours]);
      setModalOpen(false);
      navigate(`/app/editor/${data.id}`);
    } catch (error) {
      console.error('Error creating tour:', error);
      toast.error(t('dashboard.errorCreating'));
    } finally {
      setSavingTour(false);
    }
  };

  const handleUploadCover = async (tourId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploadingCover(tourId);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${tourId}/cover-${Date.now()}.${fileExt}`;

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
          .eq('id', tourId);

        if (updateError) throw updateError;

        setTours(tours.map(t => 
          t.id === tourId ? { ...t, cover_image_url: publicUrl } : t
        ));
        toast.success(t('dashboard.coverUploaded'));
      } catch (error) {
        console.error('Error uploading cover:', error);
        toast.error(t('dashboard.errorUploadingCover'));
      } finally {
        setUploadingCover(null);
      }
    };

    input.click();
  };

  const deleteTour = async (id: string) => {
    try {
      const { error } = await supabase
        .from('virtual_tours')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(t('dashboard.tourDeleted'));
      setTours(tours.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting tour:', error);
      toast.error(t('dashboard.errorDeleting'));
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">{t('common.loading')}</p>
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
            <h1 className="text-4xl font-bold mb-2">{t('dashboard.title')}</h1>
            <p className="text-muted-foreground">
              {t('dashboard.subtitle')}
            </p>
          </div>

          <Button size="lg" onClick={() => setModalOpen(true)}>
            <Plus className="w-5 h-5 mr-2" />
            {t('dashboard.createNew')}
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
              <CardTitle className="text-2xl">{t('dashboard.noTours')}</CardTitle>
              <CardDescription>
                {t('dashboard.noToursDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setModalOpen(true)} size="lg">
                <Plus className="w-5 h-5 mr-2" />
                {t('dashboard.createFirstTour')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tours.map((tour) => (
              <Card key={tour.id} className="hover:shadow-lg transition-all overflow-hidden">
                <div className="relative aspect-video bg-muted">
                  {tour.cover_image_url ? (
                    <>
                      <img 
                        src={tour.cover_image_url} 
                        alt={tour.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/app/editor/${tour.id}`)}
                          className="backdrop-blur-sm bg-black/40 hover:bg-black/60 transition-all border border-white/20"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => deleteTour(tour.id)}
                          className="backdrop-blur-sm bg-black/40 hover:bg-red-600/60 transition-all border border-white/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleUploadCover(tour.id)}
                        disabled={uploadingCover === tour.id}
                        className="absolute top-2 right-2 backdrop-blur-sm bg-black/40 hover:bg-black/60 transition-all border border-white/20"
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Button
                        variant="outline"
                        onClick={() => handleUploadCover(tour.id)}
                        disabled={uploadingCover === tour.id}
                      >
                        <ImageIcon className="w-4 h-4 mr-2" />
                        {uploadingCover === tour.id ? t('common.loading') : t('dashboard.addCover')}
                      </Button>
                    </div>
                  )}
                </div>
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
                    {tour.description || t('dashboard.noDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {tour.is_published && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/viewer/${tour.id}`)}
                      className="w-full"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {t('dashboard.view')}
                    </Button>
                  )}
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