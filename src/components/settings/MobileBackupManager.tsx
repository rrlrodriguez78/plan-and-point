import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Save, 
  RotateCcw, 
  Trash2, 
  Clock, 
  Smartphone, 
  CheckCircle2,
  GitCompare,
  FileJson,
  Plus
} from 'lucide-react';
import { useMobileSettingsBackup } from '@/hooks/useMobileSettingsBackup';
import { UserSettings } from '@/hooks/useUserSettings';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MobileBackupManagerProps {
  currentSettings: UserSettings;
  onRestoreSettings: (settings: any) => void;
}

export const MobileBackupManager = ({ currentSettings, onRestoreSettings }: MobileBackupManagerProps) => {
  const { backups, loading, creating, createBackup, restoreBackup, deleteBackup, compareBackups } = useMobileSettingsBackup();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [backupDescription, setBackupDescription] = useState('');
  const [compareBackupId, setCompareBackupId] = useState<string | null>(null);

  const handleCreateBackup = async () => {
    if (!backupName.trim()) return;
    
    try {
      await createBackup(backupName, backupDescription, currentSettings);
      setBackupName('');
      setBackupDescription('');
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating backup:', error);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    try {
      const restoredSettings = await restoreBackup(backupId);
      if (restoredSettings?.user_settings) {
        onRestoreSettings(restoredSettings.user_settings);
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
    }
  };

  const activeBackup = backups.find(b => b.is_active);

  const getBackupStatusColor = (backup: any) => {
    if (backup.is_active) return 'bg-green-500';
    return 'bg-gray-500';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Save className="h-5 w-5 text-primary" />
            <CardTitle>Backups de Configuración Móvil</CardTitle>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Crear Backup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Backup</DialogTitle>
                <DialogDescription>
                  Guarda la configuración actual de tu app móvil para restaurarla más tarde
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="backup-name">Nombre del Backup *</Label>
                  <Input
                    id="backup-name"
                    placeholder="Ej: Configuración funcionando bien"
                    value={backupName}
                    onChange={(e) => setBackupName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="backup-description">Descripción</Label>
                  <Textarea
                    id="backup-description"
                    placeholder="Describe qué hace especial esta configuración..."
                    value={backupDescription}
                    onChange={(e) => setBackupDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="rounded-lg bg-muted p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Smartphone className="h-4 w-4" />
                    <span className="font-medium">Se guardará:</span>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-6">
                    <li>• Configuración de usuario actual</li>
                    <li>• Ajustes de tema y apariencia</li>
                    <li>• Preferencias del visor</li>
                    <li>• Información del dispositivo</li>
                  </ul>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreateBackup} 
                  disabled={!backupName.trim() || creating}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {creating ? 'Guardando...' : 'Guardar Backup'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          Guarda y restaura configuraciones que funcionan bien en tu dispositivo móvil
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Cargando backups...
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileJson className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No hay backups guardados aún</p>
            <p className="text-sm mt-1">Crea tu primer backup para guardar tu configuración actual</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {backups.map((backup) => (
                <div 
                  key={backup.id}
                  className="border rounded-lg p-4 space-y-3 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{backup.backup_name}</h4>
                        {backup.is_active && (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Activo
                          </Badge>
                        )}
                      </div>
                      {backup.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {backup.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(backup.created_at), 'PPp', { locale: es })}
                        </div>
                        {backup.device_info && (
                          <div className="flex items-center gap-1">
                            <Smartphone className="h-3 w-3" />
                            {backup.device_info.screenSize}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="default" className="flex-1 gap-2">
                          <RotateCcw className="h-3 w-3" />
                          Restaurar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Restaurar este backup?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esto reemplazará tu configuración actual con la guardada en "{backup.backup_name}".
                            Los cambios se aplicarán inmediatamente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRestoreBackup(backup.id)}>
                            Restaurar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-2">
                          <GitCompare className="h-3 w-3" />
                          Ver
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Detalles del Backup</DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-[400px]">
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold mb-2">Información del Dispositivo</h4>
                              {backup.device_info && (
                                <div className="text-sm space-y-1 bg-muted p-3 rounded">
                                  <p><strong>Plataforma:</strong> {backup.device_info.platform}</p>
                                  <p><strong>Resolución:</strong> {backup.device_info.screenSize}</p>
                                  <p><strong>Móvil:</strong> {backup.device_info.isMobile ? 'Sí' : 'No'}</p>
                                  <p><strong>PWA:</strong> {backup.device_info.isStandalone ? 'Sí' : 'No'}</p>
                                </div>
                              )}
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">Configuración Guardada</h4>
                              <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                                {JSON.stringify(backup.settings_snapshot, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>

                    {!backup.is_active && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar backup?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. El backup "{backup.backup_name}" será eliminado permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteBackup(backup.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
