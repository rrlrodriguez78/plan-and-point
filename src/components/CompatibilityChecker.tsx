import { useState, useEffect } from 'react';
import { runCompatibilityCheck, CompatibilityReport } from '@/utils/compatibilityCheck';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

export const CompatibilityChecker = () => {
  const [report, setReport] = useState<CompatibilityReport | null>(null);
  const [loading, setLoading] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    try {
      const result = await runCompatibilityCheck();
      setReport(result);
    } catch (error) {
      console.error('Compatibility check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runCheck();
  }, []);

  if (!report && !loading) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const renderResults = (results: any[], title: string) => (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm">{title}</h3>
      {results.map((result, idx) => (
        <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
          <div className="flex items-center gap-2">
            {result.supported ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm">{result.feature}</span>
          </div>
          <span className="text-xs text-muted-foreground">{result.details}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Compatibility Check
              {report && (
                <Badge 
                  variant={report.overall.score >= 80 ? 'default' : report.overall.score >= 60 ? 'secondary' : 'destructive'}
                >
                  {report.overall.score}%
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {report 
                ? `${report.overall.supported}/${report.overall.total} features supported`
                : 'Checking compatibility...'}
            </CardDescription>
          </div>
          <Button 
            onClick={runCheck} 
            disabled={loading}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Running checks...</p>
            </div>
          </div>
        ) : report ? (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-6">
              {renderResults(report.web, '🌐 Web Browser')}
              <Separator />
              {renderResults(report.pwa, '📱 PWA Features')}
              <Separator />
              {renderResults(report.mobile, '📲 Mobile')}
              <Separator />
              {renderResults(report.accessibility, '♿ Accessibility')}
              <Separator />
              {renderResults(report.performance, '⚡ Performance')}
              
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">Note:</p>
                    <p className="text-muted-foreground">
                      Performance metrics (LCP, FID, CLS) are measured after page load. 
                      Refresh for updated values. Some features may require user interaction to measure accurately.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </CardContent>
    </Card>
  );
};
