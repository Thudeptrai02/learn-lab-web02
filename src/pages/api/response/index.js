import { supabaseAdmin } from '../../../lib/supabase-admin';

export const prerender = false;

function noClient() {
  return new Response(JSON.stringify({ ok: false, error: 'Supabase admin chưa được cấu hình' }), {
    status: 500, headers: { 'Content-Type': 'application/json' }
  });
}

export async function GET({ url }) {
  if (!supabaseAdmin) return noClient();
  const surveyId = url.searchParams.get('survey_id');
  if (!surveyId) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing survey_id' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }
  const { data, error } = await supabaseAdmin
    .from('survey_responses')
    .select('*')
    .eq('survey_id', surveyId)
    .order('submitted_at', { ascending: true });

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
      .from('survey_responses')
      .insert({
        survey_id: body.survey_id,
        respondent_info: body.respondent_info || '',
        answers: body.answers || {},
        submitted_at: body.submitted_at || new Date().toISOString()
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
