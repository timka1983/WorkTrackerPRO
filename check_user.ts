import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('URL:', supabaseUrl);

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const email = 'TimkaZlt@gmail.com';
  const { data, error } = await supabase.from('organizations').select('*').eq('email', email);
  console.log('Organizations:', data);
  if (error) console.error('Error:', error);
}

main();
