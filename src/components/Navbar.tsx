import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MapPin, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

export const Navbar = () => {
  const { user, signOut } = useAuth();
  const { t } = useTranslation();

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl">VirtualTour</span>
        </Link>

        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          {user ? (
            <>
              <Link to="/app/inicio">
                <Button variant="ghost">{t('nav.dashboard')}</Button>
              </Link>
              <Link to="/app/tours">
                <Button variant="ghost">{t('nav.tours')}</Button>
              </Link>
              <Link to="/app/tours-publicos">
                <Button variant="ghost">{t('nav.publicTours')}</Button>
              </Link>
              <Link to="/app/settings">
                <Button variant="ghost">
                  <Settings className="w-4 h-4 mr-2" />
                  {t('nav.settings')}
                </Button>
              </Link>
              <Button variant="outline" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                {t('nav.logout')}
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost">{t('nav.login')}</Button>
              </Link>
              <Link to="/signup">
                <Button>{t('nav.signup')}</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};