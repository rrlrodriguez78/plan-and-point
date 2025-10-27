import { CompatibilityChecker } from '@/components/CompatibilityChecker';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CompatibilityTest = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">System Compatibility Test</h1>
            <p className="text-muted-foreground">
              Verify web, PWA, mobile, accessibility, and performance compatibility
            </p>
          </div>
        </div>

        <CompatibilityChecker />

        <div className="mt-8 p-6 bg-muted/50 rounded-lg space-y-4">
          <h2 className="text-xl font-semibold">Testing Categories</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <h3 className="font-semibold mb-2">🌐 Web Browsers</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Chrome</li>
                <li>• Firefox</li>
                <li>• Safari</li>
                <li>• Edge</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">📱 PWA Features</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Service Worker</li>
                <li>• Manifest</li>
                <li>• Offline Support</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">📲 Mobile</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Touch Events</li>
                <li>• Viewport</li>
                <li>• Orientation</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">♿ Accessibility</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Screen Readers</li>
                <li>• Keyboard Navigation</li>
                <li>• ARIA Labels</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">⚡ Performance</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• LCP (Largest Contentful Paint)</li>
                <li>• FID (First Input Delay)</li>
                <li>• CLS (Cumulative Layout Shift)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompatibilityTest;
