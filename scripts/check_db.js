import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: subs, error: subErr } = await supabase
    .from('subscriptions')
    .select('*');
  
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('*');

  console.log('=== SUBSCRIPTIONS ===');
  console.log(JSON.stringify(subs, null, 2));

  console.log('\n=== PROFILES ===');
  console.log(JSON.stringify(profiles, null, 2));
}

check();
