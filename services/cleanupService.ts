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
