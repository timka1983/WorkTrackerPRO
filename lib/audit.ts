import { STORAGE_KEYS } from '../constants';

export interface AuditLogEntry {
  id: string;
  orgId: string;
  timestamp: string;
  adminId: string;
  adminName: string;
  action: string;
  details: string;
  targetUserId?: string;
  targetUserName?: string;
}

export const logAuditAction = (
  orgId: string,
  adminId: string,
  adminName: string,
  action: string,
  details: string,
  targetUserId?: string,
  targetUserName?: string
) => {
  try {
    const key = `${STORAGE_KEYS.AUDIT_LOGS}_${orgId}`;
    const existing = localStorage.getItem(key);
    const logs: AuditLogEntry[] = existing ? JSON.parse(existing) : [];
    
    const newEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      orgId,
      timestamp: new Date().toISOString(),
      adminId,
      adminName,
      action,
      details,
      targetUserId,
      targetUserName
    };
    
    logs.unshift(newEntry);
    
    // Keep only last 1000 logs to prevent localStorage overflow
    if (logs.length > 1000) {
      logs.length = 1000;
    }
    
    localStorage.setItem(key, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save audit log', e);
  }
};

export const getAuditLogs = (orgId: string): AuditLogEntry[] => {
  try {
    const key = `${STORAGE_KEYS.AUDIT_LOGS}_${orgId}`;
    const existing = localStorage.getItem(key);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    console.error('Failed to get audit logs', e);
    return [];
  }
};
