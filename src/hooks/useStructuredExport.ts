import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FloorPlanExport {
  floor_plan_id: string;
  floor_name: string;
  hotspot_count: number;
  photo_count: number;
  estimated_size_mb: number;
}

interface ExportJob {
  export_token: string;
  floor_plan_id: string;
  floor_name: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  download_url?: string;
  error_message?: string;
}

export function useStructuredExport() {
  const [estimating, setEstimating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);

  const estimateExport = async (tourId: string): Promise<FloorPlanExport[]> => {
    setEstimating(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-tour-structured', {
        body: { action: 'estimate', tour_id: tourId }
      });

      if (error) throw error;
      return data.floor_plans;
    } catch (error: any) {
      console.error('Estimate error:', error);
      toast.error(`Error al estimar: ${error.message}`);
      return [];
    } finally {
      setEstimating(false);
    }
  };

  const exportFloorPlans = async (
    tourId: string,
    selectedFloorPlanIds: string[],
    downloadMode: 'auto' | 'manual'
  ) => {
    setExporting(true);
    const jobs: ExportJob[] = [];

    try {
      for (const floorPlanId of selectedFloorPlanIds) {
        const { data, error } = await supabase.functions.invoke('export-tour-structured', {
          body: {
            action: 'export',
            tour_id: tourId,
            floor_plan_id: floorPlanId
          }
        });

        if (error) throw error;

        const job: ExportJob = {
          export_token: data.export_token,
          floor_plan_id: floorPlanId,
          floor_name: data.floor_name,
          status: 'processing',
          progress: 0
        };

        jobs.push(job);
      }

      setExportJobs(jobs);
      jobs.forEach(job => pollExportProgress(job.export_token, downloadMode));
      toast.success(`Iniciando exportación de ${jobs.length} plano(s)`);
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(`Error al exportar: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const pollExportProgress = async (exportToken: string, downloadMode: 'auto' | 'manual') => {
    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('export-tour-structured', {
          body: { action: 'status', export_token: exportToken }
        });

        if (error) throw error;

        const updatedJob: ExportJob = {
          export_token: data.export_token,
          floor_plan_id: data.floor_plan_id,
          floor_name: data.floor_name,
          status: data.status,
          progress: data.progress,
          download_url: data.download_url,
          error_message: data.error_message
        };

        setExportJobs(prev => 
          prev.map(job => job.export_token === exportToken ? updatedJob : job)
        );

        if (data.status === 'completed') {
          clearInterval(interval);
          
          if (downloadMode === 'auto' && data.download_url) {
            window.open(data.download_url, '_blank');
            toast.success(`${data.floor_name} descargado`);
          } else {
            toast.success(`${data.floor_name} listo para descargar`);
          }
        } else if (data.status === 'failed') {
          clearInterval(interval);
          toast.error(`Error en ${data.floor_name}: ${data.error_message}`);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);
  };

  const downloadExport = (exportToken: string) => {
    const job = exportJobs.find(j => j.export_token === exportToken);
    if (job?.download_url) {
      window.open(job.download_url, '_blank');
      toast.success(`Descargando ${job.floor_name}`);
    }
  };

  const downloadAllExports = () => {
    const completedJobs = exportJobs.filter(
      job => job.status === 'completed' && job.download_url
    );

    completedJobs.forEach((job, index) => {
      setTimeout(() => {
        window.open(job.download_url!, '_blank');
      }, index * 500);
    });
    
    toast.success('Descargando todos los archivos');
  };

  return {
    estimating,
    exporting,
    exportJobs,
    estimateExport,
    exportFloorPlans,
    downloadExport,
    downloadAllExports
  };
}
