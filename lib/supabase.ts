
import { createClient } from '@supabase/supabase-js';
import { Organization } from '../types';

const getEnv = (name: string): string => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return process.env[name] as string;
    }
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv[name]) {
      return metaEnv[name];
    }
  } catch (e) {}
  return '';
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || 'https://placeholder-project.supabase.co';
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || 'placeholder-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const isConfigured = () => {
  const configured = SUPABASE_URL !== 'https://placeholder-project.supabase.co' && 
         SUPABASE_ANON_KEY !== 'placeholder-anon-key' &&
         SUPABASE_URL.trim() !== '' &&
         SUPABASE_ANON_KEY.trim() !== '';
  return configured;
};

// Кэшируем результат конфигурации
let _isConfigured: boolean | null = null;
const checkConfig = () => {
  if (_isConfigured === null) _isConfigured = isConfigured();
  return _isConfigured;
};

export const db = {
  checkConnection: async () => {
    if (!checkConfig()) return false;
    try {
      const { data, error } = await supabase.from('organizations').select('id').limit(1);
      return !error;
    } catch (e) {
      return false;
    }
  },
  getOrganization: async (orgId: string) => {
    if (!checkConfig()) return null;
    const { data, error } = await supabase.from('organizations').select('*').eq('id', orgId).maybeSingle();
    if (error || !data) return null;
    return {
      ...data,
      ownerId: data.owner_id,
      expiryDate: data.expiry_date
    };
  },
  getLogs: async (orgId: string) => {
    if (!checkConfig()) return null;
    try {
      const { data, error } = await supabase.from('work_logs').select('*').eq('organization_id', orgId).order('date', { ascending: false }).limit(1000);
      if (error) {
        console.error('Error fetching logs:', error);
        return null;
      }
      return data.map(l => ({
        id: l.id,
        userId: l.user_id,
        organizationId: l.organization_id,
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
        correctionTimestamp: l.correction_timestamp,
        isNightShift: l.is_night_shift
      }));
    } catch (e) {
      console.error('Database connection failed:', e);
      return null;
    }
  },
  upsertLog: async (log: any, orgId: string) => {
    if (!isConfigured()) return;
    const { error } = await supabase.from('work_logs').upsert({
      id: log.id,
      user_id: log.userId,
      organization_id: orgId,
      date: log.date,
      entry_type: log.entryType,
      machine_id: log.machineId,
      check_in: log.checkIn,
      check_out: log.checkOut,
      duration_minutes: log.durationMinutes,
      photo_in: log.photoIn,
      photo_out: log.photoOut,
      is_corrected: log.isCorrected,
      correction_note: log.correctionNote,
      correction_timestamp: log.correctionTimestamp,
      is_night_shift: log.isNightShift
    });
    if (error) console.error('Error upserting log:', error);
  },
  deleteLog: async (id: string, orgId: string) => {
    if (!isConfigured()) return;
    await supabase.from('work_logs').delete().eq('id', id).eq('organization_id', orgId);
  },
  getUsers: async (orgId: string) => {
    if (!checkConfig()) return null;
    try {
      const { data, error } = await supabase.from('users').select('*').eq('organization_id', orgId).order('name');
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
        requirePhoto: u.require_photo,
        isAdmin: u.is_admin,
        forcePinChange: u.force_pin_change,
        organizationId: u.organization_id
      }));
    } catch (e) {
      return null;
    }
  },
  upsertUser: async (user: any, orgId: string) => {
    if (!isConfigured()) return { error: 'Not configured' };
    const { error } = await supabase.from('users').upsert({
      id: user.id,
      name: user.name,
      role: user.role,
      department: user.department,
      position: user.position,
      pin: user.pin,
      require_photo: user.requirePhoto,
      is_admin: user.isAdmin,
      force_pin_change: user.forcePinChange,
      organization_id: orgId
    });
    return { error };
  },
  deleteUser: async (id: string, orgId: string) => {
    if (!isConfigured()) return;
    await supabase.from('users').delete().eq('id', id).eq('organization_id', orgId);
  },
  getMachines: async (orgId: string) => {
    if (!checkConfig()) return null;
    const { data } = await supabase.from('machines').select('*').eq('organization_id', orgId).order('name');
    return data || null;
  },
  saveMachines: async (machines: any[], orgId: string) => {
    if (!checkConfig()) return { error: 'Not configured' };
    
    // Сначала удаляем (это не ограничено триггером на вставку)
    const { error: delError } = await supabase.from('machines').delete().eq('organization_id', orgId);
    if (delError) return { error: delError };

    if (machines.length > 0) {
      const { error: insError } = await supabase.from('machines').insert(
        machines.map(m => ({ ...m, organization_id: orgId }))
      );
      return { error: insError };
    }
    return { error: null };
  },
  getPositions: async (orgId: string) => {
    if (!checkConfig()) return null;
    const { data } = await supabase.from('positions').select('name').eq('organization_id', orgId).order('name');
    return data?.map(p => p.name) || null;
  },
  savePositions: async (positions: string[], orgId: string) => {
    if (!checkConfig()) return;
    await supabase.from('positions').delete().eq('organization_id', orgId);
    if (positions.length > 0) {
      await supabase.from('positions').insert(positions.map(p => ({ name: p, organization_id: orgId })));
    }
  },
  getActiveShifts: async (userId: string, orgId: string) => {
    if (!isConfigured()) return null;
    const { data, error } = await supabase.from('active_shifts').select('shifts_json').eq('user_id', userId).eq('organization_id', orgId).maybeSingle();
    if (error) return null;
    return data?.shifts_json || { 1: null, 2: null, 3: null };
  },
  saveActiveShifts: async (userId: string, shifts: any, orgId: string) => {
    if (!isConfigured()) return;
    await supabase.from('active_shifts').upsert({ user_id: userId, shifts_json: shifts, organization_id: orgId });
  },
  // Super-Admin methods
  getPlans: async () => {
    if (!checkConfig()) return null;
    const { data, error } = await supabase.from('plans').select('*').order('type');
    if (error) return null;
    return data;
  },
  savePlan: async (plan: any) => {
    if (!isConfigured()) return;
    const { error } = await supabase.from('plans').upsert(plan);
    if (error) console.error('Error saving plan:', error);
  },
  getAllOrganizations: async () => {
    if (!checkConfig()) return null;
    const { data, error } = await supabase.from('organizations').select('*').order('name');
    if (error) return null;
    return data.map(org => ({
      ...org,
      ownerId: org.owner_id,
      expiryDate: org.expiry_date
    }));
  },
  getGlobalStats: async () => {
    if (!checkConfig()) return null;
    
    try {
      // Пытаемся вызвать RPC функцию для эффективного подсчета на стороне сервера
      const { data, error } = await supabase.rpc('get_user_counts_by_org');
      
      if (!error && data) {
        const stats: Record<string, number> = {};
        data.forEach((item: any) => {
          stats[item.organization_id || 'unknown'] = item.user_count;
        });
        return stats;
      }
      
      // Если RPC не настроен, используем старый метод (fallback)
      console.warn('RPC get_user_counts_by_org not found, using fallback method');
      const { data: users, error: usersError } = await supabase.from('users').select('organization_id');
      if (usersError) return null;
      
      const stats: Record<string, number> = {};
      users.forEach(u => {
        const orgId = u.organization_id || 'unknown';
        stats[orgId] = (stats[orgId] || 0) + 1;
      });
      return stats;
    } catch (e) {
      console.error('Error in getGlobalStats:', e);
      return null;
    }
  },
  updateOrganization: async (orgId: string, updates: any) => {
    if (!checkConfig()) return { error: 'Not configured' };
    
    const dbUpdates: any = { ...updates };
    if (updates.ownerId) {
      dbUpdates.owner_id = updates.ownerId;
      delete dbUpdates.ownerId;
    }
    if (updates.expiryDate) {
      dbUpdates.expiry_date = updates.expiryDate;
      delete dbUpdates.expiryDate;
    }

    const { error } = await supabase.from('organizations').update(dbUpdates).eq('id', orgId);
    if (error) console.error('Error updating organization:', error);
    return { error };
  },
  createOrganization: async (org: Organization) => {
    if (!checkConfig()) return;
    const { error } = await supabase.from('organizations').upsert({
      id: org.id,
      name: org.name,
      email: org.email,
      owner_id: org.ownerId,
      plan: org.plan,
      status: org.status,
      expiry_date: org.expiryDate
    }, { onConflict: 'id' });
    
    if (error && error.code !== '23505') {
      console.error('Error creating organization:', error);
    }
  },
  getOrganizationByEmail: async (email: string) => {
    if (!checkConfig()) return null;
    const { data, error } = await supabase.from('organizations').select('*').eq('email', email).maybeSingle();
    if (error || !data) return null;
    return {
      ...data,
      ownerId: data.owner_id,
      expiryDate: data.expiry_date
    };
  },
  resetAdminPin: async (orgId: string, newPin: string) => {
    if (!checkConfig()) return;
    const { error } = await supabase.from('users').update({ pin: newPin }).eq('organization_id', orgId).eq('id', 'admin');
    if (error) console.error('Error resetting admin pin:', error);
  },
  getPromoCodes: async () => {
    if (!checkConfig()) return null;
    const { data, error } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
    if (error) return null;
    return data.map(p => ({
      id: p.id,
      code: p.code,
      planType: p.plan_type,
      durationDays: p.duration_days,
      maxUses: p.max_uses,
      usedCount: p.used_count,
      createdAt: p.created_at,
      expiresAt: p.expires_at,
      isActive: p.is_active
    }));
  },
  savePromoCode: async (promo: any) => {
    if (!checkConfig()) return;
    const { error } = await supabase.from('promo_codes').upsert({
      id: promo.id,
      code: promo.code,
      plan_type: promo.planType,
      duration_days: promo.durationDays,
      max_uses: promo.maxUses,
      used_count: promo.usedCount,
      created_at: promo.createdAt,
      expires_at: promo.expiresAt,
      is_active: promo.isActive
    });
    if (error) console.error('Error saving promo code:', error);
  },
  deletePromoCode: async (id: string) => {
    if (!checkConfig()) return;
    await supabase.from('promo_codes').delete().eq('id', id);
  }
};
