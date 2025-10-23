import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { MapPin, Layout, Eye, Zap } from 'lucide-react';
import heroImage from '@/assets/hero-bg.jpg';

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0" style={{ background: 'var(--gradient-hero)', opacity: 0.05 }} />
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              Crea Tours Virtuales Interactivos
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Transforma planos de planta en experiencias inmersivas con hotspots 360°. 
              Perfecto para bienes raíces, eventos y espacios comerciales.
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/signup">
                <Button size="lg" className="text-lg px-8">
                  Comenzar Gratis
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Ver Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-16">
            Funcionalidades Destacadas
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Layout className="w-8 h-8" />}
              title="Editor Visual"
              description="Interfaz drag & drop intuitiva para crear tours sin esfuerzo"
            />
            <FeatureCard
              icon={<MapPin className="w-8 h-8" />}
              title="Hotspots 360°"
              description="Agrega puntos interactivos con imágenes panorámicas"
            />
            <FeatureCard
              icon={<Eye className="w-8 h-8" />}
              title="Vista Pública"
              description="Comparte tours con un simple enlace, sin registro"
            />
            <FeatureCard
              icon={<Zap className="w-8 h-8" />}
              title="Auto-Save"
              description="Guarda automáticamente mientras trabajas"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center p-12 rounded-2xl" 
               style={{ background: 'var(--gradient-card)', boxShadow: 'var(--shadow-elevated)' }}>
            <h2 className="text-4xl font-bold mb-4">
              ¿Listo para crear tu primer tour virtual?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Únete a profesionales que confían en VirtualTour para mostrar sus espacios
            </p>
            <Link to="/signup">
              <Button size="lg" className="text-lg px-12">
                Crear Cuenta Ahora
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 VirtualTour. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => {
  return (
    <div className="p-6 rounded-xl bg-card border border-border hover:shadow-lg transition-all duration-300 hover:scale-105">
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 text-primary">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};

export default Landing;