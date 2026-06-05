import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { exportToSheet } from '../../../../lib/sheetExport';

export const prerender = false;

export async function POST({ request, params }) {
  const surveyId = params.id;

  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ ok: false, error: 'Supabase admin chưa được cấu hình' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const webhookUrl = body.webhook_url?.trim();
    if (!webhookUrl) {
      return new Response(JSON.stringify({ ok: false, error: 'Thiếu webhook_url' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const [surveyRes, respRes] = await Promise.all([
      supabaseAdmin.from('surveys').select('*').eq('id', surveyId).single(),
      supabaseAdmin.from('survey_responses').select('*').eq('survey_id', surveyId).order('submitted_at', { ascending: true })
    ]);

    if (surveyRes.error) throw new Error('Không tìm thấy khảo sát');
    if (respRes.error) throw new Error('Lỗi lấy responses');

    const survey = surveyRes.data;
    const responses = respRes.data || [];
    const questions = survey.questions || [];

    if (responses.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Chưa có response nào' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const headers = questions.map(q => q.title || 'Câu hỏi ' + (questions.indexOf(q) + 1));
    const rows = responses.map((r, i) => ({
      stt: i + 1,
      time: new Date(r.submitted_at).toLocaleString('vi-VN'),
      answers: questions.map(q => r.answers?.[q.id] !== undefined ? String(r.answers[q.id]) : '')
    }));

    const result = await exportToSheet(webhookUrl, {
      title: survey.title,
      survey_id: surveyId,
      headers,
      rows
    });

    return new Response(JSON.stringify({
      ok: true,
      rows: rows.length,
      surveyTitle: survey.title,
      result
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
