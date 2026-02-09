
export enum UserRole {
  EMPLOYEE = 'EMPLOYEE',
  EMPLOYER = 'EMPLOYER'
}

export enum EntryType {
  WORK = 'WORK',
  VACATION = 'VACATION',
  SICK = 'SICK',
  DAY_OFF = 'DAY_OFF'
}

export const FIXED_POSITION_TURNER = 'Токарь';

export interface Machine {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  department?: string;
  position: string;
  pin: string; // 4-digit pin
  requirePhoto?: boolean; // New: Mandatory photo capture
}

export interface WorkLog {
  id: string;
  userId: string;
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
}
