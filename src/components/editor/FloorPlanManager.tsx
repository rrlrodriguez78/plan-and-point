// This component will be created with a simplified version for initial integration
import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Upload, Plus, Trash2, Star, Edit, Check, X, RotateCw, MoreVertical, ImageIcon, FileText, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
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
import { useMediaQuery } from '@/hooks/use-media-query';
import { supabase } from '@/integrations/supabase/client';

// Opciones predefinidas para tipos de piso
const floorTypes = [];
for (let i = 5; i > 0; i--) {
  floorTypes.push({ value: -i, label: `Sótano -${i}`, order: -i });
}
floorTypes.push({ value: 0, label: "Planta Baja", order: 0 });
for (let i = 1; i <= 25; i++) {
  let label;
  switch (i) {
    case 1: label = "Primer Piso"; break;
    case 2: label = "Segundo Piso"; break;
    case 3: label = "Tercer Piso"; break;
    default: label = `Piso ${i}`;
  }
  floorTypes.push({ value: i, label: label, order: i });
}

const isPDF = (url: string) => {
  return url && url.toLowerCase().endsWith('.pdf');
};

const ProgressBar = ({ current, total }: { current: number; total: number }) => {
  const percentage = (current / total) * 100;
  return (
    <div className="w-full bg-slate-200 rounded-full h-2.5 mb-4">
      <div 
        className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  );
};

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
  floorPlans: any[];
  activeFloorPlanId?: string;
  onFloorPlanSelect: (floorPlan: any) => void;
  onFloorPlansUpdate: (floorPlans: any[]) => void;
  isMobile: boolean;
}

