import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const BackupTester: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      console.log('🔄 Starting connection test...');
      
      // Test 1: Basic Supabase connection
      console.log('1. Testing Supabase auth...');
      const { data: userData, error: userError } = await supabase.auth.getUser();
      console.log('User auth result:', { user: userData?.user?.id, error: userError });
      
      // Test 2: Database access
      console.log('2. Testing database access...');
      const { data: tours, error: dbError } = await supabase
        .from('virtual_tours')
        .select('id, title')
        .limit(1);
      console.log('Database test result:', { tours: tours?.length, error: dbError });

      // Test 3: Edge function invocation
      console.log('3. Testing edge function...');
      
      // Get a real tour ID for testing
      const tourId = tours?.[0]?.id;
      if (!tourId) {
        throw new Error('No tours found for testing');
      }

      console.log('Using tour ID for test:', tourId);
      
      const { data, error: functionError } = await supabase.functions.invoke('backup-processor', {
        body: { 
          action: 'start',
          tourId: tourId,
          backupType: 'full_backup'
        }
      });

      console.log('Edge function response:', { data, error: functionError });

      setResult({
        userAuth: { user: userData?.user?.id, error: userError },
        database: { toursCount: tours?.length, error: dbError },
        edgeFunction: { data, error: functionError }
      });

      if (functionError) {
        throw new Error(`Edge function error: ${functionError.message}`);
      }

    } catch (err: any) {
      console.error('❌ Test failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Backup System Connection Test</CardTitle>
        <CardDescription>
          Test the connection between frontend and backup services
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testConnection} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Testing...' : 'Run Connection Test'}
        </Button>

        {error && (
          <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-md">
            <h4 className="font-semibold text-destructive">Error</h4>
            <p className="text-destructive text-sm mt-1">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="p-3 border border-green-500/50 bg-green-500/10 rounded-md">
              <h4 className="font-semibold text-green-700 dark:text-green-400">Test Results</h4>
              
              <div className="mt-2 space-y-2 text-sm">
                <div>
                  <strong>User Authentication:</strong>{' '}
                  {result.userAuth.error ? '❌ Failed' : '✅ Success'}
                  {result.userAuth.user && ` (User: ${result.userAuth.user})`}
                </div>
                
                <div>
                  <strong>Database Access:</strong>{' '}
                  {result.database.error ? '❌ Failed' : '✅ Success'}
                  {result.database.toursCount !== undefined && ` (${result.database.toursCount} tours)`}
                </div>
                
                <div>
                  <strong>Edge Function:</strong>{' '}
                  {result.edgeFunction.error ? '❌ Failed' : '✅ Success'}
                  {result.edgeFunction.data && ` (Backup ID: ${result.edgeFunction.data.backupId})`}
                </div>
              </div>
            </div>

            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Raw Response Data
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded overflow-auto text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p><strong>Expected Flow:</strong></p>
          <ol className="list-decimal list-inside mt-1 space-y-1">
            <li>User authentication check</li>
            <li>Database access test</li>
            <li>Edge function invocation</li>
            <li>Backup job creation</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};
