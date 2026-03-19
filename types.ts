
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
    payments: boolean;
    multipleBranches: boolean;
    auditLog: boolean;
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
  notifyOnShiftStart?: boolean;
  notifyOnShiftEnd?: boolean;
  notifyOnLimitExceeded?: boolean;
  lastAlertSentAt?: string;
  lastCleanupAlertSentAt?: string;
}

export interface AutoShiftCompletionSettings {
  enabled: boolean;
  firstAlertMinutes: number;
  secondAlertMinutes: number;
  thirdAlertMinutes: number;
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
  autoShiftCompletion?: AutoShiftCompletionSettings;
  maxShiftDuration?: number; // Global max shift duration in minutes (default 720 = 12h)
  roundShiftMinutes?: boolean; // 15-minute rounding rule
  nightShiftBonus?: number; // Global night shift bonus in minutes
  debugEnabled?: boolean; // Enable debug info for this organization
  createdAt?: string; // ISO timestamp
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
  type: 'hourly' | 'fixed' | 'shift' | 'piecework';
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
  isArchived?: boolean;
  archivedAt?: string;
  archiveReason?: string;
  createdAt?: string;
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
  telegramSettings?: {
    notifyOnShiftStart: boolean;
    notifyOnShiftEnd: boolean;
    notifyOnLimitExceeded: boolean;
  };
  isArchived?: boolean;
  archivedAt?: string;
  archiveReason?: string;
  createdAt?: string;
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
  itemsProduced?: number; // Количество произведенных единиц для сдельной оплаты
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export enum PayrollStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  PAID = 'PAID'
}

export interface PayrollPeriod {
  id: string;
  organizationId: string;
  month: string; // YYYY-MM
  status: PayrollStatus;
  closedAt?: string;
  closedBy?: string;
}

export interface PayrollSnapshot {
  id: string;
  userId: string;
  organizationId: string;
  month: string; // YYYY-MM
  totalMinutes: number;
  totalSalary: number;
  bonuses: number;
  fines: number;
  rateUsed: number;
  rateType: 'hourly' | 'fixed' | 'shift' | 'piecework';
  calculatedAt: string; // ISO timestamp
  details: any; // Store the full calculation details as JSON
}

export interface SupportMessage {
  id: string;
  senderId: string;
  senderName: string;
  organizationId: string;
  message: string;
  createdAt: string;
}

export enum PaymentType {
  ADVANCE = 'advance',
  SALARY = 'salary',
  BONUS = 'bonus',
  FINE = 'fine',
  OTHER = 'other'
}

export interface PayrollPayment {
  id: string;
  userId: string;
  organizationId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: PaymentType;
  comment?: string;
  createdAt: string; // ISO timestamp
}
