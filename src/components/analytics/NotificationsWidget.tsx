import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, Check, Eye, MessageSquare, Mail, RotateCcw } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

export const NotificationsWidget = () => {
  const { t } = useTranslation();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteAllNotifications } = useNotifications();
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const previousCountRef = useRef(unreadCount);

  useEffect(() => {
    if (unreadCount > previousCountRef.current && previousCountRef.current !== 0) {
      setHasNewNotification(true);
      setTimeout(() => setHasNewNotification(false), 2000);
    }
    previousCountRef.current = unreadCount;
  }, [unreadCount]);

  const handleReset = () => {
    deleteAllNotifications();
    setHasNewNotification(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'new_view':
        return <Eye className="w-4 h-4" />;
      case 'new_comment':
        return <MessageSquare className="w-4 h-4" />;
      case 'email_sent':
        return <Mail className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return t('inicio.justNow');
    if (seconds < 3600) return `${Math.floor(seconds / 60)}${t('inicio.minutesAgo')}`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}${t('inicio.hoursAgo')}`;
    return `${Math.floor(seconds / 86400)}${t('inicio.daysAgo')}`;
  };

  return (
    <Card className={`border-2 border-border bg-gradient-to-br from-card to-card/50 transition-all ${hasNewNotification ? 'animate-pulse' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-futuristic flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            {t('inicio.notifications')}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="h-8 text-xs"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  {t('inicio.reset')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="h-8 text-xs"
                >
                  <Check className="w-3 h-3 mr-1" />
                  {t('inicio.markAllRead')}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            </div>
          ) : notifications.length > 0 ? (
            <div className="space-y-2">
              {notifications.slice(0, 5).map((notification, index) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50 ${
                    !notification.read
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-background/50 border-border/50'
                  }`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      !notification.read ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium font-body-future truncate">
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getTimeAgo(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Bell className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t('inicio.noNotifications')}</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
