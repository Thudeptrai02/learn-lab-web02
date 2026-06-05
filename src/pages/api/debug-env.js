export const prerender = false;

export async function GET() {
  const checks = {
    hasUrl: !!process.env.PUBLIC_SUPABASE_URL,
    hasAnonKey: !!process.env.PUBLIC_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    urlLen: (process.env.PUBLIC_SUPABASE_URL || '').length,
    serviceKeyLen: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length,
    nodeEnv: process.env.NODE_ENV,
    isVercel: process.env.VERCEL,
  };

  return new Response(JSON.stringify(checks, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
