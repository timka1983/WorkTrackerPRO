
import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { WorkLog, User, EntryType, Machine, PositionConfig, PlanLimits, Organization, PayrollPeriod, PayrollStatus } from '../types';
import { formatTime, formatDate, formatDuration, calculateMinutes, getDaysInMonthArray, formatDurationShort, sendNotification, calculateDistance, sendTelegramNotification, applyRounding } from '../utils';
import { STORAGE_KEYS, DEFAULT_PERMISSIONS } from '../constants';
import { format, isAfter, endOfMonth, eachDayOfInterval, getDay, addMonths } from 'date-fns';
import { startOfDay } from 'date-fns/startOfDay';
import { startOfMonth } from 'date-fns/startOfMonth';
import { subMonths } from 'date-fns/subMonths';
import { ru } from 'date-fns/locale/ru';
import { db } from '../lib/supabase';
import { EmployeeHeader } from './employee/EmployeeHeader';
import { ShiftControl } from './employee/ShiftControl';
import { EmployeeStats } from './employee/EmployeeStats';
import { EmployeeMatrix } from './employee/EmployeeMatrix';
import { PinChangeModal } from './employee/PinChangeModal';
import { EmployeePrintView } from './employee/EmployeePrintView';
import { TodaySessions } from './employee/TodaySessions';
import { AbsenceControls } from './employee/AbsenceControls';
import { CameraModal } from './employee/CameraModal';
import { ShiftMonitor } from './ShiftMonitor';

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
  viewMode: 'control' | 'matrix';
  setViewMode: (mode: 'control' | 'matrix') => void;
}