export default function FloorPlanManager({ tour, floorPlans, activeFloorPlanId, onFloorPlanSelect, onFloorPlansUpdate, isMobile }: FloorPlanManagerProps) {
  const [editingFloorPlan, setEditingFloorPlan] = useState<any>(null);
  const [isNewFloorPlan, setIsNewFloorPlan] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  const [fileValidationError, setFileValidationError] = useState<any>(null);

  const isFileCompatible = (url: string) => {
    return url && !url.toLowerCase().endsWith('.pdf');
  };

  const validateFloorPlan = (floorData: any) => {
    const newErrors: Record<string, string> = {};
    
    if (!floorData.name.trim()) {
      newErrors.name = "El nombre del piso es requerido";
    }
    
    const existingFloor = floorPlans.find(fp => 
      fp.floor_order === floorData.floor_order && 
      fp.id !== floorData.id
    );
    if (existingFloor) {
      newErrors.floor_order = "Ya existe un piso con este nivel";
    }

    if (isNewFloorPlan) {
      if (!floorData.floor_plan_url) {
        newErrors.floor_plan_url = "Debes subir un archivo para el plano del piso";
      } else if (!isFileCompatible(floorData.floor_plan_url)) {
        newErrors.floor_plan_url = "El archivo debe ser una imagen (PNG, JPG, WEBP).";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!editingFloorPlan) return;

    switch(currentStep) {
      case 1:
        if (!editingFloorPlan.name.trim()) {
          isValid = false;
          newErrors.name = "El nombre del piso es requerido";
        }
        break;
      case 2:
        const existingFloor = floorPlans.find(fp => 
          fp.floor_order === editingFloorPlan.floor_order && 
          fp.id !== editingFloorPlan.id
        );
        if (existingFloor) {
          isValid = false;
          newErrors.floor_order = "Ya existe un piso con este nivel";
        }
        break;
      case 4:
        if (!editingFloorPlan.floor_plan_url) {
          isValid = false;
          newErrors.floor_plan_url = "Debes subir un archivo para el plano del piso";
        } else if (!isFileCompatible(editingFloorPlan.floor_plan_url)) {
          isValid = false;
          newErrors.floor_plan_url = "El archivo debe ser una imagen compatible.";
        }
        break;
      default:
        break;
    }
    
    setErrors(newErrors);
    setFileValidationError(null);

    if (isValid) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => prev - 1);
    setErrors({});
    setFileValidationError(null);
  };

  const handleSaveFloorPlan = async () => {
    if (!editingFloorPlan) return;

    if (!validateFloorPlan(editingFloorPlan)) {
      return;
    }

    try {
      if (isNewFloorPlan) {
        const floorPlanData = {
          ...editingFloorPlan,
          tour_id: tour.id,
          is_default: floorPlans.length === 0,
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
            name: editingFloorPlan.name,
            floor_order: editingFloorPlan.floor_order,
            description: editingFloorPlan.description,
            is_default: editingFloorPlan.is_default,
            floor_plan_url: editingFloorPlan.floor_plan_url
          })
          .eq('id', editingFloorPlan.id);
        
        if (error) throw error;
        
        const updatedFloorPlans = floorPlans.map(fp =>
          fp.id === editingFloorPlan.id ? editingFloorPlan : fp
        );
        onFloorPlansUpdate(updatedFloorPlans);
      }
      
      setEditingFloorPlan(null);
      setIsNewFloorPlan(false);
      setErrors({});
      setCurrentStep(1);
      setFileValidationError(null);
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

  const handleSetDefault = async (floorPlanId: string) => {
    try {
      const updates = floorPlans.map(fp => 
        supabase
          .from('floor_plans')
          .update({ is_default: fp.id === floorPlanId })
          .eq('id', fp.id)
      );
      await Promise.all(updates);
      const updatedFloorPlans = floorPlans.map(fp => ({ ...fp, is_default: fp.id === floorPlanId }));
      onFloorPlansUpdate(updatedFloorPlans);
    } catch (error) {
      console.error('Error setting default floor plan:', error);
      alert('Error al establecer el piso por defecto.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingFloorPlan) return;

    setIsUploading(true);
    setErrors(prev => ({ ...prev, floor_plan_url: undefined as any }));
    setFileValidationError(null);
    
    try {
      const fileName = `${tour.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tour-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(fileName);
      
      if (!isFileCompatible(publicUrl)) {
        setFileValidationError({
          type: 'incompatible',
          message: 'Archivo no compatible',
          details: 'Los PDFs no son compatibles con puntos interactivos.',
          fileName: file.name
        });
        return;
      }
      
      setEditingFloorPlan((prev: any) => ({ ...prev, floor_plan_url: publicUrl }));
    } catch (error) {
      console.error('Error uploading floor plan file:', error);
      alert('Error al subir el archivo del plano.');
      setErrors(prev => ({ ...prev, floor_plan_url: 'Error al subir el archivo.' }));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const getFloorTypeLabel = (order: number) => {
    const type = floorTypes.find(ft => ft.value === order);
    return type ? type.label : `Piso ${order}`;
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
          setCurrentStep(1);
          setErrors({});
          setFileValidationError(null);
          setEditingFloorPlan({ 
            name: '', 
            floor_order: 0, 
            description: '', 
            floor_plan_url: '', 
            is_default: false
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
            {floorPlans
              .sort((a, b) => (b.floor_order || 0) - (a.floor_order || 0))
              .map(fp => (
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
                    {fp.floor_plan_url ? (
                      isPDF(fp.floor_plan_url) ?
                        <div className="text-center">
                          <FileText className="w-5 h-5 text-red-600"/>
                          <span className="text-xs font-bold text-red-600">PDF</span>
                        </div>
                        :
                        <img src={fp.floor_plan_url} alt={fp.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{fp.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={activeFloorPlanId === fp.id ? "default" : "secondary"}>
                        {getFloorTypeLabel(fp.floor_order)}
                      </Badge>
                      {fp.is_default && 
                        <Badge variant="outline" className="bg-amber-100 text-amber-800 text-xs border-amber-200">
                          <Star className="w-3 h-3 mr-1 fill-amber-400 text-amber-400" /> Principal
                        </Badge>
                      }
                      {activeFloorPlanId === fp.id && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                          Activo
                        </Badge>
                      )}
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
                        setEditingFloorPlan(fp); 
                        setErrors({}); 
                        setCurrentStep(1);
                        setFileValidationError(null);
                      }}>
                        <Edit className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      {!fp.is_default && (
                        <DropdownMenuItem onClick={() => handleSetDefault(fp.id)}>
                          <Star className="w-4 h-4 mr-2" /> Marcar como principal
                        </DropdownMenuItem>
                      )}
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
          setErrors({});
          setCurrentStep(1);
          setFileValidationError(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{isNewFloorPlan ? 'Añadir Nuevo Piso (Asistente)' : 'Editar Piso'}</DialogTitle>
            <DialogDescription>
              {isNewFloorPlan 
                ? 'Sigue los pasos para configurar tu nuevo piso.'
                : 'Configura los detalles del piso.'
              }
            </DialogDescription>
          </DialogHeader>

          {editingFloorPlan && (
            isNewFloorPlan ? (
              <ScrollArea className="flex-1 max-h-[50vh]">
                <div className="py-4 px-1">
                  <ProgressBar current={currentStep} total={totalSteps} />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStep}
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4 min-h-[280px]"
                    >
                      {currentStep === 1 && (
                        <div className="space-y-2">
                          <Label htmlFor="floor-name" className="text-lg font-semibold">1. ¿Cuál es el nombre del piso? *</Label>
                          <p className="text-sm text-slate-500">Ej: Planta Baja, Sótano...</p>
                          <Input
                            id="floor-name"
                            value={editingFloorPlan.name}
                            onChange={e => setEditingFloorPlan({...editingFloorPlan, name: e.target.value})}
                            placeholder="Escribe el nombre aquí..."
                            className={errors.name ? 'border-red-500' : ''}
                          />
                          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                        </div>
                      )}
                      {currentStep === 2 && (
                        <div className="space-y-2">
                          <Label htmlFor="floor-order" className="text-lg font-semibold">2. ¿Qué nivel ocupa? *</Label>
                          <Select 
                            value={editingFloorPlan.floor_order.toString()} 
                            onValueChange={(value) => setEditingFloorPlan({...editingFloorPlan, floor_order: parseInt(value)})}
                          >
                            <SelectTrigger className={errors.floor_order ? 'border-red-500' : ''}>
                              <SelectValue>{getFloorTypeLabel(editingFloorPlan.floor_order)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-white z-50">
                              {floorTypes.map(type => (
                                <SelectItem key={type.value} value={type.value.toString()}>{type.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.floor_order && <p className="text-red-500 text-sm mt-1">{errors.floor_order}</p>}
                        </div>
                      )}
                      {currentStep === 3 && (
                        <div className="space-y-2">
                          <Label htmlFor="floor-description" className="text-lg font-semibold">3. Describe este piso (Opcional)</Label>
                          <Textarea
                            id="floor-description"
                            value={editingFloorPlan.description || ''}
                            onChange={e => setEditingFloorPlan({...editingFloorPlan, description: e.target.value})}
                            placeholder="Añade una breve descripción..."
                            rows={4}
                          />
                        </div>
                      )}
                      {currentStep === 4 && (
                        <div className="space-y-4">
                          <Label className="text-lg font-semibold">4. Sube el plano del piso *</Label>
                          
                          {fileValidationError && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3"
                            >
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                                <h4 className="font-semibold text-red-800">{fileValidationError.message}</h4>
                              </div>
                              <p className="text-sm text-red-700">{fileValidationError.details}</p>
                              <Button 
                                onClick={() => fileInputRef.current?.click()} 
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Seleccionar Archivo Compatible
                              </Button>
                            </motion.div>
                          )}
                          
                          {!fileValidationError && (
                            <Button 
                              type="button" 
                              onClick={() => fileInputRef.current?.click()} 
                              disabled={isUploading}
                              variant="outline"
                              className={`w-full h-24 border-dashed ${errors.floor_plan_url ? 'border-red-500' : ''}`}
                            >
                              {isUploading ? (
                                <><RotateCw className="w-6 h-6 mr-2 animate-spin" /> Subiendo...</>
                              ) : (
                                <><Upload className="w-6 h-6 mr-2" /> Haz clic para subir</>
                              )}
                            </Button>
                          )}
                          
                          {editingFloorPlan.floor_plan_url && isFileCompatible(editingFloorPlan.floor_plan_url) && (
                            <div className="mt-2 text-center">
                              <p className="text-sm text-green-600 font-semibold">¡Archivo subido! ✓</p>
                              <img 
                                src={editingFloorPlan.floor_plan_url} 
                                alt="Preview" 
                                className="w-full max-w-xs mx-auto h-20 object-cover rounded border"
                              />
                            </div>
                          )}
                          
                          {errors.floor_plan_url && <p className="text-red-500 text-sm mt-1">{errors.floor_plan_url}</p>}
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  <div className="pt-4 flex justify-between">
                    <Button variant="outline" onClick={() => { setEditingFloorPlan(null); }}>Cancelar</Button>
                    <div className="flex space-x-2">
                      {currentStep > 1 && <Button variant="secondary" onClick={handlePrevStep}>Anterior</Button>}
                      {currentStep < totalSteps && (
                        <Button 
                          onClick={handleNextStep} 
                          disabled={
                            (currentStep === 1 && !editingFloorPlan.name.trim()) ||
                            (currentStep === 4 && (!editingFloorPlan.floor_plan_url || !isFileCompatible(editingFloorPlan.floor_plan_url) || !!fileValidationError))
                          }
                        >
                          Siguiente
                        </Button>
                      )}
                      {currentStep === totalSteps && (
                        <Button 
                          onClick={handleSaveFloorPlan} 
                          disabled={
                            !editingFloorPlan.floor_plan_url || 
                            !isFileCompatible(editingFloorPlan.floor_plan_url) ||
                            !!fileValidationError
                          }
                        >
                          Crear Piso
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <ScrollArea className="flex-1 max-h-[50vh]">
                <div className="space-y-4 py-4 px-1">
                  <div>
                    <Label htmlFor="floor-name">Nombre del Piso *</Label>
                    <Input 
                      id="floor-name" 
                      value={editingFloorPlan.name} 
                      onChange={e => setEditingFloorPlan({...editingFloorPlan, name: e.target.value})} 
                      placeholder="Ej: Cocina y Comedor..." 
                      className={errors.name ? 'border-red-500' : ''}
                    />
                    {errors.name && (<p className="text-red-500 text-sm mt-1">{errors.name}</p>)}
                  </div>
                  <div>
                    <Label htmlFor="floor-order">Nivel del Piso *</Label>
                    <Select value={editingFloorPlan.floor_order.toString()} onValueChange={(value) => setEditingFloorPlan({...editingFloorPlan, floor_order: parseInt(value)})}>
                      <SelectTrigger className={errors.floor_order ? 'border-red-500' : ''}>
                        <SelectValue>{getFloorTypeLabel(editingFloorPlan.floor_order)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-white z-50">
                        {floorTypes.map(type => (<SelectItem key={type.value} value={type.value.toString()}>{type.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    {errors.floor_order && (<p className="text-red-500 text-sm mt-1">{errors.floor_order}</p>)}
                  </div>
                  <div>
                    <Label htmlFor="floor-description">Descripción (Opcional)</Label>
                    <Textarea id="floor-description" value={editingFloorPlan.description || ''} onChange={e => setEditingFloorPlan({...editingFloorPlan, description: e.target.value})} placeholder="Describe las áreas..." rows={3}/>
                  </div>
                  <div>
                    <Label>Plano del Piso</Label>
                    <div className="flex items-center space-x-2">
                      <Input type="text" value={editingFloorPlan.floor_plan_url || ''} readOnly placeholder="No hay archivo subido" className="flex-grow"/>
                      <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} variant="outline">
                        {isUploading ? (<><RotateCw className="w-4 h-4 mr-2 animate-spin"/> Subiendo...</>) : (<><Upload className="w-4 h-4 mr-2"/> Subir</>)}
                      </Button>
                    </div>
                    {editingFloorPlan.floor_plan_url && (<div className="mt-2 text-sm text-slate-500">Archivo actual</div>)}
                  </div>
                  {floorPlans.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="is-default" checked={editingFloorPlan.is_default} onChange={e => setEditingFloorPlan({...editingFloorPlan, is_default: e.target.checked})} className="rounded"/>
                      <Label htmlFor="is-default" className="text-sm">Establecer como piso principal</Label>
                    </div>
                  )}
                  <div className="pt-4 flex justify-between">
                    <Button variant="outline" onClick={() => { setEditingFloorPlan(null); }}>Cancelar</Button>
                    <Button onClick={handleSaveFloorPlan}><Check className="w-4 h-4 mr-2" /> Guardar Cambios</Button>
                  </div>
                </div>
              </ScrollArea>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

