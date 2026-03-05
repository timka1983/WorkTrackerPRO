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
