import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Upload, Plus, Trash2, Edit, Check, X, RotateCw, MoreVertical, ImageIcon, FileText, CalendarIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { FloorPlan } from '@/types/tour';
import { optimizeImage, validateImageFile, formatFileSize } from '@/utils/imageOptimization';

const getFloorOptions = (t: any) => [
  { value: 'basement', label: t('floorPlan.floors.basement') },
  { value: 'groundFloor', label: t('floorPlan.floors.groundFloor') },
  { value: 'firstFloor', label: t('floorPlan.floors.firstFloor') },
  { value: 'secondFloor', label: t('floorPlan.floors.secondFloor') },
  { value: 'thirdFloor', label: t('floorPlan.floors.thirdFloor') },
  { value: 'fourthFloor', label: t('floorPlan.floors.fourthFloor') },
  { value: 'fifthFloor', label: t('floorPlan.floors.fifthFloor') },
  { value: 'sixthFloor', label: t('floorPlan.floors.sixthFloor') },
  { value: 'seventhFloor', label: t('floorPlan.floors.seventhFloor') || 'Séptimo Piso' },
  { value: 'eighthFloor', label: t('floorPlan.floors.eighthFloor') || 'Octavo Piso' },
  { value: 'ninthFloor', label: t('floorPlan.floors.ninthFloor') || 'Noveno Piso' },
  { value: 'tenthFloor', label: t('floorPlan.floors.tenthFloor') || 'Décimo Piso' },
  { value: 'eleventhFloor', label: t('floorPlan.floors.eleventhFloor') || 'Piso 11' },
  { value: 'twelfthFloor', label: t('floorPlan.floors.twelfthFloor') || 'Piso 12' },
  { value: 'thirteenthFloor', label: t('floorPlan.floors.thirteenthFloor') || 'Piso 13' },
  { value: 'fourteenthFloor', label: t('floorPlan.floors.fourteenthFloor') || 'Piso 14' },
  { value: 'fifteenthFloor', label: t('floorPlan.floors.fifteenthFloor') || 'Piso 15' },
  { value: 'sixteenthFloor', label: t('floorPlan.floors.sixteenthFloor') || 'Piso 16' },
  { value: 'seventeenthFloor', label: t('floorPlan.floors.seventeenthFloor') || 'Piso 17' },
  { value: 'eighteenthFloor', label: t('floorPlan.floors.eighteenthFloor') || 'Piso 18' },
  { value: 'nineteenthFloor', label: t('floorPlan.floors.nineteenthFloor') || 'Piso 19' },
  { value: 'twentiethFloor', label: t('floorPlan.floors.twentiethFloor') || 'Piso 20' },
  { value: 'twentyFirstFloor', label: t('floorPlan.floors.twentyFirstFloor') || 'Piso 21' },
  { value: 'twentySecondFloor', label: t('floorPlan.floors.twentySecondFloor') || 'Piso 22' },
  { value: 'twentyThirdFloor', label: t('floorPlan.floors.twentyThirdFloor') || 'Piso 23' },
  { value: 'twentyFourthFloor', label: t('floorPlan.floors.twentyFourthFloor') || 'Piso 24' },
  { value: 'twentyFifthFloor', label: t('floorPlan.floors.twentyFifthFloor') || 'Piso 25' },
  { value: 'attic', label: t('floorPlan.floors.attic') },
  { value: 'rooftop', label: t('floorPlan.floors.rooftop') },
  { value: 'custom', label: t('floorPlan.customName') },
];

interface FloorPlanManagerProps {
  tour: any;
  floorPlans: FloorPlan[];
  activeFloorPlanId?: string;
  onFloorPlanSelect: (floorPlan: FloorPlan) => void;
  onFloorPlansUpdate: (floorPlans: FloorPlan[]) => void;
  isMobile: boolean;
}

