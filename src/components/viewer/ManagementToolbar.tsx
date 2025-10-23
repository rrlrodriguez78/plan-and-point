import { Button } from "@/components/ui/button";
import { Copy, Trash2, Move, X, CheckSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ManagementToolbarProps {
  isManagementMode: boolean;
  isMoveMode: boolean;
  selectedCount: number;
  onToggleManagement: () => void;
  onToggleMoveMode: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export const ManagementToolbar = ({
  isManagementMode,
  isMoveMode,
  selectedCount,
  onToggleManagement,
  onToggleMoveMode,
  onCopy,
  onDelete,
  onClearSelection,
}: ManagementToolbarProps) => {
  return (
    <TooltipProvider>
      <div className="fixed top-20 right-4 z-30 flex flex-col gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isManagementMode ? "default" : "secondary"}
              size="icon"
              onClick={onToggleManagement}
              className="shadow-lg"
            >
              <CheckSquare className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{isManagementMode ? "Desactivar modo gestión" : "Activar modo gestión"}</p>
          </TooltipContent>
        </Tooltip>

        <AnimatePresence>
          {isManagementMode && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-2"
            >
              {selectedCount > 0 && (
                <Badge variant="default" className="justify-center py-2 shadow-lg">
                  {selectedCount} seleccionados
                </Badge>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isMoveMode ? "default" : "secondary"}
                    size="icon"
                    onClick={onToggleMoveMode}
                    disabled={selectedCount === 0}
                    className="shadow-lg"
                  >
                    <Move className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Mover puntos seleccionados</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={onCopy}
                    disabled={selectedCount === 0}
                    className="shadow-lg"
                  >
                    <Copy className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Copiar seleccionados</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={onDelete}
                    disabled={selectedCount === 0}
                    className="shadow-lg"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Eliminar seleccionados</p>
                </TooltipContent>
              </Tooltip>

              {selectedCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={onClearSelection}
                      className="shadow-lg"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>Limpiar selección</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
};
