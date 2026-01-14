import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, FileText, Trash2, Package } from 'lucide-react';
import { liveQuery } from 'dexie';
import { supabase, Notification } from '../lib/supabase';
import { db } from '../lib/db';
import { enqueueMutation } from '../lib/offlineQueue';

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let lastCount = 0;

    // Initial load from local DB
    const fetchInitial = async () => {
      try {
        const allNotifications = await db.notifications.toArray();
        const uncleared = allNotifications.filter(n => !n.cleared);
        const sorted = uncleared.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        console.log(`📢 Initial load: ${uncleared.length} uncleared notifications`);
        lastCount = uncleared.length;
        setNotifications(sorted as any);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching notifications:', err);
        setLoading(false);
      }
    };

    fetchInitial();

    // Use Dexie liveQuery to watch notifications in real-time
    const subscription = liveQuery(async () => {
      console.log('🔍 liveQuery triggered - fetching notifications');
      const allNotifications = await db.notifications.toArray();
      console.log(`📊 Total notifications in DB: ${allNotifications.length}`);
      const uncleared = allNotifications.filter(n => !n.cleared);
      console.log(`📢 Uncleared notifications: ${uncleared.length}`);
      // Sort by creation date (newest first)
      return uncleared.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }).subscribe({
      next: (result) => {
        console.log(`✅ liveQuery update received: ${result.length} notifications`);
        lastCount = result.length;
        setNotifications(result as any);
        setLoading(false);
      },
      error: (err) => {
        console.error('❌ liveQuery error:', err);
        setLoading(false);
      }
    });

    // FALLBACK: Poll every 1 second to ensure we catch all notifications
    // This is a safety net in case liveQuery misses updates
    const pollInterval = setInterval(async () => {
      try {
        const allNotifications = await db.notifications.toArray();
        const uncleared = allNotifications.filter(n => !n.cleared);
        const sorted = uncleared.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        // Only update if count changed
        if (uncleared.length !== lastCount) {
          console.log(`🔄 Poll detected change: ${sorted.length} notifications (was ${lastCount})`);
          lastCount = uncleared.length;
          setNotifications(sorted as any);
        }
      } catch (err) {
        console.debug('Poll error (non-critical):', err);
      }
    }, 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(pollInterval);
    };
  }, []);

  const clearNotification = async (id: string) => {
    try {
      // Update in LOCAL DB
      await db.notifications.update(id, { cleared: true });

      // Queue mutation to sync
      await enqueueMutation('notifications', 'UPDATE', id, { cleared: true });
      // liveQuery will automatically refresh the UI
    } catch (error) {
      console.error('Error clearing notification:', error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      // Get all uncleared notifications
      const allNotifications = await db.notifications.toArray();
      const uncleared = allNotifications.filter(n => !n.cleared);

      // Update all in LOCAL DB
      for (const notif of uncleared) {
        await db.notifications.update(notif.id, { cleared: true });
        // Queue mutation to sync
        await enqueueMutation('notifications', 'UPDATE', notif.id, { cleared: true });
      }
      // liveQuery will automatically refresh the UI
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'low_stock':
        return <AlertTriangle className="w-6 h-6 text-orange-500" />;
      case 'weekly_report':
      case 'monthly_report':
        return <FileText className="w-6 h-6 text-purple-500" />;
      default:
        return <Bell className="w-6 h-6 text-gray-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'low_stock':
        return 'bg-orange-50 border-orange-200';
      case 'weekly_report':
      case 'monthly_report':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500 mt-1">
            {notifications.length} unread notification(s)
          </p>
        </div>
        {notifications.length > 0 && (
          <button
            onClick={clearAllNotifications}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700"
          >
            <Trash2 className="w-5 h-5" />
            Clear All
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No notifications
          </h3>
          <p className="text-gray-500">
            You're all caught up! New notifications will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`${getNotificationColor(
                notification.type
              )} border rounded-xl p-4 transition-all hover:shadow-md`}
            >
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 capitalize">
                        {notification.type.replace('_', ' ')}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => clearNotification(notification.id)}
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                      title="Clear notification"
                    >
                      <Trash2 className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                  <p className="text-gray-700">{notification.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-purple-50 border border-purple-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Package className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">
              About Notifications
            </h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>
                <strong>Low Stock Alerts:</strong> Triggered when products reach 7 or
                fewer items
              </li>
              <li>
                <strong>Weekly Reports:</strong> Generated automatically every Saturday
                evening
              </li>
              <li>
                <strong>Monthly Reports:</strong> Generated on the last day of each
                month
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
