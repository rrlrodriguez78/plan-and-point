import React from 'react';
import { BackupManager } from '@/components/backups/BackupManager';
import { BackupTester } from '@/components/backups/BackupTester';

const BackupsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <BackupTester />
      <BackupManager />
    </div>
  );
};

export default BackupsPage;
