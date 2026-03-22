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
  const autoShift = organization?.autoShiftCompletion;
  const firstInterval = autoShift?.enabled ? autoShift.firstAlertMinutes : 15;
  const secondInterval = autoShift?.enabled ? autoShift.secondAlertMinutes : 5;
  const thirdInterval = autoShift?.enabled ? autoShift.thirdAlertMinutes : 5;

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

      // Stage 3: Force Close (Max + first + second + third)
      if (elapsed >= maxDuration + firstInterval + secondInterval + thirdInterval) {
        if (autoShift?.enabled === true) {
          setStatus('expired');
          setMessage('Смена принудительно завершена (превышен лимит времени)');
          // Trigger force close
          const forceEndTime = addMinutes(startTime, maxDuration).toISOString();
          onForceClose(activeShift.id, forceEndTime);
          return;
        } else {
          setStatus('warning');
          setMessage('Смена превысила лимит времени. Пожалуйста, закройте смену.');
          return;
        }
      }

      // Stage 2: Critical Warning (Max + first + second)
      if (elapsed >= maxDuration + firstInterval + secondInterval) {
        if (autoShift?.enabled === true) {
          setStatus('critical');
          setMessage('Смена будет закрыта через ' + thirdInterval + ' минут! Подтвердите присутствие.');
        } else {
          setStatus('warning');
          setMessage('Смена превысила лимит времени. Пожалуйста, закройте смену.');
        }
        
        if (notifiedStage2.current !== activeShift.id) {
          // Send notification / Check location
          if (Notification.permission === 'granted') {
            new Notification(autoShift?.enabled === true ? 'Внимание! Смена будет закрыта' : 'Внимание! Смена превысила лимит', {
              body: 'Вы превысили максимальное время смены.',
              icon: '/icon-192.png'
            });
          }
          // Here we would check location logic
          if (autoShift?.enabled === true) {
            checkLocationAndClose(activeShift.id, startTime, maxDuration);
          }
          notifiedStage2.current = activeShift.id;
        }
        return;
      }

      // Stage 1: Warning (Max + first)
      if (elapsed >= maxDuration + firstInterval) {
        setStatus('warning');
        setMessage(autoShift?.enabled === true ? 'Вы забыли закрыть смену? Проверка местоположения...' : 'Вы забыли закрыть смену?');
        
        if (notifiedStage1.current !== activeShift.id) {
           if (Notification.permission === 'granted') {
            new Notification('Вы забыли закрыть смену?', {
              body: 'Прошло ' + firstInterval + ' минут после окончания смены.',
              icon: '/icon-192.png'
            });
          }
          if (autoShift?.enabled === true) {
            checkLocationAndClose(activeShift.id, startTime, maxDuration);
          }
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
  }, [activeShift, maxDuration, organization, onForceClose, firstInterval, secondInterval, thirdInterval]);

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
    <div className={`fixed bottom-4 left-4 right-4 z-50 p-4 rounded-2xl shadow-2xl dark:shadow-slate-900/40 border-2 animate-bounce-slow flex items-center gap-4 ${
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
