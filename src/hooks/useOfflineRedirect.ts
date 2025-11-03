import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook que redirige automáticamente a /offline-theta cuando:
 * - No hay conexión a internet
 * - El usuario no está autenticado
 * - No estamos ya en la ruta offline
 */
export function useOfflineRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    // No hacer nada mientras carga la autenticación
    if (loading) return;

    // No redirigir si ya estamos en modo offline
    if (location.pathname.startsWith('/offline-theta')) return;

    // No redirigir si el usuario está autenticado
    if (user) return;

    // Redirigir solo si NO hay internet
    if (!navigator.onLine) {
      console.log('Sin internet y sin autenticación, redirigiendo a modo offline');
      navigate('/offline-theta', { replace: true });
    }

    // Escuchar cambios en el estado de la red
    const handleOffline = () => {
      if (!user && !location.pathname.startsWith('/offline-theta')) {
        navigate('/offline-theta', { replace: true });
      }
    };

    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, loading, location.pathname, navigate]);
}
