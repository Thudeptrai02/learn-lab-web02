import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { appendToSheet, verifyAccess } from '../../../../lib/sheetExport';

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
    const sheetId = body.sheet_id?.trim();
    if (!sheetId) {
      return new Response(JSON.stringify({ ok: false, error: 'Thiếu sheet_id' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const [surveyRes, respRes] = await Promise.all([
      supabaseAdmin.from('surveys').select('*').eq('id', surveyId).single(),
      supabaseAdmin.from('survey_responses').select('*').eq('survey_id', surveyId).order('submitted_at', { ascending: true })
    ]);

    if (surveyRes.error) throw new Error('Không tìm thấy khảo sát');
    if (respRes.error) throw new Error('Lỗi lấy dữ liệu responses');

    const survey = surveyRes.data;
    const responses = respRes.data || [];
    const questions = survey.questions || [];

    if (responses.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Chưa có response nào để xuất' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const headers = questions.map(q => q.title || 'Câu hỏi ' + (questions.indexOf(q) + 1));

    const rows = responses.map(r => ({
      timestamp: new Date(r.submitted_at).toLocaleString('vi-VN'),
      answers: questions.map(q => {
        const val = r.answers?.[q.id];
        return val !== undefined ? String(val) : '';
      })
    }));

    if (body.verify_only) {
      const info = await verifyAccess(sheetId);
      return new Response(JSON.stringify({ ok: true, ...info, rowCount: rows.length, headers }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await appendToSheet(sheetId, headers, rows);
    return new Response(JSON.stringify({
      ok: true,
      rows: result.rows,
      surveyTitle: survey.title
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
