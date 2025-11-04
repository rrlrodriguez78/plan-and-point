import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, Loader2, HardDrive, Smartphone } from 'lucide-react';
import { checkMigrationNeeded, migrateTours, MigrationProgress } from '@/utils/storageMigration';
import { isNativeApp } from '@/utils/storagePermissions';

export function StorageMigrationDialog() {
  const [open, setOpen] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    migrated: number;
    failed: number;
    errors: Array<{ tourId: string; error: string }>;
  } | null>(null);

  useEffect(() => {
    checkIfMigrationNeeded();
  }, []);

  const checkIfMigrationNeeded = async () => {
    // Only check on native apps
    if (!isNativeApp()) return;

    // Check if already migrated
    const alreadyMigrated = localStorage.getItem('storage_migration_completed');
    if (alreadyMigrated === 'true') return;

    const needed = await checkMigrationNeeded();
    setMigrationNeeded(needed);
    if (needed) {
      setOpen(true);
    }
  };

  const handleMigrate = async () => {
    setIsMigrating(true);
    setProgress({ total: 0, current: 0, currentTourName: '', isComplete: false });

    const migrationResult = await migrateTours((p) => {
      setProgress(p);
    });

    setResult(migrationResult);
    setIsMigrating(false);

    if (migrationResult.success) {
      localStorage.setItem('storage_migration_completed', 'true');
    }
  };

  const handleSkip = () => {
    localStorage.setItem('storage_migration_skipped', 'true');
    setOpen(false);
  };

  const handleClose = () => {
    if (result?.success) {
      localStorage.setItem('storage_migration_completed', 'true');
    }
    setOpen(false);
  };

  if (!migrationNeeded) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Mejora de Almacenamiento
          </DialogTitle>
          <DialogDescription>
            Detectamos tours almacenados en el sistema antiguo. Migra al nuevo sistema para mayor capacidad y mejor rendimiento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isMigrating && !result && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium">Antiguo</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    • Límite: 100MB<br />
                    • Máx: 5 tours
                  </div>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium text-primary">Nuevo</span>
                  </div>
                  <div className="text-sm">
                    • Sin límites*<br />
                    • Tours ilimitados
                  </div>
                </div>
              </div>

              <Alert>
                <AlertDescription className="text-xs">
                  *Solo limitado por el espacio disponible en tu dispositivo
                </AlertDescription>
              </Alert>
            </>
          )}

          {isMigrating && progress && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Migrando...</span>
                <span className="font-semibold">
                  {progress.current}/{progress.total}
                </span>
              </div>
              <Progress 
                value={(progress.current / progress.total) * 100} 
                className="h-2"
              />
              {progress.currentTourName && (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-muted-foreground">{progress.currentTourName}</span>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              {result.success ? (
                <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-900">
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <AlertDescription>
                    <strong>¡Migración exitosa!</strong>
                    <div className="mt-1 text-sm">
                      {result.migrated} {result.migrated === 1 ? 'tour migrado' : 'tours migrados'} correctamente
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <strong>Migración parcial</strong>
                    <div className="mt-1 text-sm">
                      Exitosos: {result.migrated} | Fallidos: {result.failed}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {result.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-1">
                  {result.errors.map((err, i) => (
                    <div key={i}>• {err.tourId}: {err.error}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {!isMigrating && !result && (
              <>
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  className="flex-1"
                >
                  Más tarde
                </Button>
                <Button
                  onClick={handleMigrate}
                  className="flex-1"
                >
                  Migrar ahora
                </Button>
              </>
            )}
            {result && (
              <Button onClick={handleClose} className="w-full">
                Continuar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
