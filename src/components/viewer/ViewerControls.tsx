import React, { useState, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Layers, X, ChevronUp, ChevronDown } from "lucide-react";
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

export default function ViewerControls({ 
  floorPlans, 
  activeFloorPlanId, 
  onFloorPlanChange 
}: ViewerControlsProps) {
  const [showFloorList, setShowFloorList] = useState(false);

  // Memoizar el cálculo de números de piso
  const floorPlansWithNumbers = useMemo(() => {
    return floorPlans.map(floorPlan => ({
      ...floorPlan,
      floorNumber: getFloorNumber(floorPlan, floorPlans),
      floorLabel: getFloorLabel(floorPlan)
    }));
  }, [floorPlans]);

  // Ordenar pisos de mayor a menor
  const sortedFloorPlans = useMemo(() => {
    return [...floorPlansWithNumbers].sort((a, b) => {
      // Ordenar por floor_order si está disponible, sino por floorNumber
      const orderA = a.floor_order ?? parseInt(a.floorNumber);
      const orderB = b.floor_order ?? parseInt(b.floorNumber);
      return orderB - orderA;
    });
  }, [floorPlansWithNumbers]);

  const activeFloor = useMemo(() => 
    floorPlansWithNumbers.find(fp => fp.id === activeFloorPlanId),
    [floorPlansWithNumbers, activeFloorPlanId]
  );

  // Función para convertir el nombre del piso a número
  function getFloorNumber(floorPlan: FloorPlan, allFloorPlans: FloorPlan[]): string {
    if (!floorPlan) return '0';
    
    // Priorizar floor_order si está disponible
    if (typeof floorPlan.floor_order === 'number') {
      return floorPlan.floor_order.toString();
    }
    
    // Parsear del nombre
    const name = floorPlan.name.toLowerCase();
    
    const floorMappings = [
      { patterns: ['sótano', 'sotano', 'subsuelo', 'basement'], value: '-1' },
      { patterns: ['planta baja', 'ground', 'principal', 'p.b', 'pb'], value: '0' },
      { patterns: ['primer', 'first', '1ro', '1°'], value: '1' },
      { patterns: ['segundo', 'second', '2do', '2°'], value: '2' },
      { patterns: ['tercer', 'third', '3ro', '3°'], value: '3' },
      { patterns: ['cuarto', 'fourth', '4to', '4°'], value: '4' },
      { patterns: ['quinto', 'fifth', '5to', '5°'], value: '5' }
    ];

    for (const mapping of floorMappings) {
      if (mapping.patterns.some(pattern => name.includes(pattern))) {
        return mapping.value;
      }
    }

    // Fallback: usar el índice en el array
    const index = allFloorPlans.findIndex(fp => fp.id === floorPlan.id);
    return index.toString();
  }

  // Función para obtener el nombre descriptivo del piso
  function getFloorLabel(floorPlan: FloorPlan): string {
    const number = getFloorNumber(floorPlan, floorPlans);
    
    const floorLabels: { [key: string]: string } = {
      '-1': 'Sótano',
      '0': 'Planta Baja',
      '1': 'Primer Piso',
      '2': 'Segundo Piso',
      '3': 'Tercer Piso',
      '4': 'Cuarto Piso',
      '5': 'Quinto Piso',
      '6': 'Sexto Piso',
      '7': 'Séptimo Piso',
      '8': 'Octavo Piso',
      '9': 'Noveno Piso',
      '10': 'Décimo Piso'
    };

    return floorLabels[number] || `Piso ${number}`;
  }

  const handleFloorSelect = useCallback((floorId: string) => {
    onFloorPlanChange(floorId);
    setShowFloorList(false);
  }, [onFloorPlanChange]);

  // Navegación rápida con teclado
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!showFloorList) return;

    switch(event.key) {
      case 'Escape':
        setShowFloorList(false);
        break;
      case 'ArrowUp':
      case 'ArrowDown':
        event.preventDefault();
        break;
    }
  }, [showFloorList]);

  // Botón compacto para mostrar el piso actual
  const CurrentFloorButton = () => (
    <Button
      size="sm"
      onClick={() => setShowFloorList(!showFloorList)}
      className="bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white h-8 px-3 shadow-lg flex items-center gap-2"
      title={`Piso actual: ${activeFloor?.floorLabel || 'No seleccionado'}`}
    >
      <span className="text-sm font-medium">{activeFloor?.floorNumber || '0'}</span>
      <Layers className="w-3 h-3" />
    </Button>
  );

  if (floorPlans.length <= 1) return null;

  return (
    <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-20 flex flex-col items-end gap-2">
      {/* Botón principal del selector de pisos */}
      <div className="flex items-center gap-2">
        <CurrentFloorButton />
        
        <Button
          size="icon"
          onClick={() => setShowFloorList(!showFloorList)}
          className="bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white h-10 w-10 sm:h-11 sm:w-11 shadow-lg"
          title="Cambiar de Piso"
        >
          <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
      </div>

      {/* Ventana emergente con la lista de pisos */}
      <AnimatePresence>
        {showFloorList && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="absolute bottom-14 sm:bottom-16 right-0 w-80 sm:w-96 max-w-[90vw]"
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            <Card className="bg-black/80 backdrop-blur-lg border-white/20 text-white shadow-2xl max-h-[70vh]">
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
                    {sortedFloorPlans.map((floor) => (
                      <button
                        key={floor.id}
                        onClick={() => handleFloorSelect(floor.id)}
                        className={`w-full text-left p-2 sm:p-3 rounded-md transition-all duration-200 flex items-center gap-2 sm:gap-3 group ${
                          activeFloorPlanId === floor.id 
                            ? 'bg-blue-500/30 border border-blue-400/50 shadow-lg' 
                            : 'hover:bg-white/10 hover:scale-[1.02]'
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 w-full">
                          <span className={`font-bold text-lg sm:text-xl min-w-8 sm:min-w-10 text-center rounded-lg px-2 py-1 transition-colors ${
                            activeFloorPlanId === floor.id 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-white/10 text-blue-300 group-hover:bg-white/20'
                          }`}>
                            {floor.floorNumber}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-white text-sm sm:text-base truncate">
                              {floor.floorLabel}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {floor.name}
                            </div>
                          </div>
                          {activeFloorPlanId === floor.id && (
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
                  <div className="mt-2 text-xs text-slate-400 text-center border-t border-white/10 pt-2 flex items-center justify-center gap-1">
                    <ChevronUp className="w-3 h-3" />
                    <span>Desplaza para ver más pisos</span>
                    <ChevronDown className="w-3 h-3" />
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
