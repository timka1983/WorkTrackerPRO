
import { User, UserRole, Machine, WorkLog, EntryType, PositionConfig, PositionPermissions, PlanType, PlanLimits } from './types';

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  [PlanType.FREE]: {
    maxUsers: 3,
    maxMachines: 2,
    features: {
      photoCapture: false,
      nightShift: false,
      advancedAnalytics: false
    }
  },
  [PlanType.PRO]: {
    maxUsers: 20,
    maxMachines: 10,
    features: {
      photoCapture: true,
      nightShift: true,
      advancedAnalytics: true
    }
  },
  [PlanType.BUSINESS]: {
    maxUsers: 1000,
    maxMachines: 1000,
    features: {
      photoCapture: true,
      nightShift: true,
      advancedAnalytics: true
    }
  }
};

export const DEFAULT_PERMISSIONS: PositionPermissions = {
  useMachines: false,
  multiSlot: false,
  viewSelfMatrix: true,
  markAbsences: true,
  defaultRequirePhoto: false,
  isFullAdmin: false,
  isLimitedAdmin: false,
  canUseNightShift: false
};

export const INITIAL_USERS: User[] = [
  { id: '1', name: 'Иван Иванов', role: UserRole.EMPLOYEE, department: 'Цех №1', position: 'Токарь', pin: '0000' },
  { id: '2', name: 'Анна Сидорова', role: UserRole.EMPLOYEE, department: 'Дизайн', position: 'Проектировщик', pin: '0000' },
  { id: '3', name: 'Петр Петров', role: UserRole.EMPLOYEE, department: 'Цех №1', position: 'Токарь', pin: '0000' },
  { id: '4', name: 'Сергей Волков', role: UserRole.EMPLOYEE, department: 'КБ', position: 'Инженер', pin: '0000' },
  { id: 'admin', name: 'Александр Сергеевич', role: UserRole.EMPLOYER, position: 'Менеджер', pin: '0000' }
];

export const INITIAL_MACHINES: Machine[] = [
  { id: 'm1', name: 'Пила Bosch' },
  { id: 'm2', name: 'Станок 502' }
];

export const INITIAL_POSITIONS: PositionConfig[] = [
  { 
    name: 'Токарь', 
    permissions: { ...DEFAULT_PERMISSIONS, useMachines: true, multiSlot: true, canUseNightShift: true } 
  },
  { 
    name: 'Инженер', 
    permissions: { ...DEFAULT_PERMISSIONS, viewSelfMatrix: true } 
  },
  { 
    name: 'Проектировщик', 
    permissions: { ...DEFAULT_PERMISSIONS, viewSelfMatrix: true } 
  },
  { 
    name: 'Менеджер', 
    permissions: { ...DEFAULT_PERMISSIONS, markAbsences: true, isLimitedAdmin: true, canUseNightShift: true } 
  },
  { 
    name: 'Бухгалтер', 
    permissions: { ...DEFAULT_PERMISSIONS, markAbsences: false } 
  },
  { 
    name: 'Другое', 
    permissions: DEFAULT_PERMISSIONS 
  }
];

export const STORAGE_KEYS = {
  WORK_LOGS: 'timesheet_work_logs',
  CURRENT_USER: 'timesheet_current_user',
  USERS_LIST: 'timesheet_users_list',
  MACHINES_LIST: 'timesheet_machines_list',
  POSITIONS_LIST: 'timesheet_positions_list',
  ACTIVE_SHIFTS: 'timesheet_active_shifts',
  LAST_USER_ID: 'timesheet_last_user_id',
  ORG_ID: 'timesheet_org_id',
  ORG_DATA: 'timesheet_org_data',
  PROMO_CODES: 'timesheet_promo_codes',
  OFFLINE_QUEUE: 'timesheet_offline_queue'
};

const savedLogs = localStorage.getItem(STORAGE_KEYS.WORK_LOGS);

// Генерация демо-данных за январь 2024
const generateDemoLogs = (): WorkLog[] => {
  const demoLogs: WorkLog[] = [];
  const users = ['1', '2', '3', '4'];
  
  users.forEach(userId => {
    for (let d = 1; d <= 25; d++) {
      const day = d.toString().padStart(2, '0');
      const date = `2024-01-${day}`;
      const dayOfWeek = new Date(date).getDay();
      
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      if (d === 10) {
         demoLogs.push({
           id: `demo-sick-${userId}-${d}`,
           userId,
           date,
           entryType: EntryType.SICK,
           durationMinutes: 0
         });
         continue;
      }

      if (d > 20 && userId === '2') {
        demoLogs.push({
           id: `demo-vac-${userId}-${d}`,
           userId,
           date,
           entryType: EntryType.VACATION,
           durationMinutes: 0
         });
         continue;
      }

      const randomMinutes = 480 + (d * 3) % 60; 
      demoLogs.push({
        id: `demo-work-${userId}-${d}`,
        userId,
        date,
        entryType: EntryType.WORK,
        checkIn: `${date}T08:00:00Z`,
        checkOut: `${date}T16:00:00Z`,
        durationMinutes: randomMinutes,
        machineId: userId === '1' || userId === '3' ? (d % 2 === 0 ? 'm1' : 'm2') : undefined
      });
    }
  });

  return demoLogs;
};

export const INITIAL_LOGS: WorkLog[] = savedLogs ? JSON.parse(savedLogs) : generateDemoLogs();
