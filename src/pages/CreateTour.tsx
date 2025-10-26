import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Upload, X } from 'lucide-react';
import ImageEditor from '@/components/editor/ImageEditor';

export default function CreateTour() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [tourData, setTourData] = useState({
    title: '',
    description: '',
    coverImageUrl: ''
  });
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);

  // Redirect if not authenticated
  if (!user) {
    navigate('/login');
    return null;
  }

  const handleNext = () => {
    if (currentStep === 1 && !tourData.title.trim()) {
      toast.error('El título es requerido');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleCancel = () => {
    navigate('/app/tours');
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('La imagen debe ser menor a 10MB');
        return;
      }
      setCoverImageFile(file);
      setShowImageEditor(true);
    }
  };

  const handleImageEdited = async (editedBlob: Blob) => {
    const file = new File([editedBlob], coverImageFile?.name || 'cover.jpg', { type: 'image/jpeg' });
    setCoverImageFile(file);
    setShowImageEditor(false);
    
    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setTourData(prev => ({ ...prev, coverImageUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
    
    toast.success('Imagen lista para subir');
  };

  const uploadCoverImage = async (organizationId: string): Promise<string | null> => {
    if (!coverImageFile) return null;

    try {
      const fileExt = coverImageFile.name.split('.').pop();
      const fileName = `${organizationId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('tour-images')
        .upload(fileName, coverImageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error al subir imagen de portada');
      return null;
    }
  };

  const handleCreateTour = async () => {
    if (!tourData.title.trim()) {
      toast.error('El título es requerido');
      return;
    }

    setIsCreating(true);
    try {
      // Get user's organization
      const { data: organizations, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1);

      if (orgError) throw orgError;

      if (!organizations || organizations.length === 0) {
        // Create organization if doesn't exist
        const { data: newOrg, error: createOrgError } = await supabase
          .from('organizations')
          .insert({ owner_id: user.id, name: `${user.email}'s Organization` })
          .select()
          .single();

        if (createOrgError) throw createOrgError;
        organizations[0] = newOrg;
      }

      const organizationId = organizations[0].id;

      // Upload cover image if exists
      let coverImageUrl = null;
      if (coverImageFile) {
        coverImageUrl = await uploadCoverImage(organizationId);
      }

      // Create tour
      const { data: newTour, error: tourError } = await supabase
        .from('virtual_tours')
        .insert({
          title: tourData.title,
          description: tourData.description || null,
          cover_image_url: coverImageUrl,
          organization_id: organizationId,
          is_published: false
        })
        .select()
        .single();

      if (tourError) throw tourError;

      toast.success('¡Tour creado exitosamente!');
      navigate(`/app/editor/${newTour.id}`);
    } catch (error) {
      console.error('Error creating tour:', error);
      toast.error('Error al crear el tour');
    } finally {
      setIsCreating(false);
    }
  };

  const progress = (currentStep / 3) * 100;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Crear Nuevo Tour Virtual</CardTitle>
            <CardDescription>
              Paso {currentStep} de 3 • {Math.round(progress)}% completado
            </CardDescription>
            <Progress value={progress} className="mt-2" />
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Title */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-lg font-semibold mb-2">¡Empecemos!</h3>
                  <p className="text-muted-foreground mb-4">
                    1. ¿Cuál es el título de tu tour? *
                  </p>
                  <Input
                    placeholder="Ej: Casa Moderna en la Playa, Apartamento Céntrico..."
                    value={tourData.title}
                    onChange={(e) => setTourData(prev => ({ ...prev, title: e.target.value }))}
                    className="text-lg"
                    autoFocus
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Dale un nombre atractivo que describa el espacio
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Description */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-lg font-semibold mb-2">¡Perfecto!</h3>
                  <p className="text-muted-foreground mb-4">
                    2. Describe tu tour (Opcional)
                  </p>
                  <Textarea
                    placeholder="Ej: Un hermoso espacio de 120m² con vistas espectaculares..."
                    value={tourData.description}
                    onChange={(e) => setTourData(prev => ({ ...prev, description: e.target.value }))}
                    rows={5}
                    autoFocus
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Cuéntanos qué hace especial este espacio
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Cover Image */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-lg font-semibold mb-2">¡Casi terminamos!</h3>
                  <p className="text-muted-foreground mb-4">
                    3. Imagen de portada (Opcional)
                  </p>
                  
                  {!tourData.coverImageUrl ? (
                    <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-12 h-12 mb-3 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground">
                          <span className="font-semibold">Haz clic para subir imagen</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG (Máx. 10MB)
                        </p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/jpg"
                        onChange={handleImageSelect}
                      />
                    </label>
                  ) : (
                    <div className="relative">
                      <img
                        src={tourData.coverImageUrl}
                        alt="Cover preview"
                        className="w-full h-64 object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setTourData(prev => ({ ...prev, coverImageUrl: '' }));
                          setCoverImageFile(null);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  
                  <p className="text-sm text-muted-foreground mt-2">
                    Una imagen atractiva que represente tu tour
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex gap-2">
                {currentStep > 1 && (
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={isCreating}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Anterior
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  disabled={isCreating}
                >
                  Cancelar
                </Button>
              </div>

              {currentStep < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={currentStep === 1 && !tourData.title.trim()}
                >
                  Siguiente
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleCreateTour}
                  disabled={isCreating || !tourData.title.trim()}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isCreating ? 'Creando...' : '¡Crear Mi Tour!'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Image Editor Dialog */}
      {showImageEditor && coverImageFile && (
        <ImageEditor
          imageFile={coverImageFile}
          onSave={handleImageEdited}
          onCancel={() => {
            setShowImageEditor(false);
            setCoverImageFile(null);
          }}
        />
      )}
    </div>
  );
}
