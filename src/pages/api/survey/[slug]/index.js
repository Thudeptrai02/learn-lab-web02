export const prerender = false;

import { supabase } from '../../../../lib/supabase';

export const GET = async ({ params }) => {
  try {
    const { slug } = params;
    const { data: survey, error: surveyErr } = await supabase
      .from('surveys')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (surveyErr || !survey) {
      return new Response(JSON.stringify({ error: 'Không tìm thấy khảo sát' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: questions, error: qErr } = await supabase
      .from('survey_questions')
      .select('*')
      .eq('survey_id', survey.id)
      .order('order_index');

    if (qErr) throw qErr;

    return new Response(JSON.stringify({ survey, questions }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
};

export const POST = async ({ request, params }) => {
  try {
    const { slug } = params;
    const { answers, submittedAt, timeSpentSeconds, respondentId } = await request.json();

    const { data: survey, error: surveyErr } = await supabase
      .from('surveys')
      .select('id')
      .eq('slug', slug)
      .single();

    if (surveyErr || !survey) {
      return new Response(JSON.stringify({ error: 'Không tìm thấy khảo sát' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: response, error: respErr } = await supabase
      .from('survey_responses')
      .insert({
        survey_id: survey.id,
        submitted_at: submittedAt || new Date().toISOString(),
        time_spent_seconds: timeSpentSeconds || null,
        respondent_id: respondentId || '',
        is_auto_fill: false
      })
      .select()
      .single();

    if (respErr) throw respErr;

    const answerRows = answers.map(a => ({
      response_id: response.id,
      question_id: a.questionId || a.question_id,
      value: String(a.value ?? '')
    }));

    const { error: ansErr } = await supabase
      .from('survey_answers')
      .insert(answerRows);

    if (ansErr) throw ansErr;

    return new Response(JSON.stringify({ success: true, responseId: response.id }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
};
