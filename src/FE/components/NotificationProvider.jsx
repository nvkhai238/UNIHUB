import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import api from '../api/api';
import { getCurrentUser } from '../router/jwtUtils';

const NotificationContext = createContext({});

export const useNotificationContext = () => useContext(NotificationContext);

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null);
  const currentUser = getCurrentUser();

  // Load initial unread count
  useEffect(() => {
    if (!currentUser) return;
    api.get('/api/notifications/unread-count')
      .then(({ data }) => {
        setUnreadCount(data.data ?? 0);
      })
      .catch(console.error);
  }, [currentUser]);

  // Listen to Supabase Realtime
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase.channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const newNotif = payload.new;
          setUnreadCount(prev => prev + 1);
          setToast({
            id: newNotif.id,
            title: newNotif.title,
            body: newNotif.body,
          });

          // Auto hide toast after 5s
          setTimeout(() => setToast(null), 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  const value = {
    unreadCount,
    setUnreadCount,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Global Toast UI */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex max-w-sm w-full transform flex-col gap-2 rounded-xl bg-white p-4 shadow-xl ring-1 ring-black/5 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-lg">
                🔔
              </span>
            </div>
            <div className="flex-1 pt-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">{toast.body}</p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="ml-4 flex-shrink-0 inline-flex text-gray-400 hover:text-gray-500"
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}
