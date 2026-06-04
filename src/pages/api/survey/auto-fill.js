export const prerender = false;

import { supabaseAdmin } from '../../../lib/supabase-admin';

export const POST = async ({ request }) => {
  try {
    const { slug, responses } = await request.json();

    if (!slug || !responses || !Array.isArray(responses) || responses.length === 0) {
      return new Response(JSON.stringify({ error: 'Thiếu slug hoặc responses' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: survey, error: surveyErr } = await supabaseAdmin
      .from('surveys')
      .select('id')
      .eq('slug', slug)
      .single();

    if (surveyErr || !survey) {
      return new Response(JSON.stringify({ error: 'Không tìm thấy khảo sát' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const { data: questions } = await supabaseAdmin
      .from('survey_questions')
      .select('id, variable_name')
      .eq('survey_id', survey.id);

    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ error: 'Survey chưa có câu hỏi' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const questionMap = {};
    questions.forEach(q => { questionMap[q.variable_name] = q.id; });

    let inserted = 0;
    const batchSize = 50;

    for (let i = 0; i < responses.length; i += batchSize) {
      const batch = responses.slice(i, i + batchSize);
      const responseRows = batch.map(r => ({
        survey_id: survey.id,
        respondent_id: r.respondentId || 'auto_fill',
        submitted_at: r.submittedAt || r.submitted_at || new Date().toISOString(),
        time_spent_seconds: r.timeSpentSeconds || r.time_spent_seconds || null,
        is_auto_fill: true,
        metadata: r.metadata || {}
      }));

      const { data: insertedResponses, error: respErr } = await supabaseAdmin
        .from('survey_responses')
        .insert(responseRows)
        .select('id');

      if (respErr) throw respErr;

      const answerRows = [];
      insertedResponses.forEach((resp, ri) => {
        const r = batch[ri];
        if (r.answers) {
          Object.entries(r.answers).forEach(([varName, value]) => {
            const qid = questionMap[varName];
            if (qid) {
              answerRows.push({ response_id: resp.id, question_id: qid, value: String(value ?? '') });
            }
          });
        }
      });

      if (answerRows.length > 0) {
        const { error: ansErr } = await supabaseAdmin
          .from('survey_answers')
          .insert(answerRows);
        if (ansErr) throw ansErr;
      }

      inserted += insertedResponses.length;
    }

    return new Response(JSON.stringify({ success: true, count: inserted }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
};
