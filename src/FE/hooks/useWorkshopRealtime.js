import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useWorkshopRealtime({ workshopId, onWorkshopUpdate, onListUpdate }) {
  const [realtimeAvailable, setRealtimeAvailable] = useState(false);
  const reconnectTimerRef = useRef(null);

  useEffect(() => {
    if (!supabase) return undefined;

    const channelName = workshopId ? `workshop-${workshopId}` : 'workshops-list';
    const filter = workshopId ? `id=eq.${workshopId}` : undefined;

    const channel = supabase.channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workshops',
          filter,
        },
        (payload) => {
          setRealtimeAvailable(true);
          if (typeof onWorkshopUpdate === 'function' && payload.new) {
            onWorkshopUpdate(payload.new);
          }
          if (typeof onListUpdate === 'function') {
            onListUpdate(payload);
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeAvailable(true);
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtimeAvailable(false);
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
          }
          reconnectTimerRef.current = setTimeout(() => {
            channel.subscribe();
          }, 2000);
        }
      });

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [workshopId, onListUpdate, onWorkshopUpdate]);

  return { realtimeAvailable };
}
