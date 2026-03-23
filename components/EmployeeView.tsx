
import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { WorkLog, User, EntryType, Machine, PositionConfig, PlanLimits, Organization, PayrollPeriod, PayrollStatus, PayrollPayment, LocationSettings } from '../types';
import { formatTime, formatDate, formatDuration, calculateMinutes, getDaysInMonthArray, formatDurationShort, sendNotification, calculateDistance, sendTelegramNotification, applyRounding, getEffectivePayrollConfig, calculateMonthlyPayroll } from '../utils';
import { STORAGE_KEYS, DEFAULT_PERMISSIONS } from '../constants';
import { format, isAfter, endOfMonth, eachDayOfInterval, getDay, addMonths, startOfDay, startOfMonth, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale/ru';
import { db } from '../lib/supabase';
import { X, CreditCard, History, Info, TrendingUp, TrendingDown } from 'lucide-react';
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
  activeShiftsMap?: Record<string, any>;
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
  payments?: PayrollPayment[];
}

const BIRTHDAY_GREETINGS = [
  "Желаем крепкого здоровья, успехов в работе и отличного настроения! Пусть каждый день приносит только радость! 🥳✨",
  "Пусть этот год станет для вас временем новых достижений, ярких побед и исполнения самых заветных желаний! 🚀🎂",
  "Желаем неиссякаемой энергии, вдохновения и благополучия во всём! С праздником! 🎈🌟",
  "Пусть в жизни будет больше поводов для улыбок, а каждый рабочий день приносит удовлетворение и успех! 💼🎉",
  "Желаем, чтобы каждый новый день был лучше предыдущего, а удача всегда была на вашей стороне! 🍀🎁",
  "Пусть работа будет в радость, а дома всегда ждут тепло, уют и близкие люди! С днём рождения! 🏠❤️",
  "Желаем финансового процветания, карьерного роста и личного счастья! Ура! 💰📈",
  "Пусть этот день будет полон сюрпризов, цветов и добрых слов! Вы — важная часть нашей команды! 💐🤝",
  "Желаем всегда оставаться таким же энергичным и целеустремленным человеком! Только вперед! 🏃‍♂️🔥",
  "Пусть жизнь играет яркими красками, а сердце всегда будет наполнено любовью и добротой! 🌈💖",
  "Желаем стального здоровья, железного терпения и золотых успехов! С днём рождения! 🛠️🥇",
  "Пусть мечты сбываются, а цели достигаются легко и непринужденно! Поздравляем! 🎯🎊",
  "Желаем гармонии в душе, мира в семье и процветания в делах! 🕊️✨",
  "Пусть каждый миг будет наполнен смыслом и радостью! Счастья и удачи! ⏳🎈",
  "Желаем, чтобы ваша жизнь была похожа на сказку, полную чудес и приятных событий! 🪄🏰"
];

