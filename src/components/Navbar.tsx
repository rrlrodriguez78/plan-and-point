import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MapPin, LogOut, Settings, Menu, Home, Globe, User, Sparkles, LayoutDashboard, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const Navbar = () => {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();
  const { isSuperAdmin } = useIsSuperAdmin();

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-2 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-1 sm:gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-base sm:text-xl truncate">VirtualTour</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-4">
          <LanguageSwitcher />
          {user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 sm:w-auto sm:px-4 p-0 sm:p-2">
                    <Menu className="w-4 h-4" />
                    <span className="hidden sm:inline sm:ml-2">{t('nav.pages')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-background z-50">
                  <DropdownMenuItem asChild>
                    <Link to="/" className="flex items-center cursor-pointer">
                      <Sparkles className="w-4 h-4 mr-2" />
                      {t('nav.home')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/app/inicio" className="flex items-center cursor-pointer">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      {t('nav.dashboard')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/app/crear-tour" className="flex items-center cursor-pointer">
                      <Plus className="w-4 h-4 mr-2" />
                      {t('nav.createTours')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/app/tours" className="flex items-center cursor-pointer">
                      <MapPin className="w-4 h-4 mr-2" />
                      {t('nav.tours')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/app/tours-publicos" className="flex items-center cursor-pointer">
                      <Globe className="w-4 h-4 mr-2" />
                      {t('nav.publicTours')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/app/user-settings" className="flex items-center cursor-pointer">
                      <User className="w-4 h-4 mr-2" />
                      My Settings
                    </Link>
                  </DropdownMenuItem>
                  {isSuperAdmin && (
                    <DropdownMenuItem asChild>
                      <Link to="/app/settings" className="flex items-center cursor-pointer">
                        <Settings className="w-4 h-4 mr-2" />
                        {t('nav.settings')}
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                variant="outline" 
                size="sm"
                onClick={signOut}
                className="h-9 w-9 sm:w-auto sm:px-4 p-0 sm:p-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline sm:ml-2">{t('nav.logout')}</span>
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="h-9 px-2 sm:px-4">
                  <span className="text-sm">{t('nav.login')}</span>
                </Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" className="h-9 px-2 sm:px-4">
                  <span className="text-sm">{t('nav.signup')}</span>
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};