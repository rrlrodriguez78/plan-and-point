import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navbar } from '@/components/Navbar';

export default function CreateTour() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated
  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-12">
        {/* Página vacía - listo para agregar contenido */}
      </main>
    </div>
  );
}
