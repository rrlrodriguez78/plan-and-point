import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Upload, Plus, Trash2, Edit, Check, X, RotateCw, MoreVertical, ImageIcon, FileText } from 'lucide-react';
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

const FLOOR_OPTIONS = [
  { value: 'Sótano', label: 'Sótano' },
  { value: 'Planta Baja', label: 'Planta Baja' },
  { value: '1er Piso', label: '1er Piso' },
  { value: '2do Piso', label: '2do Piso' },
  { value: '3er Piso', label: '3er Piso' },
  { value: '4to Piso', label: '4to Piso' },
  { value: '5to Piso', label: '5to Piso' },
  { value: '6to Piso', label: '6to Piso' },
  { value: 'Ático', label: 'Ático' },
  { value: 'Azotea', label: 'Azotea' },
  { value: 'custom', label: 'Personalizado...' },
];

interface FloorPlan {
  id: string;
  name: string;
  image_url: string;
  width: number;
  height: number;
  tour_id: string;
  created_at: string;
}

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
  const [editingFloorPlan, setEditingFloorPlan] = useState<Partial<FloorPlan> | null>(null);
  const [isNewFloorPlan, setIsNewFloorPlan] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCustomFloorName, setIsCustomFloorName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateFloorPlan = (floorData: Partial<FloorPlan>) => {
    const newErrors: Record<string, string> = {};
    
    if (!floorData.name?.trim()) {
      newErrors.name = "El nombre del piso es requerido";
    }
    
    if (isNewFloorPlan && !floorData.image_url) {
      newErrors.image_url = "Debes subir una imagen para el plano del piso";
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
          image_url: editingFloorPlan.image_url!,
          width: editingFloorPlan.width || 1920,
          height: editingFloorPlan.height || 1080
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
            height: editingFloorPlan.height || 1080
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
    } catch (error) {
      console.error('Error saving floor plan:', error);
      alert('Error al guardar el piso.');
    }
  };

  const handleDelete = async (floorPlanId: string, floorPlanName: string) => {
    if (!confirm(`¿Seguro que quieres eliminar "${floorPlanName}"?`)) {
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
      alert('Error al eliminar el piso.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingFloorPlan) return;

    setIsUploading(true);
    setErrors(prev => ({ ...prev, image_url: '' }));
    
    try {
      // Create an image to get dimensions
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
      });

      const fileName = `${tour.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tour-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(fileName);
      
      setEditingFloorPlan(prev => ({ 
        ...prev, 
        image_url: publicUrl,
        width: img.naturalWidth,
        height: img.naturalHeight
      }));

      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Error uploading floor plan file:', error);
      alert('Error al subir el archivo del plano.');
      setErrors(prev => ({ ...prev, image_url: 'Error al subir el archivo.' }));
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
        Añadir Nuevo Piso
      </Button>

      {!tour.id && (
        <p className="text-xs text-center text-slate-500 mt-2">
          Guarda el tour para poder añadir pisos.
        </p>
      )}

      {floorPlans.length === 0 ? (
        <div className="text-center text-slate-500 py-6 border-2 border-dashed rounded-lg">
          <p>No hay pisos en este tour.</p>
          <p className="text-sm">Añade uno para empezar.</p>
        </div>
      ) : (
        <ScrollArea className="h-64 pr-3">
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
                        Activo
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
                      const isCustomName = !FLOOR_OPTIONS.some(opt => opt.value === fp.name);
                      setIsCustomFloorName(isCustomName);
                      setEditingFloorPlan(fp); 
                      setErrors({}); 
                    }}>
                      <Edit className="w-4 h-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(fp.id, fp.name)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Eliminar
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
            <DialogTitle>{isNewFloorPlan ? 'Añadir Nuevo Piso' : 'Editar Piso'}</DialogTitle>
            <DialogDescription>
              {isNewFloorPlan 
                ? 'Configura los detalles del nuevo piso.'
                : 'Actualiza la información del piso.'
              }
            </DialogDescription>
          </DialogHeader>

          {editingFloorPlan && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="floor-name">Nombre del Piso *</Label>
                {isCustomFloorName ? (
                  <div className="space-y-2">
                    <Input
                      id="floor-name"
                      value={editingFloorPlan.name || ''}
                      onChange={e => setEditingFloorPlan({...editingFloorPlan, name: e.target.value})}
                      placeholder="Escribe el nombre del piso..."
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
                      Volver a opciones predefinidas
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
                      <SelectValue placeholder="Selecciona un piso..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FLOOR_OPTIONS.map(option => (
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
                <Label>Imagen del Plano {isNewFloorPlan && '*'}</Label>
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
                        Subiendo...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        {editingFloorPlan.image_url ? 'Cambiar imagen' : 'Subir imagen'}
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
                      Dimensiones: {editingFloorPlan.width}x{editingFloorPlan.height}px
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
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveFloorPlan}
              disabled={isUploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Check className="w-4 h-4 mr-2" />
              {isNewFloorPlan ? 'Crear Piso' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
