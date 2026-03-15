import { STORAGE_KEYS } from '../constants';
import { db } from './supabase';

export interface AuditLogEntry {
  id: string;
  orgId: string;
  timestamp: string;
  adminId: string;
  adminName: string;
  action: string;
  details: string;
  changes?: string;
  targetUserId?: string;
  targetUserName?: string;
}

export const logAuditAction = async (
  orgId: string,
  adminId: string,
  adminName: string,
  action: string,
  details: string,
  targetUserId?: string,
  targetUserName?: string,
  changes?: string
) => {
  try {
    const newEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      orgId,
      timestamp: new Date().toISOString(),
      adminId,
      adminName,
      action,
      details,
      targetUserId,
      targetUserName,
      changes
    };

    // Save to Supabase
    await db.saveAuditLog(newEntry);

    // Also keep in localStorage for immediate UI updates if needed, 
    // though the view should ideally fetch from DB
    const key = `${STORAGE_KEYS.AUDIT_LOGS}_${orgId}`;
    const existing = localStorage.getItem(key);
    const logs: AuditLogEntry[] = existing ? JSON.parse(existing) : [];
    
    logs.unshift(newEntry);
    if (logs.length > 1000) {
      logs.length = 1000;
    }
    localStorage.setItem(key, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save audit log', e);
  }
};

export const getAuditLogs = async (orgId: string): Promise<AuditLogEntry[]> => {
  try {
    // Try Supabase first
    const dbLogs = await db.getAuditLogs(orgId);
    if (dbLogs) return dbLogs;

    // Fallback to localStorage
    const key = `${STORAGE_KEYS.AUDIT_LOGS}_${orgId}`;
    const existing = localStorage.getItem(key);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    console.error('Failed to get audit logs', e);
    return [];
  }
};
