import { supabaseAdmin } from '../../../lib/supabase-admin';

export const prerender = false;

function noClient() {
  return new Response(JSON.stringify({ ok: false, error: 'Supabase admin chưa được cấu hình. Vui lòng thêm SUPABASE_SERVICE_ROLE_KEY vào Vercel env.' }), {
    status: 500, headers: { 'Content-Type': 'application/json' }
  });
}

export async function GET() {
  if (!supabaseAdmin) return noClient();
  const { data, error } = await supabaseAdmin
    .from('surveys')
    .select('id, title, description, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST({ request }) {
  if (!supabaseAdmin) return noClient();
  try {
    const body = await request.json();
    const { data, error } = await supabaseAdmin
      .from('surveys')
      .insert({
        title: body.title || 'Khảo sát mới',
        description: body.description || '',
        questions: body.questions || []
      })
      .select()
      .single();

    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
