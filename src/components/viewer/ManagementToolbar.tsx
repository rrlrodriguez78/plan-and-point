import { Button } from "@/components/ui/button";
import { Copy, Trash2, Move, X, CheckSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

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
    <div className="fixed top-20 right-4 z-30 flex flex-col gap-2">
      <Button
        variant={isManagementMode ? "default" : "secondary"}
        size="icon"
        onClick={onToggleManagement}
        className="shadow-lg"
        title="Modo gestión"
      >
        <CheckSquare className="w-5 h-5" />
      </Button>

      <AnimatePresence>
        {isManagementMode && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col gap-2"
          >
            {selectedCount > 0 && (
              <Badge variant="default" className="justify-center py-2">
                {selectedCount} seleccionados
              </Badge>
            )}

            <Button
              variant={isMoveMode ? "default" : "secondary"}
              size="icon"
              onClick={onToggleMoveMode}
              disabled={selectedCount === 0}
              className="shadow-lg"
              title="Mover seleccionados"
            >
              <Move className="w-5 h-5" />
            </Button>

            <Button
              variant="secondary"
              size="icon"
              onClick={onCopy}
              disabled={selectedCount === 0}
              className="shadow-lg"
              title="Copiar seleccionados"
            >
              <Copy className="w-5 h-5" />
            </Button>

            <Button
              variant="destructive"
              size="icon"
              onClick={onDelete}
              disabled={selectedCount === 0}
              className="shadow-lg"
              title="Eliminar seleccionados"
            >
              <Trash2 className="w-5 h-5" />
            </Button>

            {selectedCount > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={onClearSelection}
                className="shadow-lg"
                title="Limpiar selección"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
