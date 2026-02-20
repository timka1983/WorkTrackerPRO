
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
}

export interface Organization {
  id: string;
  name: string;
  email?: string;
  ownerId: string;
  plan: PlanType;
  status: 'active' | 'trial' | 'expired';
  expiryDate?: string;
}

export const FIXED_POSITION_TURNER = 'Токарь';

export interface PositionPermissions {
  useMachines: boolean;
  multiSlot: boolean;
  viewSelfMatrix: boolean;
  markAbsences: boolean;
  defaultRequirePhoto: boolean;
  isFullAdmin: boolean;
  isLimitedAdmin: boolean;
  canUseNightShift: boolean;
}

export interface PositionConfig {
  name: string;
  organizationId?: string;
  permissions: PositionPermissions;
}

export interface Machine {
  id: string;
  name: string;
  organizationId?: string;
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
}

export interface WorkLog {
  id: string;
  userId: string;
  organizationId?: string;
  date: string; // ISO Date YYYY-MM-DD
  entryType: EntryType;
  machineId?: string; // Reference to machine id
  checkIn?: string; // ISO Datetime
  checkOut?: string; // ISO Datetime
  durationMinutes: number;
  photoIn?: string; // Base64 capture on start
  photoOut?: string; // Base64 capture on end
  isCorrected?: boolean;
  correctionNote?: string;
  correctionTimestamp?: string;
  isNightShift?: boolean; // Флаг ночной смены
}