const EmployeeView: React.FC<EmployeeViewProps> = ({ 
  user, logs, logsLookup = {}, onLogsUpsert, activeShifts, activeShiftsMap = {}, onActiveShiftsUpdate, onOvertime, machines, positions, onUpdateUser, nightShiftBonusMinutes, onRefresh, planLimits, currentOrg, onMonthChange, getNow, viewMode, setViewMode, payments = []
}) => {
  const orgId = localStorage.getItem(STORAGE_KEYS.ORG_ID) || 'default_org';

  const perms = useMemo(() => {
    const config = positions.find(p => p.name === user.position);
    return config?.permissions || DEFAULT_PERMISSIONS;
  }, [user.position, positions]);

  const [overtimeAlerts, setOvertimeAlerts] = useState<Record<number, boolean>>({});
  const [overdueStages, setOverdueStages] = useState<Record<number, { stage: number, lastCheck: number }>>({});

  const checkGeoZone = (coords: GeolocationCoordinates, locationSettings?: LocationSettings) => {
    if (!locationSettings || !locationSettings.enabled) return true;
    const distance = calculateDistance(coords.latitude, coords.longitude, locationSettings.latitude, locationSettings.longitude);
    return distance <= locationSettings.radius;
  };

  useEffect(() => {
    const checkOvertime = async () => {
      if (!perms.maxShiftDurationMinutes || !planLimits.features.advancedAnalytics) return; 

      const now = getNow();
      const updatedAlerts = { ...overtimeAlerts };
      const updatedOverdueStages = { ...overdueStages };
      let changed = false;

      for (const [slotStr, shift] of Object.entries(activeShifts)) {
        const slot = Number(slotStr);
        if (shift && shift.checkIn) {
          const duration = calculateMinutes(shift.checkIn, now.toISOString());
          const limit = perms.maxShiftDurationMinutes!;
          const autoShift = currentOrg?.autoShiftCompletion;
          const firstInterval = autoShift?.enabled ? autoShift.firstAlertMinutes : 14;
          const secondInterval = autoShift?.enabled ? autoShift.secondAlertMinutes : 5;
          const thirdInterval = autoShift?.enabled ? autoShift.thirdAlertMinutes : 5;
          const limitWithBuffer = limit + firstInterval;
          
          if (duration > limitWithBuffer) {
            if (!updatedOverdueStages[slot]) {
              // Stage 1: firstInterval mark
              updatedOverdueStages[slot] = { stage: 1, lastCheck: now.getTime() };
              changed = true;
              
              // Check Geo
              try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
                });
                
                const isInZone = checkGeoZone(position.coords, currentOrg?.locationSettings);
                
                if (!isInZone) {
                  handleForceClose(shift.id, now.toISOString());
                } else {
                  sendNotification('Смена не завершена', `Вы работаете уже более ${Math.floor(limitWithBuffer / 60)} часов. Не забудьте завершить смену!`);
                }
              } catch (e) {
                console.error("Geo error:", e);
              }
            } else if (updatedOverdueStages[slot].stage === 1 && now.getTime() - updatedOverdueStages[slot].lastCheck > secondInterval * 60 * 1000) {
              // Stage 2: secondInterval later
              updatedOverdueStages[slot] = { stage: 2, lastCheck: now.getTime() };
              changed = true;
              // Check Geo again
              try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                  navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
                });
                const isInZone = checkGeoZone(position.coords, currentOrg?.locationSettings);
                if (!isInZone) {
                  handleForceClose(shift.id, now.toISOString());
                  delete updatedOverdueStages[slot];
                }
              } catch (e) {
                console.error("Geo error:", e);
              }
            } else if (updatedOverdueStages[slot].stage === 2 && now.getTime() - updatedOverdueStages[slot].lastCheck > thirdInterval * 60 * 1000) {
              // Stage 3: thirdInterval later
              handleForceClose(shift.id, now.toISOString());
              delete updatedOverdueStages[slot];
              changed = true;
            }
          } else if (duration <= limitWithBuffer && updatedOverdueStages[slot]) {
            delete updatedOverdueStages[slot];
            changed = true;
          }
        }
      }

      if (changed) {
        setOverdueStages(updatedOverdueStages);
        setOvertimeAlerts(updatedAlerts);
      }
    };

    const interval = setInterval(checkOvertime, 60000);
    checkOvertime();
    return () => clearInterval(interval);
  }, [activeShifts, perms.maxShiftDurationMinutes, overtimeAlerts, planLimits, user, onOvertime, getNow]);

  const [slotMachineIds, setSlotMachineIds] = useState<Record<number, string>>({ 1: '', 2: '', 3: '' });
  const [showPayrollModal, setShowPayrollModal] = useState(false);

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
  const [isProcessingAction, setIsProcessingAction] = useState(false);
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
    const ids: string[] = [];
    Object.values(activeShiftsMap || {}).forEach((userShifts) => {
      if (userShifts) {
        Object.values(userShifts).forEach((shift: any) => {
          if (shift && shift.machineId) {
            ids.push(shift.machineId);
          }
        });
      }
    });
    return ids;
  }, [activeShiftsMap]);

  const todayStr = format(getNow(), 'yyyy-MM-dd');
  const isBirthday = useMemo(() => {
    if (!user.birthday) return false;
    const today = getNow();
    const birthday = new Date(user.birthday);
    return today.getDate() === birthday.getDate() && today.getMonth() === birthday.getMonth();
  }, [user.birthday, getNow]);

  const birthdayGreeting = useMemo(() => {
    if (!isBirthday) return "";
    // Use user.id and current year as a seed for stable randomness
    const year = getNow().getFullYear();
    const seed = user.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + year;
    return BIRTHDAY_GREETINGS[seed % BIRTHDAY_GREETINGS.length];
  }, [isBirthday, user.id, getNow]);

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
    const video = videoRef.current;
    
    // Оптимизация размера: ограничиваем максимальное измерение до 800px
    const MAX_DIMENSION = 800;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > height) {
      if (width > MAX_DIMENSION) {
        height *= MAX_DIMENSION / width;
        width = MAX_DIMENSION;
      }
    } else {
      if (height > MAX_DIMENSION) {
        width *= MAX_DIMENSION / height;
        height = MAX_DIMENSION;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0, width, height);
    
    // Качество 0.5 достаточно для фотофиксации и значительно уменьшает размер файла
    return canvas.toDataURL('image/jpeg', 0.5);
  };

  const processAction = async (slot: number, type: 'start' | 'stop') => {
    if (isProcessingAction) return;
    
    if (type === 'start') {
      if (activeShifts[slot]) {
        console.warn('Shift already active in slot', slot);
        return;
      }

      setIsProcessingAction(true);
      try {
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
                   setIsProcessingAction(false);
                   return;
               }
               
               locationData = {
                   latitude: position.coords.latitude,
                   longitude: position.coords.longitude,
                   accuracy: position.coords.accuracy
               };
           } catch (e) {
               alert('Ошибка геолокации. Разрешите доступ к геопозиции для начала смены.');
               setIsProcessingAction(false);
               return;
           }
        }

        if (perms.useMachines) {
          const selectedMachineId = slotMachineIds[slot];
          if (!selectedMachineId) {
            alert("Пожалуйста, выберите оборудование перед началом смены!");
            setIsProcessingAction(false);
            return;
          }
          if (busyMachineIds.includes(selectedMachineId)) {
            alert("Это оборудование уже занято другим сотрудником!");
            setIsProcessingAction(false);
            return;
          }
        }

        const activeCount = Object.values(activeShifts).filter(s => s !== null).length;
        const requirePhoto = user.requirePhoto || perms.defaultRequirePhoto;
        
        if (requirePhoto) {
            if (activeCount === 0) {
              setShowCamera({ slot, type, location: locationData });
              // isProcessingAction will be set to false after photo capture or cancel
            } else {
              await handleStartWork(slot, undefined, locationData);
              setIsProcessingAction(false);
            }
        } else {
            await handleStartWork(slot, undefined, locationData);
            setIsProcessingAction(false);
        }
      } catch (e) {
        console.error('Error processing start action:', e);
        setIsProcessingAction(false);
      }
    } else {
      // Stop work logic
      if (!activeShifts[slot]) {
        console.warn('No active shift in slot to stop', slot);
        return;
      }

      setIsProcessingAction(true);
      try {
        const activeCount = Object.values(activeShifts).filter(s => s !== null).length;
        const requirePhoto = user.requirePhoto || perms.defaultRequirePhoto;

        if (requirePhoto) {
          if (activeCount === 1) {
            setShowCamera({ slot, type });
            // isProcessingAction will be set to false after photo capture or cancel
          } else {
            await handleStopWork(slot);
            setIsProcessingAction(false);
          }
        } else {
          await handleStopWork(slot);
          setIsProcessingAction(false);
        }
      } catch (e) {
        console.error('Error processing stop action:', e);
        setIsProcessingAction(false);
      }
    }
  };

  const handleStartWork = async (slot: number, photo?: string, location?: any) => {
    if (activeShifts[slot]) return;

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
    try {
      await Promise.all([
        onActiveShiftsUpdate(nextShifts),
        onLogsUpsert([newShift])
      ]);
    } catch (e) {
      console.error("Failed to sync start work:", e);
    }
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

  const handleStopWork = async (slot: number, photo?: string, items?: number) => {
    const currentShift = activeShifts[slot];
    if (!currentShift) return;
    
    const isPiecework = getEffectivePayrollConfig(user, positions).type === 'piecework';
    
    if (isPiecework && items === undefined) {
      setShowPieceworkModal({ slot, photo });
      setItemsProduced('');
      return;
    }
    
    const now = getNow();
    let duration = calculateMinutes(currentShift.checkIn!, now.toISOString());
    
    if (currentShift.isNightShift && nightShiftBonusMinutes > 0) {
      const bonus = Math.floor(duration * (nightShiftBonusMinutes / 100));
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
    try {
      await Promise.all([
        onActiveShiftsUpdate(nextShifts),
        onLogsUpsert([completed])
      ]);
    } catch (e) {
      console.error("Failed to sync stop work:", e);
    }
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
     return getEffectivePayrollConfig(user, positions);
  }, [user, positions]);

  const payrollDetails = useMemo(() => {
    if (!effectivePayroll || !planLimits.features.payroll) return null;
    
    const closedWorkLogs = filteredLogs.filter(l => 
      l.entryType !== EntryType.WORK || l.checkOut
    );
    
    return calculateMonthlyPayroll(user, closedWorkLogs, positions, currentOrg || undefined);
  }, [filteredLogs, effectivePayroll, planLimits.features.payroll, user, positions, currentOrg]);

  const monthEarnings = payrollDetails?.totalSalary || 0;

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
    if (currentShift.isNightShift && nightShiftBonusMinutes > 0) {
      const bonus = Math.floor(duration * (nightShiftBonusMinutes / 100));
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
    <div className="space-y-6 animate-fadeIn dark:text-slate-100">
      {isBirthday && (
        <div className="relative overflow-hidden bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-[2.5rem] p-8 text-white shadow-2xl dark:shadow-slate-900/40 animate-fadeIn mb-6">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-[-10%] left-[10%] animate-bounce delay-100">🎈</div>
            <div className="absolute top-[20%] right-[15%] animate-bounce delay-300">🎈</div>
            <div className="absolute bottom-[10%] left-[20%] animate-bounce delay-500">🎈</div>
            <div className="absolute top-[40%] left-[5%] animate-bounce delay-200">🎈</div>
            <div className="absolute bottom-[20%] right-[5%] animate-bounce delay-400">🎈</div>
          </div>
          
          <div className="relative z-10 flex flex-col items-center text-center space-y-4">
            <div className="text-6xl animate-bounce">🎂</div>
            <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter drop-shadow-lg">
              С Днём рождения! УРА!!!
            </h2>
            <p className="text-lg font-bold opacity-90 max-w-md">
              {birthdayGreeting}
            </p>
            <div className="flex gap-2">
              <span className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-widest">Праздник</span>
              <span className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-widest">Радость</span>
              <span className="px-4 py-2 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-widest">Успех</span>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div 
                key={i}
                className="absolute animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  fontSize: `${Math.random() * 20 + 10}px`,
                  opacity: 0.3
                }}
              >
                ✨
              </div>
            ))}
          </div>
        </div>
      )}

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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 w-full max-w-sm shadow-2xl dark:shadow-slate-900/40 border border-slate-100 dark:border-slate-800 transition-all">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-6">
              <CreditCard className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50 dark:text-white mb-2">Сдельная оплата</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">Введите количество произведенных единиц за эту смену для расчета оплаты.</p>
            
            <div className="relative mb-8">
              <input
                type="number"
                min="0"
                value={itemsProduced}
                onChange={e => setItemsProduced(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-2xl px-6 py-4 text-3xl font-black outline-none focus:border-blue-500 dark:focus:border-blue-400 text-slate-900 dark:text-slate-50 dark:text-white transition-all text-center"
                autoFocus
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 dark:text-slate-400 font-bold">шт.</div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPieceworkModal(null);
                  setItemsProduced('');
                }}
                className="flex-1 py-4 rounded-2xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  const items = parseInt(itemsProduced, 10);
                  if (isNaN(items) || items < 0) {
                    alert('Пожалуйста, введите корректное число');
                    return;
                  }
                  const { slot, photo } = showPieceworkModal;
                  setShowPieceworkModal(null);
                  setItemsProduced('');
                  setIsProcessingAction(true);
                  try {
                    await handleStopWork(slot, photo, items);
                  } finally {
                    setIsProcessingAction(false);
                  }
                }}
                className="flex-[2] py-4 rounded-2xl font-black bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-xl dark:shadow-slate-900/20 shadow-blue-600/20 dark:shadow-blue-900/40 active:scale-95"
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
          <div className="bg-white rounded-[2rem] w-full max-w-sm shadow-2xl dark:shadow-slate-900/40 border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight text-sm">Работа на оборудовании</h3>
              <button onClick={() => setShowMachineStatsModal(false)} className="text-slate-400 hover:text-slate-900 dark:text-slate-50 text-2xl font-light transition-colors">&times;</button>
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
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{machine.name}</span>
                        <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 tabular-nums">{formatDurationShort(mins)}</span>
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
                ? await handleStartWork(showCamera.slot, photoUrl || undefined, showCamera.location) 
                : await handleStopWork(showCamera.slot, photoUrl || undefined);
            }
          } finally {
            setIsUploadingPhoto(false);
            setIsProcessingAction(false);
          }
        }}
        onCancel={() => {
          setShowCamera(null);
          setIsProcessingAction(false);
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
        <div 
          onClick={() => setShowPayrollModal(true)}
          className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex justify-between items-center no-print cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors active:scale-[0.98] shadow-md dark:shadow-[0_0_20px_rgba(255,255,255,0.05)]"
        >
           <div>
              <h3 className="text-emerald-900 font-bold text-base">Зарплата за месяц</h3>
              <p className="text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">Нажмите для расшифровки</p>
           </div>
           <div className="text-right">
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{Math.floor(monthEarnings)} ₽</p>
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
            isProcessingAction={isProcessingAction}
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

      {showPayrollModal && (
        <PayrollBreakdownModal
          user={user}
          monthEarnings={monthEarnings}
          payrollDetails={payrollDetails}
          payments={payments}
          filterMonth={filterMonth}
          onClose={() => setShowPayrollModal(false)}
        />
      )}
    </div>
  );
};

