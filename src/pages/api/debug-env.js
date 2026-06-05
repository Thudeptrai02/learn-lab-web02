export const prerender = false;

export async function GET() {
  const checks = {
    SUPABASE_SERVICE_ROLE_KEY: !!import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
    PUBLIC_SUPABASE_URL: !!import.meta.env.PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY: !!import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    NODE_ENV: import.meta.env.NODE_ENV || 'not set',
    VERCEL: import.meta.env.VERCEL || 'not set',
    key_length: (import.meta.env.SUPABASE_SERVICE_ROLE_KEY || '').length
  };

  return new Response(JSON.stringify(checks, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
