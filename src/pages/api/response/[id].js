import { supabaseAdmin } from '../../../lib/supabase-admin';

export const prerender = false;

export async function DELETE({ params }) {
  const { error } = await supabaseAdmin
    .from('survey_responses')
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

export async function PUT({ request, params }) {
  try {
    const body = await request.json();
    const updates = {};
    if (body.answers !== undefined) updates.answers = body.answers;
    if (body.submitted_at !== undefined) updates.submitted_at = body.submitted_at;

    const { data, error } = await supabaseAdmin
      .from('survey_responses')
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
