
import { format, differenceInMinutes, eachDayOfInterval, endOfMonth } from 'date-fns';
// Using sub-path imports for members that fail to resolve from the main package index
import { parseISO } from 'date-fns/parseISO';
import { startOfMonth } from 'date-fns/startOfMonth';
// Using sub-path for locale to ensure correct resolution of Russian locale
import { ru } from 'date-fns/locale/ru';
import { WorkLog, User, EntryType } from './types';

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
