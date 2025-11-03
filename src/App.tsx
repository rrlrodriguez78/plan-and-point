import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./components/contexts/ThemeContext";
import { UserSettingsProvider } from "./contexts/UserSettingsContext";
import { TenantProvider } from "./contexts/TenantContext";
import { useOfflineRedirect } from "./hooks/useOfflineRedirect";
import { useAutoCleanup } from "./hooks/useAutoCleanup";
import { A11ySkipLink } from "./components/A11ySkipLink";
import { PWAUpdatePrompt } from "./components/PWAUpdatePrompt";
import { NetworkStatusBanner } from "./components/shared/NetworkStatusBanner";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Inicio from "./pages/Inicio";
import Dashboard from "./pages/Dashboard";
import PublicTours from "./pages/PublicTours";
import Editor from "./pages/Editor";
import PhotoEditor from "./pages/PhotoEditor";
import Viewer from "./pages/Viewer";
import SharedTour from "./pages/SharedTour";
import Settings from "./pages/Settings";
import UserSettings from "./pages/UserSettings";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import TenantAdmin from "./pages/TenantAdmin";
import TenantMembers from "./pages/TenantMembers";
import UserApprovals from "./pages/UserApprovals";
import FeatureManagement from "./pages/FeatureManagement";
import CompatibilityTest from "./pages/CompatibilityTest";
import CompatibilityReport from "./pages/CompatibilityReport";
import SwipeDemo from "./pages/SwipeDemo";
import PWASplashGenerator from "./pages/PWASplashGenerator";
import BackupsPage from "./pages/BackupsPage";
import AuthCallback from "./pages/AuthCallback";
import ThetaOfflineCapture from "./pages/ThetaOfflineCapture";
import OfflineCacheManager from "./pages/OfflineCacheManager";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Componente interno que usa el hook de redirección offline
const AppRoutes = () => {
  useOfflineRedirect();
  useAutoCleanup({ enabled: true, interval: 30 }); // Limpieza cada 30 min
  
  return (
    <main id="main-content">
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/signup" element={<Auth />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/share/:token" element={<SharedTour />} />
        <Route path="/viewer/:id" element={<Viewer />} />
        
        {/* Offline mode - No authentication required */}
        <Route path="/offline-theta" element={<ThetaOfflineCapture />} />
        
        {/* Protected routes */}
        <Route path="/app/inicio" element={<Inicio />} />
        <Route path="/app/tours" element={<Dashboard />} />
        <Route path="/app/tours-publicos" element={<PublicTours />} />
        <Route path="/app/editor/:id" element={<Editor />} />
        <Route path="/app/photo-editor/:id" element={<PhotoEditor />} />
        <Route path="/app/settings" element={<Settings />} />
        <Route path="/app/user-settings" element={<UserSettings />} />
        <Route path="/app/offline-cache" element={<OfflineCacheManager />} />
        <Route path="/app/super-admin" element={<SuperAdminDashboard />} />
        <Route path="/app/user-approvals" element={<UserApprovals />} />
        <Route path="/app/tenant-admin" element={<TenantAdmin />} />
        <Route path="/app/tenant-members" element={<TenantMembers />} />
        <Route path="/app/feature-management" element={<FeatureManagement />} />
        <Route path="/app/compatibility" element={<CompatibilityTest />} />
        <Route path="/app/compatibility-report" element={<CompatibilityReport />} />
        <Route path="/app/swipe-demo" element={<SwipeDemo />} />
        <Route path="/app/pwa-splash" element={<PWASplashGenerator />} />
        <Route path="/app/backups" element={<BackupsPage />} />
        
        {/* Catch-all route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <A11ySkipLink />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <TenantProvider>
              <UserSettingsProvider>
                <PWAUpdatePrompt />
                <NetworkStatusBanner />
                <AppRoutes />
              </UserSettingsProvider>
            </TenantProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
