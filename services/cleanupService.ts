import { supabase } from '../lib/supabase';

export const cleanupDatabase = async (orgId: string) => {
  console.log('Starting database cleanup for org:', orgId);
  const results = {
    usersFixed: 0,
    logsMoved: 0,
    errors: [] as string[]
  };

  try {
    // 1. Fetch all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('organization_id', orgId);

    if (usersError) throw usersError;
    if (!users) return results;

    const cleanUsers = new Map<string, any>();
    const dirtyUsers: any[] = [];

    // Separate clean and dirty users
    users.forEach(u => {
      if (u.id.startsWith('$')) {
        dirtyUsers.push(u);
      } else {
        cleanUsers.set(u.id, u);
      }
    });

    console.log(`Found ${dirtyUsers.length} dirty users and ${cleanUsers.size} clean users.`);

    // 2. Process dirty users
    for (const dirtyUser of dirtyUsers) {
      const cleanId = dirtyUser.id.replace(/^[^a-zA-Z0-9]+/, ''); // Remove leading non-alphanumeric
      
      if (!cleanId) {
        results.errors.push(`Skipping user ${dirtyUser.id} because clean ID is empty`);
        continue;
      }

      console.log(`Processing dirty user: ${dirtyUser.id} -> ${cleanId}`);

      // Check if clean version exists
      let cleanUser = cleanUsers.get(cleanId);

      if (!cleanUser) {
        console.log(`Creating clean user ${cleanId}...`);
        // Create clean user
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            ...dirtyUser,
            id: cleanId,
            organization_id: orgId // Ensure orgId is set
          })
          .select()
          .single();
        
        if (createError) {
          // If error is duplicate key (maybe we missed it in map?), try to fetch it
          if (createError.code === '23505') {
             console.log(`User ${cleanId} already exists (race condition?), fetching...`);
             const { data: existing } = await supabase.from('users').select('*').eq('id', cleanId).single();
             cleanUser = existing;
          } else {
            console.error('Failed to create clean user:', cleanId, createError);
            results.errors.push(`Failed to create user ${cleanId}: ${createError.message}`);
            continue;
          }
        } else {
          cleanUser = newUser;
        }
      }

      if (cleanUser) {
        // Move logs
        console.log(`Moving logs from ${dirtyUser.id} to ${cleanId}...`);
        const { error: updateError } = await supabase
          .from('work_logs')
          .update({ user_id: cleanId })
          .eq('user_id', dirtyUser.id);

        if (updateError) {
          console.error('Failed to move logs:', updateError);
          results.errors.push(`Failed to move logs for ${dirtyUser.id}: ${updateError.message}`);
        } else {
          // We don't get count easily from JS client update without select, but assume success
          results.logsMoved++;
        }

        // Delete dirty user
        console.log(`Deleting dirty user ${dirtyUser.id}...`);
        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', dirtyUser.id);
          
        if (deleteError) {
          console.error('Failed to delete dirty user:', deleteError);
          results.errors.push(`Failed to delete user ${dirtyUser.id}: ${deleteError.message}`);
        } else {
          results.usersFixed++;
        }
      }
    }

    // 3. Clean up logs with dirty IDs that might not have a user (orphaned logs)
    // This is harder to do efficiently without raw SQL. 
    // We'll skip this for now as the main issue is duplicate users in the report.

  } catch (e: any) {
    console.error('Database cleanup failed:', e);
    results.errors.push(e.message);
  }

  return results;
};

