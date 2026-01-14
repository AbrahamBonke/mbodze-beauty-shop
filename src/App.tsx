import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import Auth from './components/Auth';
import SplashScreen from './components/SplashScreen';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import Sales from './components/Sales';
import Reports from './components/Reports';
import Notifications from './components/Notifications';import Settings from './components/Settings';import { supabase } from './lib/supabase';
import { db } from './lib/db';
import { watchOnlineStatus } from './lib/sync';
import './lib/debugUtils'; // Make debug utilities available in console

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [notificationCount, setNotificationCount] = useState(0);
  const [showSplash, setShowSplash] = useState(true);

  // Show splash screen for 5 seconds on initial load
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Reset to dashboard when user logs in
  useEffect(() => {
    if (user) {
      setCurrentPage('dashboard');
    }
  }, [user]);

  const fetchNotificationCount = async () => {
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('cleared', false);

      setNotificationCount(count || 0);
    } catch (error) {
      // If offline or network error, fall back to local DB silently
      if (!navigator.onLine || (error as any)?.code === 'PGRST205' || (error as any)?.message?.includes('Could not find the table')) {
        try {
          const localCount = await db.notifications.filter((n) => !n.cleared).count();
          setNotificationCount(localCount || 0);
          return;
        } catch (e) {
          console.debug('Error reading local notifications count:', e);
        }
      }
      // Only log network errors at debug level to avoid cluttering console
      console.debug('Error fetching notification count:', error);
    }
  };
  // Auto-sync when device comes online
  useEffect(() => {
    const unsubscribe = watchOnlineStatus();
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!user) return;

    fetchNotificationCount();

    // Only subscribe to realtime notifications if online and remote table exists
    if (!navigator.onLine) {
      console.debug('📴 Offline - skipping realtime subscription');
      return;
    }

    (async () => {
      try {
        const { error: headErr } = await supabase.from('notifications').select('*', { head: true });
        if (headErr && ((headErr as any)?.code === 'PGRST205' || (headErr as any)?.message?.includes('Could not find the table'))) {
          console.warn('⚠️ Remote notifications table missing — skipping realtime subscription');
          return;
        }

        const subscription = supabase
          .channel('notifications_count')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notifications' },
            () => {
              fetchNotificationCount();
            }
          )
          .subscribe();

        // Cleanup
        return () => subscription.unsubscribe();
      } catch (err) {
        console.debug('Could not create notifications subscription:', err);
      }
    })();
  }, [user]);

  // Show splash screen while it's enabled
  if (showSplash) {
    return <SplashScreen />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <Products />;
      case 'sales':
        return <Sales />;
      case 'reports':
        return <Reports />;
      case 'notifications':
        return <Notifications />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout
      currentPage={currentPage}
      onPageChange={setCurrentPage}
      notificationCount={notificationCount}
    >
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
