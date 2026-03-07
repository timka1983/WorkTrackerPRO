
export enum UserRole {
  EMPLOYEE = 'EMPLOYEE',
  EMPLOYER = 'EMPLOYER',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export enum EntryType {
  WORK = 'WORK',
  VACATION = 'VACATION',
  SICK = 'SICK',
  DAY_OFF = 'DAY_OFF'
}

export enum PlanType {
  FREE = 'FREE',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS'
}

export interface PlanLimits {
  maxUsers: number;
  maxMachines: number;
  features: {
    photoCapture: boolean;
    nightShift: boolean;
    advancedAnalytics: boolean;
    payroll: boolean;
    shiftMonitoring: boolean;
  };
}

export interface Plan {
  type: PlanType;
  name: string;
  limits: PlanLimits;
  price: number;
}

export interface PromoCode {
  id: string;
  code: string;
  planType: PlanType;
  durationDays: number;
  maxUses: number;
  usedCount: number;
  createdAt: string;
  expiresAt?: string;
  isActive: boolean;
  lastUsedBy?: string; // ID or Name of the organization that last used it
  lastUsedAt?: string; // ISO timestamp of last usage
}

export interface LocationSettings {
  enabled: boolean;
  latitude: number;
  longitude: number;
  radius: number; // in meters
}

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  address?: string;
  locationSettings?: LocationSettings;
}

export interface TelegramSettings {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export interface Organization {
  id: string;
  name: string;
  email?: string;
  ownerId: string;
  plan: PlanType;
  status: 'active' | 'trial' | 'expired';
  expiryDate?: string;
  notificationSettings?: {
    onShiftStart: boolean;
    onShiftEnd: boolean;
    onOvertime: boolean;
  };
  locationSettings?: LocationSettings;
  telegramSettings?: TelegramSettings;
  maxShiftDuration?: number; // Global max shift duration in minutes (default 720 = 12h)
  roundShiftMinutes?: boolean; // 15-minute rounding rule
}

export const FIXED_POSITION_TURNER = 'Токарь';

export interface PositionPermissions {
  useMachines: boolean;
  multiSlot: number; // 0 - disabled, 2 - 2 slots, 3 - 3 slots
  calculateOvertime: boolean;
  viewSelfMatrix: boolean;
  markAbsences: boolean;
  defaultRequirePhoto: boolean;
  isFullAdmin: boolean;
  isLimitedAdmin: boolean;
  canUseNightShift: boolean;
  maxShiftDurationMinutes?: number; // Override global setting
}

export interface PayrollConfig {
  type: 'hourly' | 'fixed' | 'shift';
  rate: number; 
  overtimeMultiplier: number;
  nightShiftBonus: number;
  sickLeaveRate?: number;
  machineRates?: Record<string, number>;
  overrides?: {
    type?: boolean;
    rate?: boolean;
    overtimeMultiplier?: boolean;
    nightShiftBonus?: boolean;
    sickLeaveRate?: boolean;
    machineRates?: boolean;
  };
}

export interface PositionConfig {
  name: string;
  organizationId?: string;
  permissions: PositionPermissions;
  payroll?: PayrollConfig;
}

export interface Machine {
  id: string;
  name: string;
  organizationId?: string;
  branchId?: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  department?: string;
  position: string;
  pin: string; // 4-digit pin
  requirePhoto?: boolean; // Mandatory photo capture
  isAdmin?: boolean; // Admin privileges
  forcePinChange?: boolean; // Mandatory PIN change on next login
  organizationId?: string;
  branchId?: string;
  pushToken?: string;
  plannedShifts?: Record<string, string>; // YYYY-MM-DD -> 'Р' | 'В' | 'Д' | 'О' | 'Н'
  payroll?: PayrollConfig;
  telegramChatId?: string; // Personal Telegram Chat ID for notifications
}

export interface WorkLog {
  id: string;
  userId: string;
  organizationId?: string;
  branchId?: string;
  date: string; // ISO Date YYYY-MM-DD
  entryType: EntryType;
  machineId?: string; // Reference to machine id
  checkIn?: string; // ISO Datetime
  checkOut?: string; // ISO Datetime
  durationMinutes: number;
  photoIn?: string; // Base64 or URL capture on start
  photoOut?: string; // Base64 or URL capture on end
  isCorrected?: boolean;
  correctionNote?: string;
  correctionTimestamp?: string;
  isNightShift?: boolean; // Флаг ночной смены
  fine?: number; // Штраф за смену
  bonus?: number; // Премия за смену
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}
