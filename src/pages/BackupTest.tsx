import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useChunkedBackup } from '@/hooks/useChunkedBackup';
import { BackupProgress } from '@/components/backups/BackupProgress';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Play, 
  TestTube2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Database,
  TrendingUp,
  Activity,
  Zap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  duration?: number;
}

export default function BackupTest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { uploadBackup, cancelUpload, progress, metrics } = useChunkedBackup();
  
  const [backupName, setBackupName] = useState('Test Backup');
  const [backupDescription, setBackupDescription] = useState('Testing chunked backup system');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);

  if (!user) {
    navigate('/auth');
    return null;
  }

  const updateTestResult = (name: string, updates: Partial<TestResult>) => {
    setTestResults(prev => {
      const existing = prev.find(r => r.name === name);
      if (existing) {
        return prev.map(r => r.name === name ? { ...r, ...updates } : r);
      }
      return [...prev, { name, status: 'pending', message: '', ...updates }];
    });
  };

  const runTests = async () => {
    setIsTestRunning(true);
    setTestResults([]);
    toast.info('Iniciando pruebas del sistema de backup...');

    // Test 1: Crear backup pequeño
    try {
      updateTestResult('small-backup', { status: 'running', message: 'Creando backup pequeño (10KB)...' });
      const startTime = Date.now();
      
      const smallData = {
        test: 'small',
        data: Array(100).fill('test data for small backup'),
        timestamp: new Date().toISOString()
      };
      
      await uploadBackup(smallData, 'Test Small Backup', 'Small test backup');
      const duration = Date.now() - startTime;
      
      updateTestResult('small-backup', { 
        status: 'success', 
        message: `✓ Backup pequeño creado exitosamente en ${duration}ms`,
        duration 
      });
      toast.success('Test 1: Backup pequeño completado');
    } catch (error: any) {
      updateTestResult('small-backup', { 
        status: 'error', 
        message: `✗ Error: ${error.message}` 
      });
      toast.error('Test 1 falló');
    }

    // Test 2: Crear backup mediano
    try {
      updateTestResult('medium-backup', { status: 'running', message: 'Creando backup mediano (500KB)...' });
      const startTime = Date.now();
      
      const mediumData = {
        test: 'medium',
        data: Array(5000).fill('This is a medium sized backup with more data to test chunking functionality properly'),
        timestamp: new Date().toISOString(),
        metadata: {
          version: '1.0',
          created_by: 'test-system',
          items_count: 5000
        }
      };
      
      await uploadBackup(mediumData, 'Test Medium Backup', 'Medium test backup');
      const duration = Date.now() - startTime;
      
      updateTestResult('medium-backup', { 
        status: 'success', 
        message: `✓ Backup mediano creado exitosamente en ${duration}ms`,
        duration 
      });
      toast.success('Test 2: Backup mediano completado');
    } catch (error: any) {
      updateTestResult('medium-backup', { 
        status: 'error', 
        message: `✗ Error: ${error.message}` 
      });
      toast.error('Test 2 falló');
    }

    // Test 3: Crear backup grande
    try {
      updateTestResult('large-backup', { status: 'running', message: 'Creando backup grande (2MB)...' });
      const startTime = Date.now();
      
      const largeData = {
        test: 'large',
        data: Array(20000).fill('This is a large backup with a lot of data to test the chunked upload system with multiple chunks and concurrent uploads working together properly'),
        timestamp: new Date().toISOString(),
        metadata: {
          version: '1.0',
          created_by: 'test-system',
          items_count: 20000,
          features: ['chunking', 'concurrency', 'progress-tracking']
        }
      };
      
      await uploadBackup(largeData, 'Test Large Backup', 'Large test backup');
      const duration = Date.now() - startTime;
      
      updateTestResult('large-backup', { 
        status: 'success', 
        message: `✓ Backup grande creado exitosamente en ${duration}ms`,
        duration 
      });
      toast.success('Test 3: Backup grande completado');
    } catch (error: any) {
      updateTestResult('large-backup', { 
        status: 'error', 
        message: `✗ Error: ${error.message}` 
      });
      toast.error('Test 3 falló');
    }

    // Test 4: Verificar métricas
    try {
      updateTestResult('metrics', { status: 'running', message: 'Verificando métricas del sistema...' });
      
      const { data: metricsData, error: metricsError } = await supabase.rpc('get_backup_metrics_stats', {
        p_days: 30
      });
      
      if (metricsError) throw metricsError;
      
      updateTestResult('metrics', { 
        status: 'success', 
        message: `✓ Métricas verificadas: ${metricsData?.[0]?.total_uploads || 0} uploads totales, ${metricsData?.[0]?.successful_uploads || 0} exitosos` 
      });
      toast.success('Test 4: Métricas verificadas');
    } catch (error: any) {
      updateTestResult('metrics', { 
        status: 'error', 
        message: `✗ Error verificando métricas: ${error.message}` 
      });
      toast.error('Test 4 falló');
    }

    // Test 5: Dashboard metrics
    try {
      updateTestResult('dashboard', { status: 'running', message: 'Cargando dashboard de métricas...' });
      
      const { data: dashData, error: dashError } = await supabase.rpc('get_backup_dashboard');
      
      if (dashError) throw dashError;
      
      if (dashData && dashData.length > 0) {
        setDashboardMetrics(dashData[0]);
        updateTestResult('dashboard', { 
          status: 'success', 
          message: `✓ Dashboard cargado: ${dashData[0].total_uploads} uploads, ${formatBytes(dashData[0].total_storage_used)} usado` 
        });
      } else {
        updateTestResult('dashboard', { 
          status: 'success', 
          message: '✓ Dashboard cargado (sin datos aún)' 
        });
      }
      toast.success('Test 5: Dashboard verificado');
    } catch (error: any) {
      updateTestResult('dashboard', { 
        status: 'error', 
        message: `✗ Error en dashboard: ${error.message}` 
      });
      toast.error('Test 5 falló');
    }

    setIsTestRunning(false);
    toast.success('Todas las pruebas completadas', {
      description: 'Revisa los resultados detallados abajo'
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'running':
        return <Activity className="h-5 w-5 text-warning animate-pulse" />;
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/app/backups')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Backups
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <TestTube2 className="h-8 w-8 text-primary" />
                <h1 className="text-4xl font-bold">Test de Sistema de Backup</h1>
              </div>
              <p className="text-muted-foreground">
                Prueba completa del sistema de backup chunked con métricas
              </p>
            </div>
            <Button
              onClick={runTests}
              disabled={isTestRunning || progress.status === 'uploading'}
              size="lg"
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {isTestRunning ? 'Ejecutando...' : 'Ejecutar Tests'}
            </Button>
          </div>
        </div>

        {/* Progress Card */}
        {progress.status === 'uploading' && (
          <BackupProgress 
            visible={true}
            progress={progress}
            metrics={metrics}
          />
        )}

        {/* Current Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Total Uploads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalUploads}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metrics.successfulUploads} exitosos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Velocidad Promedio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(metrics.averageSpeed)}/s</div>
              <p className="text-xs text-muted-foreground mt-1">
                Últimos 30 días
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Tasa de Éxito
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.totalUploads > 0 
                  ? Math.round((metrics.successfulUploads / metrics.totalUploads) * 100) 
                  : 0}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                De {metrics.totalUploads} intentos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Metrics */}
        {dashboardMetrics && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Dashboard Metrics</CardTitle>
              <CardDescription>Estadísticas globales del sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Uploads</div>
                  <div className="text-2xl font-bold">{dashboardMetrics.total_uploads}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Exitosos</div>
                  <div className="text-2xl font-bold">{dashboardMetrics.successful_uploads}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Almacenamiento Total</div>
                  <div className="text-2xl font-bold">{formatBytes(dashboardMetrics.total_storage_used)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Tamaño Promedio</div>
                  <div className="text-2xl font-bold">{formatBytes(dashboardMetrics.average_upload_size || 0)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Tiempo Promedio</div>
                  <div className="text-lg font-bold">
                    {dashboardMetrics.average_upload_time ? 
                      `${Math.round(parseFloat(dashboardMetrics.average_upload_time.split(':')[2]))}s` : 
                      'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Último Upload</div>
                  <div className="text-sm font-bold">
                    {dashboardMetrics.last_upload_date ? 
                      new Date(dashboardMetrics.last_upload_date).toLocaleString() : 
                      'N/A'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Results */}
        <Card>
          <CardHeader>
            <CardTitle>Resultados de las Pruebas</CardTitle>
            <CardDescription>
              Estado de cada prueba ejecutada
            </CardDescription>
          </CardHeader>
          <CardContent>
            {testResults.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Haz clic en "Ejecutar Tests" para comenzar las pruebas del sistema
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {testResults.map((result, index) => (
                  <div 
                    key={result.name}
                    className="flex items-start gap-3 p-4 border rounded-lg"
                  >
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">Test {index + 1}: {result.name}</span>
                        <Badge 
                          variant={
                            result.status === 'success' ? 'default' : 
                            result.status === 'error' ? 'destructive' : 
                            'secondary'
                          }
                        >
                          {result.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{result.message}</p>
                      {result.duration && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Duración: {result.duration}ms
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