const EmployeeView: React.FC<EmployeeViewProps> = ({ 
  user, logs, logsLookup = {}, onLogsUpsert, activeShifts, onActiveShiftsUpdate, onOvertime, machines, positions, onUpdateUser, nightShiftBonusMinutes, onRefresh, planLimits, currentOrg, onMonthChange, getNow, viewMode, setViewMode
}) => {
  const orgId = localStorage.getItem(STORAGE_KEYS.ORG_ID) || 'default_org';

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
  
  const [payrollPeriod, setPayrollPeriod] = useState<PayrollPeriod | null>(null);

  useEffect(() => {
    const fetchPeriod = async () => {
      if (!currentOrg) return;
      const period = await db.getPayrollPeriod(currentOrg.id, filterMonth);
      setPayrollPeriod(period);
    };
    fetchPeriod();
  }, [currentOrg, filterMonth]);

  const isPaid = payrollPeriod?.status === PayrollStatus.PAID;

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

  const [showCamera, setShowCamera] = useState<{ slot: number; type: 'start' | 'stop'; location?: any } | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showPieceworkModal, setShowPieceworkModal] = useState<{ slot: number; photo?: string } | null>(null);
  const [itemsProduced, setItemsProduced] = useState<string>('');
  
  const [showPinChange, setShowPinChange] = useState(user.forcePinChange || false);
  const [pinState, setPinState] = useState({ old: '', new: '', confirm: '' });
  const [pinError, setPinError] = useState('');
  const [showMachineStatsModal, setShowMachineStatsModal] = useState(false);

  useEffect(() => {
    const handleOpenPinChange = () => setShowPinChange(true);
    window.addEventListener('open-pin-change', handleOpenPinChange);
    return () => window.removeEventListener('open-pin-change', handleOpenPinChange);
  }, []);

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
    if (perms.multiSlot > 0) return false;
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

      // Location Check
      let locationData = undefined;
      if (currentOrg?.locationSettings?.enabled) {
         try {
             const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                 navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
             });
             
             const dist = calculateDistance(
                 currentOrg.locationSettings.latitude, 
                 currentOrg.locationSettings.longitude, 
                 position.coords.latitude, 
                 position.coords.longitude
             );
             
             if (dist > currentOrg.locationSettings.radius) {
                 alert(`Вы находитесь вне рабочей зоны! Расстояние: ${Math.round(dist)}м. (Макс: ${currentOrg.locationSettings.radius}м)`);
                 return;
             }
             
             locationData = {
                 latitude: position.coords.latitude,
                 longitude: position.coords.longitude,
                 accuracy: position.coords.accuracy
             };
         } catch (e) {
             alert('Ошибка геолокации. Разрешите доступ к геопозиции для начала смены.');
             return;
         }
      }

      if (perms.useMachines) {
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
          if (activeCount === 0) setShowCamera({ slot, type, location: locationData });
          else handleStartWork(slot, undefined, locationData);
      } else {
          handleStartWork(slot, undefined, locationData);
      }
    } else {
      // Stop work logic
      const activeCount = Object.values(activeShifts).filter(s => s !== null).length;
      const requirePhoto = user.requirePhoto || perms.defaultRequirePhoto;

      if (requirePhoto) {
        if (activeCount === 1) setShowCamera({ slot, type });
        else handleStopWork(slot);
      } else {
        handleStopWork(slot);
      }
    }
  };

  const handleStartWork = (slot: number, photo?: string, location?: any) => {
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
      isNightShift: isNightModeGlobal,
      location: location
    };
    
    const nextShifts = { ...activeShifts, [slot]: newShift };
    onActiveShiftsUpdate(nextShifts);
    onLogsUpsert([newShift]);
    setShowCamera(null);

    // Telegram Notification
    if (currentOrg?.telegramSettings?.enabled && currentOrg.telegramSettings.botToken) {
      const machineName = selectedMachineId ? getMachineName(selectedMachineId) : 'Работа';
      const msg = `🟢 <b>Начало смены</b>\n👤 Сотрудник: ${user.name}\n📍 Позиция: ${user.position}\n🔧 Слот: ${slot} (${machineName})\n⏰ Время: ${formatTime(now.toISOString())}`;
      
      // 1. Notify Admin (Organization Chat)
      if (currentOrg.telegramSettings.chatId && currentOrg.telegramSettings.notifyOnShiftStart !== false) {
        sendTelegramNotification(currentOrg.telegramSettings.botToken, currentOrg.telegramSettings.chatId, msg);
      }

      // 2. Notify Employee (Personal Chat)
      if (user.telegramChatId && (user.telegramSettings?.notifyOnShiftStart ?? true)) {
        sendTelegramNotification(currentOrg.telegramSettings.botToken, user.telegramChatId, msg);
      }
    }
  };

  const handleStopWork = (slot: number, photo?: string, items?: number) => {
    const currentShift = activeShifts[slot];
    if (!currentShift) return;
    
    const isPiecework = user.payroll?.type === 'piecework' || (!user.payroll?.overrides?.type && positions.find(p => p.name === user.position)?.payroll?.type === 'piecework');
    
    if (isPiecework && items === undefined) {
      setShowPieceworkModal({ slot, photo });
      setItemsProduced('');
      return;
    }
    
    const now = getNow();
    let duration = calculateMinutes(currentShift.checkIn!, now.toISOString());
    
    if (currentShift.isNightShift) {
      const bonus = Math.floor((duration / 60) * nightShiftBonusMinutes);
      duration += bonus;
    }

    const completed: WorkLog = { 
      ...currentShift, 
      checkOut: now.toISOString(), 
      durationMinutes: Math.max(0, duration),
      photoOut: photo,
      itemsProduced: items
    };
    
    // Explicitly update active shifts first
    const nextShifts = { ...activeShifts, [slot]: null };
    onActiveShiftsUpdate(nextShifts);
    
    // Обновляем логи. handleLogsUpsert в App.tsx теперь автоматически очистит 
    // завершенную смену из карты активных смен.
    onLogsUpsert([completed]);
    setShowCamera(null);

    // Telegram Notification
    if (currentOrg?.telegramSettings?.enabled && currentOrg.telegramSettings.botToken) {
      const machineName = currentShift.machineId ? getMachineName(currentShift.machineId) : 'Работа';
      const durationFormatted = formatDuration(Math.max(0, duration));
      const itemsText = items !== undefined ? `\n📦 Произведено: ${items} шт.` : '';
      const msg = `🔴 <b>Конец смены</b>\n👤 Сотрудник: ${user.name}\n📍 Позиция: ${user.position}\n🔧 Слот: ${slot} (${machineName})\n⏰ Время: ${formatTime(now.toISOString())}\n⏱ Длительность: ${durationFormatted}${itemsText}`;
      
      // 1. Notify Admin (Organization Chat)
      if (currentOrg.telegramSettings.chatId && currentOrg.telegramSettings.notifyOnShiftEnd !== false) {
        sendTelegramNotification(currentOrg.telegramSettings.botToken, currentOrg.telegramSettings.chatId, msg);
      }

      // 2. Notify Employee (Personal Chat)
      if (user.telegramChatId && (user.telegramSettings?.notifyOnShiftEnd ?? true)) {
        sendTelegramNotification(currentOrg.telegramSettings.botToken, user.telegramChatId, msg);
      }
    }
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
      const maxMins = Object.values(machineTotals).reduce((max, val) => Math.max(max, val), 0);
      totalWorkMinutes += applyRounding(maxMins, currentOrg?.roundShiftMinutes);
    });

    const sickDays = filteredLogs.filter(l => l.entryType === EntryType.SICK).length;
    const vacationDays = filteredLogs.filter(l => l.entryType === EntryType.VACATION).length;
    const explicitDayOffs = filteredLogs.filter(l => l.entryType === EntryType.DAY_OFF).length;
    const allLoggedDates = new Set(filteredLogs.map(l => l.date));
    
    const pastDaysInMonth = daysInMonth.filter(d => !isAfter(d, today));
    const autoDayOffs = pastDaysInMonth.filter(d => !allLoggedDates.has(format(d, 'yyyy-MM-dd'))).length;
    
    const futureDaysInMonth = daysInMonth.filter(d => isAfter(d, today));
    const plannedDayOffs = futureDaysInMonth.filter(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const shift = user.plannedShifts?.[dateStr];
      return !shift || shift === 'В';
    }).length;

    return {
      workDays: workDaysCount,
      workTime: totalWorkMinutes,
      sick: sickDays,
      vacation: vacationDays,
      off: explicitDayOffs + autoDayOffs + plannedDayOffs
    };
  }, [filteredLogs, daysInMonth, today, user.plannedShifts]);

  const machineWorkBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    filteredLogs.forEach(l => {
      if (l.machineId && l.entryType === EntryType.WORK) {
        breakdown[l.machineId] = (breakdown[l.machineId] || 0) + l.durationMinutes;
      }
    });
    return breakdown;
  }, [filteredLogs]);

  const effectivePayroll = useMemo(() => {
     if (user.payroll) return user.payroll;
     const pos = positions.find(p => p.name === user.position);
     return pos?.payroll;
  }, [user, positions]);

  const monthEarnings = useMemo(() => {
    if (!effectivePayroll || !planLimits.features.payroll) return 0;
    
    const todayStr = format(getNow(), 'yyyy-MM-dd');
    const closedWorkLogs = filteredLogs.filter(l => 
      l.entryType === EntryType.WORK && 
      l.checkOut
    );
    
    const logsByDate: Record<string, WorkLog[]> = {};
    closedWorkLogs.forEach(l => {
      if (!logsByDate[l.date]) logsByDate[l.date] = [];
      logsByDate[l.date].push(l);
    });

    let totalEarnings = 0;
    Object.values(logsByDate).forEach(dayLogs => {
      let dayTotalMinutes = 0;
      let hasNightShift = false;
      
      dayLogs.forEach(l => {
        dayTotalMinutes += l.durationMinutes;
        if (l.isNightShift) hasNightShift = true;
      });
      
      let dayEarnings = 0;
      if (effectivePayroll.type === 'hourly') {
        dayEarnings = (dayTotalMinutes / 60) * effectivePayroll.rate;
      } else if (effectivePayroll.type === 'shift') {
        if (dayTotalMinutes > 0) dayEarnings = effectivePayroll.rate;
      }
      
      if (hasNightShift) {
        dayEarnings += effectivePayroll.nightShiftBonus;
      }
      
      totalEarnings += dayEarnings;
    });
    
    return totalEarnings;
  }, [filteredLogs, effectivePayroll, planLimits.features.payroll, getNow]);

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

  const handleForceClose = (logId: string, endTime: string) => {
    const slot = Object.keys(activeShifts).find(key => activeShifts[Number(key)]?.id === logId);
    if (!slot) return;
    
    const currentShift = activeShifts[Number(slot)];
    if (!currentShift) return;

    const now = getNow();
    let duration = calculateMinutes(currentShift.checkIn!, endTime);
    if (currentShift.isNightShift) {
      const bonus = Math.floor((duration / 60) * nightShiftBonusMinutes);
      duration += bonus;
    }

    const completed: WorkLog = { 
      ...currentShift, 
      checkOut: endTime, 
      durationMinutes: Math.max(0, duration),
      isCorrected: true,
      correctionNote: 'Автоматическое завершение (превышен лимит)'
    };

    const nextShifts = { ...activeShifts, [slot]: null };
    onActiveShiftsUpdate(nextShifts);
    onLogsUpsert([completed]);

    // Telegram Notification for Force Close
    if (currentOrg?.telegramSettings?.enabled && currentOrg.telegramSettings.botToken && currentOrg.telegramSettings.chatId && currentOrg.telegramSettings.notifyOnLimitExceeded !== false) {
      const machineName = currentShift.machineId ? getMachineName(currentShift.machineId) : 'Работа';
      const msg = `⛔️ <b>Авто-закрытие смены</b>\n👤 Сотрудник: ${user.name}\n📍 Позиция: ${user.position}\n🔧 Слот: ${slot} (${machineName})\n⚠️ Причина: Превышен лимит времени или выход из гео-зоны`;
      
      // Notify Admin
      sendTelegramNotification(currentOrg.telegramSettings.botToken, currentOrg.telegramSettings.chatId, msg);
      
      // Notify Employee
      if (user.telegramChatId && (user.telegramSettings?.notifyOnLimitExceeded ?? true)) {
         sendTelegramNotification(currentOrg.telegramSettings.botToken, user.telegramChatId, msg);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {Object.values(activeShifts).map(shift => shift && (
        <ShiftMonitor 
          key={shift.id}
          activeShift={shift}
          organization={currentOrg}
          userPosition={positions.find(p => p.name === user.position) || null}
          onForceClose={handleForceClose}
        />
      ))}
      {showPieceworkModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 mb-4">Сдельная оплата</h3>
            <p className="text-sm text-slate-500 mb-4">Введите количество произведенных единиц за эту смену.</p>
            
            <input
              type="number"
              min="0"
              value={itemsProduced}
              onChange={e => setItemsProduced(e.target.value)}
              placeholder="Например: 15"
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 text-lg font-black outline-none focus:border-blue-500 mb-6"
              autoFocus
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPieceworkModal(null);
                  setItemsProduced('');
                }}
                className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  const items = parseInt(itemsProduced, 10);
                  if (isNaN(items) || items < 0) {
                    alert('Пожалуйста, введите корректное число');
                    return;
                  }
                  const { slot, photo } = showPieceworkModal;
                  setShowPieceworkModal(null);
                  setItemsProduced('');
                  handleStopWork(slot, photo, items);
                }}
                className="flex-1 py-3 rounded-xl font-black bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

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

      {showMachineStatsModal && (
        <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Работа на оборудовании</h3>
              <button onClick={() => setShowMachineStatsModal(false)} className="text-slate-400 hover:text-slate-900 text-2xl font-light transition-colors">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar">
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                {Object.keys(machineWorkBreakdown).length === 0 ? (
                  <p className="text-center text-slate-400 py-6 text-[10px] font-bold italic">Нет данных за этот месяц</p>
                ) : (
                  Object.entries(machineWorkBreakdown).map(([mId, mins]) => {
                    const machine = machines.find(m => m.id === mId);
                    if (!machine) return null;
                    return (
                      <div key={mId} className="flex justify-between items-center px-4 py-2.5 bg-white hover:bg-slate-50 transition-colors">
                        <span className="text-[11px] font-bold text-slate-600">{machine.name}</span>
                        <span className="text-[11px] font-black text-blue-600 tabular-nums">{formatDurationShort(mins)}</span>
                      </div>
                    );
                  })
                )}
              </div>
              <button 
                onClick={() => setShowMachineStatsModal(false)}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest text-[10px] mt-4 hover:bg-slate-800 transition-all active:scale-95"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      <EmployeePrintView
        calendarData={calendarData}
        user={user}
        filteredLogs={filteredLogs}
        roundShiftMinutes={currentOrg?.roundShiftMinutes}
      />

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

      {planLimits.features.payroll && effectivePayroll && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex justify-between items-center no-print">
           <div>
              <h3 className="text-emerald-900 font-bold text-lg">Зарплата за месяц</h3>
           </div>
           <div className="text-right">
              <p className="text-3xl font-black text-emerald-600">{Math.floor(monthEarnings)} ₽</p>
           </div>
        </div>
      )}

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
            isPaid={isPaid}
          />

          <TodaySessions
            todayLogs={todayLogs}
            getMachineName={getMachineName}
          />

          {perms.markAbsences && (
            <AbsenceControls
              isAbsentToday={isAbsentToday}
              handleMarkAbsence={handleMarkAbsence}
              isPaid={isPaid}
            />
          )}
        </>
      ) : (
        <div id="print-area">
          <EmployeeStats 
            stats={stats} 
            onShowMachineStats={() => setShowMachineStatsModal(true)}
          />

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
            roundShiftMinutes={currentOrg?.roundShiftMinutes}
            isPaid={isPaid}
          />
        </div>
      )}
    </div>
  );
};

export default EmployeeView;
