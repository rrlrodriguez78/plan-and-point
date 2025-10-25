import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Audio notification management using HTMLAudioElement
const playNotificationSound = () => {
  const soundEnabled = localStorage.getItem('notificationSoundEnabled') !== 'false';
  if (!soundEnabled) return;

  try {
    // Crear elemento de audio simple - funciona sin user gesture
    const audio = new Audio();
    
    // Usar data URI para sonido básico (evita CORS)
    audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Dyvm0lCjF8y/LMeSsFJHfH8N2QQAoUXrTp66hVFApGn+Dyvm0lCjF8y/LMeSsFJHfH8N2QQAoUXrTp66hVFApGn+Dyvm0lCjF8y/LMeSsFJHfH8N2QQAoUXrTp66hVFApGn+Dyvm0lCjF8y/LMeSsFJHfH8N2QQAo=';
    audio.volume = 0.3;
    
    // Reproducir y manejar errores silenciosamente
    audio.play().catch(() => {
      // Ignorar errores de reproducción (usuarios con audio deshabilitado)
    });
  } catch (error) {
    // Fallback silencioso
    console.log('Audio not available');
  }
};

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  related_tour_id: string | null;
  related_user_id: string | null;
  metadata: any;
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount(data?.filter(n => !n.read).length || 0);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteAllNotifications = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error deleting notifications:', error);
    }
  };

  useEffect(() => {
    loadNotifications();

    // Subscribe to realtime notifications
    if (user) {
      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            setNotifications(prev => [payload.new as Notification, ...prev]);
            setUnreadCount(prev => prev + 1);
            
            // Play notification sound
            playNotificationSound();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteAllNotifications,
    refresh: loadNotifications
  };
};
