import { createClient } from '@supabase/supabase-js';

function getEnv(name) {
  return import.meta.env[name] ?? process.env[name] ?? '';
}

const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL');
const supabaseAdminKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

let supabaseAdmin = null;
try {
  if (supabaseUrl && supabaseAdminKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);
  }
} catch (e) {
  console.error('Failed to create supabase admin client:', e.message);
}

export { supabaseAdmin };
