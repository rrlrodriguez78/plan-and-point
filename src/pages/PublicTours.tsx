import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Eye, Globe, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface Tour {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  is_published: boolean;
}

const PublicTours = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tours, setTours] = useState<Tour[]>([]);
  const [filteredTours, setFilteredTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchPublicTours();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTours(tours);
    } else {
      const filtered = tours.filter(tour =>
        tour.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tour.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTours(filtered);
    }
  }, [searchQuery, tours]);

  const fetchPublicTours = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('virtual_tours')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTours(data || []);
      setFilteredTours(data || []);
    } catch (error) {
      console.error('Error fetching public tours:', error);
      toast.error(t('publicTours.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const viewTour = (tourId: string) => {
    navigate(`/viewer/${tourId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t('publicTours.title')}</h1>
          <p className="text-muted-foreground">{t('publicTours.subtitle')}</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t('publicTours.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tours Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-48 w-full rounded-md" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTours.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">{t('publicTours.noTours')}</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTours.map((tour) => (
              <Card key={tour.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="p-0">
                  {tour.cover_image_url ? (
                    <img
                      src={tour.cover_image_url}
                      alt={tour.title}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Globe className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-xl line-clamp-1">{tour.title}</CardTitle>
                    <Badge variant="secondary" className="flex items-center gap-1 shrink-0 ml-2">
                      <Globe className="w-3 h-3" />
                    </Badge>
                  </div>
                  {tour.description && (
                    <CardDescription className="line-clamp-2">
                      {tour.description}
                    </CardDescription>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => viewTour(tour.id)}
                    className="w-full"
                    variant="default"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {t('publicTours.viewTour')}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicTours;
