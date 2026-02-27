import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/supabase';

export const useTimeSync = () => {
  const [offset, setOffset] = useState<number>(0);
  const [isSynced, setIsSynced] = useState(false);

  const syncTime = useCallback(async () => {
    try {
      const start = Date.now();
      const serverTimeIso = await db.getServerTime();
      const end = Date.now();
      const latency = (end - start) / 2;
      
      const serverTime = new Date(serverTimeIso).getTime();
      const clientTime = Date.now();
      
      // Calculate offset: serverTime = clientTime + offset
      // offset = serverTime - clientTime
      // Adjust for latency: serverTime (at request arrival) ~ serverTimeIso
      // We received it at `end`. So actual server time at `end` is serverTimeIso + latency?
      // No, serverTimeIso is the time at the server when it processed the request.
      // So at `end`, the server time is roughly serverTimeIso + latency.
      
      const estimatedServerTimeAtEnd = serverTime + latency;
      const calculatedOffset = estimatedServerTimeAtEnd - end;

      setOffset(calculatedOffset);
      setIsSynced(true);
      console.log('Time synced. Offset:', calculatedOffset, 'ms');
    } catch (e) {
      console.error('Time sync failed', e);
      // Fallback to 0 offset (client time)
      setOffset(0);
    }
  }, []);

  useEffect(() => {
    syncTime();
    // Re-sync every hour
    const interval = setInterval(syncTime, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [syncTime]);

  const getNow = useCallback(() => {
    return new Date(Date.now() + offset);
  }, [offset]);

  return { getNow, isSynced, offset };
};
