import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useEmailLogs } from '@/hooks/useEmailLogs';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export const EmailActivityWidget = () => {
  const { t } = useTranslation();
  const { stats, loading } = useEmailLogs();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-warning" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'outline'> = {
      sent: 'default',
      failed: 'destructive',
      pending: 'outline',
    };
    return variants[status] || 'outline';
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
    <Card className="border-2 border-border bg-gradient-to-br from-card to-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-futuristic flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          {t('inicio.emailActivity')}
        </CardTitle>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span>{t('inicio.successRate')}: {stats.successRate}%</span>
          {stats.sentToday > 0 && (
            <span>+{stats.sentToday} {t('inicio.today')}</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            </div>
          ) : stats.recentLogs.length > 0 ? (
            <div className="space-y-2">
              {stats.recentLogs.slice(0, 5).map((log, index) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-3 rounded-lg border border-border/50 bg-background/50 hover:border-primary/50 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      {getStatusIcon(log.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium font-body-future capitalize">
                          {log.notification_type.replace('_', ' ')}
                        </p>
                        <Badge variant={getStatusBadge(log.status)} className="text-xs">
                          {log.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {log.email_address}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getTimeAgo(log.sent_at)}
                      </p>
                      {log.error_message && (
                        <p className="text-xs text-destructive mt-1 line-clamp-1">
                          {log.error_message}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Mail className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t('inicio.noEmails')}</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
