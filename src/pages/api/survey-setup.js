import { supabaseAdmin } from '../../lib/supabase-admin';

export const prerender = false;

export async function POST({ request }) {
  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ ok: false, error: 'Supabase admin chưa được cấu hình. Thêm SUPABASE_SERVICE_ROLE_KEY vào Vercel env.', hint: 'Vào Vercel Dashboard → Project Settings → Environment Variables → thêm SUPABASE_SERVICE_ROLE_KEY với giá trị từ .env' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }
  try {
    const { error } = await supabaseAdmin.rpc('setup_survey_tables');
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message, hint: 'Chạy SQL trong supabase/migrations/002_create_survey_tables.sql qua Supabase Dashboard SQL Editor.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ ok: true, message: 'Tables created successfully' }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