export default function FloorPlanManager({ 
  tour, 
  floorPlans, 
  activeFloorPlanId, 
  onFloorPlanSelect, 
  onFloorPlansUpdate, 
  isMobile 
}: FloorPlanManagerProps) {
  const { t } = useTranslation();
  const [editingFloorPlan, setEditingFloorPlan] = useState<Partial<FloorPlan> | null>(null);
  const [isNewFloorPlan, setIsNewFloorPlan] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCustomFloorName, setIsCustomFloorName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateFloorPlan = (floorData: Partial<FloorPlan>) => {
    const newErrors: Record<string, string> = {};
    
    if (!floorData.name?.trim()) {
      newErrors.name = t('floorPlan.floorNameRequired');
    }
    
    if (isNewFloorPlan && !floorData.image_url) {
      newErrors.image_url = t('floorPlan.imageRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveFloorPlan = async () => {
    if (!editingFloorPlan) return;

    if (!validateFloorPlan(editingFloorPlan)) {
      return;
    }

    try {
      if (isNewFloorPlan) {
        const floorPlanData = {
          name: editingFloorPlan.name!,
          tour_id: tour.id,
          tenant_id: tour.tenant_id,
          image_url: editingFloorPlan.image_url!,
          width: editingFloorPlan.width || 1920,
          height: editingFloorPlan.height || 1080,
          capture_date: editingFloorPlan.capture_date || new Date().toISOString().split('T')[0]
        };
        
        const { data, error } = await supabase
          .from('floor_plans')
          .insert(floorPlanData)
          .select()
          .single();
        
        if (error) throw error;
        
        onFloorPlansUpdate([...floorPlans, data]);
      } else {
        const { error } = await supabase
          .from('floor_plans')
          .update({
            name: editingFloorPlan.name!,
            image_url: editingFloorPlan.image_url!,
            width: editingFloorPlan.width || 1920,
            height: editingFloorPlan.height || 1080,
            capture_date: editingFloorPlan.capture_date || new Date().toISOString().split('T')[0]
          })
          .eq('id', editingFloorPlan.id!);
        
        if (error) throw error;
        
        const updatedFloorPlans = floorPlans.map(fp =>
          fp.id === editingFloorPlan.id ? { ...fp, ...editingFloorPlan } as FloorPlan : fp
        );
        onFloorPlansUpdate(updatedFloorPlans);
      }
      
      setEditingFloorPlan(null);
      setIsNewFloorPlan(false);
      setErrors({});
    } catch (error: any) {
      console.error('Error saving floor plan:', error);
      const errorMessage = error?.message || t('floorPlan.errorSaving');
      alert(`${t('floorPlan.errorSaving')}: ${errorMessage}`);
      console.error('Full error details:', error);
    }
  };

  const handleDelete = async (floorPlanId: string, floorPlanName: string) => {
    if (!confirm(`${t('floorPlan.deleteConfirm')} "${floorPlanName}"?`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('floor_plans')
        .delete()
        .eq('id', floorPlanId);
      
      if (error) throw error;
      
      const updatedFloorPlans = floorPlans.filter(fp => fp.id !== floorPlanId);
      onFloorPlansUpdate(updatedFloorPlans);
    } catch (error) {
      console.error('Error deleting floor plan:', error);
      alert(t('floorPlan.errorDeleting'));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingFloorPlan) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrors(prev => ({ ...prev, image_url: validation.error }));
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    setErrors(prev => ({ ...prev, image_url: '' }));
    
    try {
      // Optimize the image
      const result = await optimizeImage(file, {
        maxWidth: 4000,
        quality: 0.85,
        format: 'webp',
        maxSizeMB: 10
      });

      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `floor-plans/${tour.id}/${timestamp}_${safeFileName}.${result.format}`;

      const { error: uploadError } = await supabase.storage
        .from('tour-images')
        .upload(fileName, result.blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(fileName);
      
      setEditingFloorPlan(prev => ({ 
        ...prev, 
        image_url: publicUrl,
        width: result.width,
        height: result.height
      }));
    } catch (error: any) {
      console.error('Error uploading floor plan file:', error);
      alert(error.message || t('floorPlan.errorUploading'));
      setErrors(prev => ({ ...prev, image_url: t('floorPlan.uploadError') }));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
      />
      
      <Button 
        onClick={() => { 
          setIsNewFloorPlan(true); 
          setIsCustomFloorName(false);
          setErrors({});
          setEditingFloorPlan({ 
            name: '', 
            image_url: '', 
            width: 1920,
            height: 1080
          }); 
        }}
        disabled={!tour.id}
        className="w-full bg-indigo-600 hover:bg-indigo-700"
      >
        <Plus className="w-4 h-4 mr-2" />
        {t('floorPlan.addNew')}
      </Button>

      {!tour.id && (
        <p className="text-xs text-center text-slate-500 mt-2">
          {t('floorPlan.saveFirst')}
        </p>
      )}

      {floorPlans.length === 0 ? (
        <div className="text-center text-slate-500 py-6 border-2 border-dashed rounded-lg">
          <p>{t('floorPlan.noFloors')}</p>
          <p className="text-sm">{t('floorPlan.addToStart')}</p>
        </div>
      ) : (
        <ScrollArea className="h-96 pr-3">
          <div className="space-y-2">
            {floorPlans.map(fp => (
              <div
                key={fp.id}
                onClick={() => onFloorPlanSelect(fp)}
                className={`p-3 rounded-lg border-2 flex items-center gap-3 cursor-pointer transition-all ${
                  activeFloorPlanId === fp.id
                    ? 'bg-blue-50 border-blue-500 shadow-md'
                    : 'bg-white hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="w-12 h-12 rounded-md bg-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {fp.image_url ? (
                    <img src={fp.image_url} alt={fp.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{fp.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {activeFloorPlanId === fp.id && (
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                        {t('floorPlan.active')}
                      </Badge>
                    )}
                    {fp.capture_date && (
                      <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300">
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        {format(new Date(fp.capture_date), 'dd MMM yyyy', { locale: es })}
                      </Badge>
                    )}
                    <span className="text-xs text-slate-500">{fp.width}x{fp.height}</span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-white z-50" onClick={e => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => { 
                      setIsNewFloorPlan(false);
                      const FLOOR_OPTIONS = getFloorOptions(t);
                      const isCustomName = !FLOOR_OPTIONS.some(opt => opt.value === fp.name);
                      setIsCustomFloorName(isCustomName);
                      setEditingFloorPlan(fp); 
                      setErrors({}); 
                    }}>
                      <Edit className="w-4 h-4 mr-2" /> {t('common.edit')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(fp.id, fp.name)}>
                      <Trash2 className="w-4 h-4 mr-2" /> {t('common.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={!!editingFloorPlan} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setEditingFloorPlan(null);
          setIsNewFloorPlan(false);
          setIsCustomFloorName(false);
          setErrors({});
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isNewFloorPlan ? t('floorPlan.addFloor') : t('floorPlan.editFloor')}</DialogTitle>
            <DialogDescription>
              {isNewFloorPlan 
                ? t('floorPlan.configureDetails')
                : t('floorPlan.updateInfo')
              }
            </DialogDescription>
          </DialogHeader>

          {editingFloorPlan && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="floor-name">{t('floorPlan.floorName')} *</Label>
                {isCustomFloorName ? (
                  <div className="space-y-2">
                    <Input
                      id="floor-name"
                      value={editingFloorPlan.name || ''}
                      onChange={e => setEditingFloorPlan({...editingFloorPlan, name: e.target.value})}
                      placeholder={t('floorPlan.enterName')}
                      className={errors.name ? 'border-red-500' : ''}
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsCustomFloorName(false);
                        setEditingFloorPlan({...editingFloorPlan, name: ''});
                      }}
                      className="w-full"
                    >
                      {t('floorPlan.backToOptions')}
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={editingFloorPlan.name || ''}
                    onValueChange={(value) => {
                      if (value === 'custom') {
                        setIsCustomFloorName(true);
                        setEditingFloorPlan({...editingFloorPlan, name: ''});
                      } else {
                        setEditingFloorPlan({...editingFloorPlan, name: value});
                      }
                    }}
                  >
                    <SelectTrigger className={errors.name ? 'border-red-500' : ''}>
                      <SelectValue placeholder={t('floorPlan.selectFloor')} />
                    </SelectTrigger>
                    <SelectContent>
                      {getFloorOptions(t).map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <Label>{t('floorPlan.floorImage')} {isNewFloorPlan && '*'}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isUploading}
                    variant="outline"
                    className="w-full"
                  >
                    {isUploading ? (
                      <>
                        <RotateCw className="w-4 h-4 mr-2 animate-spin" />
                        {t('common.uploading')}
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {editingFloorPlan.image_url ? t('floorPlan.changeImage') : t('floorPlan.uploadImage')}
                      </>
                    )}
                  </Button>
                </div>
                {editingFloorPlan.image_url && (
                  <div className="mt-3">
                    <img 
                      src={editingFloorPlan.image_url} 
                      alt="Preview" 
                      className="w-full h-40 object-contain rounded border"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {t('floorPlan.dimensions')} {editingFloorPlan.width}x{editingFloorPlan.height}px
                    </p>
                  </div>
                )}
                {errors.image_url && <p className="text-red-500 text-sm mt-1">{errors.image_url}</p>}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setEditingFloorPlan(null);
                setIsNewFloorPlan(false);
                setIsCustomFloorName(false);
                setErrors({});
              }}
            >
              <X className="w-4 h-4 mr-2" />
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSaveFloorPlan}
              disabled={isUploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Check className="w-4 h-4 mr-2" />
              {isNewFloorPlan ? t('common.add') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
