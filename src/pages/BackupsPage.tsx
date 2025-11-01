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

  // Handle OAuth callback
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success === 'connected') {
      toast.success('Google Drive conectado exitosamente');
      // Clear the URL params
      setSearchParams({});
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
            <TabsTrigger value="backups">🗂️ Backups</TabsTrigger>
            <TabsTrigger value="settings">⚙️ Destination Settings</TabsTrigger>
            <TabsTrigger value="history">📜 Sync History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="backups" className="space-y-6">
            <BackupTester />
            <BackupManager />
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