interface PayrollBreakdownModalProps {
  user: User;
  monthEarnings: number;
  payrollDetails: any;
  payments: PayrollPayment[];
  filterMonth: string;
  onClose: () => void;
}

const PayrollBreakdownModal: React.FC<PayrollBreakdownModalProps> = ({
  user, monthEarnings, payrollDetails, payments, filterMonth, onClose
}) => {
  if (!payrollDetails) return null;

  const monthPayments = useMemo(() => {
    return payments.filter(p => p.userId === user.id && p.date.startsWith(filterMonth));
  }, [payments, user.id, filterMonth]);

  const totalPaid = useMemo(() => {
    return monthPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [monthPayments]);

  const balance = monthEarnings - totalPaid;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl dark:shadow-slate-900/40 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">Расшифровка зарплаты</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase mt-0.5">
              {format(new Date(filterMonth + '-01'), 'LLLL yyyy', { locale: ru })}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400 hover:text-slate-600 dark:text-slate-300 shadow-md dark:shadow-slate-900/20"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Total Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Начислено</p>
              <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{Math.floor(monthEarnings)} ₽</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase mb-1">Выплачено</p>
              <p className="text-lg font-extrabold text-blue-600 dark:text-blue-400">{Math.floor(totalPaid)} ₽</p>
            </div>
          </div>

          {/* Balance */}
          <div className={`p-4 rounded-2xl border flex justify-between items-center ${balance > 0 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
            <div>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Остаток к выплате</p>
              <p className={`text-lg font-black ${balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                {Math.floor(balance)} ₽
              </p>
            </div>
            <div className={`p-2 rounded-xl ${balance > 0 ? 'bg-amber-100 text-amber-600 dark:text-amber-400' : 'bg-slate-200 text-slate-400'}`}>
              <CreditCard size={20} />
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Info size={12} /> Детализация начислений
            </h4>
            
            <div className="space-y-2">
              {payrollDetails.regularPay > 0 && (
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Основная оплата ({payrollDetails.details.regularHours} ч)</span>
                  <span className="font-bold text-slate-900 dark:text-slate-50">{Math.floor(payrollDetails.regularPay)} ₽</span>
                </div>
              )}
              {payrollDetails.overtimePay > 0 && (
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Сверхурочные ({payrollDetails.details.overtimeHours} ч)</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">+{Math.floor(payrollDetails.overtimePay)} ₽</span>
                </div>
              )}
              {payrollDetails.nightShiftPay > 0 && (
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Ночные смены ({payrollDetails.details.nightShiftCount})</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">+{Math.floor(payrollDetails.nightShiftPay)} ₽</span>
                </div>
              )}
              {payrollDetails.bonuses > 0 && (
                <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="text-sm font-medium text-emerald-700 flex items-center gap-1">
                    <TrendingUp size={14} /> Премии
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">+{Math.floor(payrollDetails.bonuses)} ₽</span>
                </div>
              )}
              {payrollDetails.fines > 0 && (
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-xl border border-red-100">
                  <span className="text-sm font-medium text-red-700 flex items-center gap-1">
                    <TrendingDown size={14} /> Штрафы
                  </span>
                  <span className="font-bold text-red-600 dark:text-red-400">-{Math.floor(payrollDetails.fines)} ₽</span>
                </div>
              )}
              {payrollDetails.sickLeavePay > 0 && (
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Больничные ({payrollDetails.details.sickDays} дн)</span>
                  <span className="font-bold text-slate-900 dark:text-slate-50">{Math.floor(payrollDetails.sickLeavePay)} ₽</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment History */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <History size={12} /> История выплат
            </h4>
            
            {monthPayments.length > 0 ? (
              <div className="space-y-2">
                {monthPayments.map(payment => (
                  <div key={payment.id} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100 shadow-md dark:shadow-slate-900/20">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                        {payment.type === 'advance' ? 'Аванс' : 
                         payment.type === 'salary' ? 'Зарплата' : 
                         payment.type === 'bonus' ? 'Премия' : 
                         payment.type === 'fine' ? 'Штраф' : 'Выплата'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium uppercase">{format(new Date(payment.date), 'd MMMM', { locale: ru })}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900 dark:text-slate-50">{payment.amount} ₽</p>
                      {payment.comment && <p className="text-[10px] text-slate-400 italic">{payment.comment}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-400 font-medium italic">Выплат в этом месяце еще не было</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-colors shadow-xl dark:shadow-slate-900/20 active:scale-[0.98]"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeView;
