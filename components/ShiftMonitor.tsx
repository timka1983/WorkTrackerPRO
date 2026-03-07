import React, { useEffect, useState, useRef } from 'react';
import { WorkLog, Organization, PositionConfig } from '../types';
import { calculateMinutes } from '../utils';
import { differenceInMinutes, parseISO, addMinutes } from 'date-fns';
import { Bell, AlertTriangle, Clock } from 'lucide-react';

interface ShiftMonitorProps {
  activeShift: WorkLog | null;
  organization: Organization | null;
  userPosition: PositionConfig | null;
  onForceClose: (logId: string, endTime: string) => void;
}

export const ShiftMonitor: React.FC<ShiftMonitorProps> = ({
  activeShift,
  organization,
  userPosition,
  onForceClose
}) => {
  const [status, setStatus] = useState<'normal' | 'warning' | 'critical' | 'expired'>('normal');
  const [message, setMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  // Refs to track notification state to prevent spam
  const notifiedStage1 = useRef<string | null>(null); // Max + 15
  const notifiedStage2 = useRef<string | null>(null); // Max + 20
  
  // Default max duration: 12 hours (720 mins)
  const maxDuration = userPosition?.permissions.maxShiftDurationMinutes || organization?.maxShiftDuration || 720;

  useEffect(() => {
    if (!activeShift || !activeShift.checkIn) {
      setStatus('normal');
      setMessage(null);
      return;
    }

    const checkShift = () => {
      const now = new Date();
      const startTime = parseISO(activeShift.checkIn!);
      const elapsed = differenceInMinutes(now, startTime);
      const remaining = maxDuration - elapsed;
      
      setTimeLeft(remaining);

      // Reset notifications if it's a new shift
      if (notifiedStage1.current !== activeShift.id) {
        notifiedStage1.current = null;
        notifiedStage2.current = null;
      }

      // Stage 3: Force Close (Max + 25m)
      if (elapsed >= maxDuration + 25) {
        setStatus('expired');
        setMessage('Смена принудительно завершена (превышен лимит времени)');
        // Trigger force close
        const forceEndTime = addMinutes(startTime, maxDuration).toISOString();
        onForceClose(activeShift.id, forceEndTime);
        return;
      }

      // Stage 2: Critical Warning (Max + 20m)
      if (elapsed >= maxDuration + 20) {
        setStatus('critical');
        setMessage('Смена будет закрыта через 5 минут! Подтвердите присутствие.');
        
        if (notifiedStage2.current !== activeShift.id) {
          // Send notification / Check location
          if (Notification.permission === 'granted') {
            new Notification('Внимание! Смена будет закрыта', {
              body: 'Вы превысили максимальное время смены на 20 минут.',
              icon: '/icon-192.png'
            });
          }
          // Here we would check location logic
          checkLocationAndClose(activeShift.id, startTime, maxDuration);
          notifiedStage2.current = activeShift.id;
        }
        return;
      }

      // Stage 1: Warning (Max + 15m)
      if (elapsed >= maxDuration + 15) {
        setStatus('warning');
        setMessage('Вы забыли закрыть смену? Проверка местоположения...');
        
        if (notifiedStage1.current !== activeShift.id) {
           if (Notification.permission === 'granted') {
            new Notification('Вы забыли закрыть смену?', {
              body: 'Прошло 15 минут после окончания смены.',
              icon: '/icon-192.png'
            });
          }
          checkLocationAndClose(activeShift.id, startTime, maxDuration);
          notifiedStage1.current = activeShift.id;
        }
        return;
      }

      setStatus('normal');
      setMessage(null);
    };

    const checkLocationAndClose = (shiftId: string, start: Date, max: number) => {
      if (!organization?.locationSettings?.enabled) return;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const targetLat = organization.locationSettings!.latitude;
          const targetLng = organization.locationSettings!.longitude;
          const radius = organization.locationSettings!.radius;
          
          const distance = getDistanceFromLatLonInM(latitude, longitude, targetLat, targetLng);
          
          if (distance > radius) {
            // User is far away, probably forgot to close
            const forceEndTime = addMinutes(start, max).toISOString();
            onForceClose(shiftId, forceEndTime);
            // Notify user
            if (Notification.permission === 'granted') {
               new Notification('Смена закрыта автоматически', {
                 body: 'Вы покинули рабочую зону.',
               });
            }
          }
        },
        (error) => {
          console.error("Geo error", error);
        }
      );
    };

    // Check every minute
    const interval = setInterval(checkShift, 60000);
    checkShift(); // Initial check

    return () => clearInterval(interval);
  }, [activeShift, maxDuration, organization, onForceClose]);

  // Helper for distance
  function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1); 
    var a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ; 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; // Distance in km
    return d * 1000; // Distance in m
  }

  function deg2rad(deg: number) {
    return deg * (Math.PI/180)
  }

  if (status === 'normal' || !message) return null;

  return (
    <div className={`fixed bottom-4 left-4 right-4 z-50 p-4 rounded-2xl shadow-2xl border-2 animate-bounce-slow flex items-center gap-4 ${
      status === 'critical' || status === 'expired' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'
    }`}>
      <div className={`p-3 rounded-xl ${status === 'critical' ? 'bg-red-100' : 'bg-amber-100'}`}>
        {status === 'critical' ? <AlertTriangle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
      </div>
      <div className="flex-1">
        <p className="font-bold text-sm">{message}</p>
        {timeLeft !== null && timeLeft < 0 && (
           <p className="text-xs opacity-75 mt-1">Превышение: {Math.abs(timeLeft)} мин</p>
        )}
      </div>
    </div>
  );
};