export const removeBase64Photos = async (orgId: string) => {
  console.log('Starting Base64 photos cleanup for org:', orgId);
  const results = {
    photosRemoved: 0,
    errors: [] as string[]
  };

  try {
    // 1. Fetch all logs (we have to fetch them to check content unfortunately, 
    // unless we can do a SQL query like "WHERE photo_in LIKE 'data:%'")
    // Since we can't do LIKE on encrypted/text fields easily without knowing schema specifics or using RPC,
    // we'll try to fetch logs in batches or just use the client side filter if the dataset isn't too huge.
    // BUT, fetching huge base64 logs is exactly what causes the egress issue.
    
    // Better approach: Use a specific RPC if possible, but we can't create one here.
    // So we will try to select only ID and photo fields to minimize data, but even that is heavy.
    // Actually, we can use the `like` filter in Supabase client!
    
    // Find logs with photo_in as base64
    const { data: logsIn, error: errorIn } = await supabase
      .from('work_logs')
      .select('id')
      .eq('organization_id', orgId)
      .ilike('photo_in', 'data:%');

    if (errorIn) throw errorIn;

    // Find logs with photo_out as base64
    const { data: logsOut, error: errorOut } = await supabase
      .from('work_logs')
      .select('id')
      .eq('organization_id', orgId)
      .ilike('photo_out', 'data:%');

    if (errorOut) throw errorOut;

    const idsIn = (logsIn || []).map(l => l.id);
    const idsOut = (logsOut || []).map(l => l.id);
    const allIds = Array.from(new Set([...idsIn, ...idsOut]));

    console.log(`Found ${allIds.length} logs with Base64 photos.`);

    // Update in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      const batchIds = allIds.slice(i, i + BATCH_SIZE);
      
      // We set them to null. 
      // Note: We can't easily distinguish which one was base64 in a single update if we just have IDs,
      // so we might clear both if one of them is base64, OR we have to be more specific.
      // To be safe and simple: we will clear BOTH photo fields for these logs. 
      // If the user wants to keep the non-base64 one, this logic is imperfect.
      // But usually if one is base64, the system configuration was wrong for both.
      
      // A better way: Update photo_in where id in idsIn, update photo_out where id in idsOut.
      
      const batchIn = idsIn.filter(id => batchIds.includes(id));
      const batchOut = idsOut.filter(id => batchIds.includes(id));

      if (batchIn.length > 0) {
        await supabase
          .from('work_logs')
          .update({ photo_in: null })
          .in('id', batchIn);
      }

      if (batchOut.length > 0) {
        await supabase
          .from('work_logs')
          .update({ photo_out: null })
          .in('id', batchOut);
      }
      
      results.photosRemoved += batchIds.length; // Approximate count
    }

  } catch (e: any) {
    console.error('Base64 cleanup failed:', e);
    results.errors.push(e.message);
  }

  return results;
};

export const mergeDuplicateUsersByName = async (orgId: string) => {
  const results = { mergedGroups: 0, usersDeleted: 0, logsMoved: 0, errors: [] as string[] };
  try {
    // 1. Get users
    const { data: users, error } = await supabase.from('users').select('*').eq('organization_id', orgId);
    if (error) throw error;
    
    // 2. Group
    const groups = new Map<string, any[]>();
    users.forEach(u => {
      const key = u.name.trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(u);
    });
    
    // 3. Process
    for (const [name, group] of groups) {
      if (group.length < 2) continue;
      
      console.log(`Merging duplicates for "${name}" (${group.length} users)`);
      
      // Find master: prefer one with most logs, or oldest created_at, or just first
      // We need to check log counts.
      const counts = await Promise.all(group.map(async u => {
        const { count } = await supabase.from('work_logs').select('id', { count: 'exact', head: true }).eq('user_id', u.id);
        return { user: u, count: count || 0 };
      }));
      
      // Sort: Max logs first, then ID length (shorter is usually better/cleaner), then alphanumeric
      counts.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.user.id.length - b.user.id.length; // Prefer shorter IDs (usually clean ones)
      });
      
      const master = counts[0].user;
      const slaves = counts.slice(1).map(c => c.user);
      
      // Move logs
      const slaveIds = slaves.map(u => u.id);
      const { error: moveError } = await supabase
        .from('work_logs')
        .update({ user_id: master.id })
        .in('user_id', slaveIds);
        
      if (moveError) {
        results.errors.push(`Failed to move logs for ${name}: ${moveError.message}`);
        continue;
      }

      // Delete active shifts for slaves
      await supabase.from('active_shifts').delete().in('user_id', slaveIds);
      
      // Delete slaves
      const { error: delError } = await supabase
        .from('users')
        .delete()
        .in('id', slaveIds);
        
      if (delError) {
        results.errors.push(`Failed to delete duplicate users for ${name}: ${delError.message}`);
      } else {
        results.mergedGroups++;
        results.usersDeleted += slaves.length;
        results.logsMoved += 1; // Just counting groups processed
      }
    }
    
  } catch (e: any) {
    results.errors.push(e.message);
  }
  return results;
};

export const checkDuplicatePositions = async (orgId: string) => {
  const { data: positions } = await supabase.from('positions').select('*').eq('organization_id', orgId);
  if (!positions) return [];
  
  const groups = new Map<string, any[]>();
  positions.forEach(p => {
    const key = p.name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(p);
  });
  
  const duplicates: any[] = [];
  groups.forEach((group, name) => {
    if (group.length > 1) {
      duplicates.push({ name, count: group.length, ids: group.map(p => p.id) });
    }
  });
  return duplicates;
};

