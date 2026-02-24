
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
      expiryDate: data.expiry_date,
      notificationSettings: data.notification_settings
    };
  },
  getLogs: async (orgId: string) => {
    if (!checkConfig()) return null;
    try {
      // Добавляем сортировку по check_in как tie-breaker для одинаковых дат
      const { data, error } = await supabase
        .from('work_logs')
        .select('*')
        .eq('organization_id', orgId)
        .order('date', { ascending: false })
        .order('check_in', { ascending: false })
        .limit(1000);
        
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
      if (orgId && orgId !== 'demo_org') item.organization_id = orgId;
      
      return item;
    });

    const { error } = await supabase.from('work_logs').upsert(payload);
    if (error) {
      console.error('Error batch upserting logs:', error);
      
      // Если ошибка в колонках (42703) или неопределенная ошибка, пробуем минимальный набор
      if (error.code === '42703' || error.message?.includes('column')) {
        const minimalPayload = payload.map(p => {
          const { is_night_shift, organization_id, photo_in, photo_out, machine_id, ...rest } = p;
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
        pushToken: u.push_token
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
      organization_id: orgId,
      push_token: user.pushToken
    });
    return { error };
  },
  batchUpsertUsers: async (users: any[], orgId: string) => {
    if (!isConfigured() || users.length === 0) return { error: 'Not configured' };
    const { error } = await supabase.from('users').upsert(
      users.map(user => ({
        id: user.id,
        name: user.name,
        role: user.role,
        department: user.department,
        position: user.position,
        pin: user.pin,
        require_photo: user.requirePhoto,
        is_admin: user.isAdmin,
        force_pin_change: user.forcePinChange,
        organization_id: orgId,
        push_token: user.pushToken
      }))
    );
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
      permissions: p.permissions || {}
    })) || null;
  },
  savePositions: async (positions: any[], orgId: string) => {
    if (!checkConfig()) return;
    
    // Для позиций upsert
    await supabase.from('positions').delete().eq('organization_id', orgId);
    if (positions.length > 0) {
      await supabase.from('positions').insert(positions.map(p => ({ 
        name: p.name, 
        permissions: p.permissions,
        organization_id: orgId 
      })));
    }
  },
  getSystemConfig: async () => {
    if (!checkConfig()) return null;
    const { data } = await supabase.from('system_config').select('*').single();
    return data;
  },
  updateSystemConfig: async (config: any) => {
    if (!checkConfig()) return;
    await supabase.from('system_config').upsert({ id: 'global', ...config });
  },
  getActiveShifts: async (userId: string, orgId: string) => {
    if (!isConfigured()) return null;
    const { data, error } = await supabase.from('active_shifts').select('shifts_json').eq('user_id', userId).eq('organization_id', orgId).maybeSingle();
    if (error) return null;
    return data?.shifts_json || { 1: null, 2: null, 3: null };
  },
  saveActiveShifts: async (userId: string, shifts: any, orgId: string) => {
    if (!isConfigured()) return { error: 'Not configured' };
    
    const payload: any = { 
      user_id: userId, 
      shifts_json: shifts
    };
    
    if (orgId && orgId !== 'demo_org') {
      payload.organization_id = orgId;
    }

    try {
      // Пробуем с явным указанием onConflict по user_id
      const { error } = await supabase.from('active_shifts').upsert(payload, { onConflict: 'user_id' });
      
      if (error) {
        console.warn('First upsert attempt failed, trying fallback:', error);
        // Если ошибка в колонке organization_id
        if (error.message?.includes('column') || error.code === '42703') {
          const { organization_id, ...minimalPayload } = payload;
          const { error: retryError } = await supabase.from('active_shifts').upsert(minimalPayload, { onConflict: 'user_id' });
          return { error: retryError };
        }
        
        // Если ошибка в onConflict (например, нет индекса по user_id, но есть по (user_id, organization_id))
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
    const { data, error } = await supabase.from('active_shifts').select('*').eq('organization_id', orgId);
    if (error) {
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
    if (updates.notificationSettings) {
      dbUpdates.notification_settings = updates.notificationSettings;
      delete dbUpdates.notificationSettings;
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
      tables: {}
    };

    if (!results.config.urlSet || !results.config.keySet) {
      return { ...results, status: 'error', message: 'Supabase URL or Key is not configured in environment variables.' };
    }

    const tablesToCheck = ['organizations', 'users', 'work_logs', 'machines', 'positions', 'plans', 'promo_codes', 'active_shifts'];
    
    try {
      for (const table of tablesToCheck) {
        const { error } = await supabase.from(table).select('count', { count: 'exact', head: true }).limit(0);
        results.tables[table] = error ? { status: 'error', message: error.message } : { status: 'ok' };
      }
      
      const hasErrors = Object.values(results.tables).some((t: any) => t.status === 'error');
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
      isActive: p.is_active,
      lastUsedBy: p.last_used_by,
      lastUsedAt: p.last_used_at
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
      is_active: promo.isActive,
      last_used_by: promo.lastUsedBy,
      last_used_at: promo.lastUsedAt
    });
    if (error) console.error('Error saving promo code:', error);
  },
  deletePromoCode: async (id: string) => {
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
