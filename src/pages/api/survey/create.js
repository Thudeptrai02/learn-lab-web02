export const prerender = false;

import { supabaseAdmin } from '../../../lib/supabase-admin';

export const POST = async ({ request }) => {
  try {
    const { title, description, introText, thankYouText, questions } = await request.json();

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ error: 'Thiếu title hoặc questions' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const slug = 'khao-sat-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);

    const { data: survey, error: surveyErr } = await supabaseAdmin
      .from('surveys')
      .insert({ slug, title, description: description || '', intro_text: introText || '', thank_you_text: thankYouText || 'Cảm ơn bạn đã hoàn thành khảo sát!' })
      .select()
      .single();

    if (surveyErr) throw surveyErr;

    const questionRows = questions.map((q, i) => ({
      survey_id: survey.id,
      construct: q.construct || '',
      construct_label: q.constructLabel || '',
      variable_name: q.variableName || q.variable_name || '',
      question_text: q.questionText || q.question_text || '',
      question_type: q.questionType || 'likert5',
      order_index: i,
      required: q.required !== false
    }));

    const { error: qErr } = await supabaseAdmin
      .from('survey_questions')
      .insert(questionRows);

    if (qErr) throw qErr;

    return new Response(JSON.stringify({ success: true, slug, id: survey.id, title, url: '/survey/' + slug }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
};
