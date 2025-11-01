import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, LogOut, CheckCircle } from 'lucide-react';

const GoogleDriveAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const scope = import.meta.env.VITE_GOOGLE_DRIVE_SCOPE;
  const redirectUri = window.location.origin + '/auth/callback';

  useEffect(() => {
    // Check if user is already authenticated
    const accessToken = localStorage.getItem('google_access_token');
    const userEmail = localStorage.getItem('google_user_email');
    
    if (accessToken && userEmail) {
      setIsAuthenticated(true);
      setUser({ email: userEmail });
    }
  }, []);

  // Iniciar flujo OAuth
  const handleLogin = () => {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

    window.location.href = authUrl;
  };

  // Cerrar sesión
  const handleLogout = () => {
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_refresh_token');
    localStorage.removeItem('google_user_email');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <img 
            src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" 
            alt="Google" 
            className="w-6 h-6"
          />
          Google Drive
        </CardTitle>
        <CardDescription>
          {isAuthenticated 
            ? 'Tu cuenta está conectada a Google Drive' 
            : 'Conecta tu cuenta de Google Drive para guardar backups automáticamente'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isAuthenticated ? (
          <Button 
            onClick={handleLogin}
            className="w-full"
            size="lg"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Conectar con Google Drive
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Conectado como: <strong>{user?.email}</strong></span>
            </div>
            <Button 
              onClick={handleLogout}
              variant="outline"
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Desconectar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GoogleDriveAuth;
