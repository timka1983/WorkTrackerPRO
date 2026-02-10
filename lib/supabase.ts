
import { createClient } from '@supabase/supabase-js';
import { PositionConfig } from '../types';
import { DEFAULT_PERMISSIONS } from '../constants';

/**
 * Helper to get environment variables from either process.env (Node/some platforms)
 * or import.meta.env (Vite/ESM).
 */
const getEnv = (name: string): string => {
  try {
    // Check process.env first (common in many cloud/AI environments)
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return process.env[name] as string;
    }
    // Check import.meta.env (standard for Vite)
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[name]) {
      return metaEnv[name];
    }
  } catch (e) {
    // Silently catch errors in environments where process or import.meta might be restricted
  }
  return '';
};

// We provide fallback placeholder strings to prevent the "supabaseUrl is required" 
// error from crashing the application if the environment variables are not yet configured.
const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || 'https://placeholder-project.supabase.co';
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || 'placeholder-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Check if the current Supabase configuration is a placeholder.
 * This prevents unnecessary network errors when the keys are not yet provided.
 */
const isConfigured = () => {
  return SUPABASE_URL !== 'https://placeholder-project.supabase.co' && 
         SUPABASE_ANON_KEY !== 'placeholder-anon-key' &&
         SUPABASE_URL.trim() !== '' &&
         SUPABASE_ANON_KEY.trim() !== '';
};

export const db = {
  getLogs: async () => {
    if (!isConfigured()) return null;
    try {
      const { data, error } = await supabase.from('work_logs').select('*').order('date', { ascending: false });
      if (error) {
        console.error('Error fetching logs:', error);
        return null;
      }
      return data.map(l => ({
        id: l.id,
        userId: l.user_id,
        date: l.date,
        entryType: l.entry_type,
        machineId: l.machine_id,
        checkIn: l.check_in,
        checkOut: l.check_out,
        durationMinutes: l.duration_minutes,
        photoIn: l.photo_in,
        photoOut: l.photo_out,
        isCorrected: l.is_corrected,
        correctionNote: l.correction_note,
        correctionTimestamp: l.correction_timestamp
      }));
    } catch (e) {
      console.error('Database connection failed:', e);
      return null;
    }
  },
  upsertLog: async (log: any) => {
    if (!isConfigured()) return;
    const { error } = await supabase.from('work_logs').upsert({
      id: log.id,
      user_id: log.userId,
      date: log.date,
      entry_type: log.entryType,
      machine_id: log.machineId,
      check_in: log.checkIn,
      check_out: log.checkOut,
      duration_minutes: log.durationMinutes,
      photo_in: log.photo_in,
      photo_out: log.photoOut,
      is_corrected: log.isCorrected,
      correction_note: log.correctionNote,
      correction_timestamp: log.correctionTimestamp
    });
    if (error) console.error('Error upserting log:', error);
  },
  deleteLog: async (id: string) => {
    if (!isConfigured()) return;
    await supabase.from('work_logs').delete().eq('id', id);
  },
  getUsers: async () => {
    if (!isConfigured()) return null;
    try {
      const { data, error } = await supabase.from('users').select('*').order('name');
      if (error) {
        console.error('Error fetching users:', error);
        return null;
      }
      return data.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        department: u.department,
        position: u.position,
        pin: u.pin,
        requirePhoto: u.require_photo
      }));
    } catch (e) {
      return null;
    }
  },
  upsertUser: async (user: any) => {
    if (!isConfigured()) return;
    await supabase.from('users').upsert({
      id: user.id,
      name: user.name,
      role: user.role,
      department: user.department,
      position: user.position,
      pin: user.pin,
      require_photo: user.requirePhoto
    });
  },
  deleteUser: async (id: string) => {
    if (!isConfigured()) return;
    await supabase.from('users').delete().eq('id', id);
  },
  getMachines: async () => {
    if (!isConfigured()) return null;
    const { data } = await supabase.from('machines').select('*').order('name');
    return data || null;
  },
  saveMachines: async (machines: any[]) => {
    if (!isConfigured()) return;
    await supabase.from('machines').delete().neq('id', 'dummy_id_to_allow_delete_all'); 
    if (machines.length > 0) {
      await supabase.from('machines').insert(machines);
    }
  },
  getPositions: async (): Promise<PositionConfig[] | null> => {
    if (!isConfigured()) return null;
    // We assume the Supabase table has a JSONB column named 'permissions'
    const { data } = await supabase.from('positions').select('*').order('name');
    if (!data) return null;
    return data.map(p => ({
      name: p.name,
      permissions: p.permissions || DEFAULT_PERMISSIONS
    }));
  },
  savePositions: async (positions: PositionConfig[]) => {
    if (!isConfigured()) return;
    await supabase.from('positions').delete().neq('name', 'dummy_position');
    if (positions.length > 0) {
      await supabase.from('positions').insert(
        positions.map(p => ({ 
          name: p.name, 
          permissions: p.permissions 
        }))
      );
    }
  },
  getActiveShifts: async (userId: string) => {
    if (!isConfigured()) return null;
    const { data, error } = await supabase.from('active_shifts').select('shifts_json').eq('user_id', userId).maybeSingle();
    if (error) return null;
    return data?.shifts_json || { 1: null, 2: null, 3: null };
  },
  saveActiveShifts: async (userId: string, shifts: any) => {
    if (!isConfigured()) return;
    await supabase.from('active_shifts').upsert({ user_id: userId, shifts_json: shifts });
  }
};
