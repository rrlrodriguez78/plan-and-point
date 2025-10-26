import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./components/contexts/ThemeContext";
import { UserSettingsProvider } from "./contexts/UserSettingsContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Inicio from "./pages/Inicio";
import Dashboard from "./pages/Dashboard";
import PublicTours from "./pages/PublicTours";
import CreateTour from "./pages/CreateTour";
import Editor from "./pages/Editor";
import Viewer from "./pages/Viewer";
import Settings from "./pages/Settings";
import UserSettings from "./pages/UserSettings";
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
            <UserSettingsProvider>
              <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/signup" element={<Auth />} />
              <Route path="/app/inicio" element={<Inicio />} />
              <Route path="/app/crear-tour" element={<CreateTour />} />
              <Route path="/app/tours" element={<Dashboard />} />
              <Route path="/app/tours-publicos" element={<PublicTours />} />
              <Route path="/app/editor/:id" element={<Editor />} />
              <Route path="/app/settings" element={<Settings />} />
              <Route path="/app/user-settings" element={<UserSettings />} />
              <Route path="/viewer/:id" element={<Viewer />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </UserSettingsProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
