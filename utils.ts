
import { format, differenceInMinutes, eachDayOfInterval, endOfMonth } from 'date-fns';
// Using sub-path imports for members that fail to resolve from the main package index
import { parseISO } from 'date-fns/parseISO';
import { startOfMonth } from 'date-fns/startOfMonth';
// Using sub-path for locale to ensure correct resolution of Russian locale
import { ru } from 'date-fns/locale/ru';
import { WorkLog, User, EntryType, PositionConfig, PayrollConfig } from './types';

export const formatTime = (dateStr?: string) => {
  if (!dateStr) return '--:--';
  return format(parseISO(dateStr), 'HH:mm');
};

export const formatDate = (dateStr: string) => {
  return format(parseISO(dateStr), 'd MMMM yyyy', { locale: ru });
};

export const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}ч ${m}м`;
};

export const formatDurationShort = (minutes: number) => {
  if (minutes === 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
};

export const calculateMinutes = (start: string, end: string) => {
  return differenceInMinutes(parseISO(end), parseISO(start));
};

export const getDaysInMonthArray = (monthStr: string) => {
  const start = startOfMonth(parseISO(`${monthStr}-01`));
  const end = endOfMonth(start);
  return eachDayOfInterval({ start, end });
};

export const exportToCSV = (logs: WorkLog[], users: User[]) => {
  const header = ['Дата', 'Сотрудник', 'Тип', 'Начало', 'Конец', 'Минуты', 'Часы'].join(';');
  const rows = logs.map(log => {
    const user = users.find(u => u.id === log.userId);
    return [
      log.date,
      user?.name || 'Удален',
      log.entryType,
      log.checkIn ? formatTime(log.checkIn) : '',
      log.checkOut ? formatTime(log.checkOut) : '',
      log.durationMinutes,
      (log.durationMinutes / 60).toFixed(2)
    ].join(';');
  });

  const csvContent = "\uFEFF" + [header, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
};

export const sendNotification = (title: string, body: string) => {
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/manifest.json' });
  }
};

export const calculateMonthlyPayroll = (
  user: User,
  logs: WorkLog[],
  positions: PositionConfig[]
): {
  totalSalary: number;
  regularPay: number;
  overtimePay: number;
  nightShiftPay: number;
  sickLeavePay: number;
  bonuses: number;
  fines: number;
  details: {
    regularHours: number;
    overtimeHours: number;
    nightShiftCount: number;
    sickDays: number;
  };
} => {
  const positionConfig = positions.find(p => p.name === user.position);
  const config = user.payroll || positionConfig?.payroll || {
    type: 'hourly',
    rate: 0,
    overtimeMultiplier: 1.5,
    nightShiftBonus: 0,
    sickLeaveRate: 0,
    machineRates: {}
  };

  let regularPay = 0;
  let overtimePay = 0;
  let nightShiftPay = 0;
  let sickLeavePay = 0;
  let bonuses = 0;
  let fines = 0;

  let regularHours = 0;
  let overtimeHours = 0;
  let nightShiftCount = 0;
  let sickDays = 0;

  const standardShiftMinutes = positionConfig?.permissions.maxShiftDurationMinutes || 480;

  logs.forEach(log => {
    if (log.entryType === EntryType.WORK) {
      const duration = log.durationMinutes;
      let regularMinutes = duration;
      let overtimeMinutes = 0;

      if (duration > standardShiftMinutes) {
        regularMinutes = standardShiftMinutes;
        overtimeMinutes = duration - standardShiftMinutes;
      }

      // Determine the rate to use
      let currentRate = config.rate;
      if (log.machineId && config.machineRates && config.machineRates[log.machineId] !== undefined) {
        currentRate = config.machineRates[log.machineId];
      }

      if (config.type === 'hourly') {
        regularPay += (regularMinutes / 60) * currentRate;
        overtimePay += (overtimeMinutes / 60) * currentRate * config.overtimeMultiplier;
      } else if (config.type === 'shift') {
        regularPay += currentRate;
        const impliedHourlyRate = currentRate / (standardShiftMinutes / 60);
        overtimePay += (overtimeMinutes / 60) * impliedHourlyRate * config.overtimeMultiplier;
      }

      regularHours += regularMinutes / 60;
      overtimeHours += overtimeMinutes / 60;

      if (log.isNightShift) {
        nightShiftCount++;
        nightShiftPay += config.nightShiftBonus;
      }
    } else if (log.entryType === EntryType.SICK) {
      sickDays++;
      if (config.sickLeaveRate) {
        sickLeavePay += config.sickLeaveRate;
      }
    }

    if (log.fine) {
      fines += log.fine;
    }
    if (log.bonus) {
      bonuses += log.bonus;
    }
  });

  if (config.type === 'fixed') {
    regularPay = config.rate;
    const impliedHourlyRate = config.rate / 160;
    overtimePay = overtimeHours * impliedHourlyRate * config.overtimeMultiplier;
  }

  const totalSalary = regularPay + overtimePay + nightShiftPay + sickLeavePay + bonuses - fines;

  return {
    totalSalary: Math.max(0, Math.round(totalSalary)),
    regularPay: Math.round(regularPay),
    overtimePay: Math.round(overtimePay),
    nightShiftPay: Math.round(nightShiftPay),
    sickLeavePay: Math.round(sickLeavePay),
    bonuses: Math.round(bonuses),
    fines: Math.round(fines),
    details: {
      regularHours: parseFloat(regularHours.toFixed(1)),
      overtimeHours: parseFloat(overtimeHours.toFixed(1)),
      nightShiftCount,
      sickDays
    }
  };
};
