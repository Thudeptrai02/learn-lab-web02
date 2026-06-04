import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAdminKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdmin = null;
try {
  if (supabaseUrl && supabaseAdminKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey);
  }
} catch (e) {
  console.error('Failed to create supabase admin client:', e.message);
}

export { supabaseAdmin };
