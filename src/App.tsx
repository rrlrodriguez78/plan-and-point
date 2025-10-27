import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./components/contexts/ThemeContext";
import { UserSettingsProvider } from "./contexts/UserSettingsContext";
import { TenantProvider } from "./contexts/TenantContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Inicio from "./pages/Inicio";
import Dashboard from "./pages/Dashboard";
import PublicTours from "./pages/PublicTours";
import Editor from "./pages/Editor";
import Viewer from "./pages/Viewer";
import SharedTour from "./pages/SharedTour";
import Settings from "./pages/Settings";
import UserSettings from "./pages/UserSettings";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import TenantAdmin from "./pages/TenantAdmin";
import TenantMembers from "./pages/TenantMembers";
import UserApprovals from "./pages/UserApprovals";
import Backups from "./pages/Backups";
import FeatureManagement from "./pages/FeatureManagement";
import CompatibilityTest from "./pages/CompatibilityTest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <TenantProvider>
              <UserSettingsProvider>
                <Routes>
                  {/* Public routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Auth />} />
                  <Route path="/signup" element={<Auth />} />
                  <Route path="/share/:token" element={<SharedTour />} />
                  <Route path="/viewer/:id" element={<Viewer />} />
                  
                  {/* Protected routes */}
                  <Route path="/app/inicio" element={<Inicio />} />
                  <Route path="/app/tours" element={<Dashboard />} />
                  <Route path="/app/tours-publicos" element={<PublicTours />} />
                  <Route path="/app/editor/:id" element={<Editor />} />
                  <Route path="/app/settings" element={<Settings />} />
                  <Route path="/app/user-settings" element={<UserSettings />} />
                  <Route path="/app/super-admin" element={<SuperAdminDashboard />} />
                  <Route path="/app/user-approvals" element={<UserApprovals />} />
                  <Route path="/app/backups" element={<Backups />} />
                  <Route path="/app/tenant-admin" element={<TenantAdmin />} />
                  <Route path="/app/tenant-members" element={<TenantMembers />} />
                  <Route path="/app/feature-management" element={<FeatureManagement />} />
                  <Route path="/app/compatibility" element={<CompatibilityTest />} />
                  
                  {/* Catch-all route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </UserSettingsProvider>
            </TenantProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
