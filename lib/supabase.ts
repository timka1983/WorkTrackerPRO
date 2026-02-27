
import { createClient } from '@supabase/supabase-js';
import { Organization } from '../types';
import { STORAGE_KEYS } from '../constants';

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
    if (!checkConfig()) {
      const cached = localStorage.getItem(STORAGE_KEYS.ORG_DATA);
      if (cached) {
        const org = JSON.parse(cached);
        if (org.id === orgId) return org;
      }
      return null;
    }
    const { data, error } = await supabase.from('organizations').select('*').eq('id', orgId).maybeSingle();
    if (error || !data) {
      const cached = localStorage.getItem(STORAGE_KEYS.ORG_DATA);
      if (cached) {
        const org = JSON.parse(cached);
        if (org.id === orgId) return org;
      }
      return null;
    }
    return {
      ...data,
      ownerId: data.owner_id,
      expiryDate: data.expiry_date,
      notificationSettings: data.notification_settings
    };
  },
  getLogs: async (orgId: string, monthPrefix?: string) => {
    if (!checkConfig()) return null;
    try {
      let query = supabase
        .from('work_logs')
        .select('*')
        .eq('organization_id', orgId)
        .order('date', { ascending: false })
        .order('check_in', { ascending: false });
        
      if (monthPrefix) {
        // monthPrefix is like '2023-10'
        const startDate = `${monthPrefix}-01`;
        const [year, month] = monthPrefix.split('-');
        const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
        const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
        const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
        
        query = query.gte('date', startDate).lt('date', endDate);
      } else {
        // Fallback to limit if no month specified
        query = query.limit(1000);
      }

      const { data, error } = await query;
        
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
        isNightShift: l.is_night_shift,
        fine: l.fine
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
      is_night_shift: log.isNightShift,
      fine: log.fine
    });
    if (error) console.error('Error upserting log:', error);
  },
  getDashboardStats: async (orgId: string, monthPrefix: string, last7Days: string[]) => {
    if (!checkConfig()) return null;
    try {
      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_org_id: orgId,
        p_month: monthPrefix,
        p_last_7_days: last7Days
      });
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('RPC get_dashboard_stats failed, falling back to local calculation', e);
      return null;
    }
  },
  uploadPhoto: async (base64Data: string, orgId: string, userId: string): Promise<string | null> => {
    if (!isConfigured() || !base64Data.startsWith('data:image')) return base64Data;
    
    try {
      const base64Parts = base64Data.split(',');
      if (base64Parts.length !== 2) return base64Data;
      
      const mimeMatch = base64Parts[0].match(/:(.*?);/);
      if (!mimeMatch) return base64Data;
      
      const mimeType = mimeMatch[1];
      const byteCharacters = atob(base64Parts[1]);
      const byteArrays = [];
      
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      
      const blob = new Blob(byteArrays, { type: mimeType });
      const fileExt = mimeType.split('/')[1] || 'jpg';
      const fileName = `${orgId}/${userId}/${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('photos')
        .upload(fileName, blob, {
          cacheControl: '31536000',
          upsert: false
        });
        
      if (error) {
        console.error('Error uploading photo:', error);
        return base64Data; // Fallback to base64
      }
      
      const { data: publicUrlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);
        
      return publicUrlData.publicUrl;
    } catch (e) {
      console.error('Exception uploading photo:', e);
      return base64Data; // Fallback
    }
  },
  batchUpsertLogs: async (logs: any[], orgId: string) => {
    if (!isConfigured() || logs.length === 0) return { error: null };
    
    const payload = logs.map(log => {
      const item: any = {
        id: log.id,
        user_id: log.userId,
        date: log.date,
        entry_type: log.entryType,
        check_in: log.checkIn,
        check_out: log.checkOut || null,
        duration_minutes: log.durationMinutes || 0,
      };
      
      // Только если значения не пустые/дефолтные, чтобы не ломать старые схемы БД
      if (log.machineId) item.machine_id = log.machineId;
      if (log.photoIn) item.photo_in = log.photoIn;
      if (log.photoOut) item.photo_out = log.photoOut;
      if (log.isCorrected) {
        item.is_corrected = true;
        if (log.correctionNote) item.correction_note = log.correctionNote;
        if (log.correctionTimestamp) item.correction_timestamp = log.correctionTimestamp;
      }
      
      // Эти колонки могут отсутствовать в старых версиях БД
      if (log.isNightShift) item.is_night_shift = true;
      if (log.fine) item.fine = log.fine;
      if (orgId && orgId !== 'demo_org') item.organization_id = orgId;
      
      return item;
    });

    const { error } = await supabase.from('work_logs').upsert(payload);
    if (error) {
      console.error('Error batch upserting logs:', error);
      
      // Если ошибка в колонках (42703) или неопределенная ошибка, пробуем минимальный набор
      if (error.code === '42703' || error.message?.includes('column')) {
        const minimalPayload = payload.map(p => {
          const { is_night_shift, organization_id, photo_in, photo_out, machine_id, fine, ...rest } = p;
          return rest;
        });
        console.warn('Retrying with minimal payload...');
        const { error: retryError } = await supabase.from('work_logs').upsert(minimalPayload);
        return { error: retryError };
      }
      
      // Если ошибка в данных (например, слишком большие фото), пробуем без фото
      if (error.code === '22001' || error.message?.includes('too long')) {
        const noPhotoPayload = payload.map(p => {
          const { photo_in, photo_out, ...rest } = p;
          return rest;
        });
        console.warn('Retrying without photos...');
        const { error: retryError } = await supabase.from('work_logs').upsert(noPhotoPayload);
        return { error: retryError };
      }
    }
    return { error };
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
        organizationId: u.organization_id,
        pushToken: u.push_token,
        plannedShifts: u.planned_shifts,
        payroll: u.payroll
      }));
    } catch (e) {
      return null;
    }
  },
  getMonthlyReport: async (orgId: string, month: string) => {
    if (!isConfigured()) return null;
    try {
      const { data, error } = await supabase.rpc('get_monthly_report', { p_org_id: orgId, p_month: month });
      if (error) {
        console.error('Error fetching monthly report:', error);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  },
  getUserStats: async (userId: string, month: string) => {
    if (!isConfigured()) return null;
    try {
      const { data, error } = await supabase.rpc('get_user_stats', { p_user_id: userId, p_month: month });
      if (error) {
        console.error('Error fetching user stats:', error);
        return null;
      }
      return data?.[0] || null;
    } catch (e) {
      return null;
    }
  },
  upsertUser: async (user: any, orgId: string) => {
    if (!isConfigured()) return { error: 'Not configured' };
    
    const payload: any = {
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
    };
    
    if (user.pushToken !== undefined) {
      payload.push_token = user.pushToken;
    }
    if (user.plannedShifts !== undefined) {
      payload.planned_shifts = user.plannedShifts;
    }
    if (user.payroll !== undefined) {
      payload.payroll = user.payroll;
    }

    const { error } = await supabase.from('users').upsert(payload);
    
    if (error) {
      console.error('Error saving user:', error);
      // Try without new columns if it fails due to missing column
      if (error.code === '42703' || error.code === 'PGRST204' || error.message?.includes('column')) {
        const { push_token, planned_shifts, payroll, ...minimalPayload } = payload;
        const { error: retryError } = await supabase.from('users').upsert(minimalPayload);
        return { error: retryError };
      }
    }
    
    return { error };
  },
  batchUpsertUsers: async (users: any[], orgId: string) => {
    if (!isConfigured() || users.length === 0) return { error: 'Not configured' };
    
    const payload = users.map(user => {
      const p: any = {
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
      };
      if (user.pushToken !== undefined) {
        p.push_token = user.pushToken;
      }
      if (user.plannedShifts !== undefined) {
        p.planned_shifts = user.plannedShifts;
      }
      if (user.payroll !== undefined) {
        p.payroll = user.payroll;
      }
      return p;
    });

    const { error } = await supabase.from('users').upsert(payload);
    
    if (error) {
      console.error('Error batch upserting users:', error);
      if (error.code === '42703' || error.code === 'PGRST204' || error.message?.includes('column')) {
        const minimalPayload = payload.map(p => {
          const { push_token, planned_shifts, payroll, ...rest } = p;
          return rest;
        });
        const { error: retryError } = await supabase.from('users').upsert(minimalPayload);
        return { error: retryError };
      }
    }
    
    return { error };
  },
  deleteUser: async (id: string, orgId: string) => {
    if (!isConfigured()) return { error: 'Not configured' };
    const { error } = await supabase.from('users').delete().eq('id', id).eq('organization_id', orgId);
    return { error };
  },
  getMachines: async (orgId: string) => {
    if (!checkConfig()) return null;
    const { data } = await supabase.from('machines').select('*').eq('organization_id', orgId).order('name');
    return data || null;
  },
  saveMachines: async (machines: any[], orgId: string) => {
    if (!checkConfig()) return { error: 'Not configured' };
    
    // Используем upsert для сохранения ID и производительности
    const { error } = await supabase.from('machines').upsert(
      machines.map(m => ({ ...m, organization_id: orgId })),
      { onConflict: 'id' }
    );
    
    return { error };
  },
  getPositions: async (orgId: string) => {
    if (!checkConfig()) return null;
    const { data } = await supabase.from('positions').select('*').eq('organization_id', orgId).order('name');
    return data?.map(p => ({
      name: p.name,
      permissions: p.permissions || {},
      payroll: p.payroll
    })) || null;
  },
  savePositions: async (positions: any[], orgId: string) => {
    if (!checkConfig()) return { error: 'Not configured' };
    
    // Для позиций upsert
    const { error: delError } = await supabase.from('positions').delete().eq('organization_id', orgId);
    if (delError) return { error: delError };

    if (positions.length > 0) {
      const { error } = await supabase.from('positions').insert(positions.map(p => ({ 
        name: p.name, 
        permissions: p.permissions,
        payroll: p.payroll,
        organization_id: orgId 
      })));
      return { error };
    }
    return { error: null };
  },
  getSystemConfig: async () => {
    if (!checkConfig()) return null;
    const { data } = await supabase.from('system_config').select('*').single();
    return data;
  },
  getServerTime: async () => {
    if (!checkConfig()) return new Date().toISOString();
    // Use RPC if available, or a simple query
    try {
      const { data, error } = await supabase.rpc('get_server_time');
      if (!error && data) return data;
      
      // Fallback: select now()
      // We can use a dummy query to get the time
      const { data: timeData, error: timeError } = await supabase.from('active_shifts').select('created_at').limit(1);
      // This is not ideal as it returns created_at of a row.
      // Better fallback: just use client time if RPC fails, or try to select current_timestamp via a view if one existed.
      // But since we can't easily create views/RPCs from here without SQL access, let's try a direct query if possible or just rely on client time as fallback.
      
      // Actually, we can use the `head` method or just a simple select if we had a 'health' table.
      // Let's assume we can't easily get server time without RPC.
      // But wait, we can use `select now()` via a raw query if the client allowed it, but supabase-js doesn't expose raw query easily without RPC.
      
      return new Date().toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  },
  updateSystemConfig: async (config: any) => {
    if (!checkConfig()) return;
    await supabase.from('system_config').upsert({ id: 'global', ...config });
  },
  getActiveShifts: async (userId: string, orgId: string) => {
    if (!isConfigured()) return null;
    const { data, error } = await supabase.from('active_shifts').select('shifts, shifts_json').eq('user_id', userId).eq('organization_id', orgId).maybeSingle();
    if (error) return null;
    
    let parsedShifts = data?.shifts || data?.shifts_json || { 1: null, 2: null, 3: null };
    if (typeof parsedShifts === 'string') {
      try { parsedShifts = JSON.parse(parsedShifts); } catch (e) {}
    }
    return parsedShifts;
  },
  saveActiveShifts: async (userId: string, shifts: any, orgId: string) => {
    if (!isConfigured()) return { error: 'Not configured' };
    
    // Check if shifts object is effectively empty (all slots are null)
    const isEmpty = !shifts || (typeof shifts === 'object' && Object.values(shifts).every(s => s === null));
    
    if (isEmpty) {
      const { error } = await supabase.from('active_shifts').delete().eq('user_id', userId);
      return { error };
    }
    
    // Create a base payload with shifts_json which we know exists
    const payload: any = { 
      user_id: userId, 
      shifts_json: shifts
    };
    
    // Add optional columns
    if (orgId && orgId !== 'demo_org') {
      payload.organization_id = orgId;
    }
    
    // Also try to set 'shifts' if it exists
    payload.shifts = shifts;

    try {
      // Try with everything
      const { error } = await supabase.from('active_shifts').upsert(payload, { onConflict: 'user_id' });
      
      if (error) {
        console.warn('First upsert attempt failed, trying fallback:', error);
        
        // If error is about missing columns (42703)
        if (error.code === '42703' || error.message?.includes('column')) {
          // Try removing 'shifts' first
          const { shifts, ...payloadNoShifts } = payload;
          const { error: error2 } = await supabase.from('active_shifts').upsert(payloadNoShifts, { onConflict: 'user_id' });
          
          if (error2 && (error2.code === '42703' || error2.message?.includes('column'))) {
            // If still failing, remove organization_id too
            const { organization_id, ...minimalPayload } = payloadNoShifts;
            const { error: error3 } = await supabase.from('active_shifts').upsert(minimalPayload, { onConflict: 'user_id' });
            return { error: error3 };
          }
          return { error: error2 };
        }
        
        // Handle conflict errors
        if (error.code === '42P10' || error.message?.includes('conflict')) {
           const { error: retryError2 } = await supabase.from('active_shifts').upsert(payload);
           return { error: retryError2 };
        }
        
        return { error };
      }
      return { error: null };
    } catch (e: any) {
      console.error('Exception in saveActiveShifts:', e);
      return { error: e.message };
    }
  },
  getAllActiveShifts: async (orgId: string) => {
    if (!checkConfig()) return null;
    
    // Try with organization_id filter
    const { data, error } = await supabase.from('active_shifts').select('*').eq('organization_id', orgId);
    
    if (error) {
      // If organization_id column is missing, fetch all and we'll filter in memory or just use all
      if (error.code === '42703' || error.message?.includes('column')) {
        const { data: allData, error: allErrors } = await supabase.from('active_shifts').select('*');
        if (allErrors) return null;
        return allData;
      }
      console.error('Error fetching active shifts:', error);
      return null;
    }
    return data;
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
    // Update localStorage first as a fallback
    const cached = localStorage.getItem(STORAGE_KEYS.ORG_DATA);
    if (cached) {
      try {
        const org = JSON.parse(cached);
        if (org.id === orgId) {
          const updatedOrg = { ...org, ...updates };
          localStorage.setItem(STORAGE_KEYS.ORG_DATA, JSON.stringify(updatedOrg));
        }
      } catch (e) {
        console.error('Error updating local org data:', e);
      }
    }

    if (!checkConfig()) return { error: 'Not configured' };
    
    const dbUpdates: any = { ...updates };
    if (updates.ownerId !== undefined) {
      dbUpdates.owner_id = updates.ownerId;
      delete dbUpdates.ownerId;
    }
    if (updates.expiryDate !== undefined) {
      dbUpdates.expiry_date = updates.expiryDate;
      delete dbUpdates.expiryDate;
    }
    if (updates.notificationSettings !== undefined) {
      dbUpdates.notification_settings = updates.notificationSettings;
      delete dbUpdates.notificationSettings;
    }

    const { error } = await supabase.from('organizations').update(dbUpdates).eq('id', orgId);
    
    if (error) {
      console.error('Error updating organization:', error);
      
      // If column doesn't exist, try without notification_settings
      if ((error.code === '42703' || error.message?.includes('column')) && dbUpdates.notification_settings) {
        console.warn('Retrying organization update without notification_settings...');
        const { notification_settings, ...minimalUpdates } = dbUpdates;
        const { error: retryError } = await supabase.from('organizations').update(minimalUpdates).eq('id', orgId);
        return { error: retryError };
      }
    }
    
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
      expiry_date: org.expiryDate,
      notification_settings: org.notificationSettings
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
      expiryDate: data.expiry_date,
      notificationSettings: data.notification_settings
    };
  },
  resetAdminPin: async (orgId: string, newPin: string) => {
    if (!checkConfig()) return;
    const { error } = await supabase.from('users').update({ pin: newPin }).eq('organization_id', orgId).eq('id', 'admin');
    if (error) console.error('Error resetting admin pin:', error);
  },
  getDiagnostics: async () => {
    const results: Record<string, any> = {
      config: {
        urlSet: SUPABASE_URL !== 'https://placeholder-project.supabase.co' && SUPABASE_URL.trim() !== '',
        keySet: SUPABASE_ANON_KEY !== 'placeholder-anon-key' && SUPABASE_ANON_KEY.trim() !== '',
      },
      tables: {},
      columns: {},
      sqlFixes: []
    };

    if (!results.config.urlSet || !results.config.keySet) {
      return { ...results, status: 'error', message: 'Supabase URL or Key is not configured in environment variables.' };
    }

    const tablesToCheck = ['organizations', 'users', 'work_logs', 'machines', 'positions', 'plans', 'promo_codes', 'active_shifts', 'system_config'];
    
    try {
      for (const table of tablesToCheck) {
        const { error } = await supabase.from(table).select('count', { count: 'exact', head: true }).limit(0);
        
        // If error is present, OR if the error is specifically that the table doesn't exist
        const isMissing = error && (error.message.includes('does not exist') || error.code === '42P01');
        
        results.tables[table] = error ? { status: 'error', message: error.message } : { status: 'ok' };
        
        if (isMissing) {
          if (table === 'promo_codes') {
            results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS promo_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  plan_type TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  last_used_by TEXT,
  last_used_at TIMESTAMPTZ
);
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON promo_codes;
CREATE POLICY "Allow public read" ON promo_codes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON promo_codes;
CREATE POLICY "Allow public insert" ON promo_codes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update" ON promo_codes;
CREATE POLICY "Allow public update" ON promo_codes FOR UPDATE USING (true);
            `);
          } else if (table === 'system_config') {
            results.sqlFixes.push(`
CREATE TABLE IF NOT EXISTS system_config (
  id TEXT PRIMARY KEY,
  super_admin_pin TEXT,
  global_admin_pin TEXT
);
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON system_config;
CREATE POLICY "Allow public read" ON system_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public update" ON system_config;
CREATE POLICY "Allow public update" ON system_config FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public insert" ON system_config;
CREATE POLICY "Allow public insert" ON system_config FOR INSERT WITH CHECK (true);

-- Insert default row
INSERT INTO system_config (id, super_admin_pin, global_admin_pin) VALUES ('global', '7777', '0000') ON CONFLICT (id) DO NOTHING;
            `);
          } else {
             // Generic fallback for other tables
             results.sqlFixes.push(`-- Table ${table} is missing. Please check Supabase schema.`);
          }
        }
      }

      // Check specific columns
      const expectedSchema: Record<string, string[]> = {
        organizations: ['id', 'name', 'email', 'owner_id', 'plan', 'status', 'expiry_date', 'notification_settings'],
        users: ['id', 'organization_id', 'name', 'role', 'department', 'position', 'pin', 'require_photo', 'is_admin', 'force_pin_change', 'push_token', 'planned_shifts', 'payroll'],
        work_logs: ['id', 'user_id', 'organization_id', 'date', 'entry_type', 'machine_id', 'check_in', 'check_out', 'duration_minutes', 'photo_in', 'photo_out', 'is_corrected', 'correction_note', 'correction_timestamp', 'is_night_shift', 'fine'],
        machines: ['id', 'organization_id', 'name'],
        positions: ['name', 'organization_id', 'permissions', 'payroll'],
        plans: ['type', 'name', 'limits', 'price'],
        promo_codes: ['id', 'code', 'plan_type', 'duration_days', 'max_uses', 'used_count', 'created_at', 'expires_at', 'is_active', 'last_used_by', 'last_used_at'],
        active_shifts: ['user_id', 'organization_id', 'shifts', 'shifts_json'],
        system_config: ['id', 'super_admin_pin', 'global_admin_pin']
      };

      for (const [table, columns] of Object.entries(expectedSchema)) {
        // Only check columns if the table exists (no error in the initial check)
        if (results.tables[table]?.status === 'ok') {
          for (const col of columns) {
            // Use a more robust check: try to select the specific column
            const { error } = await supabase.from(table).select(col).limit(1);
            
            if (error) {
              // Double check if the error is actually because the table doesn't exist
              // This can happen if the initial HEAD request returned 'ok' due to a bug or cache
              if (error.code === '42P01' || error.message.includes('does not exist')) {
                results.tables[table] = { status: 'error', message: error.message };
                // We should stop checking columns for this table if it doesn't exist
                break;
              }
              
              // If error is about column not found (Postgres code 42703)
              if (error.code === '42703' || error.message.includes('column') || error.message.includes('does not exist')) {
                 results.columns[`${table}.${col}`] = 'missing';
                 
                 // Generate basic SQL fix
                 let colType = 'TEXT';
                 if (col.includes('count') || col.includes('days') || col.includes('uses') || col.includes('minutes') || col === 'price' || col === 'fine') colType = 'INTEGER';
                 else if (col.includes('date') || col.includes('_at') || col.includes('timestamp') || col === 'check_in' || col === 'check_out') colType = 'TIMESTAMPTZ';
                 else if (col.startsWith('is_') || col.startsWith('require_') || col.startsWith('force_')) colType = 'BOOLEAN';
                 else if (col === 'notification_settings' || col === 'permissions' || col === 'limits' || col === 'shifts_json' || col === 'shifts' || col === 'planned_shifts' || col === 'payroll') colType = 'JSONB';
                 
                 // Explicitly handle global_admin_pin to ensure it gets generated
                 if (col === 'global_admin_pin') {
                    results.sqlFixes.push(`ALTER TABLE system_config ADD COLUMN IF NOT EXISTS global_admin_pin TEXT DEFAULT '0000';`);
                 } else {
                    results.sqlFixes.push(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${colType};`);
                 }
              } else {
                 // Other error, maybe permission or something else, but assume column exists to avoid false positives
                 console.warn(`Error checking column ${table}.${col}:`, error);
                 results.columns[`${table}.${col}`] = 'ok';
              }
            } else {
              results.columns[`${table}.${col}`] = 'ok';
            }
          }
        }
      }
      
      // Check storage bucket
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      if (!bucketError) {
        const hasPhotosBucket = buckets.some(b => b.name === 'photos');
        if (!hasPhotosBucket) {
          results.sqlFixes.push(`
-- Create a storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true) ON CONFLICT DO NOTHING;

-- Allow public access to photos
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
CREATE POLICY "Allow Uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos');
          `);
        }
      }

      // Check RPC for dashboard stats
      const { error: rpcError } = await supabase.rpc('get_dashboard_stats', { 
        p_org_id: 'test', 
        p_month: '2023-01', 
        p_last_7_days: ['2023-01-01'] 
      });
      
      if (rpcError && (rpcError.code === '42883' || rpcError.message.includes('Could not find') || rpcError.message.includes('operator does not exist'))) {
        results.sqlFixes.push(`
-- Create RPC for dashboard stats
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_org_id text, p_month text, p_last_7_days text[])
RETURNS json AS $$
DECLARE
    v_total_weekly_minutes bigint;
    v_absences json;
BEGIN
    SELECT COALESCE(SUM(duration_minutes), 0)
    INTO v_total_weekly_minutes
    FROM work_logs
    WHERE organization_id = p_org_id 
      AND date::text = ANY(p_last_7_days)
      AND entry_type = 'WORK';

    SELECT json_agg(t)
    INTO v_absences
    FROM (
        SELECT u.name, COUNT(w.id) as count
        FROM users u
        JOIN work_logs w ON u.id = w.user_id
        WHERE w.organization_id = p_org_id 
          AND w.date::text LIKE p_month || '%'
          AND w.entry_type IN ('SICK', 'VACATION')
        GROUP BY u.id, u.name
        ORDER BY count DESC
        LIMIT 3
    ) t;

    RETURN json_build_object(
        'total_weekly_minutes', v_total_weekly_minutes,
        'top_absences', COALESCE(v_absences, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
        `);
      }
      
      const hasErrors = Object.values(results.tables).some((t: any) => t.status === 'error') || 
                        Object.values(results.columns).some((c: any) => c === 'missing') ||
                        results.sqlFixes.length > 0;
      results.status = hasErrors ? 'partial' : 'ok';
      return results;
    } catch (e: any) {
      return { ...results, status: 'error', message: e.message };
    }
  },
  subscribeToChanges: (orgId: string, table: string, callback: (payload: any) => void) => {
    if (!isConfigured()) return () => {};
    
    // Пытаемся подписаться с фильтром по организации
    // Если колонка отсутствует, подписка может не работать, но это ожидаемо для старых схем
    const channel = supabase
      .channel(`public:${table}:org:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: table === 'organizations' 
            ? `id=eq.${orgId}` 
            : (orgId !== 'demo_org' ? `organization_id=eq.${orgId}` : undefined)
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  },
  getPromoCodes: async () => {
    if (!checkConfig()) {
      const cached = localStorage.getItem(STORAGE_KEYS.PROMO_CODES);
      return cached ? JSON.parse(cached) : null;
    }
    const { data, error } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
    if (error) {
      const cached = localStorage.getItem(STORAGE_KEYS.PROMO_CODES);
      return cached ? JSON.parse(cached) : null;
    }
    return data.map(p => ({
      id: p.id,
      code: p.code,
      planType: p.plan_type,
      durationDays: p.duration_days,
      maxUses: p.max_uses,
      usedCount: p.used_count,
      createdAt: p.created_at,
      expiresAt: p.expires_at,
      isActive: p.is_active,
      lastUsedBy: p.last_used_by,
      lastUsedAt: p.last_used_at
    }));
  },
  savePromoCode: async (promo: any) => {
    // Update localStorage first as a fallback
    const cached = localStorage.getItem(STORAGE_KEYS.PROMO_CODES);
    let promos = cached ? JSON.parse(cached) : [];
    const index = promos.findIndex((p: any) => p.id === promo.id);
    if (index >= 0) {
      promos[index] = promo;
    } else {
      promos.unshift(promo);
    }
    localStorage.setItem(STORAGE_KEYS.PROMO_CODES, JSON.stringify(promos));

    if (!checkConfig()) return { error: 'Not configured' };
    
    const payload = {
      id: promo.id,
      code: promo.code,
      plan_type: promo.planType,
      duration_days: promo.durationDays,
      max_uses: promo.maxUses,
      used_count: promo.usedCount,
      created_at: promo.createdAt,
      expires_at: promo.expiresAt,
      is_active: promo.isActive,
      last_used_by: promo.lastUsedBy,
      last_used_at: promo.lastUsedAt
    };

    const { error } = await supabase.from('promo_codes').upsert(payload);
    
    if (error) {
      console.error('Error saving promo code:', error);
      
      // If column error, try minimal payload
      if (error.code === '42703' || error.message?.includes('column')) {
        console.warn('Retrying promo code save with minimal payload...');
        const minimalPayload = {
          id: promo.id,
          code: promo.code,
          plan_type: promo.planType,
          duration_days: promo.durationDays,
          max_uses: promo.maxUses,
          used_count: promo.usedCount
        };
        const { error: retryError } = await supabase.from('promo_codes').upsert(minimalPayload);
        return { error: retryError };
      }
    }
    
    return { error };
  },
  deletePromoCode: async (id: string) => {
    const cached = localStorage.getItem(STORAGE_KEYS.PROMO_CODES);
    if (cached) {
      const promos = JSON.parse(cached);
      const filtered = promos.filter((p: any) => p.id !== id);
      localStorage.setItem(STORAGE_KEYS.PROMO_CODES, JSON.stringify(filtered));
    }
    if (!checkConfig()) return;
    await supabase.from('promo_codes').delete().eq('id', id);
  },
  deleteOrganization: async (orgId: string) => {
    if (!checkConfig()) return { error: 'Not configured' };
    
    try {
      // Delete from all related tables
      await Promise.all([
        supabase.from('users').delete().eq('organization_id', orgId),
        supabase.from('work_logs').delete().eq('organization_id', orgId),
        supabase.from('machines').delete().eq('organization_id', orgId),
        supabase.from('positions').delete().eq('organization_id', orgId),
        supabase.from('active_shifts').delete().eq('organization_id', orgId)
      ]);
      
      // Finally delete the organization itself
      const { error } = await supabase.from('organizations').delete().eq('id', orgId);
      return { error };
    } catch (e: any) {
      console.error('Error in deleteOrganization:', e);
      return { error: e.message };
    }
  }
};
