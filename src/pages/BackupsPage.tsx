import React from 'react';
import { BackupManager } from '@/components/backups/BackupManager';

const BackupsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <BackupManager />
    </div>
  );
};

export default BackupsPage;
