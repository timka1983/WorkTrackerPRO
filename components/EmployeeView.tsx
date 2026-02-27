
import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { WorkLog, User, EntryType, Machine, PositionConfig, PlanLimits, Organization } from '../types';
import { formatTime, formatDate, formatDuration, calculateMinutes, getDaysInMonthArray, formatDurationShort, sendNotification } from '../utils';
import { STORAGE_KEYS, DEFAULT_PERMISSIONS } from '../constants';
import { format, isAfter, endOfMonth, eachDayOfInterval, getDay, addMonths } from 'date-fns';
import { startOfDay } from 'date-fns/startOfDay';
import { startOfMonth } from 'date-fns/startOfMonth';
import { subMonths } from 'date-fns/subMonths';
import { ru } from 'date-fns/locale/ru';
import { db } from '../lib/supabase';

// --- Memoized Row Component ---
const MemoizedEmployeeMatrixRow = memo(({ 
  machine, 
  daysInMonth, 
  today, 
  filteredLogs 
}: { 
  machine: Machine | null, 
  daysInMonth: Date[], 
  today: Date, 
  filteredLogs: WorkLog[] 
}) => {
  return (
    <tr className="border-b border-slate-100">
      <td className="sticky left-0 z-10 bg-white border-r px-4 py-3 text-[11px] font-bold text-slate-700">
        {machine ? machine.name : 'Отработано'}
      </td>
      {daysInMonth.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (isAfter(day, today)) return <td key={dateStr} className="border-r p-1 h-12"></td>;
        
        const workEntries = filteredLogs.filter(l => 
          l.date === dateStr && 
          l.entryType === EntryType.WORK && 
          (!machine || l.machineId === machine.id)
        );
        
        const mins = workEntries.reduce((sum, l) => sum + l.durationMinutes, 0);
        const hasWork = workEntries.length > 0;
        const absence = filteredLogs.find(l => l.date === dateStr && l.entryType !== EntryType.WORK);
        
        let content = absence ? 
          <span className="font-black text-blue-600">{absence.entryType === EntryType.SICK ? 'Б' : absence.entryType === EntryType.VACATION ? 'О' : 'В'}</span> : 
          (hasWork ? 
            <span className={`text-[11px] font-black ${workEntries.some(l => !l.checkOut) ? 'text-blue-500 italic' : 'text-slate-900'}`}>
              {mins > 0 ? formatDurationShort(mins) : (workEntries.some(l => !l.checkOut) ? '--:--' : '0:00')}
            </span> : 
            <span className="text-[10px] font-bold text-slate-300">В</span>
          );
          
        return <td key={dateStr} className="border-r p-1 text-center h-12 tabular-nums">{content}</td>;
      })}
    </tr>
  );
});
// --- End Memoized Row Component ---

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
  getNow: () => Date;
}

