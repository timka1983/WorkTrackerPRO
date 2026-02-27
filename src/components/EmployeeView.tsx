
import React, { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react';
import { WorkLog, User, EntryType, Machine, PositionConfig, PlanLimits, Organization } from '../../types';
import { formatTime, formatDate, formatDuration, calculateMinutes, getDaysInMonthArray, formatDurationShort, sendNotification } from '../../utils';
import { STORAGE_KEYS, DEFAULT_PERMISSIONS } from '../../constants';
import { format, isAfter, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, startOfMonth } from 'date-fns';
import { startOfDay } from 'date-fns/startOfDay';
import { ru } from 'date-fns/locale/ru';
import { db } from '../../lib/supabase';

// Sub-components
import EmployeeStats from './employee/EmployeeStats';
import EmployeeMatrix from './employee/EmployeeMatrix';
import ShiftControl from './employee/ShiftControl';
import EmployeeHeader from './employee/EmployeeHeader';
import PinChangeModal from './employee/PinChangeModal';
import CameraModal from './employee/CameraModal';
import EmployeePrintView from './employee/EmployeePrintView';

interface EmployeeViewProps {
  user: User;
  logs: WorkLog[];
  onLogsUpsert: (logs: WorkLog[]) => void;
  activeShifts: Record<number, WorkLog | null>;
  onActiveShiftsUpdate: (shifts: Record<number, WorkLog | null>) => void;
  onOvertime?: (user: User, slot: number) => void;
  machines: Machine[];
  positions: PositionConfig[];
  onUpdateUser: (user: User) => void;
  nightShiftBonusMinutes: number;
  onRefresh?: () => Promise<void>;
  planLimits: PlanLimits;
  currentOrg: Organization | null;
  onMonthChange?: (month: string) => void;
}

const EmployeeView: React.FC<EmployeeViewProps> = ({ 
  user, logs, onLogsUpsert, activeShifts, onActiveShiftsUpdate, onOvertime, machines, positions, onUpdateUser, nightShiftBonusMinutes, onRefresh, planLimits, currentOrg, onMonthChange
}) => {
  const orgId = localStorage.getItem(STORAGE_KEYS.ORG_ID) || 'demo_org';

  const perms = useMemo(() => {
    const config = positions.find(p => p.name === user.position);
    return config?.permissions || DEFAULT_PERMISSIONS;
  }, [user.position, positions]);

  const [overtimeAlerts, setOvertimeAlerts] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const checkOvertime = () => {
      if (!perms.maxShiftDurationMinutes || !planLimits.features.advancedAnalytics) return;

      const now = new Date();
      const updatedAlerts = { ...overtimeAlerts };
      let changed = false;

      Object.entries(activeShifts).forEach(([slot, shift]) => {
        if (shift && shift.checkIn) {
          const duration = calculateMinutes(shift.checkIn, now.toISOString());
          const limitWithBuffer = perms.maxShiftDurationMinutes! + 15;
          
          if (duration > limitWithBuffer && !overtimeAlerts[Number(slot)]) {
            updatedAlerts[Number(slot)] = true;
            changed = true;
            if (onOvertime) onOvertime(user, Number(slot));
            sendNotification('Смена не завершена', `Вы работаете уже более ${Math.floor(limitWithBuffer / 60)} часов. Не забудьте завершить смену!`);
          } else if (duration <= limitWithBuffer && overtimeAlerts[Number(slot)]) {
            updatedAlerts[Number(slot)] = false;
            changed = true;
          }
        }
      });

      if (changed) {
        setOvertimeAlerts(updatedAlerts);
      }
    };

    const interval = setInterval(checkOvertime, 60000);
    checkOvertime();
    return () => clearInterval(interval);
  }, [activeShifts, perms.maxShiftDurationMinutes, overtimeAlerts, planLimits, user, onOvertime]);

  const [slotMachineIds, setSlotMachineIds] = useState<Record<number, string>>({ 1: '', 2: '', 3: '' });

  useEffect(() => {
    if (machines.length > 0) {
      setSlotMachineIds(prev => {
        const next = { ...prev };
        let changed = false;
        
        [1, 2, 3].forEach((slot) => {
          if (!next[slot] || !machines.find(m => m.id === next[slot])) {
            const usedInOtherSlots = Object.entries(next)
              .filter(([s]) => parseInt(s) !== slot)
              .map(([, id]) => id);
            
            const firstAvailable = machines.find(m => 
              !usedInOtherSlots.includes(m.id) && 
              !busyMachineIds.includes(m.id)
            );
            if (firstAvailable) {
              next[slot] = firstAvailable.id;
              changed = true;
            }
          }
        });
        
        return changed ? next : prev;
      });
    }
  }, [machines]);

  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().substring(0, 7));
  const [viewMode, setViewMode] = useState<'control' | 'matrix'>('control');
  
  const shiftCounts = useMemo(() => {
    const counts = { 'Р': 0, 'В': 0, 'Д': 0, 'О': 0, 'Н': 0 };
    if (!user.plannedShifts) return counts;
    
    Object.entries(user.plannedShifts).forEach(([date, val]) => {
      if (date.startsWith(filterMonth)) {
        if (val in counts) {
          counts[val as keyof typeof counts]++;
        }
      }
    });
    return counts;
  }, [user.plannedShifts, filterMonth]);

  const [showCamera, setShowCamera] = useState<{ slot: number; type: 'start' | 'stop' } | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  
  const [showPinChange, setShowPinChange] = useState(user.forcePinChange || false);
  const [pinState, setPinState] = useState({ old: '', new: '', confirm: '' });
  const [pinError, setPinError] = useState('');

  const [isNightModeGlobal, setIsNightModeGlobal] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isAnyNightShiftActive = useMemo(() => {
    return Object.values(activeShifts).some(s => s !== null && (s as WorkLog).isNightShift);
  }, [activeShifts]);

  const busyMachineIds = useMemo(() => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return logs
      .filter(l => l.entryType === EntryType.WORK && !l.checkOut && l.checkIn && l.checkIn > dayAgo)
      .map(l => l.machineId)
      .filter((id): id is string => !!id);
  }, [logs]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isAbsentToday = useMemo(() => {
    return logs.some(l => l.userId === user.id && l.date === todayStr && l.entryType !== EntryType.WORK);
  }, [logs, user.id, todayStr]);

  const todayLogs = useMemo(() => {
    return logs.filter(l => l.userId === user.id && l.date === todayStr).sort((a, b) => {
      const timeA = a.checkIn ? new Date(a.checkIn).getTime() : 0;
      const timeB = b.checkIn ? new Date(b.checkIn).getTime() : 0;
      return timeB - timeA;
    });
  }, [logs, user.id, todayStr]);

  const isAnyShiftActiveInLogs = useMemo(() => {
    if (perms.multiSlot) return false;
    return logs.some(l => l.userId === user.id && l.entryType === EntryType.WORK && !l.checkOut);
  }, [logs, user.id, perms.multiSlot]);

  useEffect(() => {
    const hasAnyNight = Object.values(activeShifts).some(s => s && (s as WorkLog).isNightShift);
    if (hasAnyNight) setIsNightModeGlobal(true);
  }, [activeShifts]);

  useEffect(() => {
    if (showCamera) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(err => {
          console.error("Camera error:", err);
          alert("Камера недоступна. Проверьте разрешения.");
          setShowCamera(null);
        });
    }
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showCamera]);

  const capturePhoto = (): string => {
    if (!videoRef.current) return '';
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.5);
  };

  const processAction = async (slot: number, type: 'start' | 'stop') => {
    if (type === 'start') {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }

    if (type === 'start' && perms.useMachines) {
      const selectedMachineId = slotMachineIds[slot];
      if (!selectedMachineId) {
        alert("Пожалуйста, выберите оборудование перед началом смены!");
        return;
      }
      if (busyMachineIds.includes(selectedMachineId)) {
        alert("Это оборудование уже занято другим сотрудником!");
        return;
      }
    }

    const activeCount = Object.values(activeShifts).filter(s => s !== null).length;
    const requirePhoto = user.requirePhoto || perms.defaultRequirePhoto;
    
    if (requirePhoto) {
      if (type === 'start') {
        if (activeCount === 0) setShowCamera({ slot, type });
        else handleStartWork(slot);
      } else {
        if (activeCount === 1) setShowCamera({ slot, type });
        else handleStopWork(slot);
      }
    } else {
      type === 'start' ? handleStartWork(slot) : handleStopWork(slot);
    }
  };

  const handleStartWork = (slot: number, photo?: string) => {
    const selectedMachineId = perms.useMachines ? slotMachineIds[slot] : undefined;
    if (selectedMachineId && busyMachineIds.includes(selectedMachineId)) {
       alert("Ошибка: Оборудование уже было занято кем-то другим!");
       return;
    }

    const now = new Date();
    const dateStr = format(now, 'yyyy-MM-dd');
    const newShift: WorkLog = {
      id: `shift-${user.id}-${Date.now()}-${slot}`,
      userId: user.id,
      organizationId: orgId,
      date: dateStr,
      entryType: EntryType.WORK,
      machineId: selectedMachineId,
      checkIn: now.toISOString(),
      checkOut: null as any,
      durationMinutes: 0,
      photoIn: photo,
      isNightShift: isNightModeGlobal
    };
    
    const nextShifts = { ...activeShifts, [slot]: newShift };
    onActiveShiftsUpdate(nextShifts);
    onLogsUpsert([newShift]);
    setShowCamera(null);
  };

  const handleStopWork = (slot: number, photo?: string) => {
    const currentShift = activeShifts[slot];
    if (!currentShift) return;
    
    const now = new Date();
    let duration = calculateMinutes(currentShift.checkIn!, now.toISOString());
    
    if (currentShift.isNightShift) {
      duration += nightShiftBonusMinutes;
    }

    const completed: WorkLog = { 
      ...currentShift, 
      checkOut: now.toISOString(), 
      durationMinutes: Math.max(0, duration),
      photoOut: photo
    };
    
    const nextShifts = { ...activeShifts, [slot]: null };
    onActiveShiftsUpdate(nextShifts);
    onLogsUpsert([completed]);
    setShowCamera(null);
  };

  const handleMarkAbsence = (type: EntryType) => {
    const typeNames = {
      [EntryType.DAY_OFF]: 'Выходной',
      [EntryType.SICK]: 'Больничный',
      [EntryType.VACATION]: 'Отпуск',
      [EntryType.WORK]: 'Рабочая смена'
    };

    if (!confirm(`Вы действительно хотите отметить сегодняшний день как "${typeNames[type]}"? Это действие нельзя будет отменить самостоятельно.`)) {
      return;
    }

    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const exists = logs.find(l => l.date === dateStr && l.userId === user.id);
    if (exists) {
      alert("На этот день уже есть записи!");
      return;
    }
    if (Object.values(activeShifts).some(s => s !== null)) {
      alert("Сначала завершите все активные рабочие сессии!");
      return;
    }
    const log: WorkLog = {
      id: `abs-${user.id}-${Date.now()}`,
      userId: user.id,
      organizationId: orgId,
      date: dateStr,
      entryType: type,
      durationMinutes: 0
    };
    onLogsUpsert([log]);
  };

  const handlePinChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (pinState.old !== user.pin) {
      setPinError('Текущий PIN-код неверен');
      return;
    }
    if (pinState.new.length !== 4) {
      setPinError('PIN должен состоять из 4 цифр');
      return;
    }
    if (pinState.new === pinState.old) {
      setPinError('Новый PIN должен отличаться от старого');
      return;
    }
    if (pinState.new !== pinState.confirm) {
      setPinError('Новые PIN-коды не совпадают');
      return;
    }
    onUpdateUser({ ...user, pin: pinState.new, forcePinChange: false });
    alert('PIN-код успешно изменен');
    setShowPinChange(false);
    setPinState({ old: '', new: '', confirm: '' });
  };

  const myLogs = logs.filter(l => l.userId === user.id);
  const filteredLogs = myLogs.filter(l => l.date.startsWith(filterMonth));
  const daysInMonth = getDaysInMonthArray(filterMonth);
  const today = startOfDay(new Date());

  const stats = useMemo(() => {
    const workSessions = filteredLogs.filter(l => l.entryType === EntryType.WORK && l.checkOut);
    const workDaysCount = new Set(workSessions.map(l => l.date)).size;
    const totalWorkMinutes = workSessions.reduce((sum, l) => sum + l.durationMinutes, 0);
    const sickDays = filteredLogs.filter(l => l.entryType === EntryType.SICK).length;
    const vacationDays = filteredLogs.filter(l => l.entryType === EntryType.VACATION).length;
    const explicitDayOffs = filteredLogs.filter(l => l.entryType === EntryType.DAY_OFF).length;
    const allLoggedDates = new Set(filteredLogs.map(l => l.date));
    
    const pastDaysInMonth = daysInMonth.filter(d => !isAfter(d, today));
    const autoDayOffs = pastDaysInMonth.filter(d => !allLoggedDates.has(format(d, 'yyyy-MM-dd'))).length;

    return {
      workDays: workDaysCount,
      workTime: totalWorkMinutes,
      sick: sickDays,
      vacation: vacationDays,
      off: explicitDayOffs + autoDayOffs
    };
  }, [filteredLogs, daysInMonth, today]);

  const getMachineName = (id?: string) => machines.find(m => m.id === id)?.name || 'Работа';

  const usedMachines = useMemo(() => {
    return machines.filter(m => filteredLogs.some(l => l.machineId === m.id));
  }, [machines, filteredLogs]);

  const downloadCalendarPDF = () => {
    const element = document.getElementById('employee-calendar-print');
    if (!element) return;
    const opt = {
      margin: 10,
      filename: `tabel_${user.name}_${filterMonth}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    // @ts-ignore
    window.html2pdf().from(element).set(opt).save();
  };

  const calendarData = useMemo(() => {
    const current = startOfMonth(new Date(`${filterMonth}-01`));
    const days = eachDayOfInterval({ start: current, end: endOfMonth(current) });
    const prevMonth = subMonths(current, 1);
    const nextMonth = addMonths(current, 1);
    const prevDays = eachDayOfInterval({ start: startOfMonth(prevMonth), end: endOfMonth(prevMonth) });
    const nextDays = eachDayOfInterval({ start: startOfMonth(nextMonth), end: endOfMonth(nextMonth) });
    const startOffset = (getDay(current) + 6) % 7;
    
    return {
      current,
      monthName: format(current, 'LLLL', { locale: ru }).toUpperCase(),
      year: format(current, 'yyyy'),
      days,
      startOffset,
      prevMonth: { name: format(prevMonth, 'LLLL', { locale: ru }), year: format(prevMonth, 'yyyy'), days: prevDays, startOffset: (getDay(startOfMonth(prevMonth)) + 6) % 7 },
      nextMonth: { name: format(nextMonth, 'LLLL', { locale: ru }), year: format(nextMonth, 'yyyy'), days: nextDays, startOffset: (getDay(startOfMonth(nextMonth)) + 6) % 7 }
    };
  }, [filterMonth]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {showPinChange && (
        <PinChangeModal 
          user={user}
          pinState={pinState}
          setPinState={setPinState}
          pinError={pinError}
          handlePinChangeSubmit={handlePinChangeSubmit}
          setShowPinChange={setShowPinChange}
        />
      )}

      <EmployeePrintView 
        calendarData={calendarData}
        user={user}
        filterMonth={filterMonth}
        filteredLogs={filteredLogs}
      />

      {showCamera && (
        <CameraModal 
          videoRef={videoRef}
          showCamera={showCamera}
          setShowCamera={setShowCamera}
          isUploadingPhoto={isUploadingPhoto}
          onCapture={async () => {
            setIsUploadingPhoto(true);
            try {
              const photoBase64 = capturePhoto();
              const photoUrl = await db.uploadPhoto(photoBase64, orgId, user.id);
              showCamera.type === 'start' ? handleStartWork(showCamera.slot, photoUrl || undefined) : handleStopWork(showCamera.slot, photoUrl || undefined);
            } finally {
              setIsUploadingPhoto(false);
            }
          }}
        />
      )}

      <EmployeeHeader 
        user={user}
        isAbsentToday={isAbsentToday}
        onRefresh={onRefresh}
        setShowPinChange={setShowPinChange}
        viewMode={viewMode}
        setViewMode={setViewMode}
        perms={perms}
      />

      {viewMode === 'control' ? (
        <>
          <ShiftControl 
            perms={perms}
            activeShifts={activeShifts}
            overtimeAlerts={overtimeAlerts}
            isAbsentToday={isAbsentToday}
            isAnyNightShiftActive={isAnyNightShiftActive}
            isNightModeGlobal={isNightModeGlobal}
            setIsNightModeGlobal={setIsNightModeGlobal}
            slotMachineIds={slotMachineIds}
            setSlotMachineIds={setSlotMachineIds}
            machines={machines}
            busyMachineIds={busyMachineIds}
            processAction={processAction}
            isAnyShiftActiveInLogs={isAnyShiftActiveInLogs}
          />

          <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm no-print">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Журнал сессий за сегодня</h3>
            <div className="overflow-hidden border border-slate-100 rounded-2xl">
               <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Объект / Статус</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Начало</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Конец</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Время</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {todayLogs.length > 0 ? todayLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              {log.isNightShift && <svg className="w-2.5 h-2.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>}
                              {getMachineName(log.machineId)}
                            </span>
                            <span className={`text-[9px] font-black uppercase tracking-tighter ${log.checkOut ? 'text-slate-400' : 'text-blue-500 animate-pulse'}`}>
                              {log.checkOut ? 'Завершена' : 'В процессе...'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] font-bold text-slate-600 tabular-nums">{formatTime(log.checkIn)}</td>
                        <td className="px-4 py-3 text-[11px] font-bold text-slate-600 tabular-nums">{log.checkOut ? formatTime(log.checkOut) : '--:--'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-[11px] font-black tabular-nums ${log.checkOut ? 'text-slate-900' : 'text-blue-500'}`}>
                            {log.checkOut ? formatDurationShort(log.durationMinutes) : '--:--'}
                          </span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400 italic">Сегодня еще не было рабочих сессий</td>
                      </tr>
                    )}
                  </tbody>
               </table>
            </div>
          </section>

          <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm no-print">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 text-center">Отметка отсутствия</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <button onClick={() => handleMarkAbsence(EntryType.DAY_OFF)} className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-blue-200 hover:bg-white transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Выходной</span>
               </button>
               <button onClick={() => handleMarkAbsence(EntryType.SICK)} className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-amber-200 hover:bg-white transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Больничный</span>
               </button>
               <button onClick={() => handleMarkAbsence(EntryType.VACATION)} className="flex flex-col items-center gap-3 p-6 bg-slate-50 rounded-2xl border-2 border-slate-100 hover:border-purple-200 hover:bg-white transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Отпуск</span>
               </button>
            </div>
          </section>
        </>
      ) : (
        <div className="space-y-8 no-print">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-3">
                <button onClick={() => {
                  const newMonth = format(subMonths(new Date(`${filterMonth}-01`), 1), 'yyyy-MM');
                  setFilterMonth(newMonth);
                  if (onMonthChange) onMonthChange(newMonth);
                }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight min-w-[140px] text-center">
                  {format(new Date(`${filterMonth}-01`), 'LLLL yyyy', { locale: ru })}
                </h3>
                <button onClick={() => {
                  const newMonth = format(addMonths(new Date(`${filterMonth}-01`), 1), 'yyyy-MM');
                  setFilterMonth(newMonth);
                  if (onMonthChange) onMonthChange(newMonth);
                }} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
             </div>
             
             <div className="flex gap-4">
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                   <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                   <span className="text-[10px] font-black text-blue-700 uppercase tracking-tight">План: {shiftCounts['Р']} дн.</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                   <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                   <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">Вых: {shiftCounts['В']} дн.</span>
                </div>
             </div>
          </div>

          <EmployeeStats stats={stats} />

          <EmployeeMatrix 
            daysInMonth={daysInMonth}
            today={today}
            filteredLogs={filteredLogs}
            usedMachines={usedMachines}
            downloadCalendarPDF={downloadCalendarPDF}
            perms={perms}
          />
        </div>
      )}
    </div>
  );
};

export default EmployeeView;
