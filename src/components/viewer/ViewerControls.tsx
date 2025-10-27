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
    
    // Casos especiales
    if (name.includes('sótano') || name.includes('sotano') || name.includes('basement')) {
      return '-1';
    }
    if (name.includes('planta baja') || name.includes('ground') || name.includes('principal')) {
      return '0';
    }
    if (name.includes('ático') || name.includes('attic')) {
      return '99';
    }
    if (name.includes('azotea') || name.includes('rooftop')) {
      return '100';
    }
    
    // Detección de pisos del 1 al 25
    const floorMappings = [
      { keywords: ['primer', 'first', 'firstfloor'], number: '1' },
      { keywords: ['segundo', 'second', 'secondfloor'], number: '2' },
      { keywords: ['tercer', 'third', 'thirdfloor'], number: '3' },
      { keywords: ['cuarto', 'fourth', 'fourthfloor'], number: '4' },
      { keywords: ['quinto', 'fifth', 'fifthfloor'], number: '5' },
      { keywords: ['sexto', 'sixth', 'sixthfloor'], number: '6' },
      { keywords: ['séptimo', 'septimo', 'seventh', 'seventhfloor'], number: '7' },
      { keywords: ['octavo', 'eighth', 'eighthfloor'], number: '8' },
      { keywords: ['noveno', 'ninth', 'ninthfloor'], number: '9' },
      { keywords: ['décimo', 'decimo', 'tenth', 'tenthfloor'], number: '10' },
      { keywords: ['eleventhfloor', 'piso 11'], number: '11' },
      { keywords: ['twelfthfloor', 'piso 12'], number: '12' },
      { keywords: ['thirteenthfloor', 'piso 13'], number: '13' },
      { keywords: ['fourteenthfloor', 'piso 14'], number: '14' },
      { keywords: ['fifteenthfloor', 'piso 15'], number: '15' },
      { keywords: ['sixteenthfloor', 'piso 16'], number: '16' },
      { keywords: ['seventeenthfloor', 'piso 17'], number: '17' },
      { keywords: ['eighteenthfloor', 'piso 18'], number: '18' },
      { keywords: ['nineteenthfloor', 'piso 19'], number: '19' },
      { keywords: ['twentiethfloor', 'piso 20'], number: '20' },
      { keywords: ['twentyfirstfloor', 'piso 21'], number: '21' },
      { keywords: ['twentysecondfloor', 'piso 22'], number: '22' },
      { keywords: ['twentythirdfloor', 'piso 23'], number: '23' },
      { keywords: ['twentyfourthfloor', 'piso 24'], number: '24' },
      { keywords: ['twentyfifthfloor', 'piso 25'], number: '25' },
    ];
    
    for (const mapping of floorMappings) {
      if (mapping.keywords.some(keyword => name.includes(keyword))) {
        return mapping.number;
      }
    }
    
    // Fallback: usar índice
    const index = floorPlans.findIndex(fp => fp.id === floorPlan.id);
    return (index + 1).toString();
  };

  // Función para obtener el nombre descriptivo del piso
  const getFloorLabel = (floorPlan: FloorPlan) => {
    const number = getFloorNumber(floorPlan);
    const numericValue = parseInt(number);
    
    // Casos especiales
    if (number === '-1') return 'Sótano';
    if (number === '0') return 'Planta Baja';
    if (number === '99') return 'Ático';
    if (number === '100') return 'Azotea';
    
    // Nombres específicos para pisos 1-10
    const specificNames: Record<string, string> = {
      '1': 'Primer Piso',
      '2': 'Segundo Piso',
      '3': 'Tercer Piso',
      '4': 'Cuarto Piso',
      '5': 'Quinto Piso',
      '6': 'Sexto Piso',
      '7': 'Séptimo Piso',
      '8': 'Octavo Piso',
      '9': 'Noveno Piso',
      '10': 'Décimo Piso',
    };
    
    if (specificNames[number]) {
      return specificNames[number];
    }
    
    // Para pisos 11 en adelante, usar "Piso X"
    if (numericValue > 10) {
      return `Piso ${number}`;
    }
    
    return `Piso ${number}`;
  };

  const activeFloor = floorPlans.find(fp => fp.id === activeFloorPlanId);

  const handleFloorSelect = (floorId: string) => {
    onFloorPlanChange(floorId);
    setShowFloorList(false);
  };

  if (floorPlans.length <= 1) return null;

  return (
    <div className="fixed bottom-4 left-4 md:left-auto md:right-4 z-10">
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
            className="absolute bottom-14 left-0 md:bottom-12 md:right-0 md:left-auto w-64 sm:w-72 max-w-[90vw]"
          >
            <Card className="bg-black/90 backdrop-blur-lg border-white/20 text-white shadow-2xl">
              <CardContent className="p-2">
                <div className="text-xs font-semibold text-slate-300 mb-2 px-1 flex items-center justify-between">
                  <span>Seleccionar Piso</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowFloorList(false)}
                    className="h-5 w-5 text-white hover:bg-white/20"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <ScrollArea className="max-h-[40vh] pr-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div className="space-y-1">
                    {floorPlans
                      .sort((a, b) => (b.floor_order || 0) - (a.floor_order || 0))
                      .map(fp => (
                      <button
                        key={fp.id}
                        onClick={() => handleFloorSelect(fp.id)}
                        className={`w-full text-left p-2 rounded-md transition-colors flex items-center gap-2 ${
                          activeFloorPlanId === fp.id 
                            ? 'bg-blue-500/30 border border-blue-400/50' 
                            : 'hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <span className="font-bold text-base min-w-7 text-center text-blue-400 bg-blue-500/20 rounded px-1.5 py-0.5">
                            {getFloorNumber(fp)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white text-sm truncate">
                              {getFloorLabel(fp)}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {fp.name}
                            </div>
                          </div>
                          {activeFloorPlanId === fp.id && (
                            <div className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0 animate-pulse"></div>
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
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
