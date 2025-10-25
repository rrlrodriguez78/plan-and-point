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
              <Card key={tour.id} className="p-0 hover:shadow-lg transition-all overflow-hidden">
                <div className="relative h-32 bg-muted">
                  {tour.cover_image_url ? (
                    <>
                      <div 
                        onClick={() => tour.is_published && navigate(`/viewer/${tour.id}`)}
                        className={tour.is_published ? "cursor-pointer group" : ""}
                      >
                        <img 
                          src={tour.cover_image_url} 
                          alt={tour.title}
                          className="w-full h-full object-cover"
                        />
                        {tour.is_published && (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Eye className="w-12 h-12 text-white drop-shadow-lg" />
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                      <div className="text-center">
                        <ImageIcon className="w-12 h-12 mx-auto mb-2 text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">{t('dashboard.noDescription')}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Title and Status Overlay - Top */}
                  <div className="absolute top-1.5 left-1.5 right-1.5 z-10 flex justify-between items-start gap-2">
                    <div className="backdrop-blur-sm bg-black/40 px-2 py-1 rounded border border-white/20 flex-1 min-w-0">
                      <h3 className="text-white font-semibold text-xs truncate">{tour.title}</h3>
                    </div>
                    <div className="backdrop-blur-sm bg-black/40 px-1.5 py-1 rounded border border-white/20 flex items-center justify-center shrink-0">
                      {tour.is_published ? (
                        <Globe className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-gray-300" />
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons - Bottom Left */}
                  <div className="absolute bottom-1.5 left-1.5 flex gap-1.5 z-10">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/app/editor/${tour.id}`)}
                      className="h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-black/60 transition-all border border-white/20"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => deleteTour(tour.id)}
                      className="h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-red-600/60 transition-all border border-white/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    {tour.is_published && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/viewer/${tour.id}`)}
                        className="h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-blue-600/60 transition-all border border-white/20"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Upload Button - Bottom Right */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleUploadCover(tour.id)}
                    disabled={uploadingCover === tour.id}
                    className="absolute bottom-1.5 right-1.5 z-10 h-7 w-7 p-0 backdrop-blur-sm bg-black/40 hover:bg-black/60 transition-all border border-white/20"
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;