const EmployeeView: React.FC<EmployeeViewProps> = ({ 
  user, logs, onLogsUpsert, activeShifts, onActiveShiftsUpdate, onOvertime, machines, positions, onUpdateUser, nightShiftBonusMinutes, onRefresh, planLimits, currentOrg, onMonthChange, getNow
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

      const now = getNow();
      const updatedAlerts = { ...overtimeAlerts };
      let changed = false;

      Object.entries(activeShifts).forEach(([slot, shift]) => {
        if (shift && shift.checkIn) {
          const duration = calculateMinutes(shift.checkIn, now.toISOString());
          // Add 15 minutes buffer
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
  }, [activeShifts, perms.maxShiftDurationMinutes, overtimeAlerts, planLimits, user, onOvertime, getNow]);

  const [slotMachineIds, setSlotMachineIds] = useState<Record<number, string>>({ 1: '', 2: '', 3: '' });

  // Синхронизируем выбранные ID машин при загрузке списка оборудования
  useEffect(() => {
    if (machines.length > 0) {
      setSlotMachineIds(prev => {
        const next = { ...prev };
        let changed = false;
        
        [1, 2, 3].forEach((slot, idx) => {
          // Если в слоте еще нет машины или она невалидна
          if (!next[slot] || !machines.find(m => m.id === next[slot])) {
            // Ищем первую свободную машину, которая не занята в других слотах ЭТОГО пользователя
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

  const todayStr = format(getNow(), 'yyyy-MM-dd');
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
    // Если разрешено несколько слотов, то наличие активной смены не блокирует начало новой в другом слоте
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

    const now = getNow();
    const dateStr = format(now, 'yyyy-MM-dd');
    const newShift: WorkLog = {
      id: `shift-${user.id}-${Date.now()}-${slot}`,
      userId: user.id,
      organizationId: orgId,
      date: dateStr,
      entryType: EntryType.WORK,
      machineId: selectedMachineId,
      checkIn: now.toISOString(),
      checkOut: null as any, // Явно указываем отсутствие завершения
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
    
    const now = getNow();
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
    
    // Explicitly update active shifts first
    const nextShifts = { ...activeShifts, [slot]: null };
    onActiveShiftsUpdate(nextShifts);
    
    // Обновляем логи. handleLogsUpsert в App.tsx теперь автоматически очистит 
    // завершенную смену из карты активных смен.
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

    const dateStr = format(getNow(), 'yyyy-MM-dd');
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
  const today = startOfDay(getNow());

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

  const getAvailableMachines = (currentSlot: number) => {
    // Возвращаем все доступные организации машины
    return machines;
  };

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

  const renderSlot = (slot: number) => {
    const active = activeShifts[slot];
    const availableMachines = getAvailableMachines(slot);
    
    return (
      <div key={slot} className={`bg-slate-50 border-2 p-6 rounded-3xl flex flex-col items-center gap-4 transition-all ${isAbsentToday ? 'opacity-50 grayscale pointer-events-none' : 'hover:bg-white hover:border-blue-100 hover:shadow-xl'} ${active ? 'border-blue-500' : 'border-slate-100'}`}>
        <div className="flex items-center gap-2">
           <span className={`w-2 h-2 rounded-full ${active ? (overtimeAlerts[slot] ? 'bg-rose-500 animate-pulse' : 'bg-blue-500 animate-pulse') : 'bg-slate-300'}`}></span>
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Рабочее место №{slot}</h4>
        </div>
        
        {active ? (
          <div className="text-center space-y-4 w-full">
            <div className={`${overtimeAlerts[slot] ? 'bg-rose-600' : 'bg-blue-600'} p-3 rounded-2xl shadow-lg ${overtimeAlerts[slot] ? 'shadow-rose-100' : 'shadow-blue-100'} relative overflow-hidden transition-colors duration-500`}>
              {active.isNightShift && (
                <div className="absolute top-1 right-1">
                   <svg className="w-3 h-3 text-white opacity-40" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
                </div>
              )}
              <p className="text-xs font-bold text-blue-100 uppercase mb-1">
                {overtimeAlerts[slot] ? 'ПРЕВЫШЕН ЛИМИТ!' : `В процессе ${active.isNightShift ? '(Ночь)' : ''}`}
              </p>
              <p className="text-sm font-black text-white truncate px-2">{getMachineName(active.machineId)}</p>
            </div>
            <div className="space-y-1">
              <p className={`text-3xl font-mono font-black tabular-nums transition-colors ${overtimeAlerts[slot] ? 'text-rose-600' : 'text-slate-900'}`}>
                {formatTime(active.checkIn)}
              </p>
              {overtimeAlerts[slot] && (
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest animate-pulse">
                  Смена длится более {perms.maxShiftDurationMinutes! / 60} ч.
                </p>
              )}
            </div>
            <button onClick={() => processAction(slot, 'stop')} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-red-100 transition-all active:scale-95 uppercase">Завершить</button>
          </div>
        ) : (
          <div className="w-full space-y-4">
            {perms.useMachines && (
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase px-1">Оборудование</label>
                <select 
                  disabled={isAbsentToday}
                  value={slotMachineIds[slot]} 
                  onChange={e => setSlotMachineIds({ ...slotMachineIds, [slot]: e.target.value })}
                  className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold bg-white text-slate-700 outline-none focus:border-blue-500 transition-colors cursor-pointer disabled:bg-slate-100"
                >
                  <option value="">-- Выберите оборудование --</option>
                  {machines.map(m => {
                    const isBusyByOthers = busyMachineIds.includes(m.id);
                    const isSelectedInOtherSlot = Object.entries(slotMachineIds)
                      .some(([s, id]) => parseInt(s) !== slot && id === m.id);
                    
                    const isDisabled = isBusyByOthers || isSelectedInOtherSlot;
                    
                    return (
                      <option key={m.id} value={m.id} disabled={isDisabled} className={isDisabled ? 'text-slate-300' : ''}>
                        {m.name} {isBusyByOthers ? '(ЗАНЯТ)' : isSelectedInOtherSlot ? '(ВЫБРАН В ДР. СЛОТЕ)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            
            {perms.canUseNightShift && (
              <div className="flex items-center justify-between px-2 py-1">
                 <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${isAnyNightShiftActive ? 'text-blue-600' : 'text-slate-400'}`}>
                    <svg className={`w-3 h-3 ${isNightModeGlobal ? 'text-blue-500' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
                    Ночная смена
                 </span>
                 <button 
                    disabled={isAnyNightShiftActive}
                    onClick={() => setIsNightModeGlobal(!isNightModeGlobal)}
                    className={`w-10 h-5 rounded-full transition-all relative ${isNightModeGlobal ? 'bg-blue-600' : 'bg-slate-200'} ${isAnyNightShiftActive ? 'opacity-80 cursor-not-allowed' : ''}`}
                    title={isAnyNightShiftActive ? "Нельзя отключить, пока один из станков в ночной смене" : ""}
                 >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isNightModeGlobal ? 'left-5.5' : 'left-0.5'}`}></div>
                 </button>
              </div>
            )}

            <button 
              disabled={isAbsentToday || isAnyShiftActiveInLogs || (perms.useMachines && busyMachineIds.includes(slotMachineIds[slot]))}
              onClick={() => processAction(slot, 'start')} 
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 transition-all active:scale-95 uppercase disabled:bg-slate-300 disabled:shadow-none"
            >
              Начать {isNightModeGlobal && perms.canUseNightShift ? 'ночную' : ''} смену
            </button>
          </div>
        )}
      </div>
    );
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
        <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 border border-slate-200">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Смена PIN-кода</h3>
                  {user.forcePinChange && <p className="text-[10px] font-bold text-amber-600 uppercase tracking-tight">Необходима смена пароля</p>}
                </div>
                {!user.forcePinChange && (
                  <button onClick={() => setShowPinChange(false)} className="text-slate-400 text-2xl">&times;</button>
                )}
             </div>
             <form onSubmit={handlePinChangeSubmit} className="space-y-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Текущий PIN</label>
                   <input 
                      type="password" 
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      required
                      value={pinState.old}
                      onChange={e => setPinState({...pinState, old: e.target.value.replace(/[^0-9]/g, '')})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-lg font-black tracking-[0.5em] text-center"
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Новый PIN (4 цифры)</label>
                   <input 
                      type="password" 
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      required
                      value={pinState.new}
                      onChange={e => setPinState({...pinState, new: e.target.value.replace(/[^0-9]/g, '')})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-lg font-black tracking-[0.5em] text-center text-blue-600"
                   />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Повторите новый PIN</label>
                   <input 
                      type="password" 
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      required
                      value={pinState.confirm}
                      onChange={e => setPinState({...pinState, confirm: e.target.value.replace(/[^0-9]/g, '')})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-lg font-black tracking-[0.5em] text-center text-blue-600"
                   />
                </div>
                {pinError && <p className="text-red-500 text-[10px] font-black text-center uppercase">{pinError}</p>}
                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-100 mt-4 active:scale-95 transition-all">Обновить PIN</button>
             </form>
          </div>
        </div>
      )}

      <div id="employee-calendar-print" className="hidden print:block bg-white text-black p-4" style={{ width: '280mm', height: '190mm', fontFamily: 'serif' }}>
        <div className="flex justify-between items-start mb-6">
          <div className="w-32 opacity-80">
            <div className="text-[8px] font-bold mb-1">{calendarData.prevMonth.name} {calendarData.prevMonth.year}</div>
            <div className="grid grid-cols-7 gap-0.5 text-[6px]">
              {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <div key={d} className="font-bold">{d}</div>)}
              {Array.from({ length: calendarData.prevMonth.startOffset }).map((_, i) => <div key={i}></div>)}
              {calendarData.prevMonth.days.map(d => <div key={d.toString()}>{format(d, 'd')}</div>)}
            </div>
          </div>
          <div className="text-center flex-1">
            <h1 className="text-6xl font-black tracking-tight leading-none mb-1" style={{ fontFamily: 'serif' }}>{calendarData.monthName} {calendarData.year}</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Рабочий табель сотрудника: {user.name}</p>
          </div>
          <div className="w-32 opacity-80 text-right">
            <div className="text-[8px] font-bold mb-1">{calendarData.nextMonth.name} {calendarData.nextMonth.year}</div>
            <div className="grid grid-cols-7 gap-0.5 text-[6px] text-left">
              {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <div key={d} className="font-bold">{d}</div>)}
              {Array.from({ length: calendarData.nextMonth.startOffset }).map((_, i) => <div key={i}></div>)}
              {calendarData.nextMonth.days.map(d => <div key={d.toString()}>{format(d, 'd')}</div>)}
            </div>
          </div>
        </div>

        <table className="w-full border-collapse border-2 border-black">
          <thead>
            <tr>
              {['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'].map(d => (
                <th key={d} className="border border-black p-2 text-xs font-bold uppercase tracking-widest bg-slate-50">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, rowIdx) => {
              const weekDays = Array.from({ length: 7 }).map((_, colIdx) => {
                const dayIdx = rowIdx * 7 + colIdx - calendarData.startOffset;
                const date = calendarData.days[dayIdx];
                if (!date) return <td key={colIdx} className="border border-black bg-slate-50/20"></td>;

                const dateStr = format(date, 'yyyy-MM-dd');
                const dayLogs = filteredLogs.filter(l => l.date === dateStr);
                const workEntries = dayLogs.filter(l => l.entryType === EntryType.WORK);
                const workMins = workEntries.reduce((s, l) => s + l.durationMinutes, 0);
                const hasWork = workEntries.length > 0;
                const absence = dayLogs.find(l => l.entryType !== EntryType.WORK);

                return (
                  <td key={colIdx} className="border border-black h-24 p-2 relative vertical-align-top">
                    <span className="text-2xl font-black absolute top-1 left-2">{format(date, 'd')}</span>
                    <div className="h-full flex flex-col justify-end items-center text-center pb-2">
                       {absence ? (
                         <div className="bg-slate-900 text-white px-3 py-1 rounded-md text-xs font-black uppercase">
                           {absence.entryType === EntryType.SICK ? 'БОЛЬНИЧНЫЙ' : absence.entryType === EntryType.VACATION ? 'ОТПУСК' : 'ВЫХОДНОЙ'}
                         </div>
                       ) : hasWork ? (
                         <div className="flex flex-col items-center">
                            <span className={`text-xl font-black tabular-nums ${workEntries.some(l => !l.checkOut) ? 'text-blue-600 italic' : ''}`}>
                              {workMins > 0 ? formatDurationShort(workMins) : (workEntries.some(l => !l.checkOut) ? '--:--' : '0:00')}
                            </span>
                            <span className="text-[7px] font-bold text-slate-500 uppercase tracking-tighter">ОТРАБОТАНО</span>
                         </div>
                       ) : (
                         <span className="text-[10px] text-slate-200 font-bold italic">--:--</span>
                       )}
                    </div>
                  </td>
                );
              });
              if (rowIdx === 5 && !calendarData.days[rowIdx * 7 - calendarData.startOffset]) return null;
              return <tr key={rowIdx}>{weekDays}</tr>;
            })}
          </tbody>
        </table>
      </div>

      {showCamera && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
           <div className="bg-white p-2 rounded-[2.5rem] shadow-2xl overflow-hidden mb-8 border-4 border-blue-600">
             <video ref={videoRef} autoPlay playsInline className="w-full max-sm rounded-[2rem] aspect-square object-cover" />
           </div>
           <h3 className="text-white text-xl font-black uppercase tracking-widest mb-2">Фотофиксация</h3>
           <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-8">{showCamera.type === 'start' ? 'Начало смены' : 'Завершение смены'}</p>
           <div className="flex gap-4">
              <button 
                onClick={() => setShowCamera(null)}
                className="px-8 py-4 bg-white/10 text-white rounded-2xl font-black uppercase text-xs tracking-widest border border-white/20"
              >
                Отмена
              </button>
              <button 
                onClick={async () => {
                  setIsUploadingPhoto(true);
                  try {
                    const photoBase64 = capturePhoto();
                    const photoUrl = await db.uploadPhoto(photoBase64, orgId, user.id);
                    showCamera.type === 'start' ? handleStartWork(showCamera.slot, photoUrl || undefined) : handleStopWork(showCamera.slot, photoUrl || undefined);
                  } finally {
                    setIsUploadingPhoto(false);
                  }
                }}
                disabled={isUploadingPhoto}
                className="px-12 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 disabled:opacity-50"
              >
                {isUploadingPhoto ? 'Сохранение...' : 'Сфотографировать'}
              </button>
           </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 no-print">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-black text-2xl">
              {user.name.charAt(0)}
           </div>
           <div>
             <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
             <div className="flex items-center gap-2">
               <p className="text-sm text-blue-600 font-semibold uppercase tracking-wider">{user.position}</p>
               {isAbsentToday && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">На выходном сегодня</span>}
             </div>
           </div>
        </div>
        <div className="flex items-center gap-4">
          {onRefresh && (
            <button onClick={onRefresh} className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors" title="Обновить данные">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          )}
          <button onClick={() => setShowPinChange(true)} className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors" title="Сменить PIN">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
          </button>
          
          {/* Кнопка выхода для администраторов */}
          {(user.id === 'admin' || user.isAdmin) && (
             <button 
               onClick={() => {
                 localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
                 localStorage.removeItem(STORAGE_KEYS.LAST_USER_ID);
                 window.location.reload();
               }} 
               className="p-3 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors" 
               title="Выйти в меню выбора"
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
             </button>
          )}

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('control')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'control' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}>Управление</button>
            {perms.viewSelfMatrix && (
              <button onClick={() => setViewMode('matrix')} className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'matrix' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}>Мой Табель</button>
            )}
          </div>
        </div>
      </div>

      {viewMode === 'control' ? (
        <>
          <section className="bg-white p-8 rounded-3xl border shadow-sm border-slate-200 no-print">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 text-center">Контроль рабочего времени</h3>
            <div className={`grid grid-cols-1 ${perms.multiSlot ? 'md:grid-cols-3' : 'max-w-md mx-auto'} gap-8`}>
               {perms.multiSlot ? [1, 2, 3].map(renderSlot) : [1].map(renderSlot)}
            </div>
          </section>

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
                  <tbody>
                    {todayLogs.length > 0 ? todayLogs.map(log => (
                      <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight flex items-center gap-1 w-fit ${log.entryType === EntryType.WORK ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                            {log.isNightShift && <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>}
                            {log.entryType === EntryType.WORK ? getMachineName(log.machineId) : 'Отсутствие'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-600">{log.checkIn ? formatTime(log.checkIn) : '--:--'}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-600">{log.checkOut ? formatTime(log.checkOut) : '--:--'}</td>
                        <td className="px-4 py-3 font-black text-slate-900 text-right">{log.durationMinutes > 0 ? formatDurationShort(log.durationMinutes) : (log.entryType === EntryType.WORK && !log.checkOut ? '--:--' : '0:00')}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-300 italic text-xs font-medium">Записей пока нет</td>
                      </tr>
                    )}
                  </tbody>
               </table>
            </div>
          </section>

          {perms.markAbsences && (
            <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm no-print">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Отметить особый статус дня</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <button disabled={isAbsentToday} onClick={() => handleMarkAbsence(EntryType.DAY_OFF)} className="py-5 bg-blue-50 border-2 border-blue-100 rounded-2xl text-xs font-black text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed">Выходной (В)</button>
                <button disabled={isAbsentToday} onClick={() => handleMarkAbsence(EntryType.SICK)} className="py-5 bg-red-50 border-2 border-red-100 rounded-2xl text-xs font-black text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed">Больничный (Б)</button>
                <button disabled={isAbsentToday} onClick={() => handleMarkAbsence(EntryType.VACATION)} className="py-5 bg-purple-50 border-2 border-purple-100 rounded-2xl text-xs font-black text-purple-700 hover:bg-purple-600 hover:text-white hover:border-purple-600 transition-all shadow-sm uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed">Отпуск (О)</button>
              </div>
            </section>
          )}
        </>
      ) : (
        <div id="print-area">
          <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 no-print">
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Отработано дней</p>
                <p className="text-2xl font-black text-slate-900">{stats.workDays}</p>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Всего времени</p>
                <p className="text-2xl font-black text-blue-600">{formatDuration(stats.workTime)}</p>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Болезни</p>
                <p className="text-2xl font-black text-red-500">{stats.sick}</p>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Отпуска</p>
                <p className="text-2xl font-black text-purple-600">{stats.vacation}</p>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Выходные</p>
                <p className="text-2xl font-black text-slate-400">{stats.off}</p>
             </div>
          </section>

          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden print-monochrome">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 no-print">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-slate-900">Мой Табель</h3>
                <div className="flex gap-2">
                   <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-white transition-colors">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                     Обычная печать
                   </button>
                   <button onClick={downloadCalendarPDF} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors">
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                     Скачать календарь
                   </button>
                </div>
              </div>
              <input type="month" value={filterMonth} onChange={(e) => {
                setFilterMonth(e.target.value);
                if (onMonthChange) onMonthChange(e.target.value);
              }} className="border border-slate-200 rounded-xl p-2 text-sm font-bold" />
            </div>

            <div className="p-4 bg-slate-50/30 border-b border-slate-100 no-print">
              <div className="flex flex-wrap gap-4 text-[10px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-[9px]">Р</span> Рабочий - {shiftCounts['Р']}</span>
                <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-slate-100 text-slate-400 flex items-center justify-center text-[9px]">В</span> Выходной - {shiftCounts['В']}</span>
                <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-amber-100 text-amber-700 flex items-center justify-center text-[9px]">Д</span> День - {shiftCounts['Д']}</span>
                <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-[9px]">О</span> Отпуск - {shiftCounts['О']}</span>
                <span className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px]">Н</span> Ночь - {shiftCounts['Н']}</span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="sticky left-0 z-20 bg-slate-50 px-4 py-4 text-left text-[10px] font-bold text-slate-600 uppercase border-r min-w-[160px]">День</th>
                    {daysInMonth.map(day => (
                      <th key={day.toString()} className={`px-1 py-2 text-center text-[9px] font-bold border-r min-w-[40px] ${[0, 6].includes(day.getDay()) ? 'text-red-500 bg-red-50/20' : 'text-slate-500'}`}>
                        <div className="flex flex-col items-center">
                          <span>{format(day, 'd')}</span>
                          <span className="text-[7px] uppercase opacity-60 font-medium">{format(day, 'eeeeee', { locale: ru })}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <td className="sticky left-0 z-10 bg-slate-50 border-r px-4 py-3 text-[11px] font-black text-blue-600">График</td>
                    {daysInMonth.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const planned = user.plannedShifts?.[dateStr];
                      const isFuture = isAfter(day, today);
                      
                      const handleClick = () => {
                        if (!isFuture) return;
                        const cycle = ['', 'Р', 'В', 'Д', 'О', 'Н'];
                        const currentVal = planned || '';
                        const nextIdx = (cycle.indexOf(currentVal) + 1) % cycle.length;
                        const nextVal = cycle[nextIdx];
                        const newPlannedShifts = { ...(user.plannedShifts || {}) };
                        if (nextVal === '') delete newPlannedShifts[dateStr];
                        else newPlannedShifts[dateStr] = nextVal;
                        onUpdateUser({ ...user, plannedShifts: newPlannedShifts });
                      };

                      return (
                        <td key={dateStr} onClick={handleClick} className={`border-r p-1 text-center h-12 tabular-nums transition-colors ${isFuture ? 'cursor-pointer hover:bg-blue-50' : ''}`}>
                          {planned && (
                            <span className={`text-[10px] font-black ${
                              planned === 'Р' ? 'text-blue-600' :
                              planned === 'В' ? 'text-slate-400' :
                              planned === 'Д' ? 'text-amber-600' :
                              planned === 'О' ? 'text-purple-600' :
                              planned === 'Н' ? 'text-indigo-600' : 'text-slate-400'
                            }`}>
                              {planned}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {perms.useMachines ? (
                    usedMachines.map(m => (
                      <MemoizedEmployeeMatrixRow
                        key={m.id}
                        machine={m}
                        daysInMonth={daysInMonth}
                        today={today}
                        filteredLogs={filteredLogs}
                      />
                    ))
                  ) : (
                    <MemoizedEmployeeMatrixRow
                      machine={null}
                      daysInMonth={daysInMonth}
                      today={today}
                      filteredLogs={filteredLogs}
                    />
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default EmployeeView;
