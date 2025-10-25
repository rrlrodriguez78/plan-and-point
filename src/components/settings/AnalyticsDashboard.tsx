import { useAnalytics } from '@/hooks/useAnalytics';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Eye, 
  Users, 
  TrendingUp, 
  BarChart3,
  Calendar,
  Clock
} from 'lucide-react';

export const AnalyticsDashboard = () => {
  const { tourAnalytics, summary, loading } = useAnalytics();

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  const stats = [
    {
      label: 'Total de Tours',
      value: summary.total_tours,
      icon: BarChart3,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      label: 'Vistas Totales',
      value: summary.total_views,
      icon: Eye,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      label: 'Visitantes Únicos',
      value: summary.total_unique_viewers,
      icon: Users,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      label: 'Vistas Hoy',
      value: summary.views_today,
      icon: Calendar,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-3xl font-bold">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Actividad Reciente</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-accent/50">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Esta Semana</span>
            </div>
            <p className="text-2xl font-bold">{summary.views_this_week}</p>
            <p className="text-sm text-muted-foreground">vistas</p>
          </div>
          
          <div className="p-4 rounded-lg bg-accent/50">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Este Mes</span>
            </div>
            <p className="text-2xl font-bold">{summary.views_this_month}</p>
            <p className="text-sm text-muted-foreground">vistas</p>
          </div>
          
          <div className="p-4 rounded-lg bg-accent/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Promedio Diario</span>
            </div>
            <p className="text-2xl font-bold">
              {summary.views_this_month > 0 ? Math.round(summary.views_this_month / 30) : 0}
            </p>
            <p className="text-sm text-muted-foreground">vistas</p>
          </div>
        </div>
      </Card>

      {/* Tour Analytics */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Analytics por Tour</h3>
        </div>

        {tourAnalytics.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">
              No hay datos de analytics todavía
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Las estadísticas aparecerán cuando alguien vea tus tours
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tourAnalytics.map((tour) => (
              <div
                key={tour.tour_id}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">{tour.tour_title}</h4>
                    {tour.recent_views > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {tour.recent_views} vistas recientes
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Vistas</span>
                    </div>
                    <p className="text-xl font-bold">{tour.total_views}</p>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Visitantes</span>
                    </div>
                    <p className="text-xl font-bold">{tour.unique_viewers}</p>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Tiempo Prom.</span>
                    </div>
                    <p className="text-xl font-bold">
                      {tour.avg_duration_seconds > 0 
                        ? `${Math.round(tour.avg_duration_seconds / 60)}m`
                        : '-'
                      }
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
