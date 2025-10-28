import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { BackupManager } from '@/components/backups/BackupManager';
import { BackupTester } from '@/components/backups/BackupTester';

const BackupsPage: React.FC = () => {
  const navigate = useNavigate();

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
        
        <BackupTester />
        <BackupManager />
      </div>
    </div>
  );
};

export default BackupsPage;
