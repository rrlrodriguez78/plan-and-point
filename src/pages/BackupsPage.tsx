import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { BackupManager } from '@/components/backups/BackupManager';
import { BackupTester } from '@/components/backups/BackupTester';
import BackupSettings from '@/components/backups/BackupSettings';
import { BackupSyncHistory } from '@/components/backups/BackupSyncHistory';
import { TourBackupConfig } from '@/components/backups/TourBackupConfig';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BackupsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tenantId, setTenantId] = useState<string>('');

  useEffect(() => {
    const loadTenant = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.rpc('get_user_tenants', { _user_id: user.id });
        if (data && data.length > 0) {
          setTenantId(data[0].tenant_id);
        }
      }
    };
    loadTenant();
  }, []);

  // Handle OAuth callback from redirect
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'connected' || success === 'reconnected') {
      const message = success === 'reconnected' 
        ? 'Conexión restablecida exitosamente' 
        : 'Google Drive conectado exitosamente';
      toast.success(message);
      // Clear the URL params
      setSearchParams({});
      
      // Force reload to show updated data
      window.location.reload();
    } else if (error) {
      toast.error(`Error al conectar: ${error}`);
      // Clear the URL params
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">Backups</h1>
        </div>
        
        <Tabs defaultValue="backups" className="space-y-6">
          <TabsList>
            <TabsTrigger value="backups">🗂️ Backups Manuales</TabsTrigger>
            <TabsTrigger value="auto-config">🔄 Backup Automático</TabsTrigger>
            <TabsTrigger value="settings">⚙️ Destination Settings</TabsTrigger>
            <TabsTrigger value="history">📜 Sync History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="backups" className="space-y-6">
            <BackupTester />
            <BackupManager />
          </TabsContent>
          
          <TabsContent value="auto-config">
            {tenantId && <TourBackupConfig tenantId={tenantId} />}
          </TabsContent>
          
          <TabsContent value="settings">
            {tenantId && <BackupSettings tenantId={tenantId} />}
          </TabsContent>
          
          <TabsContent value="history">
            {tenantId && <BackupSyncHistory tenantId={tenantId} />}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BackupsPage;
