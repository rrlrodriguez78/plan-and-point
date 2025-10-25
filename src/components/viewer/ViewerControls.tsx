import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Layers, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FloorPlan {
  id: string;
  name: string;
  floor_order?: number;
}

interface ViewerControlsProps {
  floorPlans: FloorPlan[];
  activeFloorPlanId: string | null;
  onFloorPlanChange: (floorId: string) => void;
}

export default function ViewerControls({ floorPlans, activeFloorPlanId, onFloorPlanChange }: ViewerControlsProps) {
  const [showFloorList, setShowFloorList] = useState(false);

  // Función para convertir el nombre del piso a número
  const getFloorNumber = (floorPlan: FloorPlan) => {
    if (!floorPlan) return '0';
    
    if (typeof floorPlan.floor_order === 'number') {
      if (floorPlan.floor_order === 0) return '-1'; // Sótano
      return floorPlan.floor_order.toString();
    }
    
    const name = floorPlan.name.toLowerCase();
    if (name.includes('sótano') || name.includes('sotano') || name.includes('basement')) {
      return '-1';
    }
    if (name.includes('planta baja') || name.includes('ground') || name.includes('principal')) {
      return '0';
    }
    if (name.includes('primer') || name.includes('first') || name.includes('1')) {
      return '1';
    }
    if (name.includes('segundo') || name.includes('second') || name.includes('2')) {
      return '2';
    }
    if (name.includes('tercer') || name.includes('third') || name.includes('3')) {
      return '3';
    }
    
    const index = floorPlans.findIndex(fp => fp.id === floorPlan.id);
    return (index + 1).toString();
  };

  // Función para obtener el nombre descriptivo del piso
  const getFloorLabel = (floorPlan: FloorPlan) => {
    const number = getFloorNumber(floorPlan);
    
    switch(number) {
      case '-1':
        return 'Sótano';
      case '0':
        return 'Planta Baja';
      case '1':
        return 'Primer Piso';
      case '2':
        return 'Segundo Piso';
      case '3':
        return 'Tercer Piso';
      case '4':
        return 'Cuarto Piso';
      case '5':
        return 'Quinto Piso';
      default:
        return `Piso ${number}`;
    }
  };

  const activeFloor = floorPlans.find(fp => fp.id === activeFloorPlanId);

  const handleFloorSelect = (floorId: string) => {
    onFloorPlanChange(floorId);
    setShowFloorList(false);
  };

  if (floorPlans.length <= 1) return null;

  return (
    <div className="fixed bottom-4 left-4 md:left-auto md:right-4 z-10 safe-area-bottom safe-area-left md:safe-area-right">
      {/* Selector de pisos con mismo estilo que zoom controls */}
      <Button
        variant="secondary"
        size="icon"
        onClick={() => setShowFloorList(!showFloorList)}
        className="shadow-lg h-11 w-11 md:h-10 md:w-10 touch-manipulation"
        title="Cambiar de Piso"
      >
        <Layers className="w-5 h-5 md:w-4 md:h-4" />
      </Button>

      {/* Ventana emergente con la lista de pisos - AMPLIADA */}
      <AnimatePresence>
        {showFloorList && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute bottom-14 md:bottom-12 left-0 md:right-0 md:left-auto w-80 sm:w-96 max-w-[90vw]"
          >
            <Card className="bg-black/80 backdrop-blur-lg border-white/20 text-white shadow-2xl max-h-[70vh] -webkit-overflow-scrolling-touch">
              <CardContent className="p-2 sm:p-3">
                <div className="text-xs sm:text-sm font-semibold text-slate-300 mb-2 sm:mb-3 px-1 flex items-center justify-between">
                  <span>Seleccionar Piso ({floorPlans.length} pisos)</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowFloorList(false)}
                    className="h-6 w-6 text-white hover:bg-white/20"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <ScrollArea className="h-[60vh] max-h-[500px] pr-2">
                  <div className="space-y-1">
                    {floorPlans
                      .sort((a, b) => (b.floor_order || 0) - (a.floor_order || 0))
                      .map(fp => (
                      <button
                        key={fp.id}
                        onClick={() => handleFloorSelect(fp.id)}
                        className={`w-full text-left p-2 sm:p-3 rounded-md transition-colors flex items-center gap-2 sm:gap-3 touch-manipulation min-h-[48px] ${
                          activeFloorPlanId === fp.id 
                            ? 'bg-blue-500/30 border border-blue-400/50' 
                            : 'hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 w-full">
                          <span className="font-bold text-lg sm:text-xl min-w-8 sm:min-w-10 text-center text-blue-400 bg-blue-500/20 rounded-lg px-2 py-1">
                            {getFloorNumber(fp)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white text-sm sm:text-base truncate">
                              {getFloorLabel(fp)}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {fp.name}
                            </div>
                          </div>
                          {activeFloorPlanId === fp.id && (
                            <div className="w-3 h-3 bg-blue-400 rounded-full flex-shrink-0 animate-pulse"></div>
                          )}
                        </div>
                      </button>
                    ))}
                    
                    {floorPlans.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No hay pisos disponibles</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                {floorPlans.length > 5 && (
                  <div className="mt-2 text-xs text-slate-400 text-center border-t border-white/10 pt-2">
                    Usa scroll para ver más pisos
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