export const fixDuplicatePositions = async (orgId: string) => {
  const duplicates = await checkDuplicatePositions(orgId);
  let fixedCount = 0;
  
  for (const dup of duplicates) {
    // If we have IDs, try to delete by ID
    if (dup.ids && dup.ids.length > 0 && dup.ids[0] !== undefined) {
        const toDelete = dup.ids.slice(1);
        const { error } = await supabase.from('positions').delete().in('id', toDelete);
        
        if (!error) {
            fixedCount += toDelete.length;
            continue;
        }
        // If error is "column does not exist", fall through to name-based logic
        if (error.code !== '42703') {
            console.error('Error deleting positions:', error);
            continue;
        }
    }
    
    // Fallback: Delete ALL by name and re-insert ONE
    console.warn(`Re-creating position "${dup.name}" to fix duplicates...`);
    
    // 1. Get the data of the one we want to keep (first one)
    const { data: allPos } = await supabase.from('positions').select('*').eq('name', dup.name).eq('organization_id', orgId);
    
    if (allPos && allPos.length > 1) {
      const keeper = allPos[0];
      
      // 2. Delete ALL with this name
      await supabase.from('positions').delete().eq('name', dup.name).eq('organization_id', orgId);
      
      // 3. Insert ONE back
      // Remove ID if it exists but is null/undefined to let DB generate it if needed, 
      // or just insert as is if we want to keep properties
      const { id, ...rest } = keeper; 
      await supabase.from('positions').insert(rest);
      
      fixedCount += (allPos.length - 1);
    }
  }
  return fixedCount;
};

export const checkDuplicateActiveShifts = async (orgId: string) => {
  const { data: shifts } = await supabase.from('active_shifts').select('*').eq('organization_id', orgId);
  if (!shifts) return [];
  
  const groups = new Map<string, any[]>();
  shifts.forEach(s => {
    const key = s.user_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(s);
  });
  
  const duplicates: any[] = [];
  groups.forEach((group, userId) => {
    if (group.length > 1) {
      duplicates.push({ userId, count: group.length, ids: group.map(s => s.id) });
    }
  });
  return duplicates;
};

export const fixDuplicateActiveShifts = async (orgId: string) => {
  const duplicates = await checkDuplicateActiveShifts(orgId);
  let fixedCount = 0;
  
  for (const dup of duplicates) {
    const toDelete = dup.ids.slice(1);
    await supabase.from('active_shifts').delete().in('id', toDelete);
    fixedCount += toDelete.length;
  }
  return fixedCount;
};

export const checkDuplicateMachines = async (orgId: string) => {
  const { data: machines } = await supabase.from('machines').select('*').eq('organization_id', orgId).eq('is_archived', false);
  if (!machines) return [];
  
  const groups = new Map<string, any[]>();
  machines.forEach(m => {
    const key = m.name.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(m);
  });
  
  const duplicates: any[] = [];
  groups.forEach((group, name) => {
    if (group.length > 1) {
      duplicates.push({ name, count: group.length, machines: group });
    }
  });
  return duplicates;
};

export const fixDuplicateMachines = async (orgId: string) => {
  const duplicates = await checkDuplicateMachines(orgId);
  let fixedCount = 0;
  
  for (const dup of duplicates) {
    const machines = dup.machines;
    
    // Check log counts for each machine
    const counts = await Promise.all(machines.map(async (m: any) => {
      const { count } = await supabase.from('work_logs').select('id', { count: 'exact', head: true }).eq('machine_id', m.id);
      return { machine: m, count: count || 0 };
    }));
    
    counts.sort((a, b) => b.count - a.count);
    
    const master = counts[0].machine;
    const slaves = counts.slice(1).map(c => c.machine);
    const slaveIds = slaves.map(m => m.id);
    
    // 1. Move logs
    await supabase.from('work_logs').update({ machine_id: master.id }).in('machine_id', slaveIds);
    
    // 2. Update active shifts
    const { data: activeShifts } = await supabase.from('active_shifts').select('*').eq('organization_id', orgId);
    if (activeShifts) {
      for (const shift of activeShifts) {
        let changed = false;
        let shiftsObj = shift.shifts_json || shift.shifts || {};
        if (typeof shiftsObj === 'string') {
          try { shiftsObj = JSON.parse(shiftsObj); } catch (e) { shiftsObj = {}; }
        }
        
        Object.keys(shiftsObj).forEach(slot => {
          if (shiftsObj[slot] && slaveIds.includes(shiftsObj[slot].machineId)) {
            shiftsObj[slot].machineId = master.id;
            changed = true;
          }
        });
        
        if (changed) {
          await supabase.from('active_shifts').update({ 
            shifts_json: shiftsObj,
            shifts: shiftsObj 
          }).eq('id', shift.id);
        }
      }
    }
    
    // 3. Delete slaves
    await supabase.from('machines').delete().in('id', slaveIds);
    
    fixedCount += slaves.length;
  }
  return fixedCount;
};
