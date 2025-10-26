import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
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
  Settings,
  MapPin,
  Upload,
  Move,
  Hand,
  Trash,
  X,
  MousePointer,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import FloorPlanManager from '@/components/editor/FloorPlanManager';
import HotspotEditor from '@/components/editor/HotspotEditor';
import HotspotModal from '@/components/editor/HotspotModal';
import HotspotListManager from '@/components/editor/HotspotListManager';
import { AutoImportDialog } from '@/components/editor/AutoImportDialog';
import { PhotoGroupDialog } from '@/components/editor/PhotoGroupDialog';
import { GuidedPlacementOverlay } from '@/components/editor/GuidedPlacementOverlay';
import { Badge } from '@/components/ui/badge';
import { Tour, FloorPlan, Hotspot } from '@/types/tour';
import { useBulkHotspotCreation } from '@/hooks/useBulkHotspotCreation';
import type { Match } from '@/utils/photoMatcher';
import { cn } from '@/lib/utils';

const Editor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  
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
  const [manageHotspotsOpen, setManageHotspotsOpen] = useState(false);
  const [addPointMode, setAddPointMode] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [wasSaved, setWasSaved] = useState(false);
  
  // Auto-save
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Auto-import guided mode
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [guidedMode, setGuidedMode] = useState(false);
  const [guidedMatches, setGuidedMatches] = useState<Match[]>([]);
  const [currentGuidedIndex, setCurrentGuidedIndex] = useState(0);
  const [placedHotspotIds, setPlacedHotspotIds] = useState<string[]>([]);
  const [isPlacingPoint, setIsPlacingPoint] = useState(false);
  const [placementProgress, setPlacementProgress] = useState(0);
  
  // Grupo de Fotos por Plano
  const [photoGroupDialogOpen, setPhotoGroupDialogOpen] = useState(false);
  
  // Hook for bulk creation
  const { createHotspot, isCreating } = useBulkHotspotCreation(
    selectedFloorPlan?.id || '', 
    tour?.id || ''
  );

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

  // ESC key to exit add point mode
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && addPointMode) {
        setAddPointMode(false);
        toast.info('Modo agregar punto desactivado');
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [addPointMode]);

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
    // Si estamos en modo seleccionar, permitir selección simple sin Shift
    if (selectMode || event.shiftKey) {
      event.stopPropagation();
      event.preventDefault();
      // Multi-select
      setSelectedHotspotIds((prev) =>
        prev.includes(hotspotId)
          ? prev.filter((id) => id !== hotspotId)
          : [...prev, hotspotId]
      );
    } else {
      // Single select and open modal (solo si NO estamos en selectMode)
      const hotspot = hotspots.find((h) => h.id === hotspotId);
      if (hotspot) {
        setEditingHotspot(hotspot);
        setHotspotModalOpen(true);
      }
    }
  };

  const handleCanvasClick = async (x: number, y: number) => {
    // Bloquear clicks si ya está procesando un punto
    if (isPlacingPoint) {
      toast.warning('⏳ Espera a que termine de procesar el punto actual', {
        description: 'El sistema está guardando el punto anterior'
      });
      return;
    }
    
    // Modo guiado tiene prioridad
    if (guidedMode && currentGuidedIndex < guidedMatches.length) {
      const currentMatch = guidedMatches[currentGuidedIndex];
      
      if (currentMatch.photos.length === 0) {
        toast.error('Este punto no tiene fotos asociadas, se omitirá');
        setCurrentGuidedIndex(prev => prev + 1);
        return;
      }
      
      // Prevenir clics múltiples durante el procesamiento
      if (isPlacingPoint) return;
      
      setIsPlacingPoint(true);
      setPlacementProgress(0);
      
      try {
        // Simular progreso de carga
        const progressInterval = setInterval(() => {
          setPlacementProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 100);
        
        // Ordenar fotos por fecha antes de crear
        const sortedPhotos = currentMatch.photos
          .sort((a, b) => {
            if (!a.captureDate) return 1;
            if (!b.captureDate) return -1;
            return a.captureDate.localeCompare(b.captureDate);
          })
          .map((photo) => ({
            file: photo.file,
            optimizedBlob: photo.optimizedBlob,
            captureDate: photo.captureDate,
          }));

        // Crear hotspot con todas sus fotos
        const hotspot = await createHotspot({
          name: currentMatch.name,
          photos: sortedPhotos,
          position: { x, y },
          displayOrder: currentGuidedIndex + 1,
        });
        
        clearInterval(progressInterval);
        setPlacementProgress(100);
        
        // Dar tiempo para que el usuario vea el progreso completo
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Guardar ID del hotspot creado
        setPlacedHotspotIds(prev => [...prev, hotspot.id]);
        
        // Actualizar estado local inmediatamente para visualización en tiempo real
        setHotspots(prev => [...prev, hotspot]);
        
        // Avanzar al siguiente o terminar
        if (currentGuidedIndex < guidedMatches.length - 1) {
          setCurrentGuidedIndex(prev => prev + 1);
          toast.success(`✅ ${currentMatch.name} creado. Siguiente: ${guidedMatches[currentGuidedIndex + 1].name}`);
        } else {
          // Terminamos
          setGuidedMode(false);
          setCurrentGuidedIndex(0);
          setAddPointMode(false); // Desactivar modo add point al terminar
          toast.success(`🎉 ¡Completado! ${guidedMatches.length} puntos creados exitosamente`);
        }
      } catch (error) {
        console.error('Error creando hotspot:', error);
        toast.error('No se pudo crear el punto. Intenta de nuevo.');
      } finally {
        setIsPlacingPoint(false);
        setPlacementProgress(0);
      }
      return;
    }
    
    // Protección contra clics duplicados
    if (!addPointMode || isProcessingClick || hotspotModalOpen) return;
    
    setIsProcessingClick(true);
    
    console.log('🎯 Creando hotspot en:', { x, y });
    
    // Get suggested title based on last hotspot
    const lastTitle = localStorage.getItem('lastHotspotTitle');
    const suggestedTitle = lastTitle ? (() => {
      const pattern = /^(.*?)(\d+)$/;
      const match = lastTitle.match(pattern);
      if (match) {
        const prefix = match[1];
        const lastNumber = parseInt(match[2], 10);
        return `${prefix}${lastNumber + 1}`;
      }
      return lastTitle;
    })() : '';
    
    setEditingHotspot({
      id: '',
      title: suggestedTitle,
      description: '',
      x_position: x,
      y_position: y,
      floor_plan_id: selectedFloorPlan?.id || '',
      style: {
        icon: 'MapPin',
        color: '#4285F4',
        size: 32,
      }
    });
    setHotspotModalOpen(true);
    // Keep add point mode active after creating a hotspot
    
    // Reset el flag después de un pequeño delay
    setTimeout(() => setIsProcessingClick(false), 500);
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

    const isNewHotspot = !data.id;

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
        
        // Save the title for next suggestion
        if (data.title && data.title.trim()) {
          localStorage.setItem('lastHotspotTitle', data.title.trim());
        }
        
        toast.success('Hotspot creado');
      }

      // Mark as saved successfully
      setWasSaved(true);
      
      // Close modal and reset editing state
      setHotspotModalOpen(false);
      setEditingHotspot(null);

      // If it was a new hotspot, keep add point mode active
      if (isNewHotspot && addPointMode) {
        toast.info('Modo agregar punto activo - Click para agregar otro punto');
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

  const handleDuplicateHotspot = async (hotspot: Hotspot) => {
    if (!selectedFloorPlan) return;

    try {
      const { data, error } = await supabase
        .from('hotspots')
        .insert({
          floor_plan_id: selectedFloorPlan.id,
          title: `${hotspot.title} (copia)`,
          description: hotspot.description,
          x_position: hotspot.x_position + 20,
          y_position: hotspot.y_position + 20,
          media_url: hotspot.media_url,
          media_type: hotspot.media_type,
        })
        .select()
        .single();

      if (error) throw error;

      setHotspots((prev) => [...prev, data]);
      toast.success('Hotspot duplicado');
    } catch (error) {
      console.error('Error duplicating hotspot:', error);
      toast.error('Error al duplicar hotspot');
    }
  };

  const handleDeleteHotspot = async (id: string) => {
    try {
      const { error } = await supabase
        .from('hotspots')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setHotspots((prev) => prev.filter((h) => h.id !== id));
      toast.success('Hotspot eliminado');
    } catch (error) {
      console.error('Error deleting hotspot:', error);
      toast.error('Error al eliminar hotspot');
    }
  };

  // Handlers para modo guiado
  const handleStartGuidedPlacement = (matches: Match[]) => {
    setGuidedMatches(matches);
    setCurrentGuidedIndex(0);
    setPlacedHotspotIds([]);
    setGuidedMode(true);
    setImportDialogOpen(false);
    
    // ✅ Activar automáticamente el modo "Add Point"
    setAddPointMode(true);
    setMoveMode(false);
    setSelectMode(false);
    
    toast.success(`🎯 Modo guiado activado. Haz click en el plano para colocar ${matches.length} puntos en orden`);
  };

  const handleSkipPoint = () => {
    if (currentGuidedIndex < guidedMatches.length - 1) {
      setCurrentGuidedIndex(prev => prev + 1);
      toast.info(`${guidedMatches[currentGuidedIndex].name} omitido`);
    }
  };

  const handleUndoPoint = async () => {
    if (placedHotspotIds.length === 0) return;
    
    const lastHotspotId = placedHotspotIds[placedHotspotIds.length - 1];
    
    try {
      // Eliminar último hotspot creado de la BD
      await supabase
        .from('hotspots')
        .delete()
        .eq('id', lastHotspotId);
      
      setPlacedHotspotIds(prev => prev.slice(0, -1));
      setCurrentGuidedIndex(prev => Math.max(0, prev - 1));
      
      // Remover del estado local inmediatamente para visualización en tiempo real
      setHotspots(prev => prev.filter(h => h.id !== lastHotspotId));
      
      toast.success('Último punto eliminado');
    } catch (error) {
      console.error('Error undoing point:', error);
      toast.error('No se pudo deshacer');
    }
  };

  const handleCancelGuided = () => {
    setGuidedMode(false);
    setGuidedMatches([]);
    setCurrentGuidedIndex(0);
    setPlacedHotspotIds([]);
    toast.info('Modo guiado cancelado');
  };

  if (loading || authLoading) {
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
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/app/tours')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('editor.back')}
            </Button>
            <h1 className="text-3xl font-bold">{tour?.title}</h1>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={togglePublish}>
              {tour?.is_published ? (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  {t('editor.unpublish')}
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4 mr-2" />
                  {t('editor.publish')}
                </>
              )}
            </Button>
            {tour?.is_published && (
              <Button onClick={() => navigate(`/viewer/${id}`)}>
                <Eye className="w-4 h-4 mr-2" />
                {t('editor.viewTour')}
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
                {/* Matterport-style Header */}
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <MapPin className="w-5 h-5 text-[#4285F4]" />
                        <h2 className="text-xl font-bold">{t('editor.interactivePoints')}</h2>
                        <Badge variant="secondary">{hotspots.length}</Badge>
                        {addPointMode && (
                          <Badge className="animate-pulse bg-[#4285F4] text-white">
                            🎯 Modo Agregar Activo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {addPointMode ? (
                          <span className="text-[#4285F4] font-medium">
                            Click en el plano para agregar puntos • Presiona ESC para salir
                          </span>
                        ) : (
                          <>
                            {t('editor.editingFor')} <span className="font-medium">{selectedFloorPlan?.name}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {/* Active Mode Indicators - Visible badges for active modes */}
                      {moveMode && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setMoveMode(false);
                            toast.info('Modo Mover desactivado');
                          }}
                          className="gap-2 animate-pulse"
                        >
                          <Move className="h-4 w-4" />
                          Modo Mover
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                      {selectMode && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectMode(false);
                            setSelectedHotspotIds([]);
                            toast.info('Modo Seleccionar desactivado');
                          }}
                          className="gap-2 animate-pulse"
                        >
                          <MousePointer className="h-4 w-4" />
                          Modo Seleccionar
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            className={cn(
                              "transition-all duration-300",
                              (moveMode || selectMode)
                                ? "bg-secondary text-secondary-foreground animate-slow-pulse"
                                : "bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            {t('editor.managePoints')}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => {
                              const newMoveMode = !moveMode;
                              setMoveMode(newMoveMode);
                              if (newMoveMode) {
                                setSelectMode(false);
                                setAddPointMode(false);
                                toast.info('🔵 Modo Mover activado - Arrastra los puntos en el canvas', {
                                  description: 'Los puntos ahora pueden ser reposicionados'
                                });
                              } else {
                                toast.info('Modo Mover desactivado');
                              }
                            }}
                          >
                            <Move className="w-4 h-4 mr-2" />
                            {moveMode ? 'Desactivar' : 'Activar'} Mover
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                              const newSelectMode = !selectMode;
                              setSelectMode(newSelectMode);
                              if (newSelectMode) {
                                setMoveMode(false);
                                setAddPointMode(false);
                                toast.info('🎯 Modo Seleccionar activado - Click en puntos para seleccionar', {
                                  description: 'Usa clicks simples o Shift+Click para selección múltiple'
                                });
                              } else {
                                toast.info('Modo Seleccionar desactivado');
                                setSelectedHotspotIds([]);
                              }
                            }}
                          >
                            <Hand className="w-4 h-4 mr-2" />
                            {selectMode ? 'Desactivar' : 'Activar'} Seleccionar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={handleDeleteSelected}
                            disabled={selectedHotspotIds.length === 0}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash className="w-4 h-4 mr-2" />
                            Borrar Seleccionados ({selectedHotspotIds.length})
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button 
                        onClick={() => setAddPointMode(!addPointMode)}
                        className={cn(
                          "transition-all duration-300",
                          addPointMode
                            ? "bg-secondary text-secondary-foreground animate-slow-pulse"
                            : "bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {addPointMode ? t('editor.activeMode') : t('editor.addPoint')}
                      </Button>
                      <Button 
                        onClick={() => setImportDialogOpen(true)}
                        disabled={!selectedFloorPlan}
                        className={cn(
                          "transition-all duration-300",
                          importDialogOpen
                            ? "bg-secondary text-secondary-foreground animate-slow-pulse"
                            : "bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground",
                          !selectedFloorPlan && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Auto avance
                      </Button>
                      <Button 
                        onClick={() => setPhotoGroupDialogOpen(true)}
                        disabled={!selectedFloorPlan || hotspots.length === 0}
                        className={cn(
                          "transition-all duration-300",
                          photoGroupDialogOpen
                            ? "bg-secondary text-secondary-foreground animate-slow-pulse"
                            : "bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground",
                          (!selectedFloorPlan || hotspots.length === 0) && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Grupo FP
                      </Button>
                    </div>
                  </div>
                </Card>

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
                        readOnly={!addPointMode && !moveMode}
                        selectMode={selectMode}
                        moveMode={moveMode}
                        isPlacingPoint={isPlacingPoint}
                        placementProgress={placementProgress}
                        currentPointIndex={currentGuidedIndex}
                        totalPoints={guidedMatches.length}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </>
            ) : (
              <Card className="p-12 text-center">
                <h2 className="text-2xl font-bold mb-2">{t('floorPlan.noFloors')}</h2>
                <p className="text-muted-foreground mb-4">
                  {t('floorPlan.addToStart')}
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
          // Only deactivate add point mode if we're canceling (not saving)
          if (!wasSaved && editingHotspot && !editingHotspot.id) {
            setAddPointMode(false);
            toast.info('Modo agregar punto desactivado');
          }
          // Reset the saved flag
          setWasSaved(false);
        }}
        onSave={handleSaveHotspot}
        initialData={editingHotspot || undefined}
        mode={editingHotspot?.id ? 'edit' : 'create'}
      />

      {/* Hotspot List Manager */}
      <HotspotListManager
        isOpen={manageHotspotsOpen}
        onClose={() => setManageHotspotsOpen(false)}
        hotspots={hotspots}
        onEdit={(hotspot) => {
          setEditingHotspot(hotspot);
          setHotspotModalOpen(true);
          setManageHotspotsOpen(false);
        }}
        onDelete={handleDeleteHotspot}
        onDuplicate={handleDuplicateHotspot}
        onFocus={(hotspot) => {
          setSelectedHotspotIds([hotspot.id]);
          toast.info(`Enfocando: ${hotspot.title}`);
        }}
      />

      {/* Auto Import Dialog */}
      <AutoImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onStartPlacement={handleStartGuidedPlacement}
      />

      {/* Photo Group Dialog */}
      <PhotoGroupDialog
        open={photoGroupDialogOpen}
        onOpenChange={setPhotoGroupDialogOpen}
        existingHotspots={hotspots}
        floorPlanId={selectedFloorPlan?.id || ''}
        tourId={tour?.id || ''}
        onPhotosAdded={() => {
          if (selectedFloorPlan) {
            loadHotspots(selectedFloorPlan.id);
          }
        }}
      />
      
      {/* Guided Placement Overlay */}
      {guidedMode && guidedMatches.length > 0 && (
        <GuidedPlacementOverlay
          matches={guidedMatches}
          currentIndex={currentGuidedIndex}
          onPointPlaced={() => {}} // Ya manejado en handleCanvasClick
          onSkip={handleSkipPoint}
          onUndo={handleUndoPoint}
          onCancel={handleCancelGuided}
          isPlacing={isPlacingPoint}
          placementProgress={placementProgress}
        />
      )}
    </div>
  );
};

export default Editor;
