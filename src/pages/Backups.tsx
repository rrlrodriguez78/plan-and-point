import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useBackups } from '@/hooks/useBackups';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowLeft, 
  Plus, 
  Download, 
  RotateCcw, 
  Trash2,
  Database,
  Clock,
  HardDrive,
  Package
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Backups() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { backups, loading, creating, restoring, createBackup, restoreBackup, deleteBackup, downloadBackup } = useBackups();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<any>(null);
  const [backupName, setBackupName] = useState('');
  const [backupNotes, setBackupNotes] = useState('');
  const [restoreMode, setRestoreMode] = useState<'full' | 'additive'>('additive');

  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleCreateBackup = async () => {
    await createBackup('manual', backupName || undefined, backupNotes || undefined);
    setShowCreateDialog(false);
    setBackupName('');
    setBackupNotes('');
  };

  const handleRestore = async () => {
    if (selectedBackup) {
      await restoreBackup(selectedBackup.id, restoreMode);
      setShowRestoreDialog(false);
      setSelectedBackup(null);
    }
  };

  const handleDelete = async () => {
    if (selectedBackup) {
      await deleteBackup(selectedBackup.id);
      setShowDeleteDialog(false);
      setSelectedBackup(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success text-success-foreground">Completado</Badge>;
      case 'in_progress':
        return <Badge className="bg-warning text-warning-foreground">En progreso</Badge>;
      case 'failed':
        return <Badge variant="destructive">Fallido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'manual':
        return <Badge variant="default">Manual</Badge>;
      case 'automatic':
        return <Badge variant="secondary">Automático</Badge>;
      case 'scheduled':
        return <Badge variant="outline">Programado</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/app/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al Dashboard
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Backups y Respaldos</h1>
              <p className="text-muted-foreground">
                Gestiona los respaldos de seguridad de tus tours
              </p>
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              disabled={creating}
              size="lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Crear Backup Manual
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Total Backups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{backups.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Tours Respaldados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {backups.reduce((acc, b) => acc + b.tours_count, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" />
                Espacio Usado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatBytes(backups.reduce((acc, b) => acc + b.total_size_bytes, 0))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Último Backup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {backups.length > 0 
                  ? formatDistanceToNow(new Date(backups[0].created_at), { 
                      addSuffix: true, 
                      locale: es 
                    })
                  : 'N/A'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Backups Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Backups</CardTitle>
            <CardDescription>
              Todos tus backups guardados y disponibles para restauración
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Cargando backups...</div>
            ) : backups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay backups creados. Crea tu primer backup manual.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tours</TableHead>
                    <TableHead>Tamaño</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.id}>
                      <TableCell className="font-medium">{backup.backup_name}</TableCell>
                      <TableCell>{getTypeBadge(backup.backup_type)}</TableCell>
                      <TableCell>{getStatusBadge(backup.backup_status)}</TableCell>
                      <TableCell>{backup.tours_count}</TableCell>
                      <TableCell>{formatBytes(backup.total_size_bytes)}</TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(backup.created_at), { 
                          addSuffix: true, 
                          locale: es 
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadBackup(backup)}
                            title="Descargar"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedBackup(backup);
                              setShowRestoreDialog(true);
                            }}
                            disabled={!backup.can_restore || restoring}
                            title="Restaurar"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedBackup(backup);
                              setShowDeleteDialog(true);
                            }}
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Backup Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nuevo Backup</DialogTitle>
            <DialogDescription>
              Crea un respaldo completo de todos tus tours y su contenido
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="backup-name">Nombre del Backup (opcional)</Label>
              <Input
                id="backup-name"
                placeholder="Ej: Backup mensual octubre"
                value={backupName}
                onChange={(e) => setBackupName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="backup-notes">Notas (opcional)</Label>
              <Textarea
                id="backup-notes"
                placeholder="Añade notas sobre este backup..."
                value={backupNotes}
                onChange={(e) => setBackupNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateBackup} disabled={creating}>
              {creating ? 'Creando...' : 'Crear Backup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar este backup?</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4 mt-4">
                <p>
                  Estás a punto de restaurar: <strong>{selectedBackup?.backup_name}</strong>
                </p>
                <div className="space-y-2">
                  <Label>Modo de restauración:</Label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="restore-mode"
                        value="additive"
                        checked={restoreMode === 'additive'}
                        onChange={() => setRestoreMode('additive')}
                      />
                      <span>Aditivo (mantener tours existentes)</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="restore-mode"
                        value="full"
                        checked={restoreMode === 'full'}
                        onChange={() => setRestoreMode('full')}
                      />
                      <span className="text-destructive">
                        Completo (eliminar tours existentes)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={restoring}>
              {restoring ? 'Restaurando...' : 'Restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El backup "{selectedBackup?.backup_name}" 
              será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}