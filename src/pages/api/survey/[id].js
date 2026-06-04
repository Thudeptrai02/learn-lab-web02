import { supabaseAdmin } from '../../../lib/supabase-admin';

export const prerender = false;

function noClient() {
  return new Response(JSON.stringify({ ok: false, error: 'Supabase admin chưa được cấu hình' }), {
    status: 500, headers: { 'Content-Type': 'application/json' }
  });
}

export async function GET({ params }) {
  if (!supabaseAdmin) return noClient();
  const { data, error } = await supabaseAdmin
    .from('surveys')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}

export async function PUT({ request, params }) {
  if (!supabaseAdmin) return noClient();
  try {
    const body = await request.json();
    const updates = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.questions !== undefined) updates.questions = body.questions;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('surveys')
      .update(updates)
      .eq('id', params.id)
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

export async function DELETE({ params }) {
  if (!supabaseAdmin) return noClient();
  const { error } = await supabaseAdmin
    .from('surveys')
    .delete()
    .eq('id', params.id);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  });
}
