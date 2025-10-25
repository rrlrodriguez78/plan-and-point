import { useNotifications } from '@/hooks/useNotifications';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, CheckCheck, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export const NotificationsList = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id);
    
    if (notification.related_tour_id) {
      navigate(`/app/tours/${notification.related_tour_id}/view`);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Notificaciones</h3>
          {unreadCount > 0 && (
            <Badge variant="default" className="ml-2">
              {unreadCount} nuevas
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            className="text-sm"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No tienes notificaciones</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`
                p-4 rounded-lg border transition-colors cursor-pointer
                ${notification.read 
                  ? 'bg-background hover:bg-accent/50' 
                  : 'bg-accent/20 hover:bg-accent/30 border-primary/20'
                }
              `}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex items-start gap-3">
                <div className={`
                  p-2 rounded-full
                  ${notification.read ? 'bg-muted' : 'bg-primary/10'}
                `}>
                  {notification.type === 'new_view' ? (
                    <Eye className={`h-4 w-4 ${notification.read ? 'text-muted-foreground' : 'text-primary'}`} />
                  ) : (
                    <Bell className={`h-4 w-4 ${notification.read ? 'text-muted-foreground' : 'text-primary'}`} />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className={`font-medium text-sm ${!notification.read && 'text-primary'}`}>
                      {notification.title}
                    </h4>
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {notification.message}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: es
                    })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
