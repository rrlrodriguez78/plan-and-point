import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Check, RotateCcw } from 'lucide-react';
import { useComments } from '@/hooks/useComments';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

export const CommentsWidget = () => {
  const { t } = useTranslation();
  const { comments, unreadCount, loading, markAsRead, deleteAllComments } = useComments();
  const [hasNewComment, setHasNewComment] = useState(false);
  const previousCountRef = useRef(unreadCount);

  useEffect(() => {
    if (unreadCount > previousCountRef.current && previousCountRef.current !== 0) {
      setHasNewComment(true);
      setTimeout(() => setHasNewComment(false), 2000);
    }
    previousCountRef.current = unreadCount;
  }, [unreadCount]);

  const handleReset = () => {
    deleteAllComments();
    setHasNewComment(false);
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
    <Card className={`border-2 border-border bg-gradient-to-br from-card to-card/50 transition-all ${hasNewComment ? 'animate-pulse' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-futuristic flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            {t('inicio.recentComments')}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          {comments.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8 text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              {t('inicio.reset')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-2">
              {comments.slice(0, 5).map((comment, index) => (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-3 rounded-lg border transition-all ${
                    !comment.is_read
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-background/50 border-border/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      !comment.is_read ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium font-body-future">
                          {comment.commenter_name || t('inicio.anonymous')}
                        </p>
                        {!comment.is_read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(comment.id)}
                            className="h-6 text-xs"
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {comment.comment_text}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getTimeAgo(comment.created_at)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <MessageSquare className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t('inicio.noComments')}</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
