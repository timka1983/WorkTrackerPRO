
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
import { EmployeeMatrixRow } from './employee/EmployeeMatrixRow';
import { EmployeeHeader } from './employee/EmployeeHeader';
import { ShiftControl } from './employee/ShiftControl';
import { EmployeeStats } from './employee/EmployeeStats';
import { EmployeeMatrix } from './employee/EmployeeMatrix';
import { PinChangeModal } from './employee/PinChangeModal';
import { EmployeePrintView } from './employee/EmployeePrintView';
import { TodaySessions } from './employee/TodaySessions';
import { AbsenceControls } from './employee/AbsenceControls';
import { CameraModal } from './employee/CameraModal';

interface EmployeeViewProps {
  user: User;
  logs: WorkLog[];
  logsLookup?: Record<string, Record<string, WorkLog[]>>;
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
  user, logs, logsLookup = {}, onLogsUpsert, activeShifts, onActiveShiftsUpdate, onOvertime, machines, positions, onUpdateUser, nightShiftBonusMinutes, onRefresh, planLimits, currentOrg, onMonthChange, getNow
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
  
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

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

  const myLogs = useMemo(() => {
    const userLogsMap = logsLookup[user.id] || {};
    const allUserLogs: WorkLog[] = [];
    Object.values(userLogsMap).forEach(dateLogs => {
      allUserLogs.push(...dateLogs);
    });
    return allUserLogs;
  }, [logsLookup, user.id]);

  const filteredLogs = useMemo(() => {
    const userLogsMap = logsLookup[user.id] || {};
    const monthLogs: WorkLog[] = [];
    Object.keys(userLogsMap).forEach(date => {
      if (date.startsWith(filterMonth)) {
        monthLogs.push(...userLogsMap[date]);
      }
    });
    return monthLogs;
  }, [logsLookup, user.id, filterMonth]);

  const daysInMonth = getDaysInMonthArray(filterMonth);
  const today = startOfDay(getNow());

  const stats = useMemo(() => {
    const workSessions = filteredLogs.filter(l => l.entryType === EntryType.WORK && l.checkOut);
    const workDaysCount = new Set(workSessions.map(l => l.date)).size;
    
    // Group by date and machine to calculate max duration per day
    const logsByDate: Record<string, WorkLog[]> = {};
    workSessions.forEach(l => {
      if (!logsByDate[l.date]) logsByDate[l.date] = [];
      logsByDate[l.date].push(l);
    });

    let totalWorkMinutes = 0;
    Object.values(logsByDate).forEach(dayLogs => {
      const machineTotals: Record<string, number> = {};
      dayLogs.forEach(l => {
        const mid = l.machineId || 'unknown';
        machineTotals[mid] = (machineTotals[mid] || 0) + l.durationMinutes;
      });
      totalWorkMinutes += Object.values(machineTotals).reduce((max, val) => Math.max(max, val), 0);
    });

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

  const effectivePayroll = useMemo(() => {
     if (user.payroll) return user.payroll;
     const pos = positions.find(p => p.name === user.position);
     return pos?.payroll;
  }, [user, positions]);

  const todayEarnings = useMemo(() => {
    if (!effectivePayroll || !planLimits.features.payroll) return 0;
    
    const workLogs = todayLogs.filter(l => l.entryType === EntryType.WORK);
    const now = getNow();
    const machineTotals: Record<string, number> = {};
    
    workLogs.forEach(l => {
       let duration = l.durationMinutes;
       if (!l.checkOut && l.checkIn) {
          const start = new Date(l.checkIn);
          const diff = (now.getTime() - start.getTime()) / 60000;
          duration = Math.max(0, Math.floor(diff));
       }
       const mid = l.machineId || 'unknown';
       machineTotals[mid] = (machineTotals[mid] || 0) + duration;
    });
    
    const todayMinutes = Object.values(machineTotals).reduce((max, val) => Math.max(max, val), 0);
    
    let earnings = 0;
    if (effectivePayroll.type === 'hourly') {
       earnings = (todayMinutes / 60) * effectivePayroll.rate;
    } else if (effectivePayroll.type === 'shift') {
       if (todayMinutes > 0) earnings = effectivePayroll.rate;
    }
    
    if (workLogs.some(l => l.isNightShift)) {
       earnings += effectivePayroll.nightShiftBonus;
    }
    
    return earnings;
  }, [todayLogs, effectivePayroll, planLimits.features.payroll, getNow, activeShifts, tick]); // Added tick to trigger update every minute

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
          setShowPinChange={setShowPinChange}
          handlePinChangeSubmit={handlePinChangeSubmit}
          pinState={pinState}
          setPinState={setPinState}
          pinError={pinError}
        />
      )}

      <EmployeePrintView
        calendarData={calendarData}
        user={user}
        filteredLogs={filteredLogs}
      />

      {planLimits.features.payroll && effectivePayroll && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex justify-between items-center no-print">
           <div>
              <h3 className="text-emerald-900 font-bold text-lg">Зарплата за сегодня</h3>
              <p className="text-emerald-700 text-sm">Примерный расчет</p>
           </div>
           <div className="text-right">
              <p className="text-3xl font-black text-emerald-600">{Math.floor(todayEarnings)} ₽</p>
           </div>
        </div>
      )}

      <CameraModal
        showCamera={showCamera}
        setShowCamera={setShowCamera}
        videoRef={videoRef}
        isUploadingPhoto={isUploadingPhoto}
        onCapture={async () => {
          setIsUploadingPhoto(true);
          try {
            const photoBase64 = capturePhoto();
            const photoUrl = await db.uploadPhoto(photoBase64, orgId, user.id);
            if (showCamera) {
              showCamera.type === 'start' 
                ? handleStartWork(showCamera.slot, photoUrl || undefined) 
                : handleStopWork(showCamera.slot, photoUrl || undefined);
            }
          } finally {
            setIsUploadingPhoto(false);
          }
        }}
      />

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
            getMachineName={getMachineName}
            isAnyShiftActiveInLogs={isAnyShiftActiveInLogs}
          />

          <TodaySessions
            todayLogs={todayLogs}
            getMachineName={getMachineName}
          />

          {perms.markAbsences && (
            <AbsenceControls
              isAbsentToday={isAbsentToday}
              handleMarkAbsence={handleMarkAbsence}
            />
          )}
        </>
      ) : (
        <div id="print-area">
          <EmployeeStats stats={stats} />

          <EmployeeMatrix
            filterMonth={filterMonth}
            setFilterMonth={setFilterMonth}
            onMonthChange={onMonthChange}
            daysInMonth={daysInMonth}
            user={user}
            onUpdateUser={onUpdateUser}
            today={today}
            shiftCounts={shiftCounts}
            perms={perms}
            usedMachines={usedMachines}
            filteredLogs={filteredLogs}
            logsLookup={logsLookup}
            downloadCalendarPDF={downloadCalendarPDF}
          />
        </div>
      )}
    </div>
  );
};

export default EmployeeView;